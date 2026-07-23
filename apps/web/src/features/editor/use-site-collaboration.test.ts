import { describe, expect, it } from "vitest"
import { createDefaultSiteContent, initializeSiteCollaborationDocument } from "@handout/site-document"
import * as Y from "yjs"

import {
  collaboratorsAreEqual,
  isSiteCollaborationReady,
  type EditorCollaborator,
} from "./use-site-collaboration"

const collaborator: EditorCollaborator = {
  clientId: 11,
  color: "#2563eb",
  id: "user-1",
  name: "Handout Dev",
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

describe("isSiteCollaborationReady", () => {
  it("does not read an empty document when the provider reports remote sync first", () => {
    const document = new Y.Doc()

    expect(isSiteCollaborationReady({
      authenticationFailed: false,
      document,
      isIndexedDbSynced: false,
      isRemoteSynced: true,
    })).toBe(false)
  })

  it("becomes ready only after a synced document is initialized", () => {
    const document = new Y.Doc()
    initializeSiteCollaborationDocument(document, createDefaultSiteContent())

    expect(isSiteCollaborationReady({
      authenticationFailed: false,
      document,
      isIndexedDbSynced: false,
      isRemoteSynced: true,
    })).toBe(true)
  })
})
