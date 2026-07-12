import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
  type TrackingV2EventBatch,
} from "@lightsite/tracking-schema";
import { errorMiddleware } from "../../http/error-middleware";
import { requestContextMiddleware } from "../../http/request-context";
import { createMemoryTrackingRateLimiter } from "../rate-limit";
import { createEncryptedTrackingV2ContextTokenService } from "./context-token";
import {
  createMemoryTrackingV2Repository,
  type MemoryTrackingV2RepositoryInput,
  type TrackingV2ResolvedContext,
} from "./repository";
import {
  createMemoryTrackingV2RecordingObjectStore,
  type TrackingV2RecordingObjectStore,
} from "./recording-object-store";
import { createTrackingV2ReadRouter } from "./read-router";
import { createTrackingV2Router } from "./router";
import { createTrackingV2Service } from "./service";
import type { TrackingSuppressionService } from "./suppression";

const tokenSecret = "tracking-v2-router-token-secret-at-least-32-chars";
const markerHashSecret = "tracking-v2-router-marker-secret-at-least-32-chars";
const now = new Date("2026-07-09T12:00:00.000Z");
const context = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  publishedVersionId: "33333333-3333-4333-8333-333333333333",
  recipientId: "44444444-4444-4444-8444-444444444444",
  recipientRevision: 3,
  trackingMode: "events" as const,
};
const recordingContext = {
  ...context,
  trackingMode: "events_and_recording" as const,
};
const resolvedContext: TrackingV2ResolvedContext = {
  ...context,
  workspaceStatus: "active",
  siteStatus: "published",
  recipientStatus: "active",
};

function createApp(input: {
  recordingObjectStore?: TrackingV2RecordingObjectStore | null;
  rateLimitEvents?: number;
  role?: "admin" | "user";
  settings?: MemoryTrackingV2RepositoryInput["settings"];
  suppressed?: boolean;
} = {}) {
  const app = express();
  const contextTokens = createEncryptedTrackingV2ContextTokenService(tokenSecret, {
    keyId: "router-test",
    now: () => now,
    randomBytes: (size) => Buffer.alloc(size, 8),
  });
  const repository = createMemoryTrackingV2Repository({
    contexts: [resolvedContext],
    settings: input.settings,
  });
  const suppressionService: TrackingSuppressionService = {
    async recordWorkspaceUserMarkers() {
      return { markerCount: 0 };
    },
    async evaluateRecipientVisit() {
      return {
        suppressed: Boolean(input.suppressed),
        reason: input.suppressed ? "suppression_marker" : null,
        matchedMarkerTypes: input.suppressed ? ["device_id"] : [],
        internalIpRange: null,
      };
    },
  };
  const service = createTrackingV2Service({
    repository,
    recordingObjectStore: input.recordingObjectStore,
    suppressionService,
    tokenSecret,
    markerHashSecret,
    now: () => now,
    randomId: () => "router-session",
    randomToken: () => "router-event-token",
  });

  app.use(requestContextMiddleware);
  app.use(express.json());
  app.use(createTrackingV2Router({
    contextTokens,
    trackingService: service,
    rateLimiter: input.rateLimitEvents === undefined
      ? undefined
      : createMemoryTrackingRateLimiter({
          maxEventsPerWindow: input.rateLimitEvents,
          nowMs: () => now.getTime(),
        }),
  }));
  app.use("/api/workspaces/:workspaceId/tracking/v2", createTrackingV2ReadRouter({
    bootstrapService: {
      async getBootstrap() {
        return {
          user: {
            id: "user_router",
            email: "user@lightsite.test",
            accountSetupComplete: true,
            internalAccess: false,
          },
          activeWorkspace: {
            id: context.workspaceId,
            slug: "router-workspace",
            name: "Router Workspace",
            websiteDomain: "lightsite.test",
            logoUrl: null,
            plan: "core",
            role: input.role ?? "admin",
            membershipId: "55555555-5555-4555-8555-555555555555",
          },
          workspaces: [],
          onboarding: {
            nextStep: "app",
          },
        };
      },
      async completeAccountSetup() {
        throw new Error("Not used by tracking v2 read router tests.");
      },
      async setActiveWorkspace() {
        throw new Error("Not used by tracking v2 read router tests.");
      },
    },
    getCurrentActor: async () => ({
      userId: "user_router",
      email: "user@lightsite.test",
      emailVerified: true,
    }),
    trackingService: service,
  }));
  app.use(errorMiddleware);

  return {
    app,
    contextTokens,
    repository,
  };
}

function startBody(contextToken: string) {
  return {
    contextToken,
    startedAt: now.toISOString(),
    page: {
      path: "/brief",
      title: "Recipient brief",
      referrerHost: null,
    },
    viewport: {
      width: 1440,
      height: 900,
    },
    device: {
      deviceId: "device_router_abc",
      timezone: "America/New_York",
      locale: "en-US",
      userAgent: "Mozilla/5.0 Chrome/126.0",
    },
  };
}

function eventBatch(sessionId: string, eventToken: string): TrackingV2EventBatch {
  return {
    batchId: "batch_router_1",
    sessionId,
    eventToken,
    scriptVersion: TRACKING_V2_SCRIPT_VERSION,
    sentAt: now.toISOString(),
    events: [
      {
        eventId: "event_router_visit",
        type: "site_visit",
        occurredAt: now.toISOString(),
        sequence: 0,
      },
      {
        eventId: "event_router_button",
        type: "button_click",
        occurredAt: now.toISOString(),
        sequence: 1,
        element: {
          kind: "button",
          id: "book-demo",
          label: "Book demo",
        },
      },
    ],
  };
}

function siteSettingsBody(overrides: Partial<{
  enabled: boolean;
  captureIpAddress: boolean;
  rawIpRetentionDays: number;
  eventRetentionDays: number;
  recordingEnabled: boolean;
  recordingRetentionDays: number;
  maxRecordingDurationSeconds: number;
  recordingDisclosureAccepted: boolean;
}> = {}) {
  return {
    enabled: true,
    captureIpAddress: true,
    rawIpRetentionDays: 30,
    eventRetentionDays: 365,
    recordingEnabled: false,
    recordingRetentionDays: 30,
    maxRecordingDurationSeconds: 600,
    ...overrides,
  };
}

describe("createTrackingV2Router", () => {
  it("starts sessions with an encrypted context token", async () => {
    const { app, contextTokens, repository } = createApp();
    const bootstrap = contextTokens.issue(context);
    const response = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .set("cf-connecting-ip", "203.0.113.10")
      .set("cf-ipcity", "Tampa")
      .set("cf-region", "FL")
      .set("cf-ipcountry", "US")
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    expect(response.body).toMatchObject({
      accepted: true,
      sessionId: "session_router-session",
      eventToken: "event_router-event-token",
    });
    expect(repository.sessions.size).toBe(1);
  });

  it("accepts recording chunks through scoped bearer upload tokens", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { app, contextTokens, repository } = createApp({
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
    const bootstrap = contextTokens.issue(recordingContext);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    expect(startResponse.body).toMatchObject({
      accepted: true,
      recordingAccepted: true,
      recording: {
        enabled: true,
        recordingId: expect.any(String),
        uploadToken: expect.any(String),
        chunkEndpoint: expect.stringContaining("/api/public/tracking/v2/recordings/"),
        completeEndpoint: expect.stringContaining("/api/public/tracking/v2/recordings/"),
      },
    });

    const { recording, sessionId } = startResponse.body as {
      sessionId: string;
      recording: {
        chunkEndpoint: string;
        completeEndpoint: string;
        recordingId: string;
        uploadToken: string;
      };
    };
    const chunkBody = {
      schemaVersion: 3,
      sessionId,
      sequence: 0,
      events: [
        {
          type: 2,
          timestamp: Date.parse("2026-07-09T12:00:01.000Z"),
          data: {},
        },
      ],
      compressed: false,
    };

    await request(app)
      .post(recording.chunkEndpoint)
      .set("authorization", `Bearer ${recording.uploadToken}`)
      .send(chunkBody)
      .expect(201);
    await request(app)
      .post(recording.chunkEndpoint)
      .set("authorization", `Bearer ${recording.uploadToken}`)
      .send(chunkBody)
      .expect(200);
    await request(app)
      .post(recording.completeEndpoint)
      .set("authorization", `Bearer ${recording.uploadToken}`)
      .send({
        schemaVersion: 3,
        sessionId,
        finalSequence: 0,
        endedAt: "2026-07-09T12:00:05.000Z",
        stopReason: "ended",
      })
      .expect(200);

    expect(repository.recordingChunks).toHaveLength(1);
    expect(repository.recordings.get(recording.recordingId)).toMatchObject({
      status: "available",
      chunkCount: 1,
      eventCount: 1,
    });
    expect(recordingObjectStore.objects.size).toBe(1);
  });

  it("reads completed recording manifests and chunks through workspace routes", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { app, contextTokens } = createApp({
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
    const bootstrap = contextTokens.issue(recordingContext);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);
    const { recording, sessionId } = startResponse.body as {
      sessionId: string;
      recording: {
        chunkEndpoint: string;
        completeEndpoint: string;
        recordingId: string;
        uploadToken: string;
      };
    };
    const chunkBody = {
      schemaVersion: 3,
      sessionId,
      sequence: 0,
      events: [
        {
          type: 2,
          timestamp: Date.parse("2026-07-09T12:00:01.000Z"),
          data: {},
        },
      ],
      compressed: false,
    };

    await request(app)
      .post(recording.chunkEndpoint)
      .set("authorization", `Bearer ${recording.uploadToken}`)
      .send(chunkBody)
      .expect(201);
    await request(app)
      .post(recording.completeEndpoint)
      .set("authorization", `Bearer ${recording.uploadToken}`)
      .send({
        schemaVersion: 3,
        sessionId,
        finalSequence: 0,
        endedAt: "2026-07-09T12:00:05.000Z",
        stopReason: "ended",
      })
      .expect(200);

    const manifestResponse = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/sessions/${sessionId}/recording`)
      .expect(200);

    expect(manifestResponse.body).toMatchObject({
      recordingId: recording.recordingId,
      sessionId,
      status: "available",
      chunkCount: 1,
      eventCount: 1,
      chunks: [
        {
          sequence: 0,
          eventCount: 1,
        },
      ],
    });

    const chunkResponse = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/recordings/${recording.recordingId}/chunks/0`)
      .expect(200);

    expect(chunkResponse.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(chunkResponse.text)).toMatchObject(chunkBody);
  });

  it("returns accepted false when a session is suppressed", async () => {
    const { app, contextTokens, repository } = createApp({ suppressed: true });
    const bootstrap = contextTokens.issue(context);
    const response = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    expect(response.body).toMatchObject({
      accepted: false,
      reason: "suppressed",
    });
    expect(repository.sessions.size).toBe(0);
  });

  it("rejects invalid context tokens generically", async () => {
    const { app } = createApp();
    const response = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody("not-a-valid-context-token"))
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      message: "Invalid tracking context.",
    });
  });

  it("ingests event batches and lifecycle signals", async () => {
    const { app, contextTokens, repository } = createApp();
    const bootstrap = contextTokens.issue(context);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    const { sessionId, eventToken } = startResponse.body as {
      sessionId: string;
      eventToken: string;
    };

    await request(app)
      .post(TRACKING_V2_EVENTS_ENDPOINT)
      .send(eventBatch(sessionId, eventToken))
      .expect(204);
    await request(app)
      .post(TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT)
      .send({
        sessionId,
        eventToken,
        occurredAt: "2026-07-09T12:00:15.000Z",
        activeMs: 5_000,
        maxScrollDepthPercent: 25,
      })
      .expect(204);
    await request(app)
      .post(TRACKING_V2_SESSION_END_ENDPOINT)
      .send({
        sessionId,
        eventToken,
        occurredAt: "2026-07-09T12:00:20.000Z",
        reason: "pagehide",
        activeMs: 8_000,
      })
      .expect(204);

    expect(repository.events.map((event) => event.type)).toEqual(["site_visit", "button_click"]);
    expect(repository.sessions.get(sessionId)).toMatchObject({ state: "ended" });
  });

  it("reads v2 events and sessions through authenticated workspace routes", async () => {
    const { app, contextTokens } = createApp();
    const bootstrap = contextTokens.issue(context);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .set("cf-connecting-ip", "203.0.113.10")
      .set("cf-ipcity", "Tampa")
      .set("cf-region", "FL")
      .set("cf-ipcountry", "US")
      .send(startBody(bootstrap.contextToken))
      .expect(200);
    const { sessionId, eventToken } = startResponse.body as {
      sessionId: string;
      eventToken: string;
    };

    await request(app)
      .post(TRACKING_V2_EVENTS_ENDPOINT)
      .send(eventBatch(sessionId, eventToken))
      .expect(204);
    await request(app)
      .post(TRACKING_V2_SESSION_END_ENDPOINT)
      .send({
        sessionId,
        eventToken,
        occurredAt: "2026-07-09T12:00:20.000Z",
        reason: "pagehide",
        activeMs: 8_000,
      })
      .expect(204);

    const firstEventsPage = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/events`)
      .query({ limit: 1 })
      .expect(200);

    expect(firstEventsPage.headers["cache-control"]).toBe("no-store");
    expect(firstEventsPage.body).toMatchObject({
      events: [
        {
          type: "button_click",
          site: {
            id: context.siteId,
            name: "Test Site",
          },
          recipient: {
            id: context.recipientId,
            name: "Test Recipient",
            website: null,
          },
          sessionId,
          session: {
            id: sessionId,
            state: "ended",
            device: {
              type: "desktop",
              browser: "Chrome",
            },
            location: {
              city: "Tampa",
              region: "FL",
              countryCode: "US",
            },
          },
          element: {
            kind: "button",
            id: "book-demo",
            label: "Book demo",
          },
          webhook: null,
        },
      ],
      nextCursor: expect.any(String),
      requestId: expect.any(String),
    });

    const secondEventsPage = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/events`)
      .query({ cursor: firstEventsPage.body.nextCursor })
      .expect(200);

    expect(secondEventsPage.body.events.map((event: { type: string }) => event.type)).toEqual(["site_visit"]);
    expect(secondEventsPage.body.nextCursor).toBeNull();

    const sessionsResponse = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/sessions`)
      .query({ state: "ended", limit: 10 })
      .expect(200);

    expect(sessionsResponse.body).toMatchObject({
      sessions: [
        {
          id: sessionId,
          state: "ended",
          site: {
            id: context.siteId,
          },
          recipient: {
            id: context.recipientId,
            website: null,
          },
          ipAddress: "203.0.113.10",
          initialPath: "/brief",
          referrerHost: null,
          endedAt: "2026-07-09T12:00:20.000Z",
          endReason: "pagehide",
          activeMs: 8_000,
          durationMs: 20_000,
          recording: {
            status: "disabled",
            available: false,
            durationMs: null,
          },
        },
      ],
      nextCursor: null,
      requestId: expect.any(String),
    });

    const sessionResponse = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/sessions/${sessionId}`)
      .expect(200);

    expect(sessionResponse.body.session).toMatchObject({
      id: sessionId,
      state: "ended",
      location: {
        city: "Tampa",
      },
    });
  });

  it("reads default site-level tracking settings through workspace routes", async () => {
    const { app } = createApp();
    const response = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({
      site: {
        id: context.siteId,
        name: "Test Site",
      },
      scope: "site",
      siteOverride: null,
      effective: {
        enabled: true,
        captureIpAddress: true,
        rawIpRetentionDays: 30,
        eventRetentionDays: 365,
        recordingEnabled: false,
        recordingRetentionDays: 30,
        maxRecordingDurationSeconds: 600,
      },
      recordingDisclosure: {
        required: true,
        text: expect.any(String),
      },
      requestId: expect.any(String),
    });
  });

  it("updates site tracking settings and uses them for later recording sessions", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { app, contextTokens } = createApp({ recordingObjectStore });
    const settingsResponse = await request(app)
      .put(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .send(siteSettingsBody({
        recordingEnabled: true,
        recordingDisclosureAccepted: true,
      }))
      .expect(200);

    expect(settingsResponse.body).toMatchObject({
      siteOverride: {
        recordingEnabled: true,
      },
      effective: {
        recordingEnabled: true,
      },
    });

    const bootstrap = contextTokens.issue(recordingContext);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    expect(startResponse.body).toMatchObject({
      accepted: true,
      recordingAccepted: true,
      recording: {
        enabled: true,
      },
    });
  });

  it("requires explicit disclosure acknowledgement before recording can be enabled", async () => {
    const recordingObjectStore = createMemoryTrackingV2RecordingObjectStore();
    const { app } = createApp({ recordingObjectStore });
    const response = await request(app)
      .put(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .send(siteSettingsBody({ recordingEnabled: true }))
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_payload",
      message: "Invalid tracking settings.",
    });
  });

  it("does not save recording-enabled settings when recording storage is unavailable", async () => {
    const { app } = createApp();

    await request(app)
      .put(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .send(siteSettingsBody({
        recordingEnabled: true,
        recordingDisclosureAccepted: true,
      }))
      .expect(503);

    const settingsResponse = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .expect(200);

    expect(settingsResponse.body.effective.recordingEnabled).toBe(false);
    expect(settingsResponse.body.siteOverride).toBeNull();
  });

  it("requires workspace admin role to update site tracking settings", async () => {
    const { app } = createApp({ role: "user" });
    const response = await request(app)
      .put(`/api/workspaces/${context.workspaceId}/tracking/v2/sites/${context.siteId}/settings`)
      .send(siteSettingsBody())
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "site.permission_denied",
    });
  });

  it("rejects invalid v2 read cursors", async () => {
    const { app } = createApp();
    const response = await request(app)
      .get(`/api/workspaces/${context.workspaceId}/tracking/v2/events`)
      .query({ cursor: "not-a-cursor" })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_payload",
      message: "Invalid tracking query.",
    });
  });

  it("keeps v2 read routes scoped to the active workspace", async () => {
    const { app } = createApp();
    const response = await request(app)
      .get("/api/workspaces/99999999-9999-4999-8999-999999999999/tracking/v2/events")
      .expect(404);

    expect(response.body.error.code).toBe("workspace.access_denied");
  });

  it("rejects event batches with the wrong event token", async () => {
    const { app, contextTokens } = createApp();
    const bootstrap = contextTokens.issue(context);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    const response = await request(app)
      .post(TRACKING_V2_EVENTS_ENDPOINT)
      .send(eventBatch(startResponse.body.sessionId, "event_wrong-token-that-is-long-enough"))
      .expect(400);

    expect(response.body.error.code).toBe("tracking.invalid_context");
  });

  it("rate limits oversized event pressure", async () => {
    const { app, contextTokens } = createApp({ rateLimitEvents: 1 });
    const bootstrap = contextTokens.issue(context);
    const startResponse = await request(app)
      .post(TRACKING_V2_SESSION_START_ENDPOINT)
      .send(startBody(bootstrap.contextToken))
      .expect(200);

    const response = await request(app)
      .post(TRACKING_V2_EVENTS_ENDPOINT)
      .send(eventBatch(startResponse.body.sessionId, startResponse.body.eventToken))
      .expect(429);

    expect(response.headers["retry-after"]).toBe("60");
    expect(response.body.error.code).toBe("tracking.rate_limited");
  });
});
