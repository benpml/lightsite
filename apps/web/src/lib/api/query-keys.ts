type SiteListFilters = {
  query?: string
  status?: string
}

type TrackingFilters = {
  query?: string
  source?: string
  type?: string
  siteId?: string
  recipientId?: string
  sessionId?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export const queryKeys = {
  me: () => ["me"] as const,
  workspaces: () => ["workspaces"] as const,
  workspace: (workspaceId: string) => ["workspace", workspaceId] as const,
  billing: (workspaceId: string) => ["billing", workspaceId] as const,
  workspaceSlugAvailability: (slug: string) => ["workspaceSlugAvailability", slug] as const,
  workspaceLogoPreview: (website: string) => ["workspaceLogoPreview", website] as const,
  members: (workspaceId: string) => ["members", workspaceId] as const,
  sites: (workspaceId: string, filters: SiteListFilters = {}) =>
    ["sites", workspaceId, normalizeFilter(filters)] as const,
  site: (workspaceId: string, siteId: string) => ["site", workspaceId, siteId] as const,
  siteContent: (workspaceId: string, siteId: string) =>
    ["siteContent", workspaceId, siteId] as const,
  siteVariants: (workspaceId: string, siteId: string) =>
    ["siteVariants", workspaceId, siteId] as const,
  trackingEvents: (workspaceId: string, filters: TrackingFilters = {}) =>
    ["trackingEvents", workspaceId, normalizeFilter(filters)] as const,
  trackingSessionEvents: (workspaceId: string, sessionId: string) =>
    ["trackingSessionEvents", workspaceId, sessionId] as const,
  trackingSession: (workspaceId: string, sessionId: string) =>
    ["trackingSession", workspaceId, sessionId] as const,
  trackingRecordingManifest: (workspaceId: string, sessionId: string) =>
    ["trackingRecordingManifest", workspaceId, sessionId] as const,
  trackingRecordingChunks: (workspaceId: string, recordingId: string, sequences: string) =>
    ["trackingRecordingChunks", workspaceId, recordingId, sequences] as const,
  trackingDashboard: (workspaceId: string, filters: Omit<TrackingFilters, "query" | "type" | "source" | "cursor" | "limit"> = {}) =>
    ["trackingDashboard", workspaceId, normalizeFilter(filters)] as const,
  trackingSiteRecipientActivity: (workspaceId: string, siteId: string) =>
    ["trackingSiteRecipientActivity", workspaceId, siteId] as const,
  trackingSiteSettings: (workspaceId: string, siteId: string) =>
    ["trackingSiteSettings", workspaceId, siteId] as const,
  publicSite: (workspaceSlug: string, siteSlug: string, variantSlug: string | null = null) =>
    ["publicSite", workspaceSlug, siteSlug, variantSlug] as const,
}

function normalizeFilter<TFilter extends Record<string, number | string | undefined>>(filter: TFilter) {
  return Object.fromEntries(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}
