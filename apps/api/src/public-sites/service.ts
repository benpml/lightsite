import { validateSiteSlug, validateWorkspaceSlug } from "@handout/domain";
import {
  buildPublicPreviewVersion,
  normalizePublishedSitePayload,
} from "@handout/site-document";
import type { PublicSiteRepository } from "./repository";
import type { PublicRecipientLinkInput } from "./recipient-link";
import {
  SITE_PUBLIC_ID_LENGTH,
  isRecipientShortCode,
  isPublicCode,
} from "../sites/public-identifiers";
import type {
  TrackingV2ContextTokenService,
} from "../tracking/v2/context-token";
import type { TrackingV2Service } from "../tracking/v2/service";

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
  resolveShortLink(shortCode: string): Promise<PublicShortLinkResolution>;
  resolveRecipientLink(input: PublicRecipientLinkInput & {
    sitePublicId: string;
  }): Promise<PublicShortLinkResolution>;
}

export type PublicShortLinkResolution =
  | {
      status: "available";
      payload: Record<string, unknown>;
      shortCode: string;
      version: string;
      cacheControl: string;
    }
  | {
      status: "unavailable" | "invalid_slug";
      cacheControl: string;
    };

export type PublicSiteServiceOptions = {
  trackingV2ContextTokens?: TrackingV2ContextTokenService;
  trackingV2Service?: Pick<TrackingV2Service, "preparePublicContext">;
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
        payload: await addTrackingV2Bootstrap(record.payload, options),
        cacheControl: PUBLIC_SITE_AVAILABLE_CACHE_CONTROL,
      };
    },

    async resolveShortLink(shortCode) {
      if (!isRecipientShortCode(shortCode)) {
        return {
          status: "invalid_slug",
          cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
        };
      }

      return resolveShortLinkRecord(
        await repository.findPublishedSiteByShortCode(shortCode),
        options,
      );
    },

    async resolveRecipientLink(input) {
      if (!isPublicCode(input.sitePublicId, SITE_PUBLIC_ID_LENGTH)) {
        return {
          status: "invalid_slug",
          cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
        };
      }

      return resolveShortLinkRecord(
        await repository.resolveExistingRecipientLink(input),
        options,
      );
    },
  };
}

async function resolveShortLinkRecord(
  record: Awaited<ReturnType<PublicSiteRepository["findPublishedSiteByShortCode"]>>,
  options: PublicSiteServiceOptions,
): Promise<PublicShortLinkResolution> {
  if (!record || !isPublicPayload(record.payload)) {
    return {
      status: "unavailable",
      cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
    };
  }

  const payload = await addTrackingV2Bootstrap(record.payload, options);
  const normalized = normalizePublishedSitePayload(payload);
  if (!normalized?.selectedVariant) {
    return {
      status: "unavailable",
      cacheControl: PUBLIC_SITE_UNAVAILABLE_CACHE_CONTROL,
    };
  }

  return {
    status: "available",
    payload,
    shortCode: record.shortCode,
    version: buildPublicPreviewVersion(normalized),
    cacheControl: PUBLIC_SITE_AVAILABLE_CACHE_CONTROL,
  };
}

function isPublicPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function addTrackingV2Bootstrap(
  payload: Record<string, unknown>,
  options: PublicSiteServiceOptions,
) {
  if (!options.trackingV2ContextTokens || !options.trackingV2Service) {
    return payload;
  }

  const normalized = normalizePublishedSitePayload(payload);
  if (!normalized) return payload;

  try {
    const issueInput = await options.trackingV2Service.preparePublicContext(normalized);
    if (!issueInput) return payload;

    return {
      ...payload,
      trackingV2: options.trackingV2ContextTokens.issue(issueInput),
    };
  } catch {
    // Tracking is best-effort and must never make a published site unavailable.
    return payload;
  }
}
