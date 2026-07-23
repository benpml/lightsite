import { describe, expect, it } from "vitest"
import * as Y from "yjs"

import {
  createDefaultSiteContent,
  initializeSiteCollaborationDocument,
  readSiteCollaborationContent,
  repairSiteCollaborationDocument,
  updateSiteCollaborationMetadata,
} from "./index"

describe("site collaboration document", () => {
  it("round-trips the canonical site document without losing page content", () => {
    const content = createDefaultSiteContent("Collaborative page")
    content.settings.customPrimaryColor = "#fff5d2"
    content.pages[0]!.document = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello team" }] }],
    }
    const document = new Y.Doc()

    initializeSiteCollaborationDocument(document, content)

    expect(readSiteCollaborationContent(document)).toEqual(content)
  })

  it("merges concurrent metadata edits and page additions by stable id", () => {
    const initial = createDefaultSiteContent("Overview")
    const source = new Y.Doc()
    initializeSiteCollaborationDocument(source, initial)
    const state = Y.encodeStateAsUpdate(source)
    const left = new Y.Doc()
    const right = new Y.Doc()
    Y.applyUpdate(left, state)
    Y.applyUpdate(right, state)

    const leftContent = readSiteCollaborationContent(left)
    leftContent.themeMode = "dark"
    leftContent.pages.push({
      id: "page-left",
      name: "Left page",
      slug: "left-page",
      status: "visible",
      sortOrder: 1,
      document: { type: "doc", content: [{ type: "paragraph" }] },
    })
    updateSiteCollaborationMetadata(left, leftContent)

    const rightContent = readSiteCollaborationContent(right)
    rightContent.sidebar.sections.tabs.label = "Pages"
    rightContent.pages.push({
      id: "page-right",
      name: "Right page",
      slug: "right-page",
      status: "visible",
      sortOrder: 2,
      document: { type: "doc", content: [{ type: "paragraph" }] },
    })
    updateSiteCollaborationMetadata(right, rightContent)

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right))
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left))

    for (const document of [left, right]) {
      const merged = readSiteCollaborationContent(document)
      expect(merged.themeMode).toBe("dark")
      expect(merged.sidebar.sections.tabs.label).toBe("Pages")
      expect(merged.pages.map((page) => page.id)).toEqual(
        expect.arrayContaining([initial.pages[0]!.id, "page-left", "page-right"]),
      )
    }
  })

  it("is idempotent when initialization is attempted more than once", () => {
    const initial = createDefaultSiteContent("First")
    const replacement = createDefaultSiteContent("Second")
    const document = new Y.Doc()

    initializeSiteCollaborationDocument(document, initial)
    initializeSiteCollaborationDocument(document, replacement)

    expect(readSiteCollaborationContent(document).pages[0]?.name).toBe("First")
  })

  it("repairs the zero-page state caused by concurrent last-page deletions", () => {
    const initial = createDefaultSiteContent("First")
    initial.pages.push({
      id: "second-page",
      name: "Second",
      slug: "second",
      status: "visible",
      sortOrder: 1,
      document: { type: "doc", content: [{ type: "paragraph" }] },
    })
    const source = new Y.Doc()
    initializeSiteCollaborationDocument(source, initial)
    const state = Y.encodeStateAsUpdate(source)
    const left = new Y.Doc()
    const right = new Y.Doc()
    Y.applyUpdate(left, state)
    Y.applyUpdate(right, state)

    const leftContent = readSiteCollaborationContent(left)
    leftContent.pages = leftContent.pages.filter((page) => page.id === "second-page")
    updateSiteCollaborationMetadata(left, leftContent)
    const rightContent = readSiteCollaborationContent(right)
    rightContent.pages = rightContent.pages.filter((page) => page.id !== "second-page")
    updateSiteCollaborationMetadata(right, rightContent)
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right))
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left))

    expect(() => readSiteCollaborationContent(left)).toThrow()
    expect(repairSiteCollaborationDocument(left)).toContain("page-required")
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left))

    expect(readSiteCollaborationContent(left).pages).toHaveLength(1)
    expect(readSiteCollaborationContent(right).pages).toHaveLength(1)
  })
})
