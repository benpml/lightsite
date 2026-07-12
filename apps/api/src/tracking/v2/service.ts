import { createHash, createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { gunzip, gzip } from "node:zlib";
import {
  TRACKING_V2_HEARTBEAT_INTERVAL_MS,
  TRACKING_V2_IDLE_TIMEOUT_MS,
  TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS,
  TRACKING_V2_MAX_RECORDING_DURATION_MS,
  TRACKING_V2_MAX_SESSION_DURATION_MS,
  TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS,
  TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
  TRACKING_V2_RECORDING_MAX_BYTES,
  TRACKING_V2_RECORDING_MAX_EVENTS,
  TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK,
  TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_STALE_AFTER_MS,
  sanitizeTrackingV2Path,
  trackingV2EventRegistry,
  type TrackingV2EventsQuery,
  type TrackingV2EventsResponse,
  type TrackingV2ContextTokenPayload,
  type TrackingV2EventBatch,
  type TrackingV2RecordingChunk,
  type TrackingV2RecordingComplete,
  type TrackingV2SiteTrackingSettingsResponse,
  type TrackingV2SessionResponse,
  type TrackingV2SessionEnd,
  type TrackingV2SessionHeartbeat,
  type TrackingV2SessionSummary,
  type TrackingV2SessionsQuery,
  type TrackingV2SessionsResponse,
  type TrackingV2SessionStartRequest,
  type TrackingV2SessionStartResponse,
  type TrackingV2TrackingSettings,
  type TrackingV2UpdateSiteSettingsRequest,
} from "@lightsite/tracking-schema";
import {
  hashTrackingSuppressionMarker,
  type TrackingSuppressionService,
} from "./suppression";
import type {
  TrackingV2EventCursor,
  TrackingV2RecordingChunkRecord,
  TrackingV2RecordingRecord,
  TrackingV2Repository,
  TrackingV2SessionCursor,
  TrackingV2SessionReadRecord,
  TrackingV2SettingRecord,
  TrackingV2SiteSummaryRecord,
  TrackingV2WritableSettings,
} from "./repository";
import type {
  TrackingV2RecordingObjectStore,
} from "./recording-object-store";

export type TrackingV2RequestSnapshot = {
  ipAddress: string | null;
  userAgent: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export type TrackingV2ServiceOptions = {
  repository: TrackingV2Repository;
  recordingObjectStore?: TrackingV2RecordingObjectStore | null;
  suppressionService: TrackingSuppressionService;
  tokenSecret: string;
  markerHashSecret: string;
  now?: () => Date;
  randomId?: () => string;
  randomToken?: () => string;
};

export type TrackingV2ReadWorkspace = {
  id: string;
  role: "admin" | "user";
};

export type ListTrackingV2EventsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  query: TrackingV2EventsQuery;
};

export type ListTrackingV2SessionsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  query: TrackingV2SessionsQuery;
};

export type GetTrackingV2SessionInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  sessionId: string;
};

export type GetTrackingV2SiteSettingsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  siteId: string;
};

export type UpdateTrackingV2SiteSettingsInput = {
  workspace: TrackingV2ReadWorkspace;
  userId: string;
  siteId: string;
  settings: TrackingV2UpdateSiteSettingsRequest;
};

export interface TrackingV2Service {
  listEvents(input: ListTrackingV2EventsInput): Promise<Omit<TrackingV2EventsResponse, "requestId">>;
  listSessions(input: ListTrackingV2SessionsInput): Promise<Omit<TrackingV2SessionsResponse, "requestId">>;
  getSession(input: GetTrackingV2SessionInput): Promise<Omit<TrackingV2SessionResponse, "requestId"> | null>;
  getSiteSettings(input: GetTrackingV2SiteSettingsInput): Promise<Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> | null>;
  updateSiteSettings(input: UpdateTrackingV2SiteSettingsInput): Promise<Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> | null>;
  startSession(input: {
    context: TrackingV2ContextTokenPayload;
    request: TrackingV2SessionStartRequest;
    requestSnapshot: TrackingV2RequestSnapshot;
  }): Promise<TrackingV2SessionStartResponse>;
  recordEventBatch(batch: TrackingV2EventBatch): Promise<void>;
  recordSlackShare(input: {
    context: TrackingV2ContextTokenPayload;
    imageCacheKey: string;
  }): Promise<{ recorded: boolean }>;
  recordRecordingChunk(input: {
    recordingId: string;
    uploadToken: string;
    chunk: TrackingV2RecordingChunk;
  }): Promise<{
    accepted: true;
    duplicate: boolean;
    sequence: number;
  }>;
  completeRecording(input: {
    recordingId: string;
    uploadToken: string;
    complete: TrackingV2RecordingComplete;
  }): Promise<{
    completed: boolean;
    status: "recording" | "available" | "truncated" | "failed";
  }>;
  getRecordingManifest(input: {
    workspaceId: string;
    sessionId: string;
  }): Promise<TrackingV2RecordingManifest | null>;
  getRecordingChunkObject(input: {
    workspaceId: string;
    recordingId: string;
    sequence: number;
  }): Promise<{
    body: Buffer;
    contentType: string;
  } | null>;
  recordHeartbeat(heartbeat: TrackingV2SessionHeartbeat): Promise<void>;
  endSession(end: TrackingV2SessionEnd): Promise<void>;
}

export class TrackingV2InvalidContextError extends Error {
  constructor() {
    super("Invalid tracking v2 context.");
    this.name = "TrackingV2InvalidContextError";
  }
}

export class TrackingV2InvalidCursorError extends Error {
  constructor() {
    super("Invalid tracking v2 cursor.");
    this.name = "TrackingV2InvalidCursorError";
  }
}

export class TrackingV2UnavailableError extends Error {
  constructor() {
    super("Tracking v2 data is temporarily unavailable.");
    this.name = "TrackingV2UnavailableError";
  }
}

export class TrackingV2RecordingLimitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TrackingV2RecordingLimitError";
    this.code = code;
  }
}

export type TrackingV2RecordingManifest = {
  recordingId: string;
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  eventCount: number;
  chunkCount: number;
  compressedBytes: number;
  maxDurationMs: number;
  chunks: Array<{
    sequence: number;
    eventCount: number;
    compressedBytes: number;
    checksumSha256: string;
    firstEventAt: string | null;
    lastEventAt: string | null;
  }>;
};

const defaultEffectiveSettings: EffectiveTrackingSettings = {
  enabled: true,
  captureIpAddress: true,
  eventRetentionDays: 365,
  rawIpRetentionDays: 30,
  recordingEnabled: false,
  recordingRetentionDays: 30,
  maxRecordingDurationSeconds: 600,
};

type EffectiveTrackingSettings = Omit<TrackingV2SettingRecord, "scope">;

export function createTrackingV2Service(options: TrackingV2ServiceOptions): TrackingV2Service {
  assertSecret(options.tokenSecret, "Tracking v2 token secret");
  assertSecret(options.markerHashSecret, "Tracking v2 marker hash secret");

  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? (() => randomUUID());
  const randomToken = options.randomToken ?? (() => randomUUID());

  const resolveCurrentEventContext = async (context: TrackingV2ContextTokenPayload) => {
    const currentContext = await options.repository.findCurrentContext({
      workspaceId: context.workspaceId,
      siteId: context.siteId,
      publishedVersionId: context.publishedVersionId,
      recipientId: context.recipientId,
      recipientRevision: context.recipientRevision,
    });

    if (!currentContext || context.trackingMode === "off") {
      return null;
    }

    const effectiveSettings = resolveEffectiveSettings(
      await options.repository.listSettings({
        workspaceId: context.workspaceId,
        siteId: context.siteId,
        recipientId: context.recipientId,
      }),
    );

    return effectiveSettings.enabled ? { effectiveSettings } : null;
  };

  return {
    async listEvents(input) {
      const result = await runTrackingV2RepositoryQuery(() =>
        options.repository.listEvents({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.query.siteId,
          recipientId: input.query.recipientId,
          sessionId: input.query.sessionId,
          type: input.query.type,
          source: input.query.source,
          from: parseOptionalDate(input.query.from),
          to: parseOptionalDate(input.query.to),
          cursor: decodeEventCursor(input.query.cursor),
          limit: input.query.limit,
        })
      );

      return {
        events: result.records.map((record) => ({
          id: record.id,
          eventId: record.eventId,
          type: record.type,
          source: record.source,
          site: record.site,
          recipient: record.recipient,
          sessionId: record.sessionId,
          session: record.session
            ? {
                ...record.session,
                startedAt: record.session.startedAt.toISOString(),
                lastSeenAt: record.session.lastSeenAt.toISOString(),
              }
            : null,
          tab: record.tab,
          element: record.element,
          webhook: record.webhook,
          occurredAt: record.occurredAt.toISOString(),
          receivedAt: record.receivedAt.toISOString(),
        })),
        nextCursor: encodeEventCursor(result.nextCursor),
      };
    },

    async listSessions(input) {
      const result = await runTrackingV2RepositoryQuery(() =>
        options.repository.listSessions({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.query.siteId,
          recipientId: input.query.recipientId,
          state: input.query.state,
          recordingStatus: input.query.recordingStatus,
          from: parseOptionalDate(input.query.from),
          to: parseOptionalDate(input.query.to),
          cursor: decodeSessionCursor(input.query.cursor),
          limit: input.query.limit,
        })
      );

      return {
        sessions: result.records.map(toSessionSummaryResponse),
        nextCursor: encodeSessionCursor(result.nextCursor),
      };
    },

    async getSession(input) {
      const session = await runTrackingV2RepositoryQuery(() =>
        options.repository.findReadSession({
          workspace: input.workspace,
          userId: input.userId,
          publicSessionId: input.sessionId,
        })
      );

      return session
        ? {
            session: toSessionSummaryResponse(session),
          }
        : null;
    },

    async getSiteSettings(input) {
      const site = await runTrackingV2RepositoryQuery(() =>
        options.repository.findSettingsSite({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.siteId,
        })
      );

      if (!site) {
        return null;
      }

      const [settings, siteOverride] = await runTrackingV2RepositoryQuery(() =>
        Promise.all([
          options.repository.listSettings({
            workspaceId: input.workspace.id,
            siteId: input.siteId,
            recipientId: null,
          }),
          options.repository.findSiteSetting({
            workspaceId: input.workspace.id,
            siteId: input.siteId,
          }),
        ])
      );

      return buildSiteSettingsResponse({
        settings,
        site,
        siteOverride,
      });
    },

    async updateSiteSettings(input) {
      const site = await runTrackingV2RepositoryQuery(() =>
        options.repository.findSettingsSite({
          workspace: input.workspace,
          userId: input.userId,
          siteId: input.siteId,
        })
      );

      if (!site) {
        return null;
      }

      if (input.settings.recordingEnabled && !options.recordingObjectStore) {
        throw new TrackingV2UnavailableError();
      }

      const updated = await runTrackingV2RepositoryQuery(() =>
        options.repository.upsertSiteSetting({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          settings: toWritableSettings(input.settings),
          updatedAt: now(),
        })
      );
      const settings = await runTrackingV2RepositoryQuery(() =>
        options.repository.listSettings({
          workspaceId: input.workspace.id,
          siteId: input.siteId,
          recipientId: null,
        })
      );

      return buildSiteSettingsResponse({
        settings,
        site,
        siteOverride: updated,
      });
    },

    async startSession(input) {
      const eventContext = await resolveCurrentEventContext(input.context);

      if (!eventContext) {
        return stoppedSession("disabled");
      }

      const requestIp = sanitizeIpAddress(input.requestSnapshot.ipAddress);
      const deviceId = input.request.device?.deviceId ?? null;
      const suppression = await options.suppressionService.evaluateRecipientVisit({
        workspaceId: input.context.workspaceId,
        ipAddress: requestIp,
        deviceId,
        at: now(),
      });

      if (suppression.suppressed) {
        return stoppedSession("suppressed");
      }

      const userAgent = truncateNullable(
        input.request.device?.userAgent ?? input.requestSnapshot.userAgent,
        1024,
      );
      const userAgentInfo = classifyUserAgent(userAgent);
      const startedAt = new Date(input.request.startedAt);
      const publicSessionId = `session_${randomId()}`;
      const eventToken = `event_${randomToken()}`;

      const session = await options.repository.createSession({
        publicSessionId,
        workspaceId: input.context.workspaceId,
        siteId: input.context.siteId,
        recipientId: input.context.recipientId,
        publishedVersionId: input.context.publishedVersionId,
        eventTokenHash: hashEventToken({
          sessionId: publicSessionId,
          eventToken,
          secret: options.tokenSecret,
        }),
        deviceIdHash: deviceId
          ? hashTrackingSuppressionMarker({
              workspaceId: input.context.workspaceId,
              markerType: "device_id",
              value: deviceId,
              secret: options.markerHashSecret,
            })
          : null,
        ipAddress: eventContext.effectiveSettings.captureIpAddress ? requestIp : null,
        ipAddressHash: requestIp
          ? hashTrackingSuppressionMarker({
              workspaceId: input.context.workspaceId,
              markerType: "ip_address",
              value: requestIp,
              secret: options.markerHashSecret,
            })
          : null,
        city: truncateNullable(input.requestSnapshot.city, 120),
        region: truncateNullable(input.requestSnapshot.region, 120),
        countryCode: normalizeCountryCode(input.requestSnapshot.countryCode),
        deviceType: userAgentInfo.deviceType,
        osName: userAgentInfo.osName,
        browserName: userAgentInfo.browserName,
        userAgentFamily: userAgentInfo.userAgentFamily,
        referrerHost: input.request.page.referrerHost ?? null,
        initialPath: sanitizeTrackingV2Path(input.request.page.path),
        startedAt,
      });
      const recording = await createRecordingConfig({
        context: input.context,
        effectiveSettings: eventContext.effectiveSettings,
        now,
        options,
        publicSessionId,
        randomToken,
        session,
        startedAt,
      });

      const baseResponse = {
        accepted: true,
        eventsAccepted: true,
        sessionId: publicSessionId,
        eventToken,
        scriptVersion: TRACKING_V2_SCRIPT_VERSION,
        heartbeatIntervalMs: TRACKING_V2_HEARTBEAT_INTERVAL_MS,
        idleTimeoutMs: TRACKING_V2_IDLE_TIMEOUT_MS,
        maxSessionDurationMs: TRACKING_V2_MAX_SESSION_DURATION_MS,
      } as const;

      return recording.enabled
        ? {
            ...baseResponse,
            recordingAccepted: true,
            recording,
          }
        : {
            ...baseResponse,
            recordingAccepted: false,
            recording,
          };
    },

    async recordEventBatch(batch) {
      const receivedAt = now();
      const activeAfter = getSessionActiveAfter(receivedAt);
      const session = await options.repository.findSessionForEventToken({
        publicSessionId: batch.sessionId,
        activeAfter,
        eventTokenHash: hashEventToken({
          sessionId: batch.sessionId,
          eventToken: batch.eventToken,
          secret: options.tokenSecret,
        }),
      });

      if (!session || !batch.events.every((event) => trackingV2EventRegistry[event.type].sessionScoped)) {
        throw new TrackingV2InvalidContextError();
      }

      const recorded = await options.repository.recordBrowserEvents({
        session,
        activeAfter,
        batchId: batch.batchId,
        scriptVersion: batch.scriptVersion,
        events: batch.events,
        receivedAt,
      });

      if (!recorded) {
        throw new TrackingV2InvalidContextError();
      }
    },

    async recordSlackShare(input) {
      const eventContext = await resolveCurrentEventContext(input.context);

      if (!eventContext) {
        return { recorded: false };
      }

      const occurredAt = now();
      const imageCacheKey = truncateNullable(input.imageCacheKey, 160);
      const eventId = buildServerEventId({
        context: input.context,
        secret: options.tokenSecret,
        type: "slack_share",
        bucketMs: 30 * 60 * 1000,
        occurredAt,
      });

      await options.repository.recordServerEvent({
        eventId,
        workspaceId: input.context.workspaceId,
        siteId: input.context.siteId,
        recipientId: input.context.recipientId,
        publishedVersionId: input.context.publishedVersionId,
        type: "slack_share",
        source: "slack_og_image",
        eventData: {
          platform: "slack",
          resource: "og_image",
          userAgentFamily: "slackbot",
          ...(imageCacheKey ? { imageCacheKey } : {}),
        },
        occurredAt,
        receivedAt: occurredAt,
      });

      return { recorded: true };
    },

    async recordRecordingChunk(input) {
      if (!options.recordingObjectStore) {
        throw new TrackingV2InvalidContextError();
      }

      const uploadTokenHash = hashRecordingUploadToken({
        recordingId: input.recordingId,
        sessionId: input.chunk.sessionId,
        uploadToken: input.uploadToken,
        secret: options.tokenSecret,
      });
      const recording = await options.repository.findRecordingForUploadToken({
        recordingId: input.recordingId,
        uploadTokenHash,
      });

      if (!recording || recording.publicSessionId !== input.chunk.sessionId) {
        throw new TrackingV2InvalidContextError();
      }

      const payload = Buffer.from(JSON.stringify(input.chunk), "utf8");
      const checksumSha256 = sha256(payload);
      const existing = await options.repository.findRecordingChunk({
        recordingId: recording.id,
        sequence: input.chunk.sequence,
      });

      if (existing) {
        if (
          existing.checksumSha256 !== checksumSha256 ||
          (existing.uncompressedBytes ?? existing.compressedBytes) !== payload.byteLength
        ) {
          if (isMutableRecordingStatus(recording.status)) {
            await markRecordingFailed({
              repository: options.repository,
              recordingId: recording.id,
              sessionId: recording.sessionId,
              errorCode: "duplicate_mismatch",
              now: now(),
            });
          }
          throw new TrackingV2InvalidContextError();
        }

        await settleRecordingByUploadToken({
          repository: options.repository,
          recordingId: recording.id,
          uploadTokenHash,
          now: now(),
        });
        return {
          accepted: true,
          duplicate: true,
          sequence: existing.sequence,
        };
      }

      if (!isMutableRecordingStatus(recording.status)) {
        throw new TrackingV2InvalidContextError();
      }

      if (recording.finalSequence !== null && input.chunk.sequence > recording.finalSequence) {
        throw new TrackingV2InvalidContextError();
      }

      if (recording.eventCount + input.chunk.events.length > recording.maxEvents) {
        await markRecordingFailed({
          repository: options.repository,
          recordingId: recording.id,
          sessionId: recording.sessionId,
          errorCode: "event_cap",
          now: now(),
        });
        throw new TrackingV2RecordingLimitError("event_cap", "Recording event limit exceeded.");
      }

      if (payload.byteLength > recording.maxChunkBytes) {
        await markRecordingFailed({
          repository: options.repository,
          recordingId: recording.id,
          sessionId: recording.sessionId,
          errorCode: "chunk_too_large",
          now: now(),
        });
        throw new TrackingV2RecordingLimitError("chunk_too_large", "Recording chunk is too large.");
      }

      const existingChunks = await options.repository.listRecordingChunks(recording.id);
      const existingUncompressedBytes = existingChunks.reduce(
        (total, chunk) => total + (chunk.uncompressedBytes ?? chunk.compressedBytes),
        0,
      );
      if (existingUncompressedBytes + payload.byteLength > TRACKING_V2_RECORDING_MAX_BYTES) {
        await markRecordingFailed({
          repository: options.repository,
          recordingId: recording.id,
          sessionId: recording.sessionId,
          errorCode: "recording_size_cap",
          now: now(),
        });
        throw new TrackingV2RecordingLimitError("size_cap", "Recording size limit exceeded.");
      }

      const gzippedPayload = await gzipPayload(payload);
      const storedPayload = gzippedPayload.byteLength < payload.byteLength
        ? gzippedPayload
        : payload;
      const storedContentType = storedPayload === gzippedPayload
        ? "application/gzip"
        : "application/json; charset=utf-8";

      if (recording.compressedBytes + storedPayload.byteLength > TRACKING_V2_RECORDING_MAX_BYTES) {
        await markRecordingFailed({
          repository: options.repository,
          recordingId: recording.id,
          sessionId: recording.sessionId,
          errorCode: "recording_size_cap",
          now: now(),
        });
        throw new TrackingV2RecordingLimitError("size_cap", "Recording size limit exceeded.");
      }

      const receivedAt = now();
      const eventBounds = getRrwebEventBounds(input.chunk.events, {
        minTimestamp: recording.startedAt.getTime(),
        maxTimestamp: Math.min(
          recording.startedAt.getTime() + recording.maxDurationMs,
          receivedAt.getTime() + TRACKING_V2_HEARTBEAT_INTERVAL_MS,
        ),
      });
      const objectKey = options.repository.getRecordingChunkObjectKey({
        workspaceId: recording.workspaceId,
        recordingId: recording.id,
        sequence: input.chunk.sequence,
        checksumSha256,
      });
      await options.recordingObjectStore.putObject({
        key: objectKey,
        body: storedPayload,
        contentType: storedContentType,
      });
      const inserted = await options.repository.insertRecordingChunk({
        recordingId: recording.id,
        workspaceId: recording.workspaceId,
        sessionId: recording.sessionId,
        publicSessionId: recording.publicSessionId,
        sequence: input.chunk.sequence,
        objectKey,
        eventCount: input.chunk.events.length,
        compressedBytes: storedPayload.byteLength,
        uncompressedBytes: payload.byteLength,
        checksumSha256,
        firstEventAt: eventBounds.firstEventAt,
        lastEventAt: eventBounds.lastEventAt,
        receivedAt,
      });

      if (!inserted.inserted) {
        if (
          inserted.chunk.checksumSha256 !== checksumSha256 ||
          (inserted.chunk.uncompressedBytes ?? inserted.chunk.compressedBytes) !== payload.byteLength
        ) {
          if (inserted.chunk.objectKey !== objectKey) {
            await options.recordingObjectStore.deleteObject(objectKey);
          }
          if (isMutableRecordingStatus(recording.status)) {
            await markRecordingFailed({
              repository: options.repository,
              recordingId: recording.id,
              sessionId: recording.sessionId,
              errorCode: "duplicate_mismatch",
              now: receivedAt,
            });
          }
          throw new TrackingV2InvalidContextError();
        }

        await settleRecordingByUploadToken({
          repository: options.repository,
          recordingId: recording.id,
          uploadTokenHash,
          now: receivedAt,
        });
        return {
          accepted: true,
          duplicate: true,
          sequence: inserted.chunk.sequence,
        };
      }

      await options.repository.updateRecordingAfterChunk({
        recordingId: recording.id,
        status: "recording",
        addedEventCount: input.chunk.events.length,
        addedCompressedBytes: storedPayload.byteLength,
        receivedAt,
      });
      await options.repository.incrementRecordingUsage({
        workspaceId: recording.workspaceId,
        date: receivedAt.toISOString().slice(0, 10),
        recordingCount: input.chunk.sequence === 0 ? 1 : 0,
        compressedBytes: storedPayload.byteLength,
      });
      await settleRecordingByUploadToken({
        repository: options.repository,
        recordingId: recording.id,
        uploadTokenHash,
        now: now(),
      });

      return {
        accepted: true,
        duplicate: false,
        sequence: input.chunk.sequence,
      };
    },

    async completeRecording(input) {
      const recording = await options.repository.findRecordingForUploadToken({
        recordingId: input.recordingId,
        uploadTokenHash: hashRecordingUploadToken({
          recordingId: input.recordingId,
          sessionId: input.complete.sessionId,
          uploadToken: input.uploadToken,
          secret: options.tokenSecret,
        }),
      });

      if (!recording || recording.publicSessionId !== input.complete.sessionId) {
        throw new TrackingV2InvalidContextError();
      }

      if (isCompletedRecordingStatus(recording.status)) {
        return {
          completed: true,
          status: recording.status,
        };
      }

      const chunks = await options.repository.listRecordingChunks(recording.id);
      const completion = getRecordingCompletion({
        chunks,
        complete: input.complete,
        recording,
        updatedAt: now(),
      });
      if (!hasContiguousChunks(chunks, completion.finalSequence)) {
        await options.repository.requestRecordingCompletion(completion);
        const settled = await settleRecordingByUploadToken({
          repository: options.repository,
          recordingId: recording.id,
          uploadTokenHash: hashRecordingUploadToken({
            recordingId: input.recordingId,
            sessionId: input.complete.sessionId,
            uploadToken: input.uploadToken,
            secret: options.tokenSecret,
          }),
          now: now(),
        });
        return {
          completed: settled,
          status: settled ? completion.status : "recording",
        };
      }

      await finalizeRecording({
        repository: options.repository,
        recording,
        completion,
      });

      return {
        completed: true,
        status: completion.status,
      };
    },

    async getRecordingManifest(input) {
      const recording = await options.repository.findRecordingForWorkspace({
        workspaceId: input.workspaceId,
        publicSessionId: input.sessionId,
      });
      if (!recording) {
        return null;
      }

      const chunks = getContiguousChunks(await options.repository.listRecordingChunks(recording.id));

      return {
        recordingId: recording.id,
        sessionId: recording.publicSessionId,
        status: recording.status,
        startedAt: recording.startedAt.toISOString(),
        endedAt: recording.endedAt?.toISOString() ?? null,
        durationMs: recording.durationMs,
        eventCount: recording.eventCount,
        chunkCount: chunks.length,
        compressedBytes: chunks.reduce((total, chunk) => total + chunk.compressedBytes, 0),
        maxDurationMs: recording.maxDurationMs,
        chunks: chunks.map((chunk) => ({
          sequence: chunk.sequence,
          eventCount: chunk.eventCount,
          compressedBytes: chunk.compressedBytes,
          checksumSha256: chunk.checksumSha256,
          firstEventAt: chunk.firstEventAt?.toISOString() ?? null,
          lastEventAt: chunk.lastEventAt?.toISOString() ?? null,
        })),
      };
    },

    async getRecordingChunkObject(input) {
      if (!options.recordingObjectStore) {
        return null;
      }

      const chunk = await options.repository.findRecordingChunk({
        recordingId: input.recordingId,
        sequence: input.sequence,
      });

      if (!chunk || chunk.workspaceId !== input.workspaceId) {
        return null;
      }

      const object = await options.recordingObjectStore.getObject(chunk.objectKey);
      if (!object || object.contentType !== "application/gzip") {
        return object;
      }

      return {
        body: await gunzipPayload(object.body),
        contentType: "application/json; charset=utf-8",
      };
    },

    async recordHeartbeat(heartbeat) {
      const serverNow = now();
      const activeAfter = getSessionActiveAfter(serverNow);
      const session = await options.repository.findSessionForEventToken({
        publicSessionId: heartbeat.sessionId,
        activeAfter,
        eventTokenHash: hashEventToken({
          sessionId: heartbeat.sessionId,
          eventToken: heartbeat.eventToken,
          secret: options.tokenSecret,
        }),
      });

      if (!session) {
        throw new TrackingV2InvalidContextError();
      }

      const occurredAt = normalizeLifecycleAt({
        clientOccurredAt: new Date(heartbeat.occurredAt),
        serverNow,
        session,
      });
      const updated = await options.repository.updateSessionHeartbeat({
        sessionId: session.id,
        activeAfter,
        occurredAt,
        activeMs: getCreditedActiveMs({
          claimedActiveMs: heartbeat.activeMs,
          occurredAt,
          session,
        }),
        maxScrollDepthPercent: heartbeat.maxScrollDepthPercent ?? null,
      });

      if (!updated) {
        throw new TrackingV2InvalidContextError();
      }
    },

    async endSession(end) {
      const serverNow = now();
      const activeAfter = getSessionActiveAfter(serverNow);
      const session = await options.repository.findSessionForEventToken({
        publicSessionId: end.sessionId,
        activeAfter,
        eventTokenHash: hashEventToken({
          sessionId: end.sessionId,
          eventToken: end.eventToken,
          secret: options.tokenSecret,
        }),
      });

      if (!session) {
        throw new TrackingV2InvalidContextError();
      }

      const occurredAt = normalizeLifecycleAt({
        clientOccurredAt: new Date(end.occurredAt),
        serverNow,
        session,
      });
      const ended = await options.repository.endSession({
        sessionId: session.id,
        activeAfter,
        occurredAt,
        reason: end.reason,
        activeMs: end.activeMs === undefined
          ? session.activeMs
          : getCreditedActiveMs({
              claimedActiveMs: end.activeMs,
              occurredAt,
              session,
            }),
      });

      if (!ended) {
        throw new TrackingV2InvalidContextError();
      }
    },
  };
}

function toSessionSummaryResponse(record: TrackingV2SessionReadRecord): TrackingV2SessionSummary {
  return {
    ...record,
    startedAt: record.startedAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
  };
}

function buildSiteSettingsResponse(input: {
  settings: TrackingV2SettingRecord[];
  site: TrackingV2SiteSummaryRecord;
  siteOverride: TrackingV2SettingRecord | null;
}): Omit<TrackingV2SiteTrackingSettingsResponse, "requestId"> {
  return {
    site: input.site,
    scope: "site",
    workspaceDefault: toTrackingSettings(resolveEffectiveSettings(
      input.settings.filter((setting) => setting.scope === "workspace"),
    )),
    siteOverride: input.siteOverride ? toTrackingSettings(input.siteOverride) : null,
    effective: toTrackingSettings(resolveEffectiveSettings(input.settings)),
    recordingDisclosure: {
      required: true,
      text: TRACKING_V2_RECORDING_DISCLOSURE_TEXT,
    },
  };
}

function toTrackingSettings(settings: EffectiveTrackingSettings): TrackingV2TrackingSettings {
  return {
    enabled: settings.enabled,
    captureIpAddress: settings.captureIpAddress,
    rawIpRetentionDays: settings.rawIpRetentionDays,
    eventRetentionDays: settings.eventRetentionDays,
    recordingEnabled: settings.recordingEnabled,
    recordingRetentionDays: settings.recordingRetentionDays,
    maxRecordingDurationSeconds: settings.maxRecordingDurationSeconds,
  };
}

function toWritableSettings(settings: TrackingV2UpdateSiteSettingsRequest): TrackingV2WritableSettings {
  return {
    enabled: settings.enabled,
    captureIpAddress: settings.captureIpAddress,
    rawIpRetentionDays: settings.rawIpRetentionDays,
    eventRetentionDays: settings.eventRetentionDays,
    recordingEnabled: settings.recordingEnabled,
    recordingRetentionDays: settings.recordingRetentionDays,
    maxRecordingDurationSeconds: settings.maxRecordingDurationSeconds,
  };
}

async function runTrackingV2RepositoryQuery<TResult>(query: () => Promise<TResult>) {
  try {
    return await query();
  } catch (error) {
    throw mapTrackingV2RepositoryError(error);
  }
}

function mapTrackingV2RepositoryError(error: unknown) {
  if (isDatabaseConnectionError(error)) {
    return new TrackingV2UnavailableError();
  }

  return error;
}

function parseOptionalDate(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

function encodeEventCursor(cursor: TrackingV2EventCursor | null) {
  if (!cursor) {
    return null;
  }

  return Buffer.from(JSON.stringify({
    receivedAt: cursor.receivedAt.toISOString(),
    id: cursor.id,
  }), "utf8").toString("base64url");
}

function decodeEventCursor(value: string | undefined): TrackingV2EventCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;

    if (!isEventCursorPayload(parsed)) {
      throw new TrackingV2InvalidCursorError();
    }

    return {
      receivedAt: new Date(parsed.receivedAt),
      id: parsed.id,
    };
  } catch {
    throw new TrackingV2InvalidCursorError();
  }
}

function encodeSessionCursor(cursor: TrackingV2SessionCursor | null) {
  if (!cursor) {
    return null;
  }

  return Buffer.from(JSON.stringify({
    startedAt: cursor.startedAt.toISOString(),
    id: cursor.id,
  }), "utf8").toString("base64url");
}

function decodeSessionCursor(value: string | undefined): TrackingV2SessionCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;

    if (!isSessionCursorPayload(parsed)) {
      throw new TrackingV2InvalidCursorError();
    }

    return {
      startedAt: new Date(parsed.startedAt),
      id: parsed.id,
    };
  } catch {
    throw new TrackingV2InvalidCursorError();
  }
}

function isEventCursorPayload(value: unknown): value is { receivedAt: string; id: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const input = value as Partial<{ receivedAt: string; id: string }>;

  return typeof input.receivedAt === "string" &&
    !Number.isNaN(Date.parse(input.receivedAt)) &&
    typeof input.id === "string" &&
    input.id.length > 0;
}

function isSessionCursorPayload(value: unknown): value is { startedAt: string; id: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const input = value as Partial<{ startedAt: string; id: string }>;

  return typeof input.startedAt === "string" &&
    !Number.isNaN(Date.parse(input.startedAt)) &&
    typeof input.id === "string" &&
    input.id.length > 0;
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (
    "code" in error &&
    typeof error.code === "string" &&
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(error.code)
  ) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.some(isDatabaseConnectionError);
  }

  if (
    "message" in error &&
    typeof error.message === "string" &&
    (/^Failed query:/.test(error.message) ||
      /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/.test(error.message))
  ) {
    return true;
  }

  return false;
}

export function hashEventToken(input: {
  sessionId: string;
  eventToken: string;
  secret: string;
}) {
  assertSecret(input.secret, "Tracking v2 event token secret");

  return createHmac("sha256", input.secret)
    .update("tracking-v2-event-token")
    .update("\0")
    .update(input.sessionId)
    .update("\0")
    .update(input.eventToken)
    .digest("hex");
}

export function hashRecordingUploadToken(input: {
  recordingId: string;
  sessionId: string;
  uploadToken: string;
  secret: string;
}) {
  assertSecret(input.secret, "Tracking v2 recording upload token secret");

  return createHmac("sha256", input.secret)
    .update("tracking-v2-recording-upload-token")
    .update("\0")
    .update(input.recordingId)
    .update("\0")
    .update(input.sessionId)
    .update("\0")
    .update(input.uploadToken)
    .digest("hex");
}

async function createRecordingConfig(input: {
  context: TrackingV2ContextTokenPayload;
  effectiveSettings: EffectiveTrackingSettings;
  now: () => Date;
  options: TrackingV2ServiceOptions;
  publicSessionId: string;
  randomToken: () => string;
  session: Awaited<ReturnType<TrackingV2Repository["createSession"]>>;
  startedAt: Date;
}): Promise<TrackingV2SessionStartResponse["recording"]> {
  const disabled = disabledRecordingConfig();
  if (
    !input.options.recordingObjectStore ||
    input.context.trackingMode !== "events_and_recording" ||
    !input.effectiveSettings.recordingEnabled
  ) {
    return disabled;
  }

  const recordingId = randomUUID();
  const uploadToken = `recording_${input.randomToken()}`;
  const maxDurationMs = Math.min(
    input.effectiveSettings.maxRecordingDurationSeconds * 1000,
    TRACKING_V2_MAX_RECORDING_DURATION_MS,
  );
  const expiresAt = new Date(
    input.startedAt.getTime() + input.effectiveSettings.recordingRetentionDays * 24 * 60 * 60 * 1000,
  );

  try {
    await input.options.repository.createRecording({
      recordingId,
      workspaceId: input.context.workspaceId,
      siteId: input.context.siteId,
      recipientId: input.context.recipientId,
      sessionId: input.session.id,
      publicSessionId: input.publicSessionId,
      uploadTokenHash: hashRecordingUploadToken({
        recordingId,
        sessionId: input.publicSessionId,
        uploadToken,
        secret: input.options.tokenSecret,
      }),
      runtimeVersion: TRACKING_V2_SCRIPT_VERSION,
      maxDurationMs,
      maxChunkBytes: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
      maxEvents: TRACKING_V2_RECORDING_MAX_EVENTS,
      startedAt: input.startedAt,
      expiresAt,
    });
  } catch {
    await input.options.repository.updateSessionRecordingStatus({
      sessionId: input.session.id,
      status: "failed",
      updatedAt: input.now(),
    }).catch(() => {});
    return disabled;
  }

  return {
    enabled: true,
    recordingId,
    uploadToken,
    chunkEndpoint: `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/${recordingId}/chunks`,
    completeEndpoint: `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/${recordingId}/complete`,
    maxDurationMs,
    flushIntervalMs: TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS,
    targetChunkBytes: TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES,
    maxChunkBytes: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
    maxBytes: TRACKING_V2_RECORDING_MAX_BYTES,
    maxEvents: TRACKING_V2_RECORDING_MAX_EVENTS,
    maxEventsPerChunk: TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK,
  };
}

function disabledRecordingConfig(): Extract<TrackingV2SessionStartResponse["recording"], { enabled: false }> {
  return {
    enabled: false,
    maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS,
  };
}

async function markRecordingFailed(input: {
  repository: TrackingV2Repository;
  recordingId: string;
  sessionId: string;
  errorCode: string;
  now: Date;
}) {
  await input.repository.completeRecording({
    recordingId: input.recordingId,
    status: "failed",
    endedAt: input.now,
    durationMs: 0,
    stopReason: "error",
    finalSequence: null,
    errorCode: input.errorCode,
    updatedAt: input.now,
  });
  await input.repository.updateSessionRecordingStatus({
    sessionId: input.sessionId,
    status: "failed",
    updatedAt: input.now,
  });
}

type RecordingCompletion = {
  recordingId: string;
  status: "available" | "truncated" | "failed";
  endedAt: Date;
  durationMs: number;
  stopReason: string;
  finalSequence: number | null;
  errorCode: string | null;
  updatedAt: Date;
};

function getRecordingCompletion(input: {
  chunks: TrackingV2RecordingChunkRecord[];
  complete: TrackingV2RecordingComplete;
  recording: TrackingV2RecordingRecord;
  updatedAt: Date;
}): RecordingCompletion {
  const eventBounds = getRecordingChunkBounds(input.chunks);
  const clientEndedAt = new Date(input.complete.endedAt);
  const endedAt = eventBounds.lastEventAt ?? clampRecordingEnd({
    clientEndedAt,
    maxDurationMs: input.recording.maxDurationMs,
    startedAt: input.recording.startedAt,
    updatedAt: input.updatedAt,
  });
  const status = input.complete.finalSequence === null
    ? "failed"
    : getRecordingStatusForStopReason(input.complete.stopReason);
  const durationMs = eventBounds.firstEventAt && eventBounds.lastEventAt
    ? eventBounds.lastEventAt.getTime() - eventBounds.firstEventAt.getTime()
    : endedAt.getTime() - input.recording.startedAt.getTime();

  return {
    recordingId: input.recording.id,
    status,
    endedAt,
    durationMs: Math.min(input.recording.maxDurationMs, Math.max(0, durationMs)),
    stopReason: input.complete.stopReason,
    finalSequence: input.complete.finalSequence,
    errorCode: status === "failed" ? "client_error" : null,
    updatedAt: input.updatedAt,
  };
}

function getRecordingStatusForStopReason(stopReason: string): RecordingCompletion["status"] {
  return stopReason === "error"
    ? "failed"
    : stopReason === "duration_cap" ||
        stopReason === "size_cap" ||
        stopReason === "event_cap"
      ? "truncated"
      : "available";
}

function isMutableRecordingStatus(status: TrackingV2RecordingRecord["status"]) {
  return status === "pending" || status === "recording";
}

function isCompletedRecordingStatus(
  status: TrackingV2RecordingRecord["status"],
): status is RecordingCompletion["status"] {
  return status === "available" || status === "truncated" || status === "failed";
}

async function settleRecordingIfCompletionRequested(input: {
  repository: TrackingV2Repository;
  recording: TrackingV2RecordingRecord;
  now: Date;
}) {
  if (
    !input.recording.endedAt ||
    !input.recording.stopReason
  ) {
    return false;
  }

  const chunks = await input.repository.listRecordingChunks(input.recording.id);
  if (!hasContiguousChunks(chunks, input.recording.finalSequence)) {
    return false;
  }
  const eventBounds = getRecordingChunkBounds(chunks);
  const endedAt = eventBounds.lastEventAt ?? input.recording.endedAt;
  const durationMs = eventBounds.firstEventAt && eventBounds.lastEventAt
    ? eventBounds.lastEventAt.getTime() - eventBounds.firstEventAt.getTime()
    : input.recording.durationMs;

  await finalizeRecording({
    repository: input.repository,
    recording: input.recording,
    completion: {
      recordingId: input.recording.id,
      status: getRecordingStatusForStopReason(input.recording.stopReason),
      endedAt,
      durationMs: Math.min(input.recording.maxDurationMs, Math.max(0, durationMs)),
      stopReason: input.recording.stopReason,
      finalSequence: input.recording.finalSequence,
      errorCode: input.recording.errorCode,
      updatedAt: input.now,
    },
  });

  return true;
}

async function settleRecordingByUploadToken(input: {
  repository: TrackingV2Repository;
  recordingId: string;
  uploadTokenHash: string;
  now: Date;
}) {
  const recording = await input.repository.findRecordingForUploadToken({
    recordingId: input.recordingId,
    uploadTokenHash: input.uploadTokenHash,
  });

  if (!recording || !isMutableRecordingStatus(recording.status)) {
    return Boolean(recording && isCompletedRecordingStatus(recording.status));
  }

  return settleRecordingIfCompletionRequested({
    repository: input.repository,
    recording,
    now: input.now,
  });
}

async function finalizeRecording(input: {
  repository: TrackingV2Repository;
  recording: TrackingV2RecordingRecord;
  completion: RecordingCompletion;
}) {
  await input.repository.completeRecording(input.completion);
  await input.repository.updateSessionRecordingStatus({
    sessionId: input.recording.sessionId,
    status: input.completion.status === "failed" ? "failed" : "available",
    recordingDurationMs: input.completion.durationMs,
    recordingObjectKey: input.recording.objectPrefix,
    updatedAt: input.completion.updatedAt,
  });
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function gzipPayload(value: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    gzip(value, { level: 6 }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function gunzipPayload(value: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    gunzip(value, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function getRrwebEventBounds(
  events: TrackingV2RecordingChunk["events"],
  limits: { minTimestamp: number; maxTimestamp: number },
) {
  let firstTimestamp = Number.POSITIVE_INFINITY;
  let lastTimestamp = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const timestamp = Math.min(Math.max(event.timestamp, limits.minTimestamp), limits.maxTimestamp);
    firstTimestamp = Math.min(firstTimestamp, timestamp);
    lastTimestamp = Math.max(lastTimestamp, timestamp);
  }

  return {
    firstEventAt: Number.isFinite(firstTimestamp) ? new Date(firstTimestamp) : null,
    lastEventAt: Number.isFinite(lastTimestamp) ? new Date(lastTimestamp) : null,
  };
}

function getRecordingChunkBounds(chunks: TrackingV2RecordingChunkRecord[]) {
  let firstEventAt: Date | null = null;
  let lastEventAt: Date | null = null;

  for (const chunk of chunks) {
    if (chunk.firstEventAt && (!firstEventAt || chunk.firstEventAt < firstEventAt)) {
      firstEventAt = chunk.firstEventAt;
    }
    if (chunk.lastEventAt && (!lastEventAt || chunk.lastEventAt > lastEventAt)) {
      lastEventAt = chunk.lastEventAt;
    }
  }

  return { firstEventAt, lastEventAt };
}

function clampRecordingEnd(input: {
  clientEndedAt: Date;
  maxDurationMs: number;
  startedAt: Date;
  updatedAt: Date;
}) {
  const maximum = Math.min(
    input.startedAt.getTime() + input.maxDurationMs,
    input.updatedAt.getTime() + TRACKING_V2_HEARTBEAT_INTERVAL_MS,
  );
  const clientTime = Number.isFinite(input.clientEndedAt.getTime())
    ? input.clientEndedAt.getTime()
    : input.updatedAt.getTime();

  return new Date(Math.min(Math.max(clientTime, input.startedAt.getTime()), maximum));
}

function normalizeLifecycleAt(input: {
  clientOccurredAt: Date;
  serverNow: Date;
  session: { startedAt: Date; lastSeenAt: Date };
}) {
  const minimum = Math.max(
    input.session.startedAt.getTime(),
    input.session.lastSeenAt.getTime(),
  );
  const maximum = Math.min(
    minimum + TRACKING_V2_MAX_SESSION_DURATION_MS,
    input.serverNow.getTime() + TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS,
  );
  const clientTime = Number.isFinite(input.clientOccurredAt.getTime())
    ? input.clientOccurredAt.getTime()
    : input.serverNow.getTime();

  return new Date(Math.min(Math.max(clientTime, minimum), maximum));
}

function getCreditedActiveMs(input: {
  claimedActiveMs: number;
  occurredAt: Date;
  session: {
    activeMs: number;
    lastSeenAt: Date;
  };
}) {
  const claimedDelta = Math.max(0, input.claimedActiveMs - input.session.activeMs);
  const elapsedSinceSignal = Math.max(
    0,
    input.occurredAt.getTime() - input.session.lastSeenAt.getTime(),
  );
  const credit = Math.min(
    claimedDelta,
    elapsedSinceSignal,
    TRACKING_V2_MAX_HEARTBEAT_CREDIT_MS,
  );

  return Math.min(TRACKING_V2_MAX_SESSION_DURATION_MS, input.session.activeMs + credit);
}

function getSessionActiveAfter(serverNow: Date) {
  return new Date(serverNow.getTime() - TRACKING_V2_SESSION_STALE_AFTER_MS);
}

function hasContiguousChunks(chunks: TrackingV2RecordingChunkRecord[], finalSequence: number | null) {
  if (finalSequence === null) {
    return chunks.length === 0;
  }

  const sequences = new Set(chunks.map((chunk) => chunk.sequence));
  for (let sequence = 0; sequence <= finalSequence; sequence += 1) {
    if (!sequences.has(sequence)) {
      return false;
    }
  }

  return true;
}

function getContiguousChunks(chunks: TrackingV2RecordingChunkRecord[]) {
  const sorted = [...chunks].sort((left, right) => left.sequence - right.sequence);
  const contiguous: TrackingV2RecordingChunkRecord[] = [];

  for (const chunk of sorted) {
    if (chunk.sequence !== contiguous.length) {
      break;
    }

    contiguous.push(chunk);
  }

  return contiguous;
}

function buildServerEventId(input: {
  context: TrackingV2ContextTokenPayload;
  secret: string;
  type: "slack_share";
  bucketMs: number;
  occurredAt: Date;
}) {
  assertSecret(input.secret, "Tracking v2 server event secret");

  const bucket = Math.floor(input.occurredAt.getTime() / input.bucketMs);
  const digest = createHmac("sha256", input.secret)
    .update("tracking-v2-server-event")
    .update("\0")
    .update(input.type)
    .update("\0")
    .update(input.context.workspaceId)
    .update("\0")
    .update(input.context.siteId)
    .update("\0")
    .update(input.context.publishedVersionId)
    .update("\0")
    .update(input.context.recipientId ?? "default")
    .update("\0")
    .update(String(input.context.recipientRevision ?? 0))
    .update("\0")
    .update(String(bucket))
    .digest("hex");

  return `event_${input.type}_${digest}`;
}

function stoppedSession(reason: "disabled" | "suppressed"): TrackingV2SessionStartResponse {
  return {
    accepted: false,
    eventsAccepted: false,
    recordingAccepted: false,
    reason,
    recording: {
      enabled: false,
      maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS,
    },
  };
}

function resolveEffectiveSettings(settings: TrackingV2SettingRecord[]): EffectiveTrackingSettings {
  const effective = { ...defaultEffectiveSettings };
  const precedence: Record<TrackingV2SettingRecord["scope"], number> = {
    workspace: 1,
    site: 2,
    recipient: 3,
  };

  for (const setting of [...settings].sort((left, right) => precedence[left.scope] - precedence[right.scope])) {
    effective.enabled = setting.enabled;
    effective.captureIpAddress = setting.captureIpAddress;
    effective.rawIpRetentionDays = setting.rawIpRetentionDays;
    effective.eventRetentionDays = setting.eventRetentionDays;
    effective.recordingEnabled = setting.recordingEnabled;
    effective.recordingRetentionDays = setting.recordingRetentionDays;
    effective.maxRecordingDurationSeconds = setting.maxRecordingDurationSeconds;
  }

  return effective;
}

function sanitizeIpAddress(value: string | null | undefined) {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  const firstForwardedIp = candidate.split(",")[0]?.trim() ?? "";
  return isIP(firstForwardedIp) ? firstForwardedIp : null;
}

function normalizeCountryCode(value: string | null | undefined) {
  const countryCode = value?.trim().toUpperCase();
  return countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
}

function truncateNullable(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function classifyUserAgent(userAgent: string | null) {
  const value = userAgent ?? "";

  return {
    deviceType: classifyDeviceType(value),
    osName: classifyOs(value),
    browserName: classifyBrowser(value),
    userAgentFamily: classifyBrowser(value),
  };
}

function classifyDeviceType(userAgent: string) {
  if (/\b(ipad|tablet)\b/i.test(userAgent)) {
    return "tablet";
  }

  if (/\b(mobile|iphone|android)\b/i.test(userAgent)) {
    return "mobile";
  }

  return userAgent ? "desktop" : "unknown";
}

function classifyOs(userAgent: string) {
  if (/\biphone|ipad|ios\b/i.test(userAgent)) return "iOS";
  if (/\bandroid\b/i.test(userAgent)) return "Android";
  if (/\bmac os x|macintosh\b/i.test(userAgent)) return "macOS";
  if (/\bwindows\b/i.test(userAgent)) return "Windows";
  if (/\blinux\b/i.test(userAgent)) return "Linux";
  return userAgent ? "Other" : "Unknown";
}

function classifyBrowser(userAgent: string) {
  if (/\bedg\//i.test(userAgent)) return "Edge";
  if (/\bfirefox\//i.test(userAgent)) return "Firefox";
  if (/\bchrome\//i.test(userAgent) && !/\bedg\//i.test(userAgent)) return "Chrome";
  if (/\bsafari\//i.test(userAgent) && !/\bchrome\//i.test(userAgent)) return "Safari";
  return userAgent ? "Other" : "Unknown";
}

function assertSecret(secret: string, label: string) {
  if (secret.length < 32) {
    throw new Error(`${label} must be at least 32 characters.`);
  }
}
