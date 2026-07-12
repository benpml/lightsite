import {
  appBootstrapResponseSchema,
  completeAccountSetupRequestSchema,
  setActiveWorkspaceRequestSchema,
} from "@lightsite/contracts";
import { Router } from "express";
import type { CurrentActorProvider } from "../auth/current-actor";
import { getDevAppBootstrap, isDevAuthBypassRequest } from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import {
  AccountSetupValidationError,
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

  return router;
}
