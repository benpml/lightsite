import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { renderPublicSiteHtml } from "@lightsite/site-document"

import { getDemoPublishedSite } from "./public-site-fixture"
import { PublicSiteRenderer } from "./public-site-renderer"

describe("public site renderer", () => {
  it("mounts the canonical public document in an isolated full-page frame", () => {
    const html = renderToStaticMarkup(<PublicSiteRenderer payload={getDemoPublishedSite()} />)

    expect(html).toContain('data-public-site-document=""')
    expect(html).toContain('title="Rollout brief"')
    expect(html).toContain("allow-same-origin")
    expect(html).toContain("root.addEventListener")
    expect(html).not.toContain("site-runtime.v3.js")
  })

  it("preserves Tiptap marks and emits element tracking from the shared renderer", () => {
    const html = renderPublicSiteHtml(getDemoPublishedSite("acme"), {
      includeTracking: false,
      origin: "https://lightsite.test",
    })

    expect(html).toContain("<strong>full Tiptap document</strong>")
    expect(html).toContain('data-ls-element-id="book-call"')
    expect(html).toContain('data-ls-element-label="Book a call"')
    expect(html).toContain("A rollout brief for Acme")
  })

  it("does not emit unsafe link protocols", () => {
    const payload = getDemoPublishedSite()
    payload.content.pages[0]!.document.content!.push({
      type: "buttonBlock",
      attrs: { id: "unsafe", href: "javascript:alert(1)" },
      content: [{ type: "text", text: "Unsafe" }],
    })

    const html = renderPublicSiteHtml(payload, { includeTracking: false })

    expect(html).not.toContain("javascript:")
    expect(html).not.toContain('data-ls-element-id="unsafe"')
  })
})
