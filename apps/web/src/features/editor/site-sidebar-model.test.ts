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
  reorderSidebarButtons,
  reorderSidebarLinks,
  reorderSidebarPages,
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

  it("stores an optional icon on sidebar buttons", () => {
    const iconButton = createSidebarButton(
      {
        label: "Book a call",
        href: "https://example.com/book",
        icon: "calendar",
        style: "filled",
      },
      []
    )
    const textButton = createSidebarButton(
      { label: "Learn more", href: "https://example.com", style: "outline" },
      [iconButton]
    )

    expect(iconButton.icon).toBe("calendar")
    expect(textButton).not.toHaveProperty("icon")
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

  it("reorders sidebar buttons in their visible sort order and normalizes sort values", () => {
    const first = createSidebarButton(
      { label: "First", href: "https://example.com/first", style: "filled" },
      []
    )
    const second = {
      ...createSidebarButton(
        { label: "Second", href: "https://example.com/second", style: "outline" },
        [first]
      ),
      sortOrder: 1,
    }
    const third = {
      ...createSidebarButton(
        { label: "Third", href: "https://example.com/third", style: "filled" },
        [first, second]
      ),
      sortOrder: 2,
    }

    const reordered = reorderSidebarButtons(
      [third, first, second],
      third.id,
      first.id
    )

    expect(reordered.map((button) => button.label)).toEqual(["Third", "First", "Second"])
    expect(reordered.map((button) => button.sortOrder)).toEqual([0, 1, 2])
    expect(reordered[0]).toMatchObject({ href: third.href, style: third.style, status: third.status })
  })

  it("leaves sidebar buttons untouched when a reorder target is stale", () => {
    const first = createSidebarButton(
      { label: "First", href: "https://example.com/first", style: "filled" },
      []
    )
    const second = createSidebarButton(
      { label: "Second", href: "https://example.com/second", style: "outline" },
      [first]
    )
    const buttons = [first, second]

    expect(reorderSidebarButtons(buttons, second.id, "missing-button")).toBe(buttons)
  })

  it("reorders tabs without changing their page content or active identity", () => {
    const first = createEditorPage("Overview", [])
    const second = createEditorPage("Pricing", [first])
    const third = createEditorPage("FAQs", [first, second])

    const reordered = reorderSidebarPages([third, first, second], second.id, third.id)

    expect(reordered.map((page) => page.name)).toEqual(["Overview", "FAQs", "Pricing"])
    expect(reordered.map((page) => page.sortOrder)).toEqual([0, 1, 2])
    expect(reordered.find((page) => page.id === second.id)?.document).toBe(second.document)
  })

  it("reorders links without changing their destinations or icons", () => {
    const first = createSidebarLink(
      { label: "Website", href: "https://example.com" },
      []
    )
    const second = createSidebarLink(
      { label: "Pricing", href: "https://example.com/pricing" },
      [first]
    )
    const third = createSidebarLink(
      { label: "Security", href: "https://example.com/security" },
      [first, second]
    )

    const reordered = reorderSidebarLinks([second, third, first], third.id, first.id)

    expect(reordered.map((link) => link.label)).toEqual(["Security", "Website", "Pricing"])
    expect(reordered.map((link) => link.sortOrder)).toEqual([0, 1, 2])
    expect(reordered[0]).toMatchObject({ href: third.href, icon: third.icon })
  })

  it("keeps every sidebar collection unchanged when a reorder id is stale", () => {
    const pages = [createEditorPage("Overview", []), createEditorPage("Pricing", [])]
    const links = [
      createSidebarLink({ label: "Website", href: "https://example.com" }, []),
      createSidebarLink({ label: "Pricing", href: "https://example.com/pricing" }, []),
    ]

    expect(reorderSidebarPages(pages, pages[0]!.id, "missing-page")).toBe(pages)
    expect(reorderSidebarLinks(links, links[0]!.id, "missing-link")).toBe(links)
  })

  it("appends new sidebar items after the highest persisted sort order", () => {
    const page = createEditorPage("Overview", [])
    const link = createSidebarLink({ label: "Website", href: "https://example.com" }, [])
    const button = createSidebarButton(
      { label: "Book", href: "https://example.com/book", style: "filled" },
      []
    )

    expect(link.icon).toBe("link")
    expect(createEditorPage("Pricing", [{ ...page, sortOrder: 4 }]).sortOrder).toBe(5)
    expect(createSidebarLink(
      { label: "Pricing", href: "https://example.com/pricing" },
      [{ ...link, sortOrder: 6 }]
    ).sortOrder).toBe(7)
    expect(createSidebarButton(
      { label: "Contact", href: "https://example.com/contact", style: "outline" },
      [{ ...button, sortOrder: 8 }]
    ).sortOrder).toBe(9)
  })
})
