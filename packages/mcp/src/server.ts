import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SITE_DOCUMENT_CATALOG,
  SITE_DOCUMENT_DESIGN_OPTIONS,
  SITE_DOCUMENT_ICON_CATALOG,
  SITE_DOCUMENT_SCHEMA_VERSION,
  SITE_DOCUMENT_TOP_LEVEL_BLOCKS,
  SUPPORTED_SITE_DOCUMENT_MARK_TYPES,
  SUPPORTED_SITE_DOCUMENT_NODE_TYPES,
  getSiteDocumentCatalogSelection,
  siteContentSchema,
  type SiteContent,
} from "@handout/site-document";
import { z } from "zod";

import { HandoutApiError, HandoutClient, isRecord, type HandoutClientOptions } from "./client";
import { formatToolText, sanitizeAgentOutput } from "./agent-output";
import {
  analyzeAssetUsage,
  analyzeVariableUsage,
  applySiteContentOperations,
  projectPageSummaries,
  removeContentTarget,
  siteContentOperationSchema,
  summarizeSiteContent,
} from "./site-operations";
import {
  HANDOUT_WIDGET_HTML,
  HANDOUT_WIDGET_MIME_TYPE,
  HANDOUT_WIDGET_URI,
} from "./widget";

export type HandoutMcpOptions = HandoutClientOptions & {
  authMode?: "oauth" | "bearer" | "development";
  protectedResourceMetadataUrl?: string;
};

type ToolHints = {
  destructive?: boolean;
  openWorld?: boolean;
  readOnly?: boolean;
  showWidget?: boolean;
};

const protectedResourceMetadataUrls = new WeakMap<McpServer, string>();

const MCP_INSTRUCTIONS = `Operate Handout as a concise sales-site workspace. Start with handout_get_capabilities and handout_get_workspace_context. Before constructing Tiptap JSON, call handout_get_block_schemas only for the blocks you intend to use and read handout://guides/content-patterns for composition examples. Do not guess node attributes, options, or child structure. Use handout_get_site with selective includes; request complete content only when editing. Read draftRevision immediately before handout_edit_site content operations. Keep content in schema-v3 Tiptap JSON, use variables for personalization, and batch-upsert recipient variants. A variableToken references variables[].id; variant variableValues are keyed by variables[].key. Validate before publishing. Never publish, unpublish, archive, restore a version, change access, or confirm deletion without explicit user intent. handout_delete is preview-first and reference-aware. Prefer engagement summaries before detailed tracking records. Never ask for or reveal credentials, webhook signing secrets, retained payloads, event tokens, or internal user identifiers.`;

const supportedNodeTypeValues = [...SUPPORTED_SITE_DOCUMENT_NODE_TYPES] as [string, ...string[]];

const variantInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).max(96),
  name: z.string().min(1).max(160),
  recipientName: z.string().nullable().optional(),
  recipientCompany: z.string().nullable().optional(),
  variableValues: z.record(z.string(), z.unknown()).default({}),
});

const siteIncludeSchema = z.enum(["pageSummaries", "variables", "content", "variants", "publicUrls", "versions"]);
const automationEventTypeSchema = z.enum(["site_visit", "button_click", "link_click", "tab_switch"]);
const automationTriggerSchema = z.object({
  eventTypes: z.array(automationEventTypeSchema).min(1).max(4),
  siteScope: z.enum(["all", "selected"]),
  siteIds: z.array(z.uuid()).max(50).default([]),
  recipientScope: z.enum(["anyone", "named", "unnamed", "selected"]),
  recipientIds: z.array(z.uuid()).max(500).default([]),
}).superRefine((value, context) => {
  if (value.siteScope === "selected" && value.siteIds.length === 0) context.addIssue({ code: "custom", path: ["siteIds"], message: "Choose at least one site." });
  if (value.recipientScope === "selected" && value.recipientIds.length === 0) context.addIssue({ code: "custom", path: ["recipientIds"], message: "Choose at least one recipient." });
});

const siteDocumentExample = {
  type: "doc",
  content: [
    {
      type: "pageTitleSection",
      attrs: { id: "title-overview", align: "center" },
      content: [
        { type: "pageTitleTitle", content: [{ type: "text", text: "Implementation plan" }] },
        {
          type: "pageTitleSubtitle",
          content: [
            { type: "text", text: "A focused rollout for " },
            { type: "variableToken", attrs: { variableId: "recipient-company", fallbackName: "your team" } },
          ],
        },
      ],
    },
    { type: "heading", attrs: { id: "heading-context", level: 2 }, content: [{ type: "text", text: "Why this matters now" }] },
    { type: "paragraph", content: [{ type: "text", text: "A clear point of view grounded in the recipient's priorities." }] },
    { type: "buttonBlock", attrs: { id: "cta-primary", href: "{{primary_cta_url}}", fullWidth: false }, content: [{ type: "text", text: "Book implementation review" }] },
  ],
};

export function handoutMcpOptionsFromEnv(): HandoutMcpOptions {
  return {
    apiBaseUrl: process.env.HANDOUT_API_BASE_URL ?? "http://localhost:3011",
    ...(process.env.HANDOUT_AGENT_API_TOKEN
      ? { authorization: `Bearer ${process.env.HANDOUT_AGENT_API_TOKEN}` }
      : {}),
    devAuth: process.env.HANDOUT_DEV_AUTH === "1",
    publicSiteOrigin: process.env.HANDOUT_PUBLIC_SITE_ORIGIN,
    webOrigin: process.env.HANDOUT_WEB_ORIGIN ?? "http://localhost:5173",
    workspaceId: process.env.HANDOUT_AGENT_WORKSPACE_ID,
    workspaceSlug: process.env.HANDOUT_AGENT_WORKSPACE_SLUG,
    authMode: process.env.HANDOUT_DEV_AUTH === "1"
      ? "development"
      : process.env.HANDOUT_AGENT_API_TOKEN ? "bearer" : "oauth",
  };
}

export function createHandoutMcpServer(options: HandoutMcpOptions) {
  const client = new HandoutClient(options);
  const server = new McpServer(
    {
      name: "handout",
      version: "1.0.0",
      websiteUrl: options.webOrigin ?? "https://app.handout.link",
    },
    { instructions: MCP_INSTRUCTIONS },
  );
  if (options.protectedResourceMetadataUrl) {
    protectedResourceMetadataUrls.set(server, options.protectedResourceMetadataUrl);
  }

  server.registerResource(
    "Handout workspace dashboard",
    HANDOUT_WIDGET_URI,
    {
      title: "Handout workspace dashboard",
      description: "Compact review UI for sites, recipients, publish readiness, links, and engagement.",
      mimeType: HANDOUT_WIDGET_MIME_TYPE,
    },
    async () => ({
      contents: [{
        uri: HANDOUT_WIDGET_URI,
        mimeType: HANDOUT_WIDGET_MIME_TYPE,
        text: HANDOUT_WIDGET_HTML,
        _meta: {
          ui: {
            prefersBorder: false,
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/widgetDescription": "Review Handout sites, personalization, publishing status, links, and engagement.",
        },
      }],
    }),
  );

  registerTextResource(server, "Handout operating guide", "handout://guides/operating", OPERATING_GUIDE);
  registerTextResource(server, "Handout content model", "handout://guides/content-model", CONTENT_MODEL_GUIDE);
  registerTextResource(server, "Handout content patterns", "handout://guides/content-patterns", CONTENT_PATTERNS_GUIDE);
  registerTextResource(server, "Handout personalization guide", "handout://guides/personalization", PERSONALIZATION_GUIDE);
  registerTextResource(server, "Handout quality checklist", "handout://guides/quality", QUALITY_GUIDE);
  registerJsonResource(server, "Handout site-document schema", "handout://schema/site-document", SITE_DOCUMENT_CATALOG);
  registerJsonResource(server, "Handout icon catalog", "handout://catalog/icons", SITE_DOCUMENT_ICON_CATALOG);
  registerJsonResource(server, "Handout design options", "handout://catalog/design-options", SITE_DOCUMENT_DESIGN_OPTIONS);

  server.registerPrompt("build_sales_site", {
    title: "Build a sales site",
    description: "Turn an offer and audience brief into a polished Handout draft and review it before publishing.",
    argsSchema: {
      audience: z.string().describe("Target role, account, or buying committee"),
      offer: z.string().describe("What is being proposed or sold"),
      callToAction: z.string().optional().describe("Desired next step"),
    },
  }, ({ audience, offer, callToAction }) => promptMessages(
    `Build a concise, high-quality Handout for ${audience}. The offer is: ${offer}. ${callToAction ? `The CTA is: ${callToAction}.` : "Ask for the CTA if it cannot be inferred."} Create a draft, validate it, and show me the result. Do not publish yet.`,
  ));

  server.registerPrompt("personalize_for_accounts", {
    title: "Personalize for accounts",
    description: "Create recipient or account variants from a list while preserving one canonical site.",
    argsSchema: {
      siteId: z.string(),
      accounts: z.string().describe("Account list or CSV-like rows with recipient context"),
    },
  }, ({ siteId, accounts }) => promptMessages(
    `Personalize Handout site ${siteId} for these accounts:\n${accounts}\nRead the site's variables first, propose the mapping, then batch-upsert variants by slug. Do not change the canonical draft unless the variable model is insufficient.`,
  ));

  server.registerPrompt("analyze_engagement", {
    title: "Analyze engagement",
    description: "Summarize account engagement and recommend the next sales action.",
    argsSchema: { siteId: z.string().optional(), timeWindow: z.string().optional() },
  }, ({ siteId, timeWindow }) => promptMessages(
    `Analyze Handout engagement${siteId ? ` for site ${siteId}` : ""}${timeWindow ? ` during ${timeWindow}` : ""}. Start with the tracking summary, inspect detailed events only when they change the conclusion, and return prioritized follow-up recommendations without overstating buyer intent.`,
  ));

  registerTool(server, "handout_get_capabilities", {
    title: "Get Handout capabilities",
    description: "Read Handout's canonical schema version, Tiptap node and mark support, operating rules, and connection mode before creating or editing a site.",
    inputSchema: {},
  }, { readOnly: true, showWidget: true }, async () => ({
    connection: { authMode: options.authMode ?? "oauth" },
    toolSurface: { count: 21, design: "task-oriented, selective reads, atomic writes, preview-first destructive actions" },
    siteContent: {
      sourceOfTruth: "sites.draftContent",
      schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
      documentFormat: "Tiptap JSONContent",
      pageShape: { id: "string", name: "string", slug: "string", status: '"visible" | "hidden"', sortOrder: "non-negative integer", document: "Tiptap doc root" },
      supportedNodeTypes: [...SUPPORTED_SITE_DOCUMENT_NODE_TYPES],
      supportedMarkTypes: [...SUPPORTED_SITE_DOCUMENT_MARK_TYPES],
      documentExample: siteDocumentExample,
      schemaDiscovery: {
        catalogVersion: SITE_DOCUMENT_CATALOG.catalogVersion,
        fingerprint: SITE_DOCUMENT_CATALOG.fingerprint,
        topLevelBlocks: SITE_DOCUMENT_TOP_LEVEL_BLOCKS,
        targetedTool: "handout_get_block_schemas",
        fullCatalogResource: "handout://schema/site-document",
        iconCatalogResource: "handout://catalog/icons",
        designOptionsResource: "handout://catalog/design-options",
        instruction: "Request the blocks you plan to use; structural child nodes are included automatically. Omit nodeTypes only when the complete catalog is truly needed.",
      },
      reservedVariables: [
        { id: "recipient-name", key: "name", purpose: "Recipient name" },
        { id: "recipient-company", key: "company", purpose: "Recipient company" },
        { id: "recipient_website", key: "website", purpose: "Recipient company website/domain" },
      ],
      variableContract: {
        inlineTokenReference: "variableToken.attrs.variableId = variables[].id",
        variantValueKeys: "variants[].variableValues keys = variables[].key",
        urlTemplateReference: "Use {{variables[].key}} in URL-like attrs and sidebar hrefs",
      },
    },
    workflow: [
      "Read workspace context, then create or select a site.",
      "Use selective site includes; request complete content only before editing.",
      "Discover exact block schemas for the blocks being authored.",
      "Apply an atomic operation batch with the latest expectedDraftRevision.",
      "Validate the draft and repair every blocking issue.",
      "Preview recipient variants before large upserts.",
      "Ask before changing access, publishing, unpublishing, archiving, or restoring.",
      "Preview deletion, remove blocking references, then confirm with exact targetName.",
      "Read engagement summary before querying detailed events or sessions.",
    ],
    safety: {
      optimisticConcurrency: "Content writes and nested deletions require the latest draftRevision.",
      deletion: "Preview-first, exact-name confirmation, reference checks for variables and assets.",
      secrets: "Agent responses remove signing secrets, credentials, tokens, internal response IDs, user IDs, and binary asset bodies.",
      externalRequests: "Asset URLs must be public HTTPS; webhook tests are explicit open-world actions.",
    },
    resources: ["handout://guides/operating", "handout://guides/content-model", "handout://guides/content-patterns", "handout://guides/personalization", "handout://guides/quality", "handout://schema/site-document", "handout://catalog/icons", "handout://catalog/design-options"],
  }));

  registerTool(server, "handout_get_block_schemas", {
    title: "Get Handout block schemas",
    description: "Get canonical Tiptap node schemas, attributes, defaults, valid options, child structure, dependencies, and minimal examples. Request only the block types you plan to use; omit nodeTypes for the complete catalog.",
    inputSchema: {
      nodeTypes: z.array(z.enum(supportedNodeTypeValues)).min(1).max(24).optional().describe("Top-level blocks or structural node types to inspect"),
      includeDependencies: z.boolean().default(true).describe("Include explicitly named structural child nodes required by the requested types"),
      includeMarks: z.boolean().default(true).describe("Include the supported inline mark schemas"),
    },
  }, { readOnly: true }, ({ nodeTypes, includeDependencies, includeMarks }) => ({
    ...getSiteDocumentCatalogSelection(nodeTypes, includeDependencies, includeMarks),
    usage: {
      contentExpression: "Authoritative child ordering and cardinality. A plus means one or more, an asterisk means zero or more, and a question mark means optional.",
      allowedChildTypes: "All node types accepted directly anywhere in this node's content expression.",
      explicitChildTypes: "Named structural dependencies included automatically when includeDependencies is true.",
      attributes: "Use only listed attributes. Read optionsCatalog resources when an attribute references one.",
      minimalExample: "Schema-valid structural starting point; replace placeholder or empty content with user-relevant copy.",
    },
  }), completeJsonText);

  registerTool(server, "handout_get_workspace_context", {
    title: "Get workspace context",
    description: "Read the active workspace, role, plan, brand context, permissions, and optionally automation configuration or activity without exposing user profile data or secrets.",
    inputSchema: {
      include: z.array(z.enum(["automations", "automationOptions", "automationDetail", "automationActivity"])).max(4).default([]),
      automationId: z.uuid().optional().describe("Required for automationDetail or automationActivity"),
      activityLimit: z.number().int().min(1).max(100).default(20),
      activityCursor: z.string().optional(),
    },
  }, { readOnly: true, showWidget: true }, async ({ include, automationId, activityLimit, activityCursor }) => {
    if ((include.includes("automationDetail") || include.includes("automationActivity")) && !automationId) {
      throw new Error("automationId is required when requesting automation detail or activity.");
    }
    const me = asRecord(await client.request("/api/me"));
    const active = asRecord(me.activeWorkspace);
    if (!active.id) throw new Error("Select an active Handout workspace before using this tool.");
    const workspace = {
      id: active.id,
      name: active.name,
      slug: active.slug,
      websiteDomain: active.websiteDomain,
      logoUrl: active.logoUrl ?? null,
      plan: active.plan,
      role: active.role,
    };
    const result: Record<string, unknown> = {
      workspace,
      permissions: {
        canCreateSites: true,
        canEditAccessibleSites: true,
        canManageWorkspaceSettings: active.role === "admin",
        canManageAutomations: active.role === "admin" && active.plan === "pro",
      },
      limits: {
        siteContentSchemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
        variantsPerBatch: 100,
        variablesPerSite: 200,
      },
      included: include,
    };
    const base = `/api/workspaces/${encodeURIComponent(String(active.id))}/automations`;
    if (include.includes("automations")) Object.assign(result, await client.request(base));
    if (include.includes("automationOptions")) result.automationOptions = await client.request(`${base}/options`);
    if (include.includes("automationDetail")) result.automationDetail = await client.request(`${base}/${encodeURIComponent(automationId!)}`);
    if (include.includes("automationActivity")) {
      result.automationActivity = await client.request(`${base}/${encodeURIComponent(automationId!)}/activity?${toSearchParams({ limit: activityLimit, cursor: activityCursor })}`);
    }
    return result;
  });

  registerTool(server, "handout_list_sites", {
    title: "List sites",
    description: "List compact site summaries in the active workspace with optional lifecycle, publication, visibility, and text filters. Content thumbnails are intentionally omitted.",
    inputSchema: {
      lifecycle: z.enum(["active", "archived", "all"]).default("active"),
      status: z.enum(["draft", "published", "archived"]).optional(),
      visibility: z.enum(["private", "team"]).optional(),
      search: z.string().trim().max(160).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().regex(/^\d+$/).optional(),
    },
  }, { readOnly: true, showWidget: true }, async ({ lifecycle, status, visibility, search, limit, cursor }) => {
    const allSites: Array<Record<string, unknown>> = [];
    let apiCursor: string | null = null;
    do {
      const response = asRecord(await client.request(`/api/sites?${toSearchParams({ status: lifecycle, limit: 100, cursor: apiCursor })}`));
      allSites.push(...arrayOfRecords(response.sites));
      apiCursor = typeof response.nextCursor === "string" ? response.nextCursor : null;
    } while (apiCursor);
    const query = search?.toLowerCase();
    const filtered = allSites
      .filter((site) => !status || site.status === status)
      .filter((site) => !visibility || site.visibility === visibility)
      .filter((site) => !query || String(site.name ?? "").toLowerCase().includes(query) || String(site.slug ?? "").toLowerCase().includes(query))
      .map(compactSite);
    const offset = cursor ? Number(cursor) : 0;
    const sites = filtered.slice(offset, offset + limit);
    const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null;
    return { sites, nextCursor, totalMatched: filtered.length, filters: { lifecycle, status: status ?? null, visibility: visibility ?? null, search: search ?? null, limit, cursor: cursor ?? null } };
  });

  registerTool(server, "handout_create_site", {
    title: "Create a site",
    description: "Create a private draft site shell. This does not publish or share it.",
    inputSchema: { name: z.string().min(1).max(160), slug: z.string().min(1).max(96).optional() },
  }, { showWidget: true }, async (input) => withEditorUrl(client, await client.request("/api/sites", { method: "POST", body: input })));

  registerTool(server, "handout_get_site", {
    title: "Get site",
    description: "Read a compact site overview and only the requested sections: page summaries, variables, complete content, variants, public URLs, or versions.",
    inputSchema: {
      siteId: z.string().min(1),
      include: z.array(siteIncludeSchema).max(6).default([]),
    },
  }, { readOnly: true, showWidget: true }, async ({ siteId, include }) => {
    const detail = asRecord(await client.request(sitePath(siteId)));
    const result: Record<string, unknown> = {
      site: compactSite(asRecord(detail.site)),
      editorUrl: client.editorUrl(siteId),
      included: include,
    };
    let contentPayload: Record<string, any> | null = null;
    if (include.some((section: string) => ["pageSummaries", "variables", "content"].includes(section))) {
      contentPayload = asRecord(await client.request(`${sitePath(siteId)}/content`));
      const content = siteContentSchema.parse(contentPayload.draftContent);
      result.draftRevision = contentPayload.draftRevision;
      result.contentSummary = summarizeSiteContent(content);
      if (include.includes("pageSummaries")) result.pages = projectPageSummaries(content);
      if (include.includes("variables")) result.variables = content.variables.map((variable) => ({ ...variable, usage: analyzeVariableUsage(content, variable.id).referenceCount }));
      if (include.includes("content")) result.draftContent = content;
    }
    if (include.includes("variants")) Object.assign(result, await client.request(`${sitePath(siteId)}/variants`));
    if (include.includes("versions")) Object.assign(result, await client.request(`${sitePath(siteId)}/versions`));
    if (include.includes("publicUrls")) result.publicUrls = await buildPublicUrls(client, siteId);
    return result;
  });

  registerTool(server, "handout_edit_site", {
    title: "Edit site",
    description: "Edit site metadata or apply a validated atomic batch of page, settings, variable, sidebar, theme, or complete-content operations. Content mode requires the latest draft revision.",
    inputSchema: {
      siteId: z.string().min(1),
      mode: z.enum(["metadata", "content"]),
      name: z.string().min(1).max(160).optional(),
      slug: z.string().min(1).max(96).optional(),
      expectedDraftRevision: z.number().int().positive().optional(),
      operations: z.array(siteContentOperationSchema).min(1).max(50).optional(),
    },
  }, { showWidget: true }, async ({ siteId, mode, name, slug, expectedDraftRevision, operations }) => {
    if (mode === "metadata") {
      if (!name && !slug) throw new Error("Metadata mode requires name or slug.");
      if (operations?.length || expectedDraftRevision) throw new Error("Metadata mode does not accept content operations or expectedDraftRevision.");
      const response = asRecord(await client.request(sitePath(siteId), { method: "PATCH", body: { ...(name ? { name } : {}), ...(slug ? { slug } : {}) } }));
      return { site: compactSite(asRecord(response.site)), editorUrl: client.editorUrl(siteId), appliedOperations: ["metadata"] };
    }
    if (!expectedDraftRevision) throw new Error("Content mode requires expectedDraftRevision from the latest handout_get_site content read.");
    if (!operations?.length) throw new Error("Content mode requires at least one operation.");
    if (name || slug) throw new Error("Content mode does not accept name or slug; use metadata mode in a separate call.");
    const current = asRecord(await client.request(`${sitePath(siteId)}/content`));
    if (current.draftRevision !== expectedDraftRevision) {
      throw new Error(`Draft revision conflict: expected ${expectedDraftRevision}, current revision is ${String(current.draftRevision)}. Read the site again and merge your changes.`);
    }
    const nextContent = applySiteContentOperations(siteContentSchema.parse(current.draftContent), operations);
    const response = asRecord(await client.request(`${sitePath(siteId)}/content`, {
      method: "PUT",
      body: { expectedDraftRevision, draftContent: nextContent },
    }));
    return {
      site: compactSite(asRecord(response.site)),
      draftRevision: response.draftRevision,
      contentSummary: summarizeSiteContent(nextContent),
      appliedOperations: operations.map((operation: { op: string }) => operation.op),
      editorUrl: client.editorUrl(siteId),
    };
  });

  registerTool(server, "handout_duplicate_site", {
    title: "Duplicate a site",
    description: "Create a new private draft by copying an existing site.",
    inputSchema: { siteId: z.string().min(1) },
  }, { showWidget: true }, async ({ siteId }) => withEditorUrl(client, await client.request(`${sitePath(siteId)}/duplicate`, { method: "POST" })));

  registerTool(server, "handout_validate_site", {
    title: "Validate site",
    description: "Check current or proposed SiteContent for schema correctness, publish readiness, unresolved variable references, and usage context without changing it.",
    inputSchema: { siteId: z.string().min(1), draftContent: siteContentSchema.optional() },
  }, { readOnly: true, showWidget: true }, async ({ siteId, draftContent }) => {
    let content = draftContent;
    if (!content) {
      const current = await client.request(`${sitePath(siteId)}/content`);
      if (!isRecord(current) || !isRecord(current.draftContent)) throw new Error("Handout did not return current site content.");
      content = current.draftContent as z.infer<typeof siteContentSchema>;
    }
    const validated = asRecord(await client.request(`${sitePath(siteId)}/content/validate`, { method: "POST", body: { draftContent: content } }));
    const parsed = siteContentSchema.parse(content);
    const variableUsage = parsed.variables.map((variable) => ({ id: variable.id, key: variable.key, label: variable.label, references: analyzeVariableUsage(parsed, variable.id).referenceCount }));
    return { ...validated, contentSummary: summarizeSiteContent(parsed), variableUsage };
  });

  registerTool(server, "handout_set_site_access", {
    title: "Set site access",
    description: "Set private or team visibility independently from publishing. Team visibility can make a published site reachable by its share URL.",
    inputSchema: { siteId: z.string().min(1), visibility: z.enum(["private", "team"]) },
  }, { openWorld: true, showWidget: true }, async ({ siteId, visibility }) => {
    const response = asRecord(await client.request(sitePath(siteId), { method: "PATCH", body: { visibility } }));
    return { site: compactSite(asRecord(response.site)), publicUrls: await buildPublicUrls(client, siteId), editorUrl: client.editorUrl(siteId) };
  });

  registerTool(server, "handout_publish_site", {
    title: "Publish a site",
    description: "Publish the current validated draft as a publicly reachable immutable snapshot. Call only after explicit user approval.",
    inputSchema: { siteId: z.string().min(1) },
  }, { openWorld: true, showWidget: true }, async ({ siteId }) => {
    const response = asRecord(await client.request(`${sitePath(siteId)}/publish`, { method: "POST" }));
    const urls = await buildPublicUrls(client, siteId);
    return { site: compactSite(asRecord(response.site)), version: response.version, ...urls, editorUrl: client.editorUrl(siteId) };
  });

  registerTool(server, "handout_unpublish_site", {
    title: "Unpublish a site",
    description: "Remove a live site's public availability without deleting version history. Call only after explicit user approval.",
    inputSchema: { siteId: z.string().min(1) },
  }, { destructive: true, openWorld: true, showWidget: true }, async ({ siteId }) => {
    const response = asRecord(await client.request(`${sitePath(siteId)}/unpublish`, { method: "POST" }));
    return { site: compactSite(asRecord(response.site)), editorUrl: client.editorUrl(siteId) };
  });

  registerTool(server, "handout_restore_site_version", {
    title: "Restore a site version",
    description: "Replace the current draft with a selected historical version. This does not publish it.",
    inputSchema: { siteId: z.string().min(1), versionId: z.string().min(1) },
  }, { destructive: true, showWidget: true }, async ({ siteId, versionId }) => {
    const response = asRecord(await client.request(`${sitePath(siteId)}/versions/${encodeURIComponent(versionId)}/restore`, { method: "POST" }));
    const content = asRecord(await client.request(`${sitePath(siteId)}/content`));
    return { site: compactSite(asRecord(response.site)), version: response.version, draftRevision: content.draftRevision, editorUrl: client.editorUrl(siteId) };
  });

  registerTool(server, "handout_set_site_lifecycle", {
    title: "Set site lifecycle",
    description: "Archive an active site or restore an archived site. Archiving also removes public availability and requires explicit user intent.",
    inputSchema: { siteId: z.string().min(1), action: z.enum(["archive", "restore"]) },
  }, { destructive: true, openWorld: true, showWidget: true }, async ({ siteId, action }) => {
    const response = asRecord(await client.request(`${sitePath(siteId)}/${action}`, { method: "POST" }));
    return { site: compactSite(asRecord(response.site)), editorUrl: client.editorUrl(siteId) };
  });

  registerTool(server, "handout_upsert_variants", {
    title: "Create or update recipient variants",
    description: "Validate, preview, or batch-create/update up to 100 recipient variants using canonical variable keys. Prefer slug matching for account lists.",
    inputSchema: {
      siteId: z.string().min(1),
      matchBy: z.enum(["id", "slug"]).default("slug"),
      preview: z.boolean().default(false),
      variants: z.array(variantInputSchema).min(1).max(100),
    },
  }, { showWidget: true }, async ({ siteId, matchBy, preview, variants }) => {
    const slugs = variants.map((variant: { slug: string }) => variant.slug);
    if (new Set(slugs).size !== slugs.length) throw new Error("Each variant slug must appear only once in a batch.");
    if (matchBy === "id" && variants.some((variant: { id?: string }) => !variant.id)) throw new Error("Every variant requires id when matchBy is id.");
    const contentResponse = asRecord(await client.request(`${sitePath(siteId)}/content`));
    const content = siteContentSchema.parse(contentResponse.draftContent);
    const allowedKeys = new Set([...content.variables.map((variable) => variable.key), "name", "company", "website", "recipient_name", "recipient_company", "recipient_website"]);
    const unknownKeys = [...new Set(variants.flatMap((variant: { variableValues: Record<string, unknown> }) => Object.keys(variant.variableValues)).filter((key: string) => !allowedKeys.has(key)))];
    if (unknownKeys.length) throw new Error(`Unknown variable keys: ${unknownKeys.join(", ")}. Read the site's variables before personalizing.`);
    if (preview) return { preview: true, variants: variants.map(compactVariant), validVariableKeys: [...allowedKeys].sort() };
    const response = asRecord(await client.request(`${sitePath(siteId)}/variants/batch`, { method: "POST", body: { matchBy, variants } }));
    return { variants: arrayOfRecords(response.variants).map(compactVariant), publicUrls: await buildPublicUrls(client, siteId) };
  });

  registerTool(server, "handout_list_assets", {
    title: "List assets",
    description: "List compact metadata for workspace images, logos, OG images, and avatars. Binary content and uploader identities are never returned.",
    inputSchema: {
      purpose: z.enum(["image", "logo", "og_image", "avatar"]).optional(),
      search: z.string().trim().max(160).optional(),
    },
  }, { readOnly: true }, async (input) => {
    const workspace = await client.resolveWorkspace();
    return client.request(`/api/workspaces/${encodeURIComponent(workspace.id)}/assets?${toSearchParams(input)}`);
  });

  registerTool(server, "handout_import_asset", {
    title: "Import asset",
    description: "Import a PNG, JPEG, or WebP from a public HTTPS URL or bounded base64 input into the active workspace. Private-network URLs and oversized files are rejected.",
    inputSchema: {
      purpose: z.enum(["image", "logo", "og_image", "avatar"]).default("image"),
      fileName: z.string().trim().min(1).max(255).optional(),
      source: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("url"), url: z.url().max(2_048) }),
        z.object({ kind: z.literal("base64"), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), dataBase64: z.string().min(1).max(7_000_000) }),
      ]),
    },
  }, { openWorld: true }, async (input) => {
    const workspace = await client.resolveWorkspace();
    const response = asRecord(await client.request(`/api/workspaces/${encodeURIComponent(workspace.id)}/assets/import`, { method: "POST", body: input }));
    const asset = asRecord(response.asset);
    return { asset: { ...asset, url: absoluteUrl(client.apiBaseUrl, String(asset.url ?? "")) } };
  });

  registerTool(server, "handout_get_tracking_summary", {
    title: "Get engagement summary",
    description: "Summarize up to the requested limit of recent visits, clicks, navigation, and sessions, and report whether more rows exist.",
    inputSchema: trackingQuerySchema(false),
  }, { readOnly: true, showWidget: true }, async (input) => {
    const workspace = await client.resolveWorkspace();
    const query = toSearchParams({ ...input, limit: input.limit ?? 100 });
    const base = `/api/workspaces/${encodeURIComponent(workspace.id)}/tracking/v2`;
    const [eventResult, sessionResult] = await Promise.all([
      client.request(`${base}/events?${query}`), client.request(`${base}/sessions?${query}`),
    ]);
    const eventResponse = asRecord(eventResult);
    const sessionResponse = asRecord(sessionResult);
    const events = Array.isArray(eventResponse.events) ? eventResponse.events.filter(isRecord) : [];
    const sessions = Array.isArray(sessionResponse.sessions) ? sessionResponse.sessions.filter(isRecord) : [];
    const nextEventCursor = typeof eventResponse.nextCursor === "string" ? eventResponse.nextCursor : null;
    const nextSessionCursor = typeof sessionResponse.nextCursor === "string" ? sessionResponse.nextCursor : null;
    return {
      metrics: {
        eventCount: events.length, sessionCount: sessions.length,
        siteVisits: countBy(events, "type", "site_visit"), buttonClicks: countBy(events, "type", "button_click"),
        linkClicks: countBy(events, "type", "link_click"), tabSwitches: countBy(events, "type", "tab_switch"),
        activeSessions: countBy(sessions, "state", "active"),
      },
      coverage: {
        eventRows: events.length,
        sessionRows: sessions.length,
        limitPerCollection: input.limit ?? 100,
        isPartial: Boolean(nextEventCursor || nextSessionCursor),
      },
      nextEventCursor,
      nextSessionCursor,
    };
  });

  registerTool(server, "handout_query_tracking", {
    title: "Query engagement records",
    description: "Page through detailed events or sessions only when the engagement summary is insufficient. Filters are specific to the selected view.",
    inputSchema: {
      view: z.enum(["events", "sessions"]),
      ...trackingQuerySchema(true),
      sessionId: z.string().optional().describe("Events only"),
      eventType: z.enum(["site_visit", "button_click", "link_click", "tab_switch", "slack_share", "webhook_send"]).optional().describe("Events only"),
      source: z.enum(["browser", "server", "slack_og_image", "webhook"]).optional().describe("Events only"),
      state: z.enum(["active", "ended", "expired", "suppressed"]).optional().describe("Sessions only"),
    },
  }, { readOnly: true }, async ({ view, eventType, ...input }) => {
    if (view === "events" && input.state) throw new Error("state is available only when view is sessions.");
    if (view === "sessions" && (input.sessionId || eventType || input.source)) {
      throw new Error("sessionId, eventType, and source are available only when view is events.");
    }
    const workspace = await client.resolveWorkspace();
    const query = toSearchParams({ ...input, ...(eventType ? { type: eventType } : {}) });
    const response = asRecord(await client.request(`/api/workspaces/${encodeURIComponent(workspace.id)}/tracking/v2/${view}?${query}`));
    return { view, ...response };
  });

  registerTool(server, "handout_manage_automation", {
    title: "Manage webhook automation",
    description: "Validate, create, update, enable, pause, test, or retry a workspace webhook automation. Signing secrets and retained delivery payloads are never exposed.",
    inputSchema: {
      action: z.enum(["validate", "create", "update", "set_state", "test", "retry_delivery"]),
      automationId: z.uuid().optional(),
      deliveryId: z.uuid().optional(),
      name: z.string().trim().min(1).max(120).optional(),
      endpointUrl: z.url().max(2_048).optional(),
      trigger: automationTriggerSchema.optional(),
      state: z.enum(["enabled", "paused"]).optional(),
    },
  }, { openWorld: true }, async ({ action, automationId, deliveryId, name, endpointUrl, trigger, state }) => {
    const workspace = await client.resolveWorkspace();
    const base = `/api/workspaces/${encodeURIComponent(workspace.id)}/automations`;
    const configuration = { ...(name !== undefined ? { name } : {}), ...(endpointUrl !== undefined ? { endpointUrl } : {}), ...(trigger !== undefined ? { trigger } : {}) };
    if (action === "validate") {
      if (automationId || deliveryId || state) throw new Error("validate accepts only name, endpointUrl, and trigger.");
      if (!name || !endpointUrl || !trigger) throw new Error("Validation requires name, endpointUrl, and trigger.");
      return { valid: true, preview: true, configuration: { name, endpointHost: new URL(endpointUrl).hostname, trigger } };
    }
    if (action === "create") {
      if (automationId || deliveryId || state) throw new Error("create accepts only name, endpointUrl, and trigger.");
      if (!name || !endpointUrl || !trigger) throw new Error("Creation requires name, endpointUrl, and trigger.");
      const response = asRecord(await client.request(base, { method: "POST", body: { name, endpointUrl, trigger } }));
      return { automation: response.automation, secretWithheld: true };
    }
    if (!automationId) throw new Error(`${action} requires automationId.`);
    if (action === "update") {
      if (deliveryId || state) throw new Error("update accepts automationId and one or more configuration fields.");
      if (!Object.keys(configuration).length) throw new Error("Update requires at least one of name, endpointUrl, or trigger.");
      return client.request(`${base}/${encodeURIComponent(automationId)}`, { method: "PATCH", body: configuration });
    }
    if (action === "set_state") {
      if (deliveryId || Object.keys(configuration).length) throw new Error("set_state accepts only automationId and state.");
      if (!state) throw new Error("set_state requires state.");
      return client.request(`${base}/${encodeURIComponent(automationId)}/${state === "enabled" ? "enable" : "pause"}`, { method: "POST" });
    }
    if (action === "test") {
      if (deliveryId || state || Object.keys(configuration).length) throw new Error("test accepts only automationId.");
      return client.request(`${base}/${encodeURIComponent(automationId)}/test`, { method: "POST" });
    }
    if (state || Object.keys(configuration).length) throw new Error("retry_delivery accepts only automationId and deliveryId.");
    if (!deliveryId) throw new Error("retry_delivery requires deliveryId.");
    await client.request(`${base}/${encodeURIComponent(automationId)}/deliveries/${encodeURIComponent(deliveryId)}/retry`, { method: "POST" });
    return { automationId, deliveryId, queued: true };
  });

  registerTool(server, "handout_delete", {
    title: "Preview or delete a Handout object",
    description: "Preview the exact impact before deleting a site, page, variable, sidebar item, recipient variant, asset, or automation. Confirmation requires the exact returned targetName.",
    inputSchema: {
      targetType: z.enum(["site", "page", "variable", "sidebar_item", "variant", "asset", "automation"]),
      targetId: z.string().min(1),
      siteId: z.string().min(1).optional().describe("Required for page, variable, sidebar_item, and variant"),
      expectedDraftRevision: z.number().int().positive().optional().describe("Required to confirm page, variable, or sidebar_item deletion"),
      confirm: z.boolean().default(false),
      confirmName: z.string().optional(),
    },
  }, { destructive: true, openWorld: true, showWidget: true }, async (input) => deleteTarget(client, input as Parameters<typeof deleteTarget>[1]));

  return server;
}

async function deleteTarget(client: HandoutClient, input: {
  targetType: "site" | "page" | "variable" | "sidebar_item" | "variant" | "asset" | "automation";
  targetId: string;
  siteId?: string;
  expectedDraftRevision?: number;
  confirm: boolean;
  confirmName?: string;
}) {
  if (["page", "variable", "sidebar_item", "variant"].includes(input.targetType) && !input.siteId) {
    throw new Error(`${input.targetType} deletion requires siteId.`);
  }
  if (input.confirm && !input.confirmName) throw new Error("Confirmed deletion requires confirmName from a deletion preview.");

  if (input.targetType === "site") {
    const detail = asRecord(await client.request(sitePath(input.targetId)));
    const site = compactSite(asRecord(detail.site));
    const targetName = String(site.name ?? input.targetId);
    verifyDeleteConfirmation(input, targetName);
    if (input.confirm) await client.request(sitePath(input.targetId), { method: "DELETE" });
    return deletionResult(input, targetName, [], input.confirm, { target: site, warning: "Deleting a site removes its draft, variants, versions, and tracking association. Archive it instead when recovery may be needed." });
  }

  if (input.targetType === "page" || input.targetType === "variable" || input.targetType === "sidebar_item") {
    const contentResponse = asRecord(await client.request(`${sitePath(input.siteId!)}/content`));
    const content = siteContentSchema.parse(contentResponse.draftContent);
    const variantsResponse = input.targetType === "variable"
      ? asRecord(await client.request(`${sitePath(input.siteId!)}/variants`))
      : { variants: [] };
    const references = input.targetType === "variable"
      ? analyzeVariableUsage(content, input.targetId, arrayOfRecords(variantsResponse.variants)).references
      : [];
    const removed = removeContentTarget(content, { targetType: input.targetType, targetId: input.targetId });
    verifyDeleteConfirmation(input, removed.targetName);
    if (references.length) {
      if (input.confirm) throw new Error(`Cannot delete variable “${removed.targetName}” while ${references.length} reference${references.length === 1 ? " remains" : "s remain"}. Remove those references first.`);
      return deletionResult(input, removed.targetName, references, false, { blocked: true, draftRevision: contentResponse.draftRevision });
    }
    if (input.confirm) {
      if (!input.expectedDraftRevision) throw new Error("Confirmed content deletion requires expectedDraftRevision from the preview.");
      if (input.expectedDraftRevision !== contentResponse.draftRevision) {
        throw new Error(`Draft revision conflict: expected ${input.expectedDraftRevision}, current revision is ${String(contentResponse.draftRevision)}. Preview deletion again.`);
      }
      const updated = asRecord(await client.request(`${sitePath(input.siteId!)}/content`, {
        method: "PUT",
        body: { expectedDraftRevision: input.expectedDraftRevision, draftContent: removed.content },
      }));
      return deletionResult(input, removed.targetName, [], true, { draftRevision: updated.draftRevision });
    }
    return deletionResult(input, removed.targetName, [], false, { draftRevision: contentResponse.draftRevision });
  }

  if (input.targetType === "variant") {
    const response = asRecord(await client.request(`${sitePath(input.siteId!)}/variants`));
    const variant = arrayOfRecords(response.variants).find((candidate) => candidate.id === input.targetId);
    if (!variant) throw new Error(`Recipient variant was not found: ${input.targetId}`);
    const targetName = String(variant.name ?? variant.slug ?? input.targetId);
    verifyDeleteConfirmation(input, targetName);
    if (input.confirm) await client.request(`${sitePath(input.siteId!)}/variants/${encodeURIComponent(input.targetId)}`, { method: "DELETE" });
    return deletionResult(input, targetName, [], input.confirm, { target: compactVariant(variant) });
  }

  const workspace = await client.resolveWorkspace();
  if (input.targetType === "automation") {
    const base = `/api/workspaces/${encodeURIComponent(workspace.id)}/automations`;
    const detail = asRecord(await client.request(`${base}/${encodeURIComponent(input.targetId)}`));
    const automation = asRecord(detail.automation);
    const targetName = String(automation.name ?? input.targetId);
    verifyDeleteConfirmation(input, targetName);
    if (input.confirm) await client.request(`${base}/${encodeURIComponent(input.targetId)}`, { method: "DELETE" });
    return deletionResult(input, targetName, [], input.confirm, { target: automation, warning: "Pending deliveries may be cancelled and the webhook will stop receiving future events." });
  }

  const assetResponse = asRecord(await client.request(`/api/workspaces/${encodeURIComponent(workspace.id)}/assets`));
  const asset = arrayOfRecords(assetResponse.assets).find((candidate) => candidate.id === input.targetId);
  if (!asset) throw new Error(`Workspace asset was not found: ${input.targetId}`);
  const accessibleSites: Array<Record<string, unknown>> = [];
  let siteCursor: string | null = null;
  do {
    const sitesResponse = asRecord(await client.request(`/api/sites?${toSearchParams({ status: "all", limit: 100, cursor: siteCursor })}`));
    accessibleSites.push(...arrayOfRecords(sitesResponse.sites));
    siteCursor = typeof sitesResponse.nextCursor === "string" ? sitesResponse.nextCursor : null;
  } while (siteCursor);
  const references: Array<{ kind: string; siteId: string; siteName: string; path: Array<string | number> }> = [];
  for (const site of accessibleSites) {
    try {
      const contentResponse = asRecord(await client.request(`${sitePath(String(site.id))}/content`));
      const usage = analyzeAssetUsage(siteContentSchema.parse(contentResponse.draftContent), input.targetId);
      references.push(...usage.references.map((reference) => ({ ...reference, siteId: String(site.id), siteName: String(site.name ?? "Untitled") })));
    } catch (error) {
      if (!(error instanceof HandoutApiError && (error.status === 403 || error.status === 404 || error.status === 409))) throw error;
    }
  }
  const targetName = String(asset.fileName ?? input.targetId);
  verifyDeleteConfirmation(input, targetName);
  if (references.length) {
    if (input.confirm) throw new Error(`Cannot delete asset “${targetName}” while ${references.length} reference${references.length === 1 ? " remains" : "s remain"}. Remove those references first.`);
    return deletionResult(input, targetName, references, false, { blocked: true, target: asset });
  }
  if (input.confirm) await client.request(`/api/workspaces/${encodeURIComponent(workspace.id)}/assets/${encodeURIComponent(input.targetId)}`, { method: "DELETE" });
  return deletionResult(input, targetName, [], input.confirm, { target: asset });
}

function verifyDeleteConfirmation(input: { confirm: boolean; confirmName?: string }, targetName: string) {
  if (input.confirm && input.confirmName !== targetName) {
    throw new Error(`confirmName must exactly match the deletion preview targetName: ${targetName}`);
  }
}

function deletionResult(
  input: { targetType: string; targetId: string; siteId?: string },
  targetName: string,
  references: unknown[],
  deleted: boolean,
  extra: Record<string, unknown> = {},
) {
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    ...(input.siteId ? { siteId: input.siteId } : {}),
    targetName,
    deleted,
    referenceCount: references.length,
    references: references.slice(0, 50),
    ...extra,
  };
}

function registerTool(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> },
  hints: ToolHints,
  handler: (input: Record<string, any>) => Promise<unknown> | unknown,
  textFormatter?: (value: unknown) => string,
) {
  const securitySchemes = [{ type: "oauth2", scopes: ["handout:operate"] }];
  server.registerTool(name, {
    ...config,
    annotations: {
      readOnlyHint: hints.readOnly === true,
      destructiveHint: hints.destructive === true,
      openWorldHint: hints.openWorld === true,
      idempotentHint: hints.readOnly === true,
    },
    _meta: {
      securitySchemes,
      ...(hints.showWidget ? {
        ui: { resourceUri: HANDOUT_WIDGET_URI },
        "openai/outputTemplate": HANDOUT_WIDGET_URI,
        "openai/toolInvocation/invoking": `${config.title}…`,
        "openai/toolInvocation/invoked": config.title,
      } : {}),
    },
  }, async (input) => {
    try {
      const result = sanitizeAgentOutput(await handler(input));
      return { structuredContent: toStructuredContent(result), content: [{ type: "text" as const, text: textFormatter ? textFormatter(result) : formatToolText(name, result) }] };
    } catch (error) {
      const result = toStructuredContent(sanitizeAgentOutput(toToolError(error)));
      const protectedResourceMetadataUrl = protectedResourceMetadataUrls.get(server);
      return {
        isError: true,
        structuredContent: result,
        content: [{ type: "text" as const, text: formatToolText(name, result) }],
        ...(error instanceof HandoutApiError && error.status === 401 && protectedResourceMetadataUrl ? {
          _meta: {
            "mcp/www_authenticate": [
              `Bearer resource_metadata="${protectedResourceMetadataUrl}", error="invalid_token", error_description="Connect your Handout account to continue"`,
            ],
          },
        } : {}),
      };
    }
  });
}

function registerTextResource(server: McpServer, name: string, uri: string, text: string) {
  server.registerResource(name, uri, { title: name, mimeType: "text/markdown" }, async () => ({ contents: [{ uri, mimeType: "text/markdown", text }] }));
}

function registerJsonResource(server: McpServer, name: string, uri: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  server.registerResource(name, uri, { title: name, mimeType: "application/json" }, async () => ({ contents: [{ uri, mimeType: "application/json", text }] }));
}

function promptMessages(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

function sitePath(siteId: string) { return `/api/sites/${encodeURIComponent(siteId)}`; }

function trackingQuerySchema(includeCursor: boolean) {
  return {
    siteId: z.string().optional(),
    recipientId: z.string().optional(),
    from: z.string().datetime({ offset: true }).optional().describe("Inclusive ISO 8601 timestamp"),
    to: z.string().datetime({ offset: true }).optional().describe("Inclusive ISO 8601 timestamp"),
    ...(includeCursor ? { cursor: z.string().optional() } : {}),
    limit: z.number().int().min(1).max(100).optional(),
  };
}

function withEditorUrl(client: HandoutClient, value: unknown) {
  const result = asRecord(value);
  const site = isRecord(result.site) ? result.site : null;
  const siteId = site && typeof site.id === "string" ? site.id : null;
  return {
    ...result,
    ...(site ? { site: compactSite(site) } : {}),
    ...(siteId && client.editorUrl(siteId) ? { editorUrl: client.editorUrl(siteId) } : {}),
  };
}

function compactSite(site: Record<string, unknown>) {
  return pickDefined(site, [
    "id", "publicId", "name", "slug", "status", "visibility", "recipientCount",
    "createdAt", "updatedAt", "publishedAt", "archivedAt", "permissions",
  ]);
}

function compactVariant(variant: Record<string, unknown>) {
  return pickDefined(variant, [
    "id", "shortCode", "siteId", "name", "slug", "recipientName", "recipientCompany",
    "variableValues", "revisionNumber", "createdAt", "updatedAt",
  ]);
}

function pickDefined(record: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

async function buildPublicUrls(client: HandoutClient, siteId: string) {
  const [detailResult, variantsResult, workspace] = await Promise.all([
    client.request(sitePath(siteId)),
    client.request(`${sitePath(siteId)}/variants`),
    client.resolveWorkspace(),
  ]);
  const site = asRecord(asRecord(detailResult).site);
  const origin = client.publicSiteOrigin ?? client.apiBaseUrl;
  const canonicalSiteUrl = site.publicId
    ? `${origin}/${encodeURIComponent(String(site.publicId))}/{recipientName}/{recipientCompany}/{recipientWebsite}`
    : null;
  const legacySiteUrl = `${origin}/${encodeURIComponent(workspace.slug)}/${encodeURIComponent(String(site.slug))}`;
  const variants = arrayOfRecords(asRecord(variantsResult).variants).map((variant) => ({
    id: variant.id,
    name: variant.name,
    slug: variant.slug,
    url: variant.shortCode
      ? `${origin}/${encodeURIComponent(String(variant.shortCode))}`
      : `${legacySiteUrl}/${encodeURIComponent(String(variant.slug))}`,
  }));
  return {
    siteUrl: legacySiteUrl,
    recipientLinkTemplate: canonicalSiteUrl,
    variants,
    availability: { published: site.status === "published", visibility: site.visibility },
  };
}

function absoluteUrl(origin: string, path: string) {
  if (!path) return null;
  return new URL(path, `${origin.replace(/\/$/, "")}/`).toString();
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { value };
}

function completeJsonText(value: unknown) {
  return JSON.stringify(value);
}

function toToolError(error: unknown): Record<string, unknown> {
  if (error instanceof HandoutApiError) {
    if (isRecord(error.payload) && isRecord(error.payload.error)) return { error: { status: error.status, ...error.payload.error } };
    return { error: { status: error.status, message: error.message } };
  }
  return { error: { message: error instanceof Error ? error.message : String(error) } };
}

function asRecord(value: unknown): Record<string, any> {
  if (!isRecord(value)) throw new Error("Expected an object response from Handout.");
  return value;
}

function countBy(records: Array<Record<string, unknown>>, key: string, value: string) {
  return records.filter((record) => record[key] === value).length;
}

function toSearchParams(input: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

const OPERATING_GUIDE = `# Operating Handout\n\n1. Read capabilities and workspace context.\n2. Select or create a private draft.\n3. Use selective site includes; request complete content immediately before editing and retain draftRevision.\n4. Choose the blocks needed for the user's story.\n5. Call handout_get_block_schemas for those blocks; do not guess attributes or nesting.\n6. Apply the narrowest atomic handout_edit_site operation batch with expectedDraftRevision.\n7. Validate and repair every issue.\n8. Preview, then upsert recipient variants.\n9. Ask before publishing or changing public availability.\n10. Read public URLs from handout_get_site rather than constructing them.\n11. Preview deletion, inspect references, and confirm only with the exact returned targetName.\n12. For analytics, summarize first and query detailed events or sessions only as needed.`;

const CONTENT_MODEL_GUIDE = `# Content model\n\nSiteContent schema v3 owns theme, settings, variables, ordered pages, sidebar links, and sidebar CTAs. Each page owns one Tiptap doc. Use node content for editable text and attrs only for configuration. Preserve stable IDs. For custom variables, variableToken.attrs.variableId references variables[].id, while variant variableValues and {{variable_key}} URL templates use variables[].key. Capabilities lists available top-level blocks. Call handout_get_block_schemas with the blocks you intend to use for exact attributes, defaults, options, children, marks, and examples. Use handout://schema/site-document only when the complete catalog is necessary; large icon and design option sets live at handout://catalog/icons and handout://catalog/design-options.`;

const CONTENT_PATTERNS_GUIDE = `# Common Tiptap content patterns

Use these validated schema-v3 shapes as composable examples. Keep IDs stable and unique within the site.

## Personalized page title

Define {"id":"var-company","key":"company_name","label":"Company name","type":"text","defaultValue":"your team"}. Inline content uses the definition ID:

\`\`\`json
{"type":"pageTitleSection","attrs":{"id":"title-overview","align":"center"},"content":[{"type":"pageTitleTitle","content":[{"type":"text","text":"A plan for "},{"type":"variableToken","attrs":{"variableId":"var-company","fallbackName":"your team"}}]},{"type":"pageTitleSubtitle","content":[{"type":"text","text":"A concise shared plan."}]}]}
\`\`\`

A recipient variant uses the key: {"variableValues":{"company_name":"Acme"}}. URL-like attrs and sidebar hrefs also use the key: "{{company_name}}".

## Two-column icon cards

\`\`\`json
{"type":"gridBlock","attrs":{"id":"grid-outcomes","columns":2},"content":[{"type":"gridRow","content":[{"type":"gridCell","content":[{"type":"iconCard","attrs":{"id":"card-one","icon":"target","iconColor":"blue"},"content":[{"type":"iconCardTitle","content":[{"type":"text","text":"Shared context"}]},{"type":"iconCardBody","content":[{"type":"text","text":"One clear narrative for the buying team."}]}]}]},{"type":"gridCell","content":[{"type":"iconCard","attrs":{"id":"card-two","icon":"rocket","iconColor":"green"},"content":[{"type":"iconCardTitle","content":[{"type":"text","text":"Visible momentum"}]},{"type":"iconCardBody","content":[{"type":"text","text":"A concrete owner, action, and timeline."}]}]}]}]}]}
\`\`\`

## Mutual action list

\`\`\`json
{"type":"taskList","attrs":{"id":"tasks-rollout"},"content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Confirm success criteria"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Launch the first workflow"}]}]}]}
\`\`\`

## Table

\`\`\`json
{"type":"table","attrs":{"id":"table-plan"},"content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Phase"}]}]},{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Owner"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Launch"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Joint team"}]}]}]}]}
\`\`\`

## Icon list and CTA

\`\`\`json
[{"type":"iconList","attrs":{"id":"list-next"},"content":[{"type":"iconListItem","attrs":{"icon":"users","iconColor":"blue"},"content":[{"type":"paragraph","content":[{"type":"text","text":"Confirm the people who need to approve."}]}]}]},{"type":"buttonBlock","attrs":{"id":"cta-primary","href":"{{primary_cta_url}}","fullWidth":true},"content":[{"type":"text","text":"Choose a time"}]}]
\`\`\``;

const PERSONALIZATION_GUIDE = `# Personalization\n\nKeep one canonical site. Define reusable variables in SiteContent and store per-recipient values on variants. A variableToken points to the variable definition id; variableValues are keyed by the definition key. Reserve recipient-name/name, recipient-company/company, and recipient_website/website for core identity. Match batches by stable slugs, normalize company domains, include fallbacks, and review a sample before creating a large batch. Variants do not fork page content.`;

const QUALITY_GUIDE = `# Site quality\n\nLead with a recipient-relevant point of view, not a product slogan. Keep one primary narrative and one primary CTA. Use 3-6 scannable sections, concrete proof, short paragraphs, meaningful headings, and restrained visual variety. Personalization must change relevance, not merely insert a company name. Validate every draft and never invent customer proof, metrics, logos, or claims.`;
