import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_RECORDER_SCRIPT_ENDPOINT,
  TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_ENDPOINT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
} from "@lightsite/tracking-schema";
import {
  PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL,
  createPublicTrackingScriptRouter,
} from "./public-script";

describe("public tracking scripts", () => {
  it("does not serve the removed legacy public tracking script", async () => {
    const app = express().use(createPublicTrackingScriptRouter());

    await request(app)
      .get("/track/2026-06-14.v1/script.js")
      .expect(404);
  });

  it("serves the v2 public tracking script as an immutable standalone asset", async () => {
    const app = express().use(createPublicTrackingScriptRouter());

    const response = await request(app)
      .get(TRACKING_V2_SCRIPT_ENDPOINT)
      .expect(200);

    expect(response.headers["cache-control"]).toBe(PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain("data-lightsite-tracking-v2");
    expect(response.text).toContain(TRACKING_V2_SCRIPT_VERSION);
    expect(response.text).toContain(TRACKING_V2_SESSION_START_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_EVENTS_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_SESSION_END_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_RECORDER_SCRIPT_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT);
    expect(response.text).toContain("import(config.recorderScriptEndpoint)");
    expect(response.text).toContain("[data-ls-track]");
    expect(response.text).toContain("trackType === \"tab\"");
    expect(response.text).toContain("lastActivityAt + state.activityWindowMs");
    expect(response.text).not.toContain("lastActivityAt + state.idleTimeoutMs");
    expect(response.text).not.toContain("workspaceId");
  });

  it("serves the v2 recorder as a separate immutable module", async () => {
    const app = express().use(createPublicTrackingScriptRouter());

    const response = await request(app)
      .get(TRACKING_V2_RECORDER_SCRIPT_ENDPOINT)
      .expect(200);

    expect(response.headers["cache-control"]).toBe(PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain("export function startLightsiteRecording");
    expect(response.text).toContain("data-ls-recording-mask");
    expect(response.text).toContain("data-ls-recording-block");
    expect(response.text).toContain("isBrowserToolingNode");
    expect(response.text).toContain("codex-browser-sidebar-comments-root");
    expect(response.text).toContain("maskAllInputs: true");
    expect(response.text).toContain("recordCrossOriginIframes: false");
    expect(response.text).toContain("inlineStylesheet: true");
    expect(response.text).toContain("uploadWithRetry");
    expect(response.text).toContain("sendCompletion(reason, state.sequence === 0 ? null : state.sequence - 1, false)");
    expect(response.text).toContain("finalizeAfterUploads(reason)");
    expect(response.text).toContain("/api/public/tracking/v2/og/");
    expect(response.text).toContain("/lightsite-logo.svg");
    expect(response.text).not.toContain("workspaceId");
  });

  it("serves the pinned rrweb recorder as an immutable module", async () => {
    const app = express().use(createPublicTrackingScriptRouter());

    const response = await request(app)
      .get(TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT)
      .expect(200);

    expect(response.headers["cache-control"]).toBe(PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    expect(response.text).toContain("export {");
    expect(response.text).toContain("record");
  });
});
