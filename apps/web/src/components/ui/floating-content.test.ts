import { describe, expect, it } from "vitest"

const primitiveModules = import.meta.glob("./*.tsx", {
  eager: true,
  import: "default",
  query: "?raw",
})

const floatingContentPrimitives = [
  { path: "./combobox.tsx", surfaces: 1 },
  { path: "./context-menu.tsx", surfaces: 2 },
  { path: "./dropdown-menu.tsx", surfaces: 2 },
  { path: "./hover-card.tsx", surfaces: 1 },
  { path: "./menubar.tsx", surfaces: 2 },
  { path: "./popover.tsx", surfaces: 1 },
  { path: "./select.tsx", surfaces: 1 },
  { path: "./tooltip.tsx", surfaces: 1 },
] as const

describe("floating content primitives", () => {
  it.each(floatingContentPrimitives)(
    "keeps every $path surface inside a viewport gutter",
    ({ path, surfaces }) => {
      const source = primitiveModules[path]

      expect(typeof source).toBe("string")
      expect((source as string).match(/collisionPadding = 8/g) ?? []).toHaveLength(
        surfaces
      )
      expect(((source as string).match(/max-w-/g) ?? []).length).toBeGreaterThanOrEqual(
        surfaces
      )
    }
  )
})
