import { and, eq, isNotNull } from "drizzle-orm";
import {
  db as defaultDb,
  siteVariants,
  siteVersions,
  sites,
  workspaces,
  type Database,
  type SiteContent,
} from "@handout/db";
import {
  getSiteMetadata,
  getSiteVariableValues,
  normalizeSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@handout/site-document";
import type { TrackingV2TrackingMode } from "@handout/tracking-schema";
import { isPostgresUniqueViolation } from "../lib/postgres-errors";
import { allocateRecipientShortCode } from "../sites/public-identifiers";
import {
  normalizePublicRecipientLink,
  type PublicRecipientLinkInput,
} from "./recipient-link";

export type PublicSiteLookupInput = {
  workspaceSlug: string;
  siteSlug: string;
  variantSlug: string | null;
};

export type PublicSiteRecord = {
  payload: unknown;
};

export type PublicRecipientLinkRecord = PublicSiteRecord & {
  shortCode: string;
};

export interface PublicSiteRepository {
  findPublishedSite(input: PublicSiteLookupInput): Promise<PublicSiteRecord | null>;
  findPublishedSiteByShortCode(shortCode: string): Promise<PublicRecipientLinkRecord | null>;
  resolveOrCreateRecipientLink(input: PublicRecipientLinkInput & {
    sitePublicId: string;
  }): Promise<PublicRecipientLinkRecord | null>;
}

export type PublicSiteRepositoryOptions = {
  resolveWorkspaceLogoUrl?: (workspaceId: string) => string | null;
};

export function createDbPublicSiteRepository(
  database: Database = defaultDb,
  options: PublicSiteRepositoryOptions = {},
): PublicSiteRepository {
  return {
    async findPublishedSite(input) {
      const [record] = await database
        .select({
          workspace: {
            id: workspaces.id,
            slug: workspaces.slug,
            name: workspaces.name,
            websiteDomain: workspaces.websiteDomain,
            logoAssetId: workspaces.logoAssetId,
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
        payload: buildPublicSitePayload(
          record,
          variant,
          record.workspace.logoAssetId
            ? `/api/workspaces/logo-assets/${record.workspace.logoAssetId}`
            : options.resolveWorkspaceLogoUrl?.(record.workspace.id) ?? null,
        ),
      };
    },

    async findPublishedSiteByShortCode(shortCode) {
      const [record] = await database
        .select({
          workspace: {
            id: workspaces.id,
            slug: workspaces.slug,
            name: workspaces.name,
            websiteDomain: workspaces.websiteDomain,
            logoAssetId: workspaces.logoAssetId,
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
          variant: {
            id: siteVariants.id,
            slug: siteVariants.slug,
            shortCode: siteVariants.shortCode,
            name: siteVariants.name,
            recipientName: siteVariants.recipientName,
            recipientCompany: siteVariants.recipientCompany,
            variableValues: siteVariants.variableValues,
            revisionNumber: siteVariants.revisionNumber,
          },
        })
        .from(siteVariants)
        .innerJoin(sites, eq(siteVariants.siteId, sites.id))
        .innerJoin(workspaces, eq(sites.workspaceId, workspaces.id))
        .innerJoin(siteVersions, eq(sites.publishedVersionId, siteVersions.id))
        .where(and(
          eq(siteVariants.shortCode, shortCode),
          eq(siteVariants.status, "active"),
          eq(workspaces.status, "active"),
          eq(sites.status, "published"),
          isNotNull(sites.publishedVersionId),
          eq(siteVersions.kind, "publish"),
        ))
        .limit(1);

      if (!record || !record.site.publishedAt) return null;

      return {
        shortCode: record.variant.shortCode,
        payload: buildPublicSitePayload(
          record,
          record.variant,
          resolveWorkspaceLogoUrl(record.workspace, options),
        ),
      };
    },

    async resolveOrCreateRecipientLink(input) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          return await database.transaction(async (transaction) => {
            const [record] = await transaction
              .select({
                workspace: {
                  id: workspaces.id,
                  slug: workspaces.slug,
                  name: workspaces.name,
                  websiteDomain: workspaces.websiteDomain,
                  logoAssetId: workspaces.logoAssetId,
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
                eq(sites.publicId, input.sitePublicId),
                eq(workspaces.status, "active"),
                eq(sites.status, "published"),
                isNotNull(sites.publishedVersionId),
                eq(siteVersions.kind, "publish"),
              ))
              .limit(1);

            if (!record || !record.site.publishedAt) return null;

            const content = normalizeSiteContent(record.version.content, record.site.name);
            const normalized = normalizePublicRecipientLink(content, input);
            if (!normalized) return null;

            const [existing] = await transaction
              .select()
              .from(siteVariants)
              .where(and(
                eq(siteVariants.siteId, record.site.id),
                eq(siteVariants.publicLinkKey, normalized.publicLinkKey),
              ))
              .limit(1);

            if (existing) {
              if (existing.status !== "active") return null;
              return {
                shortCode: existing.shortCode,
                payload: buildPublicSitePayload(
                  record,
                  existing,
                  resolveWorkspaceLogoUrl(record.workspace, options),
                ),
              };
            }

            const slug = await findAvailableRecipientSlug(transaction, {
              siteId: record.site.id,
              slugBase: normalized.slugBase,
              publicLinkKey: normalized.publicLinkKey,
            });
            const created = await allocateRecipientShortCode(async (shortCode) => {
              const [inserted] = await transaction
                .insert(siteVariants)
                .values({
                  shortCode,
                  workspaceId: record.workspace.id,
                  siteId: record.site.id,
                  name: normalized.name,
                  slug,
                  recipientName: normalized.recipientName,
                  recipientCompany: normalized.recipientCompany,
                  variableValues: normalized.variableValues,
                  publicLinkKey: normalized.publicLinkKey,
                })
                .onConflictDoNothing({ target: siteVariants.shortCode })
                .returning();
              return inserted ?? null;
            });

            if (!created) throw new Error("Public recipient insert did not return a row.");

            return {
              shortCode: created.shortCode,
              payload: buildPublicSitePayload(
                record,
                created,
                resolveWorkspaceLogoUrl(record.workspace, options),
              ),
            };
          });
        } catch (error) {
          if (!isPostgresUniqueViolation(error) || attempt === 3) throw error;
        }
      }

      return null;
    },
  };
}

export function createUnavailablePublicSiteRepository(): PublicSiteRepository {
  return {
    async findPublishedSite() {
      return null;
    },
    async findPublishedSiteByShortCode() {
      return null;
    },
    async resolveOrCreateRecipientLink() {
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
    logoAssetId: string | null;
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
  shortCode?: string;
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

function resolveWorkspaceLogoUrl(
  workspace: { id: string; logoAssetId: string | null },
  options: PublicSiteRepositoryOptions,
) {
  return workspace.logoAssetId
    ? `/api/workspaces/logo-assets/${workspace.logoAssetId}`
    : options.resolveWorkspaceLogoUrl?.(workspace.id) ?? null;
}

async function findAvailableRecipientSlug(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: { siteId: string; slugBase: string; publicLinkKey: string },
) {
  const candidates = [
    input.slugBase,
    `${input.slugBase}-${input.publicLinkKey.slice(0, 8)}`.slice(0, 96),
    `${input.slugBase}-${input.publicLinkKey.slice(0, 15)}`.slice(0, 96),
  ];

  for (const candidate of candidates) {
    const [owner] = await transaction
      .select({ id: siteVariants.id })
      .from(siteVariants)
      .where(and(eq(siteVariants.siteId, input.siteId), eq(siteVariants.slug, candidate)))
      .limit(1);
    if (!owner) return candidate;
  }

  return `recipient-${input.publicLinkKey.slice(0, 24)}`;
}

function buildPublicSitePayload(
  record: PublishedSiteQueryRecord,
  variant: PublishedVariantRecord | null,
  workspaceLogoUrl: string | null,
): PublishedSitePayload {
  if (!record.site.publishedAt || !record.site.publishedVersionId) {
    throw new Error("Published site payload requires a published timestamp.");
  }

  const content = normalizeSiteContent(record.version.content, record.site.name);
  const variableValues = getSiteVariableValues(content, {
    recipientCompany: variant?.recipientCompany,
    recipientName: variant?.recipientName,
    variableValues: variant?.variableValues,
  });
  const metadata = getSiteMetadata(content, record.site.name, variableValues);
  const trackingMode: TrackingV2TrackingMode = "events";

  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: record.workspace.id,
      slug: record.workspace.slug,
      name: record.workspace.name,
      websiteDomain: record.workspace.websiteDomain ?? "",
      logoUrl: workspaceLogoUrl,
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
