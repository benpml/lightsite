import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import {
  db as defaultDb,
  userProfiles,
  workspaceMembers,
  workspaceLogoAssets,
  workspaces,
  type Database,
} from "@handout/db";

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
  findActiveMembership(input: { workspaceId: string; userId: string }): Promise<WorkspaceMembershipRecord | null>;
  updateWorkspaceSettings(input: { workspaceId: string; name: string; websiteDomain: string }): Promise<WorkspaceRecord>;
  saveWorkspaceLogo(input: {
    workspaceId: string;
    fileName: string;
    contentType: string;
    width: number;
    height: number;
    content: Buffer;
  }): Promise<{ id: string }>;
  findWorkspaceLogo(assetId: string): Promise<{ contentType: string; content: Buffer } | null>;
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

    async findActiveMembership(input) {
      const [membership] = await database
        .select()
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, input.userId),
          eq(workspaceMembers.status, "active"),
        ))
        .limit(1);
      return membership ?? null;
    },

    async updateWorkspaceSettings(input) {
      const [workspace] = await database
        .update(workspaces)
        .set({
          name: input.name,
          websiteDomain: input.websiteDomain,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, input.workspaceId))
        .returning();
      if (!workspace) throw new Error("Workspace was not found.");
      return workspace;
    },

    async saveWorkspaceLogo(input) {
      return database.transaction(async (transaction) => {
        const [workspace] = await transaction
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, input.workspaceId))
          .for("update")
          .limit(1);
        if (!workspace) throw new Error("Workspace was not found.");
        const [asset] = await transaction
          .insert(workspaceLogoAssets)
          .values({
            workspaceId: input.workspaceId,
            fileName: input.fileName,
            contentType: input.contentType,
            byteSize: input.content.byteLength,
            width: input.width,
            height: input.height,
            content: input.content,
          })
          .returning({ id: workspaceLogoAssets.id });
        if (!asset) throw new Error("Workspace logo insert did not return a row.");
        await transaction
          .update(workspaces)
          .set({ logoAssetId: asset.id, updatedAt: new Date() })
          .where(eq(workspaces.id, input.workspaceId));
        await transaction
          .delete(workspaceLogoAssets)
          .where(and(
            eq(workspaceLogoAssets.workspaceId, input.workspaceId),
            ne(workspaceLogoAssets.id, asset.id),
          ));
        return asset;
      });
    },

    async findWorkspaceLogo(assetId) {
      const [asset] = await database
        .select({ contentType: workspaceLogoAssets.contentType, content: workspaceLogoAssets.content })
        .from(workspaceLogoAssets)
        .where(eq(workspaceLogoAssets.id, assetId))
        .limit(1);
      return asset ? { contentType: asset.contentType, content: Buffer.from(asset.content) } : null;
    },
  };
}

export function createMemoryWorkspaceRepository(
  initialWorkspaces: WorkspaceRecord[] = [],
): WorkspaceRepository {
  const workspaceBySlug = new Map(
    initialWorkspaces.map((workspace) => [workspace.slug, workspace]),
  );
  const memberships: WorkspaceMembershipRecord[] = [];
  const logoAssets = new Map<string, { contentType: string; content: Buffer }>();

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
      memberships.push(membership);

      return { workspace, membership };
    },

    async findActiveMembership(input) {
      return memberships.find((membership) =>
        membership.workspaceId === input.workspaceId &&
        membership.userId === input.userId &&
        membership.status === "active"
      ) ?? null;
    },

    async updateWorkspaceSettings(input) {
      const workspace = [...workspaceBySlug.values()].find((item) => item.id === input.workspaceId);
      if (!workspace) throw new Error("Workspace was not found.");
      const updated = { ...workspace, name: input.name, websiteDomain: input.websiteDomain, updatedAt: new Date() };
      workspaceBySlug.set(updated.slug, updated);
      return updated;
    },

    async saveWorkspaceLogo(input) {
      const workspace = [...workspaceBySlug.values()].find((item) => item.id === input.workspaceId);
      if (!workspace) throw new Error("Workspace was not found.");
      const id = randomUUID();
      logoAssets.set(id, { contentType: input.contentType, content: input.content });
      workspaceBySlug.set(workspace.slug, { ...workspace, logoAssetId: id, updatedAt: new Date() });
      return { id };
    },

    async findWorkspaceLogo(assetId) {
      return logoAssets.get(assetId) ?? null;
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
