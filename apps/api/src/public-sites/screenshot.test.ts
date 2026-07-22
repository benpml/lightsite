import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import {
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@handout/site-document";
import {
  createPublicSiteScreenshotService,
  createPlaywrightPublicSiteScreenshotRenderer,
  isPublicIpAddress,
  type PublicSiteScreenshotRenderInput,
  type PublicSiteScreenshotRenderer,
} from "./screenshot";

describe("public site screenshots", () => {
  it("captures a real browser-rendered 1200 by 630 JPEG", async () => {
    const renderer = createPlaywrightPublicSiteScreenshotRenderer();
    const server = createServer((_request, response) => response.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const origin = typeof address === "object" && address
      ? `http://127.0.0.1:${address.port}`
      : "http://127.0.0.1";
    try {
      const image = await renderer.render({
        html: "<!doctype html><html><head></head><body><main>Literal site preview</main></body></html>",
        origin,
      });

      expect([...image.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      expect(readJpegDimensions(image)).toEqual({ width: 1200, height: 630 });
    } finally {
      await renderer.close?.();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 20_000);

  it("loads the Handout fallback before capturing a failed workspace logo", async () => {
    const requestedPaths: string[] = [];
    const renderer = createPlaywrightPublicSiteScreenshotRenderer();
    const server = createServer((request, response) => {
      requestedPaths.push(request.url ?? "");
      if (request.url === "/missing-workspace-logo.jpg") {
        response.statusCode = 404;
        response.end();
        return;
      }
      if (request.url === "/handout-logo-icon.svg") {
        response.setHeader("content-type", "image/svg+xml");
        response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>');
        return;
      }
      response.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const origin = typeof address === "object" && address
      ? `http://127.0.0.1:${address.port}`
      : "http://127.0.0.1";

    try {
      await renderer.render({
        html: '<!doctype html><html><head></head><body><main class="handout-site"><span class="handout-page-title-logo" data-handout-logo-kind="workspace"><img src="/missing-workspace-logo.jpg" alt="Acme logo"></span></main></body></html>',
        origin,
      });

      expect(requestedPaths).toContain("/missing-workspace-logo.jpg");
      expect(requestedPaths).toContain("/handout-logo-icon.svg");
    } finally {
      await renderer.close?.();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }, 20_000);

  it("renders canonical personalized HTML and caches immutable recipient revisions", async () => {
    const render = vi.fn(async (_input: PublicSiteScreenshotRenderInput) => Buffer.from("jpg"));
    const renderer: PublicSiteScreenshotRenderer = { render };
    const service = createPublicSiteScreenshotService(renderer);
    const payload = buildPayload();

    const first = await service.render({ origin: "https://handout.test", payload });
    const second = await service.render({ origin: "https://handout.test", payload });

    expect(first?.bytes.toString()).toBe("jpg");
    expect(second?.cacheKey).toBe(first?.cacheKey);
    expect(render).toHaveBeenCalledTimes(1);
    const renderedHtml = render.mock.calls[0]?.[0].html ?? "";
    expect(renderedHtml).toContain("Ada Lovelace");
    expect(renderedHtml).toContain("North Star");
    expect(renderedHtml).not.toContain("data-handout-tracking-v2");
  });

  it("coalesces concurrent requests for the same immutable recipient image", async () => {
    let finishRender: ((bytes: Buffer) => void) | undefined;
    const pendingRender = new Promise<Buffer>((resolve) => {
      finishRender = resolve;
    });
    const render = vi.fn(() => pendingRender);
    const service = createPublicSiteScreenshotService({ render });
    const payload = buildPayload();

    const requests = Array.from({ length: 20 }, () => service.render({
      origin: "https://handout.test",
      payload,
    }));

    expect(render).toHaveBeenCalledTimes(1);
    finishRender?.(Buffer.from("shared-jpg"));
    const results = await Promise.all(requests);

    expect(results.every((result) => result?.bytes.toString() === "shared-jpg")).toBe(true);
    expect(new Set(results.map((result) => result?.cacheKey)).size).toBe(1);
  });

  it("renders a new image when the recipient revision changes", async () => {
    const render = vi.fn(async (_input: PublicSiteScreenshotRenderInput) => Buffer.from("jpg"));
    const service = createPublicSiteScreenshotService({ render });
    const payload = buildPayload();

    await service.render({ origin: "https://handout.test", payload });
    payload.selectedVariant!.revisionNumber = 3;
    await service.render({ origin: "https://handout.test", payload });

    expect(render).toHaveBeenCalledTimes(2);
  });

  it("rejects loopback and private network addresses used by remote assets", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.0.0.4")).toBe(false);
    expect(isPublicIpAddress("192.168.1.4")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
  });
});

function buildPayload(): PublishedSitePayload {
  const content = createDefaultSiteContent("Rollout brief");
  content.pages[0]!.document = {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "variableToken", attrs: { variableId: "recipient-name", fallbackName: "Name" } },
        { type: "text", text: " at " },
        { type: "variableToken", attrs: { variableId: "recipient-company", fallbackName: "Company" } },
      ],
    }],
  };

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
      publishedAt: "2026-07-11T12:00:00.000Z",
    },
    metadata: {
      title: "Rollout brief",
      description: "A focused plan.",
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "north-star-ada",
      name: "Ada @ North Star",
      recipientName: "Ada Lovelace",
      recipientCompany: "North Star",
      revisionNumber: 2,
      variableValues: {
        "recipient-name": "Ada Lovelace",
        "recipient-company": "North Star",
      },
    },
    tracking: {
      version: 2,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: "44444444-4444-4444-8444-444444444444",
      recipientRevision: 2,
      trackingMode: "events",
    },
  };
}

function readJpegDimensions(image: Buffer) {
  const sizeMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;

  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = image[offset + 1];
    if (marker !== undefined && sizeMarkers.has(marker)) {
      return {
        height: image.readUInt16BE(offset + 5),
        width: image.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = image.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  throw new Error("JPEG dimensions were not found.");
}
