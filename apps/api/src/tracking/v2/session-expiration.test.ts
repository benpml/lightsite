import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryTrackingV2Repository,
  type TrackingV2CreateSessionInput,
} from "./repository";
import {
  createTrackingV2ReadReconciler,
  createTrackingV2SessionExpirationService,
  startTrackingV2SessionExpirationJob,
} from "./session-expiration";
import { createMemoryTrackingV2RecordingRepository } from "./recording-repository";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const publishedVersionId = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.useRealTimers();
});

describe("tracking v2 session expiration", () => {
  it("expires stale active sessions at their last trustworthy signal", async () => {
    const repository = createMemoryTrackingV2Repository();
    const stale = await repository.createSession(sessionInput({
      publicSessionId: "session_stale",
      startedAt: new Date("2026-07-11T12:00:00.000Z"),
    }));
    const fresh = await repository.createSession(sessionInput({
      publicSessionId: "session_fresh",
      startedAt: new Date("2026-07-11T12:01:00.000Z"),
    }));
    await repository.updateSessionHeartbeat({
      sessionId: stale.id,
      activeAfter: new Date("2026-07-11T11:58:00.000Z"),
      occurredAt: new Date("2026-07-11T12:01:00.000Z"),
      activeMs: 30_000,
    });
    await repository.updateSessionHeartbeat({
      sessionId: fresh.id,
      activeAfter: new Date("2026-07-11T11:59:00.000Z"),
      occurredAt: new Date("2026-07-11T12:02:30.001Z"),
      activeMs: 30_000,
    });

    const result = await createTrackingV2SessionExpirationService({
      repository,
      staleAfterMs: 2 * 60_000,
    }).runOnce({
      now: new Date("2026-07-11T12:03:00.000Z"),
    });

    expect(result).toEqual({
      expired: 1,
      recordingsSettled: 0,
      now: "2026-07-11T12:03:00.000Z",
      staleBefore: "2026-07-11T12:01:00.000Z",
    });
    expect(repository.sessions.get("session_stale")).toMatchObject({
      state: "expired",
      endedAt: new Date("2026-07-11T12:01:00.000Z"),
      lastSeenAt: new Date("2026-07-11T12:01:00.000Z"),
      endReason: "server_expired",
      activeMs: 30_000,
      durationMs: 60_000,
    });
    expect(repository.sessions.get("session_fresh")).toMatchObject({
      state: "active",
      endedAt: null,
      endReason: null,
      durationMs: null,
    });
  });

  it("processes the oldest stale sessions in bounded batches", async () => {
    const repository = createMemoryTrackingV2Repository();
    await repository.createSession(sessionInput({
      publicSessionId: "session_oldest",
      startedAt: new Date("2026-07-11T11:00:00.000Z"),
    }));
    await repository.createSession(sessionInput({
      publicSessionId: "session_newer",
      startedAt: new Date("2026-07-11T11:01:00.000Z"),
    }));
    const service = createTrackingV2SessionExpirationService({ repository });

    const first = await service.runOnce({
      limit: 1,
      now: new Date("2026-07-11T12:00:00.000Z"),
    });
    const second = await service.runOnce({
      limit: 1,
      now: new Date("2026-07-11T12:00:00.000Z"),
    });

    expect(first.expired).toBe(1);
    expect(second.expired).toBe(1);
    expect(repository.sessions.get("session_oldest")?.state).toBe("expired");
    expect(repository.sessions.get("session_newer")?.state).toBe("expired");
  });

  it("never moves session time backward when lifecycle signals arrive out of order", async () => {
    const repository = createMemoryTrackingV2Repository();
    const session = await repository.createSession(sessionInput({
      publicSessionId: "session-reordered",
      startedAt: new Date("2026-07-11T12:00:00.000Z"),
    }));
    await repository.updateSessionHeartbeat({
      sessionId: session.id,
      activeAfter: new Date("2026-07-11T11:58:00.000Z"),
      occurredAt: new Date("2026-07-11T12:01:00.000Z"),
      activeMs: 30_000,
    });
    await repository.updateSessionHeartbeat({
      sessionId: session.id,
      activeAfter: new Date("2026-07-11T11:58:00.000Z"),
      occurredAt: new Date("2026-07-11T12:00:30.000Z"),
      activeMs: 20_000,
    });
    await repository.endSession({
      sessionId: session.id,
      activeAfter: new Date("2026-07-11T11:58:00.000Z"),
      occurredAt: new Date("2026-07-11T12:00:45.000Z"),
      reason: "pagehide",
      activeMs: 25_000,
    });

    expect(repository.sessions.get("session-reordered")).toMatchObject({
      lastSeenAt: new Date("2026-07-11T12:01:00.000Z"),
      endedAt: new Date("2026-07-11T12:01:00.000Z"),
      activeMs: 30_000,
      durationMs: 60_000,
    });
  });

  it("settles an ended replay even when the browser never sends completion metadata", async () => {
    const repository = createMemoryTrackingV2Repository();
    const recording = createMemoryTrackingV2RecordingRepository();
    const startedAt = new Date("2026-07-11T12:00:00.000Z");
    const endedAt = new Date("2026-07-11T12:00:15.000Z");
    const session = await repository.createSession(sessionInput({
      publicSessionId: "session_abandoned_replay",
      startedAt,
    }));
    const storedSession = repository.sessions.get("session_abandoned_replay");
    if (!storedSession) throw new Error("Expected memory session.");
    storedSession.recordingStatus = "recording";
    const created = await recording.repository.createRecording({
      id: "77777777-7777-4777-8777-777777777777",
      workspaceId,
      siteId,
      recipientId: null,
      sessionId: session.id,
      publicSessionId: session.publicSessionId,
      uploadTokenHash: "upload-token-hash",
      runtimeVersion: "test",
      visitorNoticeVersion: 1,
      consentGrantedAt: startedAt,
      consentSource: "prompt",
      maxDurationMs: 600_000,
      maxChunkBytes: 524_288,
      maxEvents: 20_000,
      startedAt,
      expiresAt: new Date("2026-07-25T12:00:00.000Z"),
      usageDate: "2026-07-11",
      dailyRecordingLimit: 1_000,
    });
    if (!created) throw new Error("Expected memory recording.");
    await recording.repository.insertChunk({
      recordingId: created.id,
      workspaceId,
      sessionId: session.id,
      sequence: 0,
      objectKey: "recordings/test/chunk-0.json.gz",
      eventCount: 1,
      compressedBytes: 100,
      uncompressedBytes: 200,
      hasFullSnapshot: true,
      checksumSha256: "a".repeat(64),
      firstEventAt: startedAt,
      lastEventAt: endedAt,
      receivedAt: endedAt,
      usageDate: "2026-07-11",
      dailyCompressedByteLimit: 1_000_000,
      recordingByteLimit: 1_000_000,
    });
    await repository.endSession({
      sessionId: session.id,
      activeAfter: new Date("2026-07-11T11:58:00.000Z"),
      occurredAt: endedAt,
      reason: "pagehide",
      activeMs: 15_000,
    });

    const result = await createTrackingV2SessionExpirationService({
      repository,
      recordingRepository: recording.repository,
      recordingSettlementGraceMs: 30_000,
    }).runOnce({ now: new Date("2026-07-11T12:00:45.000Z") });

    expect(result.recordingsSettled).toBe(1);
    expect(recording.recordings.get(created.id)).toMatchObject({
      status: "truncated",
      finalSequence: 0,
      stopReason: "pagehide",
      errorCode: "missing_completion",
    });
  });

  it("runs immediately, does not overlap, and stops cleanly", async () => {
    vi.useFakeTimers();
    let releaseFirstRun: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    const runOnce = vi.fn()
      .mockImplementationOnce(async () => {
        await firstRun;
        return result(1);
      })
      .mockResolvedValue(result(0));
    const stop = startTrackingV2SessionExpirationJob({
      service: { runOnce },
      intervalMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(runOnce).toHaveBeenCalledTimes(1);

    releaseFirstRun?.();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runOnce).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent tracking reads and performs no idle polling", async () => {
    let currentTime = 1_000;
    let releaseRun: (() => void) | undefined;
    const pendingRun = new Promise<void>((resolve) => { releaseRun = resolve; });
    const runOnce = vi.fn()
      .mockImplementationOnce(async () => {
        await pendingRun;
        return result(0);
      })
      .mockResolvedValue(result(0));
    const reconcile = createTrackingV2ReadReconciler({
      service: { runOnce },
      intervalMs: 30_000,
      now: () => currentTime,
    });

    const first = reconcile();
    const concurrent = reconcile();
    expect(runOnce).toHaveBeenCalledTimes(1);
    releaseRun?.();
    await Promise.all([first, concurrent]);
    await reconcile();
    expect(runOnce).toHaveBeenCalledTimes(1);

    currentTime += 30_000;
    await reconcile();
    expect(runOnce).toHaveBeenCalledTimes(2);
  });
});

function sessionInput(input: {
  publicSessionId: string;
  startedAt: Date;
}): TrackingV2CreateSessionInput {
  return {
    publicSessionId: input.publicSessionId,
    workspaceId,
    siteId,
    recipientId: null,
    recipientRevision: null,
    publishedVersionId,
    manifestId: "44444444-4444-4444-8444-444444444444",
    eventTokenHash: `hash_${input.publicSessionId}`,
    initialPageId: "page-overview",
    initialPageLabel: "Overview",
    city: null,
    region: null,
    countryCode: null,
    deviceType: "desktop",
    osName: "macOS",
    browserName: "Chrome",
    startedAt: input.startedAt,
    receivedAt: input.startedAt,
  };
}

function result(expired: number) {
  return {
    expired,
    recordingsSettled: 0,
    now: "2026-07-11T12:00:00.000Z",
    staleBefore: "2026-07-11T11:58:00.000Z",
  };
}
