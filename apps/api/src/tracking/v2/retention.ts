import type {
  TrackingV2ExpiredRecordingChunkRecord,
  TrackingV2Repository,
} from "./repository";
import type { TrackingV2RecordingObjectStore } from "./recording-object-store";
import { createTrackingV2SessionExpirationService } from "./session-expiration";

export type TrackingV2RetentionServiceOptions = {
  repository: TrackingV2Repository;
  recordingObjectStore?: TrackingV2RecordingObjectStore | null;
  now?: () => Date;
};

export type TrackingV2RetentionRunInput = {
  batchSize?: number;
  objectBatchSize?: number;
  now?: Date;
};

export type TrackingV2RetentionRunResult = {
  now: string;
  sessionsExpired: number;
  rawIpAddressesPruned: number;
  suppressionMarkersDeleted: number;
  eventsDeleted: number;
  recordingsExpired: number;
  recordingChunkObjectsDeleted: number;
  recordingChunkMetadataDeleted: number;
  recordingChunkDeleteFailures: number;
  recordingChunksSkippedWithoutStore: number;
  recordingsDeleted: number;
  sessionsDeleted: number;
};

export interface TrackingV2RetentionService {
  runOnce(input?: TrackingV2RetentionRunInput): Promise<TrackingV2RetentionRunResult>;
}

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_OBJECT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 5_000;

export function createTrackingV2RetentionService(
  options: TrackingV2RetentionServiceOptions,
): TrackingV2RetentionService {
  const now = options.now ?? (() => new Date());

  return {
    async runOnce(input = {}) {
      const runAt = input.now ?? now();
      const batchSize = normalizeBatchSize(input.batchSize, DEFAULT_BATCH_SIZE);
      const objectBatchSize = normalizeBatchSize(input.objectBatchSize, DEFAULT_OBJECT_BATCH_SIZE);

      const sessionExpiration = await createTrackingV2SessionExpirationService({
        repository: options.repository,
      }).runOnce({
        limit: batchSize,
        now: runAt,
      });
      const rawIpAddressesPruned = await options.repository.pruneRawIpAddresses({
        now: runAt,
        limit: batchSize,
      });
      const suppressionMarkersDeleted = await options.repository.pruneExpiredSuppressionMarkers({
        now: runAt,
        limit: batchSize,
      });
      const eventsDeleted = await options.repository.pruneExpiredEvents({
        now: runAt,
        limit: batchSize,
      });
      const recordingsExpired = await options.repository.expireRecordings({
        now: runAt,
        limit: batchSize,
      });
      const objectCleanup = await deleteExpiredRecordingChunks({
        chunks: await options.repository.listExpiredRecordingChunks({
          now: runAt,
          limit: objectBatchSize,
        }),
        objectStore: options.recordingObjectStore ?? null,
        repository: options.repository,
      });
      const recordingsDeleted = await options.repository.markExpiredRecordingsDeleted({
        now: runAt,
        limit: batchSize,
      });
      const sessionsDeleted = await options.repository.pruneExpiredSessions({
        now: runAt,
        limit: batchSize,
      });

      return {
        now: runAt.toISOString(),
        sessionsExpired: sessionExpiration.expired,
        rawIpAddressesPruned,
        suppressionMarkersDeleted,
        eventsDeleted,
        recordingsExpired,
        recordingChunkObjectsDeleted: objectCleanup.objectsDeleted,
        recordingChunkMetadataDeleted: objectCleanup.metadataDeleted,
        recordingChunkDeleteFailures: objectCleanup.deleteFailures,
        recordingChunksSkippedWithoutStore: objectCleanup.skippedWithoutStore,
        recordingsDeleted,
        sessionsDeleted,
      };
    },
  };
}

async function deleteExpiredRecordingChunks(input: {
  chunks: TrackingV2ExpiredRecordingChunkRecord[];
  objectStore: TrackingV2RecordingObjectStore | null;
  repository: TrackingV2Repository;
}) {
  if (input.chunks.length === 0) {
    return {
      objectsDeleted: 0,
      metadataDeleted: 0,
      deleteFailures: 0,
      skippedWithoutStore: 0,
    };
  }

  if (!input.objectStore) {
    return {
      objectsDeleted: 0,
      metadataDeleted: 0,
      deleteFailures: 0,
      skippedWithoutStore: input.chunks.length,
    };
  }

  const deletedChunkIds: string[] = [];
  let deleteFailures = 0;

  for (const chunk of input.chunks) {
    try {
      await input.objectStore.deleteObject(chunk.objectKey);
      deletedChunkIds.push(chunk.id);
    } catch {
      deleteFailures += 1;
    }
  }

  return {
    objectsDeleted: deletedChunkIds.length,
    metadataDeleted: await input.repository.deleteRecordingChunks({
      chunkIds: deletedChunkIds,
    }),
    deleteFailures,
    skippedWithoutStore: 0,
  };
}

function normalizeBatchSize(value: number | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

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
