import { normalizeWebsiteDomain } from "@handout/domain";
import { normalizePublishedSitePayload } from "@handout/content-schema";
import { getSiteVariableValues } from "@handout/site-document";
import { Router, type Response } from "express";

import { asyncHandler } from "../http/async-handler";
import {
  WorkspaceLogoPreviewDisabledError,
  WorkspaceLogoValidationError,
  type WorkspaceLogoPreviewService,
} from "../workspaces/logo-preview";
import type { RecipientLogoService } from "../recipient-logos/service";
import type { PublicSiteService } from "./service";

const PUBLIC_LOGO_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const UNAVAILABLE_LOGO_CACHE_CONTROL = "public, max-age=60";

export function createPublicSiteLogoRouter(options: {
  logoPreviewService: WorkspaceLogoPreviewService;
  publicSiteService: PublicSiteService;
  recipientLogoService: RecipientLogoService;
}) {
  const router = Router();

  router.get("/:workspaceSlug/:siteSlug/:kind", asyncHandler(async (request, response) => {
    const kind = request.params.kind;
    const theme = request.query.theme;
    const variant = request.query.variant;

    if (
      (kind !== "workspace" && kind !== "recipient") ||
      (theme !== "light" && theme !== "dark") ||
      (variant !== undefined && typeof variant !== "string")
    ) {
      sendUnavailableLogo(response);
      return;
    }

    const resolution = await options.publicSiteService.resolve({
      workspaceSlug: request.params.workspaceSlug ?? "",
      siteSlug: request.params.siteSlug ?? "",
      ...(variant ? { variantSlug: variant } : {}),
    });
    const payload = resolution.status === "available"
      ? normalizePublishedSitePayload(resolution.payload)
      : null;
    const domain = payload ? resolveLogoDomain(payload, kind) : null;

    if (!payload || !domain) {
      sendUnavailableLogo(response);
      return;
    }

    try {
      const image = kind === "recipient"
        ? await options.recipientLogoService.getOrFetch({
            domain,
            theme,
            workspaceId: payload.workspace.id,
          })
        : await options.logoPreviewService.fetchImage({
            domain,
            size: 128,
            theme,
          });

      if (!image) {
        sendUnavailableLogo(response);
        return;
      }

      response
        .setHeader("cache-control", PUBLIC_LOGO_CACHE_CONTROL)
        .setHeader("cross-origin-resource-policy", "same-origin")
        .setHeader("x-content-type-options", "nosniff")
        .type(image.contentType)
        .send("body" in image ? Buffer.from(image.body) : image.content);
    } catch (error) {
      if (
        error instanceof WorkspaceLogoPreviewDisabledError ||
        error instanceof WorkspaceLogoValidationError
      ) {
        sendUnavailableLogo(response);
        return;
      }

      throw error;
    }
  }));

  return router;
}

function resolveLogoDomain(
  payload: NonNullable<ReturnType<typeof normalizePublishedSitePayload>>,
  kind: "recipient" | "workspace",
) {
  const rawValue = kind === "workspace"
    ? payload.workspace.websiteDomain
    : getSiteVariableValues(payload.content, {
        recipientCompany: payload.selectedVariant?.recipientCompany,
        recipientName: payload.selectedVariant?.recipientName,
        variableValues: payload.selectedVariant?.variableValues,
      }).recipient_website;
  const normalized = normalizeWebsiteDomain(rawValue ?? "");
  return normalized.ok ? normalized.domain : null;
}

function sendUnavailableLogo(response: Response) {
  response
    .setHeader("cache-control", UNAVAILABLE_LOGO_CACHE_CONTROL)
    .setHeader("x-content-type-options", "nosniff")
    .status(404)
    .end();
}
