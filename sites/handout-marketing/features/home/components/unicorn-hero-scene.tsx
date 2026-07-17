"use client"

import { useEffect } from "react"

import { cn } from "@/lib/utils"

const unicornSdkElementId = "unicorn-studio-sdk"

type UnicornStudioRuntime = {
  init: () => Promise<unknown[]>
  destroy: () => void
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioRuntime
  }
}

function UnicornHeroScene({ className }: { className?: string }) {
  useEffect(() => {
    let cancelled = false
    let destroyed = false
    let initialized = false
    const sdkElement = document.getElementById(unicornSdkElementId)

    const destroy = () => {
      if (destroyed) {
        return
      }

      destroyed = true
      window.UnicornStudio?.destroy()
    }

    const initialize = () => {
      const runtime = window.UnicornStudio

      if (initialized || !runtime?.init) {
        return
      }

      initialized = true
      void runtime
        .init()
        .then(() => {
          if (cancelled) {
            destroy()
          }
        })
        .catch(() => {
          initialized = false
        })
    }

    initialize()

    if (!initialized) {
      sdkElement?.addEventListener("load", initialize, { once: true })
      initialize()
    }

    return () => {
      cancelled = true
      sdkElement?.removeEventListener("load", initialize)

      if (initialized) {
        destroy()
      }
    }
  }, [])

  return (
    <div
      aria-label="Abstract blue sky animation"
      className={cn("unicorn-hero-scene absolute inset-0", className)}
      data-us-project-src="/scenes/handout-hero.json"
      data-us-production="true"
      data-us-scale="1"
      data-us-dpi="1"
      data-us-fps="24"
      data-us-arialabel="Abstract blue sky animation"
    />
  )
}

export { UnicornHeroScene, unicornSdkElementId }
