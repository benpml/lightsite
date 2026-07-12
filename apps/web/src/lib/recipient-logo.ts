import { normalizeWebsiteDomain } from "@lightsite/domain"

export function getRecipientLogoUrl(website: string | null | undefined) {
  if (!website) return null

  const normalized = normalizeWebsiteDomain(website)
  if (!normalized.ok) return null

  const params = new URLSearchParams({
    domain: normalized.domain,
    theme: "light",
    size: "64",
  })

  return `/api/workspaces/logo-preview/image?${params.toString()}`
}
