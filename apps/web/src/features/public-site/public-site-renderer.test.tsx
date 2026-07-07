import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getPublicCacheMetadata } from "./public-cache";
import { getDemoPublishedSite } from "./public-site-fixture";
import { PublicSiteRenderer } from "./public-site-renderer";
import { getResolvedMetadata } from "./public-metadata";
import { normalizePublishedSitePayload } from "./public-payload-adapter";
import type { PublishedSitePayload } from "./types";

describe("public site rendering", () => {
  it("renders the default published snapshot with fallback variable values", () => {
    const payload = requireDemoPayload(null);
    const html = renderPublicSite(payload);

    expect(html).toContain("A focused rollout plan for your team");
    expect(html).toContain("Book implementation review");
    expect(html).toContain('data-track-click-id="cta-primary"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders variant overrides and includes variant revision in cache metadata", () => {
    const payload = requireDemoPayload("mira");
    const html = renderPublicSite(payload);
    const metadata = getResolvedMetadata(payload, "https://pages.lightsite.test");
    const cache = getPublicCacheMetadata(payload);

    expect(html).toContain("A focused rollout plan for Acme");
    expect(metadata).toMatchObject({
      title: "Rollout brief for Acme",
      canonicalUrl: "https://pages.lightsite.test/lightsite/rollout-brief/mira",
      robots: "noindex,nofollow",
    });
    expect(cache.key).toBe("public-site:lightsite:rollout-brief:version-rollout-brief-4:mira:3");
    expect(cache.tags).toContain("variant:variant-acme-mira");
  });

  it("renders hero avatars from hero chrome JSON", () => {
    const payload = clonePayload(requireDemoPayload("mira"));
    payload.chrome.siteHeader.logoUrl = null;
    payload.chrome.hero.avatarMode = "duo";
    payload.chrome.hero.avatarImageUrl = "/workspace-logo.svg";
    payload.chrome.hero.avatarImageAlt = "Workspace avatar";
    payload.chrome.hero.avatarImageSecondaryUrl = "/recipient-logo.svg";
    payload.chrome.hero.avatarImageSecondaryAlt = "Recipient avatar";

    const html = renderPublicSite(payload);

    expect(html).toContain('src="/workspace-logo.svg"');
    expect(html).toContain('alt="Workspace avatar"');
    expect(html).toContain('src="/recipient-logo.svg"');
    expect(html).toContain('alt="Recipient avatar"');
    expect(html).not.toContain("/api/workspaces/logo-preview/image");
  });

  it("omits the hero avatars when both sources are unavailable", () => {
    const payload = clonePayload(requireDemoPayload(null));
    payload.chrome.siteHeader.logoUrl = null;
    payload.chrome.hero.avatarImageUrl = null;
    payload.chrome.hero.avatarImageSecondaryUrl = null;
    payload.selectedVariant = null;

    const html = renderPublicSite(payload);

    expect(html).not.toContain("/api/workspaces/logo-preview/image");
    expect(html).not.toContain("Recipient logo");
  });

  it("fails closed for unknown variant slugs", () => {
    expect(getDemoPublishedSite("unknown")).toBeNull();
  });

  it("omits invalid public media and unsafe URLs without crashing", () => {
    const payload = clonePayload(requireDemoPayload("mira"));
    payload.chrome.hero.avatarImageUrl = "javascript:alert(1)";
    payload.chrome.hero.avatarImageAlt = "Bad";
    payload.blocks.push({
      id: "bad-image",
      type: "image",
      asset: {
        id: "bad-image-asset",
        kind: "image",
        src: "//evil.example/image.png",
        alt: "Bad image",
        width: 1200,
        height: 675,
      },
      caption: null,
    });
    payload.blocks.push({
      id: "bad-cta",
      type: "button",
      label: "Unsafe CTA",
      href: "javascript:alert(1)",
      style: "filled",
    });

    const html = renderPublicSite(payload);

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("//evil.example/image.png");
    expect(html).not.toContain("Unsafe CTA");
  });

  it("renders public blocks with editor-aligned list, button, and accordion structure", () => {
    const payload = clonePayload(requireDemoPayload("mira"));
    payload.blocks.push(
      {
        id: "list-test",
        type: "bullet-list",
        items: ["First item", "Second item"],
      },
      {
        id: "button-test",
        type: "button",
        label: "Open plan",
        href: "https://example.com/plan",
        style: "outline",
      },
      {
        id: "accordion-test",
        type: "accordion",
        items: [
          {
            id: "accordion-open",
            title: "Open question",
            body: "Open answer",
            expanded: true,
          },
          {
            id: "accordion-closed",
            title: "Closed question",
            body: "Closed answer",
            expanded: false,
          },
        ],
      },
    );

    const html = renderPublicSite(payload);

    expect(html).toContain("my-1 list-disc pl-8");
    expect(html).toContain("rounded-lg border border-transparent");
    expect(html).toContain("<details open");
    expect(html).toContain("Closed answer");
    expect(html).toContain("group-open/accordion:rotate-0");
  });
});

describe("public payload adapter", () => {
  it("normalizes older payloads with missing optional fields", () => {
    const normalized = normalizePublishedSitePayload({
      workspace: {
        id: "workspace_1",
        slug: "ACME",
        name: "Acme",
      },
      site: {
        id: "site_1",
        slug: "Rollout-Brief",
        name: "Rollout brief",
        publishedVersionId: "version_1",
      },
      header: {
        title: "Hello {{company_name}}",
      },
      variables: [
        {
          id: "company_name",
          name: "Company name",
          defaultValue: "team",
        },
      ],
      blocks: [
        {
          id: "heading_1",
          type: "heading",
          text: "Overview",
        },
        {
          id: "legacy_unknown",
          type: "legacy_embed",
          html: "<script>alert(1)</script>",
        },
      ],
    });

    expect(normalized).toMatchObject({
      schemaVersion: 1,
      workspace: {
        slug: "acme",
        websiteDomain: "",
      },
      site: {
        slug: "rollout-brief",
        publishedAt: "1970-01-01T00:00:00.000Z",
      },
      metadata: {
        title: "Rollout brief",
        robots: "noindex,nofollow",
      },
      tracking: {
        mode: "off",
        variantId: null,
        variantRevision: null,
      },
    });
    expect(normalized?.blocks).toHaveLength(1);
    expect(renderPublicSite(normalized as PublishedSitePayload)).toContain("Hello team");
  });

  it("rejects payloads without required public identity", () => {
    expect(normalizePublishedSitePayload({ site: { id: "site_1" } })).toBeNull();
  });
});

function requireDemoPayload(variantSlug: string | null) {
  const payload = getDemoPublishedSite(variantSlug);

  if (!payload) {
    throw new Error(`Missing demo payload for ${variantSlug ?? "default"}.`);
  }

  return payload;
}

function renderPublicSite(payload: PublishedSitePayload) {
  return renderToStaticMarkup(<PublicSiteRenderer payload={payload} />);
}

function clonePayload(payload: PublishedSitePayload): PublishedSitePayload {
  return structuredClone(payload);
}
