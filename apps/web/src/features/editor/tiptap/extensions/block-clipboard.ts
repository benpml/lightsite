import { Extension, type JSONContent } from "@tiptap/core"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Plugin } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import type { Editor } from "@tiptap/react"

import { stripHandoutUniqueIds } from "./block-commands"
import { getSelectedBlockRanges, type BlockRange } from "./block-selection"

const HANDOUT_BLOCK_CLIPBOARD_MIME = "application/x-handout-blocks+json"
const HANDOUT_BLOCK_CLIPBOARD_ATTRIBUTE = "data-handout-block-clipboard"
const HANDOUT_BLOCK_CLIPBOARD_SESSION_KEY = "handout:block-clipboard:v1"
const HANDOUT_BLOCK_CLIPBOARD_VERSION = 1
const MAX_CLIPBOARD_BLOCKS = 200
const MAX_CLIPBOARD_PAYLOAD_LENGTH = 2_000_000

export type HandoutBlockClipboardPayload = {
  blocks: JSONContent[]
  version: typeof HANDOUT_BLOCK_CLIPBOARD_VERSION
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    handoutNextBlockClipboard: {
      duplicateHandoutNextSelectedBlocks: (targetPos?: number) => ReturnType
      insertHandoutNextBlockClipboard: (
        payload: HandoutBlockClipboardPayload,
        targetPos?: number
      ) => ReturnType
    }
  }
}

let cachedBlockClipboard: HandoutBlockClipboardPayload | null = null

export const HandoutNextBlockClipboard = Extension.create({
  name: "handoutNextBlockClipboard",

  addCommands() {
    return {
      duplicateHandoutNextSelectedBlocks:
        (targetPos) =>
        ({ state, dispatch, view }) => {
          const payload = createHandoutBlockClipboardPayload(state, targetPos)

          if (!payload) {
            return false
          }

          const tr = createInsertHandoutBlockClipboardTransaction(
            state,
            payload,
            targetPos,
            false
          )

          if (!tr) {
            return false
          }

          if (dispatch) {
            dispatch(tr)
            view.focus()
          }

          return true
        },
      insertHandoutNextBlockClipboard:
        (payload, targetPos) =>
        ({ state, dispatch, view }) => {
          const tr = createInsertHandoutBlockClipboardTransaction(
            state,
            payload,
            targetPos
          )

          if (!tr) {
            return false
          }

          if (dispatch) {
            dispatch(tr)
            view.focus()
          }

          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            copy: (view, event) => copySelectedBlocksFromNativeEvent(view, event),
          },
          handlePaste: (view, event) => pasteBlocksFromNativeEvent(view, event),
        },
      }),
    ]
  },
})

export function createHandoutBlockClipboardPayload(
  state: EditorState,
  targetPos?: number
): HandoutBlockClipboardPayload | null {
  const ranges = getActionBlockRanges(state, targetPos)

  if (ranges.length === 0) {
    return null
  }

  const blocks: JSONContent[] = []

  for (const range of ranges) {
    state.doc.slice(range.from, range.to).content.forEach((node) => {
      blocks.push(stripHandoutUniqueIds(node.toJSON()))
    })
  }

  return normalizeHandoutBlockClipboardPayload({
    blocks,
    version: HANDOUT_BLOCK_CLIPBOARD_VERSION,
  })
}

export function createInsertHandoutBlockClipboardTransaction(
  state: EditorState,
  input: HandoutBlockClipboardPayload,
  targetPos?: number,
  replaceEmptyTarget = true
): Transaction | null {
  const payload = normalizeHandoutBlockClipboardPayload(input)

  if (!payload) {
    return null
  }

  const ranges = getInsertionBlockRanges(state, targetPos)
  const replacementRange =
    replaceEmptyTarget && ranges.length === 1
      ? getEmptyTextBlockRange(state.doc, ranges[0])
      : null
  const insertionPos = replacementRange?.from ?? ranges.at(-1)?.to

  if (typeof insertionPos !== "number") {
    return null
  }

  try {
    const nodes = payload.blocks.map((block) => {
      const node = state.schema.nodeFromJSON(stripHandoutUniqueIds(block))
      node.check()

      if (!node.type.isInGroup("block")) {
        throw new Error("Clipboard content must contain complete block nodes.")
      }

      return node
    })
    const content = Fragment.fromArray(nodes)
    const tr = replacementRange
      ? state.tr.replaceWith(
          replacementRange.from,
          replacementRange.to,
          content
        )
      : state.tr.insert(insertionPos, content)

    return tr
      .setSelection(
        NodeRangeSelection.create(
          tr.doc,
          insertionPos,
          insertionPos + content.size,
          0
        )
      )
      .scrollIntoView()
  } catch {
    return null
  }
}

export function getCachedHandoutBlockClipboard() {
  if (cachedBlockClipboard) {
    return cachedBlockClipboard
  }

  if (typeof window === "undefined") {
    return null
  }

  try {
    const serialized = window.sessionStorage.getItem(
      HANDOUT_BLOCK_CLIPBOARD_SESSION_KEY
    )
    const payload = serialized
      ? parseHandoutBlockClipboardPayload(serialized)
      : null

    cachedBlockClipboard = payload
    return payload
  } catch {
    return null
  }
}

export async function readHandoutBlockClipboard() {
  if (typeof navigator !== "undefined" && navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read()

      for (const item of items) {
        const customPayload = await readClipboardItemPayload(
          item,
          HANDOUT_BLOCK_CLIPBOARD_MIME
        )

        if (customPayload) {
          rememberHandoutBlockClipboard(customPayload)
          return customPayload
        }

        const htmlPayload = await readClipboardItemPayload(item, "text/html")

        if (htmlPayload) {
          rememberHandoutBlockClipboard(htmlPayload)
          return htmlPayload
        }
      }

      forgetHandoutBlockClipboard()
      return null
    } catch {
      // Clipboard read permissions vary by browser. The in-session payload is
      // still authoritative when the browser does not expose clipboard reads.
    }
  }

  return getCachedHandoutBlockClipboard()
}

export async function writeSelectedHandoutBlocksToClipboard(
  editor: Editor,
  targetPos?: number
) {
  const payload = createHandoutBlockClipboardPayload(editor.state, targetPos)

  if (!payload) {
    return false
  }

  const serialized = serializeHandoutBlockClipboard(editor.view, payload)

  if (!serialized) {
    return false
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.write &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([serialized.html], { type: "text/html" }),
          "text/plain": new Blob([serialized.text], { type: "text/plain" }),
        }),
      ])
      rememberHandoutBlockClipboard(payload)
      return true
    } catch {
      // Fall through to the native copy event, which supports the custom MIME
      // type and is available in older browser implementations.
    }
  }

  if (
    typeof document !== "undefined" &&
    typeof document.execCommand === "function" &&
    document.execCommand("copy")
  ) {
    return true
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(serialized.text)
      rememberHandoutBlockClipboard(payload)
      return true
    } catch {
      return false
    }
  }

  return false
}

export function parseHandoutBlockClipboardPayload(
  serialized: string
): HandoutBlockClipboardPayload | null {
  if (
    serialized.length === 0 ||
    serialized.length > MAX_CLIPBOARD_PAYLOAD_LENGTH
  ) {
    return null
  }

  try {
    return normalizeHandoutBlockClipboardPayload(JSON.parse(serialized))
  } catch {
    return null
  }
}

function copySelectedBlocksFromNativeEvent(
  view: EditorView,
  event: ClipboardEvent
) {
  const payload = createHandoutBlockClipboardPayload(view.state)
  const clipboardData = event.clipboardData

  if (!payload || !clipboardData) {
    return false
  }

  const serialized = serializeHandoutBlockClipboard(view, payload)

  if (!serialized) {
    return false
  }

  clipboardData.setData("text/html", serialized.html)
  clipboardData.setData("text/plain", serialized.text)

  try {
    clipboardData.setData(
      HANDOUT_BLOCK_CLIPBOARD_MIME,
      JSON.stringify(payload)
    )
  } catch {
    // The HTML marker remains available when a browser rejects custom MIME.
  }

  rememberHandoutBlockClipboard(payload)
  event.preventDefault()

  return true
}

function pasteBlocksFromNativeEvent(
  view: EditorView,
  event: ClipboardEvent
) {
  const payload = readHandoutBlockClipboardFromDataTransfer(
    event.clipboardData
  )

  if (!payload) {
    return false
  }

  const tr = createInsertHandoutBlockClipboardTransaction(
    view.state,
    payload
  )

  if (!tr) {
    return false
  }

  rememberHandoutBlockClipboard(payload)
  event.preventDefault()
  view.dispatch(tr)
  view.focus()

  return true
}

function serializeHandoutBlockClipboard(
  view: EditorView,
  payload: HandoutBlockClipboardPayload
) {
  if (typeof document === "undefined") {
    return null
  }

  try {
    const nodes = payload.blocks.map((block) =>
      view.state.schema.nodeFromJSON(block)
    )
    const serialized = view.serializeForClipboard(
      new Slice(Fragment.fromArray(nodes), 0, 0)
    )
    const wrapper = document.createElement("div")

    wrapper.setAttribute(
      HANDOUT_BLOCK_CLIPBOARD_ATTRIBUTE,
      encodeURIComponent(JSON.stringify(payload))
    )
    wrapper.append(...Array.from(serialized.dom.childNodes))

    return {
      html: wrapper.outerHTML,
      text: serialized.text,
    }
  } catch {
    return null
  }
}

function readHandoutBlockClipboardFromDataTransfer(
  clipboardData: DataTransfer | null
) {
  if (!clipboardData) {
    return null
  }

  const customPayload = parseHandoutBlockClipboardPayload(
    clipboardData.getData(HANDOUT_BLOCK_CLIPBOARD_MIME)
  )

  return (
    customPayload ||
    parseHandoutBlockClipboardHtml(clipboardData.getData("text/html"))
  )
}

async function readClipboardItemPayload(
  item: ClipboardItem,
  type: string
) {
  if (!item.types.includes(type)) {
    return null
  }

  try {
    const serialized = await (await item.getType(type)).text()

    return type === "text/html"
      ? parseHandoutBlockClipboardHtml(serialized)
      : parseHandoutBlockClipboardPayload(serialized)
  } catch {
    return null
  }
}

function parseHandoutBlockClipboardHtml(html: string) {
  if (!html || typeof DOMParser === "undefined") {
    return null
  }

  try {
    const document = new DOMParser().parseFromString(html, "text/html")
    const marker = document.querySelector<HTMLElement>(
      `[${HANDOUT_BLOCK_CLIPBOARD_ATTRIBUTE}]`
    )
    const serialized = marker?.getAttribute(
      HANDOUT_BLOCK_CLIPBOARD_ATTRIBUTE
    )

    return serialized
      ? parseHandoutBlockClipboardPayload(decodeURIComponent(serialized))
      : null
  } catch {
    return null
  }
}

function normalizeHandoutBlockClipboardPayload(
  input: unknown
): HandoutBlockClipboardPayload | null {
  if (!input || typeof input !== "object") {
    return null
  }

  const candidate = input as Partial<HandoutBlockClipboardPayload>
  let serializedLength: number

  try {
    serializedLength = JSON.stringify(candidate).length
  } catch {
    return null
  }

  if (
    serializedLength > MAX_CLIPBOARD_PAYLOAD_LENGTH ||
    candidate.version !== HANDOUT_BLOCK_CLIPBOARD_VERSION ||
    !Array.isArray(candidate.blocks) ||
    candidate.blocks.length === 0 ||
    candidate.blocks.length > MAX_CLIPBOARD_BLOCKS ||
    candidate.blocks.some(
      (block) =>
        !block ||
        typeof block !== "object" ||
        typeof (block as JSONContent).type !== "string"
    )
  ) {
    return null
  }

  return {
    blocks: candidate.blocks.map((block) => ({ ...block })),
    version: HANDOUT_BLOCK_CLIPBOARD_VERSION,
  }
}

function rememberHandoutBlockClipboard(
  payload: HandoutBlockClipboardPayload
) {
  cachedBlockClipboard = payload

  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(
      HANDOUT_BLOCK_CLIPBOARD_SESSION_KEY,
      JSON.stringify(payload)
    )
  } catch {
    // The in-memory payload remains available if storage is disabled or full.
  }
}

function forgetHandoutBlockClipboard() {
  cachedBlockClipboard = null

  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.removeItem(HANDOUT_BLOCK_CLIPBOARD_SESSION_KEY)
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

function getEmptyTextBlockRange(
  doc: ProseMirrorNode,
  range: BlockRange | undefined
) {
  if (!range) {
    return null
  }

  const node = doc.nodeAt(range.from)

  return node?.isTextblock &&
    node.content.size === 0 &&
    range.to === range.from + node.nodeSize
    ? range
    : null
}

function getInsertionBlockRanges(
  state: EditorState,
  targetPos?: number
) {
  const ranges = getActionBlockRanges(state, targetPos)

  if (ranges.length > 0) {
    return ranges
  }

  const selectionTarget = findBlockRangeAt(
    state.doc,
    state.selection.from
  )

  return selectionTarget ? [selectionTarget] : []
}

function getActionBlockRanges(
  state: EditorState,
  targetPos?: number
) {
  const selectedRanges = getSelectedBlockRanges(
    state.doc,
    state.selection
  )

  if (typeof targetPos !== "number") {
    return selectedRanges
  }

  const targetRange = findBlockRangeAt(state.doc, targetPos)

  if (!targetRange) {
    return []
  }

  return selectedRanges.some(
    (range) => targetRange.from >= range.from && targetRange.to <= range.to
  )
    ? selectedRanges
    : [targetRange]
}

function findBlockRangeAt(
  doc: ProseMirrorNode,
  inputPosition: number
): BlockRange | null {
  const position = Math.max(0, Math.min(inputPosition, doc.content.size))
  const directNode = doc.nodeAt(position)

  if (directNode?.type.isInGroup("block")) {
    return {
      from: position,
      to: position + directNode.nodeSize,
    }
  }

  const $position = doc.resolve(position)

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.isInGroup("block")) {
      const from = $position.before(depth)

      return { from, to: from + node.nodeSize }
    }
  }

  const adjacentNode = $position.nodeBefore ?? $position.nodeAfter

  if (!adjacentNode?.type.isInGroup("block")) {
    return null
  }

  const from = $position.nodeBefore
    ? position - adjacentNode.nodeSize
    : position

  return { from, to: from + adjacentNode.nodeSize }
}
