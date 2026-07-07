export const DEFAULT_HTML_CACHE_SECONDS = 60;
export const DEFAULT_UNAVAILABLE_CACHE_SECONDS = 15;
export const DEFAULT_R2_SNAPSHOT_SECONDS = 300;
export const MAX_R2_SNAPSHOT_SECONDS = 3600;

const PUBLIC_SITE_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;
const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "assets",
  "cdn-cgi",
  "editor-assets",
  "favicon.ico",
  "health",
  "lightsite-logo.svg",
  "robots.txt",
]);

export type PublicRouteKind = "api" | "asset" | "health" | "public-site" | "not-found";

export function classifyPublicRoute(pathname: string): PublicRouteKind {
  if (pathname === "/health") {
    return "health";
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api";
  }

  if (
    pathname === "/favicon.ico" ||
    pathname === "/lightsite-logo.svg" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/editor-assets/")
  ) {
    return "asset";
  }

  return isPublicSitePath(pathname) ? "public-site" : "not-found";
}

export function isPublicSitePath(pathname: string) {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  if (segments.length < 2 || segments.length > 3) {
    return false;
  }

  if (RESERVED_FIRST_SEGMENTS.has(segments[0] ?? "")) {
    return false;
  }

  return segments.every((segment) => PUBLIC_SITE_SEGMENT_PATTERN.test(segment));
}

export function readPositiveInteger(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function buildPublicHtmlSnapshotKey(pathname: string) {
  const normalizedPathname = pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "index";

  return `public-html/v1/${normalizedPathname}/index.html`;
}

export function isSnapshotFresh(storedAt: string | undefined, now: Date, ttlSeconds: number) {
  if (!storedAt) {
    return false;
  }

  const storedAtMs = Date.parse(storedAt);

  if (!Number.isFinite(storedAtMs)) {
    return false;
  }

  return now.getTime() - storedAtMs <= ttlSeconds * 1000;
}
