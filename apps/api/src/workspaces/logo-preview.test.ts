import { describe, expect, it } from "vitest";

import { createLogoDevPreviewService } from "./logo-preview";

describe("Logo.dev preview service", () => {
  it("requests a 404 when Logo.dev has no real logo", async () => {
    const requestedUrls: string[] = [];
    const fetchImplementation = (async (input: Parameters<typeof fetch>[0]) => {
      requestedUrls.push(String(input));
      return new Response(
        Uint8Array.from([1, 2, 3]),
        { headers: { "content-type": "image/webp" }, status: 200 },
      );
    }) as typeof fetch;
    const service = createLogoDevPreviewService(
      "secret_logo_token",
      fetchImplementation,
    );

    await service.fetchImage({ domain: "acme.com", size: 64, theme: "light" });

    const requestedUrl = new URL(requestedUrls[0]!);
    expect(requestedUrl.origin).toBe("https://img.logo.dev");
    expect(requestedUrl.pathname).toBe("/acme.com");
    expect(requestedUrl.searchParams.get("fallback")).toBe("404");
  });

  it("returns null for a missing Logo.dev image", async () => {
    const service = createLogoDevPreviewService(
      "secret_logo_token",
      (async () => new Response(null, { status: 404 })) as typeof fetch,
    );

    await expect(service.fetchImage({
      domain: "missing-logo-test.com",
      size: 64,
      theme: "dark",
    })).resolves.toBeNull();
  });
});
