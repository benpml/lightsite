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
    await request(app).get("/track/2026-07-21.v10/recorder.js").expect(404);
  });

  it("collects only explicit server-issued element and logical page ids", () => {
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("[data-handout-track=");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain('getAttribute("data-handout-element-id")');
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain('getAttribute("data-handout-page-id")');
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("elementId,");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("pageId");
  });

  it("loads replay dependencies in parallel and closes recordings that end during startup", () => {
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("Promise.all([");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("rrwebRecordModule");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("completePendingRecording(recording");
    expect(PUBLIC_TRACKING_V2_SCRIPT).toContain("finalSequence: null");
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
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("mousemoveCallback: 100");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("scroll: 150");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("event.type === FULL_SNAPSHOT_TYPE");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxEventsPerChunk");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxChunkBytes");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("maxBytes");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("completion: terminalMetadata");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toContain("if (upload === terminalUpload) continue;");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).not.toContain("state.inFlightSequence");
    expect(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).not.toContain("compressed: false");
  });

  it("uploads the initial full snapshot immediately and completes against an in-flight large chunk", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    const requests: Array<{ body: string; url: string }> = [];
    let resolveChunk!: () => void;
    const chunkResponse = new Promise<{ ok: true; status: 201 }>((resolve) => {
      resolveChunk = () => resolve({ ok: true, status: 201 });
    });

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener() {},
        clearInterval() {},
        clearTimeout() {},
        removeEventListener() {},
        setInterval() { return 1; },
        setTimeout() { return 1; },
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        addEventListener() {},
        documentElement: { dataset: {} },
        removeEventListener() {},
        visibilityState: "visible",
      },
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: (url: string, init: { body?: string }) => {
        requests.push({ body: String(init.body ?? ""), url });
        return url === "/chunks"
          ? chunkResponse
          : Promise.resolve({ ok: true, status: 200 });
      },
    });

    try {
      const runtimeUrl = `data:text/javascript;base64,${Buffer.from(PUBLIC_TRACKING_V2_RECORDER_SCRIPT).toString("base64")}#${Date.now()}`;
      const runtime = await import(runtimeUrl) as {
        startHandoutRecording(config: Record<string, unknown>): ((reason: string) => void) | null;
      };
      const rrwebRecordModule = {
        record({ emit }: { emit: (event: unknown) => void }) {
          emit({ type: 4, timestamp: Date.now(), data: { width: 1280, height: 720 } });
          emit({
            type: 2,
            timestamp: Date.now() + 1,
            data: { node: { type: 2, tagName: "main", childNodes: [], large: "x".repeat(70_000) } },
          });
          return () => {};
        },
      };
      const stop = runtime.startHandoutRecording({
        chunkEndpoint: "/chunks",
        completeEndpoint: "/complete",
        flushIntervalMs: 5_000,
        maxBytes: 5 * 1024 * 1024,
        maxChunkBytes: 512 * 1024,
        maxDurationMs: 600_000,
        maxEvents: 20_000,
        maxEventsPerChunk: 500,
        rrwebRecordModule,
        sessionId: "session-replay-runtime",
        targetChunkBytes: 48 * 1024,
        uploadToken: "upload-token",
      });

      expect(stop).toBeTypeOf("function");
      expect(requests.filter((entry) => entry.url === "/chunks")).toHaveLength(1);
      expect(JSON.parse(requests[0]!.body).events.map((event: { type: number }) => event.type)).toEqual([4, 2]);

      stop!("pagehide");

      const completion = requests.find((entry) => entry.url === "/complete");
      expect(completion).toBeDefined();
      expect(JSON.parse(completion!.body)).toMatchObject({
        finalSequence: 0,
        sessionId: "session-replay-runtime",
        stopReason: "pagehide",
      });
      resolveChunk();
      await chunkResponse;
    } finally {
      restoreGlobal("window", originalWindow);
      restoreGlobal("document", originalDocument);
      restoreGlobal("fetch", originalFetch);
    }
  });
});

function restoreGlobal(name: "document" | "fetch" | "window", descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}
