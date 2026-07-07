import { GiphyFetch, type GifsResult } from "@giphy/js-fetch-api"

export type GiphyGif = GifsResult["data"][number]

export type EditorGifSelection = {
  alt: string
  giphyId: string
  height: number | null
  src: string
  width: number | null
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY?.trim() ?? ""

export const hasGiphyApiKey = GIPHY_API_KEY.length > 0
export const giphyAttributionAssetPath = "/editor-assets/giphy-powered-by.png"
export const giphyClient = hasGiphyApiKey ? new GiphyFetch(GIPHY_API_KEY) : null
export const giphyPageSize = 24

export function createGiphyFetchGifs(query: string) {
  if (!giphyClient) {
    throw new Error("Missing GIPHY API key")
  }

  const trimmedQuery = query.trim()

  return (offset: number) =>
    trimmedQuery
      ? giphyClient.search(trimmedQuery, {
          limit: giphyPageSize,
          offset,
          rating: "g",
          type: "gifs",
        })
      : giphyClient.trending({
          limit: giphyPageSize,
          offset,
          rating: "g",
          type: "gifs",
        })
}

export function createGifSelection(gif: GiphyGif): EditorGifSelection {
  const images = gif.images as unknown as
    | Record<string, { height?: number | string; url?: string; webp?: string; width?: number | string } | undefined>
    | undefined
  const original = images?.original
  const selectedImage = images?.downsized_large ?? images?.downsized ?? images?.fixed_width ?? original
  const src = selectedImage?.webp ?? selectedImage?.url ?? ""

  return {
    alt: normalizeGifAltText(gif.title),
    giphyId: String(gif.id),
    height: normalizeImageDimension(selectedImage?.height ?? original?.height),
    src,
    width: normalizeImageDimension(selectedImage?.width ?? original?.width),
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
