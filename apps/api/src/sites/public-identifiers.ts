import { randomBytes } from "node:crypto";

const PUBLIC_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const SITE_PUBLIC_ID_LENGTH = 12;
export const RECIPIENT_SHORT_CODE_MIN_LENGTH = 6;
export const RECIPIENT_SHORT_CODE_MAX_LENGTH = 16;
export const RECIPIENT_SHORT_CODE_GENERATED_LENGTH = 7;
export const RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS = 16;

export function createSitePublicId() {
  return createPublicCode(SITE_PUBLIC_ID_LENGTH);
}

export function createRecipientShortCode(_attempt = 0) {
  return createPublicCode(RECIPIENT_SHORT_CODE_GENERATED_LENGTH);
}

export function recipientShortCodeLengthForAttempt(_attempt: number) {
  return RECIPIENT_SHORT_CODE_GENERATED_LENGTH;
}

export function isRecipientShortCode(value: string) {
  return value.length >= RECIPIENT_SHORT_CODE_MIN_LENGTH
    && value.length <= RECIPIENT_SHORT_CODE_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value);
}

export async function allocateRecipientShortCode<T>(
  tryReserve: (candidate: string, attempt: number) => Promise<T | null>,
) {
  for (let attempt = 0; attempt < RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const reserved = await tryReserve(createRecipientShortCode(attempt), attempt);
    if (reserved !== null) return reserved;
  }

  throw new Error("Recipient short code allocation exhausted.");
}

export function isPublicCode(value: string, length: number) {
  return value.length === length && /^[A-Za-z0-9_-]+$/.test(value);
}

function createPublicCode(length: number) {
  let value = "";
  const unbiasedByteLimit = 256 - (256 % PUBLIC_CODE_ALPHABET.length);

  while (value.length < length) {
    const bytes = randomBytes(length - value.length + 2);
    for (const byte of bytes) {
      if (byte >= unbiasedByteLimit) continue;
      value += PUBLIC_CODE_ALPHABET[byte % PUBLIC_CODE_ALPHABET.length];
      if (value.length === length) break;
    }
  }

  return value;
}
