import { describe, expect, it } from "vitest"

import { extractIframeSrc, normalizeIframeEmbedUrl } from "./embed-url"

describe("editor-next iframe embed URLs", () => {
  it("extracts an iframe src from pasted embed code", () => {
    expect(
      extractIframeSrc('<iframe src="https://calendly.com/team/demo" title="Book"></iframe>')
    ).toBe("https://calendly.com/team/demo")
  })

  it("normalizes bare calendar domains to https URLs", () => {
    expect(normalizeIframeEmbedUrl("cal.com/acme/demo")).toEqual({
      ok: true,
      url: "https://cal.com/acme/demo",
    })
  })

  it("normalizes Cal inline embed snippets from calLink", () => {
    expect(
      normalizeIframeEmbedUrl(`
        <div id="my-cal-inline-15min"></div>
        <script>
          Cal.ns["15min"]("inline", {
            elementOrSelector:"#my-cal-inline-15min",
            config: {"theme":"dark"},
            calLink: "playmakerben/15min",
          });
        </script>
      `)
    ).toEqual({
      ok: true,
      url: "https://cal.com/playmakerben/15min",
    })
  })

  it("rejects non-web embed protocols", () => {
    expect(normalizeIframeEmbedUrl("javascript:alert(1)")).toMatchObject({
      ok: false,
    })
  })
})
