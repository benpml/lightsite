import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMemoryTrackingRateLimiter } from "../tracking/rate-limit";
import { createEncryptedTrackingV2ContextTokenService } from "../tracking/v2/context-token";
import type { TrackingV2Service } from "../tracking/v2/service";
import { createPublicSiteDocumentRouter } from "./document-router";
import type { PublicSiteScreenshotService } from "./screenshot";
import type { PublicSiteService } from "./service";

describe("public site screenshot route", () => {
  it("serves the recipient JPEG and records Slack's image load against that recipient", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events_and_recording",
    });
    const recordSlackShare = vi.fn(async (_input: Parameters<TrackingV2Service["recordSlackShare"]>[0]) => ({ recorded: true }));
    const app = createScreenshotTestApp({ bootstrap, contextTokens, recordSlackShare });

    const response = await request(app)
      .get("/acme/rollout/ada/embed.jpg?v=version-7")
      .set("user-agent", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")
      .expect(200);

    expect(response.headers["content-type"]).toContain("image/jpeg");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual(Buffer.from("literal-site-jpg"));
    expect(recordSlackShare).toHaveBeenCalledTimes(1);
    expect(recordSlackShare.mock.calls[0]?.[0]).toMatchObject({
      context: {
        recipientId: "44444444-4444-4444-8444-444444444444",
        recipientRevision: 7,
      },
      imageCacheKey: "workspace:site:version:recipient:7",
    });
  });

  it("serves the same image without recording normal browser preview loads", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events_and_recording",
    });
    const recordSlackShare = vi.fn(async (_input: Parameters<TrackingV2Service["recordSlackShare"]>[0]) => ({ recorded: true }));
    const app = createScreenshotTestApp({ bootstrap, contextTokens, recordSlackShare });

    await request(app)
      .get("/acme/rollout/ada/embed.jpg")
      .set("user-agent", "Mozilla/5.0 Chrome/149.0")
      .expect(200);

    expect(recordSlackShare).not.toHaveBeenCalled();
  });

  it("redirects legacy PNG URLs to the versioned JPEG endpoint", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events_and_recording",
    });
    const app = createScreenshotTestApp({
      bootstrap,
      contextTokens,
      recordSlackShare: vi.fn(async () => ({ recorded: true })),
    });

    const response = await request(app)
      .get("/acme/rollout/ada/embed.png?v=version-7")
      .expect(308);

    expect(response.headers.location).toBe("/acme/rollout/ada/embed.jpg?v=version-7");
  });
});

function createScreenshotTestApp(input: {
  bootstrap: { contextToken: string };
  contextTokens: ReturnType<typeof createEncryptedTrackingV2ContextTokenService>;
  recordSlackShare: TrackingV2Service["recordSlackShare"];
}) {
  const publicSiteService: PublicSiteService = {
    async resolve() {
      return {
        status: "available",
        cacheControl: "public, max-age=60",
        payload: { trackingV2: input.bootstrap },
      };
    },
  };
  const screenshotService: PublicSiteScreenshotService = {
    async render() {
      return {
        bytes: Buffer.from("literal-site-jpg"),
        cacheKey: "workspace:site:version:recipient:7",
      };
    },
  };
  const trackingService = {
    recordSlackShare: input.recordSlackShare,
  } as unknown as TrackingV2Service;
  const app = express();
  app.use(createPublicSiteDocumentRouter({
    publicSiteOrigin: "https://lightsite.test",
    publicSiteService,
    screenshotService,
    trackingContextTokens: input.contextTokens,
    trackingRateLimiter: createMemoryTrackingRateLimiter(),
    trackingService,
  }));
  return app;
}
