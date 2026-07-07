import { Router } from "express";
import { z } from "zod";
import {
  TRACKING_INGEST_ENDPOINT,
  TRACKING_MAX_BATCH_EVENTS,
  TRACKING_MAX_CLICK_LABEL_LENGTH,
  TRACKING_MAX_CONTEXT_TOKEN_LENGTH,
  TRACKING_MAX_HEARTBEAT_SECONDS,
  TRACKING_MAX_ID_LENGTH,
  TRACKING_MAX_REFERRER_HOST_LENGTH,
  TRACKING_MAX_URL_LENGTH,
  TRACKING_SCRIPT_VERSION,
  previewPlatforms,
  previewResources,
  sanitizeTrackedUrl,
  trackingEventTypes,
  type TrackingBatch,
} from "@lightsite/tracking-schema";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import { logger } from "../lib/logger";
import type { TrackingContextTokenService } from "./context-token";
import { createNoopTrackingEventSink, type TrackingEventSink } from "./event-sink";
import type { TrackingRateLimiter } from "./rate-limit";
import { TrackingUnavailableError } from "./service";

const trackingContextSchema = z.object({
  workspaceId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  siteId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  publishedVersionId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  variantId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH).nullable(),
  variantRevision: z.number().int().nonnegative().nullable(),
  mode: z.enum(["off", "essential_only", "engagement"]),
  token: z.string().min(1).max(TRACKING_MAX_CONTEXT_TOKEN_LENGTH),
});

const trackingEventBaseSchema = z.object({
  eventId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  type: z.enum(trackingEventTypes),
  occurredAt: z.iso.datetime(),
  sessionId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  context: trackingContextSchema,
  scriptVersion: z.literal(TRACKING_SCRIPT_VERSION),
});

const trackingScrollThresholdSchema = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(90),
  z.literal(100),
]);

const sanitizedUrlSchema = z.string()
  .url()
  .max(TRACKING_MAX_URL_LENGTH)
  .refine((value) => sanitizeTrackedUrl(value) === value, "Target URL must not include credentials, query strings, or fragments.");

const referrerHostSchema = z.string()
  .min(1)
  .max(TRACKING_MAX_REFERRER_HOST_LENGTH)
  .regex(/^[a-z0-9.-]+$/i)
  .nullable();

const trackingEventSchema = z.discriminatedUnion("type", [
  trackingEventBaseSchema.extend({
    type: z.literal("site_viewed"),
    viewport: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    referrerHost: referrerHostSchema,
  }),
  trackingEventBaseSchema.extend({
    type: z.literal("heartbeat"),
    engagedSeconds: z.number().int().min(1).max(TRACKING_MAX_HEARTBEAT_SECONDS),
    maxScrollDepthPercent: z.number().int().min(0).max(100),
  }),
  trackingEventBaseSchema.extend({
    type: z.literal("scroll_depth_reached"),
    depthPercent: trackingScrollThresholdSchema,
  }),
  trackingEventBaseSchema.extend({
    type: z.enum(["element_clicked", "button_clicked", "link_clicked", "calendar_booked"]),
    elementId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
    label: z.string().min(1).max(TRACKING_MAX_CLICK_LABEL_LENGTH),
    href: sanitizedUrlSchema.nullable(),
  }),
  trackingEventBaseSchema.extend({
    type: z.literal("link_preview_loaded"),
    platform: z.enum(previewPlatforms),
    resource: z.enum(previewResources),
    userAgentFamily: z.string().min(1).max(80),
  }),
]);

const trackingBatchSchema = z.object({
  batchId: z.string().min(1).max(TRACKING_MAX_ID_LENGTH),
  sentAt: z.iso.datetime(),
  events: z.array(trackingEventSchema).min(1).max(TRACKING_MAX_BATCH_EVENTS),
});

export type CreateTrackingRouterOptions = {
  contextTokens: TrackingContextTokenService;
  contextIsCurrentlyAcceptable: (context: TrackingBatch["events"][number]["context"]) => Promise<boolean>;
  eventSink?: TrackingEventSink;
  rateLimiter: TrackingRateLimiter;
};

export function createTrackingRouter(options: CreateTrackingRouterOptions) {
  const trackingRouter = Router();
  const eventSink = options.eventSink ?? createNoopTrackingEventSink();

  trackingRouter.post(TRACKING_INGEST_ENDPOINT, asyncHandler(async (request, response) => {
    const parsed = trackingBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError({
        code: "tracking.invalid_payload",
        message: "Invalid tracking payload.",
        status: 400,
        issues: issuesFromZodError(parsed.error),
      });
    }

    const batch = parsed.data as TrackingBatch;

    if (
      !hasSingleTrackingScope(batch) ||
      !hasCoherentVariantContext(batch) ||
      !hasAllowedTrackingModeEvents(batch) ||
      !batch.events.every((event) => options.contextTokens.verify(event.context))
    ) {
      throw new AppError({
        code: "tracking.invalid_context",
        message: "Invalid tracking context.",
        status: 400,
      });
    }

    let contextIsCurrentlyAcceptable;

    try {
      contextIsCurrentlyAcceptable = await options.contextIsCurrentlyAcceptable(batch.events[0]!.context);
    } catch (error) {
      if (error instanceof TrackingUnavailableError) {
        throw new AppError({
          code: "tracking.unavailable",
          message: "Tracking data is temporarily unavailable.",
          status: 503,
        });
      }

      throw error;
    }

    if (!contextIsCurrentlyAcceptable) {
      throw new AppError({
        code: "tracking.invalid_context",
        message: "Invalid tracking context.",
        status: 400,
      });
    }

    const rateLimit = await options.rateLimiter.check({
      key: getTrackingRateLimitKey(batch),
      eventCount: batch.events.length,
    });

    if (!rateLimit.allowed) {
      response.setHeader("retry-after", String(rateLimit.retryAfterSeconds));

      throw new AppError({
        code: "tracking.rate_limited",
        message: "Tracking is receiving too many events. Try again shortly.",
        status: 429,
      });
    }

    await recordTrackingBatchBestEffort(eventSink, batch);

    response.status(204).send();
  }));

  return trackingRouter;
}

async function recordTrackingBatchBestEffort(
  eventSink: TrackingEventSink,
  batch: TrackingBatch,
) {
  try {
    await eventSink.record(batch, { source: "browser" });
  } catch (error) {
    const firstEvent = batch.events[0];

    logger.warn("Tracking event sink failed after batch acceptance.", {
      error,
      eventCount: batch.events.length,
      siteId: firstEvent?.context.siteId,
      publishedVersionId: firstEvent?.context.publishedVersionId,
      variantId: firstEvent?.context.variantId,
      source: "browser",
    });
  }
}

function getTrackingRateLimitKey(batch: TrackingBatch) {
  const firstEvent = batch.events[0]!;

  return [
    "tracking",
    firstEvent.context.workspaceId,
    firstEvent.context.siteId,
    firstEvent.context.publishedVersionId,
    firstEvent.context.variantId ?? "default",
    firstEvent.sessionId,
  ].join(":");
}

function hasSingleTrackingScope(batch: TrackingBatch) {
  const firstEvent = batch.events[0]!;

  return batch.events.every((event) =>
    event.sessionId === firstEvent.sessionId &&
    event.context.workspaceId === firstEvent.context.workspaceId &&
    event.context.siteId === firstEvent.context.siteId &&
    event.context.publishedVersionId === firstEvent.context.publishedVersionId &&
    event.context.variantId === firstEvent.context.variantId &&
    event.context.variantRevision === firstEvent.context.variantRevision &&
    event.context.mode === firstEvent.context.mode &&
    event.context.token === firstEvent.context.token
  );
}

function hasAllowedTrackingModeEvents(batch: TrackingBatch) {
  const mode = batch.events[0]!.context.mode;

  if (mode === "off") {
    return false;
  }

  if (mode === "essential_only") {
    return batch.events.every((event) =>
      event.type === "site_viewed" || event.type === "link_preview_loaded"
    );
  }

  return true;
}

function hasCoherentVariantContext(batch: TrackingBatch) {
  return batch.events.every((event) =>
    (event.context.variantId === null) === (event.context.variantRevision === null)
  );
}
