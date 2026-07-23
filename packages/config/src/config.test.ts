import { describe, expect, it } from "vitest";
import {
  parseApiEnv,
  parseDatabaseEnv,
  parseTrackingReplayStorageEnv,
} from "./index";

const validEnv = {
  BETTER_AUTH_SECRET: "a-secret-value-that-is-long-enough",
  BETTER_AUTH_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/handout",
  PUBLIC_SITE_ORIGIN: "https://pages.handout.test",
  TRACKING_SIGNING_SECRET: "a-tracking-signing-secret-long-enough",
  WEB_ORIGIN: "http://localhost:5173",
};

describe("api env parsing", () => {
  it("parses required API configuration with defaults", () => {
    expect(parseApiEnv(validEnv)).toEqual({
      API_JSON_BODY_LIMIT: "256kb",
      API_PORT: 3011,
      API_SITE_CONTENT_JSON_BODY_LIMIT: "12mb",
      AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS: false,
      AUTOMATIONS_ENABLED: false,
      AUTOMATIONS_WORKER_MODE: "in-process",
      BETTER_AUTH_SECRET: "a-secret-value-that-is-long-enough",
      BETTER_AUTH_URL: "http://localhost:5173",
      DATABASE_POOL_MAX: 10,
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/handout",
      EMAIL_FROM: "Handout <noreply@handout.link>",
      NODE_ENV: "development",
      PUBLIC_SITE_ORIGIN: "https://pages.handout.test",
      TRACKING_SIGNING_SECRET: "a-tracking-signing-secret-long-enough",
      TRACKING_REPLAY_STORAGE: "off",
      TRACKING_REPLAY_S3_FORCE_PATH_STYLE: false,
      TRACKING_RETENTION_MODE: "in-process",
      TRACKING_TRUST_CLOUDFLARE_GEO: false,
      TRACKING_V2_ENABLED: false,
      TRUST_PROXY: "false",
      WEB_ORIGIN: "http://localhost:5173",
    });
  });

  it("parses tracking feature switches from strings", () => {
    expect(
      parseApiEnv({
        ...validEnv,
        TRACKING_TRUST_CLOUDFLARE_GEO: "true",
        TRACKING_V2_ENABLED: "true",
      }),
    ).toMatchObject({
      TRACKING_TRUST_CLOUDFLARE_GEO: true,
      TRACKING_V2_ENABLED: true,
    });
  });

  it("supports an external production retention scheduler", () => {
    expect(parseApiEnv({ ...validEnv, TRACKING_RETENTION_MODE: "external" }).TRACKING_RETENTION_MODE)
      .toBe("external");
  });

  it("requires an encryption key when automations are enabled", () => {
    expect(() => parseApiEnv({ ...validEnv, AUTOMATIONS_ENABLED: "true" })).toThrow();
    expect(parseApiEnv({
      ...validEnv,
      AUTOMATIONS_ENABLED: "true",
      AUTOMATIONS_ENCRYPTION_KEY: "a".repeat(32),
    }).AUTOMATIONS_ENABLED).toBe(true);
  });

  it("never permits local automation destinations in production", () => {
    expect(() => parseApiEnv({
      ...validEnv,
      NODE_ENV: "production",
      AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS: "true",
    })).toThrow();
  });

  it("requires a dedicated origin authentication secret in production", () => {
    expect(() => parseApiEnv({
      ...validEnv,
      NODE_ENV: "production",
    })).toThrow();
    expect(parseApiEnv({
      ...validEnv,
      NODE_ENV: "production",
      ORIGIN_AUTH_SECRET: "o".repeat(32),
    }).ORIGIN_AUTH_SECRET).toBe("o".repeat(32));
  });

  it("rejects short auth secrets", () => {
    expect(() =>
      parseApiEnv({
        ...validEnv,
        BETTER_AUTH_SECRET: "short",
      }),
    ).toThrow();
  });

  it("requires complete Google OAuth credentials when either value is provided", () => {
    expect(() => parseApiEnv({
      ...validEnv,
      GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
    })).toThrow();
    expect(parseApiEnv({
      ...validEnv,
      GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    })).toMatchObject({
      GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    });
  });
});

describe("database env parsing", () => {
  it("parses the database URL for database-only tools", () => {
    expect(parseDatabaseEnv(validEnv)).toEqual({
      DATABASE_POOL_MAX: 10,
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/handout",
    });
  });
});

describe("replay storage env parsing", () => {
  it("parses storage configuration without unrelated API secrets", () => {
    expect(parseTrackingReplayStorageEnv({
      NODE_ENV: "production",
      TRACKING_REPLAY_STORAGE: "s3",
      TRACKING_REPLAY_S3_BUCKET: "handout-session-replays",
      TRACKING_REPLAY_S3_REGION: "auto",
    })).toMatchObject({
      NODE_ENV: "production",
      TRACKING_REPLAY_STORAGE: "s3",
      TRACKING_REPLAY_S3_FORCE_PATH_STYLE: false,
    });
  });

  it("requires complete S3 credentials when either credential is provided", () => {
    expect(() => parseTrackingReplayStorageEnv({
      TRACKING_REPLAY_STORAGE: "s3",
      TRACKING_REPLAY_S3_BUCKET: "handout-session-replays",
      TRACKING_REPLAY_S3_REGION: "auto",
      TRACKING_REPLAY_S3_ACCESS_KEY_ID: "access-key",
    })).toThrow();
  });
});
