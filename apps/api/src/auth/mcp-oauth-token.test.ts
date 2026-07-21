import { describe, expect, it } from "vitest";

import { issueMcpAccessToken, verifyMcpAccessToken } from "./mcp-oauth-token";

const NOW = Date.UTC(2026, 6, 21, 12, 0, 0);
const input = {
  actor: { userId: "user_123", email: "rep@example.com", name: "Sales Rep" },
  issuer: "https://api.handout.link",
  resource: "https://api.handout.link/mcp",
  secret: "test-secret-at-least-long-enough",
  workspace: { id: "workspace_123", plan: "pro" as const, role: "admin" as const },
  now: NOW,
};

describe("MCP access tokens", () => {
  it("issues and verifies a workspace-scoped token", () => {
    const issued = issueMcpAccessToken(input);
    const claims = verifyMcpAccessToken({
      token: issued.accessToken,
      issuer: input.issuer,
      resource: input.resource,
      secret: input.secret,
      now: NOW,
    });

    expect(issued.expiresIn).toBe(15 * 60);
    expect(claims).toMatchObject({
      sub: input.actor.userId,
      aud: input.resource,
      scope: "handout:operate",
      workspace: input.workspace,
    });
  });

  it("rejects the wrong audience, signature, and expired tokens", () => {
    const token = issueMcpAccessToken(input).accessToken;
    expect(verifyMcpAccessToken({ token, issuer: input.issuer, resource: "https://api.handout.link/other", secret: input.secret, now: NOW })).toBeNull();
    expect(verifyMcpAccessToken({ token, issuer: input.issuer, resource: input.resource, secret: "different-secret", now: NOW })).toBeNull();
    expect(verifyMcpAccessToken({ token, issuer: input.issuer, resource: input.resource, secret: input.secret, now: NOW + 16 * 60 * 1000 })).toBeNull();
  });
});
