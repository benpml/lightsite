import { describe, expect, it } from "vitest";
import { createDefaultSiteContent } from "@handout/site-document";
import {
  appBootstrapResponseSchema,
  apiErrorResponseSchema,
  billingSummarySchema,
  completeAccountSetupRequestSchema,
  createSiteRequestSchema,
  listSiteVersionsResponseSchema,
  publishSiteResponseSchema,
  restoreSiteVersionResponseSchema,
  siteDetailResponseSchema,
  createWorkspaceRequestSchema,
  listSitesResponseSchema,
  updateSiteRequestSchema,
  publicSiteResponseSchema,
  setActiveWorkspaceRequestSchema,
  workspaceLogoPreviewQuerySchema,
  workspaceLogoPreviewResponseSchema,
} from "./index";

describe("API contracts", () => {
  it("parses site list responses", () => {
    expect(
      listSitesResponseSchema.parse({
        sites: [],
        nextCursor: null,
        requestId: "request_123",
      }),
    ).toEqual({
      sites: [],
      nextCursor: null,
      requestId: "request_123",
    });
  });

  it("parses content-derived site thumbnails", () => {
    const content = createDefaultSiteContent("Acme launch");

    expect(
      listSitesResponseSchema.parse({
        sites: [
          {
            id: "site_123",
            name: "Acme launch",
            slug: "acme-launch",
            status: "draft",
            thumbnail: {
              content,
            },
          },
        ],
        nextCursor: null,
        requestId: "request_123",
      }),
    ).toMatchObject({
      sites: [
        {
          thumbnail: {
            content,
          },
        },
      ],
    });
  });

  it("normalizes create site requests", () => {
    expect(createSiteRequestSchema.parse({ name: "  Acme brief  " })).toEqual({
      name: "Acme brief",
    });
  });

  it("normalizes update site requests", () => {
    expect(
      updateSiteRequestSchema.parse({
        name: "  Acme launch  ",
        slug: " acme-launch ",
        visibility: "team",
      }),
    ).toEqual({
      name: "Acme launch",
      slug: "acme-launch",
      visibility: "team",
    });
  });

  it("parses site detail responses with effective permissions", () => {
    expect(
      siteDetailResponseSchema.parse({
        site: {
          id: "site_123",
          publicId: "site-public-123",
          name: "Acme launch",
          slug: "acme-launch",
          status: "draft",
          recipientCount: 0,
          visibility: "private",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          publishedAt: null,
          archivedAt: null,
          permissions: {
            canView: true,
            canEdit: true,
            canDuplicate: true,
            canPublish: true,
            canUnpublish: false,
            canArchive: true,
            canRestore: false,
          },
        },
        requestId: "request_123",
      }),
    ).toEqual({
      site: {
        id: "site_123",
        publicId: "site-public-123",
        name: "Acme launch",
        slug: "acme-launch",
        status: "draft",
        recipientCount: 0,
        visibility: "private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        publishedAt: null,
        archivedAt: null,
        permissions: {
          canView: true,
          canEdit: true,
          canDuplicate: true,
          canPublish: true,
          canUnpublish: false,
          canArchive: true,
          canRestore: false,
        },
      },
      requestId: "request_123",
    });
  });

  it("parses site version list responses", () => {
    expect(
      listSiteVersionsResponseSchema.parse({
        versions: [
          {
            id: "version_123",
            siteId: "site_123",
            versionNumber: 1,
            kind: "initial",
            label: "Initial draft",
            createdByUserId: "user_123",
            createdAt: "2026-01-01T00:00:00.000Z",
            publishedAt: null,
          },
        ],
        nextCursor: null,
        requestId: "request_123",
      }),
    ).toEqual({
      versions: [
        {
          id: "version_123",
          siteId: "site_123",
          versionNumber: 1,
          kind: "initial",
          label: "Initial draft",
          createdByUserId: "user_123",
          createdAt: "2026-01-01T00:00:00.000Z",
          publishedAt: null,
        },
      ],
      nextCursor: null,
      requestId: "request_123",
    });
  });

  it("parses site version restore responses", () => {
    expect(
      restoreSiteVersionResponseSchema.parse({
        site: {
          id: "site_123",
          name: "Acme launch",
          slug: "acme-launch",
          status: "draft",
          visibility: "private",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          publishedAt: null,
          archivedAt: null,
          permissions: {
            canView: true,
            canEdit: true,
            canDuplicate: true,
            canPublish: true,
            canUnpublish: false,
            canArchive: true,
            canRestore: false,
          },
        },
        version: {
          id: "version_rollback",
          siteId: "site_123",
          versionNumber: 3,
          kind: "rollback",
          label: "Restored version 1",
          createdByUserId: "user_123",
          createdAt: "2026-01-01T00:00:00.000Z",
          publishedAt: null,
        },
        requestId: "request_123",
      }).version.kind,
    ).toBe("rollback");
  });

  it("parses publish site responses", () => {
    expect(
      publishSiteResponseSchema.parse({
        site: {
          id: "site_123",
          name: "Acme launch",
          slug: "acme-launch",
          status: "published",
          visibility: "private",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          publishedAt: "2026-01-01T00:00:00.000Z",
          archivedAt: null,
          permissions: {
            canView: true,
            canEdit: true,
            canDuplicate: true,
            canPublish: true,
            canUnpublish: true,
            canArchive: true,
            canRestore: false,
          },
        },
        version: {
          id: "version_publish",
          siteId: "site_123",
          versionNumber: 2,
          kind: "publish",
          label: "Published version 2",
          createdByUserId: "user_123",
          createdAt: "2026-01-01T00:00:00.000Z",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
        requestId: "request_123",
      }).version.kind,
    ).toBe("publish");
  });

  it("parses public site payload responses without validating private internals", () => {
    expect(
      publicSiteResponseSchema.parse({
        payload: {
          schemaVersion: 1,
          workspace: {
            slug: "acme",
          },
        },
        requestId: "request_123",
      }),
    ).toEqual({
      payload: {
        schemaVersion: 1,
        workspace: {
          slug: "acme",
        },
      },
      requestId: "request_123",
    });
  });

  it("validates workspace setup input", () => {
    expect(
      createWorkspaceRequestSchema.parse({
        name: "Acme",
        website: "https://acme.com",
      }),
    ).toEqual({
      name: "Acme",
      website: "https://acme.com",
    });
  });

  it("parses app bootstrap responses", () => {
    expect(
      appBootstrapResponseSchema.parse({
        user: {
          id: "user_123",
          email: "jane@acme.com",
          accountSetupComplete: true,
          internalAccess: false,
        },
        activeWorkspace: {
          id: "workspace_123",
          slug: "acme",
          name: "Acme",
          websiteDomain: "acme.com",
          logoUrl: null,
          plan: "core",
          role: "admin",
          membershipId: "membership_123",
        },
        workspaces: [],
        onboarding: {
          nextStep: "app",
        },
        requestId: "request_123",
      }),
    ).toEqual({
      user: {
        id: "user_123",
        email: "jane@acme.com",
        accountSetupComplete: true,
        internalAccess: false,
      },
      activeWorkspace: {
        id: "workspace_123",
        slug: "acme",
        name: "Acme",
        websiteDomain: "acme.com",
        logoUrl: null,
        plan: "core",
        role: "admin",
        membershipId: "membership_123",
      },
      workspaces: [],
      onboarding: {
        nextStep: "app",
      },
      requestId: "request_123",
    });
  });

  it("parses billing summary responses", () => {
    expect(
      billingSummarySchema.parse({
        workspaceId: "workspace_123",
        plan: "core",
        canPublish: true,
        canManageBilling: true,
        hasStripeCustomer: true,
        subscription: {
          status: "active",
          interval: "year",
          seatCount: 2,
          currentPeriodEnd: "2026-12-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
        requestId: "request_123",
      }),
    ).toMatchObject({
      plan: "core",
      subscription: {
        interval: "year",
        seatCount: 2,
      },
    });
  });

  it("normalizes account setup requests", () => {
    expect(
      completeAccountSetupRequestSchema.parse({
        displayName: "  Jane Doe  ",
      }),
    ).toEqual({
      displayName: "Jane Doe",
    });
  });

  it("validates active workspace selection requests", () => {
    expect(
      setActiveWorkspaceRequestSchema.parse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      workspaceId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("normalizes workspace logo preview query input", () => {
    expect(
      workspaceLogoPreviewQuerySchema.parse({
        website: " https://acme.com ",
      }),
    ).toEqual({
      website: "https://acme.com",
      size: 128,
      theme: "light",
    });
  });

  it("parses workspace logo preview responses", () => {
    expect(
      workspaceLogoPreviewResponseSchema.parse({
        enabled: true,
        domain: "acme.com",
        imageUrl: "/api/workspaces/logo-preview/image?domain=acme.com&size=128&theme=light",
        requestId: "request_123",
      }),
    ).toEqual({
      enabled: true,
      domain: "acme.com",
      imageUrl: "/api/workspaces/logo-preview/image?domain=acme.com&size=128&theme=light",
      requestId: "request_123",
    });
  });

  it("parses standard API errors", () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: "request.invalid",
          message: "Invalid request.",
          requestId: "request_123",
          issues: [{ path: ["name"], message: "Required" }],
        },
      }),
    ).toEqual({
      error: {
        code: "request.invalid",
        message: "Invalid request.",
        requestId: "request_123",
        issues: [{ path: ["name"], message: "Required" }],
      },
    });
  });
});
