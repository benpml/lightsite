import {
  DEFAULT_HTML_CACHE_SECONDS,
  DEFAULT_UNAVAILABLE_CACHE_SECONDS,
  classifyPublicRoute,
  isPublicPreviewVersion,
  isShortPublicSitePath,
  isShortPublicSiteScreenshotPath,
  readPositiveInteger,
} from "./cache-policy";

export interface Env {
  API_ORIGIN: string;
  ORIGIN_AUTH_SECRET: string;
  PUBLIC_ORIGIN?: string;
  EDGE_CACHE_HTML_SECONDS?: string;
  EDGE_CACHE_UNAVAILABLE_SECONDS?: string;
}

const ORIGIN_TIMEOUT_MS = 8000;
const SCREENSHOT_ORIGIN_TIMEOUT_MS = 20_000;
const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
const JPEG_CONTENT_TYPE = "image/jpeg";
const EDGE_CACHE_NAME = "handout-public-v1";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.redirect("https://www.handout.link", 308);
    }

    const routeKind = classifyPublicRoute(url.pathname);

    if (routeKind === "health") {
      return json({ ok: true, service: "handout-public-worker" }, 200, "no-store");
    }

    if (routeKind === "api") {
      return proxyOrigin(request, env, {
        cache: shouldCacheApiRequest(request, url) ? "read-through" : "none",
      });
    }

    if (routeKind === "asset") {
      return proxyOrigin(request, env, { cache: "read-through" });
    }

    if (routeKind === "screenshot") {
      return servePublicScreenshot(request, env, ctx);
    }

    if (routeKind === "recipient-link") {
      return withEdgeHeader(
        withNoStore(await fetchPublicOrigin(request, env), request.method),
        "proxy",
        request.method,
      );
    }

    if (routeKind !== "public-site") {
      return new Response("Not found", {
        status: 404,
        headers: securityHeaders({
          "cache-control": cacheControl(readUnavailableCacheSeconds(env)),
          "content-type": "text/plain; charset=utf-8",
        }),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: securityHeaders({
          allow: "GET, HEAD",
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
        }),
      });
    }

    return servePublicHtml(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

async function servePublicHtml(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const shortLinkVersion = isShortPublicSitePath(url.pathname)
    ? url.searchParams.get("v")
    : null;
  if (isShortPublicSitePath(url.pathname) && !shortLinkVersion) {
    return withEdgeHeader(
      withNoStore(await fetchPublicOrigin(request, env), request.method),
      "proxy",
      request.method,
    );
  }
  if (shortLinkVersion) {
    if (!isPublicPreviewVersion(shortLinkVersion)) {
      return invalidPublicVersion();
    }
    return withEdgeHeader(
      withNoStore(await fetchPublicOrigin(request, env), request.method),
      "proxy",
      request.method,
    );
  }
  url.search = "";
  const cacheKey = new Request(publicUrlFor(env, url.pathname), {
    method: "GET",
    headers: {
      accept: HTML_CONTENT_TYPE,
    },
  });
  const cache = await caches.open(EDGE_CACHE_NAME);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return withEdgeHeader(cached, "hit", request.method);
  }

  const canonicalRequest = new Request(cacheKey.url, request);
  const originResponse = await fetchPublicOrigin(canonicalRequest, env, { forceGet: true });
  const cacheSeconds = originResponse.ok
    ? readHtmlCacheSeconds(env)
    : readUnavailableCacheSeconds(env);
  const edgeResponse = sanitizeCacheableResponse(originResponse, cacheSeconds);

  if (isCacheableHtml(edgeResponse)) {
    ctx.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
  }

  return withEdgeHeader(edgeResponse, "miss", request.method);
}

async function servePublicScreenshot(request: Request, env: Env, _ctx: ExecutionContext) {
  const url = new URL(request.url);
  const suppliedVersion = url.searchParams.get("v");
  if (
    isShortPublicSiteScreenshotPath(url.pathname) &&
    suppliedVersion &&
    !isPublicPreviewVersion(suppliedVersion)
  ) {
    return invalidPublicVersion();
  }
  return withEdgeHeader(
    await fetchScreenshotOrigin(request, env),
    "proxy",
    request.method,
  );
}

function invalidPublicVersion() {
  return new Response("Not found", {
    status: 404,
    headers: securityHeaders({
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    }),
  });
}

async function fetchScreenshotOrigin(request: Request, env: Env) {
  try {
    return await fetchOrigin(request, env, { timeoutMs: SCREENSHOT_ORIGIN_TIMEOUT_MS });
  } catch {
    return new Response("Preview temporarily unavailable", {
      status: 503,
      headers: securityHeaders({
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "retry-after": "5",
      }),
    });
  }
}

async function proxyOrigin(
  request: Request,
  env: Env,
  options: {
    cache: "none" | "read-through";
  },
) {
  if (options.cache === "none" || request.method !== "GET") {
    return withEdgeHeader(await fetchPublicOrigin(request, env), "proxy", request.method);
  }

  const cache = await caches.open(EDGE_CACHE_NAME);
  const requestUrl = new URL(request.url);
  const cacheKey = new Request(publicUrlFor(env, requestUrl.pathname), {
    method: "GET",
    headers: {
      accept: request.headers.get("accept") ?? "*/*",
    },
  });
  const cached = await cache.match(cacheKey);

  if (cached) {
    return withEdgeHeader(cached, "hit", request.method);
  }

  const canonicalRequest = new Request(cacheKey.url, request);
  const originResponse = await fetchPublicOrigin(canonicalRequest, env);
  const cacheSeconds = shouldCacheOriginResponse(originResponse)
    ? readHtmlCacheSeconds(env)
    : readUnavailableCacheSeconds(env);
  const edgeResponse = sanitizeCacheableResponse(originResponse, cacheSeconds);

  if (shouldCacheOriginResponse(edgeResponse)) {
    await cache.put(cacheKey, edgeResponse.clone());
  }

  return withEdgeHeader(edgeResponse, "miss", request.method);
}

async function fetchPublicOrigin(
  request: Request,
  env: Env,
  options: { forceGet?: boolean } = {},
) {
  try {
    return await fetchOrigin(request, env, options);
  } catch {
    return new Response("Temporarily unavailable", {
      status: 503,
      headers: securityHeaders({
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "retry-after": "5",
      }),
    });
  }
}

async function fetchOrigin(
  request: Request,
  env: Env,
  options: { forceGet?: boolean; timeoutMs?: number } = {},
) {
  return fetch(buildOriginRequest(request, env, options));
}

export function buildOriginRequest(
  request: Request,
  env: Pick<Env, "API_ORIGIN" | "ORIGIN_AUTH_SECRET">,
  options: { forceGet?: boolean; timeoutMs?: number } = {},
) {
  const originUrl = new URL(request.url);
  const apiOrigin = new URL(env.API_ORIGIN);
  originUrl.protocol = apiOrigin.protocol;
  originUrl.host = apiOrigin.host;

  const headers = new Headers(request.headers);
  headers.set("x-handout-edge", "cloudflare-worker");
  headers.set("x-handout-origin-auth", env.ORIGIN_AUTH_SECRET);
  headers.set("x-forwarded-host", new URL(request.url).host);

  return new Request(originUrl, {
    body: options.forceGet || request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body,
    headers,
    method: options.forceGet ? "GET" : request.method,
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs ?? ORIGIN_TIMEOUT_MS),
    ...(request.body ? { duplex: "half" } : {}),
  });
}

function shouldCacheApiRequest(request: Request, url: URL) {
  return request.method === "GET" && url.pathname === "/api/tracking/script.js";
}

function shouldCacheOriginResponse(response: Response) {
  return response.status === 200 && !response.headers.has("set-cookie");
}

function isCacheableHtml(response: Response) {
  return shouldCacheOriginResponse(response)
    && (response.headers.get("content-type") ?? "").includes("text/html");
}

function sanitizeCacheableResponse(response: Response, cacheSeconds: number) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.set("cache-control", cacheControl(cacheSeconds));

  return new Response(response.body, {
    headers: securityHeaders(headers),
    status: response.status,
    statusText: response.statusText,
  });
}

function withEdgeHeader(response: Response, value: string, requestMethod: string) {
  const headers = new Headers(response.headers);
  headers.set("x-handout-edge-cache", value);

  return new Response(requestMethod === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function withNoStore(response: Response, requestMethod: string) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");

  return new Response(requestMethod === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function securityHeaders(headersInit: HeadersInit) {
  const headers = new Headers(headersInit);
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");

  return headers;
}

function publicUrlFor(env: Env, pathname: string) {
  const origin = env.PUBLIC_ORIGIN ?? "https://handout.link";

  return new URL(pathname, origin).toString();
}

function readHtmlCacheSeconds(env: Env) {
  return readPositiveInteger(env.EDGE_CACHE_HTML_SECONDS, DEFAULT_HTML_CACHE_SECONDS);
}

function readUnavailableCacheSeconds(env: Env) {
  return readPositiveInteger(env.EDGE_CACHE_UNAVAILABLE_SECONDS, DEFAULT_UNAVAILABLE_CACHE_SECONDS);
}

function cacheControl(seconds: number) {
  return `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`;
}

function json(body: unknown, status: number, cacheControlValue: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: securityHeaders({
      "cache-control": cacheControlValue,
      "content-type": "application/json; charset=utf-8",
    }),
  });
}
