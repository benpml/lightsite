import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Router } from "express";
import {
  TRACKING_V2_ACTIVITY_WINDOW_MS,
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_HEARTBEAT_INTERVAL_MS,
  TRACKING_V2_IDLE_TIMEOUT_MS,
  TRACKING_V2_MAX_BATCH_EVENTS,
  TRACKING_V2_MAX_REQUEUED_EVENTS,
  TRACKING_V2_MAX_SESSION_DURATION_MS,
  TRACKING_V2_RECORDER_SCRIPT_ENDPOINT,
  TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES,
  TRACKING_V2_RECORDING_SCHEMA_VERSION,
  TRACKING_V2_RECORDING_TERMINAL_RESERVE_BYTES,
  TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
} from "@handout/tracking-schema";

export const PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function createPublicTrackingScriptRouter() {
  const router = Router();
  router.get(TRACKING_V2_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL)
      .setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(PUBLIC_TRACKING_V2_SCRIPT);
  });
  router.get(TRACKING_V2_RECORDER_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL)
      .setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(PUBLIC_TRACKING_V2_RECORDER_SCRIPT);
  });
  router.get(TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL)
      .setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(getPublicTrackingV2RrwebRecordScript());
  });
  return router;
}

let rrwebRecordScript: string | null = null;

export function getPublicTrackingV2RrwebRecordScript() {
  if (rrwebRecordScript !== null) return rrwebRecordScript;
  const require = createRequire(import.meta.url);
  const entrypoint = require.resolve("@rrweb/record");
  rrwebRecordScript = readFileSync(join(dirname(entrypoint), "record.js"), "utf8");
  return rrwebRecordScript;
}

export const PUBLIC_TRACKING_V2_SCRIPT = `
;(() => {
  "use strict";

  const script = document.currentScript || document.querySelector("script[data-handout-tracking-v2]");
  if (!script) return;

  let bootstrap;
  try {
    bootstrap = JSON.parse(script.dataset.handoutTrackingV2 || "null");
  } catch {
    return;
  }
  if (!bootstrap || (bootstrap.trackingMode !== "events" && bootstrap.trackingMode !== "events_and_replay") || !bootstrap.contextToken) return;

  let replayConsent;
  try {
    replayConsent = JSON.parse(script.dataset.handoutReplayConsent || "null");
  } catch {
    replayConsent = null;
  }

  const config = {
    eventsEndpoint: "${TRACKING_V2_EVENTS_ENDPOINT}",
    heartbeatEndpoint: "${TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT}",
    maxBatchEvents: ${TRACKING_V2_MAX_BATCH_EVENTS},
    maxQueuedEvents: ${TRACKING_V2_MAX_REQUEUED_EVENTS},
    recorderScriptEndpoint: "${TRACKING_V2_RECORDER_SCRIPT_ENDPOINT}",
    rrwebRecordScriptEndpoint: "${TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT}",
    scriptVersion: "${TRACKING_V2_SCRIPT_VERSION}",
    sessionEndEndpoint: "${TRACKING_V2_SESSION_END_ENDPOINT}",
    sessionStartEndpoint: "${TRACKING_V2_SESSION_START_ENDPOINT}",
    startTimeoutMs: 5000
  };

  const state = {
    activeMs: 0,
    ended: false,
    eventToken: null,
    flushTimerId: null,
    heartbeatIntervalId: null,
    heartbeatIntervalMs: ${TRACKING_V2_HEARTBEAT_INTERVAL_MS},
    hiddenAt: null,
    hiddenTimerId: null,
    idleTimeoutMs: ${TRACKING_V2_IDLE_TIMEOUT_MS},
    activityWindowMs: ${TRACKING_V2_ACTIVITY_WINDOW_MS},
    lastActivityAt: Date.now(),
    lastVisibleAt: document.visibilityState === "visible" ? Date.now() : null,
    maxSessionDurationMs: ${TRACKING_V2_MAX_SESSION_DURATION_MS},
    maxSessionTimerId: null,
    queue: [],
    requestId: createId("request"),
    recorderStop: null,
    sequence: 0,
    sessionId: null,
    startedAt: Date.now()
  };

  void startSession();

  async function startSession() {
    const initialPageId = getCurrentPageId();
    if (!initialPageId) return;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), config.startTimeoutMs) : null;
    let response;
    try {
      response = await fetch(config.sessionStartEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contextToken: bootstrap.contextToken,
          requestId: state.requestId,
          startedAt: new Date(state.startedAt).toISOString(),
          initialPageId,
          ...(validReplayConsent(replayConsent) ? { replayConsent } : {})
        }),
        credentials: "omit",
        signal: controller ? controller.signal : undefined
      });
    } catch {
      return;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
    if (!response.ok) return;
    const body = await response.json().catch(() => null);
    if (!body || body.accepted !== true || !body.sessionId || !body.eventToken) return;

    state.sessionId = body.sessionId;
    state.eventToken = body.eventToken;
    state.heartbeatIntervalMs = positiveInteger(body.heartbeatIntervalMs, state.heartbeatIntervalMs);
    state.idleTimeoutMs = positiveInteger(body.idleTimeoutMs, state.idleTimeoutMs);
    state.maxSessionDurationMs = positiveInteger(body.maxSessionDurationMs, state.maxSessionDurationMs);
    installListeners();
    startRecorder(body.recording);
  }

  function startRecorder(recording) {
    if (bootstrap.trackingMode !== "events_and_replay" || !recording || recording.enabled !== true) return;
    import(config.recorderScriptEndpoint).then((module) => {
      if (state.ended || !module || typeof module.startHandoutRecording !== "function") return;
      state.recorderStop = module.startHandoutRecording({
        ...recording,
        rrwebRecordScriptEndpoint: config.rrwebRecordScriptEndpoint,
        sessionId: state.sessionId
      });
    }).catch(() => {});
  }

  function installListeners() {
    state.heartbeatIntervalId = window.setInterval(onHeartbeat, state.heartbeatIntervalMs);
    state.maxSessionTimerId = window.setTimeout(() => endSession("max_duration"), state.maxSessionDurationMs);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", markActivity, { passive: true });
    document.addEventListener("pointerdown", markActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("handout:tracking-consent-withdrawn", onConsentWithdrawn);
    window.addEventListener("pagehide", onPageHide);
  }

  function onClick(event) {
    markActivity();
    const target = event.target instanceof Element
      ? event.target.closest('[data-handout-track="button"],[data-handout-track="link"],[data-handout-track="tab"]')
      : null;
    if (!target) return;

    const trackType = target.getAttribute("data-handout-track");
    const occurredAt = new Date().toISOString();
    if (trackType === "tab") {
      const fromPageId = getCurrentPageId();
      const toPageId = validId(target.getAttribute("data-handout-page-id"));
      if (!fromPageId || !toPageId || fromPageId === toPageId) return;
      enqueue({
        eventId: createId("event"),
        type: "tab_switch",
        occurredAt,
        sequence: nextSequence(),
        fromPageId,
        toPageId,
        trigger: event.detail === 0 ? "keyboard" : "click"
      });
      scheduleFlush();
      return;
    }

    const elementId = validId(target.getAttribute("data-handout-element-id"));
    const pageId = getCurrentPageId();
    if (!elementId || !pageId) return;
    enqueue({
      eventId: createId("event"),
      type: trackType === "link" ? "link_click" : "button_click",
      occurredAt,
      sequence: nextSequence(),
      elementId,
      pageId
    });
    flushEvents(true);
  }

  function onHeartbeat() {
    if (state.ended || document.visibilityState !== "visible") return;
    const currentTime = Date.now();
    if (currentTime - state.lastActivityAt >= state.idleTimeoutMs) {
      endSession("idle_timeout");
      return;
    }
    accrueVisibleTime(currentTime);
    sendJson(config.heartbeatEndpoint, {
      sessionId: state.sessionId,
      eventToken: state.eventToken,
      occurredAt: new Date(currentTime).toISOString(),
      activeMs: Math.round(state.activeMs)
    }, false);
    flushEvents(false);
  }

  function onVisibilityChange() {
    const currentTime = Date.now();
    if (document.visibilityState === "hidden") {
      accrueVisibleTime(currentTime);
      state.lastVisibleAt = null;
      state.hiddenAt = currentTime;
      flushEvents(true);
      sendHeartbeatBeacon(currentTime);
      state.hiddenTimerId = window.setTimeout(() => endSession("visibility_timeout"), 60000);
      return;
    }
    if (state.hiddenTimerId !== null) {
      window.clearTimeout(state.hiddenTimerId);
      state.hiddenTimerId = null;
    }
    state.hiddenAt = null;
    state.lastVisibleAt = currentTime;
    markActivity();
  }

  function onPageHide() {
    endSession("pagehide");
  }

  function onConsentWithdrawn() {
    if (typeof state.recorderStop === "function") state.recorderStop("consent_withdrawn");
    state.recorderStop = null;
    endSession("unknown");
  }

  function markActivity() {
    const currentTime = Date.now();
    accrueVisibleTime(currentTime);
    state.lastActivityAt = currentTime;
  }

  function accrueVisibleTime(currentTime) {
    if (state.lastVisibleAt === null || currentTime <= state.lastVisibleAt) return;
    const activeUntil = Math.min(currentTime, state.lastActivityAt + state.activityWindowMs);
    if (activeUntil > state.lastVisibleAt) state.activeMs += activeUntil - state.lastVisibleAt;
    state.lastVisibleAt = currentTime;
  }

  function sendHeartbeatBeacon(currentTime) {
    if (!state.sessionId || !state.eventToken || state.ended) return;
    sendJson(config.heartbeatEndpoint, {
      sessionId: state.sessionId,
      eventToken: state.eventToken,
      occurredAt: new Date(currentTime).toISOString(),
      activeMs: Math.round(state.activeMs)
    }, true);
  }

  function endSession(reason) {
    if (!state.sessionId || !state.eventToken || state.ended) return;
    state.ended = true;
    const endedAt = state.hiddenAt || Date.now();
    accrueVisibleTime(endedAt);
    clearTimers();
    window.removeEventListener("handout:tracking-consent-withdrawn", onConsentWithdrawn);
    if (typeof state.recorderStop === "function") {
      state.recorderStop(reason === "pagehide" ? "pagehide" : reason === "max_duration" ? "duration_cap" : "hidden_timeout");
      state.recorderStop = null;
    }
    flushEvents(true);
    sendJson(config.sessionEndEndpoint, {
      sessionId: state.sessionId,
      eventToken: state.eventToken,
      occurredAt: new Date(endedAt).toISOString(),
      reason,
      activeMs: Math.round(state.activeMs)
    }, true);
  }

  function clearTimers() {
    for (const key of ["flushTimerId", "heartbeatIntervalId", "hiddenTimerId", "maxSessionTimerId"]) {
      if (state[key] !== null) window.clearTimeout(state[key]);
      state[key] = null;
    }
  }

  function enqueue(event) {
    if (!state.sessionId || !state.eventToken || state.ended) return;
    state.queue.push(event);
    if (state.queue.length > config.maxQueuedEvents) state.queue.shift();
    if (state.queue.length >= config.maxBatchEvents) flushEvents(false);
  }

  function scheduleFlush() {
    if (state.flushTimerId !== null) return;
    state.flushTimerId = window.setTimeout(() => {
      state.flushTimerId = null;
      flushEvents(false);
    }, 2000);
  }

  function flushEvents(preferBeacon) {
    if (!state.sessionId || !state.eventToken || state.queue.length === 0) return;
    while (state.queue.length > 0) {
      const events = state.queue.splice(0, config.maxBatchEvents);
      const sent = sendJson(config.eventsEndpoint, {
        batchId: createId("batch"),
        sessionId: state.sessionId,
        eventToken: state.eventToken,
        scriptVersion: config.scriptVersion,
        sentAt: new Date().toISOString(),
        events
      }, preferBeacon);
      if (!sent) {
        state.queue.unshift(...events);
        if (state.queue.length > config.maxQueuedEvents) state.queue.splice(0, state.queue.length - config.maxQueuedEvents);
        return;
      }
    }
  }

  function sendJson(endpoint, body, preferBeacon) {
    try {
      const text = JSON.stringify(body);
      if (preferBeacon && navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([text], { type: "application/json" }))) return true;
      void fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
        credentials: "omit",
        keepalive: preferBeacon
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function getCurrentPageId() {
    const panel = document.querySelector("[data-handout-page-panel]:not([hidden])");
    return panel ? validId(panel.getAttribute("data-handout-page-id")) : null;
  }

  function validId(value) {
    return typeof value === "string" && value.length >= 8 && value.length <= 160 && /^[A-Za-z0-9:_-]+$/.test(value)
      ? value
      : null;
  }

  function createId(prefix) {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return prefix + "_" + globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") globalThis.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    return prefix + "_" + Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function nextSequence() {
    const sequence = state.sequence;
    state.sequence += 1;
    return sequence;
  }

  function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  function validReplayConsent(value) {
    return value && value.noticeVersion === 1 &&
      (value.source === "prompt" || value.source === "remembered") &&
      typeof value.grantedAt === "string";
  }
})();
`.trim();

export const PUBLIC_TRACKING_V2_RECORDER_SCRIPT = `
export function startHandoutRecording(config) {
  "use strict";

  if (!config || !config.sessionId || !config.chunkEndpoint || !config.completeEndpoint || !config.uploadToken) return null;
  const root = document.documentElement;
  if (root && root.dataset.handoutRecordingStarted === "true") return null;
  if (root) root.dataset.handoutRecordingStarted = "true";

  const INPUT_SOURCE = 5;
  const MASKED_VALUE = "[masked]";
  const MAX_DEPTH = 32;
  const URL_KEYS = new Set(["action", "background", "data", "href", "poster", "src", "srcset", "xlink:href"]);
  const VALUE_KEYS = new Set(["currentvalue", "placeholder", "value"]);
  const state = {
    stopped: false,
    eventCount: 0,
    pendingEvents: [],
    uploads: [],
    draining: null,
    sequence: 0,
    lastUploadedSequence: null,
    totalBytes: 0,
    uploadFailureReason: null,
    stopRecorder: null,
    flushTimer: null,
    durationTimer: null
  };

  void start().catch(() => stop("error"));
  return (reason) => stop(validStopReason(reason) ? reason : "pagehide");

  async function start() {
    const module = await import(config.rrwebRecordScriptEndpoint);
    if (state.stopped || !module || typeof module.record !== "function") return;
    state.flushTimer = window.setInterval(() => {
      if (!flush(false)) stop("size_cap");
    }, positiveInteger(config.flushIntervalMs, 5000));
    state.durationTimer = window.setTimeout(() => stop("duration_cap"), positiveInteger(config.maxDurationMs, 600000));
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const stopRecorder = module.record({
      emit: recordEvent,
      blockSelector: "script,iframe,[data-handout-recording-block]",
      checkoutEveryNms: 120000,
      collectFonts: false,
      errorHandler: () => stop("error"),
      inlineImages: false,
      inlineStylesheet: true,
      maskAllInputs: true,
      maskInputOptions: {
        color: false, date: true, datetime: true, "datetime-local": true,
        email: true, month: true, number: true, password: true, range: false,
        search: true, select: true, tel: true, text: true, textarea: true,
        time: true, url: true, week: true
      },
      maskTextSelector: "[data-handout-recording-mask]",
      recordCanvas: false,
      recordCrossOriginIframes: false,
      sampling: {
        input: "last",
        media: 1000,
        mouseInteraction: true,
        mousemove: 100,
        scroll: 150
      },
      slimDOMOptions: {
        comment: true,
        headFavicon: true,
        headMetaHttpEquiv: true,
        headMetaRobots: true,
        headMetaSocial: true,
        headMetaVerification: true,
        script: true
      }
    });
    if (typeof stopRecorder === "function") state.stopRecorder = stopRecorder;
  }

  function recordEvent(rawEvent, isCheckout) {
    if (state.stopped) return;
    const maxEvents = positiveInteger(config.maxEvents, 20000);
    if (state.eventCount >= maxEvents) return stop("event_cap");
    const event = sanitizeValue(rawEvent, "", 0, new WeakSet(), false);
    if (!isRrwebEvent(event)) return;
    state.pendingEvents.push(event);
    state.eventCount += 1;
    if (state.eventCount >= maxEvents) return stop("event_cap");
    if (isCheckout || state.pendingEvents.length >= positiveInteger(config.maxEventsPerChunk, 500)) {
      if (!flush(false)) stop("size_cap");
      return;
    }
    if (state.pendingEvents.length % 25 === 0 && jsonBytes(buildChunk(state.pendingEvents, state.sequence)) >= positiveInteger(config.targetChunkBytes, 98304)) {
      if (!flush(false)) stop("size_cap");
    }
  }

  function flush(forUnload) {
    if (state.pendingEvents.length === 0) return true;
    const configuredMax = positiveInteger(config.maxChunkBytes, 524288);
    const chunkLimit = forUnload
      ? Math.min(configuredMax, ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES - TRACKING_V2_RECORDING_TERMINAL_RESERVE_BYTES})
      : configuredMax;
    const eventLimit = positiveInteger(config.maxEventsPerChunk, 500);
    const recordingLimit = positiveInteger(config.maxBytes, 5242880);

    while (state.pendingEvents.length > 0) {
      const events = state.pendingEvents.splice(0, eventLimit);
      while (events.length > 1 && jsonBytes(buildChunk(events, state.sequence)) > chunkLimit) {
        state.pendingEvents.unshift(events.pop());
      }
      const text = JSON.stringify(buildChunk(events, state.sequence));
      const byteLength = textBytes(text);
      if (byteLength > chunkLimit || state.totalBytes + byteLength > recordingLimit) {
        state.pendingEvents.length = 0;
        return false;
      }
      state.uploads.push({
        byteLength,
        sequence: state.sequence,
        text,
        keepalive: Boolean(forUnload)
      });
      state.totalBytes += byteLength;
      state.sequence += 1;
      if (!forUnload) break;
    }
    if (!forUnload) void drainUploads();
    return true;
  }

  function drainUploads() {
    if (state.draining) return state.draining;
    state.draining = (async () => {
      while (state.uploads.length > 0 && !state.uploadFailureReason) {
        const upload = state.uploads[0];
        const result = await uploadChunk(upload, upload.keepalive ? 1 : 3);
        if (!result.ok) {
          state.uploadFailureReason = result.reason;
          break;
        }
        state.lastUploadedSequence = upload.sequence;
        state.uploads.shift();
      }
    })().finally(() => { state.draining = null; });
    return state.draining;
  }

  async function uploadChunk(upload, attempts) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(config.chunkEndpoint, {
          method: "POST",
          headers: { authorization: "Bearer " + config.uploadToken, "content-type": "application/json" },
          body: upload.text,
          credentials: "omit",
          keepalive: upload.keepalive && upload.byteLength <= ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES}
        });
        if (response.ok) return { ok: true, reason: null };
        if (response.status === 429) return { ok: false, reason: "daily_cap" };
        if (response.status === 413) return { ok: false, reason: "size_cap" };
        if (response.status >= 400 && response.status < 500) return { ok: false, reason: "error" };
      } catch {}
      if (attempt + 1 < attempts) await delay(250 * Math.pow(2, attempt));
    }
    return { ok: false, reason: "error" };
  }

  function stop(reason) {
    if (state.stopped) return;
    state.stopped = true;
    if (typeof state.stopRecorder === "function") {
      try { state.stopRecorder(); } catch {}
      state.stopRecorder = null;
    }
    if (state.flushTimer !== null) window.clearInterval(state.flushTimer);
    if (state.durationTimer !== null) window.clearTimeout(state.durationTimer);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);

    const unloading = reason === "pagehide" || reason === "hidden_timeout";
    if (!flush(unloading) && reason !== "event_cap") reason = "size_cap";
    if (unloading) {
      const finalSequence = state.sequence === 0 ? null : state.sequence - 1;
      const terminalUpload = finalSequence === null
        ? null
        : state.uploads.find((upload) => upload.sequence === finalSequence) || null;
      if (terminalUpload) {
        const payload = JSON.parse(terminalUpload.text);
        terminalUpload.text = JSON.stringify({
          ...payload,
          completion: terminalMetadata(reason, finalSequence)
        });
        terminalUpload.byteLength = textBytes(terminalUpload.text);
        if (!sendUnloadUpload(terminalUpload)) sendCompletion(reason, state.lastUploadedSequence);
      } else {
        sendCompletion(reason, state.lastUploadedSequence);
      }
      for (const upload of state.uploads) {
        if (upload === terminalUpload) continue;
        if (upload.byteLength > ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES}) continue;
        sendUnloadUpload(upload);
      }
      return;
    }
    void finalize(reason);
  }

  async function finalize(reason) {
    await drainUploads();
    const finalReason = state.uploadFailureReason || reason;
    const finalSequence = state.uploadFailureReason
      ? state.lastUploadedSequence
      : state.sequence === 0 ? null : state.sequence - 1;
    sendCompletion(finalReason, finalSequence);
  }

  function sendCompletion(reason, finalSequence) {
    void fetch(config.completeEndpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + config.uploadToken, "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: ${TRACKING_V2_RECORDING_SCHEMA_VERSION},
        sessionId: config.sessionId,
        ...terminalMetadata(reason, finalSequence)
      }),
      credentials: "omit",
      keepalive: true
    }).catch(() => {});
  }

  function sendUnloadUpload(upload) {
    if (upload.byteLength > ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES}) return false;
    void fetch(config.chunkEndpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + config.uploadToken, "content-type": "application/json" },
      body: upload.text,
      credentials: "omit",
      keepalive: true
    }).catch(() => {});
    return true;
  }

  function terminalMetadata(reason, finalSequence) {
    return {
      finalSequence,
      endedAt: new Date().toISOString(),
      stopReason: validStopReason(reason) ? reason : "error"
    };
  }

  function onPageHide() { stop("pagehide"); }
  function onVisibilityChange() { if (document.visibilityState === "hidden" && !flush(true)) stop("size_cap"); }
  function buildChunk(events, sequence) {
    return { schemaVersion: ${TRACKING_V2_RECORDING_SCHEMA_VERSION}, sessionId: config.sessionId, sequence, events };
  }
  function validStopReason(value) {
    return ["pagehide", "consent_withdrawn", "hidden_timeout", "duration_cap", "size_cap", "event_cap", "daily_cap", "error"].includes(value);
  }
  function isRrwebEvent(value) {
    return value && typeof value === "object" && Number.isInteger(value.type) && value.type >= 0 && value.type <= 7 && Number.isInteger(value.timestamp) && value.timestamp > 0;
  }
  function sanitizeValue(value, key, depth, seen, inputEvent) {
    if (depth > MAX_DEPTH) return null;
    if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
    const normalizedKey = String(key).toLowerCase();
    if (typeof value === "string") {
      if (VALUE_KEYS.has(normalizedKey) || (inputEvent && normalizedKey === "text")) return MASKED_VALUE;
      if (URL_KEYS.has(normalizedKey)) return normalizedKey === "srcset" || normalizedKey === "href" || normalizedKey === "action" ? null : sanitizeUrl(value);
      if (normalizedKey === "style") return sanitizeStyle(value);
      return value;
    }
    if (typeof value !== "object" || seen.has(value) || isBrowserToolingNode(value)) return null;
    seen.add(value);
    const nextInputEvent = inputEvent || value.source === INPUT_SOURCE;
    if (Array.isArray(value)) {
      const output = [];
      for (const entry of value) {
        if (isBrowserToolingNode(entry)) continue;
        const sanitized = sanitizeValue(entry, key, depth + 1, seen, nextInputEvent);
        if (normalizedKey === "childnodes" && sanitized === null) continue;
        output.push(sanitized);
      }
      seen.delete(value);
      return output;
    }
    const output = {};
    for (const property of Object.keys(value)) {
      const sanitized = sanitizeValue(value[property], property, depth + 1, seen, nextInputEvent);
      if (sanitized !== null || value[property] === null) output[property] = sanitized;
    }
    seen.delete(value);
    return output;
  }
  function sanitizeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      url.username = ""; url.password = ""; url.search = ""; url.hash = "";
      return url.toString();
    } catch { return null; }
  }
  function sanitizeStyle(value) {
    return String(value || "").replace(/url\\(([^)]*)\\)/gi, (_match, raw) => {
      const cleaned = sanitizeUrl(String(raw || "").trim().replace(/^['"]|['"]$/g, ""));
      return cleaned ? "url(" + JSON.stringify(cleaned) + ")" : "url(about:blank)";
    });
  }
  function isBrowserToolingNode(value) {
    const node = value && typeof value.node === "object" ? value.node : value;
    return Boolean(node && node.attributes && node.attributes.id === "codex-browser-sidebar-comments-root");
  }
  function jsonBytes(value) { try { return textBytes(JSON.stringify(value)); } catch { return Number.MAX_SAFE_INTEGER; } }
  function textBytes(value) { try { return new Blob([value]).size; } catch { return Number.MAX_SAFE_INTEGER; } }
  function delay(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
  function positiveInteger(value, fallback) { return Number.isInteger(value) && value > 0 ? value : fallback; }
}
`.trim();
