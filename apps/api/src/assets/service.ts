import { readImageDimensions } from "../uploads/image-dimensions";
import { fetchSafeImage, UnsafeAssetSourceError } from "./safe-image-fetch";
import type { WorkspaceAssetPurpose, WorkspaceAssetRecord, WorkspaceAssetRepository } from "./repository";

const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 5_242_880;

export type WorkspaceAsset = ReturnType<typeof serializeAsset>;

export interface WorkspaceAssetService {
  list(input: { workspaceId: string; purpose?: WorkspaceAssetPurpose; search?: string }): Promise<{ assets: WorkspaceAsset[] }>;
  import(input: {
    workspaceId: string;
    userId: string;
    purpose: WorkspaceAssetPurpose;
    fileName?: string;
    source: { kind: "url"; url: string } | { kind: "base64"; contentType: typeof ALLOWED_CONTENT_TYPES[number]; dataBase64: string };
  }): Promise<{ asset: WorkspaceAsset }>;
  remove(input: { workspaceId: string; assetId: string }): Promise<boolean>;
  getContent(assetId: string): Promise<{ contentType: string; content: Buffer } | null>;
}

export class WorkspaceAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAssetValidationError";
  }
}

export function createWorkspaceAssetService(repository: WorkspaceAssetRepository): WorkspaceAssetService {
  return {
    async list(input) {
      const query = input.search?.trim().toLowerCase();
      const records = await repository.list({ workspaceId: input.workspaceId, limit: 200 });
      return {
        assets: records
          .filter((asset) => !input.purpose || asset.purpose === input.purpose)
          .filter((asset) => !query || asset.fileName.toLowerCase().includes(query) || asset.sourceHost?.includes(query))
          .map(serializeAsset),
      };
    },

    async import(input) {
      let content: Buffer;
      let contentType: string;
      let fileName = input.fileName?.trim();
      let sourceHost: string | null = null;
      if (input.source.kind === "url") {
        let fetched;
        try {
          fetched = await fetchSafeImage(input.source.url);
        } catch (error) {
          if (error instanceof UnsafeAssetSourceError) throw new WorkspaceAssetValidationError(error.message);
          throw error;
        }
        content = fetched.content;
        contentType = fetched.contentType;
        fileName ||= fetched.fileName;
        sourceHost = fetched.sourceHost;
      } else {
        content = Buffer.from(input.source.dataBase64, "base64");
        contentType = input.source.contentType;
      }
      if (!ALLOWED_CONTENT_TYPES.includes(contentType as typeof ALLOWED_CONTENT_TYPES[number])) {
        throw new WorkspaceAssetValidationError("Assets must be PNG, JPEG, or WebP images.");
      }
      if (!content.byteLength || content.byteLength > MAX_BYTES) {
        throw new WorkspaceAssetValidationError("Assets must be non-empty and no larger than 5 MB.");
      }
      const dimensions = readImageDimensions(content, contentType);
      if (!dimensions || dimensions.width > 12_000 || dimensions.height > 12_000) {
        throw new WorkspaceAssetValidationError("The image is invalid or exceeds 12,000 pixels in either dimension.");
      }
      if ((input.purpose === "logo" || input.purpose === "avatar") && dimensions.width !== dimensions.height) {
        throw new WorkspaceAssetValidationError(`${input.purpose === "logo" ? "Logos" : "Avatars"} must be square.`);
      }
      const safeFileName = normalizeFileName(fileName, contentType);
      const asset = await repository.save({
        workspaceId: input.workspaceId,
        uploadedByUserId: input.userId,
        fileName: safeFileName,
        purpose: input.purpose,
        contentType,
        width: dimensions.width,
        height: dimensions.height,
        sourceHost,
        content,
      });
      return { asset: serializeAsset(asset) };
    },

    remove(input) {
      return repository.remove(input);
    },

    getContent(assetId) {
      return repository.findContent(assetId);
    },
  };
}

function serializeAsset(asset: WorkspaceAssetRecord) {
  return {
    id: asset.id,
    fileName: asset.fileName,
    purpose: asset.purpose,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    sourceHost: asset.sourceHost,
    url: `/api/public/assets/${asset.id}`,
    createdAt: asset.createdAt.toISOString(),
  };
}

function normalizeFileName(value: string | undefined, contentType: string) {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const normalized = (value || "handout-asset").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.(png|jpe?g|webp)$/i, "");
  const base = normalized.replace(/^\.+|\.+$/g, "").slice(0, 250 - extension.length) || "handout-asset";
  return `${base}.${extension}`;
}
