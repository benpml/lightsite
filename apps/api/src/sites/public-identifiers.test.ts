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
  it("creates seven-character recipient links and twelve-character site ids", () => {
    expect(createRecipientShortCode()).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(createSitePublicId()).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("retries complete seven-character candidates", async () => {
    const attemptedLengths: number[] = [];
    const reserved = await allocateRecipientShortCode(async (candidate, attempt) => {
      attemptedLengths.push(candidate.length);
      return attempt === 4 ? candidate : null;
    });

    expect(attemptedLengths).toEqual([7, 7, 7, 7, 7]);
    expect(reserved).toHaveLength(7);
  });

  it("accepts legacy short codes while generating seven-character links", () => {
    expect(isRecipientShortCode("aZ7k2Q")).toBe(true);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp")).toBe(true);
    expect(isRecipientShortCode("aZ7k2")).toBe(false);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp12345")).toBe(false);
    expect(recipientShortCodeLengthForAttempt(0)).toBe(7);
    expect(recipientShortCodeLengthForAttempt(4)).toBe(7);
    expect(recipientShortCodeLengthForAttempt(40)).toBe(7);
    expect(recipientShortCodeLengthForAttempt(10_000)).toBe(7);
    expect(RECIPIENT_SHORT_CODE_GENERATED_LENGTH).toBe(7);
    expect(RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS).toBe(16);
  });
});
