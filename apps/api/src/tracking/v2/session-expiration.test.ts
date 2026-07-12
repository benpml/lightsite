import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryTrackingV2Repository,
  type TrackingV2CreateSessionInput,
} from "./repository";
import {
  createTrackingV2SessionExpirationService,
  startTrackingV2SessionExpirationJob,
} from "./session-expiration";

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
      maxScrollDepthPercent: 50,
    });
    await repository.updateSessionHeartbeat({
      sessionId: fresh.id,
      activeAfter: new Date("2026-07-11T11:59:00.000Z"),
      occurredAt: new Date("2026-07-11T12:02:30.001Z"),
      activeMs: 30_000,
      maxScrollDepthPercent: null,
    });

    const result = await createTrackingV2SessionExpirationService({
      repository,
      staleAfterMs: 2 * 60_000,
    }).runOnce({
      now: new Date("2026-07-11T12:03:00.000Z"),
    });

    expect(result).toEqual({
      expired: 1,
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
    publishedVersionId,
    eventTokenHash: `hash_${input.publicSessionId}`,
    deviceIdHash: null,
    ipAddress: null,
    ipAddressHash: null,
    city: null,
    region: null,
    countryCode: null,
    deviceType: "desktop",
    osName: "macOS",
    browserName: "Chrome",
    userAgentFamily: "Chrome",
    referrerHost: null,
    initialPath: "/",
    startedAt: input.startedAt,
  };
}

function result(expired: number) {
  return {
    expired,
    now: "2026-07-11T12:00:00.000Z",
    staleBefore: "2026-07-11T11:58:00.000Z",
  };
}
