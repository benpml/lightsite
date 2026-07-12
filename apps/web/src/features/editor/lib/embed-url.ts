import { normalizeWebsiteUrl } from "@lightsite/domain"

export type EmbedUrlResult =
  | {
      ok: true
      url: string
    }
  | {
      message: string
      ok: false
    }

export function extractIframeSrc(value: string) {
  const trimmed = value.trim()
  const iframeMatch = trimmed.match(/<iframe\b[^>]*\bsrc=(["'])(.*?)\1/i)
  const calInlineEmbedUrl = extractCalInlineEmbedUrl(trimmed)

  return iframeMatch?.[2]?.trim() ?? calInlineEmbedUrl ?? trimmed
}

export function normalizeIframeEmbedUrl(value: string): EmbedUrlResult {
  const rawUrl = extractIframeSrc(value)

  if (!rawUrl) {
    return { ok: false, message: "Enter an embed link." }
  }

  const normalized = normalizeWebsiteUrl(rawUrl)

  if (!normalized.ok) {
    return { ok: false, message: "Enter a valid embed link or iframe code." }
  }

  return { ok: true, url: normalized.url }
}

export function getEmbedUrlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function extractCalInlineEmbedUrl(value: string) {
  if (!/\bCal(?:\.ns\[[^\]]+\])?\s*\(/.test(value) || !value.includes("calLink")) {
    return null
  }

  const calLinkMatch = value.match(/\bcalLink\s*:\s*(["'])(.*?)\1/i)
  const calLink = calLinkMatch?.[2]?.trim()

  if (!calLink) {
    return null
  }

  if (/^https?:\/\//i.test(calLink)) {
    return calLink
  }

  try {
    return new URL(calLink.replace(/^\/+/, ""), "https://cal.com/").toString()
  } catch {
    return null
  }
}
