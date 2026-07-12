#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  SITE_DOCUMENT_SCHEMA_VERSION,
  SUPPORTED_SITE_DOCUMENT_MARK_TYPES,
  SUPPORTED_SITE_DOCUMENT_NODE_TYPES,
  siteContentSchema,
} from "@lightsite/site-document";
import { z } from "zod";

const apiBaseUrl = (process.env.LIGHTSITE_API_BASE_URL ?? "http://localhost:3011").replace(/\/$/, "");

const variantInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string(),
  name: z.string(),
  recipientName: z.string().nullable().optional(),
  recipientCompany: z.string().nullable().optional(),
  variableValues: z.record(z.string(), z.unknown()).default({}),
});

const siteDocumentExample = {
  type: "doc",
  content: [
    {
      type: "pageTitleSection",
      attrs: { id: "title-overview", align: "center" },
      content: [
        {
          type: "pageTitleTitle",
          content: [{ type: "text", text: "Implementation plan" }],
        },
        {
          type: "pageTitleSubtitle",
          content: [{ type: "text", text: "A focused rollout for " }, {
            type: "variableToken",
            attrs: { variableId: "company_name", fallbackName: "your team" },
          }],
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
      content: [{ type: "text", text: "One canonical Tiptap document powers editing, preview, and publishing." }],
    },
    {
      type: "buttonBlock",
      attrs: { id: "cta-primary", href: "{{primary_cta_url}}", fullWidth: false },
      content: [{ type: "text", text: "Book implementation review" }],
    },
  ],
};

const server = new McpServer({
  name: "lightsite",
  version: "0.1.0",
});

registerTool("lightsite_get_capabilities", {
  title: "Get Lightsite agent capabilities",
  description: "Returns the canonical Tiptap JSON workflow, supported node and mark types, and configuration seen by this MCP server.",
  inputSchema: {},
}, async () => ({
  apiBaseUrl,
  workspaceId: process.env.LIGHTSITE_AGENT_WORKSPACE_ID ?? null,
  publicSiteOrigin: process.env.LIGHTSITE_PUBLIC_SITE_ORIGIN ?? null,
  workspaceSlug: process.env.LIGHTSITE_AGENT_WORKSPACE_SLUG ?? null,
  auth: {
    bearerTokenConfigured: Boolean(process.env.LIGHTSITE_AGENT_API_TOKEN),
    devAuthEnabled: process.env.LIGHTSITE_DEV_AUTH === "1",
  },
  siteContent: {
    sourceOfTruth: "sites.draftContent",
    schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
    documentFormat: "Tiptap JSONContent",
    pageShape: {
      id: "string",
      name: "string",
      slug: "string",
      status: '"visible" | "hidden"',
      sortOrder: "non-negative integer",
      document: "Tiptap JSON document with a doc root",
    },
    sidebarShape: {
      sections: "labels for tabs, links, and next steps",
      links: "ordered visible or hidden external sidebar links",
      nextSteps: "ordered visible or hidden sidebar CTA buttons",
    },
    supportedNodeTypes: [...SUPPORTED_SITE_DOCUMENT_NODE_TYPES],
    supportedMarkTypes: [...SUPPORTED_SITE_DOCUMENT_MARK_TYPES],
    documentExample: siteDocumentExample,
  },
  workflow: [
    "Create or list a site.",
    "Set visibility to team before browser-testing or sharing a public URL.",
    "Read current JSON content and draftRevision.",
    "Write the complete canonical SiteContent JSON, including each page's Tiptap document, with expectedDraftRevision.",
    "Validate the JSON.",
    "Batch upsert variants by slug.",
    "Publish only after explicit user approval.",
    "Read tracking summary first, then event details if needed.",
  ],
}));

registerTool("lightsite_list_sites", {
  title: "List sites",
  description: "Lists sites available to the configured actor/workspace.",
  inputSchema: {},
}, () => apiRequest("/api/sites"));

registerTool("lightsite_create_site", {
  title: "Create site",
  description: "Creates a draft site shell. Follow with lightsite_update_site_content to write the JSON.",
  inputSchema: {
    name: z.string().min(1).max(160),
    slug: z.string().max(96).optional(),
  },
}, (input) => apiRequest("/api/sites", {
  method: "POST",
  body: input,
}));

registerTool("lightsite_get_site", {
  title: "Get site metadata",
  description: "Reads site metadata and permissions.",
  inputSchema: {
    siteId: z.string().min(1),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}`));

registerTool("lightsite_update_site", {
  title: "Update site metadata",
  description: "Updates site metadata such as name, slug, or visibility. Set visibility to team before sharing or browser-testing public URLs.",
  inputSchema: {
    siteId: z.string().min(1),
    name: z.string().min(1).max(160).optional(),
    slug: z.string().min(1).max(96).optional(),
    visibility: z.enum(["private", "team"]).optional(),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}`, {
  method: "PATCH",
  body: {
    name: input.name,
    slug: input.slug,
    visibility: input.visibility,
  },
}));

registerTool("lightsite_get_site_content", {
  title: "Get site JSON content",
  description: "Reads the editable SiteContent JSON and draftRevision.",
  inputSchema: {
    siteId: z.string().min(1),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/content`));

registerTool("lightsite_update_site_content", {
  title: "Update site JSON content",
  description: "Replaces the editable canonical SiteContent JSON. Page content must be Tiptap JSON. Use expectedDraftRevision from lightsite_get_site_content.",
  inputSchema: {
    siteId: z.string().min(1),
    expectedDraftRevision: z.number().int().positive().optional(),
    draftContent: siteContentSchema,
    changeSummary: z.string().max(500).optional(),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/content`, {
  method: "PUT",
  body: {
    expectedDraftRevision: input.expectedDraftRevision,
    draftContent: input.draftContent,
    changeSummary: input.changeSummary,
  },
}));

registerTool("lightsite_validate_site_content", {
  title: "Validate site JSON content",
  description: "Checks whether SiteContent JSON is ready to publish.",
  inputSchema: {
    siteId: z.string().min(1),
    draftContent: siteContentSchema,
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/content/validate`, {
  method: "POST",
  body: {
    draftContent: input.draftContent,
  },
}));

registerTool("lightsite_publish_site", {
  title: "Publish site",
  description: "Publishes the current draft JSON as an immutable public snapshot.",
  inputSchema: {
    siteId: z.string().min(1),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/publish`, {
  method: "POST",
}));

registerTool("lightsite_unpublish_site", {
  title: "Unpublish site",
  description: "Unpublishes a live site without deleting version history.",
  inputSchema: {
    siteId: z.string().min(1),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/unpublish`, {
  method: "POST",
}));

registerTool("lightsite_list_variants", {
  title: "List site variants",
  description: "Lists active variants for a site.",
  inputSchema: {
    siteId: z.string().min(1),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/variants`));

registerTool("lightsite_get_public_urls", {
  title: "Get public site URLs",
  description: "Builds the default public site URL and variant URLs from site and variant slugs.",
  inputSchema: {
    siteId: z.string().min(1),
    workspaceSlug: z.string().optional(),
    publicSiteOrigin: z.string().optional(),
  },
}, async (input) => {
  const [siteResult, variantsResult] = await Promise.all([
    apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}`),
    apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/variants`),
  ]);
  const site = asRecord(siteResult).site;
  const variants = asRecord(variantsResult).variants;
  const workspaceSlug = input.workspaceSlug ?? process.env.LIGHTSITE_AGENT_WORKSPACE_SLUG;
  const origin = (input.publicSiteOrigin ?? process.env.LIGHTSITE_PUBLIC_SITE_ORIGIN ?? apiBaseUrl).replace(/\/$/, "");

  if (!workspaceSlug) {
    throw new Error("workspaceSlug is required unless LIGHTSITE_AGENT_WORKSPACE_SLUG is configured.");
  }

  if (!isRecord(site) || !Array.isArray(variants)) {
    throw new Error("Unexpected site or variant response while building public URLs.");
  }

  const siteUrl = `${origin}/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(String(site.slug))}`;

  return {
    siteUrl,
    variantUrls: variants
      .filter(isRecord)
      .map((variant) => ({
        id: String(variant.id),
        slug: String(variant.slug),
        name: String(variant.name),
        url: `${siteUrl}/${encodeURIComponent(String(variant.slug))}`,
      })),
  };
});

registerTool("lightsite_batch_upsert_variants", {
  title: "Batch upsert variants",
  description: "Creates or updates many site variants at once. Prefer matchBy=slug for account lists.",
  inputSchema: {
    siteId: z.string().min(1),
    matchBy: z.enum(["id", "slug"]).default("slug"),
    variants: z.array(variantInputSchema).min(1).max(100),
  },
}, (input) => apiRequest(`/api/sites/${encodeURIComponent(input.siteId)}/variants/batch`, {
  method: "POST",
  body: {
    matchBy: input.matchBy,
    variants: input.variants,
  },
}));

registerTool("lightsite_get_tracking_summary", {
  title: "Get tracking summary",
  description: "Gets a v2 tracking activity summary from recent events and sessions. Use this before listing detailed records.",
  inputSchema: {
    workspaceId: z.string().optional(),
    siteId: z.string().optional(),
    recipientId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
}, async (input) => {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const query = toSearchParams({
    ...input,
    limit: input.limit ?? 100,
  });
  const basePath = `/api/workspaces/${encodeURIComponent(workspaceId)}/tracking/v2`;
  const [eventsResult, sessionsResult] = await Promise.all([
    apiRequest(`${basePath}/events?${query}`),
    apiRequest(`${basePath}/sessions?${query}`),
  ]);
  const eventsResponse = asRecord(eventsResult);
  const sessionsResponse = asRecord(sessionsResult);
  const events = Array.isArray(eventsResponse.events) ? eventsResponse.events.filter(isRecord) : [];
  const sessions = Array.isArray(sessionsResponse.sessions) ? sessionsResponse.sessions.filter(isRecord) : [];

  return {
    metrics: {
      eventCount: events.length,
      sessionCount: sessions.length,
      siteVisits: countBy(events, "type", "site_visit"),
      buttonClicks: countBy(events, "type", "button_click"),
      linkClicks: countBy(events, "type", "link_click"),
      tabSwitches: countBy(events, "type", "tab_switch"),
      slackShares: countBy(events, "type", "slack_share"),
      webhookSends: countBy(events, "type", "webhook_send"),
      activeSessions: countBy(sessions, "state", "active"),
      sessionsWithRecordings: sessions.filter((session) => {
        const recording = isRecord(session.recording) ? session.recording : null;
        return recording?.available === true;
      }).length,
    },
    events,
    sessions,
    nextEventCursor: typeof eventsResponse.nextCursor === "string" ? eventsResponse.nextCursor : null,
    nextSessionCursor: typeof sessionsResponse.nextCursor === "string" ? sessionsResponse.nextCursor : null,
  };
});

registerTool("lightsite_list_tracking_events", {
  title: "List tracking events",
  description: "Lists detailed v2 tracking events for deeper inspection.",
  inputSchema: {
    workspaceId: z.string().optional(),
    siteId: z.string().optional(),
    recipientId: z.string().optional(),
    sessionId: z.string().optional(),
    type: z.string().optional(),
    source: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
}, (input) => apiRequest(`/api/workspaces/${encodeURIComponent(resolveWorkspaceId(input.workspaceId))}/tracking/v2/events?${toSearchParams(input)}`));

registerTool("lightsite_list_tracking_sessions", {
  title: "List tracking sessions",
  description: "Lists v2 tracking sessions, including device, location, duration, and recording status.",
  inputSchema: {
    workspaceId: z.string().optional(),
    siteId: z.string().optional(),
    recipientId: z.string().optional(),
    state: z.enum(["active", "ended", "expired", "suppressed"]).optional(),
    recordingStatus: z.enum(["disabled", "pending", "available", "expired", "failed"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
}, (input) => apiRequest(`/api/workspaces/${encodeURIComponent(resolveWorkspaceId(input.workspaceId))}/tracking/v2/sessions?${toSearchParams(input)}`));

const transport = new StdioServerTransport();
await server.connect(transport);

function registerTool(
  name: string,
  options: {
    title: string;
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
  },
  handler: (input: Record<string, any>) => Promise<unknown> | unknown,
) {
  server.registerTool(name, options, async (input) => {
    try {
      const result = await handler(input);

      return {
        structuredContent: toStructuredContent(result),
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const result = toToolError(error);

      return {
        isError: true,
        structuredContent: result,
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  });
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}

async function apiRequest(path: string, options: {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
} = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.body),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    throw new Error(JSON.stringify({
      status: response.status,
      body: payload,
    }, null, 2));
  }

  return payload;
}

function buildHeaders(body: unknown) {
  return {
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(process.env.LIGHTSITE_AGENT_API_TOKEN
      ? { authorization: `Bearer ${process.env.LIGHTSITE_AGENT_API_TOKEN}` }
      : {}),
    ...(process.env.LIGHTSITE_DEV_AUTH === "1" ? { "x-lightsite-dev-auth": "1" } : {}),
  };
}

function parseJson(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toToolError(error: unknown) {
  if (error instanceof Error) {
    const parsed = parseJson(error.message);

    if (isRecord(parsed)) {
      return parsed;
    }

    return {
      error: {
        message: error.message,
      },
    };
  }

  return {
    error: {
      message: String(error),
    },
  };
}

function asRecord(value: unknown): Record<string, any> {
  if (!isRecord(value)) {
    throw new Error("Expected object response from Lightsite API.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveWorkspaceId(inputWorkspaceId: string | undefined) {
  const workspaceId = inputWorkspaceId ?? process.env.LIGHTSITE_AGENT_WORKSPACE_ID;

  if (!workspaceId) {
    throw new Error("workspaceId is required unless LIGHTSITE_AGENT_WORKSPACE_ID is configured.");
  }

  return workspaceId;
}

function countBy(records: Array<Record<string, any>>, key: string, value: string) {
  return records.filter((record) => record[key] === value).length;
}

function toSearchParams(input: Record<string, unknown>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (key === "workspaceId" || value === undefined || value === null || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}
