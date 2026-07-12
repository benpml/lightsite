import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const devWorkspaceId = "00000000-0000-4000-8000-000000000101";

const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--filter", "@lightsite/mcp", "exec", "tsx", "src/index.ts"],
  env: {
    ...process.env,
    LIGHTSITE_API_BASE_URL: process.env.LIGHTSITE_API_BASE_URL ?? "http://localhost:3011",
    LIGHTSITE_DEV_AUTH: process.env.LIGHTSITE_DEV_AUTH ?? "1",
    LIGHTSITE_AGENT_WORKSPACE_ID: process.env.LIGHTSITE_AGENT_WORKSPACE_ID ?? devWorkspaceId,
  },
});
const client = new Client({
  name: "lightsite-mcp-smoke",
  version: "0.1.0",
});

await client.connect(transport);

try {
  const capabilities = readTextJson(await callTool("lightsite_get_capabilities", {}));
  assert(Array.isArray(capabilities.workflow), "capabilities should include workflow guidance");
  assert(capabilities.siteContent?.schemaVersion === 3, "capabilities should expose canonical site schema v3");
  assert(
    capabilities.siteContent?.supportedNodeTypes?.includes("pageTitleSection"),
    "capabilities should expose supported Tiptap nodes",
  );
  assert(
    capabilities.siteContent?.documentExample?.type === "doc",
    "capabilities should include a canonical Tiptap document example",
  );
  const sites = readTextJson(await callTool("lightsite_list_sites", {}));
  assert(Array.isArray(sites.sites), "list sites should return a sites array");
  const created = await callTool("lightsite_create_site", {
    name: `Agent smoke ${Date.now()}`,
  });
  const siteId = readTextJson(created).site.id as string;
  const content = await callTool("lightsite_get_site_content", { siteId });
  const draftRevision = readTextJson(content).draftRevision as number;
  const draftContent = {
    schemaVersion: 3,
    themeMode: "dark",
    settings: {
      allowSearchIndexing: false,
    },
    variables: [
      {
        id: "var_company_name",
        key: "company_name",
        label: "Company name",
        type: "text",
        defaultValue: "Acme",
      },
      {
        id: "var_company_logo",
        key: "company_logo",
        label: "Company logo",
        type: "image",
        defaultValue: "",
      },
      {
        id: "var_primary_cta_url",
        key: "primary_cta_url",
        label: "Primary CTA URL",
        type: "url",
        defaultValue: "https://example.com/book",
      },
    ],
    pages: [
      {
        id: "page-overview",
        name: "Overview",
        slug: "overview",
        status: "visible",
        sortOrder: 0,
        document: {
          type: "doc",
          content: [
            {
              type: "pageTitleSection",
              attrs: { id: "title-overview", align: "center" },
              content: [
                {
                  type: "pageTitleTitle",
                  content: [{ type: "text", text: "Agent-generated rollout brief" }],
                },
                {
                  type: "pageTitleSubtitle",
                  content: [{ type: "text", text: "A clean Tiptap-native site created through MCP." }],
                },
              ],
            },
            {
              type: "heading",
              attrs: { id: "heading-context", level: 2 },
              content: [{ type: "text", text: "Why this matters now" }],
            },
            {
              type: "paragraph",
              content: [
                { type: "variableToken", attrs: { variableId: "company_name", fallbackName: "Your team" } },
                { type: "text", text: " can move faster when the buying team has one clean page to review." },
              ],
            },
            {
              type: "buttonBlock",
              attrs: { id: "cta-primary", href: "{{primary_cta_url}}", fullWidth: false },
              content: [{ type: "text", text: "Book implementation review" }],
            },
          ],
        },
      },
    ],
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

  const updated = readTextJson(await callTool("lightsite_update_site_content", {
    siteId,
    expectedDraftRevision: draftRevision,
    draftContent,
    changeSummary: "Created the smoke-test site JSON.",
  }));
  assert(updated.draftRevision === draftRevision + 1, "content update should increment draftRevision");
  const staleRevisionResult = readTextJson(await callTool("lightsite_update_site_content", {
    siteId,
    expectedDraftRevision: draftRevision,
    draftContent,
  }, { allowError: true }));
  assert(
    staleRevisionResult.body?.error?.code === "site.draft_revision_conflict",
    "stale content update should return structured site.draft_revision_conflict",
  );
  const validation = readTextJson(await callTool("lightsite_validate_site_content", { siteId, draftContent }));
  assert(validation.valid === true, "site content should validate before publishing");
  const variants = readTextJson(await callTool("lightsite_batch_upsert_variants", {
    siteId,
    matchBy: "slug",
    variants: [
      {
        slug: "mira-acme",
        name: "Mira at Acme",
        recipientName: "Mira Singh",
        recipientCompany: "Acme",
        variableValues: {
          company_name: "Acme",
          primary_cta_url: "https://example.com/acme",
        },
      },
      {
        slug: "jules-northstar",
        name: "Jules at Northstar",
        recipientName: "Jules Lee",
        recipientCompany: "Northstar",
        variableValues: {
          company_name: "Northstar",
          primary_cta_url: "https://example.com/northstar",
        },
      },
    ],
  }));
  assert(variants.variants.length === 2, "variant batch should create two variants");
  const duplicateVariantResult = readTextJson(await callTool("lightsite_batch_upsert_variants", {
    siteId,
    matchBy: "slug",
    variants: [
      {
        slug: "duplicate-recipient",
        name: "Duplicate A",
        variableValues: {},
      },
      {
        slug: "duplicate-recipient",
        name: "Duplicate B",
        variableValues: {},
      },
    ],
  }, { allowError: true }));
  assert(
    duplicateVariantResult.body?.error?.code === "site.variant_conflict",
    "duplicate variant slugs should return structured site.variant_conflict",
  );
  const updatedVariantById = readTextJson(await callTool("lightsite_batch_upsert_variants", {
    siteId,
    matchBy: "id",
    variants: [
      {
        id: variants.variants[0].id,
        slug: "mira-acme-revised",
        name: "Mira at Acme revised",
        recipientName: "Mira Singh",
        recipientCompany: "Acme",
        variableValues: {
          company_name: "Acme revised",
          primary_cta_url: "https://example.com/acme-revised",
        },
      },
    ],
  }));
  assert(
    updatedVariantById.variants[0]?.revisionNumber === variants.variants[0].revisionNumber + 1,
    "matchBy=id variant update should increment revisionNumber",
  );
  const listedVariants = readTextJson(await callTool("lightsite_list_variants", { siteId }));
  assert(listedVariants.variants.length === 2, "variant list should return two variants");
  const site = readTextJson(await callTool("lightsite_get_site", { siteId }));
  assert(site.site.id === siteId, "get site should return the created site");
  const siteWithVisibility = readTextJson(await callTool("lightsite_update_site", {
    siteId,
    visibility: "team",
  }));
  assert(siteWithVisibility.site.visibility === "team", "site update should allow making the site browser-accessible");
  const published = readTextJson(await callTool("lightsite_publish_site", { siteId }));
  assert(published.site.status === "published", "publish should mark the site published");
  const publicUrls = readTextJson(await callTool("lightsite_get_public_urls", {
    siteId,
    workspaceSlug: "lightsite-dev",
    publicSiteOrigin: "http://localhost:3011",
  }));
  assert(typeof publicUrls.siteUrl === "string", "public URLs should include a site URL");
  const trackingSummary = readTextJson(await callTool("lightsite_get_tracking_summary", { workspaceId: devWorkspaceId, siteId }));
  assert(typeof trackingSummary.metrics === "object", "tracking summary should include metrics");
  const trackingEvents = readTextJson(await callTool("lightsite_list_tracking_events", {
    workspaceId: devWorkspaceId,
    siteId,
    type: "site_visit",
    limit: 5,
  }));
  assert(Array.isArray(trackingEvents.events), "tracking events should return an events array");
  const trackingSessions = readTextJson(await callTool("lightsite_list_tracking_sessions", {
    workspaceId: devWorkspaceId,
    siteId,
    limit: 5,
  }));
  assert(Array.isArray(trackingSessions.sessions), "tracking sessions should return a sessions array");
  const unpublished = readTextJson(await callTool("lightsite_unpublish_site", { siteId }));
  assert(unpublished.site.status === "draft", "unpublish should return the site to draft");

  console.log(`MCP smoke passed for site ${siteId}`);
} finally {
  await client.close();
}

async function callTool(name: string, args: Record<string, unknown>, options: { allowError?: boolean } = {}) {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  if (result.isError && !options.allowError) {
    throw new Error(`Unexpected MCP tool error from ${name}: ${JSON.stringify(readTextJson(result))}`);
  }

  console.log(`called ${name}`);
  return result;
}


function readTextJson(result: Awaited<ReturnType<typeof callTool>>) {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent as Record<string, any>;
  }

  const content = result.content;

  if (!Array.isArray(content) || content[0]?.type !== "text") {
    throw new Error("Expected text content from MCP tool.");
  }

  return JSON.parse(content[0].text) as Record<string, any>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
