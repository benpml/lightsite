import {
  TRACKING_V2_SCRIPT_ENDPOINT,
  TRACKING_V2_VISITOR_NOTICE_VERSION,
} from "@handout/tracking-schema";
import {
  HANDOUT_THEME_CSS,
  normalizeEditorHighlightColor,
  normalizeEditorTextColor,
} from "@handout/design-tokens";
import { normalizeWebsiteDomain } from "@handout/domain";
import {
  escapeHTML,
  escapeHTMLAttribute,
  serializeChildrenToHTMLString,
  type MarkProps,
  type NodeProps,
} from "@tiptap/static-renderer/json/html-string";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import type { Mark as ProseMirrorMark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  SITE_DOCUMENT_EXTENSIONS,
  SITE_DOCUMENT_PROSEMIRROR_SCHEMA,
} from "./tiptap/site-extensions";
import { normalizeSiteIconColor, renderSiteIconSvg } from "./site-icons";

import {
  getSiteMetadata,
  getSiteVariableValues,
  getSiteSidebarModel,
  getVisibleSitePages,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
  type SiteContent,
  type TiptapMark,
  type TiptapNode,
} from "./model";
import { SITE_DOCUMENT_CSS } from "./styles";
import {
  buildPublicSiteVariableValues,
  getResolvedNodeText,
  resolvePublicSiteTracking,
  resolveSiteTemplate,
  sanitizePublicActionUrl,
  sanitizeTrackingPrivacyPolicyUrl,
  type ResolvedTrackingElement,
} from "./tracking-manifest";

export type RenderPublicSiteOptions = {
  activePageSlug?: string | null;
  includeRuntime?: boolean;
  includeTracking?: boolean;
  logoDelivery?: "preview" | "public";
  origin?: string;
  runtimeMode?: "external" | "inline";
};

export const PUBLIC_SITE_LOGO_ENDPOINT = "/api/public/site-logo" as const;
export const PUBLIC_SITE_RUNTIME_PATH = "/site-runtime.v5.js" as const;
/**
 * Shared iframe capability contract for generated site documents.
 *
 * `allow-same-origin` is required for srcDoc previews to load the canonical
 * same-origin font and asset URLs. The document itself is produced by the
 * escaped site renderer and only executes the controlled site runtime.
 */
export const SITE_DOCUMENT_IFRAME_SANDBOX =
  "allow-popups allow-same-origin allow-scripts" as const;

type RenderContext = {
  logoDelivery: "preview" | "public";
  payload: PublishedSitePayload;
  trackingElementsById: ReadonlyMap<string, ResolvedTrackingElement>;
  values: Readonly<Record<string, string>>;
};

type NodeRendererProps = NodeProps<TiptapNode, string | string[]>;
type MarkRendererProps = MarkProps<TiptapMark, string | string[], TiptapNode>;

export function renderPublicSiteHtml(
  payload: PublishedSitePayload,
  options: RenderPublicSiteOptions = {},
) {
  // PUBLISHED-SITE PARITY: draft Preview reaches this renderer through
  // renderPublicSitePreviewHtml, so this markup and stylesheet are the live contract.
  const origin = normalizeOrigin(options.origin);
  const includeTracking = options.includeTracking !== false;
  const runtimeScript = options.includeRuntime === false
    ? ""
    : options.runtimeMode === "inline"
      ? `<script>${PUBLIC_SITE_RUNTIME}</script>`
      : `<script defer src="${PUBLIC_SITE_RUNTIME_PATH}"></script>`;
  const pages = getVisibleSitePages(payload.content);
  const activePage = pages.find((page) => page.slug === options.activePageSlug) ?? pages[0];
  const values = buildPublicSiteVariableValues(payload);
  let trackingElementsById: ReadonlyMap<string, ResolvedTrackingElement> = new Map();
  try {
    trackingElementsById = resolvePublicSiteTracking(payload).elementsById;
  } catch {
    // Tracking metadata must never make a published site unavailable.
  }
  const context: RenderContext = {
    logoDelivery: options.logoDelivery ?? "public",
    payload,
    trackingElementsById,
    values,
  };
  const renderDocument = createDocumentRenderer(context);
  const pagePanels = pages.map((page) => {
    const active = page.id === activePage?.id;
    return `<article class="handout-page-panel" data-handout-page-panel="${attr(page.slug)}" data-handout-page-id="${attr(page.id)}"${active ? "" : " hidden"}>${renderDocument({ content: page.document })}</article>`;
  }).join("");
  const sidebar = renderSidebar(payload.content, activePage?.slug ?? null, context);
  const canonicalUrl = origin
    ? new URL(buildPublicPath(payload), origin).toString()
    : buildPublicPath(payload);
  const ogImageUrl = payload.metadata.ogImageUrl
    ? resolveAbsoluteUrl(payload.metadata.ogImageUrl, origin)
    : resolveAbsoluteUrl("/handout-logo.svg", origin);
  const trackingScript = includeTracking && payload.trackingV2
    ? `<script async src="${TRACKING_V2_SCRIPT_ENDPOINT}" data-handout-tracking-v2="${attr(JSON.stringify(payload.trackingV2))}"></script>`
    : "";
  const consentPopup = renderTrackingConsent(payload, Boolean(trackingScript));
  const immediateTrackingScript = payload.content.settings.trackingConsentPopup === "none"
    ? trackingScript
    : "";
  const theme = resolveTheme(payload.content.themeMode);
  const primaryStyle = getPrimaryColorStyle(payload.content.settings.primaryColor);

  return `<!doctype html>
<html lang="en" class="${theme}" data-handout-public-site="">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${text(payload.metadata.title)}</title>
  <meta name="description" content="${attr(payload.metadata.description)}">
  <meta name="robots" content="${attr(payload.metadata.robots)}">
  <link rel="canonical" href="${attr(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${attr(payload.metadata.title)}">
  <meta property="og:description" content="${attr(payload.metadata.description)}">
  <meta property="og:url" content="${attr(canonicalUrl)}">
  <meta property="og:image" content="${attr(ogImageUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${attr(payload.metadata.title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(payload.metadata.title)}">
  <meta name="twitter:description" content="${attr(payload.metadata.description)}">
  <meta name="twitter:image" content="${attr(ogImageUrl)}">
  <meta name="twitter:image:alt" content="${attr(payload.metadata.title)}">
  <style>${HANDOUT_THEME_CSS}${SITE_DOCUMENT_CSS}</style>
</head>
<body data-handout-public-site="">
  <div class="handout-site" data-handout-site-id="${attr(payload.site.id)}" style="${attr(primaryStyle)}">
    ${sidebar}
    <main class="handout-main">
      <div class="handout-mobile-bar">
        ${sidebar ? `<button class="handout-mobile-menu" type="button" aria-label="Open site navigation" aria-controls="handout-site-sidebar" aria-expanded="false">${icon("menu")}</button>` : ""}
        <span data-handout-active-page-label="">${text(activePage?.name ?? payload.site.name)}</span>
      </div>
      <div class="handout-document">${pagePanels || renderEmptyPage()}</div>
      <footer class="handout-footer"><span>Powered by</span><span class="handout-footer-logo" role="img" aria-label="Handout"></span></footer>
    </main>
  </div>
  ${consentPopup}
  ${runtimeScript}
  ${immediateTrackingScript}
</body>
</html>`;
}

export function renderPublicSitePreviewHtml(
  content: SiteContent,
  input: {
    siteId: string;
    siteName: string;
    siteSlug: string;
    workspaceId: string;
    workspaceLogoUrl: string | null;
    workspaceName: string;
    workspaceSlug: string;
    workspaceWebsiteDomain: string | null;
    activePageSlug?: string | null;
    variableValues?: Record<string, string>;
  },
) {
  const metadata = getSiteMetadata(
    content,
    input.siteName,
    getSiteVariableValues(content, { variableValues: input.variableValues }),
  );
  const payload: PublishedSitePayload = {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: input.workspaceId,
      slug: input.workspaceSlug,
      name: input.workspaceName,
      websiteDomain: input.workspaceWebsiteDomain ?? "",
      logoUrl: input.workspaceLogoUrl,
    },
    site: {
      id: input.siteId,
      slug: input.siteSlug,
      name: input.siteName,
      publishedVersionId: "draft-preview",
      publishedAt: new Date(0).toISOString(),
    },
    metadata: {
      ...metadata,
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: input.variableValues
      ? {
          id: "draft-preview",
          slug: "draft-preview",
          name: "Draft preview",
          recipientName: null,
          recipientCompany: null,
          revisionNumber: 0,
          variableValues: input.variableValues,
        }
      : null,
    tracking: {
      version: 2,
      workspaceId: input.workspaceId,
      siteId: input.siteId,
      publishedVersionId: "draft-preview",
      recipientId: null,
      recipientRevision: null,
      trackingMode: "off",
    },
  };

  return renderPublicSiteHtml(payload, {
    activePageSlug: input.activePageSlug,
    includeTracking: false,
    logoDelivery: "preview",
    runtimeMode: "inline",
  });
}

function createDocumentRenderer(context: RenderContext) {
  const nodeMapping = bridgeNodeMapping(createNodeMapping(context));
  const markMapping = bridgeMarkMapping(createMarkMapping(context));

  return ({ content }: { content: TiptapNode }) => renderToHTMLString({
    content: SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON(content),
    extensions: SITE_DOCUMENT_EXTENSIONS,
    options: {
      nodeMapping,
      markMapping,
      unhandledNode: ({ children, node }) => {
        throw new Error(`Unsupported Tiptap node in published document: ${node.type.name || "unknown"} (${childrenText(children).length} rendered bytes)`);
      },
      unhandledMark: ({ mark }) => {
        throw new Error(`Unsupported Tiptap mark in published document: ${mark.type.name || "unknown"}`);
      },
    },
  });
}

function bridgeNodeMapping(mapping: ReturnType<typeof createNodeMapping>) {
  return Object.fromEntries(Object.entries(mapping).map(([type, render]) => [
    type,
    (props: NodeProps<ProseMirrorNode, string | string[]>) => render({
      ...props,
      node: props.node.toJSON() as TiptapNode,
    } as unknown as NodeRendererProps),
  ]));
}

function bridgeMarkMapping(mapping: ReturnType<typeof createMarkMapping>) {
  return Object.fromEntries(Object.entries(mapping).map(([type, render]) => [
    type,
    (props: MarkProps<ProseMirrorMark, string | string[], ProseMirrorNode>) => render({
      ...props,
      mark: props.mark.toJSON() as TiptapMark,
      node: props.node.toJSON() as TiptapNode,
    } as unknown as MarkRendererProps),
  ]));
}

function createNodeMapping(context: RenderContext): Record<string, (props: NodeRendererProps) => string> {
  const wrap = (tag: string, className: string, children: string | string[] | undefined, attrs = "") =>
    `<${tag} class="${className}"${attrs}>${childrenText(children)}</${tag}>`;

  return {
    doc: ({ children }) => `<div class="handout-prosemirror">${childrenText(children)}</div>`,
    text: ({ node }) => text(resolveTemplate(node.text ?? "", context.values)),
    paragraph: ({ children, node }) => childrenText(children)
      ? wrap("p", "handout-paragraph", children, nodeId(node))
      : "",
    heading: ({ children, node }) => {
      const level = node.attrs?.level === 1 || node.attrs?.level === 3 ? node.attrs.level : 2;
      return wrap(`h${level}`, `handout-heading handout-heading-${level}`, children, nodeId(node));
    },
    blockquote: ({ children, node }) => wrap("blockquote", "handout-blockquote", children, nodeId(node)),
    bulletList: ({ children, node }) => wrap("ul", "handout-list", children, nodeId(node)),
    orderedList: ({ children, node }) => wrap("ol", "handout-list", children, nodeId(node)),
    listItem: ({ children, node }) => wrap("li", "handout-list-item", children, nodeId(node)),
    taskList: ({ children, node }) => wrap("ul", "handout-task-list", children, nodeId(node)),
    taskItem: ({ children, node }) => {
      const checked = node.attrs?.checked === true;
      return `<li class="handout-task-item" data-checked="${checked}"><span class="handout-task-check" aria-hidden="true">${checked ? "&#10003;" : ""}</span><div>${childrenText(children)}</div></li>`;
    },
    hardBreak: () => "<br>",
    codeBlock: ({ children, node }) => `<pre class="handout-code-block"${nodeId(node)}><code>${childrenText(children)}</code></pre>`,
    horizontalRule: ({ node }) => `<hr class="handout-divider"${nodeId(node)}>` ,
    pageTitleSection: ({ children, node }) => renderPageTitle(node, children, context),
    pageTitleTitle: ({ children }) => wrap("h1", "handout-page-title-heading", children),
    pageTitleSubtitle: ({ children }) => wrap("p", "handout-page-title-subtitle", children),
    iconList: ({ children, node }) => wrap("ul", "handout-icon-list", children, nodeId(node)),
    iconListItem: ({ children, node }) => `<li class="handout-icon-list-item"${nodeId(node)}><span class="handout-icon-tile" data-icon-color="${normalizeSiteIconColor(node.attrs?.iconColor)}">${icon(stringAttr(node.attrs?.icon, "box"))}</span><div>${childrenText(children)}</div></li>`,
    image: ({ node }) => renderImage(node, "handout-image-block"),
    gifBlock: ({ node }) => renderImage(node, "handout-image-block handout-gif-block"),
    imageCard: ({ children, node }) => renderImageCard(node, children, context),
    imageCardTitle: ({ children }) => wrap("h3", "handout-card-title", children),
    imageCardBody: ({ children }) => wrap("p", "handout-card-body", children),
    iconCard: ({ children, node }) => `<article class="handout-icon-card"${nodeId(node)}><span class="handout-card-icon" data-icon-color="${normalizeSiteIconColor(node.attrs?.iconColor)}">${icon(stringAttr(node.attrs?.icon, "bolt"))}</span><div class="handout-card-copy">${childrenText(children)}</div></article>`,
    iconCardTitle: ({ children }) => wrap("h3", "handout-card-title", children),
    iconCardBody: ({ children }) => wrap("p", "handout-card-body", children),
    testimonialCard: ({ children, node }) => renderTestimonial(node, children),
    testimonialQuote: ({ children }) => wrap("blockquote", "handout-testimonial-quote", children),
    testimonialAuthorName: ({ children }) => wrap("p", "handout-testimonial-name", children),
    testimonialAuthorRole: ({ children }) => wrap("p", "handout-testimonial-role", children),
    logoGrid: ({ children, node }) => wrap("section", "handout-logo-grid", children, nodeId(node)),
    logoGridItem: ({ children, node }) => renderLogoGridItem(node, children),
    logoGridItemTitle: ({ children }) => wrap("p", "handout-logo-grid-title", children),
    buttonBlock: ({ children, node }) => renderButtonBlock(node, children, context),
    calendarEmbed: ({ node }) => renderEmbed(node, "calendar"),
    videoEmbed: ({ node }) => renderEmbed(node, "video"),
    gridBlock: ({ children, node }) => {
      const columns = numberAttr(node.attrs?.columns, 2, 1, 4);
      return `<section class="handout-grid" style="--handout-grid-columns:${columns}"${nodeId(node)}>${childrenText(children)}</section>`;
    },
    gridRow: ({ children }) => `<div class="handout-grid-row">${childrenText(children)}</div>`,
    gridCell: ({ children }) => `<div class="handout-grid-cell">${childrenText(children)}</div>`,
    table: ({ children, node }) => `<div class="handout-table-scroll"${nodeId(node)}><table class="handout-table"><tbody>${childrenText(children)}</tbody></table></div>`,
    tableRow: ({ children }) => `<tr>${childrenText(children)}</tr>`,
    tableHeader: ({ children, node }) => `<th${tableSpanAttrs(node)}>${childrenText(children)}</th>`,
    tableCell: ({ children, node }) => `<td${tableSpanAttrs(node)}>${childrenText(children)}</td>`,
    variableToken: ({ node }) => text(resolveVariableToken(node, context.values)),
    emoji: ({ node }) => text(stringAttr(node.attrs?.emoji, stringAttr(node.attrs?.name, ""))),
  };
}

function createMarkMapping(context: RenderContext): Record<string, (props: MarkRendererProps) => string> {
  return {
    bold: ({ children }) => `<strong>${childrenText(children)}</strong>`,
    italic: ({ children }) => `<em>${childrenText(children)}</em>`,
    underline: ({ children }) => `<u>${childrenText(children)}</u>`,
    strike: ({ children }) => `<s>${childrenText(children)}</s>`,
    code: ({ children }) => `<code class="handout-inline-code">${childrenText(children)}</code>`,
    link: ({ children, mark }) => {
      const href = sanitizeLinkUrl(resolveTemplate(stringAttr(mark.attrs?.href), context.values));
      if (!href) return childrenText(children);
      return `<a class="handout-link" href="${attr(href)}" target="_blank" rel="noopener noreferrer">${childrenText(children)}</a>`;
    },
    textStyle: ({ children, mark }) => {
      const color = sanitizeCssColor(normalizeEditorTextColor(mark.attrs?.color));
      return color ? `<span style="color:${attr(color)}">${childrenText(children)}</span>` : childrenText(children);
    },
    highlight: ({ children, mark }) => {
      const color = sanitizeCssColor(normalizeEditorHighlightColor(mark.attrs?.color));
      return `<mark${color ? ` style="background-color:${attr(color)}"` : ""}>${childrenText(children)}</mark>`;
    },
  };
}

function renderPageTitle(node: TiptapNode, children: string | string[] | undefined, context: RenderContext) {
  const align = node.attrs?.align === "left" || node.attrs?.align === "right" ? "left" : "center";
  const theme = context.payload.content.themeMode === "dark" ? "dark" : "light";
  const workspaceDomain = normalizeLogoDomain(context.payload.workspace.websiteDomain);
  const recipientDomain = normalizeLogoDomain(context.values.recipient_website);
  const primaryLogo = context.payload.workspace.logoUrl || (workspaceDomain
    ? buildLogoImagePath(context, "workspace", workspaceDomain, theme)
    : null);
  const secondaryLogo = recipientDomain
    ? buildLogoImagePath(context, "recipient", recipientDomain, theme)
    : null;
  const logos = [
    primaryLogo ? renderLogo(primaryLogo, `${context.payload.workspace.name} logo`, "workspace") : "",
    secondaryLogo ? renderLogo(secondaryLogo, `${recipientDomain} logo`, "recipient") : "",
  ].filter(Boolean);

  return `<section class="handout-page-title" data-align="${align}"${nodeId(node)}>${logos.length ? `<div class="handout-page-title-logos">${logos.join(logos.length > 1 ? '<span class="handout-logo-connector"></span>' : "")}</div>` : ""}<div class="handout-page-title-copy">${childrenText(children)}</div></section>`;
}

function renderLogo(src: string, altText: string, kind: "recipient" | "workspace") {
  const safeSrc = sanitizeImageUrl(src);
  return safeSrc ? `<span class="handout-page-title-logo" data-handout-logo-kind="${kind}"><img src="${attr(safeSrc)}" alt="${attr(altText)}"></span>` : "";
}

function buildLogoImagePath(
  context: RenderContext,
  kind: "recipient" | "workspace",
  domain: string,
  theme: "dark" | "light",
) {
  if (context.logoDelivery === "preview") {
    const query = new URLSearchParams({ domain, size: "128", theme });
    return `/api/workspaces/logo-preview/image?${query.toString()}`;
  }

  const query = new URLSearchParams({ theme });
  if (context.payload.selectedVariant) {
    query.set("variant", context.payload.selectedVariant.slug);
  }

  return `${PUBLIC_SITE_LOGO_ENDPOINT}/${encodeURIComponent(context.payload.workspace.slug)}/${encodeURIComponent(context.payload.site.slug)}/${kind}?${query.toString()}`;
}

function normalizeLogoDomain(value: string | null | undefined) {
  const result = normalizeWebsiteDomain(value?.trim() ?? "");
  return result.ok ? result.domain : null;
}

function renderImage(node: TiptapNode, className: string) {
  const src = sanitizeImageUrl(stringAttr(node.attrs?.src));
  if (!src) return "";
  const altText = stringAttr(node.attrs?.alt);
  const width = positiveNumberAttr(node.attrs?.width ?? node.attrs?.imageWidth);
  const height = positiveNumberAttr(node.attrs?.height ?? node.attrs?.imageHeight);
  const sizeStyle = width ? ` style="max-width:${width}px"` : "";
  const dimensions = `${width ? ` width="${width}"` : ""}${height ? ` height="${height}"` : ""}`;
  return `<figure class="${className}"${sizeStyle}${nodeId(node)}><img src="${attr(src)}" alt="${attr(altText)}"${dimensions} loading="lazy" decoding="async"></figure>`;
}

function renderImageCard(node: TiptapNode, children: string | string[] | undefined, context: RenderContext) {
  const src = sanitizeImageUrl(resolveSiteTemplate(stringAttr(node.attrs?.src), context.values));
  const includeButton = node.attrs?.includeButton === true;
  const href = sanitizePublicActionUrl(resolveSiteTemplate(stringAttr(node.attrs?.buttonUrl), context.values));
  const label = resolveSiteTemplate(stringAttr(node.attrs?.buttonLabel, "Learn more"), context.values).trim();
  const tracking = trackingElement(context, node.attrs?.id, ":button");
  const cta = includeButton && href && label
    ? `<a class="handout-small-button handout-small-button-outline" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs(tracking)}>${text(label)}</a>`
    : "";
  const media = src ? `<div class="handout-image-card-media"><img src="${attr(src)}" alt="${attr(stringAttr(node.attrs?.alt))}" loading="lazy" decoding="async"></div>` : "";

  return `<article class="handout-image-card"${nodeId(node)}>${media}<div class="handout-image-card-copy"><div>${childrenText(children)}</div>${cta}</div></article>`;
}

function renderTestimonial(node: TiptapNode, children: string | string[] | undefined) {
  const src = sanitizeImageUrl(stringAttr(node.attrs?.src));
  const avatar = src
    ? `<img src="${attr(src)}" alt="" loading="lazy" decoding="async">`
    : icon("quote");
  return `<article class="handout-testimonial"${nodeId(node)}><span class="handout-testimonial-avatar">${avatar}</span><div>${childrenText(children)}</div></article>`;
}

function renderLogoGridItem(node: TiptapNode, children: string | string[] | undefined) {
  const src = sanitizeImageUrl(stringAttr(node.attrs?.src));
  const logo = src ? `<img src="${attr(src)}" alt="${attr(stringAttr(node.attrs?.alt))}" loading="lazy" decoding="async">` : icon("photo");
  return `<article class="handout-logo-grid-item"${nodeId(node)}><span class="handout-logo-grid-image">${logo}</span>${childrenText(children)}</article>`;
}

function renderButtonBlock(node: TiptapNode, children: string | string[] | undefined, context: RenderContext) {
  const href = sanitizePublicActionUrl(resolveSiteTemplate(stringAttr(node.attrs?.href), context.values));
  const label = getResolvedNodeText(node, context.values).trim();
  if (!href || !label) return "";
  const fullWidth = node.attrs?.fullWidth === true;
  const tracking = trackingElement(context, node.attrs?.id);
  return `<a class="handout-button-block${fullWidth ? " handout-button-block-full" : ""}" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${nodeId(node)}${trackingAttrs(tracking)}>${childrenText(children)}</a>`;
}

function renderEmbed(node: TiptapNode, kind: "calendar" | "video") {
  const src = sanitizeEmbedUrl(stringAttr(node.attrs?.src));
  if (!src) return "";
  const height = numberAttr(node.attrs?.height, kind === "calendar" ? 680 : 360, 240, 1200);
  return `<div class="handout-embed" style="height:${height}px"${nodeId(node)}><iframe src="${attr(src)}" title="${kind === "calendar" ? "Calendar" : "Video"}" loading="lazy" allow="${kind === "video" ? "accelerometer; autoplay; encrypted-media; picture-in-picture" : "clipboard-write"}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"></iframe></div>`;
}

// PUBLISHED-SITE PARITY: This is the sidebar for both Preview and deployed sites.
// Keep visual changes synchronized with EditorSiteSidebar's edit shell.
function renderSidebar(content: SiteContent, activePageSlug: string | null, context: RenderContext) {
  const model = getSiteSidebarModel(content);
  const { pages, links, nextSteps: buttons } = model;
  const tabItems = pages;
  const activePageName = pages.find((page) => page.slug === activePageSlug)?.name ?? pages[0]?.name ?? "Page";

  if (!model.showSidebar) return "";

  const tabsHtml = tabItems.map((page) => `<button type="button" class="handout-sidebar-row handout-tab${page.slug === activePageSlug ? " is-active" : ""}" data-handout-page-target="${attr(page.slug)}" data-handout-page-id="${attr(page.id)}" data-handout-track="tab">${icon("notes")}<span>${text(page.name)}</span></button>`).join("");
  const linksHtml = links.map((link) => {
    const href = sanitizePublicActionUrl(resolveSiteTemplate(link.href, context.values));
    const label = resolveSiteTemplate(link.label, context.values).trim();
    return href && label ? `<a class="handout-sidebar-row handout-sidebar-link" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs(trackingElement(context, link.id))}>${icon("link")}<span>${text(label)}</span></a>` : "";
  }).join("");
  const buttonsHtml = buttons.map((button) => {
    const href = sanitizePublicActionUrl(resolveSiteTemplate(button.href, context.values));
    const label = resolveSiteTemplate(button.label, context.values).trim();
    const buttonIcon = button.icon ? icon(button.icon) : "";
    return href && label ? `<a class="handout-sidebar-button handout-sidebar-button-${button.style}" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs(trackingElement(context, button.id))}>${buttonIcon}${text(label)}</a>` : "";
  }).join("");

  return `<aside id="handout-site-sidebar" class="handout-sidebar" aria-label="Site navigation"><div class="handout-sidebar-mobile-header"><span class="handout-sidebar-mobile-title" data-handout-active-page-label="">${text(activePageName)}</span><button class="handout-sidebar-close" type="button" aria-label="Close site navigation">${icon("x")}</button></div><div class="handout-sidebar-inner">${renderSidebarSection(content.sidebar.sections.tabs.label, tabsHtml)}${renderSidebarSection(content.sidebar.sections.links.label, linksHtml)}${renderSidebarSection(content.sidebar.sections.nextSteps.label, buttonsHtml, "handout-sidebar-section-buttons")}</div></aside><div class="handout-sidebar-backdrop" aria-hidden="true"></div>`;
}

function renderSidebarSection(label: string, content: string, className = "") {
  return content ? `<section class="handout-sidebar-section${className ? ` ${className}` : ""}"><h2>${text(label)}</h2><div>${content}</div></section>` : "";
}

function renderEmptyPage() {
  return `<div class="handout-empty-page"><h1>This page is empty</h1></div>`;
}

export function getPrimaryColorStyle(color: SiteContent["settings"]["primaryColor"]) {
  if (color === "neutral") {
    return "--handout-primary:var(--foreground);--handout-primary-foreground:var(--background);--handout-primary-soft:var(--accent);--handout-sidebar-link-icon:var(--blue-foreground)";
  }

  return `--handout-primary:var(--${color}-foreground);--handout-primary-foreground:var(--background);--handout-primary-soft:var(--${color}-background-subtle);--handout-sidebar-link-icon:var(--${color}-foreground)`;
}

function renderTrackingConsent(payload: PublishedSitePayload, hasTracking: boolean) {
  const popup = payload.content.settings.trackingConsentPopup;
  const privacyPolicyUrl = sanitizeTrackingPrivacyPolicyUrl(payload.content.settings.trackingPrivacyPolicyUrl);
  if (!hasTracking || !payload.trackingV2 || popup === "none" || !privacyPolicyUrl) return "";

  const isPopupA = popup === "popup-a";
  const body = isPopupA
    ? `This site uses cookies and other technology upon consent to help the owner understand how you use it, including session behavior and where you click and scroll. By selecting Allow and proceed, you consent to this as described in the <a href="${attr(privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. You may decline and enter <button type="button" data-handout-consent="deny">here</button>.`
    : `This site uses cookies and other technology upon consent to help the owner understand how you use it, including session behavior and where you click and scroll. By selecting Allow and proceed, you consent to this as described in the <a href="${attr(privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.`;
  const actions = isPopupA
    ? `<button class="handout-consent-button handout-consent-button-primary" type="button" data-handout-consent="allow">Allow and proceed</button>`
    : `<button class="handout-consent-button" type="button" data-handout-consent="deny">Deny and proceed</button><button class="handout-consent-button handout-consent-button-primary" type="button" data-handout-consent="allow">Allow and proceed</button>`;
  const bootstrap = JSON.stringify(payload.trackingV2);

  return `<aside class="handout-consent-popup" role="dialog" aria-modal="true" data-handout-consent-popup="${attr(popup)}" data-handout-consent-site-id="${attr(payload.site.id)}" data-handout-consent-notice-version="${TRACKING_V2_VISITOR_NOTICE_VERSION}" data-handout-consent-script-src="${TRACKING_V2_SCRIPT_ENDPOINT}" data-handout-consent-bootstrap="${attr(bootstrap)}" aria-labelledby="handout-consent-title"><div class="handout-consent-dialog"><div class="handout-consent-copy"><h2 id="handout-consent-title">We value your privacy</h2><p>${body}</p></div><div class="handout-consent-actions">${actions}</div></div></aside><button class="handout-privacy-choices" type="button" data-handout-privacy-choices hidden>Privacy choices</button>`;
}

function resolveVariableToken(node: TiptapNode, values: Record<string, string>) {
  const id = stringAttr(node.attrs?.variableId);
  return values[id] ?? stringAttr(node.attrs?.fallbackName, id);
}

function resolveTemplate(value: string, values: Record<string, string>) {
  return resolveSiteTemplate(value, values);
}

function trackingAttrs(element: ResolvedTrackingElement | null) {
  if (!element) return "";
  const track = element.eventType === "link_click" ? "link" : "button";
  return ` data-handout-track="${track}" data-handout-element-id="${attr(element.id)}"`;
}

function trackingElement(context: RenderContext, value: unknown, suffix = "") {
  if (typeof value !== "string") return null;
  return context.trackingElementsById.get(`${value.trim()}${suffix}`) ?? null;
}

function sanitizeLinkUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || /^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeCssColor(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && /^[#a-zA-Z0-9.,%()\s-]+$/.test(trimmed) ? trimmed : null;
}

function tableSpanAttrs(node: TiptapNode) {
  const colspan = numberAttr(node.attrs?.colspan, 1, 1, 20);
  const rowspan = numberAttr(node.attrs?.rowspan, 1, 1, 100);
  return `${colspan > 1 ? ` colspan="${colspan}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}`;
}

function nodeId(node: TiptapNode) {
  const id = stringAttr(node.attrs?.id);
  return id ? ` data-handout-node-id="${attr(id)}"` : "";
}

export function buildPublicPath(payload: PublishedSitePayload) {
  const segments = [payload.workspace.slug, payload.site.slug, payload.selectedVariant?.slug]
    .filter((value): value is string => Boolean(value));
  return `/${segments.map(encodeURIComponent).join("/")}`;
}

export function buildPublicScreenshotPath(payload: PublishedSitePayload) {
  const revision = payload.selectedVariant?.revisionNumber ?? 0;
  const version = `${payload.site.publishedVersionId}.${revision}`;
  return `${buildPublicPath(payload)}/embed.jpg?v=${encodeURIComponent(version)}`;
}

function resolveAbsoluteUrl(value: string, origin: string | null) {
  if (!origin) return value;
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveTheme(mode: SiteContent["themeMode"]) {
  if (mode === "light") return "light";
  return mode === "system" ? "system" : "dark";
}

function childrenText(children: string | string[] | undefined) {
  return serializeChildrenToHTMLString(children);
}

function stringAttr(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function positiveNumberAttr(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function numberAttr(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function text(value: string) {
  return escapeHTML(value);
}

function attr(value: string) {
  return escapeHTMLAttribute(value);
}

function icon(name: string) {
  return renderSiteIconSvg(name);
}

export const PUBLIC_SITE_RUNTIME = `(function(){
var root=document.querySelector('.handout-site');if(!root)return;
var sidebar=root.querySelector('.handout-sidebar');
var menu=root.querySelector('.handout-mobile-menu');
var closeButton=root.querySelector('.handout-sidebar-close');
var backdrop=root.querySelector('.handout-sidebar-backdrop');
function setSidebarOpen(open,restoreFocus){
  if(!sidebar)return;
  sidebar.classList.toggle('is-open',open);
  if(backdrop)backdrop.classList.toggle('is-open',open);
  if(menu)menu.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('handout-drawer-open',open);
  if(open&&closeButton)requestAnimationFrame(function(){closeButton.focus();});
  if(!open&&restoreFocus&&menu)menu.focus();
}
function removeLogoTile(tile){var group=tile&&tile.parentElement;if(tile)tile.remove();if(group&&!group.querySelector('.handout-page-title-logo'))group.remove();}
function handleLogoError(image){
  var tile=image.closest('.handout-page-title-logo');if(!tile)return;
  if(tile.getAttribute('data-handout-logo-kind')==='workspace'&&!image.hasAttribute('data-handout-logo-fallback')){
    image.setAttribute('data-handout-logo-fallback','');image.alt='Handout';image.src='/handout-logo.svg';return;
  }
  removeLogoTile(tile);
}
root.querySelectorAll('.handout-page-title-logo img').forEach(function(image){
  image.addEventListener('error',function(){handleLogoError(image);});
  if(image.complete&&image.naturalWidth===0)handleLogoError(image);
});
function selectPage(slug){
  root.querySelectorAll('[data-handout-page-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-handout-page-panel')!==slug;});
  root.querySelectorAll('[data-handout-page-target]').forEach(function(tab){tab.classList.toggle('is-active',tab.getAttribute('data-handout-page-target')===slug);});
  var active=Array.prototype.find.call(root.querySelectorAll('[data-handout-page-target]'),function(tab){return tab.getAttribute('data-handout-page-target')===slug;});
  active=active?active.querySelector('span'):null;
  if(active)root.querySelectorAll('[data-handout-active-page-label]').forEach(function(label){label.textContent=active.textContent||'';});
  setSidebarOpen(false,true);
}
root.addEventListener('click',function(event){
  var target=event.target instanceof Element?event.target.closest('[data-handout-page-target],.handout-mobile-menu,.handout-sidebar-close,.handout-sidebar-backdrop'):null;if(!target)return;
  if(target.matches('[data-handout-page-target]')){event.preventDefault();selectPage(target.getAttribute('data-handout-page-target')||'');return;}
  if(target.matches('.handout-mobile-menu')){setSidebarOpen(!sidebar.classList.contains('is-open'),false);return;}
  setSidebarOpen(false,true);
});
document.addEventListener('keydown',function(event){
  if(!sidebar||!sidebar.classList.contains('is-open'))return;
  if(event.key==='Escape'){event.preventDefault();setSidebarOpen(false,true);return;}
  if(event.key!=='Tab')return;
  var focusable=sidebar.querySelectorAll('button:not([disabled]),a[href]');if(!focusable.length)return;
  var first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
var mobileQuery=window.matchMedia('(max-width:760px)');
function handleMobileChange(event){if(!event.matches)setSidebarOpen(false,false);}
if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',handleMobileChange);
else if(typeof mobileQuery.addListener==='function')mobileQuery.addListener(handleMobileChange);
var consentPopup=document.querySelector('[data-handout-consent-popup]');
var privacyChoices=document.querySelector('[data-handout-privacy-choices]');
if(consentPopup&&privacyChoices){
  var consentSiteId=consentPopup.getAttribute('data-handout-consent-site-id')||'';
  var consentNoticeVersion=Number(consentPopup.getAttribute('data-handout-consent-notice-version'));
  var consentScriptSrc=consentPopup.getAttribute('data-handout-consent-script-src')||'';
  var consentBootstrap=consentPopup.getAttribute('data-handout-consent-bootstrap')||'';
  var consentStorageKey='handout:tracking-consent:'+consentSiteId;
  var consentMaxAge=15552000000;
  var storedConsent=null;
  try{storedConsent=JSON.parse(localStorage.getItem(consentStorageKey)||'null');}catch(error){}
  function validStoredConsent(value){
    var age=value&&typeof value.decidedAt==='string'?Date.now()-Date.parse(value.decidedAt):NaN;
    return value&&value.noticeVersion===consentNoticeVersion&&(value.choice==='allow'||value.choice==='deny')&&Number.isFinite(age)&&age>=0&&age<=consentMaxAge;
  }
  function storeConsent(value){try{localStorage.setItem(consentStorageKey,JSON.stringify(value));}catch(error){}}
  function startTracking(consent){
    if(!consentScriptSrc||!consentBootstrap||document.querySelector('[data-handout-tracking-v2]'))return;
    var script=document.createElement('script');
    script.async=true;
    script.src=consentScriptSrc;
    script.setAttribute('data-handout-tracking-v2',consentBootstrap);
    script.setAttribute('data-handout-replay-consent',JSON.stringify(consent));
    document.body.appendChild(script);
  }
  function showPrivacyChoices(){privacyChoices.hidden=false;}
  function finishConsent(choice){
    var decidedAt=new Date().toISOString();
    storeConsent({choice:choice,noticeVersion:consentNoticeVersion,decidedAt:decidedAt});
    consentPopup.hidden=true;
    showPrivacyChoices();
    if(choice==='allow'){
      startTracking({noticeVersion:consentNoticeVersion,grantedAt:decidedAt,source:'prompt'});
      return;
    }
    window.dispatchEvent(new Event('handout:tracking-consent-withdrawn'));
    var trackingScript=document.querySelector('[data-handout-tracking-v2]');
    if(trackingScript)trackingScript.remove();
  }
  privacyChoices.addEventListener('click',function(){privacyChoices.hidden=true;consentPopup.hidden=false;});
  consentPopup.addEventListener('click',function(event){
    var target=event.target instanceof Element?event.target.closest('[data-handout-consent]'):null;
    if(target)finishConsent(target.getAttribute('data-handout-consent')==='allow'?'allow':'deny');
  });
  if(validStoredConsent(storedConsent)){
    consentPopup.hidden=true;
    showPrivacyChoices();
    if(storedConsent.choice==='allow')startTracking({noticeVersion:consentNoticeVersion,grantedAt:storedConsent.decidedAt,source:'remembered'});
  }
}
})();`;

export { SITE_DOCUMENT_CSS as PUBLIC_SITE_CSS } from "./styles";
export { HANDOUT_THEME_CSS } from "@handout/design-tokens";
