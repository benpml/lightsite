import { describe, expect, it } from "vitest";
import {
  classifyPublicRoute,
  isPublicSiteScreenshotPath,
  isPublicSitePath,
  isPublicPreviewVersion,
  isShortPublicSiteScreenshotPath,
  readPositiveInteger,
} from "./cache-policy";

describe("public worker cache policy", () => {
  it("classifies public site paths without catching API or assets", () => {
    expect(classifyPublicRoute("/acme/overview")).toBe("public-site");
    expect(classifyPublicRoute("/acme/overview/mira")).toBe("public-site");
    expect(classifyPublicRoute("/aZ7k2Q")).toBe("public-site");
    expect(classifyPublicRoute("/aZ7k2Qr9LmNp")).toBe("public-site");
    expect(classifyPublicRoute("/Ab3dE5fG7hJ9/john/linear/linear.app")).toBe("recipient-link");
    expect(classifyPublicRoute("/Ab3dE5fG7hJ9/john/linear/linear.app/embed.jpg")).toBe("recipient-link");
    expect(classifyPublicRoute("/aZ7k2Qr9LmNp/embed.jpg")).toBe("screenshot");
    expect(classifyPublicRoute("/acme/overview/embed.jpg")).toBe("screenshot");
    expect(classifyPublicRoute("/acme/overview/mira/embed.jpg")).toBe("screenshot");
    expect(classifyPublicRoute("/api/tracking/events")).toBe("api");
    expect(classifyPublicRoute("/assets/images/foo/bar")).toBe("not-found");
    expect(classifyPublicRoute("/editor-assets/site-avatar.png")).toBe("asset");
    expect(classifyPublicRoute("/fonts/geist-latin-wght-normal.woff2")).toBe("asset");
    expect(classifyPublicRoute("/handout-logo-icon.svg")).toBe("asset");
    expect(classifyPublicRoute("/handout-logo.svg")).toBe("asset");
    expect(classifyPublicRoute("/site-runtime.v7.js")).toBe("asset");
    expect(classifyPublicRoute("/site-runtime.v99.js")).toBe("asset");
    expect(classifyPublicRoute("/site-runtime.latest.js")).toBe("not-found");
    expect(classifyPublicRoute("/health")).toBe("health");
    expect(classifyPublicRoute("/api")).toBe("api");
    expect(classifyPublicRoute("/aZ7k2")).toBe("not-found");
    expect(classifyPublicRoute("/aZ7k2Qr9LmNp12345")).toBe("not-found");
    expect(classifyPublicRoute("/acme")).toBe("not-found");
    expect(classifyPublicRoute("/api/site/page")).toBe("api");
  });

  it("recognizes only canonical site and recipient screenshot paths", () => {
    expect(isPublicSiteScreenshotPath("/workspace/site/embed.jpg")).toBe(true);
    expect(isPublicSiteScreenshotPath("/aZ7k2Qr9LmNp/embed.jpg")).toBe(true);
    expect(isPublicSiteScreenshotPath("/Ab3dE5fG7hJ9/john/linear/linear.app/embed.jpg")).toBe(false);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/embed.jpg")).toBe(true);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/embed.png")).toBe(true);
    expect(isPublicSiteScreenshotPath("/workspace/site/recipient/other.png")).toBe(false);
    expect(isPublicSiteScreenshotPath("/api/site/embed.png")).toBe(false);
    expect(isShortPublicSiteScreenshotPath("/aZ7k2Qr9LmNp/embed.jpg")).toBe(true);
    expect(isShortPublicSiteScreenshotPath("/workspace/site/embed.jpg")).toBe(false);
  });

  it("allows only stable public site segments", () => {
    expect(isPublicSitePath("/workspace/site/recipient-company")).toBe(true);
    expect(isPublicSitePath("/workspace/site/recipient_company")).toBe(false);
    expect(isPublicSitePath("/workspace/site/recipient/company")).toBe(false);
    expect(isPublicSitePath("/workspace/site?x=1")).toBe(false);
    expect(isPublicSitePath("/-workspace/site")).toBe(false);
  });

  it("parses cache seconds defensively", () => {
    expect(readPositiveInteger("120", 60)).toBe(120);
    expect(readPositiveInteger("-1", 60)).toBe(60);
    expect(readPositiveInteger("oops", 60)).toBe(60);
    expect(readPositiveInteger("999", 60, 300)).toBe(300);
  });

  it("accepts only canonical bounded preview versions", () => {
    expect(isPublicPreviewVersion(
      "33333333-3333-4333-8333-333333333333.7.r2.w1a2b3c",
    )).toBe(true);
    expect(isPublicPreviewVersion(
      "33333333-3333-4333-8333-333333333333.7",
    )).toBe(true);
    expect(isPublicPreviewVersion("version-7.3")).toBe(false);
    expect(isPublicPreviewVersion("x".repeat(200))).toBe(false);
    expect(isPublicPreviewVersion(null)).toBe(false);
  });

});
