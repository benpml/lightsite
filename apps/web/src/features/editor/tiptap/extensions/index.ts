import Focus from "@tiptap/extension-focus"
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import Color from "@tiptap/extension-color"
import Emoji from "@tiptap/extension-emoji"
import Highlight from "@tiptap/extension-highlight"
import Link from "@tiptap/extension-link"
import { BulletList, ListItem, ListKeymap, OrderedList, TaskItem, TaskList } from "@tiptap/extension-list"
import NodeRange from "@tiptap/extension-node-range"
import { TableKit } from "@tiptap/extension-table"
import { TextStyle } from "@tiptap/extension-text-style"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import UniqueID from "@tiptap/extension-unique-id"
import { TrailingNode } from "@tiptap/extensions/trailing-node"
import StarterKit from "@tiptap/starter-kit"
import type * as Y from "yjs"

import {
  editorUniqueIdNodeTypes,
  type HandoutVariableOption,
  type HandoutVariableValueMap,
} from "../schema"
import {
  ButtonBlock,
  GridBlock,
  GridCell,
  GridRow,
  IconCard,
  IconCardBody,
  IconCardTitle,
  IconList,
  IconListItem,
  ImageCard,
  ImageCardBody,
  ImageCardTitle,
  LogoGrid,
  LogoGridItem,
  LogoGridItemTitle,
  PageTitleSection,
  PageTitleSubtitle,
  PageTitleTitle,
  TestimonialAuthorName,
  TestimonialAuthorRole,
  TestimonialCard,
  TestimonialQuote,
} from "../nodes/blocks"
import { CalendarEmbed } from "../nodes/calendar-embed"
import { HandoutGif } from "../nodes/handout-gif"
import { HandoutImage } from "../nodes/handout-image"
import { VideoEmbed } from "../nodes/video-embed"
import { VariableToken } from "../nodes/variable-token"
import { HandoutNextBlockCommands } from "./block-commands"
import { HandoutNextBlockMarqueeSelection } from "./block-marquee-selection"
import { HandoutNextBlockSelection } from "./block-selection"
import { HandoutNextButtonSettings } from "./button-settings"
import { HandoutNextCalendarEmbedSettings } from "./calendar-embed-settings"
import { HandoutNextCardNavigation } from "./card-navigation"
import { HandoutNextDocumentLimits } from "./document-limits"
import { HandoutNextGifPicker } from "./gif-picker"
import { HandoutNextGridCommands } from "./grid-commands"
import { HandoutNextImageCardButtonSettings } from "./image-card-button-settings"
import { HandoutNextMarkdownShortcuts } from "./markdown-shortcuts"
import { HandoutPaletteColorMigration } from "./palette-color-migration"
import { HandoutNextSelectionCleanup } from "./selection-cleanup"
import { StablePlaceholder } from "./stable-placeholder"
import { HandoutNextVideoEmbedSettings } from "./video-embed-settings"
import {
  createHandoutNextEmojiSuggestion,
  HandoutNextSlashCommands,
  HandoutNextVariables,
} from "./suggestion-menu"

export function createEditorExtensions(
  variables: HandoutVariableOption[],
  variableValues: HandoutVariableValueMap = {},
  activeVariantId = "default",
  pageTitleContext: {
    workspaceLogoUrl?: string | null
    workspaceName?: string
    workspaceWebsiteDomain?: string
  } = {},
  collaboration?: {
    document: Y.Doc
    field: string
    provider: HocuspocusProvider
    user: {
      color: string
      id: string
      name: string
    }
    undoManager: Y.UndoManager
  },
) {
  return [
    StarterKit.configure({
      bulletList: false,
      dropcursor: {
        color: "var(--color-indigo-700)",
        width: 1,
      },
      heading: {
        levels: [1, 2, 3],
      },
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      trailingNode: false,
      underline: false,
      undoRedo: collaboration ? false : undefined,
    }),
    StablePlaceholder.configure({
      emptyNodeClass: ({ editor, hasAnchor, node, pos }) => {
        if (node.type.name === "buttonBlock") {
          return "handout-editor-placeholder-hidden"
        }

        if (!hasAnchor && isRedundantGridCellParagraph(editor.state.doc, node.type.name, pos)) {
          return "handout-editor-placeholder-hidden"
        }

        if (isEmptyPageScaffoldParagraph(editor.state.doc, node.type.name)) {
          return "handout-editor-placeholder-hidden"
        }

        if (isAlwaysVisiblePlaceholderNode(editor.state.doc, node.type.name, pos)) {
          return "is-empty handout-editor-card-placeholder-empty"
        }

        return hasAnchor ? "is-empty" : "handout-editor-placeholder-hidden"
      },
      includeChildren: true,
      // Preview uses a separate renderer and hides this editor. Keep its
      // decorations mounted so toggling read-only mode cannot discard empty
      // block placeholders before the editor becomes editable again.
      showOnlyWhenEditable: false,
      showOnlyCurrent: false,
      placeholder: ({ editor, node, pos }) => {
        if (node.type.name === "heading") {
          if (node.attrs.level === 1) {
            return "Untitled"
          }

          return node.attrs.level === 2 ? "Heading 2" : "Heading 3"
        }

        if (node.type.name === "paragraph") {
          if (isTableCellParagraph(editor.state.doc, node.type.name, pos)) {
            return "Type here"
          }

          return "Type / for blocks or { for variables"
        }

        if (node.type.name === "pageTitleTitle") {
          return "Page Title"
        }

        if (node.type.name === "pageTitleSubtitle") {
          return "Description"
        }

        if (node.type.name === "iconCardTitle") {
          return "Heading 3"
        }

        if (node.type.name === "iconCardBody") {
          return "Supporting text"
        }

        if (node.type.name === "imageCardTitle") {
          return "Title"
        }

        if (node.type.name === "imageCardBody") {
          return "Description"
        }

        if (node.type.name === "testimonialAuthorName") {
          return "Name"
        }

        if (node.type.name === "testimonialAuthorRole") {
          return "Role"
        }

        if (node.type.name === "testimonialQuote") {
          return "“Quote”"
        }

        if (node.type.name === "logoGridItemTitle") {
          return "Title"
        }

        return ""
      },
    }),
    UniqueID.configure({
      attributeName: "id",
      filterTransaction: collaboration
        ? (transaction) => !isChangeOrigin(transaction)
        : null,
      types: editorUniqueIdNodeTypes,
    }),
    Link.configure({
      autolink: true,
      defaultProtocol: "https",
      enableClickSelection: true,
      linkOnPaste: true,
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    HandoutPaletteColorMigration,
    Typography,
    Emoji.configure({
      enableEmoticons: true,
      HTMLAttributes: {
        class: "handout-editor-emoji",
      },
      suggestion: createHandoutNextEmojiSuggestion(),
    }),
    HandoutImage.configure({
      HTMLAttributes: {
        class: "handout-editor-image",
        loading: "lazy",
      },
      resize: {
        enabled: true,
        directions: ["left", "right"],
        minWidth: 180,
        minHeight: 120,
        alwaysPreserveAspectRatio: true,
      },
    }),
    HandoutGif.configure({
      HTMLAttributes: {
        class: "handout-editor-gif",
        loading: "lazy",
      },
      resize: {
        enabled: true,
        directions: ["left", "right"],
        minWidth: 180,
        minHeight: 120,
        alwaysPreserveAspectRatio: true,
      },
    }),
    TrailingNode.configure({
      node: "paragraph",
      notAfter: ["paragraph", "heading", "pageTitleSection"],
    }),
    Focus.configure({
      className: "has-focus",
      mode: "deepest",
    }),
    NodeRange.configure({
      key: null,
    }),
    ListItem,
    BulletList,
    OrderedList,
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: {
        checkboxLabel: (node, checked) =>
          `${checked ? "Completed" : "Incomplete"} task: ${node.textContent || "empty item"}`,
      },
    }),
    ListKeymap.configure({
      listTypes: [
        { itemName: "listItem", wrapperNames: ["bulletList", "orderedList"] },
        { itemName: "taskItem", wrapperNames: ["taskList"] },
        { itemName: "iconListItem", wrapperNames: ["iconList"] },
      ],
    }),
    TableKit.configure({
      table: {
        allowTableNodeSelection: true,
        cellMinWidth: 120,
        HTMLAttributes: {
          class: "handout-editor-table",
        },
        lastColumnResizable: true,
        renderWrapper: true,
        resizable: true,
      },
      tableCell: {
        HTMLAttributes: {
          class: "handout-editor-table-cell",
        },
      },
      tableHeader: {
        HTMLAttributes: {
          class: "handout-editor-table-header",
        },
      },
      tableRow: {
        HTMLAttributes: {
          class: "handout-editor-table-row",
        },
      },
    }),
    VariableToken,
    IconList,
    IconListItem,
    PageTitleTitle,
    PageTitleSubtitle,
    PageTitleSection.configure(pageTitleContext),
    ImageCardTitle,
    ImageCardBody,
    ImageCard,
    IconCardTitle,
    IconCardBody,
    IconCard,
    TestimonialAuthorName,
    TestimonialAuthorRole,
    TestimonialQuote,
    TestimonialCard,
    LogoGrid,
    LogoGridItem,
    LogoGridItemTitle,
    GridCell,
    GridRow,
    GridBlock,
    ButtonBlock,
    CalendarEmbed,
    VideoEmbed,
    HandoutNextBlockCommands,
    HandoutNextButtonSettings,
    HandoutNextCalendarEmbedSettings,
    HandoutNextVideoEmbedSettings,
    HandoutNextImageCardButtonSettings,
    HandoutNextGifPicker,
    HandoutNextGridCommands,
    HandoutNextBlockMarqueeSelection,
    HandoutNextBlockSelection,
    HandoutNextCardNavigation,
    HandoutNextMarkdownShortcuts,
    HandoutNextSelectionCleanup,
    HandoutNextDocumentLimits,
    HandoutNextSlashCommands,
    HandoutNextVariables.configure({
      activeVariantId,
      values: variableValues,
      variables,
    }),
    ...(collaboration
      ? [
          Collaboration.configure({
            document: collaboration.document,
            field: collaboration.field,
            yUndoOptions: {
              undoManager: collaboration.undoManager,
            },
          }),
          CollaborationCaret.configure({
            provider: collaboration.provider,
            user: collaboration.user,
          }),
        ]
      : []),
  ]
}

function isAlwaysVisiblePlaceholderNode(
  doc: import("@tiptap/pm/model").Node,
  nodeName: string,
  pos: number
) {
  return (
    nodeName === "iconCardTitle" ||
    nodeName === "iconCardBody" ||
    nodeName === "pageTitleTitle" ||
    nodeName === "pageTitleSubtitle" ||
    nodeName === "imageCardTitle" ||
    nodeName === "imageCardBody" ||
    nodeName === "testimonialAuthorName" ||
    nodeName === "testimonialAuthorRole" ||
    nodeName === "testimonialQuote" ||
    nodeName === "logoGridItemTitle" ||
    isGridCellParagraph(doc, nodeName, pos)
  )
}

function isEmptyPageScaffoldParagraph(
  doc: import("@tiptap/pm/model").Node,
  nodeName: string
) {
  return (
    nodeName === "paragraph" &&
    doc.childCount === 1 &&
    doc.firstChild?.type.name === "paragraph" &&
    doc.firstChild.content.size === 0
  )
}

function isGridCellParagraph(
  doc: import("@tiptap/pm/model").Node,
  nodeName: string,
  pos: number
) {
  if (nodeName !== "paragraph") {
    return false
  }

  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))

  return $pos.parent.type.name === "gridCell" && $pos.parent.childCount === 1
}

function isTableCellParagraph(
  doc: import("@tiptap/pm/model").Node,
  nodeName: string,
  pos: number
) {
  if (nodeName !== "paragraph") {
    return false
  }

  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))

  return $pos.parent.type.name === "tableCell" || $pos.parent.type.name === "tableHeader"
}

function isRedundantGridCellParagraph(
  doc: import("@tiptap/pm/model").Node,
  nodeName: string,
  pos: number
) {
  if (nodeName !== "paragraph") {
    return false
  }

  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))

  return $pos.parent.type.name === "gridCell" && $pos.parent.childCount > 1
}
