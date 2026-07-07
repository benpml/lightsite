import { describe, expect, it } from "vitest"

import {
  createEditorNextPage,
  createEditorNextSiteDraft,
  createSidebarButton,
  createSidebarLink,
  getPublicSidebarModel,
  isUrlish,
  normalizeSidebarHref,
  normalizeSectionLabel,
} from "./site-sidebar-model"

describe("editor-next site sidebar model", () => {
  it("keeps a one-page site sidebar hidden publicly", () => {
    const draft = createEditorNextSiteDraft("Sales one-pager")

    expect(getPublicSidebarModel(draft)).toMatchObject({
      pages: [],
      links: [],
      nextSteps: [],
      showSidebar: false,
    })
  })

  it("creates the first page with the title-section empty state", () => {
    const draft = createEditorNextSiteDraft("Sales one-pager")

    expect(draft.pages[0]?.body.content?.[0]).toMatchObject({
      type: "pageTitleSection",
      attrs: { align: "center" },
      content: [
        { type: "pageTitleTitle" },
        { type: "pageTitleSubtitle" },
      ],
    })
    expect(JSON.stringify(draft.pages[0]?.body)).not.toContain("Sites work like a doc.")
    expect(JSON.stringify(draft.pages[0]?.body)).not.toContain("Start from a template:")
  })

  it("creates added pages with a heading empty state instead of a title section", () => {
    const draft = createEditorNextSiteDraft("Sales one-pager")
    const nextPage = createEditorNextPage("ROI calculator", draft.pages)

    expect(nextPage.body.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    })
    expect(JSON.stringify(nextPage.body)).not.toContain("pageTitleSection")
    expect(JSON.stringify(nextPage.body)).not.toContain("Sites work like a doc.")
  })

  it("shows public tabs only after a second visible page exists", () => {
    const draft = createEditorNextSiteDraft("Sales one-pager")
    const nextPage = createEditorNextPage("ROI calculator", draft.pages)
    const publicModel = getPublicSidebarModel({
      ...draft,
      pages: [...draft.pages, nextPage],
    })

    expect(publicModel.showSidebar).toBe(true)
    expect(publicModel.pages.map((page) => page.name)).toEqual([
      "Sales one-pager",
      "ROI calculator",
    ])
  })

  it("normalizes duplicate page slugs without exposing slug work to the user", () => {
    const draft = createEditorNextSiteDraft("Overview")
    const secondPage = createEditorNextPage("Overview", draft.pages)
    const thirdPage = createEditorNextPage("Overview", [...draft.pages, secondPage])

    expect([draft.pages[0]?.name, secondPage.name, thirdPage.name]).toEqual([
      "Overview",
      "Overview 2",
      "Overview 3",
    ])
    expect([draft.pages[0]?.slug, secondPage.slug, thirdPage.slug]).toEqual([
      "overview",
      "overview-2",
      "overview-3",
    ])
  })

  it("keeps empty links and buttons hidden from the public sidebar", () => {
    const draft = createEditorNextSiteDraft("Overview")
    const link = createSidebarLink({ label: "Website", href: "https://example.com" }, [])
    const button = createSidebarButton(
      { label: "Book a call", href: "https://example.com/book", style: "filled" },
      []
    )

    expect(getPublicSidebarModel({
      ...draft,
      sidebar: {
        ...draft.sidebar,
        links: [link, { ...link, id: "empty-link", label: "", href: "" }],
        nextSteps: [button, { ...button, id: "empty-button", label: "", href: "" }],
      },
    })).toMatchObject({
      links: [link],
      nextSteps: [button],
      showSidebar: true,
    })
  })

  it("accepts bare domains and stores normalized sidebar URLs", () => {
    const link = createSidebarLink({ label: "Website", href: "example.com" }, [])
    const button = createSidebarButton(
      { label: "Book a call", href: " example.com/book ", style: "filled" },
      []
    )

    expect(link.href).toBe("https://example.com")
    expect(button.href).toBe("https://example.com/book")
  })

  it("validates sidebar URLs with the shared editor-next link rules", () => {
    expect(normalizeSidebarHref("example.com/pricing")).toBe("https://example.com/pricing")
    expect(normalizeSidebarHref("https://example.com")).toBe("https://example.com")
    expect(normalizeSidebarHref("http://example.com")).toBe("http://example.com")
    expect(normalizeSidebarHref("person@example.com")).toBe("mailto:person@example.com")
    expect(normalizeSidebarHref("mailto:person@example.com")).toBe("mailto:person@example.com")
    expect(normalizeSidebarHref("/demo")).toBe("/demo")
    expect(normalizeSidebarHref("#pricing")).toBe("#pricing")
    expect(isUrlish("example.com")).toBe(true)
    expect(isUrlish("not a url")).toBe(false)
  })

  it("restores default section labels when users clear them", () => {
    expect(normalizeSectionLabel("nextSteps", "   ")).toBe("Next steps")
    expect(normalizeSectionLabel("links", "Resources")).toBe("Resources")
  })
})
