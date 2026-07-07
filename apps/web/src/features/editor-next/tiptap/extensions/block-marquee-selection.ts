import { Extension } from "@tiptap/core"
import { isNodeRangeSelection, NodeRangeSelection } from "@tiptap/extension-node-range"
import { Plugin, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

const MARQUEE_DRAG_THRESHOLD = 6
const MARQUEE_MIN_HEIGHT = 24
const MARQUEE_MIN_WIDTH = 12

type Point = {
  x: number
  y: number
}

type BlockRange = {
  from: number
  to: number
}

type ActiveMarquee = {
  active: boolean
  from: number | null
  nativeSelectionAllowed: boolean
  origin: Point
  overlay: HTMLDivElement | null
  pointerId: number | null
  to: number | null
}

type BlockMarqueeSelectionController = {
  destroy: () => void
  handleMouseDown: (event: MouseEvent) => boolean
  handlePointerDown: (event: PointerEvent) => boolean
}

const blockMarqueeSelectionControllers = new WeakMap<
  EditorView,
  BlockMarqueeSelectionController
>()

export const LightsiteNextBlockMarqueeSelection = Extension.create({
  name: "lightsiteNextBlockMarqueeSelection",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (view, event) =>
              blockMarqueeSelectionControllers.get(view)?.handleMouseDown(event) ?? false,
            pointerdown: (view, event) =>
              event instanceof PointerEvent
                ? blockMarqueeSelectionControllers.get(view)?.handlePointerDown(event) ?? false
                : false,
          },
        },
        view: (view) => {
          const controller = createBlockMarqueeSelectionController(view)

          blockMarqueeSelectionControllers.set(view, controller)

          return {
            destroy: () => {
              blockMarqueeSelectionControllers.delete(view)
              controller.destroy()
            },
          }
        },
      }),
    ]
  },
})

function createBlockMarqueeSelectionController(view: EditorView): BlockMarqueeSelectionController {
  let marquee: ActiveMarquee | null = null
  const eventRoot = view.dom.ownerDocument
  const handlePointerDownEvent: EventListener = (event) => {
    if (event instanceof PointerEvent) {
      handlePointerDown(event)
    }
  }
  const handleMouseDownEvent: EventListener = (event) => {
    if (!(event instanceof MouseEvent)) {
      return
    }

    handleMouseDown(event)
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (marquee) {
      if (marquee.active || !marquee.nativeSelectionAllowed) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }

      return false
    }

    if (!canStartMarquee(view, event)) {
      return false
    }

    const nativeSelectionAllowed = startsInsideTopLevelBlock(view, event)

    if (!nativeSelectionAllowed) {
      event.preventDefault()
      event.stopPropagation()
    }

    startMarquee(event, null, nativeSelectionAllowed)
    window.addEventListener("mousemove", handleMouseMove, true)
    window.addEventListener("mouseup", handleMouseUp, true)

    return !nativeSelectionAllowed
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (marquee) {
      return false
    }

    if (!canStartMarquee(view, event)) {
      return false
    }

    const nativeSelectionAllowed = startsInsideTopLevelBlock(view, event)

    if (!nativeSelectionAllowed) {
      event.preventDefault()
      event.stopPropagation()
    }

    startMarquee(event, event.pointerId, nativeSelectionAllowed)
    window.addEventListener("pointermove", handlePointerMove, true)
    window.addEventListener("pointerup", handlePointerUp, true)
    window.addEventListener("pointercancel", handlePointerCancel, true)
    window.addEventListener("mousemove", handleMouseMove, true)
    window.addEventListener("mouseup", handleMouseUp, true)

    return !nativeSelectionAllowed
  }

  const startMarquee = (
    event: MouseEvent,
    pointerId: number | null,
    nativeSelectionAllowed: boolean
  ) => {
    clearWindowSelection()

    marquee = {
      active: false,
      from: null,
      nativeSelectionAllowed,
      origin: { x: event.clientX, y: event.clientY },
      overlay: null,
      pointerId,
      to: null,
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!marquee) {
      return
    }

    updateMarqueeFromEvent(event)
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!marquee) {
      return
    }

    updateMarqueeFromEvent(event)
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (!marquee) {
      return
    }

    finishMarquee(event)
  }

  const handleMouseUp = (event: MouseEvent) => {
    if (!marquee) {
      return
    }

    finishMarquee(event)
  }

  const handlePointerCancel = () => {
    if (!marquee) {
      return
    }

    cleanupMarquee()
  }

  const updateMarqueeFromEvent = (event: MouseEvent) => {
    if (!marquee) {
      return
    }

    const distance = Math.hypot(event.clientX - marquee.origin.x, event.clientY - marquee.origin.y)

    if (!marquee.active && distance < MARQUEE_DRAG_THRESHOLD) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    clearWindowSelection()

    if (!marquee.active) {
      marquee.active = true
      marquee.overlay = createMarqueeOverlay(view)
      view.dom.classList.add("lightsite-next-marquee-active")
    }

    const rect = normalizeRect(marquee.origin, { x: event.clientX, y: event.clientY })

    updateMarqueeOverlay(marquee.overlay, rect)
    updateSelectedBlockRange(view, marquee, rect)
  }

  const finishMarquee = (event: MouseEvent) => {
    if (!marquee) {
      return
    }

    const wasActive = marquee.active
    const from = marquee.from
    const to = marquee.to
    const origin = marquee.origin

    if (marquee.active) {
      event.preventDefault()
      event.stopPropagation()

      if (marquee.from === null || marquee.to === null) {
        clearBlockSelectionNearPoint(view, event)
      }

      view.focus()
    }

    cleanupMarquee()

    if (!wasActive && (from !== null || to !== null || isBlockSelectionActive(view))) {
      clearBlockSelectionNearPoint(view, origin)
      view.focus()
    }
  }

  const cleanupMarquee = () => {
    marquee?.overlay?.remove()
    marquee = null
    view.dom.classList.remove("lightsite-next-marquee-active")
    window.removeEventListener("pointermove", handlePointerMove, true)
    window.removeEventListener("pointerup", handlePointerUp, true)
    window.removeEventListener("pointercancel", handlePointerCancel, true)
    window.removeEventListener("mousemove", handleMouseMove, true)
    window.removeEventListener("mouseup", handleMouseUp, true)
  }

  eventRoot.addEventListener("pointerdown", handlePointerDownEvent, true)
  eventRoot.addEventListener("mousedown", handleMouseDownEvent, true)

  return {
    handleMouseDown,
    handlePointerDown,
    destroy: () => {
      eventRoot.removeEventListener("pointerdown", handlePointerDownEvent, true)
      eventRoot.removeEventListener("mousedown", handleMouseDownEvent, true)
      cleanupMarquee()
    },
  }
}

function canStartMarquee(view: EditorView, event: MouseEvent) {
  if (
    event.button > 0 ||
    !view.editable ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return false
  }

  const target = event.target

  if (!(target instanceof Element)) {
    return false
  }

  if (!target.closest("[data-editor-next-canvas]")) {
    return false
  }

  if (
    target.closest(
      "[data-lightsite-next-block-plus], [data-lightsite-next-block-handle], .lightsite-next-block-menu, .lightsite-next-button-settings, .lightsite-next-suggestion-menu, .lightsite-next-bubble-menu"
    )
  ) {
    return false
  }

  const blockElement = findTopLevelBlockElement(view, target)

  if (!blockElement) {
    return true
  }

  return canStartMarqueeFromBlockWhitespace(blockElement, event)
}

function createMarqueeOverlay(view: EditorView) {
  const overlay = document.createElement("div")

  overlay.className = "lightsite-next-marquee-box"
  view.dom.closest("[data-editor-next-page]")?.append(overlay)

  return overlay
}

function updateMarqueeOverlay(
  overlay: HTMLDivElement | null,
  rect: { height: number; left: number; top: number; width: number }
) {
  if (!overlay) {
    return
  }

  overlay.style.left = `${rect.left}px`
  overlay.style.top = `${rect.top}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

function updateSelectedBlockRange(
  view: EditorView,
  marquee: ActiveMarquee,
  rect: { height: number; left: number; top: number; width: number }
) {
  const range = findIntersectingBlockRange(view, rect, marquee.origin)

  if (!range) {
    if (marquee.from !== null || marquee.to !== null) {
      marquee.from = null
      marquee.to = null
      clearBlockSelectionNearPoint(view, marquee.origin)
    }

    return
  }

  if (range.from === marquee.from && range.to === marquee.to) {
    return
  }

  marquee.from = range.from
  marquee.to = range.to

  view.dispatch(
    view.state.tr.setSelection(NodeRangeSelection.create(view.state.doc, range.from, range.to, 0))
  )
}

function findIntersectingBlockRange(
  view: EditorView,
  marqueeRect: { height: number; left: number; top: number; width: number },
  origin: Point
): BlockRange | null {
  const marqueeClientRect = {
    bottom: marqueeRect.top + marqueeRect.height,
    left: marqueeRect.left,
    right: marqueeRect.left + marqueeRect.width,
    top: marqueeRect.top,
  }
  let pos = 0
  let from: number | null = null
  let to: number | null = null
  const contentRail = getTopLevelBlockRail(view)
  const useVerticalRowHitTest =
    contentRail !== null && (origin.x < contentRail.left || origin.x > contentRail.right)

  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    const node = view.state.doc.child(index)
    const element = view.dom.children.item(index)
    const blockFrom = pos
    const blockTo = pos + node.nodeSize

    pos = blockTo

    if (!element) {
      continue
    }

    const blockRect = element.getBoundingClientRect()
    const isSelectedByRect = rectsIntersect(marqueeClientRect, blockRect)
    const isSelectedBySideGutter =
      useVerticalRowHitTest && verticalRangesIntersect(marqueeClientRect, blockRect)

    if (!isSelectedByRect && !isSelectedBySideGutter) {
      continue
    }

    from = from ?? blockFrom
    to = blockTo
  }

  return from !== null && to !== null ? { from, to } : null
}

function clearBlockSelectionNearPoint(view: EditorView, point: Point) {
  const position = view.posAtCoords({ left: point.x, top: point.y })?.pos ?? view.state.selection.from
  const safePosition = Math.max(1, Math.min(position, view.state.doc.content.size))

  view.dispatch(
    view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(safePosition), -1))
  )
}

function isBlockSelectionActive(view: EditorView) {
  return isNodeRangeSelection(view.state.selection)
}

function findTopLevelBlockElement(view: EditorView, target: Element) {
  for (const child of Array.from(view.dom.children)) {
    if (child.contains(target)) {
      return child
    }
  }

  return null
}

function startsInsideTopLevelBlock(view: EditorView, event: MouseEvent) {
  const target = event.target

  return target instanceof Element && findTopLevelBlockElement(view, target) !== null
}

function canStartMarqueeFromBlockWhitespace(blockElement: Element, event: MouseEvent) {
  if (!isTextEditableBlockElement(blockElement)) {
    return false
  }

  if (!blockElement.textContent?.trim()) {
    return false
  }

  return !pointIntersectsRenderedText(blockElement, event.clientX, event.clientY)
}

function isTextEditableBlockElement(element: Element) {
  return ["BLOCKQUOTE", "H1", "H2", "OL", "P", "PRE", "UL"].includes(element.tagName)
}

function pointIntersectsRenderedText(element: Element, x: number, y: number) {
  const textNodes = getTextNodes(element)

  for (const textNode of textNodes) {
    if (textNode.textContent?.trim()) {
      const range = document.createRange()

      range.selectNodeContents(textNode)

      for (const rect of Array.from(range.getClientRects())) {
        if (pointIntersectsTextRect(rect, x, y)) {
          return true
        }
      }
    }
  }

  return false
}

function getTextNodes(root: Node) {
  const textNodes: Text[] = []

  root.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      textNodes.push(node as Text)
      return
    }

    getTextNodes(node).forEach((textNode) => textNodes.push(textNode))
  })

  return textNodes
}

function pointIntersectsTextRect(rect: DOMRect, x: number, y: number) {
  const horizontalPadding = 4
  const verticalPadding = 3

  return (
    x >= rect.left - horizontalPadding &&
    x <= rect.right + horizontalPadding &&
    y >= rect.top - verticalPadding &&
    y <= rect.bottom + verticalPadding
  )
}

function getTopLevelBlockRail(view: EditorView) {
  let left: number | null = null
  let right: number | null = null

  for (const element of Array.from(view.dom.children)) {
    const rect = element.getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0) {
      continue
    }

    left = left === null ? rect.left : Math.min(left, rect.left)
    right = right === null ? rect.right : Math.max(right, rect.right)
  }

  return left === null || right === null ? null : { left, right }
}

function normalizeRect(origin: Point, current: Point) {
  let left = Math.min(origin.x, current.x)
  let top = Math.min(origin.y, current.y)
  let width = Math.abs(current.x - origin.x)
  let height = Math.abs(current.y - origin.y)

  if (width < MARQUEE_MIN_WIDTH) {
    left -= (MARQUEE_MIN_WIDTH - width) / 2
    width = MARQUEE_MIN_WIDTH
  }

  if (height < MARQUEE_MIN_HEIGHT) {
    top -= (MARQUEE_MIN_HEIGHT - height) / 2
    height = MARQUEE_MIN_HEIGHT
  }

  return {
    height,
    left,
    top,
    width,
  }
}

function rectsIntersect(
  a: { bottom: number; left: number; right: number; top: number },
  b: { bottom: number; left: number; right: number; top: number }
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function verticalRangesIntersect(
  a: { bottom: number; top: number },
  b: { bottom: number; top: number }
) {
  return a.top < b.bottom && a.bottom > b.top
}

function clearWindowSelection() {
  const selection = window.getSelection()

  if (selection && !selection.isCollapsed) {
    selection.removeAllRanges()
  }
}
