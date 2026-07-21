import { describe, expect, it, vi } from "vitest"
import { createDefaultSiteContent } from "@handout/site-document"

import {
  createSiteVariableDefinition,
  getSiteVariableUsageCounts,
  getUniqueSiteVariableKey,
  isDuplicateSiteVariableLabel,
  SYSTEM_SITE_VARIABLE_IDS,
} from "./model"

describe("site settings variable model", () => {
  it("keeps the three recipient system variables protected", () => {
    expect([...SYSTEM_SITE_VARIABLE_IDS]).toEqual([
      "recipient-name",
      "recipient-company",
      "recipient_website",
    ])
  })

  it("counts custom variable uses across every page", () => {
    const content = createDefaultSiteContent("Variable use")
    content.pages[0]!.document = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "variableToken", attrs: { variableId: "var-custom" } },
          { type: "text", text: " and " },
          { type: "variableToken", attrs: { variableId: "var-custom" } },
        ],
      }],
    }
    content.pages.push({
      id: "page-two",
      name: "Second",
      slug: "second",
      status: "visible",
      sortOrder: 1,
      document: {
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "variableToken", attrs: { variableId: "var-custom" } }],
        }],
      },
    })

    expect(getSiteVariableUsageCounts(content)).toEqual({ "var-custom": 3 })
  })

  it("treats system names as duplicates regardless of casing or whitespace", () => {
    expect(isDuplicateSiteVariableLabel("  NAME ", [])).toBe(true)
    expect(isDuplicateSiteVariableLabel("company", [])).toBe(true)
    expect(isDuplicateSiteVariableLabel("Proposal owner", [])).toBe(false)
  })

  it("reserves system keys when creating custom variables", () => {
    expect(getUniqueSiteVariableKey("Name", [])).toBe("name-2")
    expect(getUniqueSiteVariableKey("Website", [])).toBe("website-2")
  })

  it("normalizes definitions and creates a collision-safe key", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-abcd-efgh-ijkl-123456789012" })
    const definition = createSiteVariableDefinition({
      label: "  Deal   value  ",
      description: "  Annual value  ",
      defaultValue: "$10k",
    }, [{
      id: "existing",
      key: "deal-value",
      label: "Existing",
      type: "text",
      defaultValue: "",
    }])

    expect(definition).toMatchObject({
      id: "var-deal-value-12345678",
      key: "deal-value-2",
      label: "Deal value",
      description: "Annual value",
      defaultValue: "$10k",
    })
    vi.unstubAllGlobals()
  })
})
