import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer, emailOTP } from "better-auth/plugins";
import { validateEmail } from "@handout/domain";
import { env } from "./env";
import { db } from "@handout/db";
import * as databaseSchema from "@handout/db";
import { claimWorkspaceInvitationsForUser } from "./team/repository";
import { createVerificationEmailSender } from "./email/verification-email";
import { createTransactionalEmailSender } from "./email/transactional-email";

const sendVerificationEmail = createVerificationEmailSender({
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  nodeEnv: env.NODE_ENV,
});
const transactionalEmail = createTransactionalEmailSender({
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  nodeEnv: env.NODE_ENV,
});

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: databaseSchema,
  }),
  plugins: [
    bearer(),
    emailOTP({
      allowedAttempts: 5,
      changeEmail: { enabled: true },
      expiresIn: 600,
      otpLength: 6,
      overrideDefaultEmailVerification: true,
      rateLimit: { window: 60, max: 3 },
      sendVerificationOnSignUp: true,
      storeOTP: "hashed",
      sendVerificationOTP: sendVerificationEmail,
    }),
  ],
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: true,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      await transactionalEmail.sendPasswordReset({
        email: user.email,
        resetUrl: url,
        token,
      });
    },
    onPasswordReset: async ({ user }) => {
      await transactionalEmail.sendPasswordChanged({
        email: user.email,
        accountUrl: `${env.WEB_ORIGIN}/settings`,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const validation = validateEmail(user.email);

          if (!validation.ok) {
            throw APIError.from("BAD_REQUEST", {
              code: validation.code,
              message: validation.message,
            });
          }

          return {
            data: {
              ...user,
              email: validation.email,
              emailVerified: false,
            },
          };
        },
        after: async (user) => {
          await claimWorkspaceInvitationsForUser({
            userId: user.id,
            email: user.email,
          });
        },
      },
      update: {
        after: async (user, context) => {
          const previousEmail = context?.context.session?.user.email;

          if (
            context?.path === "/email-otp/change-email" &&
            previousEmail &&
            previousEmail.toLowerCase() !== user.email.toLowerCase()
          ) {
            await transactionalEmail.sendEmailChanged({
              previousEmail,
              newEmail: user.email,
              accountUrl: `${env.WEB_ORIGIN}/settings`,
            });
          }
        },
      },
    },
  },
});

function getTrustedOrigins() {
  return [
    env.WEB_ORIGIN,
    ...parseOriginList(env.WEB_ORIGINS),
  ];
}

function parseOriginList(value: string | undefined) {
  return value
    ? value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
    : [];
}
