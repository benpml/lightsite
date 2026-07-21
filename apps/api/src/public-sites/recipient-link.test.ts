import { describe, expect, it } from "vitest";
import { createDefaultSiteContent } from "@handout/site-document";
import { normalizePublicRecipientLink } from "./recipient-link";

function contentWithPainPoints() {
  const content = createDefaultSiteContent("Outbound brief");
  content.variables.push({
    id: "var-pain-points-1234",
    key: "pain-points",
    label: "Pain points",
    type: "text",
    defaultValue: "",
  });
  return content;
}

describe("public recipient links", () => {
  it("normalizes the cadence URL identity and configured variables", () => {
    const result = normalizePublicRecipientLink(contentWithPainPoints(), {
      recipientName: " John ",
      recipientCompany: " Linear ",
      recipientWebsite: "linear.app",
      searchParams: new URLSearchParams(
        "pain-points=-%20Example%20point%0A-%20Example%20point%202",
      ),
    });

    expect(result).toMatchObject({
      name: "John @ Linear",
      recipientName: "John",
      recipientCompany: "Linear",
      slugBase: "linear-john",
      variableValues: {
        "recipient-name": "John",
        "recipient-company": "Linear",
        recipient_website: "linear.app",
        "var-pain-points-1234": "- Example point\n- Example point 2",
      },
    });
    expect(result?.publicLinkKey).toMatch(/^[a-f0-9]{64}$/);
    expect(result?.variableValues["var-company-logo"]).toContain("domain=linear.app");
  });

  it("ignores unrelated cadence parameters when deriving recipient identity", () => {
    const first = normalizePublicRecipientLink(contentWithPainPoints(), {
      recipientName: "John",
      recipientCompany: "Linear",
      recipientWebsite: "linear.app",
      searchParams: new URLSearchParams("pain-points=Slow%20handoffs"),
    });
    const withUtm = normalizePublicRecipientLink(contentWithPainPoints(), {
      recipientName: "john",
      recipientCompany: "linear",
      recipientWebsite: "https://www.linear.app/about",
      searchParams: new URLSearchParams(
        "utm_campaign=q3&pain-points=Slow%20handoffs",
      ),
    });

    expect(withUtm?.publicLinkKey).toBe(first?.publicLinkKey);
  });

  it("fails closed for ambiguous duplicate variables or invalid public domains", () => {
    expect(normalizePublicRecipientLink(contentWithPainPoints(), {
      recipientName: "John",
      recipientCompany: "Linear",
      recipientWebsite: "linear.app",
      searchParams: new URLSearchParams("pain-points=One&pain-points=Two"),
    })).toBeNull();
    expect(normalizePublicRecipientLink(contentWithPainPoints(), {
      recipientName: "John",
      recipientCompany: "Linear",
      recipientWebsite: "localhost",
      searchParams: new URLSearchParams(),
    })).toBeNull();
  });
});
