import { slugifyName, validateSiteSlug } from "@lightsite/domain";
import { normalizeSiteContent } from "@lightsite/db";
import {
  SiteSlugConflictError,
  type SiteRecord,
  type SiteRepository,
  type SiteVariantRecord,
  type SiteVersionKind,
  type SiteVersionRecord,
} from "./repository";

export type SiteListItem = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  visibility: "private" | "team";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
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
  plan: "basic" | "pro";
  role: "admin" | "user";
};

export type ListSitesInput = {
  workspace: SiteWorkspaceContext;
  userId: string;
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
  site: Pick<SiteListItem, "id" | "name" | "slug" | "status">;
};

export type SiteVariant = {
  id: string;
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
  publishSite(input: SiteMutationInput): Promise<{
    site: SiteDetail;
    version: SiteVersionSummary;
  }>;
  unpublishSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
  archiveSite(input: SiteMutationInput): Promise<{ site: SiteDetail }>;
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
  readonly code: "site.slug_invalid";

  constructor(message: string) {
    super(message);
    this.name = "SiteValidationError";
    this.code = "site.slug_invalid";
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

  constructor(limit: number) {
    super(`This workspace can create up to ${limit} site${limit === 1 ? "" : "s"} on its current plan.`);
    this.name = "SitePlanLimitError";
    this.limit = limit;
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
const SITE_PLAN_LIMITS = {
  basic: 1,
  pro: 100,
} as const;
const SUPPORTED_DRAFT_BLOCK_TYPES = new Set([
  "title",
  "heading",
  "text",
  "divider",
  "bullet-list",
  "number-list",
  "icon-list",
  "image",
  "gif",
  "image-card",
  "icon-card",
  "button",
  "calendar",
  "accordion",
  "video",
  "testimonial",
  "logo-grid",
  "cta",
  "quote",
  "logo_strip",
]);

export function createSiteService(repository: SiteRepository): SiteService {
  return {
    async listSites(input) {
      const records = await repository.listAccessibleSites({
        workspaceId: input.workspace.id,
        userId: input.userId,
        role: input.workspace.role,
        limit: LIST_SITES_LIMIT,
      });

      return {
        sites: records.map(serializeSite),
        nextCursor: null,
      };
    },

    async createSite(input) {
      const slugResult = validateSiteSlug(input.slug ?? slugifyName(input.name));

      if (!slugResult.ok) {
        throw new SiteValidationError(slugResult.message);
      }

      const limit = SITE_PLAN_LIMITS[input.workspace.plan];
      const currentSiteCount = await repository.countWorkspaceSites(input.workspace.id);

      if (currentSiteCount >= limit) {
        throw new SitePlanLimitError(limit);
      }

      const existingSite = await repository.findByWorkspaceAndSlug({
        workspaceId: input.workspace.id,
        slug: slugResult.slug,
      });

      if (existingSite) {
        throw new SiteConflictError(slugResult.slug);
      }

      try {
        const site = await repository.createSite({
          workspaceId: input.workspace.id,
          createdByUserId: input.userId,
          name: input.name,
          slug: slugResult.slug,
        });

        return {
          site: {
            id: site.id,
            name: site.name,
            slug: site.slug,
            status: site.status,
          },
        };
      } catch (error) {
        if (error instanceof SiteSlugConflictError) {
          throw new SiteConflictError(error.slug);
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

      if (nextSlug && !nextSlug.ok) {
        throw new SiteValidationError(nextSlug.message);
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
        ...(input.name ? { name: input.name } : {}),
        ...(nextSlug?.ok && nextSlug.slug !== site.slug ? { slug: nextSlug.slug } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
      });

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

      const draftContent = normalizeSiteContent(input.draftContent);

      const updatedSite = await repository.updateSiteContent({
        workspaceId: input.workspace.id,
        siteId: input.siteId,
        updatedByUserId: input.userId,
        draftContent,
        ...(input.expectedDraftRevision ? { expectedDraftRevision: input.expectedDraftRevision } : {}),
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
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canDuplicate) {
        throw new SitePermissionError("You do not have permission to duplicate this site.");
      }

      const limit = SITE_PLAN_LIMITS[input.workspace.plan];
      const currentSiteCount = await repository.countWorkspaceSites(input.workspace.id);

      if (currentSiteCount >= limit) {
        throw new SitePlanLimitError(limit);
      }

      const { name, slug } = await getAvailableCopyIdentity(repository, input.workspace.id, site);

      try {
        const duplicatedSite = await repository.duplicateSite({
          workspaceId: input.workspace.id,
          sourceSiteId: site.id,
          createdByUserId: input.userId,
          name,
          slug,
          draftContent: normalizeSiteContent(site.draftContent),
        });

        return {
          site: {
            id: duplicatedSite.id,
            name: duplicatedSite.name,
            slug: duplicatedSite.slug,
            status: duplicatedSite.status,
          },
        };
      } catch (error) {
        if (error instanceof SiteSlugConflictError) {
          throw new SiteConflictError(error.slug);
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
        const slugResult = validateSiteSlug(variant.slug);

        if (!slugResult.ok) {
          throw new SiteValidationError(slugResult.message);
        }

        if (seenSlugs.has(slugResult.slug)) {
          throw new SiteVariantConflictError(`Variant slug appears more than once in the request: ${slugResult.slug}`);
        }

        seenSlugs.add(slugResult.slug);

        return {
          ...variant,
          slug: slugResult.slug,
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

    async publishSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (site.status === "archived") {
        throw new SiteArchivedError();
      }

      if (!permissions.canPublish) {
        throw new SitePermissionError("You do not have permission to publish this site.");
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

      return {
        site: serializeSiteDetail(unpublishedSite, resolvePermissions(unpublishedSite, input)),
      };
    },

    async archiveSite(input) {
      const site = await requireViewableSite(repository, input);
      const permissions = resolvePermissions(site, input);

      if (!permissions.canArchive) {
        throw new SitePermissionError();
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

      return {
        site: serializeSiteDetail(archivedSite, resolvePermissions(archivedSite, input)),
      };
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

      return {
        site: serializeSiteDetail(restored.site, resolvePermissions(restored.site, input)),
        version: serializeVersion(restored.version),
      };
    },
  };
}

function serializeSite(site: SiteRecord): SiteListItem {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    visibility: site.visibility,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    publishedAt: site.publishedAt?.toISOString() ?? null,
    archivedAt: site.archivedAt?.toISOString() ?? null,
  };
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
  const issues: SitePublishValidationIssue[] = [];

  if (draftContent.schemaVersion !== 2) {
    issues.push({
      path: [...pathPrefix, "schemaVersion"],
      message: "Draft content schema is not supported for publishing.",
    });
  }

  if (!draftContent.chrome.hero.title.trim()) {
    issues.push({
      path: [...pathPrefix, "chrome", "hero", "title"],
      message: "Site title is required before publishing.",
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

  const blockIds = new Set<string>();

  draftContent.blocks.forEach((block, index) => {
    if (blockIds.has(block.id)) {
      issues.push({
        path: [...pathPrefix, "blocks", index, "id"],
        message: `Block id must be unique: ${block.id}`,
      });
    }

    blockIds.add(block.id);
    issues.push(...validateDraftBlock(block, [...pathPrefix, "blocks", index]));
  });

  return issues;
}

function validateDraftBlock(
  block: SiteRecord["draftContent"]["blocks"][number],
  pathPrefix: Array<string | number>,
): SitePublishValidationIssue[] {
  const issues: SitePublishValidationIssue[] = [];

  if (!SUPPORTED_DRAFT_BLOCK_TYPES.has(block.type)) {
    return [
      {
        path: [...pathPrefix, "type"],
        message: `Unsupported block type: ${block.type}`,
      },
    ];
  }

  if (block.type === "title" || block.type === "heading") {
    const text = getNonEmptyStringField(block.fields, "text") ?? getNonEmptyStringField(block.fields, "title");

    if (!text) {
      issues.push({
        path: [...pathPrefix, "fields", "text"],
        message: "Heading blocks require text.",
      });
    }
  }

  if (block.type === "text") {
    const text = getNonEmptyStringField(block.fields, "text") ?? getNonEmptyStringField(block.fields, "body");

    if (!text) {
      issues.push({
        path: [...pathPrefix, "fields", "text"],
        message: "Text blocks require text.",
      });
    }
  }

  if (block.type === "cta" || block.type === "button" || block.type === "calendar") {
    if (!getNonEmptyStringField(block.fields, "label") && !getNonEmptyStringField(block.fields, "text")) {
      issues.push({
        path: [...pathPrefix, "fields", "label"],
        message: "Button blocks require a label.",
      });
    }

    if (!getNonEmptyStringField(block.fields, "href") && !getNonEmptyStringField(block.fields, "url")) {
      issues.push({
        path: [...pathPrefix, "fields", "href"],
        message: "Button blocks require an href.",
      });
    }
  }

  if ((block.type === "quote" || block.type === "testimonial") && !getNonEmptyStringField(block.fields, "quote")) {
    issues.push({
      path: [...pathPrefix, "fields", "quote"],
      message: "Quote blocks require quote text.",
    });
  }

  if ((block.type === "bullet-list" || block.type === "number-list") && !Array.isArray(block.fields.items)) {
    issues.push({
      path: [...pathPrefix, "fields", "items"],
      message: "List blocks require items.",
    });
  }

  if ((block.type === "accordion" || block.type === "icon-list" || block.type === "logo-grid") && !Array.isArray(block.fields.items) && !Array.isArray(block.fields.logos)) {
    issues.push({
      path: [...pathPrefix, "fields"],
      message: "This block requires an item array.",
    });
  }

  return issues;
}

function getNonEmptyStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
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
