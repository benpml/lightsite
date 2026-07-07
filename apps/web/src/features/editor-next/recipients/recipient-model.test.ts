import { describe, expect, it } from "vitest"

import {
  buildRecipientPublicUrl,
  createRecipientEmailEmbedHtml,
  createSiteRecipient,
  createStableRecipientLinkSlug,
  getRecipientLogoUrl,
  normalizeWebsite,
  updateSiteRecipient,
} from "./recipient-model"

describe("recipient model", () => {
  it("normalizes websites for logo lookup", () => {
    expect(normalizeWebsite("https://www.Linear.app/pricing")).toBe("linear.app")
    expect(normalizeWebsite(" ACME.com ")).toBe("acme.com")
  })

  it("builds recipient logo urls through the API proxy", () => {
    const logoUrl = getRecipientLogoUrl("https://www.Linear.app/pricing")

    expect(logoUrl).toBe(
      "/api/workspaces/logo-preview/image?domain=linear.app&theme=light&size=64"
    )
    expect(logoUrl).not.toContain("img.logo.dev")
    expect(logoUrl).not.toContain("token=")
  })

  it("creates stable recipient links from company and name", () => {
    expect(createStableRecipientLinkSlug("David", "Linear", [])).toBe("linear-david")
  })

  it("adds a suffix when a recipient slug already exists", () => {
    const recipient = createSiteRecipient(
      {
        company: "Linear",
        name: "David",
        siteId: "site-1",
        values: {},
        workspaceId: "workspace-1",
      },
      []
    )

    expect(createStableRecipientLinkSlug("David", "Linear", [recipient])).toMatch(
      /^linear-david-[a-z0-9]{3,4}$/
    )
  })

  it("builds public urls with the stable site uri", () => {
    const recipient = createSiteRecipient(
      {
        company: "Linear",
        name: "David",
        siteId: "site-1",
        values: {},
        workspaceId: "workspace-1",
      },
      []
    )

    expect(buildRecipientPublicUrl({ recipient, siteUri: "ab4125" })).toBe(
      "https://lightsite.io/ab4125/linear-david"
    )
  })

  it("keeps the generated link slug stable when recipient details change", () => {
    const recipient = createSiteRecipient(
      {
        company: "Linear",
        name: "David",
        siteId: "site-1",
        values: {},
        workspaceId: "workspace-1",
      },
      []
    )

    const updated = updateSiteRecipient(recipient, {
      company: "Linear Labs",
      name: "Dave",
    })

    expect(updated.linkSlug).toBe("linear-david")
    expect(buildRecipientPublicUrl({ recipient: updated, siteUri: "ab4125" })).toBe(
      "https://lightsite.io/ab4125/linear-david"
    )
  })

  it("creates email embed html for the recipient screenshot", () => {
    const recipient = createSiteRecipient(
      {
        company: "Linear",
        name: "David",
        siteId: "site-1",
        values: {},
        workspaceId: "workspace-1",
      },
      []
    )

    expect(createRecipientEmailEmbedHtml({ recipient, siteUri: "ab4125" })).toContain(
      'src="https://lightsite.io/ab4125/linear-david/embed.png"'
    )
  })
})
