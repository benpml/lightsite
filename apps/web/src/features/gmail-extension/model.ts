import type { SiteListItem, SiteVariableDefinition, SiteVariant } from "@handout/contracts"

import type { ComposeRecipient } from "./contracts"

const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
])

const BUILT_IN_VARIABLE_IDS = new Set([
  "recipient-company",
  "recipient-name",
  "recipient_website",
  "var-company-logo",
])

export type RecipientDraft = {
  company: string
  name: string
  values: Record<string, string>
  website: string
}

export function cleanRecipientDisplayName(value: string) {
  return value.replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim()
}

export function inferRecipientDraft(recipient: ComposeRecipient | null): RecipientDraft {
  const email = recipient?.email.trim().toLowerCase() ?? ""
  const domain = getEmailDomain(email)
  const inferredName = recipient?.name.trim() || inferNameFromEmail(email)

  return {
    company: "",
    name: inferredName,
    values: {},
    website: domain && !PERSONAL_EMAIL_DOMAINS.has(domain) ? domain : "",
  }
}

export function getCustomVariables(variables: SiteVariableDefinition[]) {
  return variables.filter((variable) => !BUILT_IN_VARIABLE_IDS.has(variable.id))
}

export function filterSites(sites: SiteListItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return sites
  return sites.filter((site) => site.name.toLowerCase().includes(normalizedQuery))
}

export function filterRecipients(recipients: SiteVariant[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return recipients

  return recipients.filter((recipient) => [
    recipient.recipientName,
    recipient.recipientCompany,
    recipient.slug,
    recipient.variableValues.recipient_website,
  ].some((value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery)))
}

export function createRecipientVariant(input: {
  draft: RecipientDraft
  existingRecipients: SiteVariant[]
  variables: SiteVariableDefinition[]
}) {
  const name = normalizeText(input.draft.name)
  const company = normalizeText(input.draft.company)
  const existingSlugs = new Set(input.existingRecipients.map((recipient) => recipient.slug))
  const slug = createUniqueSlug(`${company}-${name}`, existingSlugs)
  const values: Record<string, string> = {
    "recipient-company": company,
    "recipient-name": name,
    recipient_website: normalizeDomain(input.draft.website),
  }

  for (const variable of getCustomVariables(input.variables)) {
    values[variable.id] = input.draft.values[variable.id]?.trim() || getVariableDefaultValue(variable)
  }

  return {
    id: crypto.randomUUID(),
    name: `${name} @ ${company}`,
    recipientCompany: company,
    recipientName: name,
    slug,
    variableValues: values,
  }
}

export function buildRecipientPublicUrl(input: {
  publicOrigin: string
  recipient: Pick<SiteVariant, "slug">
  siteSlug: string
  workspaceSlug: string
}) {
  const path = [input.workspaceSlug, input.siteSlug, input.recipient.slug]
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${input.publicOrigin.replace(/\/$/, "")}/${path}`
}

export function buildRecipientScreenshotUrl(input: {
  publicOrigin: string
  recipient: Pick<SiteVariant, "revisionNumber" | "slug">
  siteSlug: string
  siteVersion?: string | null
  workspaceSlug: string
}) {
  const publicUrl = buildRecipientPublicUrl(input)
  return `${publicUrl}/embed.jpg`
}

export function createEmailLink(input: {
  recipientName: string
  siteName: string
  url: string
}) {
  const label = `${input.siteName} for ${input.recipientName}`
  return {
    html: `<a href="${escapeHtml(input.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>&nbsp;`,
    text: `${label}: ${input.url}`,
  }
}

export function createEmailCard(input: {
  company: string
  recipientName: string
  screenshotUrl: string
  siteName: string
  url: string
}) {
  const altText = escapeHtml(`${input.siteName} for ${input.recipientName} at ${input.company}`)
  const screenshotUrl = escapeHtml(input.screenshotUrl)
  const url = escapeHtml(input.url)
  const html = `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${screenshotUrl}" alt="${altText}" width="600" style="display:block;width:600px;max-width:100%;height:auto;border:0;border-radius:10px;"></a><div><br></div>`

  return {
    html,
    text: `${input.siteName} for ${input.recipientName} at ${input.company}: ${input.url}`,
  }
}

function getEmailDomain(email: string) {
  const atIndex = email.lastIndexOf("@")
  if (atIndex <= 0 || atIndex === email.length - 1) return ""
  return normalizeDomain(email.slice(atIndex + 1))
}

function inferNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? ""
  return titleCase(localPart.replace(/[._+-]+/g, " "))
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function getVariableDefaultValue(variable: SiteVariableDefinition) {
  return typeof variable.defaultValue === "string" ? variable.defaultValue : ""
}

function normalizeDomain(value: string) {
  const candidate = value.trim().toLowerCase()
  if (!candidate) return ""

  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return candidate.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? ""
  }
}

function createUniqueSlug(value: string, existingSlugs: Set<string>) {
  const base = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "recipient"

  if (!existingSlugs.has(base)) return base
  let suffix = 2
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
