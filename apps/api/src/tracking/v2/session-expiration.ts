import { TRACKING_V2_SESSION_STALE_AFTER_MS } from "@lightsite/tracking-schema";
import type { TrackingV2Repository } from "./repository";

export const TRACKING_V2_SESSION_EXPIRATION_INTERVAL_MS = 30_000;
export const TRACKING_V2_SESSION_EXPIRATION_BATCH_SIZE = 1_000;

export type TrackingV2SessionExpirationServiceOptions = {
  repository: TrackingV2Repository;
  now?: () => Date;
  staleAfterMs?: number;
};

export type TrackingV2SessionExpirationRunInput = {
  limit?: number;
  now?: Date;
};

export type TrackingV2SessionExpirationRunResult = {
  expired: number;
  now: string;
  staleBefore: string;
};

export interface TrackingV2SessionExpirationService {
  runOnce(input?: TrackingV2SessionExpirationRunInput): Promise<TrackingV2SessionExpirationRunResult>;
}

export function createTrackingV2SessionExpirationService(
  options: TrackingV2SessionExpirationServiceOptions,
): TrackingV2SessionExpirationService {
  const getNow = options.now ?? (() => new Date());
  const staleAfterMs = options.staleAfterMs ?? TRACKING_V2_SESSION_STALE_AFTER_MS;

  if (!Number.isInteger(staleAfterMs) || staleAfterMs < 1) {
    throw new TrackingV2SessionExpirationInputError("Session expiration timeout must be a positive integer.");
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

      return {
        expired,
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
