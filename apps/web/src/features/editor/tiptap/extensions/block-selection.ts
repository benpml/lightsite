import { Extension } from "@tiptap/core"
import { isNodeRangeSelection, NodeRangeSelection } from "@tiptap/extension-node-range"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorState, Selection, SelectionRange, Transaction } from "@tiptap/pm/state"
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

type BlockRange = {
  from: number
  gridCellPos?: number
  to: number
}

export const LightsiteNextBlockSelection = Extension.create({
  name: "lightsiteNextBlockSelection",

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) =>
        deleteSelectedBlocks(editor.view) || deleteEmptyButtonBlock(editor.view),
      Delete: ({ editor }) =>
        deleteSelectedBlocks(editor.view) || deleteEmptyButtonBlock(editor.view),
      "Mod-a": ({ editor }) => {
        const { doc, tr } = editor.state

        if (doc.childCount === 0 || doc.content.size === 0) {
          return false
        }

        editor.view.dispatch(
          tr.setSelection(NodeRangeSelection.create(doc, 0, doc.content.size, 0))
        )

        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== "Backspace" && event.key !== "Delete") {
              return false
            }

            return deleteSelectedBlocks(view) || deleteEmptyButtonBlock(view)
          },
        },
      }),
    ]
  },
})

function deleteSelectedBlocks(view: EditorView) {
  const { doc, selection } = view.state
  const blockRanges = getSelectedBlockRanges(doc, selection)

  if (blockRanges.length === 0) {
    return false
  }

  const tr = createDeleteBlockRangesTransaction(view.state, blockRanges)

  if (!tr) {
    return false
  }

  view.dispatch(tr)
  view.focus()

  return true
}

function deleteEmptyButtonBlock(view: EditorView) {
  const tr = createDeleteEmptyButtonBlockTransaction(view.state)

  if (!tr) {
    return false
  }

  view.dispatch(tr)
  view.focus()

  return true
}

export function createDeleteEmptyButtonBlockTransaction(state: EditorState) {
  const range = getEmptyButtonBlockRange(state.doc, state.selection)

  return range ? createDeleteBlockRangesTransaction(state, [range]) : null
}

function createDeleteBlockRangesTransaction(
  state: EditorState,
  blockRanges: BlockRange[]
): Transaction | null {
  const firstDeletedPosition = blockRanges[0]?.from
  const paragraphType = state.schema.nodes.paragraph

  if (typeof firstDeletedPosition !== "number") {
    return null
  }

  const gridCellReplacementKeys = paragraphType
    ? getGridCellReplacementRangeKeys(state.doc, blockRanges)
    : new Set<string>()
  let tr = state.tr

  for (const range of [...blockRanges].reverse()) {
    tr = gridCellReplacementKeys.has(getBlockRangeKey(range))
      ? tr.replaceWith(range.from, range.to, paragraphType.create())
      : tr.delete(range.from, range.to)
  }

  if (tr.doc.childCount === 0) {
    if (!paragraphType) {
      return null
    }

    tr = tr.insert(0, paragraphType.create())
  }

  return tr
    .setSelection(createTextSelectionNearBlockDelete(tr.doc, firstDeletedPosition))
    .scrollIntoView()
}

function getEmptyButtonBlockRange(
  doc: ProseMirrorNode,
  selection: Selection
): BlockRange | null {
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return null
  }

  const { $from } = selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)

    if (node.type.name !== "buttonBlock") {
      continue
    }

    if (node.content.size > 0) {
      return null
    }

    const from = $from.before(depth)
    const gridCell = findGridCellAt(doc, from)

    return {
      from,
      gridCellPos: gridCell?.pos,
      to: from + node.nodeSize,
    }
  }

  return null
}

function getSelectedBlockRanges(doc: ProseMirrorNode, selection: Selection) {
  if (isNodeRangeSelection(selection)) {
    return mergeBlockRanges(
      selection.ranges.flatMap((range) => getBlockRangesForSelectionRange(doc, range))
    )
  }

  if (selection instanceof NodeSelection) {
    return mergeBlockRanges(getBlockRanges(doc, selection.from, selection.to))
  }

  return []
}

function getBlockRangesForSelectionRange(doc: ProseMirrorNode, range: SelectionRange) {
  return getBlockRanges(doc, range.$from.pos, range.$to.pos)
}

function getBlockRanges(doc: ProseMirrorNode, from: number, to: number): BlockRange[] {
  return getGridCellBlockRanges(doc, from, to) ?? getTopLevelBlockRanges(doc, from, to)
}

function getTopLevelBlockRanges(doc: ProseMirrorNode, from: number, to: number): BlockRange[] {
  const ranges: BlockRange[] = []
  let pos = 0

  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index)
    const blockFrom = pos
    const blockTo = blockFrom + node.nodeSize

    pos = blockTo

    if (blockFrom >= to || blockTo <= from) {
      continue
    }

    ranges.push({ from: blockFrom, to: blockTo })
  }

  return ranges
}

function getGridCellBlockRanges(doc: ProseMirrorNode, from: number, to: number) {
  const gridCell = findGridCellAt(doc, from)

  if (!gridCell) {
    return null
  }

  const contentStart = gridCell.pos + 1
  const contentEnd = gridCell.pos + gridCell.node.nodeSize - 1

  if (from < contentStart || to > contentEnd) {
    return null
  }

  const ranges: BlockRange[] = []
  let pos = contentStart

  for (let index = 0; index < gridCell.node.childCount; index += 1) {
    const node = gridCell.node.child(index)
    const blockFrom = pos
    const blockTo = blockFrom + node.nodeSize

    pos = blockTo

    if (blockFrom >= to || blockTo <= from) {
      continue
    }

    ranges.push({ from: blockFrom, gridCellPos: gridCell.pos, to: blockTo })
  }

  return ranges
}

function findGridCellAt(doc: ProseMirrorNode, pos: number) {
  const $position = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === "gridCell") {
      return { node: $position.node(depth), pos: $position.before(depth) }
    }
  }

  return null
}

function getGridCellReplacementRangeKeys(doc: ProseMirrorNode, ranges: BlockRange[]) {
  const replacements = new Set<string>()
  const rangesByCell = new Map<number, BlockRange[]>()

  for (const range of ranges) {
    if (typeof range.gridCellPos !== "number") {
      continue
    }

    rangesByCell.set(range.gridCellPos, [...(rangesByCell.get(range.gridCellPos) ?? []), range])
  }

  for (const [gridCellPos, cellRanges] of rangesByCell) {
    const cell = doc.nodeAt(gridCellPos)

    if (!cell || cell.type.name !== "gridCell") {
      continue
    }

    const sortedRanges = [...cellRanges].sort((a, b) => a.from - b.from || a.to - b.to)
    const firstRange = sortedRanges[0]
    const lastRange = sortedRanges.at(-1)
    const contentStart = gridCellPos + 1
    const contentEnd = gridCellPos + cell.nodeSize - 1

    if (firstRange && lastRange && firstRange.from <= contentStart && lastRange.to >= contentEnd) {
      replacements.add(getBlockRangeKey(firstRange))
    }
  }

  return replacements
}

function getBlockRangeKey(range: BlockRange) {
  return `${range.from}:${range.to}`
}

function mergeBlockRanges(ranges: BlockRange[]) {
  const sortedRanges = [...ranges]
    .sort((a, b) => a.from - b.from || a.to - b.to)
    .reduce<BlockRange[]>((mergedRanges, range) => {
      const previousRange = mergedRanges.at(-1)

      if (
        previousRange &&
        previousRange.gridCellPos === range.gridCellPos &&
        range.from <= previousRange.to
      ) {
        previousRange.to = Math.max(previousRange.to, range.to)
        return mergedRanges
      }

      mergedRanges.push({ ...range })
      return mergedRanges
    }, [])

  return sortedRanges
}

function createTextSelectionNearBlockDelete(doc: ProseMirrorNode, deletedFrom: number) {
  const position = Math.max(0, Math.min(deletedFrom, doc.content.size))
  const bias = position === 0 ? 1 : -1

  return TextSelection.near(doc.resolve(position), bias)
}
