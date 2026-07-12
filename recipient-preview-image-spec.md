# Recipient site preview images

## Product contract

Every recipient share surface uses a literal browser screenshot of that recipient's published Lightsite. The screenshot is not a reconstructed marketing card: it is the first 1200×630 CSS pixels of the canonical public renderer with the selected recipient's variable values applied.

The same image URL is used for:

- `og:image` and `twitter:image` on the recipient's public page.
- The email embed copied from Lightsite.
- The in-app recipient share preview.
- The Gmail extension's preview and inserted email image.

The image links to the recipient's public Lightsite. At 600 CSS pixels wide in email, it remains a sharp 2× source image and preserves the standard 1.904:1 large social-preview ratio.

## URL and invalidation

The canonical endpoint is:

```txt
/{workspaceSlug}/{siteSlug}/{recipientSlug}/embed.jpg?v={publishedVersionId}.{recipientRevision}
```

The non-recipient site also supports `/{workspaceSlug}/{siteSlug}/embed.jpg` for consistent default-site metadata. Legacy `embed.png` requests receive a permanent redirect that preserves the version query.

The route always resolves the published version and active recipient from the server. The query version prevents email and social caches from reusing an image after either the site is republished or the recipient variables change. It is not trusted as input and does not choose the rendered version.

## Rendering

- Normalize the public payload through the same schema used by the public page.
- Render with `@lightsite/site-document`, which is the shared editor-preview and published-site source of truth.
- Apply the canonical selected variant before rendering; no second variable substitution system is allowed.
- Disable the public runtime and tracking script during capture so the capture cannot generate visits, recordings, clicks, or Slack events.
- Capture a fixed 1200×630 Chromium viewport at device scale 1, at scroll position zero, after fonts and images settle.
- Disable animation and caret rendering for deterministic images.
- Allow same-origin assets and public HTTPS assets. Block credentials, insecure remote HTTP, loopback, link-local, and private-network destinations to prevent screenshot rendering from becoming an SSRF path.

## Performance and failure behavior

- Encode at JPEG quality 75. At the 1200×630 source size this stays crisp when displayed at the 600px email width while reducing transfer size on visually rich sites.
- Cache JPEG bytes in a bounded in-process LRU keyed by format/quality, workspace, site, published version, recipient, and recipient revision.
- Keep at most 24 images and at most 48 MiB per API process, evicting the least recently used image when either limit is reached.
- Persist each successfully rendered, explicitly versioned JPEG in the private `lightsite-recipient-previews` Cloudflare R2 bucket through the public-site Worker. The API does not hold R2 credentials.
- Use immutable R2 object keys containing the public path and full `publishedVersionId.recipientRevision` value. Never persist unversioned requests, preventing a mutable `latest` image from becoming stale.
- Generate lazily on the first versioned image request. Recipient creation does not render an image by itself; opening the share preview normally warms the durable image before the message is sent.
- Keep a single object for each requested site-version/recipient-revision combination. Repeated loads reuse the same object. Retain old objects so screenshots in already-sent emails continue to work; introduce an explicit archival policy only when product retention requirements exist.
- Coalesce concurrent renders for the same key so a Slack burst creates one browser capture.
- Keep the HTTP response `no-store`. R2 is the durable internal cache, not a public bucket or browser cache.
- On an R2 miss, fetch the canonical image from the API, validate that it is a successful JPEG, return it, and write it to R2 asynchronously. On R2 failure, fail open to the canonical API renderer.
- A render failure returns `503` with no cache instruction so crawlers can retry. It must never return a generic image while claiming it is the personalized site.

## Slack tracking

Slack tracking occurs only when Slack requests the canonical screenshot URL:

1. Resolve the recipient-specific published payload.
2. Render or read its cached JPEG.
3. Classify the request as a Slack preview request from the user agent.
4. Verify the signed tracking context emitted for that exact payload.
5. Record a sessionless `slack_share` event with source `slack_og_image`, the recipient ID, recipient revision, published version ID, and screenshot cache key.

Normal browser loads from the Lightsite app or Gmail extension do not create Slack events. On an R2 hit, the Worker serves the image immediately and sends a best-effort background request to the canonical API only for Slack preview user agents, preserving recipient-specific tracking without delaying image delivery. Slack event recording is rate-limited, deduplicated by the existing server-event policy, and best-effort so analytics cannot break image delivery.

## Release checks

- The screenshot is a real JPEG with dimensions 1200×630.
- Recipient variables are visibly present in rendered screenshot HTML.
- A recipient revision change produces a new cache key and image URL.
- Public HTML points `og:image` and `twitter:image` at the canonical screenshot endpoint.
- In-app and Gmail embeds use that same endpoint.
- Slack user-agent requests record one recipient-specific server event; ordinary browser requests record none.
- Public edge routing reads and writes versioned JPEGs through the private R2 binding without browser/CDN caching.
- API, web, public-worker, site-document, extension, and tracking smoke checks pass.
