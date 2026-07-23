import {
  HANDOUT_TEXT_LIMITS,
  clampTextToLimit,
  normalizeWebsiteUrl,
  type HandoutTextLimitKey,
} from "@handout/domain"

import { buildPublicSiteUrl } from "@/lib/public-site-url"

export { getRecipientLogoUrl } from "@/lib/recipient-logo"

const builtInRecipientVariableIds = new Set([
  "recipient-name",
  "recipient-company",
  "recipient_website",
  "var-company-logo",
])

export type SiteRecipient = {
  company: string
  createdAt: string
  id: string
  linkSlug: string
  shortCode: string
  name: string
  siteId: string
  updatedAt: string
  values: Record<string, string>
  website: string
  workspaceId: string
}

export type CreateSiteRecipientInput = {
  company: string
  name: string
  siteId: string
  values: Record<string, string>
  website?: string
  workspaceId: string
}

export type UpdateSiteRecipientInput = Partial<
  Pick<SiteRecipient, "company" | "name" | "values" | "website">
>

export function isBuiltInRecipientVariableId(variableId: string) {
  return builtInRecipientVariableIds.has(variableId)
}

export function createSiteRecipient(
  input: CreateSiteRecipientInput,
  existingRecipients: SiteRecipient[]
): SiteRecipient {
  const now = new Date().toISOString()

  return {
    company: normalizeRecipientField(input.company, "recipientCompany"),
    createdAt: now,
    id: createRecipientId(),
    linkSlug: createStableRecipientLinkSlug(input.name, input.company, existingRecipients),
    shortCode: "",
    name: normalizeRecipientField(input.name, "recipientName"),
    siteId: input.siteId,
    updatedAt: now,
    values: normalizeRecipientValues(input.values),
    website: normalizeWebsite(input.website ?? ""),
    workspaceId: input.workspaceId,
  }
}

export function updateSiteRecipient(
  recipient: SiteRecipient,
  input: UpdateSiteRecipientInput
): SiteRecipient {
  return {
    ...recipient,
    company:
      input.company === undefined
        ? recipient.company
        : normalizeRecipientField(input.company, "recipientCompany"),
    name:
      input.name === undefined ? recipient.name : normalizeRecipientField(input.name, "recipientName"),
    updatedAt: new Date().toISOString(),
    values: input.values === undefined ? recipient.values : normalizeRecipientValues(input.values),
    website: input.website === undefined ? recipient.website : normalizeWebsite(input.website),
  }
}

export function buildRecipientPublicUrl({
  recipient,
  siteUri,
  publicOrigin,
}: {
  recipient: SiteRecipient
  siteUri: string
  publicOrigin?: string
}) {
  if (recipient.shortCode) {
    return buildPublicSiteUrl(recipient.shortCode, publicOrigin)
  }

  return buildPublicSiteUrl(
    `${siteUri}/${recipient.linkSlug}`,
    publicOrigin
  )
}

export function buildRecipientScreenshotUrl({
  recipient,
  siteUri,
  publicOrigin,
}: {
  recipient: SiteRecipient
  siteUri: string
  siteVersion?: string | null
  publicOrigin?: string
}) {
  if (recipient.shortCode) {
    return buildPublicSiteUrl(
      `${recipient.shortCode}/embed.jpg`,
      publicOrigin
    )
  }

  return buildPublicSiteUrl(
    `${siteUri}/${recipient.linkSlug}/embed.jpg`,
    publicOrigin
  )
}

export function createRecipientEmailEmbedHtml({
  recipient,
  siteUri,
  siteVersion,
  publicOrigin,
}: {
  recipient: SiteRecipient
  siteUri: string
  siteVersion?: string | null
  publicOrigin?: string
}) {
  const url = buildRecipientPublicUrl({ publicOrigin, recipient, siteUri })
  const screenshotUrl = buildRecipientScreenshotUrl({
    publicOrigin,
    recipient,
    siteUri,
    siteVersion,
  })
  const altText = `${recipient.name} at ${recipient.company}`

  return `<a href="${escapeHtmlAttribute(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtmlAttribute(screenshotUrl)}" alt="${escapeHtmlAttribute(altText)}" style="display:block;width:600px;max-width:100%;height:auto;border:0;border-radius:10px;" /></a>`
}

export function createSiteUri(siteId: string) {
  const compactSiteId = siteId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5)

  return `${compactSiteId || "site"}${randomCompactSuffix(5)}`
}

export function createStableRecipientLinkSlug(
  name: string,
  company: string,
  existingRecipients: SiteRecipient[]
) {
  const baseSlug =
    createRecipientSlug(`${company}-${name}`) || createRecipientSlug(`${name}-${company}`) || "recipient"
  const existingSlugs = new Set(existingRecipients.map((recipient) => recipient.linkSlug))

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }

  let nextSlug = `${baseSlug}-${randomCompactSuffix(3)}`

  while (existingSlugs.has(nextSlug)) {
    nextSlug = `${baseSlug}-${randomCompactSuffix(4)}`
  }

  return nextSlug
}

export function createRecipientSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export function normalizeRecipientField(
  value: string,
  limitKey: Extract<HandoutTextLimitKey, "recipientCompany" | "recipientName">
) {
  return clampTextToLimit(value.trim().replace(/\s+/g, " "), limitKey)
}

export function normalizeWebsite(value: string) {
  const normalized = normalizeOptionalRecipientWebsite(value)

  return normalized.ok ? normalized.website : ""
}

export function normalizeOptionalRecipientWebsite(value: string):
  | {
      ok: true
      website: string
    }
  | {
      message: string
      ok: false
    } {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return {
      ok: true,
      website: "",
    }
  }

  if (trimmedValue.length > HANDOUT_TEXT_LIMITS.url) {
    return {
      ok: false,
      message: "Enter a shorter website URL.",
    }
  }

  const normalized = normalizeWebsiteUrl(trimmedValue, { stripPath: true })

  if (!normalized.ok) {
    return {
      ok: false,
      message: "Enter a valid public website URL.",
    }
  }

  return {
    ok: true,
    website: normalized.domain,
  }
}

export function normalizeRecipientValues(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      clampTextToLimit(value.trim(), "recipientVariableValue"),
    ])
  )
}

function createRecipientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16)
    const value = character === "x" ? randomValue : (randomValue & 0x3) | 0x8
    return value.toString(16)
  })
}

function randomCompactSuffix(length: number) {
  return Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, "")
    .slice(2, 2 + length)
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
