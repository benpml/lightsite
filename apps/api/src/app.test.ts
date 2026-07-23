import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  HANDOUT_COLLECTION_LIMITS,
  HANDOUT_TEXT_LIMITS,
} from "@handout/domain";
import {
  createDefaultSiteContent,
  defaultSiteDefaults,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  PUBLIC_SITE_RUNTIME_PATH,
  type PublishedSitePayload,
  type SiteContent,
  type TiptapNode,
} from "@handout/site-document";
import { createApp } from "./app";
import type { CurrentActor } from "./auth/current-actor";
import { DEV_AUTH_BYPASS_HEADER, setDevProfileImageUrl } from "./auth/dev-auth";
import {
  buildMemoryAppUserProfile,
  createMemoryBootstrapRepository,
  type BootstrapWorkspaceMembershipRecord,
  type MemoryBootstrapRepositoryInput,
} from "./bootstrap/repository";
import { createBootstrapService } from "./bootstrap/service";
import type { BillingService } from "./billing/service";
import {
  createMemoryWorkspaceRepository,
  type WorkspaceRecord,
} from "./workspaces/repository";
import type { PublicSiteService } from "./public-sites/service";
import { createPublicSiteService } from "./public-sites/service";
import { createUnavailablePublicSiteRepository } from "./public-sites/repository";
import { createMemoryRecipientLogoRepository } from "./recipient-logos/repository";
import { createRecipientLogoService } from "./recipient-logos/service";
import {
  buildMemorySite,
  buildMemorySiteVersion,
  createMemorySiteRepository,
  type SiteRecord,
  type SiteVariantRecord,
  type SiteVersionRecord,
} from "./sites/repository";
import { createSiteService } from "./sites/service";
import {
  createMemoryTeamRepository,
  type TeamInvitationRecord,
  type TeamMemberRecord,
} from "./team/repository";
import { encodeWorkspaceInviteCode } from "./team/invite-code";
import { createTeamService, type TeamService } from "./team/service";
import {
  createLogoDevPreviewService,
  type WorkspaceLogoPreviewService,
} from "./workspaces/logo-preview";
import { createWorkspaceService } from "./workspaces/service";

const testActor: CurrentActor = {
  userId: "user_test_123",
  email: "jane@acme.com",
  emailVerified: true,
  name: "Jane Doe",
};
const unavailablePublicLinkMethods = {
  async resolveShortLink() {
    return { status: "unavailable" as const, cacheControl: "no-store" };
  },
  async resolveRecipientLink() {
    return { status: "unavailable" as const, cacheControl: "no-store" };
  },
};
function createTestApp(input: {
  initialWorkspaces?: WorkspaceRecord[];
  bootstrap?: MemoryBootstrapRepositoryInput;
  logoPreview?: WorkspaceLogoPreviewService;
  publicSites?: PublicSiteService;
  billing?: BillingService;
  publicSiteOrigin?: string;
  sites?: SiteRecord[];
  siteVariants?: SiteVariantRecord[];
  siteVersions?: SiteVersionRecord[];
  team?: TeamService;
  actor?: CurrentActor | null;
} = {}) {
  const actor = "actor" in input ? (input.actor ?? null) : testActor;
  const logoPreview = input.logoPreview ?? createLogoDevPreviewService(undefined);

  return createApp({
    billing: input.billing ?? createFakeBillingService(),
    bootstrap: createBootstrapService(createMemoryBootstrapRepository(input.bootstrap)),
    logoPreview,
    recipientLogos: createRecipientLogoService(
      createMemoryRecipientLogoRepository(),
      logoPreview,
    ),
    publicSites:
      input.publicSites ??
      createPublicSiteService(createUnavailablePublicSiteRepository()),
    publicSiteOrigin: input.publicSiteOrigin ?? "https://pages.handout.test",
    sites: createSiteService(createMemorySiteRepository(
      input.sites,
      input.siteVersions,
      input.siteVariants,
    )),
    ...(input.team ? { team: input.team } : {}),
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
    plan: "free",
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
  billing?: BillingService;
  sites?: SiteRecord[];
  siteVariants?: SiteVariantRecord[];
  siteVersions?: SiteVersionRecord[];
} = {}) {
  const workspace = input.workspace ?? buildWorkspace({ plan: "core" });

  return createTestApp({
    billing: input.billing,
    sites: input.sites,
    siteVariants: input.siteVariants,
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

function createFakeBillingService(): BillingService {
  return {
    async getSummary(input) {
      return {
        workspaceId: input.workspace.id,
        plan: input.workspace.plan,
        canPublish: input.workspace.plan !== "free",
        canManageBilling: input.workspace.role === "admin",
        hasStripeCustomer: true,
        subscription: {
          status: "active",
          interval: "month",
          seatCount: 1,
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      };
    },

    async createCheckoutSession() {
      return {
        url: "https://billing.stripe.test/checkout",
      };
    },

    async createPortalSession() {
      return {
        url: "https://billing.stripe.test/portal",
      };
    },

    async handleWebhook() {
      return undefined;
    },

    async updateSubscription() {
      return undefined;
    },

    async cancelSubscription() {
      return { currentPeriodEnd: "2026-02-01T00:00:00.000Z" };
    },

    async syncSeatCount() {
      return undefined;
    },
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

type DraftContentOverrides = Omit<Partial<SiteContent>, "pages" | "settings"> & {
  document?: TiptapNode;
  pages?: SiteContent["pages"];
  settings?: Partial<SiteContent["settings"]>;
};

function buildDraftContent(overrides: DraftContentOverrides = {}): SiteRecord["draftContent"] {
  const base = structuredClone(buildMemorySite().draftContent);
  const { document, pages, settings, ...contentOverrides } = overrides;

  return {
    ...base,
    ...contentOverrides,
    settings: {
      ...base.settings,
      ...(settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : {}),
    },
    pages: pages ?? [{
      ...base.pages[0]!,
      document: document ?? base.pages[0]!.document,
    }],
  };
}

function buildPublicHtmlPayload(): PublishedSitePayload {
  const content = createDefaultSiteContent("Rollout brief")
  content.variables.push(
    {
      id: "company_name",
      key: "company_name",
      label: "Company name",
      type: "text",
      defaultValue: "your team",
    },
    {
      id: "primary_cta_url",
      key: "primary_cta_url",
      label: "Primary CTA URL",
      type: "url",
      defaultValue: "https://cal.com/handout/implementation-review",
    },
  )
  content.pages[0]!.document = {
    type: "doc",
    content: [
      {
        type: "pageTitleSection",
        attrs: { id: "hero", align: "center" },
        content: [
          {
            type: "pageTitleTitle",
            content: [
              { type: "text", text: "A focused rollout plan for " },
              { type: "variableToken", attrs: { variableId: "company_name" } },
            ],
          },
          {
            type: "pageTitleSubtitle",
            content: [{ type: "text", text: "A short page for the buying team." }],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { id: "text-context" },
        content: [{ type: "text", text: "{{company_name}} can move faster with one clean source of truth." }],
      },
      {
        type: "buttonBlock",
        attrs: { id: "cta-primary", href: "{{primary_cta_url}}" },
        content: [{ type: "text", text: "Book implementation review" }],
      },
    ],
  }

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
      publishedAt: "2026-06-14T18:00:00.000Z",
    },
    metadata: {
      title: "Rollout brief for Acme",
      description: "A concise implementation plan for Acme.",
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "mira",
      name: "Mira at Acme",
      recipientName: "Mira",
      recipientCompany: "Acme",
      revisionNumber: 3,
      variableValues: {
        company_name: "Acme",
        recipient_website: "linear.app",
      },
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
}

describe("Handout API", () => {
  it("reports health", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/api/health")
      .set("x-request-id", "test-request-id")
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "handout-api",
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
        id: "dev_user_handout",
        email: "dev@handout.link",
        name: "Handout Dev",
        accountSetupComplete: true,
        internalAccess: true,
      },
      activeWorkspace: {
        id: "00000000-0000-4000-8000-000000000101",
        slug: "handout-dev",
        name: "Handout Dev",
        role: "admin",
      },
      onboarding: {
        nextStep: "app",
      },
      requestId: expect.any(String),
    });
  });

  it("serves and mutates the authenticated workspace team", async () => {
    const workspaceId = "11111111-1111-4111-8111-111111111111";
    const adminMember: TeamMemberRecord = {
      id: "22222222-2222-4222-8222-222222222222",
      workspaceId,
      userId: testActor.userId,
      name: testActor.name ?? "Jane Doe",
      email: testActor.email,
      avatarUrl: null,
      role: "admin",
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastActiveAt: new Date("2026-07-14T16:00:00.000Z"),
    };
    const repository = createMemoryTeamRepository({ members: [adminMember] });
    const app = createTestApp({ team: createTeamService(repository) });

    const initial = await request(app)
      .get(`/api/workspaces/${workspaceId}/team`)
      .expect(200);

    expect(initial.body).toMatchObject({
      members: [{ id: adminMember.id, email: testActor.email, role: "admin" }],
      invitations: [],
      permissions: { canManageMembers: true },
    });

    await request(app)
      .post(`/api/workspaces/${workspaceId}/team/invitations`)
      .send({ email: "teammate@acme.com", role: "user" })
      .expect(201)
      .expect((response) => {
        expect(response.body.result).toBe("invitation_created");
      });

    const updated = await request(app)
      .get(`/api/workspaces/${workspaceId}/team`)
      .expect(200);

    expect(updated.body.invitations).toMatchObject([
      { email: "teammate@acme.com", role: "user", status: "pending" },
    ]);
  });

  it("redeems a workspace invitation code for its signed-in recipient", async () => {
    const workspaceId = "11111111-1111-4111-8111-111111111112";
    const invitation: TeamInvitationRecord = {
      id: "22222222-2222-4222-8222-222222222223",
      workspaceId,
      email: testActor.email,
      role: "user",
      status: "pending",
      invitedByName: "Ada Admin",
      createdAt: new Date("2026-07-14T16:00:00.000Z"),
      expiresAt: new Date("2026-08-01T16:00:00.000Z"),
    };
    const team = createTeamService(createMemoryTeamRepository({
      invitations: [invitation],
      users: [{ id: testActor.userId, email: testActor.email }],
    }), {
      now: () => new Date("2026-07-23T16:00:00.000Z"),
    });
    const app = createTestApp({ team });

    const response = await request(app)
      .post("/api/workspace-invitations/redeem")
      .send({ code: encodeWorkspaceInviteCode(invitation.id) })
      .expect(200);

    expect(response.body).toEqual({
      workspaceId,
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
      slug: "handout-dev",
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
        plan: "free",
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
          plan: "free",
          role: "user",
          membershipId: `membership_${acmeWorkspace.id}`,
        },
        {
          id: betaWorkspace.id,
          slug: "beta",
          name: "Beta",
          websiteDomain: "beta.com",
          logoUrl: null,
          plan: "free",
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

  it("uploads and serves a profile image through dev auth", async () => {
    const app = createTestApp({ actor: null });
    const dataBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const upload = await request(app)
      .put("/api/me/profile-image")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .send({
        contentType: "image/png",
        dataBase64,
        fileName: "profile.png",
      })
      .expect(200);

    expect(upload.body).toEqual({
      imageAssetId: expect.any(String),
      imageUrl: expect.stringMatching(/^\/api\/me\/profile-image-assets\//),
      requestId: expect.any(String),
    });

    const image = await request(app)
      .get(upload.body.imageUrl)
      .expect("Content-Type", "image/png")
      .expect(200);

    expect(image.body).toEqual(Buffer.from(dataBase64, "base64"));

    const bootstrap = await request(app)
      .get("/api/me")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .expect(200);
    expect(bootstrap.body.user.avatarUrl).toBe(upload.body.imageUrl);
    setDevProfileImageUrl(undefined);
  });

  it("rejects a non-square profile image", async () => {
    const app = createTestApp();
    const pngHeader = Buffer.alloc(24);
    pngHeader.write("PNG", 1, "ascii");
    pngHeader.writeUInt32BE(2, 16);
    pngHeader.writeUInt32BE(1, 20);

    const response = await request(app)
      .put("/api/me/profile-image")
      .send({
        contentType: "image/png",
        dataBase64: pngHeader.toString("base64"),
        fileName: "wide.png",
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "profile.image_invalid",
      message: "Profile images must be square PNG, JPEG, or WebP images.",
    });
  });

  it("persists site defaults across dev-auth requests", async () => {
    const app = createTestApp({
      actor: null,
      bootstrap: {
        profiles: [buildMemoryAppUserProfile({ userId: "dev_user_handout" })],
      },
    });
    const defaults = {
      ...defaultSiteDefaults,
      themeMode: "light" as const,
      primaryColor: "blue" as const,
      customPrimaryColor: "#fff5d2",
      trackingEnabled: false,
    };

    await request(app)
      .put("/api/me/site-defaults")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .send(defaults)
      .expect(200);

    const response = await request(app)
      .get("/api/me/site-defaults")
      .set(DEV_AUTH_BYPASS_HEADER, "1")
      .expect(200);

    expect(response.body.defaults).toEqual(defaults);
  });

  it("rejects unsafe replay defaults before persistence", async () => {
    const app = createTestApp();
    const response = await request(app)
      .put("/api/me/site-defaults")
      .send({
        ...defaultSiteDefaults,
        recordingEnabled: true,
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "profile.invalid_payload",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["recordingDisclosureAccepted"] }),
      ]),
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
      plan: "free",
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

  it("derives list thumbnails from the first visible site page", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const draftContent = buildDraftContent({
      themeMode: "light",
      document: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Launch plan" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "A focused rollout for the team." }],
          },
          { type: "horizontalRule" },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First step" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [
        buildMemorySite({
          workspaceId: workspace.id,
          draftContent,
        }),
      ],
    });

    const response = await request(app).get("/api/sites").expect(200);

    expect(response.body.sites[0].thumbnail).toEqual({
      content: draftContent,
    });
  });

  it("lists only sites accessible to a non-admin workspace member", async () => {
    const workspace = buildWorkspace({ plan: "core" });
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
      plan: "core",
    });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      createdByUserId: "handout_agent",
      name: "Agent managed site",
      slug: "agent-managed-site",
    });
    const app = createTestApp({
      actor: null,
      sites: [site],
    });
    const previousEnv = {
      HANDOUT_AGENT_API_TOKEN: process.env.HANDOUT_AGENT_API_TOKEN,
      HANDOUT_AGENT_WORKSPACE_ID: process.env.HANDOUT_AGENT_WORKSPACE_ID,
      HANDOUT_AGENT_WORKSPACE_PLAN: process.env.HANDOUT_AGENT_WORKSPACE_PLAN,
      HANDOUT_AGENT_WORKSPACE_ROLE: process.env.HANDOUT_AGENT_WORKSPACE_ROLE,
      HANDOUT_AGENT_USER_ID: process.env.HANDOUT_AGENT_USER_ID,
    };

    process.env.HANDOUT_AGENT_API_TOKEN = "agent-test-token";
    process.env.HANDOUT_AGENT_WORKSPACE_ID = workspace.id;
    process.env.HANDOUT_AGENT_WORKSPACE_PLAN = "pro";
    process.env.HANDOUT_AGENT_WORKSPACE_ROLE = "admin";
    process.env.HANDOUT_AGENT_USER_ID = "handout_agent";

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
    } finally {
      restoreEnv(previousEnv);
    }
  });

  it("rejects incorrect bearer-token agent credentials", async () => {
    const workspace = buildWorkspace({
      id: "workspace_agent_456",
      plan: "core",
    });
    const app = createTestApp({
      actor: null,
    });
    const previousEnv = {
      HANDOUT_AGENT_API_TOKEN: process.env.HANDOUT_AGENT_API_TOKEN,
      HANDOUT_AGENT_WORKSPACE_ID: process.env.HANDOUT_AGENT_WORKSPACE_ID,
    };

    process.env.HANDOUT_AGENT_API_TOKEN = "correct-agent-token";
    process.env.HANDOUT_AGENT_WORKSPACE_ID = workspace.id;

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
        publicId: expect.stringMatching(/^[A-Za-z0-9_-]{12}$/),
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
        publicId: response.body.site.publicId,
        name: "Acme rollout brief",
        slug: "acme-rollout-brief",
        status: "draft",
        recipientCount: 0,
        thumbnail: {
          content: createDefaultSiteContent(),
        },
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
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const draftContent = buildDraftContent({
      variables: [
        {
          id: "var_company_name",
          key: "company_name",
          label: "Company name",
          type: "text",
          defaultValue: "Acme",
        },
      ],
      document: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { id: "heading-overview", level: 2 },
            content: [{ type: "text", text: "Why this matters now" }],
          },
          {
            type: "buttonBlock",
            attrs: { id: "cta-primary", href: "{{primary_cta_url}}" },
            content: [{ type: "text", text: "Book implementation review" }],
          },
        ],
      },
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

    expect(updateResponse.body).toMatchObject({
      draftRevision: 2,
      draftContent,
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
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const duplicatePage = structuredClone(site.draftContent.pages[0]!);

    const response = await request(app)
      .post(`/api/sites/${site.id}/content/validate`)
      .send({
        draftContent: buildDraftContent({
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
          pages: [duplicatePage, structuredClone(duplicatePage)],
        }),
      })
      .expect(200);

    expect(response.body.valid).toBe(false);
    expect(response.body.issues).toEqual([
      {
        path: ["variables", 1, "key"],
        message: "Variable key must be unique: company_name",
      },
      {
        path: ["pages", 1, "id"],
        message: `Page id must be unique: ${duplicatePage.id}`,
      },
      {
        path: ["pages", 1, "slug"],
        message: `Page slug must be unique: ${duplicatePage.slug}`,
      },
    ]);
  });

  it("rejects unsupported Tiptap nodes at the content boundary", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const draftContent = buildDraftContent({
      document: {
        type: "doc",
        content: [{ type: "unsupportedBlock" }],
      },
    });

    const validateResponse = await request(app)
      .post(`/api/sites/${site.id}/content/validate`)
      .send({ draftContent })
      .expect(400);

    expect(validateResponse.body.error).toMatchObject({
      code: "site.invalid_payload",
    });

    const updateResponse = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent,
      })
      .expect(400);

    expect(updateResponse.body.error).toMatchObject({
      code: "site.invalid_payload",
    });
  });

  it("blocks oversized draft content before saving", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent: buildDraftContent({
          document: {
            type: "doc",
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: "x".repeat(HANDOUT_TEXT_LIMITS.blockText + 1) }],
            }],
          },
        }),
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "site.invalid_payload",
    });
  });

  it("rejects newly embedded image data without breaking legacy drafts that already contain it", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });
    const embeddedImage = `data:image/webp;base64,${"a".repeat(300_000)}`;

    const nextDraftContent = buildDraftContent({
      document: {
        type: "doc",
        content: [{
          type: "image",
          attrs: { src: embeddedImage },
        }],
      },
    });
    const response = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent: nextDraftContent,
      })
      .expect(400);

    expect(response.body.error.message).toContain("Inline image data cannot be added");

    const legacySite = buildMemorySite({
      id: "legacy-inline-site",
      workspaceId: workspace.id,
      draftContent: nextDraftContent,
    });
    const legacyApp = createTestAppWithActiveWorkspace({
      workspace,
      sites: [legacySite],
    });
    await request(legacyApp)
      .put(`/api/sites/${legacySite.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent: {
          ...nextDraftContent,
          themeMode: "light",
        },
      })
      .expect(200);
  });

  it("blocks drafts with too many tab blocks before saving", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent: buildDraftContent({
          document: {
            type: "doc",
            content: Array.from(
              { length: HANDOUT_COLLECTION_LIMITS.blocksPerTab + 1 },
              (_, index) => ({
                type: "paragraph",
                attrs: { id: `block-${index}` },
                content: [{ type: "text", text: `Block ${index}` }],
              }),
            ),
          },
        }),
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "site.invalid_payload",
    });
  });

  it("rejects excessively deep content before recursive schema validation", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({ workspace, sites: [site] });
    let nested: TiptapNode = { type: "paragraph" };
    for (let depth = 0; depth < 70; depth += 1) {
      nested = { type: "blockquote", content: [nested] };
    }

    const response = await request(app)
      .put(`/api/sites/${site.id}/content`)
      .send({
        expectedDraftRevision: 1,
        draftContent: buildDraftContent({ document: { type: "doc", content: [nested] } }),
      })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: "site.content_limit_reached",
      message: expect.stringContaining("nested"),
    });
  });

  it("batch creates and updates site variants by slug", async () => {
    const workspace = buildWorkspace({ plan: "core" });
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
              recipient_website: "acme.com",
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
      variableValues: {
        recipient_website: "acme.com",
        "var-company-logo": "/api/workspaces/logo-preview/image?domain=acme.com&theme=light&size=64",
      },
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

    const sitesResponse = await request(app).get("/api/sites").expect(200);
    expect(sitesResponse.body.sites).toEqual([
      expect.objectContaining({
        id: site.id,
        recipientCount: 2,
      }),
    ]);

    const recipientToDelete = listResponse.body.variants.find(
      (variant: { slug: string }) => variant.slug === "jules-northstar",
    );

    await request(app)
      .delete(`/api/sites/${site.id}/variants/${recipientToDelete.id}`)
      .expect(204);

    const variantsAfterDelete = await request(app)
      .get(`/api/sites/${site.id}/variants`)
      .expect(200);
    expect(variantsAfterDelete.body.variants).toHaveLength(1);

    const sitesAfterDelete = await request(app).get("/api/sites").expect(200);
    expect(sitesAfterDelete.body.sites).toEqual([
      expect.objectContaining({
        id: site.id,
        recipientCount: 1,
      }),
    ]);
  });

  it("does not reveal inaccessible private sites to non-admin members", async () => {
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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

  it("requires an upgrade before a free workspace can publish", async () => {
    const workspace = buildWorkspace({ plan: "free" });
    const site = buildMemorySite({
      workspaceId: workspace.id,
      name: "Publishable brief",
      slug: "publishable-brief",
    });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    const response = await request(app)
      .post(`/api/sites/${site.id}/publish`)
      .expect(402);

    expect(response.body.error).toMatchObject({
      code: "billing.upgrade_required",
      message: "Upgrade to Core to publish this site.",
      requestId: expect.any(String),
    });
  });

  it("unpublishes a live site without deleting publish history", async () => {
    const workspace = buildWorkspace({ plan: "core" });
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

  it("rejects publish when no page is publicly visible", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const baseContent = buildDraftContent();
    const invalidContent = buildDraftContent({
      pages: baseContent.pages.map((page) => ({ ...page, status: "hidden" })),
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
        path: ["draftContent", "pages"],
        message: "At least one visible page is required before publishing.",
      },
    ]);
  });

  it("rejects publish for users who can only view a team site", async () => {
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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

  it("permanently deletes sites and their recipient variants", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const site = buildMemorySite({ workspaceId: workspace.id });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: [site],
    });

    await request(app)
      .post(`/api/sites/${site.id}/variants/batch`)
      .send({
        matchBy: "slug",
        variants: [
          {
            slug: "mira-acme",
            name: "Mira at Acme",
            recipientName: "Mira Singh",
            recipientCompany: "Acme",
            variableValues: {
              company_name: "Acme",
            },
          },
        ],
      })
      .expect(200);

    const populatedListResponse = await request(app).get("/api/sites").expect(200);
    expect(populatedListResponse.body.sites).toEqual([
      expect.objectContaining({
        id: site.id,
        recipientCount: 1,
      }),
    ]);

    await request(app)
      .delete(`/api/sites/${site.id}`)
      .expect(204);

    const listResponse = await request(app).get("/api/sites").expect(200);
    expect(listResponse.body.sites).toEqual([]);

    await request(app)
      .get(`/api/sites/${site.id}`)
      .expect(404);

    await request(app)
      .get(`/api/sites/${site.id}/variants`)
      .expect(404);
  });

  it("restores an older site version into draft while preserving history", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const earlierContent = buildDraftContent({
      document: {
        type: "doc",
        content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Earlier draft" }] }],
      },
    });
    const currentContent = buildDraftContent({
      document: {
        type: "doc",
        content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Current draft" }] }],
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
    const workspace = buildWorkspace({ plan: "core" });
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
    const workspace = buildWorkspace({ plan: "core" });
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

  it("enforces the free workspace site limit", async () => {
    const workspace = buildWorkspace({ plan: "free" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      sites: Array.from({ length: 10 }, (_, index) =>
        buildMemorySite({
          workspaceId: workspace.id,
          slug: `existing-site-${index + 1}`,
        }),
      ),
    });

    const response = await request(app)
      .post("/api/sites")
      .send({ name: "Second site" })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "site.limit_reached",
      message: "Free workspaces can retain up to 10 sites. Upgrade to create another site.",
      requestId: expect.any(String),
    });
  });

  it("returns the active workspace billing summary", async () => {
    const workspace = buildWorkspace({ plan: "core" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      billing: createFakeBillingService(),
    });

    const response = await request(app)
      .get("/api/billing")
      .expect(200);

    expect(response.body).toMatchObject({
      workspaceId: workspace.id,
      plan: "core",
      canPublish: true,
      canManageBilling: true,
      hasStripeCustomer: true,
      subscription: {
        status: "active",
        interval: "month",
        seatCount: 1,
      },
      requestId: expect.any(String),
    });
  });

  it("creates a billing checkout session for workspace admins", async () => {
    const workspace = buildWorkspace({ plan: "free" });
    const app = createTestAppWithActiveWorkspace({
      workspace,
      billing: createFakeBillingService(),
    });

    const response = await request(app)
      .post("/api/billing/checkout")
      .send({ plan: "core", interval: "year" })
      .expect(200);

    expect(response.body).toMatchObject({
      url: "https://billing.stripe.test/checkout",
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
        ...unavailablePublicLinkMethods,
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
        ...unavailablePublicLinkMethods,
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
    expect(response.headers["content-security-policy"]).toContain("font-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("frame-src https:");
    expect(response.text).toContain("<title>Rollout brief for Acme</title>");
    expect(response.text).toContain('content="https://pages.handout.test/acme/rollout-brief/mira"');
    expect(response.text).toContain("A focused rollout plan for Acme");
    expect(response.text).toContain(
      'src="/api/public/site-logo/acme/rollout-brief/workspace?theme=dark&amp;variant=mira"',
    );
    expect(response.text).toContain(
      'src="/api/public/site-logo/acme/rollout-brief/recipient?theme=dark&amp;variant=mira"',
    );
    expect(response.text).toContain("Book implementation review");
    expect(response.text).toContain('data-handout-element-id="cta-primary"');
    expect(response.text).not.toContain("data-handout-element-label");
    expect(response.text).not.toContain("data-handout-tracking-v2=");
    expect(response.text).not.toContain("/track/2026-06-14.v1/script.js");
  });

  it("serves workspace and recipient logos only through published site context", async () => {
    const fetchedLogos: Array<{ domain: string; size: number; theme: "dark" | "light" }> = [];
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const payload = buildPublicHtmlPayload();
    payload.selectedVariant!.variableValues.website = "linear.app";
    delete payload.selectedVariant!.variableValues.recipient_website;
    const app = createTestApp({
      actor: null,
      logoPreview: {
        async getPreview() {
          throw new Error("Public logo delivery must not use the preview URL flow.");
        },
        async fetchImage(input) {
          fetchedLogos.push(input);
          return {
            body: onePixelPng,
            contentType: "image/png",
            cacheControl: "private, max-age=60",
          };
        },
      },
      publicSites: {
        ...unavailablePublicLinkMethods,
        async resolve(input) {
          expect(input.workspaceSlug).toBe("acme");
          expect(input.siteSlug).toBe("rollout-brief");
          return {
            status: "available",
            cacheControl: "public, max-age=60",
            payload,
          };
        },
      },
    });

    const workspaceLogo = await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/workspace")
      .query({ theme: "dark" })
      .expect(200);
    const recipientLogo = await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/recipient")
      .query({ theme: "light", variant: "mira" })
      .expect(200);
    await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/recipient")
      .query({ theme: "light", variant: "mira" })
      .expect(200);

    expect(workspaceLogo.headers["content-type"]).toContain("image/png");
    expect(workspaceLogo.headers["cache-control"]).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    expect(workspaceLogo.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(recipientLogo.headers["content-type"]).toContain("image/png");
    expect(fetchedLogos).toEqual([
      { domain: "acme.com", size: 128, theme: "dark" },
      { domain: "linear.app", size: 128, theme: "light" },
    ]);
  });

  it("does not proxy logos for malformed or unavailable public site requests", async () => {
    let fetchCount = 0;
    let resolveCount = 0;
    const app = createTestApp({
      actor: null,
      logoPreview: {
        async getPreview() {
          throw new Error("Unexpected preview request.");
        },
        async fetchImage() {
          fetchCount += 1;
          return null;
        },
      },
      publicSites: {
        ...unavailablePublicLinkMethods,
        async resolve() {
          resolveCount += 1;
          return {
            status: "unavailable",
            cacheControl: "public, max-age=15",
          };
        },
      },
    });

    await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/arbitrary-domain")
      .query({ theme: "dark" })
      .expect(404);
    await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/workspace")
      .query({ theme: "unknown" })
      .expect(404);
    await request(app)
      .get("/api/public/site-logo/acme/rollout-brief/workspace")
      .query({ theme: "dark" })
      .expect(404);

    expect(resolveCount).toBe(1);
    expect(fetchCount).toBe(0);
  });

  it("serves public renderer assets before the public HTML fallback", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/handout-logo.svg")
      .expect(200);
    const body = response.text ?? response.body.toString("utf8");

    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cache-control"]).toContain("max-age=");
    expect(body).toContain("<svg");
    expect(body).not.toContain("This page is unavailable");

    const runtimeResponse = await request(app)
      .get(PUBLIC_SITE_RUNTIME_PATH)
      .expect(200);

    expect(runtimeResponse.headers["content-type"]).toContain("application/javascript");
    expect(runtimeResponse.headers["cache-control"]).toContain("immutable");
    expect(runtimeResponse.text).toContain("data-handout-page-target");

    const fontResponse = await request(app)
      .get("/fonts/geist-latin-wght-normal.woff2")
      .expect(200);

    expect(fontResponse.headers["content-type"]).toContain("font/woff2");
    expect(fontResponse.headers["cache-control"]).toContain("max-age=");
  });

  it("renders generic server HTML for unavailable public site links", async () => {
    const app = createTestApp();
    const response = await request(app)
      .get("/acme/rollout-brief")
      .expect(404);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("public, max-age=15, stale-while-revalidate=15");
    expect(response.text).toContain("<title>Page unavailable | Handout</title>");
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
        plan: "free",
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

  it("saves a detected logo.dev image as the new workspace logo", async () => {
    const dataBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const app = createTestApp({
      logoPreview: {
        async getPreview() {
          return { enabled: true, domain: "acme.com", imageUrl: "/logo-preview" };
        },
        async fetchImage() {
          return {
            body: new Uint8Array(Buffer.from(dataBase64, "base64")),
            contentType: "image/png",
            cacheControl: "private, max-age=60",
          };
        },
      },
    });

    const response = await request(app)
      .post("/api/workspaces")
      .send({ name: "Acme Sales", website: "acme.com" })
      .expect(201);

    expect(response.body.workspace.logoAssetId).toEqual(expect.any(String));
    await request(app)
      .get(`/api/workspaces/logo-assets/${response.body.workspace.logoAssetId}`)
      .expect("Content-Type", "image/png")
      .expect(200);
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
