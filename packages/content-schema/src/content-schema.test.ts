import { describe, expect, it } from "vitest";
import { normalizePublishedSitePayload } from "./index";

describe("published site payload normalization", () => {
  it("normalizes public payloads defensively for renderer runtimes", () => {
    expect(normalizePublishedSitePayload({
      schemaVersion: 1,
      workspace: {
        id: "workspace_123",
        slug: "ACME",
        name: "Acme",
      },
      site: {
        id: "site_123",
        slug: "Rollout-Brief",
        name: "Rollout brief",
        publishedVersionId: "version_123",
      },
      metadata: {
        title: "Custom title",
        robots: "index,follow",
      },
      header: {
        title: "Header title",
      },
      variables: [
        {
          id: "company_name",
          defaultValue: "Acme",
        },
      ],
      selectedVariant: {
        id: "variant_123",
        slug: "Mira",
        variableValues: {
          company_name: "Mira Corp",
          ignored: 42,
        },
      },
      blocks: [
        {
          id: "cta_123",
          type: "cta",
          label: "Book review",
          href: "https://example.com",
        },
        {
          id: "unknown_123",
          type: "unsupported",
        },
      ],
      tracking: {
        workspaceId: "workspace_123",
        siteId: "site_123",
        publishedVersionId: "version_123",
        variantId: "variant_123",
        variantRevision: 3,
        mode: "engagement",
        token: "signed-token",
      },
    })).toMatchObject({
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
        title: "Custom title",
        description: "",
        robots: "noindex,nofollow",
      },
      variables: [
        {
          id: "company_name",
          name: "company_name",
          type: "text",
          defaultValue: "Acme",
        },
      ],
      selectedVariant: {
        slug: "mira",
        name: "Mira",
        variableValues: {
          company_name: "Mira Corp",
        },
      },
      blocks: [
        {
          id: "cta_123",
          type: "button",
          style: "filled",
        },
      ],
      tracking: {
        mode: "engagement",
        token: "signed-token",
      },
    });
  });

  it("fails closed without required public identity fields", () => {
    expect(normalizePublishedSitePayload({})).toBeNull();
    expect(normalizePublishedSitePayload({
      workspace: {
        id: "workspace_123",
        slug: "acme",
        name: "Acme",
      },
      site: {
        id: "site_123",
        slug: "rollout-brief",
        name: "Rollout brief",
      },
    })).toBeNull();
  });

  it("disables tracking unless the signed token is present", () => {
    expect(normalizePublishedSitePayload({
      workspace: {
        id: "workspace_123",
        slug: "acme",
        name: "Acme",
      },
      site: {
        id: "site_123",
        slug: "rollout-brief",
        name: "Rollout brief",
        publishedVersionId: "version_123",
      },
      tracking: {
        mode: "engagement",
      },
    })?.tracking).toMatchObject({
      workspaceId: "workspace_123",
      siteId: "site_123",
      publishedVersionId: "version_123",
      mode: "off",
      token: null,
    });
  });
});
