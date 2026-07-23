import { describe, expect, it } from "vitest";
import {
  MAX_SITE_CONTENT_BYTES,
  analyzeSiteContentSafety,
  hasAddedEmbeddedImageDataUrl,
} from "./content-safety";

describe("site content safety", () => {
  it("measures UTF-8 bytes, aggregate nodes, and media across every page", () => {
    const content = {
      pages: [
        { document: { type: "doc", content: [{ type: "image" }, { type: "paragraph" }] } },
        { document: { type: "doc", content: [{ type: "videoEmbed" }] } },
      ],
    };

    expect(analyzeSiteContentSafety(content)).toMatchObject({
      byteSize: new TextEncoder().encode(JSON.stringify(content)).byteLength,
      issues: [],
      nodeCount: 5,
      resourceCount: 2,
    });
  });

  it("rejects aggregate byte and depth abuse without recursive traversal", () => {
    const oversized = { pages: [], value: "🙂".repeat(Math.ceil(MAX_SITE_CONTENT_BYTES / 4)) };
    let document: Record<string, unknown> = { type: "paragraph" };
    for (let depth = 0; depth < 70; depth += 1) {
      document = { type: "paragraph", content: [document] };
    }

    expect(analyzeSiteContentSafety(oversized).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "content_too_large" }),
    ]));
    expect(analyzeSiteContentSafety({ pages: [{ document }] }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "document_too_deep" }),
    ]));
  });

  it("allows existing inline image data but detects any positive addition", () => {
    const image = "data:image/png;base64,aGVsbG8=";
    const previous = { pages: [], settings: { image } };

    expect(hasAddedEmbeddedImageDataUrl(previous, structuredClone(previous))).toBe(false);
    expect(hasAddedEmbeddedImageDataUrl(previous, {
      pages: [],
      settings: { image },
      variables: [{ defaultValue: image }],
    })).toBe(true);
  });

  it("iterates wide untrusted arrays without using the JavaScript call stack", () => {
    const wide = { pages: [], values: Array.from({ length: 150_000 }, () => "") };

    expect(() => analyzeSiteContentSafety(wide)).not.toThrow();
  });
});
