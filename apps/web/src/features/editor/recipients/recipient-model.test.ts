import { describe, expect, it } from "vitest"

import {
  buildRecipientPublicUrl,
  createRecipientEmailEmbedHtml,
  createSiteRecipient,
  createStableRecipientLinkSlug,
  getRecipientLogoUrl,
  isBuiltInRecipientVariableId,
  normalizeOptionalRecipientWebsite,
  normalizeWebsite,
  updateSiteRecipient,
} from "./recipient-model"

describe("recipient model", () => {
  it("keeps system recipient fields out of custom-variable inputs", () => {
    expect(isBuiltInRecipientVariableId("recipient-name")).toBe(true)
    expect(isBuiltInRecipientVariableId("recipient-company")).toBe(true)
    expect(isBuiltInRecipientVariableId("recipient_website")).toBe(true)
    expect(isBuiltInRecipientVariableId("var-company-logo")).toBe(true)
    expect(isBuiltInRecipientVariableId("var-deal-stage")).toBe(false)
  })

  it("normalizes websites for logo lookup", () => {
    expect(normalizeWebsite("https://www.Linear.app/pricing")).toBe("linear.app")
    expect(normalizeWebsite(" ACME.com ")).toBe("acme.com")
    expect(normalizeWebsite("localhost:5173")).toBe("")
  })

  it("validates optional recipient websites as public websites", () => {
    expect(normalizeOptionalRecipientWebsite("")).toEqual({
      ok: true,
      website: "",
    })
    expect(normalizeOptionalRecipientWebsite("linear.app/pricing")).toEqual({
      ok: true,
      website: "linear.app",
    })
    expect(normalizeOptionalRecipientWebsite("http://localhost:5173")).toMatchObject({
      ok: false,
    })
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

  it("creates database-compatible recipient ids", () => {
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

    expect(recipient.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
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

    expect(buildRecipientPublicUrl({
      publicOrigin: "https://handout.link",
      recipient,
      siteUri: "ab4125",
    })).toBe(
      "https://handout.link/ab4125/linear-david"
    )
  })

  it("prefers the server-owned short link and short screenshot path", () => {
    const recipient = {
      ...createSiteRecipient(
        {
          company: "Linear",
          name: "David",
          siteId: "site-1",
          values: {},
          workspaceId: "workspace-1",
        },
        []
      ),
      shortCode: "aZ7k2Qr9LmNp",
    }

    expect(buildRecipientPublicUrl({
      publicOrigin: "https://handout.link",
      recipient,
      siteUri: "workspace/site",
    })).toBe("https://handout.link/aZ7k2Qr9LmNp")
    expect(createRecipientEmailEmbedHtml({
      publicOrigin: "https://handout.link",
      recipient,
      siteUri: "workspace/site",
      siteVersion: "version-7",
    })).toContain(
      'src="https://handout.link/aZ7k2Qr9LmNp/embed.jpg"'
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
    expect(buildRecipientPublicUrl({
      publicOrigin: "https://handout.link",
      recipient: updated,
      siteUri: "ab4125",
    })).toBe(
      "https://handout.link/ab4125/linear-david"
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

    const embed = createRecipientEmailEmbedHtml({
      publicOrigin: "https://handout.link",
      recipient,
      siteUri: "ab4125",
    })
    expect(embed).toContain(
      'src="https://handout.link/ab4125/linear-david/embed.jpg"'
    )
    expect(embed).not.toContain("embed.jpg?v=")
    expect(embed).toContain('style="display:block;width:600px;max-width:100%;height:auto')
  })
})
