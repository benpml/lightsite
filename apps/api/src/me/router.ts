import {
  appBootstrapResponseSchema,
  checkEmailChangeRequestSchema,
  checkEmailChangeResponseSchema,
  completeAccountSetupRequestSchema,
  setActiveWorkspaceRequestSchema,
  siteDefaultsResponseSchema,
  updateSiteDefaultsRequestSchema,
  uploadProfileImageRequestSchema,
  uploadProfileImageResponseSchema,
} from "@handout/contracts";
import { Router } from "express";
import type { CurrentActorProvider } from "../auth/current-actor";
import {
  devActor,
  getDevAppBootstrap,
  isDevAuthBypassRequest,
  setDevProfileImageUrl,
} from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import {
  AccountSetupValidationError,
  ProfileImageUploadError,
  WorkspaceMembershipRequiredError,
  type BootstrapService,
} from "../bootstrap/service";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";

export type MeRouterOptions = {
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
};

export function createMeRouter(options: MeRouterOptions) {
  const router = Router();

  router.get("/profile-image-assets/:assetId", asyncHandler(async (request, response) => {
    const asset = await options.bootstrapService.getProfileImage(request.params.assetId ?? "");
    if (!asset) {
      response.status(404).end();
      return;
    }
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(asset.content);
  }));

  router.get("/", asyncHandler(async (request, response) => {
    if (isDevAuthBypassRequest(request)) {
      response.json(appBootstrapResponseSchema.parse({
        ...getDevAppBootstrap(),
        requestId: request.context.requestId,
      }));
      return;
    }

    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const appBootstrap = await options.bootstrapService.getBootstrap(actor);

    response.json(appBootstrapResponseSchema.parse({
      ...appBootstrap,
      requestId: request.context.requestId,
    }));
  }));

  router.patch("/profile", asyncHandler(async (request, response) => {
    if (isDevAuthBypassRequest(request)) {
      response.json(appBootstrapResponseSchema.parse({
        ...getDevAppBootstrap(),
        requestId: request.context.requestId,
      }));
      return;
    }

    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const result = completeAccountSetupRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "profile.invalid_payload",
        message: "Invalid account setup payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    let appBootstrap;

    try {
      appBootstrap = await options.bootstrapService.completeAccountSetup({
        actor,
        displayName: result.data.displayName,
      });
    } catch (error) {
      if (error instanceof AccountSetupValidationError) {
        throw new AppError({
          code: error.code,
          message: error.message,
          status: 400,
        });
      }

      throw error;
    }

    response.json(appBootstrapResponseSchema.parse({
      ...appBootstrap,
      requestId: request.context.requestId,
    }));
  }));

  router.put("/profile-image", asyncHandler(async (request, response) => {
    const actor = isDevAuthBypassRequest(request)
      ? devActor
      : await requireAuthenticatedActor(request, options.getCurrentActor);
    const result = uploadProfileImageRequestSchema.safeParse(request.body ?? {});
    if (!result.success) {
      throw new AppError({
        code: "profile.image_invalid_payload",
        message: "Choose a square PNG, JPG, or WEBP image no larger than 1 MB.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const image = await options.bootstrapService.uploadProfileImage({
        actor,
        fileName: result.data.fileName,
        contentType: result.data.contentType,
        dataBase64: result.data.dataBase64,
      });
      if (isDevAuthBypassRequest(request)) {
        setDevProfileImageUrl(image.imageUrl);
      }
      response.json(uploadProfileImageResponseSchema.parse({
        ...image,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof ProfileImageUploadError) {
        throw new AppError({
          code: "profile.image_invalid",
          message: error.message,
          status: 400,
        });
      }
      throw error;
    }
  }));

  router.put("/active-workspace", asyncHandler(async (request, response) => {
    if (isDevAuthBypassRequest(request)) {
      response.json(appBootstrapResponseSchema.parse({
        ...getDevAppBootstrap(),
        requestId: request.context.requestId,
      }));
      return;
    }

    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const result = setActiveWorkspaceRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "workspace.invalid_payload",
        message: "Invalid active workspace payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const appBootstrap = await options.bootstrapService.setActiveWorkspace({
        actor,
        workspaceId: result.data.workspaceId,
      });

      response.json(appBootstrapResponseSchema.parse({
        ...appBootstrap,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof WorkspaceMembershipRequiredError) {
        throw new AppError({
          code: "workspace.access_denied",
          message: "Workspace is not available for the current user.",
          status: 404,
        });
      }

      throw error;
    }
  }));

  router.get("/site-defaults", asyncHandler(async (request, response) => {
    const actor = isDevAuthBypassRequest(request)
      ? devActor
      : await requireAuthenticatedActor(request, options.getCurrentActor);
    const defaults = await options.bootstrapService.getSiteDefaults(actor);
    response.json(siteDefaultsResponseSchema.parse({
      defaults,
      requestId: request.context.requestId,
    }));
  }));

  router.put("/site-defaults", asyncHandler(async (request, response) => {
    const result = updateSiteDefaultsRequestSchema.safeParse(request.body ?? {});
    if (!result.success) {
      throw new AppError({
        code: "profile.invalid_payload",
        message: "Invalid site defaults payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    const actor = isDevAuthBypassRequest(request)
      ? devActor
      : await requireAuthenticatedActor(request, options.getCurrentActor);

    const defaults = await options.bootstrapService.updateSiteDefaults({
      actor,
      defaults: result.data,
    });
    response.json(siteDefaultsResponseSchema.parse({
      defaults,
      requestId: request.context.requestId,
    }));
  }));

  router.post("/email-change/check", asyncHandler(async (request, response) => {
    if (isDevAuthBypassRequest(request)) {
      response.json(checkEmailChangeResponseSchema.parse({
        available: true,
        requestId: request.context.requestId,
      }));
      return;
    }

    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const result = checkEmailChangeRequestSchema.safeParse(request.body ?? {});
    if (!result.success) {
      throw new AppError({
        code: "profile.invalid_payload",
        message: "Enter a valid email address.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    const available = await options.bootstrapService.isEmailAvailable({
      actor,
      email: result.data.email,
    });
    if (!available) {
      throw new AppError({
        code: "profile.email_in_use",
        message: "An account with this email address already exists.",
        status: 409,
      });
    }

    response.json(checkEmailChangeResponseSchema.parse({
      available: true,
      requestId: request.context.requestId,
    }));
  }));

  return router;
}
