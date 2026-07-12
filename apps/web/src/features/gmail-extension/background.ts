import type { BackgroundRequest, BackgroundResponse } from "./contracts"

const API_ORIGIN = (import.meta.env.VITE_EXTENSION_API_ORIGIN || "http://localhost:3011").replace(/\/$/, "")
const WEB_ORIGIN = (import.meta.env.VITE_EXTENSION_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "")
const PUBLIC_ORIGIN = (import.meta.env.VITE_EXTENSION_PUBLIC_ORIGIN || "https://lightsite.io").replace(/\/$/, "")
const TOKEN_KEY = "lightsite.extension.authToken.v1"
const DEV_TOKEN = "__lightsite_dev__"

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void handleMessage(message as BackgroundRequest)
    .then(sendResponse)
    .catch((error: unknown) => sendResponse(failure(error)))
  return true
})

async function handleMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  switch (message.type) {
    case "session": {
      const token = await getStoredToken()
      return success({ connected: Boolean(token), development: token === DEV_TOKEN })
    }
    case "connect":
      return connectViaLightsite()
    case "sign-out":
      await signOut()
      return success({ connected: false })
    case "open-tab":
      if (!isAllowedOpenUrl(message.url)) {
        return failureResponse("url.not_allowed", "This link cannot be opened by Lightsite.")
      }
      await chrome.tabs.create({ url: message.url })
      return success(null)
    case "api-request":
      return apiRequest(message)
    default:
      return failureResponse("request.unsupported", "The extension request is not supported.")
  }
}

async function connectViaLightsite(): Promise<BackgroundResponse> {
  const verifier = createPkceVerifier()
  const codeChallenge = await createPkceChallenge(verifier)
  const redirectUri = chrome.identity.getRedirectURL("lightsite")
  const authorizeUrl = new URL("/extension-connect", WEB_ORIGIN)
  authorizeUrl.search = new URLSearchParams({
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  }).toString()

  let callbackUrl: string | undefined
  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({
      interactive: true,
      url: authorizeUrl.toString(),
    })
  } catch {
    return failureResponse("auth.cancelled", "Lightsite connection was cancelled.")
  }

  if (!callbackUrl) {
    return failureResponse("auth.cancelled", "Lightsite connection was cancelled.")
  }

  const code = new URL(callbackUrl).hash
    ? new URLSearchParams(new URL(callbackUrl).hash.slice(1)).get("code")
    : null
  if (!code) {
    return failureResponse("auth.code_missing", "Lightsite did not return a connection code.")
  }

  const response = await fetch(`${API_ORIGIN}/api/extension-auth/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier }),
  })
  const body = await parseResponseBody(response)
  if (!response.ok) return responseFailure(response, body)
  const exchange = asRecord(body)
  const development = exchange?.development === true
  const token = typeof exchange?.token === "string" ? exchange.token : null
  if (!development && !token) {
    return failureResponse(
      "auth.token_missing",
      "Lightsite connected, but the extension session was not returned. Try again.",
      response.status,
    )
  }

  await chrome.storage.local.set({ [TOKEN_KEY]: development ? DEV_TOKEN : token })
  return success({ connected: true, development })
}

async function signOut() {
  const token = await getStoredToken()
  try {
    if (token && token !== DEV_TOKEN) {
      await fetch(`${API_ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    }
  } finally {
    await chrome.storage.local.remove(TOKEN_KEY)
  }
}

async function apiRequest(message: Extract<BackgroundRequest, { type: "api-request" }>) {
  if (!isAllowedApiPath(message.path)) {
    return failureResponse("api.path_not_allowed", "This Lightsite API request is not allowed.")
  }

  const token = await getStoredToken()
  if (!token) return failureResponse("auth.required", "Connect Lightsite to continue.", 401)

  const headers: Record<string, string> = {}
  if (token === DEV_TOKEN) headers["x-lightsite-dev-auth"] = "1"
  else headers.authorization = `Bearer ${token}`
  if (message.body !== undefined) headers["content-type"] = "application/json"

  const response = await fetch(new URL(message.path, API_ORIGIN), {
    method: message.method ?? "GET",
    headers,
    body: message.body === undefined ? undefined : JSON.stringify(message.body),
  })
  const body = await parseResponseBody(response)

  if (!response.ok) {
    if (response.status === 401) await chrome.storage.local.remove(TOKEN_KEY)
    return responseFailure(response, body)
  }

  return success(body)
}

async function getStoredToken() {
  const stored = await chrome.storage.local.get(TOKEN_KEY)
  return typeof stored[TOKEN_KEY] === "string" ? stored[TOKEN_KEY] : null
}

function isAllowedApiPath(path: string) {
  if (!path.startsWith("/api/")) return false
  return path === "/api/me" || path === "/api/sites" || /^\/api\/sites\/[^/]+(?:\/content|\/variants(?:\/batch)?)?$/.test(path)
}

function isAllowedOpenUrl(value: string) {
  try {
    const url = new URL(value)
    return [WEB_ORIGIN, PUBLIC_ORIGIN].some((origin) => url.origin === new URL(origin).origin)
  } catch {
    return false
  }
}

function success<T>(data: T): BackgroundResponse<T> {
  return { ok: true, data }
}

function failure(error: unknown): BackgroundResponse {
  if (error instanceof TypeError) {
    return failureResponse("network.unavailable", "Lightsite could not be reached. Check your connection and try again.")
  }
  return failureResponse("request.failed", error instanceof Error ? error.message : "The request failed.")
}

function responseFailure(response: Response, body: unknown): BackgroundResponse {
  const parsed = asRecord(body)
  const error = asRecord(parsed?.error)
  return failureResponse(
    typeof error?.code === "string" ? error.code : `http.${response.status}`,
    typeof error?.message === "string" ? error.message : "The Lightsite request failed.",
    response.status,
  )
}

function failureResponse(code: string, message: string, status?: number): BackgroundResponse {
  return { ok: false, error: { code, message, ...(status ? { status } : {}) } }
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function createPkceVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toBase64Url(bytes)
}

async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return toBase64Url(new Uint8Array(digest))
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
