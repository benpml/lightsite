import Color from "colorjs.io"

const CONTRAST_SOLVER_TARGET = 4.5
const DARK_FOREGROUND_LIGHTNESS = 0.87
const ADJUSTED_DELTA_E = 0.02
const SOLVER_ITERATIONS = 40

const LIGHT_SURFACE = "#ffffff"
const DARK_SURFACE = "#191919"

export type HandoutColorRoles = {
  foreground: string
  background: string
  backgroundSubtle: string
  border: string
  onForeground: string
  contrast: number
}

export type HandoutColorFamily = {
  source: string
  sourceOklch: string
  adjusted: boolean
  light: HandoutColorRoles
  dark: HandoutColorRoles
}

export type HandoutAdaptiveColorRoles = Omit<HandoutColorRoles, "contrast">

type ModeRecipe = {
  surface: string
  foreground: Color
  backgroundAlpha: number
  backgroundSubtleAlpha: number
  borderAlpha: number
}

/**
 * Expands one user-provided CSS color into the semantic accent roles used by Handout.
 * Hue and chroma are preserved where the sRGB gamut allows; OKLCH lightness is adjusted
 * only far enough to make the solid accent usable as both colored foreground and fill.
 */
export function deriveHandoutColorFamily(value: string): HandoutColorFamily {
  const parsed = Color.try(value)
  if (!parsed) {
    throw new TypeError(`Unsupported color: ${value}`)
  }

  const source = parsed.toGamut({ space: "srgb", method: "css" }).to("oklch")
  const surfaceLight = new Color(LIGHT_SURFACE)
  const surfaceDark = new Color(DARK_SURFACE)
  const lightForeground = solveLightForeground(source, surfaceLight)
  const darkForeground = solveDarkForeground(source, surfaceDark, lightForeground)

  return {
    source: source.to("srgb").toString({ format: "hex" }),
    sourceOklch: formatOklch(source),
    adjusted: source.deltaEOK(lightForeground) >= ADJUSTED_DELTA_E,
    light: createModeRoles({
      surface: LIGHT_SURFACE,
      foreground: lightForeground,
      backgroundAlpha: 0.12,
      backgroundSubtleAlpha: 0.06,
      borderAlpha: 0.08,
    }),
    dark: createModeRoles({
      surface: DARK_SURFACE,
      foreground: darkForeground,
      backgroundAlpha: 0.3,
      backgroundSubtleAlpha: 0.12,
      borderAlpha: 0.16,
    }),
  }
}

/**
 * Returns theme-aware CSS values that follow the active `color-scheme`.
 * Handout's light, dark, and system theme roots all set `color-scheme`, so these
 * values can be shared by editor previews and published documents.
 */
export function deriveHandoutAdaptiveColorRoles(value: string): HandoutAdaptiveColorRoles {
  const family = deriveHandoutColorFamily(value)

  return {
    foreground: adaptiveColor(family.light.foreground, family.dark.foreground),
    background: adaptiveColor(family.light.background, family.dark.background),
    backgroundSubtle: adaptiveColor(
      family.light.backgroundSubtle,
      family.dark.backgroundSubtle,
    ),
    border: adaptiveColor(family.light.border, family.dark.border),
    onForeground: adaptiveColor(family.light.onForeground, family.dark.onForeground),
  }
}

function solveLightForeground(seed: Color, surface: Color) {
  const seedLightness = coordinate(seed, 0)
  const seedCandidate = accentAtLightness(seed, seedLightness)

  if (contrastAgainstSubtle(seedCandidate, surface, 0.06) >= CONTRAST_SOLVER_TARGET) {
    return seedCandidate
  }

  let passingLightness = 0
  let failingLightness = seedLightness

  for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
    const candidateLightness = (passingLightness + failingLightness) / 2
    const candidate = accentAtLightness(seed, candidateLightness)

    if (contrastAgainstSubtle(candidate, surface, 0.06) >= CONTRAST_SOLVER_TARGET) {
      passingLightness = candidateLightness
    } else {
      failingLightness = candidateLightness
    }
  }

  return accentAtLightness(seed, passingLightness)
}

function solveDarkForeground(seed: Color, surface: Color, coreAccent: Color) {
  const preferredLightness = Math.max(coordinate(seed, 0), DARK_FOREGROUND_LIGHTNESS)
  const preferred = accentAtLightness(seed, preferredLightness)

  if (contrastAgainstTint(preferred, coreAccent, surface, 0.12) >= CONTRAST_SOLVER_TARGET) {
    return preferred
  }

  let failingLightness = preferredLightness
  let passingLightness = 1

  for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
    const candidateLightness = (failingLightness + passingLightness) / 2
    const candidate = accentAtLightness(seed, candidateLightness)

    if (contrastAgainstTint(candidate, coreAccent, surface, 0.12) >= CONTRAST_SOLVER_TARGET) {
      passingLightness = candidateLightness
    } else {
      failingLightness = candidateLightness
    }
  }

  return accentAtLightness(seed, passingLightness)
}

function accentAtLightness(seed: Color, lightness: number) {
  const candidate = new Color("oklch", [
    Math.min(1, Math.max(0, lightness)),
    Math.max(0, coordinate(seed, 1)),
    coordinate(seed, 2, 0),
  ])

  return candidate.toGamut({ space: "srgb", method: "css" }).to("oklch")
}

function createModeRoles(recipe: ModeRecipe): HandoutColorRoles {
  const surface = new Color(recipe.surface)
  const foreground = formatOklch(recipe.foreground)
  const backgroundSubtleSurface = compositeOver(
    recipe.foreground,
    surface,
    recipe.backgroundSubtleAlpha,
  )

  return {
    foreground,
    background: formatOklch(recipe.foreground, recipe.backgroundAlpha),
    backgroundSubtle: formatOklch(recipe.foreground, recipe.backgroundSubtleAlpha),
    border: formatOklch(recipe.foreground, recipe.borderAlpha),
    onForeground: recipe.surface,
    contrast: roundContrast(recipe.foreground.contrastWCAG21(backgroundSubtleSurface)),
  }
}

function contrastAgainstSubtle(foreground: Color, surface: Color, alpha: number) {
  return contrastAgainstTint(foreground, foreground, surface, alpha)
}

function contrastAgainstTint(
  foreground: Color,
  tint: Color,
  surface: Color,
  alpha: number,
) {
  return foreground.contrastWCAG21(compositeOver(tint, surface, alpha))
}

function compositeOver(foreground: Color, background: Color, alpha: number) {
  const foregroundSrgb = foreground.to("srgb")
  const backgroundSrgb = background.to("srgb")

  return new Color("srgb", [0, 1, 2].map((index) => (
    coordinate(foregroundSrgb, index) * alpha
      + coordinate(backgroundSrgb, index) * (1 - alpha)
  )) as [number, number, number])
}

function formatOklch(color: Color, alpha = 1) {
  const mapped = color.clone().toGamut({ space: "srgb", method: "css" }).to("oklch")
  const lightness = `${trimNumber(coordinate(mapped, 0) * 100, 5)}%`
  const chroma = trimNumber(coordinate(mapped, 1), 7)
  const hue = trimNumber(coordinate(mapped, 2, 0), 4)
  const alphaValue = alpha < 1 ? ` / ${trimNumber(alpha * 100, 1)}%` : ""

  return `oklch(${lightness} ${chroma} ${hue}${alphaValue})`
}

function coordinate(color: Color, index: number, fallback?: number) {
  const value = color.coords[index]
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (fallback !== undefined) {
    return fallback
  }

  throw new TypeError(`Color is missing coordinate ${index}`)
}

function trimNumber(value: number, precision: number) {
  return Number(value.toFixed(precision)).toString()
}

function adaptiveColor(light: string, dark: string) {
  return `light-dark(${light}, ${dark})`
}

function roundContrast(value: number) {
  return Number(value.toFixed(2))
}
