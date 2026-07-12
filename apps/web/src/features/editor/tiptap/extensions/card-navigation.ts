import { Extension } from "@tiptap/core"
import type { NodeType, ResolvedPos } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

import { findFirstTextSelectionPosition } from "./selection-utils"

const blockTypesThatExitOnTrailingEnter = new Set([
  "buttonBlock",
  "iconCard",
  "imageCard",
  "pageTitleSection",
  "testimonialCard",
])

export const LightsiteNextCardNavigation = Extension.create({
  name: "lightsiteNextCardNavigation",
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          return normalizeCardStructures(newState)
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { selection } = state

        if (selection instanceof NodeSelection) {
          const insertAfter = findEmptyPageNodeSelectionInsertPosition(selection, state)

          if (insertAfter === null) {
            return false
          }

          return insertParagraphAt(state, view, insertAfter)
        }

        if (!selection.empty) {
          return false
        }

        const logoGridTarget = findLogoGridEnterTarget(selection.$from, state)

        if (logoGridTarget) {
          if (logoGridTarget.type === "inside") {
            view.dispatch(
              state.tr
                .setSelection(TextSelection.near(state.doc.resolve(logoGridTarget.pos)))
                .scrollIntoView()
            )
            view.focus()

            return true
          }

          const itemType = state.schema.nodes.logoGridItem
          const titleType = state.schema.nodes.logoGridItemTitle

          if (!itemType || !titleType) {
            return false
          }

          const item = itemType.create({ alt: "", src: "" }, titleType.create())
          const tr = state.tr.insert(logoGridTarget.insertAt, item)

          view.dispatch(
            tr
              .setSelection(
                TextSelection.near(
                  tr.doc.resolve(findFirstTextSelectionPosition(item, logoGridTarget.insertAt))
                )
              )
              .scrollIntoView()
          )
          view.focus()

          return true
        }

        const target = findEnterTarget(selection.$from)

        if (target?.type === "inside") {
          view.dispatch(
            state.tr
              .setSelection(TextSelection.near(state.doc.resolve(target.pos)))
              .scrollIntoView()
          )
          view.focus()

          return true
        }

        const insertAfter = target?.after ?? findEmptyPageEnterInsertPosition(selection.$from, state)

        if (insertAfter === null) {
          return false
        }

        return insertParagraphAt(state, view, insertAfter)
      },
    }
  },
})

function insertParagraphAt(
  state: EditorState,
  view: EditorView,
  insertAt: number
) {
  const paragraph = state.schema.nodes.paragraph?.create()

  if (!paragraph) {
    return false
  }

  const tr = state.tr.insert(insertAt, paragraph)
  view.dispatch(
    tr
      .setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)))
      .scrollIntoView()
  )
  view.focus()

  return true
}

function normalizeCardStructures(state: EditorState) {
  const tr = state.tr
  let changed = false

  changed =
    normalizeTwoPartCardStructure(tr, state, {
      bodyNodeName: "pageTitleSubtitle",
      cardNodeName: "pageTitleSection",
      titleNodeName: "pageTitleTitle",
    }) || changed

  changed =
    normalizeTwoPartCardStructure(tr, state, {
      bodyNodeName: "iconCardBody",
      cardNodeName: "iconCard",
      titleNodeName: "iconCardTitle",
    }) || changed

  changed =
    normalizeTwoPartCardStructure(tr, state, {
      bodyNodeName: "imageCardBody",
      cardNodeName: "imageCard",
      titleNodeName: "imageCardTitle",
    }) || changed

  changed =
    normalizeOrderedCardStructure(tr, state, {
      cardNodeName: "testimonialCard",
      childNodeNames: ["testimonialAuthorName", "testimonialAuthorRole", "testimonialQuote"],
    }) || changed

  changed = normalizeLogoGridStructure(tr, state) || changed

  return changed ? tr : null
}

function normalizeTwoPartCardStructure(
  tr: EditorState["tr"],
  state: EditorState,
  config: {
    bodyNodeName: string
    cardNodeName: string
    titleNodeName: string
  }
) {
  const titleType = state.schema.nodes[config.titleNodeName]
  const bodyType = state.schema.nodes[config.bodyNodeName]

  if (!titleType || !bodyType) {
    return false
  }

  let changed = false

  state.doc.descendants((node, pos) => {
    if (node.type.name !== config.cardNodeName) {
      return true
    }

    const firstChild = node.firstChild

    if (!firstChild) {
      tr.insert(pos + 1, titleType.create())
      changed = true
      return false
    }

    const titlePos = pos + 1

    if (firstChild.type.name !== config.titleNodeName) {
      tr.replaceWith(titlePos, titlePos + firstChild.nodeSize, createInlineNode(titleType, firstChild))
      changed = true
    }

    const secondChild = node.childCount > 1 ? node.child(1) : null
    const secondChildPos = titlePos + firstChild.nodeSize

    if (!secondChild) {
      tr.insert(pos + node.nodeSize - 1, bodyType.create())
      changed = true
      return false
    }

    if (secondChild.type.name !== config.bodyNodeName) {
      tr.replaceWith(
        secondChildPos,
        secondChildPos + secondChild.nodeSize,
        createInlineNode(bodyType, secondChild)
      )
      changed = true
    }

    return false
  })

  return changed
}

function normalizeOrderedCardStructure(
  tr: EditorState["tr"],
  state: EditorState,
  config: {
    cardNodeName: string
    childNodeNames: string[]
  }
) {
  const childTypes = config.childNodeNames.map((nodeName) => state.schema.nodes[nodeName])

  if (childTypes.some((type) => !type)) {
    return false
  }

  let changed = false

  state.doc.descendants((node, pos) => {
    if (node.type.name !== config.cardNodeName) {
      return true
    }

    let childPos = pos + 1

    for (let index = 0; index < config.childNodeNames.length; index += 1) {
      const expectedName = config.childNodeNames[index]
      const expectedType = childTypes[index]
      const child = node.childCount > index ? node.child(index) : null

      if (!expectedType) {
        continue
      }

      if (!child) {
        tr.insert(pos + node.nodeSize - 1, expectedType.create())
        changed = true
        return false
      }

      if (child.type.name !== expectedName) {
        tr.replaceWith(childPos, childPos + child.nodeSize, createInlineNode(expectedType, child))
        changed = true
      }

      childPos += child.nodeSize
    }

    return false
  })

  return changed
}

function createInlineNode(type: NodeType, node: import("@tiptap/pm/model").Node) {
  return type.create(null, node.inlineContent ? node.content : undefined)
}

function normalizeLogoGridStructure(tr: EditorState["tr"], state: EditorState) {
  const itemType = state.schema.nodes.logoGridItem
  const titleType = state.schema.nodes.logoGridItemTitle

  if (!itemType || !titleType) {
    return false
  }

  let changed = false

  state.doc.descendants((node, pos) => {
    if (node.type.name === "logoGrid" && node.childCount === 0) {
      tr.insert(pos + 1, itemType.create({ alt: "", src: "" }, titleType.create()))
      changed = true
      return false
    }

    if (node.type.name !== "logoGridItem") {
      return true
    }

    const firstChild = node.firstChild

    if (!firstChild) {
      tr.insert(pos + 1, titleType.create())
      changed = true
      return false
    }

    if (firstChild.type.name !== "logoGridItemTitle") {
      tr.replaceWith(pos + 1, pos + 1 + firstChild.nodeSize, createInlineNode(titleType, firstChild))
      changed = true
    }

    if (node.childCount > 1) {
      tr.delete(pos + 1 + firstChild.nodeSize, pos + node.nodeSize - 1)
      changed = true
    }

    return false
  })

  return changed
}

type EnterTarget =
  | { type: "inside"; pos: number }
  | { type: "after"; after: number }

type LogoGridEnterTarget =
  | { type: "inside"; pos: number }
  | { type: "insert"; insertAt: number }

function findLogoGridEnterTarget(
  $from: ResolvedPos,
  state: EditorState
): LogoGridEnterTarget | null {
  if ($from.parent.type.name !== "logoGridItemTitle") {
    return null
  }

  if ($from.parentOffset !== $from.parent.content.size) {
    return null
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)

    if (node.type.name !== "logoGridItem") {
      continue
    }

    if (!isSelectionAtEndOfAncestor($from, depth)) {
      return null
    }

    const logoGridDepth = depth - 1
    const logoGrid = $from.node(logoGridDepth)

    if (logoGrid.type.name !== "logoGrid") {
      return null
    }

    const itemIndex = $from.index(logoGridDepth)

    if (itemIndex + 1 < logoGrid.childCount) {
      const nextItemPos = getChildStartPosition($from, logoGridDepth, itemIndex + 1)
      const nextItem = logoGrid.child(itemIndex + 1)

      return { type: "inside", pos: findFirstTextSelectionPosition(nextItem, nextItemPos) }
    }

    if (!state.schema.nodes.logoGridItem || !state.schema.nodes.logoGridItemTitle) {
      return null
    }

    return { type: "insert", insertAt: $from.after(depth) }
  }

  return null
}

function findEnterTarget($from: ResolvedPos): EnterTarget | null {
  if ($from.parentOffset !== $from.parent.content.size) {
    return null
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)

    if (!blockTypesThatExitOnTrailingEnter.has(node.type.name)) {
      continue
    }

    const nextChildIndex = $from.indexAfter(depth)

    if (nextChildIndex < node.childCount) {
      const nextChildPos = getChildStartPosition($from, depth, nextChildIndex)
      const nextChild = node.child(nextChildIndex)

      return { type: "inside", pos: findFirstTextSelectionPosition(nextChild, nextChildPos) }
    }

    if (isSelectionAtEndOfAncestor($from, depth)) {
      return { type: "after", after: $from.after(depth) }
    }

    return null
  }

  return null
}

function findEmptyPageEnterInsertPosition($from: ResolvedPos, state: EditorState) {
  const { doc } = state

  if (!isEmptyPageRootSelection($from)) {
    return null
  }

  if (doc.childCount !== 1) {
    return null
  }

  const firstNode = doc.child(0)

  if (firstNode.type.name !== "pageTitleSection" && firstNode.type.name !== "heading") {
    return null
  }

  return firstNode.nodeSize
}

function findEmptyPageNodeSelectionInsertPosition(
  selection: NodeSelection,
  state: EditorState
) {
  const { doc } = state

  if (doc.childCount !== 1) {
    return null
  }

  const firstNode = doc.child(0)

  if (selection.node !== firstNode) {
    return null
  }

  if (firstNode.type.name !== "pageTitleSection" && firstNode.type.name !== "heading") {
    return null
  }

  return selection.from + firstNode.nodeSize
}

function isEmptyPageRootSelection($from: ResolvedPos) {
  if ($from.depth === 0) {
    return true
  }

  if ($from.depth !== 1) {
    return false
  }

  const parent = $from.parent

  if (parent.type.name === "pageTitleSection") {
    return true
  }

  return parent.type.name === "heading" && parent.content.size === 0
}

function getChildStartPosition($from: ResolvedPos, ancestorDepth: number, childIndex: number) {
  const ancestor = $from.node(ancestorDepth)
  let pos = $from.start(ancestorDepth)

  for (let index = 0; index < childIndex; index += 1) {
    pos += ancestor.child(index).nodeSize
  }

  return pos
}

function isSelectionAtEndOfAncestor(
  $from: ResolvedPos,
  ancestorDepth: number
) {
  for (let depth = $from.depth; depth >= ancestorDepth; depth -= 1) {
    const parent = $from.node(depth)

    if ($from.indexAfter(depth) !== parent.childCount) {
      return false
    }
  }

  return $from.parentOffset === $from.parent.content.size
}
