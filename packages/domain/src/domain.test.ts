import { describe, expect, it } from "vitest";
import {
  canServeWorkspacePublicPages,
  LIGHTSITE_COLLECTION_LIMITS,
  LIGHTSITE_TEXT_LIMITS,
  clampTextToLimit,
  normalizeWebsiteDomain,
  normalizeWebsiteUrl,
  slugifyName,
  validateTextLimit,
  validateSiteSlug,
  validateVariantSlug,
  validateWorkEmail,
  validateWorkspaceSlug,
} from "./index";

describe("domain email rules", () => {
  it("normalizes and accepts work email addresses", () => {
    expect(validateWorkEmail(" Jane@Acme.com ")).toEqual({
      ok: true,
      email: "jane@acme.com",
      domain: "acme.com",
    });
  });

  it("blocks personal email domains", () => {
    expect(validateWorkEmail("jane@gmail.com")).toMatchObject({
      ok: false,
      code: "email.personal_domain_blocked",
    });
  });

  it("blocks plus aliases", () => {
    expect(validateWorkEmail("jane+sales@acme.com")).toMatchObject({
      ok: false,
      code: "email.plus_addressing_blocked",
    });
  });
});

describe("domain slug rules", () => {
  it("creates URL-safe slugs from names", () => {
    expect(slugifyName(" Acme Rollout Brief! ")).toBe("acme-rollout-brief");
  });

  it("blocks reserved workspace slugs", () => {
    expect(validateWorkspaceSlug("settings")).toMatchObject({
      ok: false,
      code: "slug.reserved",
    });
  });

  it("validates site slugs separately from workspace slugs", () => {
    expect(validateSiteSlug("rollout-brief")).toEqual({
      ok: true,
      slug: "rollout-brief",
    });
  });

  it("validates variant slugs for recipient links", () => {
    expect(validateVariantSlug("Mira Singh")).toEqual({
      ok: true,
      slug: "mira-singh",
    });
    expect(validateVariantSlug("preview")).toMatchObject({
      ok: false,
      code: "slug.reserved",
    });
  });
});

describe("domain limit rules", () => {
  it("defines safety limits for editor collections", () => {
    expect(LIGHTSITE_COLLECTION_LIMITS).toMatchObject({
      blocksPerTab: 500,
      links: 25,
      tabs: 25,
    });
  });

  it("validates and clamps text by named intent", () => {
    const oversizedName = "x".repeat(LIGHTSITE_TEXT_LIMITS.siteName + 1);

    expect(validateTextLimit("Acme", "siteName", "Site name")).toEqual({
      ok: true,
      value: "Acme",
    });
    expect(validateTextLimit(oversizedName, "siteName", "Site name")).toMatchObject({
      ok: false,
      code: "text.too_long",
      limit: LIGHTSITE_TEXT_LIMITS.siteName,
    });
    expect(clampTextToLimit(oversizedName, "siteName")).toHaveLength(
      LIGHTSITE_TEXT_LIMITS.siteName,
    );
  });
});

describe("workspace lifecycle rules", () => {
  it("serves public pages only for active workspaces", () => {
    expect(canServeWorkspacePublicPages("active")).toBe(true);
    expect(canServeWorkspacePublicPages("suspended")).toBe(false);
    expect(canServeWorkspacePublicPages("scheduled_for_deletion")).toBe(false);
    expect(canServeWorkspacePublicPages("deleted")).toBe(false);
  });
});

describe("domain website rules", () => {
  it("normalizes forgiving public website URLs", () => {
    expect(normalizeWebsiteUrl("text.text")).toEqual({
      ok: true,
      domain: "text.text",
      url: "https://text.text",
    });
    expect(normalizeWebsiteUrl(" http://www.Acme.com/team?ref=lightsite#intro ")).toEqual({
      ok: true,
      domain: "acme.com",
      url: "http://acme.com/team?ref=lightsite#intro",
    });
  });

  it("rejects non-public website URLs", () => {
    expect(normalizeWebsiteUrl("localhost:5173")).toMatchObject({
      ok: false,
      code: "website.invalid_url",
    });
    expect(normalizeWebsiteUrl("http://localhost:5173")).toMatchObject({
      ok: false,
      code: "website.local_hostname",
    });
    expect(normalizeWebsiteUrl("app.local")).toMatchObject({
      ok: false,
      code: "website.local_hostname",
    });
    expect(normalizeWebsiteUrl("acme")).toMatchObject({
      ok: false,
      code: "website.invalid_hostname",
    });
    expect(normalizeWebsiteUrl("hello world.com")).toMatchObject({
      ok: false,
      code: "website.invalid_url",
    });
    expect(normalizeWebsiteUrl("mailto:jane@acme.com")).toMatchObject({
      ok: false,
      code: "website.invalid_url",
    });
  });

  it("normalizes a company website to a canonical domain and url", () => {
    expect(normalizeWebsiteDomain(" https://www.Acme.com/team ")).toEqual({
      ok: true,
      domain: "acme.com",
      url: "https://acme.com",
    });
  });

  it("rejects local hostnames and private IP addresses", () => {
    expect(normalizeWebsiteDomain("localhost")).toMatchObject({
      ok: false,
      code: "website.local_hostname",
    });
    expect(normalizeWebsiteDomain("192.168.1.20")).toMatchObject({
      ok: false,
      code: "website.local_hostname",
    });
  });

  it("rejects placeholder domains", () => {
    expect(normalizeWebsiteDomain("example.com")).toMatchObject({
      ok: false,
      code: "website.placeholder_domain",
    });
  });
});
