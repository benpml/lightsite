import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMemoryTrackingRateLimiter } from "../tracking/rate-limit";
import { createEncryptedTrackingV2ContextTokenService } from "../tracking/v2/context-token";
import type { TrackingV2Service } from "../tracking/v2/service";
import { createPublicSiteDocumentRouter } from "./document-router";
import {
  getPublicSiteScreenshotCacheKey,
  PublicSiteScreenshotCapacityError,
  type PublicSiteScreenshotService,
} from "./screenshot";
import type { PublicSiteService } from "./service";
import {
  buildPublicPreviewVersion,
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
} from "@handout/site-document";

describe("public site screenshot route", () => {
  it("serves the recipient JPEG and records Slack's image load against that recipient", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events",
    });
    const recordSlackShare = vi.fn(async (_input: Parameters<TrackingV2Service["recordSlackShare"]>[0]) => ({ recorded: true }));
    const app = createScreenshotTestApp({ bootstrap, contextTokens, recordSlackShare });

    const response = await request(app)
      .get("/aZ7k2Qr9LmNp/embed.jpg?v=33333333-3333-4333-8333-333333333333.7")
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
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events",
    });
    const recordSlackShare = vi.fn(async (_input: Parameters<TrackingV2Service["recordSlackShare"]>[0]) => ({ recorded: true }));
    const app = createScreenshotTestApp({ bootstrap, contextTokens, recordSlackShare });

    await request(app)
      .get("/acme/rollout/ada/embed.jpg")
      .set("user-agent", "Mozilla/5.0 Chrome/149.0")
      .expect(200);

    expect(recordSlackShare).not.toHaveBeenCalled();
  });

  it("records a cached Slack preview through HEAD without rendering the image again", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events",
    });
    const recordSlackShare = vi.fn(async (_input: Parameters<TrackingV2Service["recordSlackShare"]>[0]) => ({ recorded: true }));
    const renderScreenshot = vi.fn(async () => ({
      bytes: Buffer.from("literal-site-jpg"),
      cacheKey: "should-not-be-used",
    }));
    const app = createScreenshotTestApp({
      bootstrap,
      contextTokens,
      recordSlackShare,
      renderScreenshot,
    });

    await request(app)
      .head("/aZ7k2Qr9LmNp/embed.jpg?v=33333333-3333-4333-8333-333333333333.7")
      .set("user-agent", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")
      .expect(204);

    expect(renderScreenshot).not.toHaveBeenCalled();
    const expectedPayload = buildShortLinkPayload();
    expectedPayload.selectedVariant.revisionNumber = 7;
    expect(recordSlackShare).toHaveBeenCalledWith(expect.objectContaining({
      imageCacheKey: getPublicSiteScreenshotCacheKey(expectedPayload),
    }));
  });

  it("redirects legacy PNG URLs to the versioned JPEG endpoint", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events",
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

  it("returns a short no-store retry response when screenshot capacity is busy", async () => {
    const contextTokens = createEncryptedTrackingV2ContextTokenService("test-secret-that-is-long-enough-for-tracking");
    const bootstrap = contextTokens.issue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 7,
      trackingMode: "events",
    });
    const app = createScreenshotTestApp({
      bootstrap,
      contextTokens,
      recordSlackShare: vi.fn(async () => ({ recorded: true })),
      renderScreenshot: async () => {
        throw new PublicSiteScreenshotCapacityError();
      },
    });

    const response = await request(app)
      .get("/aZ7k2Qr9LmNp/embed.jpg?v=33333333-3333-4333-8333-333333333333.7")
      .expect(503);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["retry-after"]).toBe("5");
  });
});

describe("public recipient link routes", () => {
  it("creates or reuses a recipient from a cadence URL without launching screenshot work", async () => {
    const payload = buildShortLinkPayload();
    const warm = vi.fn(async () => ({ bytes: Buffer.from("jpg"), cacheKey: "key" }));
    const publicSiteService: PublicSiteService = {
      async resolve() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveShortLink() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveRecipientLink(input) {
        expect(input).toMatchObject({
          sitePublicId: "Ab3dE5fG7hJ9",
          recipientName: "john",
          recipientCompany: "linear",
          recipientWebsite: "linear.app",
        });
        expect(input.searchParams.get("pain-points")).toBe("- Example point\n- Example point 2");
        return {
          status: "available",
          cacheControl: "public, max-age=60",
          payload,
          shortCode: "aZ7k2Q",
          version: "33333333-3333-4333-8333-333333333333.3",
        };
      },
    };
    const app = express();
    app.use(createPublicSiteDocumentRouter({
      publicSiteOrigin: "https://handout.test",
      publicSiteService,
      screenshotService: { render: warm },
      trackingRateLimiter: createMemoryTrackingRateLimiter(),
    }));

    const response = await request(app)
      .get("/Ab3dE5fG7hJ9/john/linear/linear.app?pain-points=-%20Example%20point%0A-%20Example%20point%202")
      .expect(302);

    expect(response.headers.location).toBe(
      "/aZ7k2Q?v=33333333-3333-4333-8333-333333333333.3",
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(warm).not.toHaveBeenCalled();
  });

  it("resolves a deterministic cadence image URL into the immutable short-code image", async () => {
    const payload = buildShortLinkPayload();
    const render = vi.fn(async () => ({ bytes: Buffer.from("personalized-jpg"), cacheKey: "key" }));
    const resolveRecipientLink = vi.fn(async () => ({
      status: "available" as const,
      cacheControl: "public, max-age=60",
      payload,
      shortCode: "aZ7k2Q",
      version: "33333333-3333-4333-8333-333333333333.3",
    }));
    const publicSiteService: PublicSiteService = {
      async resolve() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveRecipientLink(input) {
        expect(input).toMatchObject({
          sitePublicId: "Ab3dE5fG7hJ9",
          recipientName: "john",
          recipientCompany: "linear",
          recipientWebsite: "linear.app",
        });
        expect(input.searchParams.get("pain-points")).toBe("Slow handoffs");
        return resolveRecipientLink();
      },
      async resolveShortLink(shortCode) {
        expect(shortCode).toBe("aZ7k2Q");
        return resolveRecipientLink();
      },
    };
    const app = express();
    app.use(createPublicSiteDocumentRouter({
      publicSiteOrigin: "https://handout.test",
      publicSiteService,
      screenshotService: { render },
      trackingRateLimiter: createMemoryTrackingRateLimiter(),
    }));

    const resolver = await request(app)
      .get("/Ab3dE5fG7hJ9/john/linear/linear.app/embed.jpg?pain-points=Slow%20handoffs")
      .expect(302);

    const imageLocation = resolver.headers.location;
    expect(imageLocation).toBe(
      "/aZ7k2Q/embed.jpg?v=33333333-3333-4333-8333-333333333333.3",
    );
    expect(resolver.headers["cache-control"]).toBe("no-store");
    expect(resolver.headers["referrer-policy"]).toBe("no-referrer");
    expect(render).not.toHaveBeenCalled();
    if (!imageLocation) throw new Error("Expected deterministic image redirect location.");

    const image = await request(app).get(imageLocation).expect(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect(image.body).toEqual(Buffer.from("personalized-jpg"));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("redirects stale short-image versions before rendering or poisoning an immutable cache key", async () => {
    const payload = buildShortLinkPayload();
    const render = vi.fn(async () => ({ bytes: Buffer.from("current-jpg"), cacheKey: "key" }));
    const publicSiteService: PublicSiteService = {
      async resolve() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveRecipientLink() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveShortLink() {
        return {
          status: "available",
          cacheControl: "public, max-age=60",
          payload,
          shortCode: "aZ7k2Q",
          version: "33333333-3333-4333-8333-333333333333.3",
        };
      },
    };
    const app = express();
    app.use(createPublicSiteDocumentRouter({
      publicSiteOrigin: "https://handout.test",
      publicSiteService,
      screenshotService: { render },
    }));

    const stale = await request(app)
      .get("/aZ7k2Q/embed.jpg?v=old-version.2")
      .expect(302);

    expect(stale.headers.location).toBe(
      "/aZ7k2Q/embed.jpg?v=33333333-3333-4333-8333-333333333333.3",
    );
    expect(stale.headers["cache-control"]).toBe("no-store");
    expect(render).not.toHaveBeenCalled();
  });

  it("applies the cadence query bound to deterministic image resolvers", async () => {
    const publicSiteService: PublicSiteService = {
      async resolve() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveRecipientLink() {
        throw new Error("oversized input must be rejected before resolution");
      },
      async resolveShortLink() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
    };
    const app = express();
    app.use(createPublicSiteDocumentRouter({
      publicSiteOrigin: "https://handout.test",
      publicSiteService,
      screenshotService: { async render() { return null; } },
    }));

    await request(app)
      .get(`/Ab3dE5fG7hJ9/john/linear/linear.app/embed.jpg?pain-points=${"x".repeat(8_193)}`)
      .expect(414)
      .expect("cache-control", "no-store");
  });

  it("keeps the short alias stable while rendering versioned metadata and image URLs", async () => {
    const payload = buildShortLinkPayload();
    const previewVersion = buildPublicPreviewVersion(payload);
    const publicSiteService: PublicSiteService = {
      async resolve() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveRecipientLink() {
        return { status: "unavailable", cacheControl: "no-store" };
      },
      async resolveShortLink() {
        return {
          status: "available",
          cacheControl: "public, max-age=60",
          payload,
          shortCode: "aZ7k2Qr9LmNp",
          version: previewVersion,
        };
      },
    };
    const app = express();
    app.use(createPublicSiteDocumentRouter({
      publicSiteOrigin: "https://handout.test",
      publicSiteService,
      screenshotService: { async render() { return null; } },
    }));

    const alias = await request(app).get("/aZ7k2Qr9LmNp").expect(302);
    expect(alias.headers.location).toContain("/aZ7k2Qr9LmNp?v=");

    const document = await request(app)
      .get(`/aZ7k2Qr9LmNp?v=${encodeURIComponent(previewVersion)}`)
      .expect(200);
    expect(document.text).toContain("<title>John at Linear</title>");
    expect(document.text).toContain('<link rel="canonical" href="https://handout.test/aZ7k2Qr9LmNp">');
    expect(document.text).toContain(
      `content="https://handout.test/aZ7k2Qr9LmNp/embed.jpg?v=${previewVersion}"`,
    );
  });
});

function createScreenshotTestApp(input: {
  bootstrap: { contextToken: string };
  contextTokens: ReturnType<typeof createEncryptedTrackingV2ContextTokenService>;
  recordSlackShare: TrackingV2Service["recordSlackShare"];
  renderScreenshot?: PublicSiteScreenshotService["render"];
}) {
  const payload = buildShortLinkPayload();
  payload.selectedVariant.revisionNumber = 7;
  const trackedPayload = { ...payload, trackingV2: input.bootstrap };
  const publicSiteService: PublicSiteService = {
    async resolve() {
      return {
        status: "available",
        cacheControl: "public, max-age=60",
        payload: trackedPayload,
      };
    },
    async resolveShortLink() {
      return {
        status: "available",
        cacheControl: "public, max-age=60",
        payload: trackedPayload,
        shortCode: "aZ7k2Qr9LmNp",
        version: "33333333-3333-4333-8333-333333333333.7",
      };
    },
    async resolveRecipientLink() {
      return { status: "unavailable", cacheControl: "no-store" };
    },
  };
  const screenshotService: PublicSiteScreenshotService = {
    render: input.renderScreenshot ?? (async () => {
      return {
        bytes: Buffer.from("literal-site-jpg"),
        cacheKey: "workspace:site:version:recipient:7",
      };
    }),
  };
  const trackingService = {
    recordSlackShare: input.recordSlackShare,
  } as unknown as TrackingV2Service;
  const app = express();
  app.use(createPublicSiteDocumentRouter({
    publicSiteOrigin: "https://handout.test",
    publicSiteService,
    screenshotService,
    trackingContextTokens: input.contextTokens,
    trackingRateLimiter: createMemoryTrackingRateLimiter(),
    trackingService,
  }));
  return app;
}

function buildShortLinkPayload() {
  const content = createDefaultSiteContent("Rollout brief");
  content.settings.siteTitle = "John at Linear";
  content.settings.siteDescription = "A personalized brief.";
  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "acme",
      name: "Acme",
      websiteDomain: "acme.com",
      logoUrl: null,
    },
    site: {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "rollout-brief",
      name: "Rollout brief",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      publishedAt: "2026-07-09T12:00:00.000Z",
    },
    metadata: {
      title: "John at Linear",
      description: "A personalized brief.",
      ogImageUrl: null,
      robots: "noindex,nofollow" as const,
    },
    content,
    selectedVariant: {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "linear-john",
      name: "John @ Linear",
      recipientName: "John",
      recipientCompany: "Linear",
      revisionNumber: 3,
      variableValues: {},
    },
    tracking: {
      version: 2 as const,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 3,
      trackingMode: "events" as const,
    },
  };
}
