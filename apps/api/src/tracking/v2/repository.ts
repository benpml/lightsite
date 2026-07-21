import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database } from "@handout/db";
import {
  siteVariants,
  siteVersions,
  sites,
  trackingEventManifests,
  trackingRecipientEvents,
  trackingRecipientSessions,
  trackingSettings,
  workspaces,
} from "@handout/db/schema";
import type {
  TrackingV2DestinationKind,
  TrackingV2ElementKind,
  TrackingV2EventSource,
  TrackingV2EventType,
  TrackingV2ManifestPayload,
  TrackingV2ReadRecordingStatus,
  TrackingV2SessionEndReason,
  TrackingV2SessionState,
  TrackingV2SettingScope,
} from "@handout/tracking-schema";

export type TrackingV2ContextLookup = {
  workspaceId: string;
  siteId: string;
  publishedVersionId: string;
  manifestId: string;
  recipientId: string | null;
  recipientRevision: number | null;
};

export type TrackingV2ResolvedContext = TrackingV2ContextLookup & {
  workspaceStatus: "active";
  workspacePlan: "free" | "core" | "pro";
  siteStatus: "published";
  recipientStatus: "active" | null;
};

export type TrackingV2ManifestRecord = {
  id: string;
  workspaceId: string;
  siteId: string;
  publishedVersionId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  schemaVersion: number;
  sourceHash: string;
  payload: TrackingV2ManifestPayload;
  createdAt: Date;
};

export type TrackingV2SettingRecord = {
  scope: TrackingV2SettingScope;
  enabled: boolean;
  eventRetentionDays: 30 | 90 | 180 | 365;
  recordingEnabled: boolean;
  recordingRetentionDays: 7 | 14 | 30;
  maxRecordingDurationSeconds: number;
  recordingTermsVersion: string | null;
  recordingTermsAcceptedAt: Date | null;
  recordingTermsAcceptedByUserId: string | null;
};

export type TrackingV2WritableSettings = Omit<TrackingV2SettingRecord, "scope">;

export type TrackingV2CreateSessionInput = {
  publicSessionId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  publishedVersionId: string;
  manifestId: string;
  eventTokenHash: string;
  initialPageId: string;
  initialPageLabel: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  startedAt: Date;
  receivedAt: Date;
};

export type TrackingV2SessionRecord = {
  id: string;
  publicSessionId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  publishedVersionId: string | null;
  manifestId: string | null;
  eventTokenHash: string;
  state: TrackingV2SessionState;
  startedAt: Date;
  lastSeenAt: Date;
  activeMs: number;
};

export type TrackingV2AcceptedBrowserEvent = {
  eventId: string;
  type: Extract<TrackingV2EventType, "button_click" | "link_click" | "tab_switch">;
  occurredAt: Date;
  pageId: string;
  pageLabel: string;
  fromPageId: string | null;
  fromPageLabel: string | null;
  elementKind: TrackingV2ElementKind;
  elementId: string | null;
  elementLabel: string;
  destinationKind: TrackingV2DestinationKind | null;
  destinationHost: string | null;
  eventData: Record<string, unknown>;
};

export type TrackingV2StoredEvent = {
  id?: string;
  eventId: string;
  batchId: string | null;
  sessionId: string | null;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  publishedVersionId: string | null;
  manifestId: string | null;
  type: TrackingV2EventType;
  source: TrackingV2EventSource;
  pageId: string | null;
  pageLabel: string | null;
  fromPageId: string | null;
  fromPageLabel: string | null;
  elementKind: TrackingV2ElementKind | null;
  elementId: string | null;
  elementLabel: string | null;
  destinationKind: TrackingV2DestinationKind | null;
  destinationHost: string | null;
  webhookId: string | null;
  webhookEndpointHost: string | null;
  scriptVersion: string | null;
  eventData: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
};

export type TrackingV2ReadWorkspace = {
  id: string;
  role: "admin" | "user";
  plan: "free" | "core" | "pro";
};
export type TrackingV2EventCursor = { receivedAt: Date; id: string };
export type TrackingV2SessionCursor = { startedAt: Date; id: string };
export type TrackingV2SiteSummaryRecord = { id: string; name: string; slug: string };

type TrackingV2RecipientSummaryRecord = {
  id: string;
  name: string;
  slug: string;
  recipientName: string | null;
  recipientCompany: string | null;
  website: string | null;
};

type TrackingV2DeviceSummaryRecord = { type: string | null; os: string | null; browser: string | null };
type TrackingV2LocationSummaryRecord = { city: string | null; region: string | null; countryCode: string | null };

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
  tab: { id: string; label: string; fromId: string | null; fromLabel: string | null } | null;
  element: {
    kind: TrackingV2ElementKind;
    id: string | null;
    label: string;
    destinationKind: TrackingV2DestinationKind | null;
    destinationHost: string | null;
  } | null;
  webhook: { id: string; endpointHost: string } | null;
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
  initialPage: { id: string; label: string };
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  activeMs: number;
  durationMs: number | null;
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
  recordingStatus?: TrackingV2ReadRecordingStatus;
  from?: Date;
  to?: Date;
  cursor?: TrackingV2SessionCursor;
  limit: number;
};

export type TrackingV2RetentionBatchInput = { now: Date; limit: number };
export type TrackingV2StaleSessionExpirationInput = TrackingV2RetentionBatchInput & { staleBefore: Date };
export type TrackingV2EndedSessionForRecording = {
  id: string;
  endedAt: Date;
  endReason: TrackingV2SessionEndReason;
};

export type TrackingV2ServerEventInput = {
  eventId: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  publishedVersionId: string;
  manifestId: string;
  type: Extract<TrackingV2EventType, "slack_share" | "webhook_send">;
  source: Extract<TrackingV2EventSource, "slack_og_image" | "webhook">;
  eventData: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
  webhookId?: string | null;
  webhookEndpointHost?: string | null;
};

export type TrackingAutomationOutboxEvent = {
  sourceEventRowId: string;
  eventId: string;
  eventType: "site_visit" | "button_click" | "link_click" | "tab_switch";
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  occurredAt: Date;
  receivedAt: Date;
  pageId?: string | null;
  pageLabel?: string | null;
  fromPageId?: string | null;
  fromPageLabel?: string | null;
  elementKind?: string | null;
  elementId?: string | null;
  elementLabel?: string | null;
  destinationKind?: string | null;
  destinationHost?: string | null;
};

export type TrackingAutomationOutbox = {
  enqueue(event: TrackingAutomationOutboxEvent): Promise<void>;
  enqueueMany?(events: TrackingAutomationOutboxEvent[]): Promise<void>;
};

export interface TrackingV2Repository {
  findOrCreateManifest(input: Omit<TrackingV2ManifestRecord, "id" | "createdAt"> & { createdAt: Date }): Promise<TrackingV2ManifestRecord>;
  findManifestById(input: { manifestId: string; workspaceId: string; siteId: string }): Promise<TrackingV2ManifestRecord | null>;
  findCurrentContext(input: TrackingV2ContextLookup): Promise<TrackingV2ResolvedContext | null>;
  listSettings(input: { workspaceId: string; siteId: string; recipientId: string | null }): Promise<TrackingV2SettingRecord[]>;
  findSettingsSite(input: { workspace: TrackingV2ReadWorkspace; userId: string; siteId: string }): Promise<TrackingV2SiteSummaryRecord | null>;
  findSiteSetting(input: { workspaceId: string; siteId: string }): Promise<TrackingV2SettingRecord | null>;
  upsertSiteSetting(input: { workspaceId: string; siteId: string; settings: TrackingV2WritableSettings; updatedAt: Date }): Promise<TrackingV2SettingRecord>;
  listEvents(input: TrackingV2ListEventsInput): Promise<{ records: TrackingV2EventReadRecord[]; nextCursor: TrackingV2EventCursor | null }>;
  listSessions(input: TrackingV2ListSessionsInput): Promise<{ records: TrackingV2SessionReadRecord[]; nextCursor: TrackingV2SessionCursor | null }>;
  findReadSession(input: { workspace: TrackingV2ReadWorkspace; userId: string; publicSessionId: string }): Promise<TrackingV2SessionReadRecord | null>;
  createSession(input: TrackingV2CreateSessionInput): Promise<TrackingV2SessionRecord>;
  findSessionForEventToken(input: { publicSessionId: string; eventTokenHash: string; activeAfter: Date }): Promise<TrackingV2SessionRecord | null>;
  recordBrowserEvents(input: {
    session: TrackingV2SessionRecord;
    activeAfter: Date;
    batchId: string;
    scriptVersion: string;
    events: TrackingV2AcceptedBrowserEvent[];
    receivedAt: Date;
  }): Promise<number>;
  recordServerEvent(input: TrackingV2ServerEventInput): Promise<void>;
  updateSessionHeartbeat(input: { sessionId: string; activeAfter: Date; occurredAt: Date; activeMs: number }): Promise<boolean>;
  endSession(input: { sessionId: string; activeAfter: Date; occurredAt: Date; reason: TrackingV2SessionEndReason; activeMs: number | null }): Promise<boolean>;
  expireStaleSessions(input: TrackingV2StaleSessionExpirationInput): Promise<number>;
  listEndedSessionsForRecording(input: { endedBefore: Date; limit: number }): Promise<TrackingV2EndedSessionForRecording[]>;
  pruneExpiredEvents(input: TrackingV2RetentionBatchInput): Promise<number>;
  pruneExpiredSessions(input: TrackingV2RetentionBatchInput): Promise<number>;
  pruneUnreferencedManifests(input: TrackingV2RetentionBatchInput): Promise<number>;
}

const settingSelection = {
  scope: trackingSettings.scope,
  enabled: trackingSettings.enabled,
  eventRetentionDays: trackingSettings.eventRetentionDays,
  recordingEnabled: trackingSettings.recordingEnabled,
  recordingRetentionDays: trackingSettings.recordingRetentionDays,
  maxRecordingDurationSeconds: trackingSettings.maxRecordingDurationSeconds,
  recordingTermsVersion: trackingSettings.recordingTermsVersion,
  recordingTermsAcceptedAt: trackingSettings.recordingTermsAcceptedAt,
  recordingTermsAcceptedByUserId: trackingSettings.recordingTermsAcceptedByUserId,
};

const sessionRecordSelection = {
  id: trackingRecipientSessions.id,
  publicSessionId: trackingRecipientSessions.publicSessionId,
  workspaceId: trackingRecipientSessions.workspaceId,
  siteId: trackingRecipientSessions.siteId,
  recipientId: trackingRecipientSessions.recipientId,
  recipientRevision: trackingRecipientSessions.recipientRevision,
  publishedVersionId: trackingRecipientSessions.publishedVersionId,
  manifestId: trackingRecipientSessions.manifestId,
  eventTokenHash: trackingRecipientSessions.eventTokenHash,
  state: trackingRecipientSessions.state,
  startedAt: trackingRecipientSessions.startedAt,
  lastSeenAt: trackingRecipientSessions.lastSeenAt,
  activeMs: trackingRecipientSessions.activeMs,
};

export function createDbTrackingV2Repository(database: Database, options: { automationOutbox?: TrackingAutomationOutbox } = {}): TrackingV2Repository {
  return {
    async findOrCreateManifest(input) {
      await database.insert(trackingEventManifests).values(input).onConflictDoNothing();
      const [manifest] = await database
        .select()
        .from(trackingEventManifests)
        .where(and(
          eq(trackingEventManifests.workspaceId, input.workspaceId),
          eq(trackingEventManifests.siteId, input.siteId),
          eq(trackingEventManifests.publishedVersionId, input.publishedVersionId),
          eq(trackingEventManifests.schemaVersion, input.schemaVersion),
          input.recipientId
            ? and(
                eq(trackingEventManifests.recipientId, input.recipientId),
                eq(trackingEventManifests.recipientRevision, input.recipientRevision!),
              )
            : isNull(trackingEventManifests.recipientId),
        ))
        .limit(1);
      if (!manifest) throw new Error("Tracking manifest insert did not produce a readable row.");
      if (manifest.sourceHash !== input.sourceHash) throw new Error("Tracking manifest invariant conflict.");
      return manifest;
    },

    async findManifestById(input) {
      const [manifest] = await database
        .select()
        .from(trackingEventManifests)
        .where(and(
          eq(trackingEventManifests.id, input.manifestId),
          eq(trackingEventManifests.workspaceId, input.workspaceId),
          eq(trackingEventManifests.siteId, input.siteId),
        ))
        .limit(1);
      return manifest ?? null;
    },

    async findCurrentContext(input) {
      const [record] = await database
        .select({
          workspaceId: workspaces.id,
          workspacePlan: workspaces.plan,
          siteId: sites.id,
          publishedVersionId: siteVersions.id,
          manifestId: trackingEventManifests.id,
        })
        .from(sites)
        .innerJoin(workspaces, eq(sites.workspaceId, workspaces.id))
        .innerJoin(siteVersions, and(eq(siteVersions.id, input.publishedVersionId), eq(siteVersions.siteId, sites.id)))
        .innerJoin(trackingEventManifests, and(
          eq(trackingEventManifests.id, input.manifestId),
          eq(trackingEventManifests.publishedVersionId, siteVersions.id),
          eq(trackingEventManifests.workspaceId, workspaces.id),
          eq(trackingEventManifests.siteId, sites.id),
        ))
        .where(and(
          eq(workspaces.id, input.workspaceId),
          eq(workspaces.status, "active"),
          eq(sites.id, input.siteId),
          eq(sites.status, "published"),
          eq(siteVersions.kind, "publish"),
          input.recipientId
            ? and(
                eq(trackingEventManifests.recipientId, input.recipientId),
                eq(trackingEventManifests.recipientRevision, input.recipientRevision!),
              )
            : isNull(trackingEventManifests.recipientId),
        ))
        .limit(1);
      if (!record) return null;

      if (!input.recipientId) {
        return { ...input, workspaceStatus: "active", workspacePlan: record.workspacePlan, siteStatus: "published", recipientStatus: null };
      }
      const [recipient] = await database
        .select({ id: siteVariants.id })
        .from(siteVariants)
        .where(and(
          eq(siteVariants.id, input.recipientId),
          eq(siteVariants.workspaceId, input.workspaceId),
          eq(siteVariants.siteId, input.siteId),
          eq(siteVariants.status, "active"),
        ))
        .limit(1);
      return recipient
        ? { ...input, workspaceStatus: "active", workspacePlan: record.workspacePlan, siteStatus: "published", recipientStatus: "active" }
        : null;
    },

    async listSettings(input) {
      const predicates: SQL[] = [
        and(eq(trackingSettings.scope, "workspace"), isNull(trackingSettings.siteId), isNull(trackingSettings.recipientId))!,
        and(eq(trackingSettings.scope, "site"), eq(trackingSettings.siteId, input.siteId), isNull(trackingSettings.recipientId))!,
      ];
      if (input.recipientId) {
        predicates.push(and(
          eq(trackingSettings.scope, "recipient"),
          eq(trackingSettings.siteId, input.siteId),
          eq(trackingSettings.recipientId, input.recipientId),
        )!);
      }
      const rows = await database.select(settingSelection).from(trackingSettings).where(and(
        eq(trackingSettings.workspaceId, input.workspaceId),
        or(...predicates),
      ));
      return rows.map(toSettingRecord);
    },

    async findSettingsSite(input) {
      const [site] = await database
        .select({ id: sites.id, name: sites.name, slug: sites.slug })
        .from(sites)
        .where(and(
          eq(sites.workspaceId, input.workspace.id),
          eq(sites.id, input.siteId),
          ...buildSiteAccessConditions(input.workspace, input.userId),
        ))
        .limit(1);
      return site ?? null;
    },

    async findSiteSetting(input) {
      const [setting] = await database.select(settingSelection).from(trackingSettings).where(and(
        eq(trackingSettings.workspaceId, input.workspaceId),
        eq(trackingSettings.siteId, input.siteId),
        eq(trackingSettings.scope, "site"),
        isNull(trackingSettings.recipientId),
      )).limit(1);
      return setting ? toSettingRecord(setting) : null;
    },

    async upsertSiteSetting(input) {
      const [setting] = await database
        .insert(trackingSettings)
        .values({
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          recipientId: null,
          scope: "site",
          enabled: input.settings.enabled,
          eventRetentionDays: input.settings.eventRetentionDays,
          recordingEnabled: input.settings.recordingEnabled,
          recordingRetentionDays: input.settings.recordingRetentionDays,
          maxRecordingDurationSeconds: input.settings.maxRecordingDurationSeconds,
          recordingTermsVersion: input.settings.recordingTermsVersion,
          recordingTermsAcceptedAt: input.settings.recordingTermsAcceptedAt,
          recordingTermsAcceptedByUserId: input.settings.recordingTermsAcceptedByUserId,
          updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
          target: trackingSettings.siteId,
          targetWhere: sql`${trackingSettings.scope} = 'site'`,
          set: {
            enabled: input.settings.enabled,
            eventRetentionDays: input.settings.eventRetentionDays,
            recordingEnabled: input.settings.recordingEnabled,
            recordingRetentionDays: input.settings.recordingRetentionDays,
            maxRecordingDurationSeconds: input.settings.maxRecordingDurationSeconds,
            recordingTermsVersion: input.settings.recordingTermsVersion,
            recordingTermsAcceptedAt: input.settings.recordingTermsAcceptedAt,
            recordingTermsAcceptedByUserId: input.settings.recordingTermsAcceptedByUserId,
            updatedAt: input.updatedAt,
          },
        })
        .returning(settingSelection);
      if (!setting) throw new Error("Tracking site setting upsert did not return a row.");
      return toSettingRecord(setting);
    },

    async listEvents(input) {
      const rows = await database
        .select(eventReadSelection)
        .from(trackingRecipientEvents)
        .innerJoin(sites, eq(trackingRecipientEvents.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingRecipientEvents.recipientId, siteVariants.id))
        .leftJoin(trackingRecipientSessions, eq(trackingRecipientEvents.sessionId, trackingRecipientSessions.id))
        .where(and(...eventReadConditions(input)))
        .orderBy(desc(trackingRecipientEvents.receivedAt), desc(trackingRecipientEvents.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        records: page.map(toEventReadRecord),
        nextCursor: rows.length > input.limit && last ? { receivedAt: last.receivedAt, id: last.id } : null,
      };
    },

    async listSessions(input) {
      const rows = await database
        .select(sessionReadSelection)
        .from(trackingRecipientSessions)
        .innerJoin(sites, eq(trackingRecipientSessions.siteId, sites.id))
        .leftJoin(siteVariants, eq(trackingRecipientSessions.recipientId, siteVariants.id))
        .where(and(...sessionReadConditions(input)))
        .orderBy(desc(trackingRecipientSessions.startedAt), desc(trackingRecipientSessions.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        records: page.map(toSessionReadRecord),
        nextCursor: rows.length > input.limit && last ? { startedAt: last.startedAt, id: last.rowId } : null,
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
          ...buildSiteAccessConditions(input.workspace, input.userId),
        ))
        .limit(1);
      return row ? toSessionReadRecord(row) : null;
    },

    async createSession(input) {
      const result = await database.transaction(async (transaction) => {
        const [inserted] = await transaction
          .insert(trackingRecipientSessions)
          .values({
            publicSessionId: input.publicSessionId,
            workspaceId: input.workspaceId,
            siteId: input.siteId,
            recipientId: input.recipientId,
            recipientRevision: input.recipientRevision,
            publishedVersionId: input.publishedVersionId,
            manifestId: input.manifestId,
            eventTokenHash: input.eventTokenHash,
            initialPageId: input.initialPageId,
            initialPageLabel: input.initialPageLabel,
            city: input.city,
            region: input.region,
            countryCode: input.countryCode,
            deviceType: input.deviceType,
            osName: input.osName,
            browserName: input.browserName,
            startedAt: input.startedAt,
            lastSeenAt: input.receivedAt,
            createdAt: input.receivedAt,
            updatedAt: input.receivedAt,
          })
          .onConflictDoNothing({ target: trackingRecipientSessions.publicSessionId })
          .returning(sessionRecordSelection);

        const session = inserted ?? (await transaction
          .select(sessionRecordSelection)
          .from(trackingRecipientSessions)
          .where(eq(trackingRecipientSessions.publicSessionId, input.publicSessionId))
          .limit(1))[0];
        if (!session || session.manifestId !== input.manifestId || session.eventTokenHash !== input.eventTokenHash) {
          throw new Error("Tracking session idempotency conflict.");
        }

        let visit: TrackingAutomationOutboxEvent | null = null;
        if (inserted) {
          const [insertedEvent] = await transaction.insert(trackingRecipientEvents).values({
            eventId: `visit:${input.publicSessionId}`,
            batchId: null,
            sessionId: session.id,
            workspaceId: input.workspaceId,
            siteId: input.siteId,
            recipientId: input.recipientId,
            recipientRevision: input.recipientRevision,
            publishedVersionId: input.publishedVersionId,
            manifestId: input.manifestId,
            type: "site_visit",
            source: "browser",
            pageId: input.initialPageId,
            pageLabel: input.initialPageLabel,
            scriptVersion: null,
            eventData: {},
            occurredAt: input.startedAt,
            receivedAt: input.receivedAt,
          }).returning({ id: trackingRecipientEvents.id });
          if (insertedEvent) {
            visit = {
              sourceEventRowId: insertedEvent.id,
              eventId: `visit:${input.publicSessionId}`,
              eventType: "site_visit",
              workspaceId: input.workspaceId,
              siteId: input.siteId,
              recipientId: input.recipientId,
              sessionId: session.id,
              occurredAt: input.startedAt,
              receivedAt: input.receivedAt,
              pageId: input.initialPageId,
              pageLabel: input.initialPageLabel,
            };
          }
        }
        return { session, visit };
      });
      await safelyEnqueueAutomationEvents(options.automationOutbox, result.visit ? [result.visit] : []);
      return result.session;
    },

    async findSessionForEventToken(input) {
      const [session] = await database
        .select(sessionRecordSelection)
        .from(trackingRecipientSessions)
        .where(and(
          eq(trackingRecipientSessions.publicSessionId, input.publicSessionId),
          eq(trackingRecipientSessions.eventTokenHash, input.eventTokenHash),
          eq(trackingRecipientSessions.state, "active"),
          gte(trackingRecipientSessions.lastSeenAt, input.activeAfter),
        ))
        .limit(1);
      return session ?? null;
    },

    async recordBrowserEvents(input) {
      const result = await database.transaction(async (transaction) => {
        const [active] = await transaction
          .select({ id: trackingRecipientSessions.id })
          .from(trackingRecipientSessions)
          .where(and(
            eq(trackingRecipientSessions.id, input.session.id),
            eq(trackingRecipientSessions.state, "active"),
            gte(trackingRecipientSessions.lastSeenAt, input.activeAfter),
          ))
          .limit(1);
        if (!active) return { insertedCount: 0, outboxEvents: [] as TrackingAutomationOutboxEvent[] };

        let insertedCount = 0;
        const outboxEvents: TrackingAutomationOutboxEvent[] = [];
        for (const event of input.events) {
          const values = toBrowserEventInsert(input, event);
          const inserted = await transaction
            .insert(trackingRecipientEvents)
            .values(values)
            .onConflictDoNothing({ target: trackingRecipientEvents.eventId })
            .returning({ id: trackingRecipientEvents.id });
          insertedCount += inserted.length;
          if (inserted[0]) {
            outboxEvents.push({
              sourceEventRowId: inserted[0].id,
              eventId: values.eventId,
              eventType: values.type,
              workspaceId: values.workspaceId,
              siteId: values.siteId,
              recipientId: values.recipientId,
              sessionId: values.sessionId,
              occurredAt: values.occurredAt,
              receivedAt: values.receivedAt,
              pageId: values.pageId,
              pageLabel: values.pageLabel,
              fromPageId: values.fromPageId,
              fromPageLabel: values.fromPageLabel,
              elementKind: values.elementKind,
              elementId: values.elementId,
              elementLabel: values.elementLabel,
              destinationKind: values.destinationKind,
              destinationHost: values.destinationHost,
            });
          }
        }
        await transaction.update(trackingRecipientSessions).set({
          lastSeenAt: input.receivedAt,
          updatedAt: input.receivedAt,
        }).where(eq(trackingRecipientSessions.id, input.session.id));
        return { insertedCount, outboxEvents };
      });
      await safelyEnqueueAutomationEvents(options.automationOutbox, result.outboxEvents);
      return result.insertedCount;
    },

    async recordServerEvent(input) {
      await database.insert(trackingRecipientEvents).values({
        eventId: input.eventId,
        batchId: null,
        sessionId: null,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: input.recipientId,
        recipientRevision: input.recipientRevision,
        publishedVersionId: input.publishedVersionId,
        manifestId: input.manifestId,
        type: input.type,
        source: input.source,
        webhookId: input.webhookId ?? null,
        webhookEndpointHost: input.webhookEndpointHost ?? null,
        eventData: input.eventData,
        occurredAt: input.occurredAt,
        receivedAt: input.receivedAt,
      }).onConflictDoNothing({ target: trackingRecipientEvents.eventId });
    },

    async updateSessionHeartbeat(input) {
      const occurredAt = sql`${input.occurredAt.toISOString()}::timestamptz`;
      const rows = await database.update(trackingRecipientSessions).set({
        lastSeenAt: sql`greatest(${trackingRecipientSessions.lastSeenAt}, ${occurredAt})`,
        activeMs: sql`greatest(${trackingRecipientSessions.activeMs}, ${input.activeMs})`,
        updatedAt: input.occurredAt,
      }).where(and(
        eq(trackingRecipientSessions.id, input.sessionId),
        eq(trackingRecipientSessions.state, "active"),
        gte(trackingRecipientSessions.lastSeenAt, input.activeAfter),
      )).returning({ id: trackingRecipientSessions.id });
      return rows.length === 1;
    },

    async endSession(input) {
      const occurredAt = sql`${input.occurredAt.toISOString()}::timestamptz`;
      const rows = await database.update(trackingRecipientSessions).set({
        state: "ended",
        endedAt: sql`greatest(${trackingRecipientSessions.lastSeenAt}, ${occurredAt})`,
        lastSeenAt: sql`greatest(${trackingRecipientSessions.lastSeenAt}, ${occurredAt})`,
        endReason: input.reason,
        activeMs: input.activeMs === null
          ? trackingRecipientSessions.activeMs
          : sql`greatest(${trackingRecipientSessions.activeMs}, ${input.activeMs})`,
        durationMs: sql`greatest(0, extract(epoch from (greatest(${trackingRecipientSessions.lastSeenAt}, ${occurredAt}) - ${trackingRecipientSessions.startedAt})) * 1000)::integer`,
        updatedAt: input.occurredAt,
      }).where(and(
        eq(trackingRecipientSessions.id, input.sessionId),
        eq(trackingRecipientSessions.state, "active"),
        gte(trackingRecipientSessions.lastSeenAt, input.activeAfter),
      )).returning({ id: trackingRecipientSessions.id });
      return rows.length === 1;
    },

    async expireStaleSessions(input) {
      const ids = (await database.select({ id: trackingRecipientSessions.id })
        .from(trackingRecipientSessions)
        .where(and(eq(trackingRecipientSessions.state, "active"), lte(trackingRecipientSessions.lastSeenAt, input.staleBefore)))
        .orderBy(asc(trackingRecipientSessions.lastSeenAt), asc(trackingRecipientSessions.id))
        .limit(input.limit)).map((row) => row.id);
      if (ids.length === 0) return 0;
      const rows = await database.update(trackingRecipientSessions).set({
        state: "expired",
        endedAt: trackingRecipientSessions.lastSeenAt,
        endReason: "server_expired",
        durationMs: sql`greatest(0, extract(epoch from (${trackingRecipientSessions.lastSeenAt} - ${trackingRecipientSessions.startedAt})) * 1000)::integer`,
        updatedAt: input.now,
      }).where(and(inArray(trackingRecipientSessions.id, ids), eq(trackingRecipientSessions.state, "active")))
        .returning({ id: trackingRecipientSessions.id });
      return rows.length;
    },

    async listEndedSessionsForRecording(input) {
      const rows = await database.select({
        id: trackingRecipientSessions.id,
        endedAt: trackingRecipientSessions.endedAt,
        endReason: trackingRecipientSessions.endReason,
      }).from(trackingRecipientSessions).where(and(
        sql`${trackingRecipientSessions.state} in ('ended', 'expired')`,
        sql`${trackingRecipientSessions.recordingStatus} in ('pending', 'recording')`,
        lte(trackingRecipientSessions.updatedAt, input.endedBefore),
      )).orderBy(asc(trackingRecipientSessions.updatedAt), asc(trackingRecipientSessions.id)).limit(input.limit);
      return rows.flatMap((row) => row.endedAt && row.endReason
        ? [{ id: row.id, endedAt: row.endedAt, endReason: row.endReason }]
        : []);
    },

    async pruneExpiredEvents(input) {
      const ids = (await database.select({ id: trackingRecipientEvents.id })
        .from(trackingRecipientEvents)
        .where(eventRetentionCutoff(input.now))
        .orderBy(asc(trackingRecipientEvents.receivedAt), asc(trackingRecipientEvents.id))
        .limit(input.limit)).map((row) => row.id);
      if (ids.length === 0) return 0;
      return (await database.delete(trackingRecipientEvents).where(inArray(trackingRecipientEvents.id, ids)).returning({ id: trackingRecipientEvents.id })).length;
    },

    async pruneExpiredSessions(input) {
      const ids = (await database.select({ id: trackingRecipientSessions.id })
        .from(trackingRecipientSessions)
        .where(and(
          sessionRetentionCutoff(input.now),
          sql`not exists (
            select 1 from tracking_recordings recording
            where recording.session_id = ${trackingRecipientSessions.id}
              and recording.status <> 'deleted'
          )`,
        ))
        .orderBy(asc(trackingRecipientSessions.startedAt), asc(trackingRecipientSessions.id))
        .limit(input.limit)).map((row) => row.id);
      if (ids.length === 0) return 0;
      return (await database.delete(trackingRecipientSessions).where(inArray(trackingRecipientSessions.id, ids)).returning({ id: trackingRecipientSessions.id })).length;
    },

    async pruneUnreferencedManifests(input) {
      const graceBefore = new Date(input.now.getTime() - 24 * 60 * 60 * 1000);
      const ids = (await database.select({ id: trackingEventManifests.id })
        .from(trackingEventManifests)
        .where(and(
          lte(trackingEventManifests.createdAt, graceBefore),
          sql`not exists (select 1 from tracking_recipient_sessions s where s.manifest_id = ${trackingEventManifests.id})`,
          sql`not exists (select 1 from tracking_recipient_events e where e.manifest_id = ${trackingEventManifests.id})`,
        ))
        .orderBy(asc(trackingEventManifests.createdAt), asc(trackingEventManifests.id))
        .limit(input.limit)).map((row) => row.id);
      if (ids.length === 0) return 0;
      return (await database.delete(trackingEventManifests).where(inArray(trackingEventManifests.id, ids)).returning({ id: trackingEventManifests.id })).length;
    },
  };
}

async function safelyEnqueueAutomationEvents(
  outbox: TrackingAutomationOutbox | undefined,
  events: TrackingAutomationOutboxEvent[],
) {
  if (!outbox || events.length === 0) return;
  if (outbox.enqueueMany) {
    try {
      await outbox.enqueueMany(events);
    } catch {
      // The reconciliation pass repairs the whole accepted batch.
    }
    return;
  }
  for (const event of events) {
    try {
      await outbox.enqueue(event);
    } catch {
      // Tracking is the source of truth and must never fail because automation
      // fanout is unavailable. The worker's reconciliation pass repairs gaps.
    }
  }
}

function toSettingRecord(input: {
  scope: TrackingV2SettingScope;
  enabled: boolean;
  eventRetentionDays: number;
  recordingEnabled: boolean;
  recordingRetentionDays: number;
  maxRecordingDurationSeconds: number;
  recordingTermsVersion: string | null;
  recordingTermsAcceptedAt: Date | null;
  recordingTermsAcceptedByUserId: string | null;
}): TrackingV2SettingRecord {
  if (![30, 90, 180, 365].includes(input.eventRetentionDays)) throw new Error("Invalid tracking retention setting.");
  if (![7, 14, 30].includes(input.recordingRetentionDays)) throw new Error("Invalid recording retention setting.");
  return input as TrackingV2SettingRecord;
}

function toBrowserEventInsert(
  input: { session: TrackingV2SessionRecord; batchId: string; scriptVersion: string; receivedAt: Date },
  event: TrackingV2AcceptedBrowserEvent,
) {
  return {
    eventId: event.eventId,
    batchId: input.batchId,
    sessionId: input.session.id,
    workspaceId: input.session.workspaceId,
    siteId: input.session.siteId,
    recipientId: input.session.recipientId,
    recipientRevision: input.session.recipientRevision,
    publishedVersionId: input.session.publishedVersionId,
    manifestId: input.session.manifestId,
    type: event.type,
    source: "browser" as const,
    pageId: event.pageId,
    pageLabel: event.pageLabel,
    fromPageId: event.fromPageId,
    fromPageLabel: event.fromPageLabel,
    elementKind: event.elementKind,
    elementId: event.elementId,
    elementLabel: event.elementLabel,
    destinationKind: event.destinationKind,
    destinationHost: event.destinationHost,
    webhookId: null,
    webhookEndpointHost: null,
    scriptVersion: input.scriptVersion,
    eventData: event.eventData,
    occurredAt: event.occurredAt,
    receivedAt: input.receivedAt,
  };
}

const eventReadSelection = {
  id: trackingRecipientEvents.id,
  eventId: trackingRecipientEvents.eventId,
  type: trackingRecipientEvents.type,
  source: trackingRecipientEvents.source,
  siteId: sites.id,
  siteName: sites.name,
  siteSlug: sites.slug,
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
  pageId: trackingRecipientEvents.pageId,
  pageLabel: trackingRecipientEvents.pageLabel,
  fromPageId: trackingRecipientEvents.fromPageId,
  fromPageLabel: trackingRecipientEvents.fromPageLabel,
  elementKind: trackingRecipientEvents.elementKind,
  elementId: trackingRecipientEvents.elementId,
  elementLabel: trackingRecipientEvents.elementLabel,
  destinationKind: trackingRecipientEvents.destinationKind,
  destinationHost: trackingRecipientEvents.destinationHost,
  webhookId: trackingRecipientEvents.webhookId,
  webhookEndpointHost: trackingRecipientEvents.webhookEndpointHost,
  occurredAt: trackingRecipientEvents.occurredAt,
  receivedAt: trackingRecipientEvents.receivedAt,
};

const sessionReadSelection = {
  rowId: trackingRecipientSessions.id,
  publicSessionId: trackingRecipientSessions.publicSessionId,
  siteId: sites.id,
  siteName: sites.name,
  siteSlug: sites.slug,
  recipientId: siteVariants.id,
  recipientVariantName: siteVariants.name,
  recipientSlug: siteVariants.slug,
  recipientName: siteVariants.recipientName,
  recipientCompany: siteVariants.recipientCompany,
  recipientVariableValues: siteVariants.variableValues,
  state: trackingRecipientSessions.state,
  city: trackingRecipientSessions.city,
  region: trackingRecipientSessions.region,
  countryCode: trackingRecipientSessions.countryCode,
  deviceType: trackingRecipientSessions.deviceType,
  osName: trackingRecipientSessions.osName,
  browserName: trackingRecipientSessions.browserName,
  initialPageId: trackingRecipientSessions.initialPageId,
  initialPageLabel: trackingRecipientSessions.initialPageLabel,
  startedAt: trackingRecipientSessions.startedAt,
  lastSeenAt: trackingRecipientSessions.lastSeenAt,
  endedAt: trackingRecipientSessions.endedAt,
  endReason: trackingRecipientSessions.endReason,
  activeMs: trackingRecipientSessions.activeMs,
  durationMs: trackingRecipientSessions.durationMs,
  recordingStatus: trackingRecipientSessions.recordingStatus,
  recordingDurationMs: trackingRecipientSessions.recordingDurationMs,
};

type RecipientJoinRow = {
  recipientId: string | null;
  recipientVariantName: string | null;
  recipientSlug: string | null;
  recipientName: string | null;
  recipientCompany: string | null;
  recipientVariableValues: Record<string, unknown> | null;
};

type EventReadRow = RecipientJoinRow & {
  id: string;
  eventId: string;
  type: TrackingV2EventType;
  source: TrackingV2EventSource;
  siteId: string;
  siteName: string;
  siteSlug: string;
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
  pageId: string | null;
  pageLabel: string | null;
  fromPageId: string | null;
  fromPageLabel: string | null;
  elementKind: TrackingV2ElementKind | null;
  elementId: string | null;
  elementLabel: string | null;
  destinationKind: TrackingV2DestinationKind | null;
  destinationHost: string | null;
  webhookId: string | null;
  webhookEndpointHost: string | null;
  occurredAt: Date;
  receivedAt: Date;
};

type SessionReadRow = RecipientJoinRow & {
  rowId: string;
  publicSessionId: string;
  siteId: string;
  siteName: string;
  siteSlug: string;
  state: TrackingV2SessionState;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  initialPageId: string;
  initialPageLabel: string;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  activeMs: number;
  durationMs: number | null;
  recordingStatus: TrackingV2ReadRecordingStatus;
  recordingDurationMs: number | null;
};

function toEventReadRecord(row: EventReadRow): TrackingV2EventReadRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    source: row.source,
    site: { id: row.siteId, name: row.siteName, slug: row.siteSlug },
    recipient: toRecipientSummary(row),
    sessionId: row.sessionPublicSessionId,
    session: row.sessionPublicSessionId && row.sessionState && row.sessionStartedAt && row.sessionLastSeenAt
      ? {
          id: row.sessionPublicSessionId,
          state: row.sessionState,
          startedAt: row.sessionStartedAt,
          lastSeenAt: row.sessionLastSeenAt,
          device: { type: row.sessionDeviceType, os: row.sessionOsName, browser: row.sessionBrowserName },
          location: { city: row.sessionCity, region: row.sessionRegion, countryCode: row.sessionCountryCode },
        }
      : null,
    tab: row.pageId && row.pageLabel
      ? { id: row.pageId, label: row.pageLabel, fromId: row.fromPageId, fromLabel: row.fromPageLabel }
      : null,
    element: row.elementKind && row.elementLabel
      ? {
          kind: row.elementKind,
          id: row.elementId,
          label: row.elementLabel,
          destinationKind: row.destinationKind,
          destinationHost: row.destinationHost,
        }
      : null,
    webhook: row.webhookId && row.webhookEndpointHost
      ? { id: row.webhookId, endpointHost: row.webhookEndpointHost }
      : null,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
  };
}

function toSessionReadRecord(row: SessionReadRow): TrackingV2SessionReadRecord {
  return {
    id: row.publicSessionId,
    site: { id: row.siteId, name: row.siteName, slug: row.siteSlug },
    recipient: toRecipientSummary(row),
    state: row.state,
    device: { type: row.deviceType, os: row.osName, browser: row.browserName },
    location: { city: row.city, region: row.region, countryCode: row.countryCode },
    initialPage: { id: row.initialPageId, label: row.initialPageLabel },
    startedAt: row.startedAt,
    lastSeenAt: row.lastSeenAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    activeMs: row.activeMs,
    durationMs: row.durationMs,
    recording: {
      status: row.recordingStatus,
      available: row.recordingStatus === "available" || row.recordingStatus === "truncated",
      durationMs: row.recordingDurationMs,
    },
  };
}

function toRecipientSummary(row: RecipientJoinRow): TrackingV2RecipientSummaryRecord | null {
  if (!row.recipientId || !row.recipientVariantName || !row.recipientSlug) return null;
  const website = [
    row.recipientVariableValues?.recipient_website,
    row.recipientVariableValues?.website,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return {
    id: row.recipientId,
    name: row.recipientVariantName,
    slug: row.recipientSlug,
    recipientName: row.recipientName,
    recipientCompany: row.recipientCompany,
    website: website?.trim() ?? null,
  };
}

function eventReadConditions(input: TrackingV2ListEventsInput) {
  const conditions: SQL[] = [eq(trackingRecipientEvents.workspaceId, input.workspace.id), ...buildSiteAccessConditions(input.workspace, input.userId)];
  if (input.siteId) conditions.push(eq(trackingRecipientEvents.siteId, input.siteId));
  if (input.recipientId) conditions.push(eq(trackingRecipientEvents.recipientId, input.recipientId));
  if (input.sessionId) conditions.push(eq(trackingRecipientSessions.publicSessionId, input.sessionId));
  if (input.type) conditions.push(eq(trackingRecipientEvents.type, input.type));
  if (input.source) conditions.push(eq(trackingRecipientEvents.source, input.source));
  if (input.from) conditions.push(gte(trackingRecipientEvents.receivedAt, input.from));
  if (input.to) conditions.push(lt(trackingRecipientEvents.receivedAt, input.to));
  if (input.cursor) conditions.push(or(
    lt(trackingRecipientEvents.receivedAt, input.cursor.receivedAt),
    and(eq(trackingRecipientEvents.receivedAt, input.cursor.receivedAt), lt(trackingRecipientEvents.id, input.cursor.id)),
  )!);
  return conditions;
}

function sessionReadConditions(input: TrackingV2ListSessionsInput) {
  const conditions: SQL[] = [eq(trackingRecipientSessions.workspaceId, input.workspace.id), ...buildSiteAccessConditions(input.workspace, input.userId)];
  if (input.siteId) conditions.push(eq(trackingRecipientSessions.siteId, input.siteId));
  if (input.recipientId) conditions.push(eq(trackingRecipientSessions.recipientId, input.recipientId));
  if (input.state) conditions.push(eq(trackingRecipientSessions.state, input.state));
  if (input.recordingStatus) conditions.push(eq(trackingRecipientSessions.recordingStatus, input.recordingStatus));
  if (input.from) conditions.push(gte(trackingRecipientSessions.startedAt, input.from));
  if (input.to) conditions.push(lt(trackingRecipientSessions.startedAt, input.to));
  if (input.cursor) conditions.push(or(
    lt(trackingRecipientSessions.startedAt, input.cursor.startedAt),
    and(eq(trackingRecipientSessions.startedAt, input.cursor.startedAt), lt(trackingRecipientSessions.id, input.cursor.id)),
  )!);
  return conditions;
}

function buildSiteAccessConditions(workspace: TrackingV2ReadWorkspace, userId: string) {
  return workspace.role === "admin" ? [] : [or(eq(sites.createdByUserId, userId), eq(sites.visibility, "team"))!];
}

function effectiveRetentionDaysSql(workspaceId: unknown, siteId: unknown, recipientId: unknown) {
  return sql`coalesce(
    (select event_retention_days from tracking_settings where scope = 'recipient' and workspace_id = ${workspaceId} and recipient_id = ${recipientId} limit 1),
    (select event_retention_days from tracking_settings where scope = 'site' and workspace_id = ${workspaceId} and site_id = ${siteId} limit 1),
    (select event_retention_days from tracking_settings where scope = 'workspace' and workspace_id = ${workspaceId} limit 1),
    90
  )`;
}

function eventRetentionCutoff(now: Date) {
  return sql`${trackingRecipientEvents.receivedAt} <= ${now.toISOString()}::timestamptz - (${effectiveRetentionDaysSql(
    trackingRecipientEvents.workspaceId,
    trackingRecipientEvents.siteId,
    trackingRecipientEvents.recipientId,
  )} * interval '1 day')`;
}

function sessionRetentionCutoff(now: Date) {
  return sql`${trackingRecipientSessions.startedAt} <= ${now.toISOString()}::timestamptz - (${effectiveRetentionDaysSql(
    trackingRecipientSessions.workspaceId,
    trackingRecipientSessions.siteId,
    trackingRecipientSessions.recipientId,
  )} * interval '1 day')`;
}

export type MemoryTrackingV2RepositoryInput = {
  contexts?: TrackingV2ResolvedContext[];
  manifests?: TrackingV2ManifestRecord[];
  settings?: Array<
    Pick<TrackingV2SettingRecord, "scope" | "enabled" | "eventRetentionDays"> &
    Partial<Omit<TrackingV2SettingRecord, "scope" | "enabled" | "eventRetentionDays">> &
    { workspaceId: string; siteId: string | null; recipientId: string | null }
  >;
  sites?: Array<TrackingV2SiteSummaryRecord & { workspaceId: string; createdByUserId?: string; visibility?: "private" | "team" }>;
  recipients?: Array<TrackingV2RecipientSummaryRecord & { workspaceId: string; siteId: string }>;
};

type MemorySession = TrackingV2SessionRecord & {
  city: string | null;
  region: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  initialPageId: string;
  initialPageLabel: string;
  endedAt: Date | null;
  endReason: TrackingV2SessionEndReason | null;
  durationMs: number | null;
  recordingStatus: TrackingV2ReadRecordingStatus;
  recordingDurationMs: number | null;
  updatedAt: Date;
};

export function createMemoryTrackingV2Repository(input: MemoryTrackingV2RepositoryInput = {}): TrackingV2Repository & {
  sessions: Map<string, MemorySession>;
  events: TrackingV2StoredEvent[];
  manifests: Map<string, TrackingV2ManifestRecord>;
  createSessionInputs: TrackingV2CreateSessionInput[];
} {
  const contexts = [...(input.contexts ?? [])];
  const manifests = new Map((input.manifests ?? []).map((manifest) => [manifest.id, manifest]));
  const settings = (input.settings ?? []).map((setting) => ({
    recordingEnabled: false,
    recordingRetentionDays: 14 as const,
    maxRecordingDurationSeconds: 600,
    recordingTermsVersion: null,
    recordingTermsAcceptedAt: null,
    recordingTermsAcceptedByUserId: null,
    ...setting,
  }));
  const memorySites = new Map<string, TrackingV2SiteSummaryRecord & { workspaceId: string; createdByUserId: string; visibility: "private" | "team" }>();
  const recipients = new Map<string, TrackingV2RecipientSummaryRecord & { workspaceId: string; siteId: string }>();
  for (const context of contexts) {
    memorySites.set(context.siteId, { id: context.siteId, workspaceId: context.workspaceId, name: "Test Site", slug: "test-site", createdByUserId: "user_router", visibility: "team" });
    if (context.recipientId) recipients.set(context.recipientId, {
      id: context.recipientId, workspaceId: context.workspaceId, siteId: context.siteId, name: "Test Recipient", slug: "test-recipient",
      recipientName: "Taylor Recipient", recipientCompany: "Recipient Co", website: null,
    });
  }
  for (const site of input.sites ?? []) memorySites.set(site.id, { ...site, createdByUserId: site.createdByUserId ?? "user_router", visibility: site.visibility ?? "team" });
  for (const recipient of input.recipients ?? []) recipients.set(recipient.id, recipient);

  const sessions = new Map<string, MemorySession>();
  const events: TrackingV2StoredEvent[] = [];
  const createSessionInputs: TrackingV2CreateSessionInput[] = [];
  const effectiveRetentionDays = (workspaceId: string, siteId: string, recipientId: string | null) => {
    const applicable = settings.filter((setting) => setting.workspaceId === workspaceId && (
      setting.scope === "workspace" ||
      (setting.scope === "site" && setting.siteId === siteId) ||
      (setting.scope === "recipient" && setting.siteId === siteId && setting.recipientId === recipientId)
    ));
    const precedence: Record<TrackingV2SettingScope, number> = { workspace: 1, site: 2, recipient: 3 };
    return applicable.sort((left, right) => precedence[left.scope] - precedence[right.scope]).at(-1)?.eventRetentionDays ?? 90;
  };

  const repository: TrackingV2Repository & {
    sessions: Map<string, MemorySession>;
    events: TrackingV2StoredEvent[];
    manifests: Map<string, TrackingV2ManifestRecord>;
    createSessionInputs: TrackingV2CreateSessionInput[];
  } = {
    sessions, events, manifests, createSessionInputs,
    async findOrCreateManifest(manifestInput) {
      const existing = [...manifests.values()].find((manifest) =>
        manifest.publishedVersionId === manifestInput.publishedVersionId &&
        manifest.recipientId === manifestInput.recipientId &&
        manifest.recipientRevision === manifestInput.recipientRevision &&
        manifest.schemaVersion === manifestInput.schemaVersion
      );
      if (existing) {
        if (existing.sourceHash !== manifestInput.sourceHash) throw new Error("Tracking manifest invariant conflict.");
        return existing;
      }
      const manifest = { ...manifestInput, id: memoryUuid(manifests.size + 1) };
      manifests.set(manifest.id, manifest);
      return manifest;
    },
    async findManifestById({ manifestId, workspaceId, siteId }) {
      const manifest = manifests.get(manifestId);
      return manifest?.workspaceId === workspaceId && manifest.siteId === siteId ? manifest : null;
    },
    async findCurrentContext(lookup) {
      return contexts.find((context) => Object.entries(lookup).every(([key, value]) => context[key as keyof TrackingV2ResolvedContext] === value)) ?? null;
    },
    async listSettings({ workspaceId, siteId, recipientId }) {
      return settings.filter((setting) => setting.workspaceId === workspaceId && (
        setting.scope === "workspace" ||
        (setting.scope === "site" && setting.siteId === siteId) ||
        (setting.scope === "recipient" && setting.siteId === siteId && setting.recipientId === recipientId)
      ));
    },
    async findSettingsSite({ workspace, userId, siteId }) {
      const site = memorySites.get(siteId);
      if (!site || site.workspaceId !== workspace.id || (workspace.role !== "admin" && site.createdByUserId !== userId && site.visibility !== "team")) return null;
      return { id: site.id, name: site.name, slug: site.slug };
    },
    async findSiteSetting({ workspaceId, siteId }) {
      return settings.find((setting) => setting.workspaceId === workspaceId && setting.siteId === siteId && setting.scope === "site") ?? null;
    },
    async upsertSiteSetting({ workspaceId, siteId, settings: value }) {
      const index = settings.findIndex((setting) => setting.workspaceId === workspaceId && setting.siteId === siteId && setting.scope === "site");
      const next = { ...value, scope: "site" as const, workspaceId, siteId, recipientId: null };
      if (index >= 0) settings[index] = next; else settings.push(next);
      return next;
    },
    async listEvents(query) {
      const records = events
        .filter((event) => event.workspaceId === query.workspace.id)
        .filter((event) => !query.siteId || event.siteId === query.siteId)
        .filter((event) => !query.recipientId || event.recipientId === query.recipientId)
        .filter((event) => !query.type || event.type === query.type)
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .slice(0, query.limit)
        .map((event) => memoryEventReadRecord(event, sessions, memorySites, recipients));
      return { records, nextCursor: null };
    },
    async listSessions(query) {
      const records = [...sessions.values()]
        .filter((session) => session.workspaceId === query.workspace.id)
        .filter((session) => !query.siteId || session.siteId === query.siteId)
        .filter((session) => !query.recipientId || session.recipientId === query.recipientId)
        .filter((session) => !query.state || session.state === query.state)
        .filter((session) => !query.recordingStatus || session.recordingStatus === query.recordingStatus)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, query.limit)
        .map((session) => memorySessionReadRecord(session, memorySites, recipients));
      return { records, nextCursor: null };
    },
    async findReadSession({ workspace, publicSessionId }) {
      const session = sessions.get(publicSessionId);
      return session?.workspaceId === workspace.id ? memorySessionReadRecord(session, memorySites, recipients) : null;
    },
    async createSession(sessionInput) {
      createSessionInputs.push(sessionInput);
      const existing = sessions.get(sessionInput.publicSessionId);
      if (existing) return existing;
      const session: MemorySession = {
        id: memoryUuid(sessions.size + 100),
        publicSessionId: sessionInput.publicSessionId,
        workspaceId: sessionInput.workspaceId,
        siteId: sessionInput.siteId,
        recipientId: sessionInput.recipientId,
        recipientRevision: sessionInput.recipientRevision,
        publishedVersionId: sessionInput.publishedVersionId,
        manifestId: sessionInput.manifestId,
        eventTokenHash: sessionInput.eventTokenHash,
        state: "active",
        startedAt: sessionInput.startedAt,
        lastSeenAt: sessionInput.receivedAt,
        activeMs: 0,
        city: sessionInput.city,
        region: sessionInput.region,
        countryCode: sessionInput.countryCode,
        deviceType: sessionInput.deviceType,
        osName: sessionInput.osName,
        browserName: sessionInput.browserName,
        initialPageId: sessionInput.initialPageId,
        initialPageLabel: sessionInput.initialPageLabel,
        endedAt: null,
        endReason: null,
        durationMs: null,
        recordingStatus: "disabled",
        recordingDurationMs: null,
        updatedAt: sessionInput.receivedAt,
      };
      sessions.set(session.publicSessionId, session);
      events.push({
        eventId: `visit:${session.publicSessionId}`, batchId: null, sessionId: session.id,
        workspaceId: session.workspaceId, siteId: session.siteId, recipientId: session.recipientId,
        recipientRevision: session.recipientRevision, publishedVersionId: session.publishedVersionId,
        manifestId: session.manifestId, type: "site_visit", source: "browser",
        pageId: session.initialPageId, pageLabel: session.initialPageLabel, fromPageId: null, fromPageLabel: null,
        elementKind: null, elementId: null, elementLabel: null, destinationKind: null, destinationHost: null,
        webhookId: null, webhookEndpointHost: null, scriptVersion: null, eventData: {},
        occurredAt: session.startedAt, receivedAt: session.lastSeenAt,
      });
      return session;
    },
    async findSessionForEventToken({ publicSessionId, eventTokenHash, activeAfter }) {
      const session = sessions.get(publicSessionId);
      return session?.eventTokenHash === eventTokenHash && session.state === "active" && session.lastSeenAt >= activeAfter ? session : null;
    },
    async recordBrowserEvents({ session, batchId, scriptVersion, events: accepted, receivedAt }) {
      let count = 0;
      for (const event of accepted) {
        if (events.some((stored) => stored.eventId === event.eventId)) continue;
        events.push({ ...toBrowserEventInsert({ session, batchId, scriptVersion, receivedAt }, event), id: memoryUuid(events.length + 500), sessionId: session.id });
        count += 1;
      }
      const memorySession = sessions.get(session.publicSessionId);
      if (memorySession) {
        memorySession.lastSeenAt = receivedAt;
        memorySession.updatedAt = receivedAt;
      }
      return count;
    },
    async recordServerEvent(serverEvent) {
      if (events.some((event) => event.eventId === serverEvent.eventId)) return;
      events.push({
        id: memoryUuid(events.length + 500), eventId: serverEvent.eventId, batchId: null, sessionId: null,
        workspaceId: serverEvent.workspaceId, siteId: serverEvent.siteId, recipientId: serverEvent.recipientId,
        recipientRevision: serverEvent.recipientRevision, publishedVersionId: serverEvent.publishedVersionId,
        manifestId: serverEvent.manifestId, type: serverEvent.type, source: serverEvent.source,
        pageId: null, pageLabel: null, fromPageId: null, fromPageLabel: null, elementKind: null, elementId: null,
        elementLabel: null, destinationKind: null, destinationHost: null, webhookId: serverEvent.webhookId ?? null,
        webhookEndpointHost: serverEvent.webhookEndpointHost ?? null, scriptVersion: null, eventData: serverEvent.eventData,
        occurredAt: serverEvent.occurredAt, receivedAt: serverEvent.receivedAt,
      });
    },
    async updateSessionHeartbeat({ sessionId, activeAfter, occurredAt, activeMs }) {
      const session = [...sessions.values()].find((candidate) =>
        candidate.id === sessionId && candidate.state === "active" && candidate.lastSeenAt >= activeAfter
      );
      if (!session) return false;
      session.lastSeenAt = new Date(Math.max(session.lastSeenAt.getTime(), occurredAt.getTime()));
      session.activeMs = Math.max(session.activeMs, activeMs);
      session.updatedAt = occurredAt;
      return true;
    },
    async endSession({ sessionId, activeAfter, occurredAt, reason, activeMs }) {
      const session = [...sessions.values()].find((candidate) =>
        candidate.id === sessionId && candidate.state === "active" && candidate.lastSeenAt >= activeAfter
      );
      if (!session) return false;
      const endedAt = new Date(Math.max(session.lastSeenAt.getTime(), occurredAt.getTime()));
      session.state = "ended";
      session.lastSeenAt = endedAt;
      session.endedAt = endedAt;
      session.endReason = reason;
      session.activeMs = Math.max(session.activeMs, activeMs ?? 0);
      session.durationMs = Math.max(0, endedAt.getTime() - session.startedAt.getTime());
      session.updatedAt = occurredAt;
      return true;
    },
    async expireStaleSessions({ staleBefore, now, limit }) {
      let count = 0;
      const staleSessions = [...sessions.values()]
        .filter((session) => session.state === "active" && session.lastSeenAt <= staleBefore)
        .sort((left, right) => left.lastSeenAt.getTime() - right.lastSeenAt.getTime())
        .slice(0, limit);
      for (const session of staleSessions) {
        session.state = "expired"; session.endedAt = session.lastSeenAt; session.endReason = "server_expired";
        session.durationMs = Math.max(0, session.lastSeenAt.getTime() - session.startedAt.getTime()); session.updatedAt = now; count += 1;
      }
      return count;
    },
    async listEndedSessionsForRecording({ endedBefore, limit }) {
      return [...sessions.values()]
        .filter((session) => (
          (session.state === "ended" || session.state === "expired") &&
          (session.recordingStatus === "pending" || session.recordingStatus === "recording") &&
          session.endedAt !== null &&
          session.endReason !== null &&
          session.updatedAt <= endedBefore
        ))
        .sort((left, right) => left.endedAt!.getTime() - right.endedAt!.getTime())
        .slice(0, limit)
        .map((session) => ({ id: session.id, endedAt: session.endedAt!, endReason: session.endReason! }));
    },
    async pruneExpiredEvents({ now, limit }) {
      const before = events.length;
      for (let index = events.length - 1; index >= 0 && before - events.length < limit; index -= 1) {
        const event = events[index]!;
        const cutoff = now.getTime() - effectiveRetentionDays(event.workspaceId, event.siteId, event.recipientId) * 86_400_000;
        if (event.receivedAt.getTime() <= cutoff) events.splice(index, 1);
      }
      return before - events.length;
    },
    async pruneExpiredSessions({ now, limit }) {
      let count = 0;
      for (const [id, session] of sessions) if (
        count < limit &&
        session.startedAt.getTime() <= now.getTime() - effectiveRetentionDays(session.workspaceId, session.siteId, session.recipientId) * 86_400_000
      ) {
        sessions.delete(id); count += 1;
      }
      return count;
    },
    async pruneUnreferencedManifests({ limit }) {
      let count = 0;
      for (const [id] of manifests) {
        if (count >= limit) break;
        const referenced = [...sessions.values()].some((session) => session.manifestId === id) || events.some((event) => event.manifestId === id);
        if (!referenced) { manifests.delete(id); count += 1; }
      }
      return count;
    },
  };
  return repository;
}

function memorySessionReadRecord(
  session: MemorySession,
  sitesById: Map<string, TrackingV2SiteSummaryRecord>,
  recipients: Map<string, TrackingV2RecipientSummaryRecord>,
): TrackingV2SessionReadRecord {
  return {
    id: session.publicSessionId,
    site: sitesById.get(session.siteId) ?? { id: session.siteId, name: "Site", slug: "site" },
    recipient: session.recipientId ? recipients.get(session.recipientId) ?? null : null,
    state: session.state,
    device: { type: session.deviceType, os: session.osName, browser: session.browserName },
    location: { city: session.city, region: session.region, countryCode: session.countryCode },
    initialPage: { id: session.initialPageId, label: session.initialPageLabel },
    startedAt: session.startedAt, lastSeenAt: session.lastSeenAt, endedAt: session.endedAt,
    endReason: session.endReason, activeMs: session.activeMs, durationMs: session.durationMs,
    recording: {
      status: session.recordingStatus,
      available: session.recordingStatus === "available" || session.recordingStatus === "truncated",
      durationMs: session.recordingDurationMs,
    },
  };
}

function memoryEventReadRecord(
  event: TrackingV2StoredEvent,
  sessions: Map<string, MemorySession>,
  sitesById: Map<string, TrackingV2SiteSummaryRecord>,
  recipients: Map<string, TrackingV2RecipientSummaryRecord>,
): TrackingV2EventReadRecord {
  const session = [...sessions.values()].find((candidate) => candidate.id === event.sessionId);
  return {
    id: event.id ?? memoryUuid(999), eventId: event.eventId, type: event.type, source: event.source,
    site: sitesById.get(event.siteId) ?? { id: event.siteId, name: "Site", slug: "site" },
    recipient: event.recipientId ? recipients.get(event.recipientId) ?? null : null,
    sessionId: session?.publicSessionId ?? null,
    session: session ? {
      id: session.publicSessionId, state: session.state, startedAt: session.startedAt, lastSeenAt: session.lastSeenAt,
      device: { type: session.deviceType, os: session.osName, browser: session.browserName },
      location: { city: session.city, region: session.region, countryCode: session.countryCode },
    } : null,
    tab: event.pageId && event.pageLabel ? { id: event.pageId, label: event.pageLabel, fromId: event.fromPageId, fromLabel: event.fromPageLabel } : null,
    element: event.elementKind && event.elementLabel ? {
      kind: event.elementKind, id: event.elementId, label: event.elementLabel,
      destinationKind: event.destinationKind, destinationHost: event.destinationHost,
    } : null,
    webhook: event.webhookId && event.webhookEndpointHost ? { id: event.webhookId, endpointHost: event.webhookEndpointHost } : null,
    occurredAt: event.occurredAt, receivedAt: event.receivedAt,
  };
}

function memoryUuid(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}
