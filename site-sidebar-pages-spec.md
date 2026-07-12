# Canonical Site Pages and Sidebar

Status: implemented. This feature follows [site-rendering-architecture.md](./site-rendering-architecture.md), which is authoritative for persistence, Preview, publishing, rendering, security, and tracking.

## Model

A site owns ordered pages and one site-level sidebar. Every page owns one canonical Tiptap JSON document.

```ts
type SiteContent = {
  schemaVersion: 3
  themeMode: "light" | "dark" | "system"
  settings: {
    ogImageAssetId?: string
    allowSearchIndexing: false
  }
  variables: SiteVariableDefinition[]
  pages: Array<{
    id: string
    name: string
    slug: string
    status: "visible" | "hidden"
    sortOrder: number
    document: TiptapJSONContent
  }>
  sidebar: {
    sections: {
      tabs: { label: string }
      links: { label: string }
      nextSteps: { label: string }
    }
    links: Array<{
      id: string
      label: string
      href: string
      icon: "link" | "website"
      status: "visible" | "hidden"
      sortOrder: number
    }>
    nextSteps: Array<{
      id: string
      label: string
      href: string
      style: "filled" | "outline"
      status: "visible" | "hidden"
      sortOrder: number
    }>
  }
}
```

There is no root block array, page block array, body adapter, or separate public-page shape. Legacy v1/v2 content is not converted into this model.

## Ownership

- Tiptap owns the active page document while editing.
- Site structure owns page metadata, page order/visibility, sidebar labels, links, buttons, theme, and variables.
- React controls can hold transient form state but cannot become another persisted editor model.
- Switching pages flushes the active editor JSON into the page's `document` and loads the target page document through Tiptap.
- Only one Tiptap editor instance is mounted.

## Public behavior

- Visible pages are sorted by `sortOrder`.
- The first visible page is the default page.
- Tabs render only when more than one page is visible.
- Empty sidebar sections do not render.
- The whole sidebar does not render when there are no tabs, links, or buttons.
- Missing or hidden active-page slugs fall back to the first visible page.
- Preview and published output call the same canonical renderer.
- Tab switching is enhanced by the small public runtime and works without loading React or ProseMirror.

## Tracking

- Tab switches emit tab identity from the persisted page ID and name.
- Sidebar links emit link identity from the persisted sidebar item.
- Next-step buttons emit button identity from the persisted sidebar item.
- Destination URLs in tracking attributes omit credentials, query strings, and fragments.
- Preview does not initialize tracking.

## Performance

- One editor is mounted for one active page.
- The public payload currently includes all bounded page documents so tab switching is immediate.
- Public pages ship static HTML/CSS plus the navigation runtime, not editor code.
- Schema limits bound total pages, nodes, strings, links, and buttons.

If page payload size materially grows in production telemetry, route-level page delivery can be added behind the same canonical schema. It is not needed while the current bounded document remains cheaper and simpler.

## Failure rules

- At least one page must exist.
- Unknown Tiptap nodes or marks fail validation.
- Invalid destinations are omitted from public output and should be surfaced in editor controls.
- Blank section labels fall back through editor behavior before persistence.
- Publishing uses an immutable version; later draft edits do not change the live site.
- Invalid public payloads fail closed to the generic unavailable page.

## Acceptance criteria

- Editing, leaving, and reopening a page restores the same Tiptap JSON.
- Preview and direct published output use the same renderer and stylesheet.
- One visible page with no sidebar items has no public sidebar.
- Two visible pages render tracked tabs and switch without navigation.
- Hidden pages and items never render publicly.
- Editor-only controls never appear in Preview or published HTML.
- Legacy block payloads cannot be saved through web, API, contracts, DB typing, or MCP.
