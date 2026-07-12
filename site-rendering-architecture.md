# Canonical Site Rendering Architecture

Status: implemented and verified in code. This document is the source of truth for editor Preview, publishing, public delivery, and element tracking.

## 1. Goals and invariants

1. A page has one content representation: canonical Tiptap JSON.
2. The app, Edit mode, Editor Preview, published HTML, and unavailable-page HTML consume the same generated semantic-token CSS. Edit, Preview, and published HTML also consume the same canonical site stylesheet.
3. Publishing stores an immutable copy of the canonical site document. It does not flatten, translate, or reconstruct blocks.
4. Unsupported nodes and marks fail validation before persistence or publishing.
5. Legacy `chrome`, root `blocks`, page `blocks`, and public block payloads are dead. They are never migrated into the canonical format.
6. Tracking metadata is emitted by the canonical renderer, beside the element it identifies.
7. Public HTML is server-rendered, useful without JavaScript, and enhanced by a small external runtime for tab/mobile navigation.

## 2. Why this is Tiptap-native

Tiptap recommends persisting JSON and provides `@tiptap/static-renderer` for rendering that JSON without an editor instance. Tiptap node views are editor UI and are intentionally separate from static HTML output.

References:

- [Static Renderer](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [Persistence](https://tiptap.dev/docs/editor/core-concepts/persistence)
- [Node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views)

The architecture therefore uses:

- Tiptap/ProseMirror state, transactions, commands, selections, and node views while editing.
- Tiptap JSON as the persisted page document.
- Shared pure Tiptap extensions for schema, attributes, defaults, parsing, and base HTML.
- Thin React NodeView extensions that add editor interaction without redefining the schema.
- Tiptap ProseMirror Static Renderer for Preview and published HTML, with narrow adapters for variables, security, tracking, logos, and recipient context.
- One exported site stylesheet for Edit, Preview, and published rendering.

It does not run a read-only editor on public pages. That would ship editing machinery, React node views, and editor state to recipients without improving fidelity.

## 3. Canonical data model

`@lightsite/design-tokens` owns semantic light/dark/system values, the Geist font face, and the public-site mobile breakpoint. It emits `LIGHTSITE_THEME_CSS`; no consumer restates token values.

`@lightsite/site-document` owns the Tiptap extensions, schema, types, defaults, normalization, sidebar model, icon catalog, metadata extraction, rendering, and canonical recipient stylesheet.

`SiteContent` schema version 3 contains:

- `themeMode`: `light`, `dark`, or `system`.
- `settings`: publish-safe site settings. Search indexing remains disabled until a deliberate indexing product decision is made.
- `variables`: typed variable definitions and defaults.
- `pages`: ordered visible/hidden pages. Each page owns one Tiptap `document` with a `doc` root.
- `sidebar`: ordered visible/hidden links, next-step buttons, and section labels.

The schema has bounded strings, collections, nesting, marks, and total node count. Node and mark names are allowlisted, unknown attributes are rejected, and ProseMirror validates node content expressions before persistence. Unknown or structurally invalid extensions are rejected rather than silently omitted.

The public payload schema version is independent from the site-document schema. It combines the immutable content snapshot with workspace/site metadata, an optional recipient variant, and signed tracking bootstrap data.

## 4. Ownership boundaries

### Editor

`apps/web/src/features/editor/editor-page.tsx` loads and saves canonical `SiteContent` directly. Page switching changes the active Tiptap document; it does not create a parallel page-builder model.

Editor mode uses React node views for editing controls and injects `SITE_DOCUMENT_CSS` from `@lightsite/site-document`. Preview mode renders `renderPublicSitePreviewHtml(...)` in a sandboxed iframe. Editor-only selection, drag, upload, and menu affordances remain in the web app stylesheet; typography, colors, spacing, cards, media, tables, and other recipient-visible presentation belong only to the canonical stylesheet.

### Shared renderer

`packages/site-document/src/tiptap/site-extensions.ts` owns pure Tiptap schema and HTML definitions. `packages/site-document/src/renderer.ts` renders through that extension schema with `@tiptap/static-renderer/pm` and overrides only context-dependent output. `packages/site-document/src/styles.ts` owns canonical recipient-visible CSS. Together they own:

- variable resolution;
- safe links, image URLs, colors, dimensions, and embeds;
- canonical metadata and URLs;
- sidebar and page markup;
- the shared sidebar visibility/order model and breakpoint;
- the generated Tabler icon registry and semantic icon colors;
- title-logo source resolution and fallback behavior;
- tracking attributes;
- the single Edit/Preview/published stylesheet;
- the small tab/mobile-navigation runtime.

### Publishing and API

Publishing snapshots canonical `SiteContent` without transformation. The public repository returns that immutable content and metadata. The API HTML route validates the public payload and calls the shared renderer.

The API serves the versioned site runtime, `/fonts/*`, and shared public assets before the public-site fallback. It also serves title logos through `/api/public/site-logo/:workspaceSlug/:siteSlug/:kind`. That endpoint resolves the published site (and optional recipient variant) before looking up a workspace or recipient domain, so it cannot be used as an arbitrary-domain logo proxy. The public worker reserves and caches asset paths. Runtime bytes must never change behind an existing immutable versioned URL; behavior changes require a new path such as the current `/site-runtime.v3.js`.

### Web public fallback

The Vite web app's public-site route uses the same shared renderer in `srcDoc`. It is a development/application fallback, not a second compiler.

### Agent/MCP

The MCP surface imports the canonical schema. Capabilities expose schema version 3, Tiptap node/mark allowlists, and a valid Tiptap document example. Agents cannot submit the dead block schema through MCP.

## 5. Render flow

### Preview

1. Read current editor state as canonical `SiteContent`.
2. Add draft-only metadata and optional preview variable values.
3. Call `renderPublicSiteHtml` with tracking disabled and the shared runtime embedded.
4. Display the result in an isolated iframe.

Draft title logos use the authenticated same-origin logo-preview endpoint. Logo URLs and derived domains remain render context; they are not duplicated into Tiptap attrs.

### Publish

1. Validate canonical `SiteContent`.
2. Check optimistic `draftRevision` where supplied.
3. Save an immutable publish version.
4. Resolve workspace, site, recipient, and tracking context.
5. Validate the public payload.
6. Call the same `renderPublicSiteHtml` with tracking enabled. Direct public documents load the runtime from its immutable external asset; application-hosted `srcDoc` documents embed the same runtime bytes.

Published title logos use the public-site-bound logo endpoint. Workspace domains come from published workspace context; recipient domains come from the same resolved variable values used by the document. A missing workspace logo falls back to the Lightsite mark, while a missing recipient logo is omitted.

No step converts Tiptap content to an intermediate block model.

## 6. Tracking contract

The renderer emits stable attributes on user-action elements:

- `data-ls-track`: `button`, `link`, or `tab`.
- `data-ls-element-id`: persisted node/sidebar ID when present, otherwise a deterministic fallback.
- `data-ls-element-kind`: semantic source such as `button`, `image_card`, `sidebar_link`, `sidebar_button`, or `tab`.
- `data-ls-element-label`: visible user-facing label.
- `data-ls-element-href`: sanitized URL with credentials, query, and fragment removed.

Tracked surfaces include Tiptap links, button blocks, image-card CTAs, sidebar links/buttons, and tab switches. The tracking script is loaded only when a signed tracking bootstrap is present and tracking is enabled. Preview never starts a tracking session.

Cross-origin iframe internals are not observable from the parent page. The embed container has stable identity, but clicks inside third-party calendar/video frames require provider cooperation or a deliberate overlay interaction and are not fabricated as events.

## 7. Security and privacy

- All text and attributes are escaped by the Static Renderer utilities.
- Links allow only HTTP(S), `mailto`, `tel`, relative paths, and fragments.
- Images allow HTTP(S), same-origin paths, and bounded schema-approved image data. Persisted media should use public asset URLs; base64 is not the long-term media model.
- Embeds require HTTPS, use strict referrer policy, and run in a sandbox.
- Public CSP denies everything by default, allows only same-origin scripts/connections/fonts, HTTPS frames, and approved image sources.
- Public logo delivery never exposes the logo provider token and never accepts a caller-supplied domain; it derives domains only after resolving a valid published site path.
- Direct public pages load the navigation runtime as an external immutable asset, so their CSP needs no inline-script exemption. Sandboxed application `srcDoc` pages embed the same controlled runtime because relative asset URLs resolve against the application host.
- Tracking hrefs omit query strings and fragments to avoid collecting recipient tokens or sensitive parameters.

## 8. Performance and cost model

- Public pages receive static HTML and CSS, not React, ProseMirror, or node-view bundles.
- The only site runtime handles tab switching and the mobile drawer.
- The mobile drawer uses a translated fixed panel and backdrop rather than mounting a second navigation tree. It locks body scrolling while open and closes through its ghost X control, backdrop clicks, Escape, or page selection.
- Images use native lazy loading and async decoding.
- The variable font, generated icon paths, and runtime are immutable cacheable assets. Published pages do not load an icon library.
- Public HTML keeps bounded cache and stale-while-revalidate behavior.
- Published logo responses are CDN-cacheable for one day with a one-week stale-while-revalidate window, bounding repeat provider requests without making logos permanently immutable.
- Schema limits cap pages, sidebar items, nodes, nesting, marks, and string size before data reaches rendering or storage.
- Publish versions are immutable, making cache invalidation and rollback deterministic.

Media uploads must graduate to an asset service/object store that returns immutable public URLs. Storing large base64 files in site JSON would inflate API bodies, Postgres rows, versions, cache payloads, and tracking snapshots, so it is not an accepted production architecture.

## 9. Failure behavior

- Invalid draft writes return structured validation issues.
- Unknown Tiptap nodes/marks are rejected before persistence.
- Invalid public payloads fail closed and render the generic unavailable page.
- Public repository failures return a no-store 503 unavailable page.
- Missing or hidden pages never create broken tab targets.
- Missing workspace logos fall back to the Lightsite logo; missing recipient logos remove only their own tile and leave title layout intact.
- Empty visible content renders a deterministic empty state.
- JavaScript failure leaves the initial page and all static content readable.

## 10. Versioning and extension process

To add a Tiptap extension:

1. Define its pure schema, attrs, parse rules, and base HTML in `packages/site-document/src/tiptap/site-extensions.ts`.
2. Extend that node in `features/editor/tiptap` only when it needs a React NodeView or editor-only behavior.
3. Add its name to the canonical allowlist and unique-ID list when applicable.
4. Add only context-dependent Static Renderer behavior such as sanitization, variables, logos, or tracking.
5. Add canonical CSS and schema/render/security/tracking tests as applicable.
6. Verify Edit, Editor Preview, and the direct published URL at desktop and mobile sizes.
7. Increment the site-document schema only for a persisted contract change, and write an explicit migration if old persisted data must be retained.

Do not add an adapter that flattens the node into a generic block. Do not persist rendered HTML as the source of truth. Do not make React attrs own editable text.

Do not add token values or recipient-visible site styles to `apps/web/src/index.css`. That file may contain Tailwind token aliases, editor chrome, and editing affordances only. Token values go in `@lightsite/design-tokens`; site presentation goes in `packages/site-document/src/styles.ts`; icon choices go in `packages/site-document/src/site-icons.ts` and regenerate through `pnpm --filter @lightsite/site-document generate:icons`.

## 11. Verification gates

Every renderer or schema change must pass:

- canonical schema and static-renderer unit tests;
- API public HTML, CSP, asset, and unavailable-page tests;
- web Preview/public renderer tests;
- public-worker route/cache tests;
- MCP typecheck and smoke workflow;
- monorepo typecheck, build, and test;
- public bundle boundary checks;
- live desktop/mobile Preview and published-route checks;
- tracking smoke when tracking markup or bootstrap changes.

The strongest parity assertions are structural: all three surfaces consume the same stylesheet bytes, and Preview and publish call the same render function. Screenshot checks guard layout regressions, but they are not the mechanism used to maintain parallel implementations.
