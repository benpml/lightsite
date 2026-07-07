import { Extension, InputRule } from "@tiptap/core"
import type { Editor as TiptapEditor } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Plugin, TextSelection } from "@tiptap/pm/state"

import {
  createTemporaryTextBlock,
  getTopLevelBlockRange,
  setSelectionInsideInsertedNode,
} from "./editor-blocks"

export const LightsiteDocumentBehavior = Extension.create({
  name: "lightsiteDocumentBehavior",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: () => handleLightsiteBackspace(this.editor),
      Enter: () => handleLightsiteEnter(this.editor),
    }
  },

  addInputRules() {
    return [
      createListShortcutInputRule("bulletList", /^\s*[-+*]\s$/),
      createListShortcutInputRule("orderedList", /^\s*\d+\.\s$/),
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          return normalizeTopLevelParagraphs(newState)
        },
      }),
    ]
  },
})

function createListShortcutInputRule(listTypeName: "bulletList" | "orderedList", find: RegExp) {
  return new InputRule({
    find,
    handler: ({ chain }) => {
      chain()
        .command(({ state, tr }) => {
          const range = getTopLevelBlockRange(state)
          const listType = state.schema.nodes[listTypeName]
          const listItemType = state.schema.nodes.listItem
          const paragraphType = state.schema.nodes.paragraph

          if (
            !range ||
            !listType ||
            !listItemType ||
            !paragraphType ||
            (range.node.type.name !== "textBlock" && range.node.type.name !== "paragraph")
          ) {
            return false
          }

          const listNode = listType.create(null, listItemType.create(null, paragraphType.create()))
          tr.replaceWith(range.from, range.to, listNode)
          setSelectionInsideInsertedNode(tr, range.from, listNode)

          tr.scrollIntoView()
          return true
        })
        .run()
    },
  })
}

function normalizeTopLevelParagraphs(state: EditorState) {
  const textBlockType = state.schema.nodes.textBlock

  if (!textBlockType) {
    return null
  }

  let transaction = state.tr
  let changed = false

  state.doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph") {
      return
    }

    changed = true
    transaction = transaction.setNodeMarkup(
      offset,
      textBlockType,
      { temporary: false },
      node.marks
    )
  })

  return changed ? transaction : null
}

function handleLightsiteEnter(editor: TiptapEditor) {
  if (exitEmptyIconListItem(editor)) {
    return true
  }

  if (insertTextBlockAfterFinishedHeading(editor)) {
    return true
  }

  return false
}

function handleLightsiteBackspace(editor: TiptapEditor) {
  const iconListItemTransaction = createDeleteEmptyIconListItemTransaction(editor.state)

  if (iconListItemTransaction) {
    editor.view.dispatch(iconListItemTransaction.scrollIntoView())
    editor.view.focus()

    return true
  }

  const transaction = createLightsiteBackspaceTransaction(editor.state)

  if (!transaction) {
    return false
  }

  editor.view.dispatch(transaction.scrollIntoView())
  editor.view.focus()

  return true
}

export function createDeleteEmptyIconListItemTransaction(
  state: EditorState
): Transaction | null {
  const { selection } = state

  if (!(selection instanceof TextSelection) || !selection.empty) {
    return null
  }

  const iconListItemDepth = findAncestorDepth(state, "iconListItem")

  if (iconListItemDepth === null || selection.$from.parent.textContent.trim() !== "") {
    return null
  }

  const iconListDepth = iconListItemDepth - 1
  const iconListNode = selection.$from.node(iconListDepth)

  if (iconListNode.type.name !== "iconList") {
    return null
  }

  const itemIndex = selection.$from.index(iconListDepth)
  const itemStart = selection.$from.before(iconListItemDepth)
  const itemEnd = selection.$from.after(iconListItemDepth)
  const listStart = selection.$from.before(iconListDepth)
  const listEnd = selection.$from.after(iconListDepth)

  if (iconListNode.childCount <= 1) {
    const temporaryTextNode = state.schema.nodeFromJSON(createTemporaryTextBlock())
    const transaction = state.tr.replaceWith(listStart, listEnd, temporaryTextNode)

    setSelectionInsideInsertedNode(transaction, listStart, temporaryTextNode)

    return transaction
  }

  const transaction = state.tr.delete(itemStart, itemEnd)
  const selectionPosition =
    itemIndex === 0
      ? itemStart + 1
      : Math.max(listStart + 1, transaction.mapping.map(itemStart) - 1)

  try {
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), itemIndex === 0 ? 1 : -1)
    )
  } catch {
    // The item deletion is the important transaction; selection placement is best-effort.
  }

  return transaction
}

export function createLightsiteBackspaceTransaction(state: EditorState): Transaction | null {
  const { selection } = state
  const range = getTopLevelBlockRange(state)

  if (
    !(selection instanceof TextSelection) ||
    !selection.empty ||
    !range ||
    !isLightsiteInlineBlock(range.node) ||
    selection.$from.parent !== range.node
  ) {
    return null
  }

  if (shouldDeleteSingleInlineContent(state)) {
    const transaction = state.tr.delete(selection.from - 1, selection.from)

    return transaction.setSelection(TextSelection.create(transaction.doc, selection.from - 1))
  }

  if (selection.$from.parentOffset !== 0) {
    return null
  }

  const previousBlock = getTopLevelPreviousBlock(state, range.from)

  if (!previousBlock || !isLightsiteInlineBlock(previousBlock.node)) {
    return null
  }

  if (range.node.content.size > 0) {
    return state.tr
      .setMeta("addToHistory", false)
      .setMeta("lightsitePreventBlockJoin", true)
  }

  if (state.doc.childCount <= 1) {
    return null
  }

  const transaction = state.tr.delete(range.from, range.to)
  const selectionPosition = Math.max(previousBlock.from + 1, previousBlock.to - 1)

  return transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition))
}

function isLightsiteInlineBlock(node: { type: { name: string } }) {
  return node.type.name === "textBlock" || node.type.name === "headingBlock"
}

function shouldDeleteSingleInlineContent(state: EditorState) {
  const { selection } = state

  return (
    selection instanceof TextSelection &&
    selection.empty &&
    selection.$from.parentOffset === selection.$from.parent.content.size &&
    selection.$from.parent.content.size === 1
  )
}

function getTopLevelPreviousBlock(
  state: EditorState,
  beforePosition: number
): { from: number; node: ProseMirrorNode; to: number } | null {
  let position = 0
  let previousBlock: { from: number; node: ProseMirrorNode; to: number } | null = null

  for (let index = 0; index < state.doc.childCount; index += 1) {
    const node = state.doc.child(index)
    const to = position + node.nodeSize

    if (position >= beforePosition) {
      break
    }

    previousBlock = { from: position, node, to }
    position = to
  }

  return previousBlock
}

function insertTextBlockAfterFinishedHeading(editor: TiptapEditor) {
  const { state } = editor
  const { selection } = state
  const range = getTopLevelBlockRange(state)

  if (
    !selection.empty ||
    !range ||
    range.node.type.name !== "headingBlock" ||
    selection.$from.parentOffset !== selection.$from.parent.content.size
  ) {
    return false
  }

  const textBlock = state.schema.nodeFromJSON(createTemporaryTextBlock({ temporary: false }))
  const transaction = state.tr.insert(range.to, textBlock)

  setSelectionInsideInsertedNode(transaction, range.to, textBlock)
  editor.view.dispatch(transaction.scrollIntoView())
  editor.view.focus()

  return true
}

function exitEmptyIconListItem(editor: TiptapEditor) {
  const { state } = editor
  const { selection } = state

  if (!selection.empty) {
    return false
  }

  const iconListItemDepth = findAncestorDepth(state, "iconListItem")

  if (iconListItemDepth === null || selection.$from.parent.textContent.trim() !== "") {
    return false
  }

  const iconListDepth = iconListItemDepth - 1
  const iconListNode = selection.$from.node(iconListDepth)

  if (iconListNode.type.name !== "iconList") {
    return false
  }

  const itemStart = selection.$from.before(iconListItemDepth)
  const itemEnd = selection.$from.after(iconListItemDepth)
  const listStart = selection.$from.before(iconListDepth)
  const listEnd = selection.$from.after(iconListDepth)
  const temporaryTextNode = state.schema.nodeFromJSON(createTemporaryTextBlock())
  let transaction = state.tr
  let insertPosition = listEnd - (itemEnd - itemStart)

  if (iconListNode.childCount <= 1) {
    transaction = transaction.replaceWith(listStart, listEnd, temporaryTextNode)
    insertPosition = listStart
  } else {
    transaction = transaction.delete(itemStart, itemEnd).insert(insertPosition, temporaryTextNode)
  }

  setSelectionInsideInsertedNode(transaction, insertPosition, temporaryTextNode)
  editor.view.dispatch(transaction.scrollIntoView())
  editor.view.focus()

  return true
}

function findAncestorDepth(state: EditorState, nodeTypeName: string) {
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeTypeName) {
      return depth
    }
  }

  return null
}
