import { describe, expect, it } from "vitest"
import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "@lightsite/site-document"
import { EditorState, TextSelection } from "@tiptap/pm/state"

import { createDeleteEmptyButtonBlockTransaction } from "./block-selection"

const schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA

describe("empty button block deletion", () => {
  it("deletes an empty button with Backspace semantics", () => {
    const button = schema.nodes.buttonBlock!.create()
    const paragraph = schema.nodes.paragraph!.create(null, schema.text("After"))
    const doc = schema.nodes.doc!.create(null, [button, paragraph])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 1),
    })

    const tr = createDeleteEmptyButtonBlockTransaction(state)

    expect(tr).not.toBeNull()
    expect(tr?.doc.childCount).toBe(1)
    expect(tr?.doc.firstChild?.type.name).toBe("paragraph")
    expect(tr?.doc.textContent).toBe("After")
  })

  it("does not delete a button that still has label text", () => {
    const button = schema.nodes.buttonBlock!.create(null, schema.text("Open"))
    const doc = schema.nodes.doc!.create(null, [button])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 1),
    })

    expect(createDeleteEmptyButtonBlockTransaction(state)).toBeNull()
  })

  it("leaves a valid paragraph when the empty button was the only block", () => {
    const button = schema.nodes.buttonBlock!.create()
    const doc = schema.nodes.doc!.create(null, [button])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 1),
    })

    const tr = createDeleteEmptyButtonBlockTransaction(state)

    expect(tr?.doc.childCount).toBe(1)
    expect(tr?.doc.firstChild?.type.name).toBe("paragraph")
  })
})
