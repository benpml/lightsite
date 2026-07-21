import { z } from "zod";

const envBooleanSchema = z
  .enum(["false", "true"])
  .default("false")
  .transform((value) => value === "true");

const trackingReplayStorageShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRACKING_REPLAY_STORAGE: z.enum(["off", "local", "s3"]).default("off"),
  TRACKING_REPLAY_LOCAL_DIR: z.string().min(1).optional(),
  TRACKING_REPLAY_S3_BUCKET: z.string().min(1).optional(),
  TRACKING_REPLAY_S3_REGION: z.string().min(1).optional(),
  TRACKING_REPLAY_S3_ENDPOINT: z.string().url().optional(),
  TRACKING_REPLAY_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  TRACKING_REPLAY_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  TRACKING_REPLAY_S3_FORCE_PATH_STYLE: envBooleanSchema,
  TRACKING_REPLAY_S3_KEY_PREFIX: z.string().min(1).optional(),
} as const;

export const apiEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3011),
  API_JSON_BODY_LIMIT: z.string().min(1).default("256kb"),
  API_SITE_CONTENT_JSON_BODY_LIMIT: z.string().min(1).default("12mb"),
  AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS: envBooleanSchema,
  AUTOMATIONS_ENABLED: envBooleanSchema,
  AUTOMATIONS_ENCRYPTION_KEY: z.string().min(32).optional(),
  AUTOMATIONS_WORKER_MODE: z.enum(["in-process", "external"]).default("in-process"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  DATABASE_URL: z.string().url(),
  LOGO_DEV_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("Handout <noreply@handout.link>"),
  ...trackingReplayStorageShape,
  PUBLIC_SITE_ORIGIN: z.string().url().optional(),
  STRIPE_CORE_ANNUAL_PRICE_ID: z.string().min(1).optional(),
  STRIPE_CORE_MONTHLY_PRICE_ID: z.string().min(1).optional(),
  STRIPE_PRO_ANNUAL_PRICE_ID: z.string().min(1).optional(),
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  TRACKING_TRUST_CLOUDFLARE_GEO: envBooleanSchema,
  TRACKING_SIGNING_SECRET: z.string().min(32),
  TRACKING_RETENTION_MODE: z.enum(["in-process", "external"]).default("in-process"),
  TRACKING_V2_ENABLED: envBooleanSchema,
  TRUST_PROXY: z
    .enum(["false", "true", "loopback", "linklocal", "uniquelocal"])
    .default("false"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  WEB_ORIGINS: z.string().min(1).optional(),
}).superRefine((config, context) => {
  validateTrackingReplayStorage(config, context);
  if (config.AUTOMATIONS_ENABLED && !config.AUTOMATIONS_ENCRYPTION_KEY) {
    context.addIssue({ code: "custom", path: ["AUTOMATIONS_ENCRYPTION_KEY"], message: "Required when webhook automations are enabled" });
  }
  if (config.NODE_ENV === "production" && config.AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS) {
    context.addIssue({ code: "custom", path: ["AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS"], message: "Local webhook destinations cannot be enabled in production" });
  }
});

export const trackingReplayStorageEnvSchema = z.object(trackingReplayStorageShape)
  .superRefine(validateTrackingReplayStorage);

function validateTrackingReplayStorage(
  config: z.infer<z.ZodObject<typeof trackingReplayStorageShape>>,
  context: z.RefinementCtx,
) {
  if (config.TRACKING_REPLAY_STORAGE === "s3") {
    if (!config.TRACKING_REPLAY_S3_BUCKET) {
      context.addIssue({ code: "custom", path: ["TRACKING_REPLAY_S3_BUCKET"], message: "Required for S3 replay storage" });
    }
    if (!config.TRACKING_REPLAY_S3_REGION) {
      context.addIssue({ code: "custom", path: ["TRACKING_REPLAY_S3_REGION"], message: "Required for S3 replay storage" });
    }
  }
  const hasAccessKey = Boolean(config.TRACKING_REPLAY_S3_ACCESS_KEY_ID);
  const hasSecret = Boolean(config.TRACKING_REPLAY_S3_SECRET_ACCESS_KEY);
  if (hasAccessKey !== hasSecret) {
    context.addIssue({
      code: "custom",
      path: [hasAccessKey ? "TRACKING_REPLAY_S3_SECRET_ACCESS_KEY" : "TRACKING_REPLAY_S3_ACCESS_KEY_ID"],
      message: "S3 replay credentials must be provided together",
    });
  }
}

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(env);
}

export type TrackingReplayStorageEnv = z.infer<typeof trackingReplayStorageEnvSchema>;

export function parseTrackingReplayStorageEnv(env: NodeJS.ProcessEnv): TrackingReplayStorageEnv {
  return trackingReplayStorageEnvSchema.parse(env);
}

export const databaseEnvSchema = z.object({
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  DATABASE_URL: z.string().url(),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function parseDatabaseEnv(env: NodeJS.ProcessEnv): DatabaseEnv {
  return databaseEnvSchema.parse(env);
}
