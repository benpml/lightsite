import { describe, expect, it } from "vitest"

import {
  OUTREACH_PLATFORMS,
  areSequenceVariableMappingsComplete,
  createSequenceEmbedHtml,
  createSequenceVariableMappings,
  type SequenceVariable,
} from "./sequence-embed"

const variables: SequenceVariable[] = [
  { id: "recipient-name", key: "name", label: "Name" },
  { id: "recipient-company", key: "company", label: "Company" },
  { id: "recipient_website", key: "website", label: "Website" },
  { id: "pain-points", key: "pain-points", label: "Pain Points" },
]

describe("sequence embed", () => {
  it("keeps the documented provider merge variables in sync", () => {
    expect(OUTREACH_PLATFORMS.map((platform) => ({
      id: platform.id,
      firstName: platform.firstName,
      company: platform.company,
      domain: platform.domain,
    }))).toEqual([
      { id: "apollo", firstName: "{{contact.first_name}}", company: "{{account.name}}", domain: "{{account.domain}}" },
      { id: "instantly", firstName: "{{firstName}}", company: "{{companyName}}", domain: "{{companyDomain}}" },
      { id: "outreach", firstName: "{{first_name}}", company: "{{account.name}}", domain: "{{account.domain}}" },
      { id: "lemlist", firstName: "{{firstName}}", company: "{{companyName}}", domain: "{{companyDomain}}" },
      { id: "salesloft", firstName: "{{first_name}}", company: "{{account_name_or_company}}", domain: "{{Account.domain}}" },
      { id: "other", firstName: "", company: "", domain: "" },
    ])
  })

  it("prefills known identity variables and leaves custom mappings editable", () => {
    expect(createSequenceVariableMappings("apollo", variables)).toEqual({
      "recipient-name": "{{contact.first_name}}",
      "recipient-company": "{{account.name}}",
      recipient_website: "{{account.domain}}",
      "pain-points": "",
    })

    expect(createSequenceVariableMappings("other", variables)).toEqual({
      "recipient-name": "",
      "recipient-company": "",
      recipient_website: "",
      "pain-points": "",
    })
  })

  it("builds matching deterministic recipient and image paths", () => {
    const html = createSequenceEmbedHtml({
      publicId: "NRmb6JBu3kZw",
      variables,
      mappings: {
        "recipient-name": "{{contact.first_name}}",
        "recipient-company": "{{account.name}}",
        recipient_website: "{{account.domain}}",
        "pain-points": "{{contact.pain points}}",
      },
    })

    expect(html).toContain(
      'href="https://handout.link/NRmb6JBu3kZw/{{contact.first_name}}/{{account.name}}/{{account.domain}}?pain-points={{contact.pain points}}"'
    )
    expect(html).toContain(
      'src="https://handout.link/NRmb6JBu3kZw/{{contact.first_name}}/{{account.name}}/{{account.domain}}/embed.jpg?pain-points={{contact.pain points}}"'
    )
  })

  it("encodes static URL syntax, preserves merge tags, and escapes HTML attributes", () => {
    const variablesWithRole = [
      ...variables,
      { id: "role", key: "role", label: "Role" },
    ]
    const html = createSequenceEmbedHtml({
      publicId: "abc 123",
      publicOrigin: "https://example.test/",
      variables: variablesWithRole,
      mappings: {
        "recipient-name": "Hi {{first_name}}",
        "recipient-company": "{{company}}",
        recipient_website: "{{domain}}",
        "pain-points": "{{pain}}&review=true",
        role: "{{role}}",
      },
    })

    expect(html).toContain("abc%20123/Hi%20{{first_name}}/{{company}}/{{domain}}")
    expect(html).toContain("pain-points={{pain}}%26review%3Dtrue")
    expect(html).toContain("%26review%3Dtrue&amp;role={{role}}")
  })

  it("requires every variable to be mapped before generating code", () => {
    const mappings = createSequenceVariableMappings("apollo", variables)
    expect(areSequenceVariableMappingsComplete(variables, mappings)).toBe(false)
    expect(() => createSequenceEmbedHtml({ publicId: "abc123", variables, mappings })).toThrow(
      "Every Handout variable needs an outreach variable mapping."
    )
  })
})
