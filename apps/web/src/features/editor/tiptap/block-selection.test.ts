import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { Schema } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import { createDeleteBlockSelectionTransaction } from "./block-selection"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    textBlock: {
      attrs: { temporary: { default: false } },
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p[data-lightsite-node='text-block']" }],
      toDOM: () => ["p", { "data-lightsite-node": "text-block" }, 0],
    },
  },
})

describe("LightsiteBlockSelection deletion", () => {
  it("deletes the selected top-level blocks", () => {
    const doc = schema.nodes.doc.create(null, [
      textBlock("First"),
      textBlock("Second"),
      textBlock("Third"),
    ])
    const firstBlockSize = doc.child(0).nodeSize
    const secondBlockSize = doc.child(1).nodeSize
    const baseState = EditorState.create({ doc })
    const state = baseState.apply(
      baseState.tr.setSelection(
        NodeRangeSelection.create(doc, firstBlockSize, firstBlockSize + secondBlockSize, 0)
      )
    )
    const transaction = createDeleteBlockSelectionTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)

    expect(nextState.doc.childCount).toBe(2)
    expect(nextState.doc.child(0).textContent).toBe("First")
    expect(nextState.doc.child(1).textContent).toBe("Third")
  })

  it("leaves a valid temporary text block when every block is selected", () => {
    const doc = schema.nodes.doc.create(null, [textBlock("Only")])
    const baseState = EditorState.create({ doc })
    const state = baseState.apply(
      baseState.tr.setSelection(NodeRangeSelection.create(doc, 0, doc.child(0).nodeSize, 0))
    )
    const transaction = createDeleteBlockSelectionTransaction(state)

    expect(transaction).not.toBeNull()

    const nextState = state.apply(transaction!)

    expect(nextState.doc.childCount).toBe(1)
    expect(nextState.doc.child(0).type.name).toBe("textBlock")
    expect(nextState.doc.child(0).attrs.temporary).toBe(true)
  })
})

function textBlock(text = "") {
  return schema.nodes.textBlock.create(null, text ? schema.text(text) : undefined)
}
