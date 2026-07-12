import { describe, expect, it } from "vitest"
import { getExtensionPanelRect } from "./panel-position"

describe("Gmail extension panel positioning", () => {
  it("shrinks inside a narrow viewport without negative offsets", () => {
    expect(getExtensionPanelRect({
      actionTop: 520,
      composeRight: 384,
      panelHeight: 560,
      panelWidth: 384,
      viewportHeight: 560,
      viewportPadding: 12,
      viewportWidth: 384,
    })).toEqual({
      height: 536,
      left: 12,
      top: 12,
      width: 360,
    })
  })

  it("keeps the preferred size and anchors to the compose edge when space allows", () => {
    expect(getExtensionPanelRect({
      actionTop: 800,
      composeRight: 1200,
      panelHeight: 560,
      panelWidth: 384,
      viewportHeight: 900,
      viewportPadding: 12,
      viewportWidth: 1440,
    })).toEqual({
      height: 560,
      left: 804,
      top: 230,
      width: 384,
    })
  })
})
