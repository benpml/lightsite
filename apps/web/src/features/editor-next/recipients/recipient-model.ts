export type SiteRecipient = {
  company: string
  createdAt: string
  id: string
  linkSlug: string
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

export function createSiteRecipient(
  input: CreateSiteRecipientInput,
  existingRecipients: SiteRecipient[]
): SiteRecipient {
  const now = new Date().toISOString()

  return {
    company: normalizeRecipientField(input.company),
    createdAt: now,
    id: createRecipientId(),
    linkSlug: createStableRecipientLinkSlug(input.name, input.company, existingRecipients),
    name: normalizeRecipientField(input.name),
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
      input.company === undefined ? recipient.company : normalizeRecipientField(input.company),
    name: input.name === undefined ? recipient.name : normalizeRecipientField(input.name),
    updatedAt: new Date().toISOString(),
    values: input.values === undefined ? recipient.values : normalizeRecipientValues(input.values),
    website: input.website === undefined ? recipient.website : normalizeWebsite(input.website),
  }
}

export function buildRecipientPublicUrl({
  recipient,
  siteUri,
}: {
  recipient: SiteRecipient
  siteUri: string
}) {
  return `https://lightsite.io/${siteUri}/${recipient.linkSlug}`
}

export function buildRecipientScreenshotUrl({
  recipient,
  siteUri,
}: {
  recipient: SiteRecipient
  siteUri: string
}) {
  return `https://lightsite.io/${siteUri}/${recipient.linkSlug}/embed.png`
}

export function createRecipientEmailEmbedHtml({
  recipient,
  siteUri,
}: {
  recipient: SiteRecipient
  siteUri: string
}) {
  const url = buildRecipientPublicUrl({ recipient, siteUri })
  const screenshotUrl = buildRecipientScreenshotUrl({ recipient, siteUri })
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

export function normalizeRecipientField(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeWebsite(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
}

export function normalizeRecipientValues(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()])
  )
}

export function getRecipientLogoUrl(website: string) {
  const domain = normalizeWebsite(website)

  if (!domain) {
    return null
  }

  const params = new URLSearchParams({
    domain,
    theme: "light",
    size: "64",
  })

  return `/api/workspaces/logo-preview/image?${params.toString()}`
}

function createRecipientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `recipient-${crypto.randomUUID()}`
  }

  return `recipient-${Date.now().toString(36)}-${randomCompactSuffix(8)}`
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
