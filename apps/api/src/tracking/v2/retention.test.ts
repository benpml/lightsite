import { describe, expect, it } from "vitest";
import {
  createMemoryTrackingV2Repository,
  type TrackingV2CreateSessionInput,
  type TrackingV2ManifestRecord,
} from "./repository";
import {
  TrackingV2RetentionInputError,
  createTrackingV2RetentionService,
} from "./retention";
import { createMemoryTrackingV2RecordingObjectStore } from "./recording-object-store";
import { createMemoryTrackingV2RecordingRepository } from "./recording-repository";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const publishedVersionId = "33333333-3333-4333-8333-333333333333";
const manifestId = "55555555-5555-4555-8555-555555555555";
const runAt = new Date("2026-07-12T12:00:00.000Z");

describe("tracking v2 retention", () => {
  it("expires active sessions, applies scoped retention, and prunes orphaned manifests", async () => {
    const repository = createMemoryTrackingV2Repository({
      manifests: [manifest()],
      settings: [{
        workspaceId,
        siteId,
        recipientId: null,
        scope: "site",
        enabled: true,
        eventRetentionDays: 30,
      }],
    });
    await repository.createSession(sessionInput("session-expired", new Date("2026-05-01T12:00:00.000Z")));

    const result = await createTrackingV2RetentionService({ repository }).runOnce({ now: runAt });

    expect(result).toEqual({
      now: runAt.toISOString(),
      sessionsExpired: 1,
      endedRecordingsSettled: 0,
      staleRecordingsSettled: 0,
      recordingsExpired: 0,
      recordingObjectsQueued: 0,
      recordingObjectsDeleted: 0,
      recordingObjectDeleteFailures: 0,
      recordingObjectDeletionBacklog: 0,
      recordingsDeleted: 0,
      eventsDeleted: 1,
      sessionsDeleted: 1,
      manifestsDeleted: 1,
    });
    expect(repository.events).toHaveLength(0);
    expect(repository.sessions.size).toBe(0);
    expect(repository.manifests.size).toBe(0);
  });

  it("keeps fresh activity and manifests that are still referenced", async () => {
    const repository = createMemoryTrackingV2Repository({ manifests: [manifest()] });
    await repository.createSession(sessionInput("session-fresh", new Date("2026-07-12T11:00:00.000Z")));

    const result = await createTrackingV2RetentionService({ repository }).runOnce({ now: runAt });

    expect(result).toMatchObject({ eventsDeleted: 0, sessionsDeleted: 0, manifestsDeleted: 0 });
    expect(repository.events).toHaveLength(1);
    expect(repository.sessions.size).toBe(1);
    expect(repository.manifests.size).toBe(1);
  });

  it("bounds cleanup work per run", async () => {
    const repository = createMemoryTrackingV2Repository();
    const service = createTrackingV2RetentionService({ repository });
    await expect(service.runOnce({ batchSize: 0 })).rejects.toBeInstanceOf(TrackingV2RetentionInputError);
    await expect(service.runOnce({ batchSize: 5_001 })).rejects.toBeInstanceOf(TrackingV2RetentionInputError);
  });

  it("deletes expired replay objects before marking their metadata deleted", async () => {
    const repository = createMemoryTrackingV2Repository();
    const recording = createMemoryTrackingV2RecordingRepository();
    const objectStore = createMemoryTrackingV2RecordingObjectStore();
    const startedAt = new Date("2026-06-01T12:00:00.000Z");
    const created = await recording.repository.createRecording({
      id: "77777777-7777-4777-8777-777777777777",
      workspaceId,
      siteId,
      recipientId: null,
      sessionId: "88888888-8888-4888-8888-888888888888",
      publicSessionId: "session-replay-expired",
      uploadTokenHash: "upload-token-hash",
      runtimeVersion: "test",
      visitorNoticeVersion: 1,
      consentGrantedAt: startedAt,
      consentSource: "prompt",
      maxDurationMs: 600_000,
      maxChunkBytes: 524_288,
      maxEvents: 20_000,
      startedAt,
      expiresAt: new Date("2026-06-15T12:00:00.000Z"),
      usageDate: "2026-06-01",
      dailyRecordingLimit: 1_000,
    });
    if (!created) throw new Error("Expected recording metadata.");
    const objectKey = recording.repository.getObjectKey({
      workspaceId,
      recordingId: created.id,
      sequence: 0,
      checksumSha256: "a".repeat(64),
    });
    await objectStore.putObject({ key: objectKey, body: Buffer.from("chunk"), contentType: "application/json", contentEncoding: null });
    await recording.repository.insertChunk({
      recordingId: created.id,
      workspaceId,
      sessionId: created.sessionId,
      sequence: 0,
      objectKey,
      eventCount: 1,
      compressedBytes: 5,
      uncompressedBytes: 5,
      checksumSha256: "a".repeat(64),
      firstEventAt: startedAt,
      lastEventAt: startedAt,
      receivedAt: startedAt,
      usageDate: "2026-06-01",
      dailyCompressedByteLimit: 1_000,
      recordingByteLimit: 1_000,
    });

    const failedResult = await createTrackingV2RetentionService({
      repository,
      recording: {
        repository: recording.repository,
        objectStore: {
          ...objectStore,
          async deleteObject() { throw new Error("Object storage is unavailable."); },
        },
      },
    }).runOnce({ now: runAt });

    expect(failedResult).toMatchObject({
      recordingsExpired: 1,
      recordingObjectsQueued: 1,
      recordingObjectsDeleted: 0,
      recordingObjectDeleteFailures: 1,
      recordingObjectDeletionBacklog: 1,
      recordingsDeleted: 1,
    });
    expect(objectStore.objects.size).toBe(1);
    expect([...recording.objectDeletions.values()][0]?.attemptCount).toBe(1);

    const recoveredResult = await createTrackingV2RetentionService({
      repository,
      recording: { repository: recording.repository, objectStore },
    }).runOnce({ now: runAt });
    expect(recoveredResult).toMatchObject({
      recordingObjectsQueued: 0,
      recordingObjectsDeleted: 1,
      recordingObjectDeleteFailures: 0,
      recordingObjectDeletionBacklog: 0,
    });
    expect(objectStore.objects.size).toBe(0);
    expect(recording.objectDeletions.size).toBe(0);
    expect(recording.recordings.get(created.id)?.status).toBe("deleted");
  });
});

function sessionInput(publicSessionId: string, startedAt: Date): TrackingV2CreateSessionInput {
  return {
    publicSessionId,
    workspaceId,
    siteId,
    recipientId: null,
    recipientRevision: null,
    publishedVersionId,
    manifestId,
    eventTokenHash: `hash-${publicSessionId}`,
    initialPageId: "page-overview",
    initialPageLabel: "Overview",
    city: null,
    region: null,
    countryCode: null,
    deviceType: "desktop",
    osName: "macOS",
    browserName: "Chrome",
    startedAt,
    receivedAt: startedAt,
  };
}

function manifest(): TrackingV2ManifestRecord {
  return {
    id: manifestId,
    workspaceId,
    siteId,
    publishedVersionId,
    recipientId: null,
    recipientRevision: null,
    schemaVersion: 1,
    sourceHash: "a".repeat(64),
    payload: {
      schemaVersion: 1,
      siteLabel: "Proposal",
      pages: [{ id: "page-overview", label: "Overview" }],
      elements: [],
    },
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
  };
}
