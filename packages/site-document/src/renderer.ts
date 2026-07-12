import {
  TRACKING_V2_SCRIPT_ENDPOINT,
} from "@lightsite/tracking-schema";
import {
  LIGHTSITE_THEME_CSS,
  normalizeEditorHighlightColor,
  normalizeEditorTextColor,
} from "@lightsite/design-tokens";
import { normalizeWebsiteDomain } from "@lightsite/domain";
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
  getNodeText,
  getSiteSidebarModel,
  getVisibleSitePages,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
  type SiteContent,
  type TiptapMark,
  type TiptapNode,
} from "./model";
import { SITE_DOCUMENT_CSS } from "./styles";

export type RenderPublicSiteOptions = {
  activePageSlug?: string | null;
  includeRuntime?: boolean;
  includeTracking?: boolean;
  logoDelivery?: "preview" | "public";
  origin?: string;
  runtimeMode?: "external" | "inline";
};

export const PUBLIC_SITE_LOGO_ENDPOINT = "/api/public/site-logo" as const;
export const PUBLIC_SITE_RUNTIME_PATH = "/site-runtime.v3.js" as const;

type RenderContext = {
  logoDelivery: "preview" | "public";
  payload: PublishedSitePayload;
  values: Record<string, string>;
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
  const values = buildVariableValues(payload);
  const context: RenderContext = {
    logoDelivery: options.logoDelivery ?? "public",
    payload,
    values,
  };
  const renderDocument = createDocumentRenderer(context);
  const pagePanels = pages.map((page) => {
    const active = page.id === activePage?.id;
    return `<article class="ls-page-panel" data-ls-page-panel="${attr(page.slug)}"${active ? "" : " hidden"}>${renderDocument({ content: page.document })}</article>`;
  }).join("");
  const sidebar = renderSidebar(payload.content, activePage?.slug ?? null, values);
  const canonicalUrl = origin
    ? new URL(buildPublicPath(payload), origin).toString()
    : buildPublicPath(payload);
  const ogImageUrl = payload.metadata.ogImageUrl
    ? resolveAbsoluteUrl(payload.metadata.ogImageUrl, origin)
    : resolveAbsoluteUrl("/lightsite-logo.svg", origin);
  const trackingScript = includeTracking && payload.trackingV2
    ? `<script async src="${TRACKING_V2_SCRIPT_ENDPOINT}" data-lightsite-tracking-v2="${attr(JSON.stringify(payload.trackingV2))}"></script>`
    : "";
  const theme = resolveTheme(payload.content.themeMode);

  return `<!doctype html>
<html lang="en" class="${theme}" data-ls-public-site="">
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
  <style>${LIGHTSITE_THEME_CSS}${SITE_DOCUMENT_CSS}</style>
</head>
<body data-ls-public-site="">
  <div class="ls-site" data-ls-site-id="${attr(payload.site.id)}">
    ${sidebar}
    <main class="ls-main">
      <div class="ls-mobile-bar">
        ${sidebar ? `<button class="ls-mobile-menu" type="button" aria-label="Open site navigation" aria-controls="ls-site-sidebar" aria-expanded="false">${icon("menu")}</button>` : ""}
        <span data-ls-active-page-label="">${text(activePage?.name ?? payload.site.name)}</span>
      </div>
      <div class="ls-document">${pagePanels || renderEmptyPage()}</div>
      <footer class="ls-footer"><span>Powered by</span><span class="ls-footer-logo" role="img" aria-label="Lightsite"></span></footer>
    </main>
  </div>
  ${runtimeScript}
  ${trackingScript}
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
  const metadata = getMetadataFromContent(content, input.siteName);
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
    doc: ({ children }) => `<div class="ls-prosemirror">${childrenText(children)}</div>`,
    text: ({ node }) => text(resolveTemplate(node.text ?? "", context.values)),
    paragraph: ({ children, node }) => childrenText(children)
      ? wrap("p", "ls-paragraph", children, nodeId(node))
      : "",
    heading: ({ children, node }) => {
      const level = node.attrs?.level === 1 || node.attrs?.level === 3 ? node.attrs.level : 2;
      return wrap(`h${level}`, `ls-heading ls-heading-${level}`, children, nodeId(node));
    },
    blockquote: ({ children, node }) => wrap("blockquote", "ls-blockquote", children, nodeId(node)),
    bulletList: ({ children, node }) => wrap("ul", "ls-list", children, nodeId(node)),
    orderedList: ({ children, node }) => wrap("ol", "ls-list", children, nodeId(node)),
    listItem: ({ children, node }) => wrap("li", "ls-list-item", children, nodeId(node)),
    taskList: ({ children, node }) => wrap("ul", "ls-task-list", children, nodeId(node)),
    taskItem: ({ children, node }) => {
      const checked = node.attrs?.checked === true;
      return `<li class="ls-task-item" data-checked="${checked}"><span class="ls-task-check" aria-hidden="true">${checked ? "&#10003;" : ""}</span><div>${childrenText(children)}</div></li>`;
    },
    hardBreak: () => "<br>",
    codeBlock: ({ children, node }) => `<pre class="ls-code-block"${nodeId(node)}><code>${childrenText(children)}</code></pre>`,
    horizontalRule: ({ node }) => `<hr class="ls-divider"${nodeId(node)}>` ,
    pageTitleSection: ({ children, node }) => renderPageTitle(node, children, context),
    pageTitleTitle: ({ children }) => wrap("h1", "ls-page-title-heading", children),
    pageTitleSubtitle: ({ children }) => wrap("p", "ls-page-title-subtitle", children),
    iconList: ({ children, node }) => wrap("ul", "ls-icon-list", children, nodeId(node)),
    iconListItem: ({ children, node }) => `<li class="ls-icon-list-item"${nodeId(node)}><span class="ls-icon-tile" data-icon-color="${normalizeSiteIconColor(node.attrs?.iconColor)}">${icon(stringAttr(node.attrs?.icon, "box"))}</span><div>${childrenText(children)}</div></li>`,
    image: ({ node }) => renderImage(node, "ls-image-block"),
    gifBlock: ({ node }) => renderImage(node, "ls-image-block ls-gif-block"),
    imageCard: ({ children, node }) => renderImageCard(node, children, context),
    imageCardTitle: ({ children }) => wrap("h3", "ls-card-title", children),
    imageCardBody: ({ children }) => wrap("p", "ls-card-body", children),
    iconCard: ({ children, node }) => `<article class="ls-icon-card"${nodeId(node)}><span class="ls-card-icon" data-icon-color="${normalizeSiteIconColor(node.attrs?.iconColor)}">${icon(stringAttr(node.attrs?.icon, "bolt"))}</span><div class="ls-card-copy">${childrenText(children)}</div></article>`,
    iconCardTitle: ({ children }) => wrap("h3", "ls-card-title", children),
    iconCardBody: ({ children }) => wrap("p", "ls-card-body", children),
    testimonialCard: ({ children, node }) => renderTestimonial(node, children),
    testimonialQuote: ({ children }) => wrap("blockquote", "ls-testimonial-quote", children),
    testimonialAuthorName: ({ children }) => wrap("p", "ls-testimonial-name", children),
    testimonialAuthorRole: ({ children }) => wrap("p", "ls-testimonial-role", children),
    logoGrid: ({ children, node }) => wrap("section", "ls-logo-grid", children, nodeId(node)),
    logoGridItem: ({ children, node }) => renderLogoGridItem(node, children),
    logoGridItemTitle: ({ children }) => wrap("p", "ls-logo-grid-title", children),
    buttonBlock: ({ children, node }) => renderButtonBlock(node, children, context),
    calendarEmbed: ({ node }) => renderEmbed(node, "calendar"),
    videoEmbed: ({ node }) => renderEmbed(node, "video"),
    gridBlock: ({ children, node }) => {
      const columns = numberAttr(node.attrs?.columns, 2, 1, 4);
      return `<section class="ls-grid" style="--lightsite-grid-columns:${columns}"${nodeId(node)}>${childrenText(children)}</section>`;
    },
    gridRow: ({ children }) => `<div class="ls-grid-row">${childrenText(children)}</div>`,
    gridCell: ({ children }) => `<div class="ls-grid-cell">${childrenText(children)}</div>`,
    table: ({ children, node }) => `<div class="ls-table-scroll"${nodeId(node)}><table class="ls-table"><tbody>${childrenText(children)}</tbody></table></div>`,
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
    code: ({ children }) => `<code class="ls-inline-code">${childrenText(children)}</code>`,
    link: ({ children, mark, node }) => {
      const href = sanitizeLinkUrl(resolveTemplate(stringAttr(mark.attrs?.href), context.values));
      if (!href) return childrenText(children);
      const label = getNodeText(node).trim() || "Link";
      return `<a class="ls-link" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs({ id: stringAttr(node.attrs?.id, stableElementId("link", label)), kind: "link", label, href, track: "link" })}>${childrenText(children)}</a>`;
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

  return `<section class="ls-page-title" data-align="${align}"${nodeId(node)}>${logos.length ? `<div class="ls-page-title-logos">${logos.join(logos.length > 1 ? '<span class="ls-logo-connector"></span>' : "")}</div>` : ""}<div class="ls-page-title-copy">${childrenText(children)}</div></section>`;
}

function renderLogo(src: string, altText: string, kind: "recipient" | "workspace") {
  const safeSrc = sanitizeImageUrl(src);
  return safeSrc ? `<span class="ls-page-title-logo" data-ls-logo-kind="${kind}"><img src="${attr(safeSrc)}" alt="${attr(altText)}"></span>` : "";
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
  const dimensions = `${width ? ` width="${width}"` : ""}${height ? ` height="${height}"` : ""}`;
  return `<figure class="${className}"${nodeId(node)}><img src="${attr(src)}" alt="${attr(altText)}"${dimensions} loading="lazy" decoding="async"></figure>`;
}

function renderImageCard(node: TiptapNode, children: string | string[] | undefined, context: RenderContext) {
  const src = sanitizeImageUrl(resolveTemplate(stringAttr(node.attrs?.src), context.values));
  const includeButton = node.attrs?.includeButton === true;
  const href = sanitizeLinkUrl(resolveTemplate(stringAttr(node.attrs?.buttonUrl), context.values));
  const label = resolveTemplate(stringAttr(node.attrs?.buttonLabel, "Learn more"), context.values).trim();
  const id = stringAttr(node.attrs?.id, stableElementId("image-card", label));
  const cta = includeButton && href && label
    ? `<a class="ls-small-button ls-small-button-outline" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs({ id: `${id}-button`, kind: "image_card", label, href, track: "button" })}>${text(label)}</a>`
    : "";
  const media = src ? `<div class="ls-image-card-media"><img src="${attr(src)}" alt="${attr(stringAttr(node.attrs?.alt))}" loading="lazy" decoding="async"></div>` : "";

  return `<article class="ls-image-card"${nodeId(node)}>${media}<div class="ls-image-card-copy"><div>${childrenText(children)}</div>${cta}</div></article>`;
}

function renderTestimonial(node: TiptapNode, children: string | string[] | undefined) {
  const src = sanitizeImageUrl(stringAttr(node.attrs?.src));
  const avatar = src
    ? `<img src="${attr(src)}" alt="" loading="lazy" decoding="async">`
    : icon("quote");
  return `<article class="ls-testimonial"${nodeId(node)}><span class="ls-testimonial-avatar">${avatar}</span><div>${childrenText(children)}</div></article>`;
}

function renderLogoGridItem(node: TiptapNode, children: string | string[] | undefined) {
  const src = sanitizeImageUrl(stringAttr(node.attrs?.src));
  const logo = src ? `<img src="${attr(src)}" alt="${attr(stringAttr(node.attrs?.alt))}" loading="lazy" decoding="async">` : icon("photo");
  return `<article class="ls-logo-grid-item"${nodeId(node)}><span class="ls-logo-grid-image">${logo}</span>${childrenText(children)}</article>`;
}

function renderButtonBlock(node: TiptapNode, children: string | string[] | undefined, context: RenderContext) {
  const href = sanitizeLinkUrl(resolveTemplate(stringAttr(node.attrs?.href), context.values));
  const label = getNodeText(node).trim();
  if (!href || !label) return "";
  const fullWidth = node.attrs?.fullWidth === true;
  const id = stringAttr(node.attrs?.id, stableElementId("button", label));
  return `<a class="ls-button-block${fullWidth ? " ls-button-block-full" : ""}" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${nodeId(node)}${trackingAttrs({ id, kind: "button", label, href, track: "button" })}>${childrenText(children)}</a>`;
}

function renderEmbed(node: TiptapNode, kind: "calendar" | "video") {
  const src = sanitizeEmbedUrl(stringAttr(node.attrs?.src));
  if (!src) return "";
  const height = numberAttr(node.attrs?.height, kind === "calendar" ? 680 : 360, 240, 1200);
  const id = stringAttr(node.attrs?.id, stableElementId(kind, src));
  return `<div class="ls-embed" style="height:${height}px"${nodeId(node)} data-ls-element-id="${attr(id)}" data-ls-element-kind="${kind}"><iframe src="${attr(src)}" title="${kind === "calendar" ? "Calendar" : "Video"}" loading="lazy" allow="${kind === "video" ? "accelerometer; autoplay; encrypted-media; picture-in-picture" : "clipboard-write"}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"></iframe></div>`;
}

// PUBLISHED-SITE PARITY: This is the sidebar for both Preview and deployed sites.
// Keep visual changes synchronized with EditorSiteSidebar's edit shell.
function renderSidebar(content: SiteContent, activePageSlug: string | null, values: Record<string, string>) {
  const model = getSiteSidebarModel(content);
  const { pages, links, nextSteps: buttons } = model;
  const tabItems = pages;
  const activePageName = pages.find((page) => page.slug === activePageSlug)?.name ?? pages[0]?.name ?? "Page";

  if (!model.showSidebar) return "";

  const tabsHtml = tabItems.map((page) => `<button type="button" class="ls-sidebar-row ls-tab${page.slug === activePageSlug ? " is-active" : ""}" data-ls-page-target="${attr(page.slug)}"${trackingAttrs({ id: page.id, kind: "tab", label: page.name, track: "tab" })}>${icon("notes")}<span>${text(page.name)}</span></button>`).join("");
  const linksHtml = links.map((link) => {
    const href = sanitizeLinkUrl(resolveTemplate(link.href, values));
    const label = resolveTemplate(link.label, values).trim();
    return href && label ? `<a class="ls-sidebar-row" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs({ id: link.id, kind: "sidebar_link", label, href, track: "link" })}>${icon(link.icon === "link" ? "link" : "world")}<span>${text(label)}</span></a>` : "";
  }).join("");
  const buttonsHtml = buttons.map((button) => {
    const href = sanitizeLinkUrl(resolveTemplate(button.href, values));
    const label = resolveTemplate(button.label, values).trim();
    return href && label ? `<a class="ls-sidebar-button ls-sidebar-button-${button.style}" href="${attr(href)}" target="_blank" rel="noopener noreferrer"${trackingAttrs({ id: button.id, kind: "sidebar_button", label, href, track: "button" })}>${text(label)}</a>` : "";
  }).join("");

  return `<aside id="ls-site-sidebar" class="ls-sidebar" aria-label="Site navigation"><div class="ls-sidebar-mobile-header"><span class="ls-sidebar-mobile-title" data-ls-active-page-label="">${text(activePageName)}</span><button class="ls-sidebar-close" type="button" aria-label="Close site navigation">${icon("x")}</button></div><div class="ls-sidebar-inner">${renderSidebarSection(content.sidebar.sections.tabs.label, tabsHtml)}${renderSidebarSection(content.sidebar.sections.links.label, linksHtml)}${renderSidebarSection(content.sidebar.sections.nextSteps.label, buttonsHtml, "ls-sidebar-section-buttons")}</div></aside><div class="ls-sidebar-backdrop" aria-hidden="true"></div>`;
}

function renderSidebarSection(label: string, content: string, className = "") {
  return content ? `<section class="ls-sidebar-section${className ? ` ${className}` : ""}"><h2>${text(label)}</h2><div>${content}</div></section>` : "";
}

function renderEmptyPage() {
  return `<div class="ls-empty-page"><h1>This page is empty</h1></div>`;
}

function getMetadataFromContent(content: SiteContent, fallbackTitle: string) {
  const page = getVisibleSitePages(content)[0];
  const title = page ? findText(page.document, "pageTitleTitle") : "";
  const description = page ? findText(page.document, "pageTitleSubtitle") : "";
  return {
    title: title || fallbackTitle || "Untitled Lightsite",
    description,
  };
}

function findText(node: TiptapNode, type: string): string {
  if (node.type === type) return getNodeText(node).trim();
  for (const child of node.content ?? []) {
    const value = findText(child, type);
    if (value) return value;
  }
  return "";
}

function buildVariableValues(payload: PublishedSitePayload) {
  const values: Record<string, string> = {};
  for (const variable of payload.content.variables) {
    values[variable.key] = toStringValue(variable.defaultValue);
    values[variable.id] = toStringValue(variable.defaultValue);
  }
  Object.assign(values, payload.selectedVariant?.variableValues ?? {});
  if (payload.selectedVariant?.recipientName) values.recipient_name = payload.selectedVariant.recipientName;
  if (payload.selectedVariant?.recipientCompany) values.recipient_company = payload.selectedVariant.recipientCompany;
  return values;
}

function resolveVariableToken(node: TiptapNode, values: Record<string, string>) {
  const id = stringAttr(node.attrs?.variableId);
  return values[id] ?? stringAttr(node.attrs?.fallbackName, id);
}

function resolveTemplate(value: string, values: Record<string, string>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

function trackingAttrs(input: {
  href?: string;
  id: string;
  kind: string;
  label: string;
  track: "button" | "link" | "tab";
}) {
  return ` data-ls-track="${input.track}" data-ls-element-id="${attr(input.id)}" data-ls-element-kind="${attr(input.kind)}" data-ls-element-label="${attr(input.label)}"${input.href ? ` data-ls-element-href="${attr(sanitizeTrackingHref(input.href))}"` : ""}`;
}

function sanitizeTrackingHref(value: string) {
  try {
    const url = new URL(value, "https://lightsite.invalid");
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.origin === "https://lightsite.invalid" ? url.pathname : url.toString();
  } catch {
    return "";
  }
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
  return id ? ` data-ls-node-id="${attr(id)}"` : "";
}

function stableElementId(prefix: string, value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${prefix}-${slug || "element"}`;
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

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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
var root=document.querySelector('.ls-site');if(!root)return;
var sidebar=root.querySelector('.ls-sidebar');
var menu=root.querySelector('.ls-mobile-menu');
var closeButton=root.querySelector('.ls-sidebar-close');
var backdrop=root.querySelector('.ls-sidebar-backdrop');
function setSidebarOpen(open,restoreFocus){
  if(!sidebar)return;
  sidebar.classList.toggle('is-open',open);
  if(backdrop)backdrop.classList.toggle('is-open',open);
  if(menu)menu.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('ls-drawer-open',open);
  if(open&&closeButton)requestAnimationFrame(function(){closeButton.focus();});
  if(!open&&restoreFocus&&menu)menu.focus();
}
function removeLogoTile(tile){var group=tile&&tile.parentElement;if(tile)tile.remove();if(group&&!group.querySelector('.ls-page-title-logo'))group.remove();}
function handleLogoError(image){
  var tile=image.closest('.ls-page-title-logo');if(!tile)return;
  if(tile.getAttribute('data-ls-logo-kind')==='workspace'&&!image.hasAttribute('data-ls-logo-fallback')){
    image.setAttribute('data-ls-logo-fallback','');image.alt='Lightsite';image.src='/lightsite-logo.svg';return;
  }
  removeLogoTile(tile);
}
root.querySelectorAll('.ls-page-title-logo img').forEach(function(image){
  image.addEventListener('error',function(){handleLogoError(image);});
  if(image.complete&&image.naturalWidth===0)handleLogoError(image);
});
function selectPage(slug){
  root.querySelectorAll('[data-ls-page-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-ls-page-panel')!==slug;});
  root.querySelectorAll('[data-ls-page-target]').forEach(function(tab){tab.classList.toggle('is-active',tab.getAttribute('data-ls-page-target')===slug);});
  var active=Array.prototype.find.call(root.querySelectorAll('[data-ls-page-target]'),function(tab){return tab.getAttribute('data-ls-page-target')===slug;});
  active=active?active.querySelector('span'):null;
  if(active)root.querySelectorAll('[data-ls-active-page-label]').forEach(function(label){label.textContent=active.textContent||'';});
  setSidebarOpen(false,true);
}
root.addEventListener('click',function(event){
  var target=event.target instanceof Element?event.target.closest('[data-ls-page-target],.ls-mobile-menu,.ls-sidebar-close,.ls-sidebar-backdrop'):null;if(!target)return;
  if(target.matches('[data-ls-page-target]')){event.preventDefault();selectPage(target.getAttribute('data-ls-page-target')||'');return;}
  if(target.matches('.ls-mobile-menu')){setSidebarOpen(!sidebar.classList.contains('is-open'),false);return;}
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
mobileQuery.addEventListener('change',function(event){if(!event.matches)setSidebarOpen(false,false);});
})();`;

export { SITE_DOCUMENT_CSS as PUBLIC_SITE_CSS } from "./styles";
export { LIGHTSITE_THEME_CSS } from "@lightsite/design-tokens";
