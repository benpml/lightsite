import { describe, expect, it } from "vitest"

import { normalizeVideoEmbedUrl } from "./video-embed-url"

describe("editor-next video embed URLs", () => {
  it("normalizes YouTube watch links to embed links", () => {
    expect(normalizeVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s")).toEqual({
      ok: true,
      provider: "YouTube",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ?start=65",
    })
  })

  it("normalizes Vimeo links to player links", () => {
    expect(normalizeVideoEmbedUrl("https://vimeo.com/123456789")).toEqual({
      ok: true,
      provider: "Vimeo",
      url: "https://player.vimeo.com/video/123456789",
    })
  })

  it("normalizes Loom share links to embed links", () => {
    expect(normalizeVideoEmbedUrl("https://www.loom.com/share/abc123")).toEqual({
      ok: true,
      provider: "Loom",
      url: "https://www.loom.com/embed/abc123",
    })
  })

  it("accepts pasted iframe embed code", () => {
    expect(
      normalizeVideoEmbedUrl('<iframe src="https://fast.wistia.net/embed/iframe/demo"></iframe>')
    ).toEqual({
      ok: true,
      provider: "fast.wistia.net",
      url: "https://fast.wistia.net/embed/iframe/demo",
    })
  })

  it("rejects non-video page links without iframe code", () => {
    expect(normalizeVideoEmbedUrl("https://example.com/blog")).toMatchObject({
      ok: false,
    })
  })
})
