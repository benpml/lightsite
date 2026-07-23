import { describe, expect, it } from "vitest"
import type { SiteVariableDefinition, SiteVariant } from "@handout/contracts"

import {
  buildRecipientPublicUrl,
  buildRecipientScreenshotUrl,
  cleanRecipientDisplayName,
  createEmailCard,
  createRecipientVariant,
  filterRecipients,
  inferRecipientDraft,
} from "./model"

describe("Gmail recipient inference", () => {
  it("removes stale empty parenthetical text from saved recipient names", () => {
    expect(cleanRecipientDisplayName("Scraper.Tech ()")).toBe("Scraper.Tech")
  })

  it("uses the Gmail contact name and a work domain", () => {
    expect(inferRecipientDraft({ email: "ada@north-star.co", name: "Ada Lovelace" })).toEqual({
      company: "",
      name: "Ada Lovelace",
      values: {},
      website: "north-star.co",
    })
  })

  it("does not invent a company for personal email domains", () => {
    expect(inferRecipientDraft({ email: "grace.hopper@gmail.com", name: "" })).toEqual({
      company: "",
      name: "Grace Hopper",
      values: {},
      website: "",
    })
  })
})

describe("recipient creation", () => {
  const variables = [
    { id: "recipient_website", key: "recipient_website", label: "Website", type: "url", defaultValue: "" },
    { id: "role", key: "role", label: "Role", type: "text", defaultValue: "Sales leader" },
  ] as SiteVariableDefinition[]

  it("creates canonical recipient values and a collision-safe slug", () => {
    const existing = [{ slug: "acme-ada" }] as SiteVariant[]
    const variant = createRecipientVariant({
      draft: { company: " Acme ", name: " Ada ", website: "https://www.acme.com/about", values: {} },
      existingRecipients: existing,
      variables,
    })

    expect(variant.slug).toBe("acme-ada-2")
    expect(variant.variableValues).toMatchObject({
      "recipient-company": "Acme",
      "recipient-name": "Ada",
      recipient_website: "acme.com",
      role: "Sales leader",
    })
  })
})

describe("sharing output", () => {
  it("builds an encoded personalized URL", () => {
    expect(buildRecipientPublicUrl({
      publicOrigin: "https://handout.link/",
      recipient: { slug: "acme-ada" },
      siteSlug: "Sales brief",
      workspaceSlug: "north star",
    })).toBe("https://handout.link/north%20star/Sales%20brief/acme-ada")
  })

  it("escapes all recipient-derived email card content", () => {
    const card = createEmailCard({
      company: '<img src=x onerror="bad">',
      recipientName: "Ada & Co",
      screenshotUrl: 'https://handout.link/embed.jpg?value="bad"',
      siteName: "Q3 <Plan>",
      url: 'https://handout.link/x?value="bad"',
    })
    expect(card.html.match(/<img/g)).toHaveLength(1)
    expect(card.html).not.toContain("<img src=x")
    expect(card.html).toContain("&lt;img")
    expect(card.html).toContain("Ada &amp; Co")
    expect(card.html).toContain("&quot;bad&quot;")
  })

  it("lets the screenshot endpoint redirect to its canonical version", () => {
    expect(buildRecipientScreenshotUrl({
      publicOrigin: "https://handout.link",
      recipient: { revisionNumber: 4, slug: "acme-ada" },
      siteSlug: "brief",
      siteVersion: "2026-07-11T17:00:00.000Z",
      workspaceSlug: "north-star",
    })).toBe("https://handout.link/north-star/brief/acme-ada/embed.jpg")
  })

  it("searches recipient identity, domain, and slug", () => {
    const recipients = [{
      recipientName: "Ada Lovelace",
      recipientCompany: "North Star",
      slug: "north-star-ada",
      variableValues: { recipient_website: "northstar.example" },
    }] as unknown as SiteVariant[]
    expect(filterRecipients(recipients, "northstar.example")).toHaveLength(1)
    expect(filterRecipients(recipients, "missing")).toHaveLength(0)
  })
})
