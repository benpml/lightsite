import type {
  TrackingEventsQuery,
  TrackingEventsResponse,
  TrackingSummaryQuery,
  TrackingSummaryResponse,
} from "@lightsite/contracts";
import type { TrackingBatch, TrackingContext } from "@lightsite/tracking-schema";
import type { TrackingEventSink, TrackingEventSinkRecordOptions } from "./event-sink";
import type {
  TrackingCursor,
  TrackingRepository,
  TrackingWorkspaceContext,
} from "./repository";

export type TrackingServiceWorkspace = TrackingWorkspaceContext;

export type ListTrackingEventsInput = {
  workspace: TrackingServiceWorkspace;
  userId: string;
  query: TrackingEventsQuery;
};

export type GetTrackingSummaryInput = {
  workspace: TrackingServiceWorkspace;
  userId: string;
  query: TrackingSummaryQuery;
};

export interface TrackingService extends TrackingEventSink {
  trackingContextIsCurrentlyAcceptable(context: TrackingContext): Promise<boolean>;
  listEvents(input: ListTrackingEventsInput): Promise<Omit<TrackingEventsResponse, "requestId">>;
  getSummary(input: GetTrackingSummaryInput): Promise<Omit<TrackingSummaryResponse, "requestId">>;
}

export class InvalidTrackingCursorError extends Error {
  constructor() {
    super("Invalid tracking cursor.");
    this.name = "InvalidTrackingCursorError";
  }
}

export class TrackingUnavailableError extends Error {
  constructor() {
    super("Tracking data is temporarily unavailable.");
    this.name = "TrackingUnavailableError";
  }
}

export function createTrackingService(repository: TrackingRepository): TrackingService {
  return {
    async trackingContextIsCurrentlyAcceptable(context) {
      try {
        return await repository.trackingContextIsCurrentlyAcceptable(context);
      } catch (error) {
        throw mapTrackingRepositoryError(error);
      }
    },

    async record(batch: TrackingBatch, options: TrackingEventSinkRecordOptions) {
      try {
        await repository.recordBatch(batch, options);
      } catch (error) {
        throw mapTrackingRepositoryError(error);
      }
    },

    async listEvents(input) {
      const result = await runTrackingRepositoryQuery(() =>
        repository.listFeed({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.query.siteId,
          variantId: input.query.variantId,
          type: input.query.type,
          classification: input.query.classification ?? "all",
          query: input.query.query,
          from: parseOptionalDate(input.query.from),
          to: parseOptionalDate(input.query.to),
          cursor: decodeCursor(input.query.cursor),
          limit: input.query.limit ?? 25,
        })
      );

      return {
        events: result.records.map((record) => ({
          id: record.id,
          eventId: record.eventId,
          type: record.type,
          source: record.source,
          eventName: record.eventName,
          site: record.site,
          variant: record.variant,
          targetLabel: record.targetLabel,
          targetUrl: record.targetUrl,
          occurredAt: record.occurredAt.toISOString(),
          receivedAt: record.receivedAt.toISOString(),
          isBot: record.isBot,
          isPreview: record.isPreview,
        })),
        nextCursor: encodeCursor(result.nextCursor),
      };
    },

    async getSummary(input) {
      const result = await runTrackingRepositoryQuery(() =>
        repository.getSummary({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.query.siteId,
          variantId: input.query.variantId,
          from: parseOptionalDate(input.query.from),
          to: parseOptionalDate(input.query.to),
        })
      );

      return {
        metrics: {
          humanVisits: result.metrics.humanVisits,
          uniqueSessions: result.metrics.uniqueSessions,
          averageTimeSpentSeconds: result.metrics.averageTimeSpentSeconds,
          maxScrollDepth: result.metrics.maxScrollDepth,
          ctaClicks: result.metrics.ctaClicks,
          linkClicks: result.metrics.linkClicks,
          previewLoads: result.metrics.previewLoads,
          lastEngagedAt: toIsoDate(result.metrics.lastEngagedAt),
        },
        topClickedElements: result.topClickedElements.map((element) => ({
          elementId: element.elementId,
          label: element.label,
          href: element.href,
          clickCount: element.clickCount,
          lastClickedAt: toRequiredIsoDate(element.lastClickedAt),
        })),
        variants: result.variants.map((variant) => ({
          variant: variant.variant,
          humanVisits: variant.humanVisits,
          ctaClicks: variant.ctaClicks,
          maxScrollDepth: variant.maxScrollDepth,
          previewLoads: variant.previewLoads,
          lastViewedAt: toIsoDate(variant.lastViewedAt),
        })),
      };
    },
  };
}

async function runTrackingRepositoryQuery<TResult>(query: () => Promise<TResult>) {
  try {
    return await query();
  } catch (error) {
    throw mapTrackingRepositoryError(error);
  }
}

function mapTrackingRepositoryError(error: unknown) {
  if (isDatabaseConnectionError(error)) {
    return new TrackingUnavailableError();
  }

  return error;
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (
    "code" in error &&
    typeof error.code === "string" &&
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(error.code)
  ) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.some(isDatabaseConnectionError);
  }

  if (
    "message" in error &&
    typeof error.message === "string" &&
    (/^Failed query:/.test(error.message) ||
      /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/.test(error.message))
  ) {
    return true;
  }

  return false;
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toRequiredIsoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TrackingUnavailableError();
  }

  return date.toISOString();
}

function parseOptionalDate(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

function encodeCursor(cursor: TrackingCursor | null) {
  if (!cursor) {
    return null;
  }

  return Buffer.from(JSON.stringify({
    receivedAt: cursor.receivedAt.toISOString(),
    id: cursor.id,
  }), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): TrackingCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;

    if (!isCursorPayload(parsed)) {
      throw new InvalidTrackingCursorError();
    }

    return {
      receivedAt: new Date(parsed.receivedAt),
      id: parsed.id,
    };
  } catch {
    throw new InvalidTrackingCursorError();
  }
}

function isCursorPayload(value: unknown): value is { receivedAt: string; id: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const input = value as Partial<{ receivedAt: string; id: string }>;

  return typeof input.receivedAt === "string"
    && !Number.isNaN(Date.parse(input.receivedAt))
    && typeof input.id === "string"
    && input.id.length > 0;
}
