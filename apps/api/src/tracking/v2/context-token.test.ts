import { describe, expect, it } from "vitest";
import { createEncryptedTrackingV2ContextTokenService } from "./context-token";

const secret = "tracking-v2-context-token-secret-at-least-32-chars";
const issuedAt = new Date("2026-07-09T12:00:00.000Z");
const payload = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  publishedVersionId: "33333333-3333-4333-8333-333333333333",
  recipientId: "44444444-4444-4444-8444-444444444444",
  recipientRevision: 7,
  trackingMode: "events" as const,
};

function createService(now = issuedAt) {
  return createEncryptedTrackingV2ContextTokenService(secret, {
    keyId: "test-key",
    ttlSeconds: 60,
    now: () => now,
    randomBytes: (size) => Buffer.alloc(size, 7),
  });
}

describe("createEncryptedTrackingV2ContextTokenService", () => {
  it("issues a public bootstrap and verifies the encrypted token", () => {
    const service = createService();
    const bootstrap = service.issue(payload);

    expect(bootstrap).toEqual({
      version: 2,
      trackingMode: "events",
      contextToken: expect.stringMatching(/^lsv2\./),
      issuedAt: "2026-07-09T12:00:00.000Z",
      expiresAt: "2026-07-09T12:01:00.000Z",
    });
    expect(service.verify(bootstrap.contextToken)).toMatchObject({
      version: 2,
      keyId: "test-key",
      ...payload,
      issuedAt: "2026-07-09T12:00:00.000Z",
      expiresAt: "2026-07-09T12:01:00.000Z",
    });
  });

  it("keeps workspace, site, and recipient ids opaque to base64 decoding", () => {
    const service = createService();
    const bootstrap = service.issue(payload);
    const decodedSegments = bootstrap.contextToken
      .split(".")
      .map((segment) => Buffer.from(segment, "base64url").toString("utf8"))
      .join("\n");

    expect(decodedSegments).not.toContain(payload.workspaceId);
    expect(decodedSegments).not.toContain(payload.siteId);
    expect(decodedSegments).not.toContain(payload.recipientId);
  });

  it("rejects expired tokens", () => {
    const service = createService();
    const bootstrap = service.issue(payload);
    const expiredService = createService(new Date("2026-07-09T12:01:00.001Z"));

    expect(expiredService.verify(bootstrap.contextToken)).toBeNull();
  });

  it("rejects tampered ciphertext", () => {
    const service = createService();
    const bootstrap = service.issue(payload);
    const parts = bootstrap.contextToken.split(".");
    parts[3] = `${parts[3]!.slice(0, -1)}A`;

    expect(service.verify(parts.join("."))).toBeNull();
  });

  it("rejects tokens issued for another key id", () => {
    const service = createService();
    const bootstrap = service.issue(payload);
    const otherService = createEncryptedTrackingV2ContextTokenService(secret, {
      keyId: "other-key",
      now: () => issuedAt,
    });

    expect(otherService.verify(bootstrap.contextToken)).toBeNull();
  });
});
