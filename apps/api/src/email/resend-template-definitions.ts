import {
  renderEmailAction,
  renderEmailDetails,
  renderEmailDividerNote,
  renderEmailHeading,
  renderEmailMutedParagraph,
  renderEmailParagraph,
  renderHandoutEmail,
  renderVerificationCode,
} from "./email-template";
import { RESEND_TEMPLATE_ALIASES } from "./transactional-email";

type TemplateVariable = {
  key: string;
  type: "string" | "number";
  fallback_value?: string | number;
};

export type ResendTemplateDefinition = {
  name: string;
  alias: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  variables: TemplateVariable[];
};

const CODE = "{{{CODE}}}";
const RESET_URL = "{{{RESET_URL}}}";
const INVITER_NAME = "{{{INVITER_NAME}}}";
const WORKSPACE_NAME = "{{{WORKSPACE_NAME}}}";
const ROLE = "{{{ROLE}}}";
const ACCEPT_URL = "{{{ACCEPT_URL}}}";
const RECIPIENT_NAME = "{{{RECIPIENT_NAME}}}";
const SITES_URL = "{{{SITES_URL}}}";
const ACCOUNT_URL = "{{{ACCOUNT_URL}}}";
const NEW_EMAIL_ADDRESS = "{{{NEW_EMAIL_ADDRESS}}}";

export function getResendTemplateDefinitions(
  from = "Handout <noreply@handout.link>",
): ResendTemplateDefinition[] {
  return [
    {
      name: "Handout verification code",
      alias: RESEND_TEMPLATE_ALIASES.verificationCode,
      from,
      subject: `Your Handout verification code is ${CODE}`,
      html: renderHandoutEmail({
        title: `Your Handout verification code is ${CODE}`,
        preheader: `Use ${CODE} to confirm your email. It expires in 10 minutes.`,
        contentHtml: [
          renderEmailHeading("Confirm your email"),
          renderEmailParagraph("Enter this verification code in Handout to confirm your email address."),
          renderVerificationCode(CODE),
          renderEmailMutedParagraph("This code expires in 10 minutes and can only be used once."),
          renderEmailDividerNote("If you didn't request this code, you can safely ignore this email."),
        ].join("\n"),
      }),
      text: [
        "Confirm your email",
        "",
        `Your Handout verification code is ${CODE}.`,
        "",
        "This code expires in 10 minutes and can only be used once.",
        "",
        "If you didn't request this code, you can safely ignore this email.",
      ].join("\n"),
      variables: [{ key: "CODE", type: "string" }],
    },
    {
      name: "Handout password reset",
      alias: RESEND_TEMPLATE_ALIASES.passwordReset,
      from,
      subject: "Reset your Handout password",
      html: renderHandoutEmail({
        title: "Reset your Handout password",
        preheader: "Reset your Handout password.",
        contentHtml: [
          renderEmailHeading("Reset your password"),
          renderEmailParagraph("We received a request to reset the password for your Handout account."),
          renderEmailAction("Reset password", RESET_URL),
          renderEmailMutedParagraph("This link expires in 60 minutes and can only be used once."),
          renderEmailDividerNote("If you didn't request a password reset, you can safely ignore this email."),
        ].join("\n"),
      }),
      text: [
        "Reset your password",
        "",
        "We received a request to reset the password for your Handout account.",
        "",
        RESET_URL,
        "",
        "This link expires in 60 minutes and can only be used once.",
        "",
        "If you didn't request a password reset, you can safely ignore this email.",
      ].join("\n"),
      variables: [{ key: "RESET_URL", type: "string" }],
    },
    {
      name: "Handout workspace invitation",
      alias: RESEND_TEMPLATE_ALIASES.workspaceInvitation,
      from,
      subject: `${INVITER_NAME} invited you to ${WORKSPACE_NAME}`,
      html: renderHandoutEmail({
        title: `${INVITER_NAME} invited you to ${WORKSPACE_NAME}`,
        preheader: `${INVITER_NAME} invited you to join ${WORKSPACE_NAME} on Handout.`,
        contentHtml: [
          renderEmailHeading("You're invited"),
          renderEmailParagraph(`${INVITER_NAME} invited you to collaborate in Handout.`),
          renderEmailDetails([
            { label: "Workspace", value: WORKSPACE_NAME },
            { label: "Role", value: ROLE },
          ]),
          renderEmailAction("Accept invitation", ACCEPT_URL),
          renderEmailMutedParagraph("This invitation expires in 14 days."),
          renderEmailDividerNote("If you weren't expecting this invitation, you can safely ignore this email."),
        ].join("\n"),
      }),
      text: [
        "You're invited",
        "",
        `${INVITER_NAME} invited you to join ${WORKSPACE_NAME} on Handout as ${ROLE}.`,
        "",
        ACCEPT_URL,
        "",
        "This invitation expires in 14 days.",
        "",
        "If you weren't expecting this invitation, you can safely ignore this email.",
      ].join("\n"),
      variables: [
        { key: "INVITER_NAME", type: "string" },
        { key: "WORKSPACE_NAME", type: "string" },
        { key: "ROLE", type: "string" },
        { key: "ACCEPT_URL", type: "string" },
      ],
    },
    {
      name: "Handout welcome",
      alias: RESEND_TEMPLATE_ALIASES.welcome,
      from,
      subject: "Your Handout workspace is ready",
      html: renderHandoutEmail({
        title: "Your Handout workspace is ready",
        preheader: `${WORKSPACE_NAME} is ready for your first Handout.`,
        contentHtml: [
          renderEmailHeading("Your workspace is ready"),
          renderEmailParagraph(`Hi ${RECIPIENT_NAME}, ${WORKSPACE_NAME} is set up and ready for your first site.`),
          renderEmailAction("Create your first site", SITES_URL),
          renderEmailMutedParagraph("Build a page, personalize it for each recipient, and keep improving it after you share the link."),
        ].join("\n"),
      }),
      text: [
        "Your workspace is ready",
        "",
        `Hi ${RECIPIENT_NAME}, ${WORKSPACE_NAME} is set up and ready for your first site.`,
        "",
        SITES_URL,
        "",
        "Build a page, personalize it for each recipient, and keep improving it after you share the link.",
      ].join("\n"),
      variables: [
        { key: "RECIPIENT_NAME", type: "string", fallback_value: "there" },
        { key: "WORKSPACE_NAME", type: "string" },
        { key: "SITES_URL", type: "string" },
      ],
    },
    {
      name: "Handout password changed",
      alias: RESEND_TEMPLATE_ALIASES.passwordChanged,
      from,
      subject: "Your Handout password was changed",
      html: renderHandoutEmail({
        title: "Your Handout password was changed",
        preheader: "Your Handout password was changed.",
        contentHtml: [
          renderEmailHeading("Password changed"),
          renderEmailParagraph("The password for your Handout account was changed successfully."),
          renderEmailAction("Review your account", ACCOUNT_URL),
          renderEmailDividerNote("If you didn't make this change, reset your password immediately and contact hello@handout.link."),
        ].join("\n"),
      }),
      text: [
        "Password changed",
        "",
        "The password for your Handout account was changed successfully.",
        "",
        ACCOUNT_URL,
        "",
        "If you didn't make this change, reset your password immediately and contact hello@handout.link.",
      ].join("\n"),
      variables: [{ key: "ACCOUNT_URL", type: "string" }],
    },
    {
      name: "Handout email changed",
      alias: RESEND_TEMPLATE_ALIASES.emailChanged,
      from,
      subject: "Your Handout email address was changed",
      html: renderHandoutEmail({
        title: "Your Handout email address was changed",
        preheader: "Your Handout sign-in email was changed.",
        contentHtml: [
          renderEmailHeading("Email address changed"),
          renderEmailParagraph("The sign-in email for your Handout account was changed successfully."),
          renderEmailDetails([{ label: "New email", value: NEW_EMAIL_ADDRESS }]),
          renderEmailAction("Review your account", ACCOUNT_URL),
          renderEmailDividerNote("If you didn't make this change, contact hello@handout.link immediately."),
        ].join("\n"),
      }),
      text: [
        "Email address changed",
        "",
        "The sign-in email for your Handout account was changed successfully.",
        `New email: ${NEW_EMAIL_ADDRESS}`,
        "",
        ACCOUNT_URL,
        "",
        "If you didn't make this change, contact hello@handout.link immediately.",
      ].join("\n"),
      variables: [
        { key: "NEW_EMAIL_ADDRESS", type: "string" },
        { key: "ACCOUNT_URL", type: "string" },
      ],
    },
  ];
}
