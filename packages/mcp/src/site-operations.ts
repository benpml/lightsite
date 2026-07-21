import {
  siteContentPageSchema,
  siteContentSchema,
  siteSidebarButtonSchema,
  siteSidebarLinkSchema,
  siteVariableDefinitionSchema,
  tiptapDocumentSchema,
  type SiteContent,
} from "@handout/site-document";
import { z } from "zod";

const settingsSchema = siteContentSchema.shape.settings.partial();

export const siteContentOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replace_content"), content: siteContentSchema }),
  z.object({ op: z.literal("set_theme_mode"), themeMode: z.enum(["light", "dark", "system"]) }),
  z.object({ op: z.literal("set_settings"), settings: settingsSchema.refine((value) => Object.keys(value).length > 0, "Provide at least one setting.") }),
  z.object({
    op: z.literal("set_page_settings"),
    pageId: z.string().min(1),
    name: z.string().max(160).optional(),
    slug: z.string().trim().min(1).max(96).optional(),
    status: z.enum(["visible", "hidden"]).optional(),
  }).refine((value) => value.name !== undefined || value.slug !== undefined || value.status !== undefined, "Provide at least one page setting."),
  z.object({ op: z.literal("upsert_page"), page: siteContentPageSchema }),
  z.object({ op: z.literal("replace_page_document"), pageId: z.string().min(1), document: tiptapDocumentSchema }),
  z.object({ op: z.literal("reorder_pages"), pageIds: z.array(z.string().min(1)).min(1) }),
  z.object({ op: z.literal("upsert_variable"), variable: siteVariableDefinitionSchema }),
  z.object({
    op: z.literal("set_sidebar_section"),
    section: z.enum(["tabs", "links", "nextSteps"]),
    label: z.string().max(80),
  }),
  z.object({ op: z.literal("upsert_sidebar_link"), item: siteSidebarLinkSchema }),
  z.object({ op: z.literal("upsert_sidebar_button"), item: siteSidebarButtonSchema }),
  z.object({
    op: z.literal("reorder_sidebar_items"),
    collection: z.enum(["links", "nextSteps"]),
    itemIds: z.array(z.string().min(1)),
  }),
]);

export type SiteContentOperation = z.infer<typeof siteContentOperationSchema>;

export function applySiteContentOperations(current: SiteContent, operations: SiteContentOperation[]) {
  if (!operations.length) throw new Error("Provide at least one site content operation.");
  const replacements = operations.filter((operation) => operation.op === "replace_content");
  if (replacements.length && operations.length !== 1) {
    throw new Error("replace_content must be the only operation in a request.");
  }
  let content = structuredClone(current);
  for (const operation of operations) {
    switch (operation.op) {
      case "replace_content":
        content = structuredClone(operation.content);
        break;
      case "set_theme_mode":
        content.themeMode = operation.themeMode;
        break;
      case "set_settings":
        content.settings = { ...content.settings, ...operation.settings };
        break;
      case "set_page_settings": {
        const page = requirePage(content, operation.pageId);
        if (operation.name !== undefined) page.name = operation.name;
        if (operation.slug !== undefined) page.slug = operation.slug;
        if (operation.status !== undefined) page.status = operation.status;
        break;
      }
      case "upsert_page": {
        const index = content.pages.findIndex((page) => page.id === operation.page.id);
        if (index === -1) content.pages.push(structuredClone(operation.page));
        else content.pages[index] = structuredClone(operation.page);
        normalizeOrders(content.pages);
        break;
      }
      case "replace_page_document":
        requirePage(content, operation.pageId).document = structuredClone(operation.document);
        break;
      case "reorder_pages":
        content.pages = reorderExact(content.pages, operation.pageIds, "page");
        normalizeOrders(content.pages);
        break;
      case "upsert_variable": {
        const idIndex = content.variables.findIndex((variable) => variable.id === operation.variable.id);
        const keyOwner = content.variables.find((variable) => variable.key === operation.variable.key && variable.id !== operation.variable.id);
        if (keyOwner) throw new Error(`Variable key is already used by ${keyOwner.label}: ${operation.variable.key}`);
        if (idIndex === -1) content.variables.push(structuredClone(operation.variable));
        else content.variables[idIndex] = structuredClone(operation.variable);
        break;
      }
      case "set_sidebar_section":
        content.sidebar.sections[operation.section].label = operation.label;
        break;
      case "upsert_sidebar_link":
        upsertById(content.sidebar.links, operation.item);
        normalizeOrders(content.sidebar.links);
        break;
      case "upsert_sidebar_button":
        upsertById(content.sidebar.nextSteps, operation.item);
        normalizeOrders(content.sidebar.nextSteps);
        break;
      case "reorder_sidebar_items": {
        if (operation.collection === "links") {
          const reordered = reorderExact(content.sidebar.links, operation.itemIds, "sidebar item");
          normalizeOrders(reordered);
          content.sidebar.links = reordered;
        } else {
          const reordered = reorderExact(content.sidebar.nextSteps, operation.itemIds, "sidebar item");
          normalizeOrders(reordered);
          content.sidebar.nextSteps = reordered;
        }
        break;
      }
    }
  }
  const parsed = siteContentSchema.parse(content);
  validateOperationalInvariants(parsed);
  return parsed;
}

export function summarizeSiteContent(content: SiteContent) {
  return {
    schemaVersion: content.schemaVersion,
    themeMode: content.themeMode,
    settings: content.settings,
    pageCount: content.pages.length,
    visiblePageCount: content.pages.filter((page) => page.status === "visible").length,
    variableCount: content.variables.length,
    sidebarLinkCount: content.sidebar.links.length,
    sidebarButtonCount: content.sidebar.nextSteps.length,
  };
}

export function projectPageSummaries(content: SiteContent) {
  return content.pages.map(({ id, name, slug, status, sortOrder, document }) => ({
    id,
    name,
    slug,
    status,
    sortOrder,
    topLevelBlockCount: document.content?.length ?? 0,
    topLevelBlockTypes: [...new Set((document.content ?? []).map((node) => node.type))],
  }));
}

export function analyzeVariableUsage(content: SiteContent, variableId: string, variants: unknown[] = []) {
  const variable = content.variables.find((candidate) => candidate.id === variableId);
  if (!variable) throw new Error(`Variable was not found: ${variableId}`);
  const references: Array<{ kind: string; path: Array<string | number> }> = [];
  content.pages.forEach((page, pageIndex) => {
    walk(page.document, ["pages", pageIndex, "document"], (value, path) => {
      if (isRecord(value) && value.type === "variableToken" && isRecord(value.attrs) && value.attrs.variableId === variable.id) {
        references.push({ kind: "inline_token", path });
      }
      if (typeof value === "string" && containsTemplate(value, variable.key)) {
        references.push({ kind: "template", path });
      }
    });
  });
  walk(content.sidebar, ["sidebar"], (value, path) => {
    if (typeof value === "string" && containsTemplate(value, variable.key)) references.push({ kind: "template", path });
  });
  variants.forEach((variant, index) => {
    if (isRecord(variant) && isRecord(variant.variableValues) && Object.hasOwn(variant.variableValues, variable.key)) {
      references.push({ kind: "variant_value", path: ["variants", index, "variableValues", variable.key] });
    }
  });
  return { variable, references, referenceCount: references.length };
}

export function analyzeAssetUsage(content: SiteContent, assetId: string) {
  const references: Array<{ kind: string; path: Array<string | number> }> = [];
  if (content.settings.ogImageAssetId === assetId) references.push({ kind: "og_image", path: ["settings", "ogImageAssetId"] });
  walk(content, [], (value, path) => {
    if (typeof value === "string" && (value.includes(`/api/public/assets/${assetId}`) || value === assetId)) {
      if (!(path[0] === "settings" && path[1] === "ogImageAssetId")) references.push({ kind: "content", path });
    }
  });
  return { references, referenceCount: references.length };
}

export function removeContentTarget(content: SiteContent, input: {
  targetType: "page" | "variable" | "sidebar_item";
  targetId: string;
}) {
  const next = structuredClone(content);
  if (input.targetType === "page") {
    if (next.pages.length === 1) throw new Error("A site must keep at least one page.");
    const index = next.pages.findIndex((page) => page.id === input.targetId);
    if (index === -1) throw new Error(`Page was not found: ${input.targetId}`);
    const [target] = next.pages.splice(index, 1);
    normalizeOrders(next.pages);
    return { content: siteContentSchema.parse(next), targetName: target!.name };
  }
  if (input.targetType === "variable") {
    const index = next.variables.findIndex((variable) => variable.id === input.targetId);
    if (index === -1) throw new Error(`Variable was not found: ${input.targetId}`);
    const [target] = next.variables.splice(index, 1);
    return { content: siteContentSchema.parse(next), targetName: target!.label };
  }
  const linkIndex = next.sidebar.links.findIndex((item) => item.id === input.targetId);
  if (linkIndex !== -1) {
    const [target] = next.sidebar.links.splice(linkIndex, 1);
    normalizeOrders(next.sidebar.links);
    return { content: siteContentSchema.parse(next), targetName: target!.label };
  }
  const buttonIndex = next.sidebar.nextSteps.findIndex((item) => item.id === input.targetId);
  if (buttonIndex === -1) throw new Error(`Sidebar item was not found: ${input.targetId}`);
  const [target] = next.sidebar.nextSteps.splice(buttonIndex, 1);
  normalizeOrders(next.sidebar.nextSteps);
  return { content: siteContentSchema.parse(next), targetName: target!.label };
}

function requirePage(content: SiteContent, pageId: string) {
  const page = content.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Page was not found: ${pageId}`);
  return page;
}

function reorderExact<T extends { id: string }>(items: T[], ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Each ${label} id must appear once.`);
  const byId = new Map(items.map((item) => [item.id, item]));
  if (ids.length !== items.length || ids.some((id) => !byId.has(id))) {
    throw new Error(`Reordering must include every existing ${label} id exactly once.`);
  }
  return ids.map((id) => structuredClone(byId.get(id)!));
}

function normalizeOrders(items: Array<{ sortOrder: number }>) {
  items.forEach((item, index) => { item.sortOrder = index; });
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) items.push(structuredClone(item));
  else items[index] = structuredClone(item);
}

function validateOperationalInvariants(content: SiteContent) {
  assertUnique(content.pages.map((page) => page.id), "page id");
  assertUnique(content.pages.map((page) => page.slug), "page slug");
  assertUnique(content.variables.map((variable) => variable.id), "variable id");
  assertUnique(content.variables.map((variable) => variable.key), "variable key");
  assertUnique([...content.sidebar.links, ...content.sidebar.nextSteps].map((item) => item.id), "sidebar item id");
  assertContiguous(content.pages, "pages");
  assertContiguous(content.sidebar.links, "sidebar links");
  assertContiguous(content.sidebar.nextSteps, "sidebar buttons");
  const variableIds = new Set(content.variables.map((variable) => variable.id));
  content.pages.forEach((page, pageIndex) => {
    walk(page.document, ["pages", pageIndex, "document"], (value, path) => {
      if (!isRecord(value) || value.type !== "variableToken" || !isRecord(value.attrs)) return;
      const variableId = value.attrs.variableId;
      if (typeof variableId === "string" && !variableIds.has(variableId)) {
        throw new Error(`Variable token at ${formatPath(path)} references an unknown variable id: ${variableId}`);
      }
    });
  });
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function assertContiguous(items: Array<{ sortOrder: number }>, label: string) {
  items.forEach((item, index) => {
    if (item.sortOrder !== index) throw new Error(`${label} sortOrder must be contiguous from zero.`);
  });
}

function walk(value: unknown, path: Array<string | number>, visitor: (value: unknown, path: Array<string | number>) => void) {
  visitor(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index], visitor));
  else if (isRecord(value)) Object.entries(value).forEach(([key, child]) => walk(child, [...path, key], visitor));
}

function containsTemplate(value: string, key: string) {
  return new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`).test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPath(path: Array<string | number>) {
  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
