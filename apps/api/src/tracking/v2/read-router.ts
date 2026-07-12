import { Router, type Request } from "express";
import {
  trackingV2EventsQuerySchema,
  trackingV2EventsResponseSchema,
  trackingV2EntityIdSchema,
  trackingV2SiteTrackingSettingsResponseSchema,
  trackingV2SessionIdSchema,
  trackingV2SessionResponseSchema,
  trackingV2SessionsQuerySchema,
  trackingV2SessionsResponseSchema,
  trackingV2UpdateSiteSettingsRequestSchema,
} from "@lightsite/tracking-schema";
import { getAgentAuthContext } from "../../auth/agent-auth";
import type { CurrentActor, CurrentActorProvider } from "../../auth/current-actor";
import { devActor, getDevAppBootstrap, isDevAuthBypassRequest } from "../../auth/dev-auth";
import { requireAuthenticatedActor } from "../../auth/require-authenticated-actor";
import type {
  AppBootstrap,
  BootstrapService,
  BootstrapWorkspaceSwitcherItem,
} from "../../bootstrap/service";
import { asyncHandler } from "../../http/async-handler";
import { AppError, issuesFromZodError } from "../../http/errors";
import {
  TrackingV2InvalidCursorError,
  TrackingV2UnavailableError,
  type TrackingV2ReadWorkspace,
  type TrackingV2Service,
} from "./service";

export type TrackingV2ReadRouterOptions = {
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
  trackingService: TrackingV2Service;
};

export function createTrackingV2ReadRouter(options: TrackingV2ReadRouterOptions) {
  const router = Router({ mergeParams: true });

  router.get("/events", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const parsed = trackingV2EventsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw invalidTrackingV2Query(parsed.error);
    }

    let result;

    try {
      result = await options.trackingService.listEvents({
        workspace: context.workspace,
        userId: context.actor.userId,
        query: parsed.data,
      });
    } catch (error) {
      throw mapTrackingV2ServiceError(error);
    }

    response
      .setHeader("cache-control", "no-store")
      .json(trackingV2EventsResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
  }));

  router.get("/sessions", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const parsed = trackingV2SessionsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw invalidTrackingV2Query(parsed.error);
    }

    let result;

    try {
      result = await options.trackingService.listSessions({
        workspace: context.workspace,
        userId: context.actor.userId,
        query: parsed.data,
      });
    } catch (error) {
      throw mapTrackingV2ServiceError(error);
    }

    response
      .setHeader("cache-control", "no-store")
      .json(trackingV2SessionsResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
  }));

  router.get("/sites/:siteId/settings", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const parsedSiteId = trackingV2EntityIdSchema.safeParse(request.params.siteId ?? "");

    if (!parsedSiteId.success) {
      throw invalidTrackingV2Query(parsedSiteId.error);
    }

    let result;

    try {
      result = await options.trackingService.getSiteSettings({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: parsedSiteId.data,
      });
    } catch (error) {
      throw mapTrackingV2ServiceError(error);
    }

    if (!result) {
      throw new AppError({
        code: "tracking.unavailable",
        message: "Tracking settings site was not found.",
        status: 404,
      });
    }

    response
      .setHeader("cache-control", "no-store")
      .json(trackingV2SiteTrackingSettingsResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
  }));

  router.put("/sites/:siteId/settings", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);

    if (context.workspace.role !== "admin") {
      throw new AppError({
        code: "site.permission_denied",
        message: "You do not have permission to manage tracking settings.",
        status: 403,
      });
    }

    const parsedSiteId = trackingV2EntityIdSchema.safeParse(request.params.siteId ?? "");
    const parsedBody = trackingV2UpdateSiteSettingsRequestSchema.safeParse(request.body);

    if (!parsedSiteId.success) {
      throw invalidTrackingV2Query(parsedSiteId.error);
    }

    if (!parsedBody.success) {
      throw new AppError({
        code: "tracking.invalid_payload",
        message: "Invalid tracking settings.",
        status: 400,
        issues: issuesFromZodError(parsedBody.error),
      });
    }

    let result;

    try {
      result = await options.trackingService.updateSiteSettings({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: parsedSiteId.data,
        settings: parsedBody.data,
      });
    } catch (error) {
      throw mapTrackingV2ServiceError(error);
    }

    if (!result) {
      throw new AppError({
        code: "tracking.unavailable",
        message: "Tracking settings site was not found.",
        status: 404,
      });
    }

    response
      .setHeader("cache-control", "no-store")
      .json(trackingV2SiteTrackingSettingsResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
  }));

  router.get("/sessions/:sessionId", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const parsedSessionId = trackingV2SessionIdSchema.safeParse(request.params.sessionId ?? "");

    if (!parsedSessionId.success) {
      throw invalidTrackingV2Query(parsedSessionId.error);
    }

    let result;

    try {
      result = await options.trackingService.getSession({
        workspace: context.workspace,
        userId: context.actor.userId,
        sessionId: parsedSessionId.data,
      });
    } catch (error) {
      throw mapTrackingV2ServiceError(error);
    }

    if (!result) {
      throw new AppError({
        code: "tracking.unavailable",
        message: "Tracking session was not found.",
        status: 404,
      });
    }

    response
      .setHeader("cache-control", "no-store")
      .json(trackingV2SessionResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
  }));

  router.get("/sessions/:sessionId/recording", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const manifest = await options.trackingService.getRecordingManifest({
      workspaceId: context.workspace.id,
      sessionId: request.params.sessionId ?? "",
    });

    if (!manifest) {
      throw new AppError({
        code: "tracking.unavailable",
        message: "Recording is not available.",
        status: 404,
      });
    }

    response
      .setHeader("cache-control", "no-store")
      .json({
        ...manifest,
        requestId: request.context.requestId,
      });
  }));

  router.get("/recordings/:recordingId/chunks/:sequence", asyncHandler(async (request, response) => {
    const context = await resolveTrackingV2RequestContext(request, options);
    const sequence = Number(request.params.sequence);

    if (!Number.isInteger(sequence) || sequence < 0) {
      throw new AppError({
        code: "tracking.invalid_payload",
        message: "Invalid recording chunk.",
        status: 400,
      });
    }

    const object = await options.trackingService.getRecordingChunkObject({
      workspaceId: context.workspace.id,
      recordingId: request.params.recordingId ?? "",
      sequence,
    });

    if (!object) {
      throw new AppError({
        code: "tracking.unavailable",
        message: "Recording chunk is not available.",
        status: 404,
      });
    }

    response
      .status(200)
      .setHeader("cache-control", "no-store")
      .setHeader("content-type", object.contentType)
      .send(object.body);
  }));

  return router;
}

function invalidTrackingV2Query(error: Parameters<typeof issuesFromZodError>[0]) {
  return new AppError({
    code: "tracking.invalid_payload",
    message: "Invalid tracking query.",
    status: 400,
    issues: issuesFromZodError(error),
  });
}

function mapTrackingV2ServiceError(error: unknown) {
  if (error instanceof TrackingV2InvalidCursorError) {
    return new AppError({
      code: "tracking.invalid_payload",
      message: "Invalid tracking query.",
      status: 400,
    });
  }

  if (error instanceof TrackingV2UnavailableError) {
    return new AppError({
      code: "tracking.unavailable",
      message: "Tracking data is temporarily unavailable.",
      status: 503,
    });
  }

  return error;
}

async function resolveTrackingV2RequestContext(
  request: Request,
  options: TrackingV2ReadRouterOptions,
): Promise<{
  actor: CurrentActor;
  workspace: TrackingV2ReadWorkspace;
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
