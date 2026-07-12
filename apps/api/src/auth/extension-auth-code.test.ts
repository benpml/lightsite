import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createExtensionAuthCodeService,
  ExtensionAuthCodeError,
} from "./extension-auth-code";

const service = createExtensionAuthCodeService("extension-auth-test-secret-that-is-long-enough");
const verifier = "test-verifier-that-is-at-least-forty-three-characters-long";
const codeChallenge = createHash("sha256").update(verifier).digest("base64url");

describe("extension auth codes", () => {
  it("exchanges a PKCE-bound session code", () => {
    const code = service.issue({
      codeChallenge,
      development: false,
      sessionToken: "better-auth-session-token",
      now: 1_000,
    });

    expect(service.exchange({ code, verifier, now: 2_000 })).toEqual({
      development: false,
      token: "better-auth-session-token",
    });
    expect(code).not.toContain("better-auth-session-token");
  });

  it("supports local development without issuing a fake production token", () => {
    const code = service.issue({
      codeChallenge,
      development: true,
      sessionToken: null,
      now: 1_000,
    });

    expect(service.exchange({ code, verifier, now: 2_000 })).toEqual({
      development: true,
      token: null,
    });
  });

  it("rejects the wrong verifier and expired codes", () => {
    const code = service.issue({
      codeChallenge,
      development: false,
      sessionToken: "session-token",
      now: 1_000,
    });

    expect(() => service.exchange({
      code,
      verifier: "wrong-verifier-that-is-at-least-forty-three-characters-long",
      now: 2_000,
    })).toThrow(ExtensionAuthCodeError);
    expect(() => service.exchange({ code, verifier, now: 100_000 })).toThrow(
      ExtensionAuthCodeError,
    );
  });
});
