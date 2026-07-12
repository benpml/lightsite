import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const AUTH_CODE_VERSION = 1;
const AUTH_CODE_LIFETIME_MS = 90_000;

type ExtensionAuthCodePayload = {
  version: typeof AUTH_CODE_VERSION;
  authMode: "development" | "session";
  codeChallenge: string;
  expiresAt: number;
  sessionToken: string | null;
};

export type ExtensionAuthCodeService = {
  issue(input: {
    codeChallenge: string;
    development: boolean;
    sessionToken: string | null;
    now?: number;
  }): string;
  exchange(input: {
    code: string;
    verifier: string;
    now?: number;
  }): {
    development: boolean;
    token: string | null;
  };
};

export class ExtensionAuthCodeError extends Error {
  constructor() {
    super("The Lightsite connection expired or is invalid.");
    this.name = "ExtensionAuthCodeError";
  }
}

export function createExtensionAuthCodeService(secret: string): ExtensionAuthCodeService {
  const encryptionKey = createHash("sha256").update(secret).digest();

  return {
    issue(input) {
      if (input.development === Boolean(input.sessionToken)) {
        throw new Error("Extension auth code requires exactly one authentication mode.");
      }

      const payload: ExtensionAuthCodePayload = {
        version: AUTH_CODE_VERSION,
        authMode: input.development ? "development" : "session",
        codeChallenge: input.codeChallenge,
        expiresAt: (input.now ?? Date.now()) + AUTH_CODE_LIFETIME_MS,
        sessionToken: input.sessionToken,
      };
      const initializationVector = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, initializationVector);
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
      ]);
      const authenticationTag = cipher.getAuthTag();

      return Buffer.concat([initializationVector, authenticationTag, ciphertext]).toString("base64url");
    },

    exchange(input) {
      try {
        const encoded = Buffer.from(input.code, "base64url");
        if (encoded.length < 29) throw new ExtensionAuthCodeError();
        const initializationVector = encoded.subarray(0, 12);
        const authenticationTag = encoded.subarray(12, 28);
        const ciphertext = encoded.subarray(28);
        const decipher = createDecipheriv("aes-256-gcm", encryptionKey, initializationVector);
        decipher.setAuthTag(authenticationTag);
        const payload = JSON.parse(Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]).toString("utf8")) as Partial<ExtensionAuthCodePayload>;

        if (
          payload.version !== AUTH_CODE_VERSION ||
          (payload.authMode !== "development" && payload.authMode !== "session") ||
          typeof payload.codeChallenge !== "string" ||
          typeof payload.expiresAt !== "number" ||
          payload.expiresAt < (input.now ?? Date.now()) ||
          (payload.authMode === "session" && typeof payload.sessionToken !== "string") ||
          (payload.authMode === "development" && payload.sessionToken !== null)
        ) {
          throw new ExtensionAuthCodeError();
        }

        const actualChallenge = createHash("sha256").update(input.verifier).digest("base64url");
        const expectedChallenge = payload.codeChallenge;
        const actualBuffer = Buffer.from(actualChallenge);
        const expectedBuffer = Buffer.from(expectedChallenge);
        if (
          actualBuffer.length !== expectedBuffer.length ||
          !timingSafeEqual(actualBuffer, expectedBuffer)
        ) {
          throw new ExtensionAuthCodeError();
        }

        return {
          development: payload.authMode === "development",
          token: payload.authMode === "session" ? payload.sessionToken! : null,
        };
      } catch (error) {
        if (error instanceof ExtensionAuthCodeError) throw error;
        throw new ExtensionAuthCodeError();
      }
    },
  };
}
