import { normalizeWebsiteDomain } from "@handout/domain";

import { readImageDimensions } from "../uploads/image-dimensions";
import type { WorkspaceLogoPreviewService } from "../workspaces/logo-preview";
import type {
  RecipientLogoAsset,
  RecipientLogoRepository,
  RecipientLogoTheme,
} from "./repository";

const RECIPIENT_LOGO_MAX_BYTES = 1_048_576;
const RECIPIENT_LOGO_REFRESH_MS = 30 * 24 * 60 * 60 * 1_000;
const supportedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface RecipientLogoService {
  getOrFetch(input: {
    domain: string;
    theme: RecipientLogoTheme;
    workspaceId: string;
  }): Promise<RecipientLogoAsset | null>;
}

export function createRecipientLogoService(
  repository: RecipientLogoRepository,
  logoPreviewService: WorkspaceLogoPreviewService,
): RecipientLogoService {
  const inFlight = new Map<string, Promise<RecipientLogoAsset | null>>();

  return {
    async getOrFetch(input) {
      const normalized = normalizeWebsiteDomain(input.domain);
      if (!normalized.ok) return null;

      const request = {
        domain: normalized.domain,
        theme: input.theme,
        workspaceId: input.workspaceId,
      };
      const cached = await repository.find(request);

      if (
        cached &&
        Date.now() - cached.updatedAt.getTime() < RECIPIENT_LOGO_REFRESH_MS
      ) {
        return cached;
      }

      const key = `${request.workspaceId}:${request.domain}:${request.theme}`;
      const existingRequest = inFlight.get(key);
      if (existingRequest) return existingRequest;

      const pending = fetchAndPersist({
        cached,
        logoPreviewService,
        repository,
        ...request,
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, pending);
      return pending;
    },
  };
}

async function fetchAndPersist(input: {
  cached: RecipientLogoAsset | null;
  domain: string;
  logoPreviewService: WorkspaceLogoPreviewService;
  repository: RecipientLogoRepository;
  theme: RecipientLogoTheme;
  workspaceId: string;
}) {
  try {
    const image = await input.logoPreviewService.fetchImage({
      domain: input.domain,
      size: 128,
      theme: input.theme,
    });
    if (!image) return input.cached;

    const contentType = normalizeContentType(image.contentType);
    const content = Buffer.from(image.body);
    if (
      !contentType ||
      content.byteLength === 0 ||
      content.byteLength > RECIPIENT_LOGO_MAX_BYTES
    ) {
      return input.cached;
    }

    const dimensions = readImageDimensions(content, contentType);
    if (!dimensions || dimensions.width !== dimensions.height) {
      return input.cached;
    }

    return input.repository.upsert({
      content,
      contentType,
      domain: input.domain,
      height: dimensions.height,
      theme: input.theme,
      width: dimensions.width,
      workspaceId: input.workspaceId,
    });
  } catch {
    return input.cached;
  }
}

function normalizeContentType(value: string) {
  const contentType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return supportedContentTypes.has(contentType)
    ? contentType as "image/jpeg" | "image/png" | "image/webp"
    : null;
}
