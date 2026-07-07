import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { TextSelection } from "@tiptap/pm/state"

import type { EditableBlockType } from "../editor-data"

export type IconName =
  | "alien"
  | "balloon"
  | "box"
  | "calendar"
  | "click"
  | "database"
  | "desktop"
  | "flag"
  | "heart"
  | "mail"
  | "phone"
  | "quote"
  | "rocket"
  | "shield"
  | "slack"
  | "stars"
  | "target"
  | "users"
  | "video"
  | "world"

export type IconTone =
  | "amber"
  | "blue"
  | "cyan"
  | "default"
  | "pink"
  | "rose"
  | "teal"
  | "violet"

export type BlockRange = {
  from: number
  node: ProseMirrorNode
  to: number
}

export function blockContent(
  type: string,
  text: string,
  attrs?: Record<string, unknown>
): JSONContent {
  return {
    type,
    attrs,
    content: text ? [{ type: "text", text }] : undefined,
  }
}

export function createTiptapBlock(type: EditableBlockType, seedText = ""): JSONContent {
  if (type === "title") {
    return blockContent("headingBlock", seedText, { level: 1 })
  }

  if (type === "heading") {
    return blockContent("headingBlock", seedText, { level: 2 })
  }

  if (type === "text") {
    return blockContent("textBlock", seedText)
  }

  if (type === "divider") {
    return { type: "sectionDivider" }
  }

  if (type === "bullet-list" || type === "number-list") {
    return {
      type: type === "number-list" ? "orderedList" : "bulletList",
      content: [createListItem(seedText)],
    }
  }

  if (type === "icon-list") {
    return {
      type: "iconList",
      content: [createIconListItem("")],
    }
  }

  if (type === "image") {
    return { type: "imageBlock", attrs: { alt: seedText || "Image" } }
  }

  if (type === "gif") {
    return {
      type: "gifBlock",
      attrs: {
        alt: seedText || "GIF",
        giphyId: "",
        height: null,
        promptOnMount: true,
        src: "",
        width: null,
      },
    }
  }

  if (type === "image-card") {
    return {
      type: "imageCardBlock",
      attrs: {
        alt: "Image",
        body: "Description text.",
        buttonText: "Button",
        buttonUrl: "https://example.com",
        includeButton: true,
        title: seedText || "Title",
      },
    }
  }

  if (type === "icon-card") {
    return {
      type: "iconCardBlock",
      attrs: {
        body: "Description example.",
        icon: "box",
        iconTone: "default",
        includeIcon: true,
        title: seedText || "Example Title",
      },
    }
  }

  if (type === "button") {
    return {
      type: "buttonBlock",
      attrs: { style: "outline", text: seedText || "Button", url: "https://example.com" },
    }
  }

  if (type === "calendar") {
    return {
      type: "calendarBlock",
      attrs: { text: seedText || "Book a call", url: "https://example.com/book" },
    }
  }

  if (type === "accordion") {
    return {
      type: "accordionBlock",
      attrs: {
        items: [{ id: "accordion-1", title: seedText || "Title", body: "Description", expanded: true }],
      },
    }
  }

  if (type === "video") {
    return { type: "videoBlock", attrs: { url: "" } }
  }

  if (type === "testimonial") {
    return {
      type: "testimonialBlock",
      attrs: {
        name: "Alex Morgan",
        quote: seedText || "Lightsite helped us send a polished, personalized follow-up in minutes.",
        role: "VP Sales, Acme",
      },
    }
  }

  return {
    type: "logoGridBlock",
    attrs: {
      logos: [
        { id: "logo-1", name: "Acme" },
        { id: "logo-2", name: "Northstar" },
        { id: "logo-3", name: "Orbit" },
        { id: "logo-4", name: "Linear" },
        { id: "logo-5", name: "Shopify" },
        { id: "logo-6", name: "Framer" },
      ],
    },
  }
}

export function createIconListItem(
  text: string,
  attrs: { icon?: IconName; iconTone?: IconTone } = {}
): JSONContent {
  return {
    type: "iconListItem",
    attrs: {
      icon: attrs.icon ?? "box",
      iconTone: attrs.iconTone ?? "default",
    },
    content: text ? [{ type: "text", text }] : undefined,
  }
}

export function createTemporaryTextBlock({
  temporary = true,
}: { temporary?: boolean } = {}): JSONContent {
  return {
    type: "textBlock",
    attrs: { temporary },
  }
}

export function createListItem(text: string): JSONContent {
  return {
    type: "listItem",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : undefined,
      },
    ],
  }
}

export function isEditorContentNode(nodeTypeName: string) {
  return (
    nodeTypeName === "sectionDivider" ||
    nodeTypeName === "textBlock" ||
    nodeTypeName === "headingBlock" ||
    nodeTypeName === "bulletList" ||
    nodeTypeName === "orderedList" ||
    nodeTypeName === "iconList" ||
    nodeTypeName === "imageBlock" ||
    nodeTypeName === "gifBlock" ||
    nodeTypeName === "imageCardBlock" ||
    nodeTypeName === "iconCardBlock" ||
    nodeTypeName === "buttonBlock" ||
    nodeTypeName === "calendarBlock" ||
    nodeTypeName === "accordionBlock" ||
    nodeTypeName === "videoBlock" ||
    nodeTypeName === "testimonialBlock" ||
    nodeTypeName === "logoGridBlock"
  )
}

export function getEditableBlockType(node: ProseMirrorNode): EditableBlockType | null {
  if (node.type.name === "sectionDivider") return "divider"
  if (node.type.name === "textBlock" || node.type.name === "paragraph") return "text"
  if (node.type.name === "headingBlock") {
    return Number(node.attrs.level ?? 1) === 1 ? "title" : "heading"
  }
  if (node.type.name === "bulletList") return "bullet-list"
  if (node.type.name === "orderedList") return "number-list"
  if (node.type.name === "iconList") return "icon-list"
  if (node.type.name === "imageBlock") return "image"
  if (node.type.name === "gifBlock") return "gif"
  if (node.type.name === "imageCardBlock") return "image-card"
  if (node.type.name === "iconCardBlock") return "icon-card"
  if (node.type.name === "buttonBlock") return "button"
  if (node.type.name === "calendarBlock") return "calendar"
  if (node.type.name === "accordionBlock") return "accordion"
  if (node.type.name === "videoBlock") return "video"
  if (node.type.name === "testimonialBlock") return "testimonial"
  if (node.type.name === "logoGridBlock") return "logo-grid"

  return null
}

export function getTopLevelBlockRange(state: EditorState): BlockRange | null {
  const { $from } = state.selection

  if ($from.depth === 0) {
    return null
  }

  const node = $from.node(1)

  return {
    from: $from.before(1),
    node,
    to: $from.after(1),
  }
}

export function shouldReplaceCurrentBlockOnInsert(node: ProseMirrorNode) {
  return (
    (node.type.name === "textBlock" || node.type.name === "paragraph") &&
    node.textContent.trim() === ""
  )
}

export function setSelectionInsideInsertedNode(
  transaction: Transaction,
  position: number,
  node: ProseMirrorNode
) {
  const docSize = transaction.doc.content.size
  const selectionPosition = getTextSelectionPositionInsideNode(position, node)

  if (selectionPosition === null || selectionPosition > docSize) {
    return
  }

  try {
    transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition))
  } catch {
    try {
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition), 1))
    } catch {
      // Selection placement is a convenience; the document transaction should still complete.
    }
  }
}

function getTextSelectionPositionInsideNode(position: number, node: ProseMirrorNode) {
  if (node.isTextblock) {
    return position + 1 + node.content.size
  }

  let selectionPosition: number | null = null

  node.descendants((child, offset) => {
    if (!child.isTextblock) {
      return true
    }

    selectionPosition = position + 1 + offset + 1 + child.content.size
    return false
  })

  return selectionPosition
}

export function insertBlockAtSelection(editor: TiptapEditor, type: EditableBlockType) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const node = state.schema.nodeFromJSON(createTiptapBlock(type))
      const range = getTopLevelBlockRange(state)
      let transaction = state.tr
      let insertPosition = state.selection.to

      if (range && shouldReplaceCurrentBlockOnInsert(range.node)) {
        transaction = transaction.replaceWith(range.from, range.to, node)
        insertPosition = range.from
      } else if (range) {
        transaction = transaction.insert(range.to, node)
        insertPosition = range.to
      } else {
        transaction = transaction.replaceSelectionWith(node)
      }

      setSelectionInsideInsertedNode(transaction, insertPosition, node)
      dispatch?.(transaction.scrollIntoView())

      return true
    })
    .run()
}

export function insertBlockAfterPosition(
  editor: TiptapEditor,
  position: number,
  node: ProseMirrorNode,
  type: EditableBlockType
) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const nextNode = state.schema.nodeFromJSON(createTiptapBlock(type))
      const insertPosition = position + node.nodeSize
      const transaction = state.tr.insert(insertPosition, nextNode)

      setSelectionInsideInsertedNode(transaction, insertPosition, nextNode)
      dispatch?.(transaction.scrollIntoView())

      return true
    })
    .run()
}
