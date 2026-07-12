import type {
  TrackingV2RecordingChunk,
  TrackingV2RecordingManifestResponse,
} from "@lightsite/tracking-schema"

export const RRWEB_FULL_SNAPSHOT_EVENT_TYPE = 2

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
  const initialOffsetMs = fullSnapshotTimestamp === undefined
    ? 0
    : Math.max(0, fullSnapshotTimestamp - firstTimestamp + 1)

  return {
    durationMs: eventDurationMs,
    eventCount: events.length,
    events,
    hasFullSnapshot: events.some((event) => event.type === RRWEB_FULL_SNAPSHOT_EVENT_TYPE),
    initialOffsetMs,
    manifest: input.manifest,
  }
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
