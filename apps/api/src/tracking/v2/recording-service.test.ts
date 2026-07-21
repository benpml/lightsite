import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { TRACKING_V2_RECORDING_SCHEMA_VERSION } from "@handout/tracking-schema";

import { createMemoryTrackingV2RecordingObjectStore } from "./recording-object-store";
import { createMemoryTrackingV2RecordingRepository } from "./recording-repository";
import { createTrackingV2RecordingService, TrackingV2RecordingInvalidError } from "./recording-service";

const now = new Date("2026-07-13T12:00:00.000Z");
const workspaceId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";

function harness() {
  const memory = createMemoryTrackingV2RecordingRepository();
  const objectStore = createMemoryTrackingV2RecordingObjectStore();
  const service = createTrackingV2RecordingService({
    repository: memory.repository,
    objectStore,
    tokenSecret: "recording-service-secret-that-is-long-enough",
    now: () => now,
  });
  return { ...memory, objectStore, service };
}

describe("tracking v2 recording service", () => {
  it("requires a current affirmative visitor consent receipt", async () => {
    const { service } = harness();
    await expect(service.start(startInput(undefined))).resolves.toMatchObject({ enabled: false });
    await expect(service.start(startInput({
      noticeVersion: 1,
      grantedAt: "2025-01-01T00:00:00.000Z",
      source: "remembered",
    }))).resolves.toMatchObject({ enabled: false });
    await expect(service.start(startInput(validConsent()))).resolves.toMatchObject({ enabled: true });
  });

  it("returns the same recording capability when session start is retried", async () => {
    const { service, usage } = harness();
    const first = await service.start(startInput(validConsent()));
    const second = await service.start(startInput(validConsent()));
    expect(second).toEqual(first);
    expect([...usage.values()]).toEqual([{ recordingCount: 1, compressedBytes: 0 }]);
  });

  it("masks input data, strips destination details, stores gzip chunks, and reconstructs a manifest", async () => {
    const { objectStore, service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");
    const chunk = recordingChunk(started.recordingId, [{
      type: 2,
      timestamp: now.getTime(),
      data: {
        node: {
          type: 2,
          tagName: "input",
          attributes: {
            value: "private value",
            placeholder: "private placeholder",
            src: "https://assets.example/image.png?recipient=private#section",
            href: "https://private.example/path?token=secret",
          },
          childNodes: [
            null,
            {
              type: 2,
              tagName: "div",
              attributes: { id: "codex-browser-sidebar-comments-root" },
              childNodes: [],
            },
          ],
        },
      },
    }]);

    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: chunk,
    })).resolves.toEqual({ duplicate: false, sequence: 0 });
    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: chunk,
    })).resolves.toEqual({ duplicate: true, sequence: 0 });

    const stored = [...objectStore.objects.values()][0];
    expect(stored?.contentEncoding).toBe("gzip");
    const body = gunzipSync(stored!.body).toString("utf8");
    expect(body).toContain("[masked]");
    expect(body).toContain("https://assets.example/image.png");
    expect(body).not.toContain("private value");
    expect(body).not.toContain("private placeholder");
    expect(body).not.toContain("recipient=private");
    expect(body).not.toContain("token=secret");
    expect(body).not.toContain("private.example");
    expect(body).not.toContain("codex-browser-sidebar-comments-root");
    expect(JSON.parse(body).events[0].data.node.childNodes).toEqual([]);

    await expect(service.complete({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      complete: completion(started.recordingId, 0),
    })).resolves.toEqual({ status: "available" });
    await expect(service.getManifest({ workspaceId, sessionId: session().publicSessionId }))
      .resolves.toMatchObject({ status: "available", eventCount: 1, chunkCount: 1 });
  });

  it("settles completion requested before the final page-exit chunk arrives", async () => {
    const { recordings, service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");
    await expect(service.complete({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      complete: completion(started.recordingId, 0),
    })).resolves.toEqual({ status: "recording" });
    expect(recordings.get(started.recordingId)?.status).toBe("recording");
    await service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
    });
    expect(recordings.get(started.recordingId)?.status).toBe("available");
  });

  it("persists the last chunk and completion atomically from the unload request", async () => {
    const { recordings, service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");

    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: {
        ...recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
        completion: terminalCompletion(0),
      },
    })).resolves.toEqual({ duplicate: false, sequence: 0 });

    expect(recordings.get(started.recordingId)).toMatchObject({
      status: "available",
      finalSequence: 0,
      stopReason: "pagehide",
      errorCode: null,
    });
  });

  it("settles a replay when terminal metadata retries an already stored chunk", async () => {
    const { recordings, service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");
    const chunk = recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]);

    await service.uploadChunk({ recordingId: started.recordingId, uploadToken: started.uploadToken, upload: chunk });
    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: { ...chunk, completion: terminalCompletion(0) },
    })).resolves.toEqual({ duplicate: true, sequence: 0 });

    expect(recordings.get(started.recordingId)?.status).toBe("available");
  });

  it("settles when the final chunk commits immediately before completion metadata", async () => {
    const memory = createMemoryTrackingV2RecordingRepository();
    const completionInspectedChunks = deferred<void>();
    const uploadInspectedCompletion = deferred<void>();
    let findForUploadCalls = 0;
    let listChunkCalls = 0;
    const repository = {
      ...memory.repository,
      async findForUpload(input: Parameters<typeof memory.repository.findForUpload>[0]) {
        findForUploadCalls += 1;
        const recording = await memory.repository.findForUpload(input);
        if (findForUploadCalls === 3) uploadInspectedCompletion.resolve();
        return recording;
      },
      async listChunks(recordingId: string) {
        listChunkCalls += 1;
        const chunks = await memory.repository.listChunks(recordingId);
        if (listChunkCalls === 1) completionInspectedChunks.resolve();
        return chunks;
      },
      async requestCompletion(input: Parameters<typeof memory.repository.requestCompletion>[0]) {
        await uploadInspectedCompletion.promise;
        return memory.repository.requestCompletion(input);
      },
    };
    const service = createTrackingV2RecordingService({
      repository,
      objectStore: createMemoryTrackingV2RecordingObjectStore(),
      tokenSecret: "recording-service-secret-that-is-long-enough",
      now: () => now,
    });
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");

    const completionPromise = service.complete({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      complete: completion(started.recordingId, 0),
    });
    await completionInspectedChunks.promise;
    const uploadPromise = service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
    });

    await expect(Promise.all([completionPromise, uploadPromise])).resolves.toEqual([
      { status: "available" },
      { duplicate: false, sequence: 0 },
    ]);
    expect(memory.recordings.get(started.recordingId)?.status).toBe("available");
  });

  it("makes expired recordings unreadable before physical cleanup runs", async () => {
    const { recordings, service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");
    await service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
    });
    await service.complete({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      complete: completion(started.recordingId, 0),
    });
    const recording = recordings.get(started.recordingId);
    if (!recording) throw new Error("Expected recording metadata.");
    recording.expiresAt = new Date(now.getTime() - 1);

    await expect(service.getManifest({ workspaceId, sessionId: session().publicSessionId })).resolves.toBeNull();
    await expect(service.getChunk({ workspaceId, recordingId: started.recordingId, sequence: 0 })).resolves.toBeNull();
  });

  it("rejects uploads with the wrong recording token", async () => {
    const { service } = harness();
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");
    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: "wrong-token",
      upload: recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
    })).rejects.toBeInstanceOf(TrackingV2RecordingInvalidError);
  });

  it("queues durable cleanup when a failed metadata write cannot delete its uploaded object", async () => {
    const memory = createMemoryTrackingV2RecordingRepository();
    const storedObjects = createMemoryTrackingV2RecordingObjectStore();
    const objectStore = {
      ...storedObjects,
      async deleteObject() {
        throw new Error("Object storage deletion is temporarily unavailable.");
      },
    };
    const repository = {
      ...memory.repository,
      async insertChunk() {
        throw new Error("Chunk metadata is temporarily unavailable.");
      },
    };
    const service = createTrackingV2RecordingService({
      repository,
      objectStore,
      tokenSecret: "recording-service-secret-that-is-long-enough",
      now: () => now,
    });
    const started = await service.start(startInput(validConsent()));
    if (!started.enabled) throw new Error("Expected replay to start.");

    await expect(service.uploadChunk({
      recordingId: started.recordingId,
      uploadToken: started.uploadToken,
      upload: recordingChunk(started.recordingId, [{ type: 2, timestamp: now.getTime(), data: {} }]),
    })).rejects.toThrow("Chunk metadata is temporarily unavailable.");

    expect(storedObjects.objects.size).toBe(1);
    expect([...memory.objectDeletions.values()]).toEqual([
      expect.objectContaining({ objectKey: [...storedObjects.objects.keys()][0], attemptCount: 0 }),
    ]);
  });
});

function startInput(consent: {
  noticeVersion: 1;
  grantedAt: string;
  source: "prompt" | "remembered";
} | undefined) {
  return {
    context: { trackingMode: "events_and_replay" as const, workspacePlan: "pro" as const },
    session: session(),
    settings: {
      enabled: true,
      eventRetentionDays: 90 as const,
      recordingEnabled: true,
      recordingRetentionDays: 14 as const,
      maxRecordingDurationSeconds: 600,
      recordingTermsVersion: "2026-07-13.1",
      recordingTermsAcceptedAt: now,
      recordingTermsAcceptedByUserId: "user-1",
    },
    consent,
  };
}

function session() {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    publicSessionId: "session-recording-test",
    workspaceId,
    siteId,
    recipientId: null,
    recipientRevision: null,
    publishedVersionId: "55555555-5555-4555-8555-555555555555",
    manifestId: "66666666-6666-4666-8666-666666666666",
    eventTokenHash: "event-token-hash",
    state: "active" as const,
    startedAt: now,
    lastSeenAt: now,
    activeMs: 0,
  };
}

function validConsent() {
  return { noticeVersion: 1 as const, grantedAt: now.toISOString(), source: "prompt" as const };
}

function recordingChunk(_recordingId: string, events: Array<{ type: number; timestamp: number; data: unknown }>) {
  return {
    schemaVersion: TRACKING_V2_RECORDING_SCHEMA_VERSION as 4,
    sessionId: session().publicSessionId,
    sequence: 0,
    events,
  };
}

function completion(_recordingId: string, finalSequence: number | null) {
  return {
    schemaVersion: TRACKING_V2_RECORDING_SCHEMA_VERSION as 4,
    sessionId: session().publicSessionId,
    finalSequence,
    endedAt: new Date(now.getTime() + 1_000).toISOString(),
    stopReason: "pagehide" as const,
  };
}

function terminalCompletion(finalSequence: number) {
  const { endedAt, stopReason } = completion("unused", finalSequence);
  return { finalSequence, endedAt, stopReason };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
