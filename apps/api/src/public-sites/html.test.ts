import { describe, expect, it } from "vitest";
import {
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@handout/site-document";
import { TRACKING_V2_SCRIPT_ENDPOINT } from "@handout/tracking-schema";

import {
  renderPublicSiteHtmlDocument,
  renderPublicSiteScreenshotHtmlDocument,
  renderUnavailablePublicSiteHtmlDocument,
} from "./html";

describe("public site HTML rendering", () => {
  it("renders escaped metadata and the canonical Tiptap document", () => {
    const payload = buildPayload();
    payload.metadata.title = "Rollout brief for Acme & Co";
    payload.content.pages[0]!.document = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { id: "overview", level: 2 },
          content: [{ type: "text", text: "Why <now>" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "The exact Tiptap document", marks: [{ type: "bold" }] }],
        },
      ],
    };

    const html = renderPublicSiteHtmlDocument({
      origin: "https://pages.handout.test",
      payload,
    });

    expect(html).not.toBeNull();
    expect(html).toContain("<title>Rollout brief for Acme &amp; Co</title>");
    expect(html).toContain("Why &lt;now&gt;");
    expect(html).toContain("<strong>The exact Tiptap document</strong>");
    expect(html).toContain('href="https://pages.handout.test/acme/rollout-brief"');
    expect(html).toContain('content="noindex,nofollow"');
  });

  it("emits the v2 bootstrap and canonical tracking attributes", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [{
      type: "buttonBlock",
      attrs: { id: "cta-primary", href: "https://example.com/book" },
      content: [{ type: "text", text: "Book a call" }],
    }];
    payload.trackingV2 = {
      version: 2,
      trackingMode: "events",
      contextToken: "lsv2.context-token-at-least-24",
      issuedAt: "2026-07-09T12:00:00.000Z",
      expiresAt: "2026-07-10T12:00:00.000Z",
    };

    const html = renderPublicSiteHtmlDocument({
      origin: "https://pages.handout.test",
      payload,
    });

    expect(html).not.toBeNull();
    expect(html).toContain(`src="${TRACKING_V2_SCRIPT_ENDPOINT}"`);
    expect(html).toContain("data-handout-consent-bootstrap=");
    expect(html).toContain('&quot;contextToken&quot;:&quot;lsv2.context-token-at-least-24&quot;');
    expect(html).toContain('data-handout-consent-popup="popup-a"');
    expect(html).toContain('data-handout-element-id="cta-primary"');
    expect(html).not.toContain("data-handout-element-label");
    expect(html).toContain("https://pages.handout.test/acme/rollout-brief/embed.jpg?v=");
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });

  it("renders screenshot HTML without runtime or tracking scripts", () => {
    const html = renderPublicSiteScreenshotHtmlDocument({
      origin: "https://pages.handout.test",
      payload: buildPayload(),
    });

    expect(html).not.toBeNull();
    expect(html).toContain('data-handout-public-site=""');
    expect(html).not.toContain("site-runtime.v4.js");
    expect(html).not.toContain("data-handout-tracking-v2");
  });

  it("renders a generic unavailable page with noindex metadata", () => {
    const html = renderUnavailablePublicSiteHtmlDocument(
      "https://pages.handout.test",
      "/acme/missing",
    );

    expect(html).toContain("<title>Page unavailable | Handout</title>");
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).toContain('href="https://pages.handout.test/acme/missing"');
    expect(html).toContain("This page is unavailable");
    expect(html).not.toContain("data-handout-tracking");
  });
});

function buildPayload(): PublishedSitePayload {
  const content = createDefaultSiteContent("Rollout brief");
  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "acme",
      name: "Acme",
      websiteDomain: "acme.com",
      logoUrl: null,
    },
    site: {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "rollout-brief",
      name: "Rollout brief",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      publishedAt: "2026-07-09T12:00:00.000Z",
    },
    metadata: {
      title: "Rollout brief",
      description: "A focused plan.",
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: null,
    tracking: {
      version: 2,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: null,
      recipientRevision: null,
      trackingMode: "events",
    },
  };
}
