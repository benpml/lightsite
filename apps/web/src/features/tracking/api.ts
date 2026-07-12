import {
  trackingV2RecordingChunkSchema,
  trackingV2RecordingManifestResponseSchema,
  trackingV2EventsResponseSchema,
  trackingV2SiteTrackingSettingsResponseSchema,
  trackingV2SessionResponseSchema,
  trackingV2SessionsResponseSchema,
  trackingV2UpdateSiteSettingsRequestSchema,
  type TrackingV2EventSource,
  type TrackingV2EventType,
  type TrackingV2SessionRecordingStatusFilter,
  type TrackingV2SessionState,
  type TrackingV2UpdateSiteSettingsRequest,
} from "@lightsite/tracking-schema"

import { apiRequest } from "@/lib/api/client"

export type TrackingV2BaseFilters = {
  from?: string
  recipientId?: string
  siteId?: string
  to?: string
}

export type TrackingV2EventFilters = TrackingV2BaseFilters & {
  cursor?: string
  limit?: number
  sessionId?: string
  source?: TrackingV2EventSource
  type?: TrackingV2EventType
}

export type TrackingV2SessionFilters = TrackingV2BaseFilters & {
  cursor?: string
  limit?: number
  recordingStatus?: TrackingV2SessionRecordingStatusFilter
  state?: TrackingV2SessionState
}

export async function getTrackingDashboardActivity(
  workspaceId: string,
  filters: TrackingV2BaseFilters,
  signal?: AbortSignal,
) {
  const [eventsResponse, sessionsResponse] = await Promise.all([
    listTrackingV2Events(workspaceId, { ...filters, limit: 100 }, signal),
    listTrackingV2Sessions(workspaceId, { ...filters, limit: 100 }, signal),
  ])

  return {
    eventNextCursor: eventsResponse.nextCursor,
    events: eventsResponse.events,
    requestIds: {
      events: eventsResponse.requestId,
      sessions: sessionsResponse.requestId,
    },
    sessionNextCursor: sessionsResponse.nextCursor,
    sessions: sessionsResponse.sessions,
  }
}

export function listTrackingV2Events(
  workspaceId: string,
  filters: TrackingV2EventFilters,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/events?${toSearchParams(filters)}`, {
    responseSchema: trackingV2EventsResponseSchema,
    signal,
  })
}

export function listTrackingV2Sessions(
  workspaceId: string,
  filters: TrackingV2SessionFilters,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/sessions?${toSearchParams(filters)}`, {
    responseSchema: trackingV2SessionsResponseSchema,
    signal,
  })
}

export function getTrackingV2Session(
  workspaceId: string,
  sessionId: string,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/sessions/${encodeURIComponent(sessionId)}`, {
    responseSchema: trackingV2SessionResponseSchema,
    signal,
  })
}

export function getTrackingV2RecordingManifest(
  workspaceId: string,
  sessionId: string,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/sessions/${encodeURIComponent(sessionId)}/recording`, {
    responseSchema: trackingV2RecordingManifestResponseSchema,
    signal,
  })
}

export function getTrackingV2RecordingChunk(
  workspaceId: string,
  recordingId: string,
  sequence: number,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/recordings/${encodeURIComponent(recordingId)}/chunks/${sequence}`, {
    responseSchema: trackingV2RecordingChunkSchema,
    signal,
  })
}

export function getTrackingV2SiteSettings(
  workspaceId: string,
  siteId: string,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/sites/${encodeURIComponent(siteId)}/settings`, {
    responseSchema: trackingV2SiteTrackingSettingsResponseSchema,
    signal,
  })
}

export function updateTrackingV2SiteSettings(
  workspaceId: string,
  siteId: string,
  input: TrackingV2UpdateSiteSettingsRequest,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/v2/sites/${encodeURIComponent(siteId)}/settings`, {
    method: "PUT",
    body: trackingV2UpdateSiteSettingsRequestSchema.parse(input),
    responseSchema: trackingV2SiteTrackingSettingsResponseSchema,
  })
}

function toSearchParams(filters: Record<string, number | string | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value))
    }
  }

  return params.toString()
}
