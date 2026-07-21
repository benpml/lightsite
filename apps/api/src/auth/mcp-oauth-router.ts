import express, { Router, type Request } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../auth";
import type { BootstrapService } from "../bootstrap/service";
import { asyncHandler } from "../http/async-handler";
import { getCurrentActor, type CurrentActorProvider } from "./current-actor";
import { issueMcpAccessToken } from "./mcp-oauth-token";
import { McpOAuthError, type McpOAuthService } from "./mcp-oauth";

type BetterAuthSession = { session?: { token?: string } | null } | null;

export function createMcpOAuthRouter(options: {
  bootstrapService: BootstrapService;
  codeService: McpOAuthService;
  getCurrentActor?: CurrentActorProvider;
  issuer: string;
  secret: string;
  webOrigin: string;
}) {
  const router = Router();
  const issuer = options.issuer.replace(/\/$/, "");
  const webOrigin = options.webOrigin.replace(/\/$/, "");
  const actorProvider = options.getCurrentActor ?? getCurrentActor;
  router.use(express.urlencoded({ extended: false, limit: "32kb" }));

  router.get("/.well-known/oauth-authorization-server", (_request, response) => {
    response.setHeader("cache-control", "public, max-age=300").json(authorizationServerMetadata(issuer, webOrigin));
  });

  router.post("/register", asyncHandler(async (request, response) => {
    const body = asRecord(request.body);
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((value): value is string => typeof value === "string")
      : [];
    try {
      const { clientId, client } = options.codeService.registerClient({
        clientName: typeof body.client_name === "string" ? body.client_name : undefined,
        redirectUris,
      });
      response.status(201).setHeader("cache-control", "no-store").json({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      });
    } catch (error) {
      sendOAuthError(response, error, 400);
    }
  }));

  router.get("/authorize", asyncHandler(async (request, response) => {
    try {
      const oauth = parseAuthorizationRequest(request);
      const client = options.codeService.readClient(oauth.clientId);
      const requestToken = options.codeService.issueRequest(oauth);
      const actor = await actorProvider(request);
      if (!actor) {
        const returnTo = `${request.originalUrl}`;
        response.redirect(`${webOrigin}/auth?${new URLSearchParams({ returnTo }).toString()}`);
        return;
      }
      const bootstrap = await options.bootstrapService.getBootstrap(actor);
      if (!bootstrap.activeWorkspace) throw new McpOAuthError("access_denied", "Select or create a Handout workspace before connecting.");
      response.setHeader("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      response.setHeader("cache-control", "no-store").type("html").send(consentPage({
        actorEmail: actor.email,
        clientName: client.clientName,
        requestToken,
        workspaceName: bootstrap.activeWorkspace.name,
      }));
    } catch (error) {
      sendAuthorizationError(response, error, request.query.redirect_uri, request.query.state);
    }
  }));

  router.post("/authorize", asyncHandler(async (request, response) => {
    try {
      const body = asRecord(request.body);
      const requestToken = typeof body.request_token === "string" ? body.request_token : "";
      const oauthRequest = options.codeService.readRequest(requestToken);
      if (body.decision !== "allow") {
        redirectOAuth(response, oauthRequest.redirectUri, { error: "access_denied", error_description: "The user declined Handout access.", state: oauthRequest.state });
        return;
      }
      const actor = await actorProvider(request);
      if (!actor) {
        response.redirect(`${webOrigin}/auth?${new URLSearchParams({ returnTo: authorizationRequestPath(oauthRequest) }).toString()}`);
        return;
      }
      const [sessionToken, bootstrap] = await Promise.all([
        getSessionToken(request),
        options.bootstrapService.getBootstrap(actor),
      ]);
      if (!sessionToken || !bootstrap.activeWorkspace) throw new McpOAuthError("access_denied", "Handout session or workspace is unavailable.");
      const issued = options.codeService.issueCode({
        requestToken,
        actor,
        sessionToken,
        workspaceId: bootstrap.activeWorkspace.id,
      });
      redirectOAuth(response, issued.redirectUri, { code: issued.code, state: issued.state });
    } catch (error) {
      sendOAuthError(response, error, 400);
    }
  }));

  router.post("/token", asyncHandler(async (request, response) => {
    const body = asRecord(request.body);
    try {
      const clientId = requiredString(body.client_id, "invalid_client", "client_id is required.");
      const resource = requiredString(body.resource, "invalid_target", "resource is required.");
      options.codeService.readClient(clientId);
      let grant: {
        actor: { userId: string; email: string; name?: string };
        sessionToken: string;
        workspaceId: string;
      };
      let refreshToken: string;

      if (body.grant_type === "authorization_code") {
        const exchanged = options.codeService.exchangeCode({
          clientId,
          code: requiredString(body.code, "invalid_grant", "code is required."),
          codeVerifier: requiredString(body.code_verifier, "invalid_grant", "code_verifier is required."),
          redirectUri: requiredString(body.redirect_uri, "invalid_grant", "redirect_uri is required."),
          resource,
        });
        grant = exchanged.grant;
        refreshToken = exchanged.refreshToken;
      } else if (body.grant_type === "refresh_token") {
        refreshToken = requiredString(body.refresh_token, "invalid_grant", "refresh_token is required.");
        grant = options.codeService.exchangeRefresh({ clientId, refreshToken, resource });
      } else {
        throw new McpOAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
      }

      const workspace = await validateGrant(options.bootstrapService, grant);
      const access = issueMcpAccessToken({
        actor: grant.actor,
        issuer,
        resource,
        secret: options.secret,
        workspace: { id: workspace.id, plan: workspace.plan, role: workspace.role },
      });
      response.setHeader("cache-control", "no-store").json({
        access_token: access.accessToken,
        token_type: "Bearer",
        expires_in: access.expiresIn,
        refresh_token: refreshToken,
        scope: "handout:operate",
      });
    } catch (error) {
      sendOAuthError(response, error, 400);
    }
  }));

  return router;
}

export function authorizationServerMetadata(issuer: string, webOrigin = issuer) {
  const base = `${issuer.replace(/\/$/, "")}/api/mcp/oauth`;
  return {
    issuer,
    authorization_endpoint: `${webOrigin.replace(/\/$/, "")}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    token_endpoint_auth_methods_supported: ["none"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["handout:operate"],
  };
}

function parseAuthorizationRequest(request: Request) {
  const query = request.query;
  if (query.response_type !== "code" || query.code_challenge_method !== "S256") throw new McpOAuthError("unsupported_response_type", "Handout requires authorization code with S256 PKCE.");
  const scope = typeof query.scope === "string" ? query.scope : "handout:operate";
  if (!scope.split(/\s+/).includes("handout:operate")) throw new McpOAuthError("invalid_scope", "The handout:operate scope is required.");
  return {
    clientId: requiredString(query.client_id, "invalid_client", "client_id is required."),
    redirectUri: requiredString(query.redirect_uri, "invalid_request", "redirect_uri is required."),
    codeChallenge: requiredString(query.code_challenge, "invalid_request", "code_challenge is required."),
    resource: requiredString(query.resource, "invalid_target", "resource is required."),
    scope: "handout:operate" as const,
    ...(typeof query.state === "string" ? { state: query.state } : {}),
  };
}

function authorizationRequestPath(request: ReturnType<McpOAuthService["readRequest"]>) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    resource: request.resource,
    scope: request.scope,
  });
  if (request.state) params.set("state", request.state);
  return `/api/mcp/oauth/authorize?${params}`;
}

async function validateGrant(bootstrapService: BootstrapService, grant: {
  actor: { userId: string; email: string; name?: string };
  sessionToken: string;
  workspaceId: string;
}) {
  const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${grant.sessionToken}` }) });
  const user = (session as { user?: { id?: string } } | null)?.user;
  if (user?.id !== grant.actor.userId) throw new McpOAuthError("invalid_grant", "The Handout session has expired. Connect again.");
  const bootstrap = await bootstrapService.getBootstrap({ ...grant.actor, emailVerified: true });
  const workspace = bootstrap.workspaces.find((item) => item.id === grant.workspaceId);
  if (!workspace) throw new McpOAuthError("invalid_grant", "Workspace access has been revoked.");
  return workspace;
}

async function getSessionToken(request: Request) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) }) as BetterAuthSession;
  return session?.session?.token ?? null;
}

function consentPage(input: { actorEmail: string; clientName: string; requestToken: string; workspaceName: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Handout</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#171717;background:#fafafa}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(440px,100%);background:#fff;border:1px solid #e5e5e5;border-radius:18px;padding:28px;box-shadow:0 18px 50px #0000000d}h1{font-size:22px;margin:0 0 8px}p{color:#525252;line-height:1.5}.scope{background:#f5f5f5;border-radius:12px;padding:14px;margin:20px 0}.scope strong{display:block;margin-bottom:4px}.scope span{font-size:14px;color:#525252}.actions{display:flex;gap:10px;justify-content:flex-end}button{border:1px solid #d4d4d4;border-radius:10px;padding:10px 16px;background:#fff;font-weight:650;cursor:pointer}button[value=allow]{background:#171717;color:#fff;border-color:#171717}.fine{font-size:12px}</style></head><body><main class="card"><h1>Connect ${html(input.clientName)} to Handout</h1><p>Signed in as ${html(input.actorEmail)}. This connection will operate the <strong>${html(input.workspaceName)}</strong> workspace on your behalf.</p><div class="scope"><strong>Operate Handout</strong><span>Read and edit sites, create personalized recipient copies, publish when you approve, and read engagement analytics.</span></div><p class="fine">You can revoke the connection by ending your Handout sessions or removing it in your agent's MCP settings.</p><form method="post"><input type="hidden" name="request_token" value="${html(input.requestToken)}"><div class="actions"><button name="decision" value="deny">Cancel</button><button name="decision" value="allow">Connect</button></div></form></main></body></html>`;
}

function sendAuthorizationError(response: any, error: unknown, redirectUri: unknown, state: unknown) {
  if (typeof redirectUri === "string") {
    try { redirectOAuth(response, redirectUri, { error: error instanceof McpOAuthError ? error.code : "server_error", error_description: error instanceof Error ? error.message : "Authorization failed.", state: typeof state === "string" ? state : undefined }); return; } catch {}
  }
  sendOAuthError(response, error, 400);
}

function sendOAuthError(response: any, error: unknown, status: number) {
  const oauth = error instanceof McpOAuthError ? error : new McpOAuthError("server_error", error instanceof Error ? error.message : "OAuth request failed.");
  response.status(status).setHeader("cache-control", "no-store").json({ error: oauth.code, error_description: oauth.message });
}

function redirectOAuth(response: any, redirectUri: string, values: { code?: string; error?: string; error_description?: string; state?: string }) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  response.redirect(url.toString());
}

function requiredString(value: unknown, code: string, message: string) {
  if (typeof value !== "string" || !value) throw new McpOAuthError(code, message);
  return value;
}

function asRecord(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function html(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
