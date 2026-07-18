import { describe, expect, it } from "vitest"

import {
  HANDOUT_THEME_CSS,
  HANDOUT_WEBSITE_THEME_CSS,
  handoutDarkTokens,
  handoutFoundationTokens,
  handoutLightTokens,
  handoutWebsiteComponentTokens,
  handoutWebsiteTokens,
  normalizeEditorHighlightColor,
  normalizeEditorTextColor,
} from "./index"

const lightPalette = {
  "purple-background": "#755bde1f", "purple-foreground": "#725bcd", "purple-border": "#755bde14",
  "blue-background": "#0085ee1f", "blue-foreground": "#218ce2", "blue-border": "#0085ee14",
  "cyan-background": "#0588f01f", "cyan-foreground": "#0797b9", "cyan-border": "#0588f014",
  "teal-background": "#0d9b8a1f", "teal-foreground": "#0d9b8a", "teal-border": "#0d9b8a14",
  "green-background": "#2b9a661f", "green-foreground": "#2b9a66", "green-border": "#2b9a6614",
  "yellow-background": "#ffba181f", "yellow-foreground": "#ffba18", "yellow-border": "#ffba1814",
  "orange-background": "#ef5f001f", "orange-foreground": "#ef5f00", "orange-border": "#ef5f0014",
  "red-background": "#dc3e421f", "red-foreground": "#dc3e42", "red-border": "#dc3e4214",
  "pink-background": "#cf38971f", "pink-foreground": "#cf3897", "pink-border": "#cf389714",
} as const

const darkPalette = {
  "purple-background": "#755bde4d", "purple-foreground": "#d4cafe", "purple-border": "#755bde29",
  "blue-background": "#0085ee4d", "blue-foreground": "#97d1ff", "blue-border": "#0085ee29",
  "cyan-background": "#0588f04d", "cyan-foreground": "#a4e9f4", "cyan-border": "#0588f029",
  "teal-background": "#0d9b8a4d", "teal-foreground": "#99eada", "teal-border": "#0d9b8a29",
  "green-background": "#2b9a664d", "green-foreground": "#abeec6", "green-border": "#2b9a6629",
  "yellow-background": "#ffba184d", "yellow-foreground": "#f7dd84", "yellow-border": "#ffba1829",
  "orange-background": "#ef5f004d", "orange-foreground": "#ffc78d", "orange-border": "#ef5f0029",
  "red-background": "#dc3e4252", "red-foreground": "#fdbdbe", "red-border": "#dc3e4229",
  "pink-background": "#cf38974d", "pink-foreground": "#efbfdd", "pink-border": "#cf389729",
} as const

const lightSubtleBackgroundPalette = {
  "purple-background-subtle": "#755bde0f",
  "blue-background-subtle": "#0085ee0f",
  "cyan-background-subtle": "#0588f00f",
  "teal-background-subtle": "#0d9b8a0f",
  "green-background-subtle": "#2b9a660f",
  "yellow-background-subtle": "#ffba180f",
  "orange-background-subtle": "#ef5f000f",
  "red-background-subtle": "#dc3e420f",
  "pink-background-subtle": "#cf38970f",
} as const

const darkSubtleBackgroundPalette = {
  "purple-background-subtle": "#755bde1f",
  "blue-background-subtle": "#0085ee1f",
  "cyan-background-subtle": "#0588f01f",
  "teal-background-subtle": "#0d9b8a1f",
  "green-background-subtle": "#2b9a661f",
  "yellow-background-subtle": "#ffba181f",
  "orange-background-subtle": "#ef5f001f",
  "red-background-subtle": "#dc3e421f",
  "pink-background-subtle": "#cf38971f",
} as const

describe("shared design tokens", () => {
  it("keeps the app and website on the corrected neutral foundation", () => {
    expect(handoutFoundationTokens["white-alpha-a200"]).toBe(
      "rgb(255 255 255 / 20%)",
    )
    expect(handoutFoundationTokens["neutral-450"]).toBe("#8d8d8d")
    expect(handoutFoundationTokens["neutral-alpha-a300"]).toBe(
      "rgb(128 128 128 / 12%)",
    )
    expect(handoutFoundationTokens["neutral-alpha-a400"]).toBe(
      "rgb(128 128 128 / 14%)",
    )
  })

  it("emits the website semantic layer from the shared foundation", () => {
    expect(handoutWebsiteTokens).toEqual({
      background: "var(--white-white)",
      foreground: "var(--neutral-900)",
      border: "var(--neutral-alpha-a400)",
      card: "var(--neutral-50)",
      "card-foreground": "var(--neutral-900)",
      primary: "var(--neutral-950)",
      "primary-foreground": "var(--white-white)",
      secondary: "var(--white-white)",
      "secondary-foreground": "var(--neutral-700)",
      tertiary: "var(--neutral-alpha-a200)",
      "tertiary-foreground": "var(--neutral-600)",
      muted: "var(--neutral-alpha-a300)",
      "muted-foreground": "var(--neutral-450)",
      "inverse-foreground": "var(--white-white)",
      "inverse-secondary-foreground": "var(--white-alpha-a800)",
      "inverse-border": "var(--white-alpha-a300)",
      input: "var(--neutral-alpha-a700)",
      ring: "var(--neutral-500)",
      popover: "var(--background)",
      "popover-foreground": "var(--foreground)",
    })
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      ":root{color-scheme:light;--white-white:#ffffff",
    )
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--muted-foreground:var(--neutral-450)",
    )
    expect(handoutWebsiteComponentTokens).toEqual({
      "website-radius-sm": "8px",
      "website-radius-md": "10px",
      "website-radius-lg": "12px",
      "website-radius-2xl": "16px",
      "corner-border": "var(--neutral-alpha-a800)",
      "hero-benefits-backdrop": "#003683",
      "secondary-hover": "var(--neutral-50)",
      "control-shadow": "0 1px 0.5px rgb(0 0 0 / 6%)",
      "badge-inverse-shadow": "0 1px 1px rgb(0 0 0 / 6%)",
      "success-background": "rgb(43 154 102 / 12%)",
      "success-foreground": "#2b9a66",
      "success-border": "rgb(43 154 102 / 8%)",
      "section-divider": "#ededed",
      "tab-shadow": "0 1px 1.5px rgb(0 0 0 / 10%)",
    })
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--secondary-hover:var(--neutral-50)",
    )
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--corner-border:var(--neutral-alpha-a800)",
    )
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--hero-benefits-backdrop:#003683",
    )
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--section-divider:#ededed",
    )
    expect(HANDOUT_WEBSITE_THEME_CSS).toContain(
      "--control-shadow:0 1px 0.5px rgb(0 0 0 / 6%)",
    )
  })

  it("keeps every semantic light token available in dark mode", () => {
    expect(Object.keys(handoutDarkTokens).sort()).toEqual(
      Object.keys(handoutLightTokens).sort(),
    )
  })

  it("emits light, dark, and system selectors from the same maps", () => {
    expect(HANDOUT_THEME_CSS).toContain(":root,.light{color-scheme:light")
    expect(HANDOUT_THEME_CSS).toContain(".dark{color-scheme:dark")
    expect(HANDOUT_THEME_CSS).toContain(".system{color-scheme:dark")
    expect(HANDOUT_THEME_CSS).not.toContain("--handout-")
    expect(HANDOUT_THEME_CSS).not.toContain("--handout-editor-color-")
    expect(HANDOUT_THEME_CSS).not.toContain("--editor-color-")
    expect(Object.keys(handoutLightTokens).some((name) => name.startsWith("handout-"))).toBe(false)
    expect(Object.keys(handoutDarkTokens).some((name) => name.startsWith("handout-"))).toBe(false)
  })

  it("uses the exact role-based palette in both modes", () => {
    expect(handoutLightTokens).toMatchObject(lightPalette)
    expect(handoutDarkTokens).toMatchObject(darkPalette)
    expect(handoutLightTokens).toMatchObject(lightSubtleBackgroundPalette)
    expect(handoutDarkTokens).toMatchObject(darkSubtleBackgroundPalette)
    expect(handoutLightTokens).toMatchObject({
      "variable-background": "var(--cyan-background)",
      "variable-foreground": "var(--cyan-foreground)",
      "variable-border": "var(--cyan-border)",
    })
    expect(handoutDarkTokens).toMatchObject({
      "variable-background": "var(--cyan-background)",
      "variable-foreground": "var(--cyan-foreground)",
      "variable-border": "var(--cyan-border)",
    })
  })

  it("migrates the previous editor color values to the role-based palette", () => {
    expect(normalizeEditorTextColor("var(--editor-color-indigo)")).toBe("var(--purple-foreground)")
    expect(normalizeEditorTextColor("var(--editor-color-sky)")).toBe("var(--cyan-foreground)")
    expect(normalizeEditorTextColor("var(--editor-color-neutral)")).toBe("var(--muted-foreground)")
    expect(normalizeEditorHighlightColor("color-mix(in oklab, var(--editor-color-rose) 30%, transparent)")).toBe("var(--red-background)")
    expect(normalizeEditorHighlightColor("var(--editor-color-amber)")).toBe("var(--yellow-background)")
  })

  it("gives table headers the shared translucent black fill", () => {
    expect(handoutLightTokens["table-header-background"]).toBe("rgb(0 0 0 / 5%)")
    expect(handoutDarkTokens["table-header-background"]).toBe("rgb(0 0 0 / 5%)")
  })

  it("uses a dedicated subtle input fill without weakening input borders", () => {
    expect(handoutLightTokens.input).toBe("var(--neutral-alpha-a700)")
    expect(handoutDarkTokens.input).toBe("var(--neutral-alpha-a700)")
    expect(handoutLightTokens["input-background"]).toBe("var(--neutral-alpha-a200)")
    expect(handoutDarkTokens["input-background"]).toBe("var(--neutral-alpha-a300)")
    expect(HANDOUT_THEME_CSS).toContain("--input-background:var(--neutral-alpha-a200)")
  })
})
