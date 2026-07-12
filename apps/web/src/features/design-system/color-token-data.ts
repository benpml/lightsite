import {
  lightsiteDarkTokens,
  lightsiteFoundationTokens,
  lightsiteLightTokens,
} from "@lightsite/design-tokens"

type TokenMap = Readonly<Record<string, string>>

export type BaseColorToken = {
  name: string
  value: string
  hex: string
}

export type SemanticColorToken = {
  name: string
  light: TokenModeValue
  dark: TokenModeValue
  isNonGray: boolean
}

export type TokenModeValue = {
  value: string
  inherits: string | null
  hex: string
}

const foundationColors = Object.fromEntries(
  Object.entries(lightsiteFoundationTokens).filter(([name]) => name.startsWith("neutral-")),
) as TokenMap

const lightColors = lightsiteLightTokens as TokenMap
const darkColors = lightsiteDarkTokens as TokenMap

export const baseColorTokens: BaseColorToken[] = Object.entries(foundationColors).map(
  ([name, value]) => ({
    name,
    value,
    hex: resolveColorToHex(value, foundationColors),
  }),
)

export const semanticColorTokens: SemanticColorToken[] = Object.keys(lightColors).map((name) => {
  const light = getModeValue(name, lightColors)
  const dark = getModeValue(name, darkColors)

  return {
    name,
    light,
    dark,
    isNonGray: !isGray(light.hex) || !isGray(dark.hex),
  }
})

export const nonGraySemanticColorTokens = semanticColorTokens.filter((token) => token.isNonGray)

function getModeValue(name: string, modeColors: TokenMap): TokenModeValue {
  const value = modeColors[name]

  return {
    value,
    inherits: getInheritedToken(value),
    hex: resolveColorToHex(value, { ...foundationColors, ...modeColors }),
  }
}

function getInheritedToken(value: string) {
  return value.match(/^var\(--([^)]+)\)$/)?.[1] ?? null
}

function resolveColorToHex(value: string, tokens: TokenMap, seen = new Set<string>()): string {
  const inheritedToken = getInheritedToken(value)

  if (inheritedToken) {
    if (seen.has(inheritedToken)) {
      throw new Error(`Circular color token reference: ${inheritedToken}`)
    }

    const inheritedValue = tokens[inheritedToken]
    if (!inheritedValue) {
      throw new Error(`Unknown color token reference: ${inheritedToken}`)
    }

    return resolveColorToHex(inheritedValue, tokens, new Set(seen).add(inheritedToken))
  }

  if (value.startsWith("#")) {
    return value.toUpperCase()
  }

  if (value.startsWith("rgb(")) {
    return rgbToHex(value)
  }

  if (value.startsWith("oklch(")) {
    return oklchToHex(value)
  }

  throw new Error(`Unsupported color value: ${value}`)
}

function rgbToHex(value: string) {
  const match = value.match(
    /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%)?\s*\)$/,
  )

  if (!match) {
    throw new Error(`Unsupported rgb color: ${value}`)
  }

  const [, red, green, blue, alpha] = match
  const channels = [red, green, blue].map((channel) => toHexByte(Number(channel)))
  const alphaChannel = alpha ? toHexByte((Number(alpha) / 100) * 255) : ""

  return `#${channels.join("")}${alphaChannel}`
}

function oklchToHex(value: string) {
  const match = value.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/)

  if (!match) {
    throw new Error(`Unsupported oklch color: ${value}`)
  }

  const lightness = Number(match[1]) / 100
  const chroma = Number(match[2])
  const hue = (Number(match[3]) * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  const linearRgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  return `#${linearRgb.map((channel) => toHexByte(linearToSrgb(channel) * 255)).join("")}`
}

function linearToSrgb(channel: number) {
  const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, encoded))
}

function toHexByte(value: number) {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()
}

function isGray(hex: string) {
  const normalized = hex.slice(1, 7)
  return normalized.slice(0, 2) === normalized.slice(2, 4) && normalized.slice(2, 4) === normalized.slice(4, 6)
}
