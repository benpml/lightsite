import { describe, expect, it, vi } from "vitest";
import type { TrackingV2RetentionRunResult, TrackingV2RetentionService } from "./retention";
import {
  runTrackingV2RetentionUntilIdle,
  TrackingV2RetentionRunnerInputError,
  TrackingV2RetentionUnhealthyError,
} from "./retention-runner";

const batchAt = new Date("2026-07-13T12:00:00.000Z");

describe("tracking v2 retention runner", () => {
  it("keeps running while a bounded batch is saturated", async () => {
    const runOnce = vi.fn()
      .mockResolvedValueOnce(result({ eventsDeleted: 500 }))
      .mockResolvedValueOnce(result());

    const output = await runTrackingV2RetentionUntilIdle({
      service: { runOnce },
      batchSize: 500,
      maxBatches: 3,
      now: sequentialClock(),
    });

    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(output).toMatchObject({ batches: 2, eventsDeleted: 500 });
  });

  it("fails immediately when replay object deletion fails", async () => {
    const error = await runTrackingV2RetentionUntilIdle({
      service: serviceReturning(result({
        recordingObjectDeleteFailures: 1,
        recordingObjectDeletionBacklog: 1,
      })),
      batchSize: 500,
      maxBatches: 3,
      now: sequentialClock(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TrackingV2RetentionUnhealthyError);
    expect((error as TrackingV2RetentionUnhealthyError).result)
      .toMatchObject({ batches: 1, recordingObjectDeletionBacklog: 1 });
  });

  it("fails when work remains after the configured safety ceiling", async () => {
    const runOnce = vi.fn().mockResolvedValue(result({ sessionsDeleted: 500 }));

    await expect(runTrackingV2RetentionUntilIdle({
      service: { runOnce },
      batchSize: 500,
      maxBatches: 2,
      now: sequentialClock(),
    })).rejects.toBeInstanceOf(TrackingV2RetentionUnhealthyError);
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-positive batch ceiling", async () => {
    await expect(runTrackingV2RetentionUntilIdle({
      service: serviceReturning(result()),
      batchSize: 500,
      maxBatches: 0,
    })).rejects.toBeInstanceOf(TrackingV2RetentionRunnerInputError);
  });
});

function result(overrides: Partial<TrackingV2RetentionRunResult> = {}): TrackingV2RetentionRunResult {
  const base: TrackingV2RetentionRunResult = {
    now: batchAt.toISOString(),
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
  return Object.assign(base, overrides);
}

function serviceReturning(output: TrackingV2RetentionRunResult): TrackingV2RetentionService {
  return { runOnce: vi.fn().mockResolvedValue(output) };
}

function sequentialClock() {
  let offset = 0;
  return () => new Date(batchAt.getTime() + offset++);
}
