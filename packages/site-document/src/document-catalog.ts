import { Fragment, type ContentMatch, type MarkType, type Node as ProseMirrorNode, type NodeType } from "@tiptap/pm/model";

import {
  SITE_DOCUMENT_SCHEMA_VERSION,
  SITE_PRIMARY_COLOR_PRESET_OPTIONS,
} from "./document-constants";
import type { TiptapNode } from "./model";
import {
  SITE_ICON_COLOR_OPTIONS,
  SITE_ICON_COLOR_PRESET_OPTIONS,
  SITE_ICON_OPTIONS,
} from "./site-icons";
import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "./tiptap/site-extensions";

export const SITE_DOCUMENT_CATALOG_VERSION = 1 as const;

export type SiteDocumentAttributeCatalogEntry = {
  type: "boolean" | "number" | "number-array" | "string" | "unknown";
  required: boolean;
  nullable: boolean;
  defaultValue?: unknown;
  description?: string;
  recommended?: boolean;
  allowedValues?: Array<boolean | number | string | null>;
  optionsCatalog?: "icons" | "iconColors" | "highlightColors" | "textColors";
  format?: "css-color" | "https-embed-url" | "image-url" | "url-template";
  integer?: boolean;
  minimum?: number;
  maximum?: number;
  supportsVariables?: boolean;
};

export type SiteDocumentNodeCatalogEntry = {
  type: string;
  role: "document" | "inline" | "structural" | "text" | "top-level-block";
  category: string;
  description: string;
  group: string[];
  contentExpression: string | null;
  marksExpression: string;
  explicitChildTypes: string[];
  allowedChildTypes: string[];
  allowedParentTypes: string[];
  attributes: Record<string, SiteDocumentAttributeCatalogEntry>;
  flags: {
    atom: boolean;
    draggable: boolean;
    inline: boolean;
    leaf: boolean;
    selectable: boolean;
    textblock: boolean;
  };
  minimalExample: TiptapNode | null;
};

export type SiteDocumentMarkCatalogEntry = {
  type: string;
  description: string;
  attributes: Record<string, SiteDocumentAttributeCatalogEntry>;
  excludes: string | null;
  inclusive: boolean;
};

type AttributeHint = Partial<Omit<SiteDocumentAttributeCatalogEntry, "nullable" | "required" | "type">> & {
  type?: SiteDocumentAttributeCatalogEntry["type"];
};

type TopLevelBlockMetadata = { category: string; description: string };

const TOP_LEVEL_BLOCK_METADATA: Record<string, TopLevelBlockMetadata> = {
  paragraph: { category: "text", description: "Body copy with inline text, variables, links, and formatting." },
  heading: { category: "text", description: "Section heading at level 1, 2, or 3." },
  blockquote: { category: "text", description: "Quoted or emphasized block content." },
  codeBlock: { category: "text", description: "Preformatted code or technical text without inline marks." },
  horizontalRule: { category: "text", description: "Visual divider between sections." },
  pageTitleSection: { category: "hero", description: "Page hero containing exactly one title and one subtitle." },
  bulletList: { category: "list", description: "Unordered list of list items." },
  orderedList: { category: "list", description: "Numbered list of list items." },
  taskList: { category: "list", description: "Checklist for plans, owners, and mutual actions." },
  iconList: { category: "list", description: "List whose items have a configurable icon and icon color." },
  image: { category: "media", description: "Standalone image loaded from a safe image URL." },
  gifBlock: { category: "media", description: "Standalone GIF with optional Giphy metadata and dimensions." },
  calendarEmbed: { category: "embed", description: "Embedded scheduling or calendar page using a normalized HTTPS embed URL." },
  videoEmbed: { category: "embed", description: "Embedded YouTube, Vimeo, Loom, or iframe-compatible video URL." },
  imageCard: { category: "card", description: "Image, title, body, and optional linked call to action." },
  iconCard: { category: "card", description: "Icon-led card with a title and supporting body." },
  testimonialCard: { category: "card", description: "Attributed quotation with optional avatar image." },
  logoGrid: { category: "card", description: "Collection of labeled customer, partner, or integration logos." },
  buttonBlock: { category: "action", description: "Primary or secondary linked call to action." },
  gridBlock: { category: "layout", description: "One-to-three-column layout made from rows and cells." },
  table: { category: "data", description: "Structured rows of header and body cells." },
};

const NODE_DESCRIPTIONS: Record<string, string> = {
  doc: "Root node for one Handout page document.",
  text: "Inline text; put visible copy here rather than in block attributes.",
  hardBreak: "Inline line break.",
  emoji: "Inline emoji selected by its canonical name.",
  listItem: "Structural item used by bullet and ordered lists; begins with a paragraph.",
  taskItem: "Structural checklist item containing one or more paragraphs.",
  iconListItem: "Structural icon-list item containing a paragraph followed by optional blocks.",
  tableRow: "Structural table row containing zero or more header or body cells.",
  tableHeader: "Structural header cell containing block content.",
  tableCell: "Structural body cell containing block content.",
  pageTitleTitle: "Required title textblock inside a pageTitleSection.",
  pageTitleSubtitle: "Required subtitle textblock inside a pageTitleSection.",
  imageCardTitle: "Required title textblock inside an imageCard.",
  imageCardBody: "Required body textblock inside an imageCard.",
  iconCardTitle: "Required title textblock inside an iconCard.",
  iconCardBody: "Required body textblock inside an iconCard.",
  testimonialAuthorName: "Required author-name textblock inside a testimonialCard.",
  testimonialAuthorRole: "Required author-role textblock inside a testimonialCard.",
  testimonialQuote: "Required quotation textblock inside a testimonialCard.",
  logoGridItem: "Structural logo item containing exactly one title.",
  logoGridItemTitle: "Required label textblock inside a logoGridItem.",
  gridRow: "Structural row containing one or more grid cells.",
  gridCell: "Structural grid cell containing one or more top-level block nodes.",
  variableToken: "Atomic inline variable reference; variableId points to variables[].id.",
};

const NODE_ATTRIBUTE_HINTS: Record<string, Record<string, AttributeHint>> = {
  codeBlock: {
    language: { type: "string", description: "Optional language label for the code block." },
  },
  emoji: {
    name: { type: "string", description: "Canonical emoji name recognized by the Tiptap emoji extension." },
  },
  heading: {
    level: { type: "number", integer: true, allowedValues: [1, 2, 3], description: "Visible heading level." },
  },
  orderedList: {
    start: { type: "number", integer: true, minimum: 1, description: "Starting list number." },
    type: { type: "string", description: "Optional HTML ordered-list numbering style." },
  },
  taskItem: {
    checked: { type: "boolean", description: "Whether the task is complete." },
  },
  pageTitleSection: {
    align: { type: "string", allowedValues: ["center", "left"], description: "Hero copy alignment." },
  },
  iconListItem: {
    icon: { type: "string", optionsCatalog: "icons", description: "Icon name from the icon catalog." },
    iconColor: { type: "string", optionsCatalog: "iconColors", description: "Semantic icon color or custom six-digit hex color." },
  },
  iconCard: {
    icon: { type: "string", optionsCatalog: "icons", description: "Icon name from the icon catalog." },
    iconColor: { type: "string", optionsCatalog: "iconColors", description: "Semantic icon color or custom six-digit hex color." },
  },
  gridBlock: {
    columns: { type: "number", integer: true, allowedValues: [1, 2, 3], minimum: 1, maximum: 3, description: "Number of equal-width columns." },
  },
  buttonBlock: {
    fullWidth: { type: "boolean", description: "Stretch the button to the available content width." },
    href: { type: "string", format: "url-template", supportsVariables: true, description: "Safe destination URL; may contain {{variable_key}} placeholders." },
  },
  imageCard: {
    alt: { type: "string", description: "Accessible image description." },
    buttonLabel: { type: "string", supportsVariables: true, description: "Optional CTA label; may contain {{variable_key}} placeholders." },
    buttonUrl: { type: "string", format: "url-template", supportsVariables: true, description: "Optional CTA URL; may contain {{variable_key}} placeholders." },
    imageHeight: { type: "number", minimum: 1, description: "Optional intrinsic image height in pixels." },
    imageWidth: { type: "number", minimum: 1, description: "Optional intrinsic image width in pixels." },
    includeButton: { type: "boolean", description: "Whether to render the card CTA." },
    src: { type: "string", format: "image-url", supportsVariables: true, description: "Safe image URL; may contain {{variable_key}} placeholders." },
  },
  image: imageAttributeHints("Standalone image"),
  gifBlock: {
    ...imageAttributeHints("GIF"),
    giphyId: { type: "string", description: "Optional Giphy asset identifier." },
  },
  testimonialCard: {
    alt: { type: "string", description: "Accessible avatar description." },
    avatarHeight: { type: "number", minimum: 1, description: "Optional intrinsic avatar height in pixels." },
    avatarWidth: { type: "number", minimum: 1, description: "Optional intrinsic avatar width in pixels." },
    src: { type: "string", format: "image-url", description: "Optional avatar image URL." },
  },
  logoGridItem: {
    alt: { type: "string", description: "Accessible logo description." },
    src: { type: "string", format: "image-url", description: "Logo image URL." },
  },
  calendarEmbed: {
    height: { type: "number", integer: true, minimum: 240, maximum: 1200, description: "Rendered embed height in pixels." },
    src: { type: "string", format: "https-embed-url", description: "Normalized HTTPS scheduling-page or iframe source URL." },
  },
  videoEmbed: {
    provider: { type: "string", description: "Human-readable provider label, such as YouTube, Vimeo, or Loom." },
    src: { type: "string", format: "https-embed-url", description: "Normalized HTTPS embed URL, not a watch-page URL." },
  },
  tableCell: tableCellAttributeHints(),
  tableHeader: tableCellAttributeHints(),
  variableToken: {
    variableId: { type: "string", description: "References variables[].id, not variables[].key." },
    fallbackName: { type: "string", description: "Fallback text when the variable has no value." },
  },
};

const MARK_ATTRIBUTE_HINTS: Record<string, Record<string, AttributeHint>> = {
  link: {
    href: { type: "string", format: "url-template", supportsVariables: true, description: "Safe destination URL; may contain {{variable_key}} placeholders." },
    target: { type: "string", allowedValues: ["_blank"], description: "Links open in a new tab in published Handouts." },
    rel: { type: "string", allowedValues: ["noopener noreferrer"], description: "Security relationship used for published links." },
    class: { type: "string", description: "Optional CSS class; agents should normally omit it." },
    title: { type: "string", description: "Optional accessible link title." },
  },
  textStyle: {
    color: { type: "string", format: "css-color", optionsCatalog: "textColors", description: "Text color token from the design options catalog or custom six-digit hex color." },
  },
  highlight: {
    color: { type: "string", format: "css-color", optionsCatalog: "highlightColors", description: "Highlight color token from the design options catalog or custom six-digit hex color." },
  },
};

const MARK_DESCRIPTIONS: Record<string, string> = {
  bold: "Bold emphasis.",
  italic: "Italic emphasis.",
  underline: "Underlined text.",
  strike: "Struck-through text.",
  code: "Inline code; excludes other marks.",
  link: "Safe external link with optional variable placeholders.",
  textStyle: "Text color styling.",
  highlight: "Background highlight styling.",
};

const paletteColors = SITE_ICON_COLOR_OPTIONS.filter((option) => option.name !== "neutral");

export const SITE_DOCUMENT_DESIGN_OPTIONS = {
  pageTitleAlignments: ["center", "left"],
  headingLevels: [1, 2, 3],
  gridColumns: [1, 2, 3],
  primaryColors: [...SITE_PRIMARY_COLOR_PRESET_OPTIONS],
  iconColors: SITE_ICON_COLOR_PRESET_OPTIONS.map(({ name, label }) => ({ name, label })),
  textColors: [
    { label: "Default", value: null },
    ...paletteColors.map(({ label, name }) => ({ label, value: `var(--${name}-foreground)` })),
  ],
  highlightColors: [
    { label: "None", value: null },
    ...paletteColors.map(({ label, name }) => ({ label, value: `var(--${name}-background)` })),
  ],
} as const;

export const SITE_DOCUMENT_ICON_CATALOG = {
  catalog: "icons",
  count: SITE_ICON_OPTIONS.length,
  options: SITE_ICON_OPTIONS.map(({ label, name, tablerName }) => ({ label, name, tablerName })),
};

const nodeEntries = Object.values(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes);
const topLevelBlockTypes = nodeEntries
  .filter((nodeType) => groupsFor(nodeType).includes("block"))
  .map((nodeType) => nodeType.name);
export const SITE_DOCUMENT_TOP_LEVEL_BLOCKS = topLevelBlockTypes.map((type) => ({
  type,
  category: TOP_LEVEL_BLOCK_METADATA[type]?.category ?? "other",
  description: TOP_LEVEL_BLOCK_METADATA[type]?.description ?? `${humanize(type)} block.`,
}));
const allowedChildrenByType = new Map(nodeEntries.map((nodeType) => [nodeType.name, collectAllowedChildTypes(nodeType)]));
const allowedParentsByType = new Map(nodeEntries.map((nodeType) => [
  nodeType.name,
  nodeEntries
    .filter((parentType) => allowedChildrenByType.get(parentType.name)?.includes(nodeType.name))
    .map((parentType) => parentType.name),
]));

const catalogNodes = nodeEntries.map(createNodeCatalogEntry);
const catalogMarks = Object.values(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.marks).map(createMarkCatalogEntry);

const catalogCore = {
  catalogVersion: SITE_DOCUMENT_CATALOG_VERSION,
  schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
  documentRoot: "doc",
  topLevelBlockTypes,
  optionCatalogs: {
    icons: { resourceUri: "handout://catalog/icons", count: SITE_ICON_OPTIONS.length },
    designOptions: { resourceUri: "handout://catalog/design-options" },
  },
  nodes: catalogNodes,
  marks: catalogMarks,
};

export const SITE_DOCUMENT_CATALOG = {
  ...catalogCore,
  fingerprint: createFingerprint({
    ...catalogCore,
    designOptions: SITE_DOCUMENT_DESIGN_OPTIONS,
    iconNames: SITE_DOCUMENT_ICON_CATALOG.options.map((option) => option.name),
  }),
};

export function getSiteDocumentCatalogSelection(
  requestedNodeTypes?: readonly string[],
  includeDependencies = true,
  includeMarks = true,
) {
  const selectedTypes = requestedNodeTypes?.length
    ? expandExplicitDependencies(requestedNodeTypes, includeDependencies)
    : new Set(catalogNodes.map((entry) => entry.type));

  return {
    catalogVersion: SITE_DOCUMENT_CATALOG.catalogVersion,
    schemaVersion: SITE_DOCUMENT_CATALOG.schemaVersion,
    fingerprint: SITE_DOCUMENT_CATALOG.fingerprint,
    documentRoot: SITE_DOCUMENT_CATALOG.documentRoot,
    ...(requestedNodeTypes?.length ? {} : { topLevelBlocks: SITE_DOCUMENT_TOP_LEVEL_BLOCKS }),
    optionCatalogs: SITE_DOCUMENT_CATALOG.optionCatalogs,
    requestedNodeTypes: requestedNodeTypes ? [...requestedNodeTypes] : null,
    includedNodeTypes: catalogNodes.filter((entry) => selectedTypes.has(entry.type)).map((entry) => entry.type),
    nodes: catalogNodes.filter((entry) => selectedTypes.has(entry.type)),
    marks: includeMarks ? catalogMarks : [],
  };
}

export function validateSiteDocumentNodeAttribute(nodeType: string, attributeName: string, value: unknown) {
  const entry = catalogNodes.find((candidate) => candidate.type === nodeType)?.attributes[attributeName];
  return entry ? validateAttributeValue(`Tiptap node ${nodeType}.${attributeName}`, entry, value) : null;
}

export function validateSiteDocumentMarkAttribute(markType: string, attributeName: string, value: unknown) {
  const entry = catalogMarks.find((candidate) => candidate.type === markType)?.attributes[attributeName];
  return entry ? validateAttributeValue(`Tiptap mark ${markType}.${attributeName}`, entry, value) : null;
}

function createNodeCatalogEntry(nodeType: NodeType): SiteDocumentNodeCatalogEntry {
  const topLevel = topLevelBlockTypes.includes(nodeType.name);
  const metadata = TOP_LEVEL_BLOCK_METADATA[nodeType.name];
  return {
    type: nodeType.name,
    role: nodeRole(nodeType, topLevel),
    category: metadata?.category ?? nodeRole(nodeType, topLevel),
    description: metadata?.description ?? NODE_DESCRIPTIONS[nodeType.name] ?? `${humanize(nodeType.name)} document node.`,
    group: groupsFor(nodeType),
    contentExpression: nodeType.spec.content ?? null,
    marksExpression: nodeType.spec.marks ?? "_",
    explicitChildTypes: explicitChildTypes(nodeType.spec.content),
    allowedChildTypes: allowedChildrenByType.get(nodeType.name) ?? [],
    allowedParentTypes: allowedParentsByType.get(nodeType.name) ?? [],
    attributes: attributeCatalog(nodeType.spec.attrs, NODE_ATTRIBUTE_HINTS[nodeType.name]),
    flags: {
      atom: nodeType.isAtom,
      draggable: nodeType.spec.draggable === true,
      inline: nodeType.isInline,
      leaf: nodeType.isLeaf,
      selectable: nodeType.spec.selectable !== false,
      textblock: nodeType.isTextblock,
    },
    minimalExample: minimalNodeExample(nodeType),
  };
}

function createMarkCatalogEntry(markType: MarkType): SiteDocumentMarkCatalogEntry {
  return {
    type: markType.name,
    description: MARK_DESCRIPTIONS[markType.name] ?? `${humanize(markType.name)} text mark.`,
    attributes: attributeCatalog(markType.spec.attrs, MARK_ATTRIBUTE_HINTS[markType.name]),
    excludes: markType.spec.excludes ?? null,
    inclusive: markType.spec.inclusive !== false,
  };
}

function attributeCatalog(
  attributes: Record<string, { default?: unknown; validate?: string | ((value: unknown) => void) }> | undefined,
  hints: Record<string, AttributeHint> = {},
) {
  return Object.fromEntries(Object.entries(attributes ?? {}).map(([name, spec]) => {
    const hasDefault = Object.prototype.hasOwnProperty.call(spec, "default");
    const hint = name === "id"
      ? { type: "string" as const, recommended: true, description: "Stable unique node ID used for editing, tracking, and durable references." }
      : hints[name] ?? {};
    const defaultValue = hasDefault ? spec.default : undefined;
    return [name, {
      type: hint.type ?? inferAttributeType(defaultValue, spec.validate),
      required: !hasDefault,
      nullable: defaultValue === null,
      ...(hasDefault ? { defaultValue } : {}),
      ...hint,
    } satisfies SiteDocumentAttributeCatalogEntry];
  }));
}

function collectAllowedChildTypes(nodeType: NodeType) {
  if (nodeType.isLeaf) return [];
  const names = new Set<string>();
  const visited = new Set<ContentMatch>();
  const queue = [nodeType.contentMatch];
  while (queue.length) {
    const match = queue.shift();
    if (!match || visited.has(match)) continue;
    visited.add(match);
    for (let index = 0; index < match.edgeCount; index += 1) {
      const edge = match.edge(index);
      names.add(edge.type.name);
      queue.push(edge.next);
    }
  }
  return [...names];
}

function explicitChildTypes(contentExpression: string | undefined) {
  if (!contentExpression) return [];
  const groups = new Set(nodeEntries.flatMap((nodeType) => groupsFor(nodeType)));
  return [...new Set(contentExpression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])]
    .filter((name) => SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes[name] && !groups.has(name));
}

function expandExplicitDependencies(requestedNodeTypes: readonly string[], includeDependencies: boolean) {
  const selected = new Set(requestedNodeTypes);
  if (!includeDependencies) return selected;
  const queue = [...selected];
  while (queue.length) {
    const current = queue.shift();
    const entry = catalogNodes.find((candidate) => candidate.type === current);
    for (const childType of entry?.explicitChildTypes ?? []) {
      if (!selected.has(childType)) {
        selected.add(childType);
        queue.push(childType);
      }
    }
  }
  return selected;
}

function minimalNodeExample(nodeType: NodeType): TiptapNode | null {
  if (nodeType.name === "text") return { type: "text", text: "Text" };
  try {
    const attrs = nodeType.spec.attrs?.id ? { id: `${toKebabCase(nodeType.name)}-1` } : undefined;
    const node = nodeType.createAndFill(attrs);
    return node ? stripNullAttributes(node).toJSON() as TiptapNode : null;
  } catch {
    return null;
  }
}

function stripNullAttributes(node: ProseMirrorNode): ProseMirrorNode {
  const attrs = Object.fromEntries(Object.entries(node.attrs).filter(([, value]) => value !== null));
  const content = node.content.size
    ? Fragment.fromArray(node.content.content.map(stripNullAttributes))
    : node.content;
  return node.type.create(attrs, content, node.marks);
}

function nodeRole(nodeType: NodeType, topLevel: boolean): SiteDocumentNodeCatalogEntry["role"] {
  if (nodeType.name === "doc") return "document";
  if (nodeType.name === "text") return "text";
  if (topLevel) return "top-level-block";
  if (nodeType.isInline) return "inline";
  return "structural";
}

function groupsFor(nodeType: NodeType) {
  return nodeType.spec.group?.split(/\s+/).filter(Boolean) ?? [];
}

function inferAttributeType(defaultValue: unknown, validate: string | ((value: unknown) => void) | undefined): SiteDocumentAttributeCatalogEntry["type"] {
  if (typeof validate === "string") {
    if (validate.includes("number")) return "number";
    if (validate.includes("boolean")) return "boolean";
    if (validate.includes("string")) return "string";
  }
  if (typeof defaultValue === "boolean") return "boolean";
  if (typeof defaultValue === "number") return "number";
  if (typeof defaultValue === "string") return "string";
  if (Array.isArray(defaultValue) && defaultValue.every((value) => typeof value === "number")) return "number-array";
  return "unknown";
}

function validateAttributeValue(label: string, entry: SiteDocumentAttributeCatalogEntry, value: unknown) {
  if (value === null && entry.nullable) return null;

  const typeIsValid = entry.type === "unknown"
    || (entry.type === "string" && typeof value === "string")
    || (entry.type === "number" && typeof value === "number" && Number.isFinite(value))
    || (entry.type === "boolean" && typeof value === "boolean")
    || (entry.type === "number-array" && Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item)));
  if (!typeIsValid) return `${label} must be ${attributeTypeLabel(entry)}.`;

  if (entry.integer && typeof value === "number" && !Number.isInteger(value)) {
    return `${label} must be an integer.`;
  }

  const numbers = typeof value === "number" ? [value] : entry.type === "number-array" && Array.isArray(value) ? value : [];
  if (entry.minimum !== undefined && numbers.some((number) => number < entry.minimum!)) {
    return `${label} must be at least ${entry.minimum}.`;
  }
  if (entry.maximum !== undefined && numbers.some((number) => number > entry.maximum!)) {
    return `${label} must be at most ${entry.maximum}.`;
  }

  if (entry.allowedValues && !entry.allowedValues.some((allowedValue) => allowedValue === value)) {
    if (label === "Tiptap node pageTitleSection.align" && value === "right") return null;
    return `${label} must be one of: ${entry.allowedValues.map(String).join(", ")}.`;
  }

  if (entry.optionsCatalog === "icons" && typeof value === "string" && !SITE_ICON_OPTIONS.some((option) => option.name === value)) {
    return `${label} must be a name from handout://catalog/icons.`;
  }
  if (entry.optionsCatalog === "iconColors" && typeof value === "string") {
    const current = SITE_ICON_COLOR_OPTIONS.some((option) => option.name === value);
    const legacy = ["indigo", "sky", "emerald", "amber", "rose"].includes(value);
    const custom = /^#[0-9a-f]{6}$/i.test(value);
    if (!current && !legacy && !custom) return `${label} must be a color from handout://catalog/design-options or a six-digit hex color.`;
  }
  if ((entry.optionsCatalog === "textColors" || entry.optionsCatalog === "highlightColors") && typeof value === "string") {
    const options = entry.optionsCatalog === "textColors"
      ? SITE_DOCUMENT_DESIGN_OPTIONS.textColors
      : SITE_DOCUMENT_DESIGN_OPTIONS.highlightColors;
    const custom = /^#[0-9a-f]{6}$/i.test(value);
    if (!options.some((option) => option.value === value) && !custom) {
      return `${label} must be a ${entry.optionsCatalog} value from handout://catalog/design-options or a six-digit hex color.`;
    }
  }

  return null;
}

function attributeTypeLabel(entry: SiteDocumentAttributeCatalogEntry) {
  const base = entry.type === "number-array" ? "an array of finite numbers" : `a ${entry.type}`;
  return entry.nullable ? `${base} or null` : base;
}

function imageAttributeHints(subject: string): Record<string, AttributeHint> {
  return {
    alt: { type: "string", description: `Accessible ${subject.toLowerCase()} description.` },
    height: { type: "number", minimum: 1, description: `Optional intrinsic ${subject.toLowerCase()} height in pixels.` },
    src: { type: "string", format: "image-url", description: `${subject} URL.` },
    title: { type: "string", description: `Optional ${subject.toLowerCase()} title.` },
    width: { type: "number", minimum: 1, description: `Optional intrinsic ${subject.toLowerCase()} width in pixels.` },
  };
}

function tableCellAttributeHints(): Record<string, AttributeHint> {
  return {
    colspan: { type: "number", integer: true, minimum: 1, maximum: 20, description: "Number of columns occupied by the cell." },
    rowspan: { type: "number", integer: true, minimum: 1, maximum: 100, description: "Number of rows occupied by the cell." },
    colwidth: { type: "number-array", minimum: 1, description: "Optional column widths in pixels." },
    align: { type: "string", allowedValues: [null, "left", "center", "right"], description: "Optional cell alignment." },
  };
}

function humanize(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function toKebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function createFingerprint(value: unknown) {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `site-document-v${SITE_DOCUMENT_SCHEMA_VERSION}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
