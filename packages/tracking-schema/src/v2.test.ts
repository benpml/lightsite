import { describe, expect, it } from "vitest";

import {
  TRACKING_V2_MAX_BATCH_EVENTS,
  TRACKING_V2_MAX_SESSION_DURATION_MS,
  TRACKING_V2_SCRIPT_VERSION,
  isTrackingV2BrowserEventType,
  isTrackingV2EventType,
  trackingV2ContextTokenPayloadSchema,
  trackingV2CreateInternalIpRangeRequestSchema,
  trackingV2EventBatchSchema,
  trackingV2EventRegistry,
  trackingV2ManifestPayloadSchema,
  trackingV2PublicBootstrapSchema,
  trackingV2RecordingUploadSchema,
  trackingV2ServerEventDataSchema,
  trackingV2SiteTrackingSettingsResponseSchema,
  trackingV2SessionStartRequestSchema,
  trackingV2SessionStartResponseSchema,
  trackingV2UpdateSiteSettingsRequestSchema,
  type TrackingV2EventBatch,
  type TrackingV2SessionStartRequest,
} from "./index";

const now = "2026-07-12T12:00:00.000Z";

function validStartRequest(): TrackingV2SessionStartRequest {
  return {
    contextToken: "bootstrap_token_that_is_long_enough",
    requestId: "request_abc123",
    startedAt: now,
    initialPageId: "page-overview",
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
        eventId: "event_button_1",
        type: "button_click",
        occurredAt: now,
        sequence: 1,
        elementId: "cta-primary",
        pageId: "page-overview",
      },
      {
        eventId: "event_link_1",
        type: "link_click",
        occurredAt: now,
        sequence: 2,
        elementId: "proposal-link",
        pageId: "page-overview",
      },
      {
        eventId: "event_tab_1",
        type: "tab_switch",
        occurredAt: now,
        sequence: 3,
        fromPageId: "page-overview",
        toPageId: "page-pricing",
        trigger: "click",
      },
    ],
    ...overrides,
  };
}

describe("tracking v2 browser contract", () => {
  it("accepts only modeled IDs and event mechanics", () => {
    expect(trackingV2SessionStartRequestSchema.safeParse(validStartRequest()).success).toBe(true);
    expect(trackingV2EventBatchSchema.safeParse(validBatch()).success).toBe(true);
  });

  it("rejects browser-owned labels, destinations, page paths, and device identity", () => {
    expect(trackingV2SessionStartRequestSchema.safeParse({
      ...validStartRequest(),
      page: { path: "/brief", title: "Private title" },
      device: { deviceId: "persistent-device", userAgent: "Browser" },
    }).success).toBe(false);

    expect(trackingV2EventBatchSchema.safeParse({
      ...validBatch(),
      events: [{
        eventId: "event_bad_1",
        type: "button_click",
        occurredAt: now,
        sequence: 1,
        elementId: "cta-primary",
        label: "Browser supplied",
        href: "https://example.com/private?token=secret",
      }],
    }).success).toBe(false);
  });

  it("rejects site visits and unknown interactions from the browser", () => {
    for (const type of ["site_visit", "calendar_click"]) {
      expect(trackingV2EventBatchSchema.safeParse({
        ...validBatch(),
        events: [{ eventId: `event_${type}`, type, occurredAt: now, sequence: 0 }],
      }).success).toBe(false);
    }
  });

  it("caps browser event batches", () => {
    const batch = validBatch({
      events: Array.from({ length: TRACKING_V2_MAX_BATCH_EVENTS + 1 }, (_, index) => ({
        eventId: `event_${index}`,
        type: "button_click" as const,
        occurredAt: now,
        sequence: index,
        elementId: "cta-primary",
        pageId: "page-overview",
      })),
    });

    expect(trackingV2EventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("accepts terminal replay metadata only on the matching final chunk", () => {
    const upload = {
      schemaVersion: 4,
      sessionId: "session_abc123",
      sequence: 2,
      events: [{ type: 2, timestamp: Date.parse(now), data: {} }],
      completion: {
        finalSequence: 2,
        endedAt: now,
        stopReason: "pagehide",
      },
    };

    expect(trackingV2RecordingUploadSchema.safeParse(upload).success).toBe(true);
    expect(trackingV2RecordingUploadSchema.safeParse({
      ...upload,
      completion: { ...upload.completion, finalSequence: 1 },
    }).success).toBe(false);
  });

  it("keeps public bootstrap opaque and manifest binding encrypted", () => {
    const bootstrap = trackingV2PublicBootstrapSchema.parse({
      version: 2,
      trackingMode: "events",
      contextToken: "bootstrap_token_that_is_long_enough",
      issuedAt: now,
      expiresAt: "2026-07-13T12:00:00.000Z",
    });
    expect(Object.keys(bootstrap)).not.toContain("manifestId");

    expect(trackingV2ContextTokenPayloadSchema.safeParse({
      version: 2,
      keyId: "default",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 3,
      trackingMode: "events",
      issuedAt: now,
      expiresAt: "2026-07-13T12:00:00.000Z",
    }).success).toBe(true);
  });

  it("returns an event-only session configuration", () => {
    const parsed = trackingV2SessionStartResponseSchema.parse({
      accepted: true,
      eventsAccepted: true,
      recordingAccepted: false,
      sessionId: "session_abc123",
      eventToken: "event_token_that_is_long_enough",
      scriptVersion: TRACKING_V2_SCRIPT_VERSION,
      heartbeatIntervalMs: 15_000,
      idleTimeoutMs: 120_000,
      maxSessionDurationMs: TRACKING_V2_MAX_SESSION_DURATION_MS,
      recording: { enabled: false, maxDurationMs: 600_000 },
    });

    expect(parsed.accepted).toBe(true);
    expect(parsed.recording).toEqual({ enabled: false, maxDurationMs: 600_000 });
  });
});

describe("tracking v2 server-owned data", () => {
  it("validates compact manifests and rejects duplicate IDs", () => {
    const manifest = {
      schemaVersion: 1,
      siteLabel: "Recipient brief",
      pages: [{ id: "page-overview", label: "Overview" }],
      elements: [{
        id: "cta-primary",
        pageId: "page-overview",
        eventType: "button_click",
        kind: "button",
        label: "Book a demo",
        destinationKind: "external_web",
        destinationHost: "calendar.example",
      }],
    };

    expect(trackingV2ManifestPayloadSchema.safeParse(manifest).success).toBe(true);
    expect(trackingV2ManifestPayloadSchema.safeParse({
      ...manifest,
      elements: [manifest.elements[0], manifest.elements[0]],
    }).success).toBe(false);
  });

  it("keeps settings bounded to approved retention choices", () => {
    const settings = {
      enabled: true,
      eventRetentionDays: 90 as const,
      recordingEnabled: false,
      recordingRetentionDays: 14 as const,
      maxRecordingDurationSeconds: 600,
    };
    expect(trackingV2UpdateSiteSettingsRequestSchema.safeParse(settings).success).toBe(true);
    expect(trackingV2UpdateSiteSettingsRequestSchema.safeParse({ ...settings, eventRetentionDays: 7 }).success).toBe(false);
    expect(trackingV2UpdateSiteSettingsRequestSchema.safeParse({
      ...settings,
      enabled: false,
      recordingEnabled: true,
      recordingDisclosureAccepted: true,
    }).success).toBe(false);

    const response = trackingV2SiteTrackingSettingsResponseSchema.parse({
      site: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Recipient Site",
        slug: "recipient-site",
      },
      scope: "site",
      workspaceDefault: settings,
      siteOverride: null,
      effective: settings,
      recordingAvailable: false,
      recordingDisclosure: {
        required: true,
        termsVersion: "2026-07-13.1",
        text: "Session replay captures visible page content and structure, clicks, cursor movement, scrolling, viewport changes, and timing. Typed form values are masked.",
        acceptedAt: null,
      },
      requestId: "request_abc123",
    });
    expect(response.effective).toEqual(settings);
  });

  it("accepts only compact IP address or CIDR management input", () => {
    expect(trackingV2CreateInternalIpRangeRequestSchema.safeParse({ label: "Office", cidr: "203.0.113.0/24" }).success).toBe(true);
    expect(trackingV2CreateInternalIpRangeRequestSchema.safeParse({ label: "VPN", cidr: "2001:db8::/48" }).success).toBe(true);
    expect(trackingV2CreateInternalIpRangeRequestSchema.safeParse({ label: "Bad", cidr: "office.example/24" }).success).toBe(false);
  });

  it("stores Slack preview and webhook host data without full destinations", () => {
    expect(trackingV2ServerEventDataSchema.safeParse({
      type: "slack_share",
      data: {
        platform: "slack",
        resource: "og_image",
        userAgentFamily: "slackbot",
        imageCacheKey: "og-image-cache-key",
      },
    }).success).toBe(true);

    expect(trackingV2ServerEventDataSchema.safeParse({
      type: "webhook_send",
      data: {
        webhookId: "55555555-5555-4555-8555-555555555555",
        endpointHost: "hooks.example",
      },
    }).success).toBe(true);
  });

  it("keeps the registry and type helpers explicit", () => {
    expect(trackingV2EventRegistry.site_visit.sessionScoped).toBe(true);
    expect(trackingV2EventRegistry.slack_share.sessionScoped).toBe(false);
    expect(trackingV2EventRegistry.site_visit.automationTriggerable).toBe(true);
    expect(trackingV2EventRegistry.webhook_send.automationTriggerable).toBe(false);
    expect(isTrackingV2EventType("button_click")).toBe(true);
    expect(isTrackingV2EventType("heartbeat")).toBe(false);
    expect(isTrackingV2BrowserEventType("site_visit")).toBe(false);
    expect(isTrackingV2BrowserEventType("slack_share")).toBe(false);
  });
});
