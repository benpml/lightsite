import type { ComposeContext, ComposeRecipient } from "./contracts"

const BODY_SELECTOR = [
  '[contenteditable="true"][role="textbox"][aria-label*="Message Body"]',
  '[contenteditable="true"][role="textbox"][g_editable="true"]',
].join(",")

const COMPOSE_ROOT_SELECTORS = ["[role=dialog]", ".M9", ".ip.adB", "[role=region]"]
const ACTION_MOUNT_MARKER = "data-lightsite-compose-action-mount"
let composeSequence = 0

export type GmailCompose = {
  body: HTMLElement
  id: string
  root: HTMLElement
  toolbar: HTMLElement
}

export function findGmailComposes(scope: ParentNode = document): GmailCompose[] {
  const bodies = Array.from(scope.querySelectorAll<HTMLElement>(BODY_SELECTOR))
  const seenRoots = new Set<HTMLElement>()

  return bodies.flatMap((body) => {
    const root = findComposeRoot(body)
    if (!root || seenRoots.has(root)) return []
    const toolbar = findComposeToolbar(root, body)
    if (!toolbar) return []
    seenRoots.add(root)

    return [{
      body,
      id: getComposeId(root),
      root,
      toolbar,
    }]
  })
}

export function getComposeContext(compose: GmailCompose): ComposeContext {
  return {
    composeId: compose.id,
    recipient: getPrimaryRecipient(compose.root),
  }
}

export function getPrimaryRecipient(root: HTMLElement): ComposeRecipient | null {
  const emailElement = Array.from(root.querySelectorAll<HTMLElement>("[email]"))
    .find((element) => isLikelyRecipientElement(element))
  const email = emailElement?.getAttribute("email")?.trim() ?? ""

  if (isEmail(email)) {
    return {
      email: email.toLowerCase(),
      name: cleanRecipientName(
        emailElement?.getAttribute("name") ||
        emailElement?.getAttribute("data-name") ||
        emailElement?.textContent ||
        "",
        email,
      ),
    }
  }

  const editableRecipient = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[name="to"], textarea[name="to"], input[aria-label^="To"]',
  )).map((element) => element.value.trim()).find(Boolean)

  if (!editableRecipient) return null
  const parsedEmail = extractEmail(editableRecipient)
  if (!parsedEmail) return null

  return {
    email: parsedEmail,
    name: cleanRecipientName(editableRecipient, parsedEmail),
  }
}

export function captureComposeSelection(compose: GmailCompose) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  return compose.body.contains(range.commonAncestorContainer) ? range.cloneRange() : null
}

export function insertIntoCompose(input: {
  compose: GmailCompose
  html: string
  text: string
  savedRange: Range | null
}) {
  if (!input.compose.root.isConnected || !input.compose.body.isConnected) {
    return { ok: false as const, message: "This email draft is no longer open." }
  }

  input.compose.body.focus()
  const selection = window.getSelection()
  selection?.removeAllRanges()

  const range = input.savedRange && input.compose.body.contains(input.savedRange.commonAncestorContainer)
    ? input.savedRange
    : createEndRange(input.compose.body)
  selection?.addRange(range)

  const inserted = document.execCommand("insertHTML", false, input.html)
  if (!inserted) {
    range.deleteContents()
    range.insertNode(range.createContextualFragment(input.html))
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  input.compose.body.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    data: input.text,
    inputType: "insertText",
  }))

  return { ok: true as const }
}

function findComposeRoot(body: HTMLElement) {
  for (const selector of COMPOSE_ROOT_SELECTORS) {
    const root = body.closest<HTMLElement>(selector)
    if (root) return root
  }
  return body.parentElement
}

function findComposeToolbar(root: HTMLElement, body: HTMLElement) {
  const existingMount = root.querySelector<HTMLElement>(`[${ACTION_MOUNT_MARKER}]`)
  if (existingMount) return existingMount

  const sendButton = Array.from(root.querySelectorAll<HTMLElement>('[role="button"][aria-label]'))
    .find((element) => element.getAttribute("aria-label")?.trim().startsWith("Send"))
  const actionRow = sendButton?.closest<HTMLTableRowElement>("tr")
  if (!actionRow) {
    return body.parentElement?.querySelector<HTMLElement>('[role="toolbar"]') ?? null
  }

  const moreOptionsButton = Array.from(actionRow.querySelectorAll<HTMLElement>('[role="button"][aria-label]'))
    .find((element) => element.getAttribute("aria-label")?.trim() === "More options")
  const insertionPoint = moreOptionsButton?.closest<HTMLTableCellElement>("td") ?? actionRow.lastElementChild
  const mount = document.createElement("td")
  mount.setAttribute(ACTION_MOUNT_MARKER, "")
  mount.style.padding = "0 2px"
  mount.style.verticalAlign = "middle"
  mount.style.width = "34px"
  actionRow.insertBefore(mount, insertionPoint ?? null)
  return mount
}

function getComposeId(root: HTMLElement) {
  const existing = root.dataset.lightsiteComposeId
  if (existing) return existing
  composeSequence += 1
  const id = `lightsite-compose-${Date.now().toString(36)}-${composeSequence}`
  root.dataset.lightsiteComposeId = id
  return id
}

function isLikelyRecipientElement(element: HTMLElement) {
  const label = `${element.getAttribute("aria-label") ?? ""} ${element.parentElement?.getAttribute("aria-label") ?? ""}`.toLowerCase()
  if (label.includes("from:")) return false
  return !element.closest('[data-message-id], [role="main"] [data-thread-id]')
}

export function cleanRecipientName(value: string, email: string) {
  return value
    .replace(email, "")
    .replace(/[<>"']/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? null
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function createEndRange(body: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(body)
  range.collapse(false)
  return range
}
