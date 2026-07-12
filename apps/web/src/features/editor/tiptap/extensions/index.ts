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
import Placeholder from "@tiptap/extension-placeholder"
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
  type LightsiteVariableOption,
  type LightsiteVariableValueMap,
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
import { LightsiteGif } from "../nodes/lightsite-gif"
import { LightsiteImage } from "../nodes/lightsite-image"
import { VideoEmbed } from "../nodes/video-embed"
import { VariableToken } from "../nodes/variable-token"
import { LightsiteNextBlockCommands } from "./block-commands"
import { LightsiteNextBlockMarqueeSelection } from "./block-marquee-selection"
import { LightsiteNextBlockSelection } from "./block-selection"
import { LightsiteNextButtonSettings } from "./button-settings"
import { LightsiteNextCalendarEmbedSettings } from "./calendar-embed-settings"
import { LightsiteNextCardNavigation } from "./card-navigation"
import { LightsiteNextDocumentLimits } from "./document-limits"
import { LightsiteNextGifPicker } from "./gif-picker"
import { LightsiteNextGridCommands } from "./grid-commands"
import { LightsiteNextImageCardButtonSettings } from "./image-card-button-settings"
import { LightsiteNextMarkdownShortcuts } from "./markdown-shortcuts"
import { LightsitePaletteColorMigration } from "./palette-color-migration"
import { LightsiteNextSelectionCleanup } from "./selection-cleanup"
import { LightsiteNextVideoEmbedSettings } from "./video-embed-settings"
import {
  createLightsiteNextEmojiSuggestion,
  LightsiteNextSlashCommands,
  LightsiteNextVariables,
} from "./suggestion-menu"

export function createEditorExtensions(
  variables: LightsiteVariableOption[],
  variableValues: LightsiteVariableValueMap = {},
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
    Placeholder.configure({
      emptyNodeClass: ({ editor, hasAnchor, node, pos }) => {
        if (node.type.name === "buttonBlock") {
          return "lightsite-editor-placeholder-hidden"
        }

        if (!hasAnchor && isRedundantGridCellParagraph(editor.state.doc, node.type.name, pos)) {
          return "lightsite-editor-placeholder-hidden"
        }

        if (isEmptyPageScaffoldParagraph(editor.state.doc, node.type.name)) {
          return "lightsite-editor-placeholder-hidden"
        }

        if (isAlwaysVisiblePlaceholderNode(editor.state.doc, node.type.name, pos)) {
          return "is-empty lightsite-editor-card-placeholder-empty"
        }

        return hasAnchor ? "is-empty" : "lightsite-editor-placeholder-hidden"
      },
      includeChildren: true,
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
      protocols: ["mailto", "tel"],
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
    LightsitePaletteColorMigration,
    Typography,
    Emoji.configure({
      enableEmoticons: true,
      HTMLAttributes: {
        class: "lightsite-editor-emoji",
      },
      suggestion: createLightsiteNextEmojiSuggestion(),
    }),
    LightsiteImage.configure({
      HTMLAttributes: {
        class: "lightsite-editor-image",
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
    LightsiteGif.configure({
      HTMLAttributes: {
        class: "lightsite-editor-gif",
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
          class: "lightsite-editor-table",
        },
        lastColumnResizable: true,
        renderWrapper: true,
        resizable: true,
      },
      tableCell: {
        HTMLAttributes: {
          class: "lightsite-editor-table-cell",
        },
      },
      tableHeader: {
        HTMLAttributes: {
          class: "lightsite-editor-table-header",
        },
      },
      tableRow: {
        HTMLAttributes: {
          class: "lightsite-editor-table-row",
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
    LightsiteNextBlockCommands,
    LightsiteNextButtonSettings,
    LightsiteNextCalendarEmbedSettings,
    LightsiteNextVideoEmbedSettings,
    LightsiteNextImageCardButtonSettings,
    LightsiteNextGifPicker,
    LightsiteNextGridCommands,
    LightsiteNextBlockMarqueeSelection,
    LightsiteNextBlockSelection,
    LightsiteNextCardNavigation,
    LightsiteNextMarkdownShortcuts,
    LightsiteNextSelectionCleanup,
    LightsiteNextDocumentLimits,
    LightsiteNextSlashCommands,
    LightsiteNextVariables.configure({
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
