import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_VERSION = 1;
const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

export type McpAccessTokenClaims = {
  version: typeof ACCESS_TOKEN_VERSION;
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name?: string;
  workspace: {
    id: string;
    plan: "free" | "core" | "pro";
    role: "admin" | "user";
  };
  scope: "handout:operate";
  iat: number;
  exp: number;
  jti: string;
};

export function issueMcpAccessToken(input: {
  actor: { userId: string; email: string; name?: string };
  issuer: string;
  resource: string;
  secret: string;
  workspace: McpAccessTokenClaims["workspace"];
  now?: number;
}) {
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const claims: McpAccessTokenClaims = {
    version: ACCESS_TOKEN_VERSION,
    iss: input.issuer.replace(/\/$/, ""),
    aud: input.resource,
    sub: input.actor.userId,
    email: input.actor.email,
    ...(input.actor.name ? { name: input.actor.name } : {}),
    workspace: input.workspace,
    scope: "handout:operate",
    iat: now,
    exp: now + ACCESS_TOKEN_LIFETIME_SECONDS,
    jti: randomUUID(),
  };
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const signature = sign(`${header}.${payload}`, input.secret);
  return {
    accessToken: `${header}.${payload}.${signature}`,
    expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
  };
}

export function verifyMcpAccessToken(input: {
  token: string;
  issuer: string;
  resource: string;
  secret: string;
  now?: number;
}): McpAccessTokenClaims | null {
  try {
    const [header, payload, signature, extra] = input.token.split(".");
    if (!header || !payload || !signature || extra) return null;
    const expected = sign(`${header}.${payload}`, input.secret);
    if (!secureEquals(signature, expected)) return null;
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Record<string, unknown>;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<McpAccessTokenClaims>;
    const now = Math.floor((input.now ?? Date.now()) / 1000);
    if (
      parsedHeader.alg !== "HS256" ||
      claims.version !== ACCESS_TOKEN_VERSION ||
      claims.iss !== input.issuer.replace(/\/$/, "") ||
      claims.aud !== input.resource ||
      claims.scope !== "handout:operate" ||
      typeof claims.sub !== "string" ||
      typeof claims.email !== "string" ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      claims.iat > now + 60 ||
      claims.exp <= now ||
      !claims.workspace ||
      typeof claims.workspace.id !== "string" ||
      !["free", "core", "pro"].includes(claims.workspace.plan ?? "") ||
      !["admin", "user"].includes(claims.workspace.role ?? "")
    ) return null;
    return claims as McpAccessTokenClaims;
  } catch {
    return null;
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
