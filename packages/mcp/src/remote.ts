import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createHandoutMcpServer, type HandoutMcpOptions } from "./server";

export type RemoteMcpOptions = Omit<HandoutMcpOptions, "authorization" | "authMode"> & {
  protectedResourceMetadataUrl: string;
};

export function protectedResourceMetadata(input: {
  authorizationServer: string;
  resource: string;
}) {
  return {
    resource: input.resource,
    authorization_servers: [input.authorizationServer.replace(/\/$/, "")],
    scopes_supported: ["handout:operate"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://app.handout.link/settings",
  };
}

export async function handleRemoteMcpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: RemoteMcpOptions,
) {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const authorization = normalizeAuthorization(request.headers.authorization);

  const server = createHandoutMcpServer({
    ...options,
    ...(authorization ? { authorization } : {}),
    authMode: "oauth",
    protectedResourceMetadataUrl: options.protectedResourceMetadataUrl,
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const close = () => {
    void transport.close();
    void server.close();
  };
  response.once("close", close);

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Handout could not process the MCP request." },
        id: null,
      }));
    }
  }
}

function normalizeAuthorization(value: string | string[] | undefined) {
  const authorization = Array.isArray(value) ? value[0] : value;
  return authorization?.startsWith("Bearer ") ? authorization : null;
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-protocol-version, mcp-session-id");
  response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
}
