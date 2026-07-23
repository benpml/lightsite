import type { CSSProperties } from "react"
import {
  handoutDarkTokens,
  handoutLightTokens,
} from "@handout/design-tokens"
import { deriveHandoutColorFamily } from "@handout/design-tokens/color-family"
import type { SiteContent, SitePrimaryColor } from "@handout/site-document"

export type PrimaryColorPreviewStyle = CSSProperties & {
  "--primary": string
  "--primary-background-subtle": string
  "--primary-foreground": string
}

export type PrimaryColorPreviewStyles = {
  light: PrimaryColorPreviewStyle
  dark: PrimaryColorPreviewStyle
}

export function getPrimaryColorPreviewStyles(
  color: SiteContent["settings"]["primaryColor"],
  customColor?: SiteContent["settings"]["customPrimaryColor"],
): PrimaryColorPreviewStyles {
  if (customColor) {
    const family = deriveHandoutColorFamily(customColor)

    return {
      light: rolesToPreviewStyle(family.light),
      dark: rolesToPreviewStyle(family.dark),
    }
  }

  return {
    light: presetToPreviewStyle(color, handoutLightTokens),
    dark: presetToPreviewStyle(color, handoutDarkTokens),
  }
}

function rolesToPreviewStyle(roles: {
  foreground: string
  onForeground: string
  backgroundSubtle: string
}): PrimaryColorPreviewStyle {
  return {
    "--primary": roles.foreground,
    "--primary-background-subtle": roles.backgroundSubtle,
    "--primary-foreground": roles.onForeground,
  }
}

function presetToPreviewStyle(
  color: SitePrimaryColor,
  tokens: typeof handoutLightTokens | typeof handoutDarkTokens,
): PrimaryColorPreviewStyle {
  if (color === "neutral") {
    return {
      "--primary": tokens.foreground,
      "--primary-background-subtle": tokens.accent,
      "--primary-foreground": tokens.background,
    }
  }

  const foregroundKey = `${color}-foreground` as keyof typeof tokens
  const backgroundSubtleKey =
    `${color}-background-subtle` as keyof typeof tokens

  return {
    "--primary": tokens[foregroundKey],
    "--primary-background-subtle": tokens[backgroundSubtleKey],
    "--primary-foreground": tokens.background,
  }
}
