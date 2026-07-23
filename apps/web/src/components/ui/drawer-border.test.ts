import { SITE_DOCUMENT_CSS } from "@handout/site-document"
import { describe, expect, it } from "vitest"

const primitiveSources = import.meta.glob("./{drawer,sheet}.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>

describe("app drawer borders", () => {
  it.each(["./drawer.tsx", "./sheet.tsx"])(
    "renders a complete border in %s",
    (path) => {
      const source = primitiveSources[path]

      expect(source).toContain("border border-border")
      expect(source).not.toMatch(
        /data-\[(?:side|vaul-drawer-direction)=[^\]]+\]:border-[trbl]/
      )
    }
  )

  it("preserves the published-site drawer's right border", () => {
    expect(SITE_DOCUMENT_CSS).toContain(
      "border-right:1px solid var(--border)"
    )
  })
})
