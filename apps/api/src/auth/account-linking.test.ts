import { describe, expect, it } from "vitest";
import { accountLinkingPolicy } from "./account-linking";

describe("account linking policy", () => {
  it("silently links Google to the existing verified user with the same email", () => {
    expect(accountLinkingPolicy).toEqual({
      enabled: true,
      disableImplicitLinking: false,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
      updateUserInfoOnLink: false,
    });
  });

  it("does not permit identities with different emails to be linked", () => {
    expect(accountLinkingPolicy.allowDifferentEmails).toBe(false);
  });
});
