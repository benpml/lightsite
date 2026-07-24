import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconVideo,
} from "@tabler/icons-react"
import type {
  TrackingV2RecordingChunk,
  TrackingV2RecordingManifestResponse,
  TrackingV2SessionSummary,
} from "@handout/tracking-schema"
import { TRACKING_V2_RECORDING_MAX_BYTES } from "@handout/tracking-schema"

import { LoadingState } from "@/components/common/loading-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getApiErrorMessage, isApiClientError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { cn } from "@/lib/utils"

import {
  getTrackingV2RecordingChunk,
  getTrackingV2RecordingManifest,
} from "./api"
import {
  buildTrackingRrwebReplay,
  type TrackingRrwebEvent,
  type TrackingRrwebReplay,
} from "./recording-replay-events"

type TrackingRecordingReplayProps = {
  session: TrackingV2SessionSummary
  variant?: "default" | "drawer"
  workspaceId: string
}

type RrwebReplayerInstance = {
  destroy: () => void
  getCurrentTime: () => number
  pause: (timeOffset?: number) => void
  play: (timeOffset?: number) => void
}

type RrwebReplayerConstructor = new (
  events: TrackingRrwebEvent[],
  config: {
    UNSAFE_replayCanvas?: boolean
    logger?: Pick<Console, "debug" | "error" | "info" | "log" | "warn">
    inactivePeriodThreshold?: number
    mouseTail?: false
    root: HTMLElement
    showDebug?: boolean
    showWarning?: boolean
    skipInactive?: boolean
    triggerFocus?: boolean
    useVirtualDom?: boolean
  },
) => RrwebReplayerInstance

export function TrackingRecordingReplay({
  session,
  variant = "default",
  workspaceId,
}: TrackingRecordingReplayProps) {
  const manifestQuery = useQuery({
    queryKey: queryKeys.trackingRecordingManifest(workspaceId, session.id),
    enabled: session.recording.available,
    queryFn: ({ signal }) =>
      getTrackingV2RecordingManifest(workspaceId, session.id, signal),
  })
  const manifest = manifestQuery.data ?? null
  const chunkSequences = useMemo(
    () => manifest?.chunks.map((chunk) => chunk.sequence).join(",") ?? "",
    [manifest?.chunks]
  )
  const chunksQuery = useQuery({
    queryKey: queryKeys.trackingRecordingChunks(
      workspaceId,
      manifest?.recordingId ?? "",
      chunkSequences
    ),
    enabled: Boolean(manifest && manifest.chunks.length > 0),
    queryFn: ({ signal }) => manifest
      ? loadRecordingChunks({ manifest, signal, workspaceId })
      : Promise.resolve([]),
  })
  const isLoading = manifestQuery.isLoading || chunksQuery.isLoading
  const error = manifestQuery.error ?? chunksQuery.error
  const isUnavailable = isApiClientError(error) && error.status === 404
  const chunks = chunksQuery.data ?? null

  return (
    <section className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex h-5 items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {variant === "drawer" ? <IconVideo className="size-3.5" /> : null}
          {variant === "drawer" ? "Session Replay" : "Recording replay"}
        </h2>
        {manifest ? (
          <div className="flex items-center gap-2">
            {manifest.status === "truncated" ? <Badge variant="secondary">Partial</Badge> : null}
            {variant === "default" ? <Badge variant="outline">{formatBytes(manifest.compressedBytes)}</Badge> : null}
          </div>
        ) : null}
      </div>
      <div className={cn(
        "w-full min-w-0 max-w-full border bg-background",
        variant === "drawer" ? "min-h-[350px] overflow-hidden rounded-xl" : "rounded-lg p-4"
      )}>
        {!session.recording.available ? (
          <RecordingReplayEmpty
            detail={unavailableReplayCopy(session).detail}
            title={unavailableReplayCopy(session).title}
            variant={variant}
          />
        ) : null}

        {isLoading ? <RecordingReplayLoading variant={variant} /> : null}

        {isUnavailable ? (
          <RecordingReplayEmpty
            detail="The recording file for this session is no longer available."
            title="Replay unavailable"
            variant={variant}
          />
        ) : null}

        {error && !isUnavailable ? (
          <Alert variant="destructive" className={cn("min-w-0", variant === "drawer" && "m-4")}>
            <IconAlertTriangle />
            <AlertTitle>Recording could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{getApiErrorMessage(error, "The replay files are not available.")}</span>
              <Button
                type="button"
                size="compact"
                variant="outline"
                disabled={manifestQuery.isFetching || chunksQuery.isFetching}
                onClick={() => {
                  void Promise.all([
                    manifestQuery.refetch(),
                    chunksQuery.refetch(),
                  ])
                }}
              >
                <IconRefresh data-icon="inline-start" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !error && manifest && chunks ? (
          <TrackingRecordingReplayPlayer
            key={manifest.recordingId}
            chunks={chunks}
            manifest={manifest}
            variant={variant}
          />
        ) : null}

        {!isLoading && !error && manifest && !chunks ? (
          <RecordingReplayEmpty variant={variant} />
        ) : null}
      </div>
    </section>
  )
}

function TrackingRecordingReplayPlayer({
  chunks,
  manifest,
  variant,
}: {
  chunks: TrackingV2RecordingChunk[]
  manifest: TrackingV2RecordingManifestResponse
  variant: "default" | "drawer"
}) {
  const replay = useMemo(
    () => buildTrackingRrwebReplay({ chunks, manifest }),
    [chunks, manifest]
  )

  if (replay.events.length < 2 || !replay.hasFullSnapshot) {
    return (
      <RecordingReplayEmpty
        detail={
          "This recording ended before the page snapshot finished uploading."
        }
        variant={variant}
      />
    )
  }

  return <RrwebReplayPlayer replay={replay} variant={variant} />
}

function RrwebReplayPlayer({
  replay,
  variant,
}: {
  replay: TrackingRrwebReplay
  variant: "default" | "drawer"
}) {
  const [elapsedMs, setElapsedMs] = useState(replay.initialOffsetMs)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading")
  const replayRootRef = useRef<HTMLDivElement | null>(null)
  const replayViewportRef = useRef<HTMLDivElement | null>(null)
  const replayerRef = useRef<RrwebReplayerInstance | null>(null)
  const initialOffsetMs = replay.initialOffsetMs
  const durationMs = Math.max(initialOffsetMs + 1, replay.durationMs)

  useEffect(() => {
    let disposed = false
    let stopScaling = () => {}
    const root = replayRootRef.current

    if (!root) {
      return
    }

    root.innerHTML = ""
    setElapsedMs(initialOffsetMs)
    setIsPlaying(false)
    setLoadError(null)
    setStatus("loading")

    Promise.all([
      import("@rrweb/replay"),
      import("@rrweb/replay/dist/style.css"),
    ])
      .then(([module]) => {
        if (disposed) {
          return
        }

        const Replayer = module.Replayer as unknown as RrwebReplayerConstructor
        const replayer = new Replayer(replay.events, {
          UNSAFE_replayCanvas: false,
          logger: quietReplayLogger,
          inactivePeriodThreshold: 2_000,
          mouseTail: false,
          root,
          showDebug: false,
          showWarning: false,
          skipInactive: true,
          triggerFocus: false,
          useVirtualDom: false,
        })

        replayer.pause(initialOffsetMs)
        replayerRef.current = replayer
        stopScaling = fitReplayToViewport({
          root,
          viewport: replayViewportRef.current,
        })
        setStatus("ready")
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.error("Session replay initialization failed.", error)
        }
        if (!disposed) {
          setLoadError("The replay engine could not reconstruct this recording.")
          setStatus("error")
        }
      })

    return () => {
      disposed = true
      stopScaling()
      replayerRef.current?.destroy()
      replayerRef.current = null
      root.innerHTML = ""
    }
  }, [initialOffsetMs, replay])

  useEffect(() => {
    if (!isPlaying || status !== "ready") {
      return
    }

    const tick = () => {
      const replayer = replayerRef.current
      const currentElapsedMs = replayer
        ? clamp(replayer.getCurrentTime(), initialOffsetMs, durationMs)
        : initialOffsetMs

      setElapsedMs(currentElapsedMs)

      if (currentElapsedMs >= durationMs) {
        replayer?.pause(durationMs)
        setIsPlaying(false)
        return
      }

    }

    tick()
    const intervalId = window.setInterval(tick, 100)

    return () => window.clearInterval(intervalId)
  }, [durationMs, initialOffsetMs, isPlaying, status])

  const canControl = status === "ready" && !loadError

  return (
    <div className={cn("flex w-full min-w-0 max-w-full flex-col", variant === "drawer" ? "gap-0" : "gap-4")}>
      <div
        ref={replayViewportRef}
        className={cn(
          "relative w-full min-w-0 max-w-full overflow-hidden",
          variant === "drawer"
            ? "h-[278px] bg-black"
            : "min-h-80 rounded-lg border bg-muted p-3"
        )}
      >
        <div
          ref={replayRootRef}
          className={cn(
            "relative w-full min-w-0 max-w-full overflow-hidden [&_.replayer-wrapper]:bg-background",
            variant === "drawer" ? "h-[278px]" : "min-h-74"
          )}
        />
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Spinner aria-label="Loading replay" />
          </div>
        ) : null}
      </div>

      {loadError ? (
        <Alert variant="destructive" className={cn(variant === "drawer" && "m-3")}>
          <IconAlertTriangle />
          <AlertTitle>Replay engine could not start</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className={cn(
        "flex flex-col gap-3",
        variant === "drawer" && "h-[72px] justify-center px-3 py-2"
      )}>
        <Slider
          aria-label="Recording timeline"
          disabled={!canControl}
          max={durationMs}
          min={initialOffsetMs}
          step={100}
          value={[Math.min(elapsedMs, durationMs)]}
          onValueChange={(value) => {
            const nextElapsedMs = clamp(
              value[0] ?? initialOffsetMs,
              initialOffsetMs,
              durationMs
            )
            if (isPlaying) {
              replayerRef.current?.pause()
            }
            setElapsedMs(nextElapsedMs)
            setIsPlaying(false)
          }}
          onValueCommit={(value) => {
            const nextElapsedMs = clamp(
              value[0] ?? initialOffsetMs,
              initialOffsetMs,
              durationMs
            )
            replayerRef.current?.pause(nextElapsedMs)
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="compact"
            variant="outline"
            disabled={!canControl}
            onClick={() => {
              const replayer = replayerRef.current
              if (!replayer) {
                return
              }

              if (isPlaying) {
                const currentElapsedMs = clamp(
                  replayer.getCurrentTime(),
                  initialOffsetMs,
                  durationMs
                )
                replayer.pause(currentElapsedMs)
                setElapsedMs(currentElapsedMs)
                setIsPlaying(false)
                return
              }

              const nextElapsedMs = elapsedMs >= durationMs ? initialOffsetMs : elapsedMs
              replayer.play(nextElapsedMs)
              setElapsedMs(nextElapsedMs)
              setIsPlaying(true)
            }}
          >
            {isPlaying ? (
              <IconPlayerPause data-icon="inline-start" />
            ) : (
              <IconPlayerPlay data-icon="inline-start" />
            )}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-compact"
                variant="ghost"
                aria-label="Restart replay"
                disabled={!canControl}
                onClick={() => {
                  replayerRef.current?.pause(initialOffsetMs)
                  setElapsedMs(initialOffsetMs)
                  setIsPlaying(false)
                }}
              >
                <IconRefresh />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart replay</TooltipContent>
          </Tooltip>
          <div className="ml-auto text-sm text-muted-foreground">
            {formatDurationMs(elapsedMs - initialOffsetMs)} /{" "}
            {formatDurationMs(durationMs - initialOffsetMs)}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordingReplayLoading({ variant }: { variant: "default" | "drawer" }) {
  return (
    <LoadingState
      placement="compact"
      label="Loading replay"
      className={cn(
        "min-h-0",
        variant === "drawer" ? "h-[326px]" : "aspect-video",
      )}
    />
  )
}

function RecordingReplayEmpty({
  detail = "This recording does not have a usable snapshot yet.",
  title = "Replay is empty",
  variant = "default",
}: {
  detail?: string
  title?: string
  variant?: "default" | "drawer"
}) {
  return (
    <Empty className={cn(
      "bg-background",
      variant === "drawer" ? "min-h-[348px] border-0" : "min-h-64 rounded-lg border"
    )}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconVideo />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kilobytes = bytes / 1024

  if (kilobytes < 1024) {
    return `${Math.round(kilobytes)} KB`
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`
}

function formatDurationMs(milliseconds: number) {
  const totalSeconds = Math.round(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

async function loadRecordingChunks({
  manifest,
  signal,
  workspaceId,
}: {
  manifest: TrackingV2RecordingManifestResponse
  signal: AbortSignal
  workspaceId: string
}) {
  const chunks = new Array<TrackingV2RecordingChunk>(manifest.chunks.length)
  let nextIndex = 0
  let loadedBytes = 0
  const workerCount = Math.min(4, manifest.chunks.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < manifest.chunks.length) {
      const index = nextIndex
      nextIndex += 1
      const chunk = manifest.chunks[index]

      if (!chunk) continue
      const payload = await getTrackingV2RecordingChunk(
        workspaceId,
        manifest.recordingId,
        chunk.sequence,
        signal
      )
      const serialized = JSON.stringify(payload)
      loadedBytes += new TextEncoder().encode(serialized).byteLength
      if (loadedBytes > TRACKING_V2_RECORDING_MAX_BYTES) {
        throw new Error("The replay exceeds the playback memory limit.")
      }
      if (payload.sequence !== chunk.sequence || payload.events.length !== chunk.eventCount) {
        throw new Error("The replay chunk metadata does not match its payload.")
      }
      if (await sha256Hex(serialized) !== chunk.checksumSha256) {
        throw new Error("The replay chunk failed its integrity check.")
      }
      chunks[index] = payload
    }
  }))

  return chunks
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function fitReplayToViewport({
  root,
  viewport,
}: {
  root: HTMLDivElement
  viewport: HTMLDivElement | null
}) {
  let animationFrame = 0
  let wrapperObserver: ResizeObserver | null = null

  const update = () => {
    const wrapper = root.querySelector<HTMLElement>(".replayer-wrapper")
    if (!wrapper) return

    const width = wrapper.offsetWidth
    const height = wrapper.offsetHeight
    if (width <= 0 || height <= 0) return

    const scale = Math.min(1, root.clientWidth / width)
    wrapper.style.position = "absolute"
    wrapper.style.top = "0"
    wrapper.style.left = `${Math.max(0, (root.clientWidth - width * scale) / 2)}px`
    wrapper.style.transform = `scale(${scale})`
    wrapper.style.transformOrigin = "top left"
    wrapper.style.pointerEvents = "none"
    root.style.height = `${Math.max(296, Math.ceil(height * scale))}px`

    if (!wrapperObserver && typeof ResizeObserver !== "undefined") {
      wrapperObserver = new ResizeObserver(update)
      wrapperObserver.observe(wrapper)
    }
  }

  const scheduleUpdate = () => {
    window.cancelAnimationFrame(animationFrame)
    animationFrame = window.requestAnimationFrame(() => {
      update()
      animationFrame = window.requestAnimationFrame(update)
    })
  }

  const viewportObserver = viewport && typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(scheduleUpdate)
    : null
  if (viewport && viewportObserver) viewportObserver.observe(viewport)
  if (!viewportObserver) window.addEventListener("resize", scheduleUpdate)
  scheduleUpdate()

  return () => {
    window.cancelAnimationFrame(animationFrame)
    wrapperObserver?.disconnect()
    viewportObserver?.disconnect()
    if (!viewportObserver) window.removeEventListener("resize", scheduleUpdate)
  }
}

const quietReplayLogger: Pick<Console, "debug" | "error" | "info" | "log" | "warn"> = {
  debug() {},
  error() {},
  info() {},
  log() {},
  warn() {},
}

function unavailableReplayCopy(session: TrackingV2SessionSummary) {
  const status = session.recording.status
  if (status === "pending" || status === "recording") {
    return session.state === "active"
      ? { title: "Recording in progress", detail: "The replay will be ready after this visit ends." }
      : { title: "Finalizing replay", detail: "The final session data is being assembled." }
  }
  if (status === "expired" || status === "deleted") {
    return { title: "Replay expired", detail: "This replay has reached its retention limit and was removed." }
  }
  if (status === "failed") {
    return { title: "Replay unavailable", detail: "The visit ended before a usable replay could be assembled." }
  }
  return { title: "Replay unavailable", detail: "This session does not include a replay." }
}
