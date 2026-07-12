# Lightsite Tracking Implementation Spec

Last reviewed: 2026-07-11

This spec is the clean target architecture for Lightsite tracking. It is intentionally written from the desired product model instead of from the current implementation. Existing tracking code is disposable: do not preserve old endpoints, event names, tables, or payload shapes for compatibility. This document is the implementation source of truth for the next tracking build.

## Current Implementation Status

Phase 1 is complete: v2 contracts, tracking settings/session/event/suppression/internal-IP tables, migration, feature flags, and suppression services exist.

Phase 2 public runtime foundation is complete: public v2 ingestion is feature-flagged behind `TRACKING_V2_ENABLED`, context tokens are encrypted and opaque, public HTML gets a `trackingV2` bootstrap when v2 is enabled, server-rendered public pages prefer the v2 script, current button surfaces, sidebar links, sidebar buttons, and sidebar tabs render canonical `data-ls-track` attributes, the v2 browser script starts sessions, records site visits/button clicks/link clicks/tab switches, sends heartbeats, and ends sessions on pagehide. Event upload tokens are session-scoped hashes at rest. The API also runs an immediate and 30-second bounded stale-session sweep, rejects browser signals outside the two-minute freshness window, and marks abandoned sessions `expired` at their last trusted `last_seen_at` timestamp.

Phase 3 Slack share detection is complete: public v2 pages emit unique v2 OG/Twitter image URLs, the OG image route decodes the encrypted context token from a single path segment, classifies Slackbot image fetches, records sessionless deduped `slack_share` server events, and always serves an OG image best-effort so unfurls are not broken by tracking failures.

Phase 4 recording is complete for application code: v2 issues recording upload tokens only after accepted, unsuppressed `events_and_recording` sessions; recording manifest/chunk/usage tables exist; chunks are stored outside Postgres through the recording object-store abstraction; filesystem storage is available for local/dev verification; public chunk and completion endpoints are bearer-token scoped; authenticated workspace recording manifest/chunk read routes exist; the core `/track/2026-07-11.v7/script.js` runtime lazy-loads the recorder and pinned `@rrweb/record` module only for accepted recording sessions; strict schema-v3 chunks contain rrweb snapshots and incremental events; inputs and opted-out DOM are masked or blocked before emission; URL-bearing data is sanitized before upload; bounded chunks are uploaded by an ordered retry queue; pagehide duplicates remain idempotent; completion settles only after contiguous chunks arrive; replay duration is derived from accepted event timestamps; and terminal uploads cannot reopen a recording.

Phase 5 authenticated v2 reads are complete: workspace-scoped v2 event and session query schemas exist; `GET /api/workspaces/:workspaceId/tracking/v2/events`, `GET /sessions`, and `GET /sessions/:sessionId` return bounded cursor-paginated raw reads with site, recipient, session, device, location, element, tab, webhook, recording-status, and timestamp fields; read routes use the same active-workspace/agent/dev-auth boundary as existing workspace reads; DB queries use timestamp-plus-id cursors instead of offsets; and the tracking smoke script has a v2 live branch that starts a real session, ingests events, ends the session, and reads events/sessions back through the authenticated v2 routes.

Phase 6 retention cleanup is complete as runnable code: the v2 retention service and `pnpm --filter @lightsite/api tracking:retention` command redundantly expire abandoned active sessions before pruning raw IP addresses, expired suppression markers, expired events, old sessions, expired recording chunk objects, chunk metadata, and empty expired recording manifests in bounded batches. Recording cleanup deletes object-store chunks before deleting chunk metadata without losing non-recording session analytics. A live Postgres/filesystem smoke verifies the real cleanup path.

Phase 8 dashboard first slice is complete: the workspace tracking page reads from v2 event/session APIs, filters by site/recipient/type/source/date, searches the loaded event slice client-side, and renders bounded recent metrics, activity feed rows, recent sessions, top clicked elements, and recipient activity without using legacy summary/event contracts. Event rows and recent sessions open a dedicated session sheet with lifecycle metrics, precise active and elapsed durations, recipient/device/location/IP context, a bounded session event timeline, and a lazily loaded `@rrweb/replay` player with responsive viewport reconstruction, cursor/click playback, seeking, restart, pause, idle skipping, and retryable chunk delivery.

Phase 9 v1 cleanup is complete: legacy public tracking scripts, ingest routes, signed context tokens, public HTML preview tracking, v1 read routers/services/repositories, legacy contracts, legacy dashboard/MCP endpoint usage, and old active DB schema exports were removed. The generated cleanup migration drops `analytics_events`, legacy `tracking_sessions`, legacy `tracking_events`, and their old enums. `smoke:tracking` is v2-only and verifies legacy endpoint removal under live localhost conditions.

Phase 10 site tracking controls are complete: authenticated site-level v2 settings routes expose workspace defaults, site overrides, effective settings, and recording disclosure text; updates require workspace admin role; recording cannot be enabled without explicit disclosure acknowledgement or configured recording storage; the site detail page includes a feature-owned tracking settings panel; and the live smoke exercises the settings read/update control plane before recording sessions.

Still pending for production launch: webhook-send emitters, production scheduling for the retention command, production object-store binding, and final product/legal recording copy and review. The rrweb recorder/player implementation itself is complete.

## Goals

Tracking should tell a sales team what happened on a recipient site without turning Lightsite into a generic surveillance or web analytics platform.

It must answer:

- Did this recipient open the site?
- Which site, recipient link, tab, and element were involved?
- What did they click?
- Did they switch tabs?
- Did Slack load the unique Open Graph image for this recipient link?
- Did Lightsite send a webhook because of this recipient/site activity?
- What device, OS, approximate location, and session did the activity belong to?
- Can the user replay the session later when recording is enabled?
- Can Lightsite omit internal workspace-user visits reliably enough that sales data stays clean?

## Non-Goals

- Do not track arbitrary clicks on the page body.
- Do not track keystrokes, text selection, clipboard contents, or form values.
- Do not create a global visitor identity across unrelated workspaces.
- Do not treat Slack/Open Graph loads as proof of a human visit.
- Do not make tracking infrastructure part of the public page availability path.
- Do not store recording payloads directly in Postgres.
- Do not extend the legacy `analytics_events` model as the long-term source of truth.
- Do not keep v1 tracking compatibility paths. Nothing has shipped, so replace instead of adapting.

## Naming And Current-Code Mapping

Product language should be recipient-first:

- **Recipient**: the prospect-specific share target.
- **Recipient link**: the public URL opened by the prospect.
- **Session**: one browser-tab lifetime on a resolved public site, with hidden/idle time excluded from active duration.
- **Event**: a meaningful action by, for, or about the recipient site.
- **Recording**: a session replay capture made of DOM snapshots and interaction events, not a video file.

The current codebase still uses `site_variants` for recipient-like links. For this rebuild, treat that as legacy scaffolding. The clean database target is `site_recipients`; tracking contracts should expose `recipientId` and `recipientRevision`. Refactor recipient persistence before or alongside tracking so new tracking code does not inherit variant terminology.

## High-Level Decisions

1. Use one canonical v2 tracking system. The required core is `tracking_recipient_sessions`, `tracking_recipient_events`, tracking settings, and suppression markers. Recording manifests and rollups are clean extensions, not separate analytics systems.
2. Store raw user-facing events append-only in Postgres.
3. Store session replay chunks in object storage, with only manifests and chunk metadata in Postgres.
4. Use a small core tracking script plus a separate lazy recording module.
5. Use `visibilitychange` as the primary final-flush signal, with `pagehide` as fallback.
6. Keep `sendBeacon` payloads under 64 KiB and use normal `fetch` for active recording chunk uploads.
7. Start recording only after the server accepts the session and confirms it is not suppressed.
8. Use Cloudflare request metadata for city, region, country, and timezone where available; fall back to null or a server-side GeoIP provider.
9. Store raw IP only with restricted retention. Store HMAC hashes for matching and dedupe.
10. Record Slack share detection from unique recipient OG image loads, but label it as a detected Slack preview/share signal because Slack caches and fetch behavior is probabilistic.
11. Keep public browser payloads opaque. The browser should send an encrypted opaque context token, not raw workspace, site, recipient, or published-version IDs.
12. Keep old v1 tracking tables/endpoints out of the active app surface.

## Complexity Control

Build the system in clean vertical slices, not as one giant analytics platform.

The first shippable slice should include:

- Clean recipient-backed public context.
- Session start and session lifecycle.
- Site visit, button click, link click, and tab switch events.
- Slack OG image detection.
- Workspace-user suppression.
- Authenticated event/session read APIs. Implemented for v2 raw event/session reads and the first dashboard surface.
- Indexed raw reads for the dashboard over bounded date ranges. Implemented for recent raw dashboard reads; add rollups only when measured volume requires them.
- Retention and raw IP pruning jobs. Implemented as a bounded v2 retention service/CLI; production scheduling remains pending.

Recording should stay disabled by default and ship only after:

- Product/legal disclosure is reviewed for launch. The technical acknowledgement guard and site-level control plane are implemented.
- Object storage is configured.
- Recording quotas and retention cleanup are working.
- Replay has passed masking and asset-retention tests.

Rollup tables should not be added just because they are in the target architecture. Start with indexed raw reads for bounded ranges. Add daily rollups when expected production volume or measured query latency requires them.

Webhook-send tracking should ship with the webhook delivery feature, not before it. The tracking model reserves the event type so webhook delivery can emit a clean user-facing event when that feature exists.

## Architecture

### Packages And Apps

`packages/tracking-schema`

- Versioned event schemas.
- Runtime constants.
- Public context token shape.
- Event type registry and typed metadata schemas.
- Shared sanitizer helpers for labels, URLs, device IDs, and IDs.

`packages/tracking-runtime`

- Source for browser scripts.
- Builds immutable assets:
  - `/track/2026-07-11.v7/script.js`
  - `/track/2026-07-11.v7/recorder.js`
  - `/track/2026-07-11.v7/rrweb-record.js`
- No imports from app shell, editor, dashboard, auth, or shadcn code.

`apps/api/src/tracking`

- Public ingestion routers.
- Context token verification.
- Session/event repository.
- Recording manifest/chunk metadata.
- Suppression marker service.
- Authenticated read APIs.
- Aggregation and retention jobs.

`apps/api/src/public-sites`

- Public route resolution.
- Signed tracking context generation.
- Stable tracking attributes in rendered HTML.
- Unique OG image URLs for recipient share detection.

`apps/public-worker`

- Same-origin proxy for public pages, tracking scripts, event ingestion, and recording chunk uploads.
- Pass Cloudflare geo headers to origin.
- Keep public HTML and script caching separate from tracking POST endpoints.
- Optionally record OG-image preview events at the edge with `ctx.waitUntil`.

`apps/web/src/features/tracking`

- Tracking dashboard.
- Session list and detail.
- Recording player.
- Event feed and summary UI.

## Tracking Configuration

Effective tracking mode is resolved server-side at public render and session start. Do not let the browser opt into more tracking than the server selected.

Recommended settings:

```sql
tracking_settings (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid null references sites(id) on delete cascade,
  recipient_id uuid null references site_variants(id) on delete cascade,
  scope tracking_setting_scope not null,
  enabled boolean not null default true,
  capture_ip_address boolean not null default true,
  raw_ip_retention_days integer not null default 30,
  event_retention_days integer not null default 365,
  recording_enabled boolean not null default false,
  recording_retention_days integer not null default 30,
  max_recording_duration_seconds integer not null default 600,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Indexes and constraints:

- Unique workspace default: `(workspace_id)` where `scope = 'workspace'`.
- Unique site override: `(site_id)` where `scope = 'site'`.
- Unique recipient override: `(recipient_id)` where `scope = 'recipient'`.
- Check scope integrity: workspace rows have no site/recipient, site rows have site only, recipient rows have both site and recipient.
- Check retention and duration values stay within product/legal maximums.

Resolution order:

1. Workspace status and plan.
2. Workspace default tracking settings.
3. Site override, if present.
4. Recipient override and eligibility, if present.
5. Runtime privacy signals and suppression.

Rules:

- Recording should be disabled by default until the app has product/legal disclosure and a user-facing control.
- Sampling is reserved for the recording phase and must be applied server-side during session start when added.
- `trackingMode` in the public bootstrap is the maximum possible mode; session start can still downgrade it to events-only or rejected.
- Retention settings cannot exceed product/legal maximums.

## Public Tracking Context

Public HTML includes one signed opaque tracking bootstrap. The client never chooses or sees workspace, site, recipient, or publish IDs for tracking. It only sends the opaque token back to the server.

```ts
type PublicTrackingBootstrapV2 = {
  version: 2
  trackingMode: "off" | "events" | "events_and_recording"
  contextToken: string
  issuedAt: string
  expiresAt: string
}
```

Server-side token payload:

```ts
type TrackingContextTokenPayloadV2 = {
  version: 2
  keyId: string
  workspaceId: string
  siteId: string
  publishedVersionId: string
  recipientId: string | null
  recipientRevision: number | null
  trackingMode: "off" | "events" | "events_and_recording"
  issuedAt: string
  expiresAt: string
}
```

Rules:

- Token must be opaque to the browser. Use either an encrypted compact token or a random server-side handle. An HMAC-signed base64 JSON token is not acceptable because the browser could decode workspace/site/recipient IDs.
- Token is authenticated with a rotating key or stored as a random handle with a server-side expiry.
- Public HTML exposes only `trackingMode`, `contextToken`, `issuedAt`, and `expiresAt`.
- Token TTL must be longer than the maximum public HTML cache lifetime plus stale serving window. Recommended V1 TTL: 24 hours only if public HTML and R2 stale snapshots are guaranteed to refresh well inside that window. If public HTML can be served longer, add a same-origin context refresh endpoint before accepting long-lived cached pages.
- Context token payload must not include recipient email, variable values, workspace slugs, site slugs, or recipient slugs.
- Context token validation failures return a generic tracking error and never reveal whether the workspace/site/recipient exists.
- Ingest validates both the token and current state: workspace active, site published, recipient active when present, published version still current, and tracking mode still enabled.

## Browser Runtime Flow

1. Public HTML renders content and trackable data attributes.
2. Core script loads with `defer`.
3. Core script reads the public tracking bootstrap and creates or reuses a random origin-scoped `deviceId` in `localStorage` or a first-party cookie where available.
4. Core script sends a session start request using normal `fetch` with a short timeout and the opaque `contextToken`.
5. Server verifies context, classifies suppression, creates or rejects the session, and returns:
   - `accepted: boolean`
   - `eventsAccepted: boolean`
   - `recordingAccepted: boolean`
   - `sessionId?: string`
   - `eventToken?: string`
   - effective runtime limits.
6. If accepted, core script sends `site_visit`.
7. If recording is accepted, core script lazy-loads `recorder.js` and starts replay capture.
8. Later event batches use `sendBeacon` when small enough, otherwise `fetch` with `keepalive` where suitable.
9. Recording chunks use normal `fetch` during active page lifetime. Final chunk uses `sendBeacon` only if it fits under the beacon budget.

Device ID rules:

- The browser may generate one random public `deviceId` per origin, but the server must never store it raw.
- The server stores only workspace-scoped HMAC hashes of device IDs.
- The browser should rotate public `deviceId` at least every 180 days, or sooner if local storage is cleared.
- The public `deviceId` must not be reused as a user ID, contact ID, or cross-workspace identity.

If the initial `session_start` request fails, the public page remains usable. The script may retry `session_start` lightly, but it must not start recording and should not send normal engagement events until the server accepts the session. This keeps suppression and bot checks ahead of user-visible analytics.

## Event Taxonomy

### User-Facing Event Types

These are the types users should recognize in the product:

```ts
type TrackingEventType =
  | "site_visit"
  | "button_click"
  | "link_click"
  | "tab_switch"
  | "slack_share"
  | "webhook_send"
```

The implementation may also use internal event/signal types for session accounting:

```ts
type TrackingInternalSignal =
  | "session_start"
  | "session_heartbeat"
  | "session_visibility"
  | "session_end"
  | "scroll_depth_reached"
  | "recording_started"
  | "recording_completed"
  | "recording_failed"
```

Internal signals should not clutter the default activity feed. They can power session details, duration, scroll depth, health, and debugging.

### Common Event Shape

```ts
type TrackingEventEnvelopeV2 = {
  schemaVersion: 2
  eventId: string
  batchId: string
  sessionId: string | null
  workspaceId: string
  siteId: string
  recipientId: string | null
  recipientRevision: number | null
  publishedVersionId: string
  type: TrackingEventType | TrackingInternalSignal
  source: "browser" | "edge_preview" | "server_webhook" | "system"
  classification: "human" | "bot" | "preview" | "system"
  occurredAtClient: string | null
  occurredAtServer: string
  receivedAt: string
  tab: TrackingTabSnapshot | null
  element: TrackingElementSnapshot | null
  data: Record<string, unknown>
}
```

Canonical ordering in dashboards should use `receivedAt` plus `id`, with client time shown only when it is sane and useful.

### Site Visit

Triggered when a resolved public page starts a valid session.

Data:

```ts
{
  type: "site_visit"
  data: {
    urlPath: string
    referrerHost: string | null
    viewport: { width: number; height: number }
    initialTabId: string | null
    initialTabLabel: string | null
  }
}
```

Rules:

- One `site_visit` per accepted browser session.
- Default-link visitors have `recipientId = null`.
- Known preview bots do not create human site visits.

### Button Click

Triggered by buttons in the page, header, sidebar, cards, calendar blocks, image cards, or future CTA-like elements.

Data:

```ts
{
  type: "button_click"
  element: {
    id: string
    kind: "button"
    label: string
    area: "page" | "header" | "sidebar"
    blockId: string | null
    nestedId: string | null
    href: string | null
  }
  data: {
    buttonRole: "primary" | "secondary" | "card" | "calendar" | "custom"
  }
}
```

Rules:

- Label is the resolved visible text at click time.
- URL is sanitized before storage: remove username, password, hash, and query unless allowlisted.
- Outbound navigation must not wait on analytics.

### Link Click

Triggered by sidebar links and future configured link elements.

Data:

```ts
{
  type: "link_click"
  element: {
    id: string
    kind: "link"
    label: string
    area: "sidebar" | "page" | "header"
    blockId: string | null
    nestedId: string | null
    href: string
  }
  data: {
    linkRole: "sidebar" | "resource" | "inline" | "custom"
  }
}
```

Rules:

- Sidebar links are first-class tracked elements.
- Page inline links can be added later only when rendered as configured public elements.
- Do not track arbitrary text links generated by rich text unless the editor explicitly models them as trackable elements.

### Tab Switch

Triggered when the public sidebar tab changes.

Data:

```ts
{
  type: "tab_switch"
  tab: {
    id: string
    label: string
    index: number
  }
  data: {
    previousTabId: string | null
    previousTabLabel: string | null
    trigger: "click" | "keyboard" | "programmatic"
  }
}
```

Rules:

- Initial tab is captured on `site_visit`, not as a tab switch.
- Tab IDs must come from published content, not DOM index alone.
- If future tabs are URL-addressable, include sanitized path/hash metadata.

### Slack Share Detected

Triggered when Slack requests the unique OG image URL generated for a recipient/site link.

Data:

```ts
{
  type: "slack_share"
  source: "edge_preview"
  classification: "preview"
  sessionId: null
  data: {
    platform: "slack"
    resource: "og_image"
    userAgentFamily: "slackbot-linkexpanding" | "slack-imgproxy" | "slackbot"
    confidence: "high" | "medium"
    ogImageTokenId: string
    dedupeBucket: string
  }
}
```

Rules:

- UI can label this "Slack share detected" or "Slack preview loaded", but should avoid implying exact human behavior.
- Deduplicate by workspace, site, recipient, published version, recipient revision, platform, resource, and a 30-minute bucket.
- Do not count this as a human visit.
- Slack may cache requests, so repeated posts of the same URL may not produce repeated events.

### Webhook Send

Triggered by server-side webhook delivery, not by browser claims.

Data:

```ts
{
  type: "webhook_send"
  source: "server_webhook"
  sessionId: string | null
  data: {
    webhookId: string
    webhookUrl: string
    deliveryId: string
    triggerEventId: string | null
    attempt: number
    status: "queued" | "sent" | "failed"
    responseStatus: number | null
    failureKind: string | null
  }
}
```

Rules:

- Store sanitized webhook URL. Remove credentials and query params by default.
- Attach session ID when webhook was triggered by a browser/session event.
- The canonical webhook delivery record should live in the future webhook delivery table. `tracking_events` mirrors user-facing visibility.
- Duplicate provider retry attempts should not create duplicate user-facing "sent" events unless the product intentionally shows attempts.

## Trackable Element Attributes

The public renderer should stamp stable attributes:

```html
<a
  data-ls-track="button"
  data-ls-element-id="block_abc"
  data-ls-element-area="page"
  data-ls-element-label="Book a call"
  data-ls-element-href="https://example.com/"
>
```

Required attributes:

- `data-ls-track`: `button`, `link`, or `tab`.
- `data-ls-element-id`: stable public ID from block, sidebar item, tab, or nested item.
- `data-ls-element-label`: resolved visible label.
- `data-ls-element-area`: `header`, `sidebar`, or `page`.

Optional attributes:

- `data-ls-block-id`
- `data-ls-nested-id`
- `data-ls-element-role`
- `data-ls-tab-id`
- `data-ls-tab-index`

Do not use raw DOM paths as primary identifiers. DOM paths can change across responsive layouts and republish.

## Session Model

### Table

```sql
tracking_sessions (
  id varchar(160) primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  recipient_id uuid null references site_recipients(id) on delete set null,
  recipient_revision integer null,
  published_version_id uuid not null references site_versions(id) on delete restrict,
  site_name_snapshot varchar(160) not null,
  recipient_name_snapshot varchar(160) null,
  recipient_company_snapshot varchar(160) null,
  state tracking_session_state not null default 'active',
  started_at timestamptz not null,
  first_received_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_active_at timestamptz null,
  hidden_at timestamptz null,
  ended_at timestamptz null,
  end_reason varchar(64) null,
  active_duration_ms integer not null default 0,
  visible_duration_ms integer not null default 0,
  idle_duration_ms integer not null default 0,
  max_scroll_depth integer null,
  initial_tab_id varchar(160) null,
  current_tab_id varchar(160) null,
  referrer_host varchar(253) null,
  ip_address inet null,
  ip_hash varchar(128) null,
  device_id_hash varchar(128) null,
  user_agent_hash varchar(128) null,
  browser_name varchar(80) null,
  browser_version varchar(40) null,
  os_name varchar(80) null,
  os_version varchar(40) null,
  device_type varchar(40) null,
  city varchar(120) null,
  region varchar(120) null,
  region_code varchar(32) null,
  country varchar(2) null,
  timezone varchar(80) null,
  is_bot boolean not null default false,
  bot_name varchar(80) null,
  is_suppressed boolean not null default false,
  suppressed_reason varchar(80) null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Recommended indexes:

- `(workspace_id, started_at desc)`
- `(workspace_id, site_id, started_at desc)`
- `(workspace_id, recipient_id, started_at desc)` where `recipient_id is not null`
- `(state, last_seen_at)` for expiration jobs
- `(workspace_id, device_id_hash)` where `device_id_hash is not null`
- `(workspace_id, ip_hash)` where `ip_hash is not null`

### Session State

```ts
type TrackingSessionState =
  | "active"
  | "paused"
  | "ended"
  | "expired"
  | "bot_filtered"
  | "suppressed"
  | "discarded"
```

Rules:

- `active`: visible or recently active.
- `paused`: page is hidden, but resume window has not expired.
- `ended`: explicit pagehide/session_end accepted.
- `expired`: no heartbeat/visibility signal before timeout.
- `suppressed`: matched a workspace-user marker and excluded from user analytics.
- `bot_filtered`: known bot session excluded from human analytics.

### Duration Rules

Track active visible time, not wall-clock time.

Recommended constants:

```ts
heartbeatIntervalMs = 15_000
maxHeartbeatCreditMs = 30_000
idleAfterMs = 120_000
initialReadGraceMs = 30_000
hiddenResumeWindowMs = 2 * 60_000
sessionExpirationMs = 2 * 60_000
sessionExpirationSweepMs = 30_000
maxSessionDurationMs = 60 * 60_000
```

Client rules:

- Count time only while `document.visibilityState === "visible"`.
- Count visible time as active during the initial grace window.
- After the grace window, continue active time only when there was recent user activity: scroll, pointer move sampled, click, keydown, touch, or tab switch.
- Pause active accumulation after `idleAfterMs` without activity.
- On hidden, flush a final heartbeat and mark hidden.
- On visible again within resume window, resume the same session.
- On visible after resume window, start a new session.

Server rules:

- Never trust a client-supplied total duration.
- Add duration from bounded heartbeat deltas only.
- Credit at most the 30-second activity window after initial load or the most recent pointer, key, click, or scroll signal; the two-minute idle threshold ends a session but does not count as two active minutes.
- Cap each heartbeat credit at `maxHeartbeatCreditMs`.
- Cap total active duration at `maxSessionDurationMs`.
- Reject event, heartbeat, and end requests when the stored `last_seen_at` is outside the server freshness window; a late browser request must not revive a stale session.
- Run a bounded expiration sweep immediately on API startup and every 30 seconds. Multiple API instances may run it because the terminal update rechecks both `state = active` and the stale cutoff.
- Set stale sessions to `state = expired` and `end_reason = server_expired`.
- If hidden and no resume happens, set `endedAt` to the last active or hidden timestamp, not to the later expiration-job time.

## Recording Model

### Approach

Use rrweb session replay: serialized DOM snapshots plus incremental events. Do not create video recordings or maintain a parallel custom replay format.

Reasons:

- Much smaller than video.
- Can replay clicks, scroll, DOM mutations, and mouse/touch paths.
- Can mask inputs and block sensitive areas before upload.
- Works with static public pages without screen capture permissions.

### Runtime

Core script dynamically imports `recorder.js` only when:

- `trackingMode === "events_and_recording"`.
- Server accepted the session.
- Server did not classify the session as suppressed or bot.
- Browser supports the minimum APIs.
- The session has not exceeded workspace/site recording quotas.

Recommended rrweb options:

```ts
record({
  emit(event, isCheckout) { bufferRecordingEvent(event, isCheckout) },
  maskAllInputs: true,
  maskInputOptions: { password: true, email: true, tel: true, text: true },
  blockClass: "rr-block",
  ignoreClass: "rr-ignore",
  maskTextClass: "rr-mask",
  blockSelector: "script,[data-ls-recording-block]",
  maskTextSelector: "[data-ls-recording-mask]",
  recordCanvas: false,
  collectFonts: false,
  inlineImages: false,
  recordCrossOriginIframes: false,
  checkoutEveryNms: 60_000,
  sampling: {
    mousemove: 100,
    scroll: 100,
    media: 800,
    input: "last"
  }
})
```

Rules:

- Public content is recordable by default, because it is exactly what the recipient sees.
- Inputs are masked even if the current public page has no forms.
- Public DOM attributes must not contain secrets. Recording can capture `href`, `src`, `srcset`, `style`, and text nodes from the rendered page.
- Before recording events leave the browser, sanitize URL-bearing attributes in snapshots and mutations: strip credentials, fragments, non-allowlisted query params, and signed asset tokens where the replay can still render acceptably.
- Public v2 OG image URLs are token-bearing path URLs; snapshot sanitization must replace those meta `content` URLs before upload, not merely strip query strings.
- Assets referenced by a recording must remain readable for at least the recording retention window. Retain published-version assets for the same period, or replay through a server endpoint that can return safe placeholders when an asset has expired.
- Cross-origin iframes are not recorded. Show iframe bounds/placeholders in replay.
- Canvas recording is disabled unless a future block explicitly needs it and passes a privacy/performance review.
- Recorder errors stop recording but do not stop event tracking or page rendering.

Recording privacy review checklist:

- No raw input values.
- No signed upload, auth, billing, or admin URLs in DOM snapshots.
- No app/editor/authenticated routes recorded.
- No third-party iframe internals recorded.
- No recording token persisted in replayable data.
- No recording for suppressed, bot, preview, or GPC/DNT-disabled sessions.

### Recording Limits

Recommended V1 limits:

```ts
maxRecordingDurationMs = 10 * 60_000
targetRecordingChunkBytes = 96 * 1024
maxRecordingChunkBytes = 512 * 1024
maxRecordingCompressedBytes = 5 * 1024 * 1024
maxRecordingEvents = 20_000
recordingRetentionDays = 30
```

Rules:

- Stop recording when any cap is reached.
- Continue normal event tracking after recording stops.
- Mark recording status as `truncated` when stopped by caps.
- Recordings should be plan-gated later, but the table design should support plan limits now.
- Compression must not block rendering or interaction. Prefer browser `CompressionStream` only when available and cheap; otherwise upload bounded JSON chunks and compress server-side before object storage.
- Recording acceptance and chunk uploads must update cheap daily usage counters instead of scanning chunk rows for quota checks.

### Storage

Recording chunks go to object storage, preferably Cloudflare R2 because the public worker already sits in front of public traffic and R2 has favorable egress economics.

Postgres stores:

- Recording manifest row.
- Chunk metadata.
- Object keys.
- Counts, byte sizes, checksums, status, and retention date.

Object storage stores:

- Compressed chunk payloads.
- Optional assembled manifest object.

Do not store rrweb event arrays in Postgres JSONB except tiny test fixtures.
Object keys must be server-generated from workspace ID, recording ID, and chunk sequence. Never accept client-provided object keys or prefixes.

### Tables

Recording status values:

```ts
type TrackingRecordingStatus =
  | "pending"
  | "recording"
  | "available"
  | "truncated"
  | "failed"
  | "expired"
  | "deleted"
```

Status transition rules:

- `pending` is created with the accepted session.
- `recording` begins when the first chunk is accepted, or when a completion request arrives before all expected chunks.
- `available` requires a completion request or session end plus all contiguous chunks through `finalSequence`.
- `truncated` is used when a cap stops recording before normal completion.
- `failed` is used for validation errors, quota exhaustion, or persistent upload failure.
- `expired` and `deleted` are retention states and must trigger object cleanup.
- Completion can arrive before the final keepalive chunk. Store `finalSequence`, `endedAt`, `durationMs`, and stop metadata while the recording remains `recording`; settle to `available`, `truncated`, or `failed` after chunk ingest sees a contiguous sequence from `0..finalSequence`.
- After a recording is terminal, duplicate completion requests and exact duplicate chunks remain idempotent, but new chunks or mismatched duplicate chunks are rejected without reopening the recording.

```sql
tracking_recordings (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  recipient_id uuid null references site_recipients(id) on delete set null,
  session_id varchar(160) not null references tracking_sessions(id) on delete cascade unique,
  status varchar(40) not null,
  rrweb_version varchar(40) not null,
  runtime_version varchar(80) not null,
  privacy_version integer not null default 1,
  upload_token_hash varchar(128) not null,
  max_duration_ms integer not null,
  max_chunk_bytes integer not null,
  max_events integer not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  duration_ms integer not null default 0,
  event_count integer not null default 0,
  chunk_count integer not null default 0,
  compressed_bytes integer not null default 0,
  object_prefix text not null,
  stop_reason varchar(80) null,
  final_sequence integer null,
  error_code varchar(80) null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

```sql
tracking_recording_chunks (
  id uuid primary key,
  recording_id uuid not null references tracking_recordings(id) on delete cascade,
  workspace_id uuid not null,
  session_id varchar(160) not null,
  sequence integer not null,
  object_key text not null,
  event_count integer not null,
  compressed_bytes integer not null,
  uncompressed_bytes integer null,
  checksum_sha256 varchar(128) not null,
  first_event_at timestamptz null,
  last_event_at timestamptz null,
  received_at timestamptz not null default now(),
  unique (recording_id, sequence)
)
```

Daily recording usage counters:

```sql
tracking_recording_usage_daily (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date date not null,
  recording_count integer not null default 0,
  compressed_bytes bigint not null default 0,
  primary key (workspace_id, date)
)
```

Usage-counter dates are UTC because they protect infrastructure cost rather than user-facing reporting periods.

### Recording APIs

Public upload:

```text
POST /api/public/tracking/v2/recordings/:recordingId/chunks
POST /api/public/tracking/v2/recordings/:recordingId/complete
```

Headers:

- `authorization: Bearer <recordingUploadToken>`
- `content-type: application/json` or `application/octet-stream`
- `content-encoding: gzip` when compressed

Body:

```ts
{
  schemaVersion: 3
  sequence: number
  sessionId: string
  events: Array<{
    type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
    timestamp: number
    data: unknown
  }>
  compressed: false
}
```

The current public runtime uploads bounded JSON. After validation, the server computes its own checksum and event bounds, stores gzip when it reduces bytes, and serves transparent JSON to authenticated playback. Checksum-addressed object keys prevent a conflicting concurrent upload from overwriting an accepted chunk. The client does not supply trusted timestamps, checksums, object keys, or byte counts.

Completion body:

```ts
{
  schemaVersion: 3
  sessionId: string
  finalSequence: number | null
  endedAt: string
  stopReason: "ended" | "hidden_timeout" | "duration_cap" | "size_cap" | "event_cap" | "error"
}
```

Recording upload rules:

- Upload token is scoped to one recording ID, session ID, workspace ID, and maximum sequence count.
- Upload token must be opaque or encrypted. Do not expose raw workspace/site/session IDs in a decodable token payload.
- Chunk upload is idempotent by `(recording_id, sequence)`.
- Replayed duplicate chunks must match byte count and checksum; mismatches are rejected and mark the recording suspicious.
- Chunks may arrive out of order, but playback only exposes contiguous validated chunks from sequence `0`.
- Completion is idempotent and may run before the final chunk is visible; the manifest should settle once all contiguous chunks arrive or the timeout expires.
- `finalSequence: null` means no chunk was accepted and settles the recording as failed rather than exposing an empty replay.
- Replay duration is the accepted last rrweb event timestamp minus the accepted first rrweb event timestamp, clamped to server limits. It is never stretched to a client-claimed or session wall-clock duration.
- Recording events and tracking events should share a session time origin so the player can highlight button/link/tab events on the replay timeline.

Authenticated playback:

```text
GET /api/workspaces/:workspaceId/tracking/sessions/:sessionId/recording
GET /api/workspaces/:workspaceId/tracking/recordings/:recordingId/chunks/:sequence
```

The API should enforce analytics permissions, then return a manifest and either signed chunk URLs or proxied chunk streams. The dashboard should use `@rrweb/replay` or `rrweb-player`, not the recording package. Direct object-store URLs, if used, must be short-lived and read-only. A proxied stream is simpler and safer for V1 unless object-store egress becomes a measured bottleneck.

Implemented v2 foundation routes:

```text
GET /api/workspaces/:workspaceId/tracking/v2/sessions/:sessionId/recording
GET /api/workspaces/:workspaceId/tracking/v2/recordings/:recordingId/chunks/:sequence
```

## Tracking Events Table

```sql
tracking_events (
  id uuid primary key,
  event_id varchar(160) not null,
  batch_id varchar(160) not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  recipient_id uuid null references site_recipients(id) on delete set null,
  recipient_revision integer null,
  published_version_id uuid not null references site_versions(id) on delete restrict,
  session_id varchar(160) null references tracking_sessions(id) on delete set null,
  type varchar(80) not null,
  source varchar(40) not null,
  classification varchar(40) not null,
  event_name varchar(160) not null,
  site_name_snapshot varchar(160) not null,
  recipient_name_snapshot varchar(160) null,
  recipient_company_snapshot varchar(160) null,
  tab_id varchar(160) null,
  tab_label varchar(180) null,
  element_id varchar(160) null,
  element_kind varchar(40) null,
  element_area varchar(40) null,
  element_label varchar(180) null,
  element_href text null,
  data jsonb not null default '{}',
  occurred_at_client timestamptz null,
  occurred_at_server timestamptz not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, event_id)
)
```

Recommended indexes:

- `(workspace_id, received_at desc, id desc)`
- `(workspace_id, site_id, received_at desc)`
- `(workspace_id, recipient_id, received_at desc)` where `recipient_id is not null`
- `(workspace_id, session_id, received_at asc)` where `session_id is not null`
- `(workspace_id, type, received_at desc)`
- `(workspace_id, classification, received_at desc)`
- Partial index for click analytics: `(workspace_id, site_id, element_id, received_at desc)` where `type in ('button_click', 'link_click')`

Rules:

- Raw events are append-only.
- `event_id` idempotently dedupes client retries.
- `data` must be validated by event type and bounded in size.
- Feed rows join sessions for device, OS, location, and IP display rather than duplicating those fields per event.

## Public Ingestion APIs

```text
POST /api/public/tracking/v2/sessions
POST /api/public/tracking/v2/events
POST /api/public/tracking/v2/sessions/heartbeat
POST /api/public/tracking/v2/sessions/end
```

### Session Start API

Payload:

```ts
{
  contextToken: string
  startedAt: string
  page: {
    path: string
    title?: string
    referrerHost?: string | null
  }
  viewport?: { width: number; height: number }
  device?: {
    deviceId?: string | null
    timezone?: string | null
    locale?: string | null
    userAgent?: string | null
  }
}
```

Accepted response:

```ts
{
  accepted: true
  eventsAccepted: true
  recordingAccepted: false
  sessionId: string
  eventToken: string
  scriptVersion: "2026-07-11.v7"
  heartbeatIntervalMs: 15000
  idleTimeoutMs: 120000
  maxSessionDurationMs: 3600000
  recording: {
    enabled: false
    maxDurationMs: 600000
    maxBytes: 5242880
  }
}
```

Rejected response:

```ts
{
  accepted: false
  eventsAccepted: false
  recordingAccepted: false
  reason: "disabled" | "suppressed"
  recording: {
    enabled: false
    maxDurationMs: 600000
  }
}
```

Rules:

- The session-start endpoint is the only public endpoint that can issue a recording upload token.
- The session-start endpoint is also the only public endpoint that can issue an event upload token.
- The response is intentionally coarse and must not reveal private workspace/site/recipient existence.
- If `globalPrivacyControl` or `doNotTrack` is true, deny recording by default. Event acceptance should follow product/legal policy, but it must never include session replay.
- Session start is intentionally server-generated in the current v2 runtime. Browser retries may create a second session until a browser runtime supplies a stable retry key; the browser should persist the first accepted `sessionId` and `eventToken` in tab-scoped memory.
- `eventToken` is opaque and scoped to one session, workspace, site, recipient, published version, and maximum session duration. It must not expose raw IDs to the browser.

### Event Batch API

Payload:

```ts
{
  batchId: string
  sessionId: string
  eventToken: string
  scriptVersion: "2026-07-11.v7"
  sentAt: string
  events: TrackingClientEventV2[]
}
```

Response:

- `204` for accepted beacon-style batches.
- `202` with a generic accepted body only when a non-beacon client explicitly requests acknowledgement for tests/debugging.

Validation:

- Max request body: 64 KiB for event batches.
- Max events per batch: 10.
- `eventId` dedupes retries idempotently.
- Browser event batches may contain only `site_visit`, `button_click`, `link_click`, and `tab_switch`.

### Heartbeat API

Payload:

```ts
{
  sessionId: string
  eventToken: string
  occurredAt: string
  activeMs: number
  maxScrollDepthPercent?: number
  page?: {
    path: string
    title?: string
    referrerHost?: string | null
  }
}
```

Response:

- `204` when accepted.

### Session End API

Payload:

```ts
{
  sessionId: string
  eventToken: string
  occurredAt: string
  reason: "pagehide" | "visibility_timeout" | "idle_timeout" | "max_duration" | "heartbeat_timeout" | "server_expired" | "unknown"
  activeMs?: number
}
```

Response:

- `204` when accepted.
- Max event ID length: 160.
- Max label length: 180.
- Max URL length: 2,000 after sanitization.
- Max per-event `data` payload: 4 KiB after JSON serialization.
- Reject mixed sessions/scopes in one batch.
- Reject stale, tampered, unpublished, archived, or mismatched contexts.
- Reject batches without an existing accepted session matching the opaque `eventToken`.
- Rate limit by workspace, site, recipient, session, IP hash, and device hash.

Hot-path rules:

- Validate token and payload.
- Check suppression and bot state.
- Upsert/update the session.
- Insert deduped raw events.
- Enqueue rollup/recording/status work outside the request path.
- Do not perform dashboard aggregation, webhook delivery, expensive GeoIP fallback, or recording assembly in the request path.

Production rate limiting:

- Do not rely on in-process memory rate limits in production.
- Use an edge limiter, durable object, Redis/Upstash, or a bounded Postgres-backed limiter that works across API instances.
- Include separate limits for session starts, event batches, recording chunks, Slack preview routes, and authenticated dashboard reads.

## Location And Device Enrichment

### IP

Capture:

- `ip_address`: nullable `inet`, restricted retention.
- `ip_hash`: HMAC of workspace ID plus normalized IP.

Rules:

- Use `request.ip` only after Express `trust proxy` is correctly configured.
- Prefer trusted edge headers from Cloudflare/Render when available.
- Do not log raw IP in app logs.
- Do not expose raw IP broadly in UI. It can be shown in session detail only if product/admin policy allows.

### Location

Use Cloudflare `request.cf` fields when available:

- city
- region
- regionCode
- country
- timezone

The worker should pass them to origin in internal headers only on trusted edge-origin requests. If Cloudflare metadata is unavailable, store null or use a server-side GeoIP resolver later.

Trusted edge header rules:

- The API must only trust geo/IP headers from the configured public worker or hosting proxy.
- The worker should add an internal signature header over the forwarded metadata, request timestamp, and request ID.
- The API must ignore unsigned client-supplied geo headers.
- If signature verification fails, discard forwarded geo metadata and continue with unknown location.

UI display:

- `Tampa, FL`
- `United States` if only country is known.
- `Unknown location` if no useful data.

### Device And OS

Parse user agent server-side:

- browser name/version
- OS name/version
- device type: desktop, mobile, tablet, bot, unknown

Store:

- normalized fields on session.
- `user_agent_hash` for dedupe/debug.
- raw user agent only in short-retention metadata if necessary. Avoid indefinite raw UA storage.

## Workspace-User Tracking Suppression

### Purpose

When a workspace user opens their own public site, tracking should be omitted from customer-facing analytics and recordings.

### Marker Sources

On authenticated app bootstrap and after login, the app sends or records:

- Random app `deviceId`.
- Request IP.
- User agent family.
- Active workspace memberships.

The server upserts suppression markers for each active workspace membership.

### Table

```sql
tracking_suppression_markers (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id varchar(191) null references "user"(id) on delete set null,
  workspace_member_id uuid null references workspace_members(id) on delete cascade,
  marker_type varchar(40) not null,
  marker_hash varchar(128) not null,
  confidence varchar(20) not null,
  source varchar(40) not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}',
  unique (workspace_id, marker_type, marker_hash)
)
```

Explicit internal network ranges are separate from automatically collected IP markers:

```sql
tracking_internal_ip_ranges (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cidr cidr not null,
  label varchar(160) not null,
  created_by_user_id varchar(191) null,
  created_at timestamptz not null default now(),
  unique (workspace_id, cidr)
)
```

Only admins should manage configured internal ranges. Use them sparingly; they can suppress legitimate prospects if a customer and seller share a network.

Marker types:

- `device_id`
- `ip`
- `ip_user_agent`

Hashing:

- `device_id`: `HMAC(TRACKING_IDENTITY_SECRET, workspaceId + ":" + deviceId)`
- `ip`: `HMAC(TRACKING_IDENTITY_SECRET, workspaceId + ":" + normalizedIp)`
- `ip_user_agent`: `HMAC(TRACKING_IDENTITY_SECRET, workspaceId + ":" + normalizedIp + ":" + userAgentFamily)`

Retention:

- Device marker expiry: 180 days after last seen.
- IP marker expiry: 30 days after last seen.
- IP plus UA marker expiry: 60 days after last seen.

Deduplication:

- Use `on conflict` upsert.
- Update `last_seen_at`, `seen_count`, `expires_at`, and metadata.
- Do not insert a new row every login.

### Suppression Decision

When a public session starts:

1. Compute hashes from the public request IP, UA, and browser device ID.
2. Query active markers for that workspace.
3. Suppress if:
   - device ID marker matches with high confidence, or
   - IP plus UA marker matches and the marker was refreshed recently enough for the workspace risk tolerance, or
   - request IP is inside a workspace-configured internal IP range.
4. Mark the session `suppressed`.
5. Do not create user-facing tracking events.
6. Do not issue recording upload tokens.

Optional internal observability can count suppressed sessions without storing full event detail.

Do not suppress solely on an automatically collected IP marker by default. Corporate NATs, conferences, shared offices, and VPNs can put real prospects behind the same public IP as a workspace user. IP-only markers may be used for risk scoring, recording denial, or explicitly configured internal ranges, but they should not silently remove human recipient engagement from analytics without a stronger signal.

Custom-domain limitation:

- A first-party app device ID may not be available on a custom public domain.
- IP plus UA matching is the fallback.
- Authenticated preview/share flows should prefer a signed internal preview token when the user intentionally opens their own public page from the app.
- UI/docs should describe suppression as best-effort, not perfect.

## Slack/Open Graph Share Detection

Each recipient public page should use a unique OG image URL:

```text
/api/public/tracking/v2/og/{base64urlEncryptedContextToken}
```

The path segment is a base64url wrapper around the same encrypted v2 public context token used by the browser bootstrap. Wrapping keeps opaque token punctuation out of the route matcher while preserving the encrypted payload. The token maps to:

- workspace ID
- site ID
- recipient ID
- published version ID
- recipient revision
- tracking mode

Flow:

1. User pastes recipient link into Slack.
2. Slackbot requests page metadata.
3. Slackbot or Slack image proxy requests OG image.
4. Worker/API validates preview token and classifies user agent.
5. If user agent is Slack, record a `slack_share` event that the UI can label "Slack share detected."
6. Serve the image or redirect to the actual image.

Rules:

- Route OG tracking paths before public site catch-all routes.
- Put the preview token in the path rather than the query string so crawlers, proxies, and caches do not accidentally strip it.
- The tracking OG route itself should not be edge-cached in a way that skips logging.
- The tracking OG route may respond with a short-lived no-store redirect to a cacheable rendered image asset, or proxy the asset with `no-store`; choose the approach that preserves logging and works reliably with Slack.
- The underlying rendered image asset can be cached by published version and recipient revision.
- Deduplicate Slack events over 30 minutes.
- Also support generic `preview_loaded` internally for Teams, LinkedIn, X, Facebook, Discord, and search bots, but the user-facing requested event is Slack.

## Webhook Send Tracking

Webhook sends are server events.

Recommended future tables:

```sql
webhooks (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid null references sites(id) on delete cascade,
  name varchar(160) not null,
  url text not null,
  status varchar(40) not null,
  secret_ref text null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

```sql
webhook_deliveries (
  id uuid primary key,
  webhook_id uuid not null references webhooks(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid null references sites(id) on delete cascade,
  recipient_id uuid null references site_recipients(id) on delete set null,
  session_id varchar(160) null references tracking_sessions(id) on delete set null,
  trigger_event_id uuid null references tracking_events(id) on delete set null,
  status varchar(40) not null,
  attempt integer not null,
  response_status integer null,
  error_code varchar(80) null,
  sent_at timestamptz null,
  created_at timestamptz not null
)
```

Tracking behavior:

- On queue, create a `webhook_send` event with `status = "queued"` only if the UI should show queued sends.
- On successful delivery, create or update the user-facing `webhook_send` event with `status = "sent"`.
- On terminal failure, create or update event with `status = "failed"`.
- Never accept browser-submitted `webhook_send`.

## Aggregations And Read Models

Raw tracking tables are for truth and replay. Dashboards should start with indexed raw/session reads over bounded date ranges. Move to rollups only when expected production volume or measured query latency requires them.

Recommended tables:

```sql
tracking_site_daily_rollups (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  reporting_timezone varchar(80) not null,
  date date not null,
  human_visits integer not null default 0,
  unique_sessions integer not null default 0,
  active_duration_ms bigint not null default 0,
  max_scroll_depth integer not null default 0,
  button_clicks integer not null default 0,
  link_clicks integer not null default 0,
  tab_switches integer not null default 0,
  slack_shares integer not null default 0,
  webhook_sends integer not null default 0,
  primary key (workspace_id, site_id, reporting_timezone, date)
)
```

```sql
tracking_recipient_daily_rollups (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  recipient_id uuid not null references site_recipients(id) on delete cascade,
  reporting_timezone varchar(80) not null,
  date date not null,
  human_visits integer not null default 0,
  unique_sessions integer not null default 0,
  active_duration_ms bigint not null default 0,
  max_scroll_depth integer not null default 0,
  button_clicks integer not null default 0,
  link_clicks integer not null default 0,
  tab_switches integer not null default 0,
  slack_shares integer not null default 0,
  webhook_sends integer not null default 0,
  last_engaged_at timestamptz null,
  primary key (workspace_id, site_id, recipient_id, reporting_timezone, date)
)
```

```sql
tracking_element_daily_rollups (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  recipient_id uuid null,
  recipient_scope varchar(160) not null,
  reporting_timezone varchar(80) not null,
  element_id varchar(160) not null,
  element_kind varchar(40) not null,
  element_label varchar(180) not null,
  element_href text null,
  date date not null,
  click_count integer not null default 0,
  last_clicked_at timestamptz null,
  primary key (workspace_id, site_id, recipient_scope, reporting_timezone, element_id, date)
)
```

Rules:

- Activity feed reads raw events with cursor pagination.
- Session list reads `tracking_sessions`.
- Summary cards may read indexed raw/session tables in the first shippable slice.
- After rollups exist, summary cards read rollups plus recent unrolled raw events if needed.
- Recording player reads session and recording manifest.
- Rollups are rebuildable from retained raw events while raw retention allows.
- Daily rollup `date` is computed in the workspace reporting timezone. Add a workspace reporting timezone before shipping rollups; use `UTC` only as the explicit default, not an implicit accident.
- `recipient_scope` is `default` for default-link events and `recipient:{recipientId}` for recipient-link events. This avoids nullable primary-key ambiguity.

## Dashboard Requirements

Tracking page should support:

- Date range.
- Site filter.
- Recipient filter.
- Event type filter.
- Human/bot/preview/system filter.
- Search by site, recipient name/company, element label, webhook URL host, and event name.

Activity feed columns:

- Event type.
- Site.
- Tab.
- Element.
- Recipient.
- Session ID.
- Device.
- OS.
- Location.
- Timestamp.

Session detail:

- Site.
- Recipient.
- Session ID.
- Device.
- OS.
- Location.
- IP address if permitted.
- Device ID hash or short fingerprint if permitted.
- Start timestamp.
- End timestamp.
- Active duration.
- Max scroll depth.
- Recording status and player when recording is enabled for that session.
- Ordered events in that session.

Copy rules:

- Use "Visits" and "Sessions", not "People".
- Use "Slack share detected" or "Slack preview loaded", not "definitely shared".
- Use "Time spent" with a note that it is estimated active visible time.

## Privacy, Security, And Retention

### Privacy

- Do not record form input values.
- Do not record authenticated app pages.
- Do not record workspace-user sessions when suppression matches.
- Do not store recipient email unless a future product field explicitly adds it.
- Do not store full URL query strings by default.
- Do not expose raw IP in broad feed rows.
- Include a public tracking disclosure in the product/legal surface before launch.
- Respect Global Privacy Control and Do Not Track according to product/legal policy. Recording must be disabled when either signal is present unless policy explicitly changes after review.

### Security

- Tracking context and recording upload tokens are signed and scoped.
- Recording upload token is issued only after session acceptance.
- All public ingestion endpoints are rate-limited.
- Ingestion endpoints use generic error messages.
- CSP must allow only the required same-origin script/connect/image/style paths.
- Public runtime scripts are immutable and versioned.
- Recording playback requires authenticated workspace analytics access.

### Public CSP Contract

Public pages should use the narrowest CSP that supports rendering and tracking:

```text
default-src 'none';
base-uri 'none';
frame-ancestors 'none';
form-action 'none';
object-src 'none';
script-src 'self';
connect-src 'self';
img-src 'self' https: data:;
style-src 'unsafe-inline';
```

Rules:

- Versioned core and recorder scripts must be served from `self`.
- Event, session, recording, and preview endpoints must be same-origin.
- Do not add broad third-party `script-src` for tracking.
- If future embeds need third-party frames/scripts, isolate that policy from the base public page and review recording behavior at the same time.

### Retention

Recommended V1:

- Raw events: 365 days by default, configurable per workspace/site/recipient.
- Sessions: 365 days by default, configurable per workspace/site/recipient.
- Raw IP address: 30 days.
- IP/device hashes and coarse location: retained only with the session row, then deleted when the session expires.
- Recordings: 30 days.
- Rollups, once added: 2 years or workspace lifetime.
- Suppression markers: by marker expiry, pruned daily.

Retention jobs must delete object storage chunks when recording rows expire.
Raw IP retention should null `tracking_recipient_sessions.ip_address` after the IP retention window while keeping `ip_address_hash`, coarse location, and other session fields until their own retention window expires.

## Performance Limits

Client:

- Core script target: under 10 KiB gzip.
- Recorder script is separate and lazy.
- Event batch target: under 16 KiB, hard max 64 KiB.
- Recording chunk target: 32 KiB compressed, hard max 60 KiB for final beacon path.
- Passive scroll listeners and requestAnimationFrame throttling.
- No synchronous XHR.
- No unload/beforeunload handlers.

Server:

- Batch insert events in one transaction.
- Session update should be one upsert/update per accepted batch.
- Suppression lookup must use indexed hashes.
- Recording chunk upload writes object storage plus one chunk metadata row.
- Aggregations run out of request path unless the update is cheap and bounded.

Database:

- Partition `tracking_events` by month or use retention-friendly pruning before high volume.
- Add partial indexes for common dashboard filters.
- Keep event `data` bounded and typed.
- Avoid `count(*)` over raw events for large date ranges.

## Failure Modes

- Public page loads, tracking script blocked: page still works, no events.
- Initial session start fails: no recording, event tracking may retry lightly.
- Event endpoint down: queue up to the requeue cap, then drop.
- Recording upload fails: retry current chunk while page is active; mark failed if persistent.
- Final recording chunk too large for beacon: split if possible, otherwise best-effort fetch and accept possible loss.
- Slack image route fails to record: still serve OG image if possible.
- Suppression lookup fails: fail closed for recording and user-facing analytics. The public page still renders, but the session start should return a generic non-accepted state so internal traffic is not accidentally recorded or counted.
- Aggregation delayed: dashboard can show raw recent events over bounded ranges while rollups are absent.

## Observability

Tracking observability should measure system health without becoming a second raw tracking store.

Metrics:

- Session starts accepted, rejected, suppressed, bot-filtered, and rate-limited.
- Event batches accepted, rejected, deduped, and dropped by reason.
- Recording sessions accepted, denied, completed, truncated, failed, and expired.
- Recording bytes uploaded and stored by workspace/site.
- Slack preview route hits, classified events, deduped events, and route failures.
- Rollup lag and rebuild failures once rollups exist.
- Retention cleanup rows/chunks deleted and failures.

Logging rules:

- Log request IDs, workspace/site IDs, reason codes, counts, and byte sizes.
- Do not log raw event payloads, raw IPs, raw user agents, recipient variable values, recording chunks, context tokens, or upload tokens.
- Sample noisy success logs; never sample security-relevant rejection spikes.

## Implementation Plan

### Phase 1: Schema And Contracts

- Add v2 tracking schemas in `packages/tracking-schema`.
- Add canonical settings, sessions, events, suppression, and internal-range tables and migrations.
- Add event type registry and data validators.
- Add suppression marker table and service.
- Add feature flags for tracking v2 and future recording.

Acceptance:

- Typecheck passes.
- Migration applies cleanly.
- Contract tests reject malformed, mixed-scope, oversize, stale, and tampered payloads.

### Phase 2: Public Runtime And Event Ingest

- Implement encrypted opaque v2 context tokens.
- Implement session start acknowledgement.
- Implement event batch ingest.
- Implement heartbeat and session-end lifecycle endpoints.
- Enrich sessions with IP, device, UA, and location.
- Mount v2 ingestion behind `TRACKING_V2_ENABLED`.
- Issue v2 public tracking bootstraps from public site resolution.
- Serve a versioned standalone browser runtime at `/track/2026-07-11.v7/script.js`.
- Stamp `data-ls-track` attributes in public HTML and React public previews for buttons, sidebar links, sidebar buttons, and sidebar tabs.
- Serve only the v2 runtime from public HTML when an enabled v2 bootstrap is present.
- Remove old v1 tracking script/ingest/read paths from the active app surface. There is no production compatibility requirement.

Acceptance:

- Server-generated sessions can be started through HTTP and persisted.
- Site visit, button click, link click, and tab switch event batches persist with session joins.
- Heartbeat and end-session requests update session state, active time, scroll depth, and duration.
- Browser signals older than the server freshness window are rejected and cannot revive an abandoned session.
- A bounded API lifecycle worker expires abandoned active sessions at `last_seen_at`, including when pagehide and idle-end delivery both fail.
- Internal workspace-user visits can be suppressed before session creation.
- Real browser navigation of a public recipient URL creates a session, records a site visit, records a tracked button click, sanitizes the clicked href, and ends the session on pagehide.
- Public page still renders when ingest is down.

### Phase 3: Slack Share Detection

- Implemented: generate unique recipient OG image URLs from encrypted v2 context tokens.
- Implemented: verify preview context tokens through the v2 context-token service.
- Implemented: classify Slack user agents before recording.
- Implemented: record deduped sessionless `slack_share` events.

Acceptance:

- Covered: Slackbot-like requests create preview events.
- Covered: duplicate requests within bucket dedupe.
- Covered: preview events do not count as human visits.

### Phase 4: Recording

- Implemented: add an rrweb recorder runtime at `/track/2026-07-11.v7/recorder.js` that loads the pinned `/track/2026-07-11.v7/rrweb-record.js` module only after recording acceptance.
- Implemented: add recording manifest/chunk/usage tables and migrations.
- Implemented: add recording object-store abstraction with filesystem-backed local/dev storage.
- Implemented: issue recording upload tokens only after accepted, unsuppressed `events_and_recording` session start.
- Implemented: upload strict schema-v3 rrweb chunks through scoped bearer tokens using an ordered queue, bounded retries, periodic flushes, pagehide keepalive where payload size permits, idempotent unload duplicates, and a 5 MB client/server recording cap.
- Implemented: store chunk metadata, byte counts, checksums, daily usage counters, and recording status.
- Implemented: tolerate complete-before-final-chunk ordering by storing `finalSequence` and settling after contiguous chunks arrive.
- Implemented: build authenticated workspace recording manifest and proxied chunk read routes.
- Implemented: add a lazily loaded `@rrweb/replay` player with responsive desktop/mobile reconstruction, cursor and click playback, DOM mutation playback, pause/play/restart/seek controls, idle skipping, precise event-derived duration, and retryable file loading.
- Implemented: add authenticated site-level recording enablement controls guarded by disclosure acknowledgement and recording storage configuration.
- Pending: production object-store binding, final launch copy/legal review, and production retention scheduling.

Acceptance:

- Covered: recording upload tokens are denied unless session start is accepted and recording is enabled.
- Covered: suppressed/internal sessions never receive upload tokens.
- Covered: chunks write metadata and object storage outside Postgres.
- Covered: duplicate chunk uploads are idempotent when byte count/checksum match.
- Covered: completion can arrive before the final chunk and still settles to `available` after the chunk arrives.
- Covered: duplicate complete/chunk requests after terminal completion remain idempotent, while new post-completion chunks are rejected.
- Covered: authenticated workspace routes can read a manifest and proxied chunk payload.
- Covered: the rrweb recorder masks inputs, removes opted-out DOM, strips URL credentials/query/hash values, replaces v2 OG tracking URLs, blocks browser tooling overlays, and disables canvas/cross-origin iframe capture before upload.
- Covered: a real in-app browser session reconstructed desktop and mobile layouts, cursor movement, Pricing and Overview tab mutations, idle skipping, natural completion, and restart in the dashboard player.
- Covered: recording duration comes from accepted rrweb event bounds, forged active-time claims are capped to elapsed server-bounded lifecycle intervals, and a real untouched browser tab ended after two minutes with only 30 seconds credited active.
- Covered: recording retention service deletes expired objects before chunk metadata and marks empty expired recordings deleted.
- Covered: site-level recording cannot be enabled without disclosure acknowledgement and configured recording storage.
- Pending: final product/legal recording copy and launch approval.

### Phase 5: Authenticated Event And Session Reads

- Implemented: add v2 read query/response schemas for events, sessions, and session detail.
- Implemented: add repository methods for bounded workspace-scoped raw reads over `tracking_recipient_events` and `tracking_recipient_sessions`.
- Implemented: include user-facing site, recipient, session, device, OS/browser, location, tab, element, webhook, recording, and timestamp fields.
- Implemented: use `received_at + id` event cursors and `started_at + id` session cursors; do not use offset pagination.
- Implemented: expose authenticated workspace routes under `/api/workspaces/:workspaceId/tracking/v2`.
- Implemented: extend local tracking smoke with a v2 branch that verifies real public bootstrap, session start, event ingest, session end, event read, session list, and session detail read against Postgres.

Acceptance:

- Covered: invalid query params and invalid cursors return `tracking.invalid_payload`.
- Covered: active-workspace mismatch returns `workspace.access_denied`.
- Covered: event reads include site, recipient, session, device, location, element/tab/webhook, and timestamps.
- Covered: session reads include site, recipient, device, location, IP address when captured, lifecycle timestamps, duration/active time, scroll depth, and recording summary.
- Covered: pagination returns `nextCursor` only when more records exist.
- Covered: live smoke passes through the v2 public bootstrap, session start, event ingest, heartbeat, Slack OG image share detection, session end, event read, session list, session detail read, and post-unpublish disabled-session behavior.
- Covered: legacy public ingest, legacy read routes, and the old v1 script path return 404.

### Phase 6: Retention Cleanup

- Implemented: add a v2 retention service with bounded batch sizes and explicit count reporting.
- Implemented: run the same bounded stale-session expiration operation on API startup, every 30 seconds, and at the start of retention maintenance.
- Implemented: null expired raw IP addresses while retaining hashed/coarse session fields.
- Implemented: delete expired suppression markers.
- Implemented: delete expired raw v2 events and old sessions after their effective retention window.
- Implemented: respect recipient, site, workspace, then default retention settings for raw IP and event/session pruning.
- Implemented: expire recordings before object cleanup; delete chunk objects before chunk metadata; mark recordings deleted only after no chunks remain.
- Implemented: keep chunk metadata when no object store is configured or object deletion fails, avoiding orphaned object files.
- Implemented: add `pnpm --filter @lightsite/api tracking:retention` for production scheduling and `pnpm --filter @lightsite/api smoke:tracking-retention` for live Postgres/filesystem verification.

Acceptance:

- Covered: cleanup is bounded and reports per-category counts.
- Covered: stale active sessions become `expired` with `server_expired`, preserve credited active time, and derive `ended_at` and duration from the last trusted heartbeat rather than the later sweep time.
- Covered: late signals cannot revive stale sessions, overlapping sweeps are suppressed in-process, and duplicate workers are safe because the database update rechecks state and cutoff.
- Covered: raw IP retention nulls `ip_address` without deleting active session fields.
- Covered: expired event/session pruning respects effective retention settings.
- Covered: recording object deletion is idempotent and precedes metadata deletion.
- Covered: live smoke verifies real Postgres rows, real filesystem recording objects, FK behavior, and cleanup results.
- Pending: production scheduler invokes the retention command on the chosen cadence.

### Phase 7: Webhook Send Events

- Add webhook delivery table when webhook feature is implemented.
- Emit `webhook_send` from server delivery flow.
- Include webhook ID and sanitized URL.

Acceptance:

- Browser cannot spoof webhook sends.
- Successful and failed deliveries show correctly in session/event feed.

### Phase 8: Dashboard And Rollups

- Implemented: migrate the tracking page from legacy summary/events to v2 event/session reads.
- Implemented: add site, recipient, event type, source, and date filters using v2 query fields.
- Implemented: add bounded client-side search across loaded event rows without sending unsupported query params to the server.
- Implemented: show recent metrics, event feed, recent sessions, top clicked elements, and recipient activity from v2 raw reads.
- Implemented: add dedicated session detail with lifecycle metrics, recipient/device/location/IP context, and bounded session event timeline.
- Implemented: add a recording player in session detail that fetches authenticated manifest/chunks with bounded concurrency and replays rrweb snapshots, mutations, responsive viewport changes, pointer movement, clicks, and scroll.
- Add daily rollups only if expected production volume or measured query latency requires them.

Acceptance:

- Covered: dashboard answers the first user-facing questions from bounded v2 raw reads without legacy contracts.
- Covered: session detail shows lifecycle, context, and a bounded event list.
- Pending: dashboard answers high-volume date ranges without raw-event scans once production volume requires rollups.
- Covered: replay player can play a captured rrweb session recording from the session detail surface and skips long inactive gaps.

### Phase 10: Site Tracking Controls

- Implemented: add shared v2 settings request/response schemas with bounded retention and recording duration values.
- Implemented: add authenticated `GET /api/workspaces/:workspaceId/tracking/v2/sites/:siteId/settings`.
- Implemented: add authenticated admin-only `PUT /api/workspaces/:workspaceId/tracking/v2/sites/:siteId/settings`.
- Implemented: require `recordingDisclosureAccepted` when `recordingEnabled` is true.
- Implemented: reject recording-enabled saves when recording object storage is not configured.
- Implemented: add a site detail tracking settings panel with activity, raw IP, and recording switches.
- Implemented: update live tracking smoke to read defaults, reject missing recording acknowledgement, update recording settings through the API, and verify later recording sessions use the saved settings.

Acceptance:

- Covered: non-admin settings updates return `site.permission_denied`.
- Covered: invalid settings payloads return `tracking.invalid_payload`.
- Covered: recording-enabled updates fail closed when storage is unavailable.
- Covered: recording sessions are enabled only after the authenticated site setting is saved.

## Test Plan

Unit tests:

- Event schema discriminated unions.
- URL sanitizer.
- Label truncation.
- Context token signing/verification/expiry.
- Suppression marker hashing and upsert dedupe.
- Session duration calculations.
- Slack user-agent classification.
- Recording limit decisions.

Integration tests:

- Published recipient page includes tracking context and trackable attrs.
- Event ingest rejects tampered/mismatched/stale contexts.
- Event ingest dedupes event IDs.
- Workspace-user marker suppresses public visit.
- Bot/preview events do not create human sessions.
- Recording upload token is denied for suppressed sessions when recording is enabled.
- Recording chunks write metadata and object storage when recording is enabled.
- Expiration job ends abandoned sessions at the right inferred timestamp.

Browser tests:

- Public page renders before tracking script runs.
- Click tracking does not block navigation.
- Hidden tab stops active duration.
- Visible idle stops active duration after idle threshold.
- Tab switch captures tab label and previous tab.
- Recorder masks inputs and blocks marked elements.

Smoke tests:

- Seed a published site and recipient.
- Open public page.
- Send site visit, button click, link click, tab switch, heartbeat, and Slack preview.
- Read back session, events, and summary.
- In the recording phase, also send recording chunks and read back the recording manifest.

## Triple-Check Review

Correctness:

- Events cannot choose arbitrary IDs because all public context is signed.
- Session duration excludes hidden time and caps visible idle inflation.
- Slack share detection is useful but not overstated.
- Webhook send events are server-origin only.
- Recording starts only after suppression and bot checks.
- Recording ships only behind disclosure, quota, storage, and retention gates.

Performance:

- Core script stays small.
- Recorder is lazy and capped.
- Event batches are bounded.
- Recording data stays out of Postgres.
- Read APIs start with bounded indexed raw/session reads and add rollups only when needed.

Privacy:

- No keystrokes or form values.
- Inputs masked at source.
- Internal user sessions suppressed before recording.
- Raw IP retention is short and restricted.
- Cross-workspace visitor identity is avoided.

Operational risk:

- Public rendering does not depend on tracking.
- Ingest failure drops data instead of hurting visitors.
- Object storage cleanup is required for recording retention.
- Rollups are rebuildable from raw events during raw retention.

Migration risk:

- Current `site_variants` naming must be isolated from recipient-facing contracts.
- Legacy `analytics_events`, legacy `tracking_sessions`, and legacy `tracking_events` must stay removed from active schema and app code.
- Current public HTML CSP must be updated intentionally for versioned tracking scripts and recording uploads.
- Tracking smoke is now v2-only: `TRACKING_V2_ENABLED=true pnpm smoke:tracking` covers v2 public sidebar tracking attributes, authenticated site settings reads and invalid recording acknowledgement rejection, session start, event ingest, heartbeat, Slack OG image share detection, session end, authenticated event/session reads, and retired legacy endpoint checks. `TRACKING_SMOKE_INCLUDE_RECORDING=1` adds site settings recording enablement through the authenticated API, recording token issuance, chunk upload, completion, authenticated manifest/chunk reads, and local object cleanup. Retention smoke covers stale-session expiration at `last_seen_at`, real Postgres row cleanup, and filesystem object deletion. Browser QA covers dashboard replay playback from seeded data on desktop and mobile. Future smoke coverage still needs production object storage and final product/legal recording copy/review.

## External References Considered

- MDN `navigator.sendBeacon`: small asynchronous analytics payloads, 64 KiB queued data limit, and `visibilitychange` guidance.
- MDN `visibilitychange`: transition to hidden is the last reliably observable session-end signal.
- MDN `Request.keepalive`: useful fallback for requests that should outlive unload, with more control than beacon.
- rrweb guide: recorder/replayer split, privacy masking/blocking options, checkout snapshots, and production package guidance.
- rrweb storage optimization recipe: sampling, blocking noisy DOM, compression, and backend whole-session compression.
- Slack Robots and Slack unfurl docs: Slackbot user agents, Open Graph image fetch behavior, and Slack caching/link unfurl limits.
- Cloudflare Workers request docs: `request.cf` fields for city, region, country, and timezone.
- Cloudflare R2 Workers docs: object storage bindings for reading/writing recording chunks.
