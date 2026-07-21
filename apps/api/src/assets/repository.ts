import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db as defaultDb, workspaceAssets, type Database } from "@handout/db";

export type WorkspaceAssetPurpose = "image" | "logo" | "og_image" | "avatar";

export type WorkspaceAssetRecord = {
  id: string;
  workspaceId: string;
  uploadedByUserId: string;
  fileName: string;
  purpose: WorkspaceAssetPurpose;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  sourceHost: string | null;
  createdAt: Date;
};

export interface WorkspaceAssetRepository {
  list(input: { workspaceId: string; limit: number }): Promise<WorkspaceAssetRecord[]>;
  find(input: { workspaceId: string; assetId: string }): Promise<WorkspaceAssetRecord | null>;
  findContent(assetId: string): Promise<{ contentType: string; content: Buffer } | null>;
  save(input: Omit<WorkspaceAssetRecord, "id" | "byteSize" | "createdAt"> & { content: Buffer }): Promise<WorkspaceAssetRecord>;
  remove(input: { workspaceId: string; assetId: string }): Promise<boolean>;
}

export function createDbWorkspaceAssetRepository(database: Database = defaultDb): WorkspaceAssetRepository {
  return {
    async list(input) {
      return database.select({
        id: workspaceAssets.id,
        workspaceId: workspaceAssets.workspaceId,
        uploadedByUserId: workspaceAssets.uploadedByUserId,
        fileName: workspaceAssets.fileName,
        purpose: workspaceAssets.purpose,
        contentType: workspaceAssets.contentType,
        byteSize: workspaceAssets.byteSize,
        width: workspaceAssets.width,
        height: workspaceAssets.height,
        sourceHost: workspaceAssets.sourceHost,
        createdAt: workspaceAssets.createdAt,
      }).from(workspaceAssets)
        .where(eq(workspaceAssets.workspaceId, input.workspaceId))
        .orderBy(desc(workspaceAssets.createdAt))
        .limit(input.limit);
    },

    async find(input) {
      const [asset] = await database.select({
        id: workspaceAssets.id,
        workspaceId: workspaceAssets.workspaceId,
        uploadedByUserId: workspaceAssets.uploadedByUserId,
        fileName: workspaceAssets.fileName,
        purpose: workspaceAssets.purpose,
        contentType: workspaceAssets.contentType,
        byteSize: workspaceAssets.byteSize,
        width: workspaceAssets.width,
        height: workspaceAssets.height,
        sourceHost: workspaceAssets.sourceHost,
        createdAt: workspaceAssets.createdAt,
      }).from(workspaceAssets)
        .where(and(eq(workspaceAssets.workspaceId, input.workspaceId), eq(workspaceAssets.id, input.assetId)))
        .limit(1);
      return asset ?? null;
    },

    async findContent(assetId) {
      const [asset] = await database.select({ contentType: workspaceAssets.contentType, content: workspaceAssets.content })
        .from(workspaceAssets).where(eq(workspaceAssets.id, assetId)).limit(1);
      return asset ? { contentType: asset.contentType, content: Buffer.from(asset.content) } : null;
    },

    async save(input) {
      const [asset] = await database.insert(workspaceAssets).values({
        workspaceId: input.workspaceId,
        uploadedByUserId: input.uploadedByUserId,
        fileName: input.fileName,
        purpose: input.purpose,
        contentType: input.contentType,
        byteSize: input.content.byteLength,
        width: input.width,
        height: input.height,
        content: input.content,
        sourceHost: input.sourceHost,
      }).returning({
        id: workspaceAssets.id,
        workspaceId: workspaceAssets.workspaceId,
        uploadedByUserId: workspaceAssets.uploadedByUserId,
        fileName: workspaceAssets.fileName,
        purpose: workspaceAssets.purpose,
        contentType: workspaceAssets.contentType,
        byteSize: workspaceAssets.byteSize,
        width: workspaceAssets.width,
        height: workspaceAssets.height,
        sourceHost: workspaceAssets.sourceHost,
        createdAt: workspaceAssets.createdAt,
      });
      if (!asset) throw new Error("Workspace asset insert did not return a row.");
      return asset;
    },

    async remove(input) {
      const removed = await database.delete(workspaceAssets)
        .where(and(eq(workspaceAssets.workspaceId, input.workspaceId), eq(workspaceAssets.id, input.assetId)))
        .returning({ id: workspaceAssets.id });
      return removed.length > 0;
    },
  };
}

export function createMemoryWorkspaceAssetRepository(): WorkspaceAssetRepository {
  const records = new Map<string, WorkspaceAssetRecord & { content: Buffer }>();
  return {
    async list(input) {
      return [...records.values()]
        .filter((asset) => asset.workspaceId === input.workspaceId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, input.limit)
        .map(({ content: _content, ...asset }) => asset);
    },
    async find(input) {
      const asset = records.get(input.assetId);
      if (!asset || asset.workspaceId !== input.workspaceId) return null;
      const { content: _content, ...metadata } = asset;
      return metadata;
    },
    async findContent(assetId) {
      const asset = records.get(assetId);
      return asset ? { contentType: asset.contentType, content: asset.content } : null;
    },
    async save(input) {
      const record = {
        ...input,
        id: randomUUID(),
        byteSize: input.content.byteLength,
        createdAt: new Date(),
      };
      records.set(record.id, record);
      const { content: _content, ...metadata } = record;
      return metadata;
    },
    async remove(input) {
      const asset = records.get(input.assetId);
      return Boolean(asset?.workspaceId === input.workspaceId && records.delete(input.assetId));
    },
  };
}
