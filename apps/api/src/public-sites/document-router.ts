import type { Request, Response } from "express";
import { Router } from "express";
import {
  renderPublicSiteHtmlDocument,
  renderUnavailablePublicSiteHtmlDocument,
} from "./html";
import {
  PUBLIC_SITE_SCREENSHOT_CACHE_CONTROL,
  PUBLIC_SITE_SCREENSHOT_CONTENT_TYPE,
  getPublicSiteScreenshotCacheKey,
  type PublicSiteScreenshotService,
} from "./screenshot";
import type { PublicSiteResolution, PublicSiteService } from "./service";
import { MAX_PUBLIC_RECIPIENT_QUERY_LENGTH } from "./recipient-link";
import {
  PUBLIC_SITE_RUNTIME,
  PUBLIC_SITE_RUNTIME_PATH,
} from "@handout/site-document/renderer";
import { classifyPreviewRequest } from "@handout/tracking-schema";
import type { TrackingRateLimiter } from "../tracking/rate-limit";
import type { TrackingV2ContextTokenService } from "../tracking/v2/context-token";
import type { TrackingV2Service } from "../tracking/v2/service";

export type PublicSiteDocumentRouterOptions = {
  publicSiteOrigin: string;
  publicSiteService: PublicSiteService;
  screenshotService: PublicSiteScreenshotService;
  trackingContextTokens?: TrackingV2ContextTokenService;
  trackingRateLimiter?: TrackingRateLimiter;
  trackingService?: TrackingV2Service;
};

const publicSiteDocumentSecurityHeaders = {
  "content-security-policy": [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-src https:",
    "img-src 'self' https: data:",
    "style-src 'unsafe-inline'",
  ].join("; "),
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
} as const;

export function createPublicSiteDocumentRouter(options: PublicSiteDocumentRouterOptions) {
  const router = Router();

  router.use((request, _response, next) => {
    if (request.path === "/api" || request.path.startsWith("/api/")) {
      next("router");
      return;
    }

    next();
  });

  router.use((_request, response, next) => {
    for (const [name, value] of Object.entries(publicSiteDocumentSecurityHeaders)) {
      response.setHeader(name, value);
    }

    next();
  });

  router.get(PUBLIC_SITE_RUNTIME_PATH, (_request, response) => {
    response
      .setHeader("cache-control", "public, max-age=31536000, immutable");
    response.type("application/javascript").send(PUBLIC_SITE_RUNTIME);
  });

  router.get("/:sitePublicId/:recipientName/:recipientCompany/:recipientWebsite/embed.jpg", (request, response) => {
    void resolveAndRedirectPublicRecipientScreenshot({ options, request, response });
  });

  router.get("/:shortCode/embed.jpg", (request, response) => {
    void resolveAndSendShortLinkScreenshot({ options, request, response });
  });

  router.get("/:workspaceSlug/:siteSlug/embed.png", redirectLegacyScreenshot);
  router.get("/:workspaceSlug/:siteSlug/:variantSlug/embed.png", redirectLegacyScreenshot);

  router.get("/:workspaceSlug/:siteSlug/embed.jpg", (request, response) => {
    void resolveAndSendPublicSiteScreenshot({
      input: {
        workspaceSlug: request.params.workspaceSlug ?? "",
        siteSlug: request.params.siteSlug ?? "",
      },
      options,
      request,
      response,
    });
  });

  router.get("/:workspaceSlug/:siteSlug/:variantSlug/embed.jpg", (request, response) => {
    void resolveAndSendPublicSiteScreenshot({
      input: {
        workspaceSlug: request.params.workspaceSlug ?? "",
        siteSlug: request.params.siteSlug ?? "",
        variantSlug: request.params.variantSlug ?? "",
      },
      options,
      request,
      response,
    });
  });

  router.get("/:sitePublicId/:recipientName/:recipientCompany/:recipientWebsite", (request, response) => {
    void resolveAndRedirectPublicRecipientLink({ options, request, response });
  });

  router.get("/:shortCode", (request, response) => {
    void resolveAndSendShortLinkDocument({ options, request, response });
  });

  router.get("/:workspaceSlug/:siteSlug", (request, response) => {
    void resolveAndSendPublicSiteDocument({
      input: {
        workspaceSlug: request.params.workspaceSlug ?? "",
        siteSlug: request.params.siteSlug ?? "",
      },
      origin: options.publicSiteOrigin,
      publicSiteService: options.publicSiteService,
      request,
      response,
    });
  });

  router.get("/:workspaceSlug/:siteSlug/:variantSlug", (request, response) => {
    void resolveAndSendPublicSiteDocument({
      input: {
        workspaceSlug: request.params.workspaceSlug ?? "",
        siteSlug: request.params.siteSlug ?? "",
        variantSlug: request.params.variantSlug ?? "",
      },
      origin: options.publicSiteOrigin,
      publicSiteService: options.publicSiteService,
      request,
      response,
    });
  });

  return router;
}

async function resolveAndRedirectPublicRecipientLink(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  try {
    const result = await resolvePublicRecipientRequest(input);
    if (!result) return;

    input.response
      .setHeader("cache-control", "no-store")
      .redirect(302, `/${result.shortCode}?v=${encodeURIComponent(result.version)}`);
  } catch {
    sendRetryableUnavailable(input.response);
  }
}

async function resolveAndRedirectPublicRecipientScreenshot(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  try {
    const result = await resolvePublicRecipientRequest(input);
    if (!result) return;

    input.response
      .setHeader("cache-control", "no-store")
      .redirect(302, `/${result.shortCode}/embed.jpg?v=${encodeURIComponent(result.version)}`);
  } catch {
    sendRetryableUnavailable(input.response);
  }
}

async function resolvePublicRecipientRequest(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  input.response.setHeader("referrer-policy", "no-referrer");
  const query = input.request.originalUrl.split("?", 2)[1] ?? "";
  if (query.length > MAX_PUBLIC_RECIPIENT_QUERY_LENGTH) {
    input.response.status(414).setHeader("cache-control", "no-store").end();
    return null;
  }

  const rateLimit = await input.options.trackingRateLimiter?.check({
    key: `public-recipient:${input.request.params.sitePublicId ?? "unknown"}:${input.request.ip}`,
    eventCount: 1,
  });
  if (rateLimit && !rateLimit.allowed) {
    input.response
      .status(429)
      .setHeader("cache-control", "no-store")
      .setHeader("retry-after", String(rateLimit.retryAfterSeconds))
      .end();
    return null;
  }

  const result = await input.options.publicSiteService.resolveRecipientLink({
    sitePublicId: input.request.params.sitePublicId ?? "",
    recipientName: input.request.params.recipientName ?? "",
    recipientCompany: input.request.params.recipientCompany ?? "",
    recipientWebsite: input.request.params.recipientWebsite ?? "",
    searchParams: new URL(input.request.originalUrl, input.options.publicSiteOrigin).searchParams,
  });
  if (result.status !== "available") {
    input.response.status(404).setHeader("cache-control", result.cacheControl).end();
    return null;
  }

  return result;
}

async function resolveAndSendShortLinkDocument(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  try {
    if (!await allowPublicRequest(
      input,
      `public-short:${input.request.params.shortCode ?? "unknown"}:${input.request.ip}`,
    )) return;
    const result = await input.options.publicSiteService.resolveShortLink(
      input.request.params.shortCode ?? "",
    );
    if (result.status !== "available") {
      input.response
        .status(404)
        .setHeader("cache-control", result.cacheControl)
        .type("html")
        .send(renderUnavailablePublicSiteHtmlDocument(
          input.options.publicSiteOrigin,
          input.request.path,
        ));
      return;
    }

    if (input.request.query.v !== result.version) {
      input.response
        .setHeader("cache-control", "no-store")
        .redirect(302, `/${result.shortCode}?v=${encodeURIComponent(result.version)}`);
      return;
    }

    const html = renderPublicSiteHtmlDocument({
      origin: input.options.publicSiteOrigin,
      payload: result.payload,
      publicPath: `/${result.shortCode}`,
    });
    if (!html) {
      input.response.status(404).setHeader("cache-control", "no-store").end();
      return;
    }

    input.response
      .status(200)
      .setHeader("cache-control", result.cacheControl)
      .type("html")
      .send(html);
  } catch {
    input.response
      .status(503)
      .setHeader("cache-control", "no-store")
      .type("html")
      .send(renderUnavailablePublicSiteHtmlDocument(
        input.options.publicSiteOrigin,
        input.request.path,
      ));
  }
}

async function resolveAndSendShortLinkScreenshot(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  try {
    if (!await allowPublicRequest(
      input,
      `public-short-image:${input.request.params.shortCode ?? "unknown"}:${input.request.ip}`,
    )) return;
    const result = await input.options.publicSiteService.resolveShortLink(
      input.request.params.shortCode ?? "",
    );
    if (result.status === "available" && input.request.query.v !== result.version) {
      input.response
        .setHeader("cache-control", "no-store")
        .redirect(302, `/${result.shortCode}/embed.jpg?v=${encodeURIComponent(result.version)}`);
      return;
    }
    await sendResolvedPublicSiteScreenshot({
      options: input.options,
      request: input.request,
      response: input.response,
      result,
    });
  } catch {
    sendRetryableUnavailable(input.response);
  }
}

function redirectLegacyScreenshot(request: Request, response: Response) {
  response
    .setHeader("cache-control", "no-store")
    .redirect(308, request.originalUrl.replace(/embed\.png(?=\?|$)/, "embed.jpg"));
}

async function resolveAndSendPublicSiteScreenshot(input: {
  input: {
    workspaceSlug: string;
    siteSlug: string;
    variantSlug?: string;
  };
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
}) {
  try {
    const result = await input.options.publicSiteService.resolve(input.input);
    await sendResolvedPublicSiteScreenshot({ ...input, result });
  } catch {
    sendRetryableUnavailable(input.response);
  }
}

function sendRetryableUnavailable(response: Response) {
  response
    .status(503)
    .setHeader("cache-control", "no-store")
    .setHeader("retry-after", "5")
    .end();
}

async function allowPublicRequest(
  input: Pick<Parameters<typeof resolveAndSendShortLinkDocument>[0], "options" | "request" | "response">,
  key: string,
) {
  const result = await input.options.trackingRateLimiter?.check({
    key,
    eventCount: 1,
  });
  if (!result || result.allowed) return true;
  input.response
    .status(429)
    .setHeader("cache-control", "no-store")
    .setHeader("retry-after", String(result.retryAfterSeconds))
    .end();
  return false;
}

async function sendResolvedPublicSiteScreenshot(input: {
  options: PublicSiteDocumentRouterOptions;
  request: Request;
  response: Response;
  result: PublicSiteResolution | Awaited<ReturnType<PublicSiteService["resolveShortLink"]>>;
}) {
  if (input.result.status !== "available") {
    input.response.status(404).end();
    return;
  }

  if (input.request.method === "HEAD") {
    const cacheKey = getPublicSiteScreenshotCacheKey(input.result.payload);
    if (!cacheKey) {
      input.response.status(404).end();
      return;
    }
    await recordSlackScreenshotLoad({
      cacheKey,
      options: input.options,
      payload: input.result.payload,
      request: input.request,
    });
    input.response.status(204).setHeader("cache-control", "no-store").end();
    return;
  }

  const screenshot = await input.options.screenshotService.render({
    origin: input.options.publicSiteOrigin,
    payload: input.result.payload,
  });
  if (!screenshot) {
    input.response.status(404).end();
    return;
  }

  await recordSlackScreenshotLoad({
    cacheKey: screenshot.cacheKey,
    options: input.options,
    payload: input.result.payload,
    request: input.request,
  });
  input.response
    .status(200)
    .setHeader("cache-control", PUBLIC_SITE_SCREENSHOT_CACHE_CONTROL)
    .setHeader("content-type", PUBLIC_SITE_SCREENSHOT_CONTENT_TYPE)
    .setHeader("content-length", String(screenshot.bytes.byteLength))
    .send(screenshot.bytes);
}

async function recordSlackScreenshotLoad(input: {
  cacheKey: string;
  options: PublicSiteDocumentRouterOptions;
  payload: Record<string, unknown>;
  request: Request;
}) {
  const bootstrap = getTrackingBootstrap(input.payload);
  const context = bootstrap && input.options.trackingContextTokens
    ? input.options.trackingContextTokens.verify(bootstrap.contextToken)
    : null;
  const classification = classifyPreviewRequest({
    resource: "og_image",
    userAgent: input.request.get("user-agent") ?? undefined,
  });

  if (!context || !input.options.trackingService || classification.platform !== "slack" || !classification.isPreviewBot) {
    return;
  }

  const rateLimit = await input.options.trackingRateLimiter?.check({
    key: `tracking-v2:og:slack:${context.workspaceId}:${context.siteId}:${context.recipientId ?? "default"}`,
    eventCount: 1,
  });
  if (rateLimit && !rateLimit.allowed) {
    return;
  }

  await input.options.trackingService.recordSlackShare({
    context,
    imageCacheKey: input.cacheKey,
  }).catch(() => {
    // Preview tracking is best-effort and never breaks image delivery.
  });
}

function getTrackingBootstrap(payload: Record<string, unknown>) {
  const value = payload.trackingV2;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const contextToken = Reflect.get(value, "contextToken");
  return typeof contextToken === "string" ? { contextToken } : null;
}

async function resolveAndSendPublicSiteDocument(input: {
  input: {
    workspaceSlug: string;
    siteSlug: string;
    variantSlug?: string;
  };
  origin: string;
  publicSiteService: PublicSiteService;
  request: Request;
  response: Response;
}) {
  try {
    sendPublicSiteDocument({
      origin: input.origin,
      request: input.request,
      response: input.response,
      result: await input.publicSiteService.resolve(input.input),
    });
  } catch {
    input.response.setHeader("cache-control", "no-store");
    input.response
      .status(503)
      .type("html")
      .send(renderUnavailablePublicSiteHtmlDocument(input.origin, input.request.path));
  }
}

function sendPublicSiteDocument(input: {
  origin: string;
  request: Request;
  response: Response;
  result: PublicSiteResolution;
}) {
  input.response.setHeader("cache-control", input.result.cacheControl);
  input.response.type("html");

  if (input.result.status !== "available") {
    input.response
      .status(404)
      .send(renderUnavailablePublicSiteHtmlDocument(input.origin, input.request.path));
    return;
  }

  const html = renderPublicSiteHtmlDocument({
    origin: input.origin,
    payload: input.result.payload,
  });

  if (!html) {
    input.response
      .status(404)
      .send(renderUnavailablePublicSiteHtmlDocument(input.origin, input.request.path));
    return;
  }

  input.response.status(200).send(html);
}
