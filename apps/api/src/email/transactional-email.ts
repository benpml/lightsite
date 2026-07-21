import type { ResendConfig, ResendTemplateSender } from "./resend";
import { createResendTemplateSender } from "./resend";

export const RESEND_TEMPLATE_ALIASES = {
  verificationCode: "handout-verification-code",
  passwordReset: "handout-password-reset",
  workspaceInvitation: "handout-workspace-invitation",
  welcome: "handout-welcome",
  passwordChanged: "handout-password-changed",
  emailChanged: "handout-email-changed",
} as const;

export type TransactionalEmailSender = {
  sendVerificationCode(input: { email: string; otp: string }): Promise<void>;
  sendPasswordReset(input: { email: string; resetUrl: string; token: string }): Promise<void>;
  sendWorkspaceInvitation(input: {
    email: string;
    inviterName: string;
    workspaceName: string;
    role: "admin" | "user";
    acceptUrl: string;
  }): Promise<void>;
  sendWelcome(input: {
    email: string;
    recipientName?: string;
    workspaceName: string;
    sitesUrl: string;
    workspaceId: string;
  }): Promise<void>;
  sendPasswordChanged(input: { email: string; accountUrl: string }): Promise<void>;
  sendEmailChanged(input: {
    previousEmail: string;
    newEmail: string;
    accountUrl: string;
  }): Promise<void>;
};

export function createTransactionalEmailSender(
  config: ResendConfig,
  sendTemplate: ResendTemplateSender = createResendTemplateSender(config),
): TransactionalEmailSender {
  return {
    async sendVerificationCode(input) {
      if (!config.apiKey && config.nodeEnv !== "production") {
        console.info(`[handout email] Verification code for ${input.email}: ${input.otp}`);
      }
      await sendTemplate({
        to: input.email,
        template: RESEND_TEMPLATE_ALIASES.verificationCode,
        variables: { CODE: input.otp },
      });
    },

    async sendPasswordReset(input) {
      await sendTemplate({
        to: input.email,
        template: RESEND_TEMPLATE_ALIASES.passwordReset,
        variables: { RESET_URL: input.resetUrl },
        idempotencyKey: `password-reset/${input.token}`,
      });
    },

    async sendWorkspaceInvitation(input) {
      await sendTemplate({
        to: input.email,
        template: RESEND_TEMPLATE_ALIASES.workspaceInvitation,
        variables: {
          INVITER_NAME: input.inviterName,
          WORKSPACE_NAME: input.workspaceName,
          ROLE: input.role === "admin" ? "Admin" : "Member",
          ACCEPT_URL: input.acceptUrl,
        },
      });
    },

    async sendWelcome(input) {
      await sendTemplate({
        to: input.email,
        template: RESEND_TEMPLATE_ALIASES.welcome,
        variables: {
          RECIPIENT_NAME: input.recipientName?.trim() || "there",
          WORKSPACE_NAME: input.workspaceName,
          SITES_URL: input.sitesUrl,
        },
        idempotencyKey: `workspace-welcome/${input.workspaceId}`,
      });
    },

    async sendPasswordChanged(input) {
      await sendTemplate({
        to: input.email,
        template: RESEND_TEMPLATE_ALIASES.passwordChanged,
        variables: { ACCOUNT_URL: input.accountUrl },
      });
    },

    async sendEmailChanged(input) {
      await sendTemplate({
        to: input.previousEmail,
        template: RESEND_TEMPLATE_ALIASES.emailChanged,
        variables: {
          NEW_EMAIL_ADDRESS: input.newEmail,
          ACCOUNT_URL: input.accountUrl,
        },
      });
    },
  };
}
