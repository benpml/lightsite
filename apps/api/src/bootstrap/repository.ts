import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db as defaultDb,
  internalUserAccess,
  user,
  userProfiles,
  workspaceMembers,
  workspaces,
  type Database,
} from "@lightsite/db";

export type AppUserProfileRecord = {
  userId: string;
  accountSetupCompletedAt: Date | null;
  lastActiveWorkspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalUserAccessRecord = {
  userId: string;
  canAccessDebugTools: boolean;
  canAccessSupportTools: boolean;
};

export type BootstrapWorkspaceMembershipRecord = {
  membership: {
    id: string;
    workspaceId: string;
    userId: string;
    role: "admin" | "user";
    status: "active";
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    websiteDomain: string | null;
    logoAssetId: string | null;
    plan: "free" | "core" | "pro";
    status: "active";
  };
};

export interface BootstrapRepository {
  findUserProfile(userId: string): Promise<AppUserProfileRecord | null>;
  findInternalUserAccess(userId: string): Promise<InternalUserAccessRecord | null>;
  findActiveWorkspaceMembership(
    userId: string,
    workspaceId: string,
  ): Promise<BootstrapWorkspaceMembershipRecord | null>;
  listActiveWorkspaceMemberships(userId: string): Promise<BootstrapWorkspaceMembershipRecord[]>;
  completeAccountSetup(input: {
    userId: string;
    displayName: string;
  }): Promise<void>;
  setLastActiveWorkspace(input: {
    userId: string;
    workspaceId: string;
  }): Promise<void>;
}

export type MemoryBootstrapRepositoryInput = {
  profiles?: AppUserProfileRecord[];
  internalAccess?: InternalUserAccessRecord[];
  memberships?: BootstrapWorkspaceMembershipRecord[];
};

export function createDbBootstrapRepository(database: Database = defaultDb): BootstrapRepository {
  return {
    async findUserProfile(userId) {
      const [profile] = await database
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      return profile ?? null;
    },

    async findInternalUserAccess(userId) {
      const [access] = await database
        .select()
        .from(internalUserAccess)
        .where(eq(internalUserAccess.userId, userId))
        .limit(1);

      return access ?? null;
    },

    async findActiveWorkspaceMembership(userId, workspaceId) {
      const [record] = await database
        .select({
          membership: {
            id: workspaceMembers.id,
            workspaceId: workspaceMembers.workspaceId,
            userId: workspaceMembers.userId,
            role: workspaceMembers.role,
            status: workspaceMembers.status,
          },
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            websiteDomain: workspaces.websiteDomain,
            logoAssetId: workspaces.logoAssetId,
            plan: workspaces.plan,
            status: workspaces.status,
          },
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.status, "active"),
            eq(workspaces.status, "active"),
          ),
        )
        .limit(1);

      return record ? toActiveMembershipRecord(record) : null;
    },

    async listActiveWorkspaceMemberships(userId) {
      const rows = await database
        .select({
          membership: {
            id: workspaceMembers.id,
            workspaceId: workspaceMembers.workspaceId,
            userId: workspaceMembers.userId,
            role: workspaceMembers.role,
            status: workspaceMembers.status,
          },
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            websiteDomain: workspaces.websiteDomain,
            logoAssetId: workspaces.logoAssetId,
            plan: workspaces.plan,
            status: workspaces.status,
          },
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.status, "active"),
            eq(workspaces.status, "active"),
          ),
        );

      return rows.map(toActiveMembershipRecord);
    },

    async completeAccountSetup(input) {
      const now = new Date();

      await database.transaction(async (transaction) => {
        await transaction
          .update(user)
          .set({
            name: input.displayName,
            updatedAt: now,
          })
          .where(eq(user.id, input.userId));

        await transaction
          .insert(userProfiles)
          .values({
            userId: input.userId,
            accountSetupCompletedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: {
              accountSetupCompletedAt: now,
              updatedAt: now,
            },
          });
      });
    },

    async setLastActiveWorkspace(input) {
      const now = new Date();

      await database
        .insert(userProfiles)
        .values({
          userId: input.userId,
          lastActiveWorkspaceId: input.workspaceId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            lastActiveWorkspaceId: input.workspaceId,
            updatedAt: now,
          },
        });
    },
  };
}

export function createMemoryBootstrapRepository(
  input: MemoryBootstrapRepositoryInput = {},
): BootstrapRepository {
  const profiles = new Map(
    (input.profiles ?? []).map((profile) => [profile.userId, profile]),
  );
  const internalAccess = new Map(
    (input.internalAccess ?? []).map((access) => [access.userId, access]),
  );
  const memberships = input.memberships ?? [];

  return {
    async findUserProfile(userId) {
      return profiles.get(userId) ?? null;
    },

    async findInternalUserAccess(userId) {
      return internalAccess.get(userId) ?? null;
    },

    async findActiveWorkspaceMembership(userId, workspaceId) {
      return (
        memberships.find(
          (record) =>
            record.membership.userId === userId &&
            record.membership.workspaceId === workspaceId &&
            record.membership.status === "active" &&
            record.workspace.status === "active",
        ) ?? null
      );
    },

    async listActiveWorkspaceMemberships(userId) {
      return memberships.filter(
        (record) =>
          record.membership.userId === userId &&
          record.membership.status === "active" &&
          record.workspace.status === "active",
      );
    },

    async completeAccountSetup(input) {
      const now = new Date();
      const existingProfile = profiles.get(input.userId);

      profiles.set(input.userId, {
        userId: input.userId,
        accountSetupCompletedAt: now,
        lastActiveWorkspaceId: existingProfile?.lastActiveWorkspaceId ?? null,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      });
    },

    async setLastActiveWorkspace(input) {
      const now = new Date();
      const existingProfile = profiles.get(input.userId);

      profiles.set(input.userId, {
        userId: input.userId,
        accountSetupCompletedAt: existingProfile?.accountSetupCompletedAt ?? null,
        lastActiveWorkspaceId: input.workspaceId,
        createdAt: existingProfile?.createdAt ?? now,
        updatedAt: now,
      });
    },
  };
}

function toActiveMembershipRecord(record: {
  membership: {
    id: string;
    workspaceId: string;
    userId: string;
    role: "admin" | "user";
    status: "active" | "removed";
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    websiteDomain: string | null;
    logoAssetId: string | null;
    plan: "free" | "core" | "pro";
    status: "active" | "suspended" | "scheduled_for_deletion" | "deleted";
  };
}): BootstrapWorkspaceMembershipRecord {
  return {
    membership: {
      ...record.membership,
      status: "active",
    },
    workspace: {
      ...record.workspace,
      status: "active",
    },
  };
}

export function buildMemoryAppUserProfile(
  overrides: Partial<AppUserProfileRecord> = {},
): AppUserProfileRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    userId: `user_${randomUUID()}`,
    accountSetupCompletedAt: now,
    lastActiveWorkspaceId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
