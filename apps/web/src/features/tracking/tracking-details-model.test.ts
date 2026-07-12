import { describe, expect, it } from "vitest"
import type { TrackingV2EventFeedItem } from "@lightsite/tracking-schema"

import {
  formatSessionEndReason,
  formatTrackingDevice,
  toEventDrawerData,
} from "./tracking-details-model"

describe("formatSessionEndReason", () => {
  it.each([
    ["pagehide", "Left page"],
    ["visibility_timeout", "Away too long"],
    ["idle_timeout", "Inactive"],
    ["max_duration", "Time limit reached"],
    ["heartbeat_timeout", "Connection lost"],
    ["server_expired", "Session expired"],
    ["unknown", "Ended"],
    [null, "In progress"],
  ] as const)("maps %s to %s", (reason, expected) => {
    expect(formatSessionEndReason(reason)).toBe(expected)
  })
})

describe("formatTrackingDevice", () => {
  it.each([
    [{ type: "mobile", os: "iOS", browser: "Safari" }, "iPhone"],
    [{ type: "mobile", os: "Android", browser: "Chrome" }, "Android phone"],
    [{ type: "desktop", os: "macOS", browser: "Safari" }, "Mac computer"],
    [{ type: "desktop", os: "Windows", browser: "Edge" }, "Windows PC"],
    [{ type: "tablet", os: "iOS", browser: "Safari" }, "iPad"],
    [{ type: "desktop", os: "Linux", browser: "Firefox" }, "Linux computer"],
    [{ type: "mobile", os: null, browser: null }, "Mobile device"],
    [{ type: null, os: null, browser: null }, "-"],
    [null, "-"],
  ] as const)("maps %j to %s", (device, expected) => {
    expect(formatTrackingDevice(device)).toBe(expected)
  })
})

describe("toEventDrawerData", () => {
  it("uses a hyphen when event details are unknown", () => {
    const event: TrackingV2EventFeedItem = {
      element: null,
      eventId: "event_0001",
      id: "33333333-3333-4333-8333-333333333330",
      occurredAt: "2026-07-09T15:00:00.000Z",
      receivedAt: "2026-07-09T15:00:01.000Z",
      recipient: null,
      session: {
        device: { browser: null, os: null, type: null },
        id: "session_0001",
        lastSeenAt: "2026-07-09T15:01:00.000Z",
        location: { city: null, countryCode: null, region: null },
        startedAt: "2026-07-09T15:00:00.000Z",
        state: "ended",
      },
      sessionId: "session_0001",
      site: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Launch Plan",
        slug: "launch-plan",
      },
      source: "browser",
      tab: null,
      type: "site_visit",
      webhook: null,
    }

    expect(toEventDrawerData(event)).toMatchObject({
      details: "-",
      device: "-",
      element: "-",
      location: "-",
    })
  })
})
