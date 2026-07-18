import { clampTextToLimit } from "@handout/domain"
import {
  createDefaultSiteContent,
  defaultSiteSidebar,
  getSiteSidebarModel,
  type SiteContent,
  type SiteContentPage,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type TiptapNode,
} from "@handout/site-document"

import { normalizeButtonHref } from "./lib/button-link"
import { createAddedPageEmptyContent } from "./tiptap/schema"

export type EditorPageStatus = "visible" | "hidden"
export type EditorSidebarButtonStyle = "filled" | "outline"
export type EditorSitePage = SiteContentPage

export type EditorSidebarSectionKey = "tabs" | "links" | "nextSteps"

export type EditorSidebarSections = Record<EditorSidebarSectionKey, { label: string }>

export type EditorSidebarLink = SiteSidebarLink
export type EditorSidebarButton = SiteSidebarButton
export type EditorSidebarButtonInput = Pick<EditorSidebarButton, "href" | "icon" | "label" | "style">

export type EditorSidebarState = {
  sections: EditorSidebarSections
  links: EditorSidebarLink[]
  nextSteps: EditorSidebarButton[]
}

export type EditorSiteDraft = SiteContent

export const defaultEditorSidebarSections: EditorSidebarSections = structuredClone(defaultSiteSidebar.sections)

export function createEditorSiteDraft(siteName: string): EditorSiteDraft {
  const pageName = siteName && siteName !== "Page draft" ? siteName : "Overview"
  const content = createDefaultSiteContent(pageName)
  content.pages[0]!.id = createEditorId()
  return content
}

export function createEditorPage(name: string, existingPages: EditorSitePage[]) {
  const trimmedName = createUniquePageName(
    clampTextToLimit(name, "siteName").trim() || "Untitled",
    existingPages
  )
  const existingSlugs = existingPages.map((page) => page.slug)

  return {
    id: createEditorId(),
    name: trimmedName,
    slug: createSlug(trimmedName, existingSlugs),
    status: "visible" as const,
    sortOrder: getNextSortOrder(existingPages),
    document: createBlankPageBody(),
  }
}

export function createUniquePageName(value: string, existingPages: EditorSitePage[]) {
  const existingNames = new Set(existingPages.map((page) => page.name.trim().toLowerCase()))
  const baseName = value.trim() || "Untitled"

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  let nextName = `${baseName} ${suffix}`

  while (existingNames.has(nextName.toLowerCase())) {
    suffix += 1
    nextName = `${baseName} ${suffix}`
  }

  return nextName
}

export function createBlankPageBody(): TiptapNode {
  return createAddedPageEmptyContent() as TiptapNode
}

export function normalizeSectionLabel(key: EditorSidebarSectionKey, value: string) {
  const trimmedValue = value.trim()

  return clampTextToLimit(trimmedValue || defaultEditorSidebarSections[key].label, "sectionLabel")
}

export function createSidebarLink(
  input: Pick<EditorSidebarLink, "label" | "href">,
  existingLinks: EditorSidebarLink[]
): EditorSidebarLink {
  const href = normalizeSidebarHref(input.href) ?? clampTextToLimit(input.href, "url").trim()

  return {
    id: createEditorId(),
    label: clampTextToLimit(input.label, "sidebarLabel").trim(),
    href,
    icon: "link",
    sortOrder: getNextSortOrder(existingLinks),
    status: "visible",
  }
}

export function createSidebarButton(
  input: EditorSidebarButtonInput,
  existingButtons: EditorSidebarButton[]
): EditorSidebarButton {
  const href = normalizeSidebarHref(input.href) ?? clampTextToLimit(input.href, "url").trim()

  return {
    id: createEditorId(),
    label: clampTextToLimit(input.label, "sidebarLabel").trim(),
    href,
    ...(input.icon ? { icon: input.icon } : {}),
    style: input.style,
    sortOrder: getNextSortOrder(existingButtons),
    status: "visible",
  }
}

export function reorderSidebarPages(
  pages: EditorSitePage[],
  activePageId: string,
  overPageId: string
) {
  return reorderSidebarItems(pages, activePageId, overPageId)
}

export function reorderSidebarLinks(
  links: EditorSidebarLink[],
  activeLinkId: string,
  overLinkId: string
) {
  return reorderSidebarItems(links, activeLinkId, overLinkId)
}

export function reorderSidebarButtons(
  buttons: EditorSidebarButton[],
  activeButtonId: string,
  overButtonId: string
) {
  return reorderSidebarItems(buttons, activeButtonId, overButtonId)
}

function reorderSidebarItems<TItem extends { id: string; sortOrder: number }>(
  items: TItem[],
  activeItemId: string,
  overItemId: string
) {
  if (activeItemId === overItemId) {
    return items
  }

  const orderedItems = [...items].sort((left, right) => left.sortOrder - right.sortOrder)
  const activeIndex = orderedItems.findIndex((item) => item.id === activeItemId)
  const overIndex = orderedItems.findIndex((item) => item.id === overItemId)

  if (activeIndex === -1 || overIndex === -1) {
    return items
  }

  const [activeItem] = orderedItems.splice(activeIndex, 1)

  if (!activeItem) {
    return items
  }

  orderedItems.splice(overIndex, 0, activeItem)

  return orderedItems.map((item, sortOrder) => ({
    ...item,
    sortOrder,
  }))
}

export function getOrderedVisiblePages(pages: EditorSitePage[]) {
  return pages
    .filter((page) => page.status === "visible")
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

export function getEditorSidebarModel(draft: EditorSiteDraft) {
  return getSiteSidebarModel(draft, { includeIncompleteItems: true })
}

export function getPublicSidebarModel(draft: EditorSiteDraft) {
  return getSiteSidebarModel(draft)
}

export function createSlug(value: string, existingSlugs: string[]) {
  const baseSlug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"
  let slug = baseSlug
  let suffix = 2

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}

export function isUrlish(value: string) {
  return normalizeSidebarHref(value) !== null
}

export function normalizeSidebarHref(value: string) {
  return normalizeButtonHref(value)
}

function createEditorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getNextSortOrder(items: Array<{ sortOrder: number }>) {
  return items.reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1
}
