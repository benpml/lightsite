import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Router } from "express";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_HEARTBEAT_INTERVAL_MS,
  TRACKING_V2_IDLE_TIMEOUT_MS,
  TRACKING_V2_ACTIVITY_WINDOW_MS,
  TRACKING_V2_MAX_BATCH_EVENTS,
  TRACKING_V2_MAX_REQUEUED_EVENTS,
  TRACKING_V2_MAX_SESSION_DURATION_MS,
  TRACKING_V2_RECORDER_SCRIPT_ENDPOINT,
  TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES,
  TRACKING_V2_RECORDING_SCHEMA_VERSION,
  TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
} from "@lightsite/tracking-schema";

export const PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function createPublicTrackingScriptRouter() {
  const router = Router();

  router.get(TRACKING_V2_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    response.setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(PUBLIC_TRACKING_V2_SCRIPT);
  });

  router.get(TRACKING_V2_RECORDER_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    response.setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(PUBLIC_TRACKING_V2_RECORDER_SCRIPT);
  });

  router.get(TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT, (_request, response) => {
    response
      .status(200)
      .setHeader("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    response.setHeader("x-content-type-options", "nosniff");
    response.type("application/javascript").send(getPublicTrackingV2RrwebRecordScript());
  });

  return router;
}

let rrwebRecordScript: string | null = null;

export function getPublicTrackingV2RrwebRecordScript() {
  if (rrwebRecordScript !== null) {
    return rrwebRecordScript;
  }

  const require = createRequire(import.meta.url);
  const rrwebRecordCjsPath = require.resolve("@rrweb/record");
  rrwebRecordScript = readFileSync(join(dirname(rrwebRecordCjsPath), "record.js"), "utf8");
  return rrwebRecordScript;
}

export const PUBLIC_TRACKING_V2_SCRIPT = `
;(() => {
  "use strict";

  const script =
    document.currentScript ||
    document.querySelector("script[data-lightsite-tracking-v2]");
  if (!script) return;

  let bootstrap;
  try {
    bootstrap = JSON.parse(script.dataset.lightsiteTrackingV2 || "null");
  } catch {
    return;
  }

  if (!bootstrap || !bootstrap.contextToken || bootstrap.trackingMode === "off") return;

  const config = {
    eventsEndpoint: "${TRACKING_V2_EVENTS_ENDPOINT}",
    heartbeatEndpoint: "${TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT}",
    maxBatchEvents: ${TRACKING_V2_MAX_BATCH_EVENTS},
    maxRequeuedEvents: ${TRACKING_V2_MAX_REQUEUED_EVENTS},
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
    heartbeatIntervalId: null,
    heartbeatIntervalMs: ${TRACKING_V2_HEARTBEAT_INTERVAL_MS},
    hiddenAt: null,
    idleTimeoutMs: ${TRACKING_V2_IDLE_TIMEOUT_MS},
    activityWindowMs: ${TRACKING_V2_ACTIVITY_WINDOW_MS},
    lastActivityAt: Date.now(),
    lastVisibleAt: document.visibilityState === "visible" ? Date.now() : null,
    maxSessionDurationMs: ${TRACKING_V2_MAX_SESSION_DURATION_MS},
    maxSessionTimerId: null,
    maxScrollDepthPercent: calculateScrollDepth(),
    queue: [],
    recorderStop: null,
    scrollFrameId: null,
    sequence: 0,
    sessionId: null,
    startedAt: Date.now()
  };

  let idSequence = 0;

  startSession().catch(() => {});

  async function startSession() {
    const startedAt = new Date().toISOString();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), config.startTimeoutMs)
      : null;

    let response;
    try {
      response = await fetch(config.sessionStartEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contextToken: bootstrap.contextToken,
          startedAt,
          page: getPageSnapshot(),
          viewport: getViewportSnapshot(),
          device: {
            deviceId: getDeviceId(),
            timezone: getTimezone(),
            locale: navigator.language || null,
            userAgent: navigator.userAgent || null
          }
        }),
        keepalive: false,
        signal: controller ? controller.signal : undefined
      });
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }

    if (!response || !response.ok) return;

    const body = await response.json().catch(() => null);
    if (!body || body.accepted !== true || !body.sessionId || !body.eventToken) return;

    state.sessionId = body.sessionId;
    state.eventToken = body.eventToken;
    state.heartbeatIntervalMs = positiveInteger(body.heartbeatIntervalMs, state.heartbeatIntervalMs);
    state.idleTimeoutMs = positiveInteger(body.idleTimeoutMs, state.idleTimeoutMs);
    state.maxSessionDurationMs = positiveInteger(body.maxSessionDurationMs, state.maxSessionDurationMs);

    installListeners();
    startRecorder(body.recording);
    enqueue({
      eventId: createBrowserId("event"),
      type: "site_visit",
      occurredAt: new Date().toISOString(),
      sequence: nextSequence(),
      page: getPageSnapshot(),
      viewport: getViewportSnapshot()
    });
    flushEvents();
  }

  function startRecorder(recording) {
    if (
      bootstrap.trackingMode !== "events_and_recording" ||
      !recording ||
      recording.enabled !== true ||
      !recording.recordingId ||
      !recording.uploadToken
    ) {
      return;
    }

    import(config.recorderScriptEndpoint)
      .then((module) => {
        if (module && typeof module.startLightsiteRecording === "function") {
          state.recorderStop = module.startLightsiteRecording({
            ...recording,
            rrwebRecordScriptEndpoint: config.rrwebRecordScriptEndpoint,
            sessionId: state.sessionId
          });
        }
      })
      .catch(() => {});
  }

  function installListeners() {
    state.heartbeatIntervalId = window.setInterval(onHeartbeatInterval, state.heartbeatIntervalMs);
    state.maxSessionTimerId = window.setTimeout(() => endSession("max_duration"), state.maxSessionDurationMs);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", markActivity, { passive: true });
    window.addEventListener("keydown", markActivity);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("click", onClick);
    onScroll();
  }

  function onClick(event) {
    markActivity();

    const target = event.target instanceof Element
      ? event.target.closest("[data-ls-track]")
      : null;
    if (!target) return;

    const trackType = target.dataset.lsTrack;
    if (trackType !== "button" && trackType !== "link" && trackType !== "tab") return;

    const element = getTrackedElement(target, trackType);
    if (!element) return;

    if (trackType === "tab") {
      enqueue({
        eventId: createBrowserId("event"),
        type: "tab_switch",
        occurredAt: new Date().toISOString(),
        sequence: nextSequence(),
        element,
        page: getPageSnapshot(),
        viewport: getViewportSnapshot()
      });
      flushEvents();
      return;
    }

    enqueue({
      eventId: createBrowserId("event"),
      type: trackType === "link" ? "link_click" : "button_click",
      occurredAt: new Date().toISOString(),
      sequence: nextSequence(),
      element,
      page: getPageSnapshot(),
      viewport: getViewportSnapshot()
    });

    if (element.href) flushEvents();
  }

  function onScroll() {
    markActivity();
    if (state.scrollFrameId !== null) return;
    state.scrollFrameId = window.requestAnimationFrame(() => {
      state.scrollFrameId = null;
      state.maxScrollDepthPercent = Math.max(state.maxScrollDepthPercent, calculateScrollDepth());
    });
  }

  function onHeartbeatInterval() {
    if (Date.now() - state.lastActivityAt >= state.idleTimeoutMs) {
      endSession("idle_timeout");
      return;
    }

    sendHeartbeat();
    flushEvents();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      sendHeartbeat();
      flushEvents();
      state.lastVisibleAt = null;
      state.hiddenAt = Date.now();
      return;
    }

    state.hiddenAt = null;
    markActivity();
    if (state.lastVisibleAt === null) {
      state.lastVisibleAt = Date.now();
    }
  }

  function onPageHide() {
    endSession("pagehide");
  }

  function markActivity() {
    const now = Date.now();
    accrueVisibleTime(now);
    state.lastActivityAt = now;
  }

  function sendHeartbeat() {
    if (!state.sessionId || !state.eventToken || state.ended) return;

    accrueVisibleTime(Date.now());
    sendLifecycle(config.heartbeatEndpoint, {
      sessionId: state.sessionId,
      eventToken: state.eventToken,
      occurredAt: new Date().toISOString(),
      activeMs: state.activeMs,
      maxScrollDepthPercent: state.maxScrollDepthPercent,
      page: getPageSnapshot()
    });
  }

  function endSession(reason) {
    if (!state.sessionId || !state.eventToken || state.ended) return;

    state.ended = true;
    const endedAt = state.hiddenAt || Date.now();
    accrueVisibleTime(endedAt);
    if (state.heartbeatIntervalId !== null) {
      window.clearInterval(state.heartbeatIntervalId);
      state.heartbeatIntervalId = null;
    }
    if (state.scrollFrameId !== null) {
      window.cancelAnimationFrame(state.scrollFrameId);
      state.scrollFrameId = null;
    }
    if (state.maxSessionTimerId !== null) {
      window.clearTimeout(state.maxSessionTimerId);
      state.maxSessionTimerId = null;
    }
    if (typeof state.recorderStop === "function") {
      state.recorderStop();
      state.recorderStop = null;
    }

    flushEvents();
    sendLifecycle(config.sessionEndEndpoint, {
      sessionId: state.sessionId,
      eventToken: state.eventToken,
      occurredAt: new Date(endedAt).toISOString(),
      reason,
      activeMs: state.activeMs
    });
  }

  function accrueVisibleTime(now) {
    if (state.lastVisibleAt === null) return;
    if (now <= state.lastVisibleAt) return;

    const graceEndsAt = state.startedAt + state.activityWindowMs;
    const activityEndsAt = state.lastActivityAt + state.activityWindowMs;
    const activeUntil = Math.min(now, Math.max(graceEndsAt, activityEndsAt));
    if (activeUntil > state.lastVisibleAt) {
      state.activeMs += activeUntil - state.lastVisibleAt;
    }
    state.lastVisibleAt = now;
  }

  function enqueue(event) {
    if (!state.sessionId || !state.eventToken || state.ended) return;

    state.queue.push(event);
    if (state.queue.length >= config.maxBatchEvents) flushEvents();
  }

  function flushEvents() {
    if (!state.sessionId || !state.eventToken || state.queue.length === 0) return;

    while (state.queue.length > 0) {
      const batch = {
        batchId: createBrowserId("batch"),
        sessionId: state.sessionId,
        eventToken: state.eventToken,
        scriptVersion: config.scriptVersion,
        sentAt: new Date().toISOString(),
        events: state.queue.splice(0, config.maxBatchEvents)
      };

      if (!sendJson(config.eventsEndpoint, batch, true)) {
        state.queue.unshift(...batch.events);
        state.queue.splice(config.maxRequeuedEvents);
        return;
      }
    }
  }

  function sendLifecycle(endpoint, body) {
    sendJson(endpoint, body, true);
  }

  function sendJson(endpoint, body, preferBeacon) {
    try {
      const text = JSON.stringify(body);

      if (preferBeacon && navigator.sendBeacon) {
        if (navigator.sendBeacon(endpoint, new Blob([text], { type: "application/json" }))) {
          return true;
        }
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
        keepalive: true
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function getTrackedElement(target, trackType) {
    const anchor = target instanceof HTMLAnchorElement ? target : target.closest("a");
    const href = trackType === "tab"
      ? null
      : sanitizeUrl(target.dataset.lsElementHref || (anchor && anchor.href));
    const id = truncateId(target.dataset.lsElementId || target.id || createBrowserId("element"));
    const label = truncateLabel(target.dataset.lsElementLabel || target.textContent || "Untitled element");
    let kind = target.dataset.lsElementKind || trackType;

    if (trackType === "link") {
      kind = kind === "sidebar_link" ? "sidebar_link" : "link";
      if (!href) return null;
    } else if (trackType === "tab") {
      kind = "tab";
    } else if (!isButtonKind(kind)) {
      kind = "button";
    }

    const element = {
      kind,
      id,
      label
    };

    const blockId = truncateOptionalId(target.dataset.lsBlockId);
    if (blockId) element.blockId = blockId;
    if (href) element.href = href;

    return element;
  }

  function isButtonKind(kind) {
    return kind === "button" ||
      kind === "sidebar_button" ||
      kind === "image_card" ||
      kind === "calendar" ||
      kind === "unknown";
  }

  function getPageSnapshot() {
    return {
      path: getPagePath(),
      title: truncateLabel(document.title || "Untitled page"),
      referrerHost: getReferrerHost(document.referrer)
    };
  }

  function getViewportSnapshot() {
    return {
      width: Math.max(1, Math.round(window.innerWidth || 1)),
      height: Math.max(1, Math.round(window.innerHeight || 1))
    };
  }

  function getPagePath() {
    const path = window.location && window.location.pathname ? window.location.pathname : "/";
    return path.length > 2048 ? "/" : path;
  }

  function getReferrerHost(value) {
    if (!value) return null;

    try {
      const host = new URL(value).hostname.toLowerCase();
      return host.length > 253 ? null : host;
    } catch {
      return null;
    }
  }

  function sanitizeUrl(value) {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      url.username = "";
      url.password = "";
      url.hash = "";
      url.search = "";
      const sanitized = url.toString();
      return sanitized.length > 2000 ? null : sanitized;
    } catch {
      return null;
    }
  }

  function getDeviceId() {
    const key = "lightsite.tracking.v2.deviceId";
    try {
      const existing = window.localStorage.getItem(key);
      if (existing && existing.length >= 8 && existing.length <= 160) return existing;

      const next = createBrowserId("device");
      window.localStorage.setItem(key, next);
      return next;
    } catch {
      return createBrowserId("device");
    }
  }

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }

  function calculateScrollDepth() {
    const height = document.documentElement.scrollHeight || 0;
    const scrollable = height - window.innerHeight;
    if (scrollable <= 0) return 100;
    return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
  }

  function createBrowserId(prefix) {
    const cryptoSource = globalThis.crypto;
    if (cryptoSource && typeof cryptoSource.randomUUID === "function") {
      return prefix + "_" + cryptoSource.randomUUID();
    }

    idSequence += 1;
    return prefix + "_" + Date.now().toString(36) + "_" + idSequence.toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function nextSequence() {
    const next = state.sequence;
    state.sequence += 1;
    return next;
  }

  function truncateId(value) {
    const text = String(value || "").trim().replace(/[^A-Za-z0-9:_-]/g, "_");
    return (text || createBrowserId("element")).slice(0, 160);
  }

  function truncateOptionalId(value) {
    const text = String(value || "").trim();
    return text ? truncateId(text) : null;
  }

  function truncateLabel(value) {
    const text = String(value || "").replace(/\\s+/g, " ").trim() || "Untitled element";
    return text.slice(0, 180);
  }

  function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
})();
`;

export const PUBLIC_TRACKING_V2_RECORDER_SCRIPT = `
export function startLightsiteRecording(config) {
  "use strict";

  if (!config || !config.sessionId || !config.chunkEndpoint || !config.completeEndpoint || !config.uploadToken) return;
  if (document.documentElement && document.documentElement.dataset.lsRecordingStarted === "true") return;
  if (document.documentElement) document.documentElement.dataset.lsRecordingStarted = "true";

  const RRWEB_INCREMENTAL_SOURCE_INPUT = 5;
  const MAX_SANITIZE_DEPTH = 32;
  const MASKED_VALUE = "[masked]";
  const STYLE_URL_PATTERN = new RegExp("url\\\\(([^)]*)\\\\)", "gi");
  const urlAttributeNames = {
    action: true,
    background: true,
    href: true,
    poster: true,
    src: true,
    srcset: true,
    "xlink:href": true
  };
  const sensitiveValueNames = {
    currentvalue: true,
    placeholder: true,
    value: true
  };

  const state = {
    completed: false,
    completionSent: false,
    eventCount: 0,
    events: [],
    flushIntervalId: null,
    lastUploadedSequence: null,
    sequence: 0,
    stopRecorder: null,
    stopTimerId: null,
    uploadFailed: false,
    uploadPromise: null,
    uploadQueue: [],
    uploadedAndQueuedBytes: 0
  };

  start().catch(() => stop("error"));
  return () => stop("ended");

  async function start() {
    const record = await loadRrwebRecord();
    if (state.completed || typeof record !== "function") return;

    state.flushIntervalId = window.setInterval(() => flush(false), getPositiveInteger(config.flushIntervalMs, 5000));
    state.stopTimerId = window.setTimeout(() => stop("duration_cap"), getPositiveInteger(config.maxDurationMs, 600000));
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const stopRecorder = record({
      emit: recordEvent,
      blockClass: "rr-block",
      blockSelector: "script,[data-ls-recording-block]",
      checkoutEveryNms: 60000,
      collectFonts: false,
      errorHandler: () => stop("error"),
      ignoreClass: "rr-ignore",
      inlineImages: false,
      inlineStylesheet: true,
      maskAllInputs: true,
      maskInputOptions: {
        color: false,
        date: true,
        datetime: true,
        "datetime-local": true,
        email: true,
        month: true,
        number: true,
        password: true,
        range: false,
        search: true,
        select: true,
        tel: true,
        text: true,
        textarea: true,
        time: true,
        url: true,
        week: true
      },
      maskTextClass: "rr-mask",
      maskTextSelector: "[data-ls-recording-mask]",
      recordCanvas: false,
      recordCrossOriginIframes: false,
      sampling: {
        input: "last",
        media: 800,
        mouseInteraction: true,
        mousemove: 100,
        scroll: 100
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

    if (typeof stopRecorder === "function") {
      state.stopRecorder = stopRecorder;
    }
  }

  async function loadRrwebRecord() {
    if (!config.rrwebRecordScriptEndpoint) return null;

    const module = await import(config.rrwebRecordScriptEndpoint);
    return module && typeof module.record === "function" ? module.record : null;
  }

  function onPageHide() {
    stop("ended");
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") flush(false);
  }

  function recordEvent(rawEvent, isCheckout) {
    const maxEvents = getPositiveInteger(config.maxEvents, 20000);
    if (state.completed || state.eventCount >= maxEvents) return;

    const event = sanitizeRecordingEvent(rawEvent);
    if (!isRrwebEvent(event)) return;

    state.events.push(event);
    state.eventCount += 1;

    if (state.eventCount >= maxEvents) {
      stop("event_cap");
      return;
    }

    if (isCheckout) {
      flush(false);
      return;
    }
    flushIfNeeded();
  }

  function flushIfNeeded() {
    if (state.events.length >= getPositiveInteger(config.maxEventsPerChunk, 500)) {
      flush(false);
      return;
    }

    try {
      const size = new Blob([JSON.stringify(buildChunkBody(state.events, state.sequence))]).size;
      if (size >= getPositiveInteger(config.targetChunkBytes, 98304)) flush(false);
    } catch {}
  }

  function flush(useKeepalive) {
    if (state.events.length === 0) return true;

    const maxChunkBytes = getPositiveInteger(config.maxChunkBytes, 524288);
    const maxEventsPerChunk = getPositiveInteger(config.maxEventsPerChunk, 500);
    const maxRecordingBytes = getPositiveInteger(config.maxBytes, 5242880);

    while (state.events.length > 0) {
      let events = state.events.splice(0, maxEventsPerChunk);
      const sequence = state.sequence;
      let body = buildChunkBody(events, sequence);

      while (events.length > 1 && getJsonSize(body) > maxChunkBytes) {
        const deferred = events.pop();
        if (deferred) state.events.unshift(deferred);
        body = buildChunkBody(events, sequence);
      }

      const text = JSON.stringify(body);
      const byteLength = getTextSize(text);
      if (byteLength > maxChunkBytes || state.uploadedAndQueuedBytes + byteLength > maxRecordingBytes) {
        state.events.length = 0;
        if (!state.completed) stop("size_cap");
        return false;
      }

      state.uploadQueue.push({
        byteLength,
        sequence,
        text,
        useKeepalive: Boolean(useKeepalive) && byteLength <= ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES}
      });
      state.uploadedAndQueuedBytes += byteLength;
      state.sequence += 1;

      if (!useKeepalive) break;
    }

    drainUploadQueue();
    return true;
  }

  function drainUploadQueue() {
    if (state.uploadPromise) return state.uploadPromise;

    state.uploadPromise = (async () => {
      while (state.uploadQueue.length > 0 && !state.uploadFailed) {
        const upload = state.uploadQueue[0];
        const uploaded = await uploadWithRetry(upload);
        if (!uploaded) {
          state.uploadFailed = true;
          state.uploadQueue.length = 0;
          break;
        }

        state.lastUploadedSequence = upload.sequence;
        state.uploadQueue.shift();
      }
    })().finally(() => {
      state.uploadPromise = null;
    });

    return state.uploadPromise;
  }

  async function uploadWithRetry(upload) {
    const attempts = upload.useKeepalive ? 1 : 3;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(config.chunkEndpoint, {
          method: "POST",
          headers: {
            authorization: "Bearer " + config.uploadToken,
            "content-type": "application/json"
          },
          body: upload.text,
          keepalive: upload.useKeepalive
        });
        if (response.ok) return true;
      } catch {}

      if (attempt + 1 < attempts) {
        await delay(250 * Math.pow(2, attempt));
      }
    }

    return false;
  }

  function stop(reason) {
    if (state.completed) return;
    state.completed = true;

    if (typeof state.stopRecorder === "function") {
      try {
        state.stopRecorder();
      } catch {}
      state.stopRecorder = null;
    }
    if (state.flushIntervalId !== null) window.clearInterval(state.flushIntervalId);
    if (state.stopTimerId !== null) window.clearTimeout(state.stopTimerId);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    const unloading = reason === "ended" || reason === "hidden_timeout";
    flush(unloading);

    if (unloading) {
      startUnloadUploads();
      sendCompletion(reason, state.sequence === 0 ? null : state.sequence - 1, false);
      finalizeAfterUploads(reason);
      return;
    }

    finalizeAfterUploads(reason);
  }

  async function finalizeAfterUploads(reason) {
    await drainUploadQueue();
    const finalReason = state.uploadFailed ? "error" : reason;
    const finalSequence = state.uploadFailed
      ? state.lastUploadedSequence
      : state.sequence === 0 ? null : state.sequence - 1;
    sendCompletion(finalReason, finalSequence);
  }

  function startUnloadUploads() {
    for (const upload of state.uploadQueue) {
      fetch(config.chunkEndpoint, {
        method: "POST",
        headers: {
          authorization: "Bearer " + config.uploadToken,
          "content-type": "application/json"
        },
        body: upload.text,
        keepalive: upload.byteLength <= ${TRACKING_V2_RECORDING_KEEPALIVE_MAX_BYTES}
      }).catch(() => {});
    }
  }

  function sendCompletion(reason, finalSequence, dedupe) {
    const shouldDedupe = dedupe !== false;
    if (state.completionSent) return;
    if (shouldDedupe) state.completionSent = true;

    fetch(config.completeEndpoint, {
      method: "POST",
      headers: {
        authorization: "Bearer " + config.uploadToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        schemaVersion: ${TRACKING_V2_RECORDING_SCHEMA_VERSION},
        sessionId: config.sessionId,
        finalSequence,
        endedAt: new Date().toISOString(),
        stopReason: reason
      }),
      keepalive: true
    }).catch(() => {});
  }

  function buildChunkBody(events, sequence) {
    return {
      schemaVersion: ${TRACKING_V2_RECORDING_SCHEMA_VERSION},
      sessionId: config.sessionId,
      sequence,
      events,
      compressed: false
    };
  }

  function sanitizeRecordingEvent(event) {
    return sanitizeValue(event, "", 0, new WeakSet(), false);
  }

  function sanitizeValue(value, key, depth, seen, isInputEvent) {
    if (depth > MAX_SANITIZE_DEPTH) return null;
    if (value === null || value === undefined) return value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalizedKey = key.toLowerCase();
      if (sensitiveValueNames[normalizedKey] || (isInputEvent && normalizedKey === "text")) {
        return MASKED_VALUE;
      }
      if (urlAttributeNames[normalizedKey]) {
        return normalizedKey === "srcset" ? null : sanitizeUrl(value);
      }
      if (normalizedKey === "style") return sanitizeStyle(value);
      return value;
    }
    if (isBrowserToolingNode(value)) return null;
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value) {
        if (isBrowserToolingNode(item)) continue;
        output.push(sanitizeValue(item, key, depth + 1, seen, isInputEvent));
      }
      return output;
    }
    if (typeof value !== "object") return null;
    if (seen.has(value)) return null;
    seen.add(value);

    const inputEvent = isInputEvent || value.source === RRWEB_INCREMENTAL_SOURCE_INPUT;
    const output = {};

    for (const propertyName in value) {
      const normalizedKey = propertyName.toLowerCase();
      const propertyValue = value[propertyName];

      if (normalizedKey === "attributes" && propertyValue && typeof propertyValue === "object" && !Array.isArray(propertyValue)) {
        output[propertyName] = sanitizeAttributes(propertyValue, depth + 1, seen);
        continue;
      }

      if (urlAttributeNames[normalizedKey]) {
        if (normalizedKey === "srcset") continue;
        const sanitized = sanitizeUrl(propertyValue);
        if (sanitized) output[propertyName] = sanitized;
        continue;
      }

      if (sensitiveValueNames[normalizedKey] || (inputEvent && normalizedKey === "text")) {
        output[propertyName] = MASKED_VALUE;
        continue;
      }

      output[propertyName] = sanitizeValue(propertyValue, propertyName, depth + 1, seen, inputEvent);
    }

    seen.delete(value);
    return output;
  }

  function isBrowserToolingNode(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const node = value.node && typeof value.node === "object" ? value.node : value;
    const attributes = node.attributes;
    return Boolean(attributes && attributes.id === "codex-browser-sidebar-comments-root");
  }

  function sanitizeAttributes(attributes, depth, seen) {
    const output = {};

    for (const attributeName in attributes) {
      const normalizedName = attributeName.toLowerCase();
      const value = attributes[attributeName];

      if (urlAttributeNames[normalizedName]) {
        if (normalizedName === "srcset") continue;
        const sanitized = sanitizeUrl(value);
        if (sanitized) output[attributeName] = sanitized;
        continue;
      }

      if (normalizedName === "data") {
        const sanitized = sanitizeUrl(value);
        if (sanitized) output[attributeName] = sanitized;
        continue;
      }

      if (sensitiveValueNames[normalizedName]) {
        output[attributeName] = MASKED_VALUE;
        continue;
      }

      output[attributeName] = normalizedName === "style"
        ? sanitizeStyle(String(value || ""))
        : sanitizeValue(value, attributeName, depth + 1, seen, false);
    }

    return output;
  }

  function sanitizeStyle(value) {
    return String(value || "").replace(STYLE_URL_PATTERN, (_match, rawUrl) => {
      const cleaned = sanitizeUrl(String(rawUrl || "").trim().replace(/^['"]|['"]$/g, ""));
      return cleaned ? "url(" + JSON.stringify(cleaned) + ")" : "url(about:blank)";
    });
  }

  function sanitizeUrl(value) {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (url.pathname.startsWith("/api/public/tracking/v2/og/")) {
        return url.origin + "/lightsite-logo.svg";
      }
      url.username = "";
      url.password = "";
      url.hash = "";
      url.search = "";
      return url.toString();
    } catch {
      return null;
    }
  }

  function isRrwebEvent(value) {
    return value &&
      typeof value === "object" &&
      Number.isFinite(value.type) &&
      Number.isFinite(value.timestamp);
  }

  function getJsonSize(value) {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function getTextSize(value) {
    try {
      return new Blob([value]).size;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function getPositiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
`;
