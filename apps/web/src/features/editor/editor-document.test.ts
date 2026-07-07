import { describe, expect, it } from "vitest"

import {
  composeEditorContent,
  getEditorBodyContent,
  getEditorPageChrome,
  initialEditorContent,
} from "./editor-document"

describe("editor document helpers", () => {
  it("keeps fixed page chrome out of the editable Tiptap body", () => {
    expect(getEditorBodyContent(initialEditorContent)).toEqual({
      type: "doc",
      content: [
        { type: "sectionDivider" },
        {
          type: "headingBlock",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Heading 1" }],
        },
        {
          type: "headingBlock",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading 2" }],
        },
        {
          type: "textBlock",
          content: [
            { type: "text", text: "Playmaker is a high-performance " },
            { type: "text", text: "AI sales rep", marks: [{ type: "bold" }] },
            { type: "text", text: " that runs prospecting and outbound sales for {{example_a}} on autopilot." },
          ],
        },
        {
          type: "iconList",
          content: [
            { type: "iconListItem", attrs: { icon: "box", iconTone: "default" }, content: [{ type: "text", text: "Example text" }] },
            { type: "iconListItem", attrs: { icon: "alien", iconTone: "default" }, content: [{ type: "text", text: "Example text" }] },
            { type: "iconListItem", attrs: { icon: "balloon", iconTone: "default" }, content: [{ type: "text", text: "Example text" }] },
          ],
        },
        {
          type: "imageCardBlock",
          attrs: {
            alt: "Product dashboard",
            body: "Description text.",
            buttonText: "Button",
            buttonUrl: "https://example.com",
            includeButton: true,
            src: "/editor-assets/image-card.png",
            title: "Title",
          },
        },
        {
          type: "iconCardBlock",
          attrs: {
            body: "Description example.",
            icon: "box",
            iconTone: "default",
            includeIcon: true,
            title: "Example Title",
          },
        },
      ],
    })
  })

  it("recomposes chrome and body content into the persisted page shape", () => {
    const chrome = getEditorPageChrome(initialEditorContent)
    const body = getEditorBodyContent(initialEditorContent)

    expect(composeEditorContent(chrome, body)).toEqual(initialEditorContent)
  })
})
