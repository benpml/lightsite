import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  TRACKING_SCRIPT_VERSION,
  type TrackingContext,
  type UnsignedTrackingContext,
} from "@lightsite/tracking-schema";
import { createHmacTrackingContextTokenService } from "../src/tracking/context-token";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../../../.env"), quiet: true });

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3011";
const workspaceId = "00000000-0000-4000-8000-000000000101";
const workspaceSlug = "lightsite-dev";
const siteId = randomUUID();
const versionId = randomUUID();
const siteSlug = `tracking-smoke-${Date.now().toString(36)}`;
const sessionId = `session_tracking_smoke_${Date.now().toString(36)}`;
const now = new Date();
const nowIso = now.toISOString();
let seeded = false;

async function main() {
  const { queryClient } = await import("@lightsite/db");

  try {
    await assertDatabaseIsReachable(queryClient);
    await assertApiIsRunning();
    await seedPublishedSite(queryClient);
    seeded = true;

    const context = await fetchSignedTrackingContext();
    await assertMalformedJsonIsRejected();
    await assertInvalidPayloadIsRejected();
    await assertMixedSessionScopeIsRejected(context);
    await assertTamperedContextIsRejected(context);
    await assertEssentialContextRejectsEngagement(context);
    await assertSensitiveUrlIsRejected(context);
    await postTrackingBatch(context);
    await recordPreviewLoad();

    const events = await readTrackingEvents();
    assert(events.events.length >= 4, `Expected at least 4 tracking events, got ${events.events.length}.`);

    const eventTypes = new Set(events.events.map((event) => event.type));
    for (const type of ["site_viewed", "scroll_depth_reached", "link_clicked", "heartbeat"]) {
      assert(eventTypes.has(type), `Expected tracking feed to include ${type}.`);
    }

    const summary = await readTrackingSummary();
    assert(summary.metrics.humanVisits >= 1, "Expected at least one human visit.");
    assert(summary.metrics.linkClicks >= 1, "Expected at least one link click.");
    assert(summary.metrics.maxScrollDepth >= 75, "Expected max scroll depth to reach 75%.");
    assert(summary.metrics.previewLoads >= 1, "Expected at least one preview load.");
    await assertReadAbuseIsRejected();

    await unpublishSeededSite(queryClient);
    await assertStaleContextIsRejected(context);

    console.log("Tracking smoke passed.");
  } finally {
    if (seeded) {
      await cleanup(queryClient).catch((error) => {
        console.warn("Tracking smoke cleanup failed.", error);
      });
    }

    await queryClient.end();
  }
}

async function assertDatabaseIsReachable(sql: Awaited<ReturnType<typeof importDbClient>>) {
  try {
    await sql`select 1`;
  } catch (error) {
    throw new Error(
      `Postgres is not reachable through DATABASE_URL. Run pnpm db:setup or update .env. ${formatErrorCause(error)}`,
    );
  }
}

async function assertApiIsRunning() {
  const response = await fetch(`${apiOrigin}/api/__lightsite_tracking_smoke_preflight`);
  const body = await response.json().catch(() => null);

  if (response.status !== 404 || body?.error?.code !== "route.not_found") {
    throw new Error(`API preflight failed with ${response.status}. Start the API with pnpm dev:api.`);
  }
}

async function seedPublishedSite(sql: Awaited<ReturnType<typeof importDbClient>>) {
  const content = {
    schemaVersion: 2,
    chrome: {
      siteHeader: {
        brandName: "Lightsite",
        logoUrl: "",
        primaryButtonText: "Open example",
        primaryButtonHref: "https://example.com/smoke?secret=removed#fragment",
        secondaryButtonText: "Learn more",
        secondaryButtonHref: "",
        showSecondaryButton: false,
      },
      hero: {
        avatarMode: "single",
        eyebrow: "Tracking verification",
        title: "Tracking smoke page",
        subtitle: "A real published page for tracking verification.",
        avatarImageUrl: "",
        avatarImageVariableKey: "",
        avatarImageAlt: "",
        avatarImageSecondaryUrl: "",
        avatarImageSecondaryVariableKey: "",
        avatarImageSecondaryAlt: "",
      },
    },
    settings: {
      showTableOfContents: true,
      allowSearchIndexing: false,
    },
    variables: [],
    blocks: [
      {
        id: "smoke-heading",
        type: "heading",
        fields: {
          level: 2,
          text: "Tracking smoke section",
        },
      },
      {
        id: "smoke-body",
        type: "text",
        fields: {
          text: "This page is created and deleted by the tracking smoke script.",
        },
      },
      {
        id: "smoke-cta",
        type: "cta",
        fields: {
          label: "Open example",
          href: "https://example.com/smoke?secret=removed#fragment",
          style: "primary",
        },
      },
    ],
  };
  const contentJson = JSON.stringify(content);

  await sql.begin(async (transaction) => {
    await transaction`
      insert into workspaces (id, name, slug, website_domain, plan, status, updated_at)
      values (${workspaceId}, 'Lightsite Dev', ${workspaceSlug}, 'lightsite.app', 'pro', 'active', ${nowIso}::timestamptz)
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        website_domain = excluded.website_domain,
        plan = excluded.plan,
        status = excluded.status,
        updated_at = excluded.updated_at
    `;

    await transaction`
      insert into sites (
        id,
        workspace_id,
        created_by_user_id,
        updated_by_user_id,
        published_by_user_id,
        name,
        slug,
        status,
        visibility,
        draft_content,
        draft_revision,
        published_at,
        updated_at
      )
      values (
        ${siteId},
        ${workspaceId},
        'dev_user_lightsite',
        'dev_user_lightsite',
        'dev_user_lightsite',
        'Tracking smoke page',
        ${siteSlug},
        'draft',
        'team',
        ${contentJson}::jsonb,
        1,
        null,
        ${nowIso}::timestamptz
      )
    `;

    await transaction`
      insert into site_versions (
        id,
        workspace_id,
        site_id,
        version_number,
        kind,
        label,
        content,
        variables_snapshot,
        created_by_user_id,
        published_at,
        metadata
      )
      values (
        ${versionId},
        ${workspaceId},
        ${siteId},
        1,
        'publish',
        'Tracking smoke publish',
        ${contentJson}::jsonb,
        ${"[]"}::jsonb,
        'dev_user_lightsite',
        ${nowIso}::timestamptz,
        ${"{\"smoke\":true}"}::jsonb
      )
    `;

    await transaction`
      update sites
      set status = 'published',
        published_version_id = ${versionId},
        published_at = ${nowIso}::timestamptz,
        updated_at = ${nowIso}::timestamptz
      where id = ${siteId}
    `;
  });
}

async function fetchSignedTrackingContext(): Promise<TrackingContext> {
  const response = await fetch(`${apiOrigin}/${workspaceSlug}/${siteSlug}`, {
    headers: {
      "user-agent": "Mozilla/5.0 LightsiteTrackingSmoke",
    },
  });
  const html = await response.text();

  assert(response.ok, `Expected public HTML to load, got ${response.status}: ${html.slice(0, 200)}`);

  const match = html.match(/data-lightsite-tracking="([^"]+)"/);
  assert(match?.[1], "Public HTML did not include a signed tracking context.");

  return JSON.parse(decodeHtmlAttribute(match[1])) as TrackingContext;
}

async function postTrackingBatch(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        {
          eventId: `event_tracking_smoke_view_${Date.now().toString(36)}`,
          type: "site_viewed",
          occurredAt,
          sessionId,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          viewport: {
            width: 1280,
            height: 720,
          },
          referrerHost: "example.com",
        },
        {
          eventId: `event_tracking_smoke_scroll_${Date.now().toString(36)}`,
          type: "scroll_depth_reached",
          occurredAt,
          sessionId,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          depthPercent: 75,
        },
        {
          eventId: `event_tracking_smoke_click_${Date.now().toString(36)}`,
          type: "link_clicked",
          occurredAt,
          sessionId,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          elementId: "smoke-cta",
          label: "Open example",
          href: "https://example.com/smoke",
        },
        {
          eventId: `event_tracking_smoke_heartbeat_${Date.now().toString(36)}`,
          type: "heartbeat",
          occurredAt,
          sessionId,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          engagedSeconds: 15,
          maxScrollDepthPercent: 75,
        },
      ],
    }),
  });

  assert(response.status === 204, `Expected tracking ingest 204, got ${response.status}: ${await response.text()}`);
}

async function assertMalformedJsonIsRejected() {
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });

  await assertErrorResponse(response, 400, "request.invalid");
}

async function assertInvalidPayloadIsRejected() {
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: "batch_tracking_smoke_invalid_payload",
      sentAt: new Date().toISOString(),
      events: [],
    }),
  });

  await assertErrorResponse(response, 400, "tracking.invalid_payload");
}

async function assertMixedSessionScopeIsRejected(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_scope_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        buildSiteViewedEvent(context, occurredAt, `${sessionId}_scope_a`),
        buildSiteViewedEvent(context, occurredAt, `${sessionId}_scope_b`),
      ],
    }),
  });

  await assertErrorResponse(response, 400, "tracking.invalid_context");
}

async function assertTamperedContextIsRejected(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_tampered_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        buildSiteViewedEvent({ ...context, mode: "essential_only" }, occurredAt, `${sessionId}_tampered`),
      ],
    }),
  });

  await assertErrorResponse(response, 400, "tracking.invalid_context");
}

async function assertEssentialContextRejectsEngagement(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const essentialContext = signTrackingContext({
    workspaceId: context.workspaceId,
    siteId: context.siteId,
    publishedVersionId: context.publishedVersionId,
    variantId: context.variantId,
    variantRevision: context.variantRevision,
    mode: "essential_only",
  });
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_essential_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        {
          eventId: `event_tracking_smoke_essential_${Date.now().toString(36)}`,
          type: "heartbeat",
          occurredAt,
          sessionId: `${sessionId}_essential`,
          context: essentialContext,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          engagedSeconds: 10,
          maxScrollDepthPercent: 25,
        },
      ],
    }),
  });

  await assertErrorResponse(response, 400, "tracking.invalid_context");
}

async function assertSensitiveUrlIsRejected(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_sensitive_url_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        {
          eventId: `event_tracking_smoke_sensitive_url_${Date.now().toString(36)}`,
          type: "link_clicked",
          occurredAt,
          sessionId: `${sessionId}_sensitive_url`,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          elementId: "smoke-sensitive-url",
          label: "Sensitive URL",
          href: "https://example.com/smoke?token=secret#fragment",
        },
      ],
    }),
  });

  await assertErrorResponse(response, 400, "tracking.invalid_payload");
}

async function recordPreviewLoad() {
  const response = await fetch(`${apiOrigin}/${workspaceSlug}/${siteSlug}`, {
    headers: {
      "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    },
  });

  assert(response.ok, `Expected preview HTML to load, got ${response.status}: ${await response.text()}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function readTrackingEvents() {
  const response = await fetch(
    `${apiOrigin}/api/workspaces/${workspaceId}/tracking/events?siteId=${siteId}&from=${encodeURIComponent(
      new Date(Date.now() - 60_000).toISOString(),
    )}`,
    {
      headers: {
        "x-lightsite-dev-auth": "1",
      },
    },
  );
  const body = await response.json();

  assert(response.ok, `Expected tracking events read to succeed, got ${response.status}: ${JSON.stringify(body)}`);
  return body as {
    events: Array<{ type: string }>;
  };
}

async function readTrackingSummary() {
  const response = await fetch(
    `${apiOrigin}/api/workspaces/${workspaceId}/tracking/summary?siteId=${siteId}&from=${encodeURIComponent(
      new Date(Date.now() - 60_000).toISOString(),
    )}`,
    {
      headers: {
        "x-lightsite-dev-auth": "1",
      },
    },
  );
  const body = await response.json();

  assert(response.ok, `Expected tracking summary read to succeed, got ${response.status}: ${JSON.stringify(body)}`);
  return body as {
    metrics: {
      humanVisits: number;
      linkClicks: number;
      maxScrollDepth: number;
      previewLoads: number;
    };
  };
}

async function assertReadAbuseIsRejected() {
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/events?cursor=${"a".repeat(2050)}`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/events?cursor=not-a-valid-cursor`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/summary?from=not-a-date`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    "/api/workspaces/00000000-0000-4000-8000-000000000999/tracking/events",
    404,
    "workspace.access_denied",
  );
}

async function unpublishSeededSite(sql: Awaited<ReturnType<typeof importDbClient>>) {
  await sql`
    update sites
    set status = 'draft',
      published_version_id = null,
      published_at = null,
      last_unpublished_at = now()
    where id = ${siteId}
  `;
}

async function assertStaleContextIsRejected(context: TrackingContext) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_smoke_stale_${Date.now().toString(36)}`,
      sentAt: occurredAt,
      events: [
        {
          eventId: `event_tracking_smoke_stale_${Date.now().toString(36)}`,
          type: "site_viewed",
          occurredAt,
          sessionId: `${sessionId}_stale`,
          context,
          scriptVersion: TRACKING_SCRIPT_VERSION,
          viewport: {
            width: 1280,
            height: 720,
          },
          referrerHost: null,
        },
      ],
    }),
  });
  const body = await response.json().catch(() => null);

  assert(
    response.status === 400 && body?.error?.code === "tracking.invalid_context",
    `Expected stale tracking context to be rejected, got ${response.status}: ${JSON.stringify(body)}`,
  );
}

async function cleanup(sql: Awaited<ReturnType<typeof importDbClient>>) {
  await sql`delete from sites where id = ${siteId}`;
}

function buildSiteViewedEvent(context: TrackingContext, occurredAt: string, scopedSessionId: string) {
  return {
    eventId: `event_tracking_smoke_view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    type: "site_viewed",
    occurredAt,
    sessionId: scopedSessionId,
    context,
    scriptVersion: TRACKING_SCRIPT_VERSION,
    viewport: {
      width: 1280,
      height: 720,
    },
    referrerHost: "example.com",
  };
}

function signTrackingContext(context: UnsignedTrackingContext): TrackingContext {
  const secret = process.env.TRACKING_SIGNING_SECRET;
  assert(secret, "TRACKING_SIGNING_SECRET is required for tracking smoke abuse tests.");
  const tokenService = createHmacTrackingContextTokenService(secret);

  return {
    ...context,
    token: tokenService.sign(context),
  };
}

async function assertGetError(path: string, status: number, code: string) {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {
      "x-lightsite-dev-auth": "1",
    },
  });

  await assertErrorResponse(response, status, code);
}

async function assertErrorResponse(response: Response, status: number, code: string) {
  const body = await response.json().catch(() => null);

  assert(
    response.status === status && body?.error?.code === code,
    `Expected ${status} ${code}, got ${response.status}: ${JSON.stringify(body)}`,
  );
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function importDbClient() {
  const { queryClient } = await import("@lightsite/db");
  return queryClient;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);

  if (
    String(error).includes("ECONNREFUSED") ||
    String(error).includes("Postgres is not reachable") ||
    String(error).includes("tracking.unavailable")
  ) {
    console.error("Make sure a real Postgres instance is running and migrated: pnpm db:setup");
  }

  process.exit(1);
});

function formatErrorCause(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  if ("code" in error && typeof error.code === "string") {
    return `Cause: ${error.code}.`;
  }

  if ("message" in error && typeof error.message === "string") {
    return `Cause: ${error.message}`;
  }

  return "";
}
