import { renderToStaticMarkup } from "react-dom/server"
import {
  createDefaultSiteContent,
  SITE_DOCUMENT_IFRAME_SANDBOX,
} from "@handout/site-document"
import { describe, expect, it } from "vitest"

import { EditorSitePreview } from "./site-preview"

describe("editor site preview", () => {
  it("uses the shared generated-document sandbox so canonical fonts can load", () => {
    const html = renderToStaticMarkup(
      <EditorSitePreview
        activePageSlug="overview"
        content={createDefaultSiteContent("Preview")}
        siteId="site-preview"
        siteName="Preview"
        siteSlug="preview"
        workspace={{
          id: "workspace-preview",
          logoUrl: null,
          name: "Preview workspace",
          slug: "preview-workspace",
          websiteDomain: null,
        }}
      />
    )

    expect(html).toContain('data-editor-site-preview=""')
    expect(html).toContain(`sandbox="${SITE_DOCUMENT_IFRAME_SANDBOX}"`)
    expect(html).toContain("Geist Variable")
  })
})
