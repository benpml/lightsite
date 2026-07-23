/* eslint-disable react-hooks/immutability, react-hooks/purity, react-hooks/refs -- Hocuspocus exposes imperative provider callbacks whose lifecycle is owned and cleaned up by this hook. */
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react"
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  WebSocketStatus,
} from "@hocuspocus/provider"
import {
  getSiteCollaborationDocumentName,
  getSitePageCollaborationField,
  isSiteCollaborationDocumentInitialized,
  readSiteCollaborationContent,
  updateSiteCollaborationMetadata,
  type SiteContent,
  SITE_DOCUMENT_SCHEMA_VERSION,
} from "@handout/site-document"
import { IndexeddbPersistence } from "y-indexeddb"
import { ySyncPluginKey } from "@tiptap/y-tiptap"
import * as Y from "yjs"

import type { AppBootstrapResponse } from "@handout/contracts"

export type EditorSaveStatus =
  | "connecting"
  | "offline"
  | "saved"
  | "saving"
  | "unavailable"

export type EditorCollaborator = {
  clientId: number
  color: string
  id: string
  name: string
}

type SavedMessage = {
  type: "site.saved"
  draftRevision: number
  requestId?: string
  savedAt: string
  stateVector: string
}

type PendingSave = {
  reject: (error: Error) => void
  resolve: (message: SavedMessage) => void
  timeout: ReturnType<typeof setTimeout>
}

export function useSiteCollaboration(input: {
  bootstrap: AppBootstrapResponse
  siteId: string
}) {
  const { bootstrap, siteId } = input
  const [connectionStatus, setConnectionStatus] = useState(WebSocketStatus.Connecting)
  const [isIndexedDbSynced, setIsIndexedDbSynced] = useState(false)
  const [isRemoteSynced, setIsRemoteSynced] = useState(false)
  const [authenticationFailed, setAuthenticationFailed] = useState(false)
  const [authenticationFailureReason, setAuthenticationFailureReason] = useState<string | null>(null)
  const [savedStateVector, setSavedStateVector] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [draftRevision, setDraftRevision] = useState<number | null>(null)
  const [collaborators, setCollaborators] = useState<EditorCollaborator[]>([])
  const [metadataRevision, setMetadataRevision] = useState(0)
  const [remoteDocumentRevision, setRemoteDocumentRevision] = useState(0)
  const [repairNotice, setRepairNotice] = useState<{
    id: number
    repairs: string[]
  } | null>(null)
  const [siteChangeRevision, setSiteChangeRevision] = useState(0)
  const pendingSaves = useRef(new Map<string, PendingSave>())
  const undoManagers = useRef(new Map<string, Y.UndoManager>())
  const remoteRevisionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveStartedAt = useRef<number | null>(null)
  const pendingDestroy = useRef<{
    document: Y.Doc
    provider: HocuspocusProvider
    websocketProvider: HocuspocusProviderWebsocket
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  const document = useMemo(() => new Y.Doc(), [siteId])
  const websocketProvider = useMemo(() => new HocuspocusProviderWebsocket({
    autoConnect: false,
    url: getCollaborationUrl(),
  }), [siteId])
  const provider = useMemo(() => {
    let currentCollaborators: EditorCollaborator[] = []

    return new HocuspocusProvider({
    websocketProvider,
    name: getSiteCollaborationDocumentName(siteId),
    document,
    token: JSON.stringify({
      dev: import.meta.env.DEV,
      schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
    }),
    forceSyncInterval: 15_000,
    onStatus: ({ status }) => setConnectionStatus(status),
    onSynced: ({ state }) => setIsRemoteSynced(state),
    onAuthenticationFailed: ({ reason }) => {
      setAuthenticationFailed(true)
      setAuthenticationFailureReason(reason)
    },
    onAwarenessUpdate: ({ states }) => {
      const nextCollaborators = parseCollaborators(states, document.clientID)
      if (collaboratorsAreEqual(currentCollaborators, nextCollaborators)) {
        return
      }

      currentCollaborators = nextCollaborators
      setCollaborators(nextCollaborators)
    },
    onStateless: ({ payload }) => {
      const message = parseSavedMessage(payload)
      if (!message) {
        if (isSiteChangedMessage(payload)) {
          setSiteChangeRevision((revision) => revision + 1)
          return
        }
        const repairs = parseRepairMessage(payload)
        if (repairs) {
          setRepairNotice({ id: Date.now(), repairs })
        }
        return
      }

      setDraftRevision(message.draftRevision)
      setSavedAt(message.savedAt)
      setSavedStateVector(message.stateVector)

      if (message.requestId) {
        const pending = pendingSaves.current.get(message.requestId)
        if (pending) {
          clearTimeout(pending.timeout)
          pendingSaves.current.delete(message.requestId)
          pending.resolve(message)
        }
      }
    },
    })
  }, [document, siteId, websocketProvider])

  const localUser = useMemo(() => ({
    id: bootstrap.user.id,
    name: bootstrap.user.name?.trim() || bootstrap.user.email,
    color: getPresenceColor(bootstrap.user.id),
  }), [bootstrap.user.email, bootstrap.user.id, bootstrap.user.name])

  useEffect(() => {
    const persistence = new IndexeddbPersistence(
      getSiteCollaborationDocumentName(siteId),
      document,
    )
    const handleIndexedDbSynced = () => setIsIndexedDbSynced(true)

    persistence.on("synced", handleIndexedDbSynced)
    return () => {
      persistence.off("synced", handleIndexedDbSynced)
      void persistence.destroy()
    }
  }, [document, siteId])

  useEffect(() => {
    if (!authenticationFailureReason?.includes("Editor schema changed")) {
      return
    }

    const reloadKey = `handout:collaboration-schema-reload:${siteId}`
    if (window.sessionStorage.getItem(reloadKey)) {
      return
    }

    window.sessionStorage.setItem(reloadKey, "1")
    window.location.reload()
  }, [authenticationFailureReason, siteId])

  useEffect(() => {
    if (isRemoteSynced) {
      window.sessionStorage.removeItem(`handout:collaboration-schema-reload:${siteId}`)
    }
  }, [isRemoteSynced, siteId])

  useEffect(() => {
    if (pendingDestroy.current?.provider === provider) {
      clearTimeout(pendingDestroy.current.timer)
      pendingDestroy.current = null
    }
    provider.setAwarenessField("user", localUser)
    provider.attach()
    void websocketProvider.connect()
    return () => {
      const entry = {
        document,
        provider,
        timer: setTimeout(() => {
        for (const pending of pendingSaves.current.values()) {
          clearTimeout(pending.timeout)
          pending.reject(new Error("The collaboration session ended before changes were saved."))
        }
        pendingSaves.current.clear()
        provider.destroy()
        websocketProvider.destroy()
        undoManagers.current.clear()
        document.destroy()
          if (pendingDestroy.current === entry) {
            pendingDestroy.current = null
          }
        }, 0),
        websocketProvider,
      }
      pendingDestroy.current = entry
    }
  }, [document, localUser, provider, websocketProvider])

  useEffect(() => {
    const metadata = document.getMap("site:metadata")
    const handleMetadataChange = () => setMetadataRevision((revision) => revision + 1)
    const handleTransaction = (transaction: Y.Transaction) => {
      if (transaction.local) {
        return
      }

      if (remoteRevisionTimer.current) {
        return
      }

      remoteRevisionTimer.current = setTimeout(() => {
        remoteRevisionTimer.current = null
        setRemoteDocumentRevision((revision) => revision + 1)
      }, 200)
    }

    metadata.observeDeep(handleMetadataChange)
    document.on("afterTransaction", handleTransaction)

    return () => {
      metadata.unobserveDeep(handleMetadataChange)
      document.off("afterTransaction", handleTransaction)
      if (remoteRevisionTimer.current) {
        clearTimeout(remoteRevisionTimer.current)
        remoteRevisionTimer.current = null
      }
    }
  }, [document])

  const isReady = isSiteCollaborationReady({
    authenticationFailed,
    document,
    isIndexedDbSynced,
    isRemoteSynced,
  })

  const siteDraft = useMemo(
    () => isReady ? readSiteCollaborationContent(document) : null,
    [document, isReady, metadataRevision],
  )

  const updateSiteDraft = useCallback((updater: SetStateAction<SiteContent>) => {
    const current = readSiteCollaborationContent(document)
    const next = typeof updater === "function" ? updater(current) : updater
    updateSiteCollaborationMetadata(document, next)
  }, [document])

  const getPageUndoManager = useCallback((pageId: string) => {
    const existing = undoManagers.current.get(pageId)
    if (existing) {
      return existing
    }

    const manager = new Y.UndoManager(
      document.getXmlFragment(getSitePageCollaborationField(pageId)),
      { trackedOrigins: new Set([ySyncPluginKey]) },
    )
    undoManagers.current.set(pageId, manager)
    return manager
  }, [document])

  const saveNow = useCallback(() => {
    if (connectionStatus !== WebSocketStatus.Connected) {
      return Promise.reject(new Error("Reconnect before saving or publishing."))
    }

    const requestId = crypto.randomUUID()
    return new Promise<SavedMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingSaves.current.delete(requestId)
        reject(new Error("Saving is taking longer than expected. Please try again."))
      }, 12_000)

      pendingSaves.current.set(requestId, { reject, resolve, timeout })
      provider.sendStateless(JSON.stringify({ type: "site.save", requestId }))
    })
  }, [connectionStatus, provider])

  const scheduleAutosave = useCallback(() => {
    if (connectionStatus !== WebSocketStatus.Connected || !isRemoteSynced) {
      return
    }

    const now = Date.now()
    autosaveStartedAt.current ??= now
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
    }

    const maximumWaitRemaining = Math.max(0, 5_000 - (now - autosaveStartedAt.current))
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null
      autosaveStartedAt.current = null
      void saveNow().catch(() => undefined)
    }, Math.min(900, maximumWaitRemaining))
  }, [connectionStatus, isRemoteSynced, saveNow])

  useEffect(() => {
    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin !== provider) {
        scheduleAutosave()
      }
    }

    document.on("update", handleUpdate)
    return () => {
      document.off("update", handleUpdate)
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
      autosaveStartedAt.current = null
    }
  }, [document, provider, scheduleAutosave])

  const localStateVector = bytesToBase64(Y.encodeStateVector(document))
  const persistedCurrentState = savedStateVector === localStateVector

  useEffect(() => {
    if (!isRemoteSynced || connectionStatus !== WebSocketStatus.Connected || persistedCurrentState) {
      return
    }

    scheduleAutosave()
  }, [connectionStatus, isRemoteSynced, persistedCurrentState, scheduleAutosave])

  const saveStatus: EditorSaveStatus = authenticationFailed
    ? "unavailable"
    : connectionStatus === WebSocketStatus.Connecting && !isReady
      ? "connecting"
      : connectionStatus !== WebSocketStatus.Connected
        ? "offline"
        : !persistedCurrentState
          ? "saving"
          : "saved"

  return {
    collaborators,
    document,
    draftRevision,
    getContent: () => readSiteCollaborationContent(document),
    getPageUndoManager,
    isReady,
    localUser,
    metadataRevision,
    provider,
    remoteDocumentRevision,
    repairNotice,
    savedAt,
    saveNow,
    saveStatus,
    siteDraft,
    siteChangeRevision,
    updateSiteDraft,
  }
}

function isSiteChangedMessage(payload: string) {
  try {
    return (JSON.parse(payload) as { type?: unknown }).type === "site.changed"
  } catch {
    return false
  }
}

function parseRepairMessage(payload: string) {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>
    return value.type === "site.repaired" && Array.isArray(value.repairs)
      ? value.repairs.filter((repair): repair is string => typeof repair === "string")
      : null
  } catch {
    return null
  }
}

function getCollaborationUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost/api/collaboration"
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/api/collaboration`
}

function parseSavedMessage(payload: string): SavedMessage | null {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>
    if (
      value.type !== "site.saved" ||
      typeof value.draftRevision !== "number" ||
      typeof value.savedAt !== "string" ||
      typeof value.stateVector !== "string"
    ) {
      return null
    }

    return {
      type: "site.saved",
      draftRevision: value.draftRevision,
      savedAt: value.savedAt,
      stateVector: value.stateVector,
      ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}),
    }
  } catch {
    return null
  }
}

function parseCollaborators(
  states: Array<{ clientId: number; user?: unknown }>,
  localClientId: number,
) {
  const collaborators = new Map<string, EditorCollaborator>()

  for (const state of states) {
    if (state.clientId === localClientId || !state.user || typeof state.user !== "object") {
      continue
    }

    const user = state.user as Record<string, unknown>
    if (
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.color !== "string"
    ) {
      continue
    }

    collaborators.set(user.id, {
      clientId: state.clientId,
      id: user.id,
      name: user.name,
      color: user.color,
    })
  }

  return [...collaborators.values()].sort((left, right) =>
    left.id.localeCompare(right.id) || left.clientId - right.clientId
  )
}

export function collaboratorsAreEqual(
  currentCollaborators: EditorCollaborator[],
  nextCollaborators: EditorCollaborator[],
) {
  return currentCollaborators.length === nextCollaborators.length &&
    currentCollaborators.every((currentCollaborator, index) => {
      const nextCollaborator = nextCollaborators[index]

      return nextCollaborator !== undefined &&
        currentCollaborator.clientId === nextCollaborator.clientId &&
        currentCollaborator.id === nextCollaborator.id &&
        currentCollaborator.name === nextCollaborator.name &&
        currentCollaborator.color === nextCollaborator.color
    })
}

export function isSiteCollaborationReady(input: {
  authenticationFailed: boolean
  document: Y.Doc
  isIndexedDbSynced: boolean
  isRemoteSynced: boolean
}) {
  return (
    (input.isRemoteSynced || input.isIndexedDbSynced) &&
    isSiteCollaborationDocumentInitialized(input.document) &&
    !input.authenticationFailed
  )
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window.btoa(binary)
}

function getPresenceColor(userId: string) {
  const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"]
  let hash = 0
  for (const character of userId) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  }
  return colors[Math.abs(hash) % colors.length]!
}
