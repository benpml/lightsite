import { describe, expect, it } from "vitest";
import { createPublicSiteService } from "./service";
import type { PublicSiteLookupInput, PublicSiteRepository } from "./repository";
import { createEncryptedTrackingV2ContextTokenService } from "../tracking/v2/context-token";

function createRecordingRepository(record: { payload: unknown } | null) {
  const calls: PublicSiteLookupInput[] = [];
  const repository: PublicSiteRepository = {
    async findPublishedSite(input) {
      calls.push(input);
      return record;
    },
  };

  return { calls, repository };
}

describe("public site service", () => {
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
      schemaVersion: 1,
      tracking: {
        version: 2,
        workspaceId: "11111111-1111-4111-8111-111111111111",
        siteId: "22222222-2222-4222-8222-222222222222",
        publishedVersionId: "33333333-3333-4333-8333-333333333333",
        recipientId: "44444444-4444-4444-8444-444444444444",
        recipientRevision: 3,
        trackingMode: "events_and_recording",
      },
    };
    const { repository } = createRecordingRepository({ payload });
    const service = createPublicSiteService(repository, { trackingV2ContextTokens });
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
          trackingMode: "events_and_recording",
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
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 3,
      trackingMode: "events_and_recording",
    });
  });
});
