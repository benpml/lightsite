import type { Editor as TiptapEditor } from "@tiptap/core"

import { formatVariableToken, type EditableBlockType, type EditorVariable } from "../editor-data"
import {
  createTiptapBlock,
  getTopLevelBlockRange,
  setSelectionInsideInsertedNode,
} from "./editor-blocks"

export type CommandMenuState = {
  kind: "block" | "variable"
  left: number
  query: string
  range: {
    from: number
    to: number
  }
  top: number
} | null

export function getCommandMenuState(editor: TiptapEditor): CommandMenuState {
  const { state } = editor
  const { selection } = state

  if (!selection.empty) {
    return null
  }

  const { $from } = selection
  const parent = $from.parent

  if (!parent.isTextblock) {
    return null
  }

  const textBeforeCursor = parent.textBetween(0, $from.parentOffset, "\n", "\ufffc")
  const match = /(^|\s)([/{])([^\s/{]*)$/.exec(textBeforeCursor)

  if (!match) {
    return null
  }

  const prefixLength = match[1]?.length ?? 0
  const trigger = match[2]
  const query = match[3] ?? ""
  const startOffset = match.index + prefixLength
  const from = $from.start() + startOffset
  const to = selection.from
  const coords = editor.view.coordsAtPos(to)

  return {
    kind: trigger === "/" ? "block" : "variable",
    left: coords.left,
    query,
    range: { from, to },
    top: coords.bottom + 6,
  }
}

export function syncCommandMenu(
  editor: TiptapEditor,
  setCommandMenu: (menu: CommandMenuState) => void
) {
  setCommandMenu(getCommandMenuState(editor))
}

export function insertBlockFromCommandMenu(
  editor: TiptapEditor,
  menu: NonNullable<CommandMenuState>,
  type: EditableBlockType
) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const node = state.schema.nodeFromJSON(createTiptapBlock(type))
      const topLevelRange = getTopLevelBlockRange(state)
      let transaction = state.tr
      let insertPosition: number

      if (topLevelRange && shouldReplaceRangeBlock(menu, topLevelRange)) {
        transaction = transaction.replaceWith(topLevelRange.from, topLevelRange.to, node)
        insertPosition = topLevelRange.from
      } else {
        transaction = transaction.delete(menu.range.from, menu.range.to)
        const mappedInsertPosition = transaction.mapping.map(topLevelRange?.to ?? menu.range.from)

        transaction = transaction.insert(mappedInsertPosition, node)
        insertPosition = mappedInsertPosition
      }

      setSelectionInsideInsertedNode(transaction, insertPosition, node)
      dispatch?.(transaction.scrollIntoView())

      return true
    })
    .run()
}

export function insertVariableFromCommandMenu(
  editor: TiptapEditor,
  menu: NonNullable<CommandMenuState>,
  variable: EditorVariable
) {
  editor
    .chain()
    .focus()
    .insertContentAt(menu.range, formatVariableToken(variable))
    .run()
}

function shouldReplaceRangeBlock(
  menu: NonNullable<CommandMenuState>,
  topLevelRange: NonNullable<ReturnType<typeof getTopLevelBlockRange>>
) {
  if (
    topLevelRange.node.type.name !== "textBlock" &&
    topLevelRange.node.type.name !== "paragraph"
  ) {
    return false
  }

  const contentStart = topLevelRange.from + 1
  const contentEnd = topLevelRange.to - 1

  if (menu.range.from < contentStart || menu.range.to > contentEnd) {
    return false
  }

  const textBeforeRange = topLevelRange.node.textBetween(
    0,
    menu.range.from - contentStart,
    "\n",
    "\ufffc"
  )
  const textAfterRange = topLevelRange.node.textBetween(
    menu.range.to - contentStart,
    topLevelRange.node.content.size,
    "\n",
    "\ufffc"
  )

  return textBeforeRange.trim() === "" && textAfterRange.trim() === ""
}
