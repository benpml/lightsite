# Lightsite Site Sidebar And Pages Spec

This document defines the product behavior, data model, editor architecture, public rendering rules, and UI details for the site sidebar and optional multi-page sites.

The important boundary: **pages are site-level documents, not blocks inside a Tiptap document**. Each page body is its own Tiptap JSON document. The sidebar is site navigation chrome that points to pages, links, and next-step buttons.

## Goals

- Let a site remain a simple one-page sales page by default.
- Let users add extra pages only when a deal needs more depth.
- Keep page switching lightweight and obvious.
- Keep published pages clean: no empty sidebar sections and no sidebar at all when there is nothing to show.
- Keep editor mode helpful: empty sections can show add affordances even though those sections are hidden in preview/published.
- Keep editing inline and low-friction without introducing a separate page-builder state model.
- Match the Figma sidebar shape and use the existing shadcn/token system.

## Non-Goals

- No nested pages.
- No per-page permissions in V1.
- No page-specific recipient links in V1; recipients resolve to the site and can include the active/default page later if needed.
- No arbitrary sidebar widgets.
- No drag-and-drop reordering in the first pass unless the base page/list model is already stable.
- No sidebar content stored inside the Tiptap page body.

## User Mental Model

A user edits a **site**.

By default, the site has one page and no visible public sidebar.

If the user adds pages, the sidebar gets a **Tabs** section. Clicking a tab changes the page being viewed or edited.

The sidebar can also include:

- **Links**: external or internal URLs.
- **Next steps**: high-emphasis CTA buttons.

The user should not have to understand routes, content JSON, page IDs, slugs, or document switching.

The important naming nuance: **Tabs are the public/editor navigation presentation of pages**. Pages are the data model. Tabs are not a separate thing to manage unless the user is editing the section label.

## Canonical Terms

- **Page**: A named Tiptap document inside a site.
- **Active page**: The page currently loaded into the editor.
- **Default page**: The first page opened by the site URL.
- **Sidebar**: The left navigation area rendered when at least one public section has visible items.
- **Tabs section**: Sidebar section containing site pages.
- **Links section**: Sidebar section containing link rows.
- **Next steps section**: Sidebar section containing CTA buttons.
- **Section label**: Editable display name for Tabs, Links, or Next steps.

## Product Rules

- Every site always has at least one page internally.
- Pages are optional from the user's point of view because a one-page site does not need visible tabs.
- The default page cannot be hard-deleted. If a site has one page, the delete action is disabled or hidden.
- The public Tabs section is visible only when there are at least two visible pages.
- Empty public sections are hidden.
- If all public sidebar sections are empty, the entire public sidebar is hidden and the content column centers like a one-page site.
- Editor mode can show empty-section add affordances so users can build the sidebar.
- Preview mode should behave like published rendering: hide empty sections and hide the entire sidebar if empty.
- Section labels can be renamed. Blank labels revert to defaults.
- Links and next-step buttons are site-level navigation items, not page body blocks.
- Variables remain site-scoped. Pages do not have separate variable definitions in V1.
- Recipients resolve variable values for the whole site; switching pages should keep the same recipient context.
- Page body editing remains fully Tiptap-native.

## Figma-Derived Layout

Source: Figma node `3224:11478`.

### Shell

- Editor header height: `46px`.
- Body height fills the remaining editor viewport.
- Main layout uses background token `background`.
- Sidebar sits on the left of the page content, not inside a floating card.
- Use tokenized typography. If generated Figma CSS includes negative letter spacing, ignore it and use the app standard `letter-spacing: 0`.

### Sidebar

- Sidebar outer width: `289px`.
- Sidebar padding: `24px` horizontal, `26px` top.
- Sidebar inner width: `241px`.
- Section vertical gap: `16px`.
- Section internal gap: `8px`.
- Section header height: `26px` when populated.
- Section label:
  - text size: `14px`
  - line height: `24px`
  - color: `secondary-foreground`
  - weight: regular
- Header icon buttons:
  - size: `26px`
  - radius: `8px`
  - icon size: `14px`
  - ghost treatment
  - add button remains visible in populated editor sections
  - edit button appears on section header hover/focus

### Rows

- Page/link rows:
  - height: `38px`
  - radius: `8px`
  - horizontal padding: `10px`
  - icon size: `16px`
  - icon/text gap: `8px`
  - label size: `16px`
  - label line height: `24px`
- Active page row:
  - background: `secondary`
  - text: `secondary-foreground`
- Inactive page/link rows:
  - background: transparent
  - hover: `muted` or `secondary` depending on current token contrast
- Empty editor add rows:
  - height: `38px`
  - label size: `14px`
  - text color: `tertiary-foreground`
  - plus icon size: `14px`
  - visible in editor mode only

### Next-Step Buttons

- Width: full sidebar inner width (`241px`).
- Height: `38px`.
- Radius: `10px`.
- Label size: `15px`.
- Filled button:
  - background: `foreground`
  - text: `background`
- Outline button:
  - border: `border`
  - text: `foreground`
  - background: transparent/background

## Data Model

The site content should move from a single body block list to a page-aware schema.

Recommended next schema:

```ts
type SiteContentV3 = {
  schemaVersion: 3
  chrome: {
    siteHeader: SiteHeaderChrome
    hero: SiteHeroChrome
    sidebar: SiteSidebarChrome
  }
  settings: SiteSettings
  variables: SiteVariableDefinition[]
  pages: SitePage[]
}

type SitePage = {
  id: string
  name: string
  slug: string
  status: "visible" | "hidden"
  sortOrder: number
  body: TiptapJSONContent
  createdAt: string
  updatedAt: string
}

type SiteSidebarChrome = {
  sections: {
    tabs: SiteSidebarSectionChrome
    links: SiteSidebarSectionChrome
    nextSteps: SiteSidebarSectionChrome
  }
  links: SiteSidebarLink[]
  nextSteps: SiteSidebarButton[]
}

type SiteSidebarSectionChrome = {
  label: string
}

type SiteSidebarLink = {
  id: string
  label: string
  href: string
  icon: string
  sortOrder: number
  status: "visible" | "hidden"
}

type SiteSidebarButton = {
  id: string
  label: string
  href: string
  style: "filled" | "outline"
  sortOrder: number
  status: "visible" | "hidden"
}
```

### Public Payload Shape

The public content schema should gain page-aware output before this ships publicly.

Recommended payload:

```ts
type PublicSitePayloadV2 = {
  schemaVersion: 2
  site: PublicSiteMeta
  chrome: PublicSiteChrome
  variables: PublicVariableValue[]
  pages: PublicSitePageSummary[]
  activePage: PublicSitePage
}

type PublicSitePageSummary = {
  id: string
  name: string
  slug: string
}

type PublicSitePage = PublicSitePageSummary & {
  body: TiptapJSONContent
}
```

This allows the first implementation to send all page summaries for sidebar tabs while sending only the active page body. The editor draft schema can keep all page bodies because the editor needs them.

### Migration From V2

Current V2 shape has one `blocks` array.

Migration should create:

- one default page
- page name from site name or `"Overview"`
- page slug `"overview"` unless it conflicts
- page body converted from existing `blocks`
- default section labels:
  - `Tabs`
  - `Links`
  - `Next steps`
- empty links and next steps arrays

V2 `blocks` can remain accepted by `normalizeSiteContent` until all saved drafts are migrated.

After the V3 migration is stable, new writes should always write `pages`; `blocks` should become read-only legacy compatibility.

### Why Pages Own Tiptap JSON

Each page is a complete document. This keeps:

- undo/redo scoped to page editing
- page switching deterministic
- public rendering simple
- collaboration eventually scoped by page ID
- pages independent without duplicating site chrome or variables

Do not store page body content in React component state as the source of truth. React can hold draft UI state while editing, but page documents must serialize from Tiptap.

## Editor Architecture

### Active Page Loading

The editor should have one active Tiptap editor instance for the active page body.

When switching pages:

1. Flush the current page document from `editor.getJSON()` into the site draft store.
2. Change `activePageId`.
3. Load the next page body into Tiptap with `editor.commands.setContent(...)`.
4. Clear block selection and transient menus.
5. Focus the new page editor at the top or preserve last cursor per page if that state exists.

This is acceptable because Tiptap remains the owner of the active document. The site-level page store is the persisted document collection, not a competing editor model.

The site sidebar must never read or mutate ProseMirror selection directly. Page switch, page creation, link editing, and next-step editing are site-structure commands around the editor, not inline document commands.

### Undo And History

V1 recommendation:

- Undo/redo is per active page.
- Switching pages clears the visible undo stack for the newly loaded page unless page-local history persistence is implemented.
- Adding/deleting/renaming pages is site-structure history, not Tiptap history.

Later collaboration can use page-level rooms/documents.

### Page Creation

Clicking `Add page`:

- creates a new page after the current last visible page
- defaults name to `Untitled`
- generates a stable page ID and slug
- switches to the new page
- loads an empty Tiptap document with a heading placeholder
- focuses the heading

If the Tabs section was previously empty publicly, the section becomes public only after there are at least two visible pages.

Recommended new-page body:

```ts
{
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [] },
    { type: "paragraph" }
  ]
}
```

The heading placeholder can display the page name visually, but the page name itself remains site metadata unless the user types heading content.

### Page Selection

Clicking a page row:

- saves current active page body
- switches the active page
- updates the active row fill
- updates any URL/editor state needed for refresh recovery

Do not make page rows contenteditable. Rename should be explicit through a row menu or inline input triggered by edit.

Recommended row menu:

- Rename
- Duplicate
- Hide from sidebar
- Delete, disabled when it is the only page or default page without a replacement

Deleting a non-default active page should switch to the nearest previous visible page, then the default page fallback.

### Section Label Editing

Each section header has a hover/focus edit ghost icon button.

Behavior:

- Hovering the section header reveals edit.
- Keyboard focus within the section header also reveals edit.
- Clicking edit opens a compact inline popover or turns the label into an input.
- Enter saves.
- Escape cancels.
- Blur saves if valid.
- Empty value reverts to the default section label.

This is site chrome editing and should not interact with Tiptap selection.

Editor-only empty sections still show their section labels so the user understands where new pages, links, and buttons will appear.

### Links

Clicking Add link opens a compact editor popover/dialog with:

- Label, required
- URL, required and URL-ish validated
- Optional icon later

Existing link rows:

- click opens the URL in preview/published
- in editor, click can select/edit the row or open a row menu; avoid accidental navigation while editing

Recommended V1 editor behavior:

- row primary click selects/opens edit popover
- menu contains `Open link`, `Rename`, `Edit URL`, `Delete`
- deleting a link removes it from the site sidebar only; it never touches page body content

### Next Steps

Clicking Add button opens a compact editor popover/dialog with:

- Label, required
- URL, required and URL-ish validated
- Style: Filled or Outline

Rows render as actual buttons, not list rows.

In editor:

- clicking a next-step button opens its edit popover
- a separate explicit menu action can open the destination URL

In public/preview:

- clicking navigates to the URL and tracks a button click.

Filled/outline style is per next-step item. The first next step can default to filled; later next steps can default to outline to avoid a wall of primary actions.

## Public And Preview Rendering

Build a normalized public sidebar from the published payload:

```ts
const visiblePages = pages.filter(page => page.status === "visible")
const tabItems = visiblePages.length >= 2 ? visiblePages : []
const linkItems = sidebar.links.filter(item => item.status === "visible" && item.label && item.href)
const buttonItems = sidebar.nextSteps.filter(item => item.status === "visible" && item.label && item.href)
const showSidebar = tabItems.length > 0 || linkItems.length > 0 || buttonItems.length > 0
```

Rules:

- If `showSidebar` is false, do not render the sidebar element.
- If a section has no items, do not render that section.
- Editor mode uses a different `editorSidebarModel` that can include empty sections and add affordances.
- Public Tabs uses page links.
- Public Links uses anchor rows.
- Public Next steps uses buttons/anchors.
- Active page should be indicated in public tabs.
- On mobile, sidebar should collapse above content as a horizontal or stacked compact nav only when visible. For V1, it can stack above the content with the same section hiding rules.

## Routing

Recommended public URLs:

```text
/{siteUri}/{recipientSlug}
/{siteUri}/{recipientSlug}/{pageSlug}
```

For non-recipient/base public links:

```text
/{workspaceSlug}/{siteSlug}
/{workspaceSlug}/{siteSlug}/{pageSlug}
```

Rules:

- Missing page slug resolves to the default page.
- Unknown page slug returns the same generic unavailable public page as unknown sites.
- Page slug changes should reserve old slugs or be blocked after publish until redirect support exists.
- Recipient URLs should keep their recipient slug stable. Page slug is the optional final segment only.

Editor route can stay:

```text
/editor-next/:siteId
```

Active page can be stored in query string or local editor state:

```text
/editor-next/:siteId?page=:pageId
```

Use page ID in editor state, not slug, because drafts can rename slugs.

Refreshing the editor with a missing or deleted page ID should resolve to the default page and remove the stale query param.

## Tracking

Tracking context should include:

- site ID
- page ID
- recipient ID if present
- published version ID
- active page slug

Track:

- page viewed
- sidebar tab clicked
- sidebar link clicked
- next-step button clicked

Avoid treating editor clicks as public tracking events.

## Accessibility

- Public sidebar should be a `nav` with an accessible label, such as `Site navigation`.
- Section labels should be headings or grouped labels, not decorative text.
- Active page tab should expose `aria-current="page"`.
- Icon-only editor buttons need `aria-label`.
- Section edit buttons must be keyboard reachable on focus, not hover-only.
- Popovers/dialogs need explicit titles.
- Links and buttons must remain real anchors/buttons according to behavior.
- Editor-only row actions should not be hidden from keyboard users just because hover is unavailable.

## Performance

- Do not mount one Tiptap editor per page.
- Keep only the active page editor mounted.
- Normalize sidebar visibility from arrays with cheap memoized selectors.
- Public rendering should not ship editor sidebar management code.
- Store page body JSON per page so public payload can send only the active page body if desired later.
- For published multi-page payloads, prefer route-level fetch of one page body over sending every page body once sites become large.
- Keep sidebar state updates immutable and scoped so typing in Tiptap does not rerender the sidebar on every transaction.

## Failure States

- If a page is deleted while another collaborator is viewing it, switch them to the default page and show a toast.
- If saving a page switch fails, keep the user on the current page and show a retryable error.
- If a link/button URL is invalid, keep the editor popover open and show field-level error.
- If all pages except the default are hidden/deleted, public sidebar tabs disappear.
- If a section label is blank, restore its default label.
- If the active page body cannot be parsed by Tiptap, load a recoverable empty document and preserve the failed JSON for diagnostics instead of overwriting it immediately.

## Implementation Plan

1. Add the documented schema types and normalization helpers.
2. Add migration from V2 `blocks` to V3 `pages`.
3. Add a local editor-next page/navigation store for the current prototype, with the same shape as the schema.
4. Refactor `EditorNextPage` to load the active page body into Tiptap and flush on page switch.
5. Build `SiteSidebar` under `features/editor-next/components`.
6. Add sidebar section header editing.
7. Add page creation and page switching.
8. Add links and next-step creation/editing.
9. Add preview/public selectors that hide empty sections and the whole sidebar.
10. Extend public payload/content schema once editor prototype behavior is solid.
11. Add tests for schema migration, sidebar selectors, page switching, and public route resolution.
12. Verify the editor in browser with one-page, two-page, empty-sidebar, populated-sidebar, and mobile-width states.

## Acceptance Criteria

- A site with one page and no links/buttons shows no sidebar in preview/published.
- Editor mode shows add affordances for empty sidebar sections.
- Adding a page creates a page, switches to it, and lets the user edit its body.
- With two visible pages, Tabs renders in the sidebar and active page styling matches Figma.
- Empty Links and Next steps sections do not render in preview/published.
- Renaming a section updates only that section label.
- Section edit buttons appear on hover and keyboard focus.
- Tiptap content for one page does not leak into another page after switching.
- Public rendering can resolve and render a specific page.
- URL and delete failure states do not corrupt page body content.
- Typing in one page, switching away, and switching back restores exactly that page's Tiptap JSON.
- Preview/published never show empty editor add rows.
