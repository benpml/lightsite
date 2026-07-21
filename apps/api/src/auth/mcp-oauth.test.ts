import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createMcpOAuthService, McpOAuthError } from "./mcp-oauth";

const NOW = Date.UTC(2026, 6, 21, 12, 0, 0);
const REDIRECT_URI = "https://chatgpt.com/connector/oauth/callback";
const RESOURCE = "https://api.handout.link/mcp";
const VERIFIER = "a-secure-pkce-verifier-with-sufficient-entropy-123456";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

function createGrant() {
  const service = createMcpOAuthService("test-secret-at-least-long-enough");
  const { clientId } = service.registerClient({ clientName: "ChatGPT", redirectUris: [REDIRECT_URI], now: NOW });
  const requestToken = service.issueRequest({
    clientId,
    codeChallenge: CHALLENGE,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    scope: "handout:operate",
    state: "state-123",
    now: NOW,
  });
  const issued = service.issueCode({
    requestToken,
    actor: { userId: "user_123", email: "rep@example.com" },
    sessionToken: "session-token",
    workspaceId: "workspace_123",
    now: NOW,
  });
  return { service, clientId, issued };
}

describe("MCP OAuth grants", () => {
  it("registers a client and exchanges an S256 authorization code", () => {
    const { service, clientId, issued } = createGrant();
    expect(issued.state).toBe("state-123");

    const exchanged = service.exchangeCode({
      clientId,
      code: issued.code,
      codeVerifier: VERIFIER,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      now: NOW,
    });

    expect(exchanged.grant).toMatchObject({
      workspaceId: "workspace_123",
      resource: RESOURCE,
      scope: "handout:operate",
    });
    expect(service.exchangeRefresh({ clientId, refreshToken: exchanged.refreshToken, resource: RESOURCE, now: NOW })).toMatchObject({
      workspaceId: "workspace_123",
    });
  });

  it("rejects a bad verifier and authorization-code replay", () => {
    const { service, clientId, issued } = createGrant();
    const exchange = (codeVerifier: string) => service.exchangeCode({
      clientId,
      code: issued.code,
      codeVerifier,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      now: NOW,
    });

    expect(() => exchange("wrong-verifier")).toThrowError(McpOAuthError);
    exchange(VERIFIER);
    expect(() => exchange(VERIFIER)).toThrow(/already used/);
  });

  it("rejects unregistered redirects and non-MCP resources", () => {
    const service = createMcpOAuthService("test-secret-at-least-long-enough");
    const { clientId } = service.registerClient({ redirectUris: [REDIRECT_URI], now: NOW });

    expect(() => service.issueRequest({ clientId, codeChallenge: CHALLENGE, redirectUri: "https://evil.example/callback", resource: RESOURCE, scope: "handout:operate", now: NOW })).toThrow(/not registered/);
    expect(() => service.issueRequest({ clientId, codeChallenge: CHALLENGE, redirectUri: REDIRECT_URI, resource: "https://api.handout.link/api", scope: "handout:operate", now: NOW })).toThrow(/Invalid Handout MCP resource/);
  });
});
