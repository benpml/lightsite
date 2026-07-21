import { createHmac } from "node:crypto";
import { Router, type Request } from "express";
import type { ZodError } from "zod";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
  trackingV2EventBatchResponseSchema,
  trackingV2EventBatchSchema,
  trackingV2EntityIdSchema,
  trackingV2RecordingUploadSchema,
  trackingV2RecordingCompleteSchema,
  trackingV2SessionEndSchema,
  trackingV2SessionHeartbeatSchema,
  trackingV2SessionStartRequestSchema,
  trackingV2SessionStartResponseSchema,
} from "@handout/tracking-schema";

import { asyncHandler } from "../../http/async-handler";
import { AppError, issuesFromZodError } from "../../http/errors";
import type { TrackingRateLimiter } from "../rate-limit";
import type { TrackingV2ContextTokenService } from "./context-token";
import {
  TrackingV2InvalidContextError,
  TrackingV2RecordingUnavailableError,
  type TrackingV2RequestSnapshot,
  type TrackingV2Service,
} from "./service";
import {
  TrackingV2RecordingInvalidError,
  TrackingV2RecordingLimitError,
} from "./recording-service";

export type CreateTrackingV2RouterOptions = {
  contextTokens: TrackingV2ContextTokenService;
  trackingService: TrackingV2Service;
  rateLimiter?: TrackingRateLimiter;
  rateLimitKeySecret: string;
  trustCloudflareGeoHeaders?: boolean;
};

export function createTrackingV2Router(options: CreateTrackingV2RouterOptions) {
  const router = Router();

  router.post(`${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/:recordingId/chunks`, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const recordingId = trackingV2EntityIdSchema.safeParse(request.params.recordingId ?? "");
    const upload = trackingV2RecordingUploadSchema.safeParse(request.body);
    const uploadToken = bearerToken(request);
    if (!recordingId.success || !upload.success || !uploadToken) {
      throw invalidPayload(!upload.success ? upload.error : recordingId.success ? undefined : recordingId.error);
    }
    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:recording:${recordingId.data}`,
      eventCount: Math.max(1, Math.ceil(Buffer.byteLength(JSON.stringify(request.body), "utf8") / 8_192)),
      response,
    });
    const result = await mapRecordingError(() => options.trackingService.recordRecordingChunk({
      recordingId: recordingId.data,
      uploadToken,
      upload: upload.data,
    }));
    response.status(result.duplicate ? 200 : 201).setHeader("cache-control", "no-store").json(result);
  }));

  router.post(`${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/:recordingId/complete`, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const recordingId = trackingV2EntityIdSchema.safeParse(request.params.recordingId ?? "");
    const complete = trackingV2RecordingCompleteSchema.safeParse(request.body);
    const uploadToken = bearerToken(request);
    if (!recordingId.success || !complete.success || !uploadToken) {
      throw invalidPayload(!complete.success ? complete.error : recordingId.success ? undefined : recordingId.error);
    }
    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:recording-complete:${recordingId.data}`,
      eventCount: 1,
      response,
    });
    const result = await mapRecordingError(() => options.trackingService.completeRecording({
      recordingId: recordingId.data,
      uploadToken,
      complete: complete.data,
    }));
    response.status(200).setHeader("cache-control", "no-store").json(result);
  }));

  router.post(TRACKING_V2_SESSION_START_ENDPOINT, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const parsed = trackingV2SessionStartRequestSchema.safeParse(request.body);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const context = options.contextTokens.verify(parsed.data.contextToken);
    if (!context) throw invalidContext();

    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:start:${context.workspaceId}:${context.siteId}:${ephemeralNetworkKey(request.ip, options.rateLimitKeySecret)}`,
      eventCount: 1,
      response,
    });
    const result = await mapInvalidContext(() => options.trackingService.startSession({
      context,
      request: parsed.data,
      requestSnapshot: requestSnapshot(request, options.trustCloudflareGeoHeaders === true),
    }));
    response.json(trackingV2SessionStartResponseSchema.parse(result));
  }));

  router.post(TRACKING_V2_EVENTS_ENDPOINT, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const parsed = trackingV2EventBatchSchema.safeParse(request.body);
    if (!parsed.success) throw invalidPayload(parsed.error);
    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:events:${parsed.data.sessionId}`,
      eventCount: parsed.data.events.length,
      response,
    });
    const result = await mapInvalidContext(() => options.trackingService.recordEventBatch(parsed.data));
    response.status(200).json(trackingV2EventBatchResponseSchema.parse(result));
  }));

  router.post(TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const parsed = trackingV2SessionHeartbeatSchema.safeParse(request.body);
    if (!parsed.success) throw invalidPayload(parsed.error);
    await checkRateLimit(options.rateLimiter, {
      key: `tracking-v2:heartbeat:${parsed.data.sessionId}`,
      eventCount: 1,
      response,
    });
    await mapInvalidContext(() => options.trackingService.recordHeartbeat(parsed.data));
    response.status(204).send();
  }));

  router.post(TRACKING_V2_SESSION_END_ENDPOINT, asyncHandler(async (request, response) => {
    enforceSameOrigin(request);
    const parsed = trackingV2SessionEndSchema.safeParse(request.body);
    if (!parsed.success) throw invalidPayload(parsed.error);
    await mapInvalidContext(() => options.trackingService.endSession(parsed.data));
    response.status(204).send();
  }));

  return router;
}

function requestSnapshot(request: Request, trustCloudflareGeoHeaders: boolean): TrackingV2RequestSnapshot {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent") ?? null,
    city: trustCloudflareGeoHeaders ? request.get("cf-ipcity") ?? null : null,
    region: trustCloudflareGeoHeaders ? request.get("cf-region") ?? null : null,
    countryCode: trustCloudflareGeoHeaders ? request.get("cf-ipcountry") ?? null : null,
  };
}

function ephemeralNetworkKey(ipAddress: string | undefined, secret: string) {
  const bucket = Math.floor(Date.now() / (15 * 60_000));
  return createHmac("sha256", secret)
    .update("tracking-rate-limit")
    .update("\0").update(String(bucket))
    .update("\0").update(ipAddress ?? "unknown")
    .digest("base64url");
}

function enforceSameOrigin(request: Request) {
  const origin = request.get("origin");
  if (!origin) return;
  try {
    const expected = `${request.protocol}://${request.get("host")}`;
    if (new URL(origin).origin === expected) return;
  } catch {
    // Invalid origins are rejected below.
  }
  throw new AppError({ code: "tracking.invalid_context", message: "Invalid tracking origin.", status: 403 });
}

function invalidPayload(error?: ZodError) {
  return new AppError({
    code: "tracking.invalid_payload",
    message: "Invalid tracking payload.",
    status: 400,
    ...(error ? { issues: issuesFromZodError(error) } : {}),
  });
}

function bearerToken(request: Request) {
  const authorization = request.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 && token.length <= 2_048 ? token : null;
}

async function mapRecordingError<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TrackingV2RecordingInvalidError) {
      throw new AppError({ code: "tracking.invalid_context", message: "Invalid recording upload.", status: 400 });
    }
    if (error instanceof TrackingV2RecordingLimitError) {
      throw new AppError({
        code: error.code === "daily_cap" ? "tracking.rate_limited" : "request.too_large",
        message: "The session replay limit has been reached.",
        status: error.code === "daily_cap" ? 429 : 413,
      });
    }
    if (error instanceof TrackingV2RecordingUnavailableError) {
      throw new AppError({ code: "tracking.unavailable", message: "Session replay is unavailable.", status: 503 });
    }
    throw error;
  }
}

function invalidContext() {
  return new AppError({ code: "tracking.invalid_context", message: "Invalid tracking context.", status: 400 });
}

async function mapInvalidContext<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TrackingV2InvalidContextError) throw invalidContext();
    throw error;
  }
}

async function checkRateLimit(
  rateLimiter: TrackingRateLimiter | undefined,
  input: { key: string; eventCount: number; response: { setHeader(name: string, value: string): void } },
) {
  if (!rateLimiter) return;
  const result = await rateLimiter.check({ key: input.key, eventCount: input.eventCount });
  if (!result.allowed) {
    input.response.setHeader("retry-after", String(result.retryAfterSeconds));
    throw new AppError({
      code: "tracking.rate_limited",
      message: "Tracking is receiving too many events. Try again shortly.",
      status: 429,
    });
  }
}
