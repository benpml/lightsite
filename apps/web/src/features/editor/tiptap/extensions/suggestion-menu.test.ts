import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "@handout/site-document"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import { isLatestHandoutSuggestionTrigger } from "./suggestion-menu"

const schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA

describe("Handout suggestion menu trigger ownership", () => {
  it("gives the latest trigger exclusive ownership of overlapping suggestions", () => {
    const state = createParagraphState(":zzzz /")

    expect(
      isLatestHandoutSuggestionTrigger(state, { from: 1, to: 8 })
    ).toBe(false)
    expect(
      isLatestHandoutSuggestionTrigger(state, { from: 7, to: 8 })
    ).toBe(true)
  })

  it("moves ownership from an earlier slash to a later variable trigger", () => {
    const state = createParagraphState("/{company")

    expect(
      isLatestHandoutSuggestionTrigger(state, { from: 1, to: 10 })
    ).toBe(false)
    expect(
      isLatestHandoutSuggestionTrigger(state, { from: 2, to: 10 })
    ).toBe(true)
  })

  it("keeps a standalone trigger active", () => {
    const state = createParagraphState("/")

    expect(
      isLatestHandoutSuggestionTrigger(state, { from: 1, to: 2 })
    ).toBe(true)
  })
})

function createParagraphState(text: string) {
  return EditorState.create({
    doc: schema.nodes.doc!.create(null, [
      schema.nodes.paragraph!.create(null, schema.text(text)),
    ]),
    schema,
  })
}
