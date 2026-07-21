import { describe, expect, it } from "vitest";
import {
  renderPasswordResetEmail,
  renderPasswordResetEmailText,
} from "./password-reset-email";
import {
  renderEmailChangedEmail,
  renderPasswordChangedEmail,
} from "./security-notice-email";
import {
  renderWelcomeEmail,
  renderWelcomeEmailText,
} from "./welcome-email";
import {
  renderWorkspaceInvitationEmail,
  renderWorkspaceInvitationEmailText,
} from "./workspace-invitation-email";

describe("transactional email templates", () => {
  it("renders password reset with the shared Handout shell", () => {
    const html = renderPasswordResetEmail({
      resetUrl: "https://app.handout.link/reset-password?token=abc&next=sites",
    });

    expect(html).toContain("https://app.handout.link/handout-logo.svg");
    expect(html).toContain("background-color:#fafafa");
    expect(html).toContain("Reset your password");
    expect(html).toContain("Reset password");
    expect(html).toContain("token=abc&amp;next=sites");
    expect(renderPasswordResetEmailText({ resetUrl: "https://example.com/reset" }))
      .toContain("https://example.com/reset");
  });

  it("renders workspace invitation details and escapes personalized content", () => {
    const html = renderWorkspaceInvitationEmail({
      inviterName: "Avery <Admin>",
      workspaceName: "Acme & Co.",
      role: "admin",
      acceptUrl: "https://app.handout.link/auth?mode=sign-up",
    });

    expect(html).toContain("Avery &lt;Admin&gt; invited you to collaborate");
    expect(html).toContain("Acme &amp; Co.");
    expect(html).toContain("Admin");
    expect(html).toContain("Accept invitation");
    expect(renderWorkspaceInvitationEmailText({
      inviterName: "Avery",
      workspaceName: "Acme",
      role: "member",
      acceptUrl: "https://app.handout.link/auth",
    })).toContain("as a member");
  });

  it("renders the welcome email with a direct first action", () => {
    const html = renderWelcomeEmail({
      firstName: "Ben",
      workspaceName: "Handout Team",
      sitesUrl: "https://app.handout.link/sites",
    });

    expect(html).toContain("Your workspace is ready");
    expect(html).toContain("Hi Ben, Handout Team is set up");
    expect(html).toContain("Create your first site");
    expect(renderWelcomeEmailText({
      workspaceName: "Handout Team",
      sitesUrl: "https://app.handout.link/sites",
    })).toContain("Welcome to Handout.");
  });

  it("renders password and email change security notices", () => {
    const passwordHtml = renderPasswordChangedEmail({
      accountUrl: "https://app.handout.link/settings",
    });
    const emailHtml = renderEmailChangedEmail({
      newEmail: "new@example.com",
      accountUrl: "https://app.handout.link/settings",
    });

    expect(passwordHtml).toContain("Password changed");
    expect(passwordHtml).toContain("reset your password immediately");
    expect(emailHtml).toContain("Email address changed");
    expect(emailHtml).toContain("new@example.com");
    expect(emailHtml).toContain("hello@handout.link");
  });
});
