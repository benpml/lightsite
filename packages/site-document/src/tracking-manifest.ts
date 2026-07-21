import {
  TRACKING_V2_MANIFEST_SCHEMA_VERSION,
  TRACKING_V2_MAX_LABEL_LENGTH,
  trackingV2ManifestPayloadSchema,
  type TrackingV2DestinationKind,
  type TrackingV2ManifestElement,
  type TrackingV2ManifestPayload,
} from "@handout/tracking-schema";

import {
  getSiteSidebarModel,
  getNodeText,
  getSiteVariableValues,
  getVisibleSitePages,
  type PublishedSitePayload,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type TiptapNode,
} from "./model";

const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const WHITESPACE = /\s+/g;
const DOWNLOAD_EXTENSION = /\.(?:7z|csv|docx?|json|pdf|pptx?|rtf|tar|txt|xlsx?|xml|zip)$/i;

export type ResolvedTrackingElement = TrackingV2ManifestElement & {
  href: string;
};

export type ResolvedPublicSiteTracking = {
  manifest: TrackingV2ManifestPayload;
  elementsById: ReadonlyMap<string, ResolvedTrackingElement>;
  values: Readonly<Record<string, string>>;
};

export function resolvePublicSiteTracking(payload: PublishedSitePayload): ResolvedPublicSiteTracking {
  const values = buildPublicSiteVariableValues(payload);
  const visiblePages = getVisibleSitePages(payload.content);
  const pages = visiblePages.map((page) => ({
    id: page.id,
    label: normalizeTrackingLabel(resolveSiteTemplate(page.name, values), "Page"),
  }));
  if (pages.length === 0) {
    pages.push({ id: "page:root", label: normalizeTrackingLabel(payload.site.name, "Site") });
  }
  const elements: ResolvedTrackingElement[] = [];

  for (const page of visiblePages) {
    visitNode(page.document, (node) => {
      const element = resolveNodeTrackingElement(node, page.id, values);
      if (element) elements.push(element);
    });
  }

  const sidebar = getSiteSidebarModel(payload.content);
  for (const link of sidebar.links) {
    const element = resolveSidebarLinkTracking(link, values);
    if (element) elements.push(element);
  }
  for (const button of sidebar.nextSteps) {
    const element = resolveSidebarButtonTracking(button, values);
    if (element) elements.push(element);
  }

  const manifest = trackingV2ManifestPayloadSchema.parse({
    schemaVersion: TRACKING_V2_MANIFEST_SCHEMA_VERSION,
    siteLabel: normalizeTrackingLabel(payload.site.name, "Site"),
    pages,
    elements: elements.map(({ href: _href, ...element }) => element),
  });

  return {
    manifest,
    elementsById: new Map(elements.map((element) => [element.id, element])),
    values,
  };
}

export function resolveNodeTrackingElement(
  node: TiptapNode,
  pageId: string,
  values: Readonly<Record<string, string>>,
): ResolvedTrackingElement | null {
  if (node.type === "buttonBlock") {
    const id = explicitElementId(node.attrs?.id);
    const href = sanitizePublicActionUrl(resolveSiteTemplate(stringValue(node.attrs?.href), values));
    const label = normalizeTrackingLabel(getResolvedNodeText(node, values));
    return id && href && label
      ? createElement({ id, pageId, kind: "button", eventType: "button_click", label, href })
      : null;
  }

  if (node.type === "imageCard" && node.attrs?.includeButton === true) {
    const cardId = explicitElementId(node.attrs?.id);
    const href = sanitizePublicActionUrl(resolveSiteTemplate(stringValue(node.attrs?.buttonUrl), values));
    const label = normalizeTrackingLabel(resolveSiteTemplate(stringValue(node.attrs?.buttonLabel, "Learn more"), values));
    return cardId && href && label
      ? createElement({ id: `${cardId}:button`, pageId, kind: "image_card", eventType: "button_click", label, href })
      : null;
  }

  return null;
}

export function resolveSidebarLinkTracking(
  link: SiteSidebarLink,
  values: Readonly<Record<string, string>>,
): ResolvedTrackingElement | null {
  const id = explicitElementId(link.id);
  const href = sanitizePublicActionUrl(resolveSiteTemplate(link.href, values));
  const label = normalizeTrackingLabel(resolveSiteTemplate(link.label, values));
  return id && href && label
    ? createElement({ id, pageId: null, kind: "sidebar_link", eventType: "link_click", label, href })
    : null;
}

export function resolveSidebarButtonTracking(
  button: SiteSidebarButton,
  values: Readonly<Record<string, string>>,
): ResolvedTrackingElement | null {
  const id = explicitElementId(button.id);
  const href = sanitizePublicActionUrl(resolveSiteTemplate(button.href, values));
  const label = normalizeTrackingLabel(resolveSiteTemplate(button.label, values));
  return id && href && label
    ? createElement({ id, pageId: null, kind: "sidebar_button", eventType: "button_click", label, href })
    : null;
}

export function buildPublicSiteVariableValues(payload: PublishedSitePayload) {
  return getSiteVariableValues(payload.content, {
    recipientCompany: payload.selectedVariant?.recipientCompany,
    recipientName: payload.selectedVariant?.recipientName,
    variableValues: payload.selectedVariant?.variableValues,
  });
}

export function resolveSiteTemplate(value: string, values: Readonly<Record<string, string>>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function getResolvedNodeText(node: TiptapNode, values: Readonly<Record<string, string>>): string {
  return getNodeText(node, values);
}

export function normalizeTrackingLabel(value: string, fallback = "") {
  const normalized = value
    .replace(CONTROL_CHARACTERS, "")
    .replace(WHITESPACE, " ")
    .trim()
    .slice(0, TRACKING_V2_MAX_LABEL_LENGTH);
  return normalized || fallback;
}

export function sanitizePublicActionUrl(value: string) {
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

function createElement(input: Omit<ResolvedTrackingElement, "destinationKind" | "destinationHost">) {
  const destination = classifyDestination(input.href);
  return {
    ...input,
    destinationKind: destination.kind,
    destinationHost: destination.host,
  } satisfies ResolvedTrackingElement;
}

function classifyDestination(href: string): { kind: TrackingV2DestinationKind; host: string | null } {
  if (href.startsWith("#") || href.startsWith("/")) return { kind: "internal_tab", host: null };

  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return { kind: "email", host: null };
    if (url.protocol === "tel:") return { kind: "phone", host: null };
    if (url.protocol === "http:" || url.protocol === "https:") {
      return {
        kind: DOWNLOAD_EXTENSION.test(url.pathname) ? "download" : "external_web",
        host: url.hostname.toLowerCase().replace(/\.$/, "").slice(0, 253) || null,
      };
    }
  } catch {
    return { kind: "other", host: null };
  }

  return { kind: "other", host: null };
}

function explicitElementId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && /^[A-Za-z0-9:_-]+$/.test(id) ? id.slice(0, 160) : null;
}

function visitNode(node: TiptapNode, visitor: (node: TiptapNode) => void) {
  visitor(node);
  for (const child of node.content ?? []) visitNode(child, visitor);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
