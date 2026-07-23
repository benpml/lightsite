import { describe, expect, it } from "vitest";

import type { WorkspaceAssetRecord, WorkspaceAssetRepository } from "./repository";
import { createWorkspaceAssetService, WorkspaceAssetValidationError } from "./service";

const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("workspace asset service", () => {
  it("imports, lists, reads, and removes an opaque stored image", async () => {
    const service = createWorkspaceAssetService(createTestRepository());
    const imported = await service.import({
      workspaceId: "workspace-1",
      userId: "user-1",
      purpose: "logo",
      fileName: "Acme logo.png",
      source: { kind: "base64", contentType: "image/png", dataBase64: ONE_PIXEL_PNG },
    });

    expect(imported.asset).toMatchObject({
      fileName: "Acme-logo.png",
      purpose: "logo",
      contentType: "image/png",
      width: 1,
      height: 1,
    });
    expect(imported.asset).not.toHaveProperty("uploadedByUserId");
    expect(imported.asset).not.toHaveProperty("content");
    await expect(service.list({ workspaceId: "workspace-1" })).resolves.toMatchObject({
      assets: [{ id: imported.asset.id }],
    });
    await expect(service.getContent(imported.asset.id)).resolves.toMatchObject({ contentType: "image/png" });
    await expect(service.remove({ workspaceId: "another-workspace", assetId: imported.asset.id })).resolves.toBe(false);
    await expect(service.remove({ workspaceId: "workspace-1", assetId: imported.asset.id })).resolves.toBe(true);
    await expect(service.getContent(imported.asset.id)).resolves.toBeNull();
  });

  it("rejects invalid, oversized, and non-square constrained images", async () => {
    const service = createWorkspaceAssetService(createTestRepository());
    await expect(service.import({
      workspaceId: "workspace-1",
      userId: "user-1",
      purpose: "image",
      source: { kind: "base64", contentType: "image/png", dataBase64: Buffer.from("not an image").toString("base64") },
    })).rejects.toBeInstanceOf(WorkspaceAssetValidationError);
    await expect(service.import({
      workspaceId: "workspace-1",
      userId: "user-1",
      purpose: "image",
      source: { kind: "base64", contentType: "image/png", dataBase64: Buffer.alloc(5_242_881).toString("base64") },
    })).rejects.toThrow("no larger than 5 MB");

    const excessivePixels = Buffer.from(ONE_PIXEL_PNG, "base64");
    excessivePixels.writeUInt32BE(8_000, 16);
    excessivePixels.writeUInt32BE(8_000, 20);
    await expect(service.import({
      workspaceId: "workspace-1",
      userId: "user-1",
      purpose: "image",
      source: {
        kind: "base64",
        contentType: "image/png",
        dataBase64: excessivePixels.toString("base64"),
      },
    })).rejects.toThrow("25 megapixel");
  });
});

function createTestRepository(): WorkspaceAssetRepository {
  const records = new Map<string, WorkspaceAssetRecord & { content: Buffer }>();
  return {
    async list({ workspaceId, limit }) {
      return [...records.values()].filter((record) => record.workspaceId === workspaceId).slice(0, limit).map(({ content: _content, ...record }) => record);
    },
    async find({ workspaceId, assetId }) {
      const record = records.get(assetId);
      if (!record || record.workspaceId !== workspaceId) return null;
      const { content: _content, ...metadata } = record;
      return metadata;
    },
    async findContent(assetId) {
      const record = records.get(assetId);
      return record ? { contentType: record.contentType, content: record.content } : null;
    },
    async save(input) {
      const record = { ...input, id: crypto.randomUUID(), byteSize: input.content.byteLength, createdAt: new Date() };
      records.set(record.id, record);
      const { content: _content, ...metadata } = record;
      return metadata;
    },
    async remove({ workspaceId, assetId }) {
      return records.get(assetId)?.workspaceId === workspaceId && records.delete(assetId);
    },
  };
}
