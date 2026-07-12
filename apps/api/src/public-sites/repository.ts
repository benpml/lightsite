import { and, eq, isNotNull } from "drizzle-orm";
import {
  db as defaultDb,
  siteVariants,
  siteVersions,
  sites,
  workspaces,
  type Database,
  type SiteContent,
} from "@lightsite/db";
import {
  getSiteMetadata,
  normalizeSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@lightsite/site-document";
import type { TrackingV2TrackingMode } from "@lightsite/tracking-schema";

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

      const variant = input.variantSlug
        ? await findVariant(database, {
            workspaceId: record.workspace.id,
            siteId: record.site.id,
            slug: input.variantSlug,
          })
        : null;

      if (input.variantSlug && !variant) {
        return null;
      }

      return {
        payload: buildPublicSitePayload(record, variant),
      };
    },
  };
}

export function createUnavailablePublicSiteRepository(): PublicSiteRepository {
  return {
    async findPublishedSite() {
      return null;
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

async function findVariant(
  database: Database,
  input: { workspaceId: string; siteId: string; slug: string },
) {
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
      eq(siteVariants.workspaceId, input.workspaceId),
      eq(siteVariants.siteId, input.siteId),
      eq(siteVariants.slug, input.slug),
      eq(siteVariants.status, "active"),
    ))
    .limit(1);

  return variant ?? null;
}

function buildPublicSitePayload(
  record: PublishedSiteQueryRecord,
  variant: PublishedVariantRecord | null,
): PublishedSitePayload {
  if (!record.site.publishedAt || !record.site.publishedVersionId) {
    throw new Error("Published site payload requires a published timestamp.");
  }

  const content = normalizeSiteContent(record.version.content, record.site.name);
  const metadata = getSiteMetadata(content, record.site.name);
  const trackingMode: TrackingV2TrackingMode = "events_and_recording";

  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
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
      title: metadata.title,
      description: metadata.description,
      ogImageUrl: null,
      robots: content.settings.allowSearchIndexing ? "index,follow" : "noindex,nofollow",
    },
    content,
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
    tracking: {
      version: 2,
      workspaceId: record.workspace.id,
      siteId: record.site.id,
      publishedVersionId: record.site.publishedVersionId,
      recipientId: variant?.id ?? null,
      recipientRevision: variant?.revisionNumber ?? null,
      trackingMode,
    },
  };
}

function toStringRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (typeof entryValue === "string") return [[key, entryValue]];
      if (typeof entryValue === "number" || typeof entryValue === "boolean") {
        return [[key, String(entryValue)]];
      }
      return [];
    }),
  );
}
