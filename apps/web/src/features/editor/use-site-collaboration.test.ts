import { describe, expect, it } from "vitest"

import {
  collaboratorsAreEqual,
  type EditorCollaborator,
} from "./use-site-collaboration"

const collaborator: EditorCollaborator = {
  clientId: 11,
  color: "#2563eb",
  id: "user-1",
  name: "Lightsite Dev",
}

describe("collaboratorsAreEqual", () => {
  it("keeps equivalent awareness snapshots from causing React updates", () => {
    expect(collaboratorsAreEqual([collaborator], [{ ...collaborator }])).toBe(true)
  })

  it("detects visible collaborator changes", () => {
    expect(
      collaboratorsAreEqual([collaborator], [{ ...collaborator, clientId: 12 }])
    ).toBe(false)
  })
})
