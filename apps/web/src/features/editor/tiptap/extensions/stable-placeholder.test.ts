import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "@handout/site-document"
import type { Editor } from "@tiptap/core"
import type { PlaceholderOptions } from "@tiptap/extension-placeholder"
import { TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"

import { buildStablePlaceholderDecorations } from "./stable-placeholder"

describe("stable placeholder decorations", () => {
  it("decorates empty nested card fields outside the selection", () => {
    const doc = SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Selected block" }],
        },
        {
          type: "imageCard",
          content: [
            { type: "imageCardTitle" },
            { type: "imageCardBody" },
          ],
        },
      ],
    })
    const editor = {
      isEditable: true,
      isEmpty: false,
      state: { doc },
    } as unknown as Editor
    const options: PlaceholderOptions = {
      dataAttribute: "placeholder",
      emptyEditorClass: "is-editor-empty",
      emptyNodeClass: "is-empty",
      includeChildren: true,
      placeholder: ({ node }) => node.type.name,
      showOnlyCurrent: false,
      showOnlyWhenEditable: false,
    }

    const decorationSet = buildStablePlaceholderDecorations({
      doc,
      editor,
      options,
      selection: TextSelection.create(doc, 1),
    })
    const placeholders = decorationSet
      ?.find()
      .map((decoration) => doc.nodeAt(decoration.from)?.type.name)

    expect(placeholders).toEqual(["imageCardTitle", "imageCardBody"])
  })
})
