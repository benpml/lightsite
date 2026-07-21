import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import {
  resolvePublicSiteTracking,
  type PublishedSitePayload,
} from "@handout/site-document";
import {
  TRACKING_V2_HEARTBEAT_INTERVAL_MS,
  TRACKING_V2_IDLE_TIMEOUT_MS,
  TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS,
  TRACKING_V2_MAX_MANIFEST_BYTES,
  TRACKING_V2_MAX_RECORDING_DURATION_MS,
  TRACKING_V2_MAX_SESSION_DURATION_MS,
  TRACKING_V2_REPLAY_TERMS_VERSION,
  TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_STALE_AFTER_MS,
  type TrackingV2BrowserEvent,
  type TrackingV2ContextTokenPayload,
  type TrackingV2CreateInternalIpRangeRequest,
  type TrackingV2EventBatch,
  type TrackingV2EventBatchResponse,
  type TrackingV2EventsQuery,
  type TrackingV2EventsResponse,
  type TrackingV2ManifestElement,
  type TrackingV2ManifestPayload,
  type TrackingV2RecordingUpload,
  type TrackingV2RecordingComplete,
  type TrackingV2RecordingManifestResponse,
  type TrackingV2SessionEnd,
  type TrackingV2SessionHeartbeat,
  type TrackingV2SessionResponse,
  type TrackingV2SessionStartRequest,
  type TrackingV2SessionStartResponse,
  type TrackingV2SessionSummary,
  type TrackingV2SessionsQuery,
  type TrackingV2SessionsResponse,
  type TrackingV2SiteTrackingSettingsResponse,
  type TrackingV2TrackingSettings,
  type TrackingV2InternalIpRange,
  type TrackingV2UpdateSiteSettingsRequest,
} from "@handout/tracking-schema";

import type {
  TrackingV2AcceptedBrowserEvent,
  TrackingV2EventCursor,
  TrackingV2ManifestRecord,
  TrackingV2Repository,
  TrackingV2SessionCursor,
  TrackingV2SessionReadRecord,
  TrackingV2SettingRecord,
  TrackingV2SiteSummaryRecord,
  TrackingV2WritableSettings,
} from "./repository";
import type { TrackingSuppressionService } from "./suppression";
import type { TrackingV2RecordingObject } from "./recording-object-store";
import type { TrackingV2RecordingService } from "./recording-service";

const MAX_CLIENT_CLOCK_SKEW_MS = 5 * 60_000;
const SLACK_DEDUPE_BUCKET_MS = 10 * 60_000;
const MANIFEST_CACHE_MAX_ENTRIES = 1_000;
const MANIFEST_CACHE_TTL_MS = 10 * 60_000;

export type TrackingV2RequestSnapshot = {
  ipAddress: string | null;
  userAgent: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export type TrackingV2ServiceOptions = {
  repository: TrackingV2Repository;
  suppressionService: TrackingSuppressionService;
  tokenSecret: string;
  recordingService?: TrackingV2RecordingService | null;
  reconcileSessions?: () => Promise<void>;
  now?: () => Date;
};

export type TrackingV2ReadWorkspace = {
  id: string;
  role: "admin" | "user";
  plan: "free" | "core" | "pro";
};

export interface TrackingV2Service {
  preparePublicContext(payload: PublishedSitePayload): Promise<{
    workspaceId: string;
    siteId: string;
    publishedVersionId: string;
    manifestId: string;
    recipientId: string | null;
    recipientRevision: number | null;
    trackingMode: "events" | "events_and_replay";
  } | null>;
  listEvents(input: { workspace: TrackingV2ReadWorkspace; userId: string; query: TrackingV2EventsQuery }): Promise<Omit<TrackingV2EventsResponse, "requestId">>;
  listSessions(input: { workspace: TrackingV2ReadWorkspace; userId: string; query: TrackingV2SessionsQuery }): Promise<Omit<TrackingV2SessionsResponse, "requestId">>;
  getSession(input: { workspace: TrackingV2ReadWorkspace; userId: string; sessionId: string }): Promise<Omit<TrackingV2SessionResponse, "requestId"> | null>;
  getSiteSettings(input: { workspace: TrackingV2ReadWorkspace; userId: string; siteId: string }): Promise<Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> | null>;
  updateSiteSettings(input: { workspace: TrackingV2ReadWorkspace; userId: string; siteId: string; settings: TrackingV2UpdateSiteSettingsRequest }): Promise<Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> | null>;
  listInternalIpRanges(workspaceId: string): Promise<TrackingV2InternalIpRange[]>;
  createInternalIpRange(input: { workspaceId: string; userId: string; range: TrackingV2CreateInternalIpRangeRequest }): Promise<TrackingV2InternalIpRange>;
  deleteInternalIpRange(input: { workspaceId: string; id: string }): Promise<boolean>;
  startSession(input: {
    context: TrackingV2ContextTokenPayload;
    request: TrackingV2SessionStartRequest;
    requestSnapshot: TrackingV2RequestSnapshot;
  }): Promise<TrackingV2SessionStartResponse>;
  recordEventBatch(batch: TrackingV2EventBatch): Promise<TrackingV2EventBatchResponse>;
  recordSlackShare(input: { context: TrackingV2ContextTokenPayload; imageCacheKey: string }): Promise<{ recorded: boolean }>;
  recordWebhookSend(input: {
    context: TrackingV2ContextTokenPayload;
    webhookId: string;
    endpointHost: string;
    deliveryId: string;
    status: "succeeded" | "failed";
    attempt: number;
  }): Promise<{ recorded: boolean }>;
  recordHeartbeat(heartbeat: TrackingV2SessionHeartbeat): Promise<void>;
  endSession(end: TrackingV2SessionEnd): Promise<void>;
  recordRecordingChunk(input: { recordingId: string; uploadToken: string; upload: TrackingV2RecordingUpload }): Promise<{ duplicate: boolean; sequence: number }>;
  completeRecording(input: { recordingId: string; uploadToken: string; complete: TrackingV2RecordingComplete }): Promise<{ status: string }>;
  getRecordingManifest(input: { workspaceId: string; sessionId: string }): Promise<Omit<TrackingV2RecordingManifestResponse, "requestId"> | null>;
  getRecordingChunk(input: { workspaceId: string; recordingId: string; sequence: number }): Promise<TrackingV2RecordingObject | null>;
}

export class TrackingV2InvalidContextError extends Error {
  constructor() {
    super("Invalid tracking context.");
    this.name = "TrackingV2InvalidContextError";
  }
}

export class TrackingV2InvalidCursorError extends Error {
  constructor() {
    super("Invalid tracking cursor.");
    this.name = "TrackingV2InvalidCursorError";
  }
}

export class TrackingV2UnavailableError extends Error {
  constructor() {
    super("Tracking data is temporarily unavailable.");
    this.name = "TrackingV2UnavailableError";
  }
}

export class TrackingV2InvalidIpRangeError extends Error {
  constructor() {
    super("Invalid IP address or CIDR range.");
    this.name = "TrackingV2InvalidIpRangeError";
  }
}

export class TrackingV2RecordingUnavailableError extends Error {
  constructor() {
    super("Session replay is not available for this workspace.");
    this.name = "TrackingV2RecordingUnavailableError";
  }
}

const defaultSettings: TrackingV2WritableSettings = {
  enabled: true,
  eventRetentionDays: 90,
  recordingEnabled: false,
  recordingRetentionDays: 14,
  maxRecordingDurationSeconds: 600,
  recordingTermsVersion: null,
  recordingTermsAcceptedAt: null,
  recordingTermsAcceptedByUserId: null,
};

export function createTrackingV2Service(options: TrackingV2ServiceOptions): TrackingV2Service {
  assertSecret(options.tokenSecret);
  const now = options.now ?? (() => new Date());
  const manifestCache = new ManifestCache();

  async function findManifest(input: { manifestId: string; workspaceId: string; siteId: string }) {
    const cached = manifestCache.get(input.manifestId, now());
    if (cached) {
      return cached.workspaceId === input.workspaceId && cached.siteId === input.siteId ? cached : null;
    }
    const manifest = await options.repository.findManifestById(input);
    if (manifest) manifestCache.set(manifest, now());
    return manifest;
  }

  async function resolveActiveContext(context: TrackingV2ContextTokenPayload) {
    if (context.trackingMode !== "events" && context.trackingMode !== "events_and_replay") return null;
    const current = await options.repository.findCurrentContext({
      workspaceId: context.workspaceId,
      siteId: context.siteId,
      publishedVersionId: context.publishedVersionId,
      manifestId: context.manifestId,
      recipientId: context.recipientId,
      recipientRevision: context.recipientRevision,
    });
    if (!current) return null;
    const settings = resolveEffectiveSettings(await options.repository.listSettings({
      workspaceId: context.workspaceId,
      siteId: context.siteId,
      recipientId: context.recipientId,
    }));
    if (!settings.enabled) return null;
    const manifest = await findManifest({
      manifestId: context.manifestId,
      workspaceId: context.workspaceId,
      siteId: context.siteId,
    });
    return manifest ? { manifest, settings, current } : null;
  }

  return {
    async preparePublicContext(payload) {
      if (payload.tracking.trackingMode === "off") return null;
      const settings = resolveEffectiveSettings(await options.repository.listSettings({
        workspaceId: payload.tracking.workspaceId,
        siteId: payload.tracking.siteId,
        recipientId: payload.tracking.recipientId,
      }));
      if (!settings.enabled) return null;
      const resolved = resolvePublicSiteTracking(payload);
      const serialized = JSON.stringify(resolved.manifest);
      if (Buffer.byteLength(serialized, "utf8") > TRACKING_V2_MAX_MANIFEST_BYTES) return null;
      const manifest = await options.repository.findOrCreateManifest({
        workspaceId: payload.tracking.workspaceId,
        siteId: payload.tracking.siteId,
        publishedVersionId: payload.tracking.publishedVersionId,
        recipientId: payload.tracking.recipientId,
        recipientRevision: payload.tracking.recipientId ? payload.tracking.recipientRevision : null,
        schemaVersion: resolved.manifest.schemaVersion,
        sourceHash: createHash("sha256").update(serialized).digest("hex"),
        payload: resolved.manifest,
        createdAt: now(),
      });
      manifestCache.set(manifest, now());
      const replayRequested = Boolean(
        options.recordingService &&
        settings.recordingEnabled &&
        settings.recordingTermsVersion === TRACKING_V2_REPLAY_TERMS_VERSION &&
        settings.recordingTermsAcceptedAt &&
        payload.content.settings.trackingConsentPopup !== "none",
      );
      return {
        workspaceId: payload.tracking.workspaceId,
        siteId: payload.tracking.siteId,
        publishedVersionId: payload.tracking.publishedVersionId,
        manifestId: manifest.id,
        recipientId: payload.tracking.recipientId,
        recipientRevision: payload.tracking.recipientId ? payload.tracking.recipientRevision : null,
        trackingMode: replayRequested ? "events_and_replay" : "events",
      };
    },

    async listEvents(input) {
      const result = await repositoryQuery(() => options.repository.listEvents({
        workspace: input.workspace,
        userId: input.userId,
        siteId: input.query.siteId,
        recipientId: input.query.recipientId,
        sessionId: input.query.sessionId,
        type: input.query.type,
        source: input.query.source,
        from: parseOptionalDate(input.query.from),
        to: parseOptionalDate(input.query.to),
        cursor: decodeEventCursor(input.query.cursor),
        limit: input.query.limit,
      }));
      return {
        events: result.records.map((record) => ({
          ...record,
          session: record.session ? {
            ...record.session,
            startedAt: record.session.startedAt.toISOString(),
            lastSeenAt: record.session.lastSeenAt.toISOString(),
          } : null,
          occurredAt: record.occurredAt.toISOString(),
          receivedAt: record.receivedAt.toISOString(),
        })),
        nextCursor: encodeEventCursor(result.nextCursor),
      };
    },

    async listSessions(input) {
      await options.reconcileSessions?.();
      const result = await repositoryQuery(() => options.repository.listSessions({
        workspace: input.workspace,
        userId: input.userId,
        siteId: input.query.siteId,
        recipientId: input.query.recipientId,
        state: input.query.state,
        recordingStatus: input.query.recordingStatus,
        from: parseOptionalDate(input.query.from),
        to: parseOptionalDate(input.query.to),
        cursor: decodeSessionCursor(input.query.cursor),
        limit: input.query.limit,
      }));
      return {
        sessions: result.records.map(toSessionSummary),
        nextCursor: encodeSessionCursor(result.nextCursor),
      };
    },

    async getSession(input) {
      await options.reconcileSessions?.();
      const session = await repositoryQuery(() => options.repository.findReadSession({
        workspace: input.workspace,
        userId: input.userId,
        publicSessionId: input.sessionId,
      }));
      return session ? { session: toSessionSummary(session) } : null;
    },

    async getSiteSettings(input) {
      const site = await options.repository.findSettingsSite(input);
      if (!site) return null;
      const [settings, siteOverride] = await Promise.all([
        options.repository.listSettings({ workspaceId: input.workspace.id, siteId: input.siteId, recipientId: null }),
        options.repository.findSiteSetting({ workspaceId: input.workspace.id, siteId: input.siteId }),
      ]);
      return buildSettingsResponse({
        site,
        settings,
        siteOverride,
        recordingAvailable: Boolean(options.recordingService && input.workspace.plan === "pro"),
      });
    },

    async updateSiteSettings(input) {
      const site = await options.repository.findSettingsSite(input);
      if (!site) return null;
      if (input.settings.recordingEnabled && (!options.recordingService || input.workspace.plan !== "pro")) {
        throw new TrackingV2RecordingUnavailableError();
      }
      const existing = await options.repository.findSiteSetting({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
      });
      const acceptedCurrentTerms = input.settings.recordingEnabled && input.settings.recordingDisclosureAccepted === true;
      const siteOverride = await options.repository.upsertSiteSetting({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        settings: {
          enabled: input.settings.enabled,
          eventRetentionDays: input.settings.eventRetentionDays,
          recordingEnabled: input.settings.recordingEnabled,
          recordingRetentionDays: input.settings.recordingRetentionDays,
          maxRecordingDurationSeconds: input.settings.maxRecordingDurationSeconds,
          recordingTermsVersion: acceptedCurrentTerms
            ? TRACKING_V2_REPLAY_TERMS_VERSION
            : existing?.recordingTermsVersion ?? null,
          recordingTermsAcceptedAt: acceptedCurrentTerms
            ? existing?.recordingTermsVersion === TRACKING_V2_REPLAY_TERMS_VERSION
              ? existing.recordingTermsAcceptedAt
              : now()
            : existing?.recordingTermsAcceptedAt ?? null,
          recordingTermsAcceptedByUserId: acceptedCurrentTerms
            ? existing?.recordingTermsVersion === TRACKING_V2_REPLAY_TERMS_VERSION
              ? existing.recordingTermsAcceptedByUserId
              : input.userId
            : existing?.recordingTermsAcceptedByUserId ?? null,
        },
        updatedAt: now(),
      });
      const settings = await options.repository.listSettings({ workspaceId: input.workspace.id, siteId: input.siteId, recipientId: null });
      return buildSettingsResponse({
        site,
        settings,
        siteOverride,
        recordingAvailable: Boolean(options.recordingService && input.workspace.plan === "pro"),
      });
    },

    async listInternalIpRanges(workspaceId) {
      const ranges = await options.suppressionService.listInternalIpRanges(workspaceId);
      return ranges.map(toInternalIpRange);
    },

    async createInternalIpRange(input) {
      const ipRange = normalizeCidr(input.range.cidr);
      if (!ipRange) throw new TrackingV2InvalidIpRangeError();
      return toInternalIpRange(await options.suppressionService.upsertInternalIpRange({
        workspaceId: input.workspaceId,
        userId: input.userId,
        label: input.range.label.trim(),
        ipRange,
        now: now(),
      }));
    },

    deleteInternalIpRange(input) {
      return options.suppressionService.deleteInternalIpRange(input);
    },

    async startSession(input) {
      const serverNow = now();
      const resolved = await resolveActiveContext(input.context);
      if (!resolved) return stoppedSession("disabled");

      const ipAddress = normalizeIp(input.requestSnapshot.ipAddress);
      const suppression = await options.suppressionService.evaluateRecipientVisit({
        workspaceId: input.context.workspaceId,
        ipAddress,
      });
      if (suppression.suppressed) return stoppedSession("suppressed");

      const initialPage = pageById(resolved.manifest.payload, input.request.initialPageId);
      if (!initialPage) throw new TrackingV2InvalidContextError();

      const sessionId = deriveOpaqueValue("session", input.request.requestId, input.context.manifestId, options.tokenSecret);
      const eventToken = deriveOpaqueValue("event-token", input.request.requestId, input.context.manifestId, options.tokenSecret);
      const userAgent = classifyUserAgent(input.requestSnapshot.userAgent);
      const session = await options.repository.createSession({
        publicSessionId: sessionId,
        workspaceId: input.context.workspaceId,
        siteId: input.context.siteId,
        recipientId: input.context.recipientId,
        recipientRevision: input.context.recipientRevision,
        publishedVersionId: input.context.publishedVersionId,
        manifestId: input.context.manifestId,
        eventTokenHash: hashEventToken({ sessionId, eventToken, secret: options.tokenSecret }),
        initialPageId: initialPage.id,
        initialPageLabel: initialPage.label,
        city: normalizeLocation(input.requestSnapshot.city, 120),
        region: normalizeLocation(input.requestSnapshot.region, 120),
        countryCode: normalizeCountryCode(input.requestSnapshot.countryCode),
        deviceType: userAgent.deviceType,
        osName: userAgent.osName,
        browserName: userAgent.browserName,
        startedAt: normalizeClientTime(input.request.startedAt, serverNow),
        receivedAt: serverNow,
      });

      const recording = options.recordingService
        ? await options.recordingService.start({
            context: { ...input.context, ...resolved.current },
            session,
            settings: resolved.settings,
            consent: input.request.replayConsent,
          })
        : { enabled: false as const, maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS };

      return recording.enabled
        ? {
            accepted: true,
            eventsAccepted: true,
            recordingAccepted: true,
            sessionId,
            eventToken,
            scriptVersion: TRACKING_V2_SCRIPT_VERSION,
            heartbeatIntervalMs: TRACKING_V2_HEARTBEAT_INTERVAL_MS,
            idleTimeoutMs: TRACKING_V2_IDLE_TIMEOUT_MS,
            maxSessionDurationMs: TRACKING_V2_MAX_SESSION_DURATION_MS,
            recording,
          }
        : {
        accepted: true,
        eventsAccepted: true,
        recordingAccepted: false,
        sessionId,
        eventToken,
        scriptVersion: TRACKING_V2_SCRIPT_VERSION,
        heartbeatIntervalMs: TRACKING_V2_HEARTBEAT_INTERVAL_MS,
        idleTimeoutMs: TRACKING_V2_IDLE_TIMEOUT_MS,
        maxSessionDurationMs: TRACKING_V2_MAX_SESSION_DURATION_MS,
        recording,
      };
    },

    async recordEventBatch(batch) {
      const serverNow = now();
      const session = await authorizedSession(options.repository, batch.sessionId, batch.eventToken, options.tokenSecret, serverNow);
      const manifest = session.manifestId
        ? await findManifest({ manifestId: session.manifestId, workspaceId: session.workspaceId, siteId: session.siteId })
        : null;
      if (!manifest || !(await trackingEnabled(options.repository, session))) throw new TrackingV2InvalidContextError();

      const accepted = batch.events.flatMap((event) => {
        const resolvedEvent = resolveBrowserEvent(event, manifest.payload, session.startedAt, serverNow);
        return resolvedEvent ? [resolvedEvent] : [];
      });
      if (accepted.length > 0) {
        await options.repository.recordBrowserEvents({
          session,
          activeAfter: sessionActiveAfter(serverNow),
          batchId: batch.batchId,
          scriptVersion: batch.scriptVersion,
          events: accepted,
          receivedAt: serverNow,
        });
      }
      return { accepted: accepted.length, rejected: batch.events.length - accepted.length };
    },

    async recordSlackShare(input) {
      const resolved = await resolveActiveContext(input.context);
      if (!resolved) return { recorded: false };
      const occurredAt = now();
      await options.repository.recordServerEvent({
        eventId: serverEventId("slack_share", input.context, String(Math.floor(occurredAt.getTime() / SLACK_DEDUPE_BUCKET_MS)), options.tokenSecret),
        workspaceId: input.context.workspaceId,
        siteId: input.context.siteId,
        recipientId: input.context.recipientId,
        recipientRevision: input.context.recipientRevision,
        publishedVersionId: input.context.publishedVersionId,
        manifestId: input.context.manifestId,
        type: "slack_share",
        source: "slack_og_image",
        eventData: { resource: "og_image", imageCacheKey: input.imageCacheKey },
        occurredAt,
        receivedAt: occurredAt,
      });
      return { recorded: true };
    },

    async recordWebhookSend(input) {
      const resolved = await resolveActiveContext(input.context);
      const host = normalizeHostname(input.endpointHost);
      if (!resolved || !host || input.attempt < 1) return { recorded: false };
      const occurredAt = now();
      await options.repository.recordServerEvent({
        eventId: serverEventId("webhook_send", input.context, input.deliveryId, options.tokenSecret),
        workspaceId: input.context.workspaceId,
        siteId: input.context.siteId,
        recipientId: input.context.recipientId,
        recipientRevision: input.context.recipientRevision,
        publishedVersionId: input.context.publishedVersionId,
        manifestId: input.context.manifestId,
        type: "webhook_send",
        source: "webhook",
        eventData: { deliveryId: input.deliveryId, status: input.status, attempt: input.attempt },
        webhookId: input.webhookId,
        webhookEndpointHost: host,
        occurredAt,
        receivedAt: occurredAt,
      });
      return { recorded: true };
    },

    async recordHeartbeat(heartbeat) {
      const serverNow = now();
      const session = await authorizedSession(options.repository, heartbeat.sessionId, heartbeat.eventToken, options.tokenSecret, serverNow);
      if (!(await trackingEnabled(options.repository, session))) throw new TrackingV2InvalidContextError();
      const occurredAt = normalizedLifecycleTime(heartbeat.occurredAt, serverNow, session.startedAt);
      const updated = await options.repository.updateSessionHeartbeat({
        sessionId: session.id,
        activeAfter: sessionActiveAfter(serverNow),
        occurredAt,
        activeMs: creditActiveMs(heartbeat.activeMs, occurredAt, session.startedAt),
      });
      if (!updated) throw new TrackingV2InvalidContextError();
    },

    async endSession(end) {
      const serverNow = now();
      const session = await authorizedSession(options.repository, end.sessionId, end.eventToken, options.tokenSecret, serverNow);
      const occurredAt = normalizedLifecycleTime(end.occurredAt, serverNow, session.startedAt);
      const ended = await options.repository.endSession({
        sessionId: session.id,
        activeAfter: sessionActiveAfter(serverNow),
        occurredAt,
        reason: end.reason,
        activeMs: end.activeMs === undefined ? session.activeMs : creditActiveMs(end.activeMs, occurredAt, session.startedAt),
      });
      if (!ended) throw new TrackingV2InvalidContextError();
    },

    async recordRecordingChunk(input) {
      if (!options.recordingService) throw new TrackingV2RecordingUnavailableError();
      return options.recordingService.uploadChunk(input);
    },

    async completeRecording(input) {
      if (!options.recordingService) throw new TrackingV2RecordingUnavailableError();
      return options.recordingService.complete(input);
    },

    async getRecordingManifest(input) {
      return options.recordingService?.getManifest(input) ?? null;
    },

    async getRecordingChunk(input) {
      return options.recordingService?.getChunk(input) ?? null;
    },
  };
}

class ManifestCache {
  private readonly entries = new Map<string, { manifest: TrackingV2ManifestRecord; expiresAt: number }>();

  get(id: string, at: Date) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= at.getTime()) {
      this.entries.delete(id);
      return null;
    }
    this.entries.delete(id);
    this.entries.set(id, entry);
    return entry.manifest;
  }

  set(manifest: TrackingV2ManifestRecord, at: Date) {
    this.entries.delete(manifest.id);
    this.entries.set(manifest.id, { manifest, expiresAt: at.getTime() + MANIFEST_CACHE_TTL_MS });
    if (this.entries.size <= MANIFEST_CACHE_MAX_ENTRIES) return;
    const oldest = this.entries.keys().next().value;
    if (oldest) this.entries.delete(oldest);
  }
}

function resolveBrowserEvent(
  event: TrackingV2BrowserEvent,
  manifest: TrackingV2ManifestPayload,
  sessionStartedAt: Date,
  serverNow: Date,
): TrackingV2AcceptedBrowserEvent | null {
  const occurredAt = normalizeEventTime(event.occurredAt, sessionStartedAt, serverNow);
  if (!occurredAt) return null;

  if (event.type === "tab_switch") {
    const fromPage = pageById(manifest, event.fromPageId);
    const toPage = pageById(manifest, event.toPageId);
    if (!fromPage || !toPage || fromPage.id === toPage.id) return null;
    return {
      eventId: event.eventId,
      type: event.type,
      occurredAt,
      pageId: toPage.id,
      pageLabel: toPage.label,
      fromPageId: fromPage.id,
      fromPageLabel: fromPage.label,
      elementKind: "tab",
      elementId: toPage.id,
      elementLabel: toPage.label,
      destinationKind: "internal_tab",
      destinationHost: null,
      eventData: { sequence: event.sequence, trigger: event.trigger },
    };
  }

  const element = elementById(manifest, event.elementId);
  const page = pageById(manifest, event.pageId);
  if (!element || !page || element.eventType !== event.type || (element.pageId && element.pageId !== page.id)) return null;
  return {
    eventId: event.eventId,
    type: event.type,
    occurredAt,
    pageId: page.id,
    pageLabel: page.label,
    fromPageId: null,
    fromPageLabel: null,
    elementKind: element.kind,
    elementId: element.id,
    elementLabel: element.label,
    destinationKind: element.destinationKind,
    destinationHost: element.destinationHost,
    eventData: { sequence: event.sequence },
  };
}

function elementById(manifest: TrackingV2ManifestPayload, id: string): TrackingV2ManifestElement | null {
  return manifest.elements.find((element) => element.id === id) ?? null;
}

function pageById(manifest: TrackingV2ManifestPayload, id: string) {
  return manifest.pages.find((page) => page.id === id) ?? null;
}

async function authorizedSession(repository: TrackingV2Repository, sessionId: string, eventToken: string, secret: string, at: Date) {
  const session = await repository.findSessionForEventToken({
    publicSessionId: sessionId,
    eventTokenHash: hashEventToken({ sessionId, eventToken, secret }),
    activeAfter: sessionActiveAfter(at),
  });
  if (!session) throw new TrackingV2InvalidContextError();
  return session;
}

async function trackingEnabled(repository: TrackingV2Repository, session: { workspaceId: string; siteId: string; recipientId: string | null }) {
  return resolveEffectiveSettings(await repository.listSettings(session)).enabled;
}

function toSessionSummary(record: TrackingV2SessionReadRecord): TrackingV2SessionSummary {
  return {
    ...record,
    startedAt: record.startedAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
  };
}

function buildSettingsResponse(input: {
  settings: TrackingV2SettingRecord[];
  site: TrackingV2SiteSummaryRecord;
  siteOverride: TrackingV2SettingRecord | null;
  recordingAvailable: boolean;
}): Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> {
  const effective = resolveEffectiveSettings(input.settings);
  return {
    site: input.site,
    scope: "site",
    workspaceDefault: toTrackingSettings(resolveEffectiveSettings(input.settings.filter((setting) => setting.scope === "workspace"))),
    siteOverride: input.siteOverride ? toTrackingSettings(input.siteOverride) : null,
    effective: toTrackingSettings(effective),
    recordingAvailable: input.recordingAvailable,
    recordingDisclosure: {
      required: true,
      termsVersion: TRACKING_V2_REPLAY_TERMS_VERSION,
      text: TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
      acceptedAt: effective.recordingTermsVersion === TRACKING_V2_REPLAY_TERMS_VERSION
        ? effective.recordingTermsAcceptedAt?.toISOString() ?? null
        : null,
    },
  };
}

function toTrackingSettings(settings: TrackingV2WritableSettings): TrackingV2TrackingSettings {
  return {
    enabled: settings.enabled,
    eventRetentionDays: settings.eventRetentionDays,
    recordingEnabled: settings.recordingEnabled,
    recordingRetentionDays: settings.recordingRetentionDays,
    maxRecordingDurationSeconds: settings.maxRecordingDurationSeconds,
  };
}

function resolveEffectiveSettings(settings: TrackingV2SettingRecord[]): TrackingV2WritableSettings {
  const effective = { ...defaultSettings };
  const precedence: Record<TrackingV2SettingRecord["scope"], number> = { workspace: 1, site: 2, recipient: 3 };
  for (const setting of [...settings].sort((a, b) => precedence[a.scope] - precedence[b.scope])) {
    effective.enabled = setting.enabled;
    effective.eventRetentionDays = setting.eventRetentionDays;
    effective.recordingEnabled = setting.recordingEnabled;
    effective.recordingRetentionDays = setting.recordingRetentionDays;
    effective.maxRecordingDurationSeconds = setting.maxRecordingDurationSeconds;
    effective.recordingTermsVersion = setting.recordingTermsVersion;
    effective.recordingTermsAcceptedAt = setting.recordingTermsAcceptedAt;
    effective.recordingTermsAcceptedByUserId = setting.recordingTermsAcceptedByUserId;
  }
  return effective;
}

function stoppedSession(reason: "disabled" | "suppressed"): TrackingV2SessionStartResponse {
  return {
    accepted: false,
    eventsAccepted: false,
    recordingAccepted: false,
    reason,
    recording: { enabled: false, maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS },
  };
}

function deriveOpaqueValue(purpose: string, requestId: string, manifestId: string, secret: string) {
  return `${purpose.replaceAll("-", "_")}_${createHmac("sha256", secret)
    .update("tracking-v2")
    .update("\0").update(purpose)
    .update("\0").update(requestId)
    .update("\0").update(manifestId)
    .digest("base64url")}`;
}

export function hashEventToken(input: { sessionId: string; eventToken: string; secret: string }) {
  return createHmac("sha256", input.secret)
    .update("tracking-v2-event-token")
    .update("\0").update(input.sessionId)
    .update("\0").update(input.eventToken)
    .digest("hex");
}

function serverEventId(type: "slack_share" | "webhook_send", context: TrackingV2ContextTokenPayload, discriminator: string, secret: string) {
  const digest = createHmac("sha256", secret)
    .update("tracking-v2-server-event")
    .update("\0").update(type)
    .update("\0").update(context.manifestId)
    .update("\0").update(discriminator)
    .digest("hex");
  return `event_${type}_${digest}`;
}

function normalizeClientTime(value: string, serverNow: Date) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && Math.abs(parsed.getTime() - serverNow.getTime()) <= MAX_CLIENT_CLOCK_SKEW_MS
    ? parsed
    : serverNow;
}

function normalizeEventTime(value: string, startedAt: Date, serverNow: Date) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  if (parsed < new Date(startedAt.getTime() - MAX_CLIENT_CLOCK_SKEW_MS)) return null;
  if (parsed > new Date(serverNow.getTime() + MAX_CLIENT_CLOCK_SKEW_MS)) return null;
  return parsed > serverNow ? serverNow : parsed;
}

function normalizedLifecycleTime(value: string, serverNow: Date, startedAt: Date) {
  return normalizeEventTime(value, startedAt, serverNow) ?? serverNow;
}

function creditActiveMs(claimed: number, occurredAt: Date, startedAt: Date) {
  const elapsed = Math.max(0, occurredAt.getTime() - startedAt.getTime());
  return Math.min(claimed, elapsed + TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS, TRACKING_V2_MAX_SESSION_DURATION_MS);
}

function sessionActiveAfter(at: Date) {
  return new Date(at.getTime() - TRACKING_V2_SESSION_STALE_AFTER_MS);
}

function normalizeIp(value: string | null) {
  const candidate = value?.split(",")[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : null;
}

function normalizeCidr(value: string) {
  const [address, prefixValue, extra] = value.trim().split("/");
  if (!address || extra !== undefined) return null;
  const version = isIP(address);
  if (version === 0) return null;
  const maxPrefix = version === 4 ? 32 : 128;
  const prefix = prefixValue === undefined ? maxPrefix : Number(prefixValue);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= maxPrefix ? `${address}/${prefix}` : null;
}

function toInternalIpRange(range: { id: string; label: string; ipRange: string; enabled: boolean; createdAt: Date }): TrackingV2InternalIpRange {
  return {
    id: range.id,
    label: range.label,
    cidr: range.ipRange,
    enabled: range.enabled,
    createdAt: range.createdAt.toISOString(),
  };
}

function normalizeLocation(value: string | null, maxLength: number) {
  const normalized = value?.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeCountryCode(value: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeHostname(value: string) {
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.toLowerCase().replace(/\.$/, "").slice(0, 253) || null;
  } catch {
    return null;
  }
}

function classifyUserAgent(userAgent: string | null) {
  const value = userAgent ?? "";
  return { deviceType: classifyDevice(value), osName: classifyOs(value), browserName: classifyBrowser(value) };
}

function classifyDevice(value: string) {
  if (/\b(ipad|tablet)\b/i.test(value)) return "tablet";
  if (/\b(mobile|iphone|android)\b/i.test(value)) return "mobile";
  return value ? "desktop" : "unknown";
}

function classifyOs(value: string) {
  if (/\biphone|ipad|ios\b/i.test(value)) return "iOS";
  if (/\bandroid\b/i.test(value)) return "Android";
  if (/\bmac os x|macintosh\b/i.test(value)) return "macOS";
  if (/\bwindows\b/i.test(value)) return "Windows";
  if (/\blinux\b/i.test(value)) return "Linux";
  return value ? "Other" : "Unknown";
}

function classifyBrowser(value: string) {
  if (/\bedg\//i.test(value)) return "Edge";
  if (/\bfirefox\//i.test(value)) return "Firefox";
  if (/\bchrome\//i.test(value) && !/\bedg\//i.test(value)) return "Chrome";
  if (/\bsafari\//i.test(value) && !/\bchrome\//i.test(value)) return "Safari";
  return value ? "Other" : "Unknown";
}

function parseOptionalDate(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

function encodeEventCursor(cursor: TrackingV2EventCursor | null) {
  return cursor ? Buffer.from(JSON.stringify({ receivedAt: cursor.receivedAt.toISOString(), id: cursor.id })).toString("base64url") : null;
}

function decodeEventCursor(value: string | undefined): TrackingV2EventCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { receivedAt?: unknown; id?: unknown };
    if (typeof parsed.receivedAt !== "string" || Number.isNaN(Date.parse(parsed.receivedAt)) || typeof parsed.id !== "string") throw new Error();
    return { receivedAt: new Date(parsed.receivedAt), id: parsed.id };
  } catch {
    throw new TrackingV2InvalidCursorError();
  }
}

function encodeSessionCursor(cursor: TrackingV2SessionCursor | null) {
  return cursor ? Buffer.from(JSON.stringify({ startedAt: cursor.startedAt.toISOString(), id: cursor.id })).toString("base64url") : null;
}

function decodeSessionCursor(value: string | undefined): TrackingV2SessionCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { startedAt?: unknown; id?: unknown };
    if (typeof parsed.startedAt !== "string" || Number.isNaN(Date.parse(parsed.startedAt)) || typeof parsed.id !== "string") throw new Error();
    return { startedAt: new Date(parsed.startedAt), id: parsed.id };
  } catch {
    throw new TrackingV2InvalidCursorError();
  }
}

async function repositoryQuery<T>(query: () => Promise<T>) {
  try {
    return await query();
  } catch (error) {
    if (isConnectionError(error)) throw new TrackingV2UnavailableError();
    throw error;
  }
}

function isConnectionError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(error.code);
}

function assertSecret(secret: string) {
  if (secret.length < 32) throw new Error("Tracking token secret must be at least 32 characters.");
}
