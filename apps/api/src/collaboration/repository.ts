import { eq, sql } from "drizzle-orm"
import {
  db as defaultDb,
  siteCollaborationDocuments,
  sites,
  type Database,
  type SiteContent,
} from "@lightsite/db"
import type { SiteRecord } from "../sites/repository"

export type SiteCollaborationSnapshot = {
  site: SiteRecord
  state: Uint8Array | null
}

export interface SiteCollaborationRepository {
  load(siteId: string): Promise<SiteCollaborationSnapshot | null>
  persist(input: {
    siteId: string
    workspaceId: string
    state: Uint8Array
    draftContent: SiteContent
    updatedByUserId: string | null
  }): Promise<SiteRecord | null>
}

export function createDbSiteCollaborationRepository(
  database: Database = defaultDb,
): SiteCollaborationRepository {
  return {
    async load(siteId) {
      const [site] = await database
        .select()
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1)

      if (!site) {
        return null
      }

      const [collaborationDocument] = await database
        .select({ state: siteCollaborationDocuments.state })
        .from(siteCollaborationDocuments)
        .where(eq(siteCollaborationDocuments.siteId, siteId))
        .limit(1)

      return {
        site,
        state: collaborationDocument?.state ?? null,
      }
    },

    async persist(input) {
      return database.transaction(async (transaction) => {
        const [site] = await transaction
          .select()
          .from(sites)
          .where(eq(sites.id, input.siteId))
          .for("update")
          .limit(1)

        if (!site || site.workspaceId !== input.workspaceId || site.status === "archived") {
          return null
        }

        const [currentCollaborationDocument] = await transaction
          .select({ state: siteCollaborationDocuments.state })
          .from(siteCollaborationDocuments)
          .where(eq(siteCollaborationDocuments.siteId, input.siteId))
          .limit(1)

        if (currentCollaborationDocument && uint8ArraysAreEqual(
          currentCollaborationDocument.state,
          input.state,
        )) {
          return site
        }

        const now = new Date()

        await transaction
          .insert(siteCollaborationDocuments)
          .values({
            siteId: input.siteId,
            workspaceId: input.workspaceId,
            state: input.state,
            updatedByUserId: input.updatedByUserId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: siteCollaborationDocuments.siteId,
            set: {
              state: input.state,
              updatedByUserId: input.updatedByUserId,
              updatedAt: now,
            },
          })

        if (JSON.stringify(site.draftContent) === JSON.stringify(input.draftContent)) {
          return site
        }

        const [updatedSite] = await transaction
          .update(sites)
          .set({
            draftContent: input.draftContent,
            draftRevision: sql`${sites.draftRevision} + 1`,
            updatedByUserId: input.updatedByUserId,
            updatedAt: now,
          })
          .where(eq(sites.id, input.siteId))
          .returning()

        return updatedSite ?? null
      })
    },
  }
}

function uint8ArraysAreEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false
  }

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}
