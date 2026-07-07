import type { Editor as TiptapEditor } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"

import type { EditableBlockType } from "../editor-data"
import {
  createTiptapBlock,
  getEditableBlockType,
  setSelectionInsideInsertedNode,
} from "./editor-blocks"

export type BlockOptionsTarget = {
  blockType: EditableBlockType
  node: ProseMirrorNode
  pos: number
} | null

export function blockOptionsTargetFromNode({
  node,
  pos,
}: {
  node: ProseMirrorNode | null
  pos: number
}): BlockOptionsTarget {
  const blockType = node ? getEditableBlockType(node) : null

  return node && blockType ? { blockType, node, pos } : null
}

export function clearEditorSelection(editor: TiptapEditor) {
  const { doc, selection, tr } = editor.state

  if (selection instanceof TextSelection && selection.empty) {
    return
  }

  let textPosition: number | null = null

  doc.descendants((node, position) => {
    if (!node.isTextblock) {
      return true
    }

    textPosition = position + 1
    return false
  })

  if (textPosition === null) {
    return
  }

  editor.view.dispatch(
    tr
      .setSelection(TextSelection.create(doc, textPosition))
      .setMeta("addToHistory", false)
  )
}

export function replaceBlockAt(
  editor: TiptapEditor,
  position: number,
  node: ProseMirrorNode,
  type: EditableBlockType
) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const nextNode = state.schema.nodeFromJSON(createTiptapBlock(type, node.textContent))
      const transaction = state.tr.replaceWith(position, position + node.nodeSize, nextNode)

      setSelectionInsideInsertedNode(transaction, position, nextNode)
      dispatch?.(transaction.scrollIntoView())

      return true
    })
    .run()
}

export function duplicateBlockAt(editor: TiptapEditor, position: number, node: ProseMirrorNode) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const currentNode = state.doc.nodeAt(position)

      if (!currentNode || currentNode.type !== node.type) {
        return false
      }

      const insertPosition = position + currentNode.nodeSize
      const transaction = state.tr.insert(insertPosition, currentNode.copy(currentNode.content))

      setSelectionInsideInsertedNode(transaction, insertPosition, currentNode)
      dispatch?.(transaction.scrollIntoView())

      return true
    })
    .run()
}

export function deleteBlockAt(editor: TiptapEditor, position: number, node: ProseMirrorNode) {
  const documentHasOnlyThisNode = editor.state.doc.childCount <= 1
  const replacement = documentHasOnlyThisNode ? createTiptapBlock("text") : undefined

  if (replacement) {
    editor
      .chain()
      .focus()
      .command(({ state, dispatch }) => {
        const nextNode = state.schema.nodeFromJSON(replacement)
        const transaction = state.tr.replaceWith(position, position + node.nodeSize, nextNode)

        setSelectionInsideInsertedNode(transaction, position, nextNode)
        dispatch?.(transaction.scrollIntoView())

        return true
      })
      .run()
    return
  }

  editor.chain().focus().deleteRange({ from: position, to: position + node.nodeSize }).run()
}

export function updateBlockAttrsAt(
  editor: TiptapEditor,
  position: number,
  node: ProseMirrorNode,
  attrs: Record<string, unknown>
) {
  const currentNode = editor.state.doc.nodeAt(position)

  if (!currentNode || currentNode.type !== node.type) {
    return
  }

  const transaction = editor.state.tr.setNodeMarkup(
    position,
    undefined,
    { ...currentNode.attrs, ...attrs },
    currentNode.marks
  )

  editor.view.dispatch(transaction)
}

export function removeEmptyTemporaryTextBlocks(editor: TiptapEditor) {
  const ranges: Array<{ from: number; to: number }> = []

  editor.state.doc.descendants((node, position) => {
    if (node.type.name === "textBlock" && node.attrs.temporary && node.textContent.trim() === "") {
      ranges.push({ from: position, to: position + node.nodeSize })
    }
  })

  if (ranges.length === 0 || ranges.length >= editor.state.doc.childCount) {
    return
  }

  let transaction = editor.state.tr

  for (const range of [...ranges].sort((left, right) => right.from - left.from)) {
    transaction = transaction.delete(range.from, range.to)
  }

  editor.view.dispatch(transaction)
}
