import {
  renderEmailAction,
  renderEmailDetails,
  renderEmailDividerNote,
  renderEmailHeading,
  renderEmailParagraph,
  renderHandoutEmail,
} from "./email-template";

export type PasswordChangedEmailInput = {
  accountUrl: string;
};

export function renderPasswordChangedEmail(input: PasswordChangedEmailInput) {
  return renderHandoutEmail({
    title: "Your Handout password was changed",
    preheader: "Your Handout password was changed.",
    contentHtml: [
      renderEmailHeading("Password changed"),
      renderEmailParagraph("The password for your Handout account was changed successfully."),
      renderEmailAction("Review your account", input.accountUrl),
      renderEmailDividerNote("If you didn't make this change, reset your password immediately and contact hello@handout.link."),
    ].join("\n"),
  });
}

export function renderPasswordChangedEmailText(input: PasswordChangedEmailInput) {
  return [
    "Password changed",
    "",
    "The password for your Handout account was changed successfully.",
    "",
    input.accountUrl,
    "",
    "If you didn't make this change, reset your password immediately and contact hello@handout.link.",
  ].join("\n");
}

export type EmailChangedEmailInput = {
  newEmail: string;
  accountUrl: string;
};

export function renderEmailChangedEmail(input: EmailChangedEmailInput) {
  return renderHandoutEmail({
    title: "Your Handout email address was changed",
    preheader: "Your Handout sign-in email was changed.",
    contentHtml: [
      renderEmailHeading("Email address changed"),
      renderEmailParagraph("The sign-in email for your Handout account was changed successfully."),
      renderEmailDetails([{ label: "New email", value: input.newEmail }]),
      renderEmailAction("Review your account", input.accountUrl),
      renderEmailDividerNote("If you didn't make this change, contact hello@handout.link immediately."),
    ].join("\n"),
  });
}

export function renderEmailChangedEmailText(input: EmailChangedEmailInput) {
  return [
    "Email address changed",
    "",
    "The sign-in email for your Handout account was changed successfully.",
    `New email: ${input.newEmail}`,
    "",
    input.accountUrl,
    "",
    "If you didn't make this change, contact hello@handout.link immediately.",
  ].join("\n");
}
