import { afterEach, describe, expect, it, vi } from "vitest"

import { getDemoPublishedSite } from "./public-site-fixture"
import { getPublicSiteApiPath, getPublicSitePayload } from "./public-site-api"

describe("public site API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds encoded public site API paths", () => {
    expect(
      getPublicSiteApiPath({
        workspaceSlug: "acme",
        siteSlug: "rollout brief",
        variantSlug: "mira/singh",
      }),
    ).toBe("/api/public/sites/acme/rollout%20brief/mira%2Fsingh")
  })

  it("fetches public payloads without credentials and normalizes the response", async () => {
    const payload = getDemoPublishedSite("acme")
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ payload, requestId: "request_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetch)

    await expect(
      getPublicSitePayload({
        workspaceSlug: "lightsite",
        siteSlug: "rollout-brief",
        variantSlug: "mira",
      }),
    ).resolves.toMatchObject({
      status: "available",
      payload: {
        workspace: {
          slug: "acme",
        },
        selectedVariant: {
          slug: "mira",
        },
      },
    })
    expect(fetch).toHaveBeenCalledWith("/api/public/sites/lightsite/rollout-brief/mira", {
      credentials: "omit",
      headers: {
        accept: "application/json",
      },
      signal: undefined,
    })
  })

  it("fails closed for unavailable or invalid public payloads", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ payload: { site: { id: "missing" } }, requestId: "request_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
    vi.stubGlobal("fetch", fetch)

    await expect(
      getPublicSitePayload({
        workspaceSlug: "acme",
        siteSlug: "rollout-brief",
        variantSlug: null,
      }),
    ).resolves.toEqual({ status: "unavailable" })
    await expect(
      getPublicSitePayload({
        workspaceSlug: "acme",
        siteSlug: "rollout-brief",
        variantSlug: null,
      }),
    ).resolves.toEqual({ status: "unavailable" })
  })
})
