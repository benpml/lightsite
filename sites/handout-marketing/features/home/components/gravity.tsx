"use client"

import * as React from "react"
import type {
  Body,
  Engine,
  IChamferableBodyDefinition,
  Runner,
} from "matter-js"

import { cn } from "@/lib/utils"

type GravityBodyConfig = {
  x: number
  y: number
  angle: number
  options?: IChamferableBodyDefinition
}

type RegisteredBody = GravityBodyConfig & {
  element: HTMLDivElement
  body?: Body
}

type GravityContextValue = {
  registerBody: (
    id: string,
    element: HTMLDivElement,
    config: GravityBodyConfig,
  ) => void
  unregisterBody: (id: string) => void
}

const GravityContext = React.createContext<GravityContextValue | null>(null)

type MatterRuntime = typeof import("matter-js")

type GravityProps = React.ComponentPropsWithoutRef<"div"> & {
  active: boolean
  gravity?: { x: number; y: number }
  addTopWall?: boolean
}

function Gravity({
  active,
  gravity = { x: 0, y: 1 },
  addTopWall = false,
  className,
  children,
  ...props
}: GravityProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodiesRef = React.useRef(new Map<string, RegisteredBody>())
  const matterRef = React.useRef<MatterRuntime | null>(null)
  const engineRef = React.useRef<Engine | null>(null)
  const runnerRef = React.useRef<Runner | null>(null)
  const runningRef = React.useRef(false)
  const rebuildFrameRef = React.useRef<number | null>(null)
  const activeRef = React.useRef(active)
  const buildWorldRef = React.useRef<() => void>(() => undefined)

  const stop = React.useCallback(() => {
    if (runnerRef.current && matterRef.current) {
      matterRef.current.Runner.stop(runnerRef.current)
    }
    runningRef.current = false
  }, [])

  const start = React.useCallback(() => {
    const engine = engineRef.current
    const runner = runnerRef.current
    const matter = matterRef.current
    if (!engine || !runner || !matter || runningRef.current) return

    matter.Runner.run(runner, engine)
    runningRef.current = true
  }, [])

  const destroyWorld = React.useCallback(() => {
    stop()

    const matter = matterRef.current
    if (engineRef.current && matter) {
      matter.Events.off(engineRef.current, "afterUpdate")
      matter.World.clear(engineRef.current.world, false)
      matter.Engine.clear(engineRef.current)
    }

    engineRef.current = null
    runnerRef.current = null
    bodiesRef.current.forEach((record) => {
      record.body = undefined
    })
  }, [stop])

  const scheduleBuild = React.useCallback(() => {
    if (rebuildFrameRef.current !== null) {
      cancelAnimationFrame(rebuildFrameRef.current)
    }

    rebuildFrameRef.current = requestAnimationFrame(() => {
      rebuildFrameRef.current = null
      buildWorldRef.current()
    })
  }, [])

  const buildWorld = React.useCallback(() => {
    const container = containerRef.current
    const matter = matterRef.current
    if (
      !container ||
      !matter ||
      container.clientWidth === 0 ||
      container.clientHeight === 0
    ) {
      return
    }

    destroyWorld()

    const width = container.clientWidth
    const height = container.clientHeight
    const engine = matter.Engine.create({ enableSleeping: true })
    const runner = matter.Runner.create({ delta: 1000 / 60 })
    const wallThickness = 40

    engine.gravity.x = gravity.x
    engine.gravity.y = gravity.y
    engine.positionIterations = 8
    engine.velocityIterations = 6

    const walls = [
      matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true,
        friction: 1,
      }),
      matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 3, {
        isStatic: true,
        friction: 1,
      }),
      matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 3, {
        isStatic: true,
        friction: 1,
      }),
    ]

    if (addTopWall) {
      walls.push(
        matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, {
          isStatic: true,
          friction: 1,
        }),
      )
    }

    const dynamicBodies: Body[] = []

    bodiesRef.current.forEach((record) => {
      const bodyWidth = record.element.offsetWidth
      const bodyHeight = record.element.offsetHeight
      const body = matter.Bodies.rectangle(record.x, record.y, bodyWidth, bodyHeight, {
        ...record.options,
        angle: (record.angle * Math.PI) / 180,
      })

      record.body = body
      dynamicBodies.push(body)
      matter.World.add(engine.world, body)
    })

    matter.World.add(engine.world, walls)

    let sleepingFrames = 0
    const syncElements = () => {
      bodiesRef.current.forEach((record) => {
        if (!record.body) return

        const x = record.body.position.x - record.element.offsetWidth / 2
        const y = record.body.position.y - record.element.offsetHeight / 2
        const angle = (record.body.angle * 180) / Math.PI

        record.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`
        record.element.style.opacity = "1"
      })

      sleepingFrames = dynamicBodies.every((body) => body.isSleeping)
        ? sleepingFrames + 1
        : 0

      if (sleepingFrames > 24) stop()
    }

    matter.Events.on(engine, "afterUpdate", syncElements)
    engineRef.current = engine
    runnerRef.current = runner
    syncElements()
    container.dataset.gravityReady = "true"

    if (activeRef.current) start()
  }, [addTopWall, destroyWorld, gravity.x, gravity.y, start, stop])

  const contextValue = React.useMemo<GravityContextValue>(
    () => ({
      registerBody(id, element, config) {
        bodiesRef.current.set(id, { element, ...config })
        scheduleBuild()
      },
      unregisterBody(id) {
        const record = bodiesRef.current.get(id)
        if (record?.body && engineRef.current && matterRef.current) {
          matterRef.current.World.remove(engineRef.current.world, record.body)
        }
        bodiesRef.current.delete(id)
      },
    }),
    [scheduleBuild],
  )

  React.useEffect(() => {
    activeRef.current = active
    if (!active) {
      stop()
      return
    }

    let cancelled = false

    if (matterRef.current) {
      scheduleBuild()
      return
    }

    void import("matter-js").then((matter) => {
      if (cancelled) return

      matterRef.current = matter
      scheduleBuild()
    })

    return () => {
      cancelled = true
    }
  }, [active, scheduleBuild, stop])

  React.useEffect(() => {
    buildWorldRef.current = buildWorld
  }, [buildWorld])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(scheduleBuild)
    observer.observe(container)
    scheduleBuild()

    return () => {
      observer.disconnect()
      if (rebuildFrameRef.current !== null) {
        cancelAnimationFrame(rebuildFrameRef.current)
      }
      destroyWorld()
    }
  }, [destroyWorld, scheduleBuild])

  return (
    <GravityContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-gravity-active={active}
        className={cn("absolute overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </GravityContext.Provider>
  )
}

type GravityBodyProps = React.ComponentPropsWithoutRef<"div"> & GravityBodyConfig

function GravityBody({
  x,
  y,
  angle,
  options,
  className,
  children,
  ...props
}: GravityBodyProps) {
  const context = React.useContext(GravityContext)
  const id = React.useId()
  const elementRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const element = elementRef.current
    if (!context || !element) return

    const initialX = x - element.offsetWidth / 2
    const initialY = y - element.offsetHeight / 2
    element.style.transform = `translate3d(${initialX}px, ${initialY}px, 0) rotate(${angle}deg)`
    element.style.opacity = "1"

    context.registerBody(id, element, { x, y, angle, options })
    return () => context.unregisterBody(id)
  }, [angle, context, id, options, x, y])

  return (
    <div
      ref={elementRef}
      data-gravity-body="true"
      className={cn("absolute top-0 left-0 opacity-0 will-change-transform", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Gravity, GravityBody }
export type { GravityBodyProps, GravityProps }
