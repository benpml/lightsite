import { describe, expect, it } from "vitest";
import { HANDOUT_THEME_CSS } from "@handout/design-tokens";
import { HANDOUT_TEXT_LIMITS } from "@handout/domain";

import {
  createDefaultSiteContent,
  getSiteMetadata,
  getSiteVariableValues,
  normalizeSiteContent,
  normalizePublishedSitePayload,
  normalizeSiteIconColor,
  PUBLIC_SITE_LOGO_ENDPOINT,
  PUBLIC_SITE_RUNTIME,
  PUBLIC_SITE_RUNTIME_PATH,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  renderPublicSiteHtml,
  renderPublicSitePreviewHtml,
  resolvePublicSiteTracking,
  renderSiteIconSvg,
  SITE_ICON_OPTIONS,
  SITE_DOCUMENT_CSS,
  SITE_DOCUMENT_IFRAME_SANDBOX,
  SITE_DOCUMENT_SCHEMA_VERSION,
  siteContentSchema,
  type PublishedSitePayload,
} from "./index";

describe("canonical site document", () => {
  it("names the first tab Overview by default", () => {
    const content = createDefaultSiteContent();

    expect(content.pages[0]).toMatchObject({
      name: "Overview",
      slug: "overview",
    });
  });

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

  it("allows bounded embedded images without relaxing ordinary content limits", () => {
    const embeddedImage = createDefaultSiteContent();
    embeddedImage.pages[0]!.document.content = [{
      type: "image",
      attrs: {
        src: `data:image/webp;base64,${"a".repeat(HANDOUT_TEXT_LIMITS.blockText)}`,
      },
    }];
    const oversizedImage = createDefaultSiteContent();
    oversizedImage.pages[0]!.document.content = [{
      type: "image",
      attrs: {
        src: `data:image/webp;base64,${"a".repeat(HANDOUT_TEXT_LIMITS.embeddedImageDataUrl)}`,
      },
    }];
    const oversizedTextAttribute = createDefaultSiteContent();
    oversizedTextAttribute.pages[0]!.document.content = [{
      type: "image",
      attrs: {
        alt: "a".repeat(HANDOUT_TEXT_LIMITS.blockText + 1),
        src: "https://example.com/image.webp",
      },
    }];

    expect(siteContentSchema.safeParse(embeddedImage).success).toBe(true);
    expect(siteContentSchema.safeParse(oversizedImage).success).toBe(false);
    expect(siteContentSchema.safeParse(oversizedTextAttribute).success).toBe(false);
  });

  it("adds site settings defaults without discarding older valid documents", () => {
    const legacy = createDefaultSiteContent("Existing site") as unknown as Record<string, unknown>;
    const settings = { ...((legacy.settings ?? {}) as Record<string, unknown>) };
    delete settings.siteTitle;
    delete settings.siteDescription;
    delete settings.primaryColor;
    delete settings.trackingConsentPopup;
    delete settings.trackingPrivacyPolicyUrl;
    legacy.settings = settings;

    const normalized = normalizeSiteContent(legacy, "Fallback");

    expect(normalized.pages[0]?.name).toBe("Existing site");
    expect(normalized.settings).toMatchObject({
      siteTitle: "",
      siteDescription: "",
      primaryColor: "neutral",
      trackingConsentPopup: "popup-a",
      trackingPrivacyPolicyUrl: "",
    });
  });

  it("resolves recipient variables in configured title and description metadata", () => {
    const content = createDefaultSiteContent("Fallback title");
    content.settings.siteTitle = "Plan for {{company}}";
    content.settings.siteDescription = "Prepared for {{name}} at {{website}}";
    const values = getSiteVariableValues(content, {
      recipientCompany: "Acme",
      recipientName: "Mira",
      variableValues: { recipient_website: "acme.com" },
    });

    expect(getSiteMetadata(content, "Fallback title", values)).toEqual({
      title: "Plan for Acme",
      description: "Prepared for Mira at acme.com",
    });
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
    content.sidebar.nextSteps.push({
      id: "book-demo",
      label: "Book a demo",
      href: "https://example.com/demo",
      icon: "calendar",
      style: "filled",
      status: "visible",
      sortOrder: 0,
    });

    const html = renderPublicSiteHtml(payload, {
      includeTracking: false,
      origin: "https://handout.test",
    });

    expect(html).toContain("Plan for Acme");
    expect(html).toContain('src="/api/public/site-logo/acme/rollout/workspace?theme=dark&amp;variant=mira"');
    expect(html).toContain('src="/api/public/site-logo/acme/rollout/recipient?theme=dark&amp;variant=mira"');
    expect(html).toContain('data-handout-logo-kind="workspace"');
    expect(html).toContain('data-handout-logo-kind="recipient"');
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain('data-handout-element-id="book-call"');
    expect(html).toContain('class="handout-button-block handout-button-block-full"');
    expect(html).toContain('data-handout-track="link" data-handout-element-id="proposal-link"');
    expect(html).toContain('data-handout-page-id="page-pricing" data-handout-track="tab"');
    expect(html).toContain(renderSiteIconSvg("notes"));
    expect(html).toContain(renderSiteIconSvg("calendar"));
    expect(html).toContain("Book a demo</a>");
    expect(html).not.toContain("data-handout-element-kind");
    expect(html).not.toContain("data-handout-element-label");
    expect(html).not.toContain("data-handout-element-href");
    expect(html).toContain('<script defer src="/site-runtime.v5.js"></script>');
    expect(html).toContain('url("/fonts/geist-latin-wght-normal.woff2")');
    expect(html).toContain('format("woff2")');
    expect(html).not.toContain("woff2-variations");
    expect(html).not.toContain("<script>(function");
    expect(html).toContain("Open site navigation");
    expect(html).toContain('aria-label="Close site navigation"');
    expect(html).toContain('class="handout-sidebar-backdrop"');
    expect(html).toContain(renderSiteIconSvg("menu"));
    expect(html).toContain(renderSiteIconSvg("x"));
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('<h2>Tabs</h2>');
    expect(html).toContain('<span class="handout-footer-logo" role="img" aria-label="Handout"></span>');
    expect(html).not.toContain('<img src="/handout-logo.svg" alt="Handout">');
    expect(html).toContain(`<style>${HANDOUT_THEME_CSS}${SITE_DOCUMENT_CSS}</style>`);
  });

  it("preserves resized image and GIF widths in preview and published output", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      {
        type: "image",
        attrs: {
          alt: "Resized image",
          height: 180,
          src: "https://example.com/image.webp",
          width: 320,
        },
      },
      {
        type: "gifBlock",
        attrs: {
          alt: "Resized GIF",
          height: 135,
          src: "https://example.com/animation.gif",
          width: 240,
        },
      },
    ];

    const publishedHtml = renderPublicSiteHtml(payload, { includeTracking: false });
    const previewHtml = renderPublicSitePreviewHtml(payload.content, {
      siteId: payload.site.id,
      siteName: payload.site.name,
      siteSlug: payload.site.slug,
      workspaceId: payload.workspace.id,
      workspaceLogoUrl: payload.workspace.logoUrl,
      workspaceName: payload.workspace.name,
      workspaceSlug: payload.workspace.slug,
      workspaceWebsiteDomain: payload.workspace.websiteDomain,
    });

    for (const html of [previewHtml, publishedHtml]) {
      expect(html).toContain(
        '<figure class="handout-image-block" style="max-width:320px"><img src="https://example.com/image.webp" alt="Resized image" width="320" height="180"',
      );
      expect(html).toContain(
        '<figure class="handout-image-block handout-gif-block" style="max-width:240px"><img src="https://example.com/animation.gif" alt="Resized GIF" width="240" height="135"',
      );
    }
  });

  it("builds a compact server-owned manifest from the same resolved controls", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      {
        type: "paragraph",
        content: [{
          type: "text",
          text: "Untracked rich link",
          marks: [{ type: "link", attrs: { href: "https://private.example/path?token=secret" } }],
        }],
      },
      {
        type: "buttonBlock",
        attrs: { id: "book-call", href: "https://calendar.example/book/mira?token=secret", fullWidth: false },
        content: [
          { type: "text", text: "Book with " },
          { type: "variableToken", attrs: { variableId: "company_name", fallbackName: "Company" } },
        ],
      },
      {
        type: "buttonBlock",
        attrs: { href: "https://example.com/unidentified", fullWidth: false },
        content: [{ type: "text", text: "Missing stable ID" }],
      },
    ];
    payload.content.sidebar.links.push({
      id: "proposal-link",
      label: "Proposal for {{company_name}}",
      href: "https://docs.example/proposal/acme?recipient=mira#private",
      icon: "website",
      status: "visible",
      sortOrder: 0,
    });

    const resolved = resolvePublicSiteTracking(payload);

    expect(resolved.manifest).toEqual({
      schemaVersion: 1,
      siteLabel: "Rollout",
      pages: [{ id: "page-overview", label: "Overview" }],
      elements: [
        {
          id: "book-call",
          pageId: "page-overview",
          eventType: "button_click",
          kind: "button",
          label: "Book with Acme",
          destinationKind: "external_web",
          destinationHost: "calendar.example",
        },
        {
          id: "proposal-link",
          pageId: null,
          eventType: "link_click",
          kind: "sidebar_link",
          label: "Proposal for Acme",
          destinationKind: "external_web",
          destinationHost: "docs.example",
        },
      ],
    });
    expect(JSON.stringify(resolved.manifest)).not.toContain("token=secret");
    expect(JSON.stringify(resolved.manifest)).not.toContain("private.example");
    expect(JSON.stringify(resolved.manifest)).not.toContain("Missing stable ID");
  });

  it("keeps a default-width Tiptap button content-sized in public output", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [{
      type: "buttonBlock",
      attrs: { id: "compact-button", href: "https://example.com/book", fullWidth: false },
      content: [{ type: "text", text: "Book a call" }],
    }];

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain('class="handout-button-block"');
    expect(html).not.toContain('class="handout-button-block handout-button-block-full"');
  });

  it("renders standard and icon lists through the shared list contract", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      {
        type: "bulletList",
        content: [{
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet" }] }],
        }],
      },
      {
        type: "orderedList",
        content: [{
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Numbered" }] }],
        }],
      },
      {
        type: "iconList",
        content: [{
          type: "iconListItem",
          attrs: { icon: "box", iconColor: "neutral" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Icon" }] }],
        }],
      },
    ];

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain('<ul class="handout-list"><li class="handout-list-item"><p class="handout-paragraph">Bullet</p></li></ul>');
    expect(html).toContain('<ol class="handout-list"><li class="handout-list-item"><p class="handout-paragraph">Numbered</p></li></ol>');
    expect(html).toContain('<ul class="handout-icon-list"><li class="handout-icon-list-item"');
    expect(html).toContain('<div><p class="handout-paragraph">Icon</p></div></li></ul>');
  });

  it("keeps the canonical editor and public typography in one stylesheet", () => {
    expect(SITE_DOCUMENT_CSS).toContain(".handout-heading-2,.handout-prosemirror>h2");
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror>[data-handout-gif-empty],.handout-document-editor .handout-prosemirror>[data-handout-image-empty],.handout-document-editor .handout-prosemirror>[data-resize-container][data-node=gifBlock],.handout-document-editor .handout-prosemirror>[data-resize-container][data-node=image]{width:min(612px,calc(100% - 104px))"
    );
    expect(SITE_DOCUMENT_CSS).toContain(".handout-prosemirror>h2");
    expect(SITE_DOCUMENT_CSS).toContain('font-family:"Geist Variable","Geist"')
    expect(SITE_DOCUMENT_CSS).toContain("letter-spacing:-.02em")
    expect(SITE_DOCUMENT_CSS).toContain("letter-spacing:-.03em")
    expect(SITE_DOCUMENT_CSS).toContain("--handout-font-weight-body:400;--handout-font-weight-heading:550;--handout-font-weight-label:500;--handout-list-item-gap:4px")
    expect(SITE_DOCUMENT_CSS).toContain(
      ":where(html[data-handout-public-site],body[data-handout-public-site],.handout-site,.handout-document-editor,.handout-editor-sidebar-content),:where(.handout-site,.handout-document-editor,.handout-editor-sidebar-content) *{font-feature-settings:normal;font-kerning:normal;font-optical-sizing:auto;font-synthesis-weight:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(".handout-document,.handout-document-editor{font-weight:var(--handout-font-weight-body)}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-prosemirror strong{font-weight:700}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-paragraph,.handout-prosemirror>p")
    expect(SITE_DOCUMENT_CSS).toContain("font-weight:var(--handout-font-weight-body);line-height:26px")
    expect(SITE_DOCUMENT_CSS).not.toContain("font-variation-settings")
    expect(SITE_DOCUMENT_CSS).not.toContain(".handout-document-editor .handout-prosemirror>p{padding")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-page-title-subtitle,[data-handout-page-title-subtitle]{max-width:100%;margin:8px 0 0")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-prosemirror>h1+p,.handout-prosemirror>h2+p,.handout-prosemirror>h3+p{margin-top:14px}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-page-title{display:flex;flex-direction:column;align-items:center;gap:24px;padding:0 0 36px")
    expect(SITE_DOCUMENT_CSS).toContain("overflow:hidden;border:1px solid var(--border);border-radius:14px")
    expect(SITE_DOCUMENT_CSS).toContain("background:var(--background);color:var(--foreground)}.handout-page-title-logo img")
    expect(SITE_DOCUMENT_CSS).not.toContain("background:var(--foreground);color:var(--background)}.handout-page-title-logo img")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-page-title-logo img{width:100%;height:100%;padding:0;object-fit:cover}")
    expect(SITE_DOCUMENT_CSS).not.toContain(".handout-page-title-logo img{width:100%;height:100%;padding:8px")
    expect(SITE_DOCUMENT_CSS).not.toContain(".handout-document-editor .handout-prosemirror>*+*{margin-top:20px}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-document-editor .handout-prosemirror{width:100%;min-width:0;max-width:100%")
    expect(SITE_DOCUMENT_CSS).toContain("width:min(612px,calc(100% - 104px));max-width:calc(100% - 104px)")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-logo-grid{display:grid;width:100%;min-width:0;max-width:100%")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-icon-list,.handout-document-editor .handout-prosemirror ul[data-handout-icon-list]{display:flex;flex-direction:column;gap:var(--handout-list-item-gap);padding:0!important;list-style:none!important}"
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-task-list,.handout-document-editor .handout-prosemirror ul[data-type=taskList]{display:flex;flex-direction:column;gap:var(--handout-list-item-gap);padding:0!important;list-style:none!important}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-prosemirror>blockquote,.handout-prosemirror>pre,.handout-prosemirror>ul,.handout-prosemirror>ol,.handout-prosemirror>:where(ul,ol)+*{margin-top:24px}",
    )
    expect(SITE_DOCUMENT_CSS.lastIndexOf(".handout-prosemirror>blockquote,.handout-prosemirror>pre,.handout-prosemirror>ul,.handout-prosemirror>ol")).toBeGreaterThan(
      SITE_DOCUMENT_CSS.indexOf(".handout-list,.handout-prosemirror>ul,.handout-prosemirror>ol"),
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list-item,.handout-document-editor .handout-prosemirror>:where(ul,ol)>li{padding-left:0}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list:is(ol)>.handout-list-item,.handout-document-editor .handout-prosemirror>ol>li{padding-left:2px}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list>.handout-list-item+.handout-list-item,.handout-document-editor .handout-prosemirror :where(ul:not([data-type=taskList]):not([data-handout-icon-list]),ol)>li+li{margin-top:var(--handout-list-item-gap)}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(".handout-icon-list-item{display:grid;grid-template-columns:20px minmax(0,1fr);align-items:start;gap:2px;padding-left:4px}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-button{display:flex;min-height:36px;align-items:center;justify-content:center;gap:6px")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-button>svg{width:15px;height:15px;flex:none}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-table th,.handout-document-editor .tableWrapper>table th{background:var(--table-header-background)")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-button-block{display:inline-flex;width:max-content;min-height:32px;max-width:100%;align-items:center;justify-content:center;padding:0 12px;border-radius:8px;background:var(--handout-primary,var(--primary));color:var(--handout-primary-foreground,var(--primary-foreground));font-size:15px")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-button-block-full{display:flex;width:100%;min-height:40px;padding:2px 12px}")
    expect(SITE_DOCUMENT_CSS).not.toContain(".handout-document-editor .handout-editor-button-block-full{")
    expect(SITE_DOCUMENT_CSS).toContain("font-size:20px;font-weight:var(--handout-font-weight-heading);letter-spacing:-.03em;line-height:32px");
    expect(SITE_DOCUMENT_IFRAME_SANDBOX).toBe("allow-popups allow-same-origin allow-scripts")
    expect(SITE_DOCUMENT_CSS).toContain("--handout-primary");
    expect(HANDOUT_THEME_CSS).toContain("--tertiary-foreground:var(--neutral-300)");
    expect(HANDOUT_THEME_CSS).toContain("--secondary-foreground:var(--neutral-200)");
    expect(SITE_DOCUMENT_CSS).toContain("font-size:14px;font-weight:500;letter-spacing:-.02em;line-height:24px");
    expect(SITE_DOCUMENT_CSS).not.toContain("text-transform:uppercase");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar,.handout-editor-sidebar-content{font-family:\"Geist Variable\",\"Geist\"")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-editor-sidebar-content :where(button,a){font-family:inherit;letter-spacing:-.02em}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-section>h2,.handout-editor-sidebar-section-title{height:26px;min-width:0;margin:0 0 0 4px;overflow:hidden;color:var(--foreground);font-size:14px;font-weight:500;letter-spacing:-.02em");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-inner{display:flex;width:241px;flex-direction:column;gap:24px}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-section-buttons{gap:10px}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-link:hover,.handout-sidebar-link:focus-visible{color:var(--foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-link svg{color:var(--handout-sidebar-link-icon,var(--blue-foreground))}");
    expect(SITE_DOCUMENT_CSS).toContain("font-size:16px;font-weight:400;letter-spacing:-.02em;line-height:24px")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-mobile-title{min-width:0;flex:1;overflow:hidden;color:var(--tertiary-foreground);font-size:16px;font-weight:500");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab,.handout-sidebar-link{color:var(--tertiary-foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab svg{color:var(--muted-foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-row.is-active svg{color:inherit}");
    expect(SITE_DOCUMENT_CSS).toContain("height:44px;align-items:center;gap:8px;padding:0 12px");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-mobile-header{display:flex;height:44px");
    expect(SITE_DOCUMENT_CSS).toContain("padding:0 8px 0 16px");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-inner{width:100%;padding:20px 16px}");
    expect(SITE_DOCUMENT_CSS).toContain("width:28px;height:28px");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-close svg{width:14px;height:14px}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-mobile-menu svg{width:14px;height:14px}");
    expect(SITE_DOCUMENT_CSS).toContain("color:var(--tertiary-foreground);cursor:pointer");
    expect(SITE_DOCUMENT_CSS).toContain("background:var(--neutral-alpha-a500)");
    expect(SITE_DOCUMENT_CSS).toContain('mask:url("/handout-logo.svg") center/contain no-repeat');
  });

  it("uses the complete shared Tabler icon catalog in every renderer", () => {
    expect(SITE_ICON_OPTIONS.length).toBeGreaterThan(200);
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

  it("uses the selected icon color for icon-card glyphs and tiles", () => {
    expect(SITE_DOCUMENT_CSS).toContain(
      "--handout-icon-color:var(--color-purple-foreground,var(--purple-foreground))",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      "--handout-icon-background:var(--color-purple-background,var(--purple-background))",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      "background:var(--handout-icon-background,var(--color-muted,var(--muted)))",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-icon-card{padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--background)",
    );
  });

  it("uses the background token for every card block surface", () => {
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-image-card{display:grid;grid-template-columns:minmax(180px,41.5%) minmax(0,1fr);align-items:center;gap:20px;overflow:hidden;padding:6px;border:1px solid var(--border);border-radius:14px;background:var(--background)",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-icon-card{padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--background)",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-testimonial{display:grid;grid-template-columns:40px minmax(0,1fr);grid-template-rows:20px 20px minmax(40px,auto);column-gap:12px;align-items:center;padding:16px 20px 20px 16px;border:1px solid var(--border);border-radius:14px;background:var(--background)",
    );
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-logo-grid-item{display:flex;min-width:0;flex-direction:column;align-items:center;gap:8px;padding:16px 12px 12px;border:1px solid var(--border);border-radius:14px;background:var(--background)",
    );
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
    expect(html).toContain('class="handout-sidebar"');
    expect(html).toContain('aria-label="Open site navigation"');
    expect(html).toContain('data-handout-page-target=');
    expect(html).not.toContain(`<script defer src="${PUBLIC_SITE_RUNTIME_PATH}"></script>`);
    expect(html).toContain('src="/api/workspaces/logo-preview/image?domain=acme.io&amp;size=128&amp;theme=dark"');
    expect(html).toContain('src="/api/workspaces/logo-preview/image?domain=linear.app&amp;size=128&amp;theme=dark"');
    expect(html).not.toContain(PUBLIC_SITE_LOGO_ENDPOINT);
    expect(PUBLIC_SITE_RUNTIME).toContain("image.src='/handout-logo.svg'");
    expect(PUBLIC_SITE_RUNTIME).toContain("removeLogoTile(tile)");
    expect(PUBLIC_SITE_RUNTIME).toContain("setSidebarOpen(false,true)");
    expect(PUBLIC_SITE_RUNTIME).toContain(".handout-sidebar-backdrop");
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

  it("keeps the site usable when invalid tracking identity disables analytics", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [
      {
        type: "buttonBlock",
        attrs: { id: "duplicate-button", href: "https://example.com/one" },
        content: [{ type: "text", text: "First action" }],
      },
      {
        type: "buttonBlock",
        attrs: { id: "duplicate-button", href: "https://example.com/two" },
        content: [{ type: "text", text: "Second action" }],
      },
    ];

    const html = renderPublicSiteHtml(payload);
    expect(html).toContain("First action");
    expect(html).toContain("Second action");
    expect(html).not.toContain("data-handout-element-id");
  });

  it("applies the selected primary color to buttons and active tabs", () => {
    const payload = buildPayload();
    payload.content.sidebar.links.push({
      id: "primary-color-link",
      label: "Proposal",
      href: "https://example.com/proposal",
      icon: "website",
      status: "visible",
      sortOrder: 0,
    });
    const neutralHtml = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(neutralHtml).toContain("--handout-sidebar-link-icon:var(--blue-foreground)");

    payload.content.settings.primaryColor = "purple";

    const html = renderPublicSiteHtml(payload, { includeTracking: false });

    expect(html).toContain("--handout-primary:var(--purple-foreground)");
    expect(html).toContain("--handout-primary-soft:var(--purple-background-subtle)");
    expect(html).toContain("--handout-sidebar-link-icon:var(--purple-foreground)");
    expect(html).toContain("handout-sidebar-row handout-sidebar-link");
    expect(html).toContain(renderSiteIconSvg("link"));
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-row.is-active{background:var(--handout-primary-soft");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab,.handout-sidebar-link{color:var(--tertiary-foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab svg{color:var(--muted-foreground)}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-row.is-active{color:var(--handout-primary,var(--foreground))}");
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-row.is-active svg{color:inherit}");
    expect(SITE_DOCUMENT_CSS).toContain("background:var(--handout-primary,var(--primary))");
  });

  it("gates tracking behind the selected visitor consent popup", () => {
    const payload = buildPayload();
    payload.trackingV2 = {
      version: 2,
      trackingMode: "events",
      contextToken: "lsv2.context-token-at-least-24",
      issuedAt: "2026-07-09T12:00:00.000Z",
      expiresAt: "2026-07-10T12:00:00.000Z",
    };
    payload.content.settings.trackingConsentPopup = "popup-b";
    payload.content.settings.trackingPrivacyPolicyUrl = "https://customer.example/privacy";

    const popupHtml = renderPublicSiteHtml(payload);
    expect(popupHtml).toContain('data-handout-consent-popup="popup-b"');
    expect(popupHtml).toContain('role="dialog" aria-modal="true"');
    expect(popupHtml).toContain('class="handout-consent-dialog"');
    expect(popupHtml).toContain('class="handout-consent-copy"');
    expect(popupHtml).toContain("Deny and proceed");
    expect(popupHtml).toContain("Allow and proceed");
    expect(popupHtml).toContain('data-handout-consent-site-id="22222222-2222-4222-8222-222222222222"');
    expect(popupHtml).toContain('data-handout-consent-script-src="/track/2026-07-13.v9/script.js"');
    expect(popupHtml).not.toContain("<script>(function()");
    expect(PUBLIC_SITE_RUNTIME).toContain("localStorage.setItem(consentStorageKey,JSON.stringify(value))");
    expect(PUBLIC_SITE_RUNTIME).toContain("data-handout-replay-consent");
    expect(PUBLIC_SITE_RUNTIME).toContain("handout:tracking-consent-withdrawn");
    expect(PUBLIC_SITE_RUNTIME).toContain("typeof mobileQuery.addEventListener==='function'");
    expect(() => new Function(PUBLIC_SITE_RUNTIME)).not.toThrow();
    expect(SITE_DOCUMENT_CSS).toContain(".handout-consent-copy{display:flex;flex-direction:column}");
    expect(SITE_DOCUMENT_CSS).toContain("padding:6px 0;font-size:16px");
    expect(SITE_DOCUMENT_CSS).toContain("padding:0 10px;border:1px solid var(--border)");
    expect(popupHtml).toContain("Privacy choices");
    expect(popupHtml).toContain('href="https://customer.example/privacy"');

    payload.content.settings.trackingConsentPopup = "popup-a";
    const popupAHtml = renderPublicSiteHtml(payload);
    expect(popupAHtml).toContain('data-handout-consent-popup="popup-a"');
    expect(popupAHtml).toContain("You may decline and enter");
    expect(popupAHtml).not.toContain("Deny and proceed");

    payload.content.settings.trackingConsentPopup = "none";
    const immediateHtml = renderPublicSiteHtml(payload);
    expect(immediateHtml).not.toContain("data-handout-consent-popup");
    expect(immediateHtml).toContain("data-handout-tracking-v2=");
  });

  it("fails consent-gated tracking closed without a valid customer privacy policy", () => {
    const payload = buildPayload();
    payload.trackingV2 = {
      version: 2,
      trackingMode: "events_and_replay",
      contextToken: "lsv2.context-token-at-least-24",
      issuedAt: "2026-07-09T12:00:00.000Z",
      expiresAt: "2026-07-10T12:00:00.000Z",
    };

    const html = renderPublicSiteHtml(payload);
    expect(html).not.toContain("data-handout-consent-popup");
    expect(html).not.toContain("data-handout-tracking-v2=");

    payload.content.settings.trackingPrivacyPolicyUrl = "http://customer.example/privacy";
    expect(renderPublicSiteHtml(payload)).not.toContain("data-handout-tracking-v2=");
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
      trackingMode: "events",
    },
  };
}
