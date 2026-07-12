import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
} from "@lightsite/tracking-schema";
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { getCurrentActor, type CurrentActorProvider } from "./auth/current-actor";
import { createDevAuthRouter } from "./auth/dev-auth-router";
import { createExtensionAuthCodeService } from "./auth/extension-auth-code";
import { createExtensionAuthRouter } from "./auth/extension-auth-router";
import { createDbBillingRepository } from "./billing/repository";
import { createBillingRouter, createBillingWebhookRouter } from "./billing/router";
import { createBillingService, type BillingService } from "./billing/service";
import { createDbBootstrapRepository } from "./bootstrap/repository";
import { createBootstrapService, type BootstrapService } from "./bootstrap/service";
import { env } from "./env";
import { errorMiddleware, notFoundMiddleware } from "./http/error-middleware";
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
import { createPublicTrackingScriptRouter } from "./tracking/public-script";
import {
  createMemoryTrackingRateLimiter,
  type TrackingRateLimiter,
} from "./tracking/rate-limit";
import { createEncryptedTrackingV2ContextTokenService } from "./tracking/v2/context-token";
import { createFileTrackingV2RecordingObjectStore } from "./tracking/v2/recording-object-store";
import { createDbTrackingV2Repository } from "./tracking/v2/repository";
import { createTrackingV2ReadRouter } from "./tracking/v2/read-router";
import { createTrackingV2Router } from "./tracking/v2/router";
import { createTrackingV2Service, type TrackingV2Service } from "./tracking/v2/service";
import {
  createDbTrackingSuppressionRepository,
  createTrackingSuppressionService,
} from "./tracking/v2/suppression";
import { createLogoDevPreviewService, type WorkspaceLogoPreviewService } from "./workspaces/logo-preview";
import { createDbWorkspaceRepository } from "./workspaces/repository";
import { createWorkspaceRouter } from "./workspaces/router";
import { createWorkspaceService, type WorkspaceService } from "./workspaces/service";

export type AppServices = {
  billing: BillingService;
  bootstrap: BootstrapService;
  logoPreview: WorkspaceLogoPreviewService;
  publicSites: PublicSiteService;
  publicSiteScreenshots: PublicSiteScreenshotService;
  sites: SiteService;
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

  const bootstrap =
    options.bootstrap ?? createBootstrapService(createDbBootstrapRepository());
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
  const trackingMarkerHashSecret =
    env.TRACKING_MARKER_HASH_SECRET ?? env.TRACKING_SIGNING_SECRET;
  const trackingV2ContextTokens = env.TRACKING_V2_ENABLED
    ? createEncryptedTrackingV2ContextTokenService(env.TRACKING_SIGNING_SECRET)
    : undefined;
  const trackingV2Service = trackingV2ContextTokens
    ? createLazyTrackingV2Service({
        tokenSecret: env.TRACKING_SIGNING_SECRET,
        markerHashSecret: trackingMarkerHashSecret,
        recordingStorageDirectory: resolveRecordingStorageDirectory(),
      })
    : undefined;
  const publicSites =
    options.publicSites ??
    createPublicSiteService(createDbPublicSiteRepository(), {
      trackingV2ContextTokens,
    });
  const publicSiteScreenshots =
    options.publicSiteScreenshots ?? createPublicSiteScreenshotService();
  const publicSiteOrigin =
    options.publicSiteOrigin ?? env.PUBLIC_SITE_ORIGIN ?? env.WEB_ORIGIN;
  const sites =
    options.sites ?? createSiteService(createDbSiteRepository());
  const trackingRateLimiter =
    options.trackingRateLimiter ?? createMemoryTrackingRateLimiter();
  const workspaces =
    options.workspaces ?? createWorkspaceService(createDbWorkspaceRepository());
  const actorProvider = options.getCurrentActor ?? getCurrentActor;

  app.use(
    cors({
      origin: resolveCorsOrigin,
      credentials: true,
    }),
  );

  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(requestContextMiddleware);
  app.use(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    createBillingWebhookRouter({ billingService: billing }),
  );
  app.use(
    `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/:recordingId/chunks`,
    express.json({ limit: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES + 16 * 1024 }),
  );
  app.use(express.json({ limit: env.API_JSON_BODY_LIMIT }));

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "lightsite-api",
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
  if (trackingV2ContextTokens) {
    app.use(createTrackingV2Router({
      contextTokens: trackingV2ContextTokens,
      trackingService: trackingV2Service!,
      rateLimiter: trackingRateLimiter,
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
  markerHashSecret: string;
  recordingStorageDirectory: string | null;
}): TrackingV2Service {
  let servicePromise: Promise<TrackingV2Service> | null = null;

  const getService = () => {
    servicePromise ??= import("@lightsite/db").then(({ db }) => {
      const recordingObjectStore = input.recordingStorageDirectory
        ? createFileTrackingV2RecordingObjectStore(input.recordingStorageDirectory)
        : null;
      const suppressionService = createTrackingSuppressionService({
        repository: createDbTrackingSuppressionRepository(db),
        hashSecret: input.markerHashSecret,
      });

      return createTrackingV2Service({
        repository: createDbTrackingV2Repository(db),
        recordingObjectStore,
        suppressionService,
        tokenSecret: input.tokenSecret,
        markerHashSecret: input.markerHashSecret,
      });
    });

    return servicePromise;
  };

  return {
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
    async startSession(request) {
      return (await getService()).startSession(request);
    },
    async recordEventBatch(batch) {
      return (await getService()).recordEventBatch(batch);
    },
    async recordSlackShare(input) {
      return (await getService()).recordSlackShare(input);
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
    async getRecordingChunkObject(input) {
      return (await getService()).getRecordingChunkObject(input);
    },
    async recordHeartbeat(heartbeat) {
      return (await getService()).recordHeartbeat(heartbeat);
    },
    async endSession(end) {
      return (await getService()).endSession(end);
    },
  };
}

function resolveRecordingStorageDirectory() {
  if (!env.TRACKING_RECORDING_ENABLED) {
    return null;
  }

  if (env.TRACKING_RECORDING_STORAGE_DIR) {
    return env.TRACKING_RECORDING_STORAGE_DIR;
  }

  return env.NODE_ENV === "production"
    ? null
    : path.resolve(process.cwd(), ".local/tracking-recordings");
}
