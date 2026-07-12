import { z } from "zod";

export const TRACKING_V2_SCRIPT_VERSION = "2026-07-11.v7" as const;
export const TRACKING_V2_SCRIPT_ENDPOINT = `/track/${TRACKING_V2_SCRIPT_VERSION}/script.js` as const;
export const TRACKING_V2_RECORDER_SCRIPT_ENDPOINT = `/track/${TRACKING_V2_SCRIPT_VERSION}/recorder.js` as const;
export const TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT = `/track/${TRACKING_V2_SCRIPT_VERSION}/rrweb-record.js` as const;
export const TRACKING_V2_SESSION_START_ENDPOINT = "/api/public/tracking/v2/sessions" as const;
export const TRACKING_V2_EVENTS_ENDPOINT = "/api/public/tracking/v2/events" as const;
export const TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT = "/api/public/tracking/v2/sessions/heartbeat" as const;
export const TRACKING_V2_SESSION_END_ENDPOINT = "/api/public/tracking/v2/sessions/end" as const;
export const TRACKING_V2_RECORDING_ENDPOINT_PREFIX = "/api/public/tracking/v2/recordings" as const;

export const TRACKING_V2_HEARTBEAT_INTERVAL_MS = 15_000;
export const TRACKING_V2_IDLE_TIMEOUT_MS = 2 * 60_000;
export const TRACKING_V2_SESSION_STALE_AFTER_MS = 2 * 60_000;
export const TRACKING_V2_ACTIVITY_WINDOW_MS = 30_000;
export const TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS = 30_000;
export const TRACKING_V2_MAX_SESSION_DURATION_MS = 60 * 60_000;
export const TRACKING_V2_MAX_BATCH_EVENTS = 10;
export const TRACKING_V2_MAX_REQUEUED_EVENTS = 50;
export const TRACKING_V2_MAX_ID_LENGTH = 160;
export const TRACKING_V2_MAX_TOKEN_LENGTH = 2_048;
export const TRACKING_V2_MAX_LABEL_LENGTH = 180;
export const TRACKING_V2_MAX_URL_LENGTH = 2_000;
export const TRACKING_V2_MAX_PATH_LENGTH = 2_048;
export const TRACKING_V2_MAX_REFERRER_HOST_LENGTH = 253;
export const TRACKING_V2_MAX_USER_AGENT_LENGTH = 1_024;
export const TRACKING_V2_MAX_TIMEZONE_LENGTH = 80;
export const TRACKING_V2_MAX_LOCALE_LENGTH = 40;
export const TRACKING_V2_RECORDING_ENABLED = false;
export const TRACKING_V2_RECORDING_SCHEMA_VERSION = 3;
export const TRACKING_V2_MAX_RECORDING_DURATION_MS = 10 * 60_000;
export const TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS = 5_000;
export const TRACKING_V2_RECORDING_MAX_CHUNK_BYTES = 512 * 1024;
export const TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES = 96 * 1024;
export const TRACKING_V2_RECORDING_MAX_BYTES = 5 * 1024 * 1024;
export const TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES = 60 * 1024;
export const TRACKING_V2_RECORDING_MAX_EVENTS = 20_000;
export const TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK = 500;
export const TRACKING_V2_RECORDING_UPLOAD_TOKEN_BYTES = 32;
export const TRACKING_V2_MAX_EVENT_RETENTION_DAYS = 365;
export const TRACKING_V2_MAX_RAW_IP_RETENTION_DAYS = 30;
export const TRACKING_V2_MAX_RECORDING_RETENTION_DAYS = 30;
export const TRACKING_V2_MAX_RECORDING_DURATION_SECONDS = 10 * 60;
export const TRACKING_V2_RECORDING_DISCLOSURE_TEXT =
  "Session recording captures page structure, clicks, cursor movement, scroll activity, viewport changes, and timing. It does not record typed form values.";

export const trackingV2EventTypes = [
  "site_visit",
  "button_click",
  "link_click",
  "tab_switch",
  "slack_share",
  "webhook_send",
] as const;

export const trackingV2BrowserEventTypes = [
  "site_visit",
  "button_click",
  "link_click",
  "tab_switch",
] as const;

export const trackingV2ServerEventTypes = ["slack_share", "webhook_send"] as const;
export const trackingV2TrackingModes = ["off", "events", "events_and_recording"] as const;

export const trackingV2InternalSignalTypes = [
  "session_heartbeat",
  "session_end",
  "recording_chunk",
] as const;

export const trackingV2ElementKinds = [
  "button",
  "link",
  "tab",
  "sidebar_button",
  "sidebar_link",
  "image_card",
  "calendar",
  "unknown",
] as const;

export const trackingV2EventSources = [
  "browser",
  "server",
  "slack_og_image",
  "webhook",
] as const;

export const trackingV2SessionEndReasons = [
  "pagehide",
  "visibility_timeout",
  "idle_timeout",
  "max_duration",
  "heartbeat_timeout",
  "server_expired",
  "unknown",
] as const;

export const trackingV2SuppressionMarkerTypes = [
  "ip_address",
  "device_id",
  "user_id",
  "email_domain",
] as const;

export const trackingV2SettingScopes = ["workspace", "site", "recipient"] as const;

export const trackingV2EventRegistry = {
  site_visit: {
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: false,
  },
  button_click: {
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  link_click: {
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  tab_switch: {
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  slack_share: {
    source: "slack_og_image",
    sessionScoped: false,
    userVisible: true,
    requiresElement: false,
  },
  webhook_send: {
    source: "webhook",
    sessionScoped: false,
    userVisible: true,
    requiresElement: false,
  },
} as const satisfies Record<
  TrackingV2EventType,
  {
    source: TrackingV2EventSource;
    sessionScoped: boolean;
    userVisible: boolean;
    requiresElement: boolean;
  }
>;

export type TrackingV2EventType = (typeof trackingV2EventTypes)[number];
export type TrackingV2BrowserEventType = (typeof trackingV2BrowserEventTypes)[number];
export type TrackingV2ServerEventType = (typeof trackingV2ServerEventTypes)[number];
export type TrackingV2TrackingMode = (typeof trackingV2TrackingModes)[number];
export type TrackingV2InternalSignalType = (typeof trackingV2InternalSignalTypes)[number];
export type TrackingV2ElementKind = (typeof trackingV2ElementKinds)[number];
export type TrackingV2EventSource = (typeof trackingV2EventSources)[number];
export type TrackingV2SessionEndReason = (typeof trackingV2SessionEndReasons)[number];
export type TrackingV2SuppressionMarkerType = (typeof trackingV2SuppressionMarkerTypes)[number];
export type TrackingV2SettingScope = (typeof trackingV2SettingScopes)[number];

const idSchema = z.string().trim().min(8).max(TRACKING_V2_MAX_ID_LENGTH).regex(/^[A-Za-z0-9:_-]+$/);
const opaqueTokenSchema = z.string().trim().min(24).max(TRACKING_V2_MAX_TOKEN_LENGTH);
const uuidSchema = z.string().uuid();
const isoTimestampSchema = z.string().datetime({ offset: true });
const optionalTrimmedString = (maxLength: number) => z.string().trim().min(1).max(maxLength).optional();

export const trackingV2EventTypeSchema = z.enum(trackingV2EventTypes);
export const trackingV2BrowserEventTypeSchema = z.enum(trackingV2BrowserEventTypes);
export const trackingV2ServerEventTypeSchema = z.enum(trackingV2ServerEventTypes);
export const trackingV2TrackingModeSchema = z.enum(trackingV2TrackingModes);
export const trackingV2InternalSignalTypeSchema = z.enum(trackingV2InternalSignalTypes);
export const trackingV2ElementKindSchema = z.enum(trackingV2ElementKinds);
export const trackingV2EventSourceSchema = z.enum(trackingV2EventSources);
export const trackingV2SessionEndReasonSchema = z.enum(trackingV2SessionEndReasons);
export const trackingV2SuppressionMarkerTypeSchema = z.enum(trackingV2SuppressionMarkerTypes);
export const trackingV2SettingScopeSchema = z.enum(trackingV2SettingScopes);

export const trackingV2ClientEventIdSchema = idSchema;
export const trackingV2BatchIdSchema = idSchema;
export const trackingV2SessionIdSchema = idSchema;
export const trackingV2OpaqueTokenSchema = opaqueTokenSchema;
export const trackingV2IsoTimestampSchema = isoTimestampSchema;
export const trackingV2EntityIdSchema = uuidSchema;

export const trackingV2ReadCursorSchema = z.string().trim().min(1).max(2048);

export const trackingV2EventsQuerySchema = z
  .object({
    siteId: uuidSchema.optional(),
    recipientId: uuidSchema.optional(),
    sessionId: trackingV2SessionIdSchema.optional(),
    type: trackingV2EventTypeSchema.optional(),
    source: trackingV2EventSourceSchema.optional(),
    from: trackingV2IsoTimestampSchema.optional(),
    to: trackingV2IsoTimestampSchema.optional(),
    cursor: trackingV2ReadCursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to)) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be after from",
      });
    }
  });

export const trackingV2SessionStateSchema = z.enum([
  "active",
  "ended",
  "expired",
  "suppressed",
]);

export const trackingV2ReadRecordingStatusSchema = z.enum([
  "disabled",
  "pending",
  "recording",
  "available",
  "truncated",
  "failed",
  "expired",
  "deleted",
]);

export const trackingV2SessionRecordingStatusFilterSchema = z.enum([
  "disabled",
  "pending",
  "available",
  "expired",
  "failed",
]);

export const trackingV2PublicContextSchema = z
  .object({
    version: z.literal(2),
    workspaceId: uuidSchema,
    siteId: uuidSchema,
    publishedVersionId: uuidSchema,
    recipientId: uuidSchema.nullable(),
    recipientRevision: z.number().int().nonnegative().nullable(),
    trackingMode: trackingV2TrackingModeSchema,
  })
  .strict();

export const trackingV2SessionsQuerySchema = z
  .object({
    siteId: uuidSchema.optional(),
    recipientId: uuidSchema.optional(),
    state: trackingV2SessionStateSchema.optional(),
    recordingStatus: trackingV2SessionRecordingStatusFilterSchema.optional(),
    from: trackingV2IsoTimestampSchema.optional(),
    to: trackingV2IsoTimestampSchema.optional(),
    cursor: trackingV2ReadCursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to)) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be after from",
      });
    }
  });

export const trackingV2SiteSummarySchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(96),
  })
  .strict();

export const trackingV2RecipientSummarySchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(96),
    recipientName: z.string().trim().min(1).max(160).nullable(),
    recipientCompany: z.string().trim().min(1).max(160).nullable(),
    website: z.string().trim().min(1).max(253).nullable(),
  })
  .strict();

export const trackingV2DeviceSummarySchema = z
  .object({
    type: z.string().trim().min(1).max(40).nullable(),
    os: z.string().trim().min(1).max(80).nullable(),
    browser: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export const trackingV2LocationSummarySchema = z
  .object({
    city: z.string().trim().min(1).max(120).nullable(),
    region: z.string().trim().min(1).max(120).nullable(),
    countryCode: z.string().trim().length(2).nullable(),
  })
  .strict();

const trackingV2TrackingSettingsShape = {
  enabled: z.boolean(),
  captureIpAddress: z.boolean(),
  rawIpRetentionDays: z.number().int().min(0).max(TRACKING_V2_MAX_RAW_IP_RETENTION_DAYS),
  eventRetentionDays: z.number().int().min(1).max(TRACKING_V2_MAX_EVENT_RETENTION_DAYS),
  recordingEnabled: z.boolean(),
  recordingRetentionDays: z.number().int().min(1).max(TRACKING_V2_MAX_RECORDING_RETENTION_DAYS),
  maxRecordingDurationSeconds: z.number().int().min(60).max(TRACKING_V2_MAX_RECORDING_DURATION_SECONDS),
} as const;

export const trackingV2TrackingSettingsSchema = z
  .object(trackingV2TrackingSettingsShape)
  .strict()
  .superRefine(validateTrackingV2SettingsRetention);

export const trackingV2UpdateSiteSettingsRequestSchema = z
  .object({
    ...trackingV2TrackingSettingsShape,
    recordingDisclosureAccepted: z.boolean().optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    validateTrackingV2SettingsRetention(settings, context);

    if (settings.recordingEnabled && settings.recordingDisclosureAccepted !== true) {
      context.addIssue({
        code: "custom",
        path: ["recordingDisclosureAccepted"],
        message: "recordingDisclosureAccepted must be true when recording is enabled",
      });
    }
  });

export const trackingV2RecordingDisclosureSchema = z
  .object({
    required: z.literal(true),
    text: z.literal(TRACKING_V2_RECORDING_DISCLOSURE_TEXT),
  })
  .strict();

export const trackingV2SiteTrackingSettingsResponseSchema = z
  .object({
    site: trackingV2SiteSummarySchema,
    scope: z.literal("site"),
    workspaceDefault: trackingV2TrackingSettingsSchema,
    siteOverride: trackingV2TrackingSettingsSchema.nullable(),
    effective: trackingV2TrackingSettingsSchema,
    recordingDisclosure: trackingV2RecordingDisclosureSchema,
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2EventElementSummarySchema = z
  .object({
    kind: trackingV2ElementKindSchema,
    id: z.string().trim().min(1).max(TRACKING_V2_MAX_ID_LENGTH).nullable(),
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    href: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH).nullable(),
  })
  .strict();

export const trackingV2EventTabSummarySchema = z
  .object({
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
  })
  .strict();

export const trackingV2EventWebhookSummarySchema = z
  .object({
    id: uuidSchema,
    url: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH),
  })
  .strict();

export const trackingV2EventSessionSummarySchema = z
  .object({
    id: trackingV2SessionIdSchema,
    state: trackingV2SessionStateSchema,
    startedAt: trackingV2IsoTimestampSchema,
    lastSeenAt: trackingV2IsoTimestampSchema,
    device: trackingV2DeviceSummarySchema,
    location: trackingV2LocationSummarySchema,
  })
  .strict();

export const trackingV2EventFeedItemSchema = z
  .object({
    id: uuidSchema,
    eventId: trackingV2ClientEventIdSchema,
    type: trackingV2EventTypeSchema,
    source: trackingV2EventSourceSchema,
    site: trackingV2SiteSummarySchema,
    recipient: trackingV2RecipientSummarySchema.nullable(),
    sessionId: trackingV2SessionIdSchema.nullable(),
    session: trackingV2EventSessionSummarySchema.nullable(),
    tab: trackingV2EventTabSummarySchema.nullable(),
    element: trackingV2EventElementSummarySchema.nullable(),
    webhook: trackingV2EventWebhookSummarySchema.nullable(),
    occurredAt: trackingV2IsoTimestampSchema,
    receivedAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export const trackingV2SessionRecordingSummarySchema = z
  .object({
    status: trackingV2ReadRecordingStatusSchema,
    available: z.boolean(),
    durationMs: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const trackingV2SessionSummarySchema = z
  .object({
    id: trackingV2SessionIdSchema,
    site: trackingV2SiteSummarySchema,
    recipient: trackingV2RecipientSummarySchema.nullable(),
    state: trackingV2SessionStateSchema,
    device: trackingV2DeviceSummarySchema,
    location: trackingV2LocationSummarySchema,
    ipAddress: z.string().trim().min(1).max(80).nullable(),
    initialPath: z.string().trim().min(1).max(TRACKING_V2_MAX_PATH_LENGTH).nullable(),
    referrerHost: z.string().trim().min(1).max(TRACKING_V2_MAX_REFERRER_HOST_LENGTH).nullable(),
    startedAt: trackingV2IsoTimestampSchema,
    lastSeenAt: trackingV2IsoTimestampSchema,
    endedAt: trackingV2IsoTimestampSchema.nullable(),
    endReason: trackingV2SessionEndReasonSchema.nullable(),
    activeMs: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().nullable(),
    maxScrollDepthPercent: z.number().int().min(0).max(100).nullable(),
    recording: trackingV2SessionRecordingSummarySchema,
  })
  .strict();

export const trackingV2EventsResponseSchema = z
  .object({
    events: z.array(trackingV2EventFeedItemSchema),
    nextCursor: trackingV2ReadCursorSchema.nullable(),
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2SessionsResponseSchema = z
  .object({
    sessions: z.array(trackingV2SessionSummarySchema),
    nextCursor: trackingV2ReadCursorSchema.nullable(),
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2SessionResponseSchema = z
  .object({
    session: trackingV2SessionSummarySchema,
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2RecordingManifestChunkSchema = z
  .object({
    sequence: z.number().int().nonnegative().max(10_000),
    eventCount: z.number().int().nonnegative(),
    compressedBytes: z.number().int().nonnegative(),
    checksumSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i),
    firstEventAt: trackingV2IsoTimestampSchema.nullable(),
    lastEventAt: trackingV2IsoTimestampSchema.nullable(),
  })
  .strict();

export const trackingV2RecordingManifestResponseSchema = z
  .object({
    recordingId: uuidSchema,
    sessionId: trackingV2SessionIdSchema,
    status: trackingV2ReadRecordingStatusSchema,
    startedAt: trackingV2IsoTimestampSchema,
    endedAt: trackingV2IsoTimestampSchema.nullable(),
    durationMs: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    compressedBytes: z.number().int().nonnegative(),
    maxDurationMs: z.number().int().positive().max(TRACKING_V2_MAX_RECORDING_DURATION_MS),
    chunks: z.array(trackingV2RecordingManifestChunkSchema),
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2ViewportSchema = z
  .object({
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
  })
  .strict();

export const trackingV2PageSchema = z
  .object({
    path: z.string().trim().min(1).max(TRACKING_V2_MAX_PATH_LENGTH),
    title: optionalTrimmedString(TRACKING_V2_MAX_LABEL_LENGTH),
    referrerHost: z.string().trim().min(1).max(TRACKING_V2_MAX_REFERRER_HOST_LENGTH).nullable().optional(),
  })
  .strict();

export const trackingV2DeviceSnapshotSchema = z
  .object({
    deviceId: z.string().trim().min(8).max(TRACKING_V2_MAX_ID_LENGTH).nullable().optional(),
    timezone: z.string().trim().min(1).max(TRACKING_V2_MAX_TIMEZONE_LENGTH).nullable().optional(),
    locale: z.string().trim().min(1).max(TRACKING_V2_MAX_LOCALE_LENGTH).nullable().optional(),
    userAgent: z.string().trim().min(1).max(TRACKING_V2_MAX_USER_AGENT_LENGTH).nullable().optional(),
  })
  .strict();

export const trackingV2ElementSchema = z
  .object({
    kind: trackingV2ElementKindSchema,
    id: optionalTrimmedString(TRACKING_V2_MAX_ID_LENGTH),
    blockId: optionalTrimmedString(TRACKING_V2_MAX_ID_LENGTH),
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    href: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH).nullable().optional(),
  })
  .strict();

const trackingV2ClientEventBaseSchema = z
  .object({
    eventId: trackingV2ClientEventIdSchema,
    occurredAt: trackingV2IsoTimestampSchema,
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    page: trackingV2PageSchema.optional(),
    viewport: trackingV2ViewportSchema.optional(),
  })
  .strict();

export const trackingV2SiteVisitEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("site_visit"),
    tab: trackingV2ElementSchema
      .extend({
        kind: z.literal("tab"),
      })
      .optional(),
  })
  .strict();

export const trackingV2ButtonClickEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("button_click"),
    element: trackingV2ElementSchema.refine((element) => element.kind !== "link" && element.kind !== "tab", {
      message: "button_click requires a button-like element",
    }),
  })
  .strict();

export const trackingV2LinkClickEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("link_click"),
    element: trackingV2ElementSchema.extend({
      kind: z.enum(["link", "sidebar_link"]),
      href: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH),
    }),
  })
  .strict();

export const trackingV2TabSwitchEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("tab_switch"),
    element: trackingV2ElementSchema.extend({
      kind: z.literal("tab"),
    }),
    fromTabLabel: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH).nullable().optional(),
  })
  .strict();

export const trackingV2BrowserEventSchema = z.discriminatedUnion("type", [
  trackingV2SiteVisitEventSchema,
  trackingV2ButtonClickEventSchema,
  trackingV2LinkClickEventSchema,
  trackingV2TabSwitchEventSchema,
]);

export const trackingV2SessionStartRequestSchema = z
  .object({
    contextToken: trackingV2OpaqueTokenSchema,
    startedAt: trackingV2IsoTimestampSchema,
    page: trackingV2PageSchema,
    viewport: trackingV2ViewportSchema.optional(),
    device: trackingV2DeviceSnapshotSchema.optional(),
  })
  .strict();

export const trackingV2RecordingDisabledConfigSchema = z
  .object({
    enabled: z.literal(false),
    maxDurationMs: z.literal(TRACKING_V2_MAX_RECORDING_DURATION_MS),
  })
  .strict();

export const trackingV2RecordingAcceptedConfigSchema = z
  .object({
    enabled: z.literal(true),
    recordingId: uuidSchema,
    uploadToken: trackingV2OpaqueTokenSchema,
    chunkEndpoint: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH),
    completeEndpoint: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH),
    maxDurationMs: z.number().int().positive().max(TRACKING_V2_MAX_RECORDING_DURATION_MS),
    flushIntervalMs: z.literal(TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS),
    targetChunkBytes: z.literal(TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES),
    maxChunkBytes: z.literal(TRACKING_V2_RECORDING_MAX_CHUNK_BYTES),
    maxBytes: z.literal(TRACKING_V2_RECORDING_MAX_BYTES),
    maxEvents: z.literal(TRACKING_V2_RECORDING_MAX_EVENTS),
    maxEventsPerChunk: z.literal(TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK),
  })
  .strict();

export const trackingV2RecordingConfigSchema = z.discriminatedUnion("enabled", [
  trackingV2RecordingDisabledConfigSchema,
  trackingV2RecordingAcceptedConfigSchema,
]);

const trackingV2StartedEventsOnlySessionResponseSchema = z
  .object({
    accepted: z.literal(true),
    eventsAccepted: z.literal(true),
    recordingAccepted: z.literal(false),
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    scriptVersion: z.literal(TRACKING_V2_SCRIPT_VERSION),
    heartbeatIntervalMs: z.literal(TRACKING_V2_HEARTBEAT_INTERVAL_MS),
    idleTimeoutMs: z.literal(TRACKING_V2_IDLE_TIMEOUT_MS),
    maxSessionDurationMs: z.literal(TRACKING_V2_MAX_SESSION_DURATION_MS),
    recording: trackingV2RecordingDisabledConfigSchema,
  })
  .strict();

const trackingV2StartedRecordingSessionResponseSchema = z
  .object({
    accepted: z.literal(true),
    eventsAccepted: z.literal(true),
    recordingAccepted: z.literal(true),
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    scriptVersion: z.literal(TRACKING_V2_SCRIPT_VERSION),
    heartbeatIntervalMs: z.literal(TRACKING_V2_HEARTBEAT_INTERVAL_MS),
    idleTimeoutMs: z.literal(TRACKING_V2_IDLE_TIMEOUT_MS),
    maxSessionDurationMs: z.literal(TRACKING_V2_MAX_SESSION_DURATION_MS),
    recording: trackingV2RecordingAcceptedConfigSchema,
  })
  .strict();

const trackingV2StoppedSessionResponseSchema = z
  .object({
    accepted: z.literal(false),
    eventsAccepted: z.literal(false),
    recordingAccepted: z.literal(false),
    reason: z.enum(["disabled", "suppressed"]),
    recording: trackingV2RecordingConfigSchema,
  })
  .strict();

export const trackingV2SessionStartResponseSchema = z.union([
  trackingV2StartedEventsOnlySessionResponseSchema,
  trackingV2StartedRecordingSessionResponseSchema,
  trackingV2StoppedSessionResponseSchema,
]);

export const trackingV2EventBatchSchema = z
  .object({
    batchId: trackingV2BatchIdSchema,
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    scriptVersion: z.literal(TRACKING_V2_SCRIPT_VERSION),
    sentAt: trackingV2IsoTimestampSchema,
    events: z.array(trackingV2BrowserEventSchema).min(1).max(TRACKING_V2_MAX_BATCH_EVENTS),
  })
  .strict();

export const trackingV2SessionHeartbeatSchema = z
  .object({
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    occurredAt: trackingV2IsoTimestampSchema,
    activeMs: z.number().int().nonnegative().max(TRACKING_V2_MAX_SESSION_DURATION_MS),
    maxScrollDepthPercent: z.number().int().min(0).max(100).optional(),
    page: trackingV2PageSchema.optional(),
  })
  .strict();

export const trackingV2SessionEndSchema = z
  .object({
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    occurredAt: trackingV2IsoTimestampSchema,
    reason: trackingV2SessionEndReasonSchema,
    activeMs: z.number().int().nonnegative().max(TRACKING_V2_MAX_SESSION_DURATION_MS).optional(),
  })
  .strict();

export const trackingV2RrwebEventSchema = z
  .object({
    type: z.number().int().min(0).max(7),
    timestamp: z.number().int().positive(),
    data: z.unknown(),
  })
  .strict();

export const trackingV2RecordingChunkSchema = z
  .object({
    schemaVersion: z.literal(TRACKING_V2_RECORDING_SCHEMA_VERSION),
    sessionId: trackingV2SessionIdSchema,
    sequence: z.number().int().nonnegative().max(10_000),
    events: z.array(trackingV2RrwebEventSchema).min(1).max(TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK),
    compressed: z.literal(false).optional(),
    checksumSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .strict();

export const trackingV2RecordingCompleteSchema = z
  .object({
    schemaVersion: z.literal(TRACKING_V2_RECORDING_SCHEMA_VERSION),
    sessionId: trackingV2SessionIdSchema,
    finalSequence: z.number().int().nonnegative().max(10_000).nullable(),
    endedAt: trackingV2IsoTimestampSchema,
    stopReason: z.enum(["ended", "hidden_timeout", "duration_cap", "size_cap", "event_cap", "error"]),
  })
  .strict();

export const trackingV2SlackShareDataSchema = z
  .object({
    platform: z.literal("slack"),
    userAgentFamily: z.literal("slackbot"),
    resource: z.literal("og_image"),
    imageCacheKey: optionalTrimmedString(TRACKING_V2_MAX_ID_LENGTH),
  })
  .strict();

export const trackingV2WebhookSendDataSchema = z
  .object({
    webhookId: uuidSchema,
    webhookUrl: z.string().trim().min(1).max(TRACKING_V2_MAX_URL_LENGTH),
  })
  .strict();

export const trackingV2ServerEventDataSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("slack_share"),
      data: trackingV2SlackShareDataSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("webhook_send"),
      data: trackingV2WebhookSendDataSchema,
    })
    .strict(),
]);

export const trackingV2PublicBootstrapSchema = z
  .object({
    version: z.literal(2),
    trackingMode: trackingV2TrackingModeSchema,
    contextToken: trackingV2OpaqueTokenSchema,
    issuedAt: trackingV2IsoTimestampSchema,
    expiresAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export const trackingV2ContextTokenPayloadSchema = z
  .object({
    version: z.literal(2),
    keyId: z.string().trim().min(1).max(80),
    workspaceId: uuidSchema,
    siteId: uuidSchema,
    publishedVersionId: uuidSchema,
    recipientId: uuidSchema.nullable(),
    recipientRevision: z.number().int().nonnegative().nullable(),
    trackingMode: trackingV2TrackingModeSchema,
    issuedAt: trackingV2IsoTimestampSchema,
    expiresAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export type TrackingV2Viewport = z.infer<typeof trackingV2ViewportSchema>;
export type TrackingV2Page = z.infer<typeof trackingV2PageSchema>;
export type TrackingV2DeviceSnapshot = z.infer<typeof trackingV2DeviceSnapshotSchema>;
export type TrackingV2Element = z.infer<typeof trackingV2ElementSchema>;
export type TrackingV2SiteVisitEvent = z.infer<typeof trackingV2SiteVisitEventSchema>;
export type TrackingV2ButtonClickEvent = z.infer<typeof trackingV2ButtonClickEventSchema>;
export type TrackingV2LinkClickEvent = z.infer<typeof trackingV2LinkClickEventSchema>;
export type TrackingV2TabSwitchEvent = z.infer<typeof trackingV2TabSwitchEventSchema>;
export type TrackingV2BrowserEvent = z.infer<typeof trackingV2BrowserEventSchema>;
export type TrackingV2SessionStartRequest = z.infer<typeof trackingV2SessionStartRequestSchema>;
export type TrackingV2SessionStartResponse = z.infer<typeof trackingV2SessionStartResponseSchema>;
export type TrackingV2EventBatch = z.infer<typeof trackingV2EventBatchSchema>;
export type TrackingV2SessionHeartbeat = z.infer<typeof trackingV2SessionHeartbeatSchema>;
export type TrackingV2SessionEnd = z.infer<typeof trackingV2SessionEndSchema>;
export type TrackingV2RecordingChunk = z.infer<typeof trackingV2RecordingChunkSchema>;
export type TrackingV2RecordingComplete = z.infer<typeof trackingV2RecordingCompleteSchema>;
export type TrackingV2ServerEventData = z.infer<typeof trackingV2ServerEventDataSchema>;
export type TrackingV2PublicBootstrap = z.infer<typeof trackingV2PublicBootstrapSchema>;
export type TrackingV2ContextTokenPayload = z.infer<typeof trackingV2ContextTokenPayloadSchema>;
export type TrackingV2SessionState = z.infer<typeof trackingV2SessionStateSchema>;
export type TrackingV2ReadRecordingStatus = z.infer<typeof trackingV2ReadRecordingStatusSchema>;
export type TrackingV2SessionRecordingStatusFilter = z.infer<typeof trackingV2SessionRecordingStatusFilterSchema>;
export type TrackingV2PublicContext = z.infer<typeof trackingV2PublicContextSchema>;
export type TrackingV2EventsQuery = z.infer<typeof trackingV2EventsQuerySchema>;
export type TrackingV2SessionsQuery = z.infer<typeof trackingV2SessionsQuerySchema>;
export type TrackingV2EventFeedItem = z.infer<typeof trackingV2EventFeedItemSchema>;
export type TrackingV2EventsResponse = z.infer<typeof trackingV2EventsResponseSchema>;
export type TrackingV2SessionSummary = z.infer<typeof trackingV2SessionSummarySchema>;
export type TrackingV2SessionsResponse = z.infer<typeof trackingV2SessionsResponseSchema>;
export type TrackingV2SessionResponse = z.infer<typeof trackingV2SessionResponseSchema>;
export type TrackingV2RecordingManifestResponse = z.infer<typeof trackingV2RecordingManifestResponseSchema>;
export type TrackingV2TrackingSettings = z.infer<typeof trackingV2TrackingSettingsSchema>;
export type TrackingV2UpdateSiteSettingsRequest = z.infer<typeof trackingV2UpdateSiteSettingsRequestSchema>;
export type TrackingV2SiteTrackingSettingsResponse = z.infer<typeof trackingV2SiteTrackingSettingsResponseSchema>;

function validateTrackingV2SettingsRetention(
  settings: {
    rawIpRetentionDays: number;
    eventRetentionDays: number;
  },
  context: z.RefinementCtx,
) {
  if (settings.eventRetentionDays < settings.rawIpRetentionDays) {
    context.addIssue({
      code: "custom",
      path: ["eventRetentionDays"],
      message: "eventRetentionDays must be greater than or equal to rawIpRetentionDays",
    });
  }
}

export function isTrackingV2EventType(value: string): value is TrackingV2EventType {
  return trackingV2EventTypes.includes(value as TrackingV2EventType);
}

export function isTrackingV2BrowserEventType(value: string): value is TrackingV2BrowserEventType {
  return trackingV2BrowserEventTypes.includes(value as TrackingV2BrowserEventType);
}

export function sanitizeTrackingV2Url(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";

    const sanitized = url.toString();
    return sanitized.length > TRACKING_V2_MAX_URL_LENGTH ? null : sanitized;
  } catch {
    return null;
  }
}

export function extractTrackingV2ReferrerHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host.length > TRACKING_V2_MAX_REFERRER_HOST_LENGTH ? null : host;
  } catch {
    return null;
  }
}

export function sanitizeTrackingV2Path(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }

  try {
    const url = value.startsWith("/") ? new URL(value, "https://lightsite.local") : new URL(value);
    const path = `${url.pathname || "/"}`;
    return path.length > TRACKING_V2_MAX_PATH_LENGTH ? "/" : path;
  } catch {
    return "/";
  }
}

export function truncateTrackingV2Label(
  value: string | null | undefined,
  fallback = "Untitled element",
): string {
  const label = value?.trim() || fallback;
  return label.length > TRACKING_V2_MAX_LABEL_LENGTH ? label.slice(0, TRACKING_V2_MAX_LABEL_LENGTH) : label;
}
