import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db as defaultDb,
  recipientLogoAssets,
  type Database,
} from "@handout/db";

export type RecipientLogoTheme = "dark" | "light";

export type RecipientLogoAsset = {
  content: Buffer;
  contentType: string;
  domain: string;
  height: number;
  id: string;
  updatedAt: Date;
  width: number;
  workspaceId: string;
  theme: RecipientLogoTheme;
};

export interface RecipientLogoRepository {
  find(input: {
    domain: string;
    theme: RecipientLogoTheme;
    workspaceId: string;
  }): Promise<RecipientLogoAsset | null>;
  upsert(input: {
    content: Buffer;
    contentType: string;
    domain: string;
    height: number;
    theme: RecipientLogoTheme;
    width: number;
    workspaceId: string;
  }): Promise<RecipientLogoAsset>;
}

export function createDbRecipientLogoRepository(
  database: Database = defaultDb,
): RecipientLogoRepository {
  return {
    async find(input) {
      const [asset] = await database
        .select()
        .from(recipientLogoAssets)
        .where(and(
          eq(recipientLogoAssets.workspaceId, input.workspaceId),
          eq(recipientLogoAssets.domain, input.domain),
          eq(recipientLogoAssets.theme, input.theme),
        ))
        .limit(1);

      return asset ? serializeAsset(asset) : null;
    },

    async upsert(input) {
      const [asset] = await database
        .insert(recipientLogoAssets)
        .values({
          workspaceId: input.workspaceId,
          domain: input.domain,
          theme: input.theme,
          contentType: input.contentType,
          byteSize: input.content.byteLength,
          width: input.width,
          height: input.height,
          content: input.content,
        })
        .onConflictDoUpdate({
          target: [
            recipientLogoAssets.workspaceId,
            recipientLogoAssets.domain,
            recipientLogoAssets.theme,
          ],
          set: {
            contentType: input.contentType,
            byteSize: input.content.byteLength,
            width: input.width,
            height: input.height,
            content: input.content,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!asset) {
        throw new Error("Recipient logo upsert did not return a row.");
      }

      return serializeAsset(asset);
    },
  };
}

export function createMemoryRecipientLogoRepository(): RecipientLogoRepository {
  const assets = new Map<string, RecipientLogoAsset>();

  return {
    async find(input) {
      return assets.get(assetKey(input)) ?? null;
    },
    async upsert(input) {
      const now = new Date();
      const key = assetKey(input);
      const existing = assets.get(key);
      const asset: RecipientLogoAsset = {
        content: Buffer.from(input.content),
        contentType: input.contentType,
        domain: input.domain,
        height: input.height,
        id: existing?.id ?? randomUUID(),
        theme: input.theme,
        updatedAt: now,
        width: input.width,
        workspaceId: input.workspaceId,
      };
      assets.set(key, asset);
      return asset;
    },
  };
}

function assetKey(input: {
  domain: string;
  theme: RecipientLogoTheme;
  workspaceId: string;
}) {
  return `${input.workspaceId}:${input.domain}:${input.theme}`;
}

function serializeAsset(asset: typeof recipientLogoAssets.$inferSelect): RecipientLogoAsset {
  return {
    content: Buffer.from(asset.content),
    contentType: asset.contentType,
    domain: asset.domain,
    height: asset.height,
    id: asset.id,
    theme: asset.theme as RecipientLogoTheme,
    updatedAt: asset.updatedAt,
    width: asset.width,
    workspaceId: asset.workspaceId,
  };
}
