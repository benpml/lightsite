import { describe, expect, it } from "vitest"
import type {
  TrackingV2EventFeedItem,
  TrackingV2RecordingChunk,
  TrackingV2RecordingManifestResponse,
  TrackingV2SessionSummary,
} from "@lightsite/tracking-schema"

import {
  buildTrackingDashboardSummary,
  dedupeTrackingV2Events,
  dedupeTrackingV2Sessions,
  filterTrackingV2EventsByQuery,
} from "./model"
import {
  RRWEB_FULL_SNAPSHOT_EVENT_TYPE,
  buildTrackingRrwebReplay,
} from "./recording-replay-events"

const site = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Launch Plan",
  slug: "launch-plan",
}

const recipient = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Maya at Linear",
  recipientCompany: "Linear",
  recipientName: "Maya",
  slug: "linear-maya",
  website: "linear.app",
}

const device = {
  browser: "Chrome",
  os: "macOS",
  type: "desktop",
}

const location = {
  city: "Tampa",
  countryCode: "US",
  region: "FL",
}

describe("tracking v2 dashboard model", () => {
  it("builds recent metrics, click rankings, and recipient activity", () => {
    const events = [
      trackingEvent({
        id: "33333333-3333-4333-8333-333333333331",
        type: "site_visit",
      }),
      trackingEvent({
        element: {
          href: "https://linear.app/pricing",
          id: "sidebar-pricing",
          kind: "sidebar_link",
          label: "Pricing",
        },
        id: "33333333-3333-4333-8333-333333333332",
        type: "link_click",
      }),
      trackingEvent({
        element: {
          href: "https://linear.app/pricing",
          id: "sidebar-pricing",
          kind: "sidebar_link",
          label: "Pricing",
        },
        id: "33333333-3333-4333-8333-333333333333",
        type: "link_click",
      }),
      trackingEvent({
        id: "33333333-3333-4333-8333-333333333334",
        session: null,
        sessionId: null,
        source: "slack_og_image",
        type: "slack_share",
      }),
    ]
    const sessions = [
      trackingSession({
        activeMs: 120_000,
        recording: {
          available: true,
          durationMs: 45_000,
          status: "available",
        },
      }),
    ]

    const summary = buildTrackingDashboardSummary({ events, sessions })

    expect(summary.metrics).toEqual({
      averageActiveMs: 120_000,
      clicks: 2,
      recordingSessions: 1,
      sessions: 1,
      slackShares: 1,
      visits: 1,
    })
    expect(summary.topClickedElements).toEqual([
      {
        clickCount: 2,
        detail: "https://linear.app/pricing",
        key: "sidebar_link:sidebar-pricing",
        kind: "sidebar_link",
        label: "Pricing",
      },
    ])
    expect(summary.recipientActivity[0]).toMatchObject({
      clicks: 2,
      detail: "Linear",
      name: "Maya",
      sessions: 1,
      slackShares: 1,
      visits: 1,
    })
    expect(summary.recipientOptions).toEqual([
      {
        detail: "Linear",
        id: recipient.id,
        label: "Maya",
      },
    ])
  })

  it("filters events by recipient, element, session, device, and location text", () => {
    const pricingClick = trackingEvent({
      element: {
        href: "https://linear.app/pricing",
        id: "sidebar-pricing",
        kind: "sidebar_link",
        label: "Pricing",
      },
      id: "33333333-3333-4333-8333-333333333335",
      type: "link_click",
    })
    const visit = trackingEvent({
      id: "33333333-3333-4333-8333-333333333336",
      type: "site_visit",
    })

    expect(filterTrackingV2EventsByQuery([pricingClick, visit], "linear pricing")).toEqual([
      pricingClick,
    ])
    expect(filterTrackingV2EventsByQuery([pricingClick, visit], "tampa chrome")).toEqual([
      pricingClick,
      visit,
    ])
  })

  it("dedupes event and session pages by stable ids", () => {
    const event = trackingEvent({
      id: "33333333-3333-4333-8333-333333333337",
    })
    const session = trackingSession({
      id: "session_0001",
    })

    expect(dedupeTrackingV2Events([event, event])).toEqual([event])
    expect(dedupeTrackingV2Sessions([session, session])).toEqual([session])
  })
})

describe("tracking v2 rrweb replay events", () => {
  it("builds sorted rrweb events from recording chunks", () => {
    const replay = buildTrackingRrwebReplay({
      chunks: [
        recordingChunk({
          events: [
            rrwebEvent(3, "2026-07-09T15:00:02.000Z", {
              source: 2,
              type: 2,
            }),
          ],
          sequence: 1,
        }),
        recordingChunk({
          events: [
            rrwebEvent(4, "2026-07-09T15:00:00.000Z", {
              height: 900,
              href: "https://example.com/launch-plan",
              width: 1440,
            }),
            rrwebEvent(RRWEB_FULL_SNAPSHOT_EVENT_TYPE, "2026-07-09T15:00:01.000Z", {
              initialOffset: {
                left: 0,
                top: 0,
              },
              node: {
                childNodes: [],
                id: 1,
                type: 0,
              },
            }),
          ],
          sequence: 0,
        }),
      ],
      manifest: recordingManifest({
        eventCount: 3,
      }),
    })

    expect(replay.eventCount).toBe(3)
    expect(replay.hasFullSnapshot).toBe(true)
    expect(replay.durationMs).toBe(2_000)
    expect(replay.initialOffsetMs).toBe(1_001)
    expect(replay.events.map((event) => event.type)).toEqual([4, 2, 3])
  })

  it("does not stretch an idle replay to the recording manifest duration", () => {
    const replay = buildTrackingRrwebReplay({
      chunks: [
        recordingChunk({
          events: [
            rrwebEvent(4, "2026-07-09T15:00:00.000Z", { height: 768, width: 1366 }),
            rrwebEvent(RRWEB_FULL_SNAPSHOT_EVENT_TYPE, "2026-07-09T15:00:00.000Z", {}),
          ],
        }),
      ],
      manifest: recordingManifest({
        durationMs: 5_000,
        eventCount: 2,
      }),
    })

    expect(replay.durationMs).toBe(0)
    expect(replay.hasFullSnapshot).toBe(true)
    expect(replay.initialOffsetMs).toBe(1)
  })
})

function trackingEvent(
  overrides: Partial<TrackingV2EventFeedItem> = {},
): TrackingV2EventFeedItem {
  const sessionId = overrides.sessionId === undefined ? "session_0001" : overrides.sessionId

  return {
    element: null,
    eventId: "event_0001",
    id: "33333333-3333-4333-8333-333333333330",
    occurredAt: "2026-07-09T15:00:00.000Z",
    receivedAt: "2026-07-09T15:00:01.000Z",
    recipient,
    session: sessionId
      ? {
          device,
          id: sessionId,
          lastSeenAt: "2026-07-09T15:01:00.000Z",
          location,
          startedAt: "2026-07-09T15:00:00.000Z",
          state: "ended",
        }
      : null,
    sessionId,
    site,
    source: "browser",
    tab: null,
    type: "site_visit",
    webhook: null,
    ...overrides,
  }
}

function trackingSession(
  overrides: Partial<TrackingV2SessionSummary> = {},
): TrackingV2SessionSummary {
  return {
    activeMs: 60_000,
    device,
    durationMs: 80_000,
    endedAt: "2026-07-09T15:01:20.000Z",
    endReason: "pagehide",
    id: "session_0001",
    initialPath: "/launch-plan/linear-maya",
    ipAddress: "203.0.113.10",
    lastSeenAt: "2026-07-09T15:01:00.000Z",
    location,
    maxScrollDepthPercent: null,
    recipient,
    recording: {
      available: false,
      durationMs: null,
      status: "disabled",
    },
    referrerHost: null,
    site,
    startedAt: "2026-07-09T15:00:00.000Z",
    state: "ended",
    ...overrides,
  }
}

function recordingManifest(
  overrides: Partial<TrackingV2RecordingManifestResponse> = {},
): TrackingV2RecordingManifestResponse {
  return {
    chunkCount: 1,
    chunks: [
      {
        checksumSha256: "a".repeat(64),
        compressedBytes: 512,
        eventCount: 1,
        firstEventAt: "2026-07-09T15:00:00.000Z",
        lastEventAt: "2026-07-09T15:00:00.000Z",
        sequence: 0,
      },
    ],
    compressedBytes: 512,
    durationMs: 5_000,
    endedAt: "2026-07-09T15:00:05.000Z",
    eventCount: 1,
    maxDurationMs: 600_000,
    recordingId: "44444444-4444-4444-8444-444444444444",
    requestId: "request_0001",
    sessionId: "session_0001",
    startedAt: "2026-07-09T15:00:00.000Z",
    status: "available",
    ...overrides,
  }
}

function recordingChunk(overrides: Partial<TrackingV2RecordingChunk> = {}): TrackingV2RecordingChunk {
  return {
    compressed: false,
    events: [
      rrwebEvent(RRWEB_FULL_SNAPSHOT_EVENT_TYPE, "2026-07-09T15:00:00.000Z", {}),
    ],
    schemaVersion: 3,
    sequence: 0,
    sessionId: "session_0001",
    ...overrides,
  }
}

function rrwebEvent(type: number, at: string, data: Record<string, unknown>) {
  return {
    data,
    timestamp: Date.parse(at),
    type,
  }
}
