import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LoadingState } from "@/components/common/loading-state"
import { Spinner } from "@/components/ui/spinner"

describe("Spinner", () => {
  it("renders the Handout mark at the canonical size and speed", () => {
    const markup = renderToStaticMarkup(<Spinner />)

    expect(markup).toContain('viewBox="0 0 20 22"')
    expect(markup).toContain("size-auto h-5")
    expect(markup.match(/dur="0.8s"/g)).toHaveLength(8)
    expect(markup.match(/repeatCount="indefinite"/g)).toHaveLength(8)
    expect(markup).toContain('fill="currentColor"')
  })

  it("exposes a placement-aware loading status", () => {
    const markup = renderToStaticMarkup(
      <LoadingState placement="page" label="Loading sites" />,
    )

    expect(markup).toContain('data-slot="loading-state"')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('aria-label="Loading sites"')
    expect(markup).toContain("min-h-[50vh]")
  })
})
