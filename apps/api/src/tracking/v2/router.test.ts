import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { TRACKING_V2_SCRIPT_VERSION } from "@handout/tracking-schema";
import type { TrackingV2Service } from "./service";
import { errorMiddleware } from "../../http/error-middleware";
import { createEncryptedTrackingV2ContextTokenService } from "./context-token";
import { createTrackingV2Router } from "./router";

const now = new Date("2026-07-12T12:00:00.000Z");
const tokenSecret = "tracking-v2-router-secret-that-is-long-enough";
const contextInput = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  publishedVersionId: "33333333-3333-4333-8333-333333333333",
  manifestId: "55555555-5555-4555-8555-555555555555",
  recipientId: "44444444-4444-4444-8444-444444444444",
  recipientRevision: 3,
  trackingMode: "events" as const,
};

function harness() {
  const startSession = vi.fn<TrackingV2Service["startSession"]>(async () => ({
    accepted: true,
    eventsAccepted: true,
    recordingAccepted: false,
    sessionId: "session-router-one",
    eventToken: "event_token_router_long_enough",
    scriptVersion: TRACKING_V2_SCRIPT_VERSION,
    heartbeatIntervalMs: 15_000,
    idleTimeoutMs: 120_000,
    maxSessionDurationMs: 14_400_000,
    recording: { enabled: false, maxDurationMs: 600_000 },
  }));
  const recordEventBatch = vi.fn<TrackingV2Service["recordEventBatch"]>(async (batch) => ({
    accepted: batch.events.length,
    rejected: 0,
  }));
  const recordRecordingChunk = vi.fn<TrackingV2Service["recordRecordingChunk"]>(async (input) => ({
    duplicate: false,
    sequence: input.upload.sequence,
  }));
  const trackingService = {
    preparePublicContext: async () => null,
    listEvents: async () => ({ events: [], nextCursor: null }),
    listSessions: async () => ({ sessions: [], nextCursor: null }),
    getSession: async () => null,
    getSiteSettings: async () => null,
    updateSiteSettings: async () => null,
    listInternalIpRanges: async () => [],
    createInternalIpRange: async () => { throw new Error("Not used by public router tests."); },
    deleteInternalIpRange: async () => false,
    startSession,
    recordEventBatch,
    recordSlackShare: async () => ({ recorded: true }),
    recordWebhookSend: async () => ({ recorded: true }),
    recordHeartbeat: async () => undefined,
    endSession: async () => undefined,
    recordRecordingChunk,
    completeRecording: async () => ({ status: "available" }),
    getRecordingManifest: async () => null,
    getRecordingChunk: async () => null,
  } satisfies TrackingV2Service;
  const contextTokens = createEncryptedTrackingV2ContextTokenService(tokenSecret, {
    now: () => now,
    randomBytes: (size) => Buffer.alloc(size, 3),
  });
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "16kb" }));
  app.use(createTrackingV2Router({
    contextTokens,
    trackingService,
    rateLimitKeySecret: tokenSecret,
  }));
  app.use(errorMiddleware);
  return { app, contextTokens, recordEventBatch, recordRecordingChunk, startSession };
}

function startBody(contextToken: string) {
  return {
    contextToken,
    requestId: "request-router-one",
    startedAt: now.toISOString(),
    initialPageId: "page-overview",
  };
}

describe("tracking v2 public router", () => {
  it("accepts a strict event-only session start and ignores untrusted geo headers", async () => {
    const { app, contextTokens, startSession } = harness();
    const bootstrap = contextTokens.issue(contextInput);
    await request(app)
      .post("/api/public/tracking/v2/sessions")
      .set("host", "recipient.handout.test")
      .set("origin", "http://recipient.handout.test")
      .set("cf-ipcity", "Forged City")
      .send(startBody(bootstrap.contextToken))
      .expect(200)
      .expect(({ body }) => expect(body.recording).toEqual({ enabled: false, maxDurationMs: 600_000 }));

    expect(startSession).toHaveBeenCalledWith(expect.objectContaining({
      requestSnapshot: expect.objectContaining({ city: null, region: null, countryCode: null }),
    }));
  });

  it("rejects cross-origin requests before any tracking work", async () => {
    const { app, contextTokens, startSession } = harness();
    const bootstrap = contextTokens.issue(contextInput);
    await request(app)
      .post("/api/public/tracking/v2/sessions")
      .set("host", "recipient.handout.test")
      .set("origin", "https://attacker.example")
      .send(startBody(bootstrap.contextToken))
      .expect(403);
    expect(startSession).not.toHaveBeenCalled();
  });

  it("rejects browser-supplied labels, destinations, and site visits", async () => {
    const { app, recordEventBatch } = harness();
    const base = {
      batchId: "batch-router-one",
      sessionId: "session-router-one",
      eventToken: "event_token_router_long_enough",
      scriptVersion: TRACKING_V2_SCRIPT_VERSION,
      sentAt: now.toISOString(),
    };
    await request(app).post("/api/public/tracking/v2/events").send({
      ...base,
      events: [{
        eventId: "event-forged-label",
        type: "button_click",
        occurredAt: now.toISOString(),
        sequence: 1,
        elementId: "button-book-demo",
        pageId: "page-overview",
        label: "Forged label",
        href: "https://example.com/private?secret=1",
      }],
    }).expect(400);
    await request(app).post("/api/public/tracking/v2/events").send({
      ...base,
      events: [{ eventId: "event-forged-visit", type: "site_visit", occurredAt: now.toISOString(), sequence: 1 }],
    }).expect(400);
    expect(recordEventBatch).not.toHaveBeenCalled();
  });

  it("accepts ID-only interaction batches and exposes no replay routes", async () => {
    const { app, recordEventBatch } = harness();
    await request(app).post("/api/public/tracking/v2/events").send({
      batchId: "batch-router-one",
      sessionId: "session-router-one",
      eventToken: "event_token_router_long_enough",
      scriptVersion: TRACKING_V2_SCRIPT_VERSION,
      sentAt: now.toISOString(),
      events: [{
        eventId: "event-button-one",
        type: "button_click",
        occurredAt: now.toISOString(),
        sequence: 1,
        elementId: "button-book-demo",
        pageId: "page-overview",
      }],
    }).expect(200, { accepted: 1, rejected: 0 });
    expect(recordEventBatch).toHaveBeenCalledOnce();
    await request(app).post("/api/public/tracking/v2/recordings").send({}).expect(404);
  });

  it("rejects oversized bodies with a precise client error", async () => {
    const { app } = harness();
    await request(app)
      .post("/api/public/tracking/v2/events")
      .set("content-type", "application/json")
      .send({ padding: "x".repeat(20_000) })
      .expect(413)
      .expect(({ body }) => expect(body.error.code).toBe("request.too_large"));
  });

  it("requires same-origin recording uploads with a recording bearer token", async () => {
    const { app, recordRecordingChunk } = harness();
    const body = {
      schemaVersion: 4,
      sessionId: "session-router-one",
      sequence: 0,
      events: [{ type: 2, timestamp: now.getTime(), data: {} }],
    };
    await request(app)
      .post("/api/public/tracking/v2/recordings/33333333-3333-4333-8333-333333333333/chunks")
      .set("host", "recipient.handout.test")
      .set("origin", "http://recipient.handout.test")
      .send(body)
      .expect(400);
    await request(app)
      .post("/api/public/tracking/v2/recordings/33333333-3333-4333-8333-333333333333/chunks")
      .set("host", "recipient.handout.test")
      .set("origin", "http://recipient.handout.test")
      .set("authorization", "Bearer recording-upload-token")
      .send(body)
      .expect(201, { duplicate: false, sequence: 0 });
    expect(recordRecordingChunk).toHaveBeenCalledOnce();
  });
});
