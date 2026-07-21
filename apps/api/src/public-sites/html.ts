import { normalizePublishedSitePayload } from "@handout/content-schema";
import {
  buildPublicScreenshotPath,
  HANDOUT_THEME_CSS,
  renderPublicSiteHtml,
} from "@handout/site-document/renderer";

type PublicHtmlRenderInput = {
  origin: string;
  payload: Record<string, unknown>;
  publicPath?: string;
};

export function renderPublicSiteHtmlDocument(input: PublicHtmlRenderInput) {
  const payload = normalizePublishedSitePayload(input.payload);

  if (!payload) {
    return null;
  }

  const ogImagePath = input.publicPath
    ? `${input.publicPath.replace(/\/+$/, "")}/embed.jpg?v=${encodeURIComponent(
        `${payload.site.publishedVersionId}.${payload.selectedVariant?.revisionNumber ?? 0}`,
      )}`
    : buildPublicScreenshotPath(payload);
  const ogImageUrl = new URL(ogImagePath, input.origin).toString();

  return renderPublicSiteHtml({
    ...payload,
    metadata: {
      ...payload.metadata,
      ogImageUrl,
    },
  }, {
    includeTracking: true,
    origin: input.origin,
    ...(input.publicPath ? { publicPath: input.publicPath } : {}),
  });
}

export function renderPublicSiteScreenshotHtmlDocument(input: PublicHtmlRenderInput) {
  const payload = normalizePublishedSitePayload(input.payload);

  if (!payload) {
    return null;
  }

  return renderPublicSiteHtml(payload, {
    includeRuntime: false,
    includeTracking: false,
    origin: input.origin,
  });
}

export function renderUnavailablePublicSiteHtmlDocument(origin: string, path: string) {
  const canonicalUrl = new URL(path, origin).toString();

  return `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Page unavailable | Handout</title>
  <meta name="robots" content="noindex,nofollow">
  <link rel="canonical" href="${escapeAttribute(canonicalUrl)}">
  <style>${HANDOUT_THEME_CSS}*{box-sizing:border-box}body{display:grid;min-height:100svh;margin:0;padding:24px;place-items:center;background:var(--background);color:var(--foreground);font-family:"Geist Variable","Geist",ui-sans-serif,system-ui,sans-serif;letter-spacing:-.02em}.message{width:min(100%,440px)}small{color:var(--muted-foreground)}p{color:var(--tertiary-foreground);font-size:16px;font-weight:325;line-height:1.6}h1{margin:12px 0 0;font-size:32px;font-weight:500;letter-spacing:-.03em}</style>
</head>
<body><main class="message"><small>Handout</small><h1>This page is unavailable</h1><p>The link may be unpublished, archived, or no longer available.</p></main></body>
</html>`;
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
