# Handout plugin

This package gives agents a shared Handout MCP connection plus focused skills for operating sites, building buyer experiences, personalizing recipient copies, and analyzing engagement.

## Contents

- `.codex-plugin/plugin.json` — Codex/OpenAI plugin metadata.
- `.claude-plugin/plugin.json` — Claude Code plugin metadata.
- `.mcp.json` — hosted Handout Streamable HTTP MCP connection.
- `skills/` — portable Agent Skills with references and templates.
- `assets/` — Handout plugin identity assets.

## Development install

Test the Claude package from this repository with:

```sh
claude --plugin-dir ./plugins/handout
```

For generic MCP clients, add this remote server:

```json
{
  "mcpServers": {
    "handout": {
      "type": "http",
      "url": "https://api.handout.link/mcp"
    }
  }
}
```

The client should discover OAuth metadata and request the `handout:operate` scope. The hosted endpoint must be deployed before remote installation works. Local developers can instead run the stdio server described in [packages/mcp/README.md](../../packages/mcp/README.md).

The OpenAI ChatGPT app uses the same MCP endpoint and its MCP Apps component. Create the real developer-mode app registration only after deploying the endpoint; then add the assigned `plugin_asdk_app_...` ID in `.app.json` and reference it from the Codex manifest. Do not commit a placeholder app ID.

See [docs/agent-platform.md](../../docs/agent-platform.md) for architecture, safety rules, tool inventory, deployment, review, and release checks.
