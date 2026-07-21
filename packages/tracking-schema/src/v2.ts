import { z } from "zod";

export const TRACKING_V2_SCRIPT_VERSION = "2026-07-21.v10" as const;
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
export const TRACKING_V2_MAX_SESSION_DURATION_MS = 4 * 60 * 60_000;
export const TRACKING_V2_MAX_BATCH_EVENTS = 20;
export const TRACKING_V2_MAX_REQUEUED_EVENTS = 40;
export const TRACKING_V2_MAX_ID_LENGTH = 160;
export const TRACKING_V2_MAX_TOKEN_LENGTH = 2_048;
export const TRACKING_V2_MAX_LABEL_LENGTH = 180;
export const TRACKING_V2_MANIFEST_SCHEMA_VERSION = 1;
export const TRACKING_V2_MAX_MANIFEST_ELEMENTS = 500;
export const TRACKING_V2_MAX_MANIFEST_BYTES = 128 * 1024;
export const TRACKING_V2_MAX_EVENT_RETENTION_DAYS = 365;
export const TRACKING_V2_RECORDING_SCHEMA_VERSION = 4;
export const TRACKING_V2_REPLAY_TERMS_VERSION = "2026-07-13.1" as const;
export const TRACKING_V2_VISITOR_NOTICE_VERSION = 1;
export const TRACKING_V2_MAX_RECORDING_DURATION_MS = 10 * 60_000;
export const TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS = 5_000;
export const TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES = 96 * 1024;
export const TRACKING_V2_RECORDING_MAX_CHUNK_BYTES = 512 * 1024;
export const TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES = 60 * 1024;
export const TRACKING_V2_RECORDING_TERMINAL_RESERVE_BYTES = 1024;
export const TRACKING_V2_RECORDING_MAX_BYTES = 5 * 1024 * 1024;
export const TRACKING_V2_RECORDING_MAX_EVENTS = 20_000;
export const TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK = 500;
export const TRACKING_V2_RECORDING_DAILY_MAX_COUNT = 1_000;
export const TRACKING_V2_RECORDING_DAILY_MAX_COMPRESSED_BYTES = 1024 * 1024 * 1024;
export const TRACKING_V2_MAX_RECORDING_RETENTION_DAYS = 30;
export const TRACKING_V2_RECORDING_DISCLOSURE_TEXT =
  "Session replay captures visible page content and structure, clicks, cursor movement, scrolling, viewport changes, and timing. Typed form values are masked.";

export const trackingV2EventTypes = [
  "site_visit",
  "button_click",
  "link_click",
  "tab_switch",
  "slack_share",
  "webhook_send",
] as const;

export const trackingV2BrowserEventTypes = [
  "button_click",
  "link_click",
  "tab_switch",
] as const;

export const trackingV2ServerEventTypes = ["slack_share", "webhook_send"] as const;
export const trackingV2TrackingModes = ["off", "events", "events_and_replay"] as const;

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

export const trackingV2DestinationKinds = [
  "external_web",
  "email",
  "phone",
  "calendar",
  "download",
  "internal_tab",
  "other",
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

export const trackingV2SettingScopes = ["workspace", "site", "recipient"] as const;

export const trackingV2EventRegistry = {
  site_visit: {
    automationTriggerable: true,
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: false,
  },
  button_click: {
    automationTriggerable: true,
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  link_click: {
    automationTriggerable: true,
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  tab_switch: {
    automationTriggerable: true,
    source: "browser",
    sessionScoped: true,
    userVisible: true,
    requiresElement: true,
  },
  slack_share: {
    automationTriggerable: false,
    source: "slack_og_image",
    sessionScoped: false,
    userVisible: true,
    requiresElement: false,
  },
  webhook_send: {
    automationTriggerable: false,
    source: "webhook",
    sessionScoped: false,
    userVisible: true,
    requiresElement: false,
  },
} as const satisfies Record<
  TrackingV2EventType,
  {
    automationTriggerable: boolean;
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
export type TrackingV2DestinationKind = (typeof trackingV2DestinationKinds)[number];
export type TrackingV2EventSource = (typeof trackingV2EventSources)[number];
export type TrackingV2SessionEndReason = (typeof trackingV2SessionEndReasons)[number];
export type TrackingV2SettingScope = (typeof trackingV2SettingScopes)[number];
export type TrackingV2ManifestPage = z.infer<typeof trackingV2ManifestPageSchema>;
export type TrackingV2ManifestElement = z.infer<typeof trackingV2ManifestElementSchema>;
export type TrackingV2ManifestPayload = z.infer<typeof trackingV2ManifestPayloadSchema>;

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
export const trackingV2DestinationKindSchema = z.enum(trackingV2DestinationKinds);
export const trackingV2EventSourceSchema = z.enum(trackingV2EventSources);
export const trackingV2SessionEndReasonSchema = z.enum(trackingV2SessionEndReasons);
export const trackingV2SettingScopeSchema = z.enum(trackingV2SettingScopes);

export const trackingV2ClientEventIdSchema = idSchema;
export const trackingV2BatchIdSchema = idSchema;
export const trackingV2SessionIdSchema = idSchema;
export const trackingV2OpaqueTokenSchema = opaqueTokenSchema;
export const trackingV2IsoTimestampSchema = isoTimestampSchema;
export const trackingV2EntityIdSchema = uuidSchema;

export const trackingV2ManifestPageSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
  })
  .strict();

export const trackingV2ManifestElementSchema = z
  .object({
    id: idSchema,
    pageId: idSchema.nullable(),
    eventType: z.enum(["button_click", "link_click"]),
    kind: z.enum(["button", "sidebar_button", "sidebar_link", "image_card"]),
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    destinationKind: trackingV2DestinationKindSchema,
    destinationHost: z.string().trim().min(1).max(253).nullable(),
  })
  .strict();

export const trackingV2ManifestPayloadSchema = z
  .object({
    schemaVersion: z.literal(TRACKING_V2_MANIFEST_SCHEMA_VERSION),
    siteLabel: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    pages: z.array(trackingV2ManifestPageSchema).min(1),
    elements: z.array(trackingV2ManifestElementSchema).max(TRACKING_V2_MAX_MANIFEST_ELEMENTS),
  })
  .strict()
  .superRefine((manifest, context) => {
    const pageIds = new Set<string>();
    for (const [index, page] of manifest.pages.entries()) {
      if (pageIds.has(page.id)) {
        context.addIssue({ code: "custom", path: ["pages", index, "id"], message: "Page IDs must be unique" });
      }
      pageIds.add(page.id);
    }

    const elementIds = new Set<string>();
    for (const [index, element] of manifest.elements.entries()) {
      if (elementIds.has(element.id)) {
        context.addIssue({ code: "custom", path: ["elements", index, "id"], message: "Element IDs must be unique" });
      }
      elementIds.add(element.id);

      if (element.pageId && !pageIds.has(element.pageId)) {
        context.addIssue({ code: "custom", path: ["elements", index, "pageId"], message: "Element pageId must exist" });
      }

      const expectedType = element.kind === "sidebar_link" ? "link_click" : "button_click";
      if (element.eventType !== expectedType) {
        context.addIssue({ code: "custom", path: ["elements", index, "eventType"], message: "Element event type does not match kind" });
      }
    }
  });

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
  "truncated",
  "failed",
  "expired",
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
  eventRetentionDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
  recordingEnabled: z.boolean(),
  recordingRetentionDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  maxRecordingDurationSeconds: z.number().int().min(60).max(TRACKING_V2_MAX_RECORDING_DURATION_MS / 1000),
} as const;

export const trackingV2TrackingSettingsSchema = z
  .object(trackingV2TrackingSettingsShape)
  .strict();

export const trackingV2UpdateSiteSettingsRequestSchema = z
  .object({
    ...trackingV2TrackingSettingsShape,
    recordingDisclosureAccepted: z.boolean().optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    if (settings.recordingEnabled && !settings.enabled) {
      context.addIssue({
        code: "custom",
        path: ["enabled"],
        message: "Activity tracking must be enabled when recording is enabled",
      });
    }
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
    termsVersion: z.literal(TRACKING_V2_REPLAY_TERMS_VERSION),
    text: z.literal(TRACKING_V2_RECORDING_DISCLOSURE_TEXT),
    acceptedAt: trackingV2IsoTimestampSchema.nullable(),
  })
  .strict();

export const trackingV2SiteTrackingSettingsResponseSchema = z
  .object({
    site: trackingV2SiteSummarySchema,
    scope: z.literal("site"),
    workspaceDefault: trackingV2TrackingSettingsSchema,
    siteOverride: trackingV2TrackingSettingsSchema.nullable(),
    effective: trackingV2TrackingSettingsSchema,
    recordingAvailable: z.boolean(),
    recordingDisclosure: trackingV2RecordingDisclosureSchema,
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2InternalIpRangeSchema = z
  .object({
    id: uuidSchema,
    label: z.string().trim().min(1).max(160),
    cidr: z.string().trim().min(3).max(49),
    enabled: z.boolean(),
    createdAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export const trackingV2InternalIpRangesResponseSchema = z
  .object({
    ranges: z.array(trackingV2InternalIpRangeSchema).max(100),
    requestId: z.string().trim().min(1),
  })
  .strict();

export const trackingV2CreateInternalIpRangeRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    cidr: z.string().trim().min(3).max(49).regex(/^[0-9A-Fa-f:.]+(?:\/\d{1,3})?$/),
  })
  .strict();

export const trackingV2EventElementSummarySchema = z
  .object({
    kind: trackingV2ElementKindSchema,
    id: z.string().trim().min(1).max(TRACKING_V2_MAX_ID_LENGTH).nullable(),
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    destinationKind: trackingV2DestinationKindSchema.nullable(),
    destinationHost: z.string().trim().min(1).max(253).nullable(),
  })
  .strict();

export const trackingV2EventTabSummarySchema = z
  .object({
    id: z.string().trim().min(1).max(TRACKING_V2_MAX_ID_LENGTH),
    label: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH),
    fromId: z.string().trim().min(1).max(TRACKING_V2_MAX_ID_LENGTH).nullable(),
    fromLabel: z.string().trim().min(1).max(TRACKING_V2_MAX_LABEL_LENGTH).nullable(),
  })
  .strict();

export const trackingV2EventWebhookSummarySchema = z
  .object({
    id: uuidSchema,
    endpointHost: z.string().trim().min(1).max(253),
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

export const trackingV2SessionSummarySchema = z
  .object({
    id: trackingV2SessionIdSchema,
    site: trackingV2SiteSummarySchema,
    recipient: trackingV2RecipientSummarySchema.nullable(),
    state: trackingV2SessionStateSchema,
    device: trackingV2DeviceSummarySchema,
    location: trackingV2LocationSummarySchema,
    initialPage: trackingV2ManifestPageSchema,
    startedAt: trackingV2IsoTimestampSchema,
    lastSeenAt: trackingV2IsoTimestampSchema,
    endedAt: trackingV2IsoTimestampSchema.nullable(),
    endReason: trackingV2SessionEndReasonSchema.nullable(),
    activeMs: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().nullable(),
    recording: z
      .object({
        status: trackingV2ReadRecordingStatusSchema,
        available: z.boolean(),
        durationMs: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();

export const trackingV2RecordingManifestChunkSchema = z
  .object({
    sequence: z.number().int().nonnegative().max(10_000),
    eventCount: z.number().int().positive().max(TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK),
    compressedBytes: z.number().int().positive().max(TRACKING_V2_RECORDING_MAX_CHUNK_BYTES),
    checksumSha256: z.string().trim().regex(/^[a-f0-9]{64}$/),
    firstEventAt: trackingV2IsoTimestampSchema,
    lastEventAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export const trackingV2RecordingManifestResponseSchema = z
  .object({
    recordingId: uuidSchema,
    sessionId: trackingV2SessionIdSchema,
    status: trackingV2ReadRecordingStatusSchema,
    startedAt: trackingV2IsoTimestampSchema,
    endedAt: trackingV2IsoTimestampSchema.nullable(),
    durationMs: z.number().int().nonnegative().max(TRACKING_V2_MAX_RECORDING_DURATION_MS),
    eventCount: z.number().int().nonnegative().max(TRACKING_V2_RECORDING_MAX_EVENTS),
    chunkCount: z.number().int().nonnegative(),
    compressedBytes: z.number().int().nonnegative().max(
      TRACKING_V2_RECORDING_MAX_BYTES + TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
    ),
    maxDurationMs: z.number().int().positive().max(TRACKING_V2_MAX_RECORDING_DURATION_MS),
    chunks: z.array(trackingV2RecordingManifestChunkSchema).max(10_001),
    requestId: z.string().trim().min(1),
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

const trackingV2ClientEventBaseSchema = z
  .object({
    eventId: trackingV2ClientEventIdSchema,
    occurredAt: trackingV2IsoTimestampSchema,
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const trackingV2ButtonClickEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("button_click"),
    elementId: idSchema,
    pageId: idSchema,
  })
  .strict();

export const trackingV2LinkClickEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("link_click"),
    elementId: idSchema,
    pageId: idSchema,
  })
  .strict();

export const trackingV2TabSwitchEventSchema = trackingV2ClientEventBaseSchema
  .extend({
    type: z.literal("tab_switch"),
    fromPageId: idSchema,
    toPageId: idSchema,
    trigger: z.enum(["click", "keyboard"]),
  })
  .strict();

export const trackingV2BrowserEventSchema = z.discriminatedUnion("type", [
  trackingV2ButtonClickEventSchema,
  trackingV2LinkClickEventSchema,
  trackingV2TabSwitchEventSchema,
]);

export const trackingV2SessionStartRequestSchema = z
  .object({
    contextToken: trackingV2OpaqueTokenSchema,
    requestId: trackingV2ClientEventIdSchema,
    startedAt: trackingV2IsoTimestampSchema,
    initialPageId: idSchema,
    replayConsent: z
      .object({
        noticeVersion: z.literal(TRACKING_V2_VISITOR_NOTICE_VERSION),
        grantedAt: trackingV2IsoTimestampSchema,
        source: z.enum(["prompt", "remembered"]),
      })
      .strict()
      .optional(),
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
    chunkEndpoint: z.string().trim().min(1).max(500),
    completeEndpoint: z.string().trim().min(1).max(500),
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
    recording: trackingV2RecordingDisabledConfigSchema,
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

export const trackingV2EventBatchResponseSchema = z
  .object({
    accepted: z.number().int().nonnegative().max(TRACKING_V2_MAX_BATCH_EVENTS),
    rejected: z.number().int().nonnegative().max(TRACKING_V2_MAX_BATCH_EVENTS),
  })
  .strict();

export const trackingV2SessionHeartbeatSchema = z
  .object({
    sessionId: trackingV2SessionIdSchema,
    eventToken: trackingV2OpaqueTokenSchema,
    occurredAt: trackingV2IsoTimestampSchema,
    activeMs: z.number().int().nonnegative().max(TRACKING_V2_MAX_SESSION_DURATION_MS),
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

export const trackingV2RecordingSequenceSchema = z.number().int().nonnegative().max(10_000);

export const trackingV2RecordingChunkSchema = z
  .object({
    schemaVersion: z.literal(TRACKING_V2_RECORDING_SCHEMA_VERSION),
    sessionId: trackingV2SessionIdSchema,
    sequence: trackingV2RecordingSequenceSchema,
    events: z.array(trackingV2RrwebEventSchema).min(1).max(TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK),
  })
  .strict();

export const trackingV2RecordingCompleteSchema = z
  .object({
    schemaVersion: z.literal(TRACKING_V2_RECORDING_SCHEMA_VERSION),
    sessionId: trackingV2SessionIdSchema,
    finalSequence: trackingV2RecordingSequenceSchema.nullable(),
    endedAt: trackingV2IsoTimestampSchema,
    stopReason: z.enum([
      "pagehide",
      "consent_withdrawn",
      "hidden_timeout",
      "duration_cap",
      "size_cap",
      "event_cap",
      "daily_cap",
      "error",
    ]),
  })
  .strict();

export const trackingV2RecordingTerminalSchema = trackingV2RecordingCompleteSchema
  .omit({ schemaVersion: true, sessionId: true });

export const trackingV2RecordingUploadSchema = trackingV2RecordingChunkSchema
  .extend({
    completion: trackingV2RecordingTerminalSchema.optional(),
  })
  .strict()
  .superRefine((upload, context) => {
    if (upload.completion && upload.completion.finalSequence !== upload.sequence) {
      context.addIssue({
        code: "custom",
        path: ["completion", "finalSequence"],
        message: "Terminal recording metadata must reference the uploaded chunk sequence",
      });
    }
  });

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
    endpointHost: z.string().trim().min(1).max(253),
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
    manifestId: uuidSchema,
    recipientId: uuidSchema.nullable(),
    recipientRevision: z.number().int().nonnegative().nullable(),
    trackingMode: trackingV2TrackingModeSchema,
    issuedAt: trackingV2IsoTimestampSchema,
    expiresAt: trackingV2IsoTimestampSchema,
  })
  .strict();

export type TrackingV2ButtonClickEvent = z.infer<typeof trackingV2ButtonClickEventSchema>;
export type TrackingV2LinkClickEvent = z.infer<typeof trackingV2LinkClickEventSchema>;
export type TrackingV2TabSwitchEvent = z.infer<typeof trackingV2TabSwitchEventSchema>;
export type TrackingV2BrowserEvent = z.infer<typeof trackingV2BrowserEventSchema>;
export type TrackingV2SessionStartRequest = z.infer<typeof trackingV2SessionStartRequestSchema>;
export type TrackingV2SessionStartResponse = z.infer<typeof trackingV2SessionStartResponseSchema>;
export type TrackingV2EventBatch = z.infer<typeof trackingV2EventBatchSchema>;
export type TrackingV2EventBatchResponse = z.infer<typeof trackingV2EventBatchResponseSchema>;
export type TrackingV2SessionHeartbeat = z.infer<typeof trackingV2SessionHeartbeatSchema>;
export type TrackingV2SessionEnd = z.infer<typeof trackingV2SessionEndSchema>;
export type TrackingV2RecordingChunk = z.infer<typeof trackingV2RecordingChunkSchema>;
export type TrackingV2RecordingComplete = z.infer<typeof trackingV2RecordingCompleteSchema>;
export type TrackingV2RecordingUpload = z.infer<typeof trackingV2RecordingUploadSchema>;
export type TrackingV2ServerEventData = z.infer<typeof trackingV2ServerEventDataSchema>;
export type TrackingV2PublicBootstrap = z.infer<typeof trackingV2PublicBootstrapSchema>;
export type TrackingV2ContextTokenPayload = z.infer<typeof trackingV2ContextTokenPayloadSchema>;
export type TrackingV2SessionState = z.infer<typeof trackingV2SessionStateSchema>;
export type TrackingV2PublicContext = z.infer<typeof trackingV2PublicContextSchema>;
export type TrackingV2EventsQuery = z.infer<typeof trackingV2EventsQuerySchema>;
export type TrackingV2SessionsQuery = z.infer<typeof trackingV2SessionsQuerySchema>;
export type TrackingV2EventFeedItem = z.infer<typeof trackingV2EventFeedItemSchema>;
export type TrackingV2EventsResponse = z.infer<typeof trackingV2EventsResponseSchema>;
export type TrackingV2SessionSummary = z.infer<typeof trackingV2SessionSummarySchema>;
export type TrackingV2ReadRecordingStatus = z.infer<typeof trackingV2ReadRecordingStatusSchema>;
export type TrackingV2SessionRecordingStatusFilter = z.infer<typeof trackingV2SessionRecordingStatusFilterSchema>;
export type TrackingV2RecordingManifestResponse = z.infer<typeof trackingV2RecordingManifestResponseSchema>;
export type TrackingV2SessionsResponse = z.infer<typeof trackingV2SessionsResponseSchema>;
export type TrackingV2SessionResponse = z.infer<typeof trackingV2SessionResponseSchema>;
export type TrackingV2TrackingSettings = z.infer<typeof trackingV2TrackingSettingsSchema>;
export type TrackingV2UpdateSiteSettingsRequest = z.infer<typeof trackingV2UpdateSiteSettingsRequestSchema>;
export type TrackingV2SiteTrackingSettingsResponse = z.infer<typeof trackingV2SiteTrackingSettingsResponseSchema>;
export type TrackingV2InternalIpRange = z.infer<typeof trackingV2InternalIpRangeSchema>;
export type TrackingV2InternalIpRangesResponse = z.infer<typeof trackingV2InternalIpRangesResponseSchema>;
export type TrackingV2CreateInternalIpRangeRequest = z.infer<typeof trackingV2CreateInternalIpRangeRequestSchema>;

export function isTrackingV2EventType(value: string): value is TrackingV2EventType {
  return trackingV2EventTypes.includes(value as TrackingV2EventType);
}

export function isTrackingV2BrowserEventType(value: string): value is TrackingV2BrowserEventType {
  return trackingV2BrowserEventTypes.includes(value as TrackingV2BrowserEventType);
}


export function truncateTrackingV2Label(
  value: string | null | undefined,
  fallback = "Untitled element",
): string {
  const label = value?.trim() || fallback;
  return label.length > TRACKING_V2_MAX_LABEL_LENGTH ? label.slice(0, TRACKING_V2_MAX_LABEL_LENGTH) : label;
}
