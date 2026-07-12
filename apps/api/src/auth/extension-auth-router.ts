import {
  extensionAuthAuthorizeRequestSchema,
  extensionAuthAuthorizeResponseSchema,
  extensionAuthExchangeRequestSchema,
  extensionAuthExchangeResponseSchema,
} from "@lightsite/contracts";
import { Router, type Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import { asyncHandler } from "../http/async-handler";
import { AppError, issuesFromZodError } from "../http/errors";
import type { CurrentActorProvider } from "./current-actor";
import { isDevAuthBypassRequest } from "./dev-auth";
import {
  ExtensionAuthCodeError,
  type ExtensionAuthCodeService,
} from "./extension-auth-code";
import { requireAuthenticatedActor } from "./require-authenticated-actor";

type BetterAuthSession = {
  session?: {
    token?: string;
  } | null;
} | null;

export function createExtensionAuthRouter(options: {
  codeService: ExtensionAuthCodeService;
  getCurrentActor: CurrentActorProvider;
  getSessionToken?: (request: Request) => Promise<string | null>;
}) {
  const router = Router();
  const getSessionToken = options.getSessionToken ?? getBetterAuthSessionToken;

  router.post("/authorize", asyncHandler(async (request, response) => {
    await requireAuthenticatedActor(request, options.getCurrentActor);
    const result = extensionAuthAuthorizeRequestSchema.safeParse(request.body ?? {});
    if (!result.success) {
      throw new AppError({
        code: "extension_auth.invalid_payload",
        message: "The extension connection request is invalid.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    const development = isDevAuthBypassRequest(request);
    const sessionToken = development ? null : await getSessionToken(request);
    if (!development && !sessionToken) {
      throw new AppError({
        code: "auth.required",
        message: "Sign in to connect Lightsite.",
        status: 401,
      });
    }

    response.json(extensionAuthAuthorizeResponseSchema.parse({
      code: options.codeService.issue({
        codeChallenge: result.data.codeChallenge,
        development,
        sessionToken,
      }),
      redirectUri: result.data.redirectUri,
      requestId: request.context.requestId,
    }));
  }));

  router.post("/exchange", asyncHandler(async (request, response) => {
    const result = extensionAuthExchangeRequestSchema.safeParse(request.body ?? {});
    if (!result.success) {
      throw new AppError({
        code: "extension_auth.invalid_payload",
        message: "The extension connection response is invalid.",
        status: 400,
        issues: issuesFromZodError(result.error),
      });
    }

    try {
      const exchange = options.codeService.exchange(result.data);
      response.setHeader("cache-control", "no-store");
      response.json(extensionAuthExchangeResponseSchema.parse({
        ...exchange,
        requestId: request.context.requestId,
      }));
    } catch (error) {
      if (error instanceof ExtensionAuthCodeError) {
        throw new AppError({
          code: "extension_auth.invalid_code",
          message: error.message,
          status: 400,
        });
      }
      throw error;
    }
  }));

  return router;
}

async function getBetterAuthSessionToken(request: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  }) as BetterAuthSession;
  return session?.session?.token ?? null;
}
