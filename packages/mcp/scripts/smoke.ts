import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const devWorkspaceId = "00000000-0000-4000-8000-000000000101";
const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--filter", "@handout/mcp", "exec", "tsx", "src/index.ts"],
  env: {
    ...process.env,
    HANDOUT_API_BASE_URL: process.env.HANDOUT_API_BASE_URL ?? "http://localhost:3011",
    HANDOUT_DEV_AUTH: process.env.HANDOUT_DEV_AUTH ?? "1",
    HANDOUT_AGENT_WORKSPACE_ID: process.env.HANDOUT_AGENT_WORKSPACE_ID ?? devWorkspaceId,
    HANDOUT_AGENT_WORKSPACE_SLUG: process.env.HANDOUT_AGENT_WORKSPACE_SLUG ?? "handout-dev",
    HANDOUT_PUBLIC_SITE_ORIGIN: process.env.HANDOUT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3011",
    HANDOUT_WEB_ORIGIN: process.env.HANDOUT_WEB_ORIGIN ?? "http://localhost:5173",
  },
});
const client = new Client({ name: "handout-live-abuse-smoke", version: "1.0.0" });
const calledTools = new Set<string>();
const printedTools = new Set<string>();
const cleanup: Array<() => Promise<void>> = [];
const expectedTools = [
  "handout_get_capabilities", "handout_get_block_schemas", "handout_get_workspace_context",
  "handout_list_sites", "handout_create_site", "handout_get_site", "handout_edit_site",
  "handout_duplicate_site", "handout_validate_site", "handout_set_site_access",
  "handout_publish_site", "handout_unpublish_site", "handout_restore_site_version",
  "handout_set_site_lifecycle", "handout_upsert_variants", "handout_list_assets",
  "handout_import_asset", "handout_get_tracking_summary", "handout_query_tracking",
  "handout_manage_automation", "handout_delete",
];

await client.connect(transport);
try {
  const capabilities = data(await call("handout_get_capabilities", {}));
  assert(record(capabilities.toolSurface).count === 21, "capabilities must report the 21-tool surface");
  assert(record(record(capabilities.siteContent).schemaDiscovery).targetedTool === "handout_get_block_schemas", "capabilities must route block discovery");

  const schemas = data(await call("handout_get_block_schemas", { nodeTypes: ["pageTitleSection", "buttonBlock"], includeMarks: true }));
  assert(array(schemas.nodes).some((node) => record(node).type === "pageTitleTitle"), "schema discovery must include dependencies");
  await expectError("handout_get_block_schemas", { nodeTypes: ["inventedBlock"] }, /invalid/i);

  const workspace = data(await call("handout_get_workspace_context", {}));
  assert(record(workspace.workspace).id === devWorkspaceId, "workspace context must resolve the dev workspace");
  await expectError("handout_get_workspace_context", { include: ["automationDetail"] }, /automationId is required/i);
  await call("handout_list_sites", { lifecycle: "all", search: "agent abuse" });

  const created = data(await call("handout_create_site", { name: `Agent abuse ${Date.now()}` }));
  const siteId = string(record(created.site).id);
  cleanup.push(() => hardDeleteSite(siteId));

  const initial = data(await call("handout_get_site", { siteId, include: ["content", "pageSummaries", "variables", "variants", "versions", "publicUrls"] }));
  const initialContent = record(initial.draftContent);
  const initialPage = record(array(initialContent.pages)[0]);
  const revision = number(initial.draftRevision);
  assert(array(initial.pages).length === 1, "new site must expose a page summary");

  await call("handout_edit_site", { siteId, mode: "metadata", name: "Agent abuse refined", slug: `agent-abuse-${Date.now()}` });
  await expectError("handout_edit_site", { siteId, mode: "metadata" }, /requires name or slug/i);
  const edited = data(await call("handout_edit_site", {
    siteId,
    mode: "content",
    expectedDraftRevision: revision,
    operations: [
      { op: "set_theme_mode", themeMode: "dark" },
      { op: "set_settings", settings: { allowSearchIndexing: false } },
      { op: "upsert_variable", variable: { id: "var-company-name", key: "company_name", label: "Company name", type: "text", defaultValue: "your team" } },
      {
        op: "replace_page_document",
        pageId: initialPage.id,
        document: {
          type: "doc",
          content: [
            {
              type: "pageTitleSection",
              attrs: { id: "title-main", align: "center" },
              content: [
                { type: "pageTitleTitle", content: [{ type: "text", text: "A plan for " }, { type: "variableToken", attrs: { variableId: "var-company-name", fallbackName: "your team" } }] },
                { type: "pageTitleSubtitle", content: [{ type: "text", text: "A focused next step." }] },
              ],
            },
            { type: "buttonBlock", attrs: { id: "cta-main", href: "https://example.com", fullWidth: false }, content: [{ type: "text", text: "Continue" }] },
          ],
        },
      },
      {
        op: "upsert_page",
        page: { id: "page-proof", name: "Proof", slug: "proof", status: "visible", sortOrder: 1, document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Concrete proof belongs here." }] }] } },
      },
    ],
  }));
  const nextRevision = number(edited.draftRevision);
  assert(nextRevision === revision + 1, "atomic content edit must advance one revision");
  await expectError("handout_edit_site", { siteId, mode: "content", expectedDraftRevision: revision, operations: [{ op: "set_theme_mode", themeMode: "light" }] }, /revision conflict/i);
  await expectError("handout_edit_site", { siteId, mode: "content", expectedDraftRevision: nextRevision, operations: [{ op: "upsert_variable", variable: { id: "bad", key: "company_name", label: "Duplicate", type: "text", defaultValue: "" } }] }, /already used/i);

  const validation = data(await call("handout_validate_site", { siteId }));
  assert(validation.valid === true, "edited site must validate");
  const invalidValidation = await call("handout_validate_site", { siteId, draftContent: { ...initialContent, schemaVersion: 999 } }, true);
  assert(invalidValidation.isError === true, "invalid proposed content must return a tool error");

  const variantInput = [{ slug: "mira-acme", name: "Mira at Acme", recipientName: "Mira", recipientCompany: "Acme", variableValues: { company_name: "Acme" } }];
  const preview = data(await call("handout_upsert_variants", { siteId, preview: true, variants: variantInput }));
  assert(preview.preview === true, "variant preview must not write");
  const variants = data(await call("handout_upsert_variants", { siteId, variants: variantInput }));
  const variantId = string(record(array(variants.variants)[0]).id);
  await expectError("handout_upsert_variants", { siteId, variants: [{ slug: "bad", name: "Bad", variableValues: { unknown_key: "x" } }] }, /unknown variable keys/i);

  await call("handout_set_site_access", { siteId, visibility: "team" });
  const duplicated = data(await call("handout_duplicate_site", { siteId }));
  const duplicateId = string(record(duplicated.site).id);
  cleanup.push(() => hardDeleteSite(duplicateId));

  const published = data(await call("handout_publish_site", { siteId }));
  const versionId = string(record(published.version).id);
  assert(typeof published.siteUrl === "string", "publish must return a public URL");
  const browserPauseMs = Math.min(Number(process.env.HANDOUT_MCP_SMOKE_BROWSER_PAUSE_MS ?? 0), 45_000);
  if (browserPauseMs > 0) {
    process.stdout.write(`BROWSER_FIXTURE ${JSON.stringify({ siteId, editorUrl: created.editorUrl, publicUrl: published.siteUrl })}\n`);
    await new Promise((resolve) => setTimeout(resolve, browserPauseMs));
  }
  await call("handout_restore_site_version", { siteId, versionId });
  await call("handout_unpublish_site", { siteId });
  await call("handout_set_site_lifecycle", { siteId, action: "archive" });
  await call("handout_set_site_lifecycle", { siteId, action: "restore" });

  const asset = data(await call("handout_import_asset", { purpose: "logo", fileName: "agent-abuse.png", source: { kind: "base64", contentType: "image/png", dataBase64: onePixelPng } }));
  const assetId = string(record(asset.asset).id);
  cleanup.push(() => confirmDelete("asset", assetId, "agent-abuse.png"));
  const assets = data(await call("handout_list_assets", { purpose: "logo", search: "agent-abuse" }));
  assert(array(assets.assets).some((item) => record(item).id === assetId), "imported asset must be listable");
  await expectError("handout_import_asset", { purpose: "image", source: { kind: "url", url: "https://127.0.0.1/private.png" } }, /public host|public internet/i);
  await expectError("handout_import_asset", { purpose: "image", source: { kind: "base64", contentType: "image/png", dataBase64: Buffer.from("not-an-image").toString("base64") } }, /invalid/i);

  await call("handout_get_tracking_summary", { siteId, limit: 10 });
  await call("handout_query_tracking", { view: "events", siteId, limit: 10 });
  await call("handout_query_tracking", { view: "sessions", siteId, limit: 10 });
  await expectError("handout_query_tracking", { view: "sessions", eventType: "site_visit" }, /events/i);

  const trigger = { eventTypes: ["site_visit"], siteScope: "selected", siteIds: [siteId], recipientScope: "anyone", recipientIds: [] };
  const automationPreview = data(await call("handout_manage_automation", { action: "validate", name: "Agent abuse webhook", endpointUrl: "https://example.com/handout", trigger }));
  assert(automationPreview.preview === true, "automation validation must be non-mutating");
  const automationCreated = data(await call("handout_manage_automation", { action: "create", name: "Agent abuse webhook", endpointUrl: "https://example.com/handout", trigger }));
  const automationId = string(record(automationCreated.automation).id);
  assert(automationCreated.secretWithheld === true && !hasSensitiveKey(automationCreated), "automation creation must withhold signing secrets");
  cleanup.push(() => confirmDelete("automation", automationId, "Agent abuse webhook"));
  await call("handout_get_workspace_context", { include: ["automations", "automationOptions", "automationDetail", "automationActivity"], automationId });
  await call("handout_manage_automation", { action: "update", automationId, name: "Agent abuse webhook updated" });
  await call("handout_manage_automation", { action: "set_state", automationId, state: "paused" });
  const testDelivery = data(await call("handout_manage_automation", { action: "test", automationId }));
  if (typeof testDelivery.deliveryId === "string") {
    await call("handout_manage_automation", { action: "retry_delivery", automationId, deliveryId: testDelivery.deliveryId }, true);
  }
  await expectError("handout_manage_automation", { action: "update", automationId }, /at least one/i);

  const variablePreview = data(await call("handout_delete", { targetType: "variable", targetId: "var-company-name", siteId }));
  assert(variablePreview.deleted === false && number(variablePreview.referenceCount) >= 2, "variable deletion must detect content and variant references");
  await expectError("handout_delete", { targetType: "variable", targetId: "var-company-name", siteId, confirm: true, confirmName: variablePreview.targetName, expectedDraftRevision: variablePreview.draftRevision }, /references/i);

  const variantPreview = data(await call("handout_delete", { targetType: "variant", targetId: variantId, siteId }));
  await call("handout_delete", { targetType: "variant", targetId: variantId, siteId, confirm: true, confirmName: variantPreview.targetName });
  const pagePreview = data(await call("handout_delete", { targetType: "page", targetId: "page-proof", siteId }));
  await expectError("handout_delete", { targetType: "page", targetId: "page-proof", siteId, confirm: true, confirmName: "wrong", expectedDraftRevision: pagePreview.draftRevision }, /exactly match/i);
  await call("handout_delete", { targetType: "page", targetId: "page-proof", siteId, confirm: true, confirmName: pagePreview.targetName, expectedDraftRevision: pagePreview.draftRevision });

  const automationDelete = data(await call("handout_delete", { targetType: "automation", targetId: automationId }));
  await call("handout_delete", { targetType: "automation", targetId: automationId, confirm: true, confirmName: automationDelete.targetName });
  cleanup.pop();
  const assetDelete = data(await call("handout_delete", { targetType: "asset", targetId: assetId }));
  await call("handout_delete", { targetType: "asset", targetId: assetId, confirm: true, confirmName: assetDelete.targetName });
  cleanup.pop();

  const siteDelete = data(await call("handout_delete", { targetType: "site", targetId: duplicateId }));
  await call("handout_set_site_lifecycle", { siteId: duplicateId, action: "archive" });
  await call("handout_delete", { targetType: "site", targetId: duplicateId, confirm: true, confirmName: siteDelete.targetName });
  cleanup.pop();

  assert(expectedTools.every((name) => calledTools.has(name)), `not every tool was exercised: ${expectedTools.filter((name) => !calledTools.has(name)).join(", ")}`);
  process.stdout.write(`Handout live abuse smoke passed: all ${expectedTools.length} tools exercised with safe, concise responses.\n`);
} finally {
  for (const operation of cleanup.reverse()) {
    try { await operation(); } catch { /* best-effort cleanup is verified separately */ }
  }
  await client.close();
}

async function call(name: string, args: Record<string, unknown>, allowError = false) {
  calledTools.add(name);
  const result = await client.callTool({ name, arguments: args });
  const text = toolText(result);
  if (process.env.HANDOUT_MCP_SMOKE_VERBOSE === "1" && !printedTools.has(name)) {
    printedTools.add(name);
    process.stdout.write(`\n[${name}]\n${text}\n`);
  }
  assert(name === "handout_get_block_schemas" || text.length < 4_000, `${name} text response is too verbose (${text.length} chars)`);
  assert(!hasSensitiveKey(data(result)), `${name} exposed a sensitive field`);
  if (!allowError && result.isError) throw new Error(`${name} failed: ${text}`);
  return result;
}

async function expectError(name: string, args: Record<string, unknown>, pattern: RegExp) {
  const result = await call(name, args, true);
  const text = toolText(result);
  assert(result.isError === true, `${name} should have failed`);
  assert(pattern.test(text), `${name} error text did not explain the problem: ${text}`);
}

async function confirmDelete(targetType: "asset" | "automation", targetId: string, fallbackName: string) {
  const preview = data(await call("handout_delete", { targetType, targetId }, true));
  if (preview.error) return;
  await call("handout_delete", { targetType, targetId, confirm: true, confirmName: preview.targetName ?? fallbackName }, true);
}

async function hardDeleteSite(siteId: string) {
  const preview = data(await call("handout_delete", { targetType: "site", targetId: siteId }, true));
  if (preview.error) return;
  await call("handout_set_site_lifecycle", { siteId, action: "archive" }, true);
  await call("handout_delete", { targetType: "site", targetId: siteId, confirm: true, confirmName: preview.targetName }, true);
}

function data(result: Awaited<ReturnType<typeof client.callTool>>): Record<string, any> {
  return record(result.structuredContent) as Record<string, any>;
}
function toolText(result: Awaited<ReturnType<typeof client.callTool>>): string {
  return Array.isArray(result.content)
    ? result.content.filter((item): item is { type: "text"; text: string } => record(item).type === "text" && typeof record(item).text === "string").map((item) => item.text).join("\n")
    : "";
}
function record(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function string(value: unknown): string { assert(typeof value === "string" && value.length > 0, "expected a non-empty string"); return value; }
function number(value: unknown): number { assert(typeof value === "number", "expected a number"); return value; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function hasSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (typeof value !== "object" || value === null) return false;
  const sensitive = new Set(["signingsecret", "eventtoken", "eventtokenhash", "authorization", "password", "nonce", "ciphertext", "requestid", "uploadedbyuserid", "createdbyuserid", "updatedbyuserid", "publiclinkkey", "databaseurl", "databasepassword", "databaseconnectionstring", "databaseconnectionurl", "databaseuri", "database64"]);
  return Object.entries(value).some(([key, child]) => sensitive.has(key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()) || hasSensitiveKey(child));
}
