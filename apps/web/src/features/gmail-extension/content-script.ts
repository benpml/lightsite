import {
  EXTENSION_PROTOCOL_VERSION,
  isExtensionPanelMessage,
  type GmailHostMessage,
} from "./contracts"
import {
  captureComposeSelection,
  findGmailComposes,
  getComposeContext,
  insertIntoCompose,
  type GmailCompose,
} from "./gmail-adapter"
import { getExtensionPanelRect } from "./panel-position"

const BUTTON_MARKER = "data-lightsite-compose-button"
const PANEL_WIDTH = 384
const PANEL_HEIGHT = 560
const PANEL_VIEWPORT_PADDING = 12
const composeById = new Map<string, GmailCompose>()
let activePanel: {
  composeId: string
  iframe: HTMLIFrameElement
  overlay: HTMLDivElement
  savedRange: Range | null
} | null = null
let scanScheduled = false

scanComposes()
const observer = new MutationObserver(scheduleComposeScan)
observer.observe(document.documentElement, { childList: true, subtree: true })
window.addEventListener("resize", () => {
  if (!activePanel) return
  const compose = composeById.get(activePanel.composeId)
  if (compose) positionPanel(activePanel.iframe, compose)
})

window.addEventListener("message", (event) => {
  if (!activePanel || event.source !== activePanel.iframe.contentWindow) return
  if (event.origin !== chrome.runtime.getURL("").replace(/\/$/, "")) return
  if (!isExtensionPanelMessage(event.data)) return

  if (event.data.type === "panel-ready") {
    const compose = composeById.get(activePanel.composeId)
    if (!compose) return
    postToPanel({
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
      source: "lightsite-gmail-host",
      type: "compose-context",
      context: getComposeContext(compose),
    })
    return
  }

  if (event.data.type === "close-panel") {
    closePanel()
    return
  }

  const compose = composeById.get(event.data.composeId)
  const result = compose
    ? insertIntoCompose({
        compose,
        html: event.data.html,
        text: event.data.text,
        savedRange: activePanel.savedRange,
      })
    : { ok: false as const, message: "This email draft is no longer open." }

  postToPanel({
    protocolVersion: EXTENSION_PROTOCOL_VERSION,
    source: "lightsite-gmail-host",
    type: "insert-result",
    ...result,
  })

  if (result.ok) window.setTimeout(closePanel, 220)
})

function scheduleComposeScan() {
  if (scanScheduled) return
  scanScheduled = true
  window.requestAnimationFrame(() => {
    scanScheduled = false
    scanComposes()
  })
}

function scanComposes() {
  const composes = findGmailComposes()
  const liveIds = new Set(composes.map((compose) => compose.id))

  for (const compose of composes) {
    composeById.set(compose.id, compose)
    for (const staleButton of compose.root.querySelectorAll(`[${BUTTON_MARKER}]`)) {
      if (!compose.toolbar.contains(staleButton)) staleButton.remove()
    }
    if (!compose.toolbar.querySelector(`[${BUTTON_MARKER}]`)) {
      compose.toolbar.append(createToolbarButton(compose))
    }
  }

  for (const composeId of composeById.keys()) {
    if (!liveIds.has(composeId)) composeById.delete(composeId)
  }
}

function createToolbarButton(compose: GmailCompose) {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute(BUTTON_MARKER, "")
  button.setAttribute("aria-label", "Share a Lightsite")
  button.title = "Share a Lightsite"
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6.5 3.5h8.25a3.75 3.75 0 0 1 3.75 3.75v4.25h-2V7.25A1.75 1.75 0 0 0 14.75 5.5H6.5A1.5 1.5 0 0 0 5 7v10a1.5 1.5 0 0 0 1.5 1.5h7v2h-7A3.5 3.5 0 0 1 3 17V7a3.5 3.5 0 0 1 3.5-3.5Zm8.75 9.25 5.5 3.25-5.5 3.25v-2.1H10.5v-2.3h4.75v-2.1Z"/></svg>'
  Object.assign(button.style, {
    alignItems: "center",
    background: "transparent",
    border: "0",
    borderRadius: "6px",
    color: "inherit",
    cursor: "pointer",
    display: "inline-flex",
    height: "28px",
    justifyContent: "center",
    margin: "0 2px",
    padding: "0",
    width: "30px",
  })
  button.addEventListener("mouseenter", () => { button.style.background = "rgba(60,64,67,.08)" })
  button.addEventListener("mouseleave", () => { button.style.background = "transparent" })
  let savedRange: Range | null = null
  button.addEventListener("mousedown", () => { savedRange = captureComposeSelection(compose) })
  button.addEventListener("click", () => openPanel(compose, savedRange))
  return button
}

function openPanel(compose: GmailCompose, savedRange: Range | null) {
  closePanel()
  const overlay = document.createElement("div")
  Object.assign(overlay.style, {
    inset: "0",
    position: "fixed",
    zIndex: "2147483646",
  })
  overlay.setAttribute("role", "presentation")
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) closePanel()
  })

  const iframe = document.createElement("iframe")
  iframe.src = chrome.runtime.getURL("panel.html")
  iframe.title = "Share a Lightsite"
  iframe.setAttribute("aria-label", "Share a Lightsite")
  Object.assign(iframe.style, {
    background: "Canvas",
    border: "0",
    borderRadius: "14px",
    boxShadow: "0 18px 48px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.08)",
    colorScheme: "light dark",
    display: "block",
    position: "fixed",
    zIndex: "2147483647",
  })
  positionPanel(iframe, compose)
  overlay.append(iframe)
  document.body.append(overlay)
  activePanel = { composeId: compose.id, iframe, overlay, savedRange }
}

function positionPanel(iframe: HTMLIFrameElement, compose: GmailCompose) {
  const composeRect = compose.root.getBoundingClientRect()
  const actionRect = compose.toolbar.getBoundingClientRect()
  const rect = getExtensionPanelRect({
    actionTop: actionRect.top,
    composeRight: composeRect.right,
    panelHeight: PANEL_HEIGHT,
    panelWidth: PANEL_WIDTH,
    viewportHeight: window.innerHeight,
    viewportPadding: PANEL_VIEWPORT_PADDING,
    viewportWidth: window.innerWidth,
  })
  iframe.style.width = `${rect.width}px`
  iframe.style.height = `${rect.height}px`
  iframe.style.left = `${rect.left}px`
  iframe.style.top = `${rect.top}px`
}

function postToPanel(message: GmailHostMessage) {
  activePanel?.iframe.contentWindow?.postMessage(
    message,
    chrome.runtime.getURL("").replace(/\/$/, ""),
  )
}

function closePanel() {
  activePanel?.overlay.remove()
  activePanel = null
}
