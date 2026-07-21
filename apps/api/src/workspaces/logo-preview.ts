import {
  normalizeWebsiteDomain,
  type WebsiteValidationResult,
} from "@handout/domain";
import type { WorkspaceLogoPreviewTheme } from "@handout/contracts";

export type WorkspaceLogoPreviewInput = {
  website: string;
  size: number;
  theme: WorkspaceLogoPreviewTheme;
};

export type WorkspaceLogoImageInput = {
  domain: string;
  size: number;
  theme: WorkspaceLogoPreviewTheme;
};

export type WorkspaceLogoPreviewResult = {
  enabled: boolean;
  domain: string;
  imageUrl: string | null;
};

export type WorkspaceLogoImageResult = {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
};

export interface WorkspaceLogoPreviewService {
  getPreview(input: WorkspaceLogoPreviewInput): Promise<WorkspaceLogoPreviewResult>;
  fetchImage(input: WorkspaceLogoImageInput): Promise<WorkspaceLogoImageResult | null>;
}

export class WorkspaceLogoValidationError extends Error {
  readonly validation: WebsiteValidationResult & { ok: false };

  constructor(validation: WebsiteValidationResult & { ok: false }) {
    super(validation.message);
    this.name = "WorkspaceLogoValidationError";
    this.validation = validation;
  }
}

export class WorkspaceLogoPreviewDisabledError extends Error {
  constructor() {
    super("Workspace logo preview is disabled.");
    this.name = "WorkspaceLogoPreviewDisabledError";
  }
}

export function createLogoDevPreviewService(
  token: string | undefined,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceLogoPreviewService {
  return {
    async getPreview(input) {
      const domain = normalizePreviewDomain(input.website);

      if (!token) {
        return {
          enabled: false,
          domain,
          imageUrl: null,
        };
      }

      return {
        enabled: true,
        domain,
        imageUrl: buildInternalLogoPreviewImageUrl({
          domain,
          size: input.size,
          theme: input.theme,
        }),
      };
    },

    async fetchImage(input) {
      const domain = normalizePreviewDomain(input.domain);

      if (!token) {
        throw new WorkspaceLogoPreviewDisabledError();
      }

      const providerResponse = await fetchImplementation(
        buildLogoDevUrl({
          domain,
          size: input.size,
          theme: input.theme,
          token,
        }),
      );

      if (providerResponse.status === 404) {
        return null;
      }

      if (!providerResponse.ok) {
        throw new Error(`logo.dev returned ${providerResponse.status}`);
      }

      return {
        body: new Uint8Array(await providerResponse.arrayBuffer()),
        contentType: providerResponse.headers.get("content-type") ?? "image/webp",
        cacheControl: "private, max-age=86400",
      };
    },
  };
}

function normalizePreviewDomain(input: string) {
  const validation = normalizeWebsiteDomain(input);

  if (!validation.ok) {
    throw new WorkspaceLogoValidationError(validation);
  }

  return validation.domain;
}

function buildInternalLogoPreviewImageUrl(input: WorkspaceLogoImageInput) {
  const params = new URLSearchParams({
    domain: input.domain,
    size: String(input.size),
    theme: input.theme,
  });

  return `/api/workspaces/logo-preview/image?${params.toString()}`;
}

function buildLogoDevUrl(input: WorkspaceLogoImageInput & { token: string }) {
  const url = new URL(`https://img.logo.dev/${input.domain}`);
  url.searchParams.set("token", input.token);
  url.searchParams.set("size", String(input.size));
  url.searchParams.set("retina", "true");
  url.searchParams.set("format", "webp");
  url.searchParams.set("theme", input.theme);
  url.searchParams.set("fallback", "404");

  return url;
}
