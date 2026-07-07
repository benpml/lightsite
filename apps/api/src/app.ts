import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { getCurrentActor, type CurrentActorProvider } from "./auth/current-actor";
import { createDevAuthRouter } from "./auth/dev-auth-router";
import { createDbBootstrapRepository } from "./bootstrap/repository";
import { createBootstrapService, type BootstrapService } from "./bootstrap/service";
import { env } from "./env";
import { errorMiddleware, notFoundMiddleware } from "./http/error-middleware";
import { requestContextMiddleware } from "./http/request-context";
import { createMeRouter } from "./me/router";
import { createPublicSiteDocumentRouter } from "./public-sites/document-router";
import { createPublicSiteRouter } from "./public-sites/router";
import { createDbPublicSiteRepository } from "./public-sites/repository";
import {
  createPublicSiteService,
  type PublicSiteService,
} from "./public-sites/service";
import {
  createDbSiteRepository,
} from "./sites/repository";
import { createSiteRouter } from "./sites/router";
import { createSiteService, type SiteService } from "./sites/service";
import {
  createHmacTrackingContextTokenService,
  type TrackingContextTokenService,
} from "./tracking/context-token";
import type { TrackingEventSink } from "./tracking/event-sink";
import { createPublicTrackingScriptRouter } from "./tracking/public-script";
import { createTrackingReadRouter } from "./tracking/read-router";
import { createDbTrackingRepository } from "./tracking/repository";
import {
  createMemoryTrackingRateLimiter,
  type TrackingRateLimiter,
} from "./tracking/rate-limit";
import { createTrackingRouter } from "./tracking/router";
import { createTrackingService, type TrackingService } from "./tracking/service";
import { createLogoDevPreviewService, type WorkspaceLogoPreviewService } from "./workspaces/logo-preview";
import { createDbWorkspaceRepository } from "./workspaces/repository";
import { createWorkspaceRouter } from "./workspaces/router";
import { createWorkspaceService, type WorkspaceService } from "./workspaces/service";

export type AppServices = {
  bootstrap: BootstrapService;
  logoPreview: WorkspaceLogoPreviewService;
  publicSites: PublicSiteService;
  sites: SiteService;
  trackingContextTokens: TrackingContextTokenService;
  trackingService: TrackingService;
  trackingEvents: TrackingEventSink;
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
  const logoPreview =
    options.logoPreview ?? createLogoDevPreviewService(env.LOGO_DEV_TOKEN);
  const trackingContextTokens =
    options.trackingContextTokens ??
    createHmacTrackingContextTokenService(env.TRACKING_SIGNING_SECRET);
  const trackingService =
    options.trackingService ?? createTrackingService(createDbTrackingRepository());
  const trackingEvents =
    options.trackingEvents ?? trackingService;
  const publicSites =
    options.publicSites ??
    createPublicSiteService(createDbPublicSiteRepository(), {
      trackingContextTokens,
    });
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
    "/api/me",
    createMeRouter({
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
  app.use("/api/public/sites", createPublicSiteRouter({ publicSiteService: publicSites }));
  app.use(createTrackingRouter({
    contextTokens: trackingContextTokens,
    contextIsCurrentlyAcceptable: (context) =>
      trackingService.trackingContextIsCurrentlyAcceptable(context),
    eventSink: trackingEvents,
    rateLimiter: trackingRateLimiter,
  }));
  app.use(createPublicTrackingScriptRouter());
  app.use(express.static(publicAssetsDirectory, {
    dotfiles: "deny",
    fallthrough: true,
    index: false,
    maxAge: "1h",
  }));
  app.use(
    "/api/workspaces/:workspaceId/tracking",
    createTrackingReadRouter({
      bootstrapService: bootstrap,
      getCurrentActor: actorProvider,
      trackingService,
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
    trackingEvents,
    trackingRateLimiter,
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

  callback(null, getAllowedWebOrigins().has(origin));
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
