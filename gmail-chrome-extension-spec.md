# Lightsite for Gmail — Product and Engineering Specification

Status: implementation baseline  
Owner: Lightsite  
Surface: Chrome extension, Gmail compose

## 1. Product outcome

Lightsite for Gmail lets a seller create or reuse a personalized Lightsite without leaving the email they are writing. The extension should make the common path—recipient detected, site selected, link created, rich card inserted—possible in seconds while preserving the full recipient and variable model already used by the Lightsite app.

The extension is a client of the existing Lightsite site and variant APIs. It must not introduce a Gmail-only recipient model, duplicate site content, or fork the visual system.

## 2. Success criteria

- A Lightsite action appears in every Gmail compose toolbar, including multiple simultaneous compose windows and pop-out compose windows.
- The action never obscures Gmail controls, steals compose keystrokes, or changes Gmail styling.
- The current primary `To` recipient is detected automatically. Name and website/domain are suggested without overwriting user-entered values; company remains blank for the seller to enter.
- A seller can search active sites by name, choose a site, create a recipient or reuse an existing recipient, complete all variables used by that site, and insert content into the correct compose body.
- The completion screen supports Preview, Insert link, and Insert email card.
- Sign-in works without relying on third-party cookies. The session survives browser restarts and can be revoked by signing out.
- Network, auth, permission, unpublished-site, stale-compose, and Gmail-DOM failures produce clear recovery actions and never lose the seller's draft values.
- The extension uses the same Lightsite tokens, fonts, shadcn primitives, field conventions, icons, and recipient terminology as the web app.

## 3. Primary user flow

### 3.1 Entry

1. The seller opens or replies from a Gmail compose.
2. A compact Lightsite icon button appears beside Gmail's compose actions with tooltip `Share a Lightsite`.
3. Selecting it opens a 384px-wide panel anchored above the compose toolbar. The panel is rendered in an extension-owned iframe so Gmail CSS and Lightsite CSS cannot affect one another.
4. The panel receives a short-lived compose context containing the compose instance identifier and the current primary recipient. It never receives the email body.

### 3.2 Authentication

- Signed in: load the active workspace and sites immediately.
- Signed out: show one `Continue with Lightsite` action. It opens the normal Lightsite web app through `chrome.identity.launchWebAuthFlow` and reuses the user's existing first-party Lightsite session.
- If the web session is absent, Lightsite shows its normal sign-in page and returns to the extension connection automatically after authentication.
- The handoff uses a 90-second encrypted authorization code bound to a background-generated PKCE verifier. The bearer session token is returned only from the code exchange and never appears in a URL.
- The token is stored only in `chrome.storage.local`, sent only to the configured Lightsite API origin, and removed on sign-out or an unrecoverable 401.
- The extension never reads browser cookies, Gmail messages, contacts, or Google account tokens.
- Google/Apple sign-in can be added to the Lightsite web app independently; the extension inherits any web-app sign-in method without adding provider-specific logic.

### 3.3 Choose site

- Search is focused on open and filters locally as the user types.
- Results show site name, publish state, last update, and recipient count.
- Published sites are selectable. Draft and archived sites explain why they cannot be sent and offer `Open in Lightsite` where applicable.
- The most recently used sites are ordered first using a versioned local preference; remaining sites use updated time.
- Empty states distinguish no sites, no published sites, and no search results.

### 3.4 Choose or create recipient

After selecting a site, the seller sees two tabs consistent with the app share modal:

- `New recipient`
- `Past recipients`

New recipient behavior:

- `Name` and `Website` are prefilled once from compose context using best-effort inference. `Company` remains blank because an email domain is not reliable company data.
- A Gmail contact display name is preferred when available.
- Website is inferred from the recipient email domain unless it is a common personal-mail domain.
- Company label is derived from the registrable-looking domain label and title-cased; the field remains editable.
- Custom site variables are read from the site's canonical draft document. Built-in identity variables are mapped to the recipient fields and are not duplicated.
- Required identity values are validated before creation. Optional variable values use the site definition's default as placeholder/fallback.
- `Create link` creates the canonical site variant through the existing API and advances to completion without closing the panel.

Past recipient behavior:

- Search filters name, company, website, and link slug.
- Recipients show a logo when a website is available and an initial fallback otherwise.
- Selecting an existing recipient goes directly to completion; an `Edit details` affordance exposes identity and variable fields before insertion.
- Matching uses exact normalized recipient email only when Lightsite eventually stores email. V1 must not pretend an email match exists because the current recipient model intentionally does not store email.

### 3.5 Complete and insert

The completion state shows recipient identity, site name, public URL, and a compact email-card preview.

Actions:

- `Insert email card` is the primary action. It inserts a conservative table-based HTML card linked to the recipient URL, followed by a blank line so typing can continue.
- `Insert link` inserts a descriptive linked phrase, not a raw URL, with a plain-text fallback.
- `Preview` opens the personalized public URL in a new tab without closing the panel.
- `Copy link` is available as a secondary recovery action.
- Successful insertion closes the panel and briefly shows a Gmail-adjacent confirmation. Reopening returns to site selection, with the last site promoted.

Insertion targets the compose instance that opened the panel. If that compose was closed, the panel states `This email draft is no longer open` and offers Close; it must never insert into another draft.

## 4. Sales-focused enhancements included

- Fast keyboard path: search on open, arrows to move, Enter to select/create, Escape to step back then close.
- Recent-site ranking stored locally per workspace.
- Existing-recipient reuse to avoid duplicate tracking links.
- Reply/forward support and multiple-compose correctness.
- Recipient-change awareness: if the `To` recipient changes before creation, the panel surfaces a non-destructive `Use updated recipient` suggestion rather than silently changing fields.
- Descriptive insertion copy generated from the selected site and recipient.
- One-click preview and copy fallbacks.

Deferred intentionally:

- CRM enrichment, contact databases, email-thread reading, send interception, automatic follow-up, and message tracking pixels.
- Gmail/Google OAuth permissions. The extension does not need Gmail API scopes for this workflow.
- Automatic insertion or send-time mutation. Every email change requires a direct user action.

## 5. Information architecture and visual direction

The extension is a focused tool panel, not a miniature dashboard. The signature interaction is a persistent three-step trail—Site, Recipient, Share—that doubles as back navigation and makes the fast path obvious without a generic wizard page.

Visual rules:

- Import the app's `index.css`, Geist font, semantic tokens, and shadcn primitives directly from the web source target.
- Use `bg-popover`, `text-popover-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, and other semantic tokens only.
- Use existing Button, Field, Input, Tabs, ScrollArea, Alert, Avatar, Empty, Skeleton, Separator, and Spinner components.
- Product icons come from `@tabler/icons-react` and button icons use `data-icon`.
- Panel corners, control heights, type scale, and focus rings match the recipient share dialog.
- No raw brand colors, independent theme file, one-off form markup, or Gmail-styled imitation controls.
- The panel respects light/dark system preference and reduced motion.

## 6. Technical architecture

### 6.1 Build target

The extension is a dedicated build target inside `apps/web` so it shares source components and tokens without copying them or creating a second component library.

Outputs:

- Manifest V3 `manifest.json`
- Gmail content script (isolated world, no remote code)
- Background service worker (API/auth broker and token owner)
- Extension panel HTML/React bundle
- Static Lightsite icons

### 6.2 Content script responsibilities

- Observe Gmail for compose roots and toolbar changes using one debounced `MutationObserver`.
- Add exactly one Lightsite button per compose root and clean orphaned state when compose roots disappear.
- Extract only recipient email/display name and compose metadata needed for targeting.
- Mount/unmount the iframe panel.
- Validate `postMessage` source and extension origin.
- Insert sanitized, extension-generated HTML into the correct contenteditable compose body while preserving selection and emitting `input` so Gmail records the draft change.
- Never call the Lightsite API or hold auth tokens.

### 6.3 Panel responsibilities

- Own presentation and transient form state.
- Communicate with the content script through typed messages.
- Communicate with the background worker through typed `chrome.runtime` messages.
- Fetch bootstrap, sites, site content, and variants only through the background worker.
- Never access Gmail DOM directly.

### 6.4 Background responsibilities

- Own the Better Auth bearer token and configured API/web origins.
- Attach Authorization only for allowlisted Lightsite origins.
- Provide typed API request, web-app connection, sign-out, open-tab, and session-state operations.
- Deduplicate concurrent bootstrap/site requests and apply bounded retries only to safe GET requests.
- Translate server failures into stable extension error codes.

### 6.5 Existing API mapping

- `GET /api/me`: user and active workspace.
- `GET /api/sites`: searchable site list.
- `GET /api/sites/:siteId/content`: canonical variable definitions.
- `GET /api/sites/:siteId/variants`: past recipients.
- `POST /api/sites/:siteId/variants/batch`: create/update recipient.
- `DELETE /api/sites/:siteId/variants/:variantId`: not exposed in the extension V1 completion flow.

Site URI remains `{workspaceSlug}/{siteSlug}`. Recipient URL remains `https://lightsite.io/{workspaceSlug}/{siteSlug}/{variantSlug}`.

## 7. Typed contracts

All page/background/content messages use a discriminated `type` and a protocol version. Unknown versions or operations fail closed.

Compose context:

```ts
type ComposeContext = {
  composeId: string
  recipient: { email: string; name: string } | null
}
```

Insertion request:

```ts
type InsertRequest = {
  composeId: string
  format: "link" | "card"
  html: string
  text: string
}
```

Only extension-generated insertion payloads are accepted. Arbitrary HTML from the API is never injected into Gmail.

## 8. Reliability and failure behavior

- Gmail DOM adapter selectors are centralized, documented, and covered by fixture tests. A fallback toolbar placement keeps the action usable when Gmail changes a minor role/class structure.
- The observer is idempotent. Duplicate compose scans cannot create duplicate buttons or panels.
- Every async state is cancel-safe when the panel closes or the selected site changes.
- 401: clear token, show reconnect, preserve non-secret draft values in memory.
- 403: show the server permission/plan message and a Lightsite deep link.
- 404 site/variant: return to the prior list with `This item is no longer available`.
- Offline/network: retain form state, show Retry, and never create twice after an ambiguous write. Creation uses a client-generated stable variant ID.
- Unpublished site: selectable actions remain disabled with a direct explanation.
- Missing recipient: let the seller type identity values manually.
- Multiple `To` recipients: use the first recipient and show which one is being personalized; switching is supported when more than one structured recipient is available.

## 9. Security and privacy

- Minimum permissions: `identity` for the first-party auth handoff, `storage` for the bearer session, plus host access for Gmail and configured Lightsite origins. No `cookies`, `scripting`, Gmail API, history, or broad web access unless a future feature proves it is required.
- Content Security Policy allows only extension scripts/assets and Lightsite API/image origins required by the panel.
- The bearer token is never sent through `postMessage`, logged, rendered, or placed in page storage.
- Passwords and provider credentials never enter the extension. Authentication happens only in the first-party Lightsite web app.
- Gmail message body, subject, thread history, and attachments are not read or transmitted.
- Recipient context is sent to Lightsite only when the seller creates/updates a recipient.
- Generated HTML escapes every recipient/site-derived string and uses an allowlisted template.

## 10. Accessibility

- Toolbar button has an accessible name and visible tooltip.
- Panel uses a labelled dialog surface, focus lands in search/first field, focus is trapped while open, and the Gmail trigger regains focus on close.
- All fields use Field/FieldLabel/FieldError with `aria-invalid`.
- Tabs and search results support arrows, Enter, Home/End, and Escape.
- Status changes use a polite live region; destructive or blocking errors use Alert.
- Targets are at least 32px; contrast and focus use existing tested tokens.

## 11. Test plan and acceptance gates

### Unit

- Recipient extraction and public-domain inference.
- Site/recipient filtering and recent ranking.
- Variable definition mapping and default resolution.
- Public URL, descriptive link, and email-card escaping.
- Typed message parsing and error mapping.
- Compose registry idempotence and stale-compose protection using DOM fixtures.

### Integration

- The PKCE-bound web handoff returns a Better Auth bearer token that is accepted by `/api/me` and site routes.
- CORS accepts configured `chrome-extension://` origins only.
- Create recipient round trip returns the exact canonical variant.
- Build output contains every manifest entry, no remote code, and no source map in release mode.

### Manual Chrome/Gmail

- Load unpacked extension from the documented build directory.
- New compose, reply, forward, pop-out, and two simultaneous compose windows.
- Recipient absent, contact name present, corporate domain, personal domain, and recipient changed while panel is open.
- Sign in, restart Chrome, sign out, expired session, API offline, and recovery.
- Search with keyboard; create recipient with variables; reuse past recipient.
- Preview opens exact personalized URL.
- Insert link and card into the correct body; continue typing; close/reopen draft; send a test email to the user's own account and verify the received rendering/link.
- Light and dark Gmail themes, 100% and 125% zoom, narrow compose, reduced motion.

Release is blocked by any uncaught console error, duplicate button, wrong-compose insertion, broken recipient URL, missing keyboard path, leaked token, or build/type/test failure.

## 12. Developer and release workflow

- `pnpm --filter @lightsite/web build:extension` produces `apps/web/dist-extension`.
- `pnpm --filter @lightsite/web test:extension` runs focused extension tests.
- Local builds target `http://localhost:3011` and `http://localhost:5173`; production builds require explicit API, web, and public-site origins.
- `apps/web/dist-extension` is the Chrome `Load unpacked` directory and is never hand-edited.
- Store assets, privacy disclosure, permission rationale, versioning, signing, and staged rollout must be completed before public Chrome Web Store distribution.

## 13. Definition of done

Done means the extension build is reproducible, focused tests and workspace typechecks pass, the real Gmail flows above are exercised in Chrome, and the setup/security/release documentation matches the implementation. A locally working dev bypass alone is not production authentication, and a copied embed whose image endpoint does not exist is not a working email embed.
