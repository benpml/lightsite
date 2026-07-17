"use client"

import * as React from "react"

import { SiteHeader } from "@/components/layout/site-header"

const stickyHeaderBuffer = 32

type StickySiteHeaderProps = {
  items?: ReadonlyArray<{ href: string; label: string }>
  observeId: string
}

function StickySiteHeader({ items, observeId }: StickySiteHeaderProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const observedHeader = document.getElementById(observeId)
    if (!observedHeader) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(
          !entry.isIntersecting && entry.boundingClientRect.bottom < 0,
        )
      },
      {
        rootMargin: `${stickyHeaderBuffer}px 0px 0px`,
        threshold: 0,
      },
    )

    observer.observe(observedHeader)
    return () => observer.disconnect()
  }, [observeId])

  if (!isVisible) return null

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <SiteHeader variant="sticky" items={items} />
    </div>
  )
}

export { StickySiteHeader }
