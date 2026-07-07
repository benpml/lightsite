import {
  trackingEventsQuerySchema,
  trackingEventsResponseSchema,
  trackingSummaryQuerySchema,
  trackingSummaryResponseSchema,
} from "@lightsite/contracts";
import { Router, type Request } from "express";
import { getAgentAuthContext } from "../auth/agent-auth";
import type { CurrentActor, CurrentActorProvider } from "../auth/current-actor";
import { devActor, getDevAppBootstrap, isDevAuthBypassRequest } from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import type {
  AppBootstrap,
  BootstrapService,
  BootstrapWorkspaceSwitcherItem,
} from "../bootstrap/service";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import {
  InvalidTrackingCursorError,
  TrackingUnavailableError,
  type TrackingService,
  type TrackingServiceWorkspace,
} from "./service";

export type TrackingReadRouterOptions = {
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
  trackingService: TrackingService;
};

export function createTrackingReadRouter(options: TrackingReadRouterOptions) {
  const router = Router({ mergeParams: true });

  router.get("/events", asyncHandler(async (request, response) => {
    const context = await resolveTrackingRequestContext(request, options);
    const parsed = trackingEventsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw new AppError({
        code: "tracking.invalid_payload",
        message: "Invalid tracking query.",
        status: 400,
        issues: issuesFromZodError(parsed.error),
      });
    }

    let result;

    try {
      result = await options.trackingService.listEvents({
        workspace: context.workspace,
        userId: context.actor.userId,
        query: parsed.data,
      });
    } catch (error) {
      throw mapTrackingServiceError(error);
    }

    response.json(trackingEventsResponseSchema.parse({
      ...result,
      requestId: request.context.requestId,
    }));
  }));

  router.get("/summary", asyncHandler(async (request, response) => {
    const context = await resolveTrackingRequestContext(request, options);
    const parsed = trackingSummaryQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw new AppError({
        code: "tracking.invalid_payload",
        message: "Invalid tracking query.",
        status: 400,
        issues: issuesFromZodError(parsed.error),
      });
    }

    let result;

    try {
      result = await options.trackingService.getSummary({
        workspace: context.workspace,
        userId: context.actor.userId,
        query: parsed.data,
      });
    } catch (error) {
      throw mapTrackingServiceError(error);
    }

    response.json(trackingSummaryResponseSchema.parse({
      ...result,
      requestId: request.context.requestId,
    }));
  }));

  return router;
}

function mapTrackingServiceError(error: unknown) {
  if (error instanceof InvalidTrackingCursorError) {
    return new AppError({
      code: "tracking.invalid_payload",
      message: "Invalid tracking query.",
      status: 400,
    });
  }

  if (error instanceof TrackingUnavailableError) {
    return new AppError({
      code: "tracking.unavailable",
      message: "Tracking data is temporarily unavailable.",
      status: 503,
    });
  }

  return error;
}

async function resolveTrackingRequestContext(
  request: Request,
  options: TrackingReadRouterOptions,
): Promise<{
  actor: CurrentActor;
  workspace: TrackingServiceWorkspace;
}> {
  const agentContext = getAgentAuthContext(request);

  if (agentContext && agentContext.workspace.id === request.params.workspaceId) {
    return agentContext;
  }

  const isDevRequest = isDevAuthBypassRequest(request);
  const actor = isDevRequest
    ? devActor
    : await requireAuthenticatedActor(request, options.getCurrentActor);
  const bootstrap = isDevRequest
    ? getDevAppBootstrap()
    : await options.bootstrapService.getBootstrap(actor);
  const activeWorkspace = getActiveWorkspace(bootstrap);
  const requestedWorkspaceId = request.params.workspaceId ?? "";

  if (!activeWorkspace || activeWorkspace.id !== requestedWorkspaceId) {
    throw new AppError({
      code: "workspace.access_denied",
      message: "Workspace is not available for the current user.",
      status: 404,
    });
  }

  return {
    actor,
    workspace: {
      id: activeWorkspace.id,
      role: activeWorkspace.role,
    },
  };
}

function getActiveWorkspace(
  bootstrap: AppBootstrap,
): BootstrapWorkspaceSwitcherItem | null {
  return bootstrap.activeWorkspace;
}
