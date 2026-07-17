"use client"

import * as React from "react"
import {
  IconFile,
  IconFileTypePdf,
  IconFileTypePpt,
  IconLink,
  IconMail,
} from "@tabler/icons-react"

import { Gravity, GravityBody } from "@/features/home/components/gravity"
import { cn } from "@/lib/utils"

const items = [
  {
    kind: "link",
    label: "https://website.com/another-link",
    x: 250.39,
    y: 388,
    width: 293,
    rotation: 25.53,
    spawnY: -80,
  },
  {
    kind: "email",
    label: "Hi Dave,",
    body: "I’ve attached our deck, pricing sheet, demo video, case studies, website link, agreemen...",
    x: 236.54,
    y: 214,
    width: 316,
    height: 137,
    rotation: 28.1,
    spawnY: -245,
  },
  {
    kind: "link",
    label: "https://website.com/link",
    x: -4,
    y: 447.12,
    width: 229,
    rotation: -25.37,
    spawnY: -390,
  },
  {
    kind: "pdf",
    label: "pricing deck.pdf",
    x: 49,
    y: 470.78,
    width: 172.61,
    rotation: -21.33,
    spawnY: -520,
  },
  {
    kind: "pdf",
    label: "Acme Contract.pdf",
    x: 22.67,
    y: 225,
    width: 193.61,
    rotation: 36.34,
    spawnY: -660,
  },
  {
    kind: "ppt",
    label: "sales deck final.pptx",
    x: 211.31,
    y: 450,
    width: 202,
    rotation: 17.2,
    spawnY: -800,
  },
  {
    kind: "file",
    label: "Customer Case Studies",
    x: 27,
    y: 508,
    width: 228,
    rotation: 0,
    spawnY: -940,
  },
] as const

const bodyOptions = {
  density: 0.001,
  friction: 0.42,
  frictionAir: 0.012,
  restitution: 0.22,
  sleepThreshold: 70,
} as const

function FallingBefore() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.28 },
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {prefersReducedMotion ? (
        <div className="absolute inset-y-0 left-1/2 w-[512px] -translate-x-1/2">
          {items.map((item) => (
            <div
              key={item.label}
              className="absolute"
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: "height" in item ? item.height : 45,
                transform: `rotate(${item.rotation}deg)`,
                transformOrigin: "top left",
              }}
            >
              <FallingItem item={item} />
            </div>
          ))}
        </div>
      ) : (
        <Gravity
          active={isVisible}
          gravity={{ x: 0, y: 1 }}
          className="inset-y-0 left-1/2 w-[512px] -translate-x-1/2"
        >
          {items.map((item) => (
            <GravityBody
              key={item.label}
              x={item.x + item.width / 2}
              y={item.spawnY}
              angle={item.rotation}
              options={bodyOptions}
              style={{
                width: item.width,
                height: "height" in item ? item.height : 45,
              }}
            >
              <FallingItem item={item} />
            </GravityBody>
          ))}
        </Gravity>
      )}
    </div>
  )
}

function FallingItem({
  item,
}: {
  item: (typeof items)[number]
}) {
  const Icon =
    item.kind === "link"
      ? IconLink
      : item.kind === "email"
        ? IconMail
        : item.kind === "ppt"
          ? IconFileTypePpt
          : item.kind === "pdf"
            ? IconFileTypePdf
            : IconFile

  return (
    <div
      className={cn(
        "flex size-full overflow-hidden rounded-xl border border-border bg-background",
        item.kind === "email"
          ? "flex-col gap-3 p-4 pr-4 pl-3"
          : "items-center gap-2 py-2.5 pr-4 pl-3",
      )}
    >
      {item.kind === "email" ? (
        <>
          <span className="flex size-[19px] items-center justify-center rounded-full bg-card text-tertiary-foreground">
            <Icon aria-hidden="true" className="size-3" />
          </span>
          <span className="flex flex-col gap-2">
            <span className="text-body-xl text-foreground">{item.label}</span>
            <span className="line-clamp-2 text-body-xl text-tertiary-foreground">
              {"body" in item ? item.body : null}
            </span>
          </span>
        </>
      ) : (
        <>
          <Icon aria-hidden="true" className="size-[18px] shrink-0 text-tertiary-foreground" />
          <span className="truncate text-body-2xl text-foreground">{item.label}</span>
        </>
      )}
    </div>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

export { FallingBefore }
