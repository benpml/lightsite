import { describe, expect, it } from "vitest"
import type { TrackingV2RecordingManifestResponse } from "@handout/tracking-schema"

import { buildTrackingRrwebReplay } from "./recording-replay-events"

describe("recording replay reconstruction", () => {
  it("orders chunk events deterministically and starts after the first full snapshot", () => {
    const replay = buildTrackingRrwebReplay({
      chunks: [
        { schemaVersion: 4, sessionId: "session-replay", sequence: 1, events: [{ type: 3, timestamp: 1_300, data: {} }] },
        { schemaVersion: 4, sessionId: "session-replay", sequence: 0, events: [
          { type: 0, timestamp: 1_000, data: {} },
          { type: 2, timestamp: 1_100, data: {} },
        ] },
      ],
      manifest: manifest(),
    })

    expect(replay.events.map((event) => event.type)).toEqual([0, 2, 3])
    expect(replay.hasFullSnapshot).toBe(true)
    expect(replay.initialOffsetMs).toBe(101)
    expect(replay.durationMs).toBe(300)
  })

  it("skips leading dead air and starts on the first recorded user activity", () => {
    const replay = buildTrackingRrwebReplay({
      chunks: [
        {
          schemaVersion: 4,
          sessionId: "session-replay",
          sequence: 0,
          events: [
            { type: 4, timestamp: 1_000, data: {} },
            { type: 2, timestamp: 1_010, data: {} },
            { type: 3, timestamp: 8_500, data: { source: 1, positions: [] } },
          ],
        },
      ],
      manifest: manifest(),
    })

    expect(replay.initialOffsetMs).toBe(7_501)
    expect(replay.durationMs).toBe(7_500)
  })
})

function manifest(): TrackingV2RecordingManifestResponse {
  return {
    recordingId: "11111111-1111-4111-8111-111111111111",
    sessionId: "session-replay",
    status: "available",
    startedAt: "2026-07-13T12:00:00.000Z",
    endedAt: "2026-07-13T12:00:01.000Z",
    durationMs: 1_000,
    eventCount: 3,
    chunkCount: 2,
    compressedBytes: 100,
    maxDurationMs: 600_000,
    chunks: [],
    requestId: "request-replay",
  }
}
