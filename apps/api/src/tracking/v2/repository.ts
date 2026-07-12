import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import {
  siteVariants,
  siteVersions,
  sites,
  trackingRecordingChunks,
  trackingRecordings,
  trackingRecordingUsageDaily,
  trackingRecipientEvents,
  trackingRecipientSessions,
  trackingSettings,
  trackingSuppressionMarkers,
  workspaces,
} from "@lightsite/db/schema";
import type { Database } from "@lightsite/db";
import type {
  TrackingV2BrowserEvent,
  TrackingV2ElementKind,
  TrackingV2EventSource,
  TrackingV2EventType,
  TrackingV2ReadRecordingStatus,
  TrackingV2SessionRecordingStatusFilter,
  TrackingV2SessionEndReason,
  TrackingV2SessionState,
  TrackingV2SettingScope,
} from "@lightsite/tracking-schema";

export type TrackingV2ContextLookup = {
  workspaceId: string;
  siteId: string;
  publishedVersionId: string;
  recipientId: string | null;
  recipientRevision: number | null;
};

export type TrackingV2ResolvedContext = TrackingV2ContextLookup & {
  workspaceStatus: "active";
  siteStatus: "published";
  recipientStatus: "active" | null;
};

export type TrackingV2SettingRecord = {
  scope: TrackingV2SettingScope;
  enabled: boolean;
  captureIpAddress: boolean;
  rawIpRetentionDays: number;
  eventRetentionDays: number;
  recordingEnabled: boolean;
  recordingRetentionDays: number;
  maxRecordingDurationSeconds: number;
};

export type TrackingV2WritableSettings = Omit<TrackingV2SettingRecord, "scope">;

export type TrackingV2CreateSessionInput = {
  publicSessionId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  publishedVersionId: string;
  eventTokenHash: string;
  deviceIdHash: string | null;
  ipAddress: string | null;
  ipAddressHash: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  userAgentFamily: string | null;
  referrerHost: string | null;
  initialPath: string | null;
  startedAt: Date;
};

export type TrackingV2SessionRecord = {
  id: string;
  publicSessionId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  publishedVersionId: string;
  state: "active" | "ended" | "expired" | "suppressed";
  startedAt: Date;
  lastSeenAt: Date;
  activeMs: number;
};

export type TrackingV2RecordingStatus =
  | "pending"
  | "recording"
  | "available"
  | "truncated"
  | "failed"
  | "expired"
  | "deleted";

export type TrackingV2RecordingRecord = {
  id: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  publicSessionId: string;
  status: TrackingV2RecordingStatus;
  uploadTokenHash: string;
  maxDurationMs: number;
  maxChunkBytes: number;
  maxEvents: number;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  eventCount: number;
  chunkCount: number;
  compressedBytes: number;
  objectPrefix: string;
  stopReason: string | null;
  finalSequence: number | null;
  errorCode: string | null;
  expiresAt: Date;
};

export type TrackingV2RecordingChunkRecord = {
  id: string;
  recordingId: string;
  workspaceId: string;
  sessionId: string;
  publicSessionId: string;
  sequence: number;
  objectKey: string;
  eventCount: number;
  compressedBytes: number;
  uncompressedBytes: number | null;
  checksumSha256: string;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  receivedAt: Date;
};

export type TrackingV2StoredEvent = {
  id?: string;
  eventId: string;
  batchId: string | null;
  sessionId: string | null;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  publishedVersionId: string;
  type: TrackingV2EventType;
  source: TrackingV2EventSource;
  tabLabel: string | null;
  elementKind: TrackingV2ElementKind | null;
  elementId: string | null;
  elementLabel: string | null;
  elementHref: string | null;
  webhookId: string | null;
  webhookUrl: string | null;
  scriptVersion: string | null;
  eventData: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
};

export type TrackingV2ReadWorkspace = {
  id: string;
  role: "admin" | "user";
};

export type TrackingV2EventCursor = {
  receivedAt: Date;
  id: string;
};

export type TrackingV2SessionCursor = {
  startedAt: Date;
  id: string;
};

export type TrackingV2SiteSummaryRecord = {
  id: string;
  name: string;
  slug: string;
};

type TrackingV2RecipientSummaryRecord = {
  id: string;
  name: string;
  slug: string;
  recipientName: string | null;
  recipientCompany: string | null;
  website: string | null;
};

type TrackingV2DeviceSummaryRecord = {
  type: string | null;
  os: string | null;
  browser: string | null;
};

type TrackingV2LocationSummaryRecord = {
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export type TrackingV2EventReadRecord = {
  id: string;
  eventId: string;
  type: TrackingV2EventType;
  source: TrackingV2EventSource;
  site: TrackingV2SiteSummaryRecord;
  recipient: TrackingV2RecipientSummaryRecord | null;
  sessionId: string | null;
  session: {
    id: string;
    state: TrackingV2SessionState;
    startedAt: Date;
    lastSeenAt: Date;
    device: TrackingV2DeviceSummaryRecord;
    location: TrackingV2LocationSummaryRecord;
  } | null;
  tab: {
    label: string;
  } | null;
  element: {
    kind: TrackingV2ElementKind;
    id: string | null;
    label: string;
    href: string | null;
  } | null;
  webhook: {
    id: string;
    url: string;
  } | null;
  occurredAt: Date;
  receivedAt: Date;
};

export type TrackingV2SessionReadRecord = {
  id: string;
  site: TrackingV2SiteSummaryRecord;
  recipient: TrackingV2RecipientSummaryRecord | null;
  state: TrackingV2SessionState;
  device: TrackingV2DeviceSummaryRecord;
  location: TrackingV2LocationSummaryRecord;
  ipAddress: string | null;
  initialPath: string | null;
  referrerHost: string | null;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  activeMs: number;
  durationMs: number | null;
  maxScrollDepthPercent: number | null;
  recording: {
    status: TrackingV2ReadRecordingStatus;
    available: boolean;
    durationMs: number | null;
  };
};

export type TrackingV2ListEventsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  siteId?: string;
  recipientId?: string;
  sessionId?: string;
  type?: TrackingV2EventType;
  source?: TrackingV2EventSource;
  from?: Date;
  to?: Date;
  cursor?: TrackingV2EventCursor;
  limit: number;
};

export type TrackingV2ListSessionsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  siteId?: string;
  recipientId?: string;
  state?: TrackingV2SessionState;
  recordingStatus?: TrackingV2SessionRecordingStatusFilter;
  from?: Date;
  to?: Date;
  cursor?: TrackingV2SessionCursor;
  limit: number;
};

export type TrackingV2RetentionBatchInput = {
  now: Date;
  limit: number;
};

export type TrackingV2StaleSessionExpirationInput = TrackingV2RetentionBatchInput & {
  staleBefore: Date;
};

export type TrackingV2ExpiredRecordingChunkRecord = {
  id: string;
  recordingId: string;
  objectKey: string;
};

export interface TrackingV2Repository {
  findCurrentContext(input: TrackingV2ContextLookup): Promise<TrackingV2ResolvedContext | null>;
  listSettings(input: {
    workspaceId: string;
    siteId: string;
    recipientId: string | null;
  }): Promise<TrackingV2SettingRecord[]>;
  findSettingsSite(input: {
    workspace: TrackingV2ReadWorkspace;
    userId: string;
    siteId: string;
  }): Promise<TrackingV2SiteSummaryRecord | null>;
  findSiteSetting(input: {
    workspaceId: string;
    siteId: string;
  }): Promise<TrackingV2SettingRecord | null>;
  upsertSiteSetting(input: {
    workspaceId: string;
    siteId: string;
    settings: TrackingV2WritableSettings;
    updatedAt: Date;
  }): Promise<TrackingV2SettingRecord>;
  listEvents(input: TrackingV2ListEventsInput): Promise<{
    records: TrackingV2EventReadRecord[];
    nextCursor: TrackingV2EventCursor | null;
  }>;
  listSessions(input: TrackingV2ListSessionsInput): Promise<{
    records: TrackingV2SessionReadRecord[];
    nextCursor: TrackingV2SessionCursor | null;
  }>;
  findReadSession(input: {
    workspace: TrackingV2ReadWorkspace;
    userId: string;
    publicSessionId: string;
  }): Promise<TrackingV2SessionReadRecord | null>;
  expireStaleSessions(input: TrackingV2StaleSessionExpirationInput): Promise<number>;
  pruneRawIpAddresses(input: TrackingV2RetentionBatchInput): Promise<number>;
  pruneExpiredEvents(input: TrackingV2RetentionBatchInput): Promise<number>;
  pruneExpiredSessions(input: TrackingV2RetentionBatchInput): Promise<number>;
  pruneExpiredSuppressionMarkers(input: TrackingV2RetentionBatchInput): Promise<number>;
  expireRecordings(input: TrackingV2RetentionBatchInput): Promise<number>;
  listExpiredRecordingChunks(input: TrackingV2RetentionBatchInput): Promise<TrackingV2ExpiredRecordingChunkRecord[]>;
  deleteRecordingChunks(input: {
    chunkIds: string[];
  }): Promise<number>;
  markExpiredRecordingsDeleted(input: TrackingV2RetentionBatchInput): Promise<number>;
  createSession(input: TrackingV2CreateSessionInput): Promise<TrackingV2SessionRecord>;
  findSessionForEventToken(input: {
    publicSessionId: string;
    eventTokenHash: string;
    activeAfter: Date;
  }): Promise<TrackingV2SessionRecord | null>;
  recordBrowserEvents(input: {
    session: TrackingV2SessionRecord;
    activeAfter: Date;
    batchId: string;
    scriptVersion: string;
    events: TrackingV2BrowserEvent[];
    receivedAt: Date;
  }): Promise<boolean>;
  recordServerEvent(input: TrackingV2ServerEventInput): Promise<void>;
  createRecording(input: TrackingV2CreateRecordingInput): Promise<TrackingV2RecordingRecord>;
  updateSessionRecordingStatus(input: {
    sessionId: string;
    status: "pending" | "available" | "failed" | "expired" | "disabled";
    recordingDurationMs?: number | null;
    recordingObjectKey?: string | null;
    updatedAt: Date;
  }): Promise<void>;
  findRecordingForUploadToken(input: {
    recordingId: string;
    uploadTokenHash: string;
  }): Promise<TrackingV2RecordingRecord | null>;
  findRecordingForWorkspace(input: {
    workspaceId: string;
    publicSessionId: string;
  }): Promise<TrackingV2RecordingRecord | null>;
  findRecordingChunk(input: {
    recordingId: string;
    sequence: number;
  }): Promise<TrackingV2RecordingChunkRecord | null>;
  listRecordingChunks(recordingId: string): Promise<TrackingV2RecordingChunkRecord[]>;
  insertRecordingChunk(input: TrackingV2InsertRecordingChunkInput): Promise<{
    inserted: boolean;
    chunk: TrackingV2RecordingChunkRecord;
  }>;
  updateRecordingAfterChunk(input: {
    recordingId: string;
    status: Extract<TrackingV2RecordingStatus, "recording">;
    addedEventCount: number;
    addedCompressedBytes: number;
    receivedAt: Date;
  }): Promise<void>;
  requestRecordingCompletion(input: {
    recordingId: string;
    endedAt: Date;
    durationMs: number;
    stopReason: string;
    finalSequence: number | null;
    errorCode?: string | null;
    updatedAt: Date;
  }): Promise<void>;
  completeRecording(input: {
    recordingId: string;
    status: Extract<TrackingV2RecordingStatus, "available" | "truncated" | "failed">;
    endedAt: Date;
    durationMs: number;
    stopReason: string;
    finalSequence: number | null;
    errorCode?: string | null;
    updatedAt: Date;
  }): Promise<void>;
  incrementRecordingUsage(input: {
    workspaceId: string;
    date: string;
    recordingCount: number;
    compressedBytes: number;
  }): Promise<void>;
  getRecordingChunkObjectKey(input: {
    workspaceId: string;
    recordingId: string;
    sequence: number;
    checksumSha256?: string;
  }): string;
  updateSessionHeartbeat(input: {
    sessionId: string;
    activeAfter: Date;
    occurredAt: Date;
    activeMs: number;
    maxScrollDepthPercent: number | null;
  }): Promise<boolean>;
  endSession(input: {
    sessionId: string;
    activeAfter: Date;
    occurredAt: Date;
    reason: TrackingV2SessionEndReason;
    activeMs: number | null;
  }): Promise<boolean>;
}

export type TrackingV2ServerEventInput = {
  eventId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  publishedVersionId: string;
  type: Extract<TrackingV2EventType, "slack_share" | "webhook_send">;
  source: Extract<TrackingV2EventSource, "slack_og_image" | "webhook">;
  eventData: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
  webhookId?: string | null;
  webhookUrl?: string | null;
};

export type TrackingV2CreateRecordingInput = {
  recordingId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  publicSessionId: string;
  uploadTokenHash: string;
  runtimeVersion: string;
  maxDurationMs: number;
  maxChunkBytes: number;
  maxEvents: number;
  startedAt: Date;
  expiresAt: Date;
};

export type TrackingV2InsertRecordingChunkInput = {
  recordingId: string;
  workspaceId: string;
  sessionId: string;
  publicSessionId: string;
  sequence: number;
  objectKey: string;
  eventCount: number;
  compressedBytes: number;
  uncompressedBytes: number | null;
  checksumSha256: string;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  receivedAt: Date;
};

const settingSelection = {
  scope: trackingSettings.scope,
  enabled: trackingSettings.enabled,
  captureIpAddress: trackingSettings.captureIpAddress,
  rawIpRetentionDays: trackingSettings.rawIpRetentionDays,
  eventRetentionDays: trackingSettings.eventRetentionDays,
  recordingEnabled: trackingSettings.recordingEnabled,
  recordingRetentionDays: trackingSettings.recordingRetentionDays,
  maxRecordingDurationSeconds: trackingSettings.maxRecordingDurationSeconds,
};

export function createDbTrackingV2Repository(database: Database): TrackingV2Repository {
  return {
    async findCurrentContext(input) {
      const [record] = await database
        .select({
          workspaceId: workspaces.id,
          siteId: sites.id,
          publishedVersionId: siteVersions.id,
        })
        .from(sites)
        .innerJoin(workspaces, eq(sites.workspaceId, workspaces.id))
        .innerJoin(siteVersions, eq(sites.publishedVersionId, siteVersions.id))
        .where(
          and(
            eq(workspaces.id, input.workspaceId),
            eq(workspaces.status, "active"),
            eq(sites.id, input.siteId),
            eq(sites.status, "published"),
            eq(sites.publishedVersionId, input.publishedVersionId),
            eq(siteVersions.id, input.publishedVersionId),
            eq(siteVersions.kind, "publish"),
          ),
        )
        .limit(1);

      if (!record) {
        return null;
      }

      if (!input.recipientId) {
        return {
          ...input,
          workspaceStatus: "active",
          siteStatus: "published",
          recipientStatus: null,
        };
      }

      const [recipient] = await database
        .select({
          id: siteVariants.id,
          revisionNumber: siteVariants.revisionNumber,
          status: siteVariants.status,
        })
        .from(siteVariants)
        .where(
          and(
            eq(siteVariants.id, input.recipientId),
            eq(siteVariants.workspaceId, input.workspaceId),
            eq(siteVariants.siteId, input.siteId),
            eq(siteVariants.status, "active"),
          ),
        )
        .limit(1);

      if (!recipient || recipient.revisionNumber !== input.recipientRevision) {
        return null;
      }

      return {
        ...input,
        workspaceStatus: "active",
        siteStatus: "published",
        recipientStatus: "active",
      };
    },

    async listSettings(input) {
      const scopePredicates: SQL[] = [
        and(eq(trackingSettings.scope, "workspace"), isNull(trackingSettings.siteId), isNull(trackingSettings.recipientId))!,
        and(eq(trackingSettings.scope, "site"), eq(trackingSettings.siteId, input.siteId), isNull(trackingSettings.recipientId))!,
      ];

      if (input.recipientId) {
        scopePredicates.push(
          and(
            eq(trackingSettings.scope, "recipient"),
            eq(trackingSettings.siteId, input.siteId),
            eq(trackingSettings.recipientId, input.recipientId),
          )!,
        );
      }

      const rows = await database
        .select({
          scope: trackingSettings.scope,
          enabled: trackingSettings.enabled,
          captureIpAddress: trackingSettings.captureIpAddress,
          rawIpRetentionDays: trackingSettings.rawIpRetentionDays,
          eventRetentionDays: trackingSettings.eventRetentionDays,
          recordingEnabled: trackingSettings.recordingEnabled,
          recordingRetentionDays: trackingSettings.recordingRetentionDays,
          maxRecordingDurationSeconds: trackingSettings.maxRecordingDurationSeconds,
        })
        .from(trackingSettings)
        .where(
          and(
            eq(trackingSettings.workspaceId, input.workspaceId),
            or(...scopePredicates),
          ),
        )
        .orderBy(desc(trackingSettings.createdAt));

      return rows;
    },

    async findSettingsSite(input) {
      const [site] = await database
        .select({
          id: sites.id,
          name: sites.name,
          slug: sites.slug,
          createdByUserId: sites.createdByUserId,
          visibility: sites.visibility,
        })
        .from(sites)
        .where(and(
          eq(sites.workspaceId, input.workspace.id),
          eq(sites.id, input.siteId),
          ...buildTrackingV2ReadSiteAccessConditions(input.workspace, input.userId),
        ))
        .limit(1);

      return site
        ? {
            id: site.id,
            name: site.name,
            slug: site.slug,
          }
        : null;
    },

    async findSiteSetting(input) {
      const [setting] = await database
        .select(settingSelection)
        .from(trackingSettings)
        .where(and(
          eq(trackingSettings.workspaceId, input.workspaceId),
          eq(trackingSettings.siteId, input.siteId),
          eq(trackingSettings.scope, "site"),
          isNull(trackingSettings.recipientId),
        ))
        .limit(1);

      return setting ?? null;
    },

    async upsertSiteSetting(input) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: trackingSettings.id })
          .from(trackingSettings)
          .where(and(
            eq(trackingSettings.workspaceId, input.workspaceId),
            eq(trackingSettings.siteId, input.siteId),
            eq(trackingSettings.scope, "site"),
            isNull(trackingSettings.recipientId),
          ))
          .limit(1);

        const values = {
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          recipientId: null,
          scope: "site" as const,
          enabled: input.settings.enabled,
          captureIpAddress: input.settings.captureIpAddress,
          rawIpRetentionDays: input.settings.rawIpRetentionDays,
          eventRetentionDays: input.settings.eventRetentionDays,
          recordingEnabled: input.settings.recordingEnabled,
          recordingRetentionDays: input.settings.recordingRetentionDays,
          maxRecordingDurationSeconds: input.settings.maxRecordingDurationSeconds,
          updatedAt: input.updatedAt,
        };

        const [setting] = existing
          ? await transaction
              .update(trackingSettings)
              .set(values)
              .where(eq(trackingSettings.id, existing.id))
              .returning(settingSelection)
          : await transaction
              .insert(trackingSettings)
              .values(values)
              .returning(settingSelection);

        if (!setting) {
          throw new Error("Tracking v2 site setting upsert did not return a row.");
        }

        return setting;
      });
    },

    async listEvents(input) {
      const rows = await database
        .select(eventReadSelection)
        .from(trackingRecipientEvents)
        .innerJoin(sites, eq(trackingRecipientEvents.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingRecipientEvents.recipientId, siteVariants.id))
        .leftJoin(trackingRecipientSessions, eq(trackingRecipientEvents.sessionId, trackingRecipientSessions.id))
        .where(and(...buildTrackingV2EventReadConditions(input)))
        .orderBy(desc(trackingRecipientEvents.receivedAt), desc(trackingRecipientEvents.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);

      return {
        records: page.map(toEventReadRecord),
        nextCursor: rows.length > input.limit && last
          ? {
              receivedAt: last.receivedAt,
              id: last.id,
            }
          : null,
      };
    },

    async listSessions(input) {
      const rows = await database
        .select(sessionReadSelection)
        .from(trackingRecipientSessions)
        .innerJoin(sites, eq(trackingRecipientSessions.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingRecipientSessions.recipientId, siteVariants.id))
        .where(and(...buildTrackingV2SessionReadConditions(input)))
        .orderBy(desc(trackingRecipientSessions.startedAt), desc(trackingRecipientSessions.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);

      return {
        records: page.map(toSessionReadRecord),
        nextCursor: rows.length > input.limit && last
          ? {
              startedAt: last.startedAt,
              id: last.rowId,
            }
          : null,
      };
    },

    async findReadSession(input) {
      const [row] = await database
        .select(sessionReadSelection)
        .from(trackingRecipientSessions)
        .innerJoin(sites, eq(trackingRecipientSessions.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingRecipientSessions.recipientId, siteVariants.id))
        .where(and(
          eq(trackingRecipientSessions.workspaceId, input.workspace.id),
          eq(trackingRecipientSessions.publicSessionId, input.publicSessionId),
          ...buildTrackingV2ReadSiteAccessConditions(input.workspace, input.userId),
        ))
        .limit(1);

      return row ? toSessionReadRecord(row) : null;
    },

    async expireStaleSessions(input) {
      const candidates = await database
        .select({ id: trackingRecipientSessions.id })
        .from(trackingRecipientSessions)
        .where(and(
          eq(trackingRecipientSessions.state, "active"),
          lte(trackingRecipientSessions.lastSeenAt, input.staleBefore),
        ))
        .orderBy(asc(trackingRecipientSessions.lastSeenAt), asc(trackingRecipientSessions.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const expired = await database
        .update(trackingRecipientSessions)
        .set({
          state: "expired",
          endedAt: trackingRecipientSessions.lastSeenAt,
          endReason: "server_expired",
          durationMs: sql`greatest(
            0,
            extract(epoch from (${trackingRecipientSessions.lastSeenAt} - ${trackingRecipientSessions.startedAt})) * 1000
          )::integer`,
          updatedAt: input.now,
        })
        .where(and(
          inArray(trackingRecipientSessions.id, ids),
          eq(trackingRecipientSessions.state, "active"),
          lte(trackingRecipientSessions.lastSeenAt, input.staleBefore),
        ))
        .returning({ id: trackingRecipientSessions.id });

      return expired.length;
    },

    async pruneRawIpAddresses(input) {
      const candidates = await database
        .select({ id: trackingRecipientSessions.id })
        .from(trackingRecipientSessions)
        .where(and(
          isNotNull(trackingRecipientSessions.ipAddress),
          sessionStartedBeforeEffectiveRetentionCutoff({
            now: input.now,
            retentionColumn: "raw_ip_retention_days",
            defaultDays: 30,
          }),
        ))
        .orderBy(asc(trackingRecipientSessions.startedAt), asc(trackingRecipientSessions.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const updated = await database
        .update(trackingRecipientSessions)
        .set({
          ipAddress: null,
          updatedAt: input.now,
        })
        .where(inArray(trackingRecipientSessions.id, ids))
        .returning({ id: trackingRecipientSessions.id });

      return updated.length;
    },

    async pruneExpiredEvents(input) {
      const candidates = await database
        .select({ id: trackingRecipientEvents.id })
        .from(trackingRecipientEvents)
        .where(eventReceivedBeforeEffectiveRetentionCutoff({
          now: input.now,
          retentionColumn: "event_retention_days",
          defaultDays: 365,
        }))
        .orderBy(asc(trackingRecipientEvents.receivedAt), asc(trackingRecipientEvents.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const deleted = await database
        .delete(trackingRecipientEvents)
        .where(inArray(trackingRecipientEvents.id, ids))
        .returning({ id: trackingRecipientEvents.id });

      return deleted.length;
    },

    async pruneExpiredSessions(input) {
      const candidates = await database
        .select({ id: trackingRecipientSessions.id })
        .from(trackingRecipientSessions)
        .where(and(
          sessionStartedBeforeEffectiveRetentionCutoff({
            now: input.now,
            retentionColumn: "event_retention_days",
            defaultDays: 365,
          }),
          sql`not exists (
            select 1
            from tracking_recordings recording
            where recording.session_id = ${trackingRecipientSessions.id}
              and recording.status <> 'deleted'
          )`,
        ))
        .orderBy(asc(trackingRecipientSessions.startedAt), asc(trackingRecipientSessions.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const deleted = await database
        .delete(trackingRecipientSessions)
        .where(inArray(trackingRecipientSessions.id, ids))
        .returning({ id: trackingRecipientSessions.id });

      return deleted.length;
    },

    async pruneExpiredSuppressionMarkers(input) {
      const candidates = await database
        .select({ id: trackingSuppressionMarkers.id })
        .from(trackingSuppressionMarkers)
        .where(and(
          isNotNull(trackingSuppressionMarkers.expiresAt),
          lte(trackingSuppressionMarkers.expiresAt, input.now),
        ))
        .orderBy(asc(trackingSuppressionMarkers.expiresAt), asc(trackingSuppressionMarkers.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const deleted = await database
        .delete(trackingSuppressionMarkers)
        .where(inArray(trackingSuppressionMarkers.id, ids))
        .returning({ id: trackingSuppressionMarkers.id });

      return deleted.length;
    },

    async expireRecordings(input) {
      return database.transaction(async (transaction) => {
        const candidates = await transaction
          .select({
            id: trackingRecordings.id,
            sessionId: trackingRecordings.sessionId,
          })
          .from(trackingRecordings)
          .where(and(
            lte(trackingRecordings.expiresAt, input.now),
            sql`${trackingRecordings.status} not in ('expired', 'deleted')`,
          ))
          .orderBy(asc(trackingRecordings.expiresAt), asc(trackingRecordings.id))
          .limit(input.limit);
        const recordingIds = candidates.map((row) => row.id);
        const sessionIds = candidates.map((row) => row.sessionId);

        if (recordingIds.length === 0) {
          return 0;
        }

        const expired = await transaction
          .update(trackingRecordings)
          .set({
            status: "expired",
            updatedAt: input.now,
          })
          .where(inArray(trackingRecordings.id, recordingIds))
          .returning({ id: trackingRecordings.id });

        if (sessionIds.length > 0) {
          await transaction
            .update(trackingRecipientSessions)
            .set({
              recordingStatus: "expired",
              recordingObjectKey: null,
              updatedAt: input.now,
            })
            .where(inArray(trackingRecipientSessions.id, sessionIds));
        }

        return expired.length;
      });
    },

    async listExpiredRecordingChunks(input) {
      return database
        .select({
          id: trackingRecordingChunks.id,
          recordingId: trackingRecordingChunks.recordingId,
          objectKey: trackingRecordingChunks.objectKey,
        })
        .from(trackingRecordingChunks)
        .innerJoin(trackingRecordings, eq(trackingRecordingChunks.recordingId, trackingRecordings.id))
        .where(and(
          lte(trackingRecordings.expiresAt, input.now),
          sql`${trackingRecordings.status} in ('expired', 'deleted')`,
        ))
        .orderBy(asc(trackingRecordings.expiresAt), asc(trackingRecordingChunks.recordingId), asc(trackingRecordingChunks.sequence))
        .limit(input.limit);
    },

    async deleteRecordingChunks(input) {
      if (input.chunkIds.length === 0) {
        return 0;
      }

      const deleted = await database
        .delete(trackingRecordingChunks)
        .where(inArray(trackingRecordingChunks.id, input.chunkIds))
        .returning({ id: trackingRecordingChunks.id });

      return deleted.length;
    },

    async markExpiredRecordingsDeleted(input) {
      const candidates = await database
        .select({ id: trackingRecordings.id })
        .from(trackingRecordings)
        .where(and(
          lte(trackingRecordings.expiresAt, input.now),
          eq(trackingRecordings.status, "expired"),
          sql`not exists (
            select 1
            from tracking_recording_chunks chunk
            where chunk.recording_id = ${trackingRecordings.id}
          )`,
        ))
        .orderBy(asc(trackingRecordings.expiresAt), asc(trackingRecordings.id))
        .limit(input.limit);
      const ids = candidates.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      const deleted = await database
        .update(trackingRecordings)
        .set({
          status: "deleted",
          updatedAt: input.now,
        })
        .where(inArray(trackingRecordings.id, ids))
        .returning({ id: trackingRecordings.id });

      return deleted.length;
    },

    async createSession(input) {
      const [session] = await database
        .insert(trackingRecipientSessions)
        .values({
          publicSessionId: input.publicSessionId,
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          recipientId: input.recipientId,
          publishedVersionId: input.publishedVersionId,
          eventTokenHash: input.eventTokenHash,
          deviceIdHash: input.deviceIdHash,
          ipAddress: input.ipAddress,
          ipAddressHash: input.ipAddressHash,
          city: input.city,
          region: input.region,
          countryCode: input.countryCode,
          deviceType: input.deviceType,
          osName: input.osName,
          browserName: input.browserName,
          userAgentFamily: input.userAgentFamily,
          referrerHost: input.referrerHost,
          initialPath: input.initialPath,
          startedAt: input.startedAt,
          lastSeenAt: input.startedAt,
          recordingStatus: "disabled",
        })
        .returning({
          id: trackingRecipientSessions.id,
          publicSessionId: trackingRecipientSessions.publicSessionId,
          workspaceId: trackingRecipientSessions.workspaceId,
          siteId: trackingRecipientSessions.siteId,
          recipientId: trackingRecipientSessions.recipientId,
          publishedVersionId: trackingRecipientSessions.publishedVersionId,
          state: trackingRecipientSessions.state,
          startedAt: trackingRecipientSessions.startedAt,
          lastSeenAt: trackingRecipientSessions.lastSeenAt,
          activeMs: trackingRecipientSessions.activeMs,
        });

      if (!session) {
        throw new Error("Tracking v2 session insert did not return a row.");
      }

      return session;
    },

    async findSessionForEventToken(input) {
      const [session] = await database
        .select({
          id: trackingRecipientSessions.id,
          publicSessionId: trackingRecipientSessions.publicSessionId,
          workspaceId: trackingRecipientSessions.workspaceId,
          siteId: trackingRecipientSessions.siteId,
          recipientId: trackingRecipientSessions.recipientId,
          publishedVersionId: trackingRecipientSessions.publishedVersionId,
          state: trackingRecipientSessions.state,
          startedAt: trackingRecipientSessions.startedAt,
          lastSeenAt: trackingRecipientSessions.lastSeenAt,
          activeMs: trackingRecipientSessions.activeMs,
        })
        .from(trackingRecipientSessions)
        .where(
          and(
            eq(trackingRecipientSessions.publicSessionId, input.publicSessionId),
            eq(trackingRecipientSessions.eventTokenHash, input.eventTokenHash),
            inArray(trackingRecipientSessions.state, ["active"]),
            gt(trackingRecipientSessions.lastSeenAt, input.activeAfter),
          ),
        )
        .limit(1);

      return session ?? null;
    },

    async recordBrowserEvents(input) {
      const rows = input.events.map((event) =>
        toBrowserEventRow({
          event,
          batchId: input.batchId,
          session: input.session,
          scriptVersion: input.scriptVersion,
          receivedAt: input.receivedAt,
        }),
      );

      return database.transaction(async (transaction) => {
        const touched = await transaction
          .update(trackingRecipientSessions)
          .set({
            lastSeenAt: input.receivedAt,
            updatedAt: input.receivedAt,
          })
          .where(and(
            eq(trackingRecipientSessions.id, input.session.id),
            eq(trackingRecipientSessions.state, "active"),
            gt(trackingRecipientSessions.lastSeenAt, input.activeAfter),
          ))
          .returning({ id: trackingRecipientSessions.id });

        if (touched.length === 0) {
          return false;
        }

        if (rows.length > 0) {
          await transaction
            .insert(trackingRecipientEvents)
            .values(rows)
            .onConflictDoNothing({ target: trackingRecipientEvents.eventId });
        }

        return true;
      });
    },

    async recordServerEvent(input) {
      await database
        .insert(trackingRecipientEvents)
        .values({
          eventId: input.eventId,
          batchId: null,
          sessionId: null,
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          recipientId: input.recipientId,
          publishedVersionId: input.publishedVersionId,
          type: input.type,
          source: input.source,
          webhookId: input.webhookId ?? null,
          webhookUrl: input.webhookUrl ?? null,
          eventData: input.eventData,
          occurredAt: input.occurredAt,
          receivedAt: input.receivedAt,
        })
        .onConflictDoNothing({ target: trackingRecipientEvents.eventId });
    },

    async createRecording(input) {
      const objectPrefix = getRecordingObjectPrefix({
        workspaceId: input.workspaceId,
        recordingId: input.recordingId,
      });
      const [recording] = await database
        .insert(trackingRecordings)
        .values({
          id: input.recordingId,
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          recipientId: input.recipientId,
          sessionId: input.sessionId,
          publicSessionId: input.publicSessionId,
          status: "pending",
          runtimeVersion: input.runtimeVersion,
          uploadTokenHash: input.uploadTokenHash,
          maxDurationMs: input.maxDurationMs,
          maxChunkBytes: input.maxChunkBytes,
          maxEvents: input.maxEvents,
          startedAt: input.startedAt,
          objectPrefix,
          expiresAt: input.expiresAt,
        })
        .returning(recordingSelection);

      if (!recording) {
        throw new Error("Tracking v2 recording insert did not return a row.");
      }

      await database
        .update(trackingRecipientSessions)
        .set({
          recordingStatus: "pending",
          updatedAt: input.startedAt,
        })
        .where(eq(trackingRecipientSessions.id, input.sessionId));

      return toRecordingRecord(recording);
    },

    async updateSessionRecordingStatus(input) {
      await database
        .update(trackingRecipientSessions)
        .set({
          recordingStatus: input.status,
          recordingDurationMs: input.recordingDurationMs ?? trackingRecipientSessions.recordingDurationMs,
          recordingObjectKey: input.recordingObjectKey ?? trackingRecipientSessions.recordingObjectKey,
          updatedAt: input.updatedAt,
        })
        .where(eq(trackingRecipientSessions.id, input.sessionId));
    },

    async findRecordingForUploadToken(input) {
      const [recording] = await database
        .select(recordingSelection)
        .from(trackingRecordings)
        .where(
          and(
            eq(trackingRecordings.id, input.recordingId),
            eq(trackingRecordings.uploadTokenHash, input.uploadTokenHash),
            inArray(trackingRecordings.status, ["pending", "recording", "available", "truncated", "failed"]),
          ),
        )
        .limit(1);

      return recording ? toRecordingRecord(recording) : null;
    },

    async findRecordingForWorkspace(input) {
      const [recording] = await database
        .select(recordingSelection)
        .from(trackingRecordings)
        .where(
          and(
            eq(trackingRecordings.workspaceId, input.workspaceId),
            eq(trackingRecordings.publicSessionId, input.publicSessionId),
          ),
        )
        .limit(1);

      return recording ? toRecordingRecord(recording) : null;
    },

    async findRecordingChunk(input) {
      const [chunk] = await database
        .select(recordingChunkSelection)
        .from(trackingRecordingChunks)
        .where(
          and(
            eq(trackingRecordingChunks.recordingId, input.recordingId),
            eq(trackingRecordingChunks.sequence, input.sequence),
          ),
        )
        .limit(1);

      return chunk ? toRecordingChunkRecord(chunk) : null;
    },

    async listRecordingChunks(recordingId) {
      const chunks = await database
        .select(recordingChunkSelection)
        .from(trackingRecordingChunks)
        .where(eq(trackingRecordingChunks.recordingId, recordingId))
        .orderBy(asc(trackingRecordingChunks.sequence));

      return chunks.map(toRecordingChunkRecord);
    },

    async insertRecordingChunk(input) {
      const [inserted] = await database
        .insert(trackingRecordingChunks)
        .values({
          recordingId: input.recordingId,
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          publicSessionId: input.publicSessionId,
          sequence: input.sequence,
          objectKey: input.objectKey,
          eventCount: input.eventCount,
          compressedBytes: input.compressedBytes,
          uncompressedBytes: input.uncompressedBytes,
          checksumSha256: input.checksumSha256,
          firstEventAt: input.firstEventAt,
          lastEventAt: input.lastEventAt,
          receivedAt: input.receivedAt,
        })
        .onConflictDoNothing({
          target: [
            trackingRecordingChunks.recordingId,
            trackingRecordingChunks.sequence,
          ],
        })
        .returning(recordingChunkSelection);

      if (inserted) {
        return {
          inserted: true,
          chunk: toRecordingChunkRecord(inserted),
        };
      }

      const [existingChunk] = await database
        .select(recordingChunkSelection)
        .from(trackingRecordingChunks)
        .where(
          and(
            eq(trackingRecordingChunks.recordingId, input.recordingId),
            eq(trackingRecordingChunks.sequence, input.sequence),
          ),
        )
        .limit(1);
      const existing = existingChunk ? toRecordingChunkRecord(existingChunk) : null;

      if (!existing) {
        throw new Error("Tracking recording chunk conflict did not return an existing row.");
      }

      return {
        inserted: false,
        chunk: existing,
      };
    },

    async updateRecordingAfterChunk(input) {
      await database
        .update(trackingRecordings)
        .set({
          status: sql`case
            when ${trackingRecordings.status} in ('pending', 'recording')
              then ${input.status}
            else ${trackingRecordings.status}
          end`,
          eventCount: sql`${trackingRecordings.eventCount} + ${input.addedEventCount}`,
          chunkCount: sql`${trackingRecordings.chunkCount} + 1`,
          compressedBytes: sql`${trackingRecordings.compressedBytes} + ${input.addedCompressedBytes}`,
          updatedAt: input.receivedAt,
        })
        .where(eq(trackingRecordings.id, input.recordingId));
    },

    async completeRecording(input) {
      await database
        .update(trackingRecordings)
        .set({
          status: input.status,
          endedAt: input.endedAt,
          durationMs: input.durationMs,
          stopReason: input.stopReason,
          finalSequence: input.finalSequence,
          errorCode: input.errorCode ?? null,
          updatedAt: input.updatedAt,
        })
        .where(eq(trackingRecordings.id, input.recordingId));
    },

    async requestRecordingCompletion(input) {
      await database
        .update(trackingRecordings)
        .set({
          status: "recording",
          endedAt: input.endedAt,
          durationMs: input.durationMs,
          stopReason: input.stopReason,
          finalSequence: input.finalSequence,
          errorCode: input.errorCode ?? null,
          updatedAt: input.updatedAt,
        })
        .where(eq(trackingRecordings.id, input.recordingId));
    },

    async incrementRecordingUsage(input) {
      await database
        .insert(trackingRecordingUsageDaily)
        .values({
          workspaceId: input.workspaceId,
          date: input.date,
          recordingCount: input.recordingCount,
          compressedBytes: input.compressedBytes,
        })
        .onConflictDoUpdate({
          target: [
            trackingRecordingUsageDaily.workspaceId,
            trackingRecordingUsageDaily.date,
          ],
          set: {
            recordingCount: sql`${trackingRecordingUsageDaily.recordingCount} + ${input.recordingCount}`,
            compressedBytes: sql`${trackingRecordingUsageDaily.compressedBytes} + ${input.compressedBytes}`,
          },
        });
    },

    getRecordingChunkObjectKey(input) {
      const checksumSuffix = input.checksumSha256 ? `.${input.checksumSha256}` : "";
      return `${getRecordingObjectPrefix(input)}/chunks/${String(input.sequence).padStart(6, "0")}${checksumSuffix}.json`;
    },

    async updateSessionHeartbeat(input) {
      const updated = await database
        .update(trackingRecipientSessions)
        .set({
          lastSeenAt: input.occurredAt,
          activeMs: input.activeMs,
          maxScrollDepthPercent:
            input.maxScrollDepthPercent === null
              ? trackingRecipientSessions.maxScrollDepthPercent
              : sql`greatest(coalesce(${trackingRecipientSessions.maxScrollDepthPercent}, 0), ${input.maxScrollDepthPercent})`,
          updatedAt: input.occurredAt,
        })
        .where(and(
          eq(trackingRecipientSessions.id, input.sessionId),
          eq(trackingRecipientSessions.state, "active"),
          gt(trackingRecipientSessions.lastSeenAt, input.activeAfter),
        ))
        .returning({ id: trackingRecipientSessions.id });

      return updated.length === 1;
    },

    async endSession(input) {
      const occurredAtIso = input.occurredAt.toISOString();

      const updated = await database
        .update(trackingRecipientSessions)
        .set({
          state: "ended",
          endedAt: input.occurredAt,
          lastSeenAt: input.occurredAt,
          endReason: input.reason,
          activeMs: input.activeMs ?? trackingRecipientSessions.activeMs,
          durationMs: sql`greatest(0, extract(epoch from (${occurredAtIso}::timestamptz - ${trackingRecipientSessions.startedAt})) * 1000)::integer`,
          updatedAt: input.occurredAt,
        })
        .where(and(
          eq(trackingRecipientSessions.id, input.sessionId),
          eq(trackingRecipientSessions.state, "active"),
          gt(trackingRecipientSessions.lastSeenAt, input.activeAfter),
        ))
        .returning({ id: trackingRecipientSessions.id });

      return updated.length === 1;
    },
  };
}

export function toBrowserEventRow(input: {
  event: TrackingV2BrowserEvent;
  batchId: string;
  session: TrackingV2SessionRecord;
  scriptVersion: string;
  receivedAt: Date;
}) {
  const element = "element" in input.event ? input.event.element : null;
  const tabLabel =
    input.event.type === "tab_switch"
      ? input.event.element.label
      : input.event.type === "site_visit"
        ? input.event.tab?.label ?? null
        : null;

  return {
    eventId: input.event.eventId,
    batchId: input.batchId,
    sessionId: input.session.id,
    workspaceId: input.session.workspaceId,
    siteId: input.session.siteId,
    recipientId: input.session.recipientId,
    publishedVersionId: input.session.publishedVersionId,
    type: input.event.type,
    source: "browser" as const,
    tabLabel,
    elementKind: element?.kind ?? null,
    elementId: element?.id ?? null,
    elementLabel: element?.label ?? null,
    elementHref: element?.href ?? null,
    webhookId: null,
    webhookUrl: null,
    scriptVersion: input.scriptVersion,
    eventData: getBrowserEventData(input.event),
    occurredAt: new Date(input.event.occurredAt),
    receivedAt: input.receivedAt,
  };
}

const eventReadSelection = {
  id: trackingRecipientEvents.id,
  workspaceId: trackingRecipientEvents.workspaceId,
  eventId: trackingRecipientEvents.eventId,
  type: trackingRecipientEvents.type,
  source: trackingRecipientEvents.source,
  siteId: sites.id,
  siteName: sites.name,
  siteSlug: sites.slug,
  siteCreatedByUserId: sites.createdByUserId,
  siteVisibility: sites.visibility,
  recipientId: siteVariants.id,
  recipientVariantName: siteVariants.name,
  recipientSlug: siteVariants.slug,
  recipientName: siteVariants.recipientName,
  recipientCompany: siteVariants.recipientCompany,
  recipientVariableValues: siteVariants.variableValues,
  sessionPublicSessionId: trackingRecipientSessions.publicSessionId,
  sessionState: trackingRecipientSessions.state,
  sessionStartedAt: trackingRecipientSessions.startedAt,
  sessionLastSeenAt: trackingRecipientSessions.lastSeenAt,
  sessionDeviceType: trackingRecipientSessions.deviceType,
  sessionOsName: trackingRecipientSessions.osName,
  sessionBrowserName: trackingRecipientSessions.browserName,
  sessionCity: trackingRecipientSessions.city,
  sessionRegion: trackingRecipientSessions.region,
  sessionCountryCode: trackingRecipientSessions.countryCode,
  tabLabel: trackingRecipientEvents.tabLabel,
  elementKind: trackingRecipientEvents.elementKind,
  elementId: trackingRecipientEvents.elementId,
  elementLabel: trackingRecipientEvents.elementLabel,
  elementHref: trackingRecipientEvents.elementHref,
  webhookId: trackingRecipientEvents.webhookId,
  webhookUrl: trackingRecipientEvents.webhookUrl,
  occurredAt: trackingRecipientEvents.occurredAt,
  receivedAt: trackingRecipientEvents.receivedAt,
};

const sessionReadSelection = {
  rowId: trackingRecipientSessions.id,
  workspaceId: trackingRecipientSessions.workspaceId,
  publicSessionId: trackingRecipientSessions.publicSessionId,
  siteId: sites.id,
  siteName: sites.name,
  siteSlug: sites.slug,
  siteCreatedByUserId: sites.createdByUserId,
  siteVisibility: sites.visibility,
  recipientId: siteVariants.id,
  recipientVariantName: siteVariants.name,
  recipientSlug: siteVariants.slug,
  recipientName: siteVariants.recipientName,
  recipientCompany: siteVariants.recipientCompany,
  recipientVariableValues: siteVariants.variableValues,
  state: trackingRecipientSessions.state,
  ipAddress: trackingRecipientSessions.ipAddress,
  city: trackingRecipientSessions.city,
  region: trackingRecipientSessions.region,
  countryCode: trackingRecipientSessions.countryCode,
  deviceType: trackingRecipientSessions.deviceType,
  osName: trackingRecipientSessions.osName,
  browserName: trackingRecipientSessions.browserName,
  referrerHost: trackingRecipientSessions.referrerHost,
  initialPath: trackingRecipientSessions.initialPath,
  startedAt: trackingRecipientSessions.startedAt,
  lastSeenAt: trackingRecipientSessions.lastSeenAt,
  endedAt: trackingRecipientSessions.endedAt,
  endReason: trackingRecipientSessions.endReason,
  activeMs: trackingRecipientSessions.activeMs,
  durationMs: trackingRecipientSessions.durationMs,
  maxScrollDepthPercent: trackingRecipientSessions.maxScrollDepthPercent,
  recordingStatus: trackingRecipientSessions.recordingStatus,
  recordingDurationMs: trackingRecipientSessions.recordingDurationMs,
};

type TrackingV2EventReadRow = {
  id: string;
  workspaceId: string;
  eventId: string;
  type: TrackingV2EventType;
  source: TrackingV2EventSource;
  siteId: string;
  siteName: string;
  siteSlug: string;
  siteCreatedByUserId: string;
  siteVisibility: "private" | "team";
  recipientId: string | null;
  recipientVariantName: string | null;
  recipientSlug: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  recipientVariableValues: Record<string, unknown> | null;
  sessionPublicSessionId: string | null;
  sessionState: TrackingV2SessionState | null;
  sessionStartedAt: Date | null;
  sessionLastSeenAt: Date | null;
  sessionDeviceType: string | null;
  sessionOsName: string | null;
  sessionBrowserName: string | null;
  sessionCity: string | null;
  sessionRegion: string | null;
  sessionCountryCode: string | null;
  tabLabel: string | null;
  elementKind: TrackingV2ElementKind | null;
  elementId: string | null;
  elementLabel: string | null;
  elementHref: string | null;
  webhookId: string | null;
  webhookUrl: string | null;
  occurredAt: Date;
  receivedAt: Date;
};

type TrackingV2SessionReadRow = {
  rowId: string;
  workspaceId: string;
  publicSessionId: string;
  siteId: string;
  siteName: string;
  siteSlug: string;
  siteCreatedByUserId: string;
  siteVisibility: "private" | "team";
  recipientId: string | null;
  recipientVariantName: string | null;
  recipientSlug: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  recipientVariableValues: Record<string, unknown> | null;
  state: TrackingV2SessionState;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  referrerHost: string | null;
  initialPath: string | null;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  activeMs: number;
  durationMs: number | null;
  maxScrollDepthPercent: number | null;
  recordingStatus: TrackingV2ReadRecordingStatus;
  recordingDurationMs: number | null;
};

function toEventReadRecord(row: TrackingV2EventReadRow): TrackingV2EventReadRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    source: row.source,
    site: {
      id: row.siteId,
      name: row.siteName,
      slug: row.siteSlug,
    },
    recipient: toRecipientSummary(row),
    sessionId: row.sessionPublicSessionId,
    session: row.sessionPublicSessionId && row.sessionState && row.sessionStartedAt && row.sessionLastSeenAt
      ? {
          id: row.sessionPublicSessionId,
          state: row.sessionState,
          startedAt: row.sessionStartedAt,
          lastSeenAt: row.sessionLastSeenAt,
          device: {
            type: row.sessionDeviceType,
            os: row.sessionOsName,
            browser: row.sessionBrowserName,
          },
          location: {
            city: row.sessionCity,
            region: row.sessionRegion,
            countryCode: row.sessionCountryCode,
          },
        }
      : null,
    tab: row.tabLabel ? { label: row.tabLabel } : null,
    element: row.elementKind && row.elementLabel
      ? {
          kind: row.elementKind,
          id: row.elementId,
          label: row.elementLabel,
          href: row.elementHref,
        }
      : null,
    webhook: row.webhookId && row.webhookUrl
      ? {
          id: row.webhookId,
          url: row.webhookUrl,
        }
      : null,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
  };
}

function toSessionReadRecord(row: TrackingV2SessionReadRow): TrackingV2SessionReadRecord {
  return {
    id: row.publicSessionId,
    site: {
      id: row.siteId,
      name: row.siteName,
      slug: row.siteSlug,
    },
    recipient: toRecipientSummary(row),
    state: row.state,
    device: {
      type: row.deviceType,
      os: row.osName,
      browser: row.browserName,
    },
    location: {
      city: row.city,
      region: row.region,
      countryCode: row.countryCode,
    },
    ipAddress: row.ipAddress,
    initialPath: row.initialPath,
    referrerHost: row.referrerHost,
    startedAt: row.startedAt,
    lastSeenAt: row.lastSeenAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    activeMs: row.activeMs,
    durationMs: row.durationMs,
    maxScrollDepthPercent: row.maxScrollDepthPercent,
    recording: {
      status: row.recordingStatus,
      available: row.recordingStatus === "available",
      durationMs: row.recordingDurationMs,
    },
  };
}

function toRecipientSummary(row: {
  recipientId: string | null;
  recipientVariantName: string | null;
  recipientSlug: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  recipientVariableValues: Record<string, unknown> | null;
}): TrackingV2RecipientSummaryRecord | null {
  if (!row.recipientId || !row.recipientVariantName || !row.recipientSlug) {
    return null;
  }

  return {
    id: row.recipientId,
    name: row.recipientVariantName,
    slug: row.recipientSlug,
    recipientName: row.recipientName,
    recipientCompany: row.recipientCompany,
    website: readRecipientWebsite(row.recipientVariableValues),
  };
}

function readRecipientWebsite(values: Record<string, unknown> | null) {
  const website = values?.recipient_website
  return typeof website === "string" && website.trim() ? website.trim() : null
}

function buildTrackingV2EventReadConditions(input: TrackingV2ListEventsInput) {
  const conditions: SQL[] = [
    eq(trackingRecipientEvents.workspaceId, input.workspace.id),
    ...buildTrackingV2ReadSiteAccessConditions(input.workspace, input.userId),
  ];

  if (input.siteId) {
    conditions.push(eq(trackingRecipientEvents.siteId, input.siteId));
  }

  if (input.recipientId) {
    conditions.push(eq(trackingRecipientEvents.recipientId, input.recipientId));
  }

  if (input.sessionId) {
    conditions.push(eq(trackingRecipientSessions.publicSessionId, input.sessionId));
  }

  if (input.type) {
    conditions.push(eq(trackingRecipientEvents.type, input.type));
  }

  if (input.source) {
    conditions.push(eq(trackingRecipientEvents.source, input.source));
  }

  if (input.from) {
    conditions.push(gte(trackingRecipientEvents.receivedAt, input.from));
  }

  if (input.to) {
    conditions.push(lt(trackingRecipientEvents.receivedAt, input.to));
  }

  if (input.cursor) {
    conditions.push(or(
      lt(trackingRecipientEvents.receivedAt, input.cursor.receivedAt),
      and(
        eq(trackingRecipientEvents.receivedAt, input.cursor.receivedAt),
        lt(trackingRecipientEvents.id, input.cursor.id),
      ),
    )!);
  }

  return conditions;
}

function buildTrackingV2SessionReadConditions(input: TrackingV2ListSessionsInput) {
  const conditions: SQL[] = [
    eq(trackingRecipientSessions.workspaceId, input.workspace.id),
    ...buildTrackingV2ReadSiteAccessConditions(input.workspace, input.userId),
  ];

  if (input.siteId) {
    conditions.push(eq(trackingRecipientSessions.siteId, input.siteId));
  }

  if (input.recipientId) {
    conditions.push(eq(trackingRecipientSessions.recipientId, input.recipientId));
  }

  if (input.state) {
    conditions.push(eq(trackingRecipientSessions.state, input.state));
  }

  if (input.recordingStatus) {
    conditions.push(eq(trackingRecipientSessions.recordingStatus, input.recordingStatus));
  }

  if (input.from) {
    conditions.push(gte(trackingRecipientSessions.startedAt, input.from));
  }

  if (input.to) {
    conditions.push(lt(trackingRecipientSessions.startedAt, input.to));
  }

  if (input.cursor) {
    conditions.push(or(
      lt(trackingRecipientSessions.startedAt, input.cursor.startedAt),
      and(
        eq(trackingRecipientSessions.startedAt, input.cursor.startedAt),
        lt(trackingRecipientSessions.id, input.cursor.id),
      ),
    )!);
  }

  return conditions;
}

function buildTrackingV2ReadSiteAccessConditions(
  workspace: TrackingV2ReadWorkspace,
  userId: string,
) {
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

type TrackingV2RetentionColumn = "raw_ip_retention_days" | "event_retention_days";

function sessionStartedBeforeEffectiveRetentionCutoff(input: {
  now: Date;
  retentionColumn: TrackingV2RetentionColumn;
  defaultDays: number;
}) {
  return sql`${trackingRecipientSessions.startedAt} <= ${input.now.toISOString()}::timestamptz - (${effectiveSessionRetentionDaysSql(input)} * interval '1 day')`;
}

function eventReceivedBeforeEffectiveRetentionCutoff(input: {
  now: Date;
  retentionColumn: TrackingV2RetentionColumn;
  defaultDays: number;
}) {
  return sql`${trackingRecipientEvents.receivedAt} <= ${input.now.toISOString()}::timestamptz - (${effectiveEventRetentionDaysSql(input)} * interval '1 day')`;
}

function effectiveSessionRetentionDaysSql(input: {
  retentionColumn: TrackingV2RetentionColumn;
  defaultDays: number;
}) {
  const column = sql.raw(input.retentionColumn);

  return sql`coalesce(
    (
      select recipient_setting.${column}
      from tracking_settings recipient_setting
      where recipient_setting.scope = 'recipient'
        and recipient_setting.workspace_id = ${trackingRecipientSessions.workspaceId}
        and recipient_setting.recipient_id = ${trackingRecipientSessions.recipientId}
      limit 1
    ),
    (
      select site_setting.${column}
      from tracking_settings site_setting
      where site_setting.scope = 'site'
        and site_setting.workspace_id = ${trackingRecipientSessions.workspaceId}
        and site_setting.site_id = ${trackingRecipientSessions.siteId}
      limit 1
    ),
    (
      select workspace_setting.${column}
      from tracking_settings workspace_setting
      where workspace_setting.scope = 'workspace'
        and workspace_setting.workspace_id = ${trackingRecipientSessions.workspaceId}
      limit 1
    ),
    ${input.defaultDays}
  )`;
}

function effectiveEventRetentionDaysSql(input: {
  retentionColumn: TrackingV2RetentionColumn;
  defaultDays: number;
}) {
  const column = sql.raw(input.retentionColumn);

  return sql`coalesce(
    (
      select recipient_setting.${column}
      from tracking_settings recipient_setting
      where recipient_setting.scope = 'recipient'
        and recipient_setting.workspace_id = ${trackingRecipientEvents.workspaceId}
        and recipient_setting.recipient_id = ${trackingRecipientEvents.recipientId}
      limit 1
    ),
    (
      select site_setting.${column}
      from tracking_settings site_setting
      where site_setting.scope = 'site'
        and site_setting.workspace_id = ${trackingRecipientEvents.workspaceId}
        and site_setting.site_id = ${trackingRecipientEvents.siteId}
      limit 1
    ),
    (
      select workspace_setting.${column}
      from tracking_settings workspace_setting
      where workspace_setting.scope = 'workspace'
        and workspace_setting.workspace_id = ${trackingRecipientEvents.workspaceId}
      limit 1
    ),
    ${input.defaultDays}
  )`;
}

const recordingSelection = {
  id: trackingRecordings.id,
  workspaceId: trackingRecordings.workspaceId,
  siteId: trackingRecordings.siteId,
  recipientId: trackingRecordings.recipientId,
  sessionId: trackingRecordings.sessionId,
  publicSessionId: trackingRecordings.publicSessionId,
  status: trackingRecordings.status,
  uploadTokenHash: trackingRecordings.uploadTokenHash,
  maxDurationMs: trackingRecordings.maxDurationMs,
  maxChunkBytes: trackingRecordings.maxChunkBytes,
  maxEvents: trackingRecordings.maxEvents,
  startedAt: trackingRecordings.startedAt,
  endedAt: trackingRecordings.endedAt,
  durationMs: trackingRecordings.durationMs,
  eventCount: trackingRecordings.eventCount,
  chunkCount: trackingRecordings.chunkCount,
  compressedBytes: trackingRecordings.compressedBytes,
  objectPrefix: trackingRecordings.objectPrefix,
  stopReason: trackingRecordings.stopReason,
  finalSequence: trackingRecordings.finalSequence,
  errorCode: trackingRecordings.errorCode,
  expiresAt: trackingRecordings.expiresAt,
};

const recordingChunkSelection = {
  id: trackingRecordingChunks.id,
  recordingId: trackingRecordingChunks.recordingId,
  workspaceId: trackingRecordingChunks.workspaceId,
  sessionId: trackingRecordingChunks.sessionId,
  publicSessionId: trackingRecordingChunks.publicSessionId,
  sequence: trackingRecordingChunks.sequence,
  objectKey: trackingRecordingChunks.objectKey,
  eventCount: trackingRecordingChunks.eventCount,
  compressedBytes: trackingRecordingChunks.compressedBytes,
  uncompressedBytes: trackingRecordingChunks.uncompressedBytes,
  checksumSha256: trackingRecordingChunks.checksumSha256,
  firstEventAt: trackingRecordingChunks.firstEventAt,
  lastEventAt: trackingRecordingChunks.lastEventAt,
  receivedAt: trackingRecordingChunks.receivedAt,
};

function toRecordingRecord(
  input: Omit<TrackingV2RecordingRecord, "status"> & { status: string },
): TrackingV2RecordingRecord {
  if (!isTrackingV2RecordingStatus(input.status)) {
    throw new Error(`Unknown tracking recording status: ${input.status}`);
  }

  return {
    ...input,
    status: input.status,
  };
}

function toRecordingChunkRecord(input: TrackingV2RecordingChunkRecord): TrackingV2RecordingChunkRecord {
  return input;
}

function isTrackingV2RecordingStatus(value: string): value is TrackingV2RecordingStatus {
  return value === "pending" ||
    value === "recording" ||
    value === "available" ||
    value === "truncated" ||
    value === "failed" ||
    value === "expired" ||
    value === "deleted";
}

function getRecordingObjectPrefix(input: {
  workspaceId: string;
  recordingId: string;
}) {
  return `tracking-recordings/${input.workspaceId}/${input.recordingId}`;
}

export type MemoryTrackingV2RepositoryInput = {
  contexts?: TrackingV2ResolvedContext[];
  settings?: Array<TrackingV2SettingRecord & {
    workspaceId: string;
    siteId: string | null;
    recipientId: string | null;
  }>;
  sites?: Array<TrackingV2SiteSummaryRecord & {
    workspaceId: string;
    createdByUserId?: string;
    visibility?: "private" | "team";
  }>;
  recipients?: Array<TrackingV2RecipientSummaryRecord & {
    workspaceId: string;
    siteId: string;
  }>;
};

type MemoryTrackingV2SessionRecord = TrackingV2SessionRecord & {
  eventTokenHash: string;
  deviceIdHash: string | null;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  referrerHost: string | null;
  initialPath: string | null;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  activeMs: number;
  durationMs: number | null;
  maxScrollDepthPercent: number | null;
  recordingStatus: TrackingV2ReadRecordingStatus;
  recordingDurationMs: number | null;
};

export function createMemoryTrackingV2Repository(
  input: MemoryTrackingV2RepositoryInput = {},
): TrackingV2Repository & {
  sessions: Map<string, MemoryTrackingV2SessionRecord>;
  events: TrackingV2StoredEvent[];
  recordings: Map<string, TrackingV2RecordingRecord>;
  recordingChunks: TrackingV2RecordingChunkRecord[];
  recordingUsage: Map<string, { recordingCount: number; compressedBytes: number }>;
  createSessionInputs: TrackingV2CreateSessionInput[];
} {
  const contexts = input.contexts ?? [];
  const settings = [...(input.settings ?? [])];
  const memorySites = new Map<string, TrackingV2SiteSummaryRecord & {
    workspaceId: string;
    createdByUserId: string;
    visibility: "private" | "team";
  }>();
  const memoryRecipients = new Map<string, TrackingV2RecipientSummaryRecord & {
    workspaceId: string;
    siteId: string;
  }>();

  for (const context of contexts) {
    memorySites.set(context.siteId, {
      id: context.siteId,
      workspaceId: context.workspaceId,
      name: "Test Site",
      slug: "test-site",
      createdByUserId: "user_router",
      visibility: "team",
    });

    if (context.recipientId) {
      memoryRecipients.set(context.recipientId, {
        id: context.recipientId,
        workspaceId: context.workspaceId,
        siteId: context.siteId,
        name: "Test Recipient",
        slug: "test-recipient",
        recipientName: "Taylor Recipient",
        recipientCompany: "Recipient Co",
        website: null,
      });
    }
  }

  for (const site of input.sites ?? []) {
    memorySites.set(site.id, {
      ...site,
      createdByUserId: site.createdByUserId ?? "user_router",
      visibility: site.visibility ?? "team",
    });
  }

  for (const recipient of input.recipients ?? []) {
    memoryRecipients.set(recipient.id, recipient);
  }

  const sessions = new Map<string, MemoryTrackingV2SessionRecord>();
  const events: TrackingV2StoredEvent[] = [];
  const recordings = new Map<string, TrackingV2RecordingRecord>();
  const recordingChunks: TrackingV2RecordingChunkRecord[] = [];
  const recordingUsage = new Map<string, { recordingCount: number; compressedBytes: number }>();
  const createSessionInputs: TrackingV2CreateSessionInput[] = [];

  return {
    sessions,
    events,
    recordings,
    recordingChunks,
    recordingUsage,
    createSessionInputs,

    async findCurrentContext(lookup) {
      return contexts.find((context) =>
        context.workspaceId === lookup.workspaceId &&
        context.siteId === lookup.siteId &&
        context.publishedVersionId === lookup.publishedVersionId &&
        context.recipientId === lookup.recipientId &&
        context.recipientRevision === lookup.recipientRevision
      ) ?? null;
    },

    async listSettings(lookup) {
      return settings
        .filter((setting) =>
          setting.workspaceId === lookup.workspaceId &&
          (
            (setting.scope === "workspace" && setting.siteId === null && setting.recipientId === null) ||
            (setting.scope === "site" && setting.siteId === lookup.siteId && setting.recipientId === null) ||
            (setting.scope === "recipient" && setting.siteId === lookup.siteId && setting.recipientId === lookup.recipientId)
          )
        )
        .map(toMemorySettingRecord);
    },

    async findSettingsSite(query) {
      const site = memorySites.get(query.siteId);

      if (
        !site ||
        site.workspaceId !== query.workspace.id ||
        !memoryCanReadSite(query.workspace, query.userId, site.createdByUserId, site.visibility)
      ) {
        return null;
      }

      return {
        id: site.id,
        name: site.name,
        slug: site.slug,
      };
    },

    async findSiteSetting(lookup) {
      const setting = settings.find((candidate) =>
        candidate.workspaceId === lookup.workspaceId &&
        candidate.siteId === lookup.siteId &&
        candidate.scope === "site" &&
        candidate.recipientId === null
      );

      return setting ? toMemorySettingRecord(setting) : null;
    },

    async upsertSiteSetting(input) {
      const existingIndex = settings.findIndex((candidate) =>
        candidate.workspaceId === input.workspaceId &&
        candidate.siteId === input.siteId &&
        candidate.scope === "site" &&
        candidate.recipientId === null
      );
      const nextSetting = {
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: null,
        scope: "site" as const,
        ...input.settings,
      };

      if (existingIndex >= 0) {
        settings[existingIndex] = nextSetting;
      } else {
        settings.push(nextSetting);
      }

      return toMemorySettingRecord(nextSetting);
    },

    async listEvents(query) {
      const rows = events
        .map((event) => toMemoryEventReadRow({
          event,
          sessions,
          sites: memorySites,
          recipients: memoryRecipients,
        }))
        .filter((row) => row !== null)
        .filter((row) => memoryEventMatchesQuery(row, query))
        .sort(compareEventReadRows);
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);

      return {
        records: page.map(toEventReadRecord),
        nextCursor: rows.length > query.limit && last
          ? {
              receivedAt: last.receivedAt,
              id: last.id,
            }
          : null,
      };
    },

    async listSessions(query) {
      const rows = [...sessions.values()]
        .map((session) => toMemorySessionReadRow({
          recipients: memoryRecipients,
          session,
          sites: memorySites,
        }))
        .filter((row) => row !== null)
        .filter((row) => memorySessionMatchesQuery(row, query))
        .sort(compareSessionReadRows);
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);

      return {
        records: page.map(toSessionReadRecord),
        nextCursor: rows.length > query.limit && last
          ? {
              startedAt: last.startedAt,
              id: last.rowId,
            }
          : null,
      };
    },

    async findReadSession(query) {
      const session = sessions.get(query.publicSessionId);
      if (!session) {
        return null;
      }

      const row = toMemorySessionReadRow({
        recipients: memoryRecipients,
        session,
        sites: memorySites,
      });

      if (
        !row ||
        !memoryCanReadSite(
          query.workspace,
          query.userId,
          row.siteCreatedByUserId,
          row.siteVisibility,
        )
      ) {
        return null;
      }

      return toSessionReadRecord(row);
    },

    async expireStaleSessions(input) {
      const candidates = [...sessions.values()]
        .filter((session) =>
          session.state === "active" && session.lastSeenAt <= input.staleBefore
        )
        .sort((left, right) => {
          const time = left.lastSeenAt.getTime() - right.lastSeenAt.getTime();
          return time === 0
            ? left.publicSessionId.localeCompare(right.publicSessionId)
            : time;
        })
        .slice(0, input.limit);

      for (const session of candidates) {
        session.state = "expired";
        session.endedAt = session.lastSeenAt;
        session.endReason = "server_expired";
        session.durationMs = Math.max(
          0,
          session.lastSeenAt.getTime() - session.startedAt.getTime(),
        );
      }

      return candidates.length;
    },

    async pruneRawIpAddresses(input) {
      const candidates = [...sessions.values()]
        .filter((session) =>
          session.ipAddress !== null &&
          memoryDateIsPastRetention({
            at: session.startedAt,
            now: input.now,
            retentionDays: getMemoryEffectiveRetentionDays({
              settings,
              workspaceId: session.workspaceId,
              siteId: session.siteId,
              recipientId: session.recipientId,
              field: "rawIpRetentionDays",
              defaultDays: 30,
            }),
          })
        )
        .sort(compareMemorySessionsByStartedAt)
        .slice(0, input.limit);

      for (const session of candidates) {
        session.ipAddress = null;
      }

      return candidates.length;
    },

    async pruneExpiredEvents(input) {
      const candidateIds = events
        .filter((event) =>
          memoryDateIsPastRetention({
            at: event.receivedAt,
            now: input.now,
            retentionDays: getMemoryEffectiveRetentionDays({
              settings,
              workspaceId: event.workspaceId,
              siteId: event.siteId,
              recipientId: event.recipientId,
              field: "eventRetentionDays",
              defaultDays: 365,
            }),
          })
        )
        .sort((left, right) => {
          const time = left.receivedAt.getTime() - right.receivedAt.getTime();
          return time === 0 ? (left.id ?? "").localeCompare(right.id ?? "") : time;
        })
        .slice(0, input.limit)
        .map((event) => event.id ?? event.eventId);
      const candidateSet = new Set(candidateIds);
      let deleted = 0;

      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]!;
        if (!candidateSet.has(event.id ?? event.eventId)) {
          continue;
        }

        events.splice(index, 1);
        deleted += 1;
      }

      return deleted;
    },

    async pruneExpiredSessions(input) {
      const candidates = [...sessions.values()]
        .filter((session) =>
          memoryDateIsPastRetention({
            at: session.startedAt,
            now: input.now,
            retentionDays: getMemoryEffectiveRetentionDays({
              settings,
              workspaceId: session.workspaceId,
              siteId: session.siteId,
              recipientId: session.recipientId,
              field: "eventRetentionDays",
              defaultDays: 365,
            }),
          }) &&
          ![...recordings.values()].some((recording) =>
            recording.sessionId === session.id &&
            recording.status !== "deleted"
          )
        )
        .sort(compareMemorySessionsByStartedAt)
        .slice(0, input.limit);

      for (const session of candidates) {
        sessions.delete(session.publicSessionId);
      }

      return candidates.length;
    },

    async pruneExpiredSuppressionMarkers() {
      return 0;
    },

    async expireRecordings(input) {
      const candidates = [...recordings.values()]
        .filter((recording) =>
          recording.expiresAt <= input.now &&
          recording.status !== "expired" &&
          recording.status !== "deleted"
        )
        .sort((left, right) => {
          const time = left.expiresAt.getTime() - right.expiresAt.getTime();
          return time === 0 ? left.id.localeCompare(right.id) : time;
        })
        .slice(0, input.limit);

      for (const recording of candidates) {
        recording.status = "expired";
        for (const session of sessions.values()) {
          if (session.id === recording.sessionId) {
            session.recordingStatus = "expired";
          }
        }
      }

      return candidates.length;
    },

    async listExpiredRecordingChunks(input) {
      return recordingChunks
        .filter((chunk) => {
          const recording = recordings.get(chunk.recordingId);
          return Boolean(
            recording &&
            recording.expiresAt <= input.now &&
            (recording.status === "expired" || recording.status === "deleted"),
          );
        })
        .sort((left, right) => {
          const recordingLeft = recordings.get(left.recordingId);
          const recordingRight = recordings.get(right.recordingId);
          const time = (recordingLeft?.expiresAt.getTime() ?? 0) - (recordingRight?.expiresAt.getTime() ?? 0);
          return time === 0 ? left.sequence - right.sequence : time;
        })
        .slice(0, input.limit)
        .map((chunk) => ({
          id: chunk.id,
          recordingId: chunk.recordingId,
          objectKey: chunk.objectKey,
        }));
    },

    async deleteRecordingChunks(input) {
      const ids = new Set(input.chunkIds);
      let deleted = 0;

      for (let index = recordingChunks.length - 1; index >= 0; index -= 1) {
        if (!ids.has(recordingChunks[index]!.id)) {
          continue;
        }

        recordingChunks.splice(index, 1);
        deleted += 1;
      }

      return deleted;
    },

    async markExpiredRecordingsDeleted(input) {
      const candidates = [...recordings.values()]
        .filter((recording) =>
          recording.expiresAt <= input.now &&
          recording.status === "expired" &&
          !recordingChunks.some((chunk) => chunk.recordingId === recording.id)
        )
        .sort((left, right) => {
          const time = left.expiresAt.getTime() - right.expiresAt.getTime();
          return time === 0 ? left.id.localeCompare(right.id) : time;
        })
        .slice(0, input.limit);

      for (const recording of candidates) {
        recording.status = "deleted";
      }

      return candidates.length;
    },

    async createSession(input) {
      createSessionInputs.push(input);
      const session: MemoryTrackingV2SessionRecord = {
        id: memoryUuid(sessions.size + 1),
        publicSessionId: input.publicSessionId,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: input.recipientId,
        publishedVersionId: input.publishedVersionId,
        state: "active",
        startedAt: input.startedAt,
        lastSeenAt: input.startedAt,
        eventTokenHash: input.eventTokenHash,
        deviceIdHash: input.deviceIdHash,
        ipAddress: input.ipAddress,
        city: input.city,
        region: input.region,
        countryCode: input.countryCode,
        deviceType: input.deviceType,
        osName: input.osName,
        browserName: input.browserName,
        referrerHost: input.referrerHost,
        initialPath: input.initialPath,
        endedAt: null,
        endReason: null,
        activeMs: 0,
        durationMs: null,
        maxScrollDepthPercent: null,
        recordingStatus: "disabled",
        recordingDurationMs: null,
      };

      sessions.set(input.publicSessionId, session);

      return session;
    },

    async findSessionForEventToken(input) {
      const session = sessions.get(input.publicSessionId);

      if (
        !session ||
        session.eventTokenHash !== input.eventTokenHash ||
        session.state !== "active" ||
        session.lastSeenAt <= input.activeAfter
      ) {
        return null;
      }

      return session;
    },

    async recordBrowserEvents(input) {
      const session = sessions.get(input.session.publicSessionId);
      if (
        !session ||
        session.state !== "active" ||
        session.lastSeenAt <= input.activeAfter
      ) {
        return false;
      }

      for (const event of input.events) {
        if (events.some((storedEvent) => storedEvent.eventId === event.eventId)) {
          continue;
        }

        const row = toBrowserEventRow({
          event,
          batchId: input.batchId,
          session: input.session,
          scriptVersion: input.scriptVersion,
          receivedAt: input.receivedAt,
        });

        events.push({
          ...row,
          id: memoryUuid(events.length + 1),
        });
      }

      session.lastSeenAt = input.receivedAt;
      return true;
    },

    async recordServerEvent(input) {
      if (events.some((storedEvent) => storedEvent.eventId === input.eventId)) {
        return;
      }

      events.push({
        id: memoryUuid(events.length + 1),
        eventId: input.eventId,
        batchId: null,
        sessionId: null,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: input.recipientId,
        publishedVersionId: input.publishedVersionId,
        type: input.type,
        source: input.source,
        tabLabel: null,
        elementKind: null,
        elementId: null,
        elementLabel: null,
        elementHref: null,
        webhookId: input.webhookId ?? null,
        webhookUrl: input.webhookUrl ?? null,
        scriptVersion: null,
        eventData: input.eventData,
        occurredAt: input.occurredAt,
        receivedAt: input.receivedAt,
      });
    },

    async createRecording(input) {
      const recording: TrackingV2RecordingRecord = {
        id: input.recordingId,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: input.recipientId,
        sessionId: input.sessionId,
        publicSessionId: input.publicSessionId,
        status: "pending",
        uploadTokenHash: input.uploadTokenHash,
        maxDurationMs: input.maxDurationMs,
        maxChunkBytes: input.maxChunkBytes,
        maxEvents: input.maxEvents,
        startedAt: input.startedAt,
        endedAt: null,
        durationMs: 0,
        eventCount: 0,
        chunkCount: 0,
        compressedBytes: 0,
        objectPrefix: getRecordingObjectPrefix({
          workspaceId: input.workspaceId,
          recordingId: input.recordingId,
        }),
        stopReason: null,
        finalSequence: null,
        errorCode: null,
        expiresAt: input.expiresAt,
      };

      recordings.set(recording.id, recording);
      for (const session of sessions.values()) {
        if (session.id === input.sessionId) {
          session.lastSeenAt = input.startedAt;
          session.recordingStatus = "pending";
        }
      }

      return recording;
    },

    async updateSessionRecordingStatus(input) {
      for (const session of sessions.values()) {
        if (session.id !== input.sessionId) {
          continue;
        }

        // The memory session record only stores lifecycle fields required by tests.
        session.lastSeenAt = input.updatedAt;
        session.recordingStatus = input.status;
        session.recordingDurationMs = input.recordingDurationMs ?? session.recordingDurationMs;
      }
    },

    async findRecordingForUploadToken(input) {
      const recording = recordings.get(input.recordingId);
      return recording &&
        recording.uploadTokenHash === input.uploadTokenHash &&
        (
          recording.status === "pending" ||
          recording.status === "recording" ||
          recording.status === "available" ||
          recording.status === "truncated" ||
          recording.status === "failed"
        )
        ? recording
        : null;
    },

    async findRecordingForWorkspace(input) {
      return [...recordings.values()].find((recording) =>
        recording.workspaceId === input.workspaceId &&
        recording.publicSessionId === input.publicSessionId
      ) ?? null;
    },

    async findRecordingChunk(input) {
      return recordingChunks.find((chunk) =>
        chunk.recordingId === input.recordingId &&
        chunk.sequence === input.sequence
      ) ?? null;
    },

    async listRecordingChunks(recordingId) {
      return recordingChunks
        .filter((chunk) => chunk.recordingId === recordingId)
        .sort((left, right) => left.sequence - right.sequence);
    },

    async insertRecordingChunk(input) {
      const existing = recordingChunks.find((chunk) =>
        chunk.recordingId === input.recordingId &&
        chunk.sequence === input.sequence
      );

      if (existing) {
        return {
          inserted: false,
          chunk: existing,
        };
      }

      const chunk: TrackingV2RecordingChunkRecord = {
        id: `recording_chunk_${input.recordingId}_${input.sequence}`,
        recordingId: input.recordingId,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        publicSessionId: input.publicSessionId,
        sequence: input.sequence,
        objectKey: input.objectKey,
        eventCount: input.eventCount,
        compressedBytes: input.compressedBytes,
        uncompressedBytes: input.uncompressedBytes,
        checksumSha256: input.checksumSha256,
        firstEventAt: input.firstEventAt,
        lastEventAt: input.lastEventAt,
        receivedAt: input.receivedAt,
      };
      recordingChunks.push(chunk);

      return {
        inserted: true,
        chunk,
      };
    },

    async updateRecordingAfterChunk(input) {
      const recording = recordings.get(input.recordingId);
      if (!recording) {
        return;
      }

      if (recording.status === "pending" || recording.status === "recording") {
        recording.status = input.status;
      }
      recording.eventCount += input.addedEventCount;
      recording.chunkCount += 1;
      recording.compressedBytes += input.addedCompressedBytes;
    },

    async completeRecording(input) {
      const recording = recordings.get(input.recordingId);
      if (!recording) {
        return;
      }

      recording.status = input.status;
      recording.endedAt = input.endedAt;
      recording.durationMs = input.durationMs;
      recording.stopReason = input.stopReason;
      recording.finalSequence = input.finalSequence;
      recording.errorCode = input.errorCode ?? null;
    },

    async requestRecordingCompletion(input) {
      const recording = recordings.get(input.recordingId);
      if (!recording) {
        return;
      }

      recording.status = "recording";
      recording.endedAt = input.endedAt;
      recording.durationMs = input.durationMs;
      recording.stopReason = input.stopReason;
      recording.finalSequence = input.finalSequence;
      recording.errorCode = input.errorCode ?? null;
    },

    async incrementRecordingUsage(input) {
      const key = `${input.workspaceId}:${input.date}`;
      const current = recordingUsage.get(key) ?? {
        recordingCount: 0,
        compressedBytes: 0,
      };
      current.recordingCount += input.recordingCount;
      current.compressedBytes += input.compressedBytes;
      recordingUsage.set(key, current);
    },

    getRecordingChunkObjectKey(input) {
      const checksumSuffix = input.checksumSha256 ? `.${input.checksumSha256}` : "";
      return `${getRecordingObjectPrefix(input)}/chunks/${String(input.sequence).padStart(6, "0")}${checksumSuffix}.json`;
    },

    async updateSessionHeartbeat(input) {
      for (const session of sessions.values()) {
        if (session.id !== input.sessionId) {
          continue;
        }

        if (session.state !== "active" || session.lastSeenAt <= input.activeAfter) {
          return false;
        }

        session.lastSeenAt = input.occurredAt;
        session.activeMs = input.activeMs;
        session.maxScrollDepthPercent = input.maxScrollDepthPercent === null
          ? session.maxScrollDepthPercent
          : Math.max(session.maxScrollDepthPercent ?? 0, input.maxScrollDepthPercent);
        return true;
      }

      return false;
    },

    async endSession(input) {
      for (const session of sessions.values()) {
        if (session.id !== input.sessionId) {
          continue;
        }

        if (session.state !== "active" || session.lastSeenAt <= input.activeAfter) {
          return false;
        }

        session.state = "ended";
        session.endedAt = input.occurredAt;
        session.endReason = input.reason;
        session.durationMs = Math.max(0, input.occurredAt.getTime() - session.startedAt.getTime());
        session.activeMs = input.activeMs ?? session.activeMs;
        session.lastSeenAt = input.occurredAt;
        return true;
      }

      return false;
    },
  };
}

function toMemoryEventReadRow(input: {
  event: TrackingV2StoredEvent;
  sessions: Map<string, MemoryTrackingV2SessionRecord>;
  sites: Map<string, TrackingV2SiteSummaryRecord & {
    workspaceId: string;
    createdByUserId: string;
    visibility: "private" | "team";
  }>;
  recipients: Map<string, TrackingV2RecipientSummaryRecord & {
    workspaceId: string;
    siteId: string;
  }>;
}): TrackingV2EventReadRow | null {
  const site = input.sites.get(input.event.siteId);
  if (!site) {
    return null;
  }

  const recipient = input.event.recipientId
    ? input.recipients.get(input.event.recipientId) ?? null
    : null;
  const session = input.event.sessionId
    ? [...input.sessions.values()].find((candidate) => candidate.id === input.event.sessionId) ?? null
    : null;

  return {
    id: input.event.id ?? memoryUuid(1),
    workspaceId: input.event.workspaceId,
    eventId: input.event.eventId,
    type: input.event.type,
    source: input.event.source,
    siteId: site.id,
    siteName: site.name,
    siteSlug: site.slug,
    siteCreatedByUserId: site.createdByUserId,
    siteVisibility: site.visibility,
    recipientId: recipient?.id ?? null,
    recipientVariantName: recipient?.name ?? null,
    recipientSlug: recipient?.slug ?? null,
    recipientName: recipient?.recipientName ?? null,
    recipientCompany: recipient?.recipientCompany ?? null,
    recipientVariableValues: recipient?.website
      ? { recipient_website: recipient.website }
      : null,
    sessionPublicSessionId: session?.publicSessionId ?? null,
    sessionState: session?.state ?? null,
    sessionStartedAt: session?.startedAt ?? null,
    sessionLastSeenAt: session?.lastSeenAt ?? null,
    sessionDeviceType: session?.deviceType ?? null,
    sessionOsName: session?.osName ?? null,
    sessionBrowserName: session?.browserName ?? null,
    sessionCity: session?.city ?? null,
    sessionRegion: session?.region ?? null,
    sessionCountryCode: session?.countryCode ?? null,
    tabLabel: input.event.tabLabel,
    elementKind: input.event.elementKind,
    elementId: input.event.elementId,
    elementLabel: input.event.elementLabel,
    elementHref: input.event.elementHref,
    webhookId: input.event.webhookId,
    webhookUrl: input.event.webhookUrl,
    occurredAt: input.event.occurredAt,
    receivedAt: input.event.receivedAt,
  };
}

function toMemorySessionReadRow(input: {
  session: MemoryTrackingV2SessionRecord;
  sites: Map<string, TrackingV2SiteSummaryRecord & {
    workspaceId: string;
    createdByUserId: string;
    visibility: "private" | "team";
  }>;
  recipients: Map<string, TrackingV2RecipientSummaryRecord & {
    workspaceId: string;
    siteId: string;
  }>;
}): TrackingV2SessionReadRow | null {
  const site = input.sites.get(input.session.siteId);
  if (!site) {
    return null;
  }

  const recipient = input.session.recipientId
    ? input.recipients.get(input.session.recipientId) ?? null
    : null;

  return {
    rowId: input.session.id,
    workspaceId: input.session.workspaceId,
    publicSessionId: input.session.publicSessionId,
    siteId: site.id,
    siteName: site.name,
    siteSlug: site.slug,
    siteCreatedByUserId: site.createdByUserId,
    siteVisibility: site.visibility,
    recipientId: recipient?.id ?? null,
    recipientVariantName: recipient?.name ?? null,
    recipientSlug: recipient?.slug ?? null,
    recipientName: recipient?.recipientName ?? null,
    recipientCompany: recipient?.recipientCompany ?? null,
    recipientVariableValues: recipient?.website
      ? { recipient_website: recipient.website }
      : null,
    state: input.session.state,
    ipAddress: input.session.ipAddress,
    city: input.session.city,
    region: input.session.region,
    countryCode: input.session.countryCode,
    deviceType: input.session.deviceType,
    osName: input.session.osName,
    browserName: input.session.browserName,
    referrerHost: input.session.referrerHost,
    initialPath: input.session.initialPath,
    startedAt: input.session.startedAt,
    lastSeenAt: input.session.lastSeenAt,
    endedAt: input.session.endedAt,
    endReason: input.session.endReason,
    activeMs: input.session.activeMs,
    durationMs: input.session.durationMs,
    maxScrollDepthPercent: input.session.maxScrollDepthPercent,
    recordingStatus: input.session.recordingStatus,
    recordingDurationMs: input.session.recordingDurationMs,
  };
}

function memoryEventMatchesQuery(
  row: TrackingV2EventReadRow,
  query: TrackingV2ListEventsInput,
) {
  return row.workspaceId === query.workspace.id &&
    memoryCanReadSite(query.workspace, query.userId, row.siteCreatedByUserId, row.siteVisibility) &&
    (!query.siteId || row.siteId === query.siteId) &&
    (!query.recipientId || row.recipientId === query.recipientId) &&
    (!query.sessionId || row.sessionPublicSessionId === query.sessionId) &&
    (!query.type || row.type === query.type) &&
    (!query.source || row.source === query.source) &&
    (!query.from || row.receivedAt >= query.from) &&
    (!query.to || row.receivedAt < query.to) &&
    (!query.cursor ||
      row.receivedAt < query.cursor.receivedAt ||
      (row.receivedAt.getTime() === query.cursor.receivedAt.getTime() && row.id < query.cursor.id));
}

function memorySessionMatchesQuery(
  row: TrackingV2SessionReadRow,
  query: TrackingV2ListSessionsInput,
) {
  return row.workspaceId === query.workspace.id &&
    memoryCanReadSite(query.workspace, query.userId, row.siteCreatedByUserId, row.siteVisibility) &&
    (!query.siteId || row.siteId === query.siteId) &&
    (!query.recipientId || row.recipientId === query.recipientId) &&
    (!query.state || row.state === query.state) &&
    (!query.recordingStatus || row.recordingStatus === query.recordingStatus) &&
    (!query.from || row.startedAt >= query.from) &&
    (!query.to || row.startedAt < query.to) &&
    (!query.cursor ||
      row.startedAt < query.cursor.startedAt ||
      (row.startedAt.getTime() === query.cursor.startedAt.getTime() && row.rowId < query.cursor.id));
}

function compareEventReadRows(left: TrackingV2EventReadRow, right: TrackingV2EventReadRow) {
  const time = right.receivedAt.getTime() - left.receivedAt.getTime();
  return time === 0 ? right.id.localeCompare(left.id) : time;
}

function compareSessionReadRows(left: TrackingV2SessionReadRow, right: TrackingV2SessionReadRow) {
  const time = right.startedAt.getTime() - left.startedAt.getTime();
  return time === 0 ? right.rowId.localeCompare(left.rowId) : time;
}

function compareMemorySessionsByStartedAt(
  left: MemoryTrackingV2SessionRecord,
  right: MemoryTrackingV2SessionRecord,
) {
  const time = left.startedAt.getTime() - right.startedAt.getTime();
  return time === 0 ? left.id.localeCompare(right.id) : time;
}

function memoryCanReadSite(
  workspace: TrackingV2ReadWorkspace,
  userId: string,
  siteCreatedByUserId: string,
  siteVisibility: "private" | "team",
) {
  if (workspace.role === "admin") {
    return true;
  }

  return siteCreatedByUserId === userId || siteVisibility === "team";
}

function toMemorySettingRecord(setting: TrackingV2SettingRecord): TrackingV2SettingRecord {
  return {
    scope: setting.scope,
    enabled: setting.enabled,
    captureIpAddress: setting.captureIpAddress,
    rawIpRetentionDays: setting.rawIpRetentionDays,
    eventRetentionDays: setting.eventRetentionDays,
    recordingEnabled: setting.recordingEnabled,
    recordingRetentionDays: setting.recordingRetentionDays,
    maxRecordingDurationSeconds: setting.maxRecordingDurationSeconds,
  };
}

function memoryUuid(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function memoryDateIsPastRetention(input: {
  at: Date;
  now: Date;
  retentionDays: number;
}) {
  const cutoff = input.now.getTime() - input.retentionDays * 24 * 60 * 60 * 1000;
  return input.at.getTime() <= cutoff;
}

function getMemoryEffectiveRetentionDays(input: {
  settings: Array<TrackingV2SettingRecord & {
    workspaceId: string;
    siteId: string | null;
    recipientId: string | null;
  }>;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  field: "rawIpRetentionDays" | "eventRetentionDays";
  defaultDays: number;
}) {
  const recipientSetting = input.recipientId
    ? input.settings.find((setting) =>
        setting.workspaceId === input.workspaceId &&
        setting.scope === "recipient" &&
        setting.siteId === input.siteId &&
        setting.recipientId === input.recipientId
      )
    : null;
  const siteSetting = input.settings.find((setting) =>
    setting.workspaceId === input.workspaceId &&
    setting.scope === "site" &&
    setting.siteId === input.siteId &&
    setting.recipientId === null
  );
  const workspaceSetting = input.settings.find((setting) =>
    setting.workspaceId === input.workspaceId &&
    setting.scope === "workspace" &&
    setting.siteId === null &&
    setting.recipientId === null
  );

  return recipientSetting?.[input.field] ??
    siteSetting?.[input.field] ??
    workspaceSetting?.[input.field] ??
    input.defaultDays;
}

function getBrowserEventData(event: TrackingV2BrowserEvent): Record<string, unknown> {
  return {
    sequence: event.sequence,
    ...(event.page ? { page: event.page } : {}),
    ...(event.viewport ? { viewport: event.viewport } : {}),
    ...(event.type === "tab_switch" && event.fromTabLabel ? { fromTabLabel: event.fromTabLabel } : {}),
  };
}
