import type {
  TrackingV2RetentionRunResult,
  TrackingV2RetentionService,
} from "./retention";

const additiveResultKeys = [
  "sessionsExpired",
  "endedRecordingsSettled",
  "staleRecordingsSettled",
  "recordingsExpired",
  "recordingObjectsQueued",
  "recordingObjectsDeleted",
  "recordingObjectDeleteFailures",
  "recordingsDeleted",
  "eventsDeleted",
  "sessionsDeleted",
  "manifestsDeleted",
] as const satisfies ReadonlyArray<keyof TrackingV2RetentionRunResult>;

export type TrackingV2RetentionRunnerResult = Omit<TrackingV2RetentionRunResult, "now"> & {
  batches: number;
  startedAt: string;
  completedAt: string;
};

export async function runTrackingV2RetentionUntilIdle(input: {
  service: TrackingV2RetentionService;
  batchSize: number;
  maxBatches: number;
  now?: () => Date;
}): Promise<TrackingV2RetentionRunnerResult> {
  if (!Number.isInteger(input.maxBatches) || input.maxBatches < 1) {
    throw new TrackingV2RetentionRunnerInputError("maxBatches must be a positive integer.");
  }

  const now = input.now ?? (() => new Date());
  const aggregate = emptyAggregate(now());
  let saturated = false;

  for (let batch = 1; batch <= input.maxBatches; batch += 1) {
    const result = await input.service.runOnce({ batchSize: input.batchSize });
    mergeResult(aggregate, result);
    aggregate.batches = batch;
    saturated = resultReachedBatchLimit(result, input.batchSize);

    if (result.recordingObjectDeleteFailures > 0) {
      throw new TrackingV2RetentionUnhealthyError(
        `${result.recordingObjectDeleteFailures} replay object deletion(s) failed.`,
        complete(aggregate, now()),
      );
    }

    if (!saturated && result.recordingObjectDeletionBacklog === 0) {
      return complete(aggregate, now());
    }
  }

  const completed = complete(aggregate, now());
  if (saturated || aggregate.recordingObjectDeletionBacklog > 0) {
    throw new TrackingV2RetentionUnhealthyError(
      `Retention may have more work after ${input.maxBatches} bounded batch(es).`,
      completed,
    );
  }
  return completed;
}

type TrackingRetentionAggregate = Omit<TrackingV2RetentionRunnerResult, "completedAt">;

function emptyAggregate(startedAt: Date): TrackingRetentionAggregate {
  return {
    batches: 0,
    startedAt: startedAt.toISOString(),
    sessionsExpired: 0,
    endedRecordingsSettled: 0,
    staleRecordingsSettled: 0,
    recordingsExpired: 0,
    recordingObjectsQueued: 0,
    recordingObjectsDeleted: 0,
    recordingObjectDeleteFailures: 0,
    recordingObjectDeletionBacklog: 0,
    recordingsDeleted: 0,
    eventsDeleted: 0,
    sessionsDeleted: 0,
    manifestsDeleted: 0,
  };
}

function mergeResult(aggregate: TrackingRetentionAggregate, result: TrackingV2RetentionRunResult) {
  for (const key of additiveResultKeys) aggregate[key] += result[key];
  aggregate.recordingObjectDeletionBacklog = result.recordingObjectDeletionBacklog;
}

function resultReachedBatchLimit(result: TrackingV2RetentionRunResult, batchSize: number) {
  return additiveResultKeys.some((key) => key !== "recordingObjectDeleteFailures" && result[key] >= batchSize);
}

function complete(aggregate: TrackingRetentionAggregate, completedAt: Date): TrackingV2RetentionRunnerResult {
  return { ...aggregate, completedAt: completedAt.toISOString() };
}

export class TrackingV2RetentionRunnerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackingV2RetentionRunnerInputError";
  }
}

export class TrackingV2RetentionUnhealthyError extends Error {
  constructor(message: string, readonly result: TrackingV2RetentionRunnerResult) {
    super(message);
    this.name = "TrackingV2RetentionUnhealthyError";
  }
}
