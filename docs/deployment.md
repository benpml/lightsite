# Handout Deployment

This is the low-cost production shape for the first Handout release:

- Logged-in React app: Cloudflare Pages.
- Public pages: Cloudflare Worker with a short Cache API TTL for non-personalized HTML.
- API: Render Node web service.
- Database: Neon Postgres.
- Session replay objects: private Cloudflare R2.

The goal is to keep public traffic cheap and bounded. Public pages should hit Cloudflare first; Render and Neon should not be on the hot path for every repeat view.

## GitHub

Repository:

```txt
https://github.com/benpml/handout.git
```

Render and Cloudflare should deploy from the `main` branch unless we add a release branch later.

## Neon

Create one production Neon project for now.

Use the pooled connection string if Neon presents one for application traffic. Set it in Render as:

```txt
DATABASE_URL=<neon pooled postgres connection string>
```

Do not commit the connection string. Do not put it in `render.yaml`.

Recommended Neon guardrails:

- Start on the free plan.
- Set usage/budget alerts in Neon.
- Keep `DATABASE_POOL_MAX=5` on Render until measured traffic says otherwise.
- Do not route public page views directly through Postgres when Cloudflare cache/R2 can serve them.

## Render API

The root `render.yaml` defines the `handout-api` service.

Render setup:

1. New > Blueprint.
2. Connect `benpml/handout`.
3. Use `render.yaml`.
4. Provide `DATABASE_URL`, `LOGO_DEV_TOKEN`, `ORIGIN_AUTH_SECRET`, and the same `AUTOMATIONS_ENCRYPTION_KEY` value for both `handout-api` and `handout-automations-worker` when prompted.
5. Let Render generate `BETTER_AUTH_SECRET` and `TRACKING_SIGNING_SECRET`.

Important Render settings:

- `plan: free` for early testing.
- Move to `starter` when the API needs to stop sleeping.
- `TRUST_PROXY=true` is required behind Render's proxy.
- `API_JSON_BODY_LIMIT=256kb` keeps request bodies bounded.
- `ORIGIN_AUTH_SECRET` must be one random value of at least 32 bytes shared by Render, the public Worker, the Pages Function, and the Cloudflare rule protecting `api.handout.link`. Generate it with `openssl rand -base64 32`.
- `AUTOMATIONS_ENCRYPTION_KEY` is a 32-byte base64 key used to encrypt webhook URLs and signing secrets. Generate it once with `openssl rand -base64 32`; the API and automation worker must use the exact same value. Losing or changing it makes saved destinations unreadable, so store it in the production secret manager and rotate through the product flow rather than replacing the environment value.
- `AUTOMATIONS_ALLOW_LOCAL_DESTINATIONS` must remain `false` in production. It exists only for isolated local end-to-end tests.

Render free web services do not support Blueprint `preDeployCommand`, so the web
service start command intentionally does not run migrations. Run Neon migrations
explicitly before the first deploy and before every schema-changing release:

```bash
DATABASE_URL=<neon pooled postgres connection string> pnpm db:migrate
```

When the API moves to a paid fixed-size Render service, we can add
`preDeployCommand: pnpm db:migrate` back to the Blueprint.

After Render creates the service, update these values if the generated URL differs:

```txt
API_ORIGIN=https://<render-api-host>
```

Current Render API URL:

```txt
https://api.handout.link
```

## Cloudflare Pages

Create a Pages project for `apps/web`.

Build settings:

```txt
Build command: pnpm install --frozen-lockfile && pnpm --filter @handout/web build
Build output directory: apps/web/dist
Root directory: /
```

Environment variables:

```txt
# Leave VITE_API_ORIGIN unset in production.
# The web app calls /api/* same-origin, and the Pages Function proxies to Render.
VITE_GIPHY_API_KEY=<giphy key>
ORIGIN_AUTH_SECRET=<same value configured in Render>
```

Current Cloudflare Pages production URL:

```txt
https://app.handout.link
```

Current deployment was created with Wrangler direct upload:

```bash
pnpm --filter @handout/web build
pnpm exec wrangler pages project create handout --production-branch main
pnpm exec wrangler pages deploy apps/web/dist --project-name=handout --branch=main
```

This is enough for the first live preview. For hands-off web deploys, connect
the Pages project to GitHub using the build settings above.

The app has:

- `apps/web/public/_redirects` for SPA fallback.
- `apps/web/public/_headers` for baseline static headers and immutable asset caching.
- `functions/api/[[path]].ts` for same-origin `/api/*` proxying to the Render API.

## Cloudflare R2

Session replay uses a private bucket:

```txt
handout-session-replays
```

The bucket must have no public development URL or custom domain. Its `delete-expired-replays`
lifecycle rule expires every object after 30 days and aborts incomplete multipart uploads after
one day. Application retention normally removes objects after the selected 7, 14, or 30-day
period; the provider rule is a hard defense-in-depth ceiling.

Create one R2 S3 token with Object Read & Write access restricted only to this bucket. Store its
access key and secret in Render as `TRACKING_REPLAY_S3_ACCESS_KEY_ID` and
`TRACKING_REPLAY_S3_SECRET_ACCESS_KEY`. Never commit those values.

## Tracking Retention

Production retention runs as the `handout-tracking-retention` Render cron job at minute 17 every
six hours. Recording reads enforce `expires_at` immediately, while this lower-frequency physical
cleanup cadence keeps a mostly idle Neon database from being woken every few minutes.
The API web service uses `TRACKING_RETENTION_MODE=external` so it does not run a duplicate timer.
The cron command processes bounded batches until idle and exits nonzero when object deletion
fails or work remains after its safety ceiling; Render failure notifications must remain enabled.

Session expiry and replay finalization are latency-sensitive rather than retention work. Session
list/detail reads therefore run a single-flight reconciler at most once per 30 seconds per API
instance. Each run performs two bounded, partial-index-backed reads (maximum 1,000 candidates),
does not read or write replay objects, and logs only when it changes state. There is no background
database polling while the tracking UI is idle, and the six-hour cron remains the unattended
fallback. Completion writes are conditional and idempotent, so a late browser request cannot
downgrade an available replay.

The cron job and API share the same Neon connection and bucket-scoped R2 credentials. The cron
job uses `DATABASE_POOL_MAX=2`; the API remains capped at five connections.

## Cloudflare Public Worker

Worker package:

```txt
apps/public-worker
```

Local typecheck:

```bash
pnpm --filter @handout/public-worker build
```

Deploy:

```bash
pnpm exec wrangler login
printf '%s' "$ORIGIN_AUTH_SECRET" | pnpm exec wrangler secret put ORIGIN_AUTH_SECRET --config apps/public-worker/wrangler.jsonc
pnpm deploy:public-worker
```

Do not deploy the Worker with the placeholder `API_ORIGIN` from `wrangler.jsonc`.
Deploy it after Render has created the API service and the Worker env var points to the real Render URL.

Current behavior:

- `GET /health` returns Worker health.
- `/api/*` proxies to Render API.
- `/api/tracking/script.js` can be edge cached.
- Static public assets are proxied and cached.
- Non-personalized public page paths are fetched from the API and cached briefly in Cloudflare Cache API.
- Recipient short links and screenshots are proxied with `no-store` until revocation-aware, accounted immutable storage is available.
- Origin failures return a bounded `503` response; deleted or unpublished content is never revived from stale R2 HTML.

Worker variables in `apps/public-worker/wrangler.jsonc`:

```txt
API_ORIGIN=https://<render-api-host>
PUBLIC_ORIGIN=https://handout.link
EDGE_CACHE_HTML_SECONDS=60
EDGE_CACHE_UNAVAILABLE_SECONDS=15
```

Set `ORIGIN_AUTH_SECRET` with `wrangler secret put`; do not add it to `wrangler.jsonc`.
The Cloudflare proxy/rule in front of `api.handout.link` must overwrite
`x-handout-origin-auth` with the same secret. Missing or incorrect headers are rejected before
body parsing; `/api/health` is the only direct-origin exemption.

## Cloudflare Agent Setup

Cloudflare's official agent setup prompt is:

```txt
https://developers.cloudflare.com/agent-setup/prompt.md
```

For Codex, it currently recommends:

```bash
codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
codex mcp add cloudflare-docs --url https://docs.mcp.cloudflare.com/mcp
codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
codex mcp add cloudflare-builds --url https://builds.mcp.cloudflare.com/mcp
codex mcp add cloudflare-observability --url https://observability.mcp.cloudflare.com/mcp
codex mcp login cloudflare
```

Those MCPs require an agent restart after setup. The repo does not depend on them to build.

## Bill-Safety Defaults

Keep these from day one:

- Cloudflare in front of public recipient pages.
- Short public HTML cache TTL; personalized HTML is not shared-cached.
- API JSON bodies capped with `API_JSON_BODY_LIMIT`.
- Render fixed instance size; no autoscaling early.
- `DATABASE_POOL_MAX=5` on Render while using Neon.
- Tracking should stay batched/rate-limited/summarized.
- No unbounded background retries.
- Webhook queues, monthly outbound attempts, request duration, payload size, test frequency, and retries all have server-enforced hard limits.
- Provider budget alerts enabled in Cloudflare, Neon, and Render.

## Production Checklist

Before pointing a real domain at this:

1. Render API deploys and `/api/health` returns `ok: true`.
2. `pnpm db:migrate` has run successfully against Neon.
3. Cloudflare Pages build leaves `VITE_API_ORIGIN` unset so authenticated API traffic goes through the same-origin Pages Function.
4. Render, Pages, the public Worker, and the `api.handout.link` Cloudflare origin rule share `ORIGIN_AUTH_SECRET`; direct provider-host requests return `403`.
5. Worker deploys and `/health` returns `ok: true`.
6. Public page path returns HTML through the Worker.
7. Tracking script and ingest routes proxy through the Worker.
8. Cloudflare rate limits/WAF rules are configured for tracking and public fallback endpoints.
