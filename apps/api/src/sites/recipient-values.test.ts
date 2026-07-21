import { describe, expect, it } from "vitest";

import { withRecipientLogo } from "./recipient-values";

describe("recipient values", () => {
  it("normalizes the website key used by agent-created variants", () => {
    const values = withRecipientLogo({ website: "https://www.linear.app/about" });

    expect(values.website).toBe("linear.app");
    expect(values.recipient_website).toBe("linear.app");
    expect(values["var-company-logo"]).toBe(
      "/api/workspaces/logo-preview/image?domain=linear.app&theme=light&size=64",
    );
  });

  it("removes stale generated logo values when the website is invalid", () => {
    expect(withRecipientLogo({
      recipient_website: "localhost",
      "var-company-logo": "/stale-logo.webp",
    })).not.toHaveProperty("var-company-logo");
  });
});
