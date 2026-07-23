import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { buildOriginRequest } from "./index";

describe("public worker origin requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("overwrites attacker-controlled origin authentication and forwarding headers", () => {
    const request = new Request("https://handout.link/api/sites?ignored=no", {
      headers: {
        "x-forwarded-host": "attacker.example",
        "x-handout-origin-auth": "attacker-secret",
      },
    });
    const origin = buildOriginRequest(request, {
      API_ORIGIN: "https://origin.example",
      ORIGIN_AUTH_SECRET: "trusted-origin-secret-that-is-long",
    });

    expect(origin.url).toBe("https://origin.example/api/sites?ignored=no");
    expect(origin.headers.get("x-forwarded-host")).toBe("handout.link");
    expect(origin.headers.get("x-handout-origin-auth")).toBe(
      "trusted-origin-secret-that-is-long",
    );
  });

  it("never lets query parameters influence a canonical public-page cache fill", async () => {
    const originFetch = vi.fn(async (request: Request) =>
      new Response(`<p>${new URL(request.url).search || "canonical"}</p>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
    vi.stubGlobal("fetch", originFetch);
    vi.stubGlobal("caches", {
      open: async () => ({
        match: async () => undefined,
        put: async () => undefined,
      }),
    });

    const response = await worker.fetch(
      new Request("https://handout.link/acme/brief?poison=yes") as Parameters<typeof worker.fetch>[0],
      {
        API_ORIGIN: "https://origin.example",
        ORIGIN_AUTH_SECRET: "trusted-origin-secret-that-is-long",
      },
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<p>canonical</p>");
    expect(new URL(originFetch.mock.calls[0]![0].url).search).toBe("");
  });
});
