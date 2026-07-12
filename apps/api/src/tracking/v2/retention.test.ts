import { describe, expect, it } from "vitest";
import {
  createMemoryTrackingV2RecordingObjectStore,
} from "./recording-object-store";
import {
  createMemoryTrackingV2Repository,
  type TrackingV2CreateSessionInput,
} from "./repository";
import { createTrackingV2RetentionService } from "./retention";

const now = new Date("2026-07-09T12:00:00.000Z");
const old = new Date("2026-07-07T11:59:00.000Z");
const fresh = new Date("2026-07-09T11:59:00.000Z");
const workspaceId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const recipientId = "44444444-4444-4444-8444-444444444444";
const publishedVersionId = "33333333-3333-4333-8333-333333333333";

function sessionInput(input: {
  publicSessionId: string;
  startedAt: Date;
  ipAddress?: string | null;
  siteId?: string;
  recipientId?: string | null;
}): TrackingV2CreateSessionInput {
  return {
    publicSessionId: input.publicSessionId,
    workspaceId,
    siteId: input.siteId ?? siteId,
    recipientId: input.recipientId === undefined ? recipientId : input.recipientId,
    publishedVersionId,
    eventTokenHash: `hash_${input.publicSessionId}`,
    deviceIdHash: null,
    ipAddress: input.ipAddress ?? "203.0.113.10",
    ipAddressHash: "ip_hash",
    city: "Tampa",
    region: "FL",
    countryCode: "US",
    deviceType: "desktop",
    osName: "macOS",
    browserName: "Chrome",
    userAgentFamily: "Chrome",
    referrerHost: null,
    initialPath: "/brief",
    startedAt: input.startedAt,
  };
}

function workspaceSetting(input: {
  rawIpRetentionDays: number;
  eventRetentionDays: number;
}) {
  return {
    workspaceId,
    siteId: null,
    recipientId: null,
    scope: "workspace" as const,
    enabled: true,
    captureIpAddress: true,
    rawIpRetentionDays: input.rawIpRetentionDays,
    eventRetentionDays: input.eventRetentionDays,
    recordingEnabled: false,
    recordingRetentionDays: 30,
    maxRecordingDurationSeconds: 600,
  };
}

function siteSetting(input: {
  rawIpRetentionDays: number;
  eventRetentionDays: number;
}) {
  return {
    ...workspaceSetting(input),
    siteId,
    scope: "site" as const,
  };
}

function recipientSetting(input: {
  rawIpRetentionDays: number;
  eventRetentionDays: number;
}) {
  return {
    ...workspaceSetting(input),
    siteId,
    recipientId,
    scope: "recipient" as const,
  };
}

function eventRecord(input: {
  id: string;
  eventId: string;
  sessionId: string;
  recipientId: string | null;
  receivedAt: Date;
}) {
  return {
    id: input.id,
    eventId: input.eventId,
    batchId: `batch_${input.eventId}`,
    sessionId: input.sessionId,
    workspaceId,
    siteId,
    recipientId: input.recipientId,
    publishedVersionId,
    type: "site_visit" as const,
    source: "browser" as const,
    tabLabel: null,
    elementKind: null,
    elementId: null,
    elementLabel: null,
    elementHref: null,
    webhookId: null,
    webhookUrl: null,
    scriptVersion: null,
    eventData: {},
    occurredAt: input.receivedAt,
    receivedAt: input.receivedAt,
  };
}

describe("tracking v2 retention", () => {
  it("prunes raw IP addresses, expired events, and expired sessions in bounded batches", async () => {
    const repository = createMemoryTrackingV2Repository({
      settings: [
        workspaceSetting({
          rawIpRetentionDays: 1,
          eventRetentionDays: 1,
        }),
      ],
    });
    const oldSession = await repository.createSession(sessionInput({
      publicSessionId: "session_old",
      startedAt: old,
    }));
    const freshSession = await repository.createSession(sessionInput({
      publicSessionId: "session_fresh",
      startedAt: fresh,
    }));

    repository.events.push({
      id: "00000000-0000-4000-8000-000000000001",
      eventId: "event_old",
      batchId: "batch_old",
      sessionId: oldSession.id,
      workspaceId,
      siteId,
      recipientId,
      publishedVersionId,
      type: "site_visit",
      source: "browser",
      tabLabel: null,
      elementKind: null,
      elementId: null,
      elementLabel: null,
      elementHref: null,
      webhookId: null,
      webhookUrl: null,
      scriptVersion: null,
      eventData: {},
      occurredAt: old,
      receivedAt: old,
    }, {
      id: "00000000-0000-4000-8000-000000000002",
      eventId: "event_fresh",
      batchId: "batch_fresh",
      sessionId: freshSession.id,
      workspaceId,
      siteId,
      recipientId,
      publishedVersionId,
      type: "site_visit",
      source: "browser",
      tabLabel: null,
      elementKind: null,
      elementId: null,
      elementLabel: null,
      elementHref: null,
      webhookId: null,
      webhookUrl: null,
      scriptVersion: null,
      eventData: {},
      occurredAt: fresh,
      receivedAt: fresh,
    });

    const service = createTrackingV2RetentionService({
      repository,
      now: () => now,
    });
    const result = await service.runOnce({ batchSize: 10 });

    expect(result).toMatchObject({
      sessionsExpired: 1,
      rawIpAddressesPruned: 1,
      eventsDeleted: 1,
      sessionsDeleted: 1,
    });
    expect(repository.sessions.has("session_old")).toBe(false);
    expect(repository.sessions.get("session_fresh")?.ipAddress).toBe("203.0.113.10");
    expect(repository.events.map((event) => event.eventId)).toEqual(["event_fresh"]);
  });

  it("applies recipient retention before site retention before workspace retention", async () => {
    const repository = createMemoryTrackingV2Repository({
      settings: [
        workspaceSetting({
          rawIpRetentionDays: 10,
          eventRetentionDays: 10,
        }),
        siteSetting({
          rawIpRetentionDays: 1,
          eventRetentionDays: 1,
        }),
        recipientSetting({
          rawIpRetentionDays: 10,
          eventRetentionDays: 10,
        }),
      ],
    });
    const recipientSession = await repository.createSession(sessionInput({
      publicSessionId: "session_recipient_keep",
      startedAt: old,
    }));
    const siteSession = await repository.createSession(sessionInput({
      publicSessionId: "session_site_prune",
      startedAt: old,
      recipientId: null,
    }));

    repository.events.push(
      eventRecord({
        id: "00000000-0000-4000-8000-000000000011",
        eventId: "event_recipient_keep",
        sessionId: recipientSession.id,
        recipientId,
        receivedAt: old,
      }),
      eventRecord({
        id: "00000000-0000-4000-8000-000000000012",
        eventId: "event_site_prune",
        sessionId: siteSession.id,
        recipientId: null,
        receivedAt: old,
      }),
    );

    const service = createTrackingV2RetentionService({
      repository,
      now: () => now,
    });
    const result = await service.runOnce({ batchSize: 10 });

    expect(result).toMatchObject({
      rawIpAddressesPruned: 1,
      eventsDeleted: 1,
      sessionsDeleted: 1,
    });
    expect(repository.sessions.has("session_recipient_keep")).toBe(true);
    expect(repository.sessions.has("session_site_prune")).toBe(false);
    expect(repository.sessions.get("session_recipient_keep")?.ipAddress).toBe("203.0.113.10");
    expect(repository.events.map((event) => event.eventId)).toEqual(["event_recipient_keep"]);
  });

  it("deletes expired recording objects before chunk metadata and marks recordings deleted when empty", async () => {
    const repository = createMemoryTrackingV2Repository();
    const objectStore = createMemoryTrackingV2RecordingObjectStore();
    const session = await repository.createSession(sessionInput({
      publicSessionId: "session_recorded",
      startedAt: old,
    }));
    const recording = await repository.createRecording({
      recordingId: "55555555-5555-4555-8555-555555555555",
      workspaceId,
      siteId,
      recipientId,
      sessionId: session.id,
      publicSessionId: session.publicSessionId,
      uploadTokenHash: "upload_hash",
      runtimeVersion: "test",
      maxDurationMs: 60_000,
      maxChunkBytes: 60 * 1024,
      maxEvents: 100,
      startedAt: old,
      expiresAt: old,
    });

    for (const sequence of [0, 1]) {
      const objectKey = repository.getRecordingChunkObjectKey({
        workspaceId,
        recordingId: recording.id,
        sequence,
      });
      await objectStore.putObject({
        key: objectKey,
        body: Buffer.from(`{"sequence":${sequence}}`),
        contentType: "application/json; charset=utf-8",
      });
      await repository.insertRecordingChunk({
        recordingId: recording.id,
        workspaceId,
        sessionId: session.id,
        publicSessionId: session.publicSessionId,
        sequence,
        objectKey,
        eventCount: 1,
        compressedBytes: 16,
        uncompressedBytes: 16,
        checksumSha256: `${sequence}`.padStart(64, "0"),
        firstEventAt: old,
        lastEventAt: old,
        receivedAt: old,
      });
    }

    const service = createTrackingV2RetentionService({
      repository,
      recordingObjectStore: objectStore,
      now: () => now,
    });

    const firstPass = await service.runOnce({ batchSize: 10, objectBatchSize: 1 });
    expect(firstPass).toMatchObject({
      recordingsExpired: 1,
      recordingChunkObjectsDeleted: 1,
      recordingChunkMetadataDeleted: 1,
      recordingsDeleted: 0,
    });
    expect(repository.recordings.get(recording.id)?.status).toBe("expired");
    expect(repository.recordingChunks).toHaveLength(1);
    expect(objectStore.objects.size).toBe(1);

    const secondPass = await service.runOnce({ batchSize: 10, objectBatchSize: 10 });
    expect(secondPass).toMatchObject({
      recordingsExpired: 0,
      recordingChunkObjectsDeleted: 1,
      recordingChunkMetadataDeleted: 1,
      recordingsDeleted: 1,
    });
    expect(repository.recordings.get(recording.id)?.status).toBe("deleted");
    expect(repository.recordingChunks).toHaveLength(0);
    expect(objectStore.objects.size).toBe(0);
    expect(repository.sessions.get("session_recorded")?.recordingStatus).toBe("expired");
  });

  it("keeps expired recording chunk metadata when no object store is configured", async () => {
    const repository = createMemoryTrackingV2Repository();
    const session = await repository.createSession(sessionInput({
      publicSessionId: "session_without_store",
      startedAt: old,
    }));
    const recording = await repository.createRecording({
      recordingId: "66666666-6666-4666-8666-666666666666",
      workspaceId,
      siteId,
      recipientId,
      sessionId: session.id,
      publicSessionId: session.publicSessionId,
      uploadTokenHash: "upload_hash",
      runtimeVersion: "test",
      maxDurationMs: 60_000,
      maxChunkBytes: 60 * 1024,
      maxEvents: 100,
      startedAt: old,
      expiresAt: old,
    });
    await repository.insertRecordingChunk({
      recordingId: recording.id,
      workspaceId,
      sessionId: session.id,
      publicSessionId: session.publicSessionId,
      sequence: 0,
      objectKey: repository.getRecordingChunkObjectKey({
        workspaceId,
        recordingId: recording.id,
        sequence: 0,
      }),
      eventCount: 1,
      compressedBytes: 16,
      uncompressedBytes: 16,
      checksumSha256: "1".padStart(64, "0"),
      firstEventAt: old,
      lastEventAt: old,
      receivedAt: old,
    });

    const service = createTrackingV2RetentionService({
      repository,
      now: () => now,
    });
    const result = await service.runOnce({ batchSize: 10 });

    expect(result).toMatchObject({
      recordingsExpired: 1,
      recordingChunksSkippedWithoutStore: 1,
      recordingChunkMetadataDeleted: 0,
      recordingsDeleted: 0,
    });
    expect(repository.recordings.get(recording.id)?.status).toBe("expired");
    expect(repository.recordingChunks).toHaveLength(1);
  });
});
