# Handout MCP

The Handout MCP server is the shared agent interface for ChatGPT, Codex, Claude, Grok, OpenClaw, and any MCP-capable client. It exposes the same tools, resources, prompts, structured results, and optional MCP Apps UI over local stdio and hosted Streamable HTTP.

## Hosted connection

Production clients connect to:

```text
https://api.handout.link/mcp
```

The endpoint advertises OAuth 2.1 protected-resource metadata and requests the `handout:operate` scope. Authorization uses S256 PKCE, dynamic client registration, short-lived access tokens, refresh tokens, and the user's active Handout workspace.

## Local stdio

```sh
HANDOUT_API_BASE_URL=http://localhost:3011 \
HANDOUT_DEV_AUTH=1 \
HANDOUT_AGENT_WORKSPACE_ID=00000000-0000-4000-8000-000000000101 \
HANDOUT_AGENT_WORKSPACE_SLUG=handout-dev \
HANDOUT_PUBLIC_SITE_ORIGIN=http://localhost:3011 \
HANDOUT_WEB_ORIGIN=http://localhost:5173 \
pnpm --filter @handout/mcp dev
```

`HANDOUT_DEV_AUTH=1` is development-only. For a standalone remote development process, run `pnpm --filter @handout/mcp dev:http`; the production OAuth facade is served by `apps/api`.

## Capabilities

- Workspace: active brand/plan/role/permissions plus selective automation configuration and activity.
- Sites: filtered active/archived listing, selective reads, create, atomic metadata/content edits, duplicate, access, lifecycle, and version restore.
- Content: typed page/settings/theme/variable/sidebar operations over canonical schema-v3 Tiptap SiteContent with optimistic revision control; validate without mutation.
- Publishing: publish and unpublish with canonical public and recipient URLs returned by the API-backed tool.
- Personalization: preview and batch-upsert recipient variants through canonical variable keys.
- Assets: list and store bounded PNG/JPEG/WebP images from base64 or SSRF-protected public HTTPS sources.
- Engagement: aggregate summary first, then one filtered event/session query tool.
- Automations: validate, create, update, pause/enable, test, and retry webhook automations without exposing signing secrets or retained payloads.
- Deletion: one preview-first, exact-name-confirmed, reference-aware tool for sites, pages, variables, sidebar items, variants, assets, and automations.
- Agent UX: operating/content/content-pattern/personalization/quality guides, a generated site-document schema, separate icon/design catalogs, targeted block-schema lookup, three reusable prompts, concise text plus `structuredContent`, and a compact MCP Apps review component.

Call `handout_get_capabilities` before authoring. Choose the blocks needed for the request, then call `handout_get_block_schemas` with those node types before constructing JSON. It returns canonical content expressions, parents and children, attributes, defaults, valid options, structural dependencies, mark schemas, and minimal examples. Large icon and design choices remain progressively available at `handout://catalog/icons` and `handout://catalog/design-options`; exhaustive tooling can read `handout://schema/site-document`.

## Safety contract

Tool annotations distinguish read-only, destructive, and open-world operations. Agents must obtain explicit user intent before publishing, unpublishing, team-sharing, version restore, archive, or confirmed deletion. Content writes require the exact latest `expectedDraftRevision`; revision conflicts must be re-read and merged, not overwritten. Agent responses recursively remove secrets, credentials, internal user/request IDs, asset bodies, and token material; normal text is concise while complete sanitized data remains in `structuredContent`.

Detailed design, distribution, and deployment guidance lives in [docs/agent-platform.md](../../docs/agent-platform.md).
