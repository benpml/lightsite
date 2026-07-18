import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  renderPublicSiteHtml,
  SITE_DOCUMENT_IFRAME_SANDBOX,
} from "@handout/site-document"

import { getDemoPublishedSite } from "./public-site-fixture"
import { PublicSiteRenderer } from "./public-site-renderer"

describe("public site renderer", () => {
  it("mounts the canonical public document in an isolated full-page frame", () => {
    const html = renderToStaticMarkup(<PublicSiteRenderer payload={getDemoPublishedSite()} />)

    expect(html).toContain('data-public-site-document=""')
    expect(html).toContain('title="Rollout brief"')
    expect(html).toContain(`sandbox="${SITE_DOCUMENT_IFRAME_SANDBOX}"`)
    expect(html).toContain("root.addEventListener")
    expect(html).not.toContain("site-runtime.v4.js")
    expect(html).not.toContain("data-handout-consent-popup=&quot;")
    expect(html).not.toContain("data-handout-tracking-v2=&quot;")
  })

  it("preserves Tiptap marks and emits element tracking from the shared renderer", () => {
    const html = renderPublicSiteHtml(getDemoPublishedSite("acme"), {
      includeTracking: false,
      origin: "https://handout.test",
    })

    expect(html).toContain("<strong>full Tiptap document</strong>")
    expect(html).toContain('data-handout-element-id="book-call"')
    expect(html).toContain('data-handout-track="button"')
    expect(html).not.toContain("data-handout-element-label")
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
    expect(html).not.toContain('data-handout-element-id="unsafe"')
  })
})
