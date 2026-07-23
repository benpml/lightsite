import { describe, expect, it } from "vitest"

import { colorToHsv, hsvToHex, normalizeHexColor } from "./color-picker"

describe("color picker conversions", () => {
  it("round-trips an opaque six-digit hex color", () => {
    const color = colorToHsv("#755bde")

    expect(color).not.toBeNull()
    expect(hsvToHex(color!)).toBe("#755bde")
  })

  it("preserves the current hue for colors without a defined hue", () => {
    expect(colorToHsv("#ffffff", 251)?.hue).toBe(251)
    expect(colorToHsv("#000000", 251)?.hue).toBe(251)
  })

  it("normalizes only supported six-digit hex values", () => {
    expect(normalizeHexColor("#FFF5D2")).toBe("#fff5d2")
    expect(normalizeHexColor("FFF5D2")).toBe("#fff5d2")
    expect(normalizeHexColor(" 755bde ")).toBe("#755bde")
    expect(normalizeHexColor("#fff")).toBeNull()
    expect(normalizeHexColor("purple")).toBeNull()
  })
})
