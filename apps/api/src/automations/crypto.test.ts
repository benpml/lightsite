import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWebhookSignature, decryptAutomationValue, encryptAutomationValue, parseAutomationEncryptionKey, verifyWebhookSignature } from "./crypto";

describe("automation cryptography", () => {
  it("round trips values only with the matching associated data", () => {
    const key = randomBytes(32);
    const encrypted = encryptAutomationValue("https://hooks.example.com/private", key, "workspace:a");
    expect(encrypted.ciphertext).not.toContain("hooks.example.com");
    expect(decryptAutomationValue(encrypted, key, "workspace:a")).toBe("https://hooks.example.com/private");
    expect(() => decryptAutomationValue(encrypted, key, "workspace:b")).toThrow();
  });

  it("parses base64 and hex keys and rejects weak lengths", () => {
    const key = randomBytes(32);
    expect(parseAutomationEncryptionKey(key.toString("base64"))).toEqual(key);
    expect(parseAutomationEncryptionKey(key.toString("hex"))).toEqual(key);
    expect(() => parseAutomationEncryptionKey("too-short")).toThrow();
    expect(() => parseAutomationEncryptionKey(`${key.toString("base64")}!`)).toThrow();
  });

  it("signs the exact id, timestamp, and body", () => {
    const input = { id: "evt_1", timestamp: 1_753_100_000, body: "{\"ok\":true}", secret: `whsec_${randomBytes(32).toString("base64")}` };
    const signature = createWebhookSignature(input);
    expect(verifyWebhookSignature({ ...input, signature })).toBe(true);
    expect(verifyWebhookSignature({ ...input, body: "{\"ok\":false}", signature })).toBe(false);
  });
});
