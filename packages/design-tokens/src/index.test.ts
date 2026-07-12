import { describe, expect, it } from "vitest"

import {
  LIGHTSITE_THEME_CSS,
  lightsiteDarkTokens,
  lightsiteLightTokens,
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

describe("shared design tokens", () => {
  it("keeps every semantic light token available in dark mode", () => {
    expect(Object.keys(lightsiteDarkTokens).sort()).toEqual(
      Object.keys(lightsiteLightTokens).sort(),
    )
  })

  it("emits light, dark, and system selectors from the same maps", () => {
    expect(LIGHTSITE_THEME_CSS).toContain(":root,.light{color-scheme:light")
    expect(LIGHTSITE_THEME_CSS).toContain(".dark{color-scheme:dark")
    expect(LIGHTSITE_THEME_CSS).toContain(".system{color-scheme:dark")
    expect(LIGHTSITE_THEME_CSS).not.toContain("--ls-")
    expect(LIGHTSITE_THEME_CSS).not.toContain("--lightsite-editor-color-")
    expect(LIGHTSITE_THEME_CSS).not.toContain("--editor-color-")
    expect(Object.keys(lightsiteLightTokens).some((name) => name.startsWith("lightsite-"))).toBe(false)
    expect(Object.keys(lightsiteDarkTokens).some((name) => name.startsWith("lightsite-"))).toBe(false)
  })

  it("uses the exact role-based palette in both modes", () => {
    expect(lightsiteLightTokens).toMatchObject(lightPalette)
    expect(lightsiteDarkTokens).toMatchObject(darkPalette)
    expect(lightsiteLightTokens).toMatchObject({
      "variable-background": "var(--cyan-background)",
      "variable-foreground": "var(--cyan-foreground)",
      "variable-border": "var(--cyan-border)",
    })
    expect(lightsiteDarkTokens).toMatchObject({
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
    expect(lightsiteLightTokens["table-header-background"]).toBe("rgb(0 0 0 / 5%)")
    expect(lightsiteDarkTokens["table-header-background"]).toBe("rgb(0 0 0 / 5%)")
  })
})
