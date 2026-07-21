import {
  renderEmailAction,
  renderEmailDividerNote,
  renderEmailHeading,
  renderEmailMutedParagraph,
  renderEmailParagraph,
  renderHandoutEmail,
} from "./email-template";

export const PASSWORD_RESET_EMAIL_SUBJECT = "Reset your Handout password";

export function renderPasswordResetEmail(input: { resetUrl: string }) {
  return renderHandoutEmail({
    title: PASSWORD_RESET_EMAIL_SUBJECT,
    preheader: "Reset your Handout password.",
    contentHtml: [
      renderEmailHeading("Reset your password"),
      renderEmailParagraph("We received a request to reset the password for your Handout account."),
      renderEmailAction("Reset password", input.resetUrl),
      renderEmailMutedParagraph("This link expires in 60 minutes and can only be used once."),
      renderEmailDividerNote("If you didn't request a password reset, you can safely ignore this email."),
    ].join("\n"),
  });
}

export function renderPasswordResetEmailText(input: { resetUrl: string }) {
  return [
    "Reset your password",
    "",
    "We received a request to reset the password for your Handout account.",
    "",
    input.resetUrl,
    "",
    "This link expires in 60 minutes and can only be used once.",
    "",
    "If you didn't request a password reset, you can safely ignore this email.",
  ].join("\n");
}
