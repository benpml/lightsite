import {
  createWorkspaceRequestSchema,
  createWorkspaceResponseSchema,
  updateWorkspaceSettingsRequestSchema,
  updateWorkspaceSettingsResponseSchema,
  uploadWorkspaceLogoRequestSchema,
  uploadWorkspaceLogoResponseSchema,
  workspaceLogoPreviewImageQuerySchema,
  workspaceLogoPreviewQuerySchema,
  workspaceLogoPreviewResponseSchema,
  workspaceSlugAvailabilityResponseSchema,
} from "@handout/contracts";
import { Router } from "express";
import { z } from "zod";
import type { CurrentActorProvider } from "../auth/current-actor";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import {
  WorkspaceLogoPreviewDisabledError,
  WorkspaceLogoValidationError,
  type WorkspaceLogoPreviewService,
} from "./logo-preview";
import {
  WorkspaceConflictError,
  WorkspaceAdminRequiredError,
  WorkspaceLogoUploadError,
  WorkspaceValidationError,
  type WorkspaceService,
} from "./service";

export type WorkspaceRouterOptions = {
  logoPreviewService: WorkspaceLogoPreviewService;
  workspaceService: WorkspaceService;
  getCurrentActor: CurrentActorProvider;
};

const slugAvailabilitySchema = z.object({
  slug: z.string().trim().min(1).max(128),
});

export function createWorkspaceRouter(options: WorkspaceRouterOptions) {
  const router = Router();

  router.get("/slug-availability", asyncHandler(async (request, response) => {
    const result = slugAvailabilitySchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError({
        code: "workspace.invalid_payload",
        message: "Invalid workspace slug availability payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    const availability = await options.workspaceService.getSlugAvailability(result.data.slug);

    if (!availability.ok) {
      throw new AppError({
        code: "slug.invalid",
        message: availability.message,
        status: 400,
      });
    }

    response.json(workspaceSlugAvailabilityResponseSchema.parse({
      slug: availability.slug,
      available: availability.available,
      requestId: request.context.requestId,
    }));
  }));

  router.get("/logo-assets/:assetId", asyncHandler(async (request, response) => {
    const assetId = z.uuid().safeParse(request.params.assetId);
    if (!assetId.success) {
      throw new AppError({ code: "route.not_found", message: "Logo was not found.", status: 404 });
    }
    const asset = await options.workspaceService.getWorkspaceLogo(assetId.data);
    if (!asset) {
      throw new AppError({ code: "route.not_found", message: "Logo was not found.", status: 404 });
    }
    response.setHeader("cache-control", "public, max-age=31536000, immutable");
    response.type(asset.contentType).send(asset.content);
  }));

  router.get("/logo-preview", asyncHandler(async (request, response) => {
    await requireAuthenticatedActor(request, options.getCurrentActor);

    const result = workspaceLogoPreviewQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError({
        code: "logo_preview.invalid_payload",
        message: "Invalid workspace logo preview payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const preview = await options.logoPreviewService.getPreview(result.data);

      response.json(workspaceLogoPreviewResponseSchema.parse({
        ...preview,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof WorkspaceLogoValidationError) {
        throw new AppError({
          code: "workspace.website_invalid",
          message: error.message,
          status: 400,
        });
      }

      throw error;
    }
  }));

  router.get("/logo-preview/image", asyncHandler(async (request, response) => {
    await requireAuthenticatedActor(request, options.getCurrentActor);

    const result = workspaceLogoPreviewImageQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw new AppError({
        code: "logo_preview.invalid_payload",
        message: "Invalid workspace logo preview image payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const image = await options.logoPreviewService.fetchImage(result.data);

      if (!image) {
        throw new AppError({
          code: "logo_preview.not_found",
          message: "Workspace logo preview image was not found.",
          status: 404,
        });
      }

      response
        .setHeader("cache-control", image.cacheControl)
        .type(image.contentType)
        .send(Buffer.from(image.body));
    } catch (error) {
      if (error instanceof WorkspaceLogoValidationError) {
        throw new AppError({
          code: "workspace.website_invalid",
          message: error.message,
          status: 400,
        });
      }

      if (error instanceof WorkspaceLogoPreviewDisabledError) {
        throw new AppError({
          code: "logo_preview.disabled",
          message: "Workspace logo preview is disabled.",
          status: 404,
        });
      }

      throw error;
    }
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(
      request,
      options.getCurrentActor,
      "Sign in to create a workspace.",
    );

    const result = createWorkspaceRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "workspace.invalid_payload",
        message: "Invalid workspace payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const created = await options.workspaceService.createWorkspace({
        name: result.data.name,
        slug: result.data.slug || undefined,
        website: result.data.website,
        ...(result.data.logoAssetId ? { logoAssetId: result.data.logoAssetId } : {}),
        creatorUserId: actor.userId,
        creatorEmail: actor.email,
        ...(actor.name ? { creatorName: actor.name } : {}),
      });
      if (!result.data.logoAssetId) {
        const detectedLogo = await persistDetectedWorkspaceLogo({
          actorUserId: actor.userId,
          domain: created.workspace.websiteDomain,
          logoPreviewService: options.logoPreviewService,
          workspaceId: created.workspace.id,
          workspaceService: options.workspaceService,
        });
        if (detectedLogo) {
          created.workspace.logoAssetId = detectedLogo.logoAssetId;
        }
      }

      response.status(201).json(createWorkspaceResponseSchema.parse({
        ...created,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof WorkspaceValidationError) {
        throw new AppError({
          code: error.code === "workspace.slug_invalid" ? "slug.invalid" : error.code,
          message: error.message,
          status: 400,
        });
      }

      if (error instanceof WorkspaceConflictError) {
        throw new AppError({
          code: "workspace.slug_unavailable",
          message: "Workspace slug is already taken.",
          status: 409,
        });
      }

      throw error;
    }
  }));

  router.patch("/:workspaceId", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const workspaceId = z.uuid().safeParse(request.params.workspaceId);
    const payload = updateWorkspaceSettingsRequestSchema.safeParse(request.body ?? {});
    if (!workspaceId.success || !payload.success) {
      throw new AppError({
        code: "workspace.invalid_payload",
        message: "Invalid workspace settings payload.",
        status: 400,
        ...(!payload.success ? { issues: issuesFromZodError(payload.error) } : {}),
      });
    }
    try {
      const workspace = await options.workspaceService.updateWorkspaceSettings({
        actorUserId: actor.userId,
        workspaceId: workspaceId.data,
        name: payload.data.name,
        website: payload.data.website,
      });
      response.json(updateWorkspaceSettingsResponseSchema.parse({
        workspace,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof WorkspaceAdminRequiredError) {
        throw new AppError({ code: "workspace.access_denied", message: error.message, status: 403 });
      }
      if (error instanceof WorkspaceValidationError) {
        throw new AppError({
          code: error.code === "workspace.slug_invalid" ? "slug.invalid" : error.code,
          message: error.message,
          status: 400,
        });
      }
      throw error;
    }
  }));

  router.put("/:workspaceId/logo", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const workspaceId = z.uuid().safeParse(request.params.workspaceId);
    const payload = uploadWorkspaceLogoRequestSchema.safeParse(request.body ?? {});
    if (!workspaceId.success || !payload.success) {
      throw new AppError({
        code: "workspace.invalid_payload",
        message: "Invalid workspace logo payload.",
        status: 400,
        ...(!payload.success ? { issues: issuesFromZodError(payload.error) } : {}),
      });
    }
    try {
      const logo = await options.workspaceService.uploadWorkspaceLogo({
        actorUserId: actor.userId,
        workspaceId: workspaceId.data,
        ...payload.data,
      });
      response.json(uploadWorkspaceLogoResponseSchema.parse({
        ...logo,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof WorkspaceAdminRequiredError) {
        throw new AppError({ code: "workspace.access_denied", message: error.message, status: 403 });
      }
      if (error instanceof WorkspaceLogoUploadError) {
        throw new AppError({ code: "workspace.invalid_payload", message: error.message, status: 400 });
      }
      throw error;
    }
  }));

  return router;
}

async function persistDetectedWorkspaceLogo(input: {
  actorUserId: string;
  domain: string;
  logoPreviewService: WorkspaceLogoPreviewService;
  workspaceId: string;
  workspaceService: WorkspaceService;
}) {
  try {
    const image = await input.logoPreviewService.fetchImage({
      domain: input.domain,
      size: 256,
      theme: "light",
    });
    if (!image) return null;

    const contentType = normalizeLogoContentType(image.contentType);
    if (!contentType) return null;

    return await input.workspaceService.uploadWorkspaceLogo({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      fileName: `${input.domain}-logo.${contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1]}`,
      contentType,
      dataBase64: Buffer.from(image.body).toString("base64"),
    });
  } catch {
    return null;
  }
}

function normalizeLogoContentType(contentType: string) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  return normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/webp"
    ? normalized
    : null;
}
