import type {
  TrackingV2EventFeedItem,
  TrackingV2SessionSummary,
} from "@lightsite/tracking-schema"

export type TrackingDashboardMetrics = {
  averageActiveMs: number
  clicks: number
  recordingSessions: number
  sessions: number
  slackShares: number
  visits: number
}

export type TrackingClickedElementSummary = {
  clickCount: number
  detail: string
  key: string
  kind: string
  label: string
}

export type TrackingRecipientActivity = {
  clicks: number
  detail: string
  key: string
  lastSeenAt: string
  name: string
  recipientId: string | null
  sessions: number
  siteName: string
  slackShares: number
  visits: number
}

export type TrackingRecipientOption = {
  detail: string
  id: string
  label: string
}

export type TrackingDashboardSummary = {
  metrics: TrackingDashboardMetrics
  recipientActivity: TrackingRecipientActivity[]
  recipientOptions: TrackingRecipientOption[]
  topClickedElements: TrackingClickedElementSummary[]
}

export function buildTrackingDashboardSummary({
  events,
  sessions,
}: {
  events: TrackingV2EventFeedItem[]
  sessions: TrackingV2SessionSummary[]
}): TrackingDashboardSummary {
  const clickedElements = new Map<string, TrackingClickedElementSummary>()
  const recipientActivity = new Map<string, TrackingRecipientActivity>()
  const recipientOptions = new Map<string, TrackingRecipientOption>()
  let clicks = 0
  let slackShares = 0
  let visits = 0

  for (const event of events) {
    if (event.type === "site_visit") {
      visits += 1
    }

    if (event.type === "slack_share") {
      slackShares += 1
    }

    if (isClickEvent(event)) {
      clicks += 1
      addClickedElement(clickedElements, event)
    }

    addRecipientEventActivity(recipientActivity, event)
    addRecipientOption(recipientOptions, event)
  }

  for (const session of sessions) {
    addRecipientSessionActivity(recipientActivity, session)
    addRecipientOption(recipientOptions, session)
  }

  return {
    metrics: {
      averageActiveMs: average(sessions.map((session) => session.activeMs)),
      clicks,
      recordingSessions: sessions.filter((session) => session.recording.available).length,
      sessions: sessions.length,
      slackShares,
      visits,
    },
    recipientActivity: [...recipientActivity.values()]
      .sort(sortRecipientActivity)
      .slice(0, 8),
    recipientOptions: [...recipientOptions.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
    topClickedElements: [...clickedElements.values()]
      .sort((left, right) =>
        right.clickCount - left.clickCount || left.label.localeCompare(right.label)
      )
      .slice(0, 8),
  }
}

export function dedupeTrackingV2Events(events: TrackingV2EventFeedItem[]) {
  const seen = new Set<string>()

  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false
    }

    seen.add(event.id)
    return true
  })
}

export function dedupeTrackingV2Sessions(sessions: TrackingV2SessionSummary[]) {
  const seen = new Set<string>()

  return sessions.filter((session) => {
    if (seen.has(session.id)) {
      return false
    }

    seen.add(session.id)
    return true
  })
}

export function filterTrackingV2EventsByQuery(
  events: TrackingV2EventFeedItem[],
  query: string,
) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (terms.length === 0) {
    return events
  }

  return events.filter((event) => {
    const searchable = [
      event.type,
      event.source,
      event.eventId,
      event.site.name,
      event.site.slug,
      event.recipient?.name,
      event.recipient?.slug,
      event.recipient?.recipientName,
      event.recipient?.recipientCompany,
      event.sessionId,
      event.tab?.label,
      event.element?.id,
      event.element?.kind,
      event.element?.label,
      event.element?.href,
      event.webhook?.id,
      event.webhook?.url,
      event.session?.device.type,
      event.session?.device.os,
      event.session?.device.browser,
      event.session?.location.city,
      event.session?.location.region,
      event.session?.location.countryCode,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase()

    return terms.every((term) => searchable.includes(term))
  })
}

function addClickedElement(
  clickedElements: Map<string, TrackingClickedElementSummary>,
  event: TrackingV2EventFeedItem,
) {
  const element = event.element

  if (!element) {
    return
  }

  const key = `${element.kind}:${element.id ?? element.href ?? element.label}`
  const existing = clickedElements.get(key)

  if (existing) {
    existing.clickCount += 1
    return
  }

  clickedElements.set(key, {
    clickCount: 1,
    detail: element.href ?? event.site.name,
    key,
    kind: element.kind,
    label: element.label,
  })
}

function addRecipientEventActivity(
  activityByKey: Map<string, TrackingRecipientActivity>,
  event: TrackingV2EventFeedItem,
) {
  const activity = getOrCreateRecipientActivity(activityByKey, {
    occurredAt: event.occurredAt,
    recipient: event.recipient,
    site: event.site,
  })

  if (event.type === "site_visit") {
    activity.visits += 1
  }

  if (isClickEvent(event)) {
    activity.clicks += 1
  }

  if (event.type === "slack_share") {
    activity.slackShares += 1
  }

  activity.lastSeenAt = maxIsoTimestamp(activity.lastSeenAt, event.occurredAt)
}

function addRecipientSessionActivity(
  activityByKey: Map<string, TrackingRecipientActivity>,
  session: TrackingV2SessionSummary,
) {
  const activity = getOrCreateRecipientActivity(activityByKey, {
    occurredAt: session.lastSeenAt,
    recipient: session.recipient,
    site: session.site,
  })

  activity.sessions += 1
  activity.lastSeenAt = maxIsoTimestamp(activity.lastSeenAt, session.lastSeenAt)
}

function addRecipientOption(
  optionsById: Map<string, TrackingRecipientOption>,
  item: TrackingV2EventFeedItem | TrackingV2SessionSummary,
) {
  if (!item.recipient || optionsById.has(item.recipient.id)) {
    return
  }

  optionsById.set(item.recipient.id, {
    detail: item.recipient.recipientCompany ?? item.site.name,
    id: item.recipient.id,
    label: item.recipient.recipientName ?? item.recipient.name,
  })
}

function getOrCreateRecipientActivity(
  activityByKey: Map<string, TrackingRecipientActivity>,
  input: Pick<TrackingV2EventFeedItem, "recipient" | "site"> & {
    occurredAt: string
  },
) {
  const identity = getRecipientIdentity(input)
  const existing = activityByKey.get(identity.key)

  if (existing) {
    return existing
  }

  const activity: TrackingRecipientActivity = {
    clicks: 0,
    detail: identity.detail,
    key: identity.key,
    lastSeenAt: input.occurredAt,
    name: identity.name,
    recipientId: identity.recipientId,
    sessions: 0,
    siteName: input.site.name,
    slackShares: 0,
    visits: 0,
  }

  activityByKey.set(activity.key, activity)
  return activity
}

function getRecipientIdentity(input: Pick<TrackingV2EventFeedItem, "recipient" | "site">) {
  if (!input.recipient) {
    return {
      detail: input.site.name,
      key: `site:${input.site.id}:default`,
      name: "Default public link",
      recipientId: null,
    }
  }

  return {
    detail: input.recipient.recipientCompany ?? input.site.name,
    key: `recipient:${input.recipient.id}`,
    name: input.recipient.recipientName ?? input.recipient.name,
    recipientId: input.recipient.id,
  }
}

function isClickEvent(event: TrackingV2EventFeedItem) {
  return event.type === "button_click" || event.type === "link_click"
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function maxIsoTimestamp(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right
}

function sortRecipientActivity(
  left: TrackingRecipientActivity,
  right: TrackingRecipientActivity,
) {
  return (
    Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt) ||
    right.visits - left.visits ||
    right.clicks - left.clicks ||
    left.name.localeCompare(right.name)
  )
}
