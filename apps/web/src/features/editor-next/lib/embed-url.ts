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

  const candidate = rawUrl.startsWith("//")
    ? `https:${rawUrl}`
    : /^[a-z][a-z\d+\-.]*:/i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`

  try {
    const url = new URL(candidate)

    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, message: "Use an http or https embed link." }
    }

    if (url.protocol === "http:" && !isLocalhost(url.hostname)) {
      url.protocol = "https:"
    }

    return { ok: true, url: url.toString() }
  } catch {
    return { ok: false, message: "Enter a valid embed link or iframe code." }
  }
}

export function getEmbedUrlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
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
