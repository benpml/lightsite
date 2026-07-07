import { Schema } from "@tiptap/pm/model"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { EditorState, TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import {
  createDeleteEmptyIconListItemTransaction,
  createLightsiteBackspaceTransaction,
} from "./document-behavior"
import { setSelectionInsideInsertedNode } from "./editor-blocks"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    textBlock: {
      attrs: { temporary: { default: false } },
      content: "inline*",
      defining: true,
      group: "block",
      parseDOM: [{ tag: "p[data-lightsite-node='text-block']" }],
      toDOM: () => ["p", { "data-lightsite-node": "text-block" }, 0],
    },
    headingBlock: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      defining: true,
      group: "block",
      parseDOM: [{ tag: "h1[data-lightsite-node='heading-block']" }],
      toDOM: () => ["h1", { "data-lightsite-node": "heading-block" }, 0],
    },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    bulletList: {
      content: "listItem+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM: () => ["ul", 0],
    },
    orderedList: {
      content: "listItem+",
      group: "block",
      parseDOM: [{ tag: "ol" }],
      toDOM: () => ["ol", 0],
    },
    listItem: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM: () => ["li", 0],
    },
    imageBlock: {
      atom: true,
      group: "block",
      parseDOM: [{ tag: "figure[data-lightsite-node='image-block']" }],
      toDOM: () => ["figure", { "data-lightsite-node": "image-block" }],
    },
    iconList: {
      content: "iconListItem+",
      group: "block",
      parseDOM: [{ tag: "div[data-lightsite-node='icon-list']" }],
      toDOM: () => ["div", { "data-lightsite-node": "icon-list" }, 0],
    },
    iconListItem: {
      content: "inline*",
      parseDOM: [{ tag: "div[data-lightsite-node='icon-list-item']" }],
      toDOM: () => ["div", { "data-lightsite-node": "icon-list-item" }, 0],
    },
  },
})

describe("LightsiteDocumentBehavior Backspace", () => {
  it("deletes the last character in a Lightsite text block without joining it into the previous block", () => {
    const state = createState({
      blocks: [textBlock("Above"), textBlock("B")],
      selection: { blockIndex: 1, offset: 1 },
    })
    const transaction = createLightsiteBackspaceTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)

    expect(nextState.doc.child(0).textContent).toBe("Above")
    expect(nextState.doc.child(1).textContent).toBe("")
  })

  it("removes an empty Lightsite text block and keeps the previous block unchanged", () => {
    const state = createState({
      blocks: [textBlock("Above"), textBlock()],
      selection: { blockIndex: 1, offset: 0 },
    })
    const transaction = createLightsiteBackspaceTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)

    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.child(0).textContent).toBe("Above")
    expect(nextState.selection.from).toBe(1 + "Above".length)
  })

  it("prevents ProseMirror from joining a non-empty Lightsite text block into the previous block", () => {
    const state = createState({
      blocks: [textBlock("Above"), textBlock("Beta")],
      selection: { blockIndex: 1, offset: 0 },
    })
    const transaction = createLightsiteBackspaceTransaction(state)

    expect(transaction).not.toBeNull()
    expect(transaction!.doc.toJSON()).toEqual(state.doc.toJSON())
  })

  it("lets normal character deletion run for multi-character text blocks", () => {
    const state = createState({
      blocks: [textBlock("Above"), textBlock("Beta")],
      selection: { blockIndex: 1, offset: "Beta".length },
    })

    expect(createLightsiteBackspaceTransaction(state)).toBeNull()
  })

  it("does not remove an empty text block when the previous block cannot receive text", () => {
    const state = createState({
      blocks: [schema.nodes.imageBlock.create(), textBlock()],
      selection: { blockIndex: 1, offset: 0 },
    })

    expect(createLightsiteBackspaceTransaction(state)).toBeNull()
  })
})

describe("LightsiteDocumentBehavior icon list Backspace", () => {
  it("deletes the first empty icon list item when later items remain", () => {
    const doc = schema.nodes.doc.create(null, [
      iconList([iconListItem(), iconListItem("Second"), iconListItem("Third")]),
    ])
    const baseState = EditorState.create({ doc })
    const state = baseState.apply(baseState.tr.setSelection(TextSelection.create(doc, 2)))
    const transaction = createDeleteEmptyIconListItemTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)
    const nextList = nextState.doc.child(0)

    expect(nextList.childCount).toBe(2)
    expect(nextList.child(0).textContent).toBe("Second")
    expect(nextList.child(1).textContent).toBe("Third")
    expect(nextState.selection.$from.parent.textContent).toBe("Second")
  })

  it("replaces the icon list with a temporary text block when the only item is empty", () => {
    const doc = schema.nodes.doc.create(null, [iconList([iconListItem()])])
    const baseState = EditorState.create({ doc })
    const state = baseState.apply(baseState.tr.setSelection(TextSelection.create(doc, 2)))
    const transaction = createDeleteEmptyIconListItemTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)

    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.child(0).type.name).toBe("textBlock")
  })
})

describe("setSelectionInsideInsertedNode", () => {
  it("places the cursor inside a newly inserted bullet list item", () => {
    const doc = schema.nodes.doc.create(null, [textBlock("Before")])
    const state = EditorState.create({ doc })
    const listNode = bulletList("Item")
    const insertPosition = doc.child(0).nodeSize
    const transaction = state.tr.insert(insertPosition, listNode)

    setSelectionInsideInsertedNode(transaction, insertPosition, listNode)

    const nextState = state.apply(transaction)

    expect(nextState.selection.$from.parent.type.name).toBe("paragraph")
    expect(nextState.selection.$from.parentOffset).toBe("Item".length)
  })

  it("places the cursor inside an empty ordered list item", () => {
    const doc = schema.nodes.doc.create(null, [textBlock("Before")])
    const state = EditorState.create({ doc })
    const listNode = orderedList()
    const insertPosition = doc.child(0).nodeSize
    const transaction = state.tr.insert(insertPosition, listNode)

    setSelectionInsideInsertedNode(transaction, insertPosition, listNode)

    const nextState = state.apply(transaction)

    expect(nextState.selection.$from.parent.type.name).toBe("paragraph")
    expect(nextState.selection.$from.parentOffset).toBe(0)
  })
})

function createState({
  blocks,
  selection,
}: {
  blocks: ProseMirrorNode[]
  selection: { blockIndex: number; offset: number }
}) {
  const doc = schema.nodes.doc.create(null, blocks)
  const state = EditorState.create({ doc })
  const selectionPosition = contentPosition(blocks, selection.blockIndex, selection.offset)

  return state.apply(state.tr.setSelection(TextSelection.create(doc, selectionPosition)))
}

function textBlock(text = "") {
  return schema.nodes.textBlock.create(null, text ? schema.text(text) : undefined)
}

function iconList(items: ProseMirrorNode[]) {
  return schema.nodes.iconList.create(null, items)
}

function iconListItem(text = "") {
  return schema.nodes.iconListItem.create(null, text ? schema.text(text) : undefined)
}

function bulletList(text = "") {
  return schema.nodes.bulletList.create(null, listItem(text))
}

function orderedList(text = "") {
  return schema.nodes.orderedList.create(null, listItem(text))
}

function listItem(text = "") {
  return schema.nodes.listItem.create(
    null,
    schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)
  )
}

function contentPosition(blocks: ProseMirrorNode[], blockIndex: number, offset: number) {
  let position = 0

  for (let index = 0; index < blockIndex; index += 1) {
    position += blocks[index]?.nodeSize ?? 0
  }

  return position + 1 + offset
}
