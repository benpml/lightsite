import { isEmbeddedImageDataUrl } from "@handout/domain";

export const MAX_SITE_CONTENT_BYTES = 5 * 1024 * 1024;
export const MAX_SITE_CONTENT_NODES = 100_000;
export const MAX_SITE_CONTENT_RESOURCES = 500;
export const MAX_SITE_DOCUMENT_DEPTH = 64;

const RESOURCE_NODE_TYPES = new Set([
  "calendarEmbed",
  "gifBlock",
  "image",
  "imageCard",
  "logoGridItem",
  "videoEmbed",
]);

export type SiteContentSafetyIssue = {
  code: "content_too_large" | "document_too_deep" | "too_many_nodes" | "too_many_resources";
  message: string;
};

export type SiteContentSafetyAnalysis = {
  byteSize: number;
  embeddedImageDataUrls: Map<string, number>;
  issues: SiteContentSafetyIssue[];
  nodeCount: number;
  resourceCount: number;
};

export function analyzeSiteContentSafety(value: unknown): SiteContentSafetyAnalysis {
  const issues: SiteContentSafetyIssue[] = [];
  const embeddedImageDataUrls = new Map<string, number>();
  const pages = readPages(value);
  let nodeCount = 0;
  let resourceCount = 0;
  let documentTooDeep = false;

  for (const page of pages) {
    const document = readRecord(page)?.document;
    if (!document || typeof document !== "object") continue;
    const stack: Array<{ depth: number; value: unknown }> = [{ depth: 1, value: document }];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const node = readRecord(current.value);
      if (!node) continue;
      nodeCount += 1;

      if (current.depth > MAX_SITE_DOCUMENT_DEPTH) {
        documentTooDeep = true;
        continue;
      }
      if (typeof node.type === "string" && RESOURCE_NODE_TYPES.has(node.type)) {
        resourceCount += 1;
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          stack.push({ depth: current.depth + 1, value: child });
        }
      }
    }
  }

  collectEmbeddedImages(value, embeddedImageDataUrls);

  let byteSize = Number.POSITIVE_INFINITY;
  try {
    byteSize = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    // Cyclic or otherwise non-serializable data is rejected by the byte limit.
  }

  if (byteSize > MAX_SITE_CONTENT_BYTES) {
    issues.push({
      code: "content_too_large",
      message: "Site content must be 5 MB or smaller.",
    });
  }
  if (documentTooDeep) {
    issues.push({
      code: "document_too_deep",
      message: `Site content cannot be nested more than ${MAX_SITE_DOCUMENT_DEPTH} levels.`,
    });
  }
  if (nodeCount > MAX_SITE_CONTENT_NODES) {
    issues.push({
      code: "too_many_nodes",
      message: `A site can contain at most ${MAX_SITE_CONTENT_NODES.toLocaleString("en-US")} content blocks.`,
    });
  }
  if (resourceCount > MAX_SITE_CONTENT_RESOURCES) {
    issues.push({
      code: "too_many_resources",
      message: `A site can contain at most ${MAX_SITE_CONTENT_RESOURCES.toLocaleString("en-US")} media and embed blocks.`,
    });
  }

  return {
    byteSize,
    embeddedImageDataUrls,
    issues,
    nodeCount,
    resourceCount,
  };
}

export function hasAddedEmbeddedImageDataUrl(previous: unknown, next: unknown) {
  const previousImages = analyzeSiteContentSafety(previous).embeddedImageDataUrls;
  const nextImages = analyzeSiteContentSafety(next).embeddedImageDataUrls;

  for (const [image, count] of nextImages) {
    if (count > (previousImages.get(image) ?? 0)) return true;
  }
  return false;
}

function collectEmbeddedImages(value: unknown, images: Map<string, number>) {
  const stack: unknown[] = [value];
  const visited = new WeakSet<object>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      if (isEmbeddedImageDataUrl(current)) {
        images.set(current, (images.get(current) ?? 0) + 1);
      }
      continue;
    }
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const child of current) {
        stack.push(child);
      }
    } else {
      for (const child of Object.values(current)) {
        stack.push(child);
      }
    }
  }
}

function readPages(value: unknown) {
  const record = readRecord(value);
  return Array.isArray(record?.pages) ? record.pages : [];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
