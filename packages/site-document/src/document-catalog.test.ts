import { describe, expect, it } from "vitest";

import {
  SITE_DOCUMENT_CATALOG,
  SITE_DOCUMENT_DESIGN_OPTIONS,
  SITE_DOCUMENT_ICON_CATALOG,
  getSiteDocumentCatalogSelection,
} from "./document-catalog";
import { tiptapDocumentSchema } from "./model";
import { SITE_DOCUMENT_PROSEMIRROR_SCHEMA } from "./tiptap/site-extensions";

describe("site-document agent catalog", () => {
  it("is generated from every canonical ProseMirror node and mark", () => {
    expect(SITE_DOCUMENT_CATALOG.nodes.map((entry) => entry.type)).toEqual(
      Object.keys(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes),
    );
    expect(SITE_DOCUMENT_CATALOG.marks.map((entry) => entry.type)).toEqual(
      Object.keys(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.marks),
    );

    for (const entry of SITE_DOCUMENT_CATALOG.nodes) {
      const nodeType = SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes[entry.type];
      expect(Object.keys(entry.attributes)).toEqual(Object.keys(nodeType?.spec.attrs ?? {}));
      expect(entry.contentExpression).toBe(nodeType?.spec.content ?? null);
    }

    for (const entry of SITE_DOCUMENT_CATALOG.marks) {
      expect(Object.keys(entry.attributes)).toEqual(
        Object.keys(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.marks[entry.type]?.spec.attrs ?? {}),
      );
    }
  });

  it("publishes every top-level block with a schema-valid minimal example", () => {
    const expectedBlocks = Object.values(SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodes)
      .filter((nodeType) => nodeType.spec.group?.split(/\s+/).includes("block"))
      .map((nodeType) => nodeType.name);
    expect(SITE_DOCUMENT_CATALOG.topLevelBlockTypes).toEqual(expectedBlocks);

    for (const type of SITE_DOCUMENT_CATALOG.topLevelBlockTypes) {
      const entry = SITE_DOCUMENT_CATALOG.nodes.find((candidate) => candidate.type === type);
      expect(entry?.role).toBe("top-level-block");
      expect(entry?.description).not.toMatch(/ document node\.$/);
      expect(entry?.minimalExample).not.toBeNull();
      const example = SITE_DOCUMENT_PROSEMIRROR_SCHEMA.nodeFromJSON(entry?.minimalExample);
      expect(() => example.check()).not.toThrow();
    }
  });

  it("returns only requested blocks and their explicit structural dependencies", () => {
    const selection = getSiteDocumentCatalogSelection(["pageTitleSection", "gridBlock"], true, false);
    expect(selection.requestedNodeTypes).toEqual(["pageTitleSection", "gridBlock"]);
    expect(selection.includedNodeTypes).toEqual([
      "pageTitleTitle",
      "pageTitleSubtitle",
      "pageTitleSection",
      "gridCell",
      "gridRow",
      "gridBlock",
    ]);
    expect(selection.includedNodeTypes).not.toContain("iconCard");
    expect(selection.marks).toEqual([]);
    expect(selection).not.toHaveProperty("topLevelBlocks");
  });

  it("exposes the exact product options an agent needs without embedding the large icon list", () => {
    const iconCard = SITE_DOCUMENT_CATALOG.nodes.find((entry) => entry.type === "iconCard");
    const grid = SITE_DOCUMENT_CATALOG.nodes.find((entry) => entry.type === "gridBlock");
    const title = SITE_DOCUMENT_CATALOG.nodes.find((entry) => entry.type === "pageTitleSection");

    expect(iconCard?.attributes.icon?.optionsCatalog).toBe("icons");
    expect(iconCard?.attributes.iconColor?.optionsCatalog).toBe("iconColors");
    expect(grid?.attributes.columns?.allowedValues).toEqual([1, 2, 3]);
    expect(title?.attributes.align?.allowedValues).toEqual(["center", "left"]);
    expect(SITE_DOCUMENT_DESIGN_OPTIONS.gridColumns).toEqual([1, 2, 3]);
    expect(SITE_DOCUMENT_ICON_CATALOG.count).toBeGreaterThan(200);
    expect(SITE_DOCUMENT_CATALOG.optionCatalogs.icons).toEqual({
      resourceUri: "handout://catalog/icons",
      count: SITE_DOCUMENT_ICON_CATALOG.count,
    });
  });

  it("has a stable versioned fingerprint", () => {
    expect(SITE_DOCUMENT_CATALOG.schemaVersion).toBe(3);
    expect(SITE_DOCUMENT_CATALOG.fingerprint).toMatch(/^site-document-v3-[0-9a-f]{8}$/);
  });

  it("uses the published catalog rules to reject invalid agent attributes", () => {
    const invalidDocuments = [
      { type: "doc", content: [{ type: "heading", attrs: { level: 4 } }] },
      { type: "doc", content: [{ type: "gridBlock", attrs: { columns: "two" }, content: [{ type: "gridRow", content: [{ type: "gridCell", content: [{ type: "paragraph" }] }] }] }] },
      { type: "doc", content: [{ type: "iconCard", attrs: { icon: "not-an-icon", iconColor: "ultraviolet" }, content: [{ type: "iconCardTitle" }, { type: "iconCardBody" }] }] },
      { type: "doc", content: [{ type: "calendarEmbed", attrs: { height: 100, src: "https://cal.com/example" } }] },
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Invalid color", marks: [{ type: "textStyle", attrs: { color: "hotpink" } }] }] }] },
    ];

    for (const document of invalidDocuments) {
      expect(tiptapDocumentSchema.safeParse(document).success).toBe(false);
    }
  });

  it("accepts custom six-digit hex colors for color-aware icons", () => {
    const document = {
      type: "doc",
      content: [{
        type: "iconCard",
        attrs: { icon: "bolt", iconColor: "#fff5d2" },
        content: [{ type: "iconCardTitle" }, { type: "iconCardBody" }],
      }],
    };

    expect(tiptapDocumentSchema.safeParse(document).success).toBe(true);
  });

  it("accepts custom six-digit hex text and highlight colors", () => {
    const document = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "Custom colors",
          marks: [
            { type: "textStyle", attrs: { color: "#755bde" } },
            { type: "highlight", attrs: { color: "#fff5d2" } },
          ],
        }],
      }],
    };

    expect(tiptapDocumentSchema.safeParse(document).success).toBe(true);
  });

  it("omits teal from selectable primary and icon presets", () => {
    expect(SITE_DOCUMENT_DESIGN_OPTIONS.primaryColors).not.toContain("teal");
    expect(SITE_DOCUMENT_DESIGN_OPTIONS.iconColors).not.toContainEqual({
      name: "teal",
      label: "Teal",
    });
  });

  it("reports the exact nested node and mark paths for repair", () => {
    const result = tiptapDocumentSchema.safeParse({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "Repair me",
          marks: [{ type: "textStyle", attrs: { color: "hotpink" } }],
        }],
      }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({
      path: ["content", 0, "content", 0, "marks", 0, "attrs", "color"],
    }));
  });
});
