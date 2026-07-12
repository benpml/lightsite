import { validateSiteSlug, validateWorkspaceSlug } from "@lightsite/domain";
import {
  trackingV2PublicContextSchema,
  type TrackingV2PublicContext,
} from "@lightsite/tracking-schema";
import type { PublicSiteRepository } from "./repository";
import type {
  TrackingV2ContextTokenIssueInput,
  TrackingV2ContextTokenService,
} from "../tracking/v2/context-token";

export const PUBLIC_SITE_AVAILABLE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
export const PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL = "public, max-age=15, stale-while-revalidate=15";

export type PublicSiteRouteInput = {
  workspaceSlug: string;
  siteSlug: string;
  variantSlug?: string;
};

export type PublicSiteResolution =
  | {
    status: "available";
    payload: Record<string, unknown>;
    cacheControl: string;
  }
  | {
    status: "unavailable";
    cacheControl: string;
  }
  | {
    status: "invalid_slug";
    message: string;
    cacheControl: string;
  };

export interface PublicSiteService {
  resolve(input: PublicSiteRouteInput): Promise<PublicSiteResolution>;
}

export type PublicSiteServiceOptions = {
  trackingV2ContextTokens?: TrackingV2ContextTokenService;
};

export function createPublicSiteService(
  repository: PublicSiteRepository,
  options: PublicSiteServiceOptions = {},
): PublicSiteService {
  return {
    async resolve(input) {
      const workspaceSlug = validateWorkspaceSlug(input.workspaceSlug);
      const siteSlug = validateSiteSlug(input.siteSlug);
      const variantSlug = input.variantSlug
        ? validateSiteSlug(input.variantSlug)
        : { ok: true as const, slug: null };

      if (!workspaceSlug.ok || !siteSlug.ok || !variantSlug.ok) {
        return {
          status: "invalid_slug",
          message: "Invalid public site path.",
          cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
        };
      }

      const record = await repository.findPublishedSite({
        workspaceSlug: workspaceSlug.slug,
        siteSlug: siteSlug.slug,
        variantSlug: variantSlug.slug,
      });

      if (!record || !isPublicPayload(record.payload)) {
        return {
          status: "unavailable",
          cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
        };
      }

      return {
        status: "available",
        payload: addTrackingV2Bootstrap(record.payload, options.trackingV2ContextTokens),
        cacheControl: PUBLIC_SITE_AVAILABLE_CACHE_CONTROL,
      };
    },
  };
}

function isPublicPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addTrackingV2Bootstrap(
  payload: Record<string, unknown>,
  trackingV2ContextTokens: TrackingV2ContextTokenService | undefined,
) {
  if (!trackingV2ContextTokens) {
    return payload;
  }

  const issueInput = parseTrackingV2ContextIssueInput(payload.tracking);

  if (!issueInput) {
    return payload;
  }

  return {
    ...payload,
    trackingV2: trackingV2ContextTokens.issue(issueInput),
  };
}

function parseTrackingV2ContextIssueInput(value: unknown): TrackingV2ContextTokenIssueInput | null {
  const parsed = trackingV2PublicContextSchema.safeParse(value);

  if (!parsed.success || parsed.data.trackingMode === "off") {
    return null;
  }

  const context: TrackingV2PublicContext = parsed.data;

  return {
    workspaceId: context.workspaceId,
    siteId: context.siteId,
    publishedVersionId: context.publishedVersionId,
    recipientId: context.recipientId,
    recipientRevision: context.recipientId ? context.recipientRevision : null,
    trackingMode: context.trackingMode,
  };
}
