import { describe, expect, it } from "vitest";
import {
  TRACKING_V2_SCRIPT_VERSION,
  type TrackingV2ContextTokenPayload,
  type TrackingV2EventBatch,
  type TrackingV2SessionStartRequest,
} from "@lightsite/tracking-schema";
import {
  createMemoryTrackingV2Repository,
  type MemoryTrackingV2RepositoryInput,
  type TrackingV2ResolvedContext,
} from "./repository";
import {
  createTrackingV2Service,
  hashEventToken,
  TrackingV2InvalidContextError,
} from "./service";
import {
  createMemoryTrackingV2RecordingObjectStore,
  type TrackingV2RecordingObjectStore,
} from "./recording-object-store";
import type {
  TrackingSuppressionDecisionInput,
  TrackingSuppressionService,
} from "./suppression";

const tokenSecret = "tracking-v2-event-token-secret-at-least-32-chars";
const markerHashSecret = "tracking-v2-marker-hash-secret-at-least-32-chars";
const now = new Date("2026-07-09T12:00:00.000Z");

const context: TrackingV2ContextTokenPayload = {
  version: 2,
  keyId: "test-key",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  publishedVersionId: "33333333-3333-4333-8333-333333333333",
  recipientId: "44444444-4444-4444-8444-444444444444",
  recipientRevision: 3,
  trackingMode: "events",
  issuedAt: "2026-07-09T11:55:00.000Z",
  expiresAt: "2026-07-10T11:55:00.000Z",
};
const recordingContext: TrackingV2ContextTokenPayload = {
  ...context,
  trackingMode: "events_and_recording",
};

const resolvedContext: TrackingV2ResolvedContext = {
  workspaceId: context.workspaceId,
  siteId: context.siteId,
  publishedVersionId: context.publishedVersionId,
  recipientId: context.recipientId,
  recipientRevision: context.recipientRevision,
  workspaceStatus: "active",
  siteStatus: "published",
  recipientStatus: "active",
};

function startRequest(): TrackingV2SessionStartRequest {
  return {
    contextToken: "context_token_that_is_long_enough",
    startedAt: now.toISOString(),
    page: {
      path: "/brief?secret=value",
      title: "Recipient brief",
      referrerHost: "workspace.slack.com",
    },
    viewport: {
      width: 1440,
      height: 900,
    },
    device: {
      deviceId: "device_abc123",
      timezone: "America/New_York",
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    },
  };
}

function eventBatch(sessionId: string, eventToken: string): TrackingV2EventBatch {
  return {
    batchId: "batch_abc123",
    sessionId,
    eventToken,
    scriptVersion: TRACKING_V2_SCRIPT_VERSION,
    sentAt: now.toISOString(),
    events: [
      {
        eventId: "event_visit_1",
        type: "site_visit",
        occurredAt: now.toISOString(),
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
        eventId: "event_link_1",
        type: "link_click",
        occurredAt: now.toISOString(),
        sequence: 1,
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
        occurredAt: now.toISOString(),
        sequence: 2,
        element: {
          kind: "tab",
          id: "pricing",
          label: "Pricing",
        },
        fromTabLabel: "Overview",
      },
    ],
  };
}

function createSuppressionService(suppressed = false): TrackingSuppressionService & {
  decisions: TrackingSuppressionDecisionInput[];
} {
  const decisions: TrackingSuppressionDecisionInput[] = [];

  return {
    decisions,
    async recordWorkspaceUserMarkers() {
      return { markerCount: 0 };
    },
    async evaluateRecipientVisit(input) {
      decisions.push(input);

      return {
        suppressed,
        reason: suppressed ? "suppression_marker" : null,
        matchedMarkerTypes: suppressed ? ["device_id"] : [],
        internalIpRange: null,
      };
    },
  };
}

function createService(input: {
  recordingObjectStore?: TrackingV2RecordingObjectStore | null;
  suppressed?: boolean;
  settings?: MemoryTrackingV2RepositoryInput["settings"];
  contexts?: TrackingV2ResolvedContext[];
  now?: () => Date;
} = {}) {
  const repository = createMemoryTrackingV2Repository({
    contexts: input.contexts ?? [resolvedContext],
    settings: input.settings,
  });
  const suppressionService = createSuppressionService(input.suppressed);
  const service = createTrackingV2Service({
    repository,
    recordingObjectStore: input.recordingObjectStore,
    suppressionService,
    tokenSecret,
    markerHashSecret,
    now: input.now ?? (() => now),
    randomId: () => "fixed-session-id",
    randomToken: () => "fixed-event-token",
  });

  return { repository, service, suppressionService };
}

describe("createTrackingV2Service", () => {
  it("starts an accepted session and stores only hashed device/IP identifiers", async () => {
    const { repository, service, suppressionService } = createService();
    const response = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: "Tampa",
        region: "FL",
        countryCode: "us",
      },
    });

    expect(response).toMatchObject({
      accepted: true,
      eventsAccepted: true,
      recordingAccepted: false,
      sessionId: "session_fixed-session-id",
      eventToken: "event_fixed-event-token",
    });
    expect(repository.createSessionInputs).toHaveLength(1);
    expect(repository.createSessionInputs[0]).toMatchObject({
      publicSessionId: "session_fixed-session-id",
      workspaceId: context.workspaceId,
      ipAddress: "203.0.113.10",
      city: "Tampa",
      region: "FL",
      countryCode: "US",
      deviceType: "desktop",
      osName: "macOS",
      browserName: "Chrome",
      initialPath: "/brief",
    });
    expect(repository.createSessionInputs[0]!.deviceIdHash).toHaveLength(64);
    expect(repository.createSessionInputs[0]!.deviceIdHash).not.toContain("device_abc123");
    expect(repository.createSessionInputs[0]!.ipAddressHash).toHaveLength(64);
    expect(suppressionService.decisions[0]).toMatchObject({
      workspaceId: context.workspaceId,
      ipAddress: "203.0.113.10",
      deviceId: "device_abc123",
    });
  });

  it("returns disabled without creating a session when context is not current", async () => {
    const { repository, service } = createService({ contexts: [] });

    await expect(
      service.startSession({
        context,
        request: startRequest(),
        requestSnapshot: {
          ipAddress: "203.0.113.10",
          userAgent: null,
          city: null,
          region: null,
          countryCode: null,
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      eventsAccepted: false,
      recordingAccepted: false,
      reason: "disabled",
      recording: {
        enabled: false,
        maxDurationMs: 600_000,
      },
    });
    expect(repository.sessions.size).toBe(0);
  });

  it("returns suppressed without creating a session when suppression matches", async () => {
    const { repository, service } = createService({ suppressed: true });

    const response = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    expect(response).toMatchObject({
      accepted: false,
      reason: "suppressed",
    });
    expect(repository.sessions.size).toBe(0);
  });

  it("honors disabled recipient settings", async () => {
    const { repository, service } = createService({
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: false,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: false,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });

    const response = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    expect(response).toMatchObject({
      accepted: false,
      reason: "disabled",
    });
    expect(repository.sessions.size).toBe(0);
  });

  it("issues recording upload tokens only when context, settings, and storage allow it", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { repository, service } = createService({
      recordingObjectStore,
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: true,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: true,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 120,
        },
      ],
    });

    const response = await service.startSession({
      context: recordingContext,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    expect(response).toMatchObject({
      accepted: true,
      recordingAccepted: true,
      recording: {
        enabled: true,
        maxDurationMs: 120_000,
        uploadToken: expect.any(String),
      },
    });
    if (!response.accepted || !response.recording.enabled) {
      throw new Error("Expected recording to be accepted.");
    }

    expect(repository.recordings.size).toBe(1);
    const [recording] = [...repository.recordings.values()];
    if (!recording) {
      throw new Error("Expected recording to be stored.");
    }
    expect(recording).toMatchObject({
      publicSessionId: response.sessionId,
      status: "pending",
      maxDurationMs: 120_000,
    });
    expect(recording.uploadTokenHash).not.toContain(response.recording.uploadToken);
  });

  it("stores, dedupes, completes, and reads recording chunks", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { repository, service } = createService({
      recordingObjectStore,
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: true,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: true,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });
    const session = await service.startSession({
      context: recordingContext,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted || !session.recording.enabled) {
      throw new Error("Expected recording to be accepted.");
    }

    const chunk = {
      schemaVersion: 3 as const,
      sessionId: session.sessionId,
      sequence: 0,
      events: [
        {
          type: 2,
          timestamp: Date.parse("2026-07-09T12:00:01.000Z"),
          data: {},
        },
        {
          type: 3,
          timestamp: Date.parse("2026-07-09T12:00:04.000Z"),
          data: { source: 1, positions: [] },
        },
      ],
      compressed: false as const,
    };

    await expect(
      service.recordRecordingChunk({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        chunk,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      sequence: 0,
    });
    await expect(
      service.recordRecordingChunk({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        chunk,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      duplicate: true,
      sequence: 0,
    });
    await expect(
      service.completeRecording({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        complete: {
          schemaVersion: 3,
          sessionId: session.sessionId,
          finalSequence: 0,
          endedAt: "2026-07-09T12:00:05.000Z",
          stopReason: "ended",
        },
      }),
    ).resolves.toEqual({
      completed: true,
      status: "available",
    });

    const manifest = await service.getRecordingManifest({
      workspaceId: context.workspaceId,
      sessionId: session.sessionId,
    });
    expect(manifest).toMatchObject({
      recordingId: session.recording.recordingId,
      sessionId: session.sessionId,
      status: "available",
      chunkCount: 1,
      eventCount: 2,
      durationMs: 3_000,
      chunks: [
        {
          sequence: 0,
          eventCount: 2,
          firstEventAt: "2026-07-09T12:00:01.000Z",
          lastEventAt: "2026-07-09T12:00:04.000Z",
        },
      ],
    });
    const object = await service.getRecordingChunkObject({
      workspaceId: context.workspaceId,
      recordingId: session.recording.recordingId,
      sequence: 0,
    });
    expect(object?.contentType).toContain("application/json");
    expect(object?.body.toString("utf8")).toContain("\"type\":2");
    expect(recordingObjectStore.objects.size).toBe(1);
    const [storedObject] = recordingObjectStore.objects.values();
    expect(storedObject?.contentType).toBe("application/gzip");
    expect(storedObject?.body.byteLength).toBeLessThan(object?.body.byteLength ?? 0);
    expect(repository.recordingUsage.get(`${context.workspaceId}:2026-07-09`)).toMatchObject({
      recordingCount: 1,
    });
  });

  it("fails cleanly when recording stops before any chunk is accepted", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { repository, service } = createService({
      recordingObjectStore,
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: true,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: true,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });
    const session = await service.startSession({
      context: recordingContext,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted || !session.recording.enabled) {
      throw new Error("Expected recording to be accepted.");
    }

    await expect(
      service.completeRecording({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        complete: {
          schemaVersion: 3,
          sessionId: session.sessionId,
          finalSequence: null,
          endedAt: "2026-07-09T12:00:05.000Z",
          stopReason: "error",
        },
      }),
    ).resolves.toEqual({
      completed: true,
      status: "failed",
    });
    expect(repository.recordings.get(session.recording.recordingId)).toMatchObject({
      status: "failed",
      chunkCount: 0,
      finalSequence: null,
    });
    expect(repository.sessions.get(session.sessionId)).toMatchObject({
      recordingStatus: "failed",
    });
    expect(recordingObjectStore.objects.size).toBe(0);
  });

  it("settles recordings when completion arrives before the final chunk", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { repository, service } = createService({
      recordingObjectStore,
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: true,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: true,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });
    const session = await service.startSession({
      context: recordingContext,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted || !session.recording.enabled) {
      throw new Error("Expected recording to be accepted.");
    }

    await expect(
      service.completeRecording({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        complete: {
          schemaVersion: 3,
          sessionId: session.sessionId,
          finalSequence: 1,
          endedAt: "2026-07-09T12:00:05.000Z",
          stopReason: "ended",
        },
      }),
    ).resolves.toEqual({
      completed: false,
      status: "recording",
    });
    expect(repository.recordings.get(session.recording.recordingId)).toMatchObject({
      status: "recording",
      finalSequence: 1,
      stopReason: "ended",
    });

    await service.recordRecordingChunk({
      recordingId: session.recording.recordingId,
      uploadToken: session.recording.uploadToken,
      chunk: {
        schemaVersion: 3,
        sessionId: session.sessionId,
        sequence: 0,
        events: [
          {
            type: 2,
            timestamp: Date.parse("2026-07-09T12:00:01.000Z"),
            data: {},
          },
        ],
        compressed: false,
      },
    });

    expect(repository.recordings.get(session.recording.recordingId)).toMatchObject({
      status: "recording",
      chunkCount: 1,
    });

    await service.recordRecordingChunk({
      recordingId: session.recording.recordingId,
      uploadToken: session.recording.uploadToken,
      chunk: {
        schemaVersion: 3,
        sessionId: session.sessionId,
        sequence: 1,
        events: [
          {
            type: 3,
            timestamp: Date.parse("2026-07-09T12:00:04.000Z"),
            data: { source: 1, positions: [] },
          },
        ],
        compressed: false,
      },
    });

    expect(repository.recordings.get(session.recording.recordingId)).toMatchObject({
      status: "available",
      finalSequence: 1,
      chunkCount: 2,
      eventCount: 2,
      durationMs: 3_000,
    });
    await expect(
      service.getRecordingManifest({
        workspaceId: context.workspaceId,
        sessionId: session.sessionId,
      }),
    ).resolves.toMatchObject({
      status: "available",
      chunkCount: 2,
      durationMs: 3_000,
    });
  });

  it("keeps terminal recording uploads idempotent without accepting new chunks", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { repository, service } = createService({
      recordingObjectStore,
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: true,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: true,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });
    const session = await service.startSession({
      context: recordingContext,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted || !session.recording.enabled) {
      throw new Error("Expected recording to be accepted.");
    }

    const firstChunk = {
      schemaVersion: 3 as const,
      sessionId: session.sessionId,
      sequence: 0,
      events: [
        {
          type: 2,
          timestamp: Date.parse("2026-07-09T12:00:01.000Z"),
          data: {},
        },
      ],
      compressed: false as const,
    };
    const completion = {
      schemaVersion: 3 as const,
      sessionId: session.sessionId,
      finalSequence: 0,
      endedAt: "2026-07-09T12:00:05.000Z",
      stopReason: "ended" as const,
    };

    await service.recordRecordingChunk({
      recordingId: session.recording.recordingId,
      uploadToken: session.recording.uploadToken,
      chunk: firstChunk,
    });
    await service.completeRecording({
      recordingId: session.recording.recordingId,
      uploadToken: session.recording.uploadToken,
      complete: completion,
    });

    await expect(
      service.completeRecording({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        complete: completion,
      }),
    ).resolves.toEqual({
      completed: true,
      status: "available",
    });
    await expect(
      service.recordRecordingChunk({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        chunk: firstChunk,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      duplicate: true,
      sequence: 0,
    });
    await expect(
      service.recordRecordingChunk({
        recordingId: session.recording.recordingId,
        uploadToken: session.recording.uploadToken,
        chunk: {
          ...firstChunk,
          sequence: 1,
        },
      }),
    ).rejects.toBeInstanceOf(TrackingV2InvalidContextError);

    expect(repository.recordings.get(session.recording.recordingId)).toMatchObject({
      status: "available",
      chunkCount: 1,
      eventCount: 1,
    });
    expect(repository.recordingChunks).toHaveLength(1);
    expect(recordingObjectStore.objects.size).toBe(1);
  });

  it("records browser event batches idempotently", async () => {
    const { repository, service } = createService();
    const session = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted) {
      throw new Error("Expected accepted session.");
    }

    await service.recordEventBatch(eventBatch(session.sessionId, session.eventToken));
    await service.recordEventBatch(eventBatch(session.sessionId, session.eventToken));

    expect(repository.events).toHaveLength(3);
    expect(repository.events.map((event) => event.type)).toEqual([
      "site_visit",
      "link_click",
      "tab_switch",
    ]);
    expect(repository.events[1]).toMatchObject({
      elementKind: "sidebar_link",
      elementLabel: "Proposal",
      elementHref: "https://example.com/proposal",
    });
    expect(repository.events[2]).toMatchObject({
      tabLabel: "Pricing",
      eventData: {
        sequence: 2,
        fromTabLabel: "Overview",
      },
    });
  });

  it("records deduped Slack share events without a browser session", async () => {
    const { repository, service } = createService();

    await expect(
      service.recordSlackShare({
        context,
        imageCacheKey: "og-image-cache-key",
      }),
    ).resolves.toEqual({ recorded: true });
    await service.recordSlackShare({
      context,
      imageCacheKey: "og-image-cache-key",
    });

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]).toMatchObject({
      type: "slack_share",
      source: "slack_og_image",
      sessionId: null,
      workspaceId: context.workspaceId,
      siteId: context.siteId,
      recipientId: context.recipientId,
      publishedVersionId: context.publishedVersionId,
      tabLabel: null,
      elementKind: null,
      webhookId: null,
      webhookUrl: null,
      scriptVersion: null,
      eventData: {
        platform: "slack",
        resource: "og_image",
        userAgentFamily: "slackbot",
        imageCacheKey: "og-image-cache-key",
      },
    });
  });

  it("does not record Slack share events when tracking is disabled", async () => {
    const { repository, service } = createService({
      settings: [
        {
          workspaceId: context.workspaceId,
          siteId: context.siteId,
          recipientId: context.recipientId,
          scope: "recipient",
          enabled: false,
          captureIpAddress: true,
          rawIpRetentionDays: 30,
          eventRetentionDays: 365,
          recordingEnabled: false,
          recordingRetentionDays: 30,
          maxRecordingDurationSeconds: 600,
        },
      ],
    });

    await expect(
      service.recordSlackShare({
        context,
        imageCacheKey: "og-image-cache-key",
      }),
    ).resolves.toEqual({ recorded: false });

    expect(repository.events).toHaveLength(0);
  });

  it("rejects event batches with the wrong event token", async () => {
    const { service } = createService();
    const session = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted) {
      throw new Error("Expected accepted session.");
    }

    await expect(
      service.recordEventBatch(eventBatch(session.sessionId, "event_wrong-token")),
    ).rejects.toBeInstanceOf(TrackingV2InvalidContextError);
  });

  it("updates heartbeat and ends sessions through event tokens", async () => {
    const { repository, service } = createService();
    const session = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted) {
      throw new Error("Expected accepted session.");
    }

    await service.recordHeartbeat({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: "2026-07-09T12:00:15.000Z",
      activeMs: 5_000,
      maxScrollDepthPercent: 40,
    });
    await service.endSession({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: "2026-07-09T12:00:20.000Z",
      reason: "pagehide",
      activeMs: 8_000,
    });

    expect(repository.sessions.get(session.sessionId)).toMatchObject({
      state: "ended",
      lastSeenAt: new Date("2026-07-09T12:00:20.000Z"),
    });
  });

  it("rejects lifecycle signals after the server freshness window", async () => {
    let serverNow = now;
    const { repository, service } = createService({
      now: () => serverNow,
    });
    const session = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted) {
      throw new Error("Expected accepted session.");
    }

    serverNow = new Date("2026-07-09T12:02:00.001Z");

    await expect(service.recordHeartbeat({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: serverNow.toISOString(),
      activeMs: 120_000,
    })).rejects.toBeInstanceOf(TrackingV2InvalidContextError);
    await expect(
      service.recordEventBatch(eventBatch(session.sessionId, session.eventToken)),
    ).rejects.toBeInstanceOf(TrackingV2InvalidContextError);
    expect(repository.sessions.get(session.sessionId)).toMatchObject({
      state: "active",
      lastSeenAt: now,
      activeMs: 0,
    });
  });

  it("caps active time claims to elapsed time between lifecycle signals", async () => {
    const { repository, service } = createService();
    const session = await service.startSession({
      context,
      request: startRequest(),
      requestSnapshot: {
        ipAddress: "203.0.113.10",
        userAgent: null,
        city: null,
        region: null,
        countryCode: null,
      },
    });

    if (!session.accepted) {
      throw new Error("Expected accepted session.");
    }

    await service.recordHeartbeat({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: "2026-07-09T12:00:15.000Z",
      activeMs: 999_999_999,
    });
    await service.recordHeartbeat({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: "2026-07-09T12:00:16.000Z",
      activeMs: 999_999_999,
    });
    await service.endSession({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: "2026-07-09T12:00:17.000Z",
      reason: "pagehide",
      activeMs: 999_999_999,
    });

    expect(repository.sessions.get(session.sessionId)).toMatchObject({
      activeMs: 17_000,
      durationMs: 17_000,
      state: "ended",
    });
  });

  it("hashes event tokens per session", () => {
    expect(
      hashEventToken({
        sessionId: "session_a",
        eventToken: "event_same",
        secret: tokenSecret,
      }),
    ).not.toBe(
      hashEventToken({
        sessionId: "session_b",
        eventToken: "event_same",
        secret: tokenSecret,
      }),
    );
  });
});
