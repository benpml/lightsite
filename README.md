# Handout

Handout is a lightweight sales one-page site builder for creating editable one-pagers that sales teams can send to prospects.

## Stack

- Frontend: React, Vite, TanStack Router, TanStack Query, TanStack Table, shadcn/ui, Tailwind CSS v4
- Backend: Node.js, Express, BetterAuth
- Database: Postgres with Drizzle ORM
- Package manager: pnpm workspaces

## Local Development

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm dev
```

Useful focused commands:

```bash
pnpm dev:web
pnpm dev:api
pnpm db:up
pnpm db:setup
pnpm db:setup:local
pnpm db:local:start
pnpm db:local:stop
pnpm db:local:status
pnpm db:wait
pnpm db:down
pnpm db:logs
pnpm smoke:tracking
pnpm test
pnpm typecheck
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

## Postgres Architecture

Handout uses one real Postgres database as the source of truth for app data, published-site state, and tracking analytics. The app connects through `DATABASE_URL`; local development uses the Compose service in `compose.yml`, while production should use a managed Postgres provider.

Recommended defaults:

- Local: Docker Compose Postgres 17 via `pnpm db:setup`.
- Local without Docker: workspace-local Postgres 17.10 via `pnpm db:setup:local` after the binaries exist at `.local/postgres-17.10`.
- Production: managed Postgres such as Neon, Supabase, Railway Postgres, or Render Postgres.
- Pooling: keep `DATABASE_POOL_MAX=10` by default for a low-cost Node API. Increase only after measuring connection pressure.
- Migrations: run `pnpm db:migrate` during deploy or release setup before serving new code.

Operational checks:

```bash
pnpm db:wait          # confirms DATABASE_URL is reachable
pnpm db:migrate       # applies Drizzle migrations
pnpm smoke:tracking   # seeds a throwaway published site and verifies live tracking persistence
```

`pnpm smoke:tracking` expects the API to be running on `API_ORIGIN` or `http://localhost:3011`. It exercises the real public HTML route, signed tracking context, ingest endpoint, tracking read APIs, malformed/hostile public tracking requests, preview-bot recording, stale-context rejection, and cleanup.

If `pnpm db:up` fails with `docker: command not found`, either install Docker Desktop, point `DATABASE_URL` at an existing local/managed Postgres instance and run `pnpm db:wait && pnpm db:migrate`, or use the workspace-local path with `pnpm db:setup:local` once PostgreSQL 17.10 has been installed under `.local/postgres-17.10`.

## App Structure

- `apps/web`: Vite React app and all shadcn UI source components
- `apps/api`: Express API with BetterAuth mounted at `/api/auth/*`
- `packages/db`: Drizzle client, schema, and migration config

Core frontend routes:

- `/`: foundation dashboard
- `/sites`: site management table
- `/tracking`: event feed
- `/team`: team management
- `/editor/$siteId`: editor shell
- `/design-system`: living shadcn primitive gallery
- `/components`: installed component inventory
- `/$workspaceSlug/$siteSlug`: public share-link route shape

## Hosting Recommendation

The low-cost production path is documented in [docs/deployment.md](docs/deployment.md).

Recommended first production split:

- Web app: Cloudflare Pages.
- Public pages: Cloudflare Worker with short Cache API entries for non-personalized HTML.
- API: Render Node web service.
- Database: Neon Postgres.
- Session replay objects: private Cloudflare R2.

The key rule is that public recipient links should hit Cloudflare first. Render and Neon should not be on the hot path for every repeated public page view.

## Auth Notes

BetterAuth is configured in `apps/api/src/auth.ts` with the Drizzle adapter. The Express server mounts BetterAuth before `express.json()` in `apps/api/src/server.ts`, which follows BetterAuth's Express guidance.

Run BetterAuth schema generation/migration work once the final auth table naming and provider choices are locked.
