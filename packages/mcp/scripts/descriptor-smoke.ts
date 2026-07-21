import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createHandoutMcpServer } from "../src/server";
import { formatToolText, sanitizeAgentOutput } from "../src/agent-output";
import { HANDOUT_WIDGET_MIME_TYPE, HANDOUT_WIDGET_URI } from "../src/widget";

const server = createHandoutMcpServer({
  apiBaseUrl: "https://api.handout.link",
  webOrigin: "https://app.handout.link",
  protectedResourceMetadataUrl: "https://api.handout.link/.well-known/oauth-protected-resource/mcp",
});
const client = new Client({ name: "handout-descriptor-smoke", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

await server.connect(serverTransport);
await client.connect(clientTransport);

try {
  const sanitized = sanitizeAgentOutput({
    ok: true,
    requestId: "internal-request",
    nested: { signingSecret: "whsec_test", uploadedByUserId: "user_1", dataBase64: "binary", safe: "kept" },
    rows: [{ eventToken: "token", name: "Buyer" }],
  });
  assert(JSON.stringify(sanitized) === JSON.stringify({ ok: true, nested: { safe: "kept" }, rows: [{ name: "Buyer" }] }), "response sanitizer must recursively remove sensitive fields");
  assert(!formatToolText("handout_manage_automation", { automation: { id: "a", name: "Webhook", state: "draft" }, secretWithheld: true }).includes("whsec"), "automation text must never include a secret");

  const [{ tools }, { resources }, { prompts }] = await Promise.all([
    client.listTools(),
    client.listResources(),
    client.listPrompts(),
  ]);
  const expectedTools = [
    "handout_get_capabilities", "handout_get_block_schemas", "handout_get_workspace_context",
    "handout_list_sites", "handout_create_site", "handout_get_site", "handout_edit_site",
    "handout_duplicate_site", "handout_validate_site", "handout_set_site_access",
    "handout_publish_site", "handout_unpublish_site", "handout_restore_site_version",
    "handout_set_site_lifecycle", "handout_upsert_variants", "handout_list_assets",
    "handout_import_asset", "handout_get_tracking_summary", "handout_query_tracking",
    "handout_manage_automation", "handout_delete",
  ];
  assert(tools.length === expectedTools.length, `expected ${expectedTools.length} tools, received ${tools.length}`);
  assert(expectedTools.every((name) => tools.some((tool) => tool.name === name)), "tool surface is missing a canonical tool");
  assert(prompts.length === 3, `expected 3 prompts, received ${prompts.length}`);
  assert(resources.some((resource) => resource.uri === HANDOUT_WIDGET_URI && resource.mimeType === HANDOUT_WIDGET_MIME_TYPE), "widget resource is missing");
  assert(resources.some((resource) => resource.uri === "handout://guides/content-patterns"), "content patterns resource is missing");
  assert(resources.some((resource) => resource.uri === "handout://schema/site-document" && resource.mimeType === "application/json"), "site-document schema resource is missing");
  assert(resources.some((resource) => resource.uri === "handout://catalog/icons" && resource.mimeType === "application/json"), "icon catalog resource is missing");
  assert(resources.some((resource) => resource.uri === "handout://catalog/design-options" && resource.mimeType === "application/json"), "design options resource is missing");

  const schemaResult = await client.callTool({
    name: "handout_get_block_schemas",
    arguments: { nodeTypes: ["pageTitleSection", "iconCard", "gridBlock"], includeMarks: false },
  });
  const schema = schemaResult.structuredContent;
  assert(isRecord(schema) && Array.isArray(schema.nodes), "block schema tool must return structured node schemas");
  assert(schema.nodes.some((entry) => isRecord(entry) && entry.type === "pageTitleTitle"), "block schema tool must include explicit dependencies");
  assert(schema.nodes.some((entry) => isRecord(entry) && entry.type === "gridBlock" && isRecord(entry.attributes)), "block schema tool must include requested attributes");

  const schemaResource = await client.readResource({ uri: "handout://schema/site-document" });
  const schemaText = schemaResource.contents.find((content) => "text" in content)?.text;
  const schemaCatalog = typeof schemaText === "string" ? JSON.parse(schemaText) as unknown : null;
  assert(isRecord(schemaCatalog) && Array.isArray(schemaCatalog.nodes) && schemaCatalog.nodes.length > 40, "full schema resource must contain every node");

  const iconResource = await client.readResource({ uri: "handout://catalog/icons" });
  const iconText = iconResource.contents.find((content) => "text" in content)?.text;
  const iconCatalog = typeof iconText === "string" ? JSON.parse(iconText) as unknown : null;
  assert(isRecord(iconCatalog) && Array.isArray(iconCatalog.options) && iconCatalog.options.length > 200, "icon resource must contain the complete icon catalog");

  for (const tool of tools) {
    const schemes = tool._meta?.securitySchemes;
    assert(Array.isArray(schemes) && schemes.some((scheme) => isRecord(scheme) && scheme.type === "oauth2"), `${tool.name} is missing OAuth metadata`);
    assert(typeof tool.annotations?.readOnlyHint === "boolean", `${tool.name} is missing readOnlyHint`);
    assert(typeof tool.annotations?.destructiveHint === "boolean", `${tool.name} is missing destructiveHint`);
    assert(typeof tool.annotations?.openWorldHint === "boolean", `${tool.name} is missing openWorldHint`);
  }

  const publish = tools.find((tool) => tool.name === "handout_publish_site");
  const remove = tools.find((tool) => tool.name === "handout_delete");
  const automation = tools.find((tool) => tool.name === "handout_manage_automation");
  assert(publish?.annotations?.openWorldHint === true, "publish must be open-world");
  assert(remove?.annotations?.destructiveHint === true, "delete must be destructive");
  assert(automation?.annotations?.openWorldHint === true, "automation management must be open-world");

  const originalFetch = globalThis.fetch;
  let listPageCalls = 0;
  globalThis.fetch = async (request) => {
    listPageCalls += 1;
    const url = new URL(String(request));
    const cursor = url.searchParams.get("cursor");
    return Response.json(cursor === "1"
      ? { sites: [{ id: "site-target", publicId: "public-target", name: "Target account", slug: "target-account", status: "draft", visibility: "private", recipientCount: 0 }], nextCursor: null, requestId: "internal-two" }
      : { sites: [{ id: "site-other", publicId: "public-other", name: "Other account", slug: "other-account", status: "draft", visibility: "private", recipientCount: 0 }], nextCursor: "1", requestId: "internal-one" });
  };
  try {
    const paged = await client.callTool({ name: "handout_list_sites", arguments: { lifecycle: "all", search: "target", limit: 10 } });
    assert(isRecord(paged.structuredContent) && paged.structuredContent.totalMatched === 1, "site search must cover every API page before filtering");
    assert(listPageCalls === 2, "site search must continue through nextCursor");
    assert(!JSON.stringify(paged).includes("internal-two"), "site list must strip internal request IDs");
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "auth.required" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  try {
    const unauthenticated = await client.callTool({ name: "handout_list_sites", arguments: {} });
    const challenge = unauthenticated._meta?.["mcp/www_authenticate"];
    assert(unauthenticated.isError === true && Array.isArray(challenge), "unauthenticated tool calls must return an OAuth challenge");
  } finally {
    globalThis.fetch = originalFetch;
  }
  process.stdout.write(`Handout MCP descriptors OK: ${tools.length} tools, ${resources.length} resources, ${prompts.length} prompts.\n`);
} finally {
  await client.close();
  await server.close();
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
