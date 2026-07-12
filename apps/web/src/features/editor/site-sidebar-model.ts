import { clampTextToLimit } from "@lightsite/domain"
import {
  createDefaultSiteContent,
  defaultSiteSidebar,
  getSiteSidebarModel,
  type SiteContent,
  type SiteContentPage,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type TiptapNode,
} from "@lightsite/site-document"

import { normalizeButtonHref } from "./lib/button-link"
import { createAddedPageEmptyContent } from "./tiptap/schema"

export type EditorPageStatus = "visible" | "hidden"
export type EditorSidebarButtonStyle = "filled" | "outline"
export type EditorSitePage = SiteContentPage

export type EditorSidebarSectionKey = "tabs" | "links" | "nextSteps"

export type EditorSidebarSections = Record<EditorSidebarSectionKey, { label: string }>

export type EditorSidebarLink = SiteSidebarLink
export type EditorSidebarButton = SiteSidebarButton

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
    sortOrder: existingPages.length,
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
    icon: "website",
    sortOrder: existingLinks.length,
    status: "visible",
  }
}

export function createSidebarButton(
  input: Pick<EditorSidebarButton, "label" | "href" | "style">,
  existingButtons: EditorSidebarButton[]
): EditorSidebarButton {
  const href = normalizeSidebarHref(input.href) ?? clampTextToLimit(input.href, "url").trim()

  return {
    id: createEditorId(),
    label: clampTextToLimit(input.label, "sidebarLabel").trim(),
    href,
    style: input.style,
    sortOrder: existingButtons.length,
    status: "visible",
  }
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
