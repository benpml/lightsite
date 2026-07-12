import { GiphyFetch, type GifsResult } from "@giphy/js-fetch-api"

export type LightsiteGiphyGif = GifsResult["data"][number]

export type LightsiteGifSelection = {
  alt: string
  giphyId: string
  height: number | null
  src: string
  title: string
  width: number | null
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY?.trim() ?? ""
const MAX_GIF_WIDTH = 612

export const hasLightsiteGiphyApiKey = GIPHY_API_KEY.length > 0
export const lightsiteGiphyAttributionAssetPath = "/editor-assets/giphy-powered-by-dark.png"
export const lightsiteGiphyClient = hasLightsiteGiphyApiKey ? new GiphyFetch(GIPHY_API_KEY) : null
export const lightsiteGiphyPageSize = 24

export function createLightsiteGiphyFetchGifs(query: string) {
  if (!lightsiteGiphyClient) {
    throw new Error("Missing GIPHY API key")
  }

  const trimmedQuery = query.trim()

  return (offset: number) =>
    trimmedQuery
      ? lightsiteGiphyClient.search(trimmedQuery, {
          limit: lightsiteGiphyPageSize,
          offset,
          rating: "g",
          type: "gifs",
        })
      : lightsiteGiphyClient.trending({
          limit: lightsiteGiphyPageSize,
          offset,
          rating: "g",
          type: "gifs",
        })
}

export function createLightsiteGifSelection(gif: LightsiteGiphyGif): LightsiteGifSelection {
  const images = gif.images as unknown as
    | Record<
        string,
        { height?: number | string; url?: string; webp?: string; width?: number | string } | undefined
      >
    | undefined
  const original = images?.original
  const selectedImage = images?.downsized_large ?? images?.downsized ?? images?.fixed_width ?? original
  const src = selectedImage?.webp ?? selectedImage?.url ?? ""
  const naturalWidth = normalizeImageDimension(selectedImage?.width ?? original?.width)
  const naturalHeight = normalizeImageDimension(selectedImage?.height ?? original?.height)
  const fittedDimensions =
    naturalWidth && naturalHeight ? fitGifDimensions(naturalWidth, naturalHeight) : null
  const alt = normalizeGifAltText(gif.title)

  return {
    alt,
    giphyId: String(gif.id),
    height: fittedDimensions?.height ?? naturalHeight,
    src,
    title: alt,
    width: fittedDimensions?.width ?? naturalWidth,
  }
}

function fitGifDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_GIF_WIDTH / width)

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
}

function normalizeImageDimension(value: number | string | undefined) {
  const dimension = Number(value)

  return Number.isFinite(dimension) && dimension > 0 ? dimension : null
}

function normalizeGifAltText(value: string | undefined) {
  const cleanedValue = value
    ?.replace(/\s+GIF(?:\s+by.*)?$/i, "")
    ?.replace(/\s+/g, " ")
    ?.trim()

  return cleanedValue || "GIF"
}
