import { drizzle } from "drizzle-orm/postgres-js";
import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@handout/db";
import { workspaceInvitations } from "@handout/db/schema";

describe("team repository", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encodes the invitation expiry cutoff as a Postgres timestamp", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/handout_test");
    const { claimWorkspaceInvitationsForUser } = await import("./repository");
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      transaction: async (callback: (transaction: unknown) => Promise<void>) => callback({
        select: () => ({
          from: () => ({
            where: async (condition: SQL) => {
              queries.push(
                drizzle.mock()
                  .select({ id: workspaceInvitations.id })
                  .from(workspaceInvitations)
                  .where(condition)
                  .toSQL(),
              );
              return [];
            },
          }),
        }),
      }),
    } as unknown as Database;

    await claimWorkspaceInvitationsForUser(
      {
        userId: "user_test_123",
        email: "New.User@Example.com",
        now: new Date("2026-07-21T12:05:00.034Z"),
      },
      database,
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]?.params).toEqual([
      "new.user@example.com",
      "pending",
      "2026-07-21T12:05:00.034Z",
    ]);
  });
});
