import { useCallback, useLayoutEffect, useState, type RefObject } from "react"

type FloatingEditorPopoverPosition = {
  maxHeight: number
  x: number
  y: number
}

type UseFloatingEditorPopoverPositionOptions = {
  fallbackHeight: number
  fallbackWidth: number
  floatingRef: RefObject<HTMLElement | null>
  getAnchorRect: () => DOMRect | null
  offset?: number
  open: boolean
  viewportPadding?: number
}

const defaultOffset = 8
const defaultViewportPadding = 12
const minimumUsableHeight = 96

export function useFloatingEditorPopoverPosition({
  fallbackHeight,
  fallbackWidth,
  floatingRef,
  getAnchorRect,
  offset = defaultOffset,
  open,
  viewportPadding = defaultViewportPadding,
}: UseFloatingEditorPopoverPositionOptions) {
  const [position, setPosition] = useState<FloatingEditorPopoverPosition | null>(null)

  const updatePosition = useCallback(() => {
    const anchorRect = getAnchorRect()

    if (!anchorRect) {
      return
    }

    const floatingRect = floatingRef.current?.getBoundingClientRect() ?? null
    setPosition(
      computeFloatingEditorPopoverPosition({
        anchorRect,
        fallbackHeight,
        fallbackWidth,
        floatingRect,
        offset,
        viewportPadding,
      })
    )
  }, [fallbackHeight, fallbackWidth, floatingRef, getAnchorRect, offset, viewportPadding])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    updatePosition()

    const measureFrame = window.requestAnimationFrame(updatePosition)
    let resizeObserver: ResizeObserver | null = null
    const observeFrame = window.requestAnimationFrame(() => {
      if (!floatingRef.current) {
        return
      }

      resizeObserver = new ResizeObserver(updatePosition)
      resizeObserver.observe(floatingRef.current)
    })

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.cancelAnimationFrame(measureFrame)
      window.cancelAnimationFrame(observeFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [floatingRef, open, updatePosition])

  return open ? position : null
}

function computeFloatingEditorPopoverPosition({
  anchorRect,
  fallbackHeight,
  fallbackWidth,
  floatingRect,
  offset,
  viewportPadding,
}: {
  anchorRect: DOMRect
  fallbackHeight: number
  fallbackWidth: number
  floatingRect: DOMRect | null
  offset: number
  viewportPadding: number
}): FloatingEditorPopoverPosition {
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const floatingHeight = Math.max(1, floatingRect?.height ?? fallbackHeight)
  const floatingWidth = Math.max(1, floatingRect?.width ?? fallbackWidth)
  const maxViewportHeight = Math.max(
    minimumUsableHeight,
    viewportHeight - viewportPadding * 2
  )
  const availableBelow = viewportHeight - viewportPadding - anchorRect.bottom - offset
  const availableAbove = anchorRect.top - viewportPadding - offset
  const shouldPlaceAbove = availableBelow < floatingHeight && availableAbove > availableBelow
  const availableHeight = shouldPlaceAbove ? availableAbove : availableBelow
  const maxHeight = Math.max(
    minimumUsableHeight,
    Math.min(maxViewportHeight, Math.max(0, availableHeight))
  )
  const height = Math.min(floatingHeight, maxHeight)
  const maxX = Math.max(viewportPadding, viewportWidth - viewportPadding - floatingWidth)
  const unclampedY = shouldPlaceAbove
    ? anchorRect.top - offset - height
    : anchorRect.bottom + offset
  const maxY = Math.max(viewportPadding, viewportHeight - viewportPadding - height)

  return {
    maxHeight: Math.round(maxHeight),
    x: Math.round(Math.max(viewportPadding, Math.min(anchorRect.left, maxX))),
    y: Math.round(Math.max(viewportPadding, Math.min(unclampedY, maxY))),
  }
}
