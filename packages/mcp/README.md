# Lightsite MCP

JSON-first MCP tools for creating, editing, publishing, personalizing, and inspecting Lightsite sites.

## Local Development

```sh
LIGHTSITE_API_BASE_URL=http://localhost:3011 \
LIGHTSITE_DEV_AUTH=1 \
LIGHTSITE_AGENT_WORKSPACE_ID=00000000-0000-4000-8000-000000000101 \
LIGHTSITE_AGENT_WORKSPACE_SLUG=lightsite-dev \
LIGHTSITE_PUBLIC_SITE_ORIGIN=http://localhost:3011 \
pnpm --filter @lightsite/mcp dev
```

## Server-To-Server Auth

Configure the API server with:

```sh
LIGHTSITE_AGENT_API_TOKEN=...
LIGHTSITE_AGENT_WORKSPACE_ID=...
LIGHTSITE_AGENT_USER_ID=lightsite_agent
```

Configure the MCP server with:

```sh
LIGHTSITE_API_BASE_URL=https://api.example.com
LIGHTSITE_AGENT_API_TOKEN=...
LIGHTSITE_AGENT_WORKSPACE_ID=...
LIGHTSITE_AGENT_WORKSPACE_SLUG=...
LIGHTSITE_PUBLIC_SITE_ORIGIN=https://pages.example.com
```

## Tools

- `lightsite_get_capabilities`
- `lightsite_list_sites`
- `lightsite_create_site`
- `lightsite_get_site`
- `lightsite_update_site`
- `lightsite_get_site_content`
- `lightsite_update_site_content`
- `lightsite_validate_site_content`
- `lightsite_publish_site`
- `lightsite_unpublish_site`
- `lightsite_list_variants`
- `lightsite_batch_upsert_variants`
- `lightsite_get_public_urls`
- `lightsite_get_tracking_summary`
- `lightsite_list_tracking_events`

`lightsite_get_capabilities` now includes `siteContent.draftBlockDefinitions`, which gives agents the required fields, optional fields, and example JSON for each currently publishable draft block type.

The canonical editable site model is `SiteContent` schema version `2`, where `chrome.siteHeader`, `chrome.hero`, `variables`, and the ordered `blocks` array all live in one JSON document.
