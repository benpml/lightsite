import {
  automationActionResponseSchema,
  automationActivityResponseSchema,
  automationDetailResponseSchema,
  automationDeliveryDataResponseSchema,
  automationListResponseSchema,
  automationOptionsResponseSchema,
  automationSecretResponseSchema,
  automationTestResponseSchema,
  createAutomationRequestSchema,
  updateAutomationRequestSchema,
} from "@handout/contracts";
import { Router } from "express";
import { z } from "zod";
import type { CurrentActorProvider } from "../auth/current-actor";
import { devActor, getDevAppBootstrap, isDevAuthBypassRequest } from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import type { BootstrapService } from "../bootstrap/service";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import { AutomationServiceError, type AutomationWorkspaceContext } from "./service";

type AutomationService = ReturnType<typeof import("./service").createAutomationService>;

export function createAutomationRouter(options: {
  service: AutomationService;
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
}) {
  const router = Router({ mergeParams: true });
  const stateAction = (state: "enabled" | "paused") => asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const result = await execute(() => options.service.setState(
      context.workspace,
      context.actor.userId,
      id(request.params.automationId),
      state,
    ));
    response.json(automationActionResponseSchema.parse(result));
  });

  router.get("/", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    response.json(automationListResponseSchema.parse(await options.service.list(context.workspace)));
  }));

  router.get("/options", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    response.json(automationOptionsResponseSchema.parse(await options.service.options(context.workspace)));
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const payload = createAutomationRequestSchema.safeParse(request.body ?? {});
    if (!payload.success) throw invalidPayload(payload.error);
    const result = await execute(() => options.service.create(context.workspace, context.actor.userId, payload.data));
    response.status(201).json(automationDetailResponseSchema.parse(result));
  }));

  router.get("/:automationId", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    response.json(automationDetailResponseSchema.parse(await execute(() => options.service.get(context.workspace, id(request.params.automationId)))));
  }));

  router.patch("/:automationId", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const payload = updateAutomationRequestSchema.safeParse(request.body ?? {});
    if (!payload.success) throw invalidPayload(payload.error);
    const result = await execute(() => options.service.update(context.workspace, context.actor.userId, id(request.params.automationId), payload.data));
    response.json(automationActionResponseSchema.parse(result));
  }));

  router.post("/:automationId/enable", stateAction("enabled"));
  router.post("/:automationId/pause", stateAction("paused"));

  router.post("/:automationId/test", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    response.status(202).json(automationTestResponseSchema.parse(await execute(() => options.service.test(context.workspace, id(request.params.automationId)))));
  }));

  router.get("/:automationId/activity", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const limit = z.coerce.number().int().positive().max(100).catch(50).parse(request.query.limit);
    const cursor = parseActivityCursor(request.query.cursor);
    response.json(automationActivityResponseSchema.parse(await execute(() => options.service.activity(context.workspace, id(request.params.automationId), limit, cursor))));
  }));

  router.get("/:automationId/deliveries/:deliveryId", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const result = await execute(() => options.service.deliveryData(context.workspace, id(request.params.automationId), id(request.params.deliveryId)));
    response.json(automationDeliveryDataResponseSchema.parse(result));
  }));

  router.post("/:automationId/deliveries/:deliveryId/retry", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    await execute(() => options.service.retry(context.workspace, id(request.params.automationId), id(request.params.deliveryId)));
    response.status(204).send();
  }));

  router.post("/:automationId/rotate-secret", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const result = await execute(() => options.service.rotateSecret(context.workspace, context.actor.userId, id(request.params.automationId)));
    response.json(automationSecretResponseSchema.parse(result));
  }));

  router.delete("/:automationId", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    await execute(() => options.service.remove(context.workspace, id(request.params.automationId)));
    response.status(204).send();
  }));

  return router;
}

async function resolveContext(request: Parameters<Parameters<typeof asyncHandler>[0]>[0], options: Parameters<typeof createAutomationRouter>[0]) {
  const development = isDevAuthBypassRequest(request);
  const actor = development ? devActor : await requireAuthenticatedActor(request, options.getCurrentActor);
  const workspaceId = id(request.params.workspaceId);
  const bootstrap = development ? getDevAppBootstrap() : await options.bootstrapService.getBootstrap(actor);
  const membership = bootstrap.workspaces.find((workspace) => workspace.id === workspaceId);
  if (!membership) throw new AppError({ code: "workspace.access_denied", message: "You do not have access to this workspace.", status: 403 });
  const workspace: AutomationWorkspaceContext = { id: membership.id, plan: membership.plan, role: membership.role };
  return { actor, workspace };
}

function id(value: unknown) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw invalidPayload(parsed.error);
  return parsed.data;
}

function parseActivityCursor(value: unknown) {
  if (value === undefined) return undefined;
  const parsed = z.string().max(200).safeParse(value);
  if (!parsed.success) throw invalidPayload(parsed.error);
  const [dateValue, idValue, ...extra] = parsed.data.split("|");
  const date = z.iso.datetime().safeParse(dateValue);
  const deliveryId = z.uuid().safeParse(idValue);
  if (!date.success || !deliveryId.success || extra.length) {
    throw new AppError({ code: "automation.invalid_payload", message: "The activity cursor is invalid.", status: 400 });
  }
  return { createdAt: new Date(date.data), id: deliveryId.data };
}

function invalidPayload(error: z.ZodError) {
  return new AppError({ code: "automation.invalid_payload", message: "Check the automation details and try again.", status: 400, issues: issuesFromZodError(error) });
}

async function execute<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    if (!(error instanceof AutomationServiceError)) throw error;
    const mapping = {
      admin_required: { code: "automation.admin_required" as const, status: 403 },
      invalid_destination: { code: "automation.invalid_destination" as const, status: 400 },
      limit_reached: { code: "automation.limit_reached" as const, status: 403 },
      not_found: { code: "automation.not_found" as const, status: 404 },
      test_required: { code: "automation.test_required" as const, status: 409 },
      upgrade_required: { code: "billing.upgrade_required" as const, status: 403 },
      unavailable: { code: "automation.unavailable" as const, status: 503 },
    }[error.code];
    throw new AppError({ code: mapping.code, message: error.message, status: mapping.status });
  }
}
