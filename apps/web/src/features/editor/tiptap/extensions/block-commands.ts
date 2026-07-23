import { Extension, type JSONContent } from "@tiptap/core"
import { Fragment } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

import type { HandoutNextBlockType } from "../schema"
import { findFirstTextSelectionPosition } from "./selection-utils"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    handoutNextBlocks: {
      insertHandoutNextBlock: (blockType: HandoutNextBlockType) => ReturnType
      insertHandoutNextBlockAfter: (pos: number, blockType: HandoutNextBlockType) => ReturnType
      insertHandoutNextCommandParagraphAfter: (pos: number) => ReturnType
      insertHandoutNextIconListItemAfter: (pos: number) => ReturnType
      duplicateHandoutNextBlock: (pos: number) => ReturnType
      deleteHandoutNextBlock: (pos: number) => ReturnType
      turnHandoutNextBlockInto: (pos: number, blockType: HandoutNextBlockType) => ReturnType
      replaceSelectionWithHandoutNextBlock: (blockType: HandoutNextBlockType) => ReturnType
    }
  }
}

export const HandoutNextBlockCommands = Extension.create({
  name: "handoutNextBlockCommands",

  addCommands() {
    return {
      insertHandoutNextBlock:
        (blockType) =>
        ({ commands, editor }) => {
          const inserted = commands.insertContent(createInsertedBlockContent(blockType))

          if (inserted && blockType === "gif") {
            editor.commands.openHandoutNextGifPicker()
          }

          if (inserted && blockType === "button") {
            editor.commands.openHandoutNextButtonSettings(undefined, "create")
          }

          if (inserted && blockType === "calendar") {
            editor.commands.openHandoutNextCalendarEmbedSettings(undefined, "create")
          }

          if (inserted && blockType === "video") {
            editor.commands.openHandoutNextVideoEmbedSettings(undefined, "create")
          }

          return inserted
        },
      insertHandoutNextBlockAfter:
        (pos, blockType) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)

          if (!node) {
            return false
          }

          if (dispatch) {
            const insertionPos = pos + node.nodeSize
            const insertedNodes = createInsertedBlockNodes(state.schema, blockType)
            const tr = state.tr.insert(insertionPos, Fragment.fromArray(insertedNodes))
            dispatch(setSelectionInsideInsertedContent(tr, insertionPos))

            if (blockType === "gif") {
              this.editor.commands.openHandoutNextGifPicker(insertionPos)
            }

            if (blockType === "button") {
              this.editor.commands.openHandoutNextButtonSettings(insertionPos, "create")
            }

            if (blockType === "calendar") {
              this.editor.commands.openHandoutNextCalendarEmbedSettings(insertionPos, "create")
            }

            if (blockType === "video") {
              this.editor.commands.openHandoutNextVideoEmbedSettings(insertionPos, "create")
            }
          }

          return true
        },
      insertHandoutNextCommandParagraphAfter:
        (pos) =>
        ({ state, dispatch, view }) => {
          const targetPos = getTopLevelBlockPosition(state.doc, pos)
          const node = state.doc.nodeAt(targetPos)
          const paragraphType = state.schema.nodes.paragraph

          if (!node || !paragraphType) {
            return false
          }

          if (dispatch) {
            const insertionPos = targetPos + node.nodeSize
            const paragraph = paragraphType.create(null, state.schema.text("/"))
            const tr = state.tr.insert(insertionPos, paragraph)

            dispatch(
              tr
                .setSelection(TextSelection.create(tr.doc, insertionPos + paragraph.nodeSize - 1))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
      insertHandoutNextIconListItemAfter:
        (pos) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)
          const iconListItemType = state.schema.nodes.iconListItem
          const paragraphType = state.schema.nodes.paragraph

          if (!node || node.type.name !== "iconListItem" || !iconListItemType || !paragraphType) {
            return false
          }

          if (dispatch) {
            const insertionPos = pos + node.nodeSize
            const nextItem = iconListItemType.create(
              { icon: node.attrs.icon ?? "box", iconColor: node.attrs.iconColor ?? "neutral" },
              paragraphType.create()
            )
            const tr = state.tr.insert(insertionPos, nextItem)

            dispatch(
              tr
                .setSelection(
                  TextSelection.near(
                    tr.doc.resolve(findFirstTextSelectionPosition(nextItem, insertionPos))
                  )
                )
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
      duplicateHandoutNextBlock:
        (pos) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)

          if (!node) {
            return false
          }

          if (dispatch) {
            const insertionPos = pos + node.nodeSize
            const copiedNode = state.schema.nodeFromJSON(stripHandoutUniqueIds(node.toJSON()))
            const tr = state.tr.insert(insertionPos, copiedNode)
            dispatch(setSelectionInsideInsertedNode(tr, insertionPos))
          }

          return true
        },
      deleteHandoutNextBlock:
        (pos) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          const $pos = state.doc.resolve(Math.max(0, Math.min(pos, state.doc.content.size)))
          const isGridCellChild = $pos.parent.type.name === "gridCell"

          if (!node || node.type.name === "gridBlock" || (!isGridCellChild && state.doc.childCount <= 1)) {
            return false
          }

          if (dispatch) {
            const paragraphType = state.schema.nodes.paragraph
            const shouldPreserveGridCellBlock =
              isGridCellChild && $pos.parent.childCount <= 1 && paragraphType
            const tr = shouldPreserveGridCellBlock
              ? state.tr.replaceWith(pos, pos + node.nodeSize, paragraphType.create())
              : state.tr.delete(pos, pos + node.nodeSize)
            const selection = TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)))
            dispatch(tr.setSelection(selection).scrollIntoView())
          }

          return true
        },
      turnHandoutNextBlockInto:
        (pos, blockType) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node) {
            return false
          }

          if (dispatch) {
            const replacement = state.schema.nodeFromJSON(
              createBlockContentWithText(blockType, node.textContent)
            )
            const tr = state.tr.replaceWith(pos, pos + node.nodeSize, replacement)
            dispatch(
              blockType === "emoji"
                ? setSelectionInsideInsertedContent(tr, pos)
                : setSelectionInsideInsertedNode(tr, pos)
            )
            view.focus()

            if (blockType === "gif") {
              this.editor.commands.openHandoutNextGifPicker(pos)
            }

            if (blockType === "button") {
              this.editor.commands.openHandoutNextButtonSettings(pos, "create")
            }

            if (blockType === "calendar") {
              this.editor.commands.openHandoutNextCalendarEmbedSettings(pos, "create")
            }

            if (blockType === "video") {
              this.editor.commands.openHandoutNextVideoEmbedSettings(pos, "create")
            }
          }

          return true
        },
      replaceSelectionWithHandoutNextBlock:
        (blockType) =>
        ({ commands, editor }) => {
          const inserted = commands.insertContent(createInsertedBlockContent(blockType))

          if (inserted && blockType === "gif") {
            editor.commands.openHandoutNextGifPicker()
          }

          if (inserted && blockType === "button") {
            editor.commands.openHandoutNextButtonSettings(undefined, "create")
          }

          if (inserted && blockType === "calendar") {
            editor.commands.openHandoutNextCalendarEmbedSettings(undefined, "create")
          }

          if (inserted && blockType === "video") {
            editor.commands.openHandoutNextVideoEmbedSettings(undefined, "create")
          }

          return inserted
        },
    }
  },
})

function getTopLevelBlockPosition(doc: import("@tiptap/pm/model").Node, pos: number) {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))

  if ($pos.parent.type.name === "gridCell") {
    return pos
  }

  if ($pos.depth <= 1) {
    return pos
  }

  return $pos.before(1)
}

export function setSelectionInsideInsertedNode(
  tr: import("@tiptap/pm/state").Transaction,
  insertedAt: number
) {
  const focusPosition = findFirstTextSelectionPosition(tr.doc.nodeAt(insertedAt), insertedAt)
  const selection = TextSelection.near(tr.doc.resolve(Math.min(focusPosition, tr.doc.content.size)))

  return tr.setSelection(selection).scrollIntoView()
}

export function setSelectionInsideInsertedContent(
  tr: import("@tiptap/pm/state").Transaction,
  insertedAt: number
) {
  const insertedNode = tr.doc.nodeAt(insertedAt)

  if (
    insertedNode?.type.name === "image" ||
    insertedNode?.type.name === "gifBlock" ||
    insertedNode?.type.name === "calendarEmbed" ||
    insertedNode?.type.name === "videoEmbed"
  ) {
    return tr.setSelection(NodeSelection.create(tr.doc, insertedAt)).scrollIntoView()
  }

  let found: number | null = null

  tr.doc.nodesBetween(insertedAt, tr.doc.content.size, (node, pos) => {
    if (found !== null || !node.isTextblock) {
      return found === null
    }

    found =
      isEmojiTriggerParagraph(node) || node.firstChild?.type.name === "emoji"
        ? pos + 1 + node.content.size
        : pos + 1
    return false
  })

  if (found === null) {
    return setSelectionInsideInsertedNode(tr, insertedAt)
  }

  return tr.setSelection(TextSelection.create(tr.doc, found)).scrollIntoView()
}

function isEmojiTriggerParagraph(node: import("@tiptap/pm/model").Node) {
  return (
    node.type.name === "paragraph" &&
    node.childCount === 1 &&
    node.firstChild?.isText === true &&
    node.firstChild.text === ":"
  )
}

export function stripHandoutUniqueIds(content: JSONContent): JSONContent {
  return {
    ...content,
    attrs: content.attrs
      ? Object.fromEntries(Object.entries(content.attrs).filter(([key]) => key !== "id"))
      : undefined,
    content: content.content?.map(stripHandoutUniqueIds),
  }
}

function createBlockContentWithText(blockType: HandoutNextBlockType, text: string): JSONContent {
  const content = createBlockContent(blockType)

  if (
    !text ||
    blockType === "divider" ||
    blockType === "gif" ||
    blockType === "calendar" ||
    blockType === "video" ||
    blockType === "emoji" ||
    blockType === "image"
  ) {
    return content
  }

  const textContent = [{ type: "text", text }]

  switch (blockType) {
    case "paragraph":
      return { type: "paragraph", content: textContent }
    case "heading1":
      return { type: "heading", attrs: { level: 1 }, content: textContent }
    case "heading2":
      return { type: "heading", attrs: { level: 2 }, content: textContent }
    case "heading3":
      return { type: "heading", attrs: { level: 3 }, content: textContent }
    case "pageTitle":
      return {
        type: "pageTitleSection",
        attrs: { align: "center" },
        content: [
          { type: "pageTitleTitle", content: textContent },
          { type: "pageTitleSubtitle" },
        ],
      }
    case "blockquote":
      return { type: "blockquote", content: [{ type: "paragraph", content: textContent }] }
    case "codeBlock":
      return { type: "codeBlock", content: textContent }
    case "bulletList":
      return {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }],
      }
    case "orderedList":
      return {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: textContent }] }],
      }
    case "taskList":
      return {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph", content: textContent }],
          },
        ],
      }
    case "iconList":
      return {
        type: "iconList",
        content: [
          {
            type: "iconListItem",
            attrs: { icon: "box", iconColor: "neutral" },
            content: [{ type: "paragraph", content: textContent }],
          },
        ],
      }
    case "iconCard":
      return {
        type: "iconCard",
        attrs: { icon: "bolt", iconColor: "neutral" },
        content: [
          { type: "iconCardTitle" },
          { type: "iconCardBody" },
        ],
      }
    case "imageCard":
      return {
        type: "imageCard",
        attrs: {
          alt: "",
          buttonLabel: "Learn more",
          buttonUrl: "",
          imageHeight: null,
          imageWidth: null,
          includeButton: false,
          src: "",
        },
        content: [
          { type: "imageCardTitle" },
          { type: "imageCardBody" },
        ],
      }
    case "testimonial":
      return createTestimonialBlockContent(text)
    case "logoGrid":
      return createLogoGridBlockContent(text)
    case "button":
      return {
        type: "buttonBlock",
        attrs: { fullWidth: false, href: "" },
        content: textContent,
      }
    case "grid":
      return createGridBlockContent(text)
    case "table":
      return createTableBlockContent(text)
    default:
      return content
  }
}

export function createBlockContent(blockType: HandoutNextBlockType): JSONContent {
  switch (blockType) {
    case "heading1":
      return {
        type: "heading",
        attrs: { level: 1 },
      }
    case "heading2":
      return {
        type: "heading",
        attrs: { level: 2 },
      }
    case "heading3":
      return {
        type: "heading",
        attrs: { level: 3 },
      }
    case "blockquote":
      return {
        type: "blockquote",
        content: [{ type: "paragraph" }],
      }
    case "bulletList":
      return {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      }
    case "codeBlock":
      return {
        type: "codeBlock",
      }
    case "orderedList":
      return {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      }
    case "taskList":
      return {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph" }],
          },
        ],
      }
    case "emoji":
      return {
        type: "paragraph",
        content: [{ type: "text", text: ":" }],
      }
    case "pageTitle":
      return {
        type: "pageTitleSection",
        attrs: { align: "center" },
        content: [
          { type: "pageTitleTitle" },
          { type: "pageTitleSubtitle" },
        ],
      }
    case "iconList":
      return {
        type: "iconList",
        content: [
          {
            type: "iconListItem",
            attrs: { icon: "box", iconColor: "neutral" },
            content: [{ type: "paragraph" }],
          },
        ],
      }
    case "image":
      return {
        type: "image",
      }
    case "imageCard":
      return {
        type: "imageCard",
        attrs: {
          alt: "",
          buttonLabel: "Learn more",
          buttonUrl: "",
          imageHeight: null,
          imageWidth: null,
          includeButton: false,
          src: "",
        },
        content: [
          { type: "imageCardTitle" },
          { type: "imageCardBody" },
        ],
      }
    case "gif":
      return {
        type: "gifBlock",
      }
    case "iconCard":
      return {
        type: "iconCard",
        attrs: { icon: "bolt", iconColor: "neutral" },
        content: [
          { type: "iconCardTitle" },
          { type: "iconCardBody" },
        ],
      }
    case "testimonial":
      return createTestimonialBlockContent()
    case "logoGrid":
      return createLogoGridBlockContent()
    case "grid":
      return createGridBlockContent()
    case "table":
      return createTableBlockContent()
    case "button":
      return {
        type: "buttonBlock",
        attrs: { fullWidth: false, href: "" },
        content: [{ type: "text", text: "Button" }],
      }
    case "calendar":
      return {
        type: "calendarEmbed",
        attrs: { src: "" },
      }
    case "video":
      return {
        type: "videoEmbed",
        attrs: { provider: "", src: "" },
      }
    case "divider":
      return { type: "horizontalRule" }
    case "paragraph":
    default:
      return { type: "paragraph" }
  }
}

export function createInsertedBlockContent(blockType: HandoutNextBlockType): JSONContent | JSONContent[] {
  const content = createBlockContent(blockType)

  if (
    blockType === "divider" ||
    blockType === "gif" ||
    blockType === "image" ||
    blockType === "calendar" ||
    blockType === "video" ||
    blockType === "table"
  ) {
    return [content, { type: "paragraph" }]
  }

  return content
}

function createTestimonialBlockContent(quoteText?: string): JSONContent {
  return {
    type: "testimonialCard",
    attrs: {
      alt: "",
      avatarHeight: null,
      avatarWidth: null,
      src: "",
    },
    content: [
      { type: "testimonialAuthorName" },
      { type: "testimonialAuthorRole" },
      quoteText
        ? { type: "testimonialQuote", content: [{ type: "text", text: quoteText }] }
        : { type: "testimonialQuote" },
    ],
  }
}

function createLogoGridBlockContent(firstTitle?: string): JSONContent {
  const titles = firstTitle ? [firstTitle, "", "", "", "", ""] : ["", "", "", "", "", ""]

  return {
    type: "logoGrid",
    content: titles.map((title) => ({
      type: "logoGridItem",
      attrs: {
        alt: "",
        src: "",
      },
      content: [
        title
          ? { type: "logoGridItemTitle", content: [{ type: "text", text: title }] }
          : { type: "logoGridItemTitle" },
      ],
    })),
  }
}

function createTableBlockContent(firstCellText?: string): JSONContent {
  const firstCellParagraph = firstCellText
    ? { type: "paragraph", content: [{ type: "text", text: firstCellText }] }
    : { type: "paragraph" }

  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          { type: "tableHeader", content: [firstCellParagraph] },
          { type: "tableHeader", content: [{ type: "paragraph" }] },
          { type: "tableHeader", content: [{ type: "paragraph" }] },
        ],
      },
      {
        type: "tableRow",
        content: [
          { type: "tableCell", content: [{ type: "paragraph" }] },
          { type: "tableCell", content: [{ type: "paragraph" }] },
          { type: "tableCell", content: [{ type: "paragraph" }] },
        ],
      },
      {
        type: "tableRow",
        content: [
          { type: "tableCell", content: [{ type: "paragraph" }] },
          { type: "tableCell", content: [{ type: "paragraph" }] },
          { type: "tableCell", content: [{ type: "paragraph" }] },
        ],
      },
    ],
  }
}

function createGridBlockContent(firstCellText?: string): JSONContent {
  return {
    type: "gridBlock",
    attrs: { columns: 2 },
    content: [
      {
        type: "gridRow",
        content: [
          {
            type: "gridCell",
            content: [
              firstCellText
                ? { type: "paragraph", content: [{ type: "text", text: firstCellText }] }
                : { type: "paragraph" },
            ],
          },
          {
            type: "gridCell",
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  }
}

function createInsertedBlockNodes(
  schema: import("@tiptap/pm/model").Schema,
  blockType: HandoutNextBlockType
) {
  const content = createInsertedBlockContent(blockType)
  const contentItems = Array.isArray(content) ? content : [content]

  return contentItems.map((item) => schema.nodeFromJSON(item))
}
