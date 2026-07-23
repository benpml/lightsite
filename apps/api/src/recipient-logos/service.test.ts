import { describe, expect, it } from "vitest";

import type { WorkspaceLogoPreviewService } from "../workspaces/logo-preview";
import { createMemoryRecipientLogoRepository } from "./repository";
import { createRecipientLogoService } from "./service";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("recipient logo service", () => {
  it("normalizes, persists, and reuses a fetched recipient logo", async () => {
    let fetchCount = 0;
    const service = createRecipientLogoService(
      createMemoryRecipientLogoRepository(),
      createPreviewService(async (input) => {
        fetchCount += 1;
        expect(input).toEqual({
          domain: "linear.app",
          size: 128,
          theme: "dark",
        });
        return {
          body: ONE_PIXEL_PNG,
          cacheControl: "private, max-age=60",
          contentType: "image/png",
        };
      }),
    );

    const first = await service.getOrFetch({
      domain: "https://www.Linear.app/pricing",
      theme: "dark",
      workspaceId: "workspace-1",
    });
    const second = await service.getOrFetch({
      domain: "linear.app",
      theme: "dark",
      workspaceId: "workspace-1",
    });

    expect(first).toMatchObject({
      contentType: "image/png",
      domain: "linear.app",
      height: 1,
      theme: "dark",
      width: 1,
      workspaceId: "workspace-1",
    });
    expect(second?.id).toBe(first?.id);
    expect(second?.content.equals(ONE_PIXEL_PNG)).toBe(true);
    expect(fetchCount).toBe(1);
  });

  it("coalesces simultaneous first fetches", async () => {
    let fetchCount = 0;
    const service = createRecipientLogoService(
      createMemoryRecipientLogoRepository(),
      createPreviewService(async () => {
        fetchCount += 1;
        await Promise.resolve();
        return {
          body: ONE_PIXEL_PNG,
          cacheControl: "private, max-age=60",
          contentType: "image/png",
        };
      }),
    );
    const input = {
      domain: "linear.app",
      theme: "light" as const,
      workspaceId: "workspace-1",
    };

    const [first, second] = await Promise.all([
      service.getOrFetch(input),
      service.getOrFetch(input),
    ]);

    expect(first?.id).toBe(second?.id);
    expect(fetchCount).toBe(1);
  });

  it("does not persist malformed provider responses", async () => {
    const service = createRecipientLogoService(
      createMemoryRecipientLogoRepository(),
      createPreviewService(async () => ({
        body: Uint8Array.from([1, 2, 3]),
        cacheControl: "private, max-age=60",
        contentType: "image/png",
      })),
    );

    await expect(service.getOrFetch({
      domain: "linear.app",
      theme: "light",
      workspaceId: "workspace-1",
    })).resolves.toBeNull();
  });
});

function createPreviewService(
  fetchImage: WorkspaceLogoPreviewService["fetchImage"],
): WorkspaceLogoPreviewService {
  return {
    fetchImage,
    async getPreview() {
      throw new Error("Recipient logos must use the image fetch path.");
    },
  };
}
