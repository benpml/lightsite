# Recipient site preview images

## Product contract

Every recipient share surface uses a literal browser screenshot of that recipient's published Handout. The screenshot is not a reconstructed marketing card: it is the first 1200×630 CSS pixels of the canonical public renderer with the selected recipient's variable values applied.

The same image URL is used for:

- `og:image` and `twitter:image` on the recipient's public page.
- The email embed copied from Handout.
- The in-app recipient share preview.
- The Gmail extension's preview and inserted email image.

The image links to the recipient's public Handout. At 600 CSS pixels wide in email, it remains a sharp 2× source image and preserves the standard 1.904:1 large social-preview ratio.

## URL and invalidation

The canonical endpoint is:

```txt
/{recipientShortCode}/embed.jpg?v={publishedVersionId}.{recipientRevision}
```

Compatibility cadence tools that cannot pre-provision use an owner-issued, scoped, expiring campaign capability:

```txt
/{sitePublicId}/campaign/{campaignCapability}/{name}/{company}/{domain}/embed.jpg?{variable-key}={value}
```

The resolver validates the campaign capability before site lookup, atomically creates or reuses the same recipient as the corresponding cadence link, then returns a non-cacheable temporary redirect to the canonical short-code endpoint above. It never renders, stores, or edge-caches JPEG bytes under a path containing recipient identity. New integrations use authenticated pre-provisioning so recipient values do not appear in URLs.

The legacy workspace/site/recipient path remains supported. The non-recipient site also supports `/{workspaceSlug}/{siteSlug}/embed.jpg` for consistent default-site metadata. Legacy `embed.png` requests receive a permanent redirect that preserves the version query.

The route always resolves the published version and active recipient from the server. The query version prevents email and social caches from reusing an image after either the site is republished or the recipient variables change. It is not trusted as input and does not choose the rendered version.
If an unversioned or stale short-image request misses R2, the API redirects it to the current versioned URL before rendering. It never writes current bytes beneath an older immutable version key.

## Rendering

- Normalize the public payload through the same schema used by the public page.
- Render with `@handout/site-document`, which is the shared editor-preview and published-site source of truth.
- Apply the canonical selected variant before rendering; no second variable substitution system is allowed.
- Disable the public runtime and tracking script during capture so the capture cannot generate visits, recordings, clicks, or Slack events.
- Capture a fixed 1200×630 Chromium viewport at device scale 1, at scroll position zero, after fonts and images settle.
- Disable animation and caret rendering for deterministic images.
- Allow same-origin assets and reviewed provider HTTPS resources required by the canonical renderer. Block credentials, arbitrary remote images, insecure HTTP, loopback, link-local, and private-network destinations so screenshot rendering cannot become an SSRF or recipient-tracking path.

## Performance and failure behavior

- Encode at JPEG quality 75. At the 1200×630 source size this stays crisp when displayed at the 600px email width while reducing transfer size on visually rich sites.
- Cache JPEG bytes only in a byte/count-bounded LRU owned by the isolated media role, keyed by format/quality, workspace, site, published version, recipient, and recipient revision.
- Persist each successfully rendered, explicitly versioned JPEG in the private `handout-recipient-previews` Cloudflare R2 bucket through the API-owned, bucket-scoped object-store abstraction. Persist bounded preview metadata and workspace byte/count accounting in PostgreSQL. The public-site Worker remains the cache-first reader.
- Use immutable R2 object keys containing the public path and full `publishedVersionId.recipientRevision` value. Never persist unversioned requests, preventing a mutable `latest` image from becoming stale.
- Generate only on an actual versioned image request or an explicit authenticated preview action. Recipient creation, recipient-link resolution, public HTML metadata, and redirect routes never launch Chromium.
- A deterministic cadence image request redirects immediately without rendering. Its versioned destination reads or creates the immutable image only when the image is actually requested.
- Keep a single object for each requested site-version/recipient-revision combination. Repeated loads reuse the same object. Retain personalized objects for the disclosed 90-day maximum, shortened after recipient/site deletion as defined by `abuse-cost-security-protection-spec.md`; expired URLs never expose another recipient.
- Claim one pending preview row/lease per immutable key so a Slack burst or multiple API processes create at most one browser capture.
- Run Chromium only in the fixed-capacity isolated media role, sandboxed and without core provider secrets. Screenshot and image-decode work share its measured heavy-task budget. Start with one active heavy task per configured instance, a fixed maximum instance count, and no public waiter queue. Apply the workspace, principal, global, and retained-preview ceilings from `abuse-cost-security-protection-spec.md`.
- Keep the HTTP response `no-store`. R2 is the durable internal cache, not a public bucket or browser cache.
- On an R2 miss, the Worker fetches the canonical image from the API. The API admits the render, validates the JPEG, writes it durably, commits preview metadata, and returns it. The Worker may cache only a successful personalized result.
- If a personalized render is not immediately admitted or storage/rendering fails, return `503` with `Retry-After` and `Cache-Control: no-store`. Never return generic bytes as `200` under the personalized immutable key because downstream email/social proxies may pin them.
- Authenticated share surfaces pre-generate and verify the personalized object before enabling image copy/insertion. Until ready, they show retry and link-only sharing rather than generic-image success.
- Rendering and failure behavior follow the system controls and degradation contract in `abuse-cost-security-protection-spec.md`. Preview failure must never delay or change recipient navigation.

## Slack tracking

Slack tracking occurs only when Slack requests the canonical screenshot URL:

1. Resolve the recipient-specific published payload.
2. Derive the immutable screenshot cache key; render the JPEG only when the image itself is missing.
3. Classify the request as a Slack preview request from the user agent.
4. Verify the signed tracking context emitted for that exact payload.
5. Record a sessionless `slack_share` event with source `slack_og_image`, the recipient ID, recipient revision, published version ID, and screenshot cache key.

Normal browser loads from the Handout app or Gmail extension do not create Slack events. On an R2 hit, the Worker serves the image immediately and sends a best-effort background `HEAD` request to the canonical API only for Slack preview user agents. That request resolves and verifies the recipient context without launching the screenshot renderer, preserving recipient-specific tracking without delaying image delivery. Slack event recording is rate-limited, deduplicated by the existing server-event policy, and best-effort so analytics cannot break image delivery.

## Release checks

- The screenshot is a real JPEG with dimensions 1200×630.
- Recipient variables are visibly present in rendered screenshot HTML.
- A recipient revision change produces a new cache key and image URL.
- Public HTML points `og:image` and `twitter:image` at the canonical screenshot endpoint.
- In-app and Gmail embeds use that same endpoint.
- Slack user-agent requests record one recipient-specific server event; ordinary browser requests record none.
- Recipient creation and metadata/link resolution launch zero browser renders.
- Saturation returns a temporary uncached failure, launches no queued public render, and never places generic bytes beneath a personalized key.
- Chromium executes outside the API process with its sandbox and resource limits enabled.
- Public edge routing reads versioned JPEGs through the private R2 binding without browser/CDN caching; the API performs admitted durable writes and accounting.
- API, web, public-worker, site-document, extension, and tracking smoke checks pass.
