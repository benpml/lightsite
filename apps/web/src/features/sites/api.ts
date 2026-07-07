import type {
  CreateSiteRequest,
  CreateSiteResponse,
  DuplicateSiteResponse,
  ListSitesResponse,
  SiteDetailResponse,
  SiteListItem,
  SiteStatus,
  SiteVisibility,
  UpdateSiteRequest,
} from "@lightsite/contracts"

import { apiRequest } from "@/lib/api/client"

export function listSites(signal?: AbortSignal) {
  return apiRequest("/api/sites", {
    responseSchema: listSitesResponseSchema,
    signal,
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

const siteStatuses = new Set<SiteStatus>(["draft", "published", "archived"])
const siteVisibilities = new Set<SiteVisibility>(["private", "team"])

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
    updatedAt: typeof object.updatedAt === "string" ? object.updatedAt : null,
    createdAt: typeof object.createdAt === "string" ? object.createdAt : null,
    publishedAt: typeof object.publishedAt === "string" ? object.publishedAt : null,
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
