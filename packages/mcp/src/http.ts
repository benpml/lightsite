#!/usr/bin/env node
import { createServer } from "node:http";

import { handleRemoteMcpRequest, protectedResourceMetadata } from "./remote";

const port = Number(process.env.PORT ?? 8787);
const publicOrigin = (process.env.HANDOUT_MCP_PUBLIC_ORIGIN ?? `http://localhost:${port}`).replace(/\/$/, "");
const authorizationServer = (process.env.HANDOUT_AUTHORIZATION_SERVER ?? "http://localhost:5173").replace(/\/$/, "");

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", publicOrigin);
  if (request.method === "GET" && ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"].includes(url.pathname)) {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "public, max-age=300" }).end(JSON.stringify(protectedResourceMetadata({
      authorizationServer,
      resource: `${publicOrigin}/mcp`,
    })));
    return;
  }
  if (url.pathname !== "/mcp") {
    response.writeHead(url.pathname === "/" ? 200 : 404, { "content-type": "text/plain" }).end(url.pathname === "/" ? "Handout MCP server" : "Not found");
    return;
  }
  await handleRemoteMcpRequest(request, response, {
    apiBaseUrl: process.env.HANDOUT_API_BASE_URL ?? "http://localhost:3011",
    protectedResourceMetadataUrl: `${publicOrigin}/.well-known/oauth-protected-resource/mcp`,
    publicSiteOrigin: process.env.HANDOUT_PUBLIC_SITE_ORIGIN ?? "https://handout.link",
    webOrigin: process.env.HANDOUT_WEB_ORIGIN ?? authorizationServer,
  });
}).listen(port, () => {
  process.stderr.write(`Handout MCP listening on ${publicOrigin}/mcp\n`);
});
