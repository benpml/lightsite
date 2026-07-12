import type { Schema } from "@tiptap/pm/model"
import { LIGHTSITE_COLLECTION_LIMITS } from "@lightsite/domain"
import {
  prosemirrorJSONToYXmlFragment,
  yXmlFragmentToProsemirrorJSON,
} from "y-prosemirror"
import * as Y from "yjs"

import {
  siteContentSchema,
  createDefaultSiteContent,
  type SiteContent,
  type TiptapNode,
} from "./model"
import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "./tiptap/site-extensions"

export const SITE_COLLABORATION_DOCUMENT_PREFIX = "site:"
export const SITE_COLLABORATION_METADATA_FIELD = "site:metadata"

const PAGE_FRAGMENT_PREFIX = "site:page:"

interface JsonObject {
  [key: string]: JsonValue
}
type JsonValue = boolean | number | string | null | JsonObject | JsonValue[]

export function getSiteCollaborationDocumentName(siteId: string) {
  return `${SITE_COLLABORATION_DOCUMENT_PREFIX}${siteId}`
}

export function parseSiteCollaborationDocumentName(documentName: string) {
  if (!documentName.startsWith(SITE_COLLABORATION_DOCUMENT_PREFIX)) {
    return null
  }

  const siteId = documentName.slice(SITE_COLLABORATION_DOCUMENT_PREFIX.length).trim()
  return siteId || null
}

export function getSitePageCollaborationField(pageId: string) {
  return `${PAGE_FRAGMENT_PREFIX}${pageId}`
}

export function isSiteCollaborationDocumentInitialized(document: Y.Doc) {
  return document.getMap(SITE_COLLABORATION_METADATA_FIELD).get("schemaVersion") !== undefined
}

/** Seed an empty Y.Doc exactly once from the canonical JSON draft. */
export function initializeSiteCollaborationDocument(
  document: Y.Doc,
  content: SiteContent,
  schema: Schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA,
) {
  if (isSiteCollaborationDocumentInitialized(document)) {
    return
  }

  document.transact(() => {
    writeSiteCollaborationMetadata(document, content)

    for (const page of content.pages) {
      prosemirrorJSONToYXmlFragment(
        schema,
        page.document,
        document.getXmlFragment(getSitePageCollaborationField(page.id)),
      )
    }
  }, "lightsite-initialize")
}

/**
 * Reconcile a canonical snapshot into an existing Y.Doc without replacing its
 * CRDT history. This is used by non-WebSocket writers such as the REST/MCP API.
 */
export function replaceSiteCollaborationContent(
  document: Y.Doc,
  content: SiteContent,
  schema: Schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA,
) {
  document.transact(() => {
    writeSiteCollaborationMetadata(document, content)

    const livePageIds = new Set(content.pages.map((page) => page.id))
    for (const page of content.pages) {
      prosemirrorJSONToYXmlFragment(
        schema,
        page.document,
        document.getXmlFragment(getSitePageCollaborationField(page.id)),
      )
    }

    for (const [fieldName, value] of document.share) {
      if (
        fieldName.startsWith(PAGE_FRAGMENT_PREFIX) &&
        value instanceof Y.XmlFragment &&
        !livePageIds.has(fieldName.slice(PAGE_FRAGMENT_PREFIX.length)) &&
        value.length > 0
      ) {
        value.delete(0, value.length)
      }
    }
  }, "lightsite-replace")
}

export function readSiteCollaborationContent(document: Y.Doc): SiteContent {
  const metadata = document.getMap(SITE_COLLABORATION_METADATA_FIELD).toJSON() as Record<string, unknown>
  const pages = Array.isArray(metadata.pages)
    ? metadata.pages.map((value) => {
      const page = value as Record<string, unknown>
      const id = typeof page.id === "string" ? page.id : ""

      return {
        ...page,
        document: readSitePageCollaborationContent(document, id),
      }
    })
    : []

  return siteContentSchema.parse({ ...metadata, pages })
}

export function readSitePageCollaborationContent(document: Y.Doc, pageId: string): TiptapNode {
  return yXmlFragmentToProsemirrorJSON(
    document.getXmlFragment(getSitePageCollaborationField(pageId)),
  ) as TiptapNode
}

export function writeSiteCollaborationMetadata(document: Y.Doc, content: SiteContent) {
  const metadata = document.getMap<JsonValue>(SITE_COLLABORATION_METADATA_FIELD)
  const serializable = {
    schemaVersion: content.schemaVersion,
    themeMode: content.themeMode,
    settings: content.settings,
    variables: content.variables,
    pages: content.pages.map(({ document: _document, ...page }) => page),
    sidebar: content.sidebar,
  } as JsonObject

  reconcileMap(metadata, serializable)
}

/** Update site chrome/collections and seed only newly introduced page fields. */
export function updateSiteCollaborationMetadata(
  document: Y.Doc,
  content: SiteContent,
  schema: Schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA,
) {
  document.transact(() => {
    const previousPageIds = getMetadataPageIds(document)
    writeSiteCollaborationMetadata(document, content)
    const nextPageIds = new Set(content.pages.map((page) => page.id))

    for (const page of content.pages) {
      const fragment = document.getXmlFragment(getSitePageCollaborationField(page.id))
      if (fragment.length === 0) {
        prosemirrorJSONToYXmlFragment(schema, page.document, fragment)
      }
    }

    for (const removedPageId of previousPageIds) {
      if (nextPageIds.has(removedPageId)) {
        continue
      }

      const fragment = document.getXmlFragment(getSitePageCollaborationField(removedPageId))
      if (fragment.length > 0) {
        fragment.delete(0, fragment.length)
      }
    }
  }, "lightsite-metadata")
}

export type SiteCollaborationRepair = "collection-limit" | "page-required"

/** Repair only invariants that can be violated by otherwise-valid concurrent edits. */
export function repairSiteCollaborationDocument(
  document: Y.Doc,
  schema: Schema = SITE_DOCUMENT_PROSEMIRROR_SCHEMA,
): SiteCollaborationRepair[] {
  const repairs = new Set<SiteCollaborationRepair>()

  document.transact(() => {
    const metadata = document.getMap<JsonValue>(SITE_COLLABORATION_METADATA_FIELD)
    const pages = metadata.get("pages")

    if (pages instanceof Y.Array) {
      if (pages.length === 0) {
        const recoveryPage = createDefaultSiteContent("Untitled").pages[0]!
        recoveryPage.id = createRecoveryPageId(document)
        pages.push([createYValue(withoutPageDocument(recoveryPage))])
        prosemirrorJSONToYXmlFragment(
          schema,
          recoveryPage.document,
          document.getXmlFragment(getSitePageCollaborationField(recoveryPage.id)),
        )
        repairs.add("page-required")
      }

      trimArray(pages, LIGHTSITE_COLLECTION_LIMITS.tabs, repairs)
    }

    const variables = metadata.get("variables")
    if (variables instanceof Y.Array) {
      trimArray(variables, 200, repairs)
    }

    const sidebar = metadata.get("sidebar")
    if (sidebar instanceof Y.Map) {
      for (const key of ["links", "nextSteps"]) {
        const collection = sidebar.get(key)
        if (collection instanceof Y.Array) {
          trimArray(collection, LIGHTSITE_COLLECTION_LIMITS.links, repairs)
        }
      }
    }
  }, "lightsite-repair")

  return [...repairs]
}

function reconcileMap(target: Y.Map<JsonValue>, next: JsonObject) {
  for (const key of target.keys()) {
    if (!(key in next)) {
      target.delete(key)
    }
  }

  for (const [key, value] of Object.entries(next)) {
    reconcileMapValue(target, key, value)
  }
}

function reconcileMapValue(target: Y.Map<JsonValue>, key: string, next: JsonValue) {
  const current = target.get(key)

  if (Array.isArray(next)) {
    if (current instanceof Y.Array) {
      reconcileArray(current as unknown as Y.Array<JsonValue>, next)
    } else {
      target.set(key, createYValue(next))
    }
    return
  }

  if (isJsonObject(next)) {
    if (current instanceof Y.Map) {
      reconcileMap(current as unknown as Y.Map<JsonValue>, next)
    } else {
      target.set(key, createYValue(next))
    }
    return
  }

  if (!Object.is(current, next)) {
    target.set(key, next)
  }
}

function reconcileArray(target: Y.Array<JsonValue>, next: JsonValue[]) {
  if (isStableIdArray(next)) {
    reconcileStableIdArray(target, next)
    return
  }

  if (JSON.stringify(target.toJSON()) === JSON.stringify(next)) {
    return
  }

  if (target.length > 0) {
    target.delete(0, target.length)
  }
  if (next.length > 0) {
    target.insert(0, next.map(createYValue))
  }
}

function reconcileStableIdArray(target: Y.Array<JsonValue>, next: JsonObject[]) {
  const nextById = new Map(next.map((entry) => [entry.id as string, entry]))

  for (let index = target.length - 1; index >= 0; index -= 1) {
    const current = target.get(index)
    const id = current instanceof Y.Map ? current.get("id") : null

    if (typeof id !== "string" || !nextById.has(id)) {
      target.delete(index, 1)
    }
  }

  const currentById = new Map<string, Y.Map<JsonValue>>()
  for (const current of target.toArray()) {
    if (current instanceof Y.Map) {
      const id = current.get("id")
      if (typeof id === "string") {
        currentById.set(id, current as unknown as Y.Map<JsonValue>)
      }
    }
  }

  for (const entry of next) {
    const id = entry.id as string
    const current = currentById.get(id)

    if (current) {
      reconcileMap(current, entry)
    } else {
      target.push([createYValue(entry)])
    }
  }
}

function createYValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    const array = new Y.Array<JsonValue>()
    if (value.length > 0) {
      array.insert(0, value.map(createYValue))
    }
    return array as unknown as JsonValue
  }

  if (isJsonObject(value)) {
    const map = new Y.Map<JsonValue>()
    for (const [key, entry] of Object.entries(value)) {
      map.set(key, createYValue(entry))
    }
    return map as unknown as JsonValue
  }

  return value
}

function isStableIdArray(value: JsonValue[]): value is JsonObject[] {
  return value.length > 0 && value.every(
    (entry) => isJsonObject(entry) && typeof entry.id === "string" && entry.id.length > 0,
  )
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getMetadataPageIds(document: Y.Doc) {
  const pages = document.getMap<JsonValue>(SITE_COLLABORATION_METADATA_FIELD).get("pages")
  if (!(pages instanceof Y.Array)) {
    return new Set<string>()
  }

  return new Set(pages.toArray().flatMap((page) => {
    if (!(page instanceof Y.Map)) {
      return []
    }
    const id = page.get("id")
    return typeof id === "string" ? [id] : []
  }))
}

function trimArray(
  value: Y.Array<unknown>,
  limit: number,
  repairs: Set<SiteCollaborationRepair>,
) {
  if (value.length <= limit) {
    return
  }

  value.delete(limit, value.length - limit)
  repairs.add("collection-limit")
}

function withoutPageDocument(page: SiteContent["pages"][number]) {
  const { document: _document, ...metadata } = page
  return metadata as JsonObject
}

function createRecoveryPageId(document: Y.Doc) {
  return `recovered-${document.clientID}-${Date.now().toString(36)}`
}
