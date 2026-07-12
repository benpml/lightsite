import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  trackingV2ContextTokenPayloadSchema,
  type TrackingV2ContextTokenPayload,
  type TrackingV2PublicBootstrap,
  type TrackingV2TrackingMode,
} from "@lightsite/tracking-schema";

export type TrackingV2ContextTokenIssueInput = {
  workspaceId: string;
  siteId: string;
  publishedVersionId: string;
  recipientId: string | null;
  recipientRevision: number | null;
  trackingMode: TrackingV2TrackingMode;
};

export interface TrackingV2ContextTokenService {
  issue(input: TrackingV2ContextTokenIssueInput): TrackingV2PublicBootstrap;
  verify(contextToken: string): TrackingV2ContextTokenPayload | null;
}

export type TrackingV2ContextTokenServiceOptions = {
  keyId?: string;
  ttlSeconds?: number;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

const TOKEN_PREFIX = "lsv2";
const DEFAULT_KEY_ID = "default";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function createEncryptedTrackingV2ContextTokenService(
  secret: string,
  options: TrackingV2ContextTokenServiceOptions = {},
): TrackingV2ContextTokenService {
  assertTokenSecret(secret);

  const keyId = options.keyId ?? DEFAULT_KEY_ID;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = options.now ?? (() => new Date());
  const getRandomBytes = options.randomBytes ?? randomBytes;
  const encryptionKey = deriveEncryptionKey(secret, keyId);

  return {
    issue(input) {
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
      const payload: TrackingV2ContextTokenPayload = {
        version: 2,
        keyId,
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        publishedVersionId: input.publishedVersionId,
        recipientId: input.recipientId,
        recipientRevision: input.recipientRevision,
        trackingMode: input.trackingMode,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      const parsedPayload = trackingV2ContextTokenPayloadSchema.parse(payload);
      const iv = getRandomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      cipher.setAAD(Buffer.from(`${TOKEN_PREFIX}.${keyId}`, "utf8"));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(parsedPayload), "utf8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const contextToken = [
        TOKEN_PREFIX,
        encodeBase64Url(keyId),
        iv.toString("base64url"),
        encrypted.toString("base64url"),
        authTag.toString("base64url"),
      ].join(".");

      return {
        version: 2,
        trackingMode: input.trackingMode,
        contextToken,
        issuedAt: parsedPayload.issuedAt,
        expiresAt: parsedPayload.expiresAt,
      };
    },

    verify(contextToken) {
      const [prefix, encodedKeyId, encodedIv, encodedCiphertext, encodedAuthTag, extra] =
        contextToken.split(".");

      if (
        prefix !== TOKEN_PREFIX ||
        !encodedKeyId ||
        !encodedIv ||
        !encodedCiphertext ||
        !encodedAuthTag ||
        extra !== undefined
      ) {
        return null;
      }

      const tokenKeyId = decodeBase64UrlToString(encodedKeyId);
      if (!tokenKeyId || !constantTimeEqual(tokenKeyId, keyId)) {
        return null;
      }

      try {
        const iv = Buffer.from(encodedIv, "base64url");
        const ciphertext = Buffer.from(encodedCiphertext, "base64url");
        const authTag = Buffer.from(encodedAuthTag, "base64url");

        if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
          return null;
        }

        const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv, {
          authTagLength: AUTH_TAG_BYTES,
        });
        decipher.setAAD(Buffer.from(`${TOKEN_PREFIX}.${keyId}`, "utf8"));
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        const parsed = trackingV2ContextTokenPayloadSchema.safeParse(
          JSON.parse(decrypted.toString("utf8")),
        );

        if (!parsed.success || parsed.data.keyId !== keyId) {
          return null;
        }

        if (Date.parse(parsed.data.expiresAt) <= now().getTime()) {
          return null;
        }

        return parsed.data;
      } catch {
        return null;
      }
    },
  };
}

function deriveEncryptionKey(secret: string, keyId: string) {
  return createHash("sha256")
    .update("lightsite:tracking-v2-context-token")
    .update("\0")
    .update(keyId)
    .update("\0")
    .update(secret)
    .digest();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64UrlToString(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertTokenSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("Tracking v2 context token secret must be at least 32 characters.");
  }
}
