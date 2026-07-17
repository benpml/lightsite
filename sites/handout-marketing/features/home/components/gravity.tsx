"use client"

import * as React from "react"
import type {
  Body,
  Engine,
  IChamferableBodyDefinition,
  Mouse,
  Runner,
} from "matter-js"

import { cn } from "@/lib/utils"

type GravityBodyConfig = {
  x: number
  y: number
  angle: number
  delayMs?: number
  isDraggable?: boolean
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

type InteractiveMouse = Mouse & {
  mousedown: EventListener
  mousemove: EventListener
  mouseup: EventListener
  mousewheel: EventListener
}

type GravityProps = React.ComponentPropsWithoutRef<"div"> & {
  active: boolean
  gravity?: { x: number; y: number }
  addTopWall?: boolean
  grabCursor?: boolean
}

const draggableBodyCategory = 0x0002

function configureScrollableMouse(
  mouse: InteractiveMouse,
  element: HTMLDivElement,
  start: () => void,
) {
  element.removeEventListener("wheel", mouse.mousewheel)
  element.removeEventListener("touchmove", mouse.mousemove)
  element.removeEventListener("touchstart", mouse.mousedown)
  element.removeEventListener("touchend", mouse.mouseup)

  let isTouchDragging = false

  const handleTouchStart: EventListener = (event) => {
    const target = event.target
    if (
      !(target instanceof Element) ||
      !target.closest('[data-gravity-draggable="true"]')
    ) {
      return
    }

    isTouchDragging = true
    mouse.mousedown(event)
    start()
  }

  const handleTouchMove: EventListener = (event) => {
    if (isTouchDragging) mouse.mousemove(event)
  }

  const handleTouchEnd: EventListener = (event) => {
    if (!isTouchDragging) return

    mouse.mouseup(event)
    isTouchDragging = false
  }

  element.addEventListener("touchstart", handleTouchStart, { passive: false })
  element.addEventListener("touchmove", handleTouchMove, { passive: false })
  element.addEventListener("touchend", handleTouchEnd, { passive: false })
  element.addEventListener("touchcancel", handleTouchEnd, { passive: false })

  return () => {
    element.removeEventListener("mousemove", mouse.mousemove)
    element.removeEventListener("mousedown", mouse.mousedown)
    element.removeEventListener("mouseup", mouse.mouseup)
    element.removeEventListener("wheel", mouse.mousewheel)
    element.removeEventListener("touchstart", handleTouchStart)
    element.removeEventListener("touchmove", handleTouchMove)
    element.removeEventListener("touchend", handleTouchEnd)
    element.removeEventListener("touchcancel", handleTouchEnd)
  }
}

function Gravity({
  active,
  gravity = { x: 0, y: 1 },
  addTopWall = false,
  grabCursor = true,
  className,
  children,
  onPointerDown,
  ...props
}: GravityProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bodiesRef = React.useRef(new Map<string, RegisteredBody>())
  const matterRef = React.useRef<MatterRuntime | null>(null)
  const engineRef = React.useRef<Engine | null>(null)
  const runnerRef = React.useRef<Runner | null>(null)
  const mouseRef = React.useRef<Mouse | null>(null)
  const removeMouseListenersRef = React.useRef<(() => void) | null>(null)
  const bodyDelayTimersRef = React.useRef(new Set<number>())
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
    removeMouseListenersRef.current?.()
    removeMouseListenersRef.current = null
    bodyDelayTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    bodyDelayTimersRef.current.clear()
    if (mouseRef.current && matter) {
      matter.Mouse.clearSourceEvents(mouseRef.current)
    }
    if (engineRef.current && matter) {
      matter.Events.off(engineRef.current, "afterUpdate")
      matter.World.clear(engineRef.current.world, false)
      matter.Engine.clear(engineRef.current)
    }

    engineRef.current = null
    runnerRef.current = null
    mouseRef.current = null
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
      const isDraggable = record.isDraggable !== false
      const body = matter.Bodies.rectangle(record.x, record.y, bodyWidth, bodyHeight, {
        ...record.options,
        angle: (record.angle * Math.PI) / 180,
        collisionFilter: {
          ...record.options?.collisionFilter,
          category: isDraggable
            ? draggableBodyCategory
            : (record.options?.collisionFilter?.category ?? 0x0001),
        },
      })

      record.body = body
      dynamicBodies.push(body)

      const addBody = () => {
        if (engineRef.current !== engine) return

        matter.World.add(engine.world, body)
        if (activeRef.current) start()
      }

      if (record.delayMs && record.delayMs > 0) {
        const timer = window.setTimeout(() => {
          bodyDelayTimersRef.current.delete(timer)
          addBody()
        }, record.delayMs)
        bodyDelayTimersRef.current.add(timer)
      } else {
        matter.World.add(engine.world, body)
      }
    })

    const mouse = matter.Mouse.create(container) as InteractiveMouse
    removeMouseListenersRef.current = configureScrollableMouse(
      mouse,
      container,
      start,
    )
    const mouseConstraint = matter.MouseConstraint.create(engine, {
      mouse,
      collisionFilter: {
        category: draggableBodyCategory,
        mask: draggableBodyCategory,
      },
      constraint: {
        stiffness: 0.2,
        damping: 0.1,
        render: { visible: false },
      },
    })

    matter.World.add(engine.world, [...walls, mouseConstraint])
    mouseRef.current = mouse

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

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeRef.current) start()
      onPointerDown?.(event)
    },
    [onPointerDown, start],
  )

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
        className={cn(
          "absolute overflow-hidden touch-pan-y select-none",
          grabCursor && "cursor-grab active:cursor-grabbing",
          className,
        )}
        onPointerDown={handlePointerDown}
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
  delayMs = 0,
  isDraggable = true,
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

    context.registerBody(id, element, {
      x,
      y,
      angle,
      delayMs,
      isDraggable,
      options,
    })
    return () => context.unregisterBody(id)
  }, [angle, context, delayMs, id, isDraggable, options, x, y])

  return (
    <div
      ref={elementRef}
      data-gravity-body="true"
      data-gravity-delay={delayMs}
      data-gravity-draggable={isDraggable}
      className={cn(
        "absolute top-0 left-0 opacity-0 will-change-transform",
        isDraggable && "touch-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Gravity, GravityBody }
export type { GravityBodyProps, GravityProps }
