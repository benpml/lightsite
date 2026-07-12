import {
  siteContentSchema,
  batchUpsertSiteVariantsRequestSchema,
  batchUpsertSiteVariantsResponseSchema,
  listSiteVariantsResponseSchema,
  type BatchUpsertSiteVariantsRequest,
  type CreateSiteRequest,
  type CreateSiteResponse,
  type DuplicateSiteResponse,
  type ListSitesResponse,
  type PublishSiteResponse,
  type SiteDetailResponse,
  type SiteContentResponse,
  type SiteVersionKind,
  type SiteVersionSummary,
  type SiteListItem,
  type SiteStatus,
  type SiteVisibility,
  type UpdateSiteContentRequest,
  type UpdateSiteContentResponse,
  type UpdateSiteRequest,
} from "@lightsite/contracts"

import { apiRequest } from "@/lib/api/client"

export function listSites(signal?: AbortSignal) {
  return apiRequest("/api/sites", {
    responseSchema: listSitesResponseSchema,
    signal,
  })
}

export function getSite(siteId: string, signal?: AbortSignal) {
  return apiRequest(`/api/sites/${siteId}`, {
    responseSchema: siteDetailResponseSchema,
    signal,
  })
}

export function getSiteContent(siteId: string, signal?: AbortSignal) {
  return apiRequest(`/api/sites/${siteId}/content`, {
    responseSchema: siteContentResponseSchema,
    signal,
  })
}

export function listSiteVariants(siteId: string, signal?: AbortSignal) {
  return apiRequest(`/api/sites/${siteId}/variants`, {
    responseSchema: listSiteVariantsResponseSchema,
    signal,
  })
}

export function batchUpsertSiteVariants(
  siteId: string,
  input: BatchUpsertSiteVariantsRequest,
) {
  return apiRequest(`/api/sites/${siteId}/variants/batch`, {
    method: "POST",
    body: batchUpsertSiteVariantsRequestSchema.parse(input),
    responseSchema: batchUpsertSiteVariantsResponseSchema,
  })
}

export function deleteSiteVariant(siteId: string, variantId: string) {
  return apiRequest(`/api/sites/${siteId}/variants/${encodeURIComponent(variantId)}`, {
    method: "DELETE",
  })
}

export function createSite(input: CreateSiteRequest) {
  return apiRequest("/api/sites", {
    method: "POST",
    body: normalizeCreateSiteRequest(input),
    responseSchema: createSiteResponseSchema,
  })
}

export function updateSite(siteId: string, input: UpdateSiteRequest) {
  return apiRequest(`/api/sites/${siteId}`, {
    method: "PATCH",
    body: normalizeUpdateSiteRequest(input),
    responseSchema: siteDetailResponseSchema,
  })
}

export function updateSiteContent(siteId: string, input: UpdateSiteContentRequest) {
  return apiRequest(`/api/sites/${siteId}/content`, {
    method: "PUT",
    body: normalizeUpdateSiteContentRequest(input),
    responseSchema: updateSiteContentResponseSchema,
  })
}

export function publishSite(siteId: string) {
  return apiRequest(`/api/sites/${siteId}/publish`, {
    method: "POST",
    responseSchema: publishSiteResponseSchema,
  })
}

export function duplicateSite(siteId: string) {
  return apiRequest(`/api/sites/${siteId}/duplicate`, {
    method: "POST",
    responseSchema: duplicateSiteResponseSchema,
  })
}

export function archiveSite(siteId: string) {
  return apiRequest(`/api/sites/${siteId}/archive`, {
    method: "POST",
    responseSchema: siteDetailResponseSchema,
  })
}

export function deleteSite(siteId: string) {
  return apiRequest(`/api/sites/${siteId}`, {
    method: "DELETE",
  })
}

const siteStatuses = new Set<SiteStatus>(["draft", "published", "archived"])
const siteVisibilities = new Set<SiteVisibility>(["private", "team"])
const siteVersionKinds = new Set<SiteVersionKind>([
  "initial",
  "autosave",
  "publish",
  "rollback",
  "migration",
])

const listSitesResponseSchema = {
  parse(value: unknown): ListSitesResponse {
    const object = asRecord(value)
    const sites = Array.isArray(object.sites) ? object.sites.map(parseSiteListItem) : null

    if (!sites || typeof object.requestId !== "string") {
      throw new Error("Invalid sites response.")
    }

    return {
      sites,
      nextCursor: typeof object.nextCursor === "string" ? object.nextCursor : null,
      requestId: object.requestId,
    }
  },
}

const createSiteResponseSchema = {
  parse(value: unknown): CreateSiteResponse {
    const object = asRecord(value)
    const site = parseSiteListItem(object.site)

    if (typeof object.requestId !== "string") {
      throw new Error("Invalid create site response.")
    }

    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
      },
      requestId: object.requestId,
    }
  },
}

const duplicateSiteResponseSchema = {
  parse(value: unknown): DuplicateSiteResponse {
    return createSiteResponseSchema.parse(value)
  },
}

const siteDetailResponseSchema = {
  parse(value: unknown): SiteDetailResponse {
    const object = asRecord(value)
    const site = parseSiteDetail(object.site)

    if (typeof object.requestId !== "string") {
      throw new Error("Invalid site detail response.")
    }

    return {
      site,
      requestId: object.requestId,
    }
  },
}

const siteContentResponseSchema = {
  parse(value: unknown): SiteContentResponse {
    const object = asRecord(value)

    if (
      typeof object.draftRevision !== "number" ||
      !Number.isInteger(object.draftRevision) ||
      object.draftRevision <= 0 ||
      !isRecord(object.draftContent) ||
      typeof object.requestId !== "string"
    ) {
      throw new Error("Invalid site content response.")
    }

    return {
      draftRevision: object.draftRevision,
      draftContent: object.draftContent as SiteContentResponse["draftContent"],
      requestId: object.requestId,
    }
  },
}

const updateSiteContentResponseSchema = {
  parse(value: unknown): UpdateSiteContentResponse {
    const object = asRecord(value)
    const site = parseSiteListItem(object.site)

    if (
      typeof object.draftRevision !== "number" ||
      !Number.isInteger(object.draftRevision) ||
      object.draftRevision <= 0 ||
      !isRecord(object.draftContent) ||
      typeof object.requestId !== "string"
    ) {
      throw new Error("Invalid update site content response.")
    }

    return {
      site,
      draftRevision: object.draftRevision,
      draftContent: object.draftContent as UpdateSiteContentResponse["draftContent"],
      requestId: object.requestId,
    }
  },
}

const publishSiteResponseSchema = {
  parse(value: unknown): PublishSiteResponse {
    const object = asRecord(value)
    const site = parseSiteDetail(object.site)
    const version = parseSiteVersionSummary(object.version)

    if (typeof object.requestId !== "string") {
      throw new Error("Invalid publish site response.")
    }

    return {
      site,
      version,
      requestId: object.requestId,
    }
  },
}

function normalizeCreateSiteRequest(input: CreateSiteRequest): CreateSiteRequest {
  const rawName = typeof input.name === "string" ? input.name : ""
  const name = rawName.trim() || "Untitled Lightsite"

  return {
    name,
    ...(input.slug ? { slug: input.slug.trim() } : {}),
  }
}

function normalizeUpdateSiteRequest(input: UpdateSiteRequest): UpdateSiteRequest {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
  }
}

function normalizeUpdateSiteContentRequest(
  input: UpdateSiteContentRequest
): UpdateSiteContentRequest {
  return {
    ...(input.expectedDraftRevision !== undefined
      ? { expectedDraftRevision: input.expectedDraftRevision }
      : {}),
    draftContent: input.draftContent,
    ...(input.changeSummary ? { changeSummary: input.changeSummary.trim() } : {}),
  }
}

function parseSiteListItem(value: unknown): SiteListItem {
  const object = asRecord(value)

  if (
    typeof object.id !== "string" ||
    typeof object.name !== "string" ||
    typeof object.slug !== "string" ||
    typeof object.status !== "string" ||
    !siteStatuses.has(object.status as SiteStatus)
  ) {
    throw new Error("Invalid site.")
  }

  return {
    id: object.id,
    name: object.name,
    slug: object.slug,
    status: object.status as SiteStatus,
    recipientCount: typeof object.recipientCount === "number" ? object.recipientCount : 0,
    thumbnail: parseSiteThumbnail(object.thumbnail),
    updatedAt: typeof object.updatedAt === "string" ? object.updatedAt : null,
    createdAt: typeof object.createdAt === "string" ? object.createdAt : null,
    publishedAt: typeof object.publishedAt === "string" ? object.publishedAt : null,
  }
}

function parseSiteThumbnail(value: unknown): SiteListItem["thumbnail"] {
  if (!isRecord(value)) {
    return undefined
  }

  const content = siteContentSchema.safeParse(value.content)

  return content.success ? { content: content.data } : undefined
}

function parseSiteVersionSummary(value: unknown): SiteVersionSummary {
  const object = asRecord(value)

  if (
    typeof object.id !== "string" ||
    typeof object.siteId !== "string" ||
    typeof object.versionNumber !== "number" ||
    !Number.isInteger(object.versionNumber) ||
    object.versionNumber <= 0 ||
    typeof object.kind !== "string" ||
    !siteVersionKinds.has(object.kind as SiteVersionKind) ||
    (typeof object.label !== "string" && object.label !== null) ||
    (typeof object.createdByUserId !== "string" && object.createdByUserId !== null) ||
    typeof object.createdAt !== "string" ||
    (typeof object.publishedAt !== "string" && object.publishedAt !== null)
  ) {
    throw new Error("Invalid site version summary.")
  }

  return {
    id: object.id,
    siteId: object.siteId,
    versionNumber: object.versionNumber,
    kind: object.kind as SiteVersionKind,
    label: object.label,
    createdByUserId: object.createdByUserId,
    createdAt: object.createdAt,
    publishedAt: object.publishedAt,
  }
}

function parseSiteDetail(value: unknown): SiteDetailResponse["site"] {
  const object = asRecord(value)
  const listItem = parseSiteListItem(value)
  const permissions = asRecord(object.permissions)

  if (
    typeof object.visibility !== "string" ||
    !siteVisibilities.has(object.visibility as SiteVisibility) ||
    typeof object.createdAt !== "string" ||
    typeof object.updatedAt !== "string" ||
    (typeof object.publishedAt !== "string" && object.publishedAt !== null) ||
    (typeof object.archivedAt !== "string" && object.archivedAt !== null)
  ) {
    throw new Error("Invalid site detail.")
  }

  return {
    ...listItem,
    visibility: object.visibility as SiteVisibility,
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
    publishedAt: object.publishedAt,
    archivedAt: object.archivedAt,
    permissions: {
      canView: permissions.canView === true,
      canEdit: permissions.canEdit === true,
      canDuplicate: permissions.canDuplicate === true,
      canPublish: permissions.canPublish === true,
      canUnpublish: permissions.canUnpublish === true,
      canArchive: permissions.canArchive === true,
      canRestore: permissions.canRestore === true,
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object.")
  }

  return value as Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
