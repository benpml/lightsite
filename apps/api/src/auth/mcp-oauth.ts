import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CLIENT_LIFETIME_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const REQUEST_LIFETIME_MS = 10 * 60 * 1000;
const CODE_LIFETIME_MS = 2 * 60 * 1000;
const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

type OAuthClient = {
  kind: "client";
  clientName: string;
  redirectUris: string[];
  expiresAt: number;
};

type OAuthRequest = {
  kind: "request";
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  resource: string;
  scope: "handout:operate";
  state?: string;
  expiresAt: number;
};

type OAuthCode = Omit<OAuthRequest, "kind" | "state" | "expiresAt"> & {
  kind: "code";
  actor: { userId: string; email: string; name?: string };
  sessionToken: string;
  workspaceId: string;
  expiresAt: number;
};

type OAuthRefresh = Omit<OAuthCode, "kind" | "codeChallenge" | "redirectUri" | "expiresAt"> & {
  kind: "refresh";
  expiresAt: number;
};

export type McpOAuthService = ReturnType<typeof createMcpOAuthService>;

export class McpOAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "McpOAuthError";
  }
}

export function createMcpOAuthService(secret: string) {
  const key = createHash("sha256").update(`handout-mcp-oauth:${secret}`).digest();
  const usedCodes = new Map<string, number>();

  return {
    registerClient(input: { clientName?: string; redirectUris: string[]; now?: number }) {
      const redirectUris = [...new Set(input.redirectUris.map(validateRedirectUri))];
      if (!redirectUris.length || redirectUris.length > 10) throw new McpOAuthError("invalid_redirect_uri", "Provide one to ten valid redirect URIs.");
      const client: OAuthClient = {
        kind: "client",
        clientName: input.clientName?.trim().slice(0, 120) || "Handout MCP client",
        redirectUris,
        expiresAt: (input.now ?? Date.now()) + CLIENT_LIFETIME_MS,
      };
      return { clientId: `handout_${seal(client, key)}`, client };
    },

    readClient(clientId: string, now = Date.now()) {
      if (!clientId.startsWith("handout_")) throw new McpOAuthError("invalid_client", "Unknown OAuth client.");
      const client = open<OAuthClient>(clientId.slice("handout_".length), key);
      assertPayload(client, "client", now);
      return client;
    },

    issueRequest(input: Omit<OAuthRequest, "kind" | "expiresAt"> & { now?: number }) {
      const client = this.readClient(input.clientId, input.now);
      if (!client.redirectUris.includes(input.redirectUri)) throw new McpOAuthError("invalid_redirect_uri", "Redirect URI is not registered for this client.");
      if (!isValidResource(input.resource)) throw new McpOAuthError("invalid_target", "Invalid Handout MCP resource.");
      const { now, ...request } = input;
      return seal({ ...request, kind: "request", expiresAt: (now ?? Date.now()) + REQUEST_LIFETIME_MS } satisfies OAuthRequest, key);
    },

    readRequest(token: string, now = Date.now()) {
      const request = open<OAuthRequest>(token, key);
      assertPayload(request, "request", now);
      this.readClient(request.clientId, now);
      return request;
    },

    issueCode(input: {
      requestToken: string;
      actor: OAuthCode["actor"];
      sessionToken: string;
      workspaceId: string;
      now?: number;
    }) {
      const request = this.readRequest(input.requestToken, input.now);
      const code: OAuthCode = {
        kind: "code",
        clientId: request.clientId,
        codeChallenge: request.codeChallenge,
        redirectUri: request.redirectUri,
        resource: request.resource,
        scope: request.scope,
        actor: input.actor,
        sessionToken: input.sessionToken,
        workspaceId: input.workspaceId,
        expiresAt: (input.now ?? Date.now()) + CODE_LIFETIME_MS,
      };
      return { code: seal(code, key), redirectUri: request.redirectUri, state: request.state };
    },

    exchangeCode(input: { clientId: string; code: string; codeVerifier: string; redirectUri: string; resource: string; now?: number }) {
      pruneUsedCodes(usedCodes, input.now ?? Date.now());
      const codeHash = createHash("sha256").update(input.code).digest("base64url");
      if (usedCodes.has(codeHash)) throw new McpOAuthError("invalid_grant", "Authorization code was already used.");
      const code = open<OAuthCode>(input.code, key);
      assertPayload(code, "code", input.now ?? Date.now());
      if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri || code.resource !== input.resource) {
        throw new McpOAuthError("invalid_grant", "Authorization code does not match this request.");
      }
      const actualChallenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
      if (actualChallenge !== code.codeChallenge) throw new McpOAuthError("invalid_grant", "PKCE verification failed.");
      usedCodes.set(codeHash, code.expiresAt);
      const refresh: OAuthRefresh = {
        kind: "refresh", clientId: code.clientId, resource: code.resource, scope: code.scope,
        actor: code.actor, sessionToken: code.sessionToken, workspaceId: code.workspaceId,
        expiresAt: (input.now ?? Date.now()) + REFRESH_LIFETIME_MS,
      };
      return { grant: code, refreshToken: seal(refresh, key) };
    },

    exchangeRefresh(input: { clientId: string; refreshToken: string; resource: string; now?: number }) {
      const refresh = open<OAuthRefresh>(input.refreshToken, key);
      assertPayload(refresh, "refresh", input.now ?? Date.now());
      if (refresh.clientId !== input.clientId || refresh.resource !== input.resource) throw new McpOAuthError("invalid_grant", "Refresh token does not match this request.");
      return refresh;
    },
  };
}

function seal(value: unknown, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

function open<T>(value: string, key: Buffer): T {
  try {
    const encoded = Buffer.from(value, "base64url");
    if (encoded.length < 29) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, encoded.subarray(0, 12));
    decipher.setAuthTag(encoded.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(encoded.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    throw new McpOAuthError("invalid_grant", "OAuth credential is invalid or expired.");
  }
}

function assertPayload(value: { kind?: unknown; expiresAt?: unknown }, kind: string, now: number) {
  if (value.kind !== kind || typeof value.expiresAt !== "number" || value.expiresAt <= now) throw new McpOAuthError("invalid_grant", "OAuth credential is invalid or expired.");
}

function validateRedirectUri(value: string) {
  const url = new URL(value);
  const loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.hash || (url.protocol !== "https:" && !loopback)) throw new McpOAuthError("invalid_redirect_uri", "Redirect URIs must use HTTPS or a loopback HTTP address.");
  return url.toString();
}

function isValidResource(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.endsWith("/mcp") && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
}

function pruneUsedCodes(codes: Map<string, number>, now: number) {
  for (const [code, expiresAt] of codes) if (expiresAt <= now) codes.delete(code);
}
