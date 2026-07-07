import { and, eq, isNotNull } from "drizzle-orm";
import {
  db as defaultDb,
  normalizeSiteContent,
  siteVersions,
  siteVariants,
  sites,
  workspaces,
  type Database,
  type SiteContent,
  type SiteContentBlock,
} from "@lightsite/db";
import type { TrackingMode } from "@lightsite/tracking-schema";

export type PublicSiteLookupInput = {
  workspaceSlug: string;
  siteSlug: string;
  variantSlug: string | null;
};

export type PublicSiteRecord = {
  payload: unknown;
};

export interface PublicSiteRepository {
  findPublishedSite(input: PublicSiteLookupInput): Promise<PublicSiteRecord | null>;
}

export function createDbPublicSiteRepository(database: Database = defaultDb): PublicSiteRepository {
  return {
    async findPublishedSite(input) {
      const [record] = await database
        .select({
          workspace: {
            id: workspaces.id,
            slug: workspaces.slug,
            name: workspaces.name,
            websiteDomain: workspaces.websiteDomain,
          },
          site: {
            id: sites.id,
            slug: sites.slug,
            name: sites.name,
            publishedVersionId: sites.publishedVersionId,
            publishedAt: sites.publishedAt,
          },
          version: {
            id: siteVersions.id,
            versionNumber: siteVersions.versionNumber,
            content: siteVersions.content,
            createdAt: siteVersions.createdAt,
          },
        })
        .from(sites)
        .innerJoin(workspaces, eq(sites.workspaceId, workspaces.id))
        .innerJoin(siteVersions, eq(sites.publishedVersionId, siteVersions.id))
        .where(and(
          eq(workspaces.slug, input.workspaceSlug),
          eq(workspaces.status, "active"),
          eq(sites.slug, input.siteSlug),
          eq(sites.status, "published"),
          isNotNull(sites.publishedVersionId),
          eq(siteVersions.kind, "publish"),
        ))
        .limit(1);

      if (!record || !record.site.publishedAt) {
        return null;
      }

      if (input.variantSlug) {
        const [variant] = await database
          .select({
            id: siteVariants.id,
            slug: siteVariants.slug,
            name: siteVariants.name,
            recipientName: siteVariants.recipientName,
            recipientCompany: siteVariants.recipientCompany,
            variableValues: siteVariants.variableValues,
            revisionNumber: siteVariants.revisionNumber,
          })
          .from(siteVariants)
          .where(and(
            eq(siteVariants.workspaceId, record.workspace.id),
            eq(siteVariants.siteId, record.site.id),
            eq(siteVariants.slug, input.variantSlug),
            eq(siteVariants.status, "active"),
          ))
          .limit(1);

        if (!variant) {
          return null;
        }

        return {
          payload: {
            ...buildPublicSitePayload(record, {
              id: variant.id,
              slug: variant.slug,
              name: variant.name,
              recipientName: variant.recipientName,
              recipientCompany: variant.recipientCompany,
              revisionNumber: variant.revisionNumber,
              variableValues: variant.variableValues,
            }),
          },
        };
      }

      return {
        payload: buildPublicSitePayload(record, null),
      };
    },
  };
}

type PublishedSiteQueryRecord = {
  workspace: {
    id: string;
    slug: string;
    name: string;
    websiteDomain: string | null;
  };
  site: {
    id: string;
    slug: string;
    name: string;
    publishedVersionId: string | null;
    publishedAt: Date | null;
  };
  version: {
    id: string;
    versionNumber: number;
    content: SiteContent;
    createdAt: Date;
  };
};

type PublishedVariantRecord = {
  id: string;
  slug: string;
  name: string;
  recipientName: string | null;
  recipientCompany: string | null;
  revisionNumber: number;
  variableValues: Record<string, unknown>;
};

function buildPublicSitePayload(
  record: PublishedSiteQueryRecord,
  variant: PublishedVariantRecord | null,
) {
  if (!record.site.publishedAt || !record.site.publishedVersionId) {
    throw new Error("Published site payload requires a published timestamp.");
  }
  const content = normalizeSiteContent(record.version.content);
  const trackingMode: TrackingMode = "engagement";

  return {
    schemaVersion: 1,
    workspace: {
      id: record.workspace.id,
      slug: record.workspace.slug,
      name: record.workspace.name,
      websiteDomain: record.workspace.websiteDomain ?? "",
      logoUrl: null,
    },
    site: {
      id: record.site.id,
      slug: record.site.slug,
      name: record.site.name,
      publishedVersionId: record.site.publishedVersionId,
      publishedAt: record.site.publishedAt.toISOString(),
    },
    metadata: {
      title: content.chrome.hero.title || record.site.name,
      description: content.chrome.hero.subtitle ?? "",
      ogImage: null,
      robots: "noindex,nofollow",
    },
    chrome: {
      siteHeader: {
        brandName: content.chrome.siteHeader.brandName,
        logoUrl: content.chrome.siteHeader.logoUrl || null,
        primaryButtonText: content.chrome.siteHeader.primaryButtonText || null,
        primaryButtonHref: content.chrome.siteHeader.primaryButtonHref || null,
        secondaryButtonText: content.chrome.siteHeader.secondaryButtonText || null,
        secondaryButtonHref: content.chrome.siteHeader.secondaryButtonHref || null,
        showSecondaryButton: content.chrome.siteHeader.showSecondaryButton,
      },
      hero: {
        avatarMode: content.chrome.hero.avatarMode,
        avatarImageUrl: content.chrome.hero.avatarImageUrl || null,
        avatarImageSecondaryUrl: content.chrome.hero.avatarImageSecondaryUrl || null,
        avatarImageAlt: content.chrome.hero.avatarImageAlt || null,
        avatarImageSecondaryAlt: content.chrome.hero.avatarImageSecondaryAlt || null,
        eyebrow: content.chrome.hero.eyebrow || null,
        title: content.chrome.hero.title || record.site.name,
        subtitle: content.chrome.hero.subtitle || null,
      },
    },
    variables: content.variables.map((variable) => ({
      id: variable.key,
      name: variable.label,
      type: variable.type,
      defaultValue: toPublicString(variable.defaultValue),
    })),
    selectedVariant: variant
      ? {
          id: variant.id,
          slug: variant.slug,
          name: variant.name,
          recipientName: variant.recipientName,
          recipientCompany: variant.recipientCompany,
          revisionNumber: variant.revisionNumber,
          variableValues: toStringRecord(variant.variableValues),
        }
      : null,
    blocks: content.blocks.map(toPublicBlock).filter(isPresent),
    tracking: {
      workspaceId: record.workspace.id,
      siteId: record.site.id,
      publishedVersionId: record.site.publishedVersionId,
      variantId: variant?.id ?? null,
      variantRevision: variant?.revisionNumber ?? null,
      mode: trackingMode,
      token: null,
    },
  };
}

function toPublicBlock(block: SiteContentBlock): Record<string, unknown> | null {
  const fields = block.fields;

  switch (block.type) {
    case "title":
    case "heading": {
      const text = getString(fields, "text") ?? getString(fields, "title");
      return text
        ? {
            id: block.id,
            type: "heading",
            level: block.type === "title" || fields.level === 1 ? 1 : (fields.level === 3 ? 3 : 2),
            text,
          }
        : null;
    }

    case "text": {
      const text = getString(fields, "text") ?? getString(fields, "body");
      return text ? { id: block.id, type: "text", text } : null;
    }

    case "divider":
      return {
        id: block.id,
        type: "divider",
        width: fields.width === "full" ? "full" : "content",
        spacing: fields.spacing === "sm" || fields.spacing === "lg" ? fields.spacing : "md",
      };

    case "cta": {
      const label = getString(fields, "label");
      const href = getString(fields, "href") ?? getString(fields, "url");
      return label && href
        ? {
            id: block.id,
            type: "button",
            label,
            href,
            style: fields.style === "secondary" || fields.style === "outline" ? "outline" : "filled",
          }
        : null;
    }

    case "button": {
      const label = getString(fields, "label") ?? getString(fields, "text");
      const href = getString(fields, "href") ?? getString(fields, "url");
      return label && href
        ? {
            id: block.id,
            type: "button",
            label,
            href,
            style: fields.style === "filled" || fields.style === "primary" ? "filled" : "outline",
          }
        : null;
    }

    case "quote": {
      const quote = getString(fields, "quote");
      return quote
        ? {
            id: block.id,
            type: "testimonial",
            avatar: getString(fields, "avatar"),
            name: getString(fields, "personName") ?? getString(fields, "name") ?? "",
            quote,
            role: [getString(fields, "personTitle"), getString(fields, "company")].filter(Boolean).join(", "),
          }
        : null;
    }

    case "bullet-list":
    case "number-list": {
      const items = getStringArray(fields, "items");
      return items.length > 0 ? { id: block.id, type: block.type, items } : null;
    }

    case "icon-list": {
      const items = getRecordArray(fields, "items")
        .map((item, index) => ({
          id: getString(item, "id") ?? `${block.id}-${index + 1}`,
          icon: getString(item, "icon") ?? "box",
          iconTone: getString(item, "iconTone") ?? "default",
          text: getString(item, "text") ?? "",
        }))
        .filter((item) => item.text);

      return items.length > 0 ? { id: block.id, type: "icon-list", items } : null;
    }

    case "image": {
      const src = getString(fields, "src");
      return src
        ? {
            id: block.id,
            type: "image",
            asset: toPublicAsset({
              id: `${block.id}-asset`,
              kind: "image",
              src,
              alt: getString(fields, "alt") ?? "",
            }),
            caption: getString(fields, "caption"),
          }
        : null;
    }

    case "gif": {
      const src = getString(fields, "src");
      return src
        ? {
            id: block.id,
            type: "gif",
            asset: toPublicAsset({
              id: `${block.id}-asset`,
              kind: "image",
              src,
              alt: getString(fields, "alt") ?? "",
            }),
            caption: getString(fields, "caption"),
          }
        : null;
    }

    case "image-card":
      return {
        id: block.id,
        type: "image-card",
        alt: getString(fields, "alt") ?? "",
        body: getString(fields, "body") ?? "",
        buttonText: getString(fields, "buttonText") ?? "",
        buttonUrl: getString(fields, "buttonUrl") ?? "",
        includeButton: fields.includeButton !== false,
        src: getString(fields, "src"),
        title: getString(fields, "title") ?? "",
      };

    case "icon-card":
      return {
        id: block.id,
        type: "icon-card",
        body: getString(fields, "body") ?? "",
        icon: getString(fields, "icon") ?? "box",
        iconTone: getString(fields, "iconTone") ?? "default",
        includeIcon: fields.includeIcon !== false,
        title: getString(fields, "title") ?? "",
      };

    case "calendar": {
      const label = getString(fields, "label") ?? getString(fields, "text");
      const href = getString(fields, "href") ?? getString(fields, "url");
      return label && href ? { id: block.id, type: "calendar", label, href } : null;
    }

    case "accordion": {
      const items = getRecordArray(fields, "items")
        .map((item, index) => ({
          id: getString(item, "id") ?? `${block.id}-${index + 1}`,
          title: getString(item, "title") ?? "",
          body: getString(item, "body") ?? "",
          expanded: item.expanded !== false,
        }))
        .filter((item) => item.title);

      return items.length > 0 ? { id: block.id, type: "accordion", items } : null;
    }

    case "video":
      return {
        id: block.id,
        type: "video",
        thumbnail: getString(fields, "thumbnail"),
        url: getString(fields, "url"),
      };

    case "testimonial": {
      const quote = getString(fields, "quote");
      return quote
        ? {
            id: block.id,
            type: "testimonial",
            avatar: getString(fields, "avatar"),
            name: getString(fields, "name") ?? "",
            quote,
            role: getString(fields, "role") ?? "",
          }
        : null;
    }

    case "logo-grid":
    case "logo_strip": {
      const logos = getRecordArray(fields, "logos")
        .map((logo, index) => ({
          id: getString(logo, "id") ?? `${block.id}-${index + 1}`,
          image: getString(logo, "image") ?? getString(logo, "src"),
          name: getString(logo, "name") ?? getString(logo, "alt") ?? "",
        }))
        .filter((logo) => logo.name);

      return logos.length > 0 ? { id: block.id, type: "logo-grid", logos } : null;
    }

    default:
      return null;
  }
}

function toPublicAsset(input: {
  alt: string;
  id: string;
  kind: "image" | "logo" | "avatar" | "og_image";
  src: string;
}) {
  return {
    ...input,
    width: 1200,
    height: 675,
  };
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getRecordArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function toPublicString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function toStringRecord(value: Record<string, unknown>) {
  const output: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    const publicValue = toPublicString(entryValue);

    if (publicValue.length > 0) {
      output[key] = publicValue;
    }
  }

  return output;
}

function isPresent<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}

export function createUnavailablePublicSiteRepository(): PublicSiteRepository {
  return {
    async findPublishedSite() {
      return null;
    },
  };
}
