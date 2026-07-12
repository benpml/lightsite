import { getSchema, mergeAttributes, Node, type Extensions } from "@tiptap/core"
import Color from "@tiptap/extension-color"
import Emoji from "@tiptap/extension-emoji"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { BulletList, ListItem, OrderedList, TaskItem, TaskList } from "@tiptap/extension-list"
import { TableKit } from "@tiptap/extension-table"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import UniqueID from "@tiptap/extension-unique-id"
import StarterKit from "@tiptap/starter-kit"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    iconList: { toggleIconList: () => ReturnType }
    variableToken: {
      insertVariableToken: (attrs: { fallbackName: string; variableId: string }) => ReturnType
    }
  }
}

export const siteDocumentUniqueIdNodeTypes = [
  "paragraph", "heading", "blockquote", "bulletList", "codeBlock", "orderedList",
  "taskList", "pageTitleSection", "iconList", "image", "imageCard", "gifBlock",
  "iconCard", "testimonialCard", "logoGrid", "logoGridItem", "buttonBlock",
  "calendarEmbed", "videoEmbed", "gridBlock", "table", "horizontalRule",
] as const

export const SiteIconList = BulletList.extend({
  name: "iconList",
  priority: 1000,
  addOptions: () => ({ HTMLAttributes: {}, itemTypeName: "iconListItem", keepAttributes: false, keepMarks: false }),
  parseHTML: () => [{ tag: "ul[data-lightsite-icon-list]" }],
  renderHTML({ HTMLAttributes }) {
    return ["ul", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-lightsite-icon-list": "" }), 0]
  },
  addCommands() {
    return {
      toggleIconList: () => ({ commands }) =>
        commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks),
    }
  },
  addKeyboardShortcuts: () => ({}),
  addInputRules: () => [],
})

export const SiteIconListItem = ListItem.extend({
  name: "iconListItem",
  priority: 1000,
  addOptions: () => ({ HTMLAttributes: {}, bulletListTypeName: "iconList", orderedListTypeName: "iconList" }),
  addAttributes: () => ({
    icon: dataAttribute("icon", "box", true),
    iconColor: dataAttribute("icon-color", "neutral", true),
  }),
  parseHTML: () => [{ tag: "li[data-lightsite-icon-list-item]" }],
  renderHTML({ HTMLAttributes }) {
    return ["li", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-lightsite-icon-list-item": "" }), 0]
  },
})

export const SitePageTitleSection = Node.create({
  name: "pageTitleSection",
  group: "block",
  content: "pageTitleTitle pageTitleSubtitle",
  defining: true,
  isolating: true,
  addOptions: () => ({ workspaceLogoUrl: null as string | null, workspaceName: "Workspace", workspaceWebsiteDomain: "" }),
  addAttributes: () => ({
    align: {
      default: "center",
      parseHTML: (element) => normalizePageTitleAlign(element.getAttribute("data-align")),
      renderHTML: (attributes) => ({ "data-align": normalizePageTitleAlign(attributes.align) }),
    },
  }),
  parseHTML: () => [{ tag: 'section[data-lightsite-page-title=""]' }],
  renderHTML: ({ HTMLAttributes }) => ["section", mergeAttributes(HTMLAttributes, { "data-lightsite-page-title": "" }), 0],
})

export const SitePageTitleTitle = inlineNode("pageTitleTitle", "h1", "page-title-heading")
export const SitePageTitleSubtitle = inlineNode("pageTitleSubtitle", "p", "page-title-subtitle")

export const SiteImageCard = containerNode({
  name: "imageCard", tag: "figure", dataName: "image-card", content: "imageCardTitle imageCardBody",
  attributes: {
    alt: { default: "" }, buttonLabel: { default: "Learn more" }, buttonUrl: { default: "" },
    imageHeight: { default: null }, imageWidth: { default: null }, includeButton: { default: false }, src: { default: "" },
  },
})
export const SiteImageCardTitle = inlineNode("imageCardTitle", "h3", "image-card-title")
export const SiteImageCardBody = inlineNode("imageCardBody", "p", "image-card-body")

export const SiteIconCard = containerNode({
  name: "iconCard", tag: "article", dataName: "icon-card", content: "iconCardTitle iconCardBody",
  attributes: { icon: dataAttribute("icon", "bolt"), iconColor: dataAttribute("icon-color", "neutral") },
})
export const SiteIconCardTitle = inlineNode("iconCardTitle", "h3", "icon-card-title")
export const SiteIconCardBody = inlineNode("iconCardBody", "p", "icon-card-body")

export const SiteTestimonialCard = containerNode({
  name: "testimonialCard", tag: "article", dataName: "testimonial-card",
  content: "testimonialAuthorName testimonialAuthorRole testimonialQuote",
  attributes: { alt: { default: "" }, avatarHeight: { default: null }, avatarWidth: { default: null }, src: { default: "" } },
})
export const SiteTestimonialAuthorName = inlineNode("testimonialAuthorName", "p", "testimonial-author-name")
export const SiteTestimonialAuthorRole = inlineNode("testimonialAuthorRole", "p", "testimonial-author-role")
export const SiteTestimonialQuote = inlineNode("testimonialQuote", "p", "testimonial-quote")

export const SiteButtonBlock = Node.create({
  name: "buttonBlock",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,
  addAttributes: () => ({
    fullWidth: {
      default: false,
      parseHTML: (element) => element.getAttribute("data-full-width") === "true",
      renderHTML: (attributes) => attributes.fullWidth ? { "data-full-width": "true" } : {},
    },
    href: {
      default: "",
      parseHTML: (element) => element.getAttribute("href") || "",
      renderHTML: (attributes) => typeof attributes.href === "string" && attributes.href
        ? { href: attributes.href, rel: "noopener noreferrer", target: "_blank" }
        : {},
    },
  }),
  parseHTML: () => [{ tag: 'a[data-lightsite-button-block=""]' }],
  renderHTML: ({ HTMLAttributes }) => ["a", mergeAttributes(HTMLAttributes, { "data-lightsite-button-block": "" }), 0],
})

export const SiteLogoGrid = containerNode({ name: "logoGrid", tag: "section", dataName: "logo-grid", content: "logoGridItem+" })
export const SiteLogoGridItem = containerNode({
  name: "logoGridItem", tag: "article", dataName: "logo-grid-item", content: "logoGridItemTitle", group: undefined,
  attributes: { alt: { default: "" }, src: { default: "" } },
})
export const SiteLogoGridItemTitle = inlineNode("logoGridItemTitle", "p", "logo-grid-title")

export const SiteGridBlock = Node.create({
  name: "gridBlock", group: "block", content: "gridRow+", defining: true, isolating: true,
  addAttributes: () => ({
    columns: {
      default: 2,
      parseHTML: (element) => normalizeGridColumns(element.getAttribute("data-columns")),
      renderHTML: (attributes) => {
        const columns = normalizeGridColumns(attributes.columns)
        return { "data-columns": String(columns), style: `--lightsite-grid-columns:${columns}` }
      },
    },
  }),
  parseHTML: () => [{ tag: 'div[data-lightsite-grid=""]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "ls-grid", "data-lightsite-grid": "" }), 0],
})
export const SiteGridRow = containerNode({ name: "gridRow", tag: "div", dataName: "grid-row", className: "ls-grid-row", content: "gridCell+", group: undefined, isolating: false })
export const SiteGridCell = containerNode({ name: "gridCell", tag: "div", dataName: "grid-cell", className: "ls-grid-cell", content: "block+", group: undefined })

export const SiteVariableToken = Node.create({
  name: "variableToken", group: "inline", inline: true, atom: true, selectable: true,
  addAttributes: () => ({
    variableId: dataAttribute("variable-id", ""),
    fallbackName: dataAttribute("variable-name", "Variable"),
  }),
  parseHTML: () => [{ tag: "span[data-variable-id]" }],
  renderHTML: ({ HTMLAttributes, node }) => ["span", mergeAttributes(HTMLAttributes, { "data-lightsite-variable": "", class: "lightsite-editor-variable-token" }), `{${String(node.attrs.fallbackName || "Variable")}}`],
  renderText: ({ node }) => `{${String(node.attrs.fallbackName || "Variable")}}`,
  addCommands() {
    return { insertVariableToken: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }) }
  },
})

export const SiteGifBlock = Node.create({
  name: "gifBlock", group: "block", atom: true, selectable: true, draggable: true,
  addOptions: () => ({
    HTMLAttributes: { class: "lightsite-editor-gif", loading: "lazy" },
    resize: {
      enabled: true,
      directions: ["left", "right"],
      minHeight: 120,
      minWidth: 180,
      alwaysPreserveAspectRatio: true,
    },
  }),
  addAttributes: () => ({
    alt: { default: "GIF" }, giphyId: dataAttribute("giphy-id", ""), height: { default: null },
    src: { default: "" }, title: { default: "" }, width: { default: null },
  }),
  parseHTML: () => [{ tag: 'figure[data-lightsite-gif=""]' }],
  renderHTML: ({ HTMLAttributes }) => ["figure", mergeAttributes(HTMLAttributes, { "data-lightsite-gif": "" })],
})

export const SiteCalendarEmbed = embedNode("calendarEmbed", "calendar-embed", { height: { default: 420 }, src: dataAttribute("src", "") })
export const SiteVideoEmbed = embedNode("videoEmbed", "video-embed", { provider: dataAttribute("provider", ""), src: dataAttribute("src", "") })

export const SiteImage = Image.extend({ name: "image" })

export function createSiteDocumentExtensions(): Extensions {
  return [
    StarterKit.configure({ bulletList: false, link: false, listItem: false, orderedList: false, underline: false }),
    Link, Underline, TextStyle, Color, Highlight.configure({ multicolor: true }), Emoji,
    UniqueID.configure({ attributeName: "id", types: [...siteDocumentUniqueIdNodeTypes] }),
    SiteImage, SiteGifBlock, ListItem, BulletList, OrderedList, TaskList, TaskItem,
    TableKit, SiteVariableToken, SiteIconList, SiteIconListItem,
    SitePageTitleTitle, SitePageTitleSubtitle, SitePageTitleSection,
    SiteImageCardTitle, SiteImageCardBody, SiteImageCard,
    SiteIconCardTitle, SiteIconCardBody, SiteIconCard,
    SiteTestimonialAuthorName, SiteTestimonialAuthorRole, SiteTestimonialQuote, SiteTestimonialCard,
    SiteLogoGrid, SiteLogoGridItem, SiteLogoGridItemTitle,
    SiteGridCell, SiteGridRow, SiteGridBlock, SiteButtonBlock, SiteCalendarEmbed, SiteVideoEmbed,
  ]
}

export const SITE_DOCUMENT_EXTENSIONS = createSiteDocumentExtensions()
export const SITE_DOCUMENT_PROSEMIRROR_SCHEMA = getSchema(SITE_DOCUMENT_EXTENSIONS)

function inlineNode(name: string, tag: string, dataName: string) {
  return Node.create({
    name, content: "inline*", defining: true,
    parseHTML: () => [{ tag: `${tag}[data-lightsite-${dataName}]` }],
    renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { [`data-lightsite-${dataName}`]: "" }), 0],
  })
}

function containerNode(input: {
  name: string; tag: string; dataName: string; content: string; group?: string;
  className?: string; isolating?: boolean; attributes?: Record<string, Record<string, unknown>>;
}) {
  return Node.create({
    name: input.name, group: input.group === undefined && !("group" in input) ? "block" : input.group,
    content: input.content, defining: true, isolating: input.isolating ?? true,
    addAttributes: () => input.attributes ?? {},
    parseHTML: () => [{ tag: `${input.tag}[data-lightsite-${input.dataName}]` }],
    renderHTML: ({ HTMLAttributes }) => [input.tag, mergeAttributes(
      HTMLAttributes,
      input.className ? { class: input.className } : {},
      { [`data-lightsite-${input.dataName}`]: "" },
    ), 0],
  })
}

function embedNode(name: string, dataName: string, attributes: Record<string, Record<string, unknown>>) {
  return Node.create({
    name, group: "block", atom: true, selectable: true, draggable: true, isolating: true,
    addAttributes: () => attributes,
    parseHTML: () => [{ tag: `figure[data-lightsite-${dataName}]` }],
    renderHTML: ({ HTMLAttributes }) => ["figure", mergeAttributes(HTMLAttributes, { [`data-lightsite-${dataName}`]: "" })],
  })
}

function dataAttribute(name: string, defaultValue: unknown, keepOnSplit = false) {
  return {
    default: defaultValue,
    keepOnSplit,
    parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? defaultValue,
    renderHTML: (attributes: Record<string, unknown>) => ({ [`data-${name}`]: attributes[name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] }),
  }
}

function normalizePageTitleAlign(value: unknown) {
  return value === "left" || value === "right" ? "left" : "center"
}

function normalizeGridColumns(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(3, parsed)) : 2
}
