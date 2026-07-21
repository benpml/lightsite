import { describe, expect, it } from "vitest";

import { fetchSafeImage } from "./safe-image-fetch";

describe("safe image fetch", () => {
  it.each([
    "http://example.com/image.png",
    "https://localhost/image.png",
    "https://127.0.0.1/image.png",
    "https://[::1]/image.png",
    "https://user:password@example.com/image.png",
    "https://example.com:8443/image.png",
    "https://example.com/image.png#fragment",
  ])("rejects unsafe source %s before downloading", async (url) => {
    await expect(fetchSafeImage(url)).rejects.toThrow();
  });
});
