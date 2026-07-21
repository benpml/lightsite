import {
  renderEmailAction,
  renderEmailHeading,
  renderEmailMutedParagraph,
  renderEmailParagraph,
  renderHandoutEmail,
} from "./email-template";

export const WELCOME_EMAIL_SUBJECT = "Your Handout workspace is ready";

export type WelcomeEmailInput = {
  firstName?: string;
  workspaceName: string;
  sitesUrl: string;
};

export function renderWelcomeEmail(input: WelcomeEmailInput) {
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : "Welcome to Handout.";

  return renderHandoutEmail({
    title: WELCOME_EMAIL_SUBJECT,
    preheader: `${input.workspaceName} is ready for your first Handout.`,
    contentHtml: [
      renderEmailHeading("Your workspace is ready"),
      renderEmailParagraph(`${greeting} ${input.workspaceName} is set up and ready for your first site.`),
      renderEmailAction("Create your first site", input.sitesUrl),
      renderEmailMutedParagraph("Build a page, personalize it for each recipient, and keep improving it after you share the link."),
    ].join("\n"),
  });
}

export function renderWelcomeEmailText(input: WelcomeEmailInput) {
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : "Welcome to Handout.";

  return [
    "Your workspace is ready",
    "",
    `${greeting} ${input.workspaceName} is set up and ready for your first site.`,
    "",
    input.sitesUrl,
    "",
    "Build a page, personalize it for each recipient, and keep improving it after you share the link.",
  ].join("\n");
}
