import {
  billingCheckoutResponseSchema,
  billingPortalResponseSchema,
  billingSummarySchema,
  createBillingCheckoutRequestSchema,
} from "@lightsite/contracts";
import { Router, type Request } from "express";
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
  BillingConfigurationError,
  BillingPermissionError,
  BillingPortalUnavailableError,
  BillingWebhookError,
  type BillingService,
  type BillingWorkspaceContext,
} from "./service";

export type BillingRouterOptions = {
  billingService: BillingService;
  bootstrapService: BootstrapService;
  getCurrentActor: CurrentActorProvider;
};

export function createBillingRouter(options: BillingRouterOptions) {
  const router = Router();

  router.get("/", asyncHandler(async (request, response) => {
    const context = await resolveBillingRequestContext(request, options);
    const summary = await options.billingService.getSummary({
      workspace: context.workspace,
    });

    response.json(billingSummarySchema.parse({
      ...summary,
      requestId: request.context.requestId,
    }));
  }));

  router.post("/checkout", asyncHandler(async (request, response) => {
    const context = await resolveBillingRequestContext(request, options);
    const result = createBillingCheckoutRequestSchema.safeParse(request.body ?? {});

    if (!result.success) {
      throw new AppError({
        code: "billing.invalid_payload",
        message: "Invalid checkout payload.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const session = await options.billingService.createCheckoutSession({
        actor: context.actor,
        workspace: context.workspace,
        plan: result.data.plan,
        interval: result.data.interval,
      });

      response.json(billingCheckoutResponseSchema.parse({
        ...session,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapBillingServiceError(error);
    }
  }));

  router.post("/portal", asyncHandler(async (request, response) => {
    const context = await resolveBillingRequestContext(request, options);

    try {
      const session = await options.billingService.createPortalSession({
        workspace: context.workspace,
      });

      response.json(billingPortalResponseSchema.parse({
        ...session,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      throw mapBillingServiceError(error);
    }
  }));

  return router;
}

export function createBillingWebhookRouter(options: Pick<BillingRouterOptions, "billingService">) {
  const router = Router();

  router.post("/", asyncHandler(async (request, response) => {
    const signature = request.header("stripe-signature") ?? "";

    if (!Buffer.isBuffer(request.body) || !signature) {
      throw new AppError({
        code: "billing.webhook_invalid",
        message: "Invalid Stripe webhook payload.",
        status: 400,
      });
    }

    try {
      await options.billingService.handleWebhook({
        payload: request.body,
        signature,
      });
    } catch (error) {
      throw mapBillingServiceError(error);
    }

    response.json({
      received: true,
      requestId: request.context.requestId,
    });
  }));

  return router;
}

async function resolveBillingRequestContext(
  request: Request,
  options: BillingRouterOptions,
): Promise<{
  actor: CurrentActor;
  workspace: BillingWorkspaceContext;
}> {
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
    workspace: {
      id: workspace.id,
      name: workspace.name,
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

function mapBillingServiceError(error: unknown): AppError {
  if (error instanceof BillingPermissionError) {
    return new AppError({
      code: "site.permission_denied",
      message: error.message,
      status: 403,
    });
  }

  if (error instanceof BillingPortalUnavailableError) {
    return new AppError({
      code: "billing.portal_unavailable",
      message: error.message,
      status: 409,
    });
  }

  if (error instanceof BillingConfigurationError) {
    return new AppError({
      code: "billing.stripe_unavailable",
      message: error.message,
      status: 503,
    });
  }

  if (error instanceof BillingWebhookError) {
    return new AppError({
      code: "billing.webhook_invalid",
      message: error.message,
      status: 400,
    });
  }

  throw error;
}
