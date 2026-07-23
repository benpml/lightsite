import {
  batchUpsertSiteVariantsRequestSchema,
  batchUpsertSiteVariantsResponseSchema,
  createSiteRequestSchema,
  createSiteResponseSchema,
  duplicateSiteResponseSchema,
  listSiteVariantsResponseSchema,
  listSiteVersionsResponseSchema,
  listSitesResponseSchema,
  publishSiteResponseSchema,
  restoreSiteVersionResponseSchema,
  siteContentResponseSchema,
  siteDetailResponseSchema,
  unpublishSiteResponseSchema,
  updateSiteContentRequestSchema,
  updateSiteContentResponseSchema,
  updateSiteRequestSchema,
  validateSiteContentRequestSchema,
  validateSiteContentResponseSchema,
} from "@handout/contracts";
import { Router, type Request } from "express";
import { z } from "zod";
import { analyzeSiteContentSafety } from "@handout/site-document";
import { getAgentAuthContext } from "../auth/agent-auth";
import type { CurrentActor, CurrentActorProvider } from "../auth/current-actor";
import { devActor, getDevAppBootstrap, isDevAuthBypassRequest } from "../auth/dev-auth";
import { requireAuthenticatedActor } from "../auth/require-authenticated-actor";
import type {
  AppBootstrap,
  BootstrapWorkspaceSwitcherItem,
  BootstrapService,
} from "../bootstrap/service";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import {
  SiteConflictError,
  SiteArchivedError,
  SiteDraftRevisionConflictError,
  SiteNotFoundError,
  SitePlanLimitError,
  SitePermissionError,
  SitePublishPlanError,
  SitePublishValidationError,
  SitePublishedSlugChangeError,
  SiteVariantConflictError,
  SiteVersionNotFoundError,
  SiteValidationError,
  type SiteService,
  type SiteWorkspaceContext,
} from "./service";

export type SiteRouterOptions = {
  bootstrapService: BootstrapService;
  devSiteService?: SiteService;
  getCurrentActor: CurrentActorProvider;
  siteService: SiteService;
};

export function createSiteRouter(options: SiteRouterOptions) {
  const router = Router();

  router.get("/", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    const status = z.enum(["active", "archived", "all"]).default("active").safeParse(request.query.status);
    if (!status.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Site status filter must be active, archived, or all.",
        status: 400,
        issues: issuesFromZodError(status.error),
      });
    }
    const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(request.query.limit);
    const cursor = z.coerce.number().int().min(0).max(1_000_000).default(0).safeParse(request.query.cursor);
    const paginationError = !limit.success ? limit.error : !cursor.success ? cursor.error : null;
    if (paginationError) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Site pagination requires a limit from 1 to 100 and a non-negative numeric cursor.",
        status: 400,
        issues: issuesFromZodError(paginationError),
      });
    }
    const result = await context.siteService.listSites({
      workspace: context.workspace,
      userId: context.actor.userId,
      status: status.data,
      limit: limit.data,
      cursor: cursor.data,
    });

    response.json(listSitesResponseSchema.parse({
      ...result,
      requestId: request.context.requestId,
    }));
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    const result = createSiteRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Invalid site payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const created = await context.siteService.createSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        name: result.data.name,
        ...(result.data.slug ? { slug: result.data.slug } : {}),
      });

      response.status(201).json(createSiteResponseSchema.parse({
        ...created,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof SiteValidationError) {
        throw new AppError({
          code: error.code === "site.slug_invalid" ? "slug.invalid" : error.code,
          message: error.message,
          status: 400,
        });
      }

      if (error instanceof SiteConflictError) {
        throw new AppError({
          code: "site.slug_unavailable",
          message: "Site slug is already taken.",
          status: 409,
        });
      }

      if (error instanceof SitePlanLimitError) {
        throw new AppError({
          code: "site.limit_reached",
          message: error.message,
          status: 403,
        });
      }

      throw error;
    }
  }));

  router.get("/:siteId", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const result = await context.siteService.getSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(siteDetailResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.get("/:siteId/content", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const result = await context.siteService.getSiteContent({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(siteContentResponseSchema.parse({
        ...result,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.put("/:siteId/content", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    enforceSiteContentEnvelope((request.body as { draftContent?: unknown } | undefined)?.draftContent);
    const result = updateSiteContentRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Invalid site content payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const updated = await context.siteService.updateSiteContent({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
        draftContent: result.data.draftContent,
        ...(result.data.expectedDraftRevision
          ? { expectedDraftRevision: result.data.expectedDraftRevision }
          : {}),
      });

      response.json(updateSiteContentResponseSchema.parse({
        ...updated,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/content/validate", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    enforceSiteContentEnvelope((request.body as { draftContent?: unknown } | undefined)?.draftContent);
    const result = validateSiteContentRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Invalid site content payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      await context.siteService.getSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });
      const validation = await context.siteService.validateSiteContent({
        draftContent: result.data.draftContent,
      });

      response.json(validateSiteContentResponseSchema.parse({
        ...validation,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.patch("/:siteId", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    const result = updateSiteRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Invalid site payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const updated = await context.siteService.updateSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
        ...(result.data.name ? { name: result.data.name } : {}),
        ...(result.data.slug ? { slug: result.data.slug } : {}),
        ...(result.data.visibility ? { visibility: result.data.visibility } : {}),
      });

      response.json(siteDetailResponseSchema.parse({
        ...updated,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.get("/:siteId/variants", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const variants = await context.siteService.listSiteVariants({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(listSiteVariantsResponseSchema.parse({
        ...variants,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/variants/batch", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);
    const result = batchUpsertSiteVariantsRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "site.invalid_payload",
        message: "Invalid site variants payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const variants = await context.siteService.batchUpsertSiteVariants({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
        matchBy: result.data.matchBy,
        variants: result.data.variants,
      });

      response.json(batchUpsertSiteVariantsResponseSchema.parse({
        ...variants,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.delete("/:siteId/variants/:variantId", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      await context.siteService.deleteSiteVariant({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
        variantId: request.params.variantId ?? "",
      });
      response.status(204).send();
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/duplicate", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const duplicated = await context.siteService.duplicateSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.status(201).json(duplicateSiteResponseSchema.parse({
        ...duplicated,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/publish", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const published = await context.siteService.publishSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(publishSiteResponseSchema.parse({
        ...published,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/unpublish", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const unpublished = await context.siteService.unpublishSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(unpublishSiteResponseSchema.parse({
        ...unpublished,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/archive", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const archived = await context.siteService.archiveSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(siteDetailResponseSchema.parse({
        ...archived,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.delete("/:siteId", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      await context.siteService.deleteSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.status(204).end();
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/restore", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const restored = await context.siteService.restoreSite({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(siteDetailResponseSchema.parse({
        ...restored,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.get("/:siteId/versions", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const versions = await context.siteService.listSiteVersions({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
      });

      response.json(listSiteVersionsResponseSchema.parse({
        ...versions,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  router.post("/:siteId/versions/:versionId/restore", asyncHandler(async (request, response) => {
    const context = await resolveSiteRequestContext(request, options);

    try {
      const restored = await context.siteService.restoreSiteVersion({
        workspace: context.workspace,
        userId: context.actor.userId,
        siteId: request.params.siteId ?? "",
        versionId: request.params.versionId ?? "",
      });

      response.json(restoreSiteVersionResponseSchema.parse({
        ...restored,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapSiteServiceError(error);
    }
  }));

  return router;
}

async function resolveSiteRequestContext(
  request: Request,
  options: SiteRouterOptions,
): Promise<{
  actor: CurrentActor;
  siteService: SiteService;
  workspace: SiteWorkspaceContext;
}> {
  const agentContext = getAgentAuthContext(request);

  if (agentContext) {
    return {
      actor: agentContext.actor,
      siteService: options.siteService,
      workspace: agentContext.workspace,
    };
  }

  const isDevRequest = isDevAuthBypassRequest(request);
  const actor = isDevRequest
    ? devActor
    : await requireAuthenticatedActor(request, options.getCurrentActor);
  const bootstrap = isDevRequest
    ? getDevAppBootstrap()
    : await options.bootstrapService.getBootstrap(actor);
  const workspace = getActiveWorkspace(bootstrap);

  if (!workspace) {
    throw new AppError({
      code: "workspace.access_denied",
      message: "Workspace is not available for the current user.",
      status: 404,
    });
  }

  return {
    actor,
    siteService: isDevRequest ? (options.devSiteService ?? options.siteService) : options.siteService,
    workspace: {
      id: workspace.id,
      plan: workspace.plan,
      role: workspace.role,
    },
  };
}

function getActiveWorkspace(
  bootstrap: AppBootstrap,
): BootstrapWorkspaceSwitcherItem | null {
  return bootstrap.activeWorkspace;
}

function mapSiteServiceError(error: unknown): AppError {
  if (error instanceof SiteValidationError) {
    return new AppError({
      code: error.code === "site.slug_invalid" ? "slug.invalid" : error.code,
      message: error.message,
      status: 400,
    });
  }

  if (error instanceof SiteConflictError) {
    return new AppError({
      code: "site.slug_unavailable",
      message: "Site slug is already taken.",
      status: 409,
    });
  }

  if (error instanceof SitePlanLimitError) {
    return new AppError({
      code: "site.limit_reached",
      message: error.message,
      status: 403,
    });
  }

  if (error instanceof SitePublishValidationError) {
    return new AppError({
      code: "site.publish_invalid",
      message: error.message,
      status: 400,
      issues: error.issues,
    });
  }

  if (error instanceof SitePublishPlanError) {
    return new AppError({
      code: "billing.upgrade_required",
      message: error.message,
      status: 402,
    });
  }

  if (error instanceof SiteNotFoundError) {
    return new AppError({
      code: "site.not_found",
      message: "Site is not available for the current user.",
      status: 404,
    });
  }

  if (error instanceof SiteVersionNotFoundError) {
    return new AppError({
      code: "site.version_not_found",
      message: "Site version is not available for the current user.",
      status: 404,
    });
  }

  if (error instanceof SitePermissionError) {
    return new AppError({
      code: "site.permission_denied",
      message: error.message,
      status: 403,
    });
  }

  if (error instanceof SiteArchivedError) {
    return new AppError({
      code: "site.archived",
      message: error.message,
      status: 409,
    });
  }

  if (error instanceof SitePublishedSlugChangeError) {
    return new AppError({
      code: "site.published_slug_locked",
      message: error.message,
      status: 409,
    });
  }

  if (error instanceof SiteDraftRevisionConflictError) {
    return new AppError({
      code: "site.draft_revision_conflict",
      message: error.message,
      status: 409,
    });
  }

  if (error instanceof SiteVariantConflictError) {
    return new AppError({
      code: "site.variant_conflict",
      message: error.message,
      status: 409,
    });
  }

  throw error;
}

function enforceSiteContentEnvelope(value: unknown) {
  if (value === undefined) return;
  const issue = analyzeSiteContentSafety(value).issues[0];
  if (!issue) return;
  throw new AppError({
    code: issue.code === "content_too_large"
      ? "site.content_too_large"
      : "site.content_limit_reached",
    message: issue.message,
    status: issue.code === "content_too_large" ? 413 : 422,
  });
}
