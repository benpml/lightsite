import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { HocuspocusProvider } from "@hocuspocus/provider"
import {
  createDefaultSiteContent,
  getSiteCollaborationDocumentName,
  getSitePageCollaborationField,
  readSiteCollaborationContent,
  updateSiteCollaborationMetadata,
  SITE_DOCUMENT_SCHEMA_VERSION,
} from "@lightsite/site-document"
import * as Y from "yjs"
import type { SiteRecord } from "../sites/repository"
import type { SiteCollaborationRepository } from "./repository"
import {
  attachSiteCollaborationWebSocketServer,
  createSiteCollaborationServer,
} from "./server"

const cleanup: Array<() => Promise<void> | void> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dispose) => dispose()))
})

describe("site collaboration server", () => {
  it("merges live and offline edits, broadcasts presence, and persists canonical content", async () => {
    const draftContent = createDefaultSiteContent("Shared page")
    draftContent.pages[0]!.document = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "middle" }] }],
    }
    let site = createSiteRecord(draftContent)
    let persistedState: Uint8Array | null = null
    const repository: SiteCollaborationRepository = {
      async load(siteId) {
        return siteId === site.id ? { site, state: persistedState } : null
      },
      async persist(input) {
        if (input.siteId !== site.id || input.workspaceId !== site.workspaceId) {
          return null
        }

        const changed = !persistedState || !arraysEqual(persistedState, input.state)
        persistedState = input.state
        if (changed) {
          site = {
            ...site,
            draftContent: input.draftContent,
            draftRevision: site.draftRevision + 1,
            updatedAt: new Date(),
            updatedByUserId: input.updatedByUserId,
          }
        }
        return site
      },
    }
    const collaboration = createSiteCollaborationServer({
      repository,
      async authorize() {
        return {
          userId: "user-1",
          workspaceId: site.workspaceId,
          user: { id: "user-1", name: "Test User", color: "#2563eb" },
        }
      },
    })
    const httpServer = createServer()
    const destroyCollaboration = attachSiteCollaborationWebSocketServer(
      httpServer,
      collaboration.hocuspocus,
    )
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve))
    const address = httpServer.address()
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a TCP port.")
    }
    const url = `ws://127.0.0.1:${address.port}/api/collaboration`
    const leftDocument = new Y.Doc()
    const rightDocument = new Y.Doc()
    const leftStates: number[] = []
    const rightStates: number[] = []
    const left = new HocuspocusProvider({
      url,
      name: getSiteCollaborationDocumentName(site.id),
      document: leftDocument,
      token: JSON.stringify({ schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION }),
      onAwarenessUpdate: ({ states }) => leftStates.push(states.length),
    })
    const right = new HocuspocusProvider({
      url,
      name: getSiteCollaborationDocumentName(site.id),
      document: rightDocument,
      token: JSON.stringify({ schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION }),
      onAwarenessUpdate: ({ states }) => rightStates.push(states.length),
    })
    cleanup.push(async () => {
      left.destroy()
      right.destroy()
      leftDocument.destroy()
      rightDocument.destroy()
      await destroyCollaboration()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    })

    await Promise.all([waitForSynced(left), waitForSynced(right)])
    left.setAwarenessField("user", { id: "left", name: "Left", color: "#2563eb" })
    right.setAwarenessField("user", { id: "right", name: "Right", color: "#dc2626" })
    await waitFor(() => leftStates.some((count) => count >= 2) && rightStates.some((count) => count >= 2))

    const pageId = draftContent.pages[0]!.id
    const leftText = getFirstPageText(leftDocument, pageId)
    const rightText = getFirstPageText(rightDocument, pageId)
    leftText.insert(0, "left ")
    rightText.insert(rightText.length, " right")
    await waitFor(() => getFirstPageText(leftDocument, pageId).toString() === "left middle right")
    await waitFor(() => getFirstPageText(rightDocument, pageId).toString() === "left middle right")

    right.disconnect()
    await waitFor(() => !right.isSynced)
    getFirstPageText(rightDocument, pageId).insert(0, "offline ")
    getFirstPageText(leftDocument, pageId).insert(leftText.length, " online")
    await right.connect()
    await waitForSynced(right)
    await waitFor(() => getFirstPageText(leftDocument, pageId).toString() === "offline left middle right online")
    await waitFor(() => getFirstPageText(rightDocument, pageId).toString() === "offline left middle right online")

    const leftContent = readSiteCollaborationContent(leftDocument)
    leftContent.themeMode = "dark"
    updateSiteCollaborationMetadata(leftDocument, leftContent)
    const rightContent = readSiteCollaborationContent(rightDocument)
    rightContent.sidebar.sections.tabs.label = "Pages"
    updateSiteCollaborationMetadata(rightDocument, rightContent)
    await waitFor(() => {
      const content = readSiteCollaborationContent(leftDocument)
      return content.themeMode === "dark" && content.sidebar.sections.tabs.label === "Pages"
    })

    const requestId = crypto.randomUUID()
    const saved = waitForSaved(left, requestId)
    const peerSaved = waitForSavedBroadcast(right)
    left.sendStateless(JSON.stringify({ type: "site.save", requestId }))
    await Promise.all([saved, peerSaved])

    expect(persistedState).not.toBeNull()
    expect(site.draftRevision).toBeGreaterThan(1)
    expect(site.draftContent.themeMode).toBe("dark")
    expect(site.draftContent.sidebar.sections.tabs.label).toBe("Pages")
    expect(site.draftContent.pages[0]?.document).toMatchObject({
      content: [{ content: [{ text: "offline left middle right online" }] }],
    })
  }, 20_000)
})

function getFirstPageText(document: Y.Doc, pageId: string) {
  const fragment = document.getXmlFragment(getSitePageCollaborationField(pageId))
  const paragraph = fragment.get(0) as Y.XmlElement
  return paragraph.get(0) as Y.XmlText
}

function waitForSynced(provider: HocuspocusProvider) {
  if (provider.isSynced) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const handleSynced = ({ state }: { state: boolean }) => {
      if (state) {
        provider.off("synced", handleSynced)
        resolve()
      }
    }
    provider.on("synced", handleSynced)
  })
}

function waitForSaved(provider: HocuspocusProvider, requestId: string) {
  return new Promise<void>((resolve) => {
    const handleStateless = ({ payload }: { payload: string }) => {
      const message = JSON.parse(payload) as { requestId?: string; type?: string }
      if (message.type === "site.saved" && message.requestId === requestId) {
        provider.off("stateless", handleStateless)
        resolve()
      }
    }
    provider.on("stateless", handleStateless)
  })
}

function waitForSavedBroadcast(provider: HocuspocusProvider) {
  return new Promise<void>((resolve) => {
    const handleStateless = ({ payload }: { payload: string }) => {
      const message = JSON.parse(payload) as { stateVector?: string; type?: string }
      if (message.type === "site.saved" && typeof message.stateVector === "string") {
        provider.off("stateless", handleStateless)
        resolve()
      }
    }
    provider.on("stateless", handleStateless)
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000) {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for collaborative state.")
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function createSiteRecord(draftContent: SiteRecord["draftContent"]): SiteRecord {
  const now = new Date()
  return {
    id: "00000000-0000-4000-8000-000000000201",
    workspaceId: "00000000-0000-4000-8000-000000000101",
    createdByUserId: "user-1",
    updatedByUserId: null,
    publishedByUserId: null,
    archivedByUserId: null,
    name: "Shared page",
    slug: "shared-page",
    status: "draft",
    visibility: "private",
    draftContent,
    draftRevision: 1,
    publishedVersionId: null,
    publishedAt: null,
    lastUnpublishedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function arraysEqual(left: Uint8Array, right: Uint8Array) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
}
