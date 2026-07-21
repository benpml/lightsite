import { TRACKING_V2_SESSION_STALE_AFTER_MS } from "@handout/tracking-schema";
import type { TrackingV2Repository } from "./repository";
import type { TrackingV2RecordingRepository } from "./recording-repository";

export const TRACKING_V2_SESSION_EXPIRATION_INTERVAL_MS = 30_000;
export const TRACKING_V2_SESSION_EXPIRATION_BATCH_SIZE = 1_000;
export const TRACKING_V2_RECORDING_SETTLEMENT_GRACE_MS = 30_000;

export type TrackingV2SessionExpirationServiceOptions = {
  repository: TrackingV2Repository;
  now?: () => Date;
  staleAfterMs?: number;
  recordingRepository?: TrackingV2RecordingRepository;
  recordingSettlementGraceMs?: number;
};

export type TrackingV2SessionExpirationRunInput = {
  limit?: number;
  now?: Date;
};

export type TrackingV2SessionExpirationRunResult = {
  expired: number;
  recordingsSettled: number;
  now: string;
  staleBefore: string;
};

export interface TrackingV2SessionExpirationService {
  runOnce(input?: TrackingV2SessionExpirationRunInput): Promise<TrackingV2SessionExpirationRunResult>;
}

export function createTrackingV2ReadReconciler(input: {
  service: TrackingV2SessionExpirationService;
  intervalMs?: number;
  now?: () => number;
  onError?: (error: unknown) => void;
  onResult?: (result: TrackingV2SessionExpirationRunResult) => void;
}) {
  const intervalMs = input.intervalMs ?? TRACKING_V2_SESSION_EXPIRATION_INTERVAL_MS;
  if (!Number.isInteger(intervalMs) || intervalMs < 1) {
    throw new TrackingV2SessionExpirationInputError("Session reconciliation interval must be a positive integer.");
  }
  const getTime = input.now ?? Date.now;
  let nextRunAt = 0;
  let inFlight: Promise<void> | null = null;

  return async () => {
    if (inFlight) return inFlight;
    const currentTime = getTime();
    if (currentTime < nextRunAt) return;
    nextRunAt = currentTime + intervalMs;
    inFlight = input.service.runOnce()
      .then((result) => input.onResult?.(result))
      .catch((error) => input.onError?.(error))
      .finally(() => { inFlight = null; });
    return inFlight;
  };
}

export function createTrackingV2SessionExpirationService(
  options: TrackingV2SessionExpirationServiceOptions,
): TrackingV2SessionExpirationService {
  const getNow = options.now ?? (() => new Date());
  const staleAfterMs = options.staleAfterMs ?? TRACKING_V2_SESSION_STALE_AFTER_MS;
  const recordingSettlementGraceMs = options.recordingSettlementGraceMs ?? TRACKING_V2_RECORDING_SETTLEMENT_GRACE_MS;

  if (!Number.isInteger(staleAfterMs) || staleAfterMs < 1) {
    throw new TrackingV2SessionExpirationInputError("Session expiration timeout must be a positive integer.");
  }
  if (!Number.isInteger(recordingSettlementGraceMs) || recordingSettlementGraceMs < 0) {
    throw new TrackingV2SessionExpirationInputError("Recording settlement grace period must be a non-negative integer.");
  }

  return {
    async runOnce(input = {}) {
      const runAt = input.now ?? getNow();
      const limit = normalizeBatchSize(input.limit);
      const staleBefore = new Date(runAt.getTime() - staleAfterMs);
      const expired = await options.repository.expireStaleSessions({
        now: runAt,
        staleBefore,
        limit,
      });
      let recordingsSettled = 0;
      if (options.recordingRepository) {
        const sessions = await options.repository.listEndedSessionsForRecording({
          endedBefore: new Date(runAt.getTime() - recordingSettlementGraceMs),
          limit,
        });
        recordingsSettled = await options.recordingRepository.settleEndedSessions({ sessions, now: runAt });
      }

      return {
        expired,
        recordingsSettled,
        now: runAt.toISOString(),
        staleBefore: staleBefore.toISOString(),
      };
    },
  };
}

export function startTrackingV2SessionExpirationJob(input: {
  service: TrackingV2SessionExpirationService;
  intervalMs?: number;
  onError?: (error: unknown) => void;
  onResult?: (result: TrackingV2SessionExpirationRunResult) => void;
}) {
  const intervalMs = input.intervalMs ?? TRACKING_V2_SESSION_EXPIRATION_INTERVAL_MS;
  if (!Number.isInteger(intervalMs) || intervalMs < 1) {
    throw new TrackingV2SessionExpirationInputError("Session expiration interval must be a positive integer.");
  }

  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) {
      return;
    }

    running = true;
    try {
      const result = await input.service.runOnce();
      input.onResult?.(result);
    } catch (error) {
      input.onError?.(error);
    } finally {
      running = false;
    }
  };

  void run();
  const interval = setInterval(() => void run(), intervalMs);
  interval.unref();

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

function normalizeBatchSize(value: number | undefined) {
  const batchSize = value ?? TRACKING_V2_SESSION_EXPIRATION_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5_000) {
    throw new TrackingV2SessionExpirationInputError("Session expiration batch size must be between 1 and 5000.");
  }

  return batchSize;
}

export class TrackingV2SessionExpirationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackingV2SessionExpirationInputError";
  }
}
