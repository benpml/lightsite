import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "@handout/site-document"
import { isNodeRangeSelection, NodeRangeSelection } from "@tiptap/extension-node-range"
import { EditorState, TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import {
  createHandoutBlockClipboardPayload,
  createInsertHandoutBlockClipboardTransaction,
  parseHandoutBlockClipboardPayload,
  type HandoutBlockClipboardPayload,
} from "./block-clipboard"

const schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA

describe("Handout block clipboard", () => {
  it("copies one or many complete selected blocks without unique IDs", () => {
    const paragraph = schema.nodes.paragraph!.create(
      { id: "paragraph-source" },
      schema.text("First")
    )
    const heading = schema.nodes.heading!.create(
      { id: "heading-source", level: 2 },
      schema.text("Second")
    )
    const doc = schema.nodes.doc!.create(null, [paragraph, heading])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(
        doc,
        0,
        doc.content.size,
        0
      ),
    })

    expect(createHandoutBlockClipboardPayload(state)).toEqual({
      blocks: [
        {
          attrs: { id: undefined },
          content: [{ text: "First", type: "text" }],
          type: "paragraph",
        },
        {
          attrs: { id: undefined, level: 2 },
          content: [{ text: "Second", type: "text" }],
          type: "heading",
        },
      ],
      version: 1,
    })
  })

  it("pastes below the selected block in one transaction and selects the result", () => {
    const before = schema.nodes.paragraph!.create(null, schema.text("Before"))
    const after = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [before, after])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(doc, 0, before.nodeSize, 0),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          attrs: { id: "copied-id", level: 2 },
          content: [{ text: "Pasted heading", type: "text" }],
          type: "heading",
        },
        {
          attrs: { id: "copied-paragraph-id" },
          content: [{ text: "Pasted body", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)

    expect(tr?.doc.childCount).toBe(4)
    expect(tr?.doc.child(0).textContent).toBe("Before")
    expect(tr?.doc.child(1).textContent).toBe("Pasted heading")
    expect(tr?.doc.child(2).textContent).toBe("Pasted body")
    expect(tr?.doc.child(3).textContent).toBe("After")
    expect(tr?.doc.child(1).attrs.id).toBeNull()
    expect(tr?.doc.child(2).attrs.id).toBeNull()
    expect(tr && isNodeRangeSelection(tr.selection)).toBe(true)
    expect(tr?.selection.from).toBe(before.nodeSize)
    expect(tr?.selection.to).toBe(
      before.nodeSize +
        (tr?.doc.child(1).nodeSize ?? 0) +
        (tr?.doc.child(2).nodeSize ?? 0)
    )
  })

  it("pastes below the containing block when the cursor is a text selection", () => {
    const first = schema.nodes.paragraph!.create(null, schema.text("First"))
    const second = schema.nodes.paragraph!.create(null, schema.text("Second"))
    const doc = schema.nodes.doc!.create(null, [first, second])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 2),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          content: [{ text: "Inserted", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)

    expect(tr?.doc.childCount).toBe(3)
    expect(tr?.doc.child(0).textContent).toBe("First")
    expect(tr?.doc.child(1).textContent).toBe("Inserted")
    expect(tr?.doc.child(2).textContent).toBe("Second")
  })

  it("replaces one empty text block with the pasted blocks", () => {
    const before = schema.nodes.paragraph!.create(null, schema.text("Before"))
    const empty = schema.nodes.paragraph!.create()
    const after = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [before, empty, after])
    const emptyFrom = before.nodeSize
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(
        doc,
        emptyFrom,
        emptyFrom + empty.nodeSize,
        0
      ),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          content: [{ text: "Pasted heading", type: "text" }],
          type: "heading",
          attrs: { level: 2 },
        },
        {
          content: [{ text: "Pasted body", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)

    expect(
      Array.from({ length: tr?.doc.childCount ?? 0 }, (_, index) =>
        tr?.doc.child(index).textContent
      )
    ).toEqual(["Before", "Pasted heading", "Pasted body", "After"])
    expect(tr && isNodeRangeSelection(tr.selection)).toBe(true)
    expect(tr?.selection.from).toBe(emptyFrom)
    expect(tr?.selection.to).toBe(
      emptyFrom +
        (tr?.doc.child(1).nodeSize ?? 0) +
        (tr?.doc.child(2).nodeSize ?? 0)
    )
  })

  it("replaces an empty text block when pasting at its cursor", () => {
    const empty = schema.nodes.paragraph!.create()
    const after = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [empty, after])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 1),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          content: [{ text: "Inserted", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)

    expect(tr?.doc.childCount).toBe(2)
    expect(tr?.doc.child(0).textContent).toBe("Inserted")
    expect(tr?.doc.child(1).textContent).toBe("After")
  })

  it("keeps pasting below a multi-block selection that includes an empty block", () => {
    const first = schema.nodes.paragraph!.create(null, schema.text("First"))
    const empty = schema.nodes.paragraph!.create()
    const after = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [first, empty, after])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(
        doc,
        0,
        first.nodeSize + empty.nodeSize,
        0
      ),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          content: [{ text: "Inserted", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)

    expect(
      Array.from({ length: tr?.doc.childCount ?? 0 }, (_, index) =>
        tr?.doc.child(index).textContent
      )
    ).toEqual(["First", "", "Inserted", "After"])
  })

  it("keeps duplicate behavior below an empty block", () => {
    const empty = schema.nodes.paragraph!.create()
    const after = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [empty, after])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(doc, 0, empty.nodeSize, 0),
    })
    const payload = createHandoutBlockClipboardPayload(state)

    expect(payload).not.toBeNull()

    const tr = payload
      ? createInsertHandoutBlockClipboardTransaction(
          state,
          payload,
          undefined,
          false
        )
      : null

    expect(tr?.doc.childCount).toBe(3)
    expect(tr?.doc.child(0).textContent).toBe("")
    expect(tr?.doc.child(1).textContent).toBe("")
    expect(tr?.doc.child(2).textContent).toBe("After")
  })

  it("duplicates a multi-block selection in document order", () => {
    const first = schema.nodes.paragraph!.create(null, schema.text("First"))
    const second = schema.nodes.heading!.create(
      { level: 2 },
      schema.text("Second")
    )
    const third = schema.nodes.paragraph!.create(null, schema.text("Third"))
    const doc = schema.nodes.doc!.create(null, [first, second, third])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(
        doc,
        0,
        first.nodeSize + second.nodeSize,
        0
      ),
    })
    const payload = createHandoutBlockClipboardPayload(state)

    expect(payload).not.toBeNull()

    const tr = payload
      ? createInsertHandoutBlockClipboardTransaction(state, payload)
      : null

    expect(
      Array.from({ length: tr?.doc.childCount ?? 0 }, (_, index) =>
        tr?.doc.child(index).textContent
      )
    ).toEqual(["First", "Second", "First", "Second", "Third"])
  })

  it("pastes into the selected grid cell instead of escaping the grid", () => {
    const first = schema.nodes.paragraph!.create(null, schema.text("First"))
    const second = schema.nodes.paragraph!.create(null, schema.text("Second"))
    const cell = schema.nodes.gridCell!.create(null, [first, second])
    const row = schema.nodes.gridRow!.create(null, [cell])
    const grid = schema.nodes.gridBlock!.create({ columns: 1 }, [row])
    const doc = schema.nodes.doc!.create(null, [grid])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 4),
    })
    const payload: HandoutBlockClipboardPayload = {
      blocks: [
        {
          content: [{ text: "Inserted", type: "text" }],
          type: "paragraph",
        },
      ],
      version: 1,
    }

    const tr = createInsertHandoutBlockClipboardTransaction(state, payload)
    const pastedCell = tr?.doc.firstChild?.firstChild?.firstChild

    expect(tr?.doc.childCount).toBe(1)
    expect(pastedCell?.childCount).toBe(3)
    expect(pastedCell?.child(0).textContent).toBe("First")
    expect(pastedCell?.child(1).textContent).toBe("Inserted")
    expect(pastedCell?.child(2).textContent).toBe("Second")
  })

  it("rejects malformed, oversized, and non-block clipboard content", () => {
    expect(parseHandoutBlockClipboardPayload("not-json")).toBeNull()
    expect(
      parseHandoutBlockClipboardPayload(
        JSON.stringify({ blocks: [], version: 1 })
      )
    ).toBeNull()

    const paragraph = schema.nodes.paragraph!.create()
    const doc = schema.nodes.doc!.create(null, [paragraph])
    const state = EditorState.create({
      doc,
      schema,
      selection: NodeRangeSelection.create(doc, 0, paragraph.nodeSize, 0),
    })

    expect(
      createInsertHandoutBlockClipboardTransaction(state, {
        blocks: [{ text: "inline only", type: "text" }],
        version: 1,
      })
    ).toBeNull()
  })
})
