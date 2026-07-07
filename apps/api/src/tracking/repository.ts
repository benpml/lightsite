import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, max, ne, or, sql, type SQL } from "drizzle-orm";
import {
  db as defaultDb,
  siteVariants,
  siteVersions,
  sites,
  trackingEvents,
  trackingSessions,
  workspaces,
  type Database,
} from "@lightsite/db";
import type { TrackingBatch, TrackingContext, TrackingEvent } from "@lightsite/tracking-schema";
import type { TrackingEventSinkRecordOptions } from "./event-sink";

export type TrackingWorkspaceContext = {
  id: string;
  role: "admin" | "user";
};

export type TrackingFeedFilters = {
  workspace: TrackingWorkspaceContext;
  userId: string;
  siteId?: string;
  variantId?: string;
  type?: TrackingEvent["type"];
  classification: "all" | "human" | "bot" | "preview";
  query?: string;
  from?: Date;
  to?: Date;
  cursor?: TrackingCursor;
  limit: number;
};

export type TrackingCursor = {
  receivedAt: Date;
  id: string;
};

export type TrackingFeedRecord = {
  id: string;
  eventId: string;
  type: TrackingEvent["type"];
  source: TrackingEventSinkRecordOptions["source"];
  eventName: string;
  site: {
    id: string;
    name: string;
    slug: string;
  };
  variant: {
    id: string;
    name: string;
    recipientName: string | null;
    recipientCompany: string | null;
  } | null;
  targetLabel: string | null;
  targetUrl: string | null;
  occurredAt: Date;
  receivedAt: Date;
  isBot: boolean;
  isPreview: boolean;
};

export type TrackingSummary = {
  metrics: {
    humanVisits: number;
    uniqueSessions: number;
    averageTimeSpentSeconds: number;
    maxScrollDepth: number;
    ctaClicks: number;
    linkClicks: number;
    previewLoads: number;
    lastEngagedAt: Date | null;
  };
  topClickedElements: Array<{
    elementId: string;
    label: string;
    href: string | null;
    clickCount: number;
    lastClickedAt: Date;
  }>;
  variants: Array<{
    variant: {
      id: string;
      name: string;
      recipientName: string | null;
      recipientCompany: string | null;
    };
    humanVisits: number;
    ctaClicks: number;
    maxScrollDepth: number;
    previewLoads: number;
    lastViewedAt: Date | null;
  }>;
};

export interface TrackingRepository {
  trackingContextIsCurrentlyAcceptable(context: TrackingContext): Promise<boolean>;
  recordBatch(batch: TrackingBatch, options: TrackingEventSinkRecordOptions): Promise<void>;
  listFeed(input: TrackingFeedFilters): Promise<{
    records: TrackingFeedRecord[];
    nextCursor: TrackingCursor | null;
  }>;
  getSummary(input: Omit<TrackingFeedFilters, "type" | "classification" | "query" | "cursor" | "limit">): Promise<TrackingSummary>;
}

const MAX_SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const TOP_CLICK_LIMIT = 10;
const TOP_VARIANT_LIMIT = 10;

export function createDbTrackingRepository(database: Database = defaultDb): TrackingRepository {
  const trackingContextIsCurrentlyAcceptable = async (context: TrackingContext) => {
    if ((context.variantId === null) !== (context.variantRevision === null)) {
      return false;
    }

    const [record] = await database
      .select({
        siteId: sites.id,
        variantId: siteVariants.id,
      })
      .from(sites)
      .innerJoin(workspaces, eq(sites.workspaceId, workspaces.id))
      .innerJoin(siteVersions, eq(sites.publishedVersionId, siteVersions.id))
      .leftJoin(siteVariants, and(
        eq(siteVariants.id, context.variantId ?? "00000000-0000-0000-0000-000000000000"),
        eq(siteVariants.workspaceId, context.workspaceId),
        eq(siteVariants.siteId, context.siteId),
        eq(siteVariants.status, "active"),
        eq(siteVariants.revisionNumber, context.variantRevision ?? -1),
      ))
      .where(and(
        eq(workspaces.id, context.workspaceId),
        eq(workspaces.status, "active"),
        eq(sites.id, context.siteId),
        eq(sites.workspaceId, context.workspaceId),
        eq(sites.status, "published"),
        eq(sites.publishedVersionId, context.publishedVersionId),
        eq(siteVersions.id, context.publishedVersionId),
        eq(siteVersions.kind, "publish"),
      ))
      .limit(1);

    if (!record) {
      return false;
    }

    if (!context.variantId) {
      return true;
    }

    return Boolean(record.variantId);
  };

  return {
    trackingContextIsCurrentlyAcceptable,

    async recordBatch(batch, options) {
      const firstEvent = batch.events[0];

      if (!firstEvent || !(await trackingContextIsCurrentlyAcceptable(firstEvent.context))) {
        return;
      }

      await database.transaction(async (transaction) => {
        const receivedAt = new Date();

        for (const event of batch.events) {
          const isPreview = options.source !== "browser" || event.type === "link_preview_loaded";
          const isBot = isPreview;
          const visitorSessionId = isPreview ? null : event.sessionId;

          if (visitorSessionId) {
            const sessionMatchesContext = await ensureSessionForEvent(transaction, event, receivedAt);

            if (!sessionMatchesContext) {
              continue;
            }
          }

          const inserted = await transaction
            .insert(trackingEvents)
            .values({
              eventId: event.eventId,
              batchId: batch.batchId,
              visitorSessionId,
              workspaceId: event.context.workspaceId,
              siteId: event.context.siteId,
              variantId: event.context.variantId,
              variantRevision: event.context.variantRevision,
              publishedVersionId: event.context.publishedVersionId,
              type: event.type,
              source: options.source,
              eventName: getEventName(event),
              elementId: "elementId" in event ? event.elementId : null,
              targetLabel: "label" in event ? event.label : null,
              targetUrl: "href" in event ? event.href : null,
              isBot,
              isPreview,
              metadata: getEventMetadata(event),
              occurredAt: new Date(event.occurredAt),
              receivedAt,
            })
            .onConflictDoNothing({ target: trackingEvents.eventId })
            .returning({ id: trackingEvents.id });

          if (visitorSessionId && inserted.length > 0) {
            await updateSessionForEvent(transaction, event, receivedAt);
          }
        }
      });
    },

    async listFeed(input) {
      const conditions = buildTrackingEventConditions(input);
      const rows = await database
        .select({
          id: trackingEvents.id,
          eventId: trackingEvents.eventId,
          type: trackingEvents.type,
          source: trackingEvents.source,
          eventName: trackingEvents.eventName,
          targetLabel: trackingEvents.targetLabel,
          targetUrl: trackingEvents.targetUrl,
          occurredAt: trackingEvents.occurredAt,
          receivedAt: trackingEvents.receivedAt,
          isBot: trackingEvents.isBot,
          isPreview: trackingEvents.isPreview,
          siteId: sites.id,
          siteName: sites.name,
          siteSlug: sites.slug,
          variantId: siteVariants.id,
          variantName: siteVariants.name,
          recipientName: siteVariants.recipientName,
          recipientCompany: siteVariants.recipientCompany,
        })
        .from(trackingEvents)
        .innerJoin(sites, eq(trackingEvents.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingEvents.variantId, siteVariants.id))
        .where(and(...conditions))
        .orderBy(desc(trackingEvents.receivedAt), desc(trackingEvents.id))
        .limit(input.limit + 1);

      const page = rows.slice(0, input.limit);
      const next = rows.length > input.limit ? page.at(-1) : undefined;

      return {
        records: page.map((row) => ({
          id: row.id,
          eventId: row.eventId,
          type: row.type,
          source: row.source,
          eventName: row.eventName,
          site: {
            id: row.siteId,
            name: row.siteName,
            slug: row.siteSlug,
          },
          variant: row.variantId
            ? {
                id: row.variantId,
                name: row.variantName ?? "Deleted variant",
                recipientName: row.recipientName,
                recipientCompany: row.recipientCompany,
              }
            : null,
          targetLabel: row.targetLabel,
          targetUrl: row.targetUrl,
          occurredAt: row.occurredAt,
          receivedAt: row.receivedAt,
          isBot: row.isBot,
          isPreview: row.isPreview,
        })),
        nextCursor: next
          ? {
              receivedAt: next.receivedAt,
              id: next.id,
            }
          : null,
      };
    },

    async getSummary(input) {
      const eventConditions = buildTrackingEventConditions({
        ...input,
        classification: "all",
        limit: 1,
      });
      const sessionConditions = buildTrackingSessionConditions(input);

      const [eventMetrics] = await database
        .select({
          humanVisits: sql<number>`count(*) filter (where ${trackingEvents.type} = 'site_viewed' and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false)`.mapWith(Number),
          ctaClicks: sql<number>`count(*) filter (where ${trackingEvents.type} in ('button_clicked', 'element_clicked') and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false)`.mapWith(Number),
          linkClicks: sql<number>`count(*) filter (where ${trackingEvents.type} = 'link_clicked' and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false)`.mapWith(Number),
          previewLoads: sql<number>`count(*) filter (where ${trackingEvents.type} = 'link_preview_loaded' or ${trackingEvents.isPreview} = true)`.mapWith(Number),
          lastEngagedAt: max(trackingEvents.receivedAt),
        })
        .from(trackingEvents)
        .innerJoin(sites, eq(trackingEvents.siteId, sites.id))
        .where(and(...eventConditions));

      const [sessionMetrics] = await database
        .select({
          uniqueSessions: count(),
          averageTimeSpentMs: sql<number>`coalesce(avg(${trackingSessions.durationMs}), 0)`.mapWith(Number),
          maxScrollDepth: sql<number>`coalesce(max(${trackingSessions.maxScrollDepth}), 0)`.mapWith(Number),
        })
        .from(trackingSessions)
        .innerJoin(sites, eq(trackingSessions.siteId, sites.id))
        .where(and(...sessionConditions));

      const topClickedElements = await database
        .select({
          elementId: trackingEvents.elementId,
          label: trackingEvents.targetLabel,
          href: trackingEvents.targetUrl,
          clickCount: count(),
          lastClickedAt: max(trackingEvents.receivedAt),
        })
        .from(trackingEvents)
        .innerJoin(sites, eq(trackingEvents.siteId, sites.id))
        .where(and(
          ...eventConditions,
          inArray(trackingEvents.type, ["element_clicked", "button_clicked", "link_clicked"]),
          isNotNull(trackingEvents.elementId),
          eq(trackingEvents.isBot, false),
          eq(trackingEvents.isPreview, false),
        ))
        .groupBy(trackingEvents.elementId, trackingEvents.targetLabel, trackingEvents.targetUrl)
        .orderBy(sql`count(*) desc`, desc(max(trackingEvents.receivedAt)))
        .limit(TOP_CLICK_LIMIT);

      const variantRows = await database
        .select({
          variantId: siteVariants.id,
          variantName: siteVariants.name,
          recipientName: siteVariants.recipientName,
          recipientCompany: siteVariants.recipientCompany,
          humanVisits: sql<number>`count(*) filter (where ${trackingEvents.type} = 'site_viewed' and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false)`.mapWith(Number),
          ctaClicks: sql<number>`count(*) filter (where ${trackingEvents.type} in ('button_clicked', 'element_clicked') and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false)`.mapWith(Number),
          maxScrollDepth: sql<number>`coalesce(max(cast(${trackingEvents.metadata}->>'depthPercent' as integer)), 0)`.mapWith(Number),
          previewLoads: sql<number>`count(*) filter (where ${trackingEvents.type} = 'link_preview_loaded' or ${trackingEvents.isPreview} = true)`.mapWith(Number),
          lastViewedAt: sql<Date | null>`max(${trackingEvents.receivedAt}) filter (where ${trackingEvents.type} = 'site_viewed')`,
        })
        .from(trackingEvents)
        .innerJoin(sites, eq(trackingEvents.siteId, sites.id))
        .innerJoin(siteVariants, eq(trackingEvents.variantId, siteVariants.id))
        .where(and(...eventConditions, isNotNull(trackingEvents.variantId)))
        .groupBy(siteVariants.id, siteVariants.name, siteVariants.recipientName, siteVariants.recipientCompany)
        .orderBy(sql`count(*) filter (where ${trackingEvents.type} = 'site_viewed' and ${trackingEvents.isBot} = false and ${trackingEvents.isPreview} = false) desc`)
        .limit(TOP_VARIANT_LIMIT);

      return {
        metrics: {
          humanVisits: eventMetrics?.humanVisits ?? 0,
          uniqueSessions: sessionMetrics?.uniqueSessions ?? 0,
          averageTimeSpentSeconds: Math.round((sessionMetrics?.averageTimeSpentMs ?? 0) / 1000),
          maxScrollDepth: sessionMetrics?.maxScrollDepth ?? 0,
          ctaClicks: eventMetrics?.ctaClicks ?? 0,
          linkClicks: eventMetrics?.linkClicks ?? 0,
          previewLoads: eventMetrics?.previewLoads ?? 0,
          lastEngagedAt: eventMetrics?.lastEngagedAt ?? null,
        },
        topClickedElements: topClickedElements
          .filter((row): row is typeof row & { elementId: string; label: string; lastClickedAt: Date } =>
            Boolean(row.elementId && row.label && row.lastClickedAt)
          )
          .map((row) => ({
            elementId: row.elementId,
            label: row.label,
            href: row.href,
            clickCount: Number(row.clickCount),
            lastClickedAt: row.lastClickedAt,
          })),
        variants: variantRows.map((row) => ({
          variant: {
            id: row.variantId,
            name: row.variantName,
            recipientName: row.recipientName,
            recipientCompany: row.recipientCompany,
          },
          humanVisits: row.humanVisits,
          ctaClicks: row.ctaClicks,
          maxScrollDepth: row.maxScrollDepth,
          previewLoads: row.previewLoads,
          lastViewedAt: row.lastViewedAt,
        })),
      };
    },
  };
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function buildSessionInsert(event: TrackingEvent, receivedAt: Date) {
  const occurredAt = new Date(event.occurredAt);

  return {
    id: event.sessionId,
    workspaceId: event.context.workspaceId,
    siteId: event.context.siteId,
    variantId: event.context.variantId,
    variantRevision: event.context.variantRevision,
    publishedVersionId: event.context.publishedVersionId,
    state: "active" as const,
    startedAt: occurredAt,
    lastSeenAt: receivedAt,
    durationMs: 0,
    maxScrollDepth: getEventScrollDepth(event),
    referrerHost: event.type === "site_viewed" ? event.referrerHost : null,
    isBot: false,
    metadata: {},
  };
}

async function updateSessionForEvent(
  transaction: Transaction,
  event: TrackingEvent,
  receivedAt: Date,
) {
  const durationIncrementMs = event.type === "heartbeat"
    ? Math.max(0, Math.min(event.engagedSeconds * 1000, 60_000))
    : 0;
  const nextScrollDepth = getEventScrollDepth(event);

  await transaction
    .update(trackingSessions)
    .set({
      lastSeenAt: receivedAt,
      updatedAt: receivedAt,
      ...(event.type === "site_viewed" && event.referrerHost ? { referrerHost: event.referrerHost } : {}),
      ...(durationIncrementMs > 0
        ? {
            durationMs: sql`least(coalesce(${trackingSessions.durationMs}, 0) + ${durationIncrementMs}, ${MAX_SESSION_DURATION_MS})`,
          }
        : {}),
      ...(nextScrollDepth !== null
        ? {
            maxScrollDepth: sql`greatest(coalesce(${trackingSessions.maxScrollDepth}, 0), ${nextScrollDepth})`,
          }
        : {}),
    })
    .where(and(...buildTrackingSessionIdentityConditions(event)));
}

async function ensureSessionForEvent(
  transaction: Transaction,
  event: TrackingEvent,
  receivedAt: Date,
) {
  const inserted = await transaction
    .insert(trackingSessions)
    .values(buildSessionInsert(event, receivedAt))
    .onConflictDoNothing()
    .returning({ id: trackingSessions.id });

  if (inserted.length > 0) {
    return true;
  }

  const [session] = await transaction
    .select({ id: trackingSessions.id })
    .from(trackingSessions)
    .where(and(...buildTrackingSessionIdentityConditions(event)))
    .limit(1);

  return Boolean(session);
}

function buildTrackingSessionIdentityConditions(event: TrackingEvent) {
  return [
    eq(trackingSessions.id, event.sessionId),
    eq(trackingSessions.workspaceId, event.context.workspaceId),
    eq(trackingSessions.siteId, event.context.siteId),
    eq(trackingSessions.publishedVersionId, event.context.publishedVersionId),
    event.context.variantId
      ? eq(trackingSessions.variantId, event.context.variantId)
      : isNull(trackingSessions.variantId),
    event.context.variantRevision === null
      ? isNull(trackingSessions.variantRevision)
      : eq(trackingSessions.variantRevision, event.context.variantRevision),
  ];
}

function buildTrackingEventConditions(input: Partial<TrackingFeedFilters> & {
  workspace: TrackingWorkspaceContext;
  userId: string;
}) {
  const conditions: SQL[] = [
    eq(trackingEvents.workspaceId, input.workspace.id),
    ...buildSiteAccessConditions(input.workspace, input.userId),
  ];

  if (input.siteId) {
    conditions.push(eq(trackingEvents.siteId, input.siteId));
  }

  if (input.variantId) {
    conditions.push(eq(trackingEvents.variantId, input.variantId));
  }

  if (input.type) {
    conditions.push(eq(trackingEvents.type, input.type));
  }

  if (input.from) {
    conditions.push(gte(trackingEvents.receivedAt, input.from));
  }

  if (input.to) {
    conditions.push(lt(trackingEvents.receivedAt, input.to));
  }

  if (input.classification === "human") {
    conditions.push(eq(trackingEvents.isBot, false), eq(trackingEvents.isPreview, false));
  } else if (input.classification === "bot") {
    conditions.push(eq(trackingEvents.isBot, true));
  } else if (input.classification === "preview") {
    conditions.push(eq(trackingEvents.isPreview, true));
  }

  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(or(
      ilike(sites.name, pattern),
      ilike(trackingEvents.eventName, pattern),
      ilike(trackingEvents.targetLabel, pattern),
    )!);
  }

  if (input.cursor) {
    conditions.push(or(
      lt(trackingEvents.receivedAt, input.cursor.receivedAt),
      and(
        eq(trackingEvents.receivedAt, input.cursor.receivedAt),
        lt(trackingEvents.id, input.cursor.id),
      ),
    )!);
  }

  return conditions;
}

function buildTrackingSessionConditions(input: Omit<TrackingFeedFilters, "type" | "classification" | "query" | "cursor" | "limit">) {
  const conditions: SQL[] = [
    eq(trackingSessions.workspaceId, input.workspace.id),
    eq(trackingSessions.isBot, false),
    ne(trackingSessions.state, "bot_filtered"),
    ne(trackingSessions.state, "discarded"),
    ...buildSiteAccessConditions(input.workspace, input.userId),
  ];

  if (input.siteId) {
    conditions.push(eq(trackingSessions.siteId, input.siteId));
  }

  if (input.variantId) {
    conditions.push(eq(trackingSessions.variantId, input.variantId));
  }

  if (input.from) {
    conditions.push(gte(trackingSessions.startedAt, input.from));
  }

  if (input.to) {
    conditions.push(lt(trackingSessions.startedAt, input.to));
  }

  return conditions;
}

function buildSiteAccessConditions(workspace: TrackingWorkspaceContext, userId: string) {
  if (workspace.role === "admin") {
    return [];
  }

  return [
    or(
      eq(sites.createdByUserId, userId),
      eq(sites.visibility, "team"),
    )!,
  ];
}

function getEventName(event: TrackingEvent) {
  switch (event.type) {
    case "site_viewed":
      return event.context.variantId ? "Variant viewed" : "Site viewed";
    case "heartbeat":
      return "Time spent";
    case "scroll_depth_reached":
      return `Reached ${event.depthPercent}%`;
    case "element_clicked":
      return "Element clicked";
    case "button_clicked":
      return "Button clicked";
    case "link_clicked":
      return "Link clicked";
    case "calendar_booked":
      return "Calendar booked";
    case "link_preview_loaded":
      return `${formatPreviewPlatform(event.platform)} preview loaded`;
  }
}

function getEventMetadata(event: TrackingEvent) {
  switch (event.type) {
    case "site_viewed":
      return {
        viewport: event.viewport,
        referrerHost: event.referrerHost,
      };
    case "heartbeat":
      return {
        engagedSeconds: event.engagedSeconds,
        maxScrollDepthPercent: event.maxScrollDepthPercent,
      };
    case "scroll_depth_reached":
      return {
        depthPercent: event.depthPercent,
      };
    case "element_clicked":
    case "button_clicked":
    case "link_clicked":
    case "calendar_booked":
      return {
        elementId: event.elementId,
        label: event.label,
        href: event.href,
      };
    case "link_preview_loaded":
      return {
        platform: event.platform,
        resource: event.resource,
        userAgentFamily: event.userAgentFamily,
      };
  }
}

function getEventScrollDepth(event: TrackingEvent) {
  if (event.type === "scroll_depth_reached") {
    return event.depthPercent;
  }

  if (event.type === "heartbeat") {
    return event.maxScrollDepthPercent;
  }

  return null;
}

function formatPreviewPlatform(platform: string) {
  if (platform === "x") {
    return "X";
  }

  return platform
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
