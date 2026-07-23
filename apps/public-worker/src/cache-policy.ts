export const DEFAULT_HTML_CACHE_SECONDS = 60;
export const DEFAULT_UNAVAILABLE_CACHE_SECONDS = 15;

const PUBLIC_SITE_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;
const PUBLIC_PREVIEW_VERSION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.\d+(?:\.r[1-9]\d*\.w[a-z0-9]{1,16})?$/i;
const SITE_RUNTIME_PATH_PATTERN = /^\/site-runtime\.v[1-9]\d*\.js$/;
const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "assets",
  "cdn-cgi",
  "editor-assets",
  "favicon.ico",
  "fonts",
  "health",
  "handout-logo-icon.svg",
  "handout-logo.svg",
  "robots.txt",
]);

export type PublicRouteKind = "api" | "asset" | "health" | "public-site" | "recipient-link" | "screenshot" | "not-found";

export function classifyPublicRoute(pathname: string): PublicRouteKind {
  if (pathname === "/health") {
    return "health";
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api";
  }

  if (isPublicSiteScreenshotPath(pathname)) {
    return "screenshot";
  }

  if (isPublicRecipientLinkPath(pathname)) {
    return "recipient-link";
  }

  if (
    pathname === "/favicon.ico" ||
    pathname === "/handout-logo-icon.svg" ||
    pathname === "/handout-logo.svg" ||
    pathname === "/robots.txt" ||
    SITE_RUNTIME_PATH_PATTERN.test(pathname) ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/editor-assets/")
  ) {
    return "asset";
  }

  return isPublicSitePath(pathname) ? "public-site" : "not-found";
}

export function isPublicSiteScreenshotPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const filename = segments.at(-1);
  if ((segments.length < 2 || segments.length > 4) || (filename !== "embed.jpg" && filename !== "embed.png")) {
    return false;
  }

  const publicSegments = segments.slice(0, -1);
  if (publicSegments.length === 1) {
    return isShortPublicCode(publicSegments[0] ?? "");
  }
  return !RESERVED_FIRST_SEGMENTS.has(publicSegments[0] ?? "") &&
    publicSegments.every((segment) => PUBLIC_SITE_SEGMENT_PATTERN.test(segment));
}

export function isShortPublicSiteScreenshotPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2
    && segments[1] === "embed.jpg"
    && isShortPublicCode(segments[0] ?? "");
}

export function isPublicSitePath(pathname: string) {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  if (segments.length === 1) {
    return isShortPublicCode(segments[0] ?? "");
  }

  if (segments.length < 2 || segments.length > 3) {
    return false;
  }

  if (RESERVED_FIRST_SEGMENTS.has(segments[0] ?? "")) {
    return false;
  }

  return segments.every((segment) => PUBLIC_SITE_SEGMENT_PATTERN.test(segment));
}

export function isPublicRecipientLinkPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const isDocumentResolver = segments.length === 4;
  const isImageResolver = segments.length === 5 && segments.at(-1) === "embed.jpg";
  return (isDocumentResolver || isImageResolver) && isSitePublicId(segments[0] ?? "");
}

export function isShortPublicSitePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && isShortPublicCode(segments[0] ?? "");
}

export function isPublicPreviewVersion(value: string | null) {
  return Boolean(value && value.length <= 96 && PUBLIC_PREVIEW_VERSION_PATTERN.test(value));
}

export function readPositiveInteger(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function isShortPublicCode(value: string) {
  return /^[A-Za-z0-9_-]{6,16}$/.test(value);
}

function isSitePublicId(value: string) {
  return /^[A-Za-z0-9_-]{12}$/.test(value);
}
