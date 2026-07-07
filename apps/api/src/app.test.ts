import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  TRACKING_INGEST_ENDPOINT,
  TRACKING_MAX_HEARTBEAT_SECONDS,
  TRACKING_SCRIPT_ENDPOINT,
  TRACKING_SCRIPT_VERSION,
  type TrackingBatch,
  type UnsignedTrackingContext,
} from "@lightsite/tracking-schema";
import { createApp } from "./app";
import type { CurrentActor } from "./auth/current-actor";
import { DEV_AUTH_BYPASS_HEADER } from "./auth/dev-auth";
import {
  buildMemoryAppUserProfile,
  createMemoryBootstrapRepository,
  type BootstrapWorkspaceMembershipRecord,
  type MemoryBootstrapRepositoryInput,
} from "./bootstrap/repository";
import { createBootstrapService } from "./bootstrap/service";
import {
  createMemoryWorkspaceRepository,
  type WorkspaceRecord,
} from "./workspaces/repository";
import type { PublicSiteService } from "./public-sites/service";
import { createPublicSiteService } from "./public-sites/service";
import { createUnavailablePublicSiteRepository } from "./public-sites/repository";
import {
  buildMemorySite,
  buildMemorySiteVersion,
  createMemorySiteRepository,
  type SiteRecord,
  type SiteVersionRecord,
} from "./sites/repository";
import { createSiteService } from "./sites/service";
import {
  createLogoDevPreviewService,
  type WorkspaceLogoPreviewService,
} from "./workspaces/logo-preview";
import {
  createHmacTrackingContextTokenService,
  type TrackingContextTokenService,
} from "./tracking/context-token";
import type {
  TrackingEventSink,
  TrackingEventSinkRecordOptions,
} from "./tracking/event-sink";
import {
  createMemoryTrackingRateLimiter,
  type TrackingRateLimiter,
} from "./tracking/rate-limit";
import type { TrackingService } from "./tracking/service";
import { PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL } from "./tracking/public-script";
import { createWorkspaceService } from "./workspaces/service";
import { logger } from "./lib/logger";

const testActor: CurrentActor = {
  userId: "user_test_123",
  email: "jane@acme.com",
  emailVerified: true,
  name: "Jane Doe",
};
const testTrackingContextTokens = createHmacTrackingContextTokenService(
  "test-tracking-signing-secret-at-least-32-chars",
  { nowSeconds: () => Date.parse("2026-06-14T18:00:00.000Z") / 1000 },
);

function createTestApp(input: {
  initialWorkspaces?: WorkspaceRecord[];
  bootstrap?: MemoryBootstrapRepositoryInput;
  logoPreview?: WorkspaceLogoPreviewService;
  publicSites?: PublicSiteService;
  publicSiteOrigin?: string;
  sites?: SiteRecord[];
  siteVersions?: SiteVersionRecord[];
  trackingContextTokens?: TrackingContextTokenService;
  trackingEvents?: TrackingEventSink;
  trackingRateLimiter?: TrackingRateLimiter;
  actor?: CurrentActor | null;
} = {}) {
  const actor = "actor" in input ? (input.actor ?? null) : testActor;
  const trackingContextTokens = input.trackingContextTokens ?? testTrackingContextTokens;
  const trackingService: TrackingService = {
    async trackingContextIsCurrentlyAcceptable() {
      return true;
    },
    async record(batch, options) {
      await input.trackingEvents?.record(batch, options);
    },
    async listEvents() {
      return {
        events: [],
        nextCursor: null,
      };
    },
    async getSummary() {
      return {
        metrics: {
          humanVisits: 0,
          uniqueSessions: 0,
          averageTimeSpentSeconds: 0,
          maxScrollDepth: 0,
          ctaClicks: 0,
          linkClicks: 0,
          previewLoads: 0,
          lastEngagedAt: null,
        },
        topClickedElements: [],
        variants: [],
      };
    },
  };

  return createApp({
    bootstrap: createBootstrapService(createMemoryBootstrapRepository(input.bootstrap)),
    ...(input.logoPreview ? { logoPreview: input.logoPreview } : {}),
    publicSites:
      input.publicSites ??
      createPublicSiteService(createUnavailablePublicSiteRepository(), {
        trackingContextTokens,
      }),
    publicSiteOrigin: input.publicSiteOrigin ?? "https://pages.lightsite.test",
    sites: createSiteService(createMemorySiteRepository(input.sites, input.siteVersions)),
    trackingContextTokens,
    trackingService,
    ...(input.trackingEvents ? { trackingEvents: input.trackingEvents } : {}),
    ...(input.trackingRateLimiter
      ? { trackingRateLimiter: input.trackingRateLimiter }
      : {}),
    workspaces: createWorkspaceService(createMemoryWorkspaceRepository(input.initialWorkspaces)),
    getCurrentActor: async () => actor,
  });
}

function buildWorkspace(overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: "workspace_test_123",
    name: "Acme",
    slug: "acme",
    websiteDomain: "acme.com",
    logoAssetId: null,
    plan: "basic",
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildBootstrapMembership(
  workspace: WorkspaceRecord,
  overrides: Partial<BootstrapWorkspaceMembershipRecord["membership"]> = {},
): BootstrapWorkspaceMembershipRecord {
  return {
    membership: {
      id: `membership_${workspace.id}`,
      workspaceId: workspace.id,
      userId: testActor.userId,
      role: "admin",
      status: "active",
      ...overrides,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      websiteDomain: workspace.websiteDomain,
      logoAssetId: workspace.logoAssetId,
      plan: workspace.plan,
      status: "active",
    },
  };
}

function createTestAppWithActiveWorkspace(input: {
  workspace?: WorkspaceRecord;
  role?: "admin" | "user";
  sites?: SiteRecord[];
  siteVersions?: SiteVersionRecord[];
} = {}) {
  const workspace = input.workspace ?? buildWorkspace({ plan: "pro" });

  return createTestApp({
    sites: input.sites,
    siteVersions: input.siteVersions,
    bootstrap: {
      profiles: [
        buildMemoryAppUserProfile({
          userId: testActor.userId,
          lastActiveWorkspaceId: workspace.id,
        }),
      ],
      memberships: [
        buildBootstrapMembership(workspace, { role: input.role ?? "admin" }),
      ],
    },
  });
}

function createFakeLogoPreviewService(): WorkspaceLogoPreviewService {
  return {
    async getPreview(input) {
      return {
        enabled: true,
        domain: input.website,
        imageUrl: `/api/workspaces/logo-preview/image?domain=${input.website}&size=${input.size}&theme=${input.theme}`,
      };
    },

    async fetchImage() {
      return {
        body: Uint8Array.from([1, 2, 3]),
        contentType: "image/webp",
        cacheControl: "private, max-age=60",
      };
    },
  };
}

function createRecordingTrackingEventSink() {
  const records: Array<{
    batch: TrackingBatch;
    options: TrackingEventSinkRecordOptions;
  }> = [];
  const sink: TrackingEventSink = {
    async record(batch, options) {
      records.push({ batch, options });
    },
  };

  return {
    records,
    sink,
  };
}

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

function buildTrackingContext(
  overrides: Partial<UnsignedTrackingContext> = {},
) {
  const context = {
    workspaceId: "workspace_test_123",
    siteId: "site_test_123",
    publishedVersionId: "version_test_123",
    variantId: "variant_test_123",
    variantRevision: 3,
    mode: "engagement" as const,
    ...overrides,
  };

  return {
    ...context,
    token: testTrackingContextTokens.sign(context),
  };
}

function buildTrackingViewBatch(
  overrides: {
    batchId?: string;
    eventId?: string;
    sessionId?: string;
  } = {},
) {
  return {
    batchId: overrides.batchId ?? "batch_test_123",
    sentAt: "2026-06-14T18:00:00.000Z",
    events: [
      {
        eventId: overrides.eventId ?? "event_test_123",
        type: "site_viewed",
        occurredAt: "2026-06-14T18:00:00.000Z",
        sessionId: overrides.sessionId ?? "session_test_123",
        context: buildTrackingContext(),
        scriptVersion: TRACKING_SCRIPT_VERSION,
        viewport: {
          width: 1440,
          height: 900,
        },
        referrerHost: "slack.com",
      },
    ],
  };
}

type DraftContentOverrides = {
  schemaVersion?: SiteRecord["draftContent"]["schemaVersion"];
  chrome?: {
    siteHeader?: Partial<SiteRecord["draftContent"]["chrome"]["siteHeader"]>;
    hero?: Partial<SiteRecord["draftContent"]["chrome"]["hero"]>;
  };
  settings?: Partial<SiteRecord["draftContent"]["settings"]>;
  variables?: SiteRecord["draftContent"]["variables"];
  blocks?: SiteRecord["draftContent"]["blocks"];
};

function buildDraftContent(overrides: DraftContentOverrides = {}): SiteRecord["draftContent"] {
  const base = structuredClone(buildMemorySite().draftContent);
  const overrideChrome = overrides.chrome ?? {};
  const overrideSiteHeader = overrideChrome.siteHeader ?? {};
  const overrideHero = overrideChrome.hero ?? {};

  return {
    ...base,
    ...overrides,
    chrome: {
      ...base.chrome,
      ...overrideChrome,
      siteHeader: {
        ...base.chrome.siteHeader,
        ...overrideSiteHeader,
      },
      hero: {
        ...base.chrome.hero,
        ...overrideHero,
      },
    },
    settings: {
      ...base.settings,
      ...overrides.settings,
    },
    variables: overrides.variables ?? base.variables,
    blocks: overrides.blocks ?? base.blocks,
  };
}

function buildPublicHtmlPayload() {
  return {
    schemaVersion: 1,
    workspace: {
      id: "workspace_test_123",
      slug: "acme",
      name: "Acme",
      websiteDomain: "acme.com",
    },
    site: {
      id: "site_test_123",
      slug: "rollout-brief",
      name: "Rollout brief",
      publishedVersionId: "version_test_123",
      publishedAt: "2026-06-14T18:00:00.000Z",
        },
        metadata: {
          title: "Rollout brief for {{company_name}}",
          description: "A concise implementation plan for {{company_name}}.",
          ogImage: null,
          robots: "noindex,nofollow",
        },
        chrome: {
          siteHeader: {
            brandName: "Lightsite",
            logoUrl: null,
            primaryButtonText: "Book implementation review",
            primaryButtonHref: "{{primary_cta_url}}",
            secondaryButtonText: null,
            secondaryButtonHref: null,
            showSecondaryButton: false,
          },
          hero: {
            avatarMode: "single",
            avatarImageUrl: null,
            avatarImageSecondaryUrl: null,
            avatarImageAlt: null,
            avatarImageSecondaryAlt: null,
            eyebrow: "July rollout",
            title: "A focused rollout plan for {{company_name}}",
            subtitle: "A short page for the buying team.",
          },
        },
        variables: [
          {
            id: "company_name",
        name: "Company name",
        type: "text",
        defaultValue: "your team",
      },
      {
        id: "primary_cta_url",
        name: "Primary CTA URL",
        type: "url",
        defaultValue: "https://cal.com/lightsite/implementation-review",
      },
    ],
    selectedVariant: {
      id: "variant_test_123",
      slug: "mira",
      name: "Mira at Acme",
      recipientName: "Mira",
      recipientCompany: "Acme",
      revisionNumber: 3,
      variableValues: {
        company_name: "Acme",
      },
    },
    blocks: [
      {
        id: "text-context",
        type: "text",
        text: "{{company_name}} can move faster with one clean source of truth.",
      },
      {
        id: "cta-primary",
        type: "cta",
        label: "Book implementation review",
        href: "{{primary_cta_url}}",
        style: "primary",
      },
    ],
    tracking: buildTrackingContext(),
  };
}

describe("Lightsite API", () => {
  it("reports health", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/health")
      .set("x-request-id", "test-request-id")
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "lightsite-api",
      requestId: "test-request-id",
    });
    expect(response.headers["x-request-id"]).toBe("test-request-id");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns a dev bootstrap from the local auth bypass without workspace setup", async () => {
    const app = createTestApp({ actor: null });

    const response = await request(app)
      .post("/api/dev/auth-bypass")
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: "dev_user_lightsite",
        email: "dev@lightsite.app",
        name: "Lightsite Dev",
        accountSetupComplete: true,
        internalAccess: true,
      },
      activeWorkspace: {
        id: "00000000-0000-4000-8000-000000000101",
        slug: "lightsite-dev",
        name: "Lightsite Dev",
        role: "admin",
      },
      onboarding: {
        nextStep: "app",
      },
      requestId: expect.any(String),
    });
  });

  it("uses the dev bootstrap with the configured site service when the local bypass header is present", async () => {
    const app = createTestApp({
      actor: null,
      sites: [
        buildMemorySite({
          id: "site_dev_123",
          workspaceId: "00000000-0000-4000-8000-000000000101",
          createdByUserId: testActor.userId,
          updatedByUserId: testActor.userId,
          name: "Acme rollout brief",
          slug: "acme-rollout",
          status: "draft",
          visibility: "team",
        }),
      ],
    });

    const bootstrapResponse = await request(app)
      .get("/api/me")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .expect(200);

    expect(bootstrapResponse.body.activeWorkspace).toMatchObject({
      id: "00000000-0000-4000-8000-000000000101",
      slug: "lightsite-dev",
    });

    const sitesResponse = await request(app)
      .get("/api/sites")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .expect(200);

    expect(sitesResponse.body.sites).toEqual([
      expect.objectContaining({
        id: "site_dev_123",
        name: "Acme rollout brief",
        slug: "acme-rollout",
        status: "draft",
      }),
    ]);
  });

  it("returns a small app bootstrap for the current user", async () => {
    const acmeWorkspace = buildWorkspace({
      id: "workspace_acme",
      name: "Acme",
      slug: "acme",
    });
    const betaWorkspace = buildWorkspace({
      id: "workspace_beta",
      name: "Beta",
      slug: "beta",
      websiteDomain: "beta.com",
    });
    const app = createTestApp({
      bootstrap: {
        profiles: [
          buildMemoryAppUserProfile({
            userId: testActor.userId,
            lastActiveWorkspaceId: betaWorkspace.id,
            accountSetupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
        ],
        internalAccess: [
          {
            userId: testActor.userId,
            canAccessDebugTools: false,
            canAccessSupportTools: true,
          },
        ],
        memberships: [
          buildBootstrapMembership(acmeWorkspace, { role: "user" }),
          buildBootstrapMembership(betaWorkspace, { role: "admin" }),
        ],
      },
    });

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body).toEqual({
      user: {
        id: testActor.userId,
        email: testActor.email,
        name: testActor.name,
        accountSetupComplete: true,
        internalAccess: true,
      },
      activeWorkspace: {
        id: betaWorkspace.id,
        slug: "beta",
        name: "Beta",
        websiteDomain: "beta.com",
        logoUrl: null,
        role: "admin",
        membershipId: `membership_${betaWorkspace.id}`,
      },
      workspaces: [
        {
          id: acmeWorkspace.id,
          slug: "acme",
          name: "Acme",
          websiteDomain: "acme.com",
          logoUrl: null,
          role: "user",
          membershipId: `membership_${acmeWorkspace.id}`,
        },
        {
          id: betaWorkspace.id,
          slug: "beta",
          name: "Beta",
          websiteDomain: "beta.com",
          logoUrl: null,
          role: "admin",
          membershipId: `membership_${betaWorkspace.id}`,
        },
      ],
      onboarding: {
        nextStep: "app",
      },
      requestId: expect.any(String),
    });
  });

  it("requires auth for the app bootstrap", async () => {
    const app = createTestApp({ actor: null });

    const response = await request(app).get("/api/me").expect(401);

    expect(response.body.error).toMatchObject({
      code: "auth.required",
      message: "Sign in to continue.",
      requestId: expect.any(String),
    });
  });

  it("returns account setup before workspace setup", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: testActor.userId,
        email: testActor.email,
        accountSetupComplete: false,
      },
      activeWorkspace: null,
      workspaces: [],
      onboarding: {
        nextStep: "account_setup",
      },
    });
  });

  it("returns workspace setup when account setup is complete without memberships", async () => {
    const app = createTestApp({
      bootstrap: {
        profiles: [
          buildMemoryAppUserProfile({
            userId: testActor.userId,
            accountSetupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
        ],
      },
    });

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body.onboarding).toEqual({
      nextStep: "workspace_setup",
    });
  });

  it("returns the email verification onboarding step first", async () => {
    const app = createTestApp({
      actor: {
        ...testActor,
        emailVerified: false,
      },
      bootstrap: {
        profiles: [
          buildMemoryAppUserProfile({
            userId: testActor.userId,
            accountSetupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
        ],
      },
    });

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body.onboarding).toEqual({
      nextStep: "verify_email",
    });
  });

  it("completes account setup and returns the next bootstrap state", async () => {
    const app = createTestApp();

    const response = await request(app)
      .patch("/api/me/profile")
      .send({ displayName: "  Mira Chen  " })
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: testActor.userId,
        email: testActor.email,
        name: "Mira Chen",
        accountSetupComplete: true,
        internalAccess: false,
      },
      activeWorkspace: null,
      workspaces: [],
      onboarding: {
        nextStep: "workspace_setup",
      },
      requestId: expect.any(String),
    });
  });

  it("switches the active workspace only when the user has active membership", async () => {
    const acmeWorkspace = buildWorkspace({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Acme",
      slug: "acme",
    });
    const betaWorkspace = buildWorkspace({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Beta",
      slug: "beta",
      websiteDomain: "beta.com",
    });
    const app = createTestApp({
      bootstrap: {
        profiles: [
          buildMemoryAppUserProfile({
            userId: testActor.userId,
            lastActiveWorkspaceId: acmeWorkspace.id,
            accountSetupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
        ],
        memberships: [
          buildBootstrapMembership(acmeWorkspace, { role: "user" }),
          buildBootstrapMembership(betaWorkspace, { role: "admin" }),
        ],
      },
    });

    const response = await request(app)
      .put("/api/me/active-workspace")
      .send({ workspaceId: betaWorkspace.id })
      .expect(200);

    expect(response.body.activeWorkspace).toEqual({
      id: betaWorkspace.id,
      slug: "beta",
      name: "Beta",
      websiteDomain: "beta.com",
      logoUrl: null,
      role: "admin",
      membershipId: `membership_${betaWorkspace.id}`,
    });
    expect(response.body.onboarding).toEqual({
      nextStep: "app",
    });
  });

  it("does not switch to a workspace outside the user's active memberships", async () => {
    const app = createTestApp({
      bootstrap: {
        profiles: [
          buildMemoryAppUserProfile({
            userId: testActor.userId,
            accountSetupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
        ],
      },
    });

    const response = await request(app)
      .put("/api/me/active-workspace")
      .send({ workspaceId: "00000000-0000-4000-8000-000000000003" })
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: "workspace.access_denied",
      message: "Workspace is not available for the current user.",
      requestId: expect.any(String),
    });
  });

  it("returns a same-origin logo preview URL without exposing the logo.dev token", async () => {
    const app = createTestApp({
      logoPreview: createLogoDevPreviewService("secret_logo_token"),
    });

    const response = await request(app)
      .get("/api/workspaces/logo-preview")
      .query({ website: "https://www.acme.com/company", size: 128, theme: "light" })
      .expect(200);

    expect(response.body).toEqual({
      enabled: true,
      domain: "acme.com",
      imageUrl: "/api/workspaces/logo-preview/image?domain=acme.com&size=128&theme=light",
      requestId: expect.any(String),
    });
    expect(response.body.imageUrl).not.toContain("secret_logo_token");
    expect(response.body.imageUrl).not.toContain("logo.dev");
  });

  it("keeps workspace setup usable when logo preview is disabled", async () => {
    const app = createTestApp({
      logoPreview: createLogoDevPreviewService(undefined),
    });

    const response = await request(app)
      .get("/api/workspaces/logo-preview")
      .query({ website: "acme.com" })
      .expect(200);

    expect(response.body).toEqual({
      enabled: false,
      domain: "acme.com",
      imageUrl: null,
      requestId: expect.any(String),
    });
  });

  it("proxies workspace logo preview image bytes through the API", async () => {
    const app = createTestApp({
      logoPreview: createFakeLogoPreviewService(),
    });

    const response = await request(app)
      .get("/api/workspaces/logo-preview/image")
      .query({ domain: "acme.com", size: 128, theme: "light" })
      .expect(200);

    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["cache-control"]).toBe("private, max-age=60");
    expect([...response.body]).toEqual([1, 2, 3]);
  });

  it("rejects invalid workspace logo preview websites", async () => {
    const app = createTestApp({
      logoPreview: createLogoDevPreviewService("secret_logo_token"),
    });

    const response = await request(app)
      .get("/api/workspaces/logo-preview")
      .query({ website: "localhost" })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "workspace.website_invalid",
      message: "Enter a public company website.",
      requestId: expect.any(String),
    });
  });

  it("lists sites with an empty cursor payload", async () => {
    const app = createTestAppWithActiveWorkspace();
    const response = await request(app).get("/api/sites").expect(200);

    expect(response.body).toEqual({
      sites: [],
      nextCursor: null,
      requestId: expect.any(String),
    });
  });

  it("lists only sites accessible to a non-admin workspace member", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      role: "user",
      sites: [
        buildMemorySite({
          workspaceId: workspace.id,
          createdByUserId: "another_user",
          name: "Private account plan",
          slug: "private-account-plan",
          visibility: "private",
        }),
        buildMemorySite({
          workspaceId: workspace.id,
          createdByUserId: "another_user",
          name: "Team launch memo",
          slug: "team-launch-memo",
          visibility: "team",
        }),
        buildMemorySite({
          workspaceId: workspace.id,
          createdByUserId: testActor.userId,
          name: "My rollout brief",
          slug: "my-rollout-brief",
          visibility: "private",
        }),
        buildMemorySite({
          workspaceId: "workspace_other",
          createdByUserId: testActor.userId,
          name: "Other workspace",
          slug: "other-workspace",
          visibility: "team",
        }),
      ],
    });

    const response = await request(app).get("/api/sites").expect(200);

    expect(response.body.sites.map((site: { slug: string }) => site.slug).sort()).toEqual([
      "my-rollout-brief",
      "team-launch-memo",
    ]);
  });

  it("allows configured bearer-token agents to manage the configured workspace", async () => {
    const workspace = buildWorkspace({
      id: "workspace_agent_123",
      plan: "pro",
    });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      createdByUserId: "lightsite_agent",
      name: "Agent managed site",
      slug: "agent-managed-site",
    });
    const app = createTestApp({
      actor: null,
      sites: [site],
    });
    const previousEnv = {
      LIGHTSITE_AGENT_API_TOKEN: process.env.LIGHTSITE_AGENT_API_TOKEN,
      LIGHTSITE_AGENT_WORKSPACE_ID: process.env.LIGHTSITE_AGENT_WORKSPACE_ID,
      LIGHTSITE_AGENT_WORKSPACE_PLAN: process.env.LIGHTSITE_AGENT_WORKSPACE_PLAN,
      LIGHTSITE_AGENT_WORKSPACE_ROLE: process.env.LIGHTSITE_AGENT_WORKSPACE_ROLE,
      LIGHTSITE_AGENT_USER_ID: process.env.LIGHTSITE_AGENT_USER_ID,
    };

    process.env.LIGHTSITE_AGENT_API_TOKEN = "agent-test-token";
    process.env.LIGHTSITE_AGENT_WORKSPACE_ID = workspace.id;
    process.env.LIGHTSITE_AGENT_WORKSPACE_PLAN = "pro";
    process.env.LIGHTSITE_AGENT_WORKSPACE_ROLE = "admin";
    process.env.LIGHTSITE_AGENT_USER_ID = "lightsite_agent";

    try {
      const sitesResponse = await request(app)
        .get("/api/sites")
        .set("authorization", "Bearer agent-test-token")
        .expect(200);

      expect(sitesResponse.body.sites).toEqual([
        expect.objectContaining({
          id: site.id,
          slug: "agent-managed-site",
        }),
      ]);

      const contentResponse = await request(app)
        .get(`/api/sites/${site.id}/content`)
        .set("authorization", "Bearer agent-test-token")
        .expect(200);

      expect(contentResponse.body).toMatchObject({
        draftRevision: site.draftRevision,
        draftContent: site.draftContent,
      });

      await request(app)
        .get(`/api/workspaces/${workspace.id}/tracking/summary`)
        .set("authorization", "Bearer agent-test-token")
        .expect(200)
        .expect((response) => {
          expect(response.body.metrics).toMatchObject({
            humanVisits: 0,
            ctaClicks: 0,
          });
        });
    } finally {
      restoreEnv(previousEnv);
    }
  });

  it("rejects incorrect bearer-token agent credentials", async () => {
    const workspace = buildWorkspace({
      id: "workspace_agent_456",
      plan: "pro",
    });
    const app = createTestApp({
      actor: null,
    });
    const previousEnv = {
      LIGHTSITE_AGENT_API_TOKEN: process.env.LIGHTSITE_AGENT_API_TOKEN,
      LIGHTSITE_AGENT_WORKSPACE_ID: process.env.LIGHTSITE_AGENT_WORKSPACE_ID,
    };

    process.env.LIGHTSITE_AGENT_API_TOKEN = "correct-agent-token";
    process.env.LIGHTSITE_AGENT_WORKSPACE_ID = workspace.id;

    try {
      const response = await request(app)
        .get("/api/sites")
        .set("authorization", "Bearer wrong-agent-token")
        .expect(401);

      expect(response.body.error).toMatchObject({
        code: "auth.required",
      });
    } finally {
      restoreEnv(previousEnv);
    }
  });

  it("creates a draft site shell", async () => {
    const app = createTestAppWithActiveWorkspace();
    const response = await request(app)
      .post("/api/sites")
      .send({ name: "Acme rollout brief" })
      .expect(201);

    expect(response.body).toEqual({
      site: {
        id: expect.any(String),
        name: "Acme rollout brief",
        slug: "acme-rollout-brief",
        status: "draft",
      },
      requestId: expect.any(String),
    });

    const listResponse = await request(app).get("/api/sites").expect(200);
    expect(listResponse.body.sites).toEqual([
      {
        id: response.body.site.id,
        name: "Acme rollout brief",
        slug: "acme-rollout-brief",
        status: "draft",
        visibility: "private",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        publishedAt: null,
        archivedAt: null,
      },
    ]);

    const versionsResponse = await request(app)
      .get(`/api/sites/${response.body.site.id}/versions`)
      .expect(200);

    expect(versionsResponse.body).toEqual({
      versions: [
        {
          id: expect.any(String),
          siteId: response.body.site.id,
          versionNumber: 1,
          kind: "initial",
          label: "Initial draft",
          createdByUserId: testActor.userId,
          createdAt: expect.any(String),
          publishedAt: null,
        },
      ],
      nextCursor: null,
      requestId: expect.any(String),
    });
  });

  it("returns site detail with effective permissions", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      name: "Board deck",
      slug: "board-deck",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app).get(`/api/sites/${site.id}`).expect(200);

    expect(response.body.site).toMatchObject({
      id: site.id,
      name: "Board deck",
      slug: "board-deck",
      status: "draft",
      visibility: "private",
      permissions: {
        canView: true,
        canEdit: true,
        canDuplicate: true,
        canArchive: true,
        canRestore: false,
      },
    });
  });

  it("reads, validates, and updates site JSON content with draft revision protection", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const draftContent = buildDraftContent({
      chrome: {
        hero: {
          title: "Acme rollout plan",
          subtitle: "A short plan for the buying committee.",
        },
      },
      variables: [
        {
          id: "var_company_name",
          key: "company_name",
          label: "Company name",
          type: "text",
          defaultValue: "Acme",
        },
      ],
      blocks: [
        {
          id: "heading-overview",
          type: "heading",
          fields: {
            level: 2,
            text: "Why this matters now",
          },
        },
        {
          id: "cta-primary",
          type: "cta",
          fields: {
            label: "Book implementation review",
            href: "{{primary_cta_url}}",
            style: "primary",
          },
        },
      ],
    });

    const contentResponse = await request(app)
      .get(`/api/sites/${site.id}/content`)
      .expect(200);

    expect(contentResponse.body).toMatchObject({
      draftRevision: 1,
      draftContent: site.draftContent,
      requestId: expect.any(String),
    });

    await request(app)
      .post(`/api/sites/${site.id}/content/validate`)
      .send({ draftContent })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          valid: true,
          issues: [],
        });
      });

    const updateResponse = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent,
        changeSummary: "Drafted an account-specific rollout page.",
      })
      .expect(200);

    const normalizedDraftContent = {
      ...draftContent,
      variables: [
        {
          id: "recipient_website",
          key: "recipient_website",
          label: "Recipient website",
          type: "url",
          defaultValue: "",
        },
        ...draftContent.variables,
      ],
    };

    expect(updateResponse.body).toMatchObject({
      draftRevision: 2,
      draftContent: normalizedDraftContent,
      requestId: expect.any(String),
    });

    await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent,
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error).toMatchObject({
          code: "site.draft_revision_conflict",
        });
      });
  });

  it("returns validation issues for structurally valid but unpublishable site JSON", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/content/validate`)
      .send({
        draftContent: buildDraftContent({
          chrome: {
            hero: {
              title: "",
            },
          },
          variables: [
            {
              id: "var_one",
              key: "company_name",
              label: "Company",
              type: "text",
              defaultValue: "Acme",
            },
            {
              id: "var_two",
              key: "company_name",
              label: "Company duplicate",
              type: "text",
              defaultValue: "Acme",
            },
          ],
          blocks: [
            {
              id: "block-one",
              type: "text",
              fields: { text: "One" },
            },
            {
              id: "block-one",
              type: "text",
              fields: { text: "Two" },
            },
          ],
        }),
      })
      .expect(200);

    expect(response.body.valid).toBe(false);
    expect(response.body.issues).toEqual([
      {
        path: ["chrome", "hero", "title"],
        message: "Site title is required before publishing.",
      },
      {
        path: ["variables", 2, "key"],
        message: "Variable key must be unique: company_name",
      },
      {
        path: ["blocks", 1, "id"],
        message: "Block id must be unique: block-one",
      },
    ]);
  });

  it("blocks unsupported or incomplete draft blocks before publish", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const draftContent = buildDraftContent({
      chrome: {
        hero: {
          title: "Procurement plan",
        },
      },
      variables: [],
      blocks: [
        {
          id: "unsupported-proof",
          type: "unsupported_block",
          fields: {},
        },
        {
          id: "cta-primary",
          type: "button",
          fields: {
            label: "",
          },
        },
      ],
    });

    const validateResponse = await request(app)
      .post(`/api/sites/${site.id}/content/validate`)
      .send({ draftContent })
      .expect(200);

    expect(validateResponse.body).toMatchObject({
      valid: false,
      issues: [
        {
          path: ["blocks", 0, "type"],
          message: "Unsupported block type: unsupported_block",
        },
        {
          path: ["blocks", 1, "fields", "label"],
          message: "Button blocks require a label.",
        },
        {
          path: ["blocks", 1, "fields", "href"],
          message: "Button blocks require an href.",
        },
      ],
    });

    await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent,
      })
      .expect(200);

    const publishResponse = await request(app)
      .post(`/api/sites/${site.id}/publish`)
      .expect(400);

    expect(publishResponse.body.error).toMatchObject({
      code: "site.publish_invalid",
      issues: [
        {
          path: ["draftContent", "blocks", 0, "type"],
          message: "Unsupported block type: unsupported_block",
        },
        {
          path: ["draftContent", "blocks", 1, "fields", "label"],
          message: "Button blocks require a label.",
        },
        {
          path: ["draftContent", "blocks", 1, "fields", "href"],
          message: "Button blocks require an href.",
        },
      ],
    });
  });

  it("batch creates and updates site variants by slug", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const createResponse = await request(app)
      .post(`/api/sites/${site.id}/variants/batch`)
      .send({
        matchBy: "slug",
        variants: [
          {
            slug: "Mira Acme",
            name: "Mira at Acme",
            recipientName: "Mira Singh",
            recipientCompany: "Acme",
            variableValues: {
              company_name: "Acme",
              primary_cta_url: "https://cal.example/acme",
            },
          },
          {
            slug: "Jules Northstar",
            name: "Jules at Northstar",
            recipientName: "Jules Lee",
            recipientCompany: "Northstar",
            variableValues: {
              company_name: "Northstar",
            },
          },
        ],
      })
      .expect(200);

    expect(createResponse.body.variants).toHaveLength(2);
    expect(createResponse.body.variants[0]).toMatchObject({
      slug: "mira-acme",
      name: "Mira at Acme",
      revisionNumber: 1,
    });

    const updateResponse = await request(app)
      .post(`/api/sites/${site.id}/variants/batch`)
      .send({
        matchBy: "slug",
        variants: [
          {
            slug: "mira-acme",
            name: "Mira at Acme updated",
            recipientName: "Mira Singh",
            recipientCompany: "Acme Corp",
            variableValues: {
              company_name: "Acme Corp",
            },
          },
        ],
      })
      .expect(200);

    expect(updateResponse.body.variants[0]).toMatchObject({
      slug: "mira-acme",
      name: "Mira at Acme updated",
      recipientCompany: "Acme Corp",
      variableValues: {
        company_name: "Acme Corp",
      },
      revisionNumber: 2,
    });

    const listResponse = await request(app)
      .get(`/api/sites/${site.id}/variants`)
      .expect(200);

    expect(listResponse.body.variants.map((variant: { slug: string }) => variant.slug).sort()).toEqual([
      "jules-northstar",
      "mira-acme",
    ]);
  });

  it("does not reveal inaccessible private sites to non-admin members", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      createdByUserId: "another_user",
      visibility: "private",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      role: "user",
      sites: [site],
    });

    const response = await request(app).get(`/api/sites/${site.id}`).expect(404);

    expect(response.body.error).toMatchObject({
      code: "site.not_found",
      message: "Site is not available for the current user.",
      requestId: expect.any(String),
    });
  });

  it("updates draft site metadata and slug", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      name: "Old name",
      slug: "old-name",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .patch(`/api/sites/${site.id}`)
      .send({
        name: "New rollout brief",
        slug: "new-rollout-brief",
        visibility: "team",
      })
      .expect(200);

    expect(response.body.site).toMatchObject({
      id: site.id,
      name: "New rollout brief",
      slug: "new-rollout-brief",
      status: "draft",
      visibility: "team",
    });
  });

  it("blocks slug changes after a site is published", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      status: "published",
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      publishedVersionId: "00000000-0000-4000-8000-000000000010",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .patch(`/api/sites/${site.id}`)
      .send({ slug: "new-live-slug" })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "site.published_slug_locked",
      message: "Published site slugs cannot be changed while the site is published.",
      requestId: expect.any(String),
    });
  });

  it("publishes a site through an immutable publish version", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      name: "Publishable brief",
      slug: "publishable-brief",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const publishResponse = await request(app)
      .post(`/api/sites/${site.id}/publish`)
      .expect(200);

    expect(publishResponse.body.site).toMatchObject({
      id: site.id,
      status: "published",
      publishedAt: expect.any(String),
      permissions: {
        canPublish: true,
        canUnpublish: true,
      },
    });
    expect(publishResponse.body.version).toMatchObject({
      id: expect.any(String),
      siteId: site.id,
      versionNumber: 2,
      kind: "publish",
      label: "Published version 2",
      createdByUserId: testActor.userId,
      publishedAt: expect.any(String),
    });

    const versionsResponse = await request(app)
      .get(`/api/sites/${site.id}/versions`)
      .expect(200);

    expect(versionsResponse.body.versions.map((version: { kind: string }) => version.kind)).toEqual([
      "publish",
      "initial",
    ]);
  });

  it("unpublishes a live site without deleting publish history", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      status: "published",
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      publishedVersionId: "00000000-0000-4000-8000-000000000012",
    });
    const publishVersion = buildMemorySiteVersion({
      id: "00000000-0000-4000-8000-000000000012",
      workspaceId: workspace.id,
      siteId: site.id,
      versionNumber: 2,
      kind: "publish",
      label: "Published version 2",
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
      siteVersions: [publishVersion],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/unpublish`)
      .expect(200);

    expect(response.body.site).toMatchObject({
      id: site.id,
      status: "draft",
      publishedAt: null,
      permissions: {
        canUnpublish: false,
      },
    });

    const versionsResponse = await request(app)
      .get(`/api/sites/${site.id}/versions`)
      .expect(200);

    expect(versionsResponse.body.versions).toEqual([
      expect.objectContaining({
        id: publishVersion.id,
        kind: "publish",
      }),
    ]);
  });

  it("rejects publish when draft content is not public-renderable", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const invalidContent = buildDraftContent({
      chrome: {
        hero: {
          title: "",
        },
      },
    });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      draftContent: invalidContent,
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/publish`)
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "site.publish_invalid",
      message: "Site is not ready to publish.",
      requestId: expect.any(String),
    });
    expect(response.body.error.issues).toEqual([
      {
        path: ["draftContent", "chrome", "hero", "title"],
        message: "Site title is required before publishing.",
      },
    ]);
  });

  it("rejects publish for users who can only view a team site", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      createdByUserId: "another_user",
      visibility: "team",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      role: "user",
      sites: [site],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/publish`)
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "site.permission_denied",
      message: "You do not have permission to publish this site.",
      requestId: expect.any(String),
    });
  });

  it("lets viewable team sites be duplicated without allowing original mutation", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      createdByUserId: "another_user",
      name: "Team memo",
      slug: "team-memo",
      visibility: "team",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      role: "user",
      sites: [site],
    });

    const archiveResponse = await request(app)
      .post(`/api/sites/${site.id}/archive`)
      .expect(403);

    expect(archiveResponse.body.error).toMatchObject({
      code: "site.permission_denied",
      message: "You do not have permission to manage this site.",
      requestId: expect.any(String),
    });

    const duplicateResponse = await request(app)
      .post(`/api/sites/${site.id}/duplicate`)
      .expect(201);

    expect(duplicateResponse.body.site).toMatchObject({
      id: expect.any(String),
      name: "Copy of Team memo",
      slug: "copy-of-team-memo",
      status: "draft",
    });

    const versionsResponse = await request(app)
      .get(`/api/sites/${duplicateResponse.body.site.id}/versions`)
      .expect(200);

    expect(versionsResponse.body.versions).toEqual([
      expect.objectContaining({
        siteId: duplicateResponse.body.site.id,
        versionNumber: 1,
        kind: "initial",
        label: "Duplicated draft",
        createdByUserId: testActor.userId,
      }),
    ]);
  });

  it("archives published sites as unavailable and restores them as drafts", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      status: "published",
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      publishedVersionId: "00000000-0000-4000-8000-000000000011",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const archiveResponse = await request(app)
      .post(`/api/sites/${site.id}/archive`)
      .expect(200);

    expect(archiveResponse.body.site).toMatchObject({
      id: site.id,
      status: "archived",
      publishedAt: null,
      archivedAt: expect.any(String),
      permissions: {
        canEdit: false,
        canArchive: true,
        canRestore: true,
      },
    });

    const restoreResponse = await request(app)
      .post(`/api/sites/${site.id}/restore`)
      .expect(200);

    expect(restoreResponse.body.site).toMatchObject({
      id: site.id,
      status: "draft",
      publishedAt: null,
      archivedAt: null,
      permissions: {
        canEdit: true,
        canRestore: false,
      },
    });
  });

  it("restores an older site version into draft while preserving history", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const earlierContent = buildDraftContent({
      chrome: {
        hero: {
          title: "Earlier draft",
        },
      },
    });
    const currentContent = buildDraftContent({
      chrome: {
        hero: {
          title: "Current draft",
        },
      },
    });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      draftContent: currentContent,
    });
    const earlierVersion = buildMemorySiteVersion({
      workspaceId: workspace.id,
      siteId: site.id,
      versionNumber: 1,
      kind: "initial",
      label: "Initial draft",
      content: earlierContent,
      variablesSnapshot: earlierContent.variables,
    });
    const currentVersion = buildMemorySiteVersion({
      workspaceId: workspace.id,
      siteId: site.id,
      versionNumber: 2,
      kind: "autosave",
      label: "Autosave",
      content: currentContent,
      variablesSnapshot: currentContent.variables,
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
      siteVersions: [earlierVersion, currentVersion],
    });

    const restoreResponse = await request(app)
      .post(`/api/sites/${site.id}/versions/${earlierVersion.id}/restore`)
      .expect(200);

    expect(restoreResponse.body.version).toMatchObject({
      id: expect.any(String),
      siteId: site.id,
      versionNumber: 3,
      kind: "rollback",
      label: "Restored version 1",
      createdByUserId: testActor.userId,
    });
    expect(restoreResponse.body.site).toMatchObject({
      id: site.id,
      status: "draft",
      permissions: {
        canEdit: true,
      },
    });

    const versionsResponse = await request(app)
      .get(`/api/sites/${site.id}/versions`)
      .expect(200);

    expect(versionsResponse.body.versions.map((version: { kind: string }) => version.kind)).toEqual([
      "rollback",
      "autosave",
      "initial",
    ]);
  });

  it("blocks version restore while the site is archived", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      status: "archived",
      archivedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const version = buildMemorySiteVersion({
      workspaceId: workspace.id,
      siteId: site.id,
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
      siteVersions: [version],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/versions/${version.id}/restore`)
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "site.archived",
      message: "Archived sites must be restored before editing.",
      requestId: expect.any(String),
    });
  });

  it("rejects blank site names", async () => {
    const app = createTestAppWithActiveWorkspace();
    const response = await request(app)
      .post("/api/sites")
      .send({ name: "" })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "site.invalid_payload",
      message: "Invalid site payload.",
      requestId: expect.any(String),
    });
    expect(response.body.error.issues).toHaveLength(1);
  });

  it("rejects duplicate site slugs inside a workspace", async () => {
    const workspace = buildWorkspace({ plan: "pro" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [
        buildMemorySite({
          workspaceId: workspace.id,
          slug: "rollout-brief",
        }),
      ],
    });

    const response = await request(app)
      .post("/api/sites")
      .send({ name: "Rollout brief" })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "site.slug_unavailable",
      message: "Site slug is already taken.",
      requestId: expect.any(String),
    });
  });

  it("enforces the basic workspace site limit", async () => {
    const workspace = buildWorkspace({ plan: "basic" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [
        buildMemorySite({
          workspaceId: workspace.id,
          slug: "existing-site",
        }),
      ],
    });

    const response = await request(app)
      .post("/api/sites")
      .send({ name: "Second site" })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "site.limit_reached",
      message: "This workspace can create up to 1 site on its current plan.",
      requestId: expect.any(String),
    });
  });

  it("requires an active workspace before listing sites", async () => {
    const app = createTestApp();
    const response = await request(app).get("/api/sites").expect(404);

    expect(response.body.error).toMatchObject({
      code: "workspace.access_denied",
      message: "Workspace is not available for the current user.",
      requestId: expect.any(String),
    });
  });

  it("fails closed for unavailable public sites", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/public/sites/acme/rollout-brief")
      .expect(404);

    expect(response.headers["cache-control"]).toBe("public, max-age=15, stale-while-revalidate=15");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.body.error).toMatchObject({
      code: "route.not_found",
      message: "Public site is not available.",
      requestId: expect.any(String),
    });
  });

  it("rejects invalid public slugs without revealing site state", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/public/sites/api/rollout-brief")
      .expect(404);

    expect(response.headers["cache-control"]).toBe("public, max-age=15, stale-while-revalidate=15");
    expect(response.body.error).toMatchObject({
      code: "slug.invalid",
      message: "Invalid public site path.",
      requestId: expect.any(String),
    });
  });

  it("fails closed for unavailable public variant links", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/public/sites/acme/rollout-brief/mira")
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: "route.not_found",
      message: "Public site is not available.",
      requestId: expect.any(String),
    });
  });

  it("rejects invalid public variant slugs without revealing site state", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/public/sites/acme/rollout-brief/settings")
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: "slug.invalid",
      message: "Invalid public site path.",
      requestId: expect.any(String),
    });
  });

  it("returns a public-safe payload from the public site resolver", async () => {
    const app = createTestApp({
      publicSites: {
        async resolve(input) {
          expect(input).toEqual({
            workspaceSlug: "acme",
            siteSlug: "rollout-brief",
            variantSlug: "mira",
          });

          return {
            status: "available",
            cacheControl: "public, max-age=60, stale-while-revalidate=300",
            payload: {
              schemaVersion: 1,
              workspace: {
                slug: "acme",
                name: "Acme",
              },
              site: {
                slug: "rollout-brief",
                name: "Rollout brief",
              },
            },
          };
        },
      },
    });

    const response = await request(app)
      .get("/api/public/sites/acme/rollout-brief/mira")
      .expect(200);

    expect(response.headers["cache-control"]).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    expect(response.body).toEqual({
      payload: {
        schemaVersion: 1,
        workspace: {
          slug: "acme",
          name: "Acme",
        },
        site: {
          slug: "rollout-brief",
          name: "Rollout brief",
        },
      },
      requestId: expect.any(String),
    });
  });

  it("renders server HTML for public site links with metadata and critical content", async () => {
    const app = createTestApp({
      publicSites: {
        async resolve(input) {
          expect(input).toEqual({
            workspaceSlug: "acme",
            siteSlug: "rollout-brief",
            variantSlug: "mira",
          });

          return {
            status: "available",
            cacheControl: "public, max-age=60, stale-while-revalidate=300",
            payload: buildPublicHtmlPayload(),
          };
        },
      },
    });

    const response = await request(app)
      .get("/acme/rollout-brief/mira")
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(response.text).toContain("<title>Rollout brief for Acme</title>");
    expect(response.text).toContain('content="https://pages.lightsite.test/acme/rollout-brief/mira"');
    expect(response.text).toContain("A focused rollout plan for Acme");
    expect(response.text).toContain("Book implementation review");
    expect(response.text).toContain('data-track-click-id="cta-primary"');
    expect(response.text).toContain(`src="${TRACKING_SCRIPT_ENDPOINT}"`);
    expect(response.text).toContain("data-lightsite-tracking=");
  });

  it("records public HTML preview loads for known preview bots without blocking rendering", async () => {
    const trackingEvents = createRecordingTrackingEventSink();
    const app = createTestApp({
      trackingEvents: trackingEvents.sink,
      publicSites: {
        async resolve() {
          return {
            status: "available",
            cacheControl: "public, max-age=60, stale-while-revalidate=300",
            payload: buildPublicHtmlPayload(),
          };
        },
      },
    });

    const response = await request(app)
      .get("/acme/rollout-brief/mira")
      .set("user-agent", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")
      .expect(200);

    expect(response.text).toContain("<title>Rollout brief for Acme</title>");
    expect(trackingEvents.records).toHaveLength(1);
    expect(trackingEvents.records[0]?.options).toEqual({ source: "preview_html" });
    expect(trackingEvents.records[0]?.batch.events[0]).toMatchObject({
      type: "link_preview_loaded",
      platform: "slack",
      resource: "html",
      userAgentFamily: "slackbot",
      context: {
        workspaceId: "workspace_test_123",
        siteId: "site_test_123",
        publishedVersionId: "version_test_123",
        variantId: "variant_test_123",
        variantRevision: 3,
        mode: "engagement",
      },
    });
  });

  it("does not record preview events for ordinary public HTML requests", async () => {
    const trackingEvents = createRecordingTrackingEventSink();
    const app = createTestApp({
      trackingEvents: trackingEvents.sink,
      publicSites: {
        async resolve() {
          return {
            status: "available",
            cacheControl: "public, max-age=60, stale-while-revalidate=300",
            payload: buildPublicHtmlPayload(),
          };
        },
      },
    });

    await request(app)
      .get("/acme/rollout-brief/mira")
      .set("user-agent", "Mozilla/5.0")
      .expect(200);

    expect(trackingEvents.records).toEqual([]);
  });

  it("rate limits repeated public HTML preview events by public page identity", async () => {
    const trackingEvents = createRecordingTrackingEventSink();
    const app = createTestApp({
      trackingEvents: trackingEvents.sink,
      trackingRateLimiter: createMemoryTrackingRateLimiter({
        maxEventsPerWindow: 1,
        windowMs: 60_000,
        nowMs: () => Date.parse("2026-06-14T18:00:00.000Z"),
      }),
      publicSites: {
        async resolve() {
          return {
            status: "available",
            cacheControl: "public, max-age=60, stale-while-revalidate=300",
            payload: buildPublicHtmlPayload(),
          };
        },
      },
    });

    await request(app)
      .get("/acme/rollout-brief/mira")
      .set("user-agent", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")
      .expect(200);
    await request(app)
      .get("/acme/rollout-brief/mira")
      .set("user-agent", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")
      .expect(200);

    expect(trackingEvents.records).toHaveLength(1);
    expect(trackingEvents.records[0]?.batch.events[0]).toMatchObject({
      type: "link_preview_loaded",
      platform: "slack",
    });
  });

  it("serves the standalone public tracking script with immutable caching", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get(TRACKING_SCRIPT_ENDPOINT)
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/javascript");
    expect(response.headers["cache-control"]).toBe(PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain(TRACKING_SCRIPT_VERSION);
    expect(response.text).toContain(TRACKING_INGEST_ENDPOINT);
    expect(response.text).toContain("data-lightsite-tracking");
  });

  it("serves public renderer assets before the public HTML fallback", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/lightsite-logo.svg")
      .expect(200);
    const body = response.text ?? response.body.toString("utf8");

    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cache-control"]).toContain("max-age=");
    expect(body).toContain("<svg");
    expect(body).not.toContain("This page is unavailable");
  });

  it("renders generic server HTML for unavailable public site links", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/acme/rollout-brief")
      .expect(404);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("public, max-age=15, stale-while-revalidate=15");
    expect(response.text).toContain("<title>Page unavailable | Lightsite</title>");
    expect(response.text).toContain('content="noindex,nofollow"');
    expect(response.text).toContain("This page is unavailable");
  });

  it("keeps unknown API paths on the API error envelope instead of public HTML", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/not-a-real-route")
      .expect(404);

    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body.error).toMatchObject({
      code: "route.not_found",
      requestId: expect.any(String),
    });
  });

  it("accepts valid public tracking batches", async () => {
    const trackingEvents = createRecordingTrackingEventSink();
    const app = createTestApp({
      trackingEvents: trackingEvents.sink,
    });

    await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send(buildTrackingViewBatch())
      .expect(204);

    expect(trackingEvents.records).toHaveLength(1);
    expect(trackingEvents.records[0]?.options).toEqual({ source: "browser" });
    expect(trackingEvents.records[0]?.batch.events[0]).toMatchObject({
      type: "site_viewed",
      sessionId: "session_test_123",
    });
  });

  it("accepts valid public tracking batches when the sink is temporarily unavailable", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const app = createTestApp({
      trackingEvents: {
        async record() {
          throw new Error("tracking sink unavailable");
        },
      },
    });

    try {
      await request(app)
        .post(TRACKING_INGEST_ENDPOINT)
        .send(buildTrackingViewBatch())
        .expect(204);

      expect(warn).toHaveBeenCalledWith(
        "Tracking event sink failed after batch acceptance.",
        expect.objectContaining({
          eventCount: 1,
          siteId: "site_test_123",
          publishedVersionId: "version_test_123",
          variantId: "variant_test_123",
          source: "browser",
        }),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects public tracking batches with forged context", async () => {
    const app = createTestApp();
    const batch = buildTrackingViewBatch();
    const event = batch.events[0];

    if (!event) {
      throw new Error("Expected tracking test batch to include an event.");
    }

    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        ...batch,
        events: [
          {
            ...event,
            context: {
              ...buildTrackingContext(),
              siteId: "site_forged_123",
            },
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      message: "Invalid tracking context.",
      requestId: expect.any(String),
    });
  });

  it("rejects public tracking batches that mix visitor scopes", async () => {
    const app = createTestApp();
    const batch = buildTrackingViewBatch();
    const event = batch.events[0];

    if (!event) {
      throw new Error("Expected tracking test batch to include an event.");
    }

    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        ...batch,
        events: [
          event,
          {
            ...event,
            eventId: "event_test_other_scope",
            sessionId: "session_other_123",
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      requestId: expect.any(String),
    });
  });

  it("rejects public tracking events when the signed context disables tracking", async () => {
    const app = createTestApp();
    const batch = buildTrackingViewBatch();
    const event = batch.events[0];

    if (!event) {
      throw new Error("Expected tracking test batch to include an event.");
    }

    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        ...batch,
        events: [
          {
            ...event,
            context: buildTrackingContext({ mode: "off" }),
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      requestId: expect.any(String),
    });
  });

  it("rejects signed public tracking contexts with mismatched variant fields", async () => {
    const app = createTestApp();
    const batch = buildTrackingViewBatch();
    const event = batch.events[0];

    if (!event) {
      throw new Error("Expected tracking test batch to include an event.");
    }

    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        ...batch,
        events: [
          {
            ...event,
            context: buildTrackingContext({
              variantId: null,
              variantRevision: 3,
            }),
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      requestId: expect.any(String),
    });
  });

  it("rejects engagement events for essential-only signed contexts", async () => {
    const app = createTestApp();
    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        batchId: "batch_test_essential",
        sentAt: "2026-06-14T18:00:00.000Z",
        events: [
          {
            eventId: "event_test_essential",
            type: "heartbeat",
            occurredAt: "2026-06-14T18:00:00.000Z",
            sessionId: "session_test_123",
            context: buildTrackingContext({ mode: "essential_only" }),
            scriptVersion: TRACKING_SCRIPT_VERSION,
            engagedSeconds: 15,
            maxScrollDepthPercent: 50,
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_context",
      requestId: expect.any(String),
    });
  });

  it("rate limits noisy public tracking sessions without disabling other sessions", async () => {
    const app = createTestApp({
      trackingRateLimiter: createMemoryTrackingRateLimiter({
        maxEventsPerWindow: 1,
        windowMs: 60_000,
        nowMs: () => Date.parse("2026-06-14T18:00:00.000Z"),
      }),
    });

    await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send(buildTrackingViewBatch())
      .expect(204);

    const rateLimitedResponse = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send(
        buildTrackingViewBatch({
          batchId: "batch_test_456",
          eventId: "event_test_456",
        }),
      )
      .expect(429);

    expect(rateLimitedResponse.headers["retry-after"]).toBe("60");
    expect(rateLimitedResponse.body.error).toMatchObject({
      code: "tracking.rate_limited",
      message: "Tracking is receiving too many events. Try again shortly.",
      requestId: expect.any(String),
    });

    await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send(
        buildTrackingViewBatch({
          batchId: "batch_test_789",
          eventId: "event_test_789",
          sessionId: "session_other_123",
        }),
      )
      .expect(204);
  });

  it("rejects invalid public tracking batches", async () => {
    const app = createTestApp();
    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        batchId: "",
        sentAt: "not-a-date",
        events: [],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_payload",
      message: "Invalid tracking payload.",
      requestId: expect.any(String),
    });
    expect(response.body.error.issues.length).toBeGreaterThan(0);
  });

  it("rejects malformed JSON request bodies with a structured client error", async () => {
    const app = createTestApp();
    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .set("content-type", "application/json")
      .send("{")
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "request.invalid",
      message: "Invalid JSON request body.",
      requestId: expect.any(String),
    });
  });

  it("rejects public tracking URLs that contain sensitive URL parts", async () => {
    const app = createTestApp();
    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        batchId: "batch_test_123",
        sentAt: "2026-06-14T18:00:00.000Z",
        events: [
          {
            eventId: "event_test_123",
            type: "link_clicked",
            occurredAt: "2026-06-14T18:00:00.000Z",
            sessionId: "session_test_123",
            context: buildTrackingContext(),
            scriptVersion: TRACKING_SCRIPT_VERSION,
            elementId: "cta-primary",
            label: "Book implementation review",
            href: "https://cal.com/lightsite/review?token=secret#details",
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_payload",
      requestId: expect.any(String),
    });
  });

  it("rejects heartbeat windows that would inflate time spent", async () => {
    const app = createTestApp();
    const response = await request(app)
      .post(TRACKING_INGEST_ENDPOINT)
      .send({
        batchId: "batch_test_123",
        sentAt: "2026-06-14T18:00:00.000Z",
        events: [
          {
            eventId: "event_test_123",
            type: "heartbeat",
            occurredAt: "2026-06-14T18:00:00.000Z",
            sessionId: "session_test_123",
            context: buildTrackingContext(),
            scriptVersion: TRACKING_SCRIPT_VERSION,
            engagedSeconds: TRACKING_MAX_HEARTBEAT_SECONDS + 1,
            maxScrollDepthPercent: 75,
          },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "tracking.invalid_payload",
      requestId: expect.any(String),
    });
  });

  it("reports workspace slug availability", async () => {
    const app = createTestApp({
      initialWorkspaces: [buildWorkspace({ slug: "acme" })],
    });

    const availableResponse = await request(app)
      .get("/api/workspaces/slug-availability")
      .query({ slug: "Beta Team" })
      .expect(200);

    expect(availableResponse.body).toEqual({
      slug: "beta-team",
      available: true,
      requestId: expect.any(String),
    });

    const takenResponse = await request(app)
      .get("/api/workspaces/slug-availability")
      .query({ slug: "acme" })
      .expect(200);

    expect(takenResponse.body).toEqual({
      slug: "acme",
      available: false,
      requestId: expect.any(String),
    });
  });

  it("rejects reserved workspace slugs during availability checks", async () => {
    const app = createTestApp();

    const response = await request(app)
      .get("/api/workspaces/slug-availability")
      .query({ slug: "settings" })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "slug.invalid",
      message: "Workspace slug is reserved.",
      requestId: expect.any(String),
    });
  });

  it("creates a workspace and admin membership for the current actor", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/workspaces")
      .send({
        name: "Acme Sales",
        website: "https://www.acme.com/company",
      })
      .expect(201);

    expect(response.body).toEqual({
      workspace: {
        id: expect.any(String),
        name: "Acme Sales",
        slug: "acme-sales",
        websiteDomain: "acme.com",
        logoAssetId: null,
        plan: "basic",
        status: "active",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      membership: {
        id: expect.any(String),
        workspaceId: expect.any(String),
        userId: "user_test_123",
        role: "admin",
        status: "active",
      },
      requestId: expect.any(String),
    });
    expect(response.body.membership.workspaceId).toBe(response.body.workspace.id);
  });

  it("requires auth before creating a workspace", async () => {
    const app = createApp({
      workspaces: createWorkspaceService(createMemoryWorkspaceRepository()),
      getCurrentActor: async () => null,
    });

    const response = await request(app)
      .post("/api/workspaces")
      .send({
        name: "Acme",
        website: "acme.com",
      })
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: "auth.required",
      message: "Sign in to create a workspace.",
      requestId: expect.any(String),
    });
  });

  it("rejects workspace creation when the slug is already taken", async () => {
    const app = createTestApp({
      initialWorkspaces: [buildWorkspace({ slug: "acme" })],
    });

    const response = await request(app)
      .post("/api/workspaces")
      .send({
        name: "Acme",
        slug: "acme",
        website: "acme.com",
      })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "workspace.slug_unavailable",
      message: "Workspace slug is already taken.",
      requestId: expect.any(String),
    });
  });

  it("rejects placeholder workspace websites", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/workspaces")
      .send({
        name: "Example",
        website: "example.com",
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "workspace.website_invalid",
      message: "Enter your real company website.",
      requestId: expect.any(String),
    });
  });
});
