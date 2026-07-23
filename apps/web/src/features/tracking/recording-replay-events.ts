import type {
  TrackingV2RecordingChunk,
  TrackingV2RecordingManifestResponse,
} from "@handout/tracking-schema"

export const RRWEB_FULL_SNAPSHOT_EVENT_TYPE = 2
const RRWEB_INCREMENTAL_SNAPSHOT_EVENT_TYPE = 3
const RRWEB_FIRST_USER_SOURCE = 1
const RRWEB_LAST_USER_SOURCE = 5
const LEADING_IDLE_SKIP_THRESHOLD_MS = 2_000

export type TrackingRrwebEvent = {
  data?: unknown
  timestamp: number
  type: number
}

export type TrackingRrwebReplay = {
  durationMs: number
  eventCount: number
  events: TrackingRrwebEvent[]
  hasFullSnapshot: boolean
  initialOffsetMs: number
  manifest: TrackingV2RecordingManifestResponse
}

type IndexedRrwebEvent = TrackingRrwebEvent & {
  index: number
}

export function buildTrackingRrwebReplay(input: {
  chunks: TrackingV2RecordingChunk[]
  manifest: TrackingV2RecordingManifestResponse
}): TrackingRrwebReplay {
  const events = parseRrwebEvents(input.chunks)
  const firstTimestamp = events[0]?.timestamp ?? 0
  const lastTimestamp = events[events.length - 1]?.timestamp ?? firstTimestamp
  const eventDurationMs = Math.max(0, lastTimestamp - firstTimestamp)
  const fullSnapshotTimestamp = events.find(
    (event) => event.type === RRWEB_FULL_SNAPSHOT_EVENT_TYPE
  )?.timestamp
  const firstUserActivityTimestamp = fullSnapshotTimestamp === undefined
    ? undefined
    : events.find(
        (event) =>
          event.timestamp >= fullSnapshotTimestamp &&
          isUserActivityEvent(event)
      )?.timestamp
  const replayStartTimestamp =
    fullSnapshotTimestamp !== undefined &&
    firstUserActivityTimestamp !== undefined &&
    firstUserActivityTimestamp - fullSnapshotTimestamp > LEADING_IDLE_SKIP_THRESHOLD_MS
      ? firstUserActivityTimestamp
      : fullSnapshotTimestamp
  const initialOffsetMs = replayStartTimestamp === undefined
    ? 0
    : Math.max(0, replayStartTimestamp - firstTimestamp + 1)

  return {
    durationMs: eventDurationMs,
    eventCount: events.length,
    events,
    hasFullSnapshot: events.some((event) => event.type === RRWEB_FULL_SNAPSHOT_EVENT_TYPE),
    initialOffsetMs,
    manifest: input.manifest,
  }
}

function isUserActivityEvent(event: TrackingRrwebEvent) {
  if (
    event.type !== RRWEB_INCREMENTAL_SNAPSHOT_EVENT_TYPE ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return false
  }
  const source = (event.data as { source?: unknown }).source
  return typeof source === "number" &&
    source >= RRWEB_FIRST_USER_SOURCE &&
    source <= RRWEB_LAST_USER_SOURCE
}

function parseRrwebEvents(chunks: TrackingV2RecordingChunk[]) {
  return [...chunks]
    .sort((left, right) => left.sequence - right.sequence)
    .flatMap((chunk) =>
      chunk.events.map((event, index) => ({
        ...parseRrwebEvent(event),
        index: chunk.sequence * 100_000 + index,
      }))
    )
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index)
    .map((event) => ({
      data: event.data,
      timestamp: event.timestamp,
      type: event.type,
    }))
}

function parseRrwebEvent(value: TrackingV2RecordingChunk["events"][number]): IndexedRrwebEvent {
  return {
    data: value.data,
    index: 0,
    timestamp: value.timestamp,
    type: value.type,
  }
}
