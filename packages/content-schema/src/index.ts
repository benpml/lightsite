import type { TrackingContext, TrackingMode } from "@lightsite/tracking-schema";

export const CURRENT_PUBLIC_PAYLOAD_SCHEMA_VERSION = 1;

export type PublicAsset = {
  id: string;
  kind: "image" | "logo" | "avatar" | "og_image";
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type PublicVariable = {
  id: string;
  name: string;
  type: "text" | "image" | "url";
  defaultValue: string;
};

export type PublicVariant = {
  id: string;
  slug: string;
  name: string;
  recipientName: string | null;
  recipientCompany: string | null;
  revisionNumber: number;
  variableValues: Record<string, string>;
};

export type PublicSiteMetadata = {
  title: string;
  description: string;
  ogImage: PublicAsset | null;
  robots: "noindex,nofollow" | "index,follow";
};

export type PublicSiteHeaderChrome = {
  brandName: string;
  logoUrl: string | null;
  primaryButtonText: string | null;
  primaryButtonHref: string | null;
  secondaryButtonText: string | null;
  secondaryButtonHref: string | null;
  showSecondaryButton: boolean;
};

export type PublicSiteHeroChrome = {
  avatarMode: "single" | "duo";
  avatarImageUrl: string | null;
  avatarImageSecondaryUrl: string | null;
  avatarImageAlt: string | null;
  avatarImageSecondaryAlt: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
};

export type PublicHeadingBlock = {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};

export type PublicTextBlock = {
  id: string;
  type: "text";
  text: string;
};

export type PublicDividerBlock = {
  id: string;
  type: "divider";
  width: "content" | "full";
  spacing: "sm" | "md" | "lg";
};

export type PublicImageBlock = {
  id: string;
  type: "image";
  asset: PublicAsset;
  caption: string | null;
};

export type PublicButtonBlock = {
  id: string;
  type: "button";
  label: string;
  href: string;
  style: "filled" | "outline";
};

export type PublicListBlock = {
  id: string;
  type: "bullet-list" | "number-list";
  items: string[];
};

export type PublicIconListBlock = {
  id: string;
  type: "icon-list";
  items: Array<{
    id: string;
    icon: string;
    iconTone: string;
    text: string;
  }>;
};

export type PublicGifBlock = {
  id: string;
  type: "gif";
  asset: PublicAsset;
  caption: string | null;
};

export type PublicImageCardBlock = {
  id: string;
  type: "image-card";
  alt: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  includeButton: boolean;
  src: string | null;
  title: string;
};

export type PublicIconCardBlock = {
  id: string;
  type: "icon-card";
  body: string;
  icon: string;
  iconTone: string;
  includeIcon: boolean;
  title: string;
};

export type PublicCalendarBlock = {
  id: string;
  type: "calendar";
  label: string;
  href: string;
};

export type PublicAccordionBlock = {
  id: string;
  type: "accordion";
  items: Array<{
    id: string;
    title: string;
    body: string;
    expanded: boolean;
  }>;
};

export type PublicVideoBlock = {
  id: string;
  type: "video";
  thumbnail: string | null;
  url: string | null;
};

export type PublicTestimonialBlock = {
  id: string;
  type: "testimonial";
  avatar: string | null;
  name: string;
  quote: string;
  role: string;
};

export type PublicLogoGridBlock = {
  id: string;
  type: "logo-grid";
  logos: Array<{
    id: string;
    image: string | null;
    name: string;
  }>;
};

export type PublicBlock =
  | PublicHeadingBlock
  | PublicTextBlock
  | PublicDividerBlock
  | PublicImageBlock
  | PublicButtonBlock
  | PublicListBlock
  | PublicIconListBlock
  | PublicGifBlock
  | PublicImageCardBlock
  | PublicIconCardBlock
  | PublicCalendarBlock
  | PublicAccordionBlock
  | PublicVideoBlock
  | PublicTestimonialBlock
  | PublicLogoGridBlock;

export type PublishedSitePayload = {
  schemaVersion: 1;
  workspace: {
    id: string;
    slug: string;
    name: string;
    websiteDomain: string;
    logoUrl: string | null;
  };
  site: {
    id: string;
    slug: string;
    name: string;
    publishedVersionId: string;
    publishedAt: string;
  };
  metadata: PublicSiteMetadata;
  chrome: {
    siteHeader: PublicSiteHeaderChrome;
    hero: PublicSiteHeroChrome;
  };
  variables: PublicVariable[];
  selectedVariant: PublicVariant | null;
  blocks: PublicBlock[];
  tracking: TrackingContext;
};

const assetKinds = new Set<PublicAsset["kind"]>(["image", "logo", "avatar", "og_image"]);
const variableTypes = new Set<PublicVariable["type"]>(["text", "image", "url"]);
const trackingModes = new Set<TrackingMode>(["off", "essential_only", "engagement"]);

export function normalizePublishedSitePayload(value: unknown): PublishedSitePayload | null {
  const input = asRecord(value);

  if (!input) {
    return null;
  }

  const workspace = parseWorkspace(input.workspace);
  const site = parseSite(input.site);

  if (!workspace || !site) {
    return null;
  }

  const variables = parseArray(input.variables).map(parseVariable).filter(isPresent);
  const selectedVariant = parseVariant(input.selectedVariant);
  const metadata = parseMetadata(input.metadata, site.name);
  const chrome = parseChrome(input, site.name);

  return {
    schemaVersion: CURRENT_PUBLIC_PAYLOAD_SCHEMA_VERSION,
    workspace,
    site,
    metadata,
    chrome,
    variables,
    selectedVariant,
    blocks: parseArray(input.blocks).map(parseBlock).filter(isPresent),
    tracking: parseTracking(input.tracking, workspace.id, site.id, site.publishedVersionId, selectedVariant),
  };
}

function parseWorkspace(value: unknown): PublishedSitePayload["workspace"] | null {
  const input = asRecord(value);

  if (!input || !isString(input.id) || !isString(input.slug) || !isString(input.name)) {
    return null;
  }

  return {
    id: input.id,
    slug: input.slug.toLowerCase(),
    name: input.name,
    websiteDomain: isString(input.websiteDomain) ? input.websiteDomain : "",
    logoUrl: nullableString(input.logoUrl),
  };
}

function parseSite(value: unknown): PublishedSitePayload["site"] | null {
  const input = asRecord(value);

  if (
    !input ||
    !isString(input.id) ||
    !isString(input.slug) ||
    !isString(input.name) ||
    !isString(input.publishedVersionId)
  ) {
    return null;
  }

  return {
    id: input.id,
    slug: input.slug.toLowerCase(),
    name: input.name,
    publishedVersionId: input.publishedVersionId,
    publishedAt: isString(input.publishedAt) ? input.publishedAt : new Date(0).toISOString(),
  };
}

function parseMetadata(value: unknown, fallbackTitle: string): PublishedSitePayload["metadata"] {
  const input = asRecord(value);

  return {
    title: isString(input?.title) ? input.title : fallbackTitle,
    description: isString(input?.description) ? input.description : "",
    ogImage: parseAsset(input?.ogImage),
    robots: "noindex,nofollow",
  };
}

function parseChrome(
  input: Record<string, unknown>,
  fallbackTitle: string,
): PublishedSitePayload["chrome"] {
  const chrome = asRecord(input.chrome);
  const legacyHeader = asRecord(input.header);
  const siteHeader = asRecord(chrome?.siteHeader);
  const hero = asRecord(chrome?.hero);
  const legacyAvatars = parseArray(legacyHeader?.avatarAssets).map(parseAsset).filter(isPresent);

  return {
    siteHeader: {
      brandName: isString(siteHeader?.brandName) ? siteHeader.brandName : "",
      logoUrl: nullableString(siteHeader?.logoUrl),
      primaryButtonText: nullableString(siteHeader?.primaryButtonText),
      primaryButtonHref: nullableString(siteHeader?.primaryButtonHref),
      secondaryButtonText: nullableString(siteHeader?.secondaryButtonText),
      secondaryButtonHref: nullableString(siteHeader?.secondaryButtonHref),
      showSecondaryButton: siteHeader?.showSecondaryButton === true,
    },
    hero: {
      avatarMode: hero?.avatarMode === "duo" ? "duo" : (legacyHeader?.avatarMode === "duo" ? "duo" : "single"),
      avatarImageUrl: nullableString(hero?.avatarImageUrl) ?? legacyAvatars[0]?.src ?? null,
      avatarImageSecondaryUrl: nullableString(hero?.avatarImageSecondaryUrl) ?? legacyAvatars[1]?.src ?? null,
      avatarImageAlt: nullableString(hero?.avatarImageAlt) ?? legacyAvatars[0]?.alt ?? null,
      avatarImageSecondaryAlt: nullableString(hero?.avatarImageSecondaryAlt) ?? legacyAvatars[1]?.alt ?? null,
      eyebrow: nullableString(hero?.eyebrow) ?? nullableString(legacyHeader?.eyebrow),
      title: isString(hero?.title) ? hero.title : (isString(legacyHeader?.title) ? legacyHeader.title : fallbackTitle),
      subtitle: nullableString(hero?.subtitle) ?? nullableString(legacyHeader?.subtitle),
    },
  };
}

function parseVariable(value: unknown): PublicVariable | null {
  const input = asRecord(value);

  if (!input || !isString(input.id)) {
    return null;
  }

  const type = isString(input.type) && variableTypes.has(input.type as PublicVariable["type"])
    ? input.type as PublicVariable["type"]
    : "text";

  return {
    id: input.id,
    name: isString(input.name) ? input.name : input.id,
    type,
    defaultValue: isString(input.defaultValue) ? input.defaultValue : "",
  };
}

function parseVariant(value: unknown): PublicVariant | null {
  const input = asRecord(value);

  if (!input || !isString(input.id) || !isString(input.slug)) {
    return null;
  }

  return {
    id: input.id,
    slug: input.slug.toLowerCase(),
    name: isString(input.name) ? input.name : input.slug,
    recipientName: nullableString(input.recipientName),
    recipientCompany: nullableString(input.recipientCompany),
    revisionNumber: isNonNegativeInteger(input.revisionNumber) ? input.revisionNumber : 1,
    variableValues: parseStringRecord(input.variableValues),
  };
}

function parseBlock(value: unknown): PublicBlock | null {
  const input = asRecord(value);

  if (!input || !isString(input.id) || !isString(input.type)) {
    return null;
  }

  switch (input.type) {
    case "heading":
      return isString(input.text)
        ? {
            id: input.id,
            type: "heading",
            level: input.level === 1 || input.level === 3 ? input.level : 2,
            text: input.text,
          }
        : null;

    case "text":
      return isString(input.text) ? { id: input.id, type: "text", text: input.text } : null;

    case "divider":
      return {
        id: input.id,
        type: "divider",
        width: input.width === "full" ? "full" : "content",
        spacing: input.spacing === "sm" || input.spacing === "lg" ? input.spacing : "md",
      };

    case "image": {
      const asset = parseAsset(input.asset);
      return asset ? { id: input.id, type: "image", asset, caption: nullableString(input.caption) } : null;
    }

    case "cta":
    case "button":
      return isString(input.label) && isString(input.href)
        ? {
            id: input.id,
            type: "button",
            label: input.label,
            href: input.href,
            style: input.style === "filled" || input.style === "primary" || input.type === "cta" ? "filled" : "outline",
          }
        : null;

    case "quote":
      return isString(input.quote)
        ? {
            id: input.id,
            type: "testimonial",
            quote: input.quote,
            name: isString(input.personName) ? input.personName : "",
            role: [nullableString(input.personTitle), nullableString(input.company)].filter(Boolean).join(", "),
            avatar: null,
          }
        : null;

    case "bullet-list":
    case "number-list": {
      const items = parseArray(input.items).filter(isString);
      return items.length > 0 ? { id: input.id, type: input.type, items } : null;
    }

    case "icon-list": {
      const items = parseArray(input.items).map(parseIconListItem).filter(isPresent);
      return items.length > 0 ? { id: input.id, type: "icon-list", items } : null;
    }

    case "gif": {
      const asset = parseAsset(input.asset);
      return asset ? { id: input.id, type: "gif", asset, caption: nullableString(input.caption) } : null;
    }

    case "image-card":
      return isString(input.title)
        ? {
            id: input.id,
            type: "image-card",
            alt: isString(input.alt) ? input.alt : "",
            body: isString(input.body) ? input.body : "",
            buttonText: isString(input.buttonText) ? input.buttonText : "",
            buttonUrl: isString(input.buttonUrl) ? input.buttonUrl : "",
            includeButton: input.includeButton === true,
            src: nullableString(input.src),
            title: input.title,
          }
        : null;

    case "icon-card":
      return isString(input.title)
        ? {
            id: input.id,
            type: "icon-card",
            body: isString(input.body) ? input.body : "",
            icon: isString(input.icon) ? input.icon : "box",
            iconTone: isString(input.iconTone) ? input.iconTone : "default",
            includeIcon: input.includeIcon !== false,
            title: input.title,
          }
        : null;

    case "calendar":
      return isString(input.label) && isString(input.href)
        ? { id: input.id, type: "calendar", label: input.label, href: input.href }
        : null;

    case "accordion": {
      const items = parseArray(input.items).map(parseAccordionItem).filter(isPresent);
      return items.length > 0 ? { id: input.id, type: "accordion", items } : null;
    }

    case "video":
      return {
        id: input.id,
        type: "video",
        thumbnail: nullableString(input.thumbnail),
        url: nullableString(input.url),
      };

    case "testimonial":
      return isString(input.quote)
        ? {
            id: input.id,
            type: "testimonial",
            avatar: nullableString(input.avatar),
            name: isString(input.name) ? input.name : "",
            quote: input.quote,
            role: isString(input.role) ? input.role : "",
          }
        : null;

    case "logo_strip":
    case "logo-grid": {
      const logos = parseArray(input.logos).map(parseLogoGridItem).filter(isPresent);
      return logos.length > 0 ? { id: input.id, type: "logo-grid", logos } : null;
    }

    default:
      return null;
  }
}

function parseIconListItem(value: unknown): PublicIconListBlock["items"][number] | null {
  const input = asRecord(value);

  if (!input || !isString(input.text)) {
    return null;
  }

  return {
    id: isString(input.id) ? input.id : input.text,
    icon: isString(input.icon) ? input.icon : "box",
    iconTone: isString(input.iconTone) ? input.iconTone : "default",
    text: input.text,
  };
}

function parseAccordionItem(value: unknown): PublicAccordionBlock["items"][number] | null {
  const input = asRecord(value);

  if (!input || !isString(input.title)) {
    return null;
  }

  return {
    id: isString(input.id) ? input.id : input.title,
    title: input.title,
    body: isString(input.body) ? input.body : "",
    expanded: input.expanded !== false,
  };
}

function parseLogoGridItem(value: unknown): PublicLogoGridBlock["logos"][number] | null {
  const input = asRecord(value);

  if (!input || !isString(input.name)) {
    const asset = parseAsset(value);
    return asset ? { id: asset.id, image: asset.src, name: asset.alt || asset.id } : null;
  }

  return {
    id: isString(input.id) ? input.id : input.name,
    image: nullableString(input.image) ?? nullableString(input.src),
    name: input.name,
  };
}

function parseAsset(value: unknown): PublicAsset | null {
  const input = asRecord(value);

  if (!input || !isString(input.id) || !isString(input.src)) {
    return null;
  }

  const kind = isString(input.kind) && assetKinds.has(input.kind as PublicAsset["kind"])
    ? input.kind as PublicAsset["kind"]
    : "image";

  return {
    id: input.id,
    kind,
    src: input.src,
    alt: isString(input.alt) ? input.alt : "",
    width: isPositiveNumber(input.width) ? input.width : 1,
    height: isPositiveNumber(input.height) ? input.height : 1,
  };
}

function parseTracking(
  value: unknown,
  workspaceId: string,
  siteId: string,
  publishedVersionId: string,
  selectedVariant: PublicVariant | null,
): PublishedSitePayload["tracking"] {
  const input = asRecord(value);
  const token = nullableString(input?.token);
  const mode = token && isTrackingMode(input?.mode) ? input.mode : "off";

  return {
    workspaceId: isString(input?.workspaceId) ? input.workspaceId : workspaceId,
    siteId: isString(input?.siteId) ? input.siteId : siteId,
    publishedVersionId: isString(input?.publishedVersionId) ? input.publishedVersionId : publishedVersionId,
    variantId: nullableString(input?.variantId) ?? selectedVariant?.id ?? null,
    variantRevision: isNonNegativeInteger(input?.variantRevision)
      ? input.variantRevision
      : selectedVariant?.revisionNumber ?? null,
    mode,
    token,
  };
}

function parseStringRecord(value: unknown): Record<string, string> {
  const input = asRecord(value);

  if (!input) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => isString(entry[1])),
  );
}

function isTrackingMode(value: unknown): value is TrackingMode {
  return isString(value) && trackingModes.has(value as TrackingMode);
}

function parseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nullableString(value: unknown): string | null {
  return isString(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPresent<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
