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
} from "@handout/tracking-schema";
import {
  PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL,
  PUBLIC_TRACKING_V2_SCRIPT,
  PUBLIC_TRACKING_V2_RECORDER_SCRIPT,
  createPublicTrackingScriptRouter,
} from "./public-script";

describe("public tracking script", () => {
  it("serves immutable analytics and replay runtimes", async () => {
    const app = express().use(createPublicTrackingScriptRouter());
    const response = await request(app).get(TRACKING_V2_SCRIPT_ENDPOINT).expect(200);

    expect(response.headers["cache-control"]).toBe(PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.text).toContain(TRACKING_V2_SCRIPT_VERSION);
    expect(response.text).toContain(TRACKING_V2_SESSION_START_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_EVENTS_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT);
    expect(response.text).toContain(TRACKING_V2_SESSION_END_ENDPOINT);
    await request(app).get(TRACKING_V2_RECORDER_SCRIPT_ENDPOINT)
      .expect("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL)
      .expect(200);
    await request(app).get(TRACKING_V2_RRWEB_RECORD_SCRIPT_ENDPOINT)
      .expect("cache-control", PUBLIC_TRACKING_SCRIPT_CACHE_CONTROL)
      .expect(200);
    await request(app).get("/track/2026-07-12.v8/recorder.js").expect(404);
    await request(app).get("/track/2026-07-12.v8/rrweb-record.js").expect(404);
  });

  it("collects only explicit server-issued element and logical page ids", () => {
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("[data-handout-track=");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain('getAttribute("data-handout-element-id")');
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain('getAttribute("data-handout-page-id")');
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("elementId,");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("pageId");
  });

  it("keeps ordinary event collection free of persistent identity and generic content scraping", () => {
    for (const prohibited of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "document.cookie",
      "innerText",
      "textContent",
      "location.href",
      "document.title",
      "document.referrer",
      "pointermove",
      "MutationObserver",
    ]) {
      expect(PUBLIC_TRACKING_V2_SCRIPT.toLowerCase()).not.toContain(prohibited.toLowerCase());
    }
  });

  it("uses privacy-first rrweb capture with bounded payloads and no media extraction", () => {
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maskAllInputs: true");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain('blockSelector: "script,iframe,[data-handout-recording-block]"');
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("recordCanvas: false");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("recordCrossOriginIframes: false");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("collectFonts: false");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("inlineImages: false");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("mousemove: 100");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("scroll: 150");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxEventsPerChunk");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxChunkBytes");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxBytes");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("completion: terminalMetadata");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("if (upload === terminalUpload) continue;");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).not.toContain("state.inFlightSequence");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).not.toContain("compressed: false");
  });
});
