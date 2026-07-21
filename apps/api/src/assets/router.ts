import { Router } from "express";
import { z } from "zod";
import type { BootstrapService } from "../bootstrap/service";
import type { CurrentActorProvider } from "../auth/current-actor";
import { devActor, getDevAppBootstrap, isDevAuthBypassRequest } from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import { WorkspaceAssetValidationError, type WorkspaceAssetService } from "./service";

const purposeSchema = z.enum(["image", "logo", "og_image", "avatar"]);
const importSchema = z.object({
  purpose: purposeSchema.default("image"),
  fileName: z.string().trim().min(1).max(255).optional(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.url().max(2_048) }),
    z.object({
      kind: z.literal("base64"),
      contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      dataBase64: z.string().min(1).max(7_000_000),
    }),
  ]),
});

export function createWorkspaceAssetRouter(options: {
  assetService: WorkspaceAssetService;
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
}) {
  const router = Router({ mergeParams: true });
  router.get("/", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const purpose = purposeSchema.optional().safeParse(request.query.purpose);
    if (!purpose.success) throw invalidPayload(purpose.error);
    const search = z.string().trim().max(160).optional().safeParse(request.query.search);
    if (!search.success) throw invalidPayload(search.error);
    response.json({
      ...await options.assetService.list({
        workspaceId: context.workspaceId,
        ...(purpose.data ? { purpose: purpose.data } : {}),
        ...(search.data ? { search: search.data } : {}),
      }),
      requestId: request.context.requestId,
    });
  }));
  router.post("/import", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const parsed = importSchema.safeParse(request.body ?? {});
    if (!parsed.success) throw invalidPayload(parsed.error);
    try {
      response.status(201).json({
        ...await options.assetService.import({ workspaceId: context.workspaceId, userId: context.userId, ...parsed.data }),
        requestId: request.context.requestId,
      });
    } catch (error) {
      if (error instanceof WorkspaceAssetValidationError) {
        throw new AppError({ code: "asset.invalid", message: error.message, status: 400 });
      }
      throw error;
    }
  }));
  router.delete("/:assetId", asyncHandler(async (request, response) => {
    const context = await resolveContext(request, options);
    const assetId = z.uuid().safeParse(request.params.assetId);
    if (!assetId.success) throw invalidPayload(assetId.error);
    const removed = await options.assetService.remove({ workspaceId: context.workspaceId, assetId: assetId.data });
    if (!removed) throw new AppError({ code: "asset.not_found", message: "Asset was not found in this workspace.", status: 404 });
    response.status(204).send();
  }));
  return router;
}

export function createPublicAssetRouter(options: { assetService: WorkspaceAssetService }) {
  const router = Router();
  router.get("/:assetId", asyncHandler(async (request, response) => {
    const assetId = z.uuid().safeParse(request.params.assetId);
    if (!assetId.success) {
      response.status(404).end();
      return;
    }
    const asset = await options.assetService.getContent(assetId.data);
    if (!asset) {
      response.status(404).end();
      return;
    }
    response.setHeader("content-type", asset.contentType);
    response.setHeader("cache-control", "public, max-age=31536000, immutable");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(asset.content);
  }));
  return router;
}

async function resolveContext(
  request: Parameters<Parameters<typeof asyncHandler>[0]>[0],
  options: { bootstrapService: BootstrapService; getCurrentActor: CurrentActorProvider },
) {
  const actor = isDevAuthBypassRequest(request) ? devActor : await requireAuthenticatedActor(request, options.getCurrentActor);
  const bootstrap = isDevAuthBypassRequest(request) ? getDevAppBootstrap() : await options.bootstrapService.getBootstrap(actor);
  const workspaceId = z.uuid().safeParse(request.params.workspaceId);
  if (!workspaceId.success) throw invalidPayload(workspaceId.error);
  const membership = bootstrap.workspaces.find((workspace) => workspace.id === workspaceId.data);
  if (!membership) throw new AppError({ code: "workspace.access_denied", message: "You do not have access to this workspace.", status: 403 });
  return { userId: actor.userId, workspaceId: membership.id };
}

function invalidPayload(error: z.ZodError) {
  return new AppError({ code: "asset.invalid_payload", message: "Check the asset details and try again.", status: 400, issues: issuesFromZodError(error) });
}
