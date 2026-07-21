import { createHash, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { gzip as gzipCallback } from "node:zlib";
import {
  TRACKING_V2_MAX_RECORDING_DURATION_MS,
  TRACKING_V2_RECORDING_DAILY_MAX_COMPRESSED_BYTES,
  TRACKING_V2_RECORDING_DAILY_MAX_COUNT,
  TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS,
  TRACKING_V2_RECORDING_MAX_BYTES,
  TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
  TRACKING_V2_RECORDING_MAX_EVENTS,
  TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK,
  TRACKING_V2_RECORDING_SCHEMA_VERSION,
  TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES,
  TRACKING_V2_RECORDING_ENDPOINT_PREFIX,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_VISITOR_NOTICE_VERSION,
  trackingV2RecordingChunkSchema,
  type TrackingV2RecordingChunk,
  type TrackingV2RecordingComplete,
  type TrackingV2RecordingManifestResponse,
  type TrackingV2RecordingUpload,
} from "@handout/tracking-schema";

import type { TrackingV2RecordingObject, TrackingV2RecordingObjectStore } from "./recording-object-store";
import {
  TrackingV2RecordingAggregateLimitError,
  TrackingV2RecordingConflictError,
  TrackingV2RecordingDailyLimitError,
  type TrackingV2RecordingChunkRecord,
  type TrackingV2RecordingRecord,
  type TrackingV2RecordingRepository,
} from "./recording-repository";
import type { TrackingV2SessionRecord, TrackingV2WritableSettings } from "./repository";

const gzip = promisify(gzipCallback);
const MAX_CONSENT_AGE_MS = 180 * 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_SANITIZE_DEPTH = 32;
const MASKED_VALUE = "[masked]";
const INPUT_EVENT_SOURCE = 5;
const STYLE_URL_PATTERN = /url\(([^)]*)\)/gi;

export class TrackingV2RecordingInvalidError extends Error {
  constructor() {
    super("Invalid recording upload.");
    this.name = "TrackingV2RecordingInvalidError";
  }
}

export class TrackingV2RecordingLimitError extends Error {
  constructor(readonly code: "chunk_too_large" | "daily_cap" | "event_cap" | "recording_size_cap") {
    super("Recording upload limit exceeded.");
    this.name = "TrackingV2RecordingLimitError";
  }
}

export type TrackingV2RecordingService = ReturnType<typeof createTrackingV2RecordingService>;

export function createTrackingV2RecordingService(options: {
  repository: TrackingV2RecordingRepository;
  objectStore: TrackingV2RecordingObjectStore;
  tokenSecret: string;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());

  return {
    async start(input: {
      context: { trackingMode: "off" | "events" | "events_and_replay"; workspacePlan: "free" | "core" | "pro" };
      session: TrackingV2SessionRecord;
      settings: TrackingV2WritableSettings;
      consent: { noticeVersion: number; grantedAt: string; source: "prompt" | "remembered" } | undefined;
    }) {
      if (
        input.context.trackingMode !== "events_and_replay" ||
        input.context.workspacePlan !== "pro" ||
        !input.settings.recordingEnabled ||
        !validConsent(input.consent, now())
      ) {
        return disabledConfig();
      }

      const recordingId = deriveRecordingId(input.session.id, options.tokenSecret);
      const uploadToken = deriveRecordingUploadToken(input.session.id, options.tokenSecret);
      const startedAt = input.session.startedAt;
      const maxDurationMs = Math.min(
        TRACKING_V2_MAX_RECORDING_DURATION_MS,
        input.settings.maxRecordingDurationSeconds * 1000,
      );
      const consentGrantedAt = new Date(input.consent!.grantedAt);
      const existing = await options.repository.findForWorkspace({
        workspaceId: input.session.workspaceId,
        publicSessionId: input.session.publicSessionId,
      });
      if (existing) {
        return mutable(existing.status) && existing.uploadTokenHash === hashUploadToken(existing.id, uploadToken, options.tokenSecret)
          ? enabledConfig({ recordingId: existing.id, uploadToken, maxDurationMs: existing.maxDurationMs })
          : disabledConfig();
      }
      const recording = await options.repository.createRecording({
        id: recordingId,
        workspaceId: input.session.workspaceId,
        siteId: input.session.siteId,
        recipientId: input.session.recipientId,
        sessionId: input.session.id,
        publicSessionId: input.session.publicSessionId,
        uploadTokenHash: hashUploadToken(recordingId, uploadToken, options.tokenSecret),
        runtimeVersion: TRACKING_V2_SCRIPT_VERSION,
        visitorNoticeVersion: TRACKING_V2_VISITOR_NOTICE_VERSION,
        consentGrantedAt,
        consentSource: input.consent!.source,
        maxDurationMs,
        maxChunkBytes: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
        maxEvents: TRACKING_V2_RECORDING_MAX_EVENTS,
        startedAt,
        expiresAt: new Date(startedAt.getTime() + input.settings.recordingRetentionDays * 86_400_000),
        usageDate: utcDate(startedAt),
        dailyRecordingLimit: TRACKING_V2_RECORDING_DAILY_MAX_COUNT,
      });
      if (!recording) return disabledConfig();
      if (!mutable(recording.status) || recording.uploadTokenHash !== hashUploadToken(recording.id, uploadToken, options.tokenSecret)) return disabledConfig();
      return enabledConfig({ recordingId: recording.id, uploadToken, maxDurationMs: recording.maxDurationMs });
    },

    async uploadChunk(input: { recordingId: string; uploadToken: string; upload: TrackingV2RecordingUpload }) {
      const receivedAt = now();
      const recording = await authorizedRecording(options.repository, input.recordingId, input.uploadToken, options.tokenSecret);
      if (recording.publicSessionId !== input.upload.sessionId) throw new TrackingV2RecordingInvalidError();

      const sanitized = trackingV2RecordingChunkSchema.parse({
        schemaVersion: input.upload.schemaVersion,
        sessionId: input.upload.sessionId,
        sequence: input.upload.sequence,
        events: input.upload.events.map((event) => sanitizeRrwebEvent(event)),
      });
      const eventBounds = recordingEventBounds(sanitized.events, recording);
      if (!eventBounds) {
        await failOrTruncate(options.repository, recording, "event_timestamp", receivedAt);
        throw new TrackingV2RecordingInvalidError();
      }

      const payload = Buffer.from(JSON.stringify(sanitized), "utf8");
      if (payload.byteLength > recording.maxChunkBytes) {
        await failOrTruncate(options.repository, recording, "chunk_too_large", receivedAt);
        throw new TrackingV2RecordingLimitError("chunk_too_large");
      }
      if (input.upload.completion) {
        await options.repository.requestCompletion(buildRecordingCompletion({
          recording,
          complete: {
            schemaVersion: input.upload.schemaVersion,
            sessionId: input.upload.sessionId,
            ...input.upload.completion,
          },
          completedAt: receivedAt,
        }));
      }
      const checksumSha256 = createHash("sha256").update(payload).digest("hex");
      const existing = await options.repository.findChunk({ recordingId: recording.id, sequence: sanitized.sequence });
      if (existing) {
        if (existing.checksumSha256 !== checksumSha256) {
          await failOrTruncate(options.repository, recording, "sequence_conflict", receivedAt);
          throw new TrackingV2RecordingInvalidError();
        }
        await settleIfRequested(options.repository, recording, receivedAt);
        return { duplicate: true, sequence: existing.sequence };
      }
      if (!mutable(recording.status)) throw new TrackingV2RecordingInvalidError();

      const compressed = await gzip(payload, { level: 6 });
      const objectKey = options.repository.getObjectKey({
        workspaceId: recording.workspaceId,
        recordingId: recording.id,
        sequence: sanitized.sequence,
        checksumSha256,
      });
      await options.objectStore.putObject({
        key: objectKey,
        body: compressed,
        contentType: "application/json; charset=utf-8",
        contentEncoding: "gzip",
      });

      try {
        const inserted = await options.repository.insertChunk({
          recordingId: recording.id,
          workspaceId: recording.workspaceId,
          sessionId: recording.sessionId,
          sequence: sanitized.sequence,
          objectKey,
          eventCount: sanitized.events.length,
          compressedBytes: compressed.byteLength,
          uncompressedBytes: payload.byteLength,
          checksumSha256,
          firstEventAt: eventBounds.first,
          lastEventAt: eventBounds.last,
          receivedAt,
          usageDate: utcDate(receivedAt),
          dailyCompressedByteLimit: TRACKING_V2_RECORDING_DAILY_MAX_COMPRESSED_BYTES,
          recordingByteLimit: TRACKING_V2_RECORDING_MAX_BYTES,
        });
        await settleIfRequested(options.repository, recording, receivedAt);
        return { duplicate: inserted.duplicate, sequence: inserted.chunk.sequence };
      } catch (error) {
        try {
          await options.objectStore.deleteObject(objectKey);
        } catch {
          await options.repository.enqueueObjectDeletion(objectKey).catch(() => undefined);
        }
        if (error instanceof TrackingV2RecordingConflictError) {
          await failOrTruncate(options.repository, recording, "sequence_conflict", receivedAt);
          throw new TrackingV2RecordingInvalidError();
        }
        if (error instanceof TrackingV2RecordingDailyLimitError) {
          await failOrTruncate(options.repository, recording, "daily_cap", receivedAt);
          throw new TrackingV2RecordingLimitError("daily_cap");
        }
        if (error instanceof TrackingV2RecordingAggregateLimitError) {
          const code = recording.eventCount + sanitized.events.length > recording.maxEvents
            ? "event_cap" as const
            : "recording_size_cap" as const;
          await failOrTruncate(options.repository, recording, code, receivedAt);
          throw new TrackingV2RecordingLimitError(code);
        }
        throw error;
      }
    },

    async complete(input: { recordingId: string; uploadToken: string; complete: TrackingV2RecordingComplete }) {
      const completedAt = now();
      const recording = await authorizedRecording(options.repository, input.recordingId, input.uploadToken, options.tokenSecret);
      if (recording.publicSessionId !== input.complete.sessionId) throw new TrackingV2RecordingInvalidError();
      if (!mutable(recording.status)) return { status: recording.status };

      const completion = buildRecordingCompletion({ recording, complete: input.complete, completedAt });
      const chunks = await options.repository.listChunks(recording.id);
      if (!hasContiguousChunks(chunks, completion.finalSequence)) {
        await options.repository.requestCompletion(completion);
        // The page-exit chunk and completion request are intentionally sent in
        // parallel by the browser. Reconcile from both sides of that race: the
        // chunk upload settles a previously requested completion, and the
        // completion request re-checks chunks that may have committed while it
        // was waiting for the recording row lock.
        await settleIfRequested(options.repository, recording, completedAt);
        const reconciled = await options.repository.findForUpload({
          recordingId: recording.id,
          uploadTokenHash: recording.uploadTokenHash,
        });
        return { status: reconciled?.status ?? "recording" as const };
      }
      const status = completionStatus(input.complete.stopReason, chunks.length);
      await options.repository.complete({ ...completion, status });
      return { status };
    },

    async getManifest(input: { workspaceId: string; sessionId: string }): Promise<Omit<TrackingV2RecordingManifestResponse, "requestId"> | null> {
      const recording = await options.repository.findForWorkspace({
        workspaceId: input.workspaceId,
        publicSessionId: input.sessionId,
      });
      if (!recording || recording.expiresAt <= now() || (recording.status !== "available" && recording.status !== "truncated")) return null;
      const chunks = contiguousPrefix(await options.repository.listChunks(recording.id), recording.finalSequence);
      if (chunks.length === 0) return null;
      return {
        recordingId: recording.id,
        sessionId: recording.publicSessionId,
        status: recording.status,
        startedAt: recording.startedAt.toISOString(),
        endedAt: recording.endedAt?.toISOString() ?? null,
        durationMs: recording.durationMs,
        eventCount: chunks.reduce((total, chunk) => total + chunk.eventCount, 0),
        chunkCount: chunks.length,
        compressedBytes: chunks.reduce((total, chunk) => total + chunk.compressedBytes, 0),
        maxDurationMs: recording.maxDurationMs,
        chunks: chunks.map((chunk) => ({
          sequence: chunk.sequence,
          eventCount: chunk.eventCount,
          compressedBytes: chunk.compressedBytes,
          checksumSha256: chunk.checksumSha256,
          firstEventAt: chunk.firstEventAt.toISOString(),
          lastEventAt: chunk.lastEventAt.toISOString(),
        })),
      };
    },

    async getChunk(input: { workspaceId: string; recordingId: string; sequence: number }): Promise<TrackingV2RecordingObject | null> {
      const recording = await options.repository.findByIdForWorkspace(input);
      if (!recording || recording.expiresAt <= now() || (recording.status !== "available" && recording.status !== "truncated")) return null;
      if (recording.finalSequence === null || input.sequence > recording.finalSequence) return null;
      const chunk = await options.repository.findChunk({ recordingId: input.recordingId, sequence: input.sequence });
      if (!chunk || chunk.workspaceId !== input.workspaceId) return null;
      return options.objectStore.getObject(chunk.objectKey);
    },

    repository: options.repository,
    objectStore: options.objectStore,
  };
}

function disabledConfig() {
  return { enabled: false as const, maxDurationMs: TRACKING_V2_MAX_RECORDING_DURATION_MS };
}

function enabledConfig(input: { recordingId: string; uploadToken: string; maxDurationMs: number }) {
  return {
    enabled: true as const,
    recordingId: input.recordingId,
    uploadToken: input.uploadToken,
    chunkEndpoint: `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/${input.recordingId}/chunks`,
    completeEndpoint: `${TRACKING_V2_RECORDING_ENDPOINT_PREFIX}/${input.recordingId}/complete`,
    maxDurationMs: input.maxDurationMs,
    flushIntervalMs: TRACKING_V2_RECORDING_FLUSH_INTERVAL_MS,
    targetChunkBytes: TRACKING_V2_RECORDING_TARGET_CHUNK_BYTES,
    maxChunkBytes: TRACKING_V2_RECORDING_MAX_CHUNK_BYTES,
    maxBytes: TRACKING_V2_RECORDING_MAX_BYTES,
    maxEvents: TRACKING_V2_RECORDING_MAX_EVENTS,
    maxEventsPerChunk: TRACKING_V2_RECORDING_MAX_EVENTS_PER_CHUNK,
  } as const;
}

function deriveRecordingId(sessionId: string, secret: string) {
  const bytes = createHmac("sha256", secret).update("tracking-v2-recording-id\0").update(sessionId).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deriveRecordingUploadToken(sessionId: string, secret: string) {
  return `recording_${createHmac("sha256", secret).update("tracking-v2-recording-upload\0").update(sessionId).digest("base64url")}`;
}

function validConsent(
  consent: { noticeVersion: number; grantedAt: string; source: "prompt" | "remembered" } | undefined,
  at: Date,
) {
  if (!consent || consent.noticeVersion !== TRACKING_V2_VISITOR_NOTICE_VERSION) return false;
  const grantedAt = new Date(consent.grantedAt);
  return Number.isFinite(grantedAt.getTime()) &&
    grantedAt.getTime() <= at.getTime() + MAX_CLOCK_SKEW_MS &&
    grantedAt.getTime() >= at.getTime() - MAX_CONSENT_AGE_MS;
}

function buildRecordingCompletion(input: {
  recording: TrackingV2RecordingRecord;
  complete: TrackingV2RecordingComplete;
  completedAt: Date;
}) {
  const endedAt = clampRecordingEnd(new Date(input.complete.endedAt), input.recording, input.completedAt);
  return {
    recordingId: input.recording.id,
    endedAt,
    durationMs: Math.max(0, endedAt.getTime() - input.recording.startedAt.getTime()),
    stopReason: input.complete.stopReason,
    finalSequence: input.complete.finalSequence,
    updatedAt: input.completedAt,
  };
}

async function authorizedRecording(
  repository: TrackingV2RecordingRepository,
  recordingId: string,
  uploadToken: string,
  secret: string,
) {
  const recording = await repository.findForUpload({
    recordingId,
    uploadTokenHash: hashUploadToken(recordingId, uploadToken, secret),
  });
  if (!recording) throw new TrackingV2RecordingInvalidError();
  return recording;
}

function hashUploadToken(recordingId: string, uploadToken: string, secret: string) {
  return createHmac("sha256", secret)
    .update("tracking-v2-recording-upload-token")
    .update("\0").update(recordingId)
    .update("\0").update(uploadToken)
    .digest("hex");
}

function sanitizeRrwebEvent(event: TrackingV2RecordingChunk["events"][number]) {
  return sanitizeValue(event, "", 0, new WeakSet<object>(), false) as TrackingV2RecordingChunk["events"][number];
}

function sanitizeValue(value: unknown, key: string, depth: number, seen: WeakSet<object>, inputEvent: boolean): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return null;
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  const normalizedKey = key.toLowerCase();
  if (typeof value === "string") {
    if (normalizedKey === "value" || normalizedKey === "currentvalue" || normalizedKey === "placeholder" || (inputEvent && normalizedKey === "text")) return MASKED_VALUE;
    if (normalizedKey === "href" || normalizedKey === "action" || normalizedKey === "formaction" || normalizedKey === "srcset") return null;
    if (["src", "poster", "background", "data", "xlink:href"].includes(normalizedKey)) return sanitizeResourceUrl(value);
    if (normalizedKey === "style") return sanitizeStyle(value);
    return value;
  }
  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  if (isBrowserToolingNode(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    const output = value.flatMap((entry) => {
      if (isBrowserToolingNode(entry)) return [];
      const sanitized = sanitizeValue(entry, key, depth + 1, seen, inputEvent);
      return normalizedKey === "childnodes" && sanitized === null ? [] : [sanitized];
    });
    seen.delete(value);
    return output;
  }
  const source = "source" in value ? (value as { source?: unknown }).source : undefined;
  const nextInputEvent = inputEvent || source === INPUT_EVENT_SOURCE;
  const output: Record<string, unknown> = {};
  for (const [property, propertyValue] of Object.entries(value)) {
    const sanitized = sanitizeValue(propertyValue, property, depth + 1, seen, nextInputEvent);
    if (sanitized !== null || propertyValue === null) output[property] = sanitized;
  }
  seen.delete(value);
  return output;
}

function sanitizeResourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeStyle(value: string) {
  return value.replace(STYLE_URL_PATTERN, (_match, raw: string) => {
    const cleaned = sanitizeResourceUrl(raw.trim().replace(/^['"]|['"]$/g, ""));
    return cleaned ? `url(${JSON.stringify(cleaned)})` : "url(about:blank)";
  });
}

function isBrowserToolingNode(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { node?: unknown; attributes?: unknown };
  const node = candidate.node && typeof candidate.node === "object" ? candidate.node as { attributes?: unknown } : candidate;
  const attributes = node.attributes;
  return Boolean(attributes && typeof attributes === "object" &&
    (attributes as { id?: unknown }).id === "codex-browser-sidebar-comments-root");
}

function recordingEventBounds(events: TrackingV2RecordingChunk["events"], recording: TrackingV2RecordingRecord) {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  const min = recording.startedAt.getTime() - MAX_CLOCK_SKEW_MS;
  const max = recording.startedAt.getTime() + recording.maxDurationMs + MAX_CLOCK_SKEW_MS;
  for (const event of events) {
    if (!Number.isFinite(event.timestamp) || event.timestamp < min || event.timestamp > max) return null;
    first = Math.min(first, event.timestamp);
    last = Math.max(last, event.timestamp);
  }
  return Number.isFinite(first) && Number.isFinite(last) ? { first: new Date(first), last: new Date(last) } : null;
}

function clampRecordingEnd(candidate: Date, recording: TrackingV2RecordingRecord, receivedAt: Date) {
  const min = recording.startedAt.getTime();
  const max = Math.min(receivedAt.getTime() + MAX_CLOCK_SKEW_MS, min + recording.maxDurationMs);
  const value = Number.isFinite(candidate.getTime()) ? candidate.getTime() : receivedAt.getTime();
  return new Date(Math.min(max, Math.max(min, value)));
}

function completionStatus(reason: TrackingV2RecordingComplete["stopReason"], chunkCount: number) {
  if (chunkCount === 0 || reason === "error") return "failed" as const;
  if (["duration_cap", "size_cap", "event_cap", "daily_cap"].includes(reason)) return "truncated" as const;
  return "available" as const;
}

async function failOrTruncate(
  repository: TrackingV2RecordingRepository,
  recording: TrackingV2RecordingRecord,
  errorCode: string,
  at: Date,
) {
  const chunks = await repository.listChunks(recording.id);
  const finalSequence = contiguousPrefix(chunks, null).at(-1)?.sequence ?? null;
  const last = chunks.at(-1)?.lastEventAt ?? recording.startedAt;
  await repository.complete({
    recordingId: recording.id,
    status: chunks.length > 0 ? "truncated" : "failed",
    endedAt: last,
    durationMs: Math.max(0, Math.min(recording.maxDurationMs, last.getTime() - recording.startedAt.getTime())),
    stopReason: errorCode.includes("cap") ? errorCode : "error",
    finalSequence,
    errorCode,
    updatedAt: at,
  });
}

async function settleIfRequested(
  repository: TrackingV2RecordingRepository,
  knownRecording: TrackingV2RecordingRecord,
  at: Date,
) {
  const recording = await repository.findForUpload({
    recordingId: knownRecording.id,
    uploadTokenHash: knownRecording.uploadTokenHash,
  });
  if (!recording || !mutable(recording.status) || !recording.endedAt || !recording.stopReason) return;
  const chunks = await repository.listChunks(recording.id);
  if (!hasContiguousChunks(chunks, recording.finalSequence)) return;
  const typedReason = trackingStopReason(recording.stopReason);
  await repository.complete({
    recordingId: recording.id,
    status: typedReason ? completionStatus(typedReason, chunks.length) : "failed",
    endedAt: recording.endedAt,
    durationMs: recording.durationMs,
    stopReason: recording.stopReason,
    finalSequence: recording.finalSequence,
    errorCode: recording.errorCode,
    updatedAt: at,
  });
}

function trackingStopReason(value: string): TrackingV2RecordingComplete["stopReason"] | null {
  const reasons: TrackingV2RecordingComplete["stopReason"][] = [
    "pagehide", "consent_withdrawn", "hidden_timeout", "duration_cap",
    "size_cap", "event_cap", "daily_cap", "error",
  ];
  return reasons.includes(value as TrackingV2RecordingComplete["stopReason"])
    ? value as TrackingV2RecordingComplete["stopReason"]
    : null;
}

function hasContiguousChunks(chunks: TrackingV2RecordingChunkRecord[], finalSequence: number | null) {
  if (finalSequence === null) return chunks.length === 0;
  const sequences = new Set(chunks.map((chunk) => chunk.sequence));
  for (let sequence = 0; sequence <= finalSequence; sequence += 1) if (!sequences.has(sequence)) return false;
  return true;
}

function contiguousPrefix(chunks: TrackingV2RecordingChunkRecord[], finalSequence: number | null) {
  const sorted = [...chunks].sort((left, right) => left.sequence - right.sequence);
  const result: TrackingV2RecordingChunkRecord[] = [];
  for (const chunk of sorted) {
    if (chunk.sequence !== result.length) break;
    if (finalSequence !== null && chunk.sequence > finalSequence) break;
    result.push(chunk);
  }
  return result;
}

function mutable(status: TrackingV2RecordingRecord["status"]) {
  return status === "pending" || status === "recording";
}

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
