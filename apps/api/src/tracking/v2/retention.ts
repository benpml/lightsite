import type { TrackingV2Repository } from "./repository";
import type { TrackingV2RecordingObjectStore } from "./recording-object-store";
import type { TrackingV2RecordingRepository } from "./recording-repository";
import { createTrackingV2SessionExpirationService } from "./session-expiration";

export type TrackingV2RetentionServiceOptions = {
  repository: TrackingV2Repository;
  recording?: {
    objectStore: TrackingV2RecordingObjectStore;
    repository: TrackingV2RecordingRepository;
  };
  now?: () => Date;
};

export type TrackingV2RetentionRunResult = {
  now: string;
  sessionsExpired: number;
  endedRecordingsSettled: number;
  staleRecordingsSettled: number;
  recordingsExpired: number;
  recordingObjectsQueued: number;
  recordingObjectsDeleted: number;
  recordingObjectDeleteFailures: number;
  recordingObjectDeletionBacklog: number;
  recordingsDeleted: number;
  eventsDeleted: number;
  sessionsDeleted: number;
  manifestsDeleted: number;
};

export interface TrackingV2RetentionService {
  runOnce(input?: { batchSize?: number; now?: Date }): Promise<TrackingV2RetentionRunResult>;
}

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5_000;
const STALE_RECORDING_UPLOAD_MS = 15 * 60_000;
const RETENTION_INTERVAL_MS = 15 * 60_000;
const OBJECT_DELETE_CONCURRENCY = 8;

export function createTrackingV2RetentionService(options: TrackingV2RetentionServiceOptions): TrackingV2RetentionService {
  const now = options.now ?? (() => new Date());
  return {
    async runOnce(input = {}) {
      const runAt = input.now ?? now();
      const limit = normalizeBatchSize(input.batchSize);
      const expiration = await createTrackingV2SessionExpirationService({
        repository: options.repository,
        recordingRepository: options.recording?.repository,
      }).runOnce({ limit, now: runAt });
      const sessionsExpired = expiration.expired;
      const endedRecordingsSettled = expiration.recordingsSettled;
      let staleRecordingsSettled = 0;
      let recordingsExpired = 0;
      let recordingObjectsQueued = 0;
      let recordingObjectsDeleted = 0;
      let recordingObjectDeleteFailures = 0;
      let recordingObjectDeletionBacklog = 0;
      let recordingsDeleted = 0;
      if (options.recording) {
        staleRecordingsSettled = await options.recording.repository.expireStalePending({
          staleBefore: new Date(runAt.getTime() - STALE_RECORDING_UPLOAD_MS),
          now: runAt,
          limit,
        });
        recordingsExpired = await options.recording.repository.expireRecordings({ now: runAt, limit });
        const chunks = await options.recording.repository.listExpiredChunks({ now: runAt, limit });
        recordingObjectsQueued = await options.recording.repository.deleteChunkMetadata(chunks.map((chunk) => chunk.id));
        recordingsDeleted = await options.recording.repository.markExpiredDeleted({ now: runAt, limit });
        const pendingDeletions = await options.recording.repository.listPendingObjectDeletions({ limit });
        const deletionResults = await mapConcurrent(pendingDeletions, OBJECT_DELETE_CONCURRENCY, async (deletion) => {
          try {
            await options.recording!.objectStore.deleteObject(deletion.objectKey);
            return { id: deletion.id, deleted: true as const };
          } catch {
            return { id: deletion.id, deleted: false as const };
          }
        });
        const successfulIds = deletionResults.filter((result) => result.deleted).map((result) => result.id);
        const failedIds = deletionResults.filter((result) => !result.deleted).map((result) => result.id);
        recordingObjectsDeleted = await options.recording.repository.completeObjectDeletions(successfulIds);
        recordingObjectDeleteFailures = await options.recording.repository.markObjectDeletionAttempts({
          ids: failedIds,
          attemptedAt: runAt,
        });
        recordingObjectDeletionBacklog = await options.recording.repository.countPendingObjectDeletions();
      }
      const eventsDeleted = await options.repository.pruneExpiredEvents({ now: runAt, limit });
      const sessionsDeleted = await options.repository.pruneExpiredSessions({ now: runAt, limit });
      const manifestsDeleted = await options.repository.pruneUnreferencedManifests({ now: runAt, limit });
      return {
        now: runAt.toISOString(),
        sessionsExpired,
        endedRecordingsSettled,
        staleRecordingsSettled,
        recordingsExpired,
        recordingObjectsQueued,
        recordingObjectsDeleted,
        recordingObjectDeleteFailures,
        recordingObjectDeletionBacklog,
        recordingsDeleted,
        eventsDeleted,
        sessionsDeleted,
        manifestsDeleted,
      };
    },
  };
}

export function startTrackingV2RetentionJob(input: {
  service: TrackingV2RetentionService;
  intervalMs?: number;
  onError?: (error: unknown) => void;
  onResult?: (result: TrackingV2RetentionRunResult) => void;
}) {
  const intervalMs = input.intervalMs ?? RETENTION_INTERVAL_MS;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      input.onResult?.(await input.service.runOnce());
    } catch (error) {
      input.onError?.(error);
    } finally {
      running = false;
    }
  };
  const interval = setInterval(() => void run(), intervalMs);
  void run();
  return () => clearInterval(interval);
}

async function mapConcurrent<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  operation: (value: TInput) => Promise<TOutput>,
) {
  const output = new Array<TOutput>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await operation(values[index]!);
    }
  }));
  return output;
}

function normalizeBatchSize(value: number | undefined) {
  if (value === undefined) return DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
    throw new TrackingV2RetentionInputError("Retention batch size must be between 1 and 5000.");
  }
  return value;
}

export class TrackingV2RetentionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackingV2RetentionInputError";
  }
}
