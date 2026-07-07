#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiBaseUrl = (process.env.LIGHTSITE_API_BASE_URL ?? "http://localhost:3011").replace(/\/$/, "");

const siteContentSchema = z.object({
  schemaVersion: z.literal(2),
  chrome: z.object({
    siteHeader: z.object({
      brandName: z.string(),
      logoUrl: z.string(),
      primaryButtonText: z.string(),
      primaryButtonHref: z.string(),
      secondaryButtonText: z.string(),
      secondaryButtonHref: z.string(),
      showSecondaryButton: z.boolean(),
    }),
    hero: z.object({
      avatarMode: z.enum(["single", "duo"]),
      eyebrow: z.string(),
      title: z.string(),
      subtitle: z.string(),
      avatarImageUrl: z.string(),
      avatarImageVariableKey: z.string(),
      avatarImageAlt: z.string(),
      avatarImageSecondaryUrl: z.string(),
      avatarImageSecondaryVariableKey: z.string(),
      avatarImageSecondaryAlt: z.string(),
    }),
  }),
  settings: z.object({
    showTableOfContents: z.boolean(),
    ogImageAssetId: z.string().optional(),
    allowSearchIndexing: z.literal(false),
  }),
  variables: z.array(z.object({
    id: z.string(),
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "image", "url"]),
    defaultValue: z.unknown(),
  })),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    fields: z.record(z.unknown()),
  })),
});

const variantInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string(),
  name: z.string(),
  recipientName: z.string().nullable().optional(),
  recipientCompany: z.string().nullable().optional(),
  variableValues: z.record(z.unknown()).default({}),
});

const supportedDraftBlockTypes = [
  "title",
  "heading",
  "text",
  "divider",
  "bullet-list",
  "number-list",
  "icon-list",
  "image",
  "gif",
  "image-card",
  "icon-card",
  "button",
  "calendar",
  "accordion",
  "video",
  "testimonial",
  "logo-grid",
] as const;

const draftBlockDefinitions = {
  title: {
    requiredFields: {
      text: "string",
    },
    optionalFields: {},
    example: {
      id: "title-overview",
      type: "title",
      fields: {
        text: "Implementation plan",
      },
    },
  },
  heading: {
    requiredFields: {
      text: "string",
    },
    optionalFields: {
      level: "2 | 3",
    },
    example: {
      id: "heading-context",
      type: "heading",
      fields: {
        level: 2,
        text: "Why this matters now",
      },
    },
  },
  text: {
    requiredFields: {
      text: "string",
    },
    optionalFields: {},
    example: {
      id: "text-context",
      type: "text",
      fields: {
        text: "{{company_name}} can move faster when the buying team has one clean page to review.",
      },
    },
  },
  divider: {
    requiredFields: {},
    optionalFields: {
      width: '"content" | "full"',
      spacing: '"sm" | "md" | "lg"',
    },
    example: {
      id: "divider-section",
      type: "divider",
      fields: {
        width: "content",
        spacing: "md",
      },
    },
  },
  "bullet-list": {
    requiredFields: {
      items: "string[]",
    },
    optionalFields: {},
    example: {
      id: "bullets-plan",
      type: "bullet-list",
      fields: {
        items: ["Confirm launch owner", "Align the review path", "Publish the account page"],
      },
    },
  },
  "number-list": {
    requiredFields: {
      items: "string[]",
    },
    optionalFields: {},
    example: {
      id: "steps-plan",
      type: "number-list",
      fields: {
        items: ["Draft", "Review", "Publish"],
      },
    },
  },
  "icon-list": {
    requiredFields: {
      items: "{ id?: string; icon?: string; iconTone?: string; text: string }[]",
    },
    optionalFields: {},
    example: {
      id: "icon-list-outcomes",
      type: "icon-list",
      fields: {
        items: [
          { id: "speed", icon: "zap", iconTone: "green", text: "Faster stakeholder review" },
          { id: "signal", icon: "target", iconTone: "blue", text: "Clear next-step signal" },
        ],
      },
    },
  },
  image: {
    requiredFields: {
      src: "string",
    },
    optionalFields: {
      alt: "string",
      caption: "string",
    },
    example: {
      id: "image-overview",
      type: "image",
      fields: {
        src: "/editor-assets/image-card.png",
        alt: "Product screenshot",
      },
    },
  },
  gif: {
    requiredFields: {
      src: "string",
    },
    optionalFields: {
      alt: "string",
      caption: "string",
    },
    example: {
      id: "gif-demo",
      type: "gif",
      fields: {
        src: "/editor-assets/image-card.png",
        alt: "Workflow animation",
      },
    },
  },
  "image-card": {
    requiredFields: {
      title: "string",
    },
    optionalFields: {
      alt: "string",
      body: "string",
      buttonText: "string",
      buttonUrl: "string",
      includeButton: "boolean",
      src: "string",
    },
    example: {
      id: "image-card-plan",
      type: "image-card",
      fields: {
        title: "Account-ready brief",
        body: "A polished page with copy, proof, and the next step in one place.",
        includeButton: true,
        buttonText: "Open plan",
        buttonUrl: "{{primary_cta_url}}",
        src: "/editor-assets/image-card.png",
      },
    },
  },
  "icon-card": {
    requiredFields: {
      title: "string",
    },
    optionalFields: {
      body: "string",
      icon: "string",
      iconTone: "string",
      includeIcon: "boolean",
    },
    example: {
      id: "icon-card-proof",
      type: "icon-card",
      fields: {
        title: "Built for fast follow-up",
        body: "Reuse one strong page, then personalize the variables that matter.",
        icon: "box",
        iconTone: "green",
      },
    },
  },
  button: {
    requiredFields: {
      label: "string",
      href: "string",
    },
    optionalFields: {
      style: '"filled" | "outline"',
    },
    example: {
      id: "button-primary",
      type: "button",
      fields: {
        label: "Book implementation review",
        href: "{{primary_cta_url}}",
        style: "filled",
      },
    },
  },
  calendar: {
    requiredFields: {
      label: "string",
      href: "string",
    },
    optionalFields: {},
    example: {
      id: "calendar-review",
      type: "calendar",
      fields: {
        label: "Schedule review",
        href: "{{primary_cta_url}}",
      },
    },
  },
  accordion: {
    requiredFields: {
      items: "{ id?: string; title: string; body?: string; expanded?: boolean }[]",
    },
    optionalFields: {},
    example: {
      id: "accordion-faq",
      type: "accordion",
      fields: {
        items: [
          { id: "timeline", title: "How long does rollout take?", body: "Most teams publish the first page in one working session.", expanded: true },
        ],
      },
    },
  },
  video: {
    requiredFields: {},
    optionalFields: {
      thumbnail: "string",
      url: "string",
    },
    example: {
      id: "video-overview",
      type: "video",
      fields: {
        thumbnail: "/editor-assets/image-card.png",
        url: "https://example.com/demo",
      },
    },
  },
  testimonial: {
    requiredFields: {
      quote: "string",
    },
    optionalFields: {
      avatar: "string",
      name: "string",
      role: "string",
    },
    example: {
      id: "testimonial-proof",
      type: "testimonial",
      fields: {
        quote: "Lightsite helped us send a polished, personalized follow-up in minutes.",
        name: "Mira Singh",
        role: "Revenue Operations Lead, {{company_name}}",
      },
    },
  },
  "logo-grid": {
    requiredFields: {
      logos: "{ id?: string; image?: string; name: string }[]",
    },
    optionalFields: {},
    example: {
      id: "logo-grid-proof",
      type: "logo-grid",
      fields: {
        logos: [
          { id: "acme", image: "/favicon.svg", name: "Acme" },
          { id: "northstar", image: "/favicon.svg", name: "Northstar" },
          { id: "apex", image: "/favicon.svg", name: "Apex" },
        ],
      },
    },
  },
} satisfies Record<(typeof supportedDraftBlockTypes)[number], {
  requiredFields: Record<string, string>;
  optionalFields: Record<string, string>;
  example: {
    id: string;
    type: (typeof supportedDraftBlockTypes)[number];
    fields: Record<string, unknown>;
  };
}>;

const server = new McpServer({
  name: "lightsite",
  version: "0.1.0",
});

registerTool("lightsite_get_capabilities", {
  title: "Get Lightsite agent capabilities",
  description: "Returns the JSON-first workflow, supported block types, and configuration seen by this MCP server.",
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
    schemaVersion: 2,
    chromeShape: {
      siteHeader: "Top navigation/header chrome",
      hero: "Hero/avatar/title chrome",
    },
    blockShape: { id: "string", type: "string", fields: "object" },
    supportedDraftBlockTypes,
    draftBlockDefinitions,
  },
  workflow: [
    "Create or list a site.",
    "Set visibility to team before browser-testing or sharing a public URL.",
    "Read current JSON content and draftRevision.",
    "Write the complete canonical SiteContent JSON, including chrome.siteHeader, chrome.hero, and blocks, with expectedDraftRevision.",
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
  description: "Replaces the editable SiteContent JSON. Use expectedDraftRevision from lightsite_get_site_content.",
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
  description: "Gets aggregate tracking metrics. Use this before listing individual events.",
  inputSchema: {
    workspaceId: z.string().optional(),
    siteId: z.string().optional(),
    variantId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  },
}, (input) => apiRequest(`/api/workspaces/${encodeURIComponent(resolveWorkspaceId(input.workspaceId))}/tracking/summary?${toSearchParams(input)}`));

registerTool("lightsite_list_tracking_events", {
  title: "List tracking events",
  description: "Lists detailed tracking events for deeper inspection.",
  inputSchema: {
    workspaceId: z.string().optional(),
    siteId: z.string().optional(),
    variantId: z.string().optional(),
    type: z.string().optional(),
    classification: z.enum(["all", "human", "bot", "preview"]).optional(),
    query: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
}, (input) => apiRequest(`/api/workspaces/${encodeURIComponent(resolveWorkspaceId(input.workspaceId))}/tracking/events?${toSearchParams(input)}`));

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
