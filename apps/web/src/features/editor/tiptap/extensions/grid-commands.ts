import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Plugin, TextSelection } from "@tiptap/pm/state"

import { findFirstTextSelectionPosition } from "./selection-utils"

const MAX_GRID_COLUMNS = 3

type GridPlacement = "before" | "after"
type GridDeletePlacement = GridPlacement | "current"

type GridContext = {
  cell: ProseMirrorNode
  cellIndex: number
  cellPos: number
  columnCount: number
  grid: ProseMirrorNode
  gridPos: number
  row: ProseMirrorNode
  rowCount: number
  rowIndex: number
  rowPos: number
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lightsiteNextGrid: {
      addLightsiteNextGridColumn: (pos: number | undefined, placement: GridPlacement) => ReturnType
      addLightsiteNextGridRow: (pos: number | undefined, placement: GridPlacement) => ReturnType
      deleteLightsiteNextGridColumn: (
        pos?: number,
        placement?: GridDeletePlacement
      ) => ReturnType
      deleteLightsiteNextGridRow: (pos?: number, placement?: GridDeletePlacement) => ReturnType
    }
  }
}

export const LightsiteNextGridCommands = Extension.create({
  name: "lightsiteNextGridCommands",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          return removeRedundantGridCellPlaceholders(newState)
        },
      }),
    ]
  },

  addCommands() {
    return {
      addLightsiteNextGridColumn:
        (pos, placement) =>
        ({ state, dispatch, view }) => {
          const context = resolveGridContext(state, pos)

          if (!context || context.columnCount >= MAX_GRID_COLUMNS) {
            return false
          }

          if (dispatch) {
            const insertIndex =
              placement === "before" ? context.cellIndex : context.cellIndex + 1
            let selectedInsertPos: number | null = null
            let tr = state.tr

            for (let rowIndex = context.grid.childCount - 1; rowIndex >= 0; rowIndex -= 1) {
              const row = context.grid.child(rowIndex)
              const rowPos = getGridRowPosition(context.gridPos, context.grid, rowIndex)
              const clampedInsertIndex = Math.min(insertIndex, row.childCount)
              const insertPos = getGridCellInsertPosition(rowPos, row, clampedInsertIndex)

              if (rowIndex === context.rowIndex) {
                selectedInsertPos = insertPos
              }

              tr = tr.insert(insertPos, createGridCell(state.schema))
            }

            tr = tr.setNodeMarkup(context.gridPos, undefined, {
              ...context.grid.attrs,
              columns: context.columnCount + 1,
            })

            if (selectedInsertPos !== null) {
              setTextSelectionInsideNode(tr, tr.mapping.map(selectedInsertPos))
            }

            dispatch(tr.scrollIntoView())
            view.focus()
          }

          return true
        },
      addLightsiteNextGridRow:
        (pos, placement) =>
        ({ state, dispatch, view }) => {
          const context = resolveGridContext(state, pos)

          if (!context) {
            return false
          }

          if (dispatch) {
            const insertPos =
              placement === "before" ? context.rowPos : context.rowPos + context.row.nodeSize
            const row = createGridRow(state.schema, context.columnCount)
            const tr = state.tr.insert(insertPos, row)

            setTextSelectionInsideNode(tr, insertPos)
            dispatch(tr.scrollIntoView())
            view.focus()
          }

          return true
        },
      deleteLightsiteNextGridColumn:
        (pos, placement = "current") =>
        ({ state, dispatch, view }) => {
          const context = resolveGridContext(state, pos)
          const columnIndex = getRelativeIndex(context?.cellIndex ?? 0, placement)

          if (
            !context ||
            context.columnCount <= 1 ||
            columnIndex < 0 ||
            columnIndex >= context.columnCount
          ) {
            return false
          }

          if (dispatch) {
            let tr = state.tr

            for (let rowIndex = context.grid.childCount - 1; rowIndex >= 0; rowIndex -= 1) {
              const row = context.grid.child(rowIndex)

              if (columnIndex >= row.childCount) {
                continue
              }

              const rowPos = getGridRowPosition(context.gridPos, context.grid, rowIndex)
              const cellPos = getGridCellPosition(rowPos, row, columnIndex)
              const cell = row.child(columnIndex)

              tr = tr.delete(cellPos, cellPos + cell.nodeSize)
            }

            const mappedGridPos = tr.mapping.map(context.gridPos)

            tr = tr.setNodeMarkup(mappedGridPos, undefined, {
              ...context.grid.attrs,
              columns: context.columnCount - 1,
            })

            const nextCellPos = findGridCellPosition(tr.doc, {
              cellIndex: Math.min(columnIndex, context.columnCount - 2),
              gridPos: mappedGridPos,
              rowIndex: context.rowIndex,
            })

            if (nextCellPos !== null) {
              setTextSelectionInsideNode(tr, nextCellPos)
            }

            dispatch(tr.scrollIntoView())
            view.focus()
          }

          return true
        },
      deleteLightsiteNextGridRow:
        (pos, placement = "current") =>
        ({ state, dispatch, view }) => {
          const context = resolveGridContext(state, pos)
          const rowIndex = getRelativeIndex(context?.rowIndex ?? 0, placement)

          if (!context || context.rowCount <= 1 || rowIndex < 0 || rowIndex >= context.rowCount) {
            return false
          }

          if (dispatch) {
            const row = context.grid.child(rowIndex)
            const rowPos = getGridRowPosition(context.gridPos, context.grid, rowIndex)
            const tr = state.tr.delete(rowPos, rowPos + row.nodeSize)
            const nextCellPos = findGridCellPosition(tr.doc, {
              cellIndex: Math.min(context.cellIndex, context.columnCount - 1),
              gridPos: context.gridPos,
              rowIndex: Math.min(rowIndex, context.rowCount - 2),
            })

            if (nextCellPos !== null) {
              setTextSelectionInsideNode(tr, nextCellPos)
            }

            dispatch(tr.scrollIntoView())
            view.focus()
          }

          return true
        },
    }
  },
})

export function resolveGridContext(state: EditorState, pos?: number): GridContext | null {
  if (typeof pos === "number") {
    const node = state.doc.nodeAt(pos)

    if (node?.type.name === "gridBlock") {
      return resolveFirstGridCell(pos, node)
    }
  }

  const $position =
    typeof pos === "number"
      ? state.doc.resolve(Math.max(0, Math.min(pos + 1, state.doc.content.size)))
      : state.selection.$from

  let cellDepth: number | null = null

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === "gridCell") {
      cellDepth = depth
      break
    }
  }

  if (cellDepth === null || cellDepth < 2) {
    return null
  }

  const rowDepth = cellDepth - 1
  const gridDepth = cellDepth - 2
  const cell = $position.node(cellDepth)
  const row = $position.node(rowDepth)
  const grid = $position.node(gridDepth)

  if (row.type.name !== "gridRow" || grid.type.name !== "gridBlock") {
    return null
  }

  const gridPos = $position.before(gridDepth)
  const rowPos = $position.before(rowDepth)
  const cellPos = $position.before(cellDepth)
  const rowIndex = $position.index(gridDepth)
  const cellIndex = $position.index(rowDepth)

  return {
    cell,
    cellIndex,
    cellPos,
    columnCount: getGridColumnCount(grid),
    grid,
    gridPos,
    row,
    rowCount: grid.childCount,
    rowIndex,
    rowPos,
  }
}

export function getGridColumnCount(grid: ProseMirrorNode) {
  const attrColumns = Number.parseInt(String(grid.attrs.columns ?? ""), 10)

  if (Number.isFinite(attrColumns) && attrColumns > 0) {
    return Math.min(MAX_GRID_COLUMNS, attrColumns)
  }

  let maxCells = 1

  grid.forEach((row) => {
    maxCells = Math.max(maxCells, row.childCount)
  })

  return Math.min(MAX_GRID_COLUMNS, maxCells)
}

function resolveFirstGridCell(gridPos: number, grid: ProseMirrorNode): GridContext | null {
  const row = grid.firstChild
  const cell = row?.firstChild

  if (!row || !cell) {
    return null
  }

  return {
    cell,
    cellIndex: 0,
    cellPos: gridPos + 2,
    columnCount: getGridColumnCount(grid),
    grid,
    gridPos,
    row,
    rowCount: grid.childCount,
    rowIndex: 0,
    rowPos: gridPos + 1,
  }
}

function getRelativeIndex(index: number, placement: GridDeletePlacement) {
  if (placement === "before") {
    return index - 1
  }

  if (placement === "after") {
    return index + 1
  }

  return index
}

function createGridCell(schema: Schema) {
  return schema.nodes.gridCell.create(null, schema.nodes.paragraph.create())
}

function createGridRow(schema: Schema, columns: number) {
  return schema.nodes.gridRow.create(
    null,
    Array.from({ length: columns }, () => createGridCell(schema))
  )
}

function getGridRowPosition(gridPos: number, grid: ProseMirrorNode, rowIndex: number) {
  let pos = gridPos + 1

  for (let index = 0; index < rowIndex; index += 1) {
    pos += grid.child(index).nodeSize
  }

  return pos
}

function getGridCellPosition(rowPos: number, row: ProseMirrorNode, cellIndex: number) {
  return getGridCellInsertPosition(rowPos, row, cellIndex)
}

function getGridCellInsertPosition(rowPos: number, row: ProseMirrorNode, cellIndex: number) {
  let pos = rowPos + 1

  for (let index = 0; index < cellIndex; index += 1) {
    pos += row.child(index).nodeSize
  }

  return pos
}

function findGridCellPosition(
  doc: ProseMirrorNode,
  target: { cellIndex: number; gridPos: number; rowIndex: number }
) {
  const grid = doc.nodeAt(target.gridPos)

  if (!grid || grid.type.name !== "gridBlock") {
    return null
  }

  const rowIndex = Math.min(target.rowIndex, grid.childCount - 1)
  const row = grid.child(rowIndex)

  if (!row || row.type.name !== "gridRow") {
    return null
  }

  const cellIndex = Math.min(target.cellIndex, row.childCount - 1)
  const rowPos = getGridRowPosition(target.gridPos, grid, rowIndex)

  return getGridCellPosition(rowPos, row, cellIndex)
}

function setTextSelectionInsideNode(tr: Transaction, pos: number) {
  const focusPosition = findFirstTextSelectionPosition(tr.doc.nodeAt(pos), pos)

  return tr.setSelection(
    TextSelection.near(tr.doc.resolve(Math.min(focusPosition, tr.doc.content.size)))
  )
}

function removeRedundantGridCellPlaceholders(state: EditorState) {
  const ranges: Array<{ from: number; to: number }> = []

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "gridCell" || node.childCount <= 1) {
      return true
    }

    if (!hasSubstantialGridCellChild(node)) {
      return false
    }

    let childPos = pos + 1

    node.forEach((child) => {
      const from = childPos
      const to = childPos + child.nodeSize

      if (isEmptyParagraph(child) && !selectionTouchesRange(state, from, to)) {
        ranges.push({ from, to })
      }

      childPos = to
    })

    return false
  })

  if (ranges.length === 0) {
    return null
  }

  const tr = state.tr

  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index]
    tr.delete(range.from, range.to)
  }

  return tr
}

function hasSubstantialGridCellChild(cell: ProseMirrorNode) {
  let hasSubstantialChild = false

  cell.forEach((child) => {
    if (!isEmptyParagraph(child)) {
      hasSubstantialChild = true
    }
  })

  return hasSubstantialChild
}

function isEmptyParagraph(node: ProseMirrorNode) {
  return node.type.name === "paragraph" && node.content.size === 0
}

function selectionTouchesRange(state: EditorState, from: number, to: number) {
  const { selection } = state

  if (selection.empty) {
    return selection.from >= from && selection.from <= to
  }

  return selection.from < to && selection.to > from
}
