"use client"

import * as React from "react"

import { SiteHeader } from "@/components/layout/site-header"
import { cn } from "@/lib/utils"

const stickyHeaderEnterBuffer = 112
const stickyHeaderExitBuffer = 440
const stickyHeaderEmergencyExitBuffer = 48

type StickySiteHeaderProps = {
  items?: ReadonlyArray<{ href: string; label: string }>
  observeId: string
}

function StickySiteHeader({ items, observeId }: StickySiteHeaderProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [skipExitAnimation, setSkipExitAnimation] = React.useState(false)

  React.useEffect(() => {
    const observedHeader = document.getElementById(observeId)
    if (!observedHeader) return

    let animationFrame: number | null = null
    let lastScrollY = window.scrollY

    const updateVisibility = (allowReveal: boolean) => {
      const currentScrollY = window.scrollY
      const isScrollingDown = currentScrollY > lastScrollY
      const originalHeaderBottom = observedHeader.getBoundingClientRect().bottom
      const skippedExitZone =
        !isScrollingDown &&
        originalHeaderBottom >= -stickyHeaderEmergencyExitBuffer

      lastScrollY = currentScrollY
      animationFrame = null
      setSkipExitAnimation(skippedExitZone)

      setIsVisible((wasVisible) => {
        if (wasVisible) {
          return originalHeaderBottom < -stickyHeaderExitBuffer
        }

        if (allowReveal || isScrollingDown) {
          return originalHeaderBottom < -stickyHeaderEnterBuffer
        }

        return false
      })
    }

    const scheduleVisibilityUpdate = () => {
      if (animationFrame !== null) return
      animationFrame = window.requestAnimationFrame(() => updateVisibility(false))
    }

    const handleResize = () => updateVisibility(true)

    updateVisibility(true)
    window.addEventListener("scroll", scheduleVisibilityUpdate, { passive: true })
    window.addEventListener("resize", handleResize)

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("scroll", scheduleVisibilityUpdate)
      window.removeEventListener("resize", handleResize)
    }
  }, [observeId])

  return (
    <div
      aria-hidden={!isVisible}
      data-visible={isVisible}
      inert={!isVisible}
      className={cn(
        "fixed inset-x-0 top-4 z-50 flex justify-center px-4 will-change-[translate,scale,opacity,filter] transition-[translate,scale,opacity,filter] motion-reduce:translate-none motion-reduce:scale-100 motion-reduce:transition-none",
        isVisible
          ? "translate-y-0 scale-100 opacity-100 blur-none duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          : cn(
              "pointer-events-none -translate-y-2 scale-[0.985] opacity-0 blur-[2px] ease-[cubic-bezier(0.4,0,1,1)]",
              skipExitAnimation ? "duration-0" : "duration-[220ms]",
            ),
      )}
    >
      <SiteHeader variant="sticky" items={items} />
    </div>
  )
}

export { StickySiteHeader }
