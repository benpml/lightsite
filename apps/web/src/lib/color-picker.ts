import Color from "colorjs.io"

export type HsvColor = {
  hue: number
  saturation: number
  value: number
}

export function colorToHsv(value: string, fallbackHue = 0): HsvColor | null {
  const parsed = Color.try(value)
  if (!parsed) return null

  const [hue, saturation, brightness] = parsed
    .to("srgb")
    .toGamut({ space: "srgb", method: "css" })
    .to("hsv").coords

  return {
    hue: normalizeHue(finiteCoordinate(hue, fallbackHue)),
    saturation: clampPercentage(finiteCoordinate(saturation, 0)),
    value: clampPercentage(finiteCoordinate(brightness, 0)),
  }
}

export function hsvToHex({ hue, saturation, value }: HsvColor) {
  return new Color("hsv", [
    normalizeHue(hue),
    clampPercentage(saturation),
    clampPercentage(value),
  ])
    .to("srgb")
    .toGamut({ space: "srgb", method: "css" })
    .toString({ format: "hex", collapse: false })
    .toLowerCase()
}

export function normalizeHexColor(value: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null

  return `#${match[1].toLowerCase()}`
}

function finiteCoordinate(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value))
}

function normalizeHue(value: number) {
  return ((value % 360) + 360) % 360
}
