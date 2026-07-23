import { describe, expect, it } from "vitest"

import { getPrimaryColorPreviewStyles } from "./primary-color-preview-style"

describe("primary color preview styles", () => {
  it("uses the canonical light and dark preset roles", () => {
    expect(getPrimaryColorPreviewStyles("purple")).toEqual({
      light: {
        "--primary": "#725bcd",
        "--primary-background-subtle": "#755bde0f",
        "--primary-foreground": "#ffffff",
      },
      dark: {
        "--primary": "#d4cafe",
        "--primary-background-subtle": "#755bde1f",
        "--primary-foreground": "var(--neutral-900)",
      },
    })
  })

  it("generates independent light and dark custom-color roles", () => {
    const styles = getPrimaryColorPreviewStyles("purple", "#fff5d2")

    expect(styles.light["--primary"]).toMatch(/^oklch\(/)
    expect(styles.light["--primary-background-subtle"]).toContain("/ 6%)")
    expect(styles.dark["--primary"]).toMatch(/^oklch\(/)
    expect(styles.dark["--primary-background-subtle"]).toContain("/ 12%)")
  })
})
