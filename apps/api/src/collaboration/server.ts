import type { Server as HttpServer } from "node:http"
import crossws from "crossws/adapters/node"
import { Hocuspocus, type WebSocketLike } from "@hocuspocus/server"
import {
  analyzeSiteContentSafety,
  getSiteCollaborationDocumentName,
  hasAddedEmbeddedImageDataUrl,
  initializeSiteCollaborationDocument,
  parseSiteCollaborationDocumentName,
  readSiteCollaborationContent,
  repairSiteCollaborationDocument,
  replaceSiteCollaborationContent,
  type SiteContent,
  SITE_DOCUMENT_SCHEMA_VERSION,
} from "@handout/site-document"
import * as Y from "yjs"
import type { SiteRecord } from "../sites/repository"
import type { SiteCollaborationRepository } from "./repository"

const SAVE_MESSAGE_TYPE = "site.save"
const SAVED_MESSAGE_TYPE = "site.saved"
const SAVE_FAILED_MESSAGE_TYPE = "site.save-failed"
export const MAX_COLLABORATION_MESSAGE_BYTES = 512 * 1024
export const MAX_COLLABORATION_STATE_BYTES = 5 * 1024 * 1024
export const MAX_LOADED_COLLABORATION_DOCUMENTS = 100
export const MAX_COLLABORATION_CONNECTIONS = 1_000

export type SiteCollaborationContext = {
  userId: string
  workspaceId: string
  user: {
    id: string
    name: string
    color: string
  }
}

export type SiteCollaborationAuthorization = (input: {
  headers: Headers
  siteId: string
  token: string
}) => Promise<SiteCollaborationContext>

export interface SiteContentCoordinator {
  broadcastSiteChanged(siteId: string): void
  closeSite(siteId: string): void
  flushSite(input: {
    siteId: string
    userId: string
    workspaceId: string
  }): Promise<SiteRecord | null>
  replaceContent(input: {
    draftContent: SiteContent
    expectedDraftRevision?: number
    siteId: string
    userId: string
    workspaceId: string
    skipFlush?: boolean
  }): Promise<SiteRecord | null>
}

export function createSiteCollaborationServer(options: {
  authorize: SiteCollaborationAuthorization
  repository: SiteCollaborationRepository
}) {
  const hocuspocus = new Hocuspocus<SiteCollaborationContext>({
    debounce: 1_000,
    maxDebounce: 5_000,
    quiet: true,
    timeout: 60_000,
    async onAuthenticate({ documentName, requestHeaders, token }) {
      const siteId = parseSiteCollaborationDocumentName(documentName)
      if (!siteId) {
        throw new Error("Invalid collaboration document.")
      }
      if (
        hocuspocus.documents.size >= MAX_LOADED_COLLABORATION_DOCUMENTS &&
        !hocuspocus.documents.has(documentName)
      ) {
        throw new Error("Editor capacity is temporarily unavailable.")
      }

      const client = parseClientToken(token)
      if (client.schemaVersion !== SITE_DOCUMENT_SCHEMA_VERSION) {
        throw new Error("Editor schema changed. Refresh to continue editing.")
      }

      return options.authorize({ headers: requestHeaders, siteId, token })
    },

    async onLoadDocument({ documentName }) {
      const siteId = requireSiteId(documentName)
      const snapshot = await options.repository.load(siteId)
      if (!snapshot || snapshot.site.status === "archived") {
        throw new Error("Site is not available.")
      }

      if (snapshot.state) {
        return snapshot.state
      }

      const document = new Y.Doc()
      initializeSiteCollaborationDocument(document, snapshot.site.draftContent)
      return document
    },

    async onStoreDocument({ document, documentName, lastContext }) {
      try {
        await persistDocument({
          document,
          siteId: requireSiteId(documentName),
          updatedByUserId: lastContext?.userId ?? null,
          workspaceId: lastContext?.workspaceId,
        })
      } catch (error) {
        reportCollaborationSaveFailure("onStoreDocument", error)
      }
    },

    async onChange({ document }) {
      const repairs = repairSiteCollaborationDocument(document)
      if (repairs.length > 0) {
        document.broadcastStateless(JSON.stringify({
          type: "site.repaired",
          repairs,
        }))
      }
    },

    async onStateless({ connection, document, documentName, payload }) {
      const message = parseSaveRequest(payload)
      if (!message) {
        return
      }

      try {
        const saved = await persistDocument({
          document,
          siteId: requireSiteId(documentName),
          updatedByUserId: connection.context.userId,
          workspaceId: connection.context.workspaceId,
        })

        connection.sendStateless(JSON.stringify({
          ...saved,
          requestId: message.requestId,
        }))
      } catch (error) {
        reportCollaborationSaveFailure("onStateless", error)
        connection.sendStateless(JSON.stringify({
          type: SAVE_FAILED_MESSAGE_TYPE,
          requestId: message.requestId,
          message: getCollaborationSaveFailureMessage(error),
        }))
      }
    },
  })

  async function persistDocument(input: {
    broadcast?: boolean
    document: import("@hocuspocus/server").Document
    siteId: string
    updatedByUserId: string | null
    workspaceId?: string
  }) {
    const snapshot = await options.repository.load(input.siteId)
    const workspaceId = input.workspaceId ?? snapshot?.site.workspaceId
    if (!workspaceId) {
      throw new Error("Site is not available.")
    }

    const draftContent = readSiteCollaborationContent(input.document)
    const safety = analyzeSiteContentSafety(draftContent)
    if (safety.issues[0]) {
      throw new Error(safety.issues[0].message)
    }
    if (hasAddedEmbeddedImageDataUrl(snapshot?.site.draftContent, draftContent)) {
      throw new Error("Inline image data cannot be added to site content.")
    }
    const state = Y.encodeStateAsUpdate(input.document)
    if (state.byteLength > MAX_COLLABORATION_STATE_BYTES) {
      throw new Error("Collaborative document state exceeds the 5 MB safety limit.")
    }
    const stateVector = Y.encodeStateVector(input.document)
    const site = await options.repository.persist({
      siteId: input.siteId,
      workspaceId,
      state,
      draftContent,
      updatedByUserId: input.updatedByUserId,
    })

    if (!site) {
      throw new Error("Site could not be saved.")
    }

    const savedMessage = {
      type: SAVED_MESSAGE_TYPE,
      draftRevision: site.draftRevision,
      savedAt: site.updatedAt.toISOString(),
      stateVector: Buffer.from(stateVector).toString("base64"),
    } as const

    if (input.broadcast !== false) {
      input.document.broadcastStateless(JSON.stringify(savedMessage))
    }

    return savedMessage
  }

  const coordinator: SiteContentCoordinator = {
    broadcastSiteChanged(siteId) {
      hocuspocus.documents
        .get(getSiteCollaborationDocumentName(siteId))
        ?.broadcastStateless(JSON.stringify({ type: "site.changed" }))
    },

    closeSite(siteId) {
      hocuspocus.closeConnections(getSiteCollaborationDocumentName(siteId))
    },

    async flushSite(input) {
      const documentName = getSiteCollaborationDocumentName(input.siteId)
      const loadedDocument = hocuspocus.documents.get(documentName)

      if (loadedDocument) {
        await persistDocument({
          document: loadedDocument,
          siteId: input.siteId,
          updatedByUserId: input.userId,
          workspaceId: input.workspaceId,
        })
      }

      return (await options.repository.load(input.siteId))?.site ?? null
    },

    async replaceContent(input) {
      const currentSite = input.skipFlush
        ? (await options.repository.load(input.siteId))?.site ?? null
        : await coordinator.flushSite(input)
      if (
        !currentSite ||
        currentSite.workspaceId !== input.workspaceId ||
        (input.expectedDraftRevision !== undefined &&
          currentSite.draftRevision !== input.expectedDraftRevision)
      ) {
        return null
      }

      const context: SiteCollaborationContext = {
        userId: input.userId,
        workspaceId: input.workspaceId,
        user: {
          id: input.userId,
          name: "API editor",
          color: "#6366f1",
        },
      }
      const connection = await hocuspocus.openDirectConnection(
        getSiteCollaborationDocumentName(input.siteId),
        context,
      )

      try {
        await connection.transact((document) => {
          replaceSiteCollaborationContent(document, input.draftContent)
        })

        if (!connection.document) {
          throw new Error("Collaboration document is not available.")
        }

        await persistDocument({
          document: connection.document,
          siteId: input.siteId,
          updatedByUserId: input.userId,
          workspaceId: input.workspaceId,
        })
      } finally {
        await connection.disconnect({ unloadImmediately: false })
      }

      return (await options.repository.load(input.siteId))?.site ?? null
    },
  }

  return { coordinator, hocuspocus }
}

export function attachSiteCollaborationWebSocketServer(
  server: HttpServer,
  hocuspocus: Hocuspocus<SiteCollaborationContext>,
  options: { allowedOrigins?: ReadonlySet<string> } = {},
) {
  const clientConnections = new Map<string, ReturnType<typeof hocuspocus.handleConnection>>()
  const websocket = crossws({
    hooks: {
      open(peer) {
        if (clientConnections.size >= MAX_COLLABORATION_CONNECTIONS) {
          peer.websocket.close?.(1013, "Editor capacity is temporarily unavailable.")
          return
        }
        clientConnections.set(
          peer.id,
          hocuspocus.handleConnection(
            peer.websocket as unknown as WebSocketLike,
            peer.request as Request,
          ),
        )
      },
      message(peer, message) {
        const bytes = message.uint8Array()
        if (bytes.byteLength > MAX_COLLABORATION_MESSAGE_BYTES) {
          clientConnections.get(peer.id)?.handleClose({
            code: 1009,
            reason: "Editor message is too large.",
          })
          peer.websocket.close?.(1009, "Editor message is too large.")
          clientConnections.delete(peer.id)
          return
        }
        clientConnections.get(peer.id)?.handleMessage(bytes)
      },
      close(peer, event) {
        clientConnections.get(peer.id)?.handleClose({
          code: event.code ?? 1000,
          reason: event.reason ?? "",
        })
        clientConnections.delete(peer.id)
      },
      error(peer) {
        clientConnections.get(peer.id)?.handleClose({
          code: 1011,
          reason: "Editor connection failed.",
        })
        clientConnections.delete(peer.id)
      },
    },
  })

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    if (pathname !== "/api/collaboration") {
      return
    }
    if (options.allowedOrigins) {
      const origin = request.headers.origin
      if (!origin || !options.allowedOrigins.has(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
        socket.destroy()
        return
      }
    }

    websocket.handleUpgrade(request, socket, head)
  })

  return async () => {
    hocuspocus.closeConnections()
    hocuspocus.flushPendingStores()
  }
}

function getCollaborationSaveFailureMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Site could not be saved."
}

function reportCollaborationSaveFailure(source: "onStateless" | "onStoreDocument", error: unknown) {
  const message = getCollaborationSaveFailureMessage(error)
  console.error(`[${source}] ${message}`)
}

export function parseSiteSavedMessage(payload: string): {
  type: typeof SAVED_MESSAGE_TYPE
  draftRevision: number
  requestId?: string
  savedAt: string
  stateVector: string
} | null {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>
    if (
      value.type !== SAVED_MESSAGE_TYPE ||
      typeof value.draftRevision !== "number" ||
      typeof value.savedAt !== "string" ||
      typeof value.stateVector !== "string"
    ) {
      return null
    }

    return {
      type: SAVED_MESSAGE_TYPE,
      draftRevision: value.draftRevision,
      savedAt: value.savedAt,
      stateVector: value.stateVector,
      ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}),
    }
  } catch {
    return null
  }
}

function parseSaveRequest(payload: string): { requestId: string } | null {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>
    return value.type === SAVE_MESSAGE_TYPE && typeof value.requestId === "string"
      ? { requestId: value.requestId }
      : null
  } catch {
    return null
  }
}

function requireSiteId(documentName: string) {
  const siteId = parseSiteCollaborationDocumentName(documentName)
  if (!siteId) {
    throw new Error("Invalid collaboration document.")
  }
  return siteId
}

function parseClientToken(token: string): { dev: boolean; schemaVersion: number | null } {
  try {
    const value = JSON.parse(token) as Record<string, unknown>
    return {
      dev: value.dev === true,
      schemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : null,
    }
  } catch {
    return { dev: false, schemaVersion: null }
  }
}
