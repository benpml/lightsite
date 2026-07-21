import { describe, expect, it, vi } from "vitest";
import { getResendTemplateDefinitions } from "./resend-template-definitions";
import { RESEND_TEMPLATE_ALIASES, createTransactionalEmailSender } from "./transactional-email";

describe("Resend transactional templates", () => {
  it("defines every published alias with its declared variables", () => {
    const definitions = getResendTemplateDefinitions();

    expect(definitions.map((definition) => definition.alias)).toEqual(
      Object.values(RESEND_TEMPLATE_ALIASES),
    );
    expect(definitions.every((definition) => definition.from === "Handout <noreply@handout.link>"))
      .toBe(true);

    const verification = definitions.find(
      (definition) => definition.alias === RESEND_TEMPLATE_ALIASES.verificationCode,
    );
    expect(verification?.subject).toBe("Your Handout verification code is {{{CODE}}}");
    expect(verification?.html).toContain(">{{{CODE}}}</span>");
  });

  it("sends hosted-template aliases and variables through the shared sender", async () => {
    const sendTemplate = vi.fn().mockResolvedValue({ id: "email_123" });
    const email = createTransactionalEmailSender(
      { apiKey: "re_test", from: "Handout <noreply@handout.link>", nodeEnv: "test" },
      sendTemplate,
    );

    await email.sendWorkspaceInvitation({
      email: "new@acme.com",
      inviterName: "Ada Admin",
      workspaceName: "Acme",
      role: "user",
      acceptUrl: "https://app.handout.link/auth?mode=sign-up",
    });

    expect(sendTemplate).toHaveBeenCalledWith({
      to: "new@acme.com",
      template: RESEND_TEMPLATE_ALIASES.workspaceInvitation,
      variables: {
        INVITER_NAME: "Ada Admin",
        WORKSPACE_NAME: "Acme",
        ROLE: "Member",
        ACCEPT_URL: "https://app.handout.link/auth?mode=sign-up",
      },
    });
  });
});
