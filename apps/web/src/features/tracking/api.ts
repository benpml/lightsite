import {
  trackingEventsResponseSchema,
  trackingSummaryResponseSchema,
  type TrackingClassificationFilter,
  type TrackingEventType,
} from "@lightsite/contracts"

import { apiRequest } from "@/lib/api/client"

export type TrackingEventFilters = {
  siteId?: string
  variantId?: string
  type?: TrackingEventType
  classification?: TrackingClassificationFilter
  query?: string
  from?: string
  to?: string
  cursor?: string
}

export function listTrackingEvents(
  workspaceId: string,
  filters: TrackingEventFilters,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/events?${toSearchParams(filters)}`, {
    responseSchema: trackingEventsResponseSchema,
    signal,
  })
}

export function getTrackingSummary(
  workspaceId: string,
  filters: Omit<TrackingEventFilters, "type" | "classification" | "query" | "cursor">,
  signal?: AbortSignal,
) {
  return apiRequest(`/api/workspaces/${workspaceId}/tracking/summary?${toSearchParams(filters)}`, {
    responseSchema: trackingSummaryResponseSchema,
    signal,
  })
}

function toSearchParams(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }

  return params.toString()
}
