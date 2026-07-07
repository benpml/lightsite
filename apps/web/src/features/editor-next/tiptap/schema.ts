import type { JSONContent } from "@tiptap/core"

export type LightsiteNextBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "blockquote"
  | "bulletList"
  | "codeBlock"
  | "orderedList"
  | "taskList"
  | "emoji"
  | "pageTitle"
  | "iconList"
  | "image"
  | "imageCard"
  | "gif"
  | "iconCard"
  | "testimonial"
  | "logoGrid"
  | "button"
  | "calendar"
  | "video"
  | "grid"
  | "table"
  | "divider"

export type LightsiteVariableOption = {
  id: string
  name: string
  slug: string
  description?: string
  defaultValue?: string
}

export type LightsiteVariableValueMap = Record<string, Record<string, string>>

export const editorNextUniqueIdNodeTypes = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "codeBlock",
  "orderedList",
  "taskList",
  "pageTitleSection",
  "iconList",
  "image",
  "imageCard",
  "gifBlock",
  "iconCard",
  "testimonialCard",
  "logoGrid",
  "logoGridItem",
  "buttonBlock",
  "calendarEmbed",
  "videoEmbed",
  "gridBlock",
  "table",
  "horizontalRule",
]

export const initialEditorNextContent: JSONContent = createFirstPageEmptyContent()

export function createFirstPageEmptyContent(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "pageTitleSection",
        attrs: { align: "center" },
        content: [
          { type: "pageTitleTitle" },
          { type: "pageTitleSubtitle" },
        ],
      },
    ],
  }
}

export function createAddedPageEmptyContent(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
      },
    ],
  }
}
