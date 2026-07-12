import { describe, expect, it } from "vitest";
import { LIGHTSITE_THEME_CSS } from "@lightsite/design-tokens";

import {
  createDefaultSiteContent,
  normalizeSiteContent,
  normalizePublishedSitePayload,
  normalizeSiteIconColor,
  PUBLIC_SITE_LOGO_ENDPOINT,
  PUBLIC_SITE_RUNTIME,
  PUBLIC_SITE_RUNTIME_PATH,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  renderPublicSiteHtml,
  renderPublicSitePreviewHtml,
  renderSiteIconSvg,
  SITE_ICON_OPTIONS,
  SITE_DOCUMENT_CSS,
  SITE_DOCUMENT_SCHEMA_VERSION,
  siteContentSchema,
  type PublishedSitePayload,
} from "./index";

describe("canonical site document", () => {
  it("does not translate legacy block payloads into the new document", () => {
    const content = normalizeSiteContent({
      schemaVersion: 2,
      chrome: { hero: { title: "Legacy title" } },
      blocks: [{ id: "legacy", type: "text", fields: { text: "Legacy text" } }],
    }, "Fresh site");

    expect(content.schemaVersion).toBe(SITE_DOCUMENT_SCHEMA_VERSION);
    expect(content.pages[0]?.name).toBe("Fresh site");
    expect(JSON.stringify(content)).not.toContain("Legacy title");
    expect(JSON.stringify(content)).not.toContain("Legacy text");
  });

  it("rejects unknown nodes and marks before persistence", () => {
    const unknownNode = createDefaultSiteContent();
    unknownNode.pages[0]!.document.content = [{ type: "legacyBlock" }];
    const unknownMark = createDefaultSiteContent();
    unknownMark.pages[0]!.document.content = [{
      type: "paragraph",
      content: [{ type: "text", text: "Text", marks: [{ type: "legacyMark" }] }],
    }];

    expect(siteContentSchema.safeParse(unknownNode).success).toBe(false);
    expect(siteContentSchema.safeParse(unknownMark).success).toBe(false);
  });

  it("renders nested Tiptap content, variables, navigation, and tracking from one source", () => {
    const payload = buildPayload();
    const content = payload.content;
    content.pages[0]!.document.content = [
      {
        type: "pageTitleSection",
        attrs: { id: "hero", align: "center" },
        content: [
          {
            type: "pageTitleTitle",
            content: [
              { type: "text", text: "Plan for " },
              { type: "variableToken", attrs: { variableId: "company_name" } },
            ],
          },
          { type: "pageTitleSubtitle", content: [{ type: "text", text: "The exact page." }] },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          { type: "text", text: " and linked", marks: [{ type: "link", attrs: { href: "https://example.com/path?secret=yes" } }] },
        ],
      },
      {
        type: "buttonBlock",
        attrs: { id: "book-call", href: "https://example.com/book?recipient=1", fullWidth: true },
        content: [{ type: "text", text: "Book a call" }],
      },
    ];
    content.pages.push({
      id: "page-pricing",
      name: "Pricing",
      slug: "pricing",
      status: "visible",
      sortOrder: 1,
      document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pricing" }] }] },
    });
    content.sidebar.links.push({
      id: "proposal-link",
      label: "Proposal",
      href: "https://example.com/proposal",
      icon: "website",
      status: "visible",
      sortOrder: 0,
    });

    const html = renderPublicSiteHtml(payload, {
      includeTracking: false,
      origin: "https://lightsite.test",
    });

    expect(html).toContain("Plan for Acme");
    expect(html).toContain('src="/api/public/site-logo/acme/rollout/workspace?theme=dark&amp;variant=mira"');
    expect(html).toContain('src="/api/public/site-logo/acme/rollout/recipient?theme=dark&amp;variant=mira"');
    expect(html).toContain('data-ls-logo-kind="workspace"');
    expect(html).toContain('data-ls-logo-kind="recipient"');
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain('data-ls-element-id="book-call"');
    expect(html).toContain('class="ls-button-block ls-button-block-full"');
    expect(html).toContain('data-ls-element-kind="sidebar_link"');
    expect(html).toContain('data-ls-element-kind="tab"');
    expect(html).toContain(renderSiteIconSvg("notes"));
    expect(html).toContain('data-ls-element-href="https://example.com/book"');
    expect(html).toContain('<script defer src="/site-runtime.v3.js"></script>');
    expect(html).toContain('url("/fonts/geist-latin-wght-normal.woff2")');
    expect(html).toContain('format("woff2")');
    expect(html).not.toContain("woff2-variations");
    expect(html).not.toContain("<script>(function");
    expect(html).toContain("Open site navigation");
    expect(html).toContain('aria-label="Close site navigation"');
    expect(html).toContain('class="ls-sidebar-backdrop"');
    expect(html).toContain(renderSiteIconSvg("menu"));
    expect(html).toContain(renderSiteIconSvg("x"));
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('<h2>Tabs</h2>');
    expect(html).toContain('<span class="ls-footer-logo" role="img" aria-label="Lightsite"></span>');
    expect(html).not.toContain('<img src="/lightsite-logo.svg" alt="Lightsite">');
    expect(html).toContain(`<style>${LIGHTSITE_THEME_CSS}${SITE_DOCUMENT_CSS}</style>`);
  });

  it("keeps a default-width Tiptap button content-sized in public output", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [{
      type: "buttonBlock",
      attrs: { id: "compact-button", href: "https://example.com/book", fullWidth: false },
      content: [{ type: "text", text: "Book a call" }],
    }];

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain('class="ls-button-block"');
    expect(html).not.toContain('class="ls-button-block ls-button-block-full"');
  });

  it("keeps the canonical editor and public typography in one stylesheet", () => {
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document-editor .ls-prosemirror>h2");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-prosemirror>h2");
    expect(SITE_DOCUMENT_CSS).toContain('font-family:"Geist Variable","Geist"')
    expect(SITE_DOCUMENT_CSS).toContain("letter-spacing:-.02em")
    expect(SITE_DOCUMENT_CSS).toContain("letter-spacing:-.03em")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document,.ls-document-editor{font-weight:325}")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-prosemirror>p{padding:0;color:var(--tertiary-foreground);font-size:16px;font-weight:325;font-variation-settings:\"wght\" 325")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document-editor .ls-prosemirror>p{padding:0;color:var(--tertiary-foreground);font-size:16px;font-weight:325;font-variation-settings:\"wght\" 325")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-page-title-subtitle{max-width:100%;margin:8px 0 0;color:var(--tertiary-foreground);font-size:16px;font-weight:325;font-variation-settings:\"wght\" 325")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-prosemirror>h1+p,.ls-prosemirror>h2+p,.ls-prosemirror>h3+p{margin-top:14px}")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-page-title-subtitle{max-width:100%;margin:8px 0 0")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document-editor .ls-prosemirror>h1+p,.ls-document-editor .ls-prosemirror>h2+p,.ls-document-editor .ls-prosemirror>h3+p{margin-top:14px}")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document-editor .ls-prosemirror{width:100%;min-width:0;max-width:100%")
    expect(SITE_DOCUMENT_CSS).toContain("width:min(612px,calc(100% - 104px));max-width:calc(100% - 104px)")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-logo-grid{display:grid;width:100%;min-width:0;max-width:100%")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-table th{background:var(--table-header-background)")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-button-block{display:inline-flex;width:max-content;min-height:32px;max-width:100%;align-items:center;justify-content:center;padding:0 12px;border-radius:8px;background:var(--primary);color:var(--primary-foreground);font-size:15px")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-button-block-full{display:flex;width:100%;min-height:40px;padding:2px 12px}")
    expect(SITE_DOCUMENT_CSS).toContain(".ls-document-editor .lightsite-editor-button-block-full{min-height:40px;padding:2px 12px}")
    expect(SITE_DOCUMENT_CSS).toContain("font-size:20px;font-weight:500;letter-spacing:-.03em;line-height:32px");
    expect(SITE_DOCUMENT_CSS).not.toContain("--ls-");
    expect(LIGHTSITE_THEME_CSS).toContain("--tertiary-foreground:var(--neutral-300)");
    expect(LIGHTSITE_THEME_CSS).toContain("--secondary-foreground:var(--neutral-200)");
    expect(SITE_DOCUMENT_CSS).toContain("font-size:14px;font-weight:500;line-height:24px");
    expect(SITE_DOCUMENT_CSS).not.toContain("text-transform:uppercase");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-sidebar-section>h2{height:26px;min-width:0;margin:0;overflow:hidden;color:var(--muted-foreground);font-size:14px;font-weight:500");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-sidebar-mobile-title{min-width:0;flex:1;overflow:hidden;color:var(--tertiary-foreground);font-size:16px;font-weight:500");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-tab{color:var(--tertiary-foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-tab svg{color:inherit}");
    expect(SITE_DOCUMENT_CSS).toContain("height:44px;align-items:center;gap:8px;padding:0 12px");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-sidebar-mobile-header{display:flex;height:44px");
    expect(SITE_DOCUMENT_CSS).toContain("padding:0 8px 0 16px");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-sidebar-inner{width:100%;padding:20px 16px}");
    expect(SITE_DOCUMENT_CSS).toContain("width:28px;height:28px");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-sidebar-close svg{width:14px;height:14px}");
    expect(SITE_DOCUMENT_CSS).toContain(".ls-mobile-menu svg{width:14px;height:14px}");
    expect(SITE_DOCUMENT_CSS).toContain("color:var(--tertiary-foreground);cursor:pointer");
    expect(SITE_DOCUMENT_CSS).toContain("background:var(--neutral-alpha-a500)");
    expect(SITE_DOCUMENT_CSS).toContain('mask:url("/lightsite-logo.svg") center/contain no-repeat');
  });

  it("uses the complete shared Tabler icon catalog in every renderer", () => {
    expect(SITE_ICON_OPTIONS.length).toBeGreaterThan(100);
    for (const option of SITE_ICON_OPTIONS) {
      const svg = renderSiteIconSvg(option.name);
      expect(svg).toContain("<svg");
      expect(svg).toContain("<path");
    }
  });

  it("normalizes legacy palette names for saved icon content", () => {
    expect(normalizeSiteIconColor("indigo")).toBe("purple");
    expect(normalizeSiteIconColor("sky")).toBe("cyan");
    expect(normalizeSiteIconColor("emerald")).toBe("green");
    expect(normalizeSiteIconColor("amber")).toBe("yellow");
    expect(normalizeSiteIconColor("rose")).toBe("red");
  });

  it("renders saved legacy text colors through the new palette roles", () => {
    const content = createDefaultSiteContent("Palette migration");
    content.pages[0]!.document.content = [{
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Purple text",
          marks: [{ type: "textStyle", attrs: { color: "var(--editor-color-indigo)" } }],
        },
        {
          type: "text",
          text: "Cyan highlight",
          marks: [{
            type: "highlight",
            attrs: { color: "color-mix(in oklab, var(--editor-color-sky) 30%, transparent)" },
          }],
        },
      ],
    }];

    const html = renderPublicSitePreviewHtml(content, {
      siteId: "22222222-2222-4222-8222-222222222222",
      siteName: "Palette migration",
      siteSlug: "palette-migration",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workspaceLogoUrl: null,
      workspaceName: "Acme",
      workspaceSlug: "acme",
      workspaceWebsiteDomain: "acme.io",
    });

    expect(html).toContain('style="color:var(--purple-foreground)"');
    expect(html).toContain('style="background-color:var(--cyan-background)"');
    expect(html).not.toContain("--editor-color-");
  });

  it("rejects unknown attrs and invalid custom-node content through the shared schema", () => {
    const unknownAttribute = createDefaultSiteContent();
    unknownAttribute.pages[0]!.document.content = [{
      type: "buttonBlock",
      attrs: { href: "https://example.com", legacyStyle: "primary" },
      content: [{ type: "text", text: "Open" }],
    }];
    const invalidContent = createDefaultSiteContent();
    invalidContent.pages[0]!.document.content = [{
      type: "pageTitleSection",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Wrong" }] }],
    }];

    expect(siteContentSchema.safeParse(unknownAttribute).success).toBe(false);
    expect(siteContentSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("embeds the shared navigation runtime for sandboxed previews", () => {
    const content = createDefaultSiteContent("Preview");
    content.variables[0]!.defaultValue = "linear.app";
    content.pages[0]!.document.content = [{
      type: "pageTitleSection",
      content: [
        { type: "pageTitleTitle", content: [{ type: "text", text: "Preview" }] },
        { type: "pageTitleSubtitle" },
      ],
    }];
    const html = renderPublicSitePreviewHtml(content, {
      siteId: "22222222-2222-4222-8222-222222222222",
      siteName: "Preview",
      siteSlug: "preview",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workspaceLogoUrl: null,
      workspaceName: "Acme",
      workspaceSlug: "acme",
      workspaceWebsiteDomain: "acme.io",
    });

    expect(html).toContain(`<script>${PUBLIC_SITE_RUNTIME}</script>`);
    expect(html).toContain('class="ls-sidebar"');
    expect(html).toContain('aria-label="Open site navigation"');
    expect(html).toContain('data-ls-page-target=');
    expect(html).not.toContain(`<script defer src="${PUBLIC_SITE_RUNTIME_PATH}"></script>`);
    expect(html).toContain('src="/api/workspaces/logo-preview/image?domain=acme.io&amp;size=128&amp;theme=dark"');
    expect(html).toContain('src="/api/workspaces/logo-preview/image?domain=linear.app&amp;size=128&amp;theme=dark"');
    expect(html).not.toContain(PUBLIC_SITE_LOGO_ENDPOINT);
    expect(PUBLIC_SITE_RUNTIME).toContain("image.src='/lightsite-logo.svg'");
    expect(PUBLIC_SITE_RUNTIME).toContain("removeLogoTile(tile)");
    expect(PUBLIC_SITE_RUNTIME).toContain("setSidebarOpen(false,true)");
    expect(PUBLIC_SITE_RUNTIME).toContain(".ls-sidebar-backdrop");
  });

  it("omits empty editor scaffold paragraphs from public output", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      { type: "heading", content: [{ type: "text", text: "Visible" }] },
      { type: "paragraph", attrs: { id: "trailing-editor-node" } },
    ];

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain("Visible");
    expect(html).not.toContain("trailing-editor-node");
    expect(html).toContain("Open site navigation");
  });

  it("sandboxes HTTPS embeds and rejects executable or insecure URLs", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      { type: "videoEmbed", attrs: { id: "video", src: "https://www.youtube.com/embed/demo" } },
      { type: "calendarEmbed", attrs: { id: "bad-calendar", src: "javascript:alert(1)" } },
      { type: "videoEmbed", attrs: { id: "insecure-video", src: "http://example.com/video" } },
    ];

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain('src="https://www.youtube.com/embed/demo"');
    expect(html).toContain('sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"');
    expect(html).not.toContain("javascript:alert");
    expect(html).not.toContain("http://example.com/video");
  });

  it("fails closed when public payload structure is incomplete", () => {
    expect(normalizePublishedSitePayload({ schemaVersion: 2 })).toBeNull();
  });
});

function buildPayload(): PublishedSitePayload {
  const content = createDefaultSiteContent("Overview");
  content.variables.push({
    id: "company_name",
    key: "company_name",
    label: "Company name",
    type: "text",
    defaultValue: "Company",
  });

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
      slug: "rollout",
      name: "Rollout",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      publishedAt: "2026-07-09T12:00:00.000Z",
    },
    metadata: {
      title: "Rollout",
      description: "Plan",
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "mira",
      name: "Mira",
      recipientName: "Mira",
      recipientCompany: "Acme",
      revisionNumber: 1,
      variableValues: {
        company_name: "Acme",
        recipient_website: "linear.app",
      },
    },
    tracking: {
      version: 2,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 1,
      trackingMode: "events_and_recording",
    },
  };
}
