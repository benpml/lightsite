"use client"

import * as React from "react"
import { IconLink } from "@tabler/icons-react"
import Image from "next/image"

import { Gravity, GravityBody } from "@/features/home/components/gravity"
import { cn } from "@/lib/utils"

const firstSpawnY = -80
const fallSpacing = 175
const fallSpawnY = (order: number) => firstSpawnY - order * fallSpacing

const items = [
  {
    kind: "link",
    label: "https://website.com/another-link",
    x: 250.39,
    y: 388,
    width: 293,
    rotation: 25.53,
    spawnY: fallSpawnY(0),
  },
  {
    kind: "link",
    label: "https://website.com/link",
    x: -4,
    y: 447.12,
    width: 229,
    rotation: -25.37,
    spawnY: fallSpawnY(1),
  },
  {
    kind: "pdf",
    label: "pricing deck.pdf",
    x: 49,
    y: 470.78,
    width: 172.61,
    rotation: -21.33,
    spawnY: fallSpawnY(2),
  },
  {
    kind: "pdf",
    label: "Acme Contract.pdf",
    x: 22.67,
    y: 225,
    width: 193.61,
    rotation: 36.34,
    spawnY: fallSpawnY(3),
  },
  {
    kind: "ppt",
    label: "sales deck final.pptx",
    x: 211.31,
    y: 450,
    width: 202,
    rotation: 17.2,
    spawnY: fallSpawnY(4),
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
    spawnY: fallSpawnY(5),
  },
  {
    kind: "file",
    label: "Customer Case Studies",
    x: 27,
    y: 508,
    width: 228,
    rotation: 0,
    spawnY: fallSpawnY(6),
  },
] as const

const bodyOptions = {
  density: 0.001,
  friction: 0.42,
  frictionAir: 0.012,
  restitution: 0.22,
  sleepThreshold: 70,
} as const

const uprightBodyOptions = {
  ...bodyOptions,
  inertia: Number.POSITIVE_INFINITY,
} as const

const pageIconByKind = {
  file: "/images/home/before/page-folder.jpg",
  pdf: "/images/home/before/page-document.jpg",
  ppt: "/images/home/before/page-presentation.jpg",
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
                ...getFallingItemSize(item),
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
              options={item.kind === "file" ? uprightBodyOptions : bodyOptions}
              style={getFallingItemSize(item)}
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
  return (
    <div
      className={cn(
        "flex h-full overflow-hidden rounded-xl border border-border bg-background",
        item.kind === "email"
          ? "w-full flex-col gap-3 p-4 pr-4 pl-3"
          : "w-max min-w-full items-center gap-2 py-2.5 pr-4 pl-3",
      )}
    >
      {item.kind === "email" ? (
        <>
          <Image
            aria-hidden="true"
            src="/images/home/before/email-avatar.jpg"
            alt=""
            width={20}
            height={20}
            unoptimized
            draggable={false}
            className="size-5 rounded-full object-cover"
          />
          <span className="flex flex-col gap-2 text-body-xl text-tertiary-foreground">
            <span>{item.label}</span>
            <span className="line-clamp-2">
              {"body" in item ? item.body : null}
            </span>
          </span>
        </>
      ) : (
        <>
          {item.kind === "link" ? (
            <IconLink
              aria-hidden="true"
              className="size-[18px] shrink-0 text-tertiary-foreground"
            />
          ) : (
            <Image
              aria-hidden="true"
              src={pageIconByKind[item.kind]}
              alt=""
              width={22}
              height={22}
              unoptimized
              draggable={false}
              className="size-[22px] shrink-0 object-cover"
            />
          )}
          <span className="whitespace-nowrap text-body-2xl text-foreground">
            {item.label}
          </span>
        </>
      )}
    </div>
  )
}

function getFallingItemSize(item: (typeof items)[number]): React.CSSProperties {
  return {
    ...(item.kind === "email"
      ? { width: item.width }
      : { minWidth: item.width }),
    height: "height" in item ? item.height : 45,
  }
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
