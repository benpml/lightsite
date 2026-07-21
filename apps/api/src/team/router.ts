import {
  createWorkspaceInvitationRequestSchema,
  createWorkspaceInvitationResponseSchema,
  updateWorkspaceMemberRequestSchema,
  updateWorkspaceMemberResponseSchema,
  workspaceTeamResponseSchema,
} from "@handout/contracts";
import { Router } from "express";
import { z } from "zod";
import type { CurrentActorProvider } from "../auth/current-actor";
import type { BillingService } from "../billing/service";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import {
  TeamAccessDeniedError,
  TeamAdminRequiredError,
  TeamInvitationNotFoundError,
  TeamInvitationValidationError,
  TeamMemberConflictError,
  TeamMemberNotFoundError,
  type TeamService,
} from "./service";

export type TeamRouterOptions = {
  teamService: TeamService;
  getCurrentActor: CurrentActorProvider;
  billingService?: BillingService;
};

const idParamsSchema = z.object({
  workspaceId: z.uuid(),
  id: z.uuid(),
});

const workspaceParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export function createTeamRouter(options: TeamRouterOptions) {
  const router = Router({ mergeParams: true });

  router.get("/", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const team = await executeTeamAction(() => options.teamService.getTeam({ actor, workspaceId }));

    response.json(workspaceTeamResponseSchema.parse({
      ...team,
      requestId: request.context.requestId,
    }));
  }));

  router.post("/invitations", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const { workspaceId } = parseWorkspaceParams(request.params);
    const payload = createWorkspaceInvitationRequestSchema.safeParse(request.body ?? {});

    if (!payload.success) {
      throw new AppError({
        code: "team.invalid_payload",
        message: "Invalid team invitation payload.",
        status: 400,
        issues: issuesFromZodError(payload.error),
      });
    }

    const result = await executeTeamAction(() => options.teamService.invite({
      actor,
      workspaceId,
      email: payload.data.email,
      role: payload.data.role,
    }));
    await options.billingService?.syncSeatCount(workspaceId);

    response.status(201).json(createWorkspaceInvitationResponseSchema.parse({
      result,
      requestId: request.context.requestId,
    }));
  }));

  router.patch("/members/:id", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const { workspaceId, id } = parseIdParams(request.params);
    const payload = updateWorkspaceMemberRequestSchema.safeParse(request.body ?? {});

    if (!payload.success) {
      throw new AppError({
        code: "team.invalid_payload",
        message: "Invalid team member payload.",
        status: 400,
        issues: issuesFromZodError(payload.error),
      });
    }

    const member = await executeTeamAction(() => options.teamService.updateMemberRole({
      actor,
      workspaceId,
      memberId: id,
      role: payload.data.role,
    }));

    response.json(updateWorkspaceMemberResponseSchema.parse({
      member,
      requestId: request.context.requestId,
    }));
  }));

  router.delete("/members/:id", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const { workspaceId, id } = parseIdParams(request.params);
    await executeTeamAction(() => options.teamService.removeMember({
      actor,
      workspaceId,
      memberId: id,
    }));
    await options.billingService?.syncSeatCount(workspaceId);
    response.status(204).send();
  }));

  router.delete("/invitations/:id", asyncHandler(async (request, response) => {
    const actor = await requireAuthenticatedActor(request, options.getCurrentActor);
    const { workspaceId, id } = parseIdParams(request.params);
    await executeTeamAction(() => options.teamService.revokeInvitation({
      actor,
      workspaceId,
      invitationId: id,
    }));
    await options.billingService?.syncSeatCount(workspaceId);
    response.status(204).send();
  }));

  return router;
}

function parseWorkspaceParams(params: unknown) {
  const parsed = workspaceParamsSchema.safeParse(params);
  if (!parsed.success) throw invalidParamsError(parsed.error);
  return parsed.data;
}

function parseIdParams(params: unknown) {
  const parsed = idParamsSchema.safeParse(params);
  if (!parsed.success) throw invalidParamsError(parsed.error);
  return parsed.data;
}

function invalidParamsError(error: z.ZodError) {
  return new AppError({
    code: "team.invalid_payload",
    message: "Invalid team route parameters.",
    status: 400,
    issues: issuesFromZodError(error),
  });
}

async function executeTeamAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof TeamAccessDeniedError) {
      throw new AppError({ code: "workspace.access_denied", message: error.message, status: 403 });
    }
    if (error instanceof TeamAdminRequiredError) {
      throw new AppError({ code: "team.admin_required", message: error.message, status: 403 });
    }
    if (error instanceof TeamMemberNotFoundError || error instanceof TeamInvitationNotFoundError) {
      throw new AppError({ code: "team.not_found", message: error.message, status: 404 });
    }
    if (error instanceof TeamMemberConflictError) {
      throw new AppError({ code: "team.conflict", message: error.message, status: 409 });
    }
    if (error instanceof TeamInvitationValidationError) {
      throw new AppError({
        code: "team.invalid_email",
        message: error.message,
        status: 400,
        issues: [{ path: ["email"], message: error.message }],
      });
    }
    throw error;
  }
}
