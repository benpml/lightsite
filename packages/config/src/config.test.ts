import { describe, expect, it } from "vitest";
import { parseApiEnv, parseDatabaseEnv } from "./index";

const validEnv = {
  BETTER_AUTH_SECRET: "a-secret-value-that-is-long-enough",
  BETTER_AUTH_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/lightsite",
  PUBLIC_SITE_ORIGIN: "https://pages.lightsite.test",
  TRACKING_SIGNING_SECRET: "a-tracking-signing-secret-long-enough",
  WEB_ORIGIN: "http://localhost:5173",
};

describe("api env parsing", () => {
  it("parses required API configuration with defaults", () => {
    expect(parseApiEnv(validEnv)).toEqual({
      API_JSON_BODY_LIMIT: "256kb",
      API_PORT: 3011,
      BETTER_AUTH_SECRET: "a-secret-value-that-is-long-enough",
      BETTER_AUTH_URL: "http://localhost:5173",
      DATABASE_POOL_MAX: 10,
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/lightsite",
      NODE_ENV: "development",
      PUBLIC_SITE_ORIGIN: "https://pages.lightsite.test",
      TRACKING_SIGNING_SECRET: "a-tracking-signing-secret-long-enough",
      TRUST_PROXY: "false",
      WEB_ORIGIN: "http://localhost:5173",
    });
  });

  it("rejects short auth secrets", () => {
    expect(() =>
      parseApiEnv({
        ...validEnv,
        BETTER_AUTH_SECRET: "short",
      }),
    ).toThrow();
  });
});

describe("database env parsing", () => {
  it("parses the database URL for database-only tools", () => {
    expect(parseDatabaseEnv(validEnv)).toEqual({
      DATABASE_POOL_MAX: 10,
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/lightsite",
    });
  });
});
