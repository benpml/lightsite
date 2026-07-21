import { describe, expect, it } from "vitest";
import { isPostgresUniqueViolation } from "./postgres-errors";

describe("isPostgresUniqueViolation", () => {
  it("recognizes direct and wrapped unique violations", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true);
    expect(isPostgresUniqueViolation(new Error("query failed", {
      cause: { code: "23505" },
    }))).toBe(true);
  });

  it("rejects other failures and handles cause cycles", () => {
    expect(isPostgresUniqueViolation({ code: "40001" })).toBe(false);
    expect(isPostgresUniqueViolation(null)).toBe(false);

    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(isPostgresUniqueViolation(cyclic)).toBe(false);
  });
});
