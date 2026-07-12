import type {
  TrackingV2EventFeedItem,
  TrackingV2SessionEndReason,
  TrackingV2SessionSummary,
} from "@lightsite/tracking-schema"

const unavailableValue = "-"

export type TrackingDrawerRecipient = {
  company: string | null
  name: string
  website: string | null
}

export type TrackingSessionDrawerData = {
  device: string
  endReason: string
  endedAt: string | null
  id: string
  location: string
  name: string
  recipient: TrackingDrawerRecipient | null
  scrollDepth: string
  siteName: string
  startedAt: string
  totalDuration: string
}

export type TrackingEventDrawerData = {
  action: string
  details: string
  device: string
  elapsed: string
  element: string
  id: string
  location: string
  page: string
  recipient: TrackingDrawerRecipient | null
  sessionId: string | null
  siteName: string
  timestamp: string
  type: string
}

const sessionEndReasonLabels: Record<TrackingV2SessionEndReason, string> = {
  pagehide: "Left page",
  visibility_timeout: "Away too long",
  idle_timeout: "Inactive",
  max_duration: "Time limit reached",
  heartbeat_timeout: "Connection lost",
  server_expired: "Session expired",
  unknown: "Ended",
}

export function toSessionDrawerData(session: TrackingV2SessionSummary): TrackingSessionDrawerData {
  return {
    device: formatTrackingDevice(session.device),
    endReason: formatSessionEndReason(session.endReason),
    endedAt: session.endedAt,
    id: session.id,
    location: formatLocation(session.location),
    name: formatRecipient(session.recipient),
    recipient: toRecipient(session.recipient),
    scrollDepth: session.maxScrollDepthPercent === null
      ? unavailableValue
      : `${session.maxScrollDepthPercent}%`,
    siteName: session.site.name,
    startedAt: session.startedAt,
    totalDuration: formatDurationMs(session.durationMs ?? session.activeMs),
  }
}

export function formatSessionEndReason(reason: TrackingV2SessionEndReason | null) {
  return reason ? sessionEndReasonLabels[reason] : "In progress"
}

export function toEventDrawerData(event: TrackingV2EventFeedItem): TrackingEventDrawerData {
  const startedAt = event.session?.startedAt
  const elapsedMs = startedAt
    ? Math.max(0, Date.parse(event.occurredAt) - Date.parse(startedAt))
    : 0

  return {
    action: formatEventAction(event),
    details: formatEventDetails(event),
    device: formatTrackingDevice(event.session?.device ?? null),
    elapsed: formatDurationMs(elapsedMs),
    element: formatEventDetails(event),
    id: event.id,
    location: formatLocation(event.session?.location ?? null),
    page: event.tab?.label ?? "Overview",
    recipient: toRecipient(event.recipient),
    sessionId: event.sessionId,
    siteName: event.site.name,
    timestamp: event.occurredAt,
    type: formatEventType(event.type),
  }
}

function toRecipient(
  recipient: TrackingV2EventFeedItem["recipient"] | TrackingV2SessionSummary["recipient"]
): TrackingDrawerRecipient | null {
  if (!recipient) return null

  return {
    company: recipient.recipientCompany,
    name: recipient.recipientName ?? recipient.name,
    website: recipient.website,
  }
}

function formatRecipient(recipient: TrackingV2SessionSummary["recipient"]) {
  if (!recipient) return "Default public link"
  const name = recipient.recipientName ?? recipient.name
  return recipient.recipientCompany ? `${name} @ ${recipient.recipientCompany}` : name
}

function formatEventAction(event: TrackingV2EventFeedItem) {
  const labels: Record<TrackingV2EventFeedItem["type"], string> = {
    button_click: "Button clicked",
    link_click: "Link clicked",
    site_visit: "Site opened",
    slack_share: "Shared on Slack",
    tab_switch: "Tab switched",
    webhook_send: "Webhook sent",
  }

  return labels[event.type]
}

function formatEventType(type: TrackingV2EventFeedItem["type"]) {
  const value = type.replaceAll("_", " ")
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatEventDetails(event: TrackingV2EventFeedItem) {
  const detail = event.element?.label ?? event.tab?.label ?? event.webhook?.url
  if (!detail) {
    const fallback = event.type === "site_visit"
      ? formatLocation(event.session?.location ?? null)
      : unavailableValue

    return fallback
  }

  if (detail.trim().toLowerCase() === "unknown") return unavailableValue

  return event.webhook?.url ? detail : `“${detail}”`
}

export function formatTrackingDevice(device: TrackingV2SessionSummary["device"] | null) {
  if (!device) return unavailableValue

  const type = device.type?.trim().toLowerCase()
  const os = device.os?.trim().toLowerCase()
  const normalizedOs = os === "unknown" || os === "other" ? null : os

  const labels: Record<string, string> = {
    "desktop:linux": "Linux computer",
    "desktop:macos": "Mac computer",
    "desktop:windows": "Windows PC",
    "mobile:android": "Android phone",
    "mobile:ios": "iPhone",
    "tablet:android": "Android tablet",
    "tablet:ios": "iPad",
  }
  const exactLabel = labels[`${type}:${normalizedOs}`]
  if (exactLabel) return exactLabel

  if (type === "desktop") return "Desktop computer"
  if (type === "mobile") return "Mobile device"
  if (type === "tablet") return "Tablet"
  if (normalizedOs === "macos") return "Mac computer"
  if (normalizedOs === "windows") return "Windows PC"
  if (normalizedOs === "linux") return "Linux computer"
  if (normalizedOs === "ios") return "Apple device"
  if (normalizedOs === "android") return "Android device"

  return unavailableValue
}

function formatLocation(location: TrackingV2SessionSummary["location"] | null) {
  if (!location) return unavailableValue
  return [location.city, location.region].filter(Boolean).join(", ")
    || location.countryCode
    || unavailableValue
}

function formatDurationMs(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
