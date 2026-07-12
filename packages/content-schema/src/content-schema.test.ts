import { describe, expect, it } from "vitest";
import {
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@lightsite/site-document";

import {
  CURRENT_PUBLIC_PAYLOAD_SCHEMA_VERSION,
  normalizePublishedSitePayload,
} from "./index";

describe("published site payload normalization", () => {
  it("accepts the canonical public payload without changing its Tiptap document", () => {
    const payload = buildPayload();
    payload.content.pages[0]!.document.content = [{
      type: "paragraph",
      content: [{ type: "text", text: "Canonical content", marks: [{ type: "bold" }] }],
    }];

    expect(normalizePublishedSitePayload(payload)).toEqual(payload);
    expect(CURRENT_PUBLIC_PAYLOAD_SCHEMA_VERSION).toBe(PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION);
  });

  it("fails closed for legacy public payloads", () => {
    expect(normalizePublishedSitePayload({
      schemaVersion: 1,
      blocks: [{ type: "text", text: "Legacy" }],
    })).toBeNull();
  });

  it("fails closed when tracking context is missing", () => {
    const { tracking: _tracking, ...payload } = buildPayload();
    expect(normalizePublishedSitePayload(payload)).toBeNull();
  });
});

function buildPayload(): PublishedSitePayload {
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
    content: createDefaultSiteContent("Rollout"),
    selectedVariant: null,
    tracking: {
      version: 2,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: null,
      recipientRevision: null,
      trackingMode: "off",
    },
  };
}
