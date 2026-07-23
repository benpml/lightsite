import { describe, expect, it } from "vitest";
import { createPublicSiteService } from "./service";
import type { PublicSiteLookupInput, PublicSiteRepository } from "./repository";
import { createEncryptedTrackingV2ContextTokenService } from "../tracking/v2/context-token";
import {
  buildPublicPreviewVersion,
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
} from "@handout/site-document";

function createRecordingRepository(record: { payload: unknown } | null) {
  const calls: PublicSiteLookupInput[] = [];
  const repository: PublicSiteRepository = {
    async findPublishedSite(input) {
      calls.push(input);
      return record;
    },
    async findPublishedSiteByShortCode() {
      return null;
    },
    async resolveExistingRecipientLink() {
      return null;
    },
  };

  return { calls, repository };
}

describe("public site service", () => {
  it.each(["aZ7k2Q", "aZ7k2Qr9LmNp"])(
    "resolves current and legacy recipient short code %s",
    async (shortCode) => {
    const payload = buildRecipientPayload();
    const repository: PublicSiteRepository = {
      async findPublishedSite() {
        return null;
      },
      async findPublishedSiteByShortCode(shortCode) {
        return { shortCode, payload };
      },
      async resolveExistingRecipientLink() {
        return null;
      },
    };
    const service = createPublicSiteService(repository);

    await expect(service.resolveShortLink(shortCode)).resolves.toMatchObject({
      status: "available",
      shortCode,
      version: buildPublicPreviewVersion(payload),
      payload,
    });
    },
  );

  it("rejects malformed public identifiers before repository access", async () => {
    let calls = 0;
    const repository: PublicSiteRepository = {
      async findPublishedSite() {
        return null;
      },
      async findPublishedSiteByShortCode() {
        calls += 1;
        return null;
      },
      async resolveExistingRecipientLink() {
        calls += 1;
        return null;
      },
    };
    const service = createPublicSiteService(repository);

    await expect(service.resolveShortLink("short")).resolves.toMatchObject({
      status: "invalid_slug",
    });
    await expect(service.resolveRecipientLink({
      sitePublicId: "bad",
      recipientName: "John",
      recipientCompany: "Linear",
      recipientWebsite: "linear.app",
      searchParams: new URLSearchParams(),
    })).resolves.toMatchObject({ status: "invalid_slug" });
    expect(calls).toBe(0);
  });

  it("normalizes route slugs before looking up a published site", async () => {
    const { calls, repository } = createRecordingRepository({
      payload: {
        schemaVersion: 1,
        site: {
          slug: "rollout-brief",
        },
      },
    });
    const service = createPublicSiteService(repository);

    await expect(
      service.resolve({
        workspaceSlug: " Acme ",
        siteSlug: "Rollout Brief",
        variantSlug: "Mira Singh",
      }),
    ).resolves.toMatchObject({
      status: "available",
      cacheControl: "public, max-age=60, stale-while-revalidate=300",
    });

    expect(calls).toEqual([
      {
        workspaceSlug: "acme",
        siteSlug: "rollout-brief",
        variantSlug: "mira-singh",
      },
    ]);
  });

  it("fails invalid public paths before repository lookup", async () => {
    const { calls, repository } = createRecordingRepository({
      payload: { schemaVersion: 1 },
    });
    const service = createPublicSiteService(repository);

    await expect(
      service.resolve({
        workspaceSlug: "api",
        siteSlug: "rollout-brief",
      }),
    ).resolves.toEqual({
      status: "invalid_slug",
      message: "Invalid public site path.",
      cacheControl: "public, max-age=15, stale-while-revalidate=15",
    });

    expect(calls).toEqual([]);
  });

  it("fails closed when the repository returns no public payload", async () => {
    const { repository } = createRecordingRepository({
      payload: null,
    });
    const service = createPublicSiteService(repository);

    await expect(
      service.resolve({
        workspaceSlug: "acme",
        siteSlug: "rollout-brief",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      cacheControl: "public, max-age=15, stale-while-revalidate=15",
    });
  });

  it("adds an opaque v2 tracking bootstrap when v2 tracking is enabled", async () => {
    const trackingV2ContextTokens = createEncryptedTrackingV2ContextTokenService(
      "tracking-v2-context-secret-at-least-32-characters",
      {
        keyId: "service-test",
        now: () => new Date("2026-07-09T12:00:00.000Z"),
        randomBytes: (size) => Buffer.alloc(size, 7),
      },
    );
    const payload = {
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
        title: "Rollout brief",
        description: "A focused plan.",
        ogImageUrl: null,
        robots: "noindex,nofollow",
      },
      content: createDefaultSiteContent("Rollout brief"),
      selectedVariant: {
        id: "44444444-4444-4444-8444-444444444444",
        slug: "mira",
        name: "Mira",
        recipientName: "Mira",
        recipientCompany: "Acme",
        revisionNumber: 3,
        variableValues: {},
      },
      tracking: {
        version: 2,
        workspaceId: "11111111-1111-4111-8111-111111111111",
        siteId: "22222222-2222-4222-8222-222222222222",
        publishedVersionId: "33333333-3333-4333-8333-333333333333",
        recipientId: "44444444-4444-4444-8444-444444444444",
        recipientRevision: 3,
        trackingMode: "events",
      },
    };
    const { repository } = createRecordingRepository({ payload });
    const service = createPublicSiteService(repository, {
      trackingV2ContextTokens,
      trackingV2Service: {
        preparePublicContext: async () => ({
          workspaceId: "11111111-1111-4111-8111-111111111111",
          siteId: "22222222-2222-4222-8222-222222222222",
          publishedVersionId: "33333333-3333-4333-8333-333333333333",
          manifestId: "55555555-5555-4555-8555-555555555555",
          recipientId: "44444444-4444-4444-8444-444444444444",
          recipientRevision: 3,
          trackingMode: "events",
        }),
      },
    });
    const result = await service.resolve({
      workspaceSlug: "acme",
      siteSlug: "rollout-brief",
      variantSlug: "mira",
    });

    expect(result).toMatchObject({
      status: "available",
      payload: {
        trackingV2: {
          version: 2,
          trackingMode: "events",
          contextToken: expect.any(String),
          issuedAt: "2026-07-09T12:00:00.000Z",
          expiresAt: "2026-07-10T12:00:00.000Z",
        },
      },
    });

    if (result.status !== "available") {
      throw new Error("Expected public site to resolve.");
    }

    const trackingV2 = result.payload.trackingV2 as { contextToken: string };
    expect(trackingV2.contextToken).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(trackingV2ContextTokens.verify(trackingV2.contextToken)).toMatchObject({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      manifestId: "55555555-5555-4555-8555-555555555555",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 3,
      trackingMode: "events",
    });
  });
});

function buildRecipientPayload() {
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
    content: createDefaultSiteContent("Rollout brief"),
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
