import { Extension } from "@tiptap/core"
import { isNodeRangeSelection, NodeRangeSelection } from "@tiptap/extension-node-range"
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

import { isEditorContentNode } from "./editor-blocks"

const dragThreshold = 4

let activeBlockDragSession = false

type MarqueeState = {
  active: boolean
  element: HTMLDivElement | null
  lastSelectionKey: string
  startX: number
  startY: number
}

export type ContentBlockEntry = {
  contentIndex: number
  element: HTMLElement
  from: number
  node: ProseMirrorNode
  to: number
}

type BlockDragCallbacks = {
  onDragEnd?: () => void
  onDragStart?: () => void
  onPressWithoutDrag?: () => void
}

type BlockDragState = {
  active: boolean
  dropIndex: number | null
  lineElement: HTMLDivElement | null
  sourceEntries: ContentBlockEntry[]
  startX: number
  startY: number
}

export const LightsiteBlockSelection = Extension.create({
  name: "lightsiteBlockSelection",
  priority: 1001,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("lightsiteBlockSelection"),
        view: (view) => {
          const handleDocumentMouseDown = (event: MouseEvent) => {
            if (!view.editable || event.button !== 0 || !canStartMarqueeSelection(view, event)) {
              return
            }

            startLightsiteMarqueeSelection(view, event)
          }

          document.addEventListener("mousedown", handleDocumentMouseDown, true)

          return {
            destroy() {
              document.removeEventListener("mousedown", handleDocumentMouseDown, true)
            },
          }
        },
        props: {
          handleKeyDown: (view, event) => {
            if (
              event.key !== "Backspace" &&
              event.key !== "Delete"
            ) {
              return false
            }

            const transaction = createDeleteBlockSelectionTransaction(view.state)

            if (!transaction) {
              return false
            }

            event.preventDefault()
            view.dispatch(transaction)

            return true
          },
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (!view.editable || event.button !== 0) {
                return false
              }

              const target = event.target

              if (!(target instanceof Element) || !view.dom.contains(target)) {
                return false
              }

              if (!shouldLetBrowserHandleEvent(event)) {
                const sourceElement = findClosestContentBlockElement(view, target)

                if (sourceElement) {
                  startLightsiteBlockDrag(view, event, sourceElement)
                  return true
                }
              }

              return false
            },
          },
        },
      }),
    ]
  },
})

function canStartMarqueeSelection(view: EditorView, event: MouseEvent) {
  const target = event.target

  if (!(target instanceof Element)) {
    return false
  }

  if (shouldLetBrowserHandleEvent(event) || findClosestContentBlockElement(view, target)) {
    return false
  }

  return Boolean(target.closest("[data-editor-page], .lightsite-document-editor"))
}

export function startLightsiteMarqueeSelection(view: EditorView, event: MouseEvent) {
  const state: MarqueeState = {
    active: false,
    element: null,
    lastSelectionKey: "",
    startX: event.clientX,
    startY: event.clientY,
  }

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - state.startX
    const deltaY = moveEvent.clientY - state.startY

    if (!state.active && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return
    }

    if (!state.active) {
      state.active = true
      state.element = createMarqueeElement()
      document.body.classList.add("lightsite-editor-marquee-active")
    }

    moveEvent.preventDefault()
    updateMarqueeElement(state.element, state.startX, state.startY, moveEvent.clientX, moveEvent.clientY)
    updateNodeRangeSelection(view, state)
  }

  const handleMouseUp = (upEvent: MouseEvent) => {
    if (state.active) {
      updateMarqueeElement(
        state.element,
        state.startX,
        state.startY,
        upEvent.clientX,
        upEvent.clientY
      )
      updateNodeRangeSelection(view, state)
      view.focus()
    }

    document.removeEventListener("mousemove", handleMouseMove, true)
    document.removeEventListener("mouseup", handleMouseUp, true)
    document.body.classList.remove("lightsite-editor-marquee-active")
    state.element?.remove()
  }

  document.addEventListener("mousemove", handleMouseMove, true)
  document.addEventListener("mouseup", handleMouseUp, true)
}

export function startLightsiteBlockDrag(
  view: EditorView,
  event: MouseEvent | PointerEvent,
  sourceElement: HTMLElement,
  callbacks: BlockDragCallbacks = {}
) {
  if (activeBlockDragSession) {
    return
  }

  const entries = getContentBlockEntries(view)
  const sourceEntry = entries.find((entry) => entry.element === sourceElement)

  if (!sourceEntry) {
    return
  }

  activeBlockDragSession = true
  event.preventDefault()
  event.stopPropagation()

  const state: BlockDragState = {
    active: false,
    dropIndex: null,
    lineElement: null,
    sourceEntries: getDragSourceEntries(view, entries, sourceEntry),
    startX: event.clientX,
    startY: event.clientY,
  }
  const usesPointerEvents = "pointerId" in event
  const moveEventName = usesPointerEvents ? "pointermove" : "mousemove"
  const upEventName = usesPointerEvents ? "pointerup" : "mouseup"
  const cancelEventName = usesPointerEvents ? "pointercancel" : null

  const cleanupBlockDrag = () => {
    document.removeEventListener(moveEventName, handlePointerMove as EventListener, true)
    document.removeEventListener(upEventName, handlePointerUp as EventListener, true)

    if (cancelEventName) {
      document.removeEventListener(cancelEventName, handlePointerCancel as EventListener, true)
    }

    window.removeEventListener("blur", handleWindowBlur)
    document.body.classList.remove("lightsite-editor-block-drag-active")
    state.lineElement?.remove()
    activeBlockDragSession = false
  }

  const handlePointerMove = (moveEvent: MouseEvent | PointerEvent) => {
    const deltaX = moveEvent.clientX - state.startX
    const deltaY = moveEvent.clientY - state.startY

    if (!state.active && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return
    }

    if (!state.active) {
      state.active = true
      state.lineElement = createDropLineElement()
      document.body.classList.add("lightsite-editor-block-drag-active")
      callbacks.onDragStart?.()
      window.getSelection()?.removeAllRanges()
    }

    moveEvent.preventDefault()

    const currentEntries = getContentBlockEntries(view)
    const dropTarget = getDropTarget(currentEntries, state.sourceEntries, moveEvent.clientY)

    state.dropIndex = dropTarget.dropIndex
    updateDropLineElement(view, state.lineElement, dropTarget)
  }

  const handlePointerUp = (upEvent: MouseEvent | PointerEvent) => {
    cleanupBlockDrag()

    if (!state.active) {
      callbacks.onPressWithoutDrag?.()
      return
    }

    callbacks.onDragEnd?.()

    const currentEntries = getContentBlockEntries(view)
    const dropTarget = getDropTarget(currentEntries, state.sourceEntries, upEvent.clientY)

    commitBlockDrag(view, state.sourceEntries, dropTarget.dropIndex)
  }

  const handlePointerCancel = () => {
    cleanupBlockDrag()
    callbacks.onDragEnd?.()
  }

  const handleWindowBlur = () => {
    cleanupBlockDrag()
    callbacks.onDragEnd?.()
  }

  document.addEventListener(moveEventName, handlePointerMove as EventListener, true)
  document.addEventListener(upEventName, handlePointerUp as EventListener, true)

  if (cancelEventName) {
    document.addEventListener(cancelEventName, handlePointerCancel as EventListener, true)
  }

  window.addEventListener("blur", handleWindowBlur)
}

export function getContentBlockEntryFromTarget(view: EditorView, target: Element) {
  const element = findClosestContentBlockElement(view, target)

  if (!element) {
    return null
  }

  return getContentBlockEntries(view).find((entry) => entry.element === element) ?? null
}

export function createDeleteBlockSelectionTransaction(
  state: EditorState
): Transaction | null {
  if (!isNodeRangeSelection(state.selection)) {
    return null
  }

  let transaction = state.tr.deleteSelection()

  if (transaction.doc.childCount === 0) {
    const fallbackNodeType = state.schema.nodes.textBlock ?? state.schema.nodes.paragraph

    if (fallbackNodeType) {
      const fallbackNode =
        fallbackNodeType.name === "textBlock"
          ? fallbackNodeType.create({ temporary: true })
          : fallbackNodeType.create()

      transaction = transaction.insert(0, fallbackNode)

      try {
        transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(1), 1))
      } catch {
        // Selection placement is best-effort; preserving a valid document is the important part.
      }
    }
  }

  if (transaction.doc.childCount === 1) {
    const onlyChild = transaction.doc.child(0)

    if (
      onlyChild.type.name === "textBlock" &&
      onlyChild.textContent.trim() === "" &&
      onlyChild.attrs.temporary !== true
    ) {
      transaction = transaction.setNodeMarkup(0, onlyChild.type, {
        ...onlyChild.attrs,
        temporary: true,
      })
    }
  }

  return transaction.scrollIntoView()
}

function shouldLetBrowserHandleEvent(event: MouseEvent) {
  const target = event.target

  if (!(target instanceof Element)) {
    return false
  }

  if (target.matches("[contenteditable='true']")) {
    return true
  }

  if (target.closest(".lightsite-document-editor > ul, .lightsite-document-editor > ol")) {
    return true
  }

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        "[role='button']",
        "[data-editor-text-content]",
        "[data-node-view-content]",
        "[data-radix-popper-content-wrapper]",
        "[data-lightsite-block-controls]",
      ].join(",")
    )
  )
}

function findClosestContentBlockElement(view: EditorView, target: Element) {
  const block = target.closest<HTMLElement>("[data-block-wrapper-type]")

  if (block && view.dom.contains(block)) {
    return block
  }

  let element: Element | null = target

  while (element && element !== view.dom) {
    if (
      element instanceof HTMLElement &&
      (element.tagName === "UL" || element.tagName === "OL") &&
      element.parentElement === view.dom
    ) {
      return element
    }

    element = element.parentElement
  }

  return null
}

function getContentBlockEntries(view: EditorView) {
  const elements = Array.from(
    view.dom.querySelectorAll<HTMLElement>(
      ":scope > .react-renderer > [data-block-wrapper-type], :scope > ul, :scope > ol"
    )
  )
  const entries: ContentBlockEntry[] = []
  let elementIndex = 0
  let contentIndex = 0

  view.state.doc.forEach((node, offset) => {
    if (!isEditorContentNode(node.type.name)) {
      return
    }

    const element = elements[elementIndex]
    elementIndex += 1

    if (!element) {
      contentIndex += 1
      return
    }

    entries.push({
      contentIndex,
      element,
      from: offset,
      node,
      to: offset + node.nodeSize,
    })
    contentIndex += 1
  })

  return entries
}

function getDragSourceEntries(
  view: EditorView,
  entries: ContentBlockEntry[],
  sourceEntry: ContentBlockEntry
) {
  const { selection } = view.state

  if (
    !isNodeRangeSelection(selection) ||
    !selection.ranges.some(
      (range) => sourceEntry.from >= range.$from.pos && sourceEntry.to <= range.$to.pos
    )
  ) {
    return [sourceEntry]
  }

  const selectedEntries = entries.filter((entry) =>
    selection.ranges.some((range) => entry.from >= range.$from.pos && entry.to <= range.$to.pos)
  )

  return selectedEntries.length > 0 ? selectedEntries : [sourceEntry]
}

function createDropLineElement() {
  const element = document.createElement("div")

  element.className = "lightsite-editor-drop-line"
  document.body.appendChild(element)

  return element
}

function getDropTarget(
  entries: ContentBlockEntry[],
  sourceEntries: ContentBlockEntry[],
  clientY: number
) {
  const sourceIndexes = new Set(sourceEntries.map((entry) => entry.contentIndex))
  const remainingEntries = entries.filter((entry) => !sourceIndexes.has(entry.contentIndex))

  for (let index = 0; index < remainingEntries.length; index += 1) {
    const rect = remainingEntries[index].element.getBoundingClientRect()

    if (clientY < rect.top + rect.height / 2) {
      return { dropIndex: index, remainingEntries }
    }
  }

  return { dropIndex: remainingEntries.length, remainingEntries }
}

function updateDropLineElement(
  view: EditorView,
  element: HTMLDivElement | null,
  target: ReturnType<typeof getDropTarget>
) {
  if (!element) {
    return
  }

  const targetEntry = target.remainingEntries[target.dropIndex]
  const previousEntry = target.remainingEntries[target.dropIndex - 1]
  const referenceEntry = targetEntry ?? previousEntry

  if (!referenceEntry) {
    const editorRect = view.dom.getBoundingClientRect()

    element.style.transform = `translate3d(${editorRect.left}px, ${editorRect.top - 0.5}px, 0)`
    element.style.width = `${editorRect.width}px`
    return
  }

  const referenceRect = referenceEntry.element.getBoundingClientRect()
  let top = referenceRect.top

  if (targetEntry) {
    top = targetEntry.element.getBoundingClientRect().top
  } else if (previousEntry) {
    top = previousEntry.element.getBoundingClientRect().bottom
  }

  element.style.transform = `translate3d(${referenceRect.left}px, ${top - 0.5}px, 0)`
  element.style.width = `${referenceRect.width}px`
}

function commitBlockDrag(
  view: EditorView,
  sourceEntries: ContentBlockEntry[],
  dropIndex: number
) {
  const sourceIndexes = new Set(sourceEntries.map((entry) => entry.contentIndex))
  const sourceNodes = sourceEntries.map((entry) => entry.node)
  const originalChildren: ProseMirrorNode[] = []
  const nextChildren: ProseMirrorNode[] = []
  let contentIndex = 0
  let remainingIndex = 0
  let insertedMovedNodes = false
  let movedFrom = 0
  let nextOffset = 0

  function pushNode(node: ProseMirrorNode) {
    nextChildren.push(node)
    nextOffset += node.nodeSize
  }

  function pushMovedNodes() {
    if (insertedMovedNodes) {
      return
    }

    movedFrom = nextOffset
    sourceNodes.forEach(pushNode)
    insertedMovedNodes = true
  }

  view.state.doc.forEach((node) => {
    originalChildren.push(node)

    if (!isEditorContentNode(node.type.name)) {
      pushNode(node)
      return
    }

    if (!sourceIndexes.has(contentIndex)) {
      if (remainingIndex === dropIndex) {
        pushMovedNodes()
      }

      pushNode(node)
      remainingIndex += 1
    }

    contentIndex += 1
  })

  if (!insertedMovedNodes) {
    pushMovedNodes()
  }

  if (
    nextChildren.length === originalChildren.length &&
    nextChildren.every((node, index) => node === originalChildren[index])
  ) {
    return
  }

  const transaction = view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    Fragment.fromArray(nextChildren)
  )

  setCursorNearMovedContent(transaction, movedFrom, sourceNodes[0])

  view.dispatch(transaction.scrollIntoView())
}

function setCursorNearMovedContent(
  transaction: Transaction,
  movedFrom: number,
  firstMovedNode: ProseMirrorNode | undefined
) {
  const movedNodeSize = firstMovedNode?.nodeSize ?? 1
  const selectionPosition = Math.min(
    transaction.doc.content.size,
    Math.max(1, movedFrom + movedNodeSize)
  )

  try {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition), 1))
  } catch {
    // Cursor placement is best-effort after a successful reorder.
  }
}

function createMarqueeElement() {
  const element = document.createElement("div")

  element.className = "lightsite-editor-marquee"
  document.body.appendChild(element)

  return element
}

function updateMarqueeElement(
  element: HTMLDivElement | null,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
) {
  if (!element) {
    return
  }

  const left = Math.min(startX, currentX)
  const top = Math.min(startY, currentY)
  const width = Math.abs(currentX - startX)
  const height = Math.abs(currentY - startY)

  element.style.transform = `translate3d(${left}px, ${top}px, 0)`
  element.style.width = `${width}px`
  element.style.height = `${height}px`
}

function updateNodeRangeSelection(view: EditorView, state: MarqueeState) {
  if (!state.element) {
    return
  }

  const marqueeRect = state.element.getBoundingClientRect()
  const selectedEntries = getContentBlockEntries(view).filter((entry) =>
    rectanglesIntersect(marqueeRect, entry.element.getBoundingClientRect())
  )

  if (selectedEntries.length === 0) {
    state.lastSelectionKey = ""
    return
  }

  const firstEntry = selectedEntries[0]
  const lastEntry = selectedEntries[selectedEntries.length - 1]

  const selectionKey = `${firstEntry.from}:${lastEntry.to}`

  if (selectionKey === state.lastSelectionKey) {
    return
  }

  state.lastSelectionKey = selectionKey

  try {
    const selection = NodeRangeSelection.create(view.state.doc, firstEntry.from, lastEntry.to, 0)
    view.dispatch(view.state.tr.setSelection(selection).setMeta("addToHistory", false))
  } catch {
    // The marquee is a convenience layer; a transient invalid coordinate should not break editing.
  }
}

function rectanglesIntersect(left: DOMRect, right: DOMRect) {
  return (
    left.left <= right.right &&
    left.right >= right.left &&
    left.top <= right.bottom &&
    left.bottom >= right.top
  )
}
