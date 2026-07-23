import {
  normalizeWebsiteDomain,
  slugifyName,
  validateTextLimit,
  validateWorkspaceSlug,
} from "@handout/domain";
import {
  WorkspaceSlugConflictError,
  type WorkspaceRecord,
  type WorkspaceRepository,
} from "./repository";
import type { TransactionalEmailSender } from "../email/transactional-email";
import { readImageDimensions } from "../uploads/image-dimensions";

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
  creatorEmail?: string;
  creatorName?: string;
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
  updateWorkspaceSettings(input: { actorUserId: string; workspaceId: string; name: string; website: string }): Promise<WorkspaceSummary>;
  uploadWorkspaceLogo(input: {
    actorUserId: string;
    workspaceId: string;
    fileName: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    dataBase64: string;
  }): Promise<{ logoAssetId: string; logoUrl: string }>;
  getWorkspaceLogo(assetId: string): Promise<{ contentType: string; content: Buffer } | null>;
}

export class WorkspaceAdminRequiredError extends Error {
  constructor() {
    super("Only workspace admins can change workspace settings.");
    this.name = "WorkspaceAdminRequiredError";
  }
}

export class WorkspaceLogoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceLogoUploadError";
  }
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

export function createWorkspaceService(
  repository: WorkspaceRepository,
  options: {
    email?: Pick<TransactionalEmailSender, "sendWelcome">;
    webOrigin?: string;
  } = {},
): WorkspaceService {
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

      const slugResult = input.slug
        ? validateWorkspaceSlug(input.slug)
        : await getAvailableWorkspaceSlug(repository, input.name);

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

      if (input.slug) {
        const existingWorkspace = await repository.findBySlug(slugResult.slug);

        if (existingWorkspace) {
          throw new WorkspaceConflictError(slugResult.slug);
        }
      }

      try {
        const result = await repository.createWorkspaceWithAdmin({
          name: nameResult.value,
          slug: slugResult.slug,
          websiteDomain: websiteResult.domain,
          ...(input.logoAssetId ? { logoAssetId: input.logoAssetId } : {}),
          creatorUserId: input.creatorUserId,
        });

        const created: CreateWorkspaceResult = {
          workspace: serializeWorkspace(result.workspace),
          membership: {
            id: result.membership.id,
            workspaceId: result.membership.workspaceId,
            userId: result.membership.userId,
            role: "admin",
            status: "active",
          },
        };

        if (options.email && input.creatorEmail) {
          void options.email.sendWelcome({
            email: input.creatorEmail,
            ...(input.creatorName ? { recipientName: input.creatorName } : {}),
            workspaceName: created.workspace.name,
            sitesUrl: `${options.webOrigin ?? "http://localhost:5173"}/sites`,
            workspaceId: created.workspace.id,
          }).catch((error) => {
            console.error("[handout email] Welcome email delivery failed", error);
          });
        }

        return created;
      } catch (error) {
        if (error instanceof WorkspaceSlugConflictError) {
          throw new WorkspaceConflictError(error.slug);
        }

        throw error;
      }
    },

    async updateWorkspaceSettings(input) {
      await requireAdmin(repository, input.actorUserId, input.workspaceId);
      const nameResult = validateTextLimit(input.name.trim(), "workspaceName", "Workspace name");
      if (!nameResult.ok || !nameResult.value.trim()) {
        throw new WorkspaceValidationError({
          code: "workspace.name_invalid",
          message: nameResult.ok ? "Workspace name is required." : nameResult.message,
        });
      }
      const websiteResult = normalizeWebsiteDomain(input.website);
      if (!websiteResult.ok) {
        throw new WorkspaceValidationError({ code: "workspace.website_invalid", message: websiteResult.message });
      }
      return serializeWorkspace(await repository.updateWorkspaceSettings({
        workspaceId: input.workspaceId,
        name: nameResult.value,
        websiteDomain: websiteResult.domain,
      }));
    },

    async uploadWorkspaceLogo(input) {
      await requireAdmin(repository, input.actorUserId, input.workspaceId);
      const content = Buffer.from(input.dataBase64, "base64");
      if (!content.byteLength || content.byteLength > 1_048_576) {
        throw new WorkspaceLogoUploadError("Choose a square image no larger than 1 MB.");
      }
      const dimensions = readImageDimensions(content, input.contentType);
      if (!dimensions || dimensions.width !== dimensions.height) {
        throw new WorkspaceLogoUploadError("Workspace logos must be square PNG, JPEG, or WebP images.");
      }
      const asset = await repository.saveWorkspaceLogo({
        workspaceId: input.workspaceId,
        fileName: input.fileName,
        contentType: input.contentType,
        width: dimensions.width,
        height: dimensions.height,
        content,
      });
      return { logoAssetId: asset.id, logoUrl: `/api/workspaces/logo-assets/${asset.id}` };
    },

    async getWorkspaceLogo(assetId) {
      return repository.findWorkspaceLogo(assetId);
    },
  };
}

async function getAvailableWorkspaceSlug(
  repository: WorkspaceRepository,
  name: string,
) {
  const normalizedName = slugifyName(name);
  let seed = normalizedName.slice(0, 64).replace(/-+$/g, "");
  let seedValidation = validateWorkspaceSlug(seed);

  if (!seedValidation.ok) {
    seed = slugifyName(`${normalizedName || "workspace"} workspace`)
      .slice(0, 64)
      .replace(/-+$/g, "");
    seedValidation = validateWorkspaceSlug(seed);
  }

  if (!seedValidation.ok) {
    return seedValidation;
  }

  for (let attempt = 1; attempt <= 1_000; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidateBase = seedValidation.slug
      .slice(0, 64 - suffix.length)
      .replace(/-+$/g, "");
    const candidate = validateWorkspaceSlug(`${candidateBase}${suffix}`);

    if (candidate.ok && await repository.findBySlug(candidate.slug) === null) {
      return candidate;
    }
  }

  throw new WorkspaceConflictError(seedValidation.slug);
}

async function requireAdmin(repository: WorkspaceRepository, actorUserId: string, workspaceId: string) {
  const membership = await repository.findActiveMembership({ workspaceId, userId: actorUserId });
  if (!membership || membership.role !== "admin") throw new WorkspaceAdminRequiredError();
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
