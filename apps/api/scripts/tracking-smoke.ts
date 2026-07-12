import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  TRACKING_V2_EVENTS_ENDPOINT,
  TRACKING_V2_RECORDING_SCHEMA_VERSION,
  TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT,
  TRACKING_V2_SCRIPT_VERSION,
  TRACKING_V2_SESSION_END_ENDPOINT,
  TRACKING_V2_SESSION_START_ENDPOINT,
  type TrackingV2PublicBootstrap,
  type TrackingV2SiteTrackingSettingsResponse,
} from "@lightsite/tracking-schema";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../../../.env"), quiet: true });

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3011";
const keepSeededData = process.env.TRACKING_SMOKE_KEEP_DATA === "1";
const includeRecording = process.env.TRACKING_SMOKE_INCLUDE_RECORDING === "1";
const workspaceId = "00000000-0000-4000-8000-000000000101";
const workspaceSlug = "lightsite-dev";
const siteId = randomUUID();
const recipientId = randomUUID();
const versionId = randomUUID();
const siteSlug = `tracking-smoke-${Date.now().toString(36)}`;
const recipientSlug = `recipient-${Date.now().toString(36)}`;
const now = new Date();
const nowIso = now.toISOString();
let seeded = false;
let recordingIdToCleanup: string | null = null;

type TrackingSmokeSession = {
  eventToken: string;
  recording: {
    chunkEndpoint: string;
    completeEndpoint: string;
    recordingId: string;
    uploadToken: string;
  } | null;
  sessionId: string;
};

async function main() {
  const { queryClient } = await import("@lightsite/db");

  try {
    await assertDatabaseIsReachable(queryClient);
    await assertApiIsRunning();
    await seedPublishedSite(queryClient);
    seeded = true;

    await assertLegacyEndpointsAreGone();
    await assertMalformedJsonIsRejected();
    await assertInvalidPayloadIsRejected();
    await assertSiteTrackingSettingsControlPlane();
    const smoke = await runTrackingV2Smoke();
    await assertReadAbuseIsRejected();

    if (keepSeededData) {
      console.log(JSON.stringify({
        kept: true,
        publicUrl: `${apiOrigin}/${workspaceSlug}/${siteSlug}/${recipientSlug}`,
        recordingId: smoke.recordingId,
        recipientId,
        sessionId: smoke.sessionId,
        siteId,
        workspaceId,
      }, null, 2));
      console.log("Tracking smoke passed with seeded data kept.");
      return;
    }

    await unpublishSeededSite(queryClient);
    await assertV2ContextStopsAfterUnpublish(smoke.bootstrap);

    console.log("Tracking smoke passed.");
  } finally {
    if (seeded && !keepSeededData) {
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

async function assertLegacyEndpointsAreGone() {
  const response = await fetch(`${apiOrigin}/api/public/tracking/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ events: [] }),
  });

  await assertErrorResponse(response, 404, "route.not_found");
}

async function seedPublishedSite(sql: Awaited<ReturnType<typeof importDbClient>>) {
  const content = {
    schemaVersion: 3,
    themeMode: "dark",
    settings: {
      allowSearchIndexing: false,
    },
    variables: [],
    pages: [
      {
        id: "smoke-page-overview",
        name: "Overview",
        slug: "overview",
        status: "visible",
        sortOrder: 0,
        document: {
          type: "doc",
          content: [
            {
              type: "pageTitleSection",
              attrs: { id: "smoke-title", align: "center" },
              content: [
                {
                  type: "pageTitleTitle",
                  content: [{ type: "text", text: "Tracking smoke page" }],
                },
                {
                  type: "pageTitleSubtitle",
                  content: [{ type: "text", text: "A real published page for tracking verification." }],
                },
              ],
            },
            {
              type: "heading",
              attrs: { id: "smoke-heading", level: 2 },
              content: [{ type: "text", text: "Tracking smoke section" }],
            },
            {
              type: "paragraph",
              attrs: { id: "smoke-body" },
              content: [{ type: "text", text: "This page is created and deleted by the tracking smoke script." }],
            },
            {
              type: "buttonBlock",
              attrs: {
                id: "smoke-cta",
                href: "https://example.com/smoke?secret=removed#fragment",
                fullWidth: false,
              },
              content: [{ type: "text", text: "Open example" }],
            },
          ],
        },
      },
      {
        id: "smoke-page-pricing",
        name: "Pricing",
        slug: "pricing",
        status: "visible",
        sortOrder: 1,
        document: {
          type: "doc",
          content: [{
            type: "paragraph",
            attrs: { id: "smoke-pricing" },
            content: [{ type: "text", text: "Pricing details for tracking smoke." }],
          }],
        },
      },
    ],
    sidebar: {
      sections: {
        tabs: { label: "Tabs" },
        links: { label: "Resources" },
        nextSteps: { label: "Next steps" },
      },
      links: [
        {
          id: "smoke-sidebar-link",
          label: "Proposal",
          href: "https://example.com/proposal?secret=removed#fragment",
          icon: "website",
          status: "visible",
          sortOrder: 0,
        },
      ],
      nextSteps: [
        {
          id: "smoke-sidebar-button",
          label: "Book review",
          href: "https://example.com/book?secret=removed#fragment",
          style: "filled",
          status: "visible",
          sortOrder: 0,
        },
      ],
    },
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

    await transaction`
      insert into site_variants (
        id,
        workspace_id,
        site_id,
        name,
        slug,
        recipient_name,
        recipient_company,
        variable_values,
        revision_number,
        status,
        updated_at
      )
      values (
        ${recipientId},
        ${workspaceId},
        ${siteId},
        'Tracking smoke recipient',
        ${recipientSlug},
        'Riley Smoke',
        'Smoke Co',
        ${"{}"}::jsonb,
        1,
        'active',
        ${nowIso}::timestamptz
      )
    `;

  });
}

async function assertMalformedJsonIsRejected() {
  const response = await fetch(`${apiOrigin}${TRACKING_V2_EVENTS_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });

  await assertErrorResponse(response, 400, "request.invalid");
}

async function assertInvalidPayloadIsRejected() {
  const response = await fetch(`${apiOrigin}${TRACKING_V2_EVENTS_ENDPOINT}`, {
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

async function assertSiteTrackingSettingsControlPlane() {
  const initial = await readTrackingV2Json<TrackingV2SiteTrackingSettingsResponse>(
    `/api/workspaces/${workspaceId}/tracking/v2/sites/${siteId}/settings`,
    "tracking v2 site settings",
  );

  assert(initial.site.id === siteId, "Expected site settings to return the smoke site.");
  assert(initial.siteOverride === null, "Expected smoke site settings to start without a site override.");
  assert(initial.effective.recordingEnabled === false, "Expected recording to be disabled by default.");

  const invalidRecordingResponse = await fetch(
    `${apiOrigin}/api/workspaces/${workspaceId}/tracking/v2/sites/${siteId}/settings`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-lightsite-dev-auth": "1",
      },
      body: JSON.stringify(siteSettingsBody({ recordingEnabled: true })),
    },
  );
  await assertErrorResponse(invalidRecordingResponse, 400, "tracking.invalid_payload");

  if (!includeRecording) {
    return;
  }

  const updated = await writeTrackingV2Json<TrackingV2SiteTrackingSettingsResponse>(
    `/api/workspaces/${workspaceId}/tracking/v2/sites/${siteId}/settings`,
    siteSettingsBody({
      recordingEnabled: true,
      recordingDisclosureAccepted: true,
    }),
    "tracking v2 site settings update",
  );

  assert(updated.siteOverride?.recordingEnabled === true, "Expected site settings update to save a recording-enabled override.");
  assert(updated.effective.recordingEnabled === true, "Expected site settings update to enable effective recording.");
}

async function runTrackingV2Smoke(): Promise<{
  bootstrap: TrackingV2PublicBootstrap;
  recordingId: string | null;
  sessionId: string;
}> {
  const { bootstrap, ogImageUrl } = await fetchTrackingV2Bootstrap();
  const session = await startTrackingV2Session(bootstrap);
  recordingIdToCleanup = session.recording?.recordingId ?? recordingIdToCleanup;
  await postTrackingV2Events(session);
  await postTrackingV2Heartbeat(session);
  if (includeRecording) {
    await recordTrackingV2Recording(session);
  }
  await recordTrackingV2SlackShare(ogImageUrl);
  await endTrackingV2Session(session);
  await readTrackingV2Events(session.sessionId);
  await readTrackingV2Sessions(session.sessionId);
  await readTrackingV2SessionDetail(session.sessionId);
  if (includeRecording) {
    assert(session.recording, "Expected recording smoke session to include upload config.");
    await readTrackingV2Recording(session.sessionId, session.recording.recordingId);
  }
  return {
    bootstrap,
    recordingId: session.recording?.recordingId ?? null,
    sessionId: session.sessionId,
  };
}

async function fetchTrackingV2Bootstrap(): Promise<{
  bootstrap: TrackingV2PublicBootstrap;
  ogImageUrl: string;
}> {
  const response = await fetch(`${apiOrigin}/${workspaceSlug}/${siteSlug}/${recipientSlug}`, {
    headers: {
      "user-agent": "Mozilla/5.0 LightsiteTrackingSmoke Chrome/126.0",
    },
  });
  const html = await response.text();

  assert(response.ok, `Expected v2 public HTML to load, got ${response.status}: ${html.slice(0, 200)}`);
  assert(html.includes('data-ls-track="tab"'), "Expected public HTML to include trackable sidebar tabs.");
  assert(html.includes('data-ls-element-kind="sidebar_link"'), "Expected public HTML to include trackable sidebar links.");
  assert(html.includes('data-ls-element-kind="sidebar_button"'), "Expected public HTML to include trackable sidebar buttons.");
  assert(html.includes('data-ls-element-href="https://example.com/proposal"'), "Expected sidebar link tracking href to be sanitized.");
  assert(!html.includes('data-ls-element-href="https://example.com/proposal?secret='), "Expected sidebar tracking metadata to omit query strings.");

  const match = html.match(/data-lightsite-tracking-v2="([^"]+)"/);
  assert(match?.[1], "Public HTML did not include a tracking v2 bootstrap.");
  const ogImageMatch = html.match(/property="og:image" content="([^"]+)"/);
  assert(ogImageMatch?.[1], "Public HTML did not include a tracking v2 OG image URL.");

  const bootstrap = JSON.parse(decodeHtmlAttribute(match[1])) as TrackingV2PublicBootstrap;
  assert(bootstrap.version === 2, "Expected tracking v2 bootstrap version 2.");
  assert(
    bootstrap.trackingMode === "events" || bootstrap.trackingMode === "events_and_recording",
    `Expected active v2 tracking mode, got ${bootstrap.trackingMode}.`,
  );

  return {
    bootstrap,
    ogImageUrl: decodeHtmlAttribute(ogImageMatch[1]),
  };
}

async function startTrackingV2Session(bootstrap: TrackingV2PublicBootstrap): Promise<TrackingSmokeSession> {
  const startedAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}${TRACKING_V2_SESSION_START_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.42",
      "cf-ipcity": "Tampa",
      "cf-region": "FL",
      "cf-ipcountry": "US",
      "user-agent": "Mozilla/5.0 Chrome/126.0",
    },
    body: JSON.stringify({
      contextToken: bootstrap.contextToken,
      startedAt,
      page: {
        path: `/${siteSlug}/${recipientSlug}`,
        title: "Tracking smoke recipient",
        referrerHost: "example.com",
      },
      viewport: {
        width: 1366,
        height: 768,
      },
      device: {
        deviceId: `device_tracking_smoke_${Date.now().toString(36)}`,
        timezone: "America/New_York",
        locale: "en-US",
        userAgent: "Mozilla/5.0 Chrome/126.0",
      },
    }),
  });
  const body = await response.json().catch(() => null);

  assert(response.ok && body?.accepted === true, `Expected tracking v2 session start, got ${response.status}: ${JSON.stringify(body)}`);
  assert(typeof body.sessionId === "string", "Expected tracking v2 start to return a session id.");
  assert(typeof body.eventToken === "string", "Expected tracking v2 start to return an event token.");
  if (includeRecording) {
    assert(body.recordingAccepted === true, `Expected tracking v2 recording to be accepted, got ${JSON.stringify(body?.recording)}.`);
    assert(body.recording?.enabled === true, "Expected tracking v2 start to return recording upload config.");
    assert(typeof body.recording.recordingId === "string", "Expected tracking v2 start to return recording id.");
    assert(typeof body.recording.uploadToken === "string", "Expected tracking v2 start to return recording upload token.");
    assert(typeof body.recording.chunkEndpoint === "string", "Expected tracking v2 start to return recording chunk endpoint.");
    assert(typeof body.recording.completeEndpoint === "string", "Expected tracking v2 start to return recording complete endpoint.");
  }

  return {
    eventToken: body.eventToken as string,
    recording: body.recording?.enabled === true
      ? {
          chunkEndpoint: body.recording.chunkEndpoint as string,
          completeEndpoint: body.recording.completeEndpoint as string,
          recordingId: body.recording.recordingId as string,
          uploadToken: body.recording.uploadToken as string,
        }
      : null,
    sessionId: body.sessionId as string,
  };
}

async function postTrackingV2Events(session: TrackingSmokeSession) {
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${apiOrigin}${TRACKING_V2_EVENTS_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batchId: `batch_tracking_v2_smoke_${Date.now().toString(36)}`,
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      scriptVersion: TRACKING_V2_SCRIPT_VERSION,
      sentAt: occurredAt,
      events: [
        {
          eventId: `event_tracking_v2_visit_${Date.now().toString(36)}`,
          type: "site_visit",
          occurredAt,
          sequence: 0,
          page: {
            path: `/${siteSlug}/${recipientSlug}`,
            title: "Tracking smoke recipient",
            referrerHost: "example.com",
          },
          viewport: {
            width: 1366,
            height: 768,
          },
          tab: {
            kind: "tab",
            id: "overview",
            label: "Overview",
          },
        },
        {
          eventId: `event_tracking_v2_link_${Date.now().toString(36)}`,
          type: "link_click",
          occurredAt,
          sequence: 1,
          element: {
            kind: "sidebar_link",
            id: "smoke-link",
            label: "Open example",
            href: "https://example.com/smoke",
          },
        },
        {
          eventId: `event_tracking_v2_button_${Date.now().toString(36)}`,
          type: "button_click",
          occurredAt,
          sequence: 2,
          element: {
            kind: "sidebar_button",
            id: "smoke-sidebar-button",
            label: "Book review",
            href: "https://example.com/book",
          },
        },
        {
          eventId: `event_tracking_v2_tab_${Date.now().toString(36)}`,
          type: "tab_switch",
          occurredAt,
          sequence: 3,
          element: {
            kind: "tab",
            id: "pricing",
            label: "Pricing",
          },
          fromTabLabel: "Overview",
        },
      ],
    }),
  });

  assert(response.status === 204, `Expected tracking v2 events ingest 204, got ${response.status}: ${await response.text()}`);
}

async function postTrackingV2Heartbeat(session: TrackingSmokeSession) {
  const response = await fetch(`${apiOrigin}${TRACKING_V2_SESSION_HEARTBEAT_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: new Date(Date.now() + 2500).toISOString(),
      activeMs: 2500,
      maxScrollDepthPercent: 80,
      page: {
        path: `/${siteSlug}/${recipientSlug}`,
        title: "Tracking smoke recipient",
        referrerHost: "example.com",
      },
    }),
  });

  assert(response.status === 204, `Expected tracking v2 heartbeat 204, got ${response.status}: ${await response.text()}`);
}

async function recordTrackingV2Recording(session: TrackingSmokeSession) {
  assert(session.recording, "Expected recording smoke to have upload config.");

  const firstEventAt = Date.now() + 1_000;
  const lastEventAt = Date.now() + 2_200;
  const chunkResponse = await fetch(`${apiOrigin}${session.recording.chunkEndpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.recording.uploadToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 3,
      sessionId: session.sessionId,
      sequence: 0,
      events: [
        {
          type: 4,
          timestamp: firstEventAt,
          data: {
            href: `${apiOrigin}/${siteSlug}/${recipientSlug}`,
            height: 768,
            width: 1366,
          },
        },
        {
          type: 2,
          timestamp: firstEventAt + 100,
          data: {
            initialOffset: { left: 0, top: 0 },
            node: { childNodes: [], id: 1, type: 0 },
          },
        },
        {
          type: 3,
          timestamp: firstEventAt + 700,
          data: {
            positions: [{ id: 1, timeOffset: 0, x: 260, y: 210 }],
            source: 1,
          },
        },
        {
          type: 3,
          timestamp: lastEventAt,
          data: {
            id: 1,
            source: 3,
            x: 0,
            y: 420,
          },
        },
      ],
      compressed: false,
    }),
  });
  const chunkBody = await chunkResponse.json().catch(() => null);

  assert(
    chunkResponse.status === 201 && chunkBody?.accepted === true && chunkBody?.sequence === 0,
    `Expected tracking v2 recording chunk upload, got ${chunkResponse.status}: ${JSON.stringify(chunkBody)}`,
  );

  const completeResponse = await fetch(`${apiOrigin}${session.recording.completeEndpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.recording.uploadToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 3,
      sessionId: session.sessionId,
      finalSequence: 0,
      endedAt: new Date(Date.now() + 2_600).toISOString(),
      stopReason: "ended",
    }),
  });
  const completeBody = await completeResponse.json().catch(() => null);

  assert(
    completeResponse.ok && completeBody?.completed === true && completeBody?.status === "available",
    `Expected tracking v2 recording completion, got ${completeResponse.status}: ${JSON.stringify(completeBody)}`,
  );
}

async function recordTrackingV2SlackShare(ogImageUrl: string) {
  const parsed = new URL(ogImageUrl, apiOrigin);
  const response = await fetch(`${apiOrigin}${parsed.pathname}${parsed.search}`, {
    headers: {
      "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    },
  });

  const image = Buffer.from(await response.arrayBuffer());
  assert(response.ok, `Expected v2 Slack OG image to load, got ${response.status}.`);
  assert(response.headers.get("content-type")?.includes("image/jpeg"), "Expected v2 Slack OG image route to return JPEG.");
  assert(image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff, "Expected v2 Slack OG image bytes to be a JPEG.");
  const dimensions = readJpegDimensions(image);
  assert(dimensions.width === 1200 && dimensions.height === 630, "Expected v2 Slack OG image to be 1200 by 630.");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function endTrackingV2Session(session: TrackingSmokeSession) {
  const response = await fetch(`${apiOrigin}${TRACKING_V2_SESSION_END_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: session.sessionId,
      eventToken: session.eventToken,
      occurredAt: new Date(Date.now() + 5000).toISOString(),
      reason: "pagehide",
      activeMs: 3000,
    }),
  });

  assert(response.status === 204, `Expected tracking v2 session end 204, got ${response.status}: ${await response.text()}`);
}

async function readTrackingV2Events(sessionId: string) {
  const firstPage = await readTrackingV2Json<{
    events: Array<{
      type: string;
      source: string;
      sessionId: string | null;
      site: { id: string; name: string };
      recipient: { id: string; recipientName: string | null; recipientCompany: string | null } | null;
      session: { id: string; location: { city: string | null; region: string | null; countryCode: string | null }; device: { browser: string | null } } | null;
      element: { label: string } | null;
    }>;
    nextCursor: string | null;
  }>(
    `/api/workspaces/${workspaceId}/tracking/v2/events?siteId=${siteId}&recipientId=${recipientId}&limit=2&from=${encodeURIComponent(
      new Date(Date.now() - 60_000).toISOString(),
    )}`,
    "tracking v2 events first page",
  );

  assert(firstPage.events.length === 2, `Expected first v2 events page to contain 2 events, got ${firstPage.events.length}.`);
  assert(firstPage.nextCursor, "Expected v2 events first page to return a next cursor.");
  for (const event of firstPage.events) {
    assert(event.site.id === siteId, "Expected v2 event to include the smoke site.");
    assert(event.recipient?.id === recipientId, "Expected v2 event to include the smoke recipient.");
    if (event.type === "slack_share") {
      assert(event.source === "slack_og_image", "Expected Slack share to use the Slack OG image source.");
      assert(event.sessionId === null && event.session === null, "Expected Slack share to be a server event without a browser session.");
    } else {
      assert(event.sessionId === sessionId, "Expected v2 browser event to include the public session id.");
      assert(event.session?.location.city === "Tampa", "Expected v2 event session city to be Tampa.");
      assert(event.session?.device.browser === "Chrome", "Expected v2 event device browser to be Chrome.");
    }
  }

  const paginatedEvents: Array<{ type: string }> = [...firstPage.events];
  let nextCursor: string | null = firstPage.nextCursor;

  for (let pageNumber = 2; nextCursor && pageNumber <= 10; pageNumber += 1) {
    const page = await readTrackingV2Json<{
      events: Array<{ type: string; sessionId: string | null }>;
      nextCursor: string | null;
    }>(
      `/api/workspaces/${workspaceId}/tracking/v2/events?siteId=${siteId}&recipientId=${recipientId}&limit=2&cursor=${encodeURIComponent(nextCursor)}`,
      `tracking v2 events page ${pageNumber}`,
    );

    paginatedEvents.push(...page.events);
    nextCursor = page.nextCursor;
  }

  assert(nextCursor === null, "Expected v2 events cursor chain to end within 10 pages.");
  const eventTypes = new Set(paginatedEvents.map((event) => event.type));

  for (const type of ["site_visit", "button_click", "link_click", "tab_switch", "slack_share"]) {
    assert(eventTypes.has(type), `Expected v2 event feed to include ${type}.`);
  }
}

async function readTrackingV2Sessions(sessionId: string) {
  const body = await readTrackingV2Json<{
    sessions: Array<{
      id: string;
      state: string;
      site: { id: string };
      recipient: { id: string; recipientName: string | null; recipientCompany: string | null } | null;
      ipAddress: string | null;
      location: { city: string | null; region: string | null; countryCode: string | null };
      device: { type: string | null; browser: string | null };
      activeMs: number;
      maxScrollDepthPercent: number | null;
      recording: { status: string; available: boolean };
    }>;
  }>(
    `/api/workspaces/${workspaceId}/tracking/v2/sessions?siteId=${siteId}&recipientId=${recipientId}&state=ended&from=${encodeURIComponent(
      new Date(Date.now() - 60_000).toISOString(),
    )}`,
    "tracking v2 sessions",
  );
  const session = body.sessions.find((candidate) => candidate.id === sessionId);

  assert(session, "Expected v2 sessions response to include the smoke session.");
  assert(session.state === "ended", `Expected v2 session to be ended, got ${session.state}.`);
  assert(session.site.id === siteId, "Expected v2 session to include the smoke site.");
  assert(session.recipient?.id === recipientId, "Expected v2 session to include the smoke recipient.");
  assert(session.recipient.recipientName === "Riley Smoke", "Expected v2 session to include the recipient name.");
  assert(session.ipAddress === "203.0.113.42", `Expected v2 session IP to be stored, got ${session.ipAddress}.`);
  assert(session.location.city === "Tampa" && session.location.region === "FL" && session.location.countryCode === "US", "Expected v2 session location to be Tampa, FL, US.");
  assert(session.device.type === "desktop" && session.device.browser === "Chrome", "Expected v2 session device to be desktop Chrome.");
  assert(session.activeMs >= 2500, `Expected v2 session active time to include heartbeat activity, got ${session.activeMs}.`);
  assert(session.maxScrollDepthPercent === 80, `Expected v2 session max scroll depth to be 80, got ${session.maxScrollDepthPercent}.`);
  if (includeRecording) {
    assert(session.recording.status === "available" && session.recording.available === true, "Expected v2 session recording to be available.");
  } else {
    assert(session.recording.status === "disabled" && session.recording.available === false, "Expected v2 session recording to be disabled.");
  }
}

async function readTrackingV2SessionDetail(sessionId: string) {
  const body = await readTrackingV2Json<{
    session: {
      id: string;
      state: string;
      recipient: { id: string } | null;
      location: { city: string | null };
      recording: { status: string; available: boolean };
    };
  }>(
    `/api/workspaces/${workspaceId}/tracking/v2/sessions/${sessionId}`,
    "tracking v2 session detail",
  );

  assert(body.session.id === sessionId, "Expected v2 session detail to return the requested session.");
  assert(body.session.recipient?.id === recipientId, "Expected v2 session detail to include recipient.");
  assert(body.session.location.city === "Tampa", "Expected v2 session detail to include location.");
  if (includeRecording) {
    assert(body.session.recording.status === "available" && body.session.recording.available === true, "Expected v2 session detail recording to be available.");
  } else {
    assert(body.session.recording.status === "disabled" && body.session.recording.available === false, "Expected v2 session detail recording to be disabled.");
  }
}

async function readTrackingV2Recording(sessionId: string, recordingId: string) {
  const manifest = await readTrackingV2Json<{
    chunkCount: number;
    chunks: Array<{
      eventCount: number;
      sequence: number;
    }>;
    eventCount: number;
    recordingId: string;
    sessionId: string;
    status: string;
  }>(
    `/api/workspaces/${workspaceId}/tracking/v2/sessions/${sessionId}/recording`,
    "tracking v2 recording manifest",
  );

  assert(manifest.recordingId === recordingId, "Expected v2 recording manifest to return the requested recording.");
  assert(manifest.sessionId === sessionId, "Expected v2 recording manifest to include the public session id.");
  assert(manifest.status === "available", `Expected v2 recording manifest to be available, got ${manifest.status}.`);
  assert(manifest.chunkCount === 1 && manifest.chunks.length === 1, `Expected v2 recording manifest to include one chunk, got ${manifest.chunkCount}.`);
  assert(manifest.eventCount >= 4, `Expected v2 recording manifest to count smoke events, got ${manifest.eventCount}.`);
  assert(manifest.chunks[0]?.sequence === 0, "Expected v2 recording manifest to expose chunk 0.");
  assert(manifest.chunks[0]?.eventCount === 4, `Expected v2 recording chunk event count to be 4, got ${manifest.chunks[0]?.eventCount}.`);

  const chunk = await readTrackingV2Json<{
    events: Array<{ type?: number }>;
    schemaVersion: number;
    sequence: number;
    sessionId: string;
  }>(
    `/api/workspaces/${workspaceId}/tracking/v2/recordings/${recordingId}/chunks/0`,
    "tracking v2 recording chunk",
  );
  const eventTypes = new Set(chunk.events.map((event) => event.type));

  assert(
    chunk.schemaVersion === TRACKING_V2_RECORDING_SCHEMA_VERSION,
    `Expected v2 recording chunk schema version ${TRACKING_V2_RECORDING_SCHEMA_VERSION}.`,
  );
  assert(chunk.sessionId === sessionId, "Expected v2 recording chunk to include the public session id.");
  assert(chunk.sequence === 0, "Expected v2 recording chunk to return sequence 0.");
  for (const type of [2, 3, 4]) {
    assert(eventTypes.has(type), `Expected v2 recording chunk to include rrweb event ${type}.`);
  }
}

async function assertReadAbuseIsRejected() {
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/v2/events?cursor=${"a".repeat(2050)}`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/v2/events?cursor=not-a-valid-cursor`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/v2/sessions?from=not-a-date`,
    400,
    "tracking.invalid_payload",
  );
  await assertGetError(
    "/api/workspaces/00000000-0000-4000-8000-000000000999/tracking/v2/sessions",
    404,
    "workspace.access_denied",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/events`,
    404,
    "route.not_found",
  );
  await assertGetError(
    `/api/workspaces/${workspaceId}/tracking/summary`,
    404,
    "route.not_found",
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

async function assertV2ContextStopsAfterUnpublish(bootstrap: TrackingV2PublicBootstrap) {
  const response = await fetch(`${apiOrigin}${TRACKING_V2_SESSION_START_ENDPOINT}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contextToken: bootstrap.contextToken,
      startedAt: new Date().toISOString(),
      page: {
        path: `/${siteSlug}/${recipientSlug}`,
        title: "Tracking smoke recipient",
        referrerHost: null,
      },
      viewport: {
        width: 1366,
        height: 768,
      },
      device: {
        deviceId: `device_tracking_smoke_stale_${Date.now().toString(36)}`,
        timezone: "America/New_York",
        locale: "en-US",
        userAgent: "Mozilla/5.0 Chrome/126.0",
      },
    }),
  });
  const body = await response.json().catch(() => null);

  assert(
    response.ok && body?.accepted === false && body?.reason === "disabled",
    `Expected unpublished v2 context to stop tracking, got ${response.status}: ${JSON.stringify(body)}`,
  );
}

async function cleanup(sql: Awaited<ReturnType<typeof importDbClient>>) {
  await cleanupRecordingObjectFiles();
  await sql`delete from sites where id = ${siteId}`;
}

async function cleanupRecordingObjectFiles() {
  if (!recordingIdToCleanup) {
    return;
  }

  const storageDirectory = process.env.TRACKING_RECORDING_STORAGE_DIR
    ? resolve(process.env.TRACKING_RECORDING_STORAGE_DIR)
    : resolve(process.cwd(), ".local/tracking-recordings");
  const recordingDirectory = resolve(
    storageDirectory,
    "tracking-recordings",
    workspaceId,
    recordingIdToCleanup,
  );

  await rm(recordingDirectory, { force: true, recursive: true });
}

async function assertGetError(path: string, status: number, code: string) {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {
      "x-lightsite-dev-auth": "1",
    },
  });

  await assertErrorResponse(response, status, code);
}

async function readTrackingV2Json<TBody>(path: string, label: string): Promise<TBody> {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {
      "x-lightsite-dev-auth": "1",
    },
  });
  const body = await response.json().catch(() => null);

  assert(response.ok, `Expected ${label} read to succeed, got ${response.status}: ${JSON.stringify(body)}`);

  return body as TBody;
}

async function writeTrackingV2Json<TBody>(
  path: string,
  body: Record<string, unknown>,
  label: string,
): Promise<TBody> {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-lightsite-dev-auth": "1",
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => null);

  assert(response.ok, `Expected ${label} write to succeed, got ${response.status}: ${JSON.stringify(responseBody)}`);

  return responseBody as TBody;
}

function siteSettingsBody(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    captureIpAddress: true,
    rawIpRetentionDays: 30,
    eventRetentionDays: 365,
    recordingEnabled: false,
    recordingRetentionDays: 30,
    maxRecordingDurationSeconds: 600,
    ...overrides,
  };
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

function readJpegDimensions(image: Buffer) {
  const sizeMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;

  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = image[offset + 1];
    if (marker !== undefined && sizeMarkers.has(marker)) {
      return {
        height: image.readUInt16BE(offset + 5),
        width: image.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    offset += 2 + image.readUInt16BE(offset + 2);
  }

  throw new Error("JPEG dimensions were not found.");
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
