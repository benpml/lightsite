import { describe, expect, it } from "vitest"

import {
  createEditorPage,
  createEditorSiteDraft,
  createSidebarButton,
  createSidebarLink,
  getPublicSidebarModel,
  isUrlish,
  normalizeSidebarHref,
  normalizeSectionLabel,
} from "./site-sidebar-model"

describe("editor site sidebar model", () => {
  it("keeps a one-page site sidebar visible publicly", () => {
    const draft = createEditorSiteDraft("Sales one-pager")

    expect(getPublicSidebarModel(draft)).toMatchObject({
      pages: [{ name: "Sales one-pager" }],
      links: [],
      nextSteps: [],
      showSidebar: true,
    })
  })

  it("creates the first page with a lightweight empty-state scaffold", () => {
    const draft = createEditorSiteDraft("Sales one-pager")

    expect(draft.pages[0]?.document.content?.[0]).toEqual({ type: "paragraph" })
    expect(JSON.stringify(draft.pages[0]?.document)).not.toContain("pageTitleSection")
    expect(JSON.stringify(draft.pages[0]?.document)).not.toContain("Sites work like a doc.")
    expect(JSON.stringify(draft.pages[0]?.document)).not.toContain("Start from a template:")
  })

  it("creates added pages with a lightweight empty-state scaffold", () => {
    const draft = createEditorSiteDraft("Sales one-pager")
    const nextPage = createEditorPage("ROI calculator", draft.pages)

    expect(nextPage.document.content?.[0]).toEqual({ type: "paragraph" })
    expect(JSON.stringify(nextPage.document)).not.toContain('"heading"')
    expect(JSON.stringify(nextPage.document)).not.toContain("pageTitleSection")
    expect(JSON.stringify(nextPage.document)).not.toContain("Sites work like a doc.")
  })

  it("shows every visible page as a public tab", () => {
    const draft = createEditorSiteDraft("Sales one-pager")
    const nextPage = createEditorPage("ROI calculator", draft.pages)
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
    const draft = createEditorSiteDraft("Overview")
    const secondPage = createEditorPage("Overview", draft.pages)
    const thirdPage = createEditorPage("Overview", [...draft.pages, secondPage])

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
    const draft = createEditorSiteDraft("Overview")
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

  it("validates sidebar URLs with the shared editor link rules", () => {
    expect(normalizeSidebarHref("example.com/pricing")).toBe("https://example.com/pricing")
    expect(normalizeSidebarHref("https://example.com")).toBe("https://example.com")
    expect(normalizeSidebarHref("http://example.com")).toBe("http://example.com")
    expect(normalizeSidebarHref("person@example.com")).toBe(null)
    expect(normalizeSidebarHref("mailto:person@example.com")).toBe(null)
    expect(normalizeSidebarHref("/demo")).toBe(null)
    expect(normalizeSidebarHref("#pricing")).toBe(null)
    expect(normalizeSidebarHref("localhost:5173")).toBe(null)
    expect(isUrlish("example.com")).toBe(true)
    expect(isUrlish("not a url")).toBe(false)
  })

  it("restores default section labels when users clear them", () => {
    expect(normalizeSectionLabel("nextSteps", "   ")).toBe("Next steps")
    expect(normalizeSectionLabel("links", "Resources")).toBe("Resources")
  })
})
