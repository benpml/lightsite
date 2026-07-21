import { describe, expect, it } from "vitest";
import {
  RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS,
  allocateRecipientShortCode,
  createRecipientShortCode,
  createSitePublicId,
  isRecipientShortCode,
  recipientShortCodeLengthForAttempt,
} from "./public-identifiers";

describe("public identifiers", () => {
  it("creates six-character recipient codes and twelve-character site ids", () => {
    expect(createRecipientShortCode()).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(createSitePublicId()).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("retries each compact length four times before growing", async () => {
    const attemptedLengths: number[] = [];
    const reserved = await allocateRecipientShortCode(async (candidate, attempt) => {
      attemptedLengths.push(candidate.length);
      return attempt === 4 ? candidate : null;
    });

    expect(attemptedLengths).toEqual([6, 6, 6, 6, 7]);
    expect(reserved).toHaveLength(7);
  });

  it("accepts current and legacy short codes while bounding future growth", () => {
    expect(isRecipientShortCode("aZ7k2Q")).toBe(true);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp")).toBe(true);
    expect(isRecipientShortCode("aZ7k2")).toBe(false);
    expect(isRecipientShortCode("aZ7k2Qr9LmNp12345")).toBe(false);
    expect(recipientShortCodeLengthForAttempt(0)).toBe(6);
    expect(recipientShortCodeLengthForAttempt(4)).toBe(7);
    expect(recipientShortCodeLengthForAttempt(40)).toBe(16);
    expect(recipientShortCodeLengthForAttempt(10_000)).toBe(16);
    expect(RECIPIENT_SHORT_CODE_MAX_ALLOCATION_ATTEMPTS).toBe(44);
  });
});
