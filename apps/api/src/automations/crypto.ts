import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type EncryptedValue = { ciphertext: string; nonce: string };

export function parseAutomationEncryptionKey(value: string) {
  const isHex = /^[a-f\d]{64}$/i.test(value);
  const isCanonicalBase64 = /^[A-Za-z\d+/]{43}=$/.test(value);
  if (!isHex && !isCanonicalBase64) {
    throw new Error("AUTOMATIONS_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or 64 hex characters).");
  }
  const decoded = Buffer.from(value, isHex ? "hex" : "base64");
  if (decoded.byteLength !== 32) {
    throw new Error("AUTOMATIONS_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or 64 hex characters).");
  }
  return decoded;
}

export function encryptAutomationValue(value: string, key: Buffer, associatedData: string): EncryptedValue {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decryptAutomationValue(value: EncryptedValue, key: Buffer, associatedData: string) {
  const packed = Buffer.from(value.ciphertext, "base64");
  if (packed.byteLength < 17) throw new Error("Encrypted automation value is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonce, "base64"));
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(packed.subarray(packed.byteLength - 16));
  return Buffer.concat([
    decipher.update(packed.subarray(0, packed.byteLength - 16)),
    decipher.final(),
  ]).toString("utf8");
}

export function createAutomationSigningSecret() {
  return `whsec_${randomBytes(32).toString("base64")}`;
}

export function createWebhookSignature(input: { id: string; timestamp: number; body: string; secret: string }) {
  const secretBytes = input.secret.startsWith("whsec_")
    ? Buffer.from(input.secret.slice(6), "base64")
    : Buffer.from(input.secret, "utf8");
  const digest = createHmac("sha256", secretBytes)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");
  return `v1,${digest}`;
}

export function verifyWebhookSignature(input: {
  id: string;
  timestamp: number;
  body: string;
  secret: string;
  signature: string;
}) {
  const expected = Buffer.from(createWebhookSignature(input));
  const actual = Buffer.from(input.signature);
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
}

export function automationAssociatedData(workspaceId: string, automationId: string, revisionId: string, field: "endpoint" | "secret") {
  return `handout:webhook-automation:v1:${workspaceId}:${automationId}:${revisionId}:${field}`;
}
