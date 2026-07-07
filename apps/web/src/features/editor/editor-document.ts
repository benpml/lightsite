import type { JSONContent } from "@tiptap/core"

export type EditorSiteHeaderAttrs = {
  brandName: string
  logoUrl: string
  primaryButtonText: string
  secondaryButtonText: string
  showSecondaryButton: boolean
}

export type EditorHeroAttrs = {
  avatarHidden: boolean
  avatarImage: string
  avatarImageSecondary: string
  avatarImageSecondaryVariable: string
  avatarImageVariable: string
  subtitle: string
  title: string
}

export type EditorPageChrome = {
  header: EditorSiteHeaderAttrs
  hero: EditorHeroAttrs
}

const defaultHeaderAttrs: EditorSiteHeaderAttrs = {
  brandName: "",
  logoUrl: "",
  primaryButtonText: "Book a call",
  secondaryButtonText: "Add button",
  showSecondaryButton: true,
}

const defaultHeroAttrs: EditorHeroAttrs = {
  avatarHidden: false,
  avatarImage: "",
  avatarImageSecondary: "",
  avatarImageSecondaryVariable: "",
  avatarImageVariable: "",
  subtitle: "Example Subtitle",
  title: "Example Title",
}

const editorChromeNodeTypes = new Set(["siteHeader", "heroBlock", "siteFooter"])

export const initialEditorContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "siteHeader",
      attrs: defaultHeaderAttrs,
    },
    {
      type: "heroBlock",
      attrs: defaultHeroAttrs,
    },
    { type: "sectionDivider" },
    blockContent("headingBlock", "Heading 1", { level: 1 }),
    blockContent("headingBlock", "Heading 2", { level: 2 }),
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
        createIconListItem("Example text", { icon: "box" }),
        createIconListItem("Example text", { icon: "alien" }),
        createIconListItem("Example text", { icon: "balloon" }),
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
}

export function getEditorPageChrome(content: JSONContent): EditorPageChrome {
  const topLevelContent = content.content ?? []
  const headerNode = topLevelContent.find((node) => node.type === "siteHeader")
  const heroNode = topLevelContent.find((node) => node.type === "heroBlock")

  return {
    header: coerceHeaderAttrs(headerNode?.attrs),
    hero: coerceHeroAttrs(heroNode?.attrs),
  }
}

export function getEditorBodyContent(content: JSONContent): JSONContent {
  return {
    ...content,
    type: "doc",
    content: (content.content ?? [])
      .filter((node) => !node.type || !editorChromeNodeTypes.has(node.type))
      .map((node) => ({ ...node })),
  }
}

export function composeEditorContent(
  chrome: EditorPageChrome,
  bodyContent: JSONContent
): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "siteHeader",
        attrs: chrome.header,
      },
      {
        type: "heroBlock",
        attrs: chrome.hero,
      },
      ...(bodyContent.content ?? []),
    ],
  }
}

export function serializeEditorContent(content: JSONContent) {
  return JSON.stringify(content)
}

function coerceHeaderAttrs(attrs: JSONContent["attrs"]): EditorSiteHeaderAttrs {
  return {
    brandName: stringAttr(attrs, "brandName", defaultHeaderAttrs.brandName),
    logoUrl: stringAttr(attrs, "logoUrl", defaultHeaderAttrs.logoUrl),
    primaryButtonText: stringAttr(attrs, "primaryButtonText", defaultHeaderAttrs.primaryButtonText),
    secondaryButtonText: stringAttr(attrs, "secondaryButtonText", defaultHeaderAttrs.secondaryButtonText),
    showSecondaryButton: booleanAttr(attrs, "showSecondaryButton", defaultHeaderAttrs.showSecondaryButton),
  }
}

function coerceHeroAttrs(attrs: JSONContent["attrs"]): EditorHeroAttrs {
  return {
    avatarHidden: booleanAttr(attrs, "avatarHidden", defaultHeroAttrs.avatarHidden),
    avatarImage: stringAttr(attrs, "avatarImage", defaultHeroAttrs.avatarImage),
    avatarImageSecondary: stringAttr(attrs, "avatarImageSecondary", defaultHeroAttrs.avatarImageSecondary),
    avatarImageSecondaryVariable: stringAttr(attrs, "avatarImageSecondaryVariable", defaultHeroAttrs.avatarImageSecondaryVariable),
    avatarImageVariable: stringAttr(attrs, "avatarImageVariable", defaultHeroAttrs.avatarImageVariable),
    subtitle: stringAttr(attrs, "subtitle", defaultHeroAttrs.subtitle),
    title: stringAttr(attrs, "title", defaultHeroAttrs.title),
  }
}

function stringAttr(
  attrs: JSONContent["attrs"],
  key: string,
  fallback: string
) {
  const value = attrs?.[key]
  return typeof value === "string" ? value : fallback
}

function booleanAttr(
  attrs: JSONContent["attrs"],
  key: string,
  fallback: boolean
) {
  const value = attrs?.[key]
  return typeof value === "boolean" ? value : fallback
}

function blockContent(type: string, text: string, attrs?: Record<string, unknown>): JSONContent {
  return {
    type,
    attrs,
    content: text ? [{ type: "text", text }] : undefined,
  }
}

function createIconListItem(
  text: string,
  attrs?: { icon?: string; iconTone?: string }
): JSONContent {
  return {
    type: "iconListItem",
    attrs: {
      icon: attrs?.icon ?? "box",
      iconTone: attrs?.iconTone ?? "default",
    },
    content: text ? [{ type: "text", text }] : undefined,
  }
}
