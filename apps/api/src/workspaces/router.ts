import {
  createWorkspaceRequestSchema,
  createWorkspaceResponseSchema,
  workspaceLogoPreviewImageQuerySchema,
  workspaceLogoPreviewQuerySchema,
  workspaceLogoPreviewResponseSchema,
  workspaceSlugAvailabilityResponseSchema,
} from "@lightsite/contracts";
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
      });

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

  return router;
}
