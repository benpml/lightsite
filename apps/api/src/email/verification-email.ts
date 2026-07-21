import {
  renderEmailDividerNote,
  renderEmailHeading,
  renderEmailMutedParagraph,
  renderEmailParagraph,
  renderHandoutEmail,
  renderVerificationCode,
} from "./email-template";
import type { ResendConfig } from "./resend";
import { createTransactionalEmailSender } from "./transactional-email";

export type VerificationEmailConfig = ResendConfig;

export type VerificationEmailInput = {
  email: string;
  otp: string;
  type: string;
};

export function getVerificationEmailSubject(otp: string) {
  return `Your Handout verification code is ${otp}`;
}

export function createVerificationEmailSender(config: VerificationEmailConfig) {
  const transactionalEmail = createTransactionalEmailSender(config);

  return async (input: VerificationEmailInput) => {
    await transactionalEmail.sendVerificationCode({
      email: input.email,
      otp: input.otp,
    });
  };
}

export function renderVerificationEmailText(otp: string) {
  return [
    "Confirm your email",
    "",
    `Your Handout verification code is ${otp}.`,
    "",
    "This code expires in 10 minutes and can only be used once.",
    "",
    "If you didn't request this code, you can safely ignore this email.",
  ].join("\n");
}

export function renderVerificationEmail(otp: string) {
  return renderHandoutEmail({
    title: getVerificationEmailSubject(otp),
    preheader: `Use ${otp} to confirm your email. It expires in 10 minutes.`,
    contentHtml: [
      renderEmailHeading("Confirm your email"),
      renderEmailParagraph("Enter this verification code in Handout to confirm your email address."),
      renderVerificationCode(otp),
      renderEmailMutedParagraph("This code expires in 10 minutes and can only be used once."),
      renderEmailDividerNote("If you didn't request this code, you can safely ignore this email."),
    ].join("\n"),
  });
}
