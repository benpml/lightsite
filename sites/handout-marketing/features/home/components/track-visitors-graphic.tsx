"use client"

import * as React from "react"
import Image from "next/image"
import { Replayer } from "@rrweb/replay"
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

type RrwebEvent = {
  data?: Record<string, unknown>
  timestamp: number
  type: number
}

type RrwebReplayer = {
  destroy: () => void
  getCurrentTime: () => number
  off: (event: string, handler: () => void) => void
  on: (event: string, handler: () => void) => void
  pause: (timeOffset?: number) => void
  play: (timeOffset?: number) => void
}

type RrwebReplayerConstructor = new (
  events: RrwebEvent[],
  config: {
    UNSAFE_replayCanvas?: boolean
    logger?: Pick<Console, "debug" | "error" | "info" | "log" | "warn">
    mouseTail?: false | {
      duration?: number
      lineCap?: string
      lineWidth?: number
      strokeStyle?: string
    }
    root: HTMLElement
    showDebug?: boolean
    showWarning?: boolean
    skipInactive?: boolean
    triggerFocus?: boolean
    useVirtualDom?: boolean
  },
) => RrwebReplayer

const RECORDING_URL = "/recordings/northstar-session.json"
const LOOP_PAUSE_MS = 900

function TrackVisitorsGraphic() {
  const graphicRef = React.useRef<HTMLDivElement>(null)
  const replayViewportRef = React.useRef<HTMLDivElement>(null)
  const replayRootRef = React.useRef<HTMLDivElement>(null)
  const replayerRef = React.useRef<RrwebReplayer | null>(null)
  const finishHandlerRef = React.useRef<(() => void) | null>(null)
  const loopTimerRef = React.useRef<number | null>(null)
  const loadStartedRef = React.useRef(false)
  const prefersReducedMotionRef = React.useRef(false)
  const initialOffsetRef = React.useRef(0)
  const durationRef = React.useRef(1)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  React.useEffect(() => {
    const graphic = graphicRef.current
    if (!graphic) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold: 0.35 },
    )

    observer.observe(graphic)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!isVisible || loadStartedRef.current) return

    const root = replayRootRef.current
    if (!root) return

    let disposed = false
    let stopScaling = () => {}

    loadStartedRef.current = true

    fetch(RECORDING_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error("Northstar recording could not be loaded")
        return (await response.json()) as RrwebEvent[]
      })
      .then((events) => {
        if (disposed || events.length < 2) return

        const firstTimestamp = events[0].timestamp
        const fullSnapshot = events.find((event) => event.type === 2)
        const initialOffset = Math.max(
          0,
          (fullSnapshot?.timestamp ?? firstTimestamp) - firstTimestamp,
        )
        const duration = Math.max(
          initialOffset + 1,
          events[events.length - 1].timestamp - firstTimestamp,
        )
        const ReplayerConstructor = Replayer as unknown as RrwebReplayerConstructor
        const replayer = new ReplayerConstructor(events, {
          UNSAFE_replayCanvas: false,
          logger: quietReplayLogger,
          mouseTail: {
            duration: 650,
            lineCap: "round",
            lineWidth: 3,
            strokeStyle: "rgba(70, 113, 244, 0.82)",
          },
          root,
          showDebug: false,
          showWarning: false,
          skipInactive: true,
          triggerFocus: false,
          useVirtualDom: false,
        })

        const restart = () => {
          setProgress(1)
          setIsPlaying(false)
          if (prefersReducedMotionRef.current || disposed) return

          loopTimerRef.current = window.setTimeout(() => {
            if (disposed) return
            replayer.play(initialOffset)
            setProgress(0)
            setIsPlaying(true)
          }, LOOP_PAUSE_MS)
        }

        initialOffsetRef.current = initialOffset
        durationRef.current = duration
        finishHandlerRef.current = restart
        replayerRef.current = replayer
        replayer.on("finish", restart)
        replayer.pause(initialOffset)
        stopScaling = fitReplayToViewport({
          root,
          viewport: replayViewportRef.current,
        })
        setIsReady(true)

        if (!prefersReducedMotionRef.current) {
          window.requestAnimationFrame(() => {
            if (disposed) return
            replayer.play(initialOffset)
            setIsPlaying(true)
          })
        }
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Northstar visitor replay failed to initialize.", error)
        }
        setLoadError(error instanceof Error ? error.message : String(error))
        if (!disposed) loadStartedRef.current = false
      })

    return () => {
      disposed = true
      stopScaling()
      if (loopTimerRef.current !== null) {
        window.clearTimeout(loopTimerRef.current)
      }
      const replayer = replayerRef.current
      const finishHandler = finishHandlerRef.current
      if (replayer && finishHandler) replayer.off("finish", finishHandler)
      replayer?.destroy()
      replayerRef.current = null
      root.innerHTML = ""
    }
  }, [isVisible])

  React.useEffect(() => {
    if (!isReady || !isPlaying) return

    const interval = window.setInterval(() => {
      const currentTime = replayerRef.current?.getCurrentTime()
      if (currentTime === undefined) return

      const initialOffset = initialOffsetRef.current
      const duration = durationRef.current
      setProgress(
        Math.min(1, Math.max(0, (currentTime - initialOffset) / (duration - initialOffset))),
      )
    }, 80)

    return () => window.clearInterval(interval)
  }, [isPlaying, isReady])

  React.useEffect(() => {
    if (!isReady || !prefersReducedMotion) return

    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current)
      loopTimerRef.current = null
    }
    replayerRef.current?.pause(initialOffsetRef.current)

    const frame = window.requestAnimationFrame(() => {
      setProgress(0)
      setIsPlaying(false)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isReady, prefersReducedMotion])

  const togglePlayback = () => {
    const replayer = replayerRef.current
    if (!replayer || !isReady) return

    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current)
      loopTimerRef.current = null
    }

    if (isPlaying) {
      replayer.pause()
      setIsPlaying(false)
      return
    }

    const currentTime = replayer.getCurrentTime()
    const nextOffset =
      currentTime >= durationRef.current - 80
        ? initialOffsetRef.current
        : currentTime
    replayer.play(nextOffset)
    setProgress(
      nextOffset === initialOffsetRef.current ? 0 : progress,
    )
    setIsPlaying(true)
  }

  const seekPlayback = (nextProgress: number) => {
    const replayer = replayerRef.current
    if (!replayer || !isReady) return

    const wasPlaying = isPlaying
    const nextOffset =
      initialOffsetRef.current +
      nextProgress * (durationRef.current - initialOffsetRef.current)

    replayer.pause(nextOffset)
    if (wasPlaying) replayer.play(nextOffset)
    setProgress(nextProgress)
  }

  return (
    <div
      ref={graphicRef}
      data-graphic="track"
      data-visible={isVisible ? "true" : "false"}
      className="track-graphic relative isolate size-full overflow-hidden"
    >
      <Image
        alt=""
        src="/images/home/track-layer-2.png"
        width={1295}
        height={1080}
        className="pointer-events-none absolute top-[-413px] left-[-431.5px] h-[1080px] w-[1295px] max-w-none"
      />
      <Image
        alt=""
        src="/images/home/track-layer-1.png"
        width={1295}
        height={1080}
        className="pointer-events-none absolute top-[-74.34px] left-[-66.1px] h-[550.67px] w-[660.29px] max-w-none rotate-[89.83deg]"
      />

      <div className="track-visit-card absolute top-9 left-[34px] z-20 flex h-[63px] w-[445px] items-center gap-4 rounded-2xl bg-background py-3 pr-5 pl-3 max-md:right-7 max-md:left-7 max-md:w-auto">
        <Image
          alt="Northstar"
          src="/images/home/track-northstar-logomark.svg"
          width={50}
          height={50}
          className="size-12 shrink-0 max-w-none"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium leading-none tracking-[-0.02em] text-foreground">
            John @ Northstar visited your site
          </p>
          <p className="mt-1 text-[15px] leading-[1.375] tracking-[-0.01em] text-muted-foreground">
            5m 30s session
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          aria-label={isPlaying ? "Pause Northstar visitor replay" : "Watch Northstar visitor replay"}
          disabled={!isReady}
          onClick={togglePlayback}
          className="h-[30px] rounded-[10px] px-3 text-[14px] max-[430px]:hidden"
        >
          {isPlaying ? <IconPlayerPause data-icon="inline-start" /> : <IconPlayerPlay data-icon="inline-start" />}
          {isPlaying ? "Pause" : "Watch"}
        </Button>
      </div>

      <div className="track-replay-card absolute top-[123px] left-[34px] z-20 h-[265px] w-[445px] overflow-hidden rounded-2xl border border-inverse-border/80 bg-black shadow-[0_12px_32px_rgba(20,34,70,0.14)] max-md:right-7 max-md:left-7 max-md:w-auto">
        <div
          ref={replayViewportRef}
          className="absolute inset-x-0 top-0 bottom-[42px] overflow-hidden bg-black"
        >
          <div ref={replayRootRef} className="track-replay-root size-full" />
          {!isReady ? (
            <div className="track-replay-loading absolute inset-0" />
          ) : null}
          {loadError ? (
            <span data-track-replay-error className="sr-only">{loadError}</span>
          ) : null}
        </div>

        <div className="absolute inset-x-4 bottom-5 z-30 flex h-3 items-center">
          <input
            aria-label="Northstar visitor replay progress"
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            disabled={!isReady}
            onChange={(event) => seekPlayback(Number(event.currentTarget.value))}
            className="track-replay-progress w-full"
            style={{ "--track-progress": `${progress * 100}%` } as React.CSSProperties}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute top-0 left-1/2 z-40 h-[417px] w-[925px] -translate-x-[413.5px] bg-top-left bg-repeat opacity-75 mix-blend-lighten"
        style={{
          backgroundImage: "url('/images/home/personalize-noise.png')",
          backgroundSize: "332.5px 332.5px",
        }}
      />
    </div>
  )
}

function fitReplayToViewport({
  root,
  viewport,
}: {
  root: HTMLDivElement
  viewport: HTMLDivElement | null
}) {
  let animationFrame = 0

  const update = () => {
    const wrapper = root.querySelector<HTMLElement>(".replayer-wrapper")
    if (!wrapper) return

    const width = wrapper.offsetWidth
    const height = wrapper.offsetHeight
    if (width <= 0 || height <= 0) return

    const scale = root.clientWidth / width
    wrapper.style.position = "absolute"
    wrapper.style.top = "0"
    wrapper.style.left = "0"
    wrapper.style.transform = `scale(${scale})`
    wrapper.style.transformOrigin = "top left"
    wrapper.style.pointerEvents = "none"
  }

  const scheduleUpdate = () => {
    window.cancelAnimationFrame(animationFrame)
    animationFrame = window.requestAnimationFrame(() => {
      update()
      animationFrame = window.requestAnimationFrame(update)
    })
  }

  const observer =
    viewport && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleUpdate)
      : null

  if (viewport && observer) observer.observe(viewport)
  if (!observer) window.addEventListener("resize", scheduleUpdate)
  scheduleUpdate()

  return () => {
    window.cancelAnimationFrame(animationFrame)
    observer?.disconnect()
    if (!observer) window.removeEventListener("resize", scheduleUpdate)
  }
}

const quietReplayLogger: Pick<Console, "debug" | "error" | "info" | "log" | "warn"> = {
  debug() {},
  error() {},
  info() {},
  log() {},
  warn() {},
}

export { TrackVisitorsGraphic }
