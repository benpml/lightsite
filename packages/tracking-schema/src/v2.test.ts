import { describe, expect, it } from "vitest";
import {
  TRACKING_V2_MAX_BATCH_EVENTS,
  TRACKING_V2_MAX_RECORDING_DURATION_MS,
  TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
  TRACKING_V2_SCRIPT_VERSION,
  extractTrackingV2ReferrerHost,
  isTrackingV2BrowserEventType,
  isTrackingV2EventType,
  sanitizeTrackingV2Path,
  sanitizeTrackingV2Url,
  trackingV2EventBatchSchema,
  trackingV2EventRegistry,
  trackingV2PublicBootstrapSchema,
  trackingV2RecordingChunkSchema,
  trackingV2RecordingManifestResponseSchema,
  trackingV2ServerEventDataSchema,
  trackingV2SiteTrackingSettingsResponseSchema,
  trackingV2SessionStartRequestSchema,
  trackingV2SessionStartResponseSchema,
  trackingV2UpdateSiteSettingsRequestSchema,
  truncateTrackingV2Label,
  type TrackingV2EventBatch,
  type TrackingV2SessionStartRequest,
} from "./index";

const now = "2026-07-09T12:00:00.000Z";

function validStartRequest(): TrackingV2SessionStartRequest {
  return {
    contextToken: "bootstrap_token_that_is_long_enough",
    startedAt: now,
    page: {
      path: "/brief",
      title: "Recipient brief",
      referrerHost: "example.com",
    },
    viewport: {
      width: 1440,
      height: 900,
    },
    device: {
      deviceId: "device_abc123",
      timezone: "America/New_York",
      locale: "en-US",
      userAgent: "Mozilla/5.0",
    },
  };
}

function validBatch(overrides: Partial<TrackingV2EventBatch> = {}): TrackingV2EventBatch {
  return {
    batchId: "batch_abc123",
    sessionId: "session_abc123",
    eventToken: "event_token_that_is_long_enough",
    scriptVersion: TRACKING_V2_SCRIPT_VERSION,
    sentAt: now,
    events: [
      {
        eventId: "event_visit_1",
        type: "site_visit",
        occurredAt: now,
        sequence: 0,
        page: {
          path: "/brief",
          title: "Recipient brief",
          referrerHost: null,
        },
        viewport: {
          width: 1440,
          height: 900,
        },
      },
      {
        eventId: "event_button_1",
        type: "button_click",
        occurredAt: now,
        sequence: 1,
        element: {
          kind: "button",
          id: "cta-primary",
          label: "Book a demo",
        },
      },
      {
        eventId: "event_link_1",
        type: "link_click",
        occurredAt: now,
        sequence: 2,
        element: {
          kind: "sidebar_link",
          id: "proposal",
          label: "Proposal",
          href: "https://example.com/proposal",
        },
      },
      {
        eventId: "event_tab_1",
        type: "tab_switch",
        occurredAt: now,
        sequence: 3,
        element: {
          kind: "tab",
          id: "pricing",
          label: "Pricing",
        },
        fromTabLabel: "Overview",
      },
    ],
    ...overrides,
  };
}

describe("tracking v2 contract", () => {
  it("accepts the first-phase browser event set", () => {
    const result = trackingV2EventBatchSchema.safeParse(validBatch());

    expect(result.success).toBe(true);
  });

  it("rejects unknown browser event types", () => {
    const batch = validBatch({
      events: [
        {
          eventId: "event_bad_1",
          type: "calendar_click",
          occurredAt: now,
          sequence: 0,
        } as never,
      ],
    });

    expect(trackingV2EventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("caps browser event batches", () => {
    const batch = validBatch({
      events: Array.from({ length: TRACKING_V2_MAX_BATCH_EVENTS + 1 }, (_, index) => ({
        eventId: `event_${index}`,
        type: "site_visit" as const,
        occurredAt: now,
        sequence: index,
      })),
    });

    expect(trackingV2EventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("keeps public session bootstrap opaque", () => {
    const result = trackingV2SessionStartRequestSchema.safeParse({
      ...validStartRequest(),
      workspaceId: "8b748b97-9aef-4f72-aa62-c7bfe4b31154",
    });

    expect(result.success).toBe(false);
  });

  it("returns recording disabled by contract in phase one", () => {
    expect(
      trackingV2SessionStartResponseSchema.parse({
        accepted: true,
        eventsAccepted: true,
        recordingAccepted: false,
        sessionId: "session_abc123",
        eventToken: "event_token_that_is_long_enough",
        scriptVersion: TRACKING_V2_SCRIPT_VERSION,
        heartbeatIntervalMs: 15_000,
        idleTimeoutMs: 120_000,
        maxSessionDurationMs: 3_600_000,
        recording: {
          enabled: false,
          maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS,
        },
      }).recording.enabled,
    ).toBe(false);
  });

  it("exposes a public bootstrap without site or recipient ids", () => {
    const parsed = trackingV2PublicBootstrapSchema.parse({
      version: 2,
      trackingMode: "events",
      contextToken: "bootstrap_token_that_is_long_enough",
      issuedAt: now,
      expiresAt: "2026-07-10T12:00:00.000Z",
    });

    expect(Object.keys(parsed)).not.toContain("workspaceId");
    expect(Object.keys(parsed)).not.toContain("siteId");
    expect(Object.keys(parsed)).not.toContain("recipientId");
  });

  it("accepts the authenticated recording manifest and chunk envelopes", () => {
    expect(
      trackingV2RecordingManifestResponseSchema.parse({
        recordingId: "44444444-4444-4444-8444-444444444444",
        sessionId: "session_abc123",
        status: "available",
        startedAt: now,
        endedAt: "2026-07-09T12:01:00.000Z",
        durationMs: 60_000,
        eventCount: 2,
        chunkCount: 1,
        compressedBytes: 512,
        maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS,
        chunks: [
          {
            sequence: 0,
            eventCount: 2,
            compressedBytes: 512,
            checksumSha256: "a".repeat(64),
            firstEventAt: now,
            lastEventAt: "2026-07-09T12:00:02.000Z",
          },
        ],
        requestId: "request_abc123",
      }).chunks[0]?.sequence,
    ).toBe(0);

    expect(
      trackingV2RecordingChunkSchema.parse({
        schemaVersion: 3,
        sessionId: "session_abc123",
        sequence: 0,
        events: [
          {
            type: 2,
            timestamp: Date.parse(now),
            data: {},
          },
        ],
        compressed: false,
      }).sequence,
    ).toBe(0);
  });

  it("keeps the registry explicit about session scope", () => {
    expect(trackingV2EventRegistry.site_visit.sessionScoped).toBe(true);
    expect(trackingV2EventRegistry.slack_share.sessionScoped).toBe(false);
    expect(trackingV2EventRegistry.webhook_send.sessionScoped).toBe(false);
  });

  it("requires recording disclosure acknowledgement when enabling site settings", () => {
    const request = {
      enabled: true,
      captureIpAddress: true,
      rawIpRetentionDays: 30,
      eventRetentionDays: 365,
      recordingEnabled: true,
      recordingRetentionDays: 30,
      maxRecordingDurationSeconds: 600,
    };

    expect(trackingV2UpdateSiteSettingsRequestSchema.safeParse(request).success).toBe(false);
    expect(
      trackingV2UpdateSiteSettingsRequestSchema.parse({
        ...request,
        recordingDisclosureAccepted: true,
      }).recordingEnabled,
    ).toBe(true);
  });

  it("keeps settings retention and duration limits bounded", () => {
    expect(
      trackingV2UpdateSiteSettingsRequestSchema.safeParse({
        enabled: true,
        captureIpAddress: true,
        rawIpRetentionDays: 30,
        eventRetentionDays: 7,
        recordingEnabled: false,
        recordingRetentionDays: 30,
        maxRecordingDurationSeconds: 600,
      }).success,
    ).toBe(false);

    expect(
      trackingV2UpdateSiteSettingsRequestSchema.safeParse({
        enabled: true,
        captureIpAddress: true,
        rawIpRetentionDays: 30,
        eventRetentionDays: 365,
        recordingEnabled: false,
        recordingRetentionDays: 30,
        maxRecordingDurationSeconds: 601,
      }).success,
    ).toBe(false);
  });

  it("accepts authenticated site settings responses", () => {
    const settings = {
      enabled: true,
      captureIpAddress: true,
      rawIpRetentionDays: 30,
      eventRetentionDays: 365,
      recordingEnabled: false,
      recordingRetentionDays: 30,
      maxRecordingDurationSeconds: 600,
    };

    expect(
      trackingV2SiteTrackingSettingsResponseSchema.parse({
        site: {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Recipient Site",
          slug: "recipient-site",
        },
        scope: "site",
        workspaceDefault: settings,
        siteOverride: null,
        effective: settings,
        recordingDisclosure: {
          required: true,
          text: TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
        },
        requestId: "request_abc123",
      }).effective.recordingEnabled,
    ).toBe(false);
  });

  it("accepts the stored Slack share server-event data shape", () => {
    const result = trackingV2ServerEventDataSchema.safeParse({
      type: "slack_share",
      data: {
        platform: "slack",
        resource: "og_image",
        userAgentFamily: "slackbot",
        imageCacheKey: "og-image-cache-key",
      },
    });

    expect(result.success).toBe(true);
  });

  it("checks event type helpers", () => {
    expect(isTrackingV2EventType("button_click")).toBe(true);
    expect(isTrackingV2EventType("heartbeat")).toBe(false);
    expect(isTrackingV2BrowserEventType("slack_share")).toBe(false);
  });
});

describe("tracking v2 sanitizers", () => {
  it("removes credentials, queries, and hashes from URLs", () => {
    expect(sanitizeTrackingV2Url("https://user:pass@example.com/path?token=secret#frag")).toBe(
      "https://example.com/path",
    );
  });

  it("rejects non-http URLs", () => {
    expect(sanitizeTrackingV2Url("javascript:alert(1)")).toBeNull();
  });

  it("keeps only the path for page locations", () => {
    expect(sanitizeTrackingV2Path("https://example.com/brief?token=secret#pricing")).toBe("/brief");
    expect(sanitizeTrackingV2Path("/brief?token=secret#pricing")).toBe("/brief");
  });

  it("normalizes referrer hosts", () => {
    expect(extractTrackingV2ReferrerHost("https://Workspace.Slack.com/archives/C123?secret=value")).toBe(
      "workspace.slack.com",
    );
  });

  it("truncates labels with a stable fallback", () => {
    expect(truncateTrackingV2Label("   ")).toBe("Untitled element");
    expect(truncateTrackingV2Label("a".repeat(200))).toHaveLength(180);
  });
});
