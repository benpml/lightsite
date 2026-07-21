# Handout Deployment

This is the low-cost production shape for the first Handout release:

- Logged-in React app: Cloudflare Pages.
- Public recipient pages: Cloudflare Worker with Cache API and optional R2 HTML snapshots.
- API: Render Node web service.
- Database: Neon Postgres.
- Assets/screenshots/snapshots: Cloudflare R2.

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
4. Provide `DATABASE_URL`, `LOGO_DEV_TOKEN`, and the same `AUTOMATIONS_ENCRYPTION_KEY` value for both `handout-api` and `handout-automations-worker` when prompted.
5. Let Render generate `BETTER_AUTH_SECRET` and `TRACKING_SIGNING_SECRET`.

Important Render settings:

- `plan: free` for early testing.
- Move to `starter` when the API needs to stop sleeping.
- `TRUST_PROXY=true` is required behind Render's proxy.
- `API_JSON_BODY_LIMIT=256kb` keeps request bodies bounded.
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

Create one R2 bucket:

```txt
handout-public-snapshots
```

The public Worker binds it as:

```txt
SNAPSHOT_BUCKET
```

Recommended R2 lifecycle:

- Delete temporary/public HTML snapshots after 7-30 days once production publish snapshots are versioned.
- Keep uploaded assets/screenshots under separate prefixes when those flows are added.

Session replay uses a separate private bucket:

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
pnpm deploy:public-worker
```

Do not deploy the Worker with the placeholder `API_ORIGIN` from `wrangler.jsonc`.
Deploy it after Render has created the API service and the Worker env var points to the real Render URL.

Current behavior:

- `GET /health` returns Worker health.
- `/api/*` proxies to Render API.
- `/api/tracking/script.js` can be edge cached.
- Static public assets are proxied and cached.
- Public page paths like `/<workspace>/<site>` and `/<workspace>/<site>/<recipient>` are fetched from the API, cached in Cloudflare Cache API, and stored as bounded R2 snapshots.
- If the API fails and a recent R2 snapshot exists, the Worker serves stale HTML instead of making the public page unavailable.

Worker variables in `apps/public-worker/wrangler.jsonc`:

```txt
API_ORIGIN=https://<render-api-host>
PUBLIC_ORIGIN=https://handout.link
EDGE_CACHE_HTML_SECONDS=60
EDGE_CACHE_UNAVAILABLE_SECONDS=15
EDGE_R2_SNAPSHOT_SECONDS=300
```

These short TTLs are intentional for the first release. We can increase cache duration once publish invalidation is versioned end-to-end.

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
- Short public HTML cache TTL plus stale-while-revalidate.
- R2 snapshots are bounded by `EDGE_R2_SNAPSHOT_SECONDS`.
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
4. Cloudflare R2 bucket exists and is bound to the Worker.
5. Worker deploys and `/health` returns `ok: true`.
6. Public page path returns HTML through the Worker.
7. Tracking script and ingest routes proxy through the Worker.
8. Cloudflare rate limits/WAF rules are configured for tracking and public fallback endpoints.
