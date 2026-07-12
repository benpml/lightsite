# Lightsite for Gmail

The Chrome extension is an alternate build target of `@lightsite/web`. It intentionally shares the web app's design tokens, shadcn primitives, domain limits, and API contracts instead of maintaining a second UI system.

## Build and load locally

1. Start the normal Lightsite web and API services on ports `5173` and `3011`.
2. Run `pnpm --filter @lightsite/web build:extension` from the repository root.
3. Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `apps/web/dist-extension`.
4. Open or reload Gmail. Every compose toolbar should include a **Share a Lightsite** button.
5. Select **Continue with Lightsite**. The extension opens the local Lightsite web app and reuses its existing session; local dev login remains available on the normal Lightsite auth page when needed.

Chrome does not automatically reload unpacked extensions after a rebuild. Select **Reload** on the extension card and reload Gmail after code changes.

Development builds load the panel preview image from `http://localhost:3011`, while recipient-facing links and inserted email images remain on `https://lightsite.io`. Production uses the public origin for both. `VITE_EXTENSION_PREVIEW_ORIGIN` and `VITE_EXTENSION_PUBLIC_ORIGIN` can override those independently.

## Production build configuration

Set these values before running the build with `NODE_ENV=production`:

```text
VITE_EXTENSION_API_ORIGIN=https://api.example.com
VITE_EXTENSION_WEB_ORIGIN=https://app.example.com
VITE_EXTENSION_PUBLIC_ORIGIN=https://lightsite.io
VITE_EXTENSION_PREVIEW_ORIGIN=https://lightsite.io
```

The API deployment must include the final Chrome extension origin in `WEB_ORIGINS`:

```text
WEB_ORIGINS=https://app.example.com,chrome-extension://<chrome-web-store-extension-id>
```

That allowlist is used by both CORS and Better Auth trusted-origin checks. Development accepts `chrome-extension://` origins only when `NODE_ENV` is not `production`.

## Authentication

The background worker opens the first-party Lightsite web app with `chrome.identity.launchWebAuthFlow`. The web app reuses its existing Better Auth session, or shows the normal Lightsite sign-in page when necessary. A 90-second encrypted authorization code is bound to a background-generated PKCE verifier and exchanged for the bearer session without putting that session token in a URL.

The resulting token is stored in `chrome.storage.local`. It never enters Gmail's page context or the injected iframe message channel. API requests are restricted to the configured Lightsite API origin and an allowlist of `/api/me` and `/api/sites` routes.

Sign-out revokes the Better Auth session when possible and always clears local extension storage. A server 401 also clears the local token and returns the panel to Connect Lightsite.

## Permissions

- `identity`: perform the secure first-party Lightsite web authentication handoff.
- `storage`: persist the Lightsite bearer session.
- Gmail content-script match: add the compose toolbar action and insert user-selected content.
- Lightsite host permissions: authenticate, load sites and recipients, and open public previews.

The extension does not request Gmail API, contacts, history, cookies, identity, scripting, microphone, camera, location, or broad browsing permissions. It does not read or transmit email subjects, bodies, threads, or attachments.

## Checks

```bash
pnpm --filter @lightsite/web test:extension
pnpm --filter @lightsite/web typecheck
pnpm --filter @lightsite/api typecheck
pnpm --filter @lightsite/web build:extension
```

Before Chrome Web Store submission, complete the manual matrix in `/gmail-chrome-extension-spec.md`, provide store icons/screenshots/privacy copy, pin the final extension ID in the production origin allowlist, and build with production origins.
