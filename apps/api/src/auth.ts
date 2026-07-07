import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { validateWorkEmail } from "@lightsite/domain";
import { env } from "./env";
import { db } from "@lightsite/db";
import * as databaseSchema from "@lightsite/db";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: databaseSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const validation = validateWorkEmail(user.email);

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
              emailVerified: true,
            },
          };
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
