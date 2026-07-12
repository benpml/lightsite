import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "@lightsite/site-document"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import { createPaletteMigrationTransaction } from "./palette-color-migration"

describe("palette color migration", () => {
  it("migrates saved text and highlight marks without adding an undo step", () => {
    const state = EditorState.create({
      doc: SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Purple",
              marks: [{ type: "textStyle", attrs: { color: "var(--editor-color-indigo)" } }],
            },
            {
              type: "text",
              text: "Red",
              marks: [{
                type: "highlight",
                attrs: {
                  color: "color-mix(in oklab, var(--editor-color-rose) 30%, transparent)",
                },
              }],
            },
          ],
        }],
      }),
    })

    const transaction = createPaletteMigrationTransaction(state)
    const migratedDocument = transaction ? state.apply(transaction).doc.toJSON() : null
    const serializedDocument = JSON.stringify(migratedDocument)

    expect(transaction?.getMeta("addToHistory")).toBe(false)
    expect(serializedDocument).toContain("var(--purple-foreground)")
    expect(serializedDocument).toContain("var(--red-background)")
    expect(serializedDocument).not.toContain("--editor-color-")
  })

  it("does nothing when a document already uses the role-based palette", () => {
    const state = EditorState.create({
      doc: SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{
            type: "text",
            text: "Current",
            marks: [{ type: "highlight", attrs: { color: "var(--cyan-background)" } }],
          }],
        }],
      }),
    })

    expect(createPaletteMigrationTransaction(state)).toBeNull()
  })
})
