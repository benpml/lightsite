import { describe, expect, it } from "vitest"

import { getAppTheme, resolveEditorSiteTheme } from "./theme"

describe("editor theme resolution", () => {
  it("uses the global app theme for automatic websites", () => {
    expect(resolveEditorSiteTheme("system", "light")).toBe("light")
    expect(resolveEditorSiteTheme("system", "dark")).toBe("dark")
  })

  it("keeps light-only and dark-only website overrides", () => {
    expect(resolveEditorSiteTheme("light", "dark")).toBe("light")
    expect(resolveEditorSiteTheme("dark", "light")).toBe("dark")
  })

  it("falls back to the app's configured light default before hydration", () => {
    expect(getAppTheme(undefined)).toBe("light")
    expect(getAppTheme("light")).toBe("light")
    expect(getAppTheme("dark")).toBe("dark")
  })
})
