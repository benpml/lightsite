import type { JSONContent } from "@tiptap/core"

import { normalizeButtonHref } from "./lib/button-link"
import { createAddedPageEmptyContent, initialEditorNextContent } from "./tiptap/schema"

export type EditorNextPageStatus = "visible" | "hidden"
export type EditorNextSidebarButtonStyle = "filled" | "outline"

export type EditorNextSitePage = {
  id: string
  name: string
  slug: string
  status: EditorNextPageStatus
  sortOrder: number
  body: JSONContent
  createdAt: string
  updatedAt: string
}

export type EditorNextSidebarSectionKey = "tabs" | "links" | "nextSteps"

export type EditorNextSidebarSections = Record<EditorNextSidebarSectionKey, { label: string }>

export type EditorNextSidebarLink = {
  id: string
  label: string
  href: string
  icon: "link" | "website"
  sortOrder: number
  status: EditorNextPageStatus
}

export type EditorNextSidebarButton = {
  id: string
  label: string
  href: string
  style: EditorNextSidebarButtonStyle
  sortOrder: number
  status: EditorNextPageStatus
}

export type EditorNextSidebarState = {
  sections: EditorNextSidebarSections
  links: EditorNextSidebarLink[]
  nextSteps: EditorNextSidebarButton[]
}

export type EditorNextSiteDraft = {
  pages: EditorNextSitePage[]
  sidebar: EditorNextSidebarState
}

export const defaultEditorNextSidebarSections: EditorNextSidebarSections = {
  tabs: { label: "Tabs" },
  links: { label: "Links" },
  nextSteps: { label: "Next steps" },
}

export function createEditorNextSiteDraft(siteName: string): EditorNextSiteDraft {
  const now = new Date().toISOString()
  const pageName = siteName && siteName !== "Page draft" ? siteName : "Overview"

  return {
    pages: [
      {
        id: createEditorNextId(),
        name: pageName,
        slug: createSlug(pageName, []),
        status: "visible",
        sortOrder: 0,
        body: structuredClone(initialEditorNextContent),
        createdAt: now,
        updatedAt: now,
      },
    ],
    sidebar: {
      sections: structuredClone(defaultEditorNextSidebarSections),
      links: [],
      nextSteps: [],
    },
  }
}

export function createEditorNextPage(name: string, existingPages: EditorNextSitePage[]) {
  const now = new Date().toISOString()
  const trimmedName = createUniquePageName(name.trim() || "Untitled", existingPages)
  const existingSlugs = existingPages.map((page) => page.slug)

  return {
    id: createEditorNextId(),
    name: trimmedName,
    slug: createSlug(trimmedName, existingSlugs),
    status: "visible" as const,
    sortOrder: existingPages.length,
    body: createBlankPageBody(),
    createdAt: now,
    updatedAt: now,
  }
}

export function createUniquePageName(value: string, existingPages: EditorNextSitePage[]) {
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

export function createBlankPageBody(): JSONContent {
  return createAddedPageEmptyContent()
}

export function normalizeSectionLabel(key: EditorNextSidebarSectionKey, value: string) {
  const trimmedValue = value.trim()

  return trimmedValue || defaultEditorNextSidebarSections[key].label
}

export function createSidebarLink(
  input: Pick<EditorNextSidebarLink, "label" | "href">,
  existingLinks: EditorNextSidebarLink[]
): EditorNextSidebarLink {
  const href = normalizeSidebarHref(input.href) ?? input.href.trim()

  return {
    id: createEditorNextId(),
    label: input.label.trim(),
    href,
    icon: "website",
    sortOrder: existingLinks.length,
    status: "visible",
  }
}

export function createSidebarButton(
  input: Pick<EditorNextSidebarButton, "label" | "href" | "style">,
  existingButtons: EditorNextSidebarButton[]
): EditorNextSidebarButton {
  const href = normalizeSidebarHref(input.href) ?? input.href.trim()

  return {
    id: createEditorNextId(),
    label: input.label.trim(),
    href,
    style: input.style,
    sortOrder: existingButtons.length,
    status: "visible",
  }
}

export function getOrderedVisiblePages(pages: EditorNextSitePage[]) {
  return pages
    .filter((page) => page.status === "visible")
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

export function getEditorSidebarModel(draft: EditorNextSiteDraft) {
  return {
    sections: draft.sidebar.sections,
    pages: getOrderedVisiblePages(draft.pages),
    links: draft.sidebar.links
      .filter((link) => link.status === "visible")
      .sort((left, right) => left.sortOrder - right.sortOrder),
    nextSteps: draft.sidebar.nextSteps
      .filter((button) => button.status === "visible")
      .sort((left, right) => left.sortOrder - right.sortOrder),
  }
}

export function getPublicSidebarModel(draft: EditorNextSiteDraft) {
  const editorModel = getEditorSidebarModel(draft)
  const tabItems = editorModel.pages.length >= 2 ? editorModel.pages : []
  const links = editorModel.links.filter((link) => link.label && link.href)
  const nextSteps = editorModel.nextSteps.filter((button) => button.label && button.href)

  return {
    sections: editorModel.sections,
    pages: tabItems,
    links,
    nextSteps,
    showSidebar: tabItems.length > 0 || links.length > 0 || nextSteps.length > 0,
  }
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

function createEditorNextId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
