import type { Editor as TiptapEditor } from "@tiptap/core"

import type { EditorVariable, EditorVariableType } from "../editor-data"
import { editorBlockMenuItems, type EditorBlockMenuItem } from "./block-menu-items"
import {
  insertBlockFromCommandMenu,
  insertVariableFromCommandMenu,
  type CommandMenuState,
} from "./command-menu"

export function filterCommandItems(
  items: EditorBlockMenuItem[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) =>
    `${item.label} ${item.type}`.toLowerCase().includes(normalizedQuery)
  )
}

export function filterVariableItems(
  variables: EditorVariable[],
  query: string,
  allowedTypes?: EditorVariableType[]
) {
  const normalizedQuery = query.trim().toLowerCase()
  const allowedTypeSet = allowedTypes ? new Set(allowedTypes) : null
  const matchingVariables = allowedTypeSet
    ? variables.filter((variable) => allowedTypeSet.has(variable.type))
    : variables

  if (!normalizedQuery) {
    return matchingVariables
  }

  return matchingVariables.filter((variable) =>
    `${variable.label} ${variable.key}`.toLowerCase().includes(normalizedQuery)
  )
}

export function getCommandMenuItemCount(
  menu: NonNullable<CommandMenuState>,
  variables: EditorVariable[]
) {
  return menu.kind === "block"
    ? filterCommandItems(editorBlockMenuItems, menu.query).length
    : filterVariableItems(variables, menu.query).length
}

export function selectCommandMenuItem(
  editor: TiptapEditor,
  menu: NonNullable<CommandMenuState>,
  variables: EditorVariable[],
  selectedIndex: number
) {
  if (menu.kind === "block") {
    const items = filterCommandItems(editorBlockMenuItems, menu.query)
    const item = items[Math.max(0, Math.min(selectedIndex, items.length - 1))]

    if (!item) {
      return false
    }

    insertBlockFromCommandMenu(editor, menu, item.type)
    return true
  }

  const variableItems = filterVariableItems(variables, menu.query)
  const variable = variableItems[Math.max(0, Math.min(selectedIndex, variableItems.length - 1))]

  if (!variable) {
    return false
  }

  insertVariableFromCommandMenu(editor, menu, variable)
  return true
}
