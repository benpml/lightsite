import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@handout/db";
import {
  trackingRecordingChunks,
  trackingRecordingObjectDeletions,
  trackingRecordings,
  trackingRecordingUsageDaily,
  trackingRecipientSessions,
} from "@handout/db/schema";
import type { TrackingV2ReadRecordingStatus } from "@handout/tracking-schema";

export type TrackingV2RecordingStatus = Exclude<TrackingV2ReadRecordingStatus, "disabled">;

export type TrackingV2RecordingRecord = {
  id: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  publicSessionId: string;
  status: TrackingV2RecordingStatus;
  uploadTokenHash: string;
  maxDurationMs: number;
  maxChunkBytes: number;
  maxEvents: number;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  eventCount: number;
  chunkCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  objectPrefix: string;
  stopReason: string | null;
  finalSequence: number | null;
  errorCode: string | null;
  expiresAt: Date;
};

export type TrackingV2RecordingChunkRecord = {
  id: string;
  recordingId: string;
  workspaceId: string;
  sessionId: string;
  sequence: number;
  objectKey: string;
  eventCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  hasFullSnapshot: boolean | null;
  checksumSha256: string;
  firstEventAt: Date;
  lastEventAt: Date;
  receivedAt: Date;
};

export type TrackingV2CreateRecordingInput = {
  id: string;
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  publicSessionId: string;
  uploadTokenHash: string;
  runtimeVersion: string;
  visitorNoticeVersion: number;
  consentGrantedAt: Date;
  consentSource: "prompt" | "remembered";
  maxDurationMs: number;
  maxChunkBytes: number;
  maxEvents: number;
  startedAt: Date;
  expiresAt: Date;
  usageDate: string;
  dailyRecordingLimit: number;
};

export type TrackingV2InsertRecordingChunkInput = {
  recordingId: string;
  workspaceId: string;
  sessionId: string;
  sequence: number;
  objectKey: string;
  eventCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  hasFullSnapshot: boolean;
  checksumSha256: string;
  firstEventAt: Date;
  lastEventAt: Date;
  receivedAt: Date;
  usageDate: string;
  dailyCompressedByteLimit: number;
  recordingByteLimit: number;
};

export type TrackingV2ExpiredRecordingChunkRecord = Pick<
  TrackingV2RecordingChunkRecord,
  "id" | "recordingId" | "objectKey"
>;

export type TrackingV2RecordingObjectDeletionRecord = {
  id: string;
  objectKey: string;
  attemptCount: number;
};

export class TrackingV2RecordingDailyLimitError extends Error {
  constructor() {
    super("The workspace replay usage limit has been reached.");
    this.name = "TrackingV2RecordingDailyLimitError";
  }
}

export class TrackingV2RecordingConflictError extends Error {
  constructor() {
    super("Recording chunk sequence already contains different data.");
    this.name = "TrackingV2RecordingConflictError";
  }
}

export class TrackingV2RecordingAggregateLimitError extends Error {
  constructor() {
    super("Recording aggregate limit has been reached.");
    this.name = "TrackingV2RecordingAggregateLimitError";
  }
}

export interface TrackingV2RecordingRepository {
  createRecording(input: TrackingV2CreateRecordingInput): Promise<TrackingV2RecordingRecord | null>;
  findForUpload(input: { recordingId: string; uploadTokenHash: string }): Promise<TrackingV2RecordingRecord | null>;
  findForWorkspace(input: { workspaceId: string; publicSessionId: string }): Promise<TrackingV2RecordingRecord | null>;
  findByIdForWorkspace(input: { workspaceId: string; recordingId: string }): Promise<TrackingV2RecordingRecord | null>;
  findChunk(input: { recordingId: string; sequence: number }): Promise<TrackingV2RecordingChunkRecord | null>;
  listChunks(recordingId: string): Promise<TrackingV2RecordingChunkRecord[]>;
  insertChunk(input: TrackingV2InsertRecordingChunkInput): Promise<{ duplicate: boolean; chunk: TrackingV2RecordingChunkRecord }>;
  requestCompletion(input: TrackingV2RecordingCompletion): Promise<void>;
  complete(input: TrackingV2RecordingCompletion & { status: "available" | "truncated" | "failed" }): Promise<void>;
  settleEndedSessions(input: { sessions: TrackingV2EndedRecordingSession[]; now: Date }): Promise<number>;
  expireStalePending(input: { staleBefore: Date; now: Date; limit: number }): Promise<number>;
  expireRecordings(input: { now: Date; limit: number }): Promise<number>;
  listExpiredChunks(input: { now: Date; limit: number }): Promise<TrackingV2ExpiredRecordingChunkRecord[]>;
  deleteChunkMetadata(chunkIds: string[]): Promise<number>;
  markExpiredDeleted(input: { now: Date; limit: number }): Promise<number>;
  enqueueObjectDeletion(objectKey: string): Promise<void>;
  listPendingObjectDeletions(input: { limit: number }): Promise<TrackingV2RecordingObjectDeletionRecord[]>;
  countPendingObjectDeletions(): Promise<number>;
  completeObjectDeletions(ids: string[]): Promise<number>;
  markObjectDeletionAttempts(input: { ids: string[]; attemptedAt: Date }): Promise<number>;
  getObjectKey(input: { workspaceId: string; recordingId: string; sequence: number; checksumSha256: string }): string;
}

export type TrackingV2RecordingCompletion = {
  recordingId: string;
  endedAt: Date;
  durationMs: number;
  stopReason: string;
  finalSequence: number | null;
  errorCode?: string | null;
  updatedAt: Date;
};

export type TrackingV2EndedRecordingSession = {
  id: string;
  endedAt: Date;
  endReason: "pagehide" | "visibility_timeout" | "idle_timeout" | "max_duration" | "heartbeat_timeout" | "server_expired" | "unknown";
};

const recordingSelection = {
  id: trackingRecordings.id,
  workspaceId: trackingRecordings.workspaceId,
  siteId: trackingRecordings.siteId,
  recipientId: trackingRecordings.recipientId,
  sessionId: trackingRecordings.sessionId,
  publicSessionId: trackingRecordings.publicSessionId,
  status: trackingRecordings.status,
  uploadTokenHash: trackingRecordings.uploadTokenHash,
  maxDurationMs: trackingRecordings.maxDurationMs,
  maxChunkBytes: trackingRecordings.maxChunkBytes,
  maxEvents: trackingRecordings.maxEvents,
  startedAt: trackingRecordings.startedAt,
  endedAt: trackingRecordings.endedAt,
  durationMs: trackingRecordings.durationMs,
  eventCount: trackingRecordings.eventCount,
  chunkCount: trackingRecordings.chunkCount,
  compressedBytes: trackingRecordings.compressedBytes,
  uncompressedBytes: trackingRecordings.uncompressedBytes,
  objectPrefix: trackingRecordings.objectPrefix,
  stopReason: trackingRecordings.stopReason,
  finalSequence: trackingRecordings.finalSequence,
  errorCode: trackingRecordings.errorCode,
  expiresAt: trackingRecordings.expiresAt,
};

const chunkSelection = {
  id: trackingRecordingChunks.id,
  recordingId: trackingRecordingChunks.recordingId,
  workspaceId: trackingRecordingChunks.workspaceId,
  sessionId: trackingRecordingChunks.sessionId,
  sequence: trackingRecordingChunks.sequence,
  objectKey: trackingRecordingChunks.objectKey,
  eventCount: trackingRecordingChunks.eventCount,
  compressedBytes: trackingRecordingChunks.compressedBytes,
  uncompressedBytes: trackingRecordingChunks.uncompressedBytes,
  hasFullSnapshot: trackingRecordingChunks.hasFullSnapshot,
  checksumSha256: trackingRecordingChunks.checksumSha256,
  firstEventAt: trackingRecordingChunks.firstEventAt,
  lastEventAt: trackingRecordingChunks.lastEventAt,
  receivedAt: trackingRecordingChunks.receivedAt,
};

export function createDbTrackingV2RecordingRepository(database: Database): TrackingV2RecordingRepository {
  return {
    async createRecording(input) {
      try {
        return await database.transaction(async (transaction) => {
          const objectPrefix = recordingObjectPrefix(input.workspaceId, input.id);
          const [recording] = await transaction
            .insert(trackingRecordings)
            .values({
              id: input.id,
              workspaceId: input.workspaceId,
              siteId: input.siteId,
              recipientId: input.recipientId,
              sessionId: input.sessionId,
              publicSessionId: input.publicSessionId,
              uploadTokenHash: input.uploadTokenHash,
              runtimeVersion: input.runtimeVersion,
              visitorNoticeVersion: input.visitorNoticeVersion,
              consentGrantedAt: input.consentGrantedAt,
              consentSource: input.consentSource,
              maxDurationMs: input.maxDurationMs,
              maxChunkBytes: input.maxChunkBytes,
              maxEvents: input.maxEvents,
              startedAt: input.startedAt,
              objectPrefix,
              expiresAt: input.expiresAt,
            })
            .onConflictDoNothing({ target: trackingRecordings.sessionId })
            .returning(recordingSelection);
          if (!recording) {
            const [existing] = await transaction.select(recordingSelection).from(trackingRecordings)
              .where(eq(trackingRecordings.sessionId, input.sessionId)).limit(1);
            return existing ? toRecordingRecord(existing) : null;
          }

          const usage = await transaction
          .insert(trackingRecordingUsageDaily)
          .values({ workspaceId: input.workspaceId, date: input.usageDate, recordingCount: 1, compressedBytes: 0 })
          .onConflictDoUpdate({
            target: [trackingRecordingUsageDaily.workspaceId, trackingRecordingUsageDaily.date],
            set: { recordingCount: sql`${trackingRecordingUsageDaily.recordingCount} + 1` },
            setWhere: sql`${trackingRecordingUsageDaily.recordingCount} < ${input.dailyRecordingLimit}`,
          })
          .returning({ recordingCount: trackingRecordingUsageDaily.recordingCount });
          if (usage.length === 0) throw new TrackingV2RecordingDailyLimitError();
          await transaction
            .update(trackingRecipientSessions)
            .set({ recordingStatus: "pending", updatedAt: input.startedAt })
            .where(eq(trackingRecipientSessions.id, input.sessionId));
          return toRecordingRecord(recording);
        });
      } catch (error) {
        if (error instanceof TrackingV2RecordingDailyLimitError) return null;
        throw error;
      }
    },

    async findForUpload(input) {
      const [recording] = await database.select(recordingSelection).from(trackingRecordings).where(and(
        eq(trackingRecordings.id, input.recordingId),
        eq(trackingRecordings.uploadTokenHash, input.uploadTokenHash),
      )).limit(1);
      return recording ? toRecordingRecord(recording) : null;
    },

    async findForWorkspace(input) {
      const [recording] = await database.select(recordingSelection).from(trackingRecordings).where(and(
        eq(trackingRecordings.workspaceId, input.workspaceId),
        eq(trackingRecordings.publicSessionId, input.publicSessionId),
      )).limit(1);
      return recording ? toRecordingRecord(recording) : null;
    },

    async findByIdForWorkspace(input) {
      const [recording] = await database.select(recordingSelection).from(trackingRecordings).where(and(
        eq(trackingRecordings.workspaceId, input.workspaceId),
        eq(trackingRecordings.id, input.recordingId),
      )).limit(1);
      return recording ? toRecordingRecord(recording) : null;
    },

    async findChunk(input) {
      const [chunk] = await database.select(chunkSelection).from(trackingRecordingChunks).where(and(
        eq(trackingRecordingChunks.recordingId, input.recordingId),
        eq(trackingRecordingChunks.sequence, input.sequence),
      )).limit(1);
      return chunk ? toChunkRecord(chunk) : null;
    },

    async listChunks(recordingId) {
      const chunks = await database.select(chunkSelection).from(trackingRecordingChunks)
        .where(eq(trackingRecordingChunks.recordingId, recordingId))
        .orderBy(asc(trackingRecordingChunks.sequence));
      return chunks.map(toChunkRecord);
    },

    async insertChunk(input) {
      return database.transaction(async (transaction) => {
        const [inserted] = await transaction.insert(trackingRecordingChunks).values({
          recordingId: input.recordingId,
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          sequence: input.sequence,
          objectKey: input.objectKey,
          eventCount: input.eventCount,
          compressedBytes: input.compressedBytes,
          uncompressedBytes: input.uncompressedBytes,
          hasFullSnapshot: input.hasFullSnapshot,
          checksumSha256: input.checksumSha256,
          firstEventAt: input.firstEventAt,
          lastEventAt: input.lastEventAt,
          receivedAt: input.receivedAt,
        }).onConflictDoNothing({
          target: [trackingRecordingChunks.recordingId, trackingRecordingChunks.sequence],
        }).returning(chunkSelection);
        if (!inserted) {
          const [existing] = await transaction.select(chunkSelection).from(trackingRecordingChunks).where(and(
            eq(trackingRecordingChunks.recordingId, input.recordingId),
            eq(trackingRecordingChunks.sequence, input.sequence),
          )).limit(1);
          if (!existing) throw new Error("Recording chunk conflict did not return a row.");
          if (existing.checksumSha256 !== input.checksumSha256) throw new TrackingV2RecordingConflictError();
          return { duplicate: true, chunk: toChunkRecord(existing) };
        }

        const usage = await transaction.insert(trackingRecordingUsageDaily).values({
          workspaceId: input.workspaceId,
          date: input.usageDate,
          recordingCount: 0,
          compressedBytes: input.compressedBytes,
        }).onConflictDoUpdate({
          target: [trackingRecordingUsageDaily.workspaceId, trackingRecordingUsageDaily.date],
          set: { compressedBytes: sql`${trackingRecordingUsageDaily.compressedBytes} + ${input.compressedBytes}` },
          setWhere: sql`${trackingRecordingUsageDaily.compressedBytes} + ${input.compressedBytes} <= ${input.dailyCompressedByteLimit}`,
        }).returning({ compressedBytes: trackingRecordingUsageDaily.compressedBytes });
        if (usage.length === 0) throw new TrackingV2RecordingDailyLimitError();

        const updated = await transaction.update(trackingRecordings).set({
          status: "recording",
          eventCount: sql`${trackingRecordings.eventCount} + ${input.eventCount}`,
          chunkCount: sql`${trackingRecordings.chunkCount} + 1`,
          compressedBytes: sql`${trackingRecordings.compressedBytes} + ${input.compressedBytes}`,
          uncompressedBytes: sql`${trackingRecordings.uncompressedBytes} + ${input.uncompressedBytes}`,
          updatedAt: input.receivedAt,
        }).where(and(
          eq(trackingRecordings.id, input.recordingId),
          sql`${trackingRecordings.status} in ('pending', 'recording')`,
          sql`${trackingRecordings.eventCount} + ${input.eventCount} <= ${trackingRecordings.maxEvents}`,
          sql`${trackingRecordings.uncompressedBytes} + ${input.uncompressedBytes} <= ${input.recordingByteLimit}`,
        )).returning({ id: trackingRecordings.id });
        if (updated.length === 0) throw new TrackingV2RecordingAggregateLimitError();
        return { duplicate: false, chunk: toChunkRecord(inserted) };
      });
    },

    async requestCompletion(input) {
      await database.update(trackingRecordings).set({
        status: "recording",
        endedAt: input.endedAt,
        durationMs: input.durationMs,
        stopReason: input.stopReason,
        finalSequence: input.finalSequence,
        errorCode: input.errorCode ?? null,
        updatedAt: input.updatedAt,
      }).where(and(
        eq(trackingRecordings.id, input.recordingId),
        sql`${trackingRecordings.status} in ('pending', 'recording')`,
        sql`${trackingRecordings.stopReason} is null`,
      ));
    },

    async complete(input) {
      await database.transaction(async (transaction) => {
        const recordings = await transaction.update(trackingRecordings).set({
          status: input.status,
          endedAt: input.endedAt,
          durationMs: input.durationMs,
          stopReason: input.stopReason,
          finalSequence: input.finalSequence,
          errorCode: input.errorCode ?? null,
          updatedAt: input.updatedAt,
        }).where(and(
          eq(trackingRecordings.id, input.recordingId),
          sql`${trackingRecordings.status} in ('pending', 'recording')`,
        )).returning({ sessionId: trackingRecordings.sessionId });
        const sessionId = recordings[0]?.sessionId;
        if (sessionId) {
          await transaction.update(trackingRecipientSessions).set({
            recordingStatus: input.status,
            recordingDurationMs: input.durationMs,
            updatedAt: input.updatedAt,
          }).where(eq(trackingRecipientSessions.id, sessionId));
        }
      });
    },

    async settleEndedSessions(input) {
      if (input.sessions.length === 0) return 0;
      const sessionsById = new Map(input.sessions.map((session) => [session.id, session]));
      const candidates = (await database.select(recordingSelection).from(trackingRecordings).where(and(
        inArray(trackingRecordings.sessionId, input.sessions.map((session) => session.id)),
        sql`${trackingRecordings.status} in ('pending', 'recording')`,
      ))).map(toRecordingRecord);
      if (candidates.length === 0) return 0;

      const allChunks = await database.select(chunkSelection).from(trackingRecordingChunks)
        .where(inArray(trackingRecordingChunks.recordingId, candidates.map((recording) => recording.id)))
        .orderBy(asc(trackingRecordingChunks.recordingId), asc(trackingRecordingChunks.sequence));
      const chunksByRecording = new Map<string, TrackingV2RecordingChunkRecord[]>();
      for (const row of allChunks) {
        const values = chunksByRecording.get(row.recordingId) ?? [];
        values.push(toChunkRecord(row));
        chunksByRecording.set(row.recordingId, values);
      }

      let settled = 0;
      for (const recording of candidates) {
        const session = sessionsById.get(recording.sessionId);
        if (!session) continue;
        const settlement = endedSessionSettlement(recording, session, chunksByRecording.get(recording.id) ?? [], input.now);
        settled += await database.transaction(async (transaction) => {
          const rows = await transaction.update(trackingRecordings).set({
            status: settlement.status,
            endedAt: settlement.endedAt,
            durationMs: settlement.durationMs,
            stopReason: settlement.stopReason,
            finalSequence: settlement.finalSequence,
            errorCode: settlement.errorCode,
            updatedAt: settlement.updatedAt,
          }).where(and(
            eq(trackingRecordings.id, settlement.recordingId),
            sql`${trackingRecordings.status} in ('pending', 'recording')`,
          )).returning({ sessionId: trackingRecordings.sessionId });
          const sessionId = rows[0]?.sessionId;
          if (!sessionId) return 0;
          await transaction.update(trackingRecipientSessions).set({
            recordingStatus: settlement.status,
            recordingDurationMs: settlement.durationMs,
            updatedAt: settlement.updatedAt,
          }).where(eq(trackingRecipientSessions.id, sessionId));
          return 1;
        });
      }
      return settled;
    },

    async expireStalePending(input) {
      const candidates = await database.select(recordingSelection).from(trackingRecordings).where(and(
        sql`${trackingRecordings.status} in ('pending', 'recording')`,
        lte(trackingRecordings.updatedAt, input.staleBefore),
      )).orderBy(asc(trackingRecordings.updatedAt)).limit(input.limit);
      let settled = 0;
      for (const candidate of candidates) {
        const chunks = await database.select(chunkSelection).from(trackingRecordingChunks)
          .where(eq(trackingRecordingChunks.recordingId, candidate.id))
          .orderBy(asc(trackingRecordingChunks.sequence));
        const contiguous = contiguousChunkPrefix(chunks.map(toChunkRecord));
        const lastChunk = contiguous.at(-1);
        const endedAt = lastChunk?.lastEventAt ?? candidate.startedAt;
        const durationMs = Math.max(0, Math.min(candidate.maxDurationMs, endedAt.getTime() - candidate.startedAt.getTime()));
        const status = hasReplayableSnapshot(contiguous)
          ? "truncated" as const
          : "failed" as const;
        const updated = await database.transaction(async (transaction) => {
          const rows = await transaction.update(trackingRecordings).set({
            status,
            errorCode: "upload_timeout",
            stopReason: "error",
            endedAt,
            durationMs,
            finalSequence: lastChunk?.sequence ?? null,
            updatedAt: input.now,
          }).where(and(
            eq(trackingRecordings.id, candidate.id),
            sql`${trackingRecordings.status} in ('pending', 'recording')`,
          )).returning({ sessionId: trackingRecordings.sessionId });
          if (rows[0]) {
            await transaction.update(trackingRecipientSessions).set({
              recordingStatus: status,
              recordingDurationMs: durationMs,
              updatedAt: input.now,
            }).where(eq(trackingRecipientSessions.id, rows[0].sessionId));
          }
          return rows.length;
        });
        settled += updated;
      }
      return settled;
    },

    async expireRecordings(input) {
      const candidates = await database.select({ id: trackingRecordings.id, sessionId: trackingRecordings.sessionId })
        .from(trackingRecordings).where(and(
          lte(trackingRecordings.expiresAt, input.now),
          sql`${trackingRecordings.status} not in ('expired', 'deleted')`,
        )).orderBy(asc(trackingRecordings.expiresAt)).limit(input.limit);
      if (candidates.length === 0) return 0;
      return database.transaction(async (transaction) => {
        const updated = await transaction.update(trackingRecordings).set({ status: "expired", updatedAt: input.now })
          .where(inArray(trackingRecordings.id, candidates.map((row) => row.id))).returning({ id: trackingRecordings.id });
        await transaction.update(trackingRecipientSessions).set({ recordingStatus: "expired", updatedAt: input.now })
          .where(inArray(trackingRecipientSessions.id, candidates.map((row) => row.sessionId)));
        return updated.length;
      });
    },

    listExpiredChunks(input) {
      return database.select({
        id: trackingRecordingChunks.id,
        recordingId: trackingRecordingChunks.recordingId,
        objectKey: trackingRecordingChunks.objectKey,
      }).from(trackingRecordingChunks).innerJoin(trackingRecordings, eq(trackingRecordingChunks.recordingId, trackingRecordings.id))
        .where(and(lte(trackingRecordings.expiresAt, input.now), sql`${trackingRecordings.status} in ('expired', 'deleted')`))
        .orderBy(asc(trackingRecordings.expiresAt), asc(trackingRecordingChunks.sequence)).limit(input.limit);
    },

    async deleteChunkMetadata(chunkIds) {
      if (chunkIds.length === 0) return 0;
      const deleted = await database.delete(trackingRecordingChunks).where(inArray(trackingRecordingChunks.id, chunkIds))
        .returning({ id: trackingRecordingChunks.id });
      return deleted.length;
    },

    async markExpiredDeleted(input) {
      const candidates = await database.select({ id: trackingRecordings.id }).from(trackingRecordings).where(and(
        lte(trackingRecordings.expiresAt, input.now),
        eq(trackingRecordings.status, "expired"),
        sql`not exists (select 1 from tracking_recording_chunks chunk where chunk.recording_id = ${trackingRecordings.id})`,
      )).orderBy(asc(trackingRecordings.expiresAt)).limit(input.limit);
      if (candidates.length === 0) return 0;
      const updated = await database.update(trackingRecordings).set({ status: "deleted", updatedAt: input.now })
        .where(inArray(trackingRecordings.id, candidates.map((row) => row.id))).returning({ id: trackingRecordings.id });
      return updated.length;
    },

    async enqueueObjectDeletion(objectKey) {
      await database.insert(trackingRecordingObjectDeletions).values({ objectKey }).onConflictDoNothing({
        target: trackingRecordingObjectDeletions.objectKey,
      });
    },

    listPendingObjectDeletions(input) {
      return database.select({
        id: trackingRecordingObjectDeletions.id,
        objectKey: trackingRecordingObjectDeletions.objectKey,
        attemptCount: trackingRecordingObjectDeletions.attemptCount,
      }).from(trackingRecordingObjectDeletions)
        .orderBy(asc(trackingRecordingObjectDeletions.createdAt))
        .limit(input.limit);
    },

    async countPendingObjectDeletions() {
      const [result] = await database.select({ count: sql<number>`count(*)::int` })
        .from(trackingRecordingObjectDeletions);
      return result?.count ?? 0;
    },

    async completeObjectDeletions(ids) {
      if (ids.length === 0) return 0;
      return (await database.delete(trackingRecordingObjectDeletions)
        .where(inArray(trackingRecordingObjectDeletions.id, ids))
        .returning({ id: trackingRecordingObjectDeletions.id })).length;
    },

    async markObjectDeletionAttempts(input) {
      if (input.ids.length === 0) return 0;
      return (await database.update(trackingRecordingObjectDeletions).set({
        attemptCount: sql`${trackingRecordingObjectDeletions.attemptCount} + 1`,
        lastAttemptAt: input.attemptedAt,
      }).where(inArray(trackingRecordingObjectDeletions.id, input.ids))
        .returning({ id: trackingRecordingObjectDeletions.id })).length;
    },

    getObjectKey(input) {
      return `${recordingObjectPrefix(input.workspaceId, input.recordingId)}/chunks/${String(input.sequence).padStart(6, "0")}.${input.checksumSha256}.json.gz`;
    },
  };
}

export function createMemoryTrackingV2RecordingRepository() {
  const recordings = new Map<string, TrackingV2RecordingRecord>();
  const chunks = new Map<string, TrackingV2RecordingChunkRecord>();
  const usage = new Map<string, { recordingCount: number; compressedBytes: number }>();
  const objectDeletions = new Map<string, TrackingV2RecordingObjectDeletionRecord>();
  let chunkId = 0;

  const repository: TrackingV2RecordingRepository = {
    async createRecording(input) {
      const usageKey = `${input.workspaceId}:${input.usageDate}`;
      const existing = [...recordings.values()].find((recording) => recording.sessionId === input.sessionId);
      if (existing) return cloneRecording(existing);
      const currentUsage = usage.get(usageKey) ?? { recordingCount: 0, compressedBytes: 0 };
      if (currentUsage.recordingCount >= input.dailyRecordingLimit) return null;
      usage.set(usageKey, { ...currentUsage, recordingCount: currentUsage.recordingCount + 1 });
      const recording: TrackingV2RecordingRecord = {
        id: input.id,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        recipientId: input.recipientId,
        sessionId: input.sessionId,
        publicSessionId: input.publicSessionId,
        status: "pending",
        uploadTokenHash: input.uploadTokenHash,
        maxDurationMs: input.maxDurationMs,
        maxChunkBytes: input.maxChunkBytes,
        maxEvents: input.maxEvents,
        startedAt: input.startedAt,
        endedAt: null,
        durationMs: 0,
        eventCount: 0,
        chunkCount: 0,
        compressedBytes: 0,
        uncompressedBytes: 0,
        objectPrefix: recordingObjectPrefix(input.workspaceId, input.id),
        stopReason: null,
        finalSequence: null,
        errorCode: null,
        expiresAt: input.expiresAt,
      };
      recordings.set(recording.id, recording);
      return cloneRecording(recording);
    },
    async findForUpload(input) {
      const recording = recordings.get(input.recordingId);
      return recording?.uploadTokenHash === input.uploadTokenHash ? cloneRecording(recording) : null;
    },
    async findForWorkspace(input) {
      const recording = [...recordings.values()].find((candidate) =>
        candidate.workspaceId === input.workspaceId && candidate.publicSessionId === input.publicSessionId);
      return recording ? cloneRecording(recording) : null;
    },
    async findByIdForWorkspace(input) {
      const recording = recordings.get(input.recordingId);
      return recording?.workspaceId === input.workspaceId ? cloneRecording(recording) : null;
    },
    async findChunk(input) {
      const chunk = chunks.get(`${input.recordingId}:${input.sequence}`);
      return chunk ? cloneChunk(chunk) : null;
    },
    async listChunks(recordingId) {
      return [...chunks.values()].filter((chunk) => chunk.recordingId === recordingId)
        .sort((left, right) => left.sequence - right.sequence).map(cloneChunk);
    },
    async insertChunk(input) {
      const key = `${input.recordingId}:${input.sequence}`;
      const existing = chunks.get(key);
      if (existing) {
        if (existing.checksumSha256 !== input.checksumSha256) throw new TrackingV2RecordingConflictError();
        return { duplicate: true, chunk: cloneChunk(existing) };
      }
      const recording = recordings.get(input.recordingId);
      if (!recording || (recording.status !== "pending" && recording.status !== "recording")) {
        throw new TrackingV2RecordingAggregateLimitError();
      }
      const usageKey = `${input.workspaceId}:${input.usageDate}`;
      const currentUsage = usage.get(usageKey) ?? { recordingCount: 0, compressedBytes: 0 };
      if (currentUsage.compressedBytes + input.compressedBytes > input.dailyCompressedByteLimit) {
        throw new TrackingV2RecordingDailyLimitError();
      }
      if (
        recording.eventCount + input.eventCount > recording.maxEvents ||
        recording.uncompressedBytes + input.uncompressedBytes > input.recordingByteLimit
      ) {
        throw new TrackingV2RecordingAggregateLimitError();
      }
      usage.set(usageKey, { ...currentUsage, compressedBytes: currentUsage.compressedBytes + input.compressedBytes });
      const chunk: TrackingV2RecordingChunkRecord = { id: `memory-chunk-${++chunkId}`, ...input };
      chunks.set(key, chunk);
      recordings.set(recording.id, {
        ...recording,
        status: "recording",
        eventCount: recording.eventCount + input.eventCount,
        chunkCount: recording.chunkCount + 1,
        compressedBytes: recording.compressedBytes + input.compressedBytes,
        uncompressedBytes: recording.uncompressedBytes + input.uncompressedBytes,
      });
      return { duplicate: false, chunk: cloneChunk(chunk) };
    },
    async requestCompletion(input) {
      const recording = recordings.get(input.recordingId);
      if (!recording || !mutableMemoryRecording(recording) || recording.stopReason !== null) return;
      recordings.set(recording.id, { ...recording, status: "recording", ...completionFields(input) });
    },
    async complete(input) {
      const recording = recordings.get(input.recordingId);
      if (recording && mutableMemoryRecording(recording)) {
        recordings.set(recording.id, { ...recording, status: input.status, ...completionFields(input) });
      }
    },
    async settleEndedSessions(input) {
      const sessionsById = new Map(input.sessions.map((session) => [session.id, session]));
      let count = 0;
      for (const recording of recordings.values()) {
        if (!mutableMemoryRecording(recording)) continue;
        const session = sessionsById.get(recording.sessionId);
        if (!session) continue;
        const settlement = endedSessionSettlement(
          recording,
          session,
          await repository.listChunks(recording.id),
          input.now,
        );
        recordings.set(recording.id, { ...recording, ...settlement });
        count += 1;
      }
      return count;
    },
    async expireStalePending(input) {
      let count = 0;
      for (const recording of recordings.values()) {
        if (count >= input.limit || !mutableMemoryRecording(recording) || recording.startedAt > input.staleBefore) continue;
        const prefix = contiguousChunkPrefix(await repository.listChunks(recording.id));
        const last = prefix.at(-1);
        const endedAt = last?.lastEventAt ?? recording.startedAt;
        recordings.set(recording.id, {
          ...recording,
          status: hasReplayableSnapshot(prefix) ? "truncated" : "failed",
          endedAt,
          durationMs: Math.min(recording.maxDurationMs, Math.max(0, endedAt.getTime() - recording.startedAt.getTime())),
          finalSequence: last?.sequence ?? null,
          stopReason: "error",
          errorCode: "upload_timeout",
        });
        count += 1;
      }
      return count;
    },
    async expireRecordings(input) {
      let count = 0;
      for (const recording of recordings.values()) {
        if (count >= input.limit || recording.expiresAt > input.now || recording.status === "expired" || recording.status === "deleted") continue;
        recordings.set(recording.id, { ...recording, status: "expired" });
        count += 1;
      }
      return count;
    },
    async listExpiredChunks(input) {
      return [...chunks.values()].filter((chunk) => {
        const recording = recordings.get(chunk.recordingId);
        return recording && recording.expiresAt <= input.now && (recording.status === "expired" || recording.status === "deleted");
      }).slice(0, input.limit).map(({ id, recordingId, objectKey }) => ({ id, recordingId, objectKey }));
    },
    async deleteChunkMetadata(chunkIds) {
      const ids = new Set(chunkIds);
      let count = 0;
      for (const [key, chunk] of chunks) if (ids.has(chunk.id)) {
        chunks.delete(key);
        objectDeletions.set(chunk.objectKey, {
          id: `memory-deletion-${objectDeletions.size + 1}`,
          objectKey: chunk.objectKey,
          attemptCount: 0,
        });
        count += 1;
      }
      return count;
    },
    async markExpiredDeleted(input) {
      let count = 0;
      for (const recording of recordings.values()) {
        if (count >= input.limit || recording.status !== "expired" || recording.expiresAt > input.now) continue;
        if ([...chunks.values()].some((chunk) => chunk.recordingId === recording.id)) continue;
        recordings.set(recording.id, { ...recording, status: "deleted" });
        count += 1;
      }
      return count;
    },
    async enqueueObjectDeletion(objectKey) {
      if (objectDeletions.has(objectKey)) return;
      objectDeletions.set(objectKey, {
        id: `memory-deletion-${objectDeletions.size + 1}`,
        objectKey,
        attemptCount: 0,
      });
    },
    async listPendingObjectDeletions(input) {
      return [...objectDeletions.values()].slice(0, input.limit).map((record) => ({ ...record }));
    },
    async countPendingObjectDeletions() {
      return objectDeletions.size;
    },
    async completeObjectDeletions(ids) {
      const selected = new Set(ids);
      let count = 0;
      for (const [key, record] of objectDeletions) if (selected.has(record.id)) { objectDeletions.delete(key); count += 1; }
      return count;
    },
    async markObjectDeletionAttempts(input) {
      const selected = new Set(input.ids);
      let count = 0;
      for (const [key, record] of objectDeletions) if (selected.has(record.id)) {
        objectDeletions.set(key, { ...record, attemptCount: record.attemptCount + 1 });
        count += 1;
      }
      return count;
    },
    getObjectKey(input) {
      return `${recordingObjectPrefix(input.workspaceId, input.recordingId)}/chunks/${String(input.sequence).padStart(6, "0")}.${input.checksumSha256}.json.gz`;
    },
  };

  return { repository, recordings, chunks, usage, objectDeletions };
}

function recordingObjectPrefix(workspaceId: string, recordingId: string) {
  return `tracking/v2/workspaces/${workspaceId}/recordings/${recordingId}`;
}

function toRecordingRecord(
  record: Omit<TrackingV2RecordingRecord, "status"> & { status: TrackingV2ReadRecordingStatus },
): TrackingV2RecordingRecord {
  return { ...record, status: record.status as TrackingV2RecordingStatus };
}

function toChunkRecord(record: typeof trackingRecordingChunks.$inferSelect): TrackingV2RecordingChunkRecord {
  return record;
}

function contiguousChunkPrefix(chunks: TrackingV2RecordingChunkRecord[]) {
  const prefix: TrackingV2RecordingChunkRecord[] = [];
  for (const chunk of chunks) {
    if (chunk.sequence !== prefix.length) break;
    prefix.push(chunk);
  }
  return prefix;
}

function endedSessionSettlement(
  recording: TrackingV2RecordingRecord,
  session: TrackingV2EndedRecordingSession,
  chunks: TrackingV2RecordingChunkRecord[],
  now: Date,
): TrackingV2RecordingCompletion & { status: "available" | "truncated" | "failed"; errorCode: string | null } {
  const prefix = contiguousChunkPrefix(chunks);
  const requestedCompletion = recording.endedAt !== null && recording.stopReason !== null;
  const requestedChunksPresent = recording.finalSequence === null
    ? prefix.length === 0
    : prefix.at(-1)?.sequence === recording.finalSequence;

  if (requestedCompletion && requestedChunksPresent) {
    const stopReason = recording.stopReason;
    if (stopReason === null) throw new Error("Completion settlement requires a stop reason.");
    const hasSnapshot = hasReplayableSnapshot(prefix);
    return {
      recordingId: recording.id,
      status: completionStatus(stopReason, prefix),
      endedAt: recording.endedAt!,
      durationMs: recording.durationMs,
      stopReason,
      finalSequence: recording.finalSequence,
      errorCode: !hasSnapshot ? "missing_snapshot" : recording.errorCode,
      updatedAt: now,
    };
  }

  const last = prefix.at(-1);
  const endedAt = last?.lastEventAt ?? session.endedAt;
  return {
    recordingId: recording.id,
    status: hasReplayableSnapshot(prefix) ? "truncated" : "failed",
    endedAt,
    durationMs: Math.max(0, Math.min(recording.maxDurationMs, endedAt.getTime() - recording.startedAt.getTime())),
    stopReason: recording.stopReason ?? recordingStopReasonForSession(session.endReason),
    finalSequence: last?.sequence ?? null,
    errorCode: requestedCompletion ? "incomplete_upload" : "missing_completion",
    updatedAt: now,
  };
}

function completionStatus(stopReason: string, chunks: TrackingV2RecordingChunkRecord[]) {
  if (!hasReplayableSnapshot(chunks) || stopReason === "error") return "failed" as const;
  if (["duration_cap", "size_cap", "event_cap", "daily_cap"].includes(stopReason)) return "truncated" as const;
  return "available" as const;
}

function hasReplayableSnapshot(chunks: TrackingV2RecordingChunkRecord[]) {
  return chunks.some((chunk) => chunk.hasFullSnapshot === true);
}

function recordingStopReasonForSession(endReason: TrackingV2EndedRecordingSession["endReason"]) {
  if (endReason === "pagehide") return "pagehide";
  if (endReason === "visibility_timeout") return "hidden_timeout";
  if (endReason === "max_duration") return "duration_cap";
  return "error";
}

function cloneRecording(recording: TrackingV2RecordingRecord) {
  return { ...recording };
}

function cloneChunk(chunk: TrackingV2RecordingChunkRecord) {
  return { ...chunk };
}

function mutableMemoryRecording(recording: TrackingV2RecordingRecord) {
  return recording.status === "pending" || recording.status === "recording";
}

function completionFields(input: TrackingV2RecordingCompletion) {
  return {
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    stopReason: input.stopReason,
    finalSequence: input.finalSequence,
    errorCode: input.errorCode ?? null,
  };
}
