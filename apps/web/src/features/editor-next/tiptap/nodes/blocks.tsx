import { mergeAttributes, Node } from "@tiptap/core"
import { BulletList, ListItem } from "@tiptap/extension-list"
import { ReactNodeViewRenderer } from "@tiptap/react"

import {
  ButtonBlockView,
  IconCardView,
  IconListItemView,
  ImageCardView,
  LogoGridItemView,
  LogoGridView,
  PageTitleSectionView,
  TestimonialCardView,
} from "./block-views"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    iconList: {
      toggleIconList: () => ReturnType
    }
  }
}

export const IconList = BulletList.extend({
  name: "iconList",
  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
      itemTypeName: "iconListItem",
      keepAttributes: false,
      keepMarks: false,
    }
  },

  parseHTML() {
    return [{ tag: "ul[data-lightsite-icon-list]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ul",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-lightsite-icon-list": "",
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleIconList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks)
        },
    }
  },

  addKeyboardShortcuts() {
    return {}
  },

  addInputRules() {
    return []
  },
})

export const IconListItem = ListItem.extend({
  name: "iconListItem",
  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
      bulletListTypeName: "iconList",
      orderedListTypeName: "iconList",
    }
  },

  addAttributes() {
    return {
      icon: {
        default: "box",
        keepOnSplit: true,
        parseHTML: (element) => element.getAttribute("data-icon") || "box",
        renderHTML: (attributes) => ({ "data-icon": attributes.icon }),
      },
      iconColor: {
        default: "neutral",
        keepOnSplit: true,
        parseHTML: (element) => element.getAttribute("data-icon-color") || "neutral",
        renderHTML: (attributes) => ({ "data-icon-color": attributes.iconColor }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "li[data-lightsite-icon-list-item]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-lightsite-icon-list-item": "",
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(IconListItemView, {
      as: "li",
      className: "lightsite-next-icon-list-item",
      attrs: ({ node }) => ({
        "data-icon": String(node.attrs.icon ?? "box"),
        "data-icon-color": String(node.attrs.iconColor ?? "neutral"),
        "data-lightsite-icon-list-item": "",
        "data-lightsite-next-block-type": "icon-list-item",
        "data-lightsite-next-nested-block": "",
      }),
    })
  },
})

export const PageTitleSection = Node.create({
  name: "pageTitleSection",
  group: "block",
  content: "pageTitleTitle pageTitleSubtitle",
  defining: true,
  isolating: true,

  addOptions() {
    return {
      workspaceLogoUrl: null as string | null,
      workspaceName: "Workspace",
      workspaceWebsiteDomain: "",
    }
  },

  addAttributes() {
    return {
      align: {
        default: "center",
        parseHTML: (element) => normalizePageTitleAlign(element.getAttribute("data-align")),
        renderHTML: (attributes) => ({ "data-align": normalizePageTitleAlign(attributes.align) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-lightsite-page-title=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-lightsite-page-title": "" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageTitleSectionView)
  },
})

export const PageTitleTitle = Node.create({
  name: "pageTitleTitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'h1[data-lightsite-page-title-heading=""]' },
      { tag: 'h2[data-lightsite-page-title-heading=""]' },
      { tag: 'p[data-lightsite-page-title-heading=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "h1",
      mergeAttributes(HTMLAttributes, { "data-lightsite-page-title-heading": "" }),
      0,
    ]
  },
})

export const PageTitleSubtitle = Node.create({
  name: "pageTitleSubtitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'p[data-lightsite-page-title-subtitle=""]' },
      { tag: 'h2[data-lightsite-page-title-subtitle=""]' },
      { tag: 'h3[data-lightsite-page-title-subtitle=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-lightsite-page-title-subtitle": "" }),
      0,
    ]
  },
})

function normalizePageTitleAlign(value: unknown) {
  return value === "left" || value === "right" ? "left" : "center"
}

export const ImageCard = Node.create({
  name: "imageCard",
  group: "block",
  content: "imageCardTitle imageCardBody",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      alt: { default: "" },
      buttonLabel: { default: "Learn more" },
      buttonUrl: { default: "" },
      imageHeight: { default: null },
      imageWidth: { default: null },
      includeButton: { default: false },
      src: { default: "" },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-lightsite-image-card=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-lightsite-image-card": "" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageCardView)
  },
})

export const ImageCardTitle = Node.create({
  name: "imageCardTitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'h3[data-lightsite-image-card-title=""]' },
      { tag: 'h1[data-lightsite-image-card-title=""]' },
      { tag: 'h2[data-lightsite-image-card-title=""]' },
      { tag: 'p[data-lightsite-image-card-title=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["h3", mergeAttributes(HTMLAttributes, { "data-lightsite-image-card-title": "" }), 0]
  },
})

export const ImageCardBody = Node.create({
  name: "imageCardBody",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'p[data-lightsite-image-card-body=""]' },
      { tag: 'h1[data-lightsite-image-card-body=""]' },
      { tag: 'h2[data-lightsite-image-card-body=""]' },
      { tag: 'h3[data-lightsite-image-card-body=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-lightsite-image-card-body": "" }), 0]
  },
})

export const IconCard = Node.create({
  name: "iconCard",
  group: "block",
  content: "iconCardTitle iconCardBody",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      icon: {
        default: "bolt",
        parseHTML: (element) => element.getAttribute("data-icon") || "bolt",
        renderHTML: (attributes) => ({ "data-icon": attributes.icon }),
      },
      iconColor: {
        default: "neutral",
        parseHTML: (element) => element.getAttribute("data-icon-color") || "neutral",
        renderHTML: (attributes) => ({ "data-icon-color": attributes.iconColor }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'article[data-lightsite-icon-card=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["article", mergeAttributes(HTMLAttributes, { "data-lightsite-icon-card": "" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(IconCardView)
  },
})

export const IconCardTitle = Node.create({
  name: "iconCardTitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'h3[data-lightsite-icon-card-title=""]' },
      { tag: 'h1[data-lightsite-icon-card-title=""]' },
      { tag: 'h2[data-lightsite-icon-card-title=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["h3", mergeAttributes(HTMLAttributes, { "data-lightsite-icon-card-title": "" }), 0]
  },
})

export const IconCardBody = Node.create({
  name: "iconCardBody",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'p[data-lightsite-icon-card-body=""]' },
      { tag: 'h1[data-lightsite-icon-card-body=""]' },
      { tag: 'h2[data-lightsite-icon-card-body=""]' },
      { tag: 'h3[data-lightsite-icon-card-body=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-lightsite-icon-card-body": "" }), 0]
  },
})

export const TestimonialCard = Node.create({
  name: "testimonialCard",
  group: "block",
  content: "testimonialAuthorName testimonialAuthorRole testimonialQuote",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      alt: { default: "" },
      avatarHeight: { default: null },
      avatarWidth: { default: null },
      src: { default: "" },
    }
  },

  parseHTML() {
    return [{ tag: 'article[data-lightsite-testimonial-card=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "article",
      mergeAttributes(HTMLAttributes, { "data-lightsite-testimonial-card": "" }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TestimonialCardView)
  },
})

export const TestimonialAuthorName = Node.create({
  name: "testimonialAuthorName",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-lightsite-testimonial-author-name=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-lightsite-testimonial-author-name": "" }),
      0,
    ]
  },
})

export const TestimonialAuthorRole = Node.create({
  name: "testimonialAuthorRole",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-lightsite-testimonial-author-role=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-lightsite-testimonial-author-role": "" }),
      0,
    ]
  },
})

export const TestimonialQuote = Node.create({
  name: "testimonialQuote",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-lightsite-testimonial-quote=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-lightsite-testimonial-quote": "" }),
      0,
    ]
  },
})

export const ButtonBlock = Node.create({
  name: "buttonBlock",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      fullWidth: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-full-width") === "true",
        renderHTML: (attributes) =>
          attributes.fullWidth ? { "data-full-width": "true" } : {},
      },
      href: {
        default: "",
        parseHTML: (element) => element.getAttribute("href") || "",
        renderHTML: (attributes) =>
          typeof attributes.href === "string" && attributes.href.length > 0
            ? { href: attributes.href, rel: "noopener noreferrer", target: "_blank" }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-lightsite-button-block=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-lightsite-button-block": "" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ButtonBlockView)
  },
})

export const LogoGrid = Node.create({
  name: "logoGrid",
  group: "block",
  content: "logoGridItem+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-lightsite-logo-grid=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-lightsite-logo-grid": "" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LogoGridView)
  },
})

export const LogoGridItem = Node.create({
  name: "logoGridItem",
  content: "logoGridItemTitle",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      alt: { default: "" },
      src: { default: "" },
    }
  },

  parseHTML() {
    return [{ tag: 'article[data-lightsite-logo-grid-item=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "article",
      mergeAttributes(HTMLAttributes, { "data-lightsite-logo-grid-item": "" }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LogoGridItemView)
  },
})

export const LogoGridItemTitle = Node.create({
  name: "logoGridItemTitle",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      { tag: 'p[data-lightsite-logo-grid-title=""]' },
      { tag: 'h3[data-lightsite-logo-grid-title=""]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-lightsite-logo-grid-title": "" }), 0]
  },
})

export const GridBlock = Node.create({
  name: "gridBlock",
  group: "block",
  content: "gridRow+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => getGridColumnAttribute(element.getAttribute("data-columns")),
        renderHTML: (attributes) => {
          const columns = getGridColumnAttribute(attributes.columns)

          return {
            "data-columns": String(columns),
            style: `--lightsite-grid-columns: ${columns};`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-lightsite-grid=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lightsite-grid": "" }), 0]
  },
})

export const GridRow = Node.create({
  name: "gridRow",
  content: "gridCell+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-lightsite-grid-row=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lightsite-grid-row": "" }), 0]
  },
})

export const GridCell = Node.create({
  name: "gridCell",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-lightsite-grid-cell=""]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lightsite-grid-cell": "" }), 0]
  },
})

function getGridColumnAttribute(value: unknown) {
  const columns = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(columns)) {
    return 2
  }

  return Math.max(1, Math.min(3, columns))
}
