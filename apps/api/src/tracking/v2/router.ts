import { Router } from "express";
import type { ZodError } from "zod";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
  trackingV2EventBatchSchema,
  trackingV2RecordingChunkSchema,
  trackingV2RecordingCompleteSchema,
  trackingV2SessionEndSchema,
  trackingV2SessionHeartbeatSchema,
  trackingV2SessionStartRequestSchema,
  trackingV2SessionStartResponseSchema,
} from "@lightsite/tracking-schema";
import { asyncHandler } from "../../http/async-handler";
import { AppError, issuesFromZodError } from "../../http/errors";
import type { TrackingRateLimiter } from "../rate-limit";
import type { TrackingV2ContextTokenService } from "./context-token";
import {
  TrackingV2InvalidContextError,
  TrackingV2RecordingLimitError,
  type TrackingV2RequestSnapshot,
  type TrackingV2Service,
} from "./service";

export type CreateTrackingV2RouterOptions = {
  contextTokens: TrackingV2ContextTokenService;
  trackingService: TrackingV2Service;
  rateLimiter?: TrackingRateLimiter;
};

export function createTrackingV2Router(options: CreateTrackingV2RouterOptions) {
  const router = Router();
  const recordingChunkRoute = `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/:recordingId/chunks`;
  const recordingCompleteRoute = `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/:recordingId/complete`;

  router.post(recordingChunkRoute, asyncHandler(async (request, response) => {
    const parsed = trackingV2RecordingChunkSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:recording:${request.params.recordingId ?? "unknown"}`,
      eventCount: Math.max(
        1,
        Math.ceil(Buffer.byteLength(JSON.stringify(parsed.data), "utf8") / (16 * 1024)),
      ),
      response,
    });

    const result = await mapInvalidContext(() => options.trackingService.recordRecordingChunk({
      recordingId: request.params.recordingId ?? "",
      uploadToken: getBearerToken(request) ?? "",
      chunk: parsed.data,
    }));

    response.status(result.duplicate ? 200 : 201).json(result);
  }));

  router.post(recordingCompleteRoute, asyncHandler(async (request, response) => {
    const parsed = trackingV2RecordingCompleteSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:recording-complete:${request.params.recordingId ?? "unknown"}`,
      eventCount: 1,
      response,
    });

    const result = await mapInvalidContext(() => options.trackingService.completeRecording({
      recordingId: request.params.recordingId ?? "",
      uploadToken: getBearerToken(request) ?? "",
      complete: parsed.data,
    }));

    response.status(200).json(result);
  }));

  router.post(TRACKING_V2_SESSION_START_ENDPOINT, asyncHandler(async (request, response) => {
    const parsed = trackingV2SessionStartRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    const context = options.contextTokens.verify(parsed.data.contextToken);
    if (!context) {
      throw invalidContext();
    }

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:start:${context.workspaceId}:${context.siteId}:${context.recipientId ?? "default"}:${getRateLimitIp(request)}`,
      eventCount: 1,
      response,
    });

    const startResponse = await options.trackingService.startSession({
      context,
      request: parsed.data,
      requestSnapshot: getRequestSnapshot(request),
    });

    response.json(trackingV2SessionStartResponseSchema.parse(startResponse));
  }));

  router.post(TRACKING_V2_EVENTS_ENDPOINT, asyncHandler(async (request, response) => {
    const parsed = trackingV2EventBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:events:${parsed.data.sessionId}`,
      eventCount: parsed.data.events.length,
      response,
    });

    await mapInvalidContext(() => options.trackingService.recordEventBatch(parsed.data));
    response.status(204).send();
  }));

  router.post(TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT, asyncHandler(async (request, response) => {
    const parsed = trackingV2SessionHeartbeatSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:heartbeat:${parsed.data.sessionId}`,
      eventCount: 1,
      response,
    });

    await mapInvalidContext(() => options.trackingService.recordHeartbeat(parsed.data));
    response.status(204).send();
  }));

  router.post(TRACKING_V2_SESSION_END_ENDPOINT, asyncHandler(async (request, response) => {
    const parsed = trackingV2SessionEndSchema.safeParse(request.body);

    if (!parsed.success) {
      throw invalidPayload(parsed.error);
    }

    await mapInvalidContext(() => options.trackingService.endSession(parsed.data));
    response.status(204).send();
  }));

  return router;
}

function invalidPayload(error: ZodError) {
  return new AppError({
    code: "tracking.invalid_payload",
    message: "Invalid tracking payload.",
    status: 400,
    issues: issuesFromZodError(error),
  });
}

function invalidContext() {
  return new AppError({
    code: "tracking.invalid_context",
    message: "Invalid tracking context.",
    status: 400,
  });
}

async function mapInvalidContext<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TrackingV2InvalidContextError) {
      throw invalidContext();
    }

    if (error instanceof TrackingV2RecordingLimitError) {
      throw new AppError({
        code: "tracking.recording_limited",
        message: "Recording upload limit exceeded.",
        status: 413,
      });
    }

    throw error;
  }
}

async function checkRateLimit(
  rateLimiter: TrackingRateLimiter | undefined,
  input: {
    key: string;
    eventCount: number;
    response: { setHeader(name: string, value: string): void };
    throwOnLimit?: boolean;
  },
) {
  if (!rateLimiter) {
    return;
  }

  const result = await rateLimiter.check({
    key: input.key,
    eventCount: input.eventCount,
  });

  if (!result.allowed) {
    input.response.setHeader("retry-after", String(result.retryAfterSeconds));

    if (input.throwOnLimit === false) {
      return false;
    }

    throw new AppError({
      code: "tracking.rate_limited",
      message: "Tracking is receiving too many events. Try again shortly.",
      status: 429,
    });
  }

  return true;
}

function getRequestSnapshot(request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): TrackingV2RequestSnapshot {
  return {
    ipAddress: getRateLimitIp(request),
    userAgent: firstHeader(request, "user-agent"),
    city: firstHeader(request, "cf-ipcity"),
    region: firstHeader(request, "cf-region"),
    countryCode: firstHeader(request, "cf-ipcountry"),
  };
}

function getRateLimitIp(request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  return firstHeader(request, "cf-connecting-ip") ??
    firstHeader(request, "x-forwarded-for") ??
    request.ip ??
    "unknown";
}

function firstHeader(
  request: { headers: Record<string, string | string[] | undefined> },
  name: string,
) {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getBearerToken(request: {
  headers: Record<string, string | string[] | undefined>;
}) {
  const authorization = firstHeader(request, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return match?.[1]?.trim() || null;
}
