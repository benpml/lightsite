#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createHandoutMcpServer, handoutMcpOptionsFromEnv } from "./server";

const server = createHandoutMcpServer(handoutMcpOptionsFromEnv());
await server.connect(new StdioServerTransport());
