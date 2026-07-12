export const EXTENSION_PROTOCOL_VERSION = 1 as const

export type ComposeRecipient = {
  email: string
  name: string
}

export type ComposeContext = {
  composeId: string
  recipient: ComposeRecipient | null
}

export type GmailHostMessage =
  | {
      protocolVersion: typeof EXTENSION_PROTOCOL_VERSION
      source: "lightsite-gmail-host"
      type: "compose-context"
      context: ComposeContext
    }
  | {
      protocolVersion: typeof EXTENSION_PROTOCOL_VERSION
      source: "lightsite-gmail-host"
      type: "insert-result"
      ok: boolean
      message?: string
    }

export type ExtensionPanelMessage =
  | {
      protocolVersion: typeof EXTENSION_PROTOCOL_VERSION
      source: "lightsite-extension-panel"
      type: "panel-ready"
    }
  | {
      protocolVersion: typeof EXTENSION_PROTOCOL_VERSION
      source: "lightsite-extension-panel"
      type: "close-panel"
    }
  | {
      protocolVersion: typeof EXTENSION_PROTOCOL_VERSION
      source: "lightsite-extension-panel"
      type: "insert"
      composeId: string
      format: "card" | "link"
      html: string
      text: string
    }

export type ApiRequestMessage = {
  type: "api-request"
  path: string
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
}

export type BackgroundRequest =
  | ApiRequestMessage
  | { type: "session" }
  | { type: "connect" }
  | { type: "sign-out" }
  | { type: "open-tab"; url: string }

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; status?: number } }

export function isExtensionPanelMessage(value: unknown): value is ExtensionPanelMessage {
  if (!isRecord(value)) return false
  if (
    value.protocolVersion !== EXTENSION_PROTOCOL_VERSION ||
    value.source !== "lightsite-extension-panel" ||
    typeof value.type !== "string"
  ) {
    return false
  }

  if (value.type === "panel-ready" || value.type === "close-panel") return true
  return (
    value.type === "insert" &&
    typeof value.composeId === "string" &&
    (value.format === "card" || value.format === "link") &&
    typeof value.html === "string" &&
    typeof value.text === "string"
  )
}

export function isGmailHostMessage(value: unknown): value is GmailHostMessage {
  if (!isRecord(value)) return false
  if (
    value.protocolVersion !== EXTENSION_PROTOCOL_VERSION ||
    value.source !== "lightsite-gmail-host" ||
    typeof value.type !== "string"
  ) {
    return false
  }

  return value.type === "compose-context" || value.type === "insert-result"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
