import { useCallback, useMemo, useRef, useState } from "react"

import {
  createSiteRecipient,
  createSiteUri,
  updateSiteRecipient,
  type CreateSiteRecipientInput,
  type SiteRecipient,
  type UpdateSiteRecipientInput,
} from "./recipient-model"

type StoredSiteRecipients = {
  recipients: SiteRecipient[]
  schemaVersion: 1
  siteUri: string
}

type UseSiteRecipientsOptions = {
  siteId: string
  workspaceId: string
}

const storagePrefix = "lightsite:editor-next:recipients:"

export function useSiteRecipients({ siteId, workspaceId }: UseSiteRecipientsOptions) {
  const storageKey = `${storagePrefix}${workspaceId}:${siteId}`
  const [storedState, setStoredState] = useState<StoredSiteRecipients>(() =>
    readRecipientState(storageKey, siteId)
  )
  const storedStateRef = useRef(storedState)

  const recipients = storedState.recipients
  const siteUri = storedState.siteUri
  const sortedRecipients = useMemo(
    () =>
      [...recipients].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [recipients]
  )

  const persist = useCallback(
    (createNextState: (currentState: StoredSiteRecipients) => StoredSiteRecipients) => {
      const nextState = createNextState(storedStateRef.current)

      storedStateRef.current = nextState
      writeRecipientState(storageKey, nextState)
      setStoredState(nextState)
    },
    [storageKey]
  )

  const createRecipient = useCallback(
    (input: Omit<CreateSiteRecipientInput, "siteId" | "workspaceId">) => {
      const recipient = createSiteRecipient(
        {
          ...input,
          siteId,
          workspaceId,
        },
        storedStateRef.current.recipients
      )

      persist((currentState) => ({
        ...currentState,
        recipients: [recipient, ...currentState.recipients],
      }))

      return recipient
    },
    [persist, siteId, workspaceId]
  )

  const updateRecipient = useCallback(
    (recipientId: string, input: UpdateSiteRecipientInput) => {
      const currentRecipient = storedStateRef.current.recipients.find(
        (recipient) => recipient.id === recipientId
      )

      if (!currentRecipient) {
        return null
      }

      const updatedRecipient = updateSiteRecipient(currentRecipient, input)

      persist((currentState) => ({
        ...currentState,
        recipients: currentState.recipients.map((recipient) =>
          recipient.id === recipientId ? updatedRecipient : recipient
        ),
      }))

      return updatedRecipient
    },
    [persist]
  )

  const deleteRecipient = useCallback(
    (recipientId: string) => {
      persist((currentState) => ({
        ...currentState,
        recipients: currentState.recipients.filter(
          (recipient) => recipient.id !== recipientId
        ),
      }))
    },
    [persist]
  )

  return {
    createRecipient,
    deleteRecipient,
    recipients: sortedRecipients,
    siteUri,
    updateRecipient,
  }
}

function readRecipientState(storageKey: string, siteId: string): StoredSiteRecipients {
  if (typeof window === "undefined") {
    return createEmptyRecipientState(siteId)
  }

  const rawValue = window.localStorage.getItem(storageKey)

  if (!rawValue) {
    const state = createEmptyRecipientState(siteId)
    writeRecipientState(storageKey, state)
    return state
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredSiteRecipients>

    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.siteUri !== "string" ||
      !Array.isArray(parsed.recipients)
    ) {
      return createEmptyRecipientState(siteId)
    }

    return {
      recipients: parsed.recipients.filter(isSiteRecipient),
      schemaVersion: 1,
      siteUri: parsed.siteUri,
    }
  } catch {
    return createEmptyRecipientState(siteId)
  }
}

function writeRecipientState(storageKey: string, state: StoredSiteRecipients) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

function createEmptyRecipientState(siteId: string): StoredSiteRecipients {
  return {
    recipients: [],
    schemaVersion: 1,
    siteUri: createSiteUri(siteId),
  }
}

function isSiteRecipient(value: unknown): value is SiteRecipient {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const recipient = value as Record<string, unknown>

  return (
    typeof recipient.id === "string" &&
    typeof recipient.workspaceId === "string" &&
    typeof recipient.siteId === "string" &&
    typeof recipient.name === "string" &&
    typeof recipient.company === "string" &&
    typeof recipient.website === "string" &&
    typeof recipient.linkSlug === "string" &&
    typeof recipient.values === "object" &&
    recipient.values !== null &&
    !Array.isArray(recipient.values)
  )
}
