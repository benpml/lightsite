import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db as defaultDb,
  userProfiles,
  workspaceMembers,
  workspaces,
  type Database,
} from "@lightsite/db";

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  websiteDomain: string | null;
  logoAssetId: string | null;
  plan: "free" | "core" | "pro";
  status: "active" | "suspended" | "scheduled_for_deletion" | "deleted";
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMembershipRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  role: "admin" | "user";
  status: "active" | "removed";
  createdAt: Date;
  updatedAt: Date;
};

export type CreateWorkspaceWithAdminInput = {
  name: string;
  slug: string;
  websiteDomain: string;
  logoAssetId?: string;
  creatorUserId: string;
};

export type CreateWorkspaceWithAdminResult = {
  workspace: WorkspaceRecord;
  membership: WorkspaceMembershipRecord;
};

export interface WorkspaceRepository {
  findBySlug(slug: string): Promise<WorkspaceRecord | null>;
  createWorkspaceWithAdmin(input: CreateWorkspaceWithAdminInput): Promise<CreateWorkspaceWithAdminResult>;
}

export class WorkspaceSlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Workspace slug is already in use: ${slug}`);
    this.name = "WorkspaceSlugConflictError";
    this.slug = slug;
  }
}

export function createDbWorkspaceRepository(database: Database = defaultDb): WorkspaceRepository {
  return {
    async findBySlug(slug) {
      const [workspace] = await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1);

      return workspace ?? null;
    },

    async createWorkspaceWithAdmin(input) {
      try {
        return await database.transaction(async (transaction) => {
          const [workspace] = await transaction
            .insert(workspaces)
            .values({
              name: input.name,
              slug: input.slug,
              websiteDomain: input.websiteDomain,
              ...(input.logoAssetId ? { logoAssetId: input.logoAssetId } : {}),
            })
            .returning();

          if (!workspace) {
            throw new Error("Workspace insert did not return a row.");
          }

          const [membership] = await transaction
            .insert(workspaceMembers)
            .values({
              workspaceId: workspace.id,
              userId: input.creatorUserId,
              role: "admin",
              status: "active",
            })
            .returning();

          if (!membership) {
            throw new Error("Workspace membership insert did not return a row.");
          }

          const now = new Date();

          await transaction
            .insert(userProfiles)
            .values({
              userId: input.creatorUserId,
              lastActiveWorkspaceId: workspace.id,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: userProfiles.userId,
              set: {
                lastActiveWorkspaceId: workspace.id,
                updatedAt: now,
              },
            });

          return { workspace, membership };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new WorkspaceSlugConflictError(input.slug);
        }

        throw error;
      }
    },
  };
}

export function createMemoryWorkspaceRepository(
  initialWorkspaces: WorkspaceRecord[] = [],
): WorkspaceRepository {
  const workspaceBySlug = new Map(
    initialWorkspaces.map((workspace) => [workspace.slug, workspace]),
  );

  return {
    async findBySlug(slug) {
      return workspaceBySlug.get(slug) ?? null;
    },

    async createWorkspaceWithAdmin(input) {
      if (workspaceBySlug.has(input.slug)) {
        throw new WorkspaceSlugConflictError(input.slug);
      }

      const now = new Date();
      const workspace: WorkspaceRecord = {
        id: randomUUID(),
        name: input.name,
        slug: input.slug,
        websiteDomain: input.websiteDomain,
        logoAssetId: input.logoAssetId ?? null,
        plan: "free",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      const membership: WorkspaceMembershipRecord = {
        id: randomUUID(),
        workspaceId: workspace.id,
        userId: input.creatorUserId,
        role: "admin",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      workspaceBySlug.set(workspace.slug, workspace);

      return { workspace, membership };
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
