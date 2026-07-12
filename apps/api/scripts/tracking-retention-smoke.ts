import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createFileTrackingV2RecordingObjectStore } from "../src/tracking/v2/recording-object-store";
import { createDbTrackingV2Repository } from "../src/tracking/v2/repository";
import { createTrackingV2RetentionService } from "../src/tracking/v2/retention";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../../..");
config({ path: resolve(rootDir, ".env"), quiet: true });

const workspaceId = randomUUID();
const siteId = randomUUID();
const versionId = randomUUID();
const recipientId = randomUUID();
const oldSessionId = randomUUID();
const staleActiveSessionId = randomUUID();
const freshSessionId = randomUUID();
const recordingSessionId = randomUUID();
const recordingId = randomUUID();
const oldEventId = randomUUID();
const freshEventId = randomUUID();
const expiredMarkerId = randomUUID();
const freshMarkerId = randomUUID();
const now = new Date();
const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 60_000);
const stale = new Date(now.getTime() - 5 * 60_000);
const fresh = new Date(now.getTime() - 60_000);
const storageDir = resolve(rootDir, ".local", `tracking-retention-smoke-${Date.now().toString(36)}`);
const recordingObjectKey = `tracking-recordings/${workspaceId}/${recordingId}/chunks/000000.json`;
let queryClient: Awaited<ReturnType<typeof importDbClient>> | null = null;

async function main() {
  const { db, queryClient: importedQueryClient } = await import("@lightsite/db");
  queryClient = importedQueryClient;
  const repository = createDbTrackingV2Repository(db);
  const objectStore = createFileTrackingV2RecordingObjectStore(storageDir);

  try {
    await assertDatabaseIsReachable();
    await seed();
    await objectStore.putObject({
      key: recordingObjectKey,
      body: Buffer.from("{\"type\":\"snapshot\"}", "utf8"),
      contentType: "application/json; charset=utf-8",
    });

    const service = createTrackingV2RetentionService({
      repository,
      recordingObjectStore: objectStore,
      now: () => now,
    });
    const result = await service.runOnce({
      batchSize: 100,
      objectBatchSize: 100,
    });

    assert(result.rawIpAddressesPruned >= 1, "Expected at least one raw IP address to be pruned.");
    assert(result.suppressionMarkersDeleted === 1, `Expected one expired marker deleted, got ${result.suppressionMarkersDeleted}.`);
    assert(result.eventsDeleted === 1, `Expected one expired event deleted, got ${result.eventsDeleted}.`);
    assert(result.recordingsExpired === 1, `Expected one recording expired, got ${result.recordingsExpired}.`);
    assert(result.recordingChunkObjectsDeleted === 1, `Expected one recording object deleted, got ${result.recordingChunkObjectsDeleted}.`);
    assert(result.recordingChunkMetadataDeleted === 1, `Expected one recording chunk metadata row deleted, got ${result.recordingChunkMetadataDeleted}.`);
    assert(result.recordingsDeleted === 1, `Expected one recording marked deleted, got ${result.recordingsDeleted}.`);
    assert(result.sessionsDeleted === 1, `Expected one old non-recording session deleted, got ${result.sessionsDeleted}.`);

    await assertRowCount("old session", "tracking_recipient_sessions", oldSessionId, 0);
    await assertRowCount("stale active session", "tracking_recipient_sessions", staleActiveSessionId, 1);
    await assertRowCount("fresh session", "tracking_recipient_sessions", freshSessionId, 1);
    await assertRowCount("recording session", "tracking_recipient_sessions", recordingSessionId, 1);
    await assertRowCount("old event", "tracking_recipient_events", oldEventId, 0);
    await assertRowCount("fresh event", "tracking_recipient_events", freshEventId, 1);
    await assertRowCount("expired marker", "tracking_suppression_markers", expiredMarkerId, 0);
    await assertRowCount("fresh marker", "tracking_suppression_markers", freshMarkerId, 1);

    const [recording] = await queryClient`
      select status
      from tracking_recordings
      where id = ${recordingId}
    `;
    assert(recording?.status === "deleted", `Expected recording status deleted, got ${recording?.status}.`);

    const [staleSession] = await queryClient`
      select state, ended_at, last_seen_at, end_reason, duration_ms
      from tracking_recipient_sessions
      where id = ${staleActiveSessionId}
    `;
    assert(staleSession?.state === "expired", `Expected stale session state expired, got ${staleSession?.state}.`);
    assert(staleSession?.end_reason === "server_expired", `Expected server_expired reason, got ${staleSession?.end_reason}.`);
    assert(
      new Date(staleSession?.ended_at).getTime() === new Date(staleSession?.last_seen_at).getTime(),
      "Expected stale session to end at last_seen_at.",
    );
    assert(staleSession?.duration_ms === 0, `Expected stale session duration 0, got ${staleSession?.duration_ms}.`);

    const [recordingSession] = await queryClient`
      select recording_status, ip_address
      from tracking_recipient_sessions
      where id = ${recordingSessionId}
    `;
    assert(recordingSession?.recording_status === "expired", `Expected session recording_status expired, got ${recordingSession?.recording_status}.`);
    assert(recordingSession?.ip_address === "203.0.113.12", "Expected fresh recording session IP to remain.");

    const deletedObject = await objectStore.getObject(recordingObjectKey);
    assert(deletedObject === null, "Expected recording object to be deleted.");

    console.log("Tracking retention smoke passed.");
  } finally {
    await cleanup().catch((error) => {
      console.warn("Tracking retention smoke cleanup failed.", error);
    });
    await queryClient?.end();
  }
}

async function assertDatabaseIsReachable() {
  const sql = requireQueryClient();
  try {
    await sql`select 1`;
  } catch (error) {
    throw new Error(`Postgres is not reachable through DATABASE_URL. ${formatErrorCause(error)}`);
  }
}

async function seed() {
  const sql = requireQueryClient();
  const content = {
    schemaVersion: 3,
    themeMode: "dark",
    settings: { allowSearchIndexing: false },
    variables: [],
    pages: [{
      id: "retention-page",
      name: "Overview",
      slug: "overview",
      status: "visible",
      sortOrder: 0,
      document: { type: "doc", content: [{ type: "paragraph" }] },
    }],
    sidebar: {
      sections: {
        tabs: { label: "Tabs" },
        links: { label: "Links" },
        nextSteps: { label: "Next steps" },
      },
      links: [],
      nextSteps: [],
    },
  };

  await sql.begin(async (transaction) => {
    await transaction`
      insert into workspaces (id, name, slug, website_domain, plan, status, updated_at)
      values (${workspaceId}, 'Retention Smoke Workspace', ${`retention-${workspaceId.slice(0, 8)}`}, 'lightsite.test', 'pro', 'active', ${now.toISOString()}::timestamptz)
    `;
    await transaction`
      insert into sites (
        id,
        workspace_id,
        created_by_user_id,
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
        'retention_smoke_user',
        'Retention smoke site',
        ${`retention-${siteId.slice(0, 8)}`},
        'published',
        'team',
        ${JSON.stringify(content)}::jsonb,
        1,
        ${now.toISOString()}::timestamptz,
        ${now.toISOString()}::timestamptz
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
        'Retention smoke publish',
        ${JSON.stringify(content)}::jsonb,
        ${"[]"}::jsonb,
        'retention_smoke_user',
        ${now.toISOString()}::timestamptz,
        ${"{\"smoke\":true}"}::jsonb
      )
    `;
    await transaction`
      update sites
      set published_version_id = ${versionId}
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
        'Retention smoke recipient',
        ${`recipient-${recipientId.slice(0, 8)}`},
        'Retention Recipient',
        'Retention Co',
        ${"{}"}::jsonb,
        1,
        'active',
        ${now.toISOString()}::timestamptz
      )
    `;
    await transaction`
      insert into tracking_settings (
        workspace_id,
        scope,
        enabled,
        capture_ip_address,
        raw_ip_retention_days,
        event_retention_days,
        recording_enabled,
        recording_retention_days,
        max_recording_duration_seconds,
        updated_at
      )
      values (
        ${workspaceId},
        'workspace',
        true,
        true,
        1,
        1,
        true,
        1,
        600,
        ${now.toISOString()}::timestamptz
      )
    `;

    await insertSession(transaction, {
      id: oldSessionId,
      publicSessionId: `session_old_${oldSessionId}`,
      startedAt: old,
      ipAddress: "203.0.113.10",
      recordingStatus: "disabled",
    });
    await insertSession(transaction, {
      id: freshSessionId,
      publicSessionId: `session_fresh_${freshSessionId}`,
      startedAt: fresh,
      ipAddress: "203.0.113.11",
      recordingStatus: "disabled",
    });
    await insertSession(transaction, {
      id: staleActiveSessionId,
      publicSessionId: `session_stale_${staleActiveSessionId}`,
      startedAt: stale,
      ipAddress: "203.0.113.13",
      recordingStatus: "disabled",
      state: "active",
    });
    await insertSession(transaction, {
      id: recordingSessionId,
      publicSessionId: `session_recording_${recordingSessionId}`,
      startedAt: fresh,
      ipAddress: "203.0.113.12",
      recordingStatus: "available",
    });

    await transaction`
      insert into tracking_recipient_events (
        id,
        event_id,
        batch_id,
        session_id,
        workspace_id,
        site_id,
        recipient_id,
        published_version_id,
        type,
        source,
        event_data,
        occurred_at,
        received_at
      )
      values (
        ${oldEventId},
        ${`event_old_${oldEventId}`},
        'batch_old',
        ${oldSessionId},
        ${workspaceId},
        ${siteId},
        ${recipientId},
        ${versionId},
        'site_visit',
        'browser',
        ${"{}"}::jsonb,
        ${old.toISOString()}::timestamptz,
        ${old.toISOString()}::timestamptz
      ), (
        ${freshEventId},
        ${`event_fresh_${freshEventId}`},
        'batch_fresh',
        ${freshSessionId},
        ${workspaceId},
        ${siteId},
        ${recipientId},
        ${versionId},
        'site_visit',
        'browser',
        ${"{}"}::jsonb,
        ${fresh.toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz
      )
    `;
    await transaction`
      insert into tracking_recordings (
        id,
        workspace_id,
        site_id,
        recipient_id,
        session_id,
        public_session_id,
        status,
        runtime_version,
        upload_token_hash,
        max_duration_ms,
        max_chunk_bytes,
        max_events,
        started_at,
        ended_at,
        duration_ms,
        event_count,
        chunk_count,
        compressed_bytes,
        object_prefix,
        expires_at,
        updated_at
      )
      values (
        ${recordingId},
        ${workspaceId},
        ${siteId},
        ${recipientId},
        ${recordingSessionId},
        ${`session_recording_${recordingSessionId}`},
        'available',
        'retention-smoke',
        'upload_hash',
        60000,
        61440,
        100,
        ${fresh.toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz,
        1000,
        1,
        1,
        19,
        ${`tracking-recordings/${workspaceId}/${recordingId}`},
        ${old.toISOString()}::timestamptz,
        ${now.toISOString()}::timestamptz
      )
    `;
    await transaction`
      insert into tracking_recording_chunks (
        recording_id,
        workspace_id,
        session_id,
        public_session_id,
        sequence,
        object_key,
        event_count,
        compressed_bytes,
        uncompressed_bytes,
        checksum_sha256,
        first_event_at,
        last_event_at,
        received_at
      )
      values (
        ${recordingId},
        ${workspaceId},
        ${recordingSessionId},
        ${`session_recording_${recordingSessionId}`},
        0,
        ${recordingObjectKey},
        1,
        19,
        19,
        ${"1".padStart(64, "0")},
        ${fresh.toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz
      )
    `;
    await transaction`
      insert into tracking_suppression_markers (
        id,
        workspace_id,
        user_id,
        marker_type,
        marker_hash,
        label,
        first_seen_at,
        last_seen_at,
        expires_at,
        updated_at
      )
      values (
        ${expiredMarkerId},
        ${workspaceId},
        null,
        'device_id',
        'expired_marker_hash',
        'Expired marker',
        ${old.toISOString()}::timestamptz,
        ${old.toISOString()}::timestamptz,
        ${old.toISOString()}::timestamptz,
        ${old.toISOString()}::timestamptz
      ), (
        ${freshMarkerId},
        ${workspaceId},
        null,
        'device_id',
        'fresh_marker_hash',
        'Fresh marker',
        ${fresh.toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz,
        ${new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()}::timestamptz,
        ${fresh.toISOString()}::timestamptz
      )
    `;
  });
}

async function insertSession(
  transaction: Parameters<Parameters<Awaited<ReturnType<typeof importDbClient>>["begin"]>[0]>[0],
  input: {
    id: string;
    publicSessionId: string;
    startedAt: Date;
    ipAddress: string;
    recordingStatus: "disabled" | "available";
    state?: "active" | "ended";
  },
) {
  await transaction`
    insert into tracking_recipient_sessions (
      id,
      public_session_id,
      workspace_id,
      site_id,
      recipient_id,
      published_version_id,
      state,
      event_token_hash,
      device_id_hash,
      ip_address,
      ip_address_hash,
      city,
      region,
      country_code,
      device_type,
      os_name,
      browser_name,
      user_agent_family,
      referrer_host,
      initial_path,
      started_at,
      last_seen_at,
      recording_status,
      updated_at
    )
    values (
      ${input.id},
      ${input.publicSessionId},
      ${workspaceId},
      ${siteId},
      ${recipientId},
      ${versionId},
      ${input.state ?? "ended"},
      ${`event_hash_${input.id}`},
      ${`device_hash_${input.id}`},
      ${input.ipAddress},
      ${`ip_hash_${input.id}`},
      'Tampa',
      'FL',
      'US',
      'desktop',
      'macOS',
      'Chrome',
      'Chrome',
      null,
      '/retention',
      ${input.startedAt.toISOString()}::timestamptz,
      ${input.startedAt.toISOString()}::timestamptz,
      ${input.recordingStatus},
      ${now.toISOString()}::timestamptz
    )
  `;
}

async function assertRowCount(label: string, table: string, id: string, expected: number) {
  const sql = requireQueryClient();
  const [row] = await sql`
    select count(*)::int as count
    from ${sql(table)}
    where id = ${id}
  `;

  assert(row?.count === expected, `Expected ${label} count ${expected}, got ${row?.count}.`);
}

async function cleanup() {
  const sql = queryClient;
  if (sql) {
    await sql`delete from workspaces where id = ${workspaceId}`;
  }
  await rm(storageDir, { recursive: true, force: true });
}

async function importDbClient() {
  const { queryClient: importedQueryClient } = await import("@lightsite/db");
  return importedQueryClient;
}

function requireQueryClient() {
  if (!queryClient) {
    throw new Error("Database client has not been initialized.");
  }

  return queryClient;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
