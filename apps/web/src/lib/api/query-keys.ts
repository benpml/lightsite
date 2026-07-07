type SiteListFilters = {
  query?: string
  status?: string
}

type TrackingFilters = {
  query?: string
  type?: string
  siteId?: string
  variantId?: string
  classification?: string
  from?: string
  to?: string
  cursor?: string
}

export const queryKeys = {
  me: () => ["me"] as const,
  workspaces: () => ["workspaces"] as const,
  workspace: (workspaceId: string) => ["workspace", workspaceId] as const,
  workspaceSlugAvailability: (slug: string) => ["workspaceSlugAvailability", slug] as const,
  workspaceLogoPreview: (website: string) => ["workspaceLogoPreview", website] as const,
  members: (workspaceId: string) => ["members", workspaceId] as const,
  sites: (workspaceId: string, filters: SiteListFilters = {}) =>
    ["sites", workspaceId, normalizeFilter(filters)] as const,
  site: (workspaceId: string, siteId: string) => ["site", workspaceId, siteId] as const,
  trackingEvents: (workspaceId: string, filters: TrackingFilters = {}) =>
    ["trackingEvents", workspaceId, normalizeFilter(filters)] as const,
  trackingSummary: (workspaceId: string, filters: Omit<TrackingFilters, "query" | "type" | "classification" | "cursor"> = {}) =>
    ["trackingSummary", workspaceId, normalizeFilter(filters)] as const,
  publicSite: (workspaceSlug: string, siteSlug: string, variantSlug: string | null = null) =>
    ["publicSite", workspaceSlug, siteSlug, variantSlug] as const,
}

function normalizeFilter<TFilter extends Record<string, string | undefined>>(filter: TFilter) {
  return Object.fromEntries(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}
