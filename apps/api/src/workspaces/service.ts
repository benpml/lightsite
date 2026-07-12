import {
  normalizeWebsiteDomain,
  slugifyName,
  validateTextLimit,
  validateWorkspaceSlug,
} from "@lightsite/domain";
import {
  WorkspaceSlugConflictError,
  type WorkspaceRecord,
  type WorkspaceRepository,
} from "./repository";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  websiteDomain: string;
  logoAssetId: string | null;
  plan: "free" | "core" | "pro";
  status: "active" | "suspended" | "scheduled_for_deletion" | "deleted";
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSlugAvailability =
  | { ok: true; slug: string; available: boolean }
  | { ok: false; code: string; message: string };

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  website: string;
  logoAssetId?: string;
  creatorUserId: string;
};

export type CreateWorkspaceResult = {
  workspace: WorkspaceSummary;
  membership: {
    id: string;
    workspaceId: string;
    userId: string;
    role: "admin";
    status: "active";
  };
};

export interface WorkspaceService {
  getSlugAvailability(slug: string): Promise<WorkspaceSlugAvailability>;
  createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult>;
}

export class WorkspaceValidationError extends Error {
  readonly code: "workspace.name_invalid" | "workspace.slug_invalid" | "workspace.website_invalid";

  constructor(input: { code: WorkspaceValidationError["code"]; message: string }) {
    super(input.message);
    this.name = "WorkspaceValidationError";
    this.code = input.code;
  }
}

export class WorkspaceConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super("Workspace slug is already taken.");
    this.name = "WorkspaceConflictError";
    this.slug = slug;
  }
}

export function createWorkspaceService(repository: WorkspaceRepository): WorkspaceService {
  return {
    async getSlugAvailability(rawSlug) {
      const slugResult = validateWorkspaceSlug(rawSlug);

      if (!slugResult.ok) {
        return {
          ok: false,
          code: slugResult.code,
          message: slugResult.message,
        };
      }

      const existingWorkspace = await repository.findBySlug(slugResult.slug);

      return {
        ok: true,
        slug: slugResult.slug,
        available: existingWorkspace === null,
      };
    },

    async createWorkspace(input) {
      const nameResult = validateTextLimit(input.name.trim(), "workspaceName", "Workspace name");

      if (!nameResult.ok || !nameResult.value.trim()) {
        throw new WorkspaceValidationError({
          code: "workspace.name_invalid",
          message: nameResult.ok ? "Workspace name is required." : nameResult.message,
        });
      }

      const slugResult = validateWorkspaceSlug(input.slug ?? slugifyName(input.name));

      if (!slugResult.ok) {
        throw new WorkspaceValidationError({
          code: "workspace.slug_invalid",
          message: slugResult.message,
        });
      }

      const websiteResult = normalizeWebsiteDomain(input.website);

      if (!websiteResult.ok) {
        throw new WorkspaceValidationError({
          code: "workspace.website_invalid",
          message: websiteResult.message,
        });
      }

      const existingWorkspace = await repository.findBySlug(slugResult.slug);

      if (existingWorkspace) {
        throw new WorkspaceConflictError(slugResult.slug);
      }

      try {
        const result = await repository.createWorkspaceWithAdmin({
          name: nameResult.value,
          slug: slugResult.slug,
          websiteDomain: websiteResult.domain,
          ...(input.logoAssetId ? { logoAssetId: input.logoAssetId } : {}),
          creatorUserId: input.creatorUserId,
        });

        return {
          workspace: serializeWorkspace(result.workspace),
          membership: {
            id: result.membership.id,
            workspaceId: result.membership.workspaceId,
            userId: result.membership.userId,
            role: "admin",
            status: "active",
          },
        };
      } catch (error) {
        if (error instanceof WorkspaceSlugConflictError) {
          throw new WorkspaceConflictError(error.slug);
        }

        throw error;
      }
    },
  };
}

function serializeWorkspace(workspace: WorkspaceRecord): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    websiteDomain: workspace.websiteDomain ?? "",
    logoAssetId: workspace.logoAssetId,
    plan: workspace.plan,
    status: workspace.status,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}
