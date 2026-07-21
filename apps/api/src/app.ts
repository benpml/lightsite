import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
} from "@handout/tracking-schema";
import { auth } from "./auth";
import { handleRemoteMcpRequest, protectedResourceMetadata } from "@handout/mcp/remote";
import { db } from "@handout/db";
import { createAutomationRouter } from "./automations/router";
import { createAutomationService, enqueueAutomationMessage, enqueueAutomationMessages } from "./automations/service";
import { parseAutomationEncryptionKey } from "./automations/crypto";
import { createDbWorkspaceAssetRepository } from "./assets/repository";
import { createPublicAssetRouter, createWorkspaceAssetRouter } from "./assets/router";
import { createWorkspaceAssetService, type WorkspaceAssetService } from "./assets/service";
import { getCurrentActor, type CurrentActorProvider } from "./auth/current-actor";
import { resolveDevWorkspaceLogoUrl } from "./auth/dev-auth";
import { createDevAuthRouter } from "./auth/dev-auth-router";
import { createExtensionAuthCodeService } from "./auth/extension-auth-code";
import { createExtensionAuthRouter } from "./auth/extension-auth-router";
import { createMcpOAuthService } from "./auth/mcp-oauth";
import { authorizationServerMetadata, createMcpOAuthRouter } from "./auth/mcp-oauth-router";
import { createDbBillingRepository } from "./billing/repository";
import { createBillingRouter, createBillingWebhookRouter } from "./billing/router";
import { createBillingService, type BillingService } from "./billing/service";
import { createDbBootstrapRepository } from "./bootstrap/repository";
import { createBootstrapService, type BootstrapService } from "./bootstrap/service";
import { env } from "./env";
import { errorMiddleware, notFoundMiddleware } from "./http/error-middleware";
import { createTransactionalEmailSender } from "./email/transactional-email";
import { requestContextMiddleware } from "./http/request-context";
import { createMeRouter } from "./me/router";
import { createPublicSiteDocumentRouter } from "./public-sites/document-router";
import { createPublicSiteLogoRouter } from "./public-sites/logo-router";
import { createPublicSiteRouter } from "./public-sites/router";
import { createDbPublicSiteRepository } from "./public-sites/repository";
import {
  createPublicSiteScreenshotService,
  type PublicSiteScreenshotService,
} from "./public-sites/screenshot";
import {
  createPublicSiteService,
  type PublicSiteService,
} from "./public-sites/service";
import {
  createDbSiteRepository,
} from "./sites/repository";
import { createSiteRouter } from "./sites/router";
import { createSiteService, type SiteService } from "./sites/service";
import { createDbTeamRepository } from "./team/repository";
import { createTeamRouter } from "./team/router";
import { createTeamService, type TeamService } from "./team/service";
import { createPublicTrackingScriptRouter } from "./tracking/public-script";
import {
  createMemoryTrackingRateLimiter,
  type TrackingRateLimiter,
} from "./tracking/rate-limit";
import { createEncryptedTrackingV2ContextTokenService } from "./tracking/v2/context-token";
import { createDbTrackingV2Repository } from "./tracking/v2/repository";
import { createConfiguredTrackingV2RecordingObjectStore } from "./tracking/v2/recording-config";
import { createDbTrackingV2RecordingRepository } from "./tracking/v2/recording-repository";
import { createTrackingV2RecordingService } from "./tracking/v2/recording-service";
import { createTrackingV2ReadRouter } from "./tracking/v2/read-router";
import { createTrackingV2Router } from "./tracking/v2/router";
import { createTrackingV2Service, type TrackingV2Service } from "./tracking/v2/service";
import { createTrackingV2ReadReconciler, createTrackingV2SessionExpirationService } from "./tracking/v2/session-expiration";
import {
  createDbTrackingSuppressionRepository,
  createTrackingSuppressionService,
} from "./tracking/v2/suppression";
import { createLogoDevPreviewService, type WorkspaceLogoPreviewService } from "./workspaces/logo-preview";
import { createDbWorkspaceRepository } from "./workspaces/repository";
import { createWorkspaceRouter } from "./workspaces/router";
import { createWorkspaceService, type WorkspaceService } from "./workspaces/service";
import { logger } from "./lib/logger";

export type AppServices = {
  assets: WorkspaceAssetService;
  billing: BillingService;
  bootstrap: BootstrapService;
  logoPreview: WorkspaceLogoPreviewService;
  publicSites: PublicSiteService;
  publicSiteScreenshots: PublicSiteScreenshotService;
  sites: SiteService;
  team: TeamService;
  trackingRateLimiter: TrackingRateLimiter;
  workspaces: WorkspaceService;
  getCurrentActor: CurrentActorProvider;
};

export type CreateAppOptions = Partial<AppServices> & {
  publicSiteOrigin?: string;
};

const publicAssetsDirectory = resolvePublicAssetsDirectory();

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));
  const transactionalEmail = createTransactionalEmailSender({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    nodeEnv: env.NODE_ENV,
  });

  const bootstrap =
    options.bootstrap ?? createBootstrapService(createDbBootstrapRepository());
  const assets = options.assets ?? createWorkspaceAssetService(createDbWorkspaceAssetRepository());
  const billing =
    options.billing ??
    createBillingService(createDbBillingRepository(), {
      stripeSecretKey: env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      webOrigin: env.WEB_ORIGIN,
      priceIds: {
        "core:month": env.STRIPE_CORE_MONTHLY_PRICE_ID,
        "core:year": env.STRIPE_CORE_ANNUAL_PRICE_ID,
        "pro:month": env.STRIPE_PRO_MONTHLY_PRICE_ID,
        "pro:year": env.STRIPE_PRO_ANNUAL_PRICE_ID,
      },
    });
  const logoPreview =
    options.logoPreview ?? createLogoDevPreviewService(env.LOGO_DEV_TOKEN);
  const trackingV2ContextTokens = env.TRACKING_V2_ENABLED
    ? createEncryptedTrackingV2ContextTokenService(env.TRACKING_SIGNING_SECRET)
    : undefined;
  const trackingV2Service = trackingV2ContextTokens
      ? createLazyTrackingV2Service({
        tokenSecret: env.TRACKING_SIGNING_SECRET,
      })
    : undefined;
  const publicSites =
    options.publicSites ??
    createPublicSiteService(createDbPublicSiteRepository(undefined, {
      resolveWorkspaceLogoUrl: resolveDevWorkspaceLogoUrl,
    }), {
      trackingV2ContextTokens,
      trackingV2Service,
    });
  const publicSiteScreenshots =
    options.publicSiteScreenshots ?? createPublicSiteScreenshotService();
  const publicSiteOrigin =
    options.publicSiteOrigin ?? env.PUBLIC_SITE_ORIGIN ?? env.WEB_ORIGIN;
  const sites =
    options.sites ?? createSiteService(createDbSiteRepository());
  const team =
    options.team ?? createTeamService(createDbTeamRepository(), {
      email: transactionalEmail,
      webOrigin: env.WEB_ORIGIN,
    });
  const trackingRateLimiter =
    options.trackingRateLimiter ?? createMemoryTrackingRateLimiter();
  const workspaces =
    options.workspaces ?? createWorkspaceService(createDbWorkspaceRepository(), {
      email: transactionalEmail,
      webOrigin: env.WEB_ORIGIN,
    });
  const actorProvider = options.getCurrentActor ?? getCurrentActor;
  const mcpIssuer = process.env.HANDOUT_MCP_ISSUER ?? (
    env.NODE_ENV === "production" ? "https://api.handout.link" : `http://localhost:${env.API_PORT}`
  );
  const mcpResource = process.env.HANDOUT_MCP_RESOURCE ?? `${mcpIssuer}/mcp`;
  const mcpOAuth = createMcpOAuthService(env.BETTER_AUTH_SECRET);
  const automations = env.AUTOMATIONS_ENABLED && env.AUTOMATIONS_ENCRYPTION_KEY
    ? createAutomationService(db, {
        encryptionKey: parseAutomationEncryptionKey(env.AUTOMATIONS_ENCRYPTION_KEY),
        allowLocalDestinations: env.AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS,
      })
    : null;

  app.use(
    cors({
      origin: resolveCorsOrigin,
      credentials: true,
    }),
  );

  app.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"], (_request, response) => {
    response.setHeader("cache-control", "public, max-age=300").json(protectedResourceMetadata({
      authorizationServer: mcpIssuer,
      resource: mcpResource,
    }));
  });
  app.get("/.well-known/oauth-authorization-server", (_request, response) => {
    response.setHeader("cache-control", "public, max-age=300").json(authorizationServerMetadata(mcpIssuer, env.WEB_ORIGIN));
  });
  app.all("/mcp", (request, response) => {
    void handleRemoteMcpRequest(request, response, {
      apiBaseUrl: `http://127.0.0.1:${env.API_PORT}`,
      protectedResourceMetadataUrl: `${mcpIssuer}/.well-known/oauth-protected-resource/mcp`,
      publicSiteOrigin: publicSiteOrigin,
      webOrigin: env.WEB_ORIGIN,
    });
  });

  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(requestContextMiddleware);
  app.use(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    createBillingWebhookRouter({ billingService: billing }),
  );
  app.use(
    TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
    express.json({ limit: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES + 32 * 1024 }),
  );
  app.use([
    TRACKING_V2_SESSION_START_ENDPOINT,
    TRACKING_V2_EVENTS_ENDPOINT,
    TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
    TRACKING_V2_SESSION_END_ENDPOINT,
  ], express.json({ limit: "16kb" }));
  app.use(
    "/api/sites/:siteId/content",
    express.json({ limit: env.API_SITE_CONTENT_JSON_BODY_LIMIT }),
  );
  app.use(
    "/api/workspaces/:workspaceId/logo",
    express.json({ limit: "2mb" }),
  );
  app.use(
    "/api/workspaces/:workspaceId/assets/import",
    express.json({ limit: "8mb" }),
  );
  app.use(
    "/api/me/profile-image",
    express.json({ limit: "2mb" }),
  );
  app.use(express.json({ limit: env.API_JSON_BODY_LIMIT }));

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "handout-api",
      requestId: request.context.requestId,
    });
  });

  app.use("/api/dev", createDevAuthRouter());
  app.use(
    "/api/extension-auth",
    createExtensionAuthRouter({
      codeService: createExtensionAuthCodeService(env.BETTER_AUTH_SECRET),
      getCurrentActor: actorProvider,
    }),
  );
  app.use(
    "/api/mcp/oauth",
    createMcpOAuthRouter({
      bootstrapService: bootstrap,
      codeService: mcpOAuth,
      getCurrentActor: actorProvider,
      issuer: mcpIssuer,
      secret: env.BETTER_AUTH_SECRET,
      webOrigin: env.WEB_ORIGIN,
    }),
  );
  app.use(
    "/api/me",
    createMeRouter({
      bootstrapService: bootstrap,
      getCurrentActor: actorProvider,
    }),
  );
  app.use(
    "/api/billing",
    createBillingRouter({
      billingService: billing,
      bootstrapService: bootstrap,
      getCurrentActor: actorProvider,
    }),
  );
  app.use(
    "/api/sites",
    createSiteRouter({
      bootstrapService: bootstrap,
      getCurrentActor: actorProvider,
      siteService: sites,
    }),
  );
  app.use(
    "/api/public/site-logo",
    createPublicSiteLogoRouter({
      logoPreviewService: logoPreview,
      publicSiteService: publicSites,
    }),
  );
  app.use("/api/public/sites", createPublicSiteRouter({ publicSiteService: publicSites }));
  app.use("/api/public/assets", createPublicAssetRouter({ assetService: assets }));
  if (trackingV2ContextTokens) {
    app.use(createTrackingV2Router({
      contextTokens: trackingV2ContextTokens,
      trackingService: trackingV2Service!,
      rateLimiter: trackingRateLimiter,
      rateLimitKeySecret: env.TRACKING_SIGNING_SECRET,
      trustCloudflareGeoHeaders: env.TRACKING_TRUST_CLOUDFLARE_GEO,
    }));
  }
  app.use(createPublicTrackingScriptRouter());
  app.use(express.static(publicAssetsDirectory, {
    dotfiles: "deny",
    fallthrough: true,
    index: false,
    maxAge: "1h",
  }));
  if (trackingV2Service) {
    app.use(
      "/api/workspaces/:workspaceId/tracking/v2",
      createTrackingV2ReadRouter({
        bootstrapService: bootstrap,
        getCurrentActor: actorProvider,
        trackingService: trackingV2Service,
      }),
    );
  }
  if (automations) {
    app.use(
      "/api/workspaces/:workspaceId/automations",
      createAutomationRouter({
        service: automations,
        bootstrapService: bootstrap,
        getCurrentActor: actorProvider,
      }),
    );
  }
  app.use(
    "/api/workspaces/:workspaceId/assets",
    createWorkspaceAssetRouter({
      assetService: assets,
      bootstrapService: bootstrap,
      getCurrentActor: actorProvider,
    }),
  );
  app.use(
    "/api/workspaces/:workspaceId/team",
    createTeamRouter({
      teamService: team,
      getCurrentActor: actorProvider,
      billingService: billing,
    }),
  );
  app.use(
    "/api/workspaces",
    createWorkspaceRouter({
      logoPreviewService: logoPreview,
      workspaceService: workspaces,
      getCurrentActor: actorProvider,
    }),
  );
  app.use(createPublicSiteDocumentRouter({
    publicSiteOrigin,
    publicSiteService: publicSites,
    screenshotService: publicSiteScreenshots,
    trackingContextTokens: trackingV2ContextTokens,
    trackingRateLimiter,
    trackingService: trackingV2Service,
  }));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

function resolveCorsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (!origin) {
    callback(null, true);
    return;
  }

  callback(null, (
    getAllowedWebOrigins().has(origin) ||
    (env.NODE_ENV !== "production" && origin.startsWith("chrome-extension://"))
  ));
}

function getAllowedWebOrigins() {
  return new Set([
    env.WEB_ORIGIN,
    ...parseOriginList(env.WEB_ORIGINS),
  ]);
}

function parseOriginList(value: string | undefined) {
  return value
    ? value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
    : [];
}

function parseTrustProxy(value: typeof env.TRUST_PROXY) {
  return value === "true" ? true : value === "false" ? false : value;
}

function resolvePublicAssetsDirectory() {
  const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "apps/web/public"),
    path.resolve(process.cwd(), "../web/public"),
    path.resolve(sourceDirectory, "../../web/public"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

function createLazyTrackingV2Service(input: {
  tokenSecret: string;
}): TrackingV2Service {
  let servicePromise: Promise<TrackingV2Service> | null = null;

  const getService = () => {
    servicePromise ??= import("@handout/db").then(({ db }) => {
      const suppressionService = createTrackingSuppressionService({
        repository: createDbTrackingSuppressionRepository(db),
      });
      const trackingRepository = createDbTrackingV2Repository(db, {
        ...(env.AUTOMATIONS_ENABLED ? {
          automationOutbox: {
            enqueue: (event) => enqueueAutomationMessage(db, event),
            enqueueMany: (events) => enqueueAutomationMessages(db, events),
          },
        } : {}),
      });
      const recordingRepository = createDbTrackingV2RecordingRepository(db);
      const recordingObjectStore = createConfiguredTrackingV2RecordingObjectStore(env);
      const recordingService = recordingObjectStore
        ? createTrackingV2RecordingService({
            repository: recordingRepository,
            objectStore: recordingObjectStore,
            tokenSecret: input.tokenSecret,
          })
        : null;
      const reconcileSessions = createTrackingV2ReadReconciler({
        service: createTrackingV2SessionExpirationService({
          repository: trackingRepository,
          recordingRepository,
        }),
        onError(error) {
          logger.error("Tracking session reconciliation failed", { error });
        },
        onResult(result) {
          if (result.expired > 0 || result.recordingsSettled > 0) {
            logger.info("Completed tracking session reconciliation", result);
          }
        },
      });

      return createTrackingV2Service({
        repository: trackingRepository,
        suppressionService,
        tokenSecret: input.tokenSecret,
        recordingService,
        reconcileSessions,
      });
    });

    return servicePromise;
  };

  return {
    async preparePublicContext(payload) {
      return (await getService()).preparePublicContext(payload);
    },
    async listEvents(input) {
      return (await getService()).listEvents(input);
    },
    async listSessions(input) {
      return (await getService()).listSessions(input);
    },
    async getSession(input) {
      return (await getService()).getSession(input);
    },
    async getSiteSettings(input) {
      return (await getService()).getSiteSettings(input);
    },
    async updateSiteSettings(input) {
      return (await getService()).updateSiteSettings(input);
    },
    async listInternalIpRanges(workspaceId) {
      return (await getService()).listInternalIpRanges(workspaceId);
    },
    async createInternalIpRange(input) {
      return (await getService()).createInternalIpRange(input);
    },
    async deleteInternalIpRange(input) {
      return (await getService()).deleteInternalIpRange(input);
    },
    async startSession(request) {
      return (await getService()).startSession(request);
    },
    async recordEventBatch(batch) {
      return (await getService()).recordEventBatch(batch);
    },
    async recordSlackShare(input) {
      return (await getService()).recordSlackShare(input);
    },
    async recordWebhookSend(input) {
      return (await getService()).recordWebhookSend(input);
    },
    async recordHeartbeat(heartbeat) {
      return (await getService()).recordHeartbeat(heartbeat);
    },
    async endSession(end) {
      return (await getService()).endSession(end);
    },
    async recordRecordingChunk(input) {
      return (await getService()).recordRecordingChunk(input);
    },
    async completeRecording(input) {
      return (await getService()).completeRecording(input);
    },
    async getRecordingManifest(input) {
      return (await getService()).getRecordingManifest(input);
    },
    async getRecordingChunk(input) {
      return (await getService()).getRecordingChunk(input);
    },
  };
}
