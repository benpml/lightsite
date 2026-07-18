import {
  getHandoutDocumentStringLimit,
  HANDOUT_COLLECTION_LIMITS,
  HANDOUT_TEXT_LIMITS,
  isEmbeddedImageDataUrl,
} from "@handout/domain";
import {
  trackingV2PublicBootstrapSchema,
  trackingV2PublicContextSchema,
} from "@handout/tracking-schema";
import { z } from "zod";

import { SITE_ICON_OPTIONS, type SiteIconName } from "./site-icons";
import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "./tiptap/site-extensions";

export const SITE_DOCUMENT_SCHEMA_VERSION = 3 as const;
export const PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION = 2 as const;

export const SUPPORTED_SITE_DOCUMENT_NODE_TYPES = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "hardBreak",
  "codeBlock",
  "horizontalRule",
  "pageTitleSection",
  "pageTitleTitle",
  "pageTitleSubtitle",
  "iconList",
  "iconListItem",
  "image",
  "gifBlock",
  "imageCard",
  "imageCardTitle",
  "imageCardBody",
  "iconCard",
  "iconCardTitle",
  "iconCardBody",
  "testimonialCard",
  "testimonialQuote",
  "testimonialAuthorName",
  "testimonialAuthorRole",
  "logoGrid",
  "logoGridItem",
  "logoGridItemTitle",
  "buttonBlock",
  "calendarEmbed",
  "videoEmbed",
  "gridBlock",
  "gridRow",
  "gridCell",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "variableToken",
  "emoji",
]);

export const SUPPORTED_SITE_DOCUMENT_MARK_TYPES = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "textStyle",
  "highlight",
]);

const limitedString = (limit: number) => z.string().max(limit);
const limitedTrimmedString = (limit: number) => z.string().trim().max(limit);

const boundedUnknownSchema: z.ZodType<unknown> = z.unknown().superRefine((value, context) => {
  validateUnknown(value, context, 0);
});

export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export const tiptapMarkSchema: z.ZodType<TiptapMark> = z.object({
  type: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  attrs: z.record(limitedString(HANDOUT_TEXT_LIMITS.variableName), boundedUnknownSchema).optional(),
});

export const tiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() => z.object({
  type: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  attrs: z.record(limitedString(HANDOUT_TEXT_LIMITS.variableName), boundedUnknownSchema).optional(),
  content: z.array(tiptapNodeSchema).max(HANDOUT_COLLECTION_LIMITS.blocksPerTab).optional(),
  marks: z.array(tiptapMarkSchema).max(32).optional(),
  text: limitedString(HANDOUT_TEXT_LIMITS.blockText).optional(),
}));

export const tiptapDocumentSchema = tiptapNodeSchema
  .refine((value) => value.type === "doc", {
    message: "A page document must have a doc root.",
  })
  .superRefine((value, context) => {
    let nodeCount = 0;

    visitDocument(value, (node) => {
      nodeCount += 1;

      if (!SUPPORTED_SITE_DOCUMENT_NODE_TYPES.has(node.type)) {
        context.addIssue({
          code: "custom",
          message: `Unsupported Tiptap node: ${node.type}`,
        });
      }

      const nodeType = SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes[node.type];
      if (nodeType) {
        const allowedAttributes = new Set(Object.keys(nodeType.spec.attrs ?? {}));
        for (const attributeName of Object.keys(node.attrs ?? {})) {
          if (!allowedAttributes.has(attributeName)) {
            context.addIssue({
              code: "custom",
              message: `Unsupported attribute ${attributeName} on Tiptap node ${node.type}`,
            });
          }
        }
      }

      for (const mark of node.marks ?? []) {
        if (!SUPPORTED_SITE_DOCUMENT_MARK_TYPES.has(mark.type)) {
          context.addIssue({
            code: "custom",
            message: `Unsupported Tiptap mark: ${mark.type}`,
          });
        }

        const markType = SITE_DOCUMENT_PROSEMIRROR_SCHEMA.marks[mark.type];
        if (markType) {
          const allowedAttributes = new Set(Object.keys(markType.spec.attrs ?? {}));
          for (const attributeName of Object.keys(mark.attrs ?? {})) {
            if (!allowedAttributes.has(attributeName)) {
              context.addIssue({
                code: "custom",
                message: `Unsupported attribute ${attributeName} on Tiptap mark ${mark.type}`,
              });
            }
          }
        }
      }
    });

    if (nodeCount > 10_000) {
      context.addIssue({ code: "custom", message: "Page document has too many nodes." });
    }

    try {
      SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON(value).check();
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: `Invalid Tiptap document structure: ${error instanceof Error ? error.message : "unknown schema error"}`,
      });
    }
  });

export const siteVariableDefinitionSchema = z.object({
  id: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  key: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  label: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  type: z.enum(["text", "image", "url"]),
  description: limitedString(HANDOUT_TEXT_LIMITS.variableDescription).optional(),
  defaultValue: boundedUnknownSchema,
});

export const sitePrimaryColorSchema = z.enum([
  "neutral",
  "purple",
  "blue",
  "cyan",
  "teal",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
]);

export const siteTrackingConsentPopupSchema = z.enum(["popup-a", "popup-b", "none"]);

export const siteContentPageSchema = z.object({
  id: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  name: limitedString(HANDOUT_TEXT_LIMITS.siteName),
  slug: z.string().trim().min(1).max(96),
  status: z.enum(["visible", "hidden"]),
  sortOrder: z.number().int().nonnegative(),
  document: tiptapDocumentSchema,
});

const siteSidebarSectionsSchema = z.object({
  tabs: z.object({ label: limitedString(HANDOUT_TEXT_LIMITS.sidebarLabel) }),
  links: z.object({ label: limitedString(HANDOUT_TEXT_LIMITS.sidebarLabel) }),
  nextSteps: z.object({ label: limitedString(HANDOUT_TEXT_LIMITS.sidebarLabel) }),
});

export const siteSidebarLinkSchema = z.object({
  id: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  label: limitedString(HANDOUT_TEXT_LIMITS.sidebarLabel),
  href: limitedString(HANDOUT_TEXT_LIMITS.url),
  icon: z.enum(["link", "website"]),
  status: z.enum(["visible", "hidden"]),
  sortOrder: z.number().int().nonnegative(),
});

const siteIconNames = SITE_ICON_OPTIONS.map((option) => option.name) as [
  SiteIconName,
  ...SiteIconName[],
];

export const siteSidebarButtonSchema = z.object({
  id: limitedTrimmedString(HANDOUT_TEXT_LIMITS.variableName).min(1),
  label: limitedString(HANDOUT_TEXT_LIMITS.sidebarLabel),
  href: limitedString(HANDOUT_TEXT_LIMITS.url),
  icon: z.enum(siteIconNames).optional(),
  style: z.enum(["filled", "outline"]),
  status: z.enum(["visible", "hidden"]),
  sortOrder: z.number().int().nonnegative(),
});

export const defaultSiteSidebar = {
  sections: {
    tabs: { label: "Tabs" },
    links: { label: "Links" },
    nextSteps: { label: "Next steps" },
  },
  links: [],
  nextSteps: [],
};

export const siteSidebarSchema = z.object({
  sections: siteSidebarSectionsSchema,
  links: z.array(siteSidebarLinkSchema).max(HANDOUT_COLLECTION_LIMITS.links),
  nextSteps: z.array(siteSidebarButtonSchema).max(HANDOUT_COLLECTION_LIMITS.links),
});

export const siteContentSchema = z.object({
  schemaVersion: z.literal(SITE_DOCUMENT_SCHEMA_VERSION),
  themeMode: z.enum(["light", "dark", "system"]),
  settings: z.object({
    ogImageAssetId: z.string().trim().min(1).optional(),
    allowSearchIndexing: z.literal(false),
    siteTitle: limitedString(HANDOUT_TEXT_LIMITS.siteName).default(""),
    siteDescription: limitedString(HANDOUT_TEXT_LIMITS.variableDescription).default(""),
    primaryColor: sitePrimaryColorSchema.default("neutral"),
    trackingConsentPopup: siteTrackingConsentPopupSchema.default("popup-a"),
    trackingPrivacyPolicyUrl: limitedString(HANDOUT_TEXT_LIMITS.url).default(""),
  }),
  variables: z.array(siteVariableDefinitionSchema).max(200),
  pages: z.array(siteContentPageSchema).min(1).max(HANDOUT_COLLECTION_LIMITS.tabs),
  sidebar: siteSidebarSchema,
});

export const publicSitePayloadSchema = z.object({
  schemaVersion: z.literal(PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION),
  workspace: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    websiteDomain: z.string(),
    logoUrl: z.string().nullable(),
  }),
  site: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    publishedVersionId: z.string(),
    publishedAt: z.string(),
  }),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    ogImageUrl: z.string().nullable(),
    robots: z.enum(["noindex,nofollow", "index,follow"]),
  }),
  content: siteContentSchema,
  selectedVariant: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    recipientName: z.string().nullable(),
    recipientCompany: z.string().nullable(),
    revisionNumber: z.number().int().nonnegative(),
    variableValues: z.record(z.string(), z.string()),
  }).nullable(),
  tracking: trackingV2PublicContextSchema,
  trackingV2: trackingV2PublicBootstrapSchema.optional(),
});

export type SiteVariableDefinition = z.infer<typeof siteVariableDefinitionSchema>;
export type SitePrimaryColor = z.infer<typeof sitePrimaryColorSchema>;
export type SiteTrackingConsentPopup = z.infer<typeof siteTrackingConsentPopupSchema>;
export type SiteContentPage = z.infer<typeof siteContentPageSchema>;
export type SiteSidebarLink = z.infer<typeof siteSidebarLinkSchema>;
export type SiteSidebarButton = z.infer<typeof siteSidebarButtonSchema>;
export type SiteSidebar = z.infer<typeof siteSidebarSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type PublishedSitePayload = z.infer<typeof publicSitePayloadSchema>;

const recipientWebsiteVariable: SiteVariableDefinition = {
  id: "recipient_website",
  key: "website",
  label: "Website",
  type: "url",
  description: "The recipient company's website.",
  defaultValue: "",
};

export function createDefaultSiteContent(siteName = "Overview"): SiteContent {
  const pageName = siteName.trim() || "Overview";

  return {
    schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
    themeMode: "dark",
    settings: {
      allowSearchIndexing: false,
      siteTitle: "",
      siteDescription: "",
      primaryColor: "neutral",
      trackingConsentPopup: "popup-a",
      trackingPrivacyPolicyUrl: "",
    },
    variables: [recipientWebsiteVariable],
    pages: [{
      id: "page-overview",
      name: pageName,
      slug: createSlug(pageName),
      status: "visible",
      sortOrder: 0,
      document: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
    }],
    sidebar: structuredClone(defaultSiteSidebar),
  };
}

export const defaultSiteContent = createDefaultSiteContent();

export function normalizeSiteContent(value: unknown, siteName?: string): SiteContent {
  const parsed = siteContentSchema.safeParse(value);
  return parsed.success ? parsed.data : createDefaultSiteContent(siteName);
}

export function normalizePublishedSitePayload(value: unknown): PublishedSitePayload | null {
  const parsed = publicSitePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getVisibleSitePages(content: SiteContent) {
  return content.pages
    .filter((page) => page.status === "visible")
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getVisibleSidebarLinks(content: SiteContent) {
  return content.sidebar.links
    .filter((link) => link.status === "visible" && link.label.trim() && link.href.trim())
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getVisibleSidebarButtons(content: SiteContent) {
  return content.sidebar.nextSteps
    .filter((button) => button.status === "visible" && button.label.trim() && button.href.trim())
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export type SiteSidebarModel = ReturnType<typeof getSiteSidebarModel>;

export function getSiteSidebarModel(
  content: SiteContent,
  options: { includeIncompleteItems?: boolean } = {},
) {
  const includeIncompleteItems = options.includeIncompleteItems === true;
  const pages = getVisibleSitePages(content);
  const links = content.sidebar.links
    .filter((link) => link.status === "visible")
    .filter((link) => includeIncompleteItems || Boolean(link.label.trim() && link.href.trim()))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const nextSteps = content.sidebar.nextSteps
    .filter((button) => button.status === "visible")
    .filter((button) => includeIncompleteItems || Boolean(button.label.trim() && button.href.trim()))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    sections: content.sidebar.sections,
    pages,
    links,
    nextSteps,
    showSidebar: pages.length > 0 || links.length > 0 || nextSteps.length > 0,
  };
}

export function getSiteMetadata(
  content: SiteContent,
  fallbackTitle: string,
  values: Readonly<Record<string, string>> = {},
) {
  const page = getVisibleSitePages(content)[0];
  const pageTitle = page ? findNode(page.document, "pageTitleTitle") : null;
  const pageSubtitle = page ? findNode(page.document, "pageTitleSubtitle") : null;
  const configuredTitle = resolveSiteSettingTemplate(content.settings.siteTitle, values).trim();
  const configuredDescription = resolveSiteSettingTemplate(
    content.settings.siteDescription,
    values,
  ).trim();

  return {
    title: configuredTitle || getNodeText(pageTitle).trim() || fallbackTitle.trim() || "Untitled Handout",
    description: configuredDescription || getNodeText(pageSubtitle).trim(),
  };
}

export function getSiteVariableValues(
  content: SiteContent,
  input: {
    recipientCompany?: string | null;
    recipientName?: string | null;
    variableValues?: Readonly<Record<string, unknown>> | null;
  } = {},
) {
  const values: Record<string, string> = {};

  for (const variable of content.variables) {
    const value = toSiteVariableString(variable.defaultValue);
    values[variable.id] = value;
    values[variable.key] = value;
  }

  for (const [key, rawValue] of Object.entries(input.variableValues ?? {})) {
    const value = toSiteVariableString(rawValue);
    values[key] = value;
    const definition = content.variables.find(
      (variable) => variable.id === key || variable.key === key,
    );
    if (definition) {
      values[definition.id] = value;
      values[definition.key] = value;
    }
  }

  if (input.recipientName) {
    values["recipient-name"] = input.recipientName;
    values.recipient_name = input.recipientName;
    values.name = input.recipientName;
  }
  if (input.recipientCompany) {
    values["recipient-company"] = input.recipientCompany;
    values.recipient_company = input.recipientCompany;
    values.company = input.recipientCompany;
  }
  const recipientWebsite = values.recipient_website ?? values.website;
  if (recipientWebsite !== undefined) {
    values.recipient_website = recipientWebsite;
    values.website = recipientWebsite;
  }

  return values;
}

export function resolveSiteSettingTemplate(
  value: string,
  values: Readonly<Record<string, string>>,
) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function getNodeText(node: TiptapNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(getNodeText).join("");
}

function findNode(node: TiptapNode, type: string): TiptapNode | null {
  if (node.type === type) return node;

  for (const child of node.content ?? []) {
    const match = findNode(child, type);
    if (match) return match;
  }

  return null;
}

function visitDocument(node: TiptapNode, visitor: (node: TiptapNode) => void) {
  visitor(node);
  (node.content ?? []).forEach((child) => visitDocument(child, visitor));
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "overview";
}

function validateUnknown(value: unknown, context: z.RefinementCtx, depth: number) {
  if (depth > 8) {
    context.addIssue({ code: "custom", message: "Nested content is too deep." });
    return;
  }

  if (typeof value === "string") {
    const isEmbeddedImage = isEmbeddedImageDataUrl(value);
    const limit = getHandoutDocumentStringLimit(value);

    if (value.length > limit) {
      context.addIssue({
        code: "custom",
        message: isEmbeddedImage
          ? "Embedded image is too large."
          : "Content string is too long.",
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > HANDOUT_COLLECTION_LIMITS.blocksPerTab) {
      context.addIssue({ code: "custom", message: "Content array is too large." });
      return;
    }
    value.forEach((entry) => validateUnknown(entry, context, depth + 1));
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 100) {
      context.addIssue({ code: "custom", message: "Content object has too many fields." });
      return;
    }
    entries.forEach(([, entry]) => validateUnknown(entry, context, depth + 1));
  }
}

function toSiteVariableString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
