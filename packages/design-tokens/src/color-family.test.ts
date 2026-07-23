import Color from "colorjs.io"
import { describe, expect, it } from "vitest"

import { deriveHandoutAdaptiveColorRoles, deriveHandoutColorFamily } from "./color-family"

describe("deriveHandoutColorFamily", () => {
  it("darkens a pale seed while preserving its hue and produces Handout alpha roles", () => {
    const family = deriveHandoutColorFamily("#fff5d2")
    const source = new Color(family.sourceOklch).to("oklch")
    const lightForeground = new Color(family.light.foreground).to("oklch")

    expect(family.source).toBe("#fff5d2")
    expect(family.adjusted).toBe(true)
    expect(lightForeground.coords[0]).toBeLessThan(source.coords[0] ?? 0)
    expect(lightForeground.coords[2]).toBeCloseTo(source.coords[2] ?? 0, 1)
    expect(family.light.background).toMatch(/\/ 12%\)$/)
    expect(family.light.backgroundSubtle).toMatch(/\/ 6%\)$/)
    expect(family.light.border).toMatch(/\/ 8%\)$/)
    expect(family.dark.background).toMatch(/\/ 30%\)$/)
    expect(family.dark.backgroundSubtle).toMatch(/\/ 12%\)$/)
    expect(family.dark.border).toMatch(/\/ 16%\)$/)
  })

  it("keeps generated foregrounds in sRGB and above the text contrast threshold", () => {
    for (const seed of ["#fff5d2", "#05c5f0", "#ff00ff", "#111111", "white"]) {
      const family = deriveHandoutColorFamily(seed)

      for (const roles of [family.light, family.dark]) {
        expect(new Color(roles.foreground).inGamut("srgb")).toBe(true)
        expect(roles.contrast).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("rejects values that are not CSS colors", () => {
    expect(() => deriveHandoutColorFamily("not-a-color")).toThrow("Unsupported color")
  })

  it("creates color-scheme-aware CSS roles for shared runtime styling", () => {
    const roles = deriveHandoutAdaptiveColorRoles("#fff5d2")

    expect(roles.foreground).toMatch(/^light-dark\(oklch\(.+\), oklch\(.+\)\)$/)
    expect(roles.backgroundSubtle).toContain(" / 6%)")
    expect(roles.backgroundSubtle).toContain(" / 12%)")
    expect(roles.onForeground).toBe("light-dark(#ffffff, #191919)")
  })
})
