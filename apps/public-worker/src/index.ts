import {
  DEFAULT_HTML_CACHE_SECONDS,
  DEFAULT_R2_SNAPSHOT_SECONDS,
  DEFAULT_UNAVAILABLE_CACHE_SECONDS,
  MAX_R2_SNAPSHOT_SECONDS,
  buildPublicHtmlSnapshotKey,
  buildRecipientPreviewKey,
  classifyPublicRoute,
  isShortPublicSitePath,
  isSnapshotFresh,
  readPositiveInteger,
} from "./cache-policy";

export interface Env {
  API_ORIGIN: string;
  PUBLIC_ORIGIN?: string;
  EDGE_CACHE_HTML_SECONDS?: string;
  EDGE_CACHE_UNAVAILABLE_SECONDS?: string;
  EDGE_R2_SNAPSHOT_SECONDS?: string;
  SNAPSHOT_BUCKET?: R2Bucket;
  PREVIEW_BUCKET?: R2Bucket;
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
      return withEdgeHeader(await fetchOrigin(request, env), "proxy", request.method);
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
    return withEdgeHeader(await fetchOrigin(request, env), "proxy", request.method);
  }
  if (!shortLinkVersion) url.search = "";
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

  const snapshotKey = buildPublicHtmlSnapshotKey(url.pathname, shortLinkVersion);
  const r2SnapshotSeconds = readPositiveInteger(
    env.EDGE_R2_SNAPSHOT_SECONDS,
    DEFAULT_R2_SNAPSHOT_SECONDS,
    MAX_R2_SNAPSHOT_SECONDS,
  );
  const r2Snapshot = await readR2Snapshot(env, snapshotKey, r2SnapshotSeconds, new Date());

  if (r2Snapshot) {
    ctx.waitUntil(cache.put(cacheKey, r2Snapshot.clone()));
    return withEdgeHeader(r2Snapshot, "r2", request.method);
  }

  const originResponse = await fetchOrigin(request, env, { forceGet: true });
  const cacheSeconds = originResponse.ok
    ? readHtmlCacheSeconds(env)
    : readUnavailableCacheSeconds(env);
  const edgeResponse = sanitizeCacheableResponse(originResponse, cacheSeconds);

  if (isCacheableHtml(edgeResponse)) {
    ctx.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
    ctx.waitUntil(writeR2Snapshot(env, snapshotKey, edgeResponse.clone()));
  }

  if (!originResponse.ok) {
    const staleSnapshot = await readR2Snapshot(env, snapshotKey, Number.POSITIVE_INFINITY, new Date());

    if (staleSnapshot) {
      return withEdgeHeader(staleSnapshot, "stale-r2", request.method);
    }
  }

  return withEdgeHeader(edgeResponse, "miss", request.method);
}

async function servePublicScreenshot(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const previewKey = buildRecipientPreviewKey(url.pathname, url.searchParams.get("v"));

  if (request.method !== "GET" || !previewKey || !env.PREVIEW_BUCKET) {
    return withEdgeHeader(
      await fetchScreenshotOrigin(request, env),
      "proxy",
      request.method,
    );
  }

  const storedPreview = await readRecipientPreview(env, previewKey).catch(() => null);
  if (storedPreview) {
    if (isSlackPreviewRequest(request)) {
      ctx.waitUntil(
        fetchOrigin(new Request(request, { method: "HEAD" }), env, {
          timeoutMs: SCREENSHOT_ORIGIN_TIMEOUT_MS,
        })
          .then((response) => response.body?.cancel())
          .catch(() => undefined),
      );
    }
    return withEdgeHeader(storedPreview, "r2", request.method);
  }

  const originResponse = await fetchScreenshotOrigin(request, env);
  if (!isCacheableRecipientPreview(originResponse)) {
    return withEdgeHeader(originResponse, "miss", request.method);
  }

  const bytes = await originResponse.arrayBuffer();
  const response = recipientPreviewResponse(bytes);
  ctx.waitUntil(writeRecipientPreview(env, previewKey, bytes));
  return withEdgeHeader(response, "miss", request.method);
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
      }),
    });
  }
}

async function readRecipientPreview(env: Env, key: string) {
  const object = await env.PREVIEW_BUCKET?.get(key);
  if (!object) return null;

  return new Response(object.body, {
    status: 200,
    headers: securityHeaders({
      "cache-control": "no-store",
      "content-length": String(object.size),
      "content-type": object.httpMetadata?.contentType ?? JPEG_CONTENT_TYPE,
      etag: object.httpEtag,
    }),
  });
}

async function writeRecipientPreview(env: Env, key: string, bytes: ArrayBuffer) {
  await env.PREVIEW_BUCKET?.put(key, bytes, {
    customMetadata: {
      storedAt: new Date().toISOString(),
    },
    httpMetadata: {
      contentType: JPEG_CONTENT_TYPE,
    },
  });
}

function recipientPreviewResponse(bytes: ArrayBuffer) {
  return new Response(bytes, {
    status: 200,
    headers: securityHeaders({
      "cache-control": "no-store",
      "content-length": String(bytes.byteLength),
      "content-type": JPEG_CONTENT_TYPE,
    }),
  });
}

function isCacheableRecipientPreview(response: Response) {
  return response.status === 200
    && (response.headers.get("content-type") ?? "").toLowerCase().startsWith(JPEG_CONTENT_TYPE);
}

function isSlackPreviewRequest(request: Request) {
  return /\bslack(?:bot|-imgproxy)?\b/i.test(request.headers.get("user-agent") ?? "");
}

async function proxyOrigin(
  request: Request,
  env: Env,
  options: {
    cache: "none" | "read-through";
  },
) {
  if (options.cache === "none" || request.method !== "GET") {
    return withEdgeHeader(await fetchOrigin(request, env), "proxy", request.method);
  }

  const cache = await caches.open(EDGE_CACHE_NAME);
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return withEdgeHeader(cached, "hit", request.method);
  }

  const originResponse = await fetchOrigin(request, env);
  const cacheSeconds = shouldCacheOriginResponse(originResponse)
    ? readHtmlCacheSeconds(env)
    : readUnavailableCacheSeconds(env);
  const edgeResponse = sanitizeCacheableResponse(originResponse, cacheSeconds);

  if (shouldCacheOriginResponse(edgeResponse)) {
    await cache.put(cacheKey, edgeResponse.clone());
  }

  return withEdgeHeader(edgeResponse, "miss", request.method);
}

async function fetchOrigin(
  request: Request,
  env: Env,
  options: { forceGet?: boolean; timeoutMs?: number } = {},
) {
  const originUrl = new URL(request.url);
  const apiOrigin = new URL(env.API_ORIGIN);
  originUrl.protocol = apiOrigin.protocol;
  originUrl.host = apiOrigin.host;

  const headers = new Headers(request.headers);
  headers.set("x-handout-edge", "cloudflare-worker");
  headers.set("x-forwarded-host", new URL(request.url).host);

  return fetch(originUrl, {
    body: options.forceGet || request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body,
    headers,
    method: options.forceGet ? "GET" : request.method,
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs ?? ORIGIN_TIMEOUT_MS),
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

async function readR2Snapshot(
  env: Env,
  key: string,
  ttlSeconds: number,
  now: Date,
) {
  if (!env.SNAPSHOT_BUCKET) {
    return null;
  }

  const object = await env.SNAPSHOT_BUCKET.get(key);

  if (!object || !isSnapshotFresh(object.customMetadata?.storedAt, now, ttlSeconds)) {
    return null;
  }

  return new Response(object.body, {
    headers: securityHeaders({
      "cache-control": cacheControl(readHtmlCacheSeconds(env)),
      "content-type": object.httpMetadata?.contentType ?? HTML_CONTENT_TYPE,
      etag: object.httpEtag,
    }),
  });
}

async function writeR2Snapshot(env: Env, key: string, response: Response) {
  if (!env.SNAPSHOT_BUCKET || response.status !== 200) {
    return;
  }

  const html = await response.text();

  if (html.length === 0) {
    return;
  }

  await env.SNAPSHOT_BUCKET.put(key, html, {
    customMetadata: {
      storedAt: new Date().toISOString(),
    },
    httpMetadata: {
      contentType: response.headers.get("content-type") ?? HTML_CONTENT_TYPE,
    },
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
