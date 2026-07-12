import { describe, expect, it } from "vitest";
import {
  buildPublicHtmlSnapshotKey,
  buildRecipientPreviewKey,
  classifyPublicRoute,
  isPublicSiteScreenshotPath,
  isPublicSitePath,
  isSnapshotFresh,
  readPositiveInteger,
} from "./cache-policy";

describe("public worker cache policy", () => {
  it("classifies public site paths without catching API or assets", () => {
    expect(classifyPublicRoute("/acme/overview")).toBe("public-site");
    expect(classifyPublicRoute("/acme/overview/mira")).toBe("public-site");
    expect(classifyPublicRoute("/acme/overview/embed.jpg")).toBe("screenshot");
    expect(classifyPublicRoute("/acme/overview/mira/embed.jpg")).toBe("screenshot");
    expect(classifyPublicRoute("/api/tracking/events")).toBe("api");
    expect(classifyPublicRoute("/editor-assets/site-avatar.png")).toBe("asset");
    expect(classifyPublicRoute("/fonts/geist-latin-wght-normal.woff2")).toBe("asset");
    expect(classifyPublicRoute("/lightsite-logo.svg")).toBe("asset");
    expect(classifyPublicRoute("/site-runtime.v3.js")).toBe("asset");
    expect(classifyPublicRoute("/health")).toBe("health");
    expect(classifyPublicRoute("/api")).toBe("api");
    expect(classifyPublicRoute("/acme")).toBe("not-found");
    expect(classifyPublicRoute("/api/site/page")).toBe("api");
  });

  it("recognizes only canonical site and recipient screenshot paths", () => {
    expect(isPublicSiteScreenshotPath("/workspace/site/embed.jpg")).toBe(true);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/embed.jpg")).toBe(true);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/embed.png")).toBe(true);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/other.png")).toBe(false);
    expect(isPublicSiteScreenshotPath("/api/site/embed.png")).toBe(false);
  });

  it("allows only stable public site segments", () => {
    expect(isPublicSitePath("/workspace/site/recipient-company")).toBe(true);
    expect(isPublicSitePath("/workspace/site/recipient_company")).toBe(false);
    expect(isPublicSitePath("/workspace/site/recipient/company")).toBe(false);
    expect(isPublicSitePath("/workspace/site?x=1")).toBe(false);
    expect(isPublicSitePath("/-workspace/site")).toBe(false);
  });

  it("builds bounded R2 snapshot keys from public paths", () => {
    expect(buildPublicHtmlSnapshotKey("/acme/overview")).toBe(
      "public-html/v1/acme/overview/index.html",
    );
    expect(buildPublicHtmlSnapshotKey("/acme/overview/")).toBe(
      "public-html/v1/acme/overview/index.html",
    );
  });

  it("builds immutable recipient preview keys only for valid versioned JPEGs", () => {
    expect(buildRecipientPreviewKey(
      "/acme/overview/ada/embed.jpg",
      "2026-07-11T17:00:00.000Z.4",
    )).toBe(
      "recipient-previews/v1/acme/overview/ada/2026-07-11T17:00:00.000Z.4/embed.jpg",
    );
    expect(buildRecipientPreviewKey("/acme/overview/embed.jpg", "version-7")).toBe(
      "recipient-previews/v1/acme/overview/version-7/embed.jpg",
    );
    expect(buildRecipientPreviewKey("/acme/overview/embed.jpg", null)).toBeNull();
    expect(buildRecipientPreviewKey("/acme/overview/embed.png", "version-7")).toBeNull();
    expect(buildRecipientPreviewKey("/acme/overview/embed.jpg", "../version-7")).toBeNull();
  });

  it("parses cache seconds defensively", () => {
    expect(readPositiveInteger("120", 60)).toBe(120);
    expect(readPositiveInteger("-1", 60)).toBe(60);
    expect(readPositiveInteger("oops", 60)).toBe(60);
    expect(readPositiveInteger("999", 60, 300)).toBe(300);
  });

  it("rejects stale or malformed R2 snapshot metadata", () => {
    const now = new Date("2026-07-07T00:00:00.000Z");

    expect(isSnapshotFresh("2026-07-06T23:59:30.000Z", now, 60)).toBe(true);
    expect(isSnapshotFresh("2026-07-06T23:58:30.000Z", now, 60)).toBe(false);
    expect(isSnapshotFresh("not-a-date", now, 60)).toBe(false);
    expect(isSnapshotFresh(undefined, now, 60)).toBe(false);
  });
});
