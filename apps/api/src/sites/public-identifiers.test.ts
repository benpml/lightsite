import { describe, expect, it } from "vitest";
import {
  RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS,
  RECIPIENT_SHORT_CODE_GENERATED_LENGTH,
  allocateRecipientShortCode,
  createRecipientShortCode,
  createSitePublicId,
  isRecipientShortCode,
  recipientShortCodeLengthForAttempt,
} from "./public-identifiers";

describe("public identifiers", () => {
  it("creates 96-bit recipient capabilities and twelve-character site ids", () => {
    expect(createRecipientShortCode()).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(createSitePublicId()).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("retries complete 96-bit candidates without reducing entropy", async () => {
    const attemptedLengths: number[] = [];
    const reserved = await allocateRecipientShortCode(async (candidate, attempt) => {
      attemptedLengths.push(candidate.length);
      return attempt === 4 ? candidate : null;
    });

    expect(attemptedLengths).toEqual([16, 16, 16, 16, 16]);
    expect(reserved).toHaveLength(16);
  });

  it("accepts legacy short codes while generating only full-strength capabilities", () => {
    expect(isRecipientShortCode("aZ7k2Q")).toBe(true);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp")).toBe(true);
    expect(isRecipientShortCode("aZ7k2")).toBe(false);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp12345")).toBe(false);
    expect(recipientShortCodeLengthForAttempt(0)).toBe(16);
    expect(recipientShortCodeLengthForAttempt(4)).toBe(16);
    expect(recipientShortCodeLengthForAttempt(40)).toBe(16);
    expect(recipientShortCodeLengthForAttempt(10_000)).toBe(16);
    expect(RECIPIENT_SHORT_CODE_GENERATED_LENGTH).toBe(16);
    expect(RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS).toBe(16);
  });
});
