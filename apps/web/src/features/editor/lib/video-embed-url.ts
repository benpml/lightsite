import { normalizeWebsiteUrl } from "@lightsite/domain"

export type VideoEmbedUrlResult =
  | {
      ok: true
      provider: string
      url: string
    }
  | {
      message: string
      ok: false
    }

export function normalizeVideoEmbedUrl(value: string): VideoEmbedUrlResult {
  const trimmed = value.trim()
  const iframeSrc = extractIframeSrc(trimmed)
  const rawUrl = iframeSrc ?? trimmed

  if (!rawUrl) {
    return { ok: false, message: "Enter a video link or iframe embed code." }
  }

  const normalized = normalizeWebsiteUrl(rawUrl)

  if (!normalized.ok) {
    return { ok: false, message: "Enter a valid video link or iframe embed code." }
  }

  const url = new URL(normalized.url)

  const youtubeUrl = normalizeYouTubeUrl(url)
  if (youtubeUrl) {
    return { ok: true, provider: "YouTube", url: youtubeUrl }
  }

  const vimeoUrl = normalizeVimeoUrl(url)
  if (vimeoUrl) {
    return { ok: true, provider: "Vimeo", url: vimeoUrl }
  }

  const loomUrl = normalizeLoomUrl(url)
  if (loomUrl) {
    return { ok: true, provider: "Loom", url: loomUrl }
  }

  if (iframeSrc) {
    return { ok: true, provider: getVideoEmbedHost(url.toString()) || "Video", url: url.toString() }
  }

  return {
    ok: false,
    message: "Paste a YouTube, Vimeo, Loom, or iframe embed link.",
  }
}

export function getVideoEmbedHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function normalizeYouTubeUrl(url: URL) {
  const hostname = url.hostname.replace(/^www\./, "")
  const videoId =
    hostname === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : hostname.endsWith("youtube.com") && url.pathname.startsWith("/embed/")
        ? url.pathname.split("/").filter(Boolean)[1]
        : hostname.endsWith("youtube.com") && url.pathname.startsWith("/shorts/")
          ? url.pathname.split("/").filter(Boolean)[1]
          : hostname.endsWith("youtube.com")
            ? url.searchParams.get("v")
            : null

  if (!videoId) {
    return null
  }

  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
  const start = url.searchParams.get("start") ?? url.searchParams.get("t")

  if (start) {
    const startSeconds = parseYouTubeTimestamp(start)

    if (startSeconds > 0) {
      embedUrl.searchParams.set("start", String(startSeconds))
    }
  }

  return embedUrl.toString()
}

function normalizeVimeoUrl(url: URL) {
  const hostname = url.hostname.replace(/^www\./, "")
  const segments = url.pathname.split("/").filter(Boolean)

  if (hostname === "player.vimeo.com" && segments[0] === "video" && segments[1]) {
    return `https://player.vimeo.com/video/${segments[1]}`
  }

  if (!hostname.endsWith("vimeo.com") || !segments[0]) {
    return null
  }

  const videoId = segments.find((segment) => /^\d+$/.test(segment))

  return videoId ? `https://player.vimeo.com/video/${videoId}` : null
}

function normalizeLoomUrl(url: URL) {
  const hostname = url.hostname.replace(/^www\./, "")
  const segments = url.pathname.split("/").filter(Boolean)

  if (!hostname.endsWith("loom.com")) {
    return null
  }

  if (segments[0] === "embed" && segments[1]) {
    return `https://www.loom.com/embed/${segments[1]}`
  }

  if (segments[0] === "share" && segments[1]) {
    return `https://www.loom.com/embed/${segments[1]}`
  }

  return null
}

function parseYouTubeTimestamp(value: string) {
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10)
  }

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i)

  if (!match) {
    return 0
  }

  const hours = Number.parseInt(match[1] ?? "0", 10)
  const minutes = Number.parseInt(match[2] ?? "0", 10)
  const seconds = Number.parseInt(match[3] ?? "0", 10)

  return hours * 3600 + minutes * 60 + seconds
}

function extractIframeSrc(value: string) {
  const iframeMatch = value.match(/<iframe\b[^>]*\bsrc=(["'])(.*?)\1/i)

  return iframeMatch?.[2]?.trim() ?? null
}
