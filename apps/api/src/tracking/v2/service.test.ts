import { describe, expect, it } from "vitest";
import { createDefaultSiteContent, PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION, type PublishedSitePayload } from "@handout/site-document";
import {
  TRACKING_V2_SCRIPT_VERSION,
  type TrackingV2ContextTokenPayload,
  type TrackingV2EventBatch,
} from "@handout/tracking-schema";
import {
  createMemoryTrackingV2Repository,
  type TrackingV2ManifestRecord,
  type TrackingV2ResolvedContext,
} from "./repository";
import { createTrackingV2Service, TrackingV2InvalidIpRangeError } from "./service";
import type { TrackingV2RecordingService } from "./recording-service";
import {
  createMemoryTrackingSuppressionRepository,
  createTrackingSuppressionService,
} from "./suppression";

const now = new Date("2026-07-12T12:00:00.000Z");
const tokenSecret = "tracking-v2-test-secret-that-is-long-enough";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const publishedVersionId = "33333333-3333-4333-8333-333333333333";
const recipientId = "44444444-4444-4444-8444-444444444444";
const manifestId = "55555555-5555-4555-8555-555555555555";

const manifest: TrackingV2ManifestRecord = {
  id: manifestId,
  workspaceId,
  siteId,
  publishedVersionId,
  recipientId,
  recipientRevision: 3,
  schemaVersion: 1,
  sourceHash: "a".repeat(64),
  payload: {
    schemaVersion: 1,
    siteLabel: "Taylor proposal",
    pages: [
      { id: "page-overview", label: "Overview" },
      { id: "page-pricing", label: "Pricing" },
    ],
    elements: [
      {
        id: "button-book-demo",
        pageId: "page-overview",
        eventType: "button_click",
        kind: "button",
        label: "Book a demo",
        destinationKind: "external_web",
        destinationHost: "calendar.example",
      },
      {
        id: "sidebar-proposal-link",
        pageId: null,
        eventType: "link_click",
        kind: "sidebar_link",
        label: "Proposal",
        destinationKind: "external_web",
        destinationHost: "example.com",
      },
    ],
  },
  createdAt: now,
};

const resolvedContext: TrackingV2ResolvedContext = {
  workspaceId,
  siteId,
  publishedVersionId,
  manifestId,
  recipientId,
  recipientRevision: 3,
  workspaceStatus: "active",
  workspacePlan: "pro",
  siteStatus: "published",
  recipientStatus: "active",
};

const context: TrackingV2ContextTokenPayload = {
  version: 2,
  keyId: "default",
  workspaceId,
  siteId,
  publishedVersionId,
  manifestId,
  recipientId,
  recipientRevision: 3,
  trackingMode: "events",
  issuedAt: "2026-07-12T11:00:00.000Z",
  expiresAt: "2026-07-13T11:00:00.000Z",
};

function harness(input: { internalRange?: boolean; enabled?: boolean; replay?: boolean } = {}) {
  const repository = createMemoryTrackingV2Repository({
    contexts: [resolvedContext],
    manifests: [manifest],
    settings: input.enabled === undefined && !input.replay ? [] : [{
      workspaceId,
      siteId,
      recipientId: null,
      scope: "site",
      enabled: input.enabled ?? true,
      eventRetentionDays: 90,
      ...(input.replay ? {
        recordingEnabled: true,
        recordingRetentionDays: 14 as const,
        maxRecordingDurationSeconds: 600,
        recordingTermsVersion: "2026-07-13.1",
        recordingTermsAcceptedAt: now,
        recordingTermsAcceptedByUserId: "user-admin",
      } : {}),
    }],
  });
  const suppressionRepository = createMemoryTrackingSuppressionRepository({
    ranges: input.internalRange ? [{
      id: "66666666-6666-4666-8666-666666666666",
      workspaceId,
      label: "Office",
      ipRange: "203.0.113.8",
    }] : [],
  });
  const service = createTrackingV2Service({
    repository,
    suppressionService: createTrackingSuppressionService({ repository: suppressionRepository }),
    tokenSecret,
    recordingService: input.replay ? {} as TrackingV2RecordingService : undefined,
    now: () => now,
  });
  return { repository, service };
}

async function start(service: ReturnType<typeof harness>["service"], ipAddress = "203.0.113.9") {
  return service.startSession({
    context,
    request: {
      contextToken: "opaque_context_token_long_enough",
      requestId: "request-session-one",
      startedAt: now.toISOString(),
      initialPageId: "page-overview",
    },
    requestSnapshot: {
      ipAddress,
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit Chrome/140.0 Safari/537.36",
      city: " Tampa ",
      region: "FL",
      countryCode: "us",
    },
  });
}

describe("tracking v2 service", () => {
  it("issues replay context for either consent popup without customer policy configuration", async () => {
    const { service } = harness({ replay: true });
    const payload = publicPayload();

    await expect(service.preparePublicContext(payload)).resolves.toMatchObject({ trackingMode: "events_and_replay" });

    payload.content.settings.trackingConsentPopup = "popup-a";
    await expect(service.preparePublicContext(payload)).resolves.toMatchObject({ trackingMode: "events_and_replay" });

    payload.content.settings.trackingConsentPopup = "popup-b";
    payload.content.settings.trackingPrivacyPolicyUrl = "";
    await expect(service.preparePublicContext(payload)).resolves.toMatchObject({ trackingMode: "events_and_replay" });
  });

  it("creates an idempotent event-only session without persisting IP or device identity", async () => {
    const { repository, service } = harness();
    const first = await start(service);
    const second = await start(service);

    expect(first).toEqual(second);
    expect(first.accepted).toBe(true);
    expect(repository.sessions).toHaveLength(1);
    expect(repository.events.filter((event) => event.type === "site_visit")).toHaveLength(1);
    expect(repository.createSessionInputs[0]).toMatchObject({
      city: "Tampa",
      region: "FL",
      countryCode: "US",
      deviceType: "desktop",
      osName: "macOS",
      browserName: "Chrome",
      initialPageId: "page-overview",
      initialPageLabel: "Overview",
    });
    expect(repository.createSessionInputs[0]).not.toHaveProperty("ipAddress");
    expect(repository.createSessionInputs[0]).not.toHaveProperty("deviceId");
    expect(repository.createSessionInputs[0]).not.toHaveProperty("userAgent");
    expect(repository.createSessionInputs[0]).not.toHaveProperty("path");
  });

  it("suppresses configured internal networks and disabled sites before creating a session", async () => {
    const internal = harness({ internalRange: true });
    expect(await start(internal.service, "203.0.113.8")).toMatchObject({ accepted: false, reason: "suppressed" });
    expect(internal.repository.sessions.size).toBe(0);

    const disabled = harness({ enabled: false });
    expect(await start(disabled.service)).toMatchObject({ accepted: false, reason: "disabled" });
    expect(disabled.repository.sessions.size).toBe(0);
  });

  it("normalizes, deduplicates, lists, and removes internal network controls", async () => {
    const { service } = harness();
    const created = await service.createInternalIpRange({
      workspaceId,
      userId: "user-admin",
      range: { label: "Office", cidr: "203.0.113.8" },
    });
    expect(created).toMatchObject({ label: "Office", cidr: "203.0.113.8/32", enabled: true });

    const updated = await service.createInternalIpRange({
      workspaceId,
      userId: "user-admin",
      range: { label: "Main office", cidr: "203.0.113.8/32" },
    });
    expect(updated.id).toBe(created.id);
    await expect(service.listInternalIpRanges(workspaceId)).resolves.toEqual([
      expect.objectContaining({ id: created.id, label: "Main office" }),
    ]);
    await expect(service.createInternalIpRange({
      workspaceId,
      userId: "user-admin",
      range: { label: "Bad", cidr: "203.0.113.8/99" },
    })).rejects.toBeInstanceOf(TrackingV2InvalidIpRangeError);
    await expect(service.deleteInternalIpRange({ workspaceId, id: created.id })).resolves.toBe(true);
    await expect(service.listInternalIpRanges(workspaceId)).resolves.toEqual([]);
  });

  it("resolves labels and destination summaries from the immutable manifest", async () => {
    const { repository, service } = harness();
    const session = await start(service);
    if (!session.accepted) throw new Error("Expected session to start.");

    const result = await service.recordEventBatch(batch(session.sessionId, session.eventToken, [
      {
        eventId: "event-button-one",
        type: "button_click",
        occurredAt: now.toISOString(),
        sequence: 1,
        elementId: "button-book-demo",
        pageId: "page-overview",
      },
      {
        eventId: "event-tab-one",
        type: "tab_switch",
        occurredAt: now.toISOString(),
        sequence: 2,
        fromPageId: "page-overview",
        toPageId: "page-pricing",
        trigger: "click",
      },
      {
        eventId: "event-forged-one",
        type: "button_click",
        occurredAt: now.toISOString(),
        sequence: 3,
        elementId: "button-not-in-manifest",
        pageId: "page-overview",
      },
    ]));

    expect(result).toEqual({ accepted: 2, rejected: 1 });
    expect(repository.events.find((event) => event.eventId === "event-button-one")).toMatchObject({
      pageLabel: "Overview",
      elementLabel: "Book a demo",
      destinationKind: "external_web",
      destinationHost: "calendar.example",
      eventData: { sequence: 1 },
    });
    expect(repository.events.find((event) => event.eventId === "event-tab-one")).toMatchObject({
      pageLabel: "Pricing",
      fromPageLabel: "Overview",
      destinationKind: "internal_tab",
    });
  });

  it("stores only webhook identity, endpoint host, and delivery outcome", async () => {
    const { repository, service } = harness();
    await service.recordWebhookSend({
      context,
      webhookId: "77777777-7777-4777-8777-777777777777",
      endpointHost: "https://hooks.example.com/private/path?secret=value",
      deliveryId: "delivery-12345678",
      status: "succeeded",
      attempt: 1,
    });

    const event = repository.events.find((candidate) => candidate.type === "webhook_send");
    expect(event).toMatchObject({
      webhookId: "77777777-7777-4777-8777-777777777777",
      webhookEndpointHost: "hooks.example.com",
      eventData: { deliveryId: "delivery-12345678", status: "succeeded", attempt: 1 },
    });
    expect(JSON.stringify(event)).not.toContain("private/path");
    expect(JSON.stringify(event)).not.toContain("secret=value");
  });
});

function publicPayload(): PublishedSitePayload {
  const content = createDefaultSiteContent("Taylor proposal");
  content.settings.trackingConsentPopup = "popup-b";
  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: { id: workspaceId, slug: "acme", name: "Acme", websiteDomain: "acme.example", logoUrl: null },
    site: {
      id: siteId,
      slug: "taylor-proposal",
      name: "Taylor proposal",
      publishedVersionId,
      publishedAt: now.toISOString(),
    },
    metadata: { title: "Taylor proposal", description: "", ogImageUrl: null, robots: "noindex,nofollow" },
    content,
    selectedVariant: null,
    tracking: {
      version: 2,
      workspaceId,
      siteId,
      publishedVersionId,
      recipientId: null,
      recipientRevision: null,
      trackingMode: "events",
    },
  };
}

function batch(
  sessionId: string,
  eventToken: string,
  events: TrackingV2EventBatch["events"],
): TrackingV2EventBatch {
  return {
    batchId: "batch-session-one",
    sessionId,
    eventToken,
    scriptVersion: TRACKING_V2_SCRIPT_VERSION,
    sentAt: now.toISOString(),
    events,
  };
}
