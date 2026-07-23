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
  const parsedBody = (request as IncomingMessage & { body?: unknown }).body;
  if (parsedBody !== undefined && !isBoundedJsonEnvelope(parsedBody)) {
    response.writeHead(413, {
      "cache-control": "no-store",
      "content-type": "application/json",
    }).end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32600, message: "MCP request content is too deeply nested or complex." },
      id: null,
    }));
    return;
  }

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
    await transport.handleRequest(
      request,
      response,
      parsedBody,
    );
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

function isBoundedJsonEnvelope(value: unknown) {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }];
  let visitedValues = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    visitedValues += 1;
    if (current.depth > 128 || visitedValues > 500_000) return false;
    if (!current.value || typeof current.value !== "object") continue;
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value);
    for (const child of children) {
      stack.push({ depth: current.depth + 1, value: child });
    }
  }
  return true;
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
