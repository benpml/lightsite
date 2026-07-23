import {
  getHandoutDocumentStringLimit,
  HANDOUT_COLLECTION_LIMITS,
  HANDOUT_TEXT_LIMITS,
  isEmbeddedImageDataUrl,
  slugifyName,
  validateSiteSlug,
  validateTextLimit,
} from "@handout/domain";
import { normalizeSiteContent } from "@handout/db";
import {
  analyzeSiteContentSafety,
  createSiteContentFromDefaults,
  hasAddedEmbeddedImageDataUrl,
  normalizeSiteDefaults,
  siteContentSchema,
  SITE_DOCUMENT_SCHEMA_VERSION,
} from "@handout/site-document";
import {
  SiteSlugConflictError,
  SiteWorkspaceCapacityError,
  type SiteRecord,
  type SiteRepository,
  type SiteVariantRecord,
  type SiteVersionKind,
  type SiteVersionRecord,
} from "./repository";
import type { SiteContentCoordinator } from "../collaboration/server";
import { withRecipientLogo } from "./recipient-values";

export type SiteListItem = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  recipientCount?: number;
  thumbnail: SiteThumbnailPreview;
  visibility: "private" | "team";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

type SiteThumbnailPreview = {
  content: SiteRecord["draftContent"];
};

export type SitePermissions = {
  canView: boolean;
  canEdit: boolean;
  canDuplicate: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

export type SiteDetail = SiteListItem & {
  permissions: SitePermissions;
};

export type SiteContentPayload = {
  draftRevision: number;
  draftContent: SiteRecord["draftContent"];
};

export type SiteVersionSummary = {
  id: string;
  siteId: string;
  versionNumber: number;
  kind: SiteVersionKind;
  label: string | null;
  createdByUserId: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type SiteWorkspaceContext = {
  id: string;
  plan: "free" | "core" | "pro";
  role: "admin" | "user";
};

export type ListSitesInput = {
  workspace: SiteWorkspaceContext;
  userId: string;
  status?: "active" | "archived" | "all";
  limit?: number;
  cursor?: number;
};

export type CreateSiteInput = {
  workspace: SiteWorkspaceContext;
  userId: string;
  name: string;
  slug?: string;
};

export type SiteMutationInput = {
  workspace: SiteWorkspaceContext;
  userId: string;
  siteId: string;
};

export type UpdateSiteContentInput = SiteMutationInput & {
  draftContent: SiteRecord["draftContent"];
  expectedDraftRevision?: number;
};

export type UpdateSiteInput = SiteMutationInput & {
  name?: string;
  slug?: string;
  visibility?: "private" | "team";
};

export type CreateSiteResult = {
  site: Pick<SiteListItem, "id" | "publicId" | "name" | "slug" | "status">;
};

export type SiteVariant = {
  id: string;
  shortCode: string;
  siteId: string;
  name: string;
  slug: string;
  recipientName: string | null;
  recipientCompany: string | null;
  variableValues: Record<string, unknown>;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
};

export type BatchUpsertSiteVariantsInput = SiteMutationInput & {
  matchBy: "id" | "slug";
  variants: Array<{
    id?: string;
    slug: string;
    name: string;
    recipientName?: string | null;
    recipientCompany?: string | null;
    variableValues: Record<string, unknown>;
  }>;
};

export type DeleteSiteVariantInput = SiteMutationInput & {
  variantId: string;
};

export interface SiteService {
  listSites(input: ListSitesInput): Promise<{
    sites: SiteListItem[];
    nextCursor: string | null;
  }>;
  createSite(input: CreateSiteInput): Promise<CreateSiteResult>;
  getSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
  updateSite(input: UpdateSiteInput): Promise<{ site: SiteDetail }>;
  getSiteContent(input: SiteMutationInput): Promise<SiteContentPayload>;
  updateSiteContent(input: UpdateSiteContentInput): Promise<{
    site: SiteListItem;
    draftRevision: number;
    draftContent: SiteRecord["draftContent"];
  }>;
  validateSiteContent(input: { draftContent: SiteRecord["draftContent"] }): Promise<{
    valid: boolean;
    issues: SitePublishValidationIssue[];
  }>;
  duplicateSite(input: SiteMutationInput): Promise<CreateSiteResult>;
  listSiteVariants(input: SiteMutationInput): Promise<{
    variants: SiteVariant[];
    nextCursor: string | null;
  }>;
  batchUpsertSiteVariants(input: BatchUpsertSiteVariantsInput): Promise<{
    variants: SiteVariant[];
  }>;
  deleteSiteVariant(input: DeleteSiteVariantInput): Promise<void>;
  publishSite(input: SiteMutationInput): Promise<{
    site: SiteDetail;
    version: SiteVersionSummary;
  }>;
  unpublishSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
  archiveSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
  deleteSite(input: SiteMutationInput): Promise<void>;
  restoreSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
  listSiteVersions(input: SiteMutationInput): Promise<{
    versions: SiteVersionSummary[];
    nextCursor: string | null;
  }>;
  restoreSiteVersion(input: SiteMutationInput & {
    versionId: string;
  }): Promise<{
    site: SiteDetail;
    version: SiteVersionSummary;
  }>;
}

export class SiteValidationError extends Error {
  readonly code: "site.invalid" | "site.slug_invalid";

  constructor(message: string, code: "site.invalid" | "site.slug_invalid" = "site.invalid") {
    super(message);
    this.name = "SiteValidationError";
    this.code = code;
  }
}

export class SiteConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super("Site slug is already taken.");
    this.name = "SiteConflictError";
    this.slug = slug;
  }
}

export class SitePlanLimitError extends Error {
  readonly limit: number;

  constructor(limit: number, plan: SiteWorkspaceContext["plan"]) {
    super(plan === "free"
      ? `Free workspaces can retain up to ${limit} sites. Upgrade to create another site.`
      : `This workspace has reached the ${limit.toLocaleString("en-US")}-site safety limit. Contact support if you need additional capacity.`);
    this.name = "SitePlanLimitError";
    this.limit = limit;
  }
}

export class SitePublishPlanError extends Error {
  constructor() {
    super("Upgrade to Core to publish this site.");
    this.name = "SitePublishPlanError";
  }
}

export class SiteNotFoundError extends Error {
  constructor() {
    super("Site is not available for the current user.");
    this.name = "SiteNotFoundError";
  }
}

export class SitePermissionError extends Error {
  constructor(message = "You do not have permission to manage this site.") {
    super(message);
    this.name = "SitePermissionError";
  }
}

export class SiteArchivedError extends Error {
  constructor() {
    super("Archived sites must be restored before editing.");
    this.name = "SiteArchivedError";
  }
}

export class SitePublishedSlugChangeError extends Error {
  constructor() {
    super("Published site slugs cannot be changed while the site is published.");
    this.name = "SitePublishedSlugChangeError";
  }
}

export class SiteDraftRevisionConflictError extends Error {
  constructor() {
    super("The site draft changed before this update was applied.");
    this.name = "SiteDraftRevisionConflictError";
  }
}

export class SiteVariantConflictError extends Error {
  constructor(message = "A site variant with this slug already exists.") {
    super(message);
    this.name = "SiteVariantConflictError";
  }
}

export class SiteVersionNotFoundError extends Error {
  constructor() {
    super("Site version is not available for the current user.");
    this.name = "SiteVersionNotFoundError";
  }
}

export type SitePublishValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export class SitePublishValidationError extends Error {
  readonly issues: SitePublishValidationIssue[];

  constructor(issues: SitePublishValidationIssue[]) {
    super("Site is not ready to publish.");
    this.name = "SitePublishValidationError";
    this.issues = issues;
  }
}

const LIST_SITES_LIMIT = 50;
const LIST_SITE_VERSIONS_LIMIT = 100;
const LIST_SITE_VARIANTS_LIMIT = 100;
const FREE_SITE_LIMIT = 10;
const RETAINED_SITE_HARD_LIMIT = 10_000;
const SITE_PLAN_LIMITS: Record<SiteWorkspaceContext["plan"], number> = {
  free: FREE_SITE_LIMIT,
  core: RETAINED_SITE_HARD_LIMIT,
  pro: RETAINED_SITE_HARD_LIMIT,
} as const;
export function createSiteService(
  repository: SiteRepository,
  options: { contentCoordinator?: SiteContentCoordinator } = {},
): SiteService {
  return {
    async listSites(input) {
      const limit = Math.min(Math.max(input.limit ?? LIST_SITES_LIMIT, 1), 100);
      const offset = Math.max(input.cursor ?? 0, 0);
      const records = await repository.listAccessibleSites({
        workspaceId: input.workspace.id,
        userId: input.userId,
        role: input.workspace.role,
        limit: limit + 1,
        offset,
        status: input.status ?? "active",
      });
      const page = records.slice(0, limit);
      const recipientCounts = await repository.countActiveVariantsBySiteIds({
        workspaceId: input.workspace.id,
        siteIds: page.map((record) => record.id),
      });

      return {
        sites: page.map((record) =>
          serializeSite(record, recipientCounts.get(record.id) ?? 0)
        ),
        nextCursor: records.length > limit ? String(offset + limit) : null,
      };
    },

    async createSite(input) {
      const nameResult = validateTextLimit(input.name.trim(), "siteName", "Site name");

      if (!nameResult.ok || !nameResult.value.trim()) {
        throw new SiteValidationError(nameResult.ok ? "Site name is required." : nameResult.message);
      }

      const slugResult = validateSiteSlug(input.slug ?? slugifyName(input.name));

      if (!slugResult.ok) {
        throw new SiteValidationError(slugResult.message, "site.slug_invalid");
      }

      const limit = SITE_PLAN_LIMITS[input.workspace.plan];

      const [existingSite, rawDefaults] = await Promise.all([
        repository.findByWorkspaceAndSlug({
          workspaceId: input.workspace.id,
          slug: slugResult.slug,
        }),
        repository.findUserSiteDefaults(input.userId),
      ]);

      if (existingSite) {
        throw new SiteConflictError(slugResult.slug);
      }

      try {
        const defaults = normalizeSiteDefaults(rawDefaults);
        const recordingEnabled =
          input.workspace.plan === "pro" &&
          defaults.recordingEnabled &&
          defaults.recordingDisclosureAccepted;
        const site = await repository.createSite({
          workspaceId: input.workspace.id,
          createdByUserId: input.userId,
          name: nameResult.value,
          slug: slugResult.slug,
          draftContent: createSiteContentFromDefaults(defaults),
          trackingEnabled: defaults.trackingEnabled,
          recordingEnabled,
          recordingDisclosureAccepted: recordingEnabled,
          maxWorkspaceSites: limit,
        });

        return {
          site: {
            id: site.id,
            publicId: site.publicId,
            name: site.name,
            slug: site.slug,
            status: site.status,
          },
        };
      } catch (error) {
        if (error instanceof SiteSlugConflictError) {
          throw new SiteConflictError(error.slug);
        }
        if (error instanceof SiteWorkspaceCapacityError) {
          throw new SitePlanLimitError(error.limit, input.workspace.plan);
        }

        throw error;
      }
    },

    async getSite(input) {
      const site = await requireViewableSite(repository, input);

      return {
        site: serializeSiteDetail(site, resolvePermissions(site, input)),
      };
    },

    async updateSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canEdit) {
        throw new SitePermissionError();
      }

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      const nextSlug = input.slug ? validateSiteSlug(input.slug) : null;
      const nextName = input.name === undefined
        ? null
        : validateTextLimit(input.name.trim(), "siteName", "Site name");

      if (nextName && (!nextName.ok || !nextName.value.trim())) {
        throw new SiteValidationError(nextName.ok ? "Site name is required." : nextName.message);
      }

      if (nextSlug && !nextSlug.ok) {
        throw new SiteValidationError(nextSlug.message, "site.slug_invalid");
      }

      if (nextSlug?.ok && nextSlug.slug !== site.slug) {
        if (site.status === "published") {
          throw new SitePublishedSlugChangeError();
        }

        const existingSite = await repository.findByWorkspaceAndSlug({
          workspaceId: input.workspace.id,
          slug: nextSlug.slug,
        });

        if (existingSite && existingSite.id !== site.id) {
          throw new SiteConflictError(nextSlug.slug);
        }
      }

      const updatedSite = await repository.updateSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        updatedByUserId: input.userId,
        ...(nextName?.ok ? { name: nextName.value } : {}),
        ...(nextSlug?.ok && nextSlug.slug !== site.slug ? { slug: nextSlug.slug } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
      });

      options.contentCoordinator?.broadcastSiteChanged(input.siteId);

      return {
        site: serializeSiteDetail(updatedSite, resolvePermissions(updatedSite, input)),
      };
    },

    async getSiteContent(input) {
      const site = await requireViewableSite(repository, input);
      const draftContent = normalizeSiteContent(site.draftContent);

      return {
        draftRevision: site.draftRevision,
        draftContent,
      };
    },

    async updateSiteContent(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canEdit) {
        throw new SitePermissionError();
      }

      const parsedDraftContent = siteContentSchema.safeParse(input.draftContent);
      if (!parsedDraftContent.success) {
        throw new SiteValidationError(
          parsedDraftContent.error.issues[0]?.message ?? "Site content is invalid.",
        );
      }
      const draftContent = parsedDraftContent.data;
      const draftIssues = validateDraftSafetyContent(draftContent);

      if (draftIssues.length > 0) {
        throw new SiteValidationError(draftIssues[0]?.message ?? "Site content is invalid.");
      }
      if (hasAddedEmbeddedImageDataUrl(site.draftContent, draftContent)) {
        throw new SiteValidationError(
          "Inline image data cannot be added to site content. Upload the image to the workspace first.",
        );
      }

      const updatedSite = options.contentCoordinator
        ? await options.contentCoordinator.replaceContent({
            workspaceId: input.workspace.id,
            siteId: input.siteId,
            userId: input.userId,
            draftContent,
            ...(input.expectedDraftRevision
              ? { expectedDraftRevision: input.expectedDraftRevision }
              : {}),
          })
        : await repository.updateSiteContent({
            workspaceId: input.workspace.id,
            siteId: input.siteId,
            updatedByUserId: input.userId,
            draftContent,
            ...(input.expectedDraftRevision
              ? { expectedDraftRevision: input.expectedDraftRevision }
              : {}),
          });

      if (!updatedSite) {
        throw new SiteDraftRevisionConflictError();
      }

      return {
        site: serializeSite(updatedSite),
        draftRevision: updatedSite.draftRevision,
        draftContent: normalizeSiteContent(updatedSite.draftContent),
      };
    },

    async validateSiteContent(input) {
      const issues = validateDraftContent(normalizeSiteContent(input.draftContent));

      return {
        valid: issues.length === 0,
        issues,
      };
    },

    async duplicateSite(input) {
      let site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canDuplicate) {
        throw new SitePermissionError("You do not have permission to duplicate this site.");
      }

      if (options.contentCoordinator) {
        site = await options.contentCoordinator.flushSite({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          userId: input.userId,
        }) ?? site;
      }

      const limit = SITE_PLAN_LIMITS[input.workspace.plan];

      const { name, slug } = await getAvailableCopyIdentity(repository, input.workspace.id, site);

      try {
        const duplicatedSite = await repository.duplicateSite({
          workspaceId: input.workspace.id,
          sourceSiteId: site.id,
          createdByUserId: input.userId,
          name,
          slug,
          draftContent: normalizeSiteContent(site.draftContent),
          maxWorkspaceSites: limit,
        });

        return {
          site: {
            id: duplicatedSite.id,
            publicId: duplicatedSite.publicId,
            name: duplicatedSite.name,
            slug: duplicatedSite.slug,
            status: duplicatedSite.status,
          },
        };
      } catch (error) {
        if (error instanceof SiteSlugConflictError) {
          throw new SiteConflictError(error.slug);
        }
        if (error instanceof SiteWorkspaceCapacityError) {
          throw new SitePlanLimitError(error.limit, input.workspace.plan);
        }

        throw error;
      }
    },

    async listSiteVariants(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canView) {
        throw new SiteNotFoundError();
      }

      const variants = await repository.listVariants({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        limit: LIST_SITE_VARIANTS_LIMIT,
      });

      return {
        variants: variants.map(serializeVariant),
        nextCursor: null,
      };
    },

    async batchUpsertSiteVariants(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canEdit) {
        throw new SitePermissionError();
      }

      const seenSlugs = new Set<string>();
      const variants = input.variants.map((variant) => {
        const variableValues = withRecipientLogo(variant.variableValues);
        const slugResult = validateSiteSlug(variant.slug);
        const nameResult = validateTextLimit(variant.name.trim(), "variableName", "Variant name");
        const variantValueIssues = validateUnknownStringFields(variableValues, [
          "variants",
          variant.slug,
          "variableValues",
        ]);

        if (!slugResult.ok) {
          throw new SiteValidationError(slugResult.message, "site.slug_invalid");
        }

        if (!nameResult.ok || !nameResult.value.trim()) {
          throw new SiteValidationError(nameResult.ok ? "Variant name is required." : nameResult.message);
        }

        if (variant.recipientName) {
          const recipientNameResult = validateTextLimit(
            variant.recipientName,
            "recipientName",
            "Recipient name",
          );

          if (!recipientNameResult.ok) {
            throw new SiteValidationError(recipientNameResult.message);
          }
        }

        if (variant.recipientCompany) {
          const recipientCompanyResult = validateTextLimit(
            variant.recipientCompany,
            "recipientCompany",
            "Recipient company",
          );

          if (!recipientCompanyResult.ok) {
            throw new SiteValidationError(recipientCompanyResult.message);
          }
        }

        if (variantValueIssues.length > 0) {
          throw new SiteValidationError(variantValueIssues[0]?.message ?? "Variant values are invalid.");
        }

        if (seenSlugs.has(slugResult.slug)) {
          throw new SiteVariantConflictError(`Variant slug appears more than once in the request: ${slugResult.slug}`);
        }

        seenSlugs.add(slugResult.slug);

        return {
          ...variant,
          name: nameResult.value,
          slug: slugResult.slug,
          variableValues,
        };
      });

      try {
        const changedVariants = await repository.batchUpsertVariants({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          matchBy: input.matchBy,
          variants,
        });

        return {
          variants: changedVariants.map(serializeVariant),
        };
      } catch (error) {
        if (error instanceof SiteSlugConflictError) {
          throw new SiteVariantConflictError();
        }

        throw error;
      }
    },

    async deleteSiteVariant(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canEdit) {
        throw new SitePermissionError();
      }

      const deleted = await repository.deleteVariant({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        variantId: input.variantId,
      });

      if (!deleted) {
        throw new SiteNotFoundError();
      }
    },

    async publishSite(input) {
      let site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canPublish) {
        throw new SitePermissionError("You do not have permission to publish this site.");
      }

      if (input.workspace.plan === "free") {
        throw new SitePublishPlanError();
      }

      if (options.contentCoordinator) {
        site = await options.contentCoordinator.flushSite({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          userId: input.userId,
        }) ?? site;
      }

      const validationIssues = validatePublishableSite(site);

      if (validationIssues.length > 0) {
        throw new SitePublishValidationError(validationIssues);
      }

      const published = await repository.publishSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        publishedByUserId: input.userId,
      });

      if (!published) {
        throw new SiteNotFoundError();
      }

      options.contentCoordinator?.broadcastSiteChanged(input.siteId);

      return {
        site: serializeSiteDetail(published.site, resolvePermissions(published.site, input)),
        version: serializeVersion(published.version),
      };
    },

    async unpublishSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canUnpublish && site.status === "published") {
        throw new SitePermissionError("You do not have permission to unpublish this site.");
      }

      if (site.status !== "published") {
        return {
          site: serializeSiteDetail(site, permissions),
        };
      }

      const unpublishedSite = await repository.unpublishSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        unpublishedByUserId: input.userId,
      });

      if (!unpublishedSite) {
        throw new SiteNotFoundError();
      }

      options.contentCoordinator?.broadcastSiteChanged(input.siteId);

      return {
        site: serializeSiteDetail(unpublishedSite, resolvePermissions(unpublishedSite, input)),
      };
    },

    async archiveSite(input) {
      let site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canArchive) {
        throw new SitePermissionError();
      }

      if (options.contentCoordinator) {
        site = await options.contentCoordinator.flushSite({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          userId: input.userId,
        }) ?? site;
      }

      if (site.status === "archived") {
        return {
          site: serializeSiteDetail(site, permissions),
        };
      }

      const archivedSite = await repository.archiveSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        archivedByUserId: input.userId,
      });

      options.contentCoordinator?.closeSite(input.siteId);

      return {
        site: serializeSiteDetail(archivedSite, resolvePermissions(archivedSite, input)),
      };
    },

    async deleteSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canArchive) {
        throw new SitePermissionError();
      }

      const deleted = await repository.deleteSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
      });

      if (!deleted) {
        throw new SiteNotFoundError();
      }

      options.contentCoordinator?.closeSite(input.siteId);
    },

    async restoreSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canRestore) {
        throw new SitePermissionError();
      }

      if (site.status !== "archived") {
        return {
          site: serializeSiteDetail(site, permissions),
        };
      }

      const restoredSite = await repository.restoreSite({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        restoredByUserId: input.userId,
      });

      return {
        site: serializeSiteDetail(restoredSite, resolvePermissions(restoredSite, input)),
      };
    },

    async listSiteVersions(input) {
      await requireViewableSite(repository, input);
      const versions = await repository.listVersions({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        limit: LIST_SITE_VERSIONS_LIMIT,
      });

      return {
        versions: versions.map(serializeVersion),
        nextCursor: null,
      };
    },

    async restoreSiteVersion(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canEdit) {
        throw new SitePermissionError("You do not have permission to restore this site.");
      }

      const version = await repository.findVersion({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        versionId: input.versionId,
      });

      if (!version) {
        throw new SiteVersionNotFoundError();
      }

      const restored = await repository.restoreVersionToDraft({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        versionId: input.versionId,
        restoredByUserId: input.userId,
      });

      if (!restored) {
        throw new SiteVersionNotFoundError();
      }

      if (options.contentCoordinator) {
        await options.contentCoordinator.replaceContent({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          userId: input.userId,
          draftContent: restored.site.draftContent,
          expectedDraftRevision: restored.site.draftRevision,
          skipFlush: true,
        });
      }

      return {
        site: serializeSiteDetail(restored.site, resolvePermissions(restored.site, input)),
        version: serializeVersion(restored.version),
      };
    },
  };
}

function serializeSite(site: SiteRecord, recipientCount?: number): SiteListItem {
  const serializedSite: SiteListItem = {
    id: site.id,
    publicId: site.publicId,
    name: site.name,
    slug: site.slug,
    status: site.status,
    thumbnail: {
      content: normalizeSiteContent(site.draftContent),
    },
    visibility: site.visibility,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    publishedAt: site.publishedAt?.toISOString() ?? null,
    archivedAt: site.archivedAt?.toISOString() ?? null,
  };

  if (recipientCount !== undefined) {
    serializedSite.recipientCount = recipientCount;
  }

  return serializedSite;
}

function serializeSiteDetail(site: SiteRecord, permissions: SitePermissions): SiteDetail {
  return {
    ...serializeSite(site),
    permissions,
  };
}

function serializeVersion(version: SiteVersionRecord): SiteVersionSummary {
  return {
    id: version.id,
    siteId: version.siteId,
    versionNumber: version.versionNumber,
    kind: version.kind,
    label: version.label,
    createdByUserId: version.createdByUserId,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
  };
}

function serializeVariant(variant: SiteVariantRecord): SiteVariant {
  return {
    id: variant.id,
    shortCode: variant.shortCode,
    siteId: variant.siteId,
    name: variant.name,
    slug: variant.slug,
    recipientName: variant.recipientName,
    recipientCompany: variant.recipientCompany,
    variableValues: variant.variableValues,
    revisionNumber: variant.revisionNumber,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

async function requireViewableSite(
  repository: SiteRepository,
  input: SiteMutationInput,
): Promise<SiteRecord> {
  const site = await repository.findByWorkspaceAndId({
    workspaceId: input.workspace.id,
    siteId: input.siteId,
  });

  if (!site) {
    throw new SiteNotFoundError();
  }

  const permissions = resolvePermissions(site, input);

  if (!permissions.canView) {
    throw new SiteNotFoundError();
  }

  return site;
}

function resolvePermissions(site: SiteRecord, input: SiteMutationInput): SitePermissions {
  const isAdmin = input.workspace.role === "admin";
  const isCreator = site.createdByUserId === input.userId;
  const isTeamVisible = site.visibility === "team";
  const canManage = isAdmin || isCreator;
  const canView = canManage || isTeamVisible;
  const canEdit = canManage && site.status !== "archived";
  const canPublish = canEdit;
  const canUnpublish = canManage && site.status === "published";

  return {
    canView,
    canEdit,
    canDuplicate: canView,
    canPublish,
    canUnpublish,
    canArchive: canManage,
    canRestore: canManage && site.status === "archived",
  };
}

function validatePublishableSite(site: SiteRecord): SitePublishValidationIssue[] {
  const issues: SitePublishValidationIssue[] = [];
  const slugResult = validateSiteSlug(site.slug);

  if (!site.name.trim()) {
    issues.push({
      path: ["name"],
      message: "Site name is required before publishing.",
    });
  }

  if (!slugResult.ok) {
    issues.push({
      path: ["slug"],
      message: slugResult.message,
    });
  }

  issues.push(...validateDraftContent(normalizeSiteContent(site.draftContent), ["draftContent"]));

  return issues;
}

function validateDraftContent(
  draftContent: SiteRecord["draftContent"],
  pathPrefix: Array<string | number> = [],
): SitePublishValidationIssue[] {
  const issues: SitePublishValidationIssue[] = validateDraftSafetyContent(draftContent, pathPrefix);

  if (draftContent.schemaVersion !== SITE_DOCUMENT_SCHEMA_VERSION) {
    issues.push({
      path: [...pathPrefix, "schemaVersion"],
      message: "Draft content schema is not supported for publishing.",
    });
  }

  if (!draftContent.pages.some((page) => page.status === "visible")) {
    issues.push({
      path: [...pathPrefix, "pages"],
      message: "At least one visible page is required before publishing.",
    });
  }

  const variableKeys = new Set<string>();

  draftContent.variables.forEach((variable, index) => {
    if (variableKeys.has(variable.key)) {
      issues.push({
        path: [...pathPrefix, "variables", index, "key"],
        message: `Variable key must be unique: ${variable.key}`,
      });
    }

    variableKeys.add(variable.key);
  });

  const pageIds = new Set<string>();
  const pageSlugs = new Set<string>();

  draftContent.pages.forEach((page, index) => {
    if (pageIds.has(page.id)) {
      issues.push({
        path: [...pathPrefix, "pages", index, "id"],
        message: `Page id must be unique: ${page.id}`,
      });
    }
    if (pageSlugs.has(page.slug)) {
      issues.push({
        path: [...pathPrefix, "pages", index, "slug"],
        message: `Page slug must be unique: ${page.slug}`,
      });
    }
    pageIds.add(page.id);
    pageSlugs.add(page.slug);
  });

  return issues;
}

function validateDraftSafetyContent(
  draftContent: SiteRecord["draftContent"],
  pathPrefix: Array<string | number> = [],
): SitePublishValidationIssue[] {
  return analyzeSiteContentSafety(draftContent).issues.map((issue) => ({
    path: pathPrefix,
    message: issue.message,
  }));
}

function validateUnknownStringFields(
  value: unknown,
  rootPath: Array<string | number>,
): SitePublishValidationIssue[] {
  const issues: SitePublishValidationIssue[] = [];
  const stack: Array<{ path: Array<string | number>; value: unknown }> = [{
    path: rootPath,
    value,
  }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (typeof current.value === "string") {
      const limit = getHandoutDocumentStringLimit(current.value);
      if (current.value.length > limit) {
        issues.push({
          path: current.path,
          message: isEmbeddedImageDataUrl(current.value)
            ? `Embedded image must be ${HANDOUT_TEXT_LIMITS.embeddedImageDataUrl.toLocaleString("en-US")} characters or fewer.`
            : `Text must be ${HANDOUT_TEXT_LIMITS.blockText.toLocaleString("en-US")} characters or fewer.`,
        });
      }
      continue;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((item, index) => {
        stack.push({ path: [...current.path, index], value: item });
      });
      continue;
    }
    if (current.value && typeof current.value === "object") {
      Object.entries(current.value).forEach(([key, item]) => {
        stack.push({ path: [...current.path, key], value: item });
      });
    }
  }

  return issues;
}

async function getAvailableCopyIdentity(
  repository: SiteRepository,
  workspaceId: string,
  sourceSite: SiteRecord,
): Promise<{ name: string; slug: string }> {
  const name = `Copy of ${sourceSite.name}`.slice(0, 160);
  const baseSlug = slugifyName(name).slice(0, 88) || "copy";

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existingSite = await repository.findByWorkspaceAndSlug({
      workspaceId,
      slug,
    });

    if (!existingSite) {
      return { name, slug };
    }
  }

  throw new SiteConflictError(baseSlug);
}
