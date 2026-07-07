import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ne, or, sql } from "drizzle-orm";
import {
  db as defaultDb,
  defaultSiteContent,
  siteVariants,
  siteVersions,
  sites,
  type Database,
  type SiteContent,
  type SiteVariableDefinition,
} from "@lightsite/db";

export type SiteRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  updatedByUserId: string | null;
  publishedByUserId: string | null;
  archivedByUserId: string | null;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  visibility: "private" | "team";
  draftContent: SiteContent;
  draftRevision: number;
  publishedVersionId: string | null;
  publishedAt: Date | null;
  lastUnpublishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListSitesInput = {
  workspaceId: string;
  userId: string;
  role: "admin" | "user";
  limit: number;
};

export type CreateSiteInput = {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  slug: string;
};

export type UpdateSiteInput = {
  workspaceId: string;
  siteId: string;
  updatedByUserId: string;
  name?: string;
  slug?: string;
  visibility?: "private" | "team";
};

export type DuplicateSiteInput = {
  workspaceId: string;
  sourceSiteId: string;
  createdByUserId: string;
  name: string;
  slug: string;
  draftContent: SiteContent;
};

export type UpdateSiteContentInput = {
  workspaceId: string;
  siteId: string;
  updatedByUserId: string;
  draftContent: SiteContent;
  expectedDraftRevision?: number;
};

export type SiteVersionKind = "initial" | "autosave" | "publish" | "rollback" | "migration";

export type SiteVersionRecord = {
  id: string;
  workspaceId: string;
  siteId: string;
  versionNumber: number;
  kind: SiteVersionKind;
  label: string | null;
  content: SiteContent;
  variablesSnapshot: SiteVariableDefinition[];
  createdByUserId: string | null;
  publishedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type SiteVariantRecord = {
  id: string;
  workspaceId: string;
  siteId: string;
  name: string;
  slug: string;
  recipientName: string | null;
  recipientCompany: string | null;
  variableValues: Record<string, unknown>;
  revisionNumber: number;
  status: "active" | "deleted";
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertSiteVariantInput = {
  id?: string;
  slug: string;
  name: string;
  recipientName?: string | null;
  recipientCompany?: string | null;
  variableValues: Record<string, unknown>;
};

export interface SiteRepository {
  listAccessibleSites(input: ListSitesInput): Promise<SiteRecord[]>;
  countWorkspaceSites(workspaceId: string): Promise<number>;
  findByWorkspaceAndId(input: {
    workspaceId: string;
    siteId: string;
  }): Promise<SiteRecord | null>;
  findByWorkspaceAndSlug(input: {
    workspaceId: string;
    slug: string;
  }): Promise<SiteRecord | null>;
  createSite(input: CreateSiteInput): Promise<SiteRecord>;
  updateSite(input: UpdateSiteInput): Promise<SiteRecord>;
  updateSiteContent(input: UpdateSiteContentInput): Promise<SiteRecord | null>;
  duplicateSite(input: DuplicateSiteInput): Promise<SiteRecord>;
  listVariants(input: {
    workspaceId: string;
    siteId: string;
    limit: number;
  }): Promise<SiteVariantRecord[]>;
  batchUpsertVariants(input: {
    workspaceId: string;
    siteId: string;
    variants: UpsertSiteVariantInput[];
    matchBy: "id" | "slug";
  }): Promise<SiteVariantRecord[]>;
  publishSite(input: {
    workspaceId: string;
    siteId: string;
    publishedByUserId: string;
  }): Promise<{
    site: SiteRecord;
    version: SiteVersionRecord;
  } | null>;
  unpublishSite(input: {
    workspaceId: string;
    siteId: string;
    unpublishedByUserId: string;
  }): Promise<SiteRecord | null>;
  archiveSite(input: {
    workspaceId: string;
    siteId: string;
    archivedByUserId: string;
  }): Promise<SiteRecord>;
  restoreSite(input: {
    workspaceId: string;
    siteId: string;
    restoredByUserId: string;
  }): Promise<SiteRecord>;
  listVersions(input: {
    workspaceId: string;
    siteId: string;
    limit: number;
  }): Promise<SiteVersionRecord[]>;
  findVersion(input: {
    workspaceId: string;
    siteId: string;
    versionId: string;
  }): Promise<SiteVersionRecord | null>;
  restoreVersionToDraft(input: {
    workspaceId: string;
    siteId: string;
    versionId: string;
    restoredByUserId: string;
  }): Promise<{
    site: SiteRecord;
    version: SiteVersionRecord;
  } | null>;
}

export class SiteSlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Site slug is already in use: ${slug}`);
    this.name = "SiteSlugConflictError";
    this.slug = slug;
  }
}

export function createDbSiteRepository(database: Database = defaultDb): SiteRepository {
  return {
    async listAccessibleSites(input) {
      const accessCondition =
        input.role === "admin"
          ? undefined
          : or(
            eq(sites.createdByUserId, input.userId),
            eq(sites.visibility, "team"),
          );
      const conditions = [
        eq(sites.workspaceId, input.workspaceId),
        ne(sites.status, "archived"),
        ...(accessCondition ? [accessCondition] : []),
      ];

      return database
        .select()
        .from(sites)
        .where(and(...conditions))
        .orderBy(desc(sites.updatedAt))
        .limit(input.limit);
    },

    async countWorkspaceSites(workspaceId) {
      const [row] = await database
        .select({ value: count() })
        .from(sites)
        .where(eq(sites.workspaceId, workspaceId));

      return row?.value ?? 0;
    },

    async findByWorkspaceAndId(input) {
      const [site] = await database
        .select()
        .from(sites)
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.id, input.siteId),
        ))
        .limit(1);

      return site ?? null;
    },

    async findByWorkspaceAndSlug(input) {
      const [site] = await database
        .select()
        .from(sites)
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.slug, input.slug),
        ))
        .limit(1);

      return site ?? null;
    },

    async createSite(input) {
      try {
        return await database.transaction(async (transaction) => {
          const [site] = await transaction
            .insert(sites)
            .values({
              workspaceId: input.workspaceId,
              createdByUserId: input.createdByUserId,
              updatedByUserId: input.createdByUserId,
              name: input.name,
              slug: input.slug,
            })
            .returning();

          if (!site) {
            throw new Error("Site insert did not return a row.");
          }

          await transaction
            .insert(siteVersions)
            .values({
              workspaceId: site.workspaceId,
              siteId: site.id,
              versionNumber: 1,
              kind: "initial",
              label: "Initial draft",
              content: site.draftContent,
              variablesSnapshot: site.draftContent.variables,
              createdByUserId: input.createdByUserId,
              metadata: {},
            });

          return site;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new SiteSlugConflictError(input.slug);
        }

        throw error;
      }
    },

    async updateSite(input) {
      const now = new Date();
      const [site] = await database
        .update(sites)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.slug ? { slug: input.slug } : {}),
          ...(input.visibility ? { visibility: input.visibility } : {}),
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        })
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.id, input.siteId),
        ))
        .returning();

      if (!site) {
        throw new Error("Site update did not return a row.");
      }

      return site;
    },

    async updateSiteContent(input) {
      const now = new Date();
      const conditions = [
        eq(sites.workspaceId, input.workspaceId),
        eq(sites.id, input.siteId),
        ...(input.expectedDraftRevision
          ? [eq(sites.draftRevision, input.expectedDraftRevision)]
          : []),
      ];
      const [site] = await database
        .update(sites)
        .set({
          draftContent: input.draftContent,
          draftRevision: sql`${sites.draftRevision} + 1`,
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        })
        .where(and(...conditions))
        .returning();

      return site ?? null;
    },

    async duplicateSite(input) {
      try {
        return await database.transaction(async (transaction) => {
          const [site] = await transaction
            .insert(sites)
            .values({
              workspaceId: input.workspaceId,
              createdByUserId: input.createdByUserId,
              updatedByUserId: input.createdByUserId,
              name: input.name,
              slug: input.slug,
              draftContent: input.draftContent,
              visibility: "private",
            })
            .returning();

          if (!site) {
            throw new Error("Duplicated site insert did not return a row.");
          }

          await transaction
            .insert(siteVersions)
            .values({
              workspaceId: site.workspaceId,
              siteId: site.id,
              versionNumber: 1,
              kind: "initial",
              label: "Duplicated draft",
              content: site.draftContent,
              variablesSnapshot: site.draftContent.variables,
              createdByUserId: input.createdByUserId,
              metadata: {
                duplicatedFromSiteId: input.sourceSiteId,
              },
            });

          return site;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new SiteSlugConflictError(input.slug);
        }

        throw error;
      }
    },

    async listVariants(input) {
      return database
        .select()
        .from(siteVariants)
        .where(and(
          eq(siteVariants.workspaceId, input.workspaceId),
          eq(siteVariants.siteId, input.siteId),
          eq(siteVariants.status, "active"),
        ))
        .orderBy(desc(siteVariants.updatedAt))
        .limit(input.limit);
    },

    async batchUpsertVariants(input) {
      try {
        return await database.transaction(async (transaction) => {
          const changedVariants: SiteVariantRecord[] = [];

          for (const variant of input.variants) {
            const matchCondition = input.matchBy === "id" && variant.id
              ? eq(siteVariants.id, variant.id)
              : eq(siteVariants.slug, variant.slug);
            const [existingVariant] = await transaction
              .select()
              .from(siteVariants)
              .where(and(
                eq(siteVariants.workspaceId, input.workspaceId),
                eq(siteVariants.siteId, input.siteId),
                eq(siteVariants.status, "active"),
                matchCondition,
              ))
              .limit(1);
            const now = new Date();

            if (existingVariant) {
              const [updatedVariant] = await transaction
                .update(siteVariants)
                .set({
                  name: variant.name,
                  slug: variant.slug,
                  recipientName: variant.recipientName ?? null,
                  recipientCompany: variant.recipientCompany ?? null,
                  variableValues: variant.variableValues,
                  revisionNumber: sql`${siteVariants.revisionNumber} + 1`,
                  updatedAt: now,
                })
                .where(and(
                  eq(siteVariants.workspaceId, input.workspaceId),
                  eq(siteVariants.siteId, input.siteId),
                  eq(siteVariants.id, existingVariant.id),
                ))
                .returning();

              if (!updatedVariant) {
                throw new Error("Variant update did not return a row.");
              }

              changedVariants.push(updatedVariant);
              continue;
            }

            const [createdVariant] = await transaction
              .insert(siteVariants)
              .values({
                workspaceId: input.workspaceId,
                siteId: input.siteId,
                name: variant.name,
                slug: variant.slug,
                recipientName: variant.recipientName ?? null,
                recipientCompany: variant.recipientCompany ?? null,
                variableValues: variant.variableValues,
                updatedAt: now,
              })
              .returning();

            if (!createdVariant) {
              throw new Error("Variant insert did not return a row.");
            }

            changedVariants.push(createdVariant);
          }

          return changedVariants;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new SiteSlugConflictError("variant");
        }

        throw error;
      }
    },

    async publishSite(input) {
      return database.transaction(async (transaction) => {
        const [site] = await transaction
          .select()
          .from(sites)
          .where(and(
            eq(sites.workspaceId, input.workspaceId),
            eq(sites.id, input.siteId),
          ))
          .limit(1);

        if (!site || site.status === "archived") {
          return null;
        }

        const [latestVersion] = await transaction
          .select({ versionNumber: siteVersions.versionNumber })
          .from(siteVersions)
          .where(and(
            eq(siteVersions.workspaceId, input.workspaceId),
            eq(siteVersions.siteId, input.siteId),
          ))
          .orderBy(desc(siteVersions.versionNumber))
          .limit(1);
        const now = new Date();
        const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
        const [publishVersion] = await transaction
          .insert(siteVersions)
          .values({
            workspaceId: site.workspaceId,
            siteId: site.id,
            versionNumber: nextVersionNumber,
            kind: "publish",
            label: `Published version ${nextVersionNumber}`,
            content: site.draftContent,
            variablesSnapshot: site.draftContent.variables,
            createdByUserId: input.publishedByUserId,
            publishedAt: now,
            metadata: {
              draftRevision: site.draftRevision,
            },
          })
          .returning();

        if (!publishVersion) {
          throw new Error("Publish version insert did not return a row.");
        }

        const [publishedSite] = await transaction
          .update(sites)
          .set({
            status: "published",
            publishedVersionId: publishVersion.id,
            publishedAt: now,
            publishedByUserId: input.publishedByUserId,
            lastUnpublishedAt: null,
            updatedByUserId: input.publishedByUserId,
            updatedAt: now,
          })
          .where(and(
            eq(sites.workspaceId, input.workspaceId),
            eq(sites.id, input.siteId),
          ))
          .returning();

        if (!publishedSite) {
          throw new Error("Site publish update did not return a row.");
        }

        return {
          site: publishedSite,
          version: publishVersion,
        };
      });
    },

    async unpublishSite(input) {
      const now = new Date();
      const [site] = await database
        .update(sites)
        .set({
          status: "draft",
          publishedVersionId: null,
          publishedAt: null,
          lastUnpublishedAt: now,
          updatedByUserId: input.unpublishedByUserId,
          updatedAt: now,
        })
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.id, input.siteId),
        ))
        .returning();

      return site ?? null;
    },

    async archiveSite(input) {
      const now = new Date();
      const [site] = await database
        .update(sites)
        .set({
          status: "archived",
          archivedByUserId: input.archivedByUserId,
          archivedAt: now,
          updatedByUserId: input.archivedByUserId,
          updatedAt: now,
          publishedVersionId: null,
          publishedAt: null,
          lastUnpublishedAt: now,
        })
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.id, input.siteId),
        ))
        .returning();

      if (!site) {
        throw new Error("Site archive did not return a row.");
      }

      return site;
    },

    async restoreSite(input) {
      const now = new Date();
      const [site] = await database
        .update(sites)
        .set({
          status: "draft",
          archivedByUserId: null,
          archivedAt: null,
          updatedByUserId: input.restoredByUserId,
          updatedAt: now,
          publishedVersionId: null,
          publishedAt: null,
        })
        .where(and(
          eq(sites.workspaceId, input.workspaceId),
          eq(sites.id, input.siteId),
        ))
        .returning();

      if (!site) {
        throw new Error("Site restore did not return a row.");
      }

      return site;
    },

    async listVersions(input) {
      return database
        .select()
        .from(siteVersions)
        .where(and(
          eq(siteVersions.workspaceId, input.workspaceId),
          eq(siteVersions.siteId, input.siteId),
        ))
        .orderBy(desc(siteVersions.versionNumber))
        .limit(input.limit);
    },

    async findVersion(input) {
      const [version] = await database
        .select()
        .from(siteVersions)
        .where(and(
          eq(siteVersions.workspaceId, input.workspaceId),
          eq(siteVersions.siteId, input.siteId),
          eq(siteVersions.id, input.versionId),
        ))
        .limit(1);

      return version ?? null;
    },

    async restoreVersionToDraft(input) {
      return database.transaction(async (transaction) => {
        const [site] = await transaction
          .select()
          .from(sites)
          .where(and(
            eq(sites.workspaceId, input.workspaceId),
            eq(sites.id, input.siteId),
          ))
          .limit(1);

        const [versionToRestore] = await transaction
          .select()
          .from(siteVersions)
          .where(and(
            eq(siteVersions.workspaceId, input.workspaceId),
            eq(siteVersions.siteId, input.siteId),
            eq(siteVersions.id, input.versionId),
          ))
          .limit(1);

        if (!site || site.status === "archived" || !versionToRestore) {
          return null;
        }

        const [latestVersion] = await transaction
          .select({ versionNumber: siteVersions.versionNumber })
          .from(siteVersions)
          .where(and(
            eq(siteVersions.workspaceId, input.workspaceId),
            eq(siteVersions.siteId, input.siteId),
          ))
          .orderBy(desc(siteVersions.versionNumber))
          .limit(1);
        const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

        const [rollbackVersion] = await transaction
          .insert(siteVersions)
          .values({
            workspaceId: site.workspaceId,
            siteId: site.id,
            versionNumber: nextVersionNumber,
            kind: "rollback",
            label: `Restored version ${versionToRestore.versionNumber}`,
            content: versionToRestore.content,
            variablesSnapshot: versionToRestore.content.variables,
            createdByUserId: input.restoredByUserId,
            metadata: {
              restoredFromVersionId: versionToRestore.id,
              restoredFromVersionNumber: versionToRestore.versionNumber,
            },
          })
          .returning();

        if (!rollbackVersion) {
          throw new Error("Rollback version insert did not return a row.");
        }

        const now = new Date();
        const [updatedSite] = await transaction
          .update(sites)
          .set({
            draftContent: versionToRestore.content,
            draftRevision: sql`${sites.draftRevision} + 1`,
            updatedByUserId: input.restoredByUserId,
            updatedAt: now,
          })
          .where(and(
            eq(sites.workspaceId, input.workspaceId),
            eq(sites.id, input.siteId),
          ))
          .returning();

        if (!updatedSite) {
          throw new Error("Site rollback update did not return a row.");
        }

        return {
          site: updatedSite,
          version: rollbackVersion,
        };
      });
    },
  };
}

export function createMemorySiteRepository(
  initialSites: SiteRecord[] = [],
  initialVersions: SiteVersionRecord[] = [],
  initialVariants: SiteVariantRecord[] = [],
): SiteRepository {
  const siteById = new Map(initialSites.map((site) => [site.id, site]));
  const versionById = new Map(initialVersions.map((version) => [version.id, version]));
  const variantById = new Map(initialVariants.map((variant) => [variant.id, variant]));

  for (const site of siteById.values()) {
    const hasVersion = Array.from(versionById.values()).some((version) => version.siteId === site.id);

    if (!hasVersion) {
      const version = buildMemorySiteVersion({
        workspaceId: site.workspaceId,
        siteId: site.id,
        content: site.draftContent,
        variablesSnapshot: site.draftContent.variables,
        createdByUserId: site.createdByUserId,
      });
      versionById.set(version.id, version);
    }
  }
  const findByWorkspaceAndId = (input: {
    workspaceId: string;
    siteId: string;
  }) => (
    Array.from(siteById.values()).find(
      (site) => site.workspaceId === input.workspaceId && site.id === input.siteId,
    ) ?? null
  );
  const findByWorkspaceAndSlug = (input: {
    workspaceId: string;
    slug: string;
  }) => (
    Array.from(siteById.values()).find(
      (site) => site.workspaceId === input.workspaceId && site.slug === input.slug,
    ) ?? null
  );
  const findVersion = (input: {
    workspaceId: string;
    siteId: string;
    versionId: string;
  }) => (
    Array.from(versionById.values()).find(
      (version) =>
        version.workspaceId === input.workspaceId &&
        version.siteId === input.siteId &&
        version.id === input.versionId,
    ) ?? null
  );

  return {
    async listAccessibleSites(input) {
      return Array.from(siteById.values())
        .filter((site) => site.workspaceId === input.workspaceId)
        .filter((site) => site.status !== "archived")
        .filter((site) =>
          input.role === "admin" ||
          site.createdByUserId === input.userId ||
          site.visibility === "team",
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, input.limit);
    },

    async countWorkspaceSites(workspaceId) {
      return Array.from(siteById.values()).filter((site) => site.workspaceId === workspaceId).length;
    },

    async findByWorkspaceAndId(input) {
      return findByWorkspaceAndId(input);
    },

    async findByWorkspaceAndSlug(input) {
      return findByWorkspaceAndSlug(input);
    },

    async createSite(input) {
      const existingSite = findByWorkspaceAndSlug({
        workspaceId: input.workspaceId,
        slug: input.slug,
      });

      if (existingSite) {
        throw new SiteSlugConflictError(input.slug);
      }

      const now = new Date();
      const site: SiteRecord = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.createdByUserId,
        archivedByUserId: null,
        publishedByUserId: null,
        name: input.name,
        slug: input.slug,
        status: "draft",
        visibility: "private",
        draftContent: defaultSiteContent,
        draftRevision: 1,
        publishedVersionId: null,
        publishedAt: null,
        lastUnpublishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      siteById.set(site.id, site);
      const version = buildMemorySiteVersion({
        workspaceId: site.workspaceId,
        siteId: site.id,
        content: site.draftContent,
        variablesSnapshot: site.draftContent.variables,
        createdByUserId: input.createdByUserId,
      });
      versionById.set(version.id, version);
      return site;
    },

    async updateSite(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site) {
        throw new Error("Site update did not find a row.");
      }

      const updatedSite: SiteRecord = {
        ...site,
        ...(input.name ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date(),
      };

      siteById.set(updatedSite.id, updatedSite);
      return updatedSite;
    },

    async updateSiteContent(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site || (input.expectedDraftRevision && site.draftRevision !== input.expectedDraftRevision)) {
        return null;
      }

      const updatedSite: SiteRecord = {
        ...site,
        draftContent: input.draftContent,
        draftRevision: site.draftRevision + 1,
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date(),
      };

      siteById.set(updatedSite.id, updatedSite);
      return updatedSite;
    },

    async duplicateSite(input) {
      const existingSite = findByWorkspaceAndSlug({
        workspaceId: input.workspaceId,
        slug: input.slug,
      });

      if (existingSite) {
        throw new SiteSlugConflictError(input.slug);
      }

      const now = new Date();
      const site: SiteRecord = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.createdByUserId,
        archivedByUserId: null,
        publishedByUserId: null,
        name: input.name,
        slug: input.slug,
        status: "draft",
        visibility: "private",
        draftContent: input.draftContent,
        draftRevision: 1,
        publishedVersionId: null,
        publishedAt: null,
        lastUnpublishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      siteById.set(site.id, site);
      const version = buildMemorySiteVersion({
        workspaceId: site.workspaceId,
        siteId: site.id,
        label: "Duplicated draft",
        content: site.draftContent,
        variablesSnapshot: site.draftContent.variables,
        createdByUserId: input.createdByUserId,
        metadata: {
          duplicatedFromSiteId: input.sourceSiteId,
        },
      });
      versionById.set(version.id, version);
      return site;
    },

    async listVariants(input) {
      return Array.from(variantById.values())
        .filter((variant) =>
          variant.workspaceId === input.workspaceId &&
          variant.siteId === input.siteId &&
          variant.status === "active"
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, input.limit);
    },

    async batchUpsertVariants(input) {
      const changedVariants: SiteVariantRecord[] = [];

      for (const variant of input.variants) {
        const existingVariant = Array.from(variantById.values()).find((entry) =>
          entry.workspaceId === input.workspaceId &&
          entry.siteId === input.siteId &&
          entry.status === "active" &&
          (input.matchBy === "id" && variant.id ? entry.id === variant.id : entry.slug === variant.slug)
        );
        const slugOwner = Array.from(variantById.values()).find((entry) =>
          entry.workspaceId === input.workspaceId &&
          entry.siteId === input.siteId &&
          entry.status === "active" &&
          entry.slug === variant.slug
        );

        if (slugOwner && slugOwner.id !== existingVariant?.id) {
          throw new SiteSlugConflictError(variant.slug);
        }

        const now = new Date();

        if (existingVariant) {
          const updatedVariant: SiteVariantRecord = {
            ...existingVariant,
            name: variant.name,
            slug: variant.slug,
            recipientName: variant.recipientName ?? null,
            recipientCompany: variant.recipientCompany ?? null,
            variableValues: variant.variableValues,
            revisionNumber: existingVariant.revisionNumber + 1,
            updatedAt: now,
          };

          variantById.set(updatedVariant.id, updatedVariant);
          changedVariants.push(updatedVariant);
          continue;
        }

        const createdVariant: SiteVariantRecord = {
          id: randomUUID(),
          workspaceId: input.workspaceId,
          siteId: input.siteId,
          name: variant.name,
          slug: variant.slug,
          recipientName: variant.recipientName ?? null,
          recipientCompany: variant.recipientCompany ?? null,
          variableValues: variant.variableValues,
          revisionNumber: 1,
          status: "active",
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        variantById.set(createdVariant.id, createdVariant);
        changedVariants.push(createdVariant);
      }

      return changedVariants;
    },

    async publishSite(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site || site.status === "archived") {
        return null;
      }

      const nextVersionNumber =
        Math.max(
          0,
          ...Array.from(versionById.values())
            .filter((version) => version.workspaceId === input.workspaceId && version.siteId === input.siteId)
            .map((version) => version.versionNumber),
        ) + 1;
      const now = new Date();
      const publishVersion = buildMemorySiteVersion({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        versionNumber: nextVersionNumber,
        kind: "publish",
        label: `Published version ${nextVersionNumber}`,
        content: site.draftContent,
        variablesSnapshot: site.draftContent.variables,
        createdByUserId: input.publishedByUserId,
        publishedAt: now,
        metadata: {
          draftRevision: site.draftRevision,
        },
        createdAt: now,
      });
      const publishedSite: SiteRecord = {
        ...site,
        status: "published",
        publishedVersionId: publishVersion.id,
        publishedAt: now,
        publishedByUserId: input.publishedByUserId,
        lastUnpublishedAt: null,
        updatedByUserId: input.publishedByUserId,
        updatedAt: now,
      };

      versionById.set(publishVersion.id, publishVersion);
      siteById.set(publishedSite.id, publishedSite);

      return {
        site: publishedSite,
        version: publishVersion,
      };
    },

    async unpublishSite(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site) {
        return null;
      }

      const unpublishedSite: SiteRecord = {
        ...site,
        status: "draft",
        publishedVersionId: null,
        publishedAt: null,
        lastUnpublishedAt: new Date(),
        updatedByUserId: input.unpublishedByUserId,
        updatedAt: new Date(),
      };

      siteById.set(unpublishedSite.id, unpublishedSite);
      return unpublishedSite;
    },

    async archiveSite(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site) {
        throw new Error("Site archive did not find a row.");
      }

      const now = new Date();
      const archivedSite: SiteRecord = {
        ...site,
        status: "archived",
        archivedByUserId: input.archivedByUserId,
        archivedAt: now,
        updatedByUserId: input.archivedByUserId,
        updatedAt: now,
        publishedVersionId: null,
        publishedAt: null,
        lastUnpublishedAt: now,
      };

      siteById.set(archivedSite.id, archivedSite);
      return archivedSite;
    },

    async restoreSite(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });

      if (!site) {
        throw new Error("Site restore did not find a row.");
      }

      const restoredSite: SiteRecord = {
        ...site,
        status: "draft",
        archivedByUserId: null,
        archivedAt: null,
        updatedByUserId: input.restoredByUserId,
        updatedAt: new Date(),
        publishedVersionId: null,
        publishedAt: null,
      };

      siteById.set(restoredSite.id, restoredSite);
      return restoredSite;
    },

    async listVersions(input) {
      return Array.from(versionById.values())
        .filter((version) => version.workspaceId === input.workspaceId && version.siteId === input.siteId)
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .slice(0, input.limit);
    },

    async findVersion(input) {
      return findVersion(input);
    },

    async restoreVersionToDraft(input) {
      const site = findByWorkspaceAndId({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
      });
      const versionToRestore = findVersion(input);

      if (!site || site.status === "archived" || !versionToRestore) {
        return null;
      }

      const nextVersionNumber =
        Math.max(
          0,
          ...Array.from(versionById.values())
            .filter((version) => version.workspaceId === input.workspaceId && version.siteId === input.siteId)
            .map((version) => version.versionNumber),
        ) + 1;
      const rollbackVersion = buildMemorySiteVersion({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        versionNumber: nextVersionNumber,
        kind: "rollback",
        label: `Restored version ${versionToRestore.versionNumber}`,
        content: versionToRestore.content,
        variablesSnapshot: versionToRestore.content.variables,
        createdByUserId: input.restoredByUserId,
        metadata: {
          restoredFromVersionId: versionToRestore.id,
          restoredFromVersionNumber: versionToRestore.versionNumber,
        },
      });
      const updatedSite: SiteRecord = {
        ...site,
        draftContent: versionToRestore.content,
        draftRevision: site.draftRevision + 1,
        updatedByUserId: input.restoredByUserId,
        updatedAt: new Date(),
      };

      siteById.set(updatedSite.id, updatedSite);
      versionById.set(rollbackVersion.id, rollbackVersion);

      return {
        site: updatedSite,
        version: rollbackVersion,
      };
    },
  };
}

export function buildMemorySite(overrides: Partial<SiteRecord> = {}): SiteRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: randomUUID(),
    workspaceId: "workspace_test_123",
    createdByUserId: "user_test_123",
    updatedByUserId: null,
    publishedByUserId: null,
    archivedByUserId: null,
    name: "Rollout brief",
    slug: "rollout-brief",
    status: "draft",
    visibility: "private",
    draftContent: defaultSiteContent,
    draftRevision: 1,
    publishedVersionId: null,
    publishedAt: null,
    lastUnpublishedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildMemorySiteVersion(
  overrides: Partial<SiteVersionRecord> = {},
): SiteVersionRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const content = overrides.content ?? defaultSiteContent;

  return {
    id: randomUUID(),
    workspaceId: "workspace_test_123",
    siteId: "site_test_123",
    versionNumber: 1,
    kind: "initial",
    label: "Initial draft",
    content,
    variablesSnapshot: content.variables,
    createdByUserId: "user_test_123",
    publishedAt: null,
    metadata: {},
    createdAt: now,
    ...overrides,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
