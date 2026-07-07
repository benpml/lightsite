import {
  normalizePublishedSitePayload,
  type PublishedSitePayload,
  type PublicBlock,
  type PublicVariable,
  type PublicVariant,
} from "@lightsite/content-schema";
import { TRACKING_INGEST_ENDPOINT, TRACKING_SCRIPT_ENDPOINT } from "@lightsite/tracking-schema";

type PublicHtmlRenderInput = {
  origin: string;
  payload: Record<string, unknown>;
};

type VariableValueMap = Map<string, string>;

const VARIABLE_TOKEN_PATTERN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export function renderPublicSiteHtmlDocument(input: PublicHtmlRenderInput) {
  const payload = normalizePublishedSitePayload(input.payload);

  if (!payload) {
    return null;
  }

  const values = buildVariableValueMap(payload.variables, payload.selectedVariant);
  const metadata = getResolvedMetadata(payload, values, input.origin);
  const headerHtml = renderChrome(payload, values);
  const blocksHtml = payload.blocks.map((block) => renderBlock(block, values)).join("");
  const trackingScriptHtml = renderTrackingScript(payload);

  return renderHtmlDocument({
    body: `
      <main class="page">
        <article class="canvas">
          ${headerHtml}
          <div class="blocks">${blocksHtml}</div>
          <footer class="footer">
            <span>Made with</span>
            <span class="footer-mark" aria-hidden="true"></span>
          </footer>
        </article>
      </main>
      ${trackingScriptHtml}
    `,
    metadata,
  });
}

export function renderUnavailablePublicSiteHtmlDocument(origin: string, path = "/") {
  const canonicalUrl = buildAbsoluteUrl(path, origin) ?? origin;

  return renderHtmlDocument({
    body: `
      <main class="page page-center">
        <article class="unavailable">
          <p class="brand">Lightsite</p>
          <h1>This page is unavailable</h1>
          <p>The link may be unpublished, archived, or no longer available.</p>
        </article>
      </main>
    `,
    metadata: {
      title: "Page unavailable | Lightsite",
      description: "This Lightsite page is unavailable.",
      robots: "noindex,nofollow",
      canonicalUrl,
      ogImageUrl: new URL("/lightsite-logo.svg", origin).toString(),
    },
  });
}

function renderHtmlDocument(input: {
  body: string;
  metadata: ResolvedMetadata;
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.metadata.title)}</title>
  <link rel="canonical" href="${escapeAttribute(input.metadata.canonicalUrl)}">
  <meta name="description" content="${escapeAttribute(input.metadata.description)}">
  <meta name="robots" content="${escapeAttribute(input.metadata.robots)}">
  <meta property="og:title" content="${escapeAttribute(input.metadata.title)}">
  <meta property="og:description" content="${escapeAttribute(input.metadata.description)}">
  <meta property="og:image" content="${escapeAttribute(input.metadata.ogImageUrl)}">
  <meta property="og:url" content="${escapeAttribute(input.metadata.canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(input.metadata.title)}">
  <meta name="twitter:description" content="${escapeAttribute(input.metadata.description)}">
  <meta name="twitter:image" content="${escapeAttribute(input.metadata.ogImageUrl)}">
  <style>${PUBLIC_HTML_CSS}</style>
</head>
<body>
${input.body}
</body>
</html>`;
}

type ResolvedMetadata = {
  title: string;
  description: string;
  robots: "noindex,nofollow" | "index,follow";
  canonicalUrl: string;
  ogImageUrl: string;
};

function getResolvedMetadata(
  payload: PublishedSitePayload,
  values: VariableValueMap,
  origin: string,
): ResolvedMetadata {
  const canonicalPath = [
    "",
    payload.workspace.slug,
    payload.site.slug,
    payload.selectedVariant?.slug ?? null,
  ]
    .filter(Boolean)
    .join("/");
  const ogImageSrc = resolvePublicAssetSrc(payload.metadata.ogImage?.src ?? "");

  return {
    title: resolveVariables(payload.metadata.title, values),
    description: resolveVariables(payload.metadata.description, values),
    robots: payload.metadata.robots,
    canonicalUrl: new URL(canonicalPath, origin).toString(),
    ogImageUrl: ogImageSrc ? new URL(ogImageSrc, origin).toString() : new URL("/lightsite-logo.svg", origin).toString(),
  };
}

function renderChrome(payload: PublishedSitePayload, values: VariableValueMap) {
  const siteHeader = payload.chrome.siteHeader;
  const hero = payload.chrome.hero;
  const logoUrl = siteHeader.logoUrl ? resolvePublicAssetSrc(resolveVariables(siteHeader.logoUrl, values)) : null;
  const title = resolveVariables(hero.title, values);
  const subtitle = hero.subtitle ? resolveVariables(hero.subtitle, values) : null;
  const primaryButton = resolveHeaderButton({
    href: siteHeader.primaryButtonHref,
    label: siteHeader.primaryButtonText,
    values,
  });
  const secondaryButton = siteHeader.showSecondaryButton
    ? resolveHeaderButton({
      href: siteHeader.secondaryButtonHref,
      label: siteHeader.secondaryButtonText,
      values,
    })
    : null;
  const primaryAvatar = hero.avatarImageUrl ? renderResolvedImage({
    src: resolvePublicAssetSrc(resolveVariables(hero.avatarImageUrl, values)),
    alt: hero.avatarImageAlt ?? "",
    className: "hero-logo",
  }) : "";
  const secondaryAvatar = hero.avatarMode === "duo" && hero.avatarImageSecondaryUrl ? renderResolvedImage({
    src: resolvePublicAssetSrc(resolveVariables(hero.avatarImageSecondaryUrl, values)),
    alt: hero.avatarImageSecondaryAlt ?? "",
    className: "hero-logo",
  }) : "";

  return `
    <div class="topbar">
      <div class="topbar-brand">
        ${
          logoUrl
            ? `<img class="topbar-logo" src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(siteHeader.brandName || payload.workspace.name)}">`
            : `<p>${escapeHtml(siteHeader.brandName || payload.workspace.name)}</p>`
        }
      </div>
      <div class="topbar-actions">
        ${secondaryButton ? renderHeaderButton(secondaryButton, "secondary", "site-header-secondary") : ""}
        ${primaryButton ? renderHeaderButton(primaryButton, "primary", "site-header-primary") : ""}
      </div>
    </div>
    <header class="hero">
      ${primaryAvatar || secondaryAvatar ? `<div class="hero-logos">${primaryAvatar}${primaryAvatar && secondaryAvatar ? `<span class="hero-logo-divider"></span>` : ""}${secondaryAvatar}</div>` : ""}
      <div class="hero-copy">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>
    </header>
  `;
}

function renderBlock(block: PublicBlock, values: VariableValueMap): string {
  const shell = (content: string) => renderBlockShell(block, content);

  switch (block.type) {
    case "heading": {
      const tag = block.level === 1 ? "h1" : (block.level === 3 ? "h3" : "h2");
      return shell(`<${tag} class="block-heading block-heading-${block.level}">${escapeHtml(resolveVariables(block.text, values))}</${tag}>`);
    }

    case "text":
      return shell(`<p class="text">${escapeHtml(resolveVariables(block.text, values))}</p>`);

    case "divider":
      return shell(`<div class="divider" aria-hidden="true"><span></span></div>`);

    case "bullet-list":
    case "number-list": {
      const tag = block.type === "number-list" ? "ol" : "ul";
      const items = block.items.map((item) => `<li>${escapeHtml(resolveVariables(item, values))}</li>`).join("");
      return shell(`<${tag} class="list list-${block.type}">${items}</${tag}>`);
    }

    case "icon-list": {
      const items = block.items.map((item) => `
        <div class="icon-list-item">
          <span class="icon-tile icon-tile-sm" style="color:${escapeAttribute(getIconToneValue(item.iconTone))}">${iconSvg(item.icon)}</span>
          <span class="icon-list-text">${escapeHtml(resolveVariables(item.text, values))}</span>
        </div>
      `).join("");
      return shell(`<div class="icon-list">${items}</div>`);
    }

    case "image": {
      const src = resolvePublicAssetSrc(block.asset.src);
      return shell(renderMediaSurface({ alt: block.asset.alt, icon: iconSvg("image"), src }));
    }

    case "gif": {
      const src = resolvePublicAssetSrc(block.asset.src);
      return shell(renderMediaSurface({ alt: block.asset.alt, icon: iconSvg("gif"), src }));
    }

    case "image-card": {
      const src = block.src ? resolvePublicAssetSrc(resolveVariables(block.src, values)) : null;
      const buttonHref = block.includeButton ? resolveUrl(block.buttonUrl, values) : null;
      const buttonLabel = block.includeButton ? resolveVariables(block.buttonText, values).trim() : "";

      return shell(`
        <div class="image-card">
          <div class="image-card-inner">
            ${renderMediaSurface({ alt: block.alt, className: "image-card-media", icon: iconSvg("image"), src })}
            <div class="image-card-copy">
              <p class="image-card-title">${escapeHtml(resolveVariables(block.title, values))}</p>
              <p class="image-card-body">${escapeHtml(resolveVariables(block.body, values))}</p>
              ${buttonHref && buttonLabel ? renderSmallButton({
                href: buttonHref,
                label: buttonLabel,
                style: "outline",
                trackId: `${block.id}-button`,
              }) : ""}
            </div>
          </div>
        </div>
      `);
    }

    case "icon-card":
      return shell(`
        <div class="icon-card">
          ${block.includeIcon ? `<span class="icon-tile" style="color:${escapeAttribute(getIconToneValue(block.iconTone))}">${iconSvg(block.icon)}</span>` : ""}
          <p class="icon-card-title ${block.includeIcon ? "icon-card-title-spaced" : ""}">${escapeHtml(resolveVariables(block.title, values))}</p>
          <p class="icon-card-body">${escapeHtml(resolveVariables(block.body, values))}</p>
        </div>
      `);

    case "button": {
      const href = resolveUrl(block.href, values);
      const label = resolveVariables(block.label, values);
      return shell(renderSmallButton({ href, label, style: block.style, trackId: block.id }));
    }

    case "calendar": {
      const href = resolveUrl(block.href, values);
      const label = resolveVariables(block.label, values);
      return shell(renderSmallButton({ href, icon: iconSvg("calendar"), label, style: "filled", trackId: block.id }));
    }

    case "accordion": {
      const items = block.items.map((item) => `
        <details class="accordion-item" ${item.expanded ? "open" : ""}>
          <summary class="accordion-row">
            <span class="accordion-chevron">${iconSvg("chevron-down")}</span>
            <span class="accordion-title">${escapeHtml(resolveVariables(item.title, values))}</span>
          </summary>
          <p class="accordion-body">${escapeHtml(resolveVariables(item.body, values))}</p>
        </details>
      `).join("");
      return shell(`<div class="accordion">${items}</div>`);
    }

    case "video": {
      const thumbnail = block.thumbnail ? resolvePublicAssetSrc(resolveVariables(block.thumbnail, values)) : null;
      return shell(`
        <div class="video-card">
          <div class="video-frame">
            ${thumbnail ? `<img src="${escapeAttribute(thumbnail)}" alt="">` : `<div class="video-placeholder">${iconSvg("video")}</div>`}
            <span class="video-play"><span>${iconSvg("play")}</span></span>
          </div>
        </div>
      `);
    }

    case "testimonial": {
      const avatar = block.avatar ? resolvePublicAssetSrc(resolveVariables(block.avatar, values)) : null;
      return shell(`
        <div class="testimonial">
          <p class="testimonial-quote">${escapeHtml(resolveVariables(block.quote, values))}</p>
          <div class="testimonial-person">
            <span class="testimonial-avatar">${avatar ? `<img src="${escapeAttribute(avatar)}" alt="">` : iconSvg("quote")}</span>
            <span class="testimonial-copy">
              <span class="testimonial-name">${escapeHtml(resolveVariables(block.name, values))}</span>
              <span class="testimonial-role">${escapeHtml(resolveVariables(block.role, values))}</span>
            </span>
          </div>
        </div>
      `);
    }

    case "logo-grid": {
      const logos = block.logos.map((logo) => {
        const src = logo.image ? resolvePublicAssetSrc(resolveVariables(logo.image, values)) : null;
        return `
          <div class="logo-grid-item">
            <span class="logo-upload">${src ? `<img src="${escapeAttribute(src)}" alt="">` : iconSvg("image")}</span>
            <span class="logo-name">${escapeHtml(resolveVariables(logo.name, values))}</span>
          </div>
        `;
      }).join("");
      return shell(`<div class="logo-grid">${logos}</div>`);
    }
  }
}

function renderBlockShell(block: PublicBlock, content: string) {
  const padding = block.type === "heading" ? "block-shell-heading" : block.type === "text" ? "block-shell-text" : "block-shell-default";
  return `<div class="block-shell ${padding}" data-block-type="${escapeAttribute(block.type)}">${content}</div>`;
}

function renderMediaSurface(input: {
  alt: string;
  className?: string;
  icon: string;
  src: string | null;
}) {
  return `
    <div class="media-surface ${input.className ? escapeAttribute(input.className) : ""} ${input.src ? "media-surface-filled" : "media-surface-empty"}">
      ${input.src ? `<img src="${escapeAttribute(input.src)}" alt="${escapeAttribute(input.alt)}">` : input.icon}
    </div>
  `;
}

function renderSmallButton(input: {
  href: string | null;
  icon?: string;
  label: string;
  style: "filled" | "outline";
  trackId: string;
}) {
  if (!input.href || !input.label.trim()) {
    return "";
  }

  return `<a class="small-button small-button-${input.style}" href="${escapeAttribute(input.href)}" target="_blank" rel="noopener noreferrer" data-track-click-id="${escapeAttribute(input.trackId)}" data-track-label="${escapeAttribute(input.label)}">${input.icon ?? ""}${escapeHtml(input.label)}</a>`;
}

function renderResolvedImage(input: { src: string | null; alt: string; className: string }) {
  if (!input.src) {
    return "";
  }

  return `<img class="${escapeAttribute(input.className)}" src="${escapeAttribute(input.src)}" alt="${escapeAttribute(input.alt)}">`;
}

function renderTrackingScript(payload: PublishedSitePayload) {
  if (!payload.tracking.token || payload.tracking.mode === "off") {
    return "";
  }

  return `<script src="${TRACKING_SCRIPT_ENDPOINT}" defer data-lightsite-tracking="${escapeAttribute(JSON.stringify(payload.tracking))}" data-lightsite-ingest="${TRACKING_INGEST_ENDPOINT}"></script>`;
}

function buildVariableValueMap(
  variables: PublicVariable[],
  variant: PublicVariant | null,
): VariableValueMap {
  const values = new Map<string, string>();

  for (const variable of variables) {
    const variantValue = variant?.variableValues[variable.id];
    values.set(variable.id, variantValue && variantValue.trim().length > 0 ? variantValue : variable.defaultValue);
  }

  return values;
}

function resolveVariables(value: string, values: VariableValueMap): string {
  if (!value.includes("{{")) {
    return value;
  }

  return value.replace(VARIABLE_TOKEN_PATTERN, (_match, variableId: string) => values.get(variableId) ?? "");
}

function resolveUrl(value: string, values: VariableValueMap): string | null {
  const resolved = resolveVariables(value, values).trim();

  try {
    const url = new URL(resolved);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolvePublicAssetSrc(src: string): string | null {
  const value = src.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value.startsWith("//") ? null : value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildAbsoluteUrl(path: string, origin: string) {
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

function iconSvg(icon: string) {
  if (icon === "calendar") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  if (icon === "chevron-down") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (icon === "gif") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-4H6M11 8v8M14 16V8h5M14 12h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (icon === "image") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 16 5-5 4 4 2-2 7 7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="9" r="1" fill="currentColor"/></svg>`;
  }

  if (icon === "play") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor"/></svg>`;
  }

  if (icon === "quote") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H5v4h4v6H3v-6a6 6 0 0 1 6-6v2Zm12 0h-4v4h4v6h-6v-6a6 6 0 0 1 6-6v2Z" fill="currentColor"/></svg>`;
  }

  if (icon === "video") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h10a2 2 0 0 1 2 2v1l4-2v8l-4-2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7 12 3l8 4v10l-8 4-8-4V7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 7l8 4 8-4M12 11v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

function getIconToneValue(tone: string) {
  if (tone === "amber") return "#d97706";
  if (tone === "blue") return "#2563eb";
  if (tone === "cyan") return "#0891b2";
  if (tone === "pink") return "#db2777";
  if (tone === "rose") return "#e11d48";
  if (tone === "teal") return "#0d9488";
  if (tone === "violet") return "#7c3aed";
  return "currentColor";
}

function resolveHeaderButton(input: {
  href: string | null;
  label: string | null;
  values: VariableValueMap;
}) {
  if (!input.href || !input.label) {
    return null;
  }

  const href = resolveUrl(input.href, input.values);
  const label = resolveVariables(input.label, input.values).trim();

  if (!href || !label) {
    return null;
  }

  return { href, label };
}

function renderHeaderButton(
  button: { href: string; label: string },
  tone: "primary" | "secondary",
  trackId: string,
) {
  return `<a class="topbar-button topbar-button-${tone}" href="${escapeAttribute(button.href)}" target="_blank" rel="noopener noreferrer" data-track-click-id="${escapeAttribute(trackId)}" data-track-label="${escapeAttribute(button.label)}">${escapeHtml(button.label)}</a>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const PUBLIC_HTML_CSS = `
:root{color-scheme:light;--page-background:#fafafa;--background:#ffffff;--foreground:#18181b;--muted:#f4f4f5;--muted-foreground:#71717a;--tertiary-foreground:#52525b;--border:#e4e4e7;--border-subtle:#f4f4f5;--primary:#18181b;--primary-foreground:#fafafa;--ring:#a1a1aa}
*{box-sizing:border-box}
html{font-family:"Inter Tight Variable","Inter Tight",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--background);color:var(--foreground)}
body{margin:0}
.page{min-height:100svh;background:var(--background);color:var(--foreground);padding:0}
.page-center{display:flex;align-items:center;justify-content:center;padding:48px 20px}
.canvas{display:flex;min-height:100svh;width:100%;min-width:720px;margin:0 auto;flex-direction:column;background:var(--background)}
.topbar{display:flex;height:54px;width:100%;max-width:600px;margin:0 auto;align-items:center;gap:10px;padding:12px 0}
.topbar-brand{min-width:0;flex:1}
.topbar-brand p{margin:0;font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-logo{display:block;height:20px;width:auto;object-fit:contain}
.topbar-actions{display:flex;align-items:center;gap:8px}
.topbar-button{display:inline-flex;height:30px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;padding:0 10px;color:var(--foreground);font-size:14px;line-height:20px;font-weight:500;text-decoration:none;white-space:nowrap;transition:background-color .15s ease,color .15s ease,transform .15s ease,box-shadow .15s ease}
.topbar-button-primary{border-color:transparent;background:var(--primary);color:var(--primary-foreground);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.topbar-button-secondary{background:var(--background);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.topbar-button-primary:hover{background:color-mix(in srgb,var(--primary) 80%,transparent)}
.topbar-button-secondary:hover{background:var(--muted);color:var(--foreground)}
.topbar-button:active{transform:translateY(1px)}
.hero{display:flex;min-height:204px;width:100%;max-width:600px;margin:0 auto;flex-direction:column;align-items:center;justify-content:center;gap:16px;overflow:hidden;border-top:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);padding:32px 28px;text-align:center}
.hero-logos{display:flex;align-items:center;justify-content:center;gap:5px}
.hero-logo{display:flex;width:56px;height:56px;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--background)}
.hero-logo img{display:block;width:40px;height:auto;object-fit:contain}
.hero-logo-divider{display:block;width:17px;height:1px;background:var(--border-subtle)}
.hero-copy{display:flex;max-width:100%;flex-direction:column;align-items:center;gap:4px}
h1{width:400px;max-width:100%;margin:0;font-size:28px;line-height:36px;font-weight:500;letter-spacing:0;text-wrap:balance}
.subtitle{width:400px;max-width:100%;margin:0;color:var(--muted-foreground);font-size:20px;line-height:28px}
.blocks{display:flex;width:100%;max-width:600px;margin:0 auto;flex:1;flex-direction:column;padding-top:20px}
.block-shell{position:relative;width:100%;border-radius:10px;padding-left:6px;padding-right:6px;outline:none}
.block-shell+.block-shell{margin-top:4px}
.block-shell-heading{padding-top:2px;padding-bottom:2px}
.block-shell-text{padding-top:4px;padding-bottom:4px}
.block-shell-default{padding-top:6px;padding-bottom:6px}
.block-heading{display:block;min-height:28px;margin:0;white-space:pre-wrap;font-weight:500;letter-spacing:0}
.block-heading-1{font-size:20px;line-height:28px}
.block-heading-2,.block-heading-3{font-size:16px;line-height:28px}
.text{display:block;min-height:24px;margin:0;white-space:pre-wrap;color:var(--secondary-foreground);font-size:16px;line-height:24px}
.divider{padding:12px 0}
.divider span{display:block;height:1px;background:var(--border-subtle)}
.list{margin:4px 0;padding-left:32px;color:var(--secondary-foreground);font-size:16px;line-height:24px}
.list-bullet-list{list-style-type:disc}
.list-number-list{list-style-type:decimal}
.list li{padding-left:4px}
.icon-list{display:flex;width:544px;max-width:100%;flex-direction:column;gap:6px}
.icon-list-item{display:flex;align-items:center;gap:8px}
.icon-list-text{display:block;min-height:24px;min-width:0;flex:1;white-space:pre-wrap;font-size:16px;line-height:24px}
.icon-tile{display:flex;width:40px;height:40px;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:10px;background:var(--background)}
.icon-tile-sm{width:24px;height:24px;border-radius:6px}
.icon-tile svg,.small-button svg,.accordion-chevron svg,.video-placeholder svg,.video-play svg,.testimonial-avatar svg,.logo-upload svg{width:1em;height:1em}
.icon-tile svg{width:20px;height:20px}
.icon-tile-sm svg{width:16px;height:16px}
.media-surface{display:flex;height:220px;width:100%;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;color:var(--muted-foreground)}
.media-surface-empty{border:1px dashed var(--border);background:color-mix(in srgb,var(--muted) 40%,transparent)}
.media-surface-filled{background:var(--background)}
.media-surface img{width:100%;height:100%;object-fit:cover}
.media-surface svg{width:24px;height:24px}
.image-card{border:1px solid var(--border);border-radius:14px;background:var(--background);padding:6px 20px 6px 6px}
.image-card-inner{display:flex;height:128px;align-items:center;gap:24px;border-radius:12px}
.image-card-media{height:128px;width:200px;flex-shrink:0;border:0;background:transparent}
.image-card-copy{min-width:0;flex:1}
.image-card-title,.icon-card-title{margin:0;font-size:16px;line-height:24px;font-weight:500}
.image-card-body,.icon-card-body{margin:0;color:var(--tertiary-foreground);font-size:14px;line-height:24px}
.icon-card{border:1px solid var(--border);border-radius:14px;background:var(--background);padding:16px}
.icon-card-title{font-size:20px;line-height:28px}
.icon-card-title-spaced{margin-top:12px}
.small-button{display:inline-flex;height:30px;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:8px;padding:0 10px;color:var(--foreground);font-size:14px;line-height:20px;font-weight:500;text-decoration:none;white-space:nowrap;transition:background-color .15s ease,color .15s ease,transform .15s ease,box-shadow .15s ease}
.small-button-filled{background:var(--primary);color:var(--primary-foreground);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.small-button-outline{border-color:var(--border);background:var(--background);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.small-button-filled:hover{background:color-mix(in srgb,var(--primary) 80%,transparent)}
.small-button-outline:hover{background:var(--muted);color:var(--foreground)}
.small-button:active{transform:translateY(1px)}
.small-button:focus-visible{outline:3px solid color-mix(in srgb,var(--ring) 50%,transparent);outline-offset:2px}
.accordion{overflow:hidden;border:1px solid var(--border);border-radius:14px;background:var(--background)}
.accordion-item{border-bottom:1px solid var(--border)}
.accordion-item:last-child{border-bottom:0}
.accordion-row{display:flex;cursor:pointer;list-style:none;align-items:center;gap:8px;padding:12px 16px}
.accordion-row::-webkit-details-marker{display:none}
.accordion-row::marker{content:""}
.accordion-chevron{display:flex;width:24px;height:24px;flex-shrink:0;align-items:center;justify-content:center;border-radius:6px;color:var(--muted-foreground);transform:rotate(-90deg);transition:background-color .15s ease,color .15s ease,transform .15s ease}
.accordion-row:hover .accordion-chevron{background:var(--muted);color:var(--foreground)}
.accordion-item[open] .accordion-chevron{transform:rotate(0deg)}
.accordion-title{min-width:0;flex:1;margin:0;font-size:16px;line-height:24px;font-weight:500}
.accordion-body{margin:0 16px 12px 48px;color:var(--tertiary-foreground);font-size:14px;line-height:24px}
.video-card{overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--background)}
.video-frame{position:relative;height:241px;width:100%;overflow:hidden;background:var(--primary);color:var(--primary-foreground)}
.video-frame img{width:100%;height:100%;object-fit:cover}
.video-placeholder{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:color-mix(in srgb,var(--primary-foreground) 80%,transparent)}
.video-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.video-play span{display:flex;width:72px;height:72px;align-items:center;justify-content:center;border-radius:9999px;background:color-mix(in srgb,var(--primary-foreground) 35%,transparent)}
.testimonial{border:1px solid var(--border);border-radius:18px;background:var(--background);padding:16px}
.testimonial-quote{margin:0;font-size:16px;line-height:24px}
.testimonial-person{display:flex;align-items:center;gap:12px;margin-top:16px}
.testimonial-avatar{display:flex;width:36px;height:36px;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--border);border-radius:9999px;background:var(--secondary);color:var(--secondary-foreground)}
.testimonial-avatar img{width:100%;height:100%;object-fit:cover}
.testimonial-copy{display:flex;min-width:0;flex:1;flex-direction:column}
.testimonial-name{font-size:14px;line-height:20px;font-weight:500}
.testimonial-role{color:var(--tertiary-foreground);font-size:14px;line-height:20px}
.logo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:8px;row-gap:12px}
.logo-grid-item{position:relative;display:flex;height:116px;flex-direction:column;align-items:center;justify-content:flex-start;border-radius:8px;text-align:center;color:var(--tertiary-foreground)}
.logo-upload{display:flex;width:40px;height:40px;align-items:center;justify-content:center;overflow:hidden;margin-top:16px;border:1px solid var(--border);border-radius:8px;background:var(--background);color:var(--muted-foreground)}
.logo-upload img{width:100%;height:100%;object-fit:contain}
.logo-name{height:24px;margin-top:8px;padding:0 8px;color:var(--foreground);font-size:16px;line-height:24px;text-align:center}
.footer{display:flex;height:44px;width:100%;max-width:600px;margin:40px auto 0;align-items:center;justify-content:center;gap:8px;border-top:1px solid var(--border-subtle);color:var(--muted-foreground);font-size:14px;line-height:20px}
.footer-mark{display:inline-block;width:83px;height:17px;background:var(--muted-foreground);-webkit-mask:url('/lightsite-logo.svg') center / contain no-repeat;mask:url('/lightsite-logo.svg') center / contain no-repeat}
.unavailable{width:100%;max-width:448px}
.unavailable .brand{margin:0;color:var(--muted-foreground);font-size:14px;line-height:20px;font-weight:500}
.unavailable h1{margin:12px 0 0;font-size:36px;line-height:40px}
.unavailable p:last-child{margin:12px 0 0;color:var(--muted-foreground);font-size:16px;line-height:28px}
@media (max-width:720px){.canvas{min-width:0}.topbar,.hero,.blocks,.footer{max-width:100%}}
@media (max-width:640px){.hero{padding:32px 20px}h1{font-size:28px;line-height:36px}.subtitle{font-size:18px;line-height:28px}.heading{font-size:24px;line-height:32px}.logos{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
