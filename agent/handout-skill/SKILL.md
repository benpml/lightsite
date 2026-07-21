---
name: handout
description: Build, edit, personalize, publish, and analyze Handout sales sites through the Handout MCP server. Use whenever a user asks an agent to operate Handout, create buyer-facing pages, generate recipient copies, return share links, or interpret site engagement.
---

# Handout

Call `handout_get_capabilities` first; it is the canonical runtime reference. Before constructing Tiptap JSON, choose the blocks needed for the user's story and call `handout_get_block_schemas` with those node types. Read only the option catalogs referenced by the returned attributes, plus `handout://guides/content-patterns` for composition examples. Handout currently uses schema-v3 `SiteContent`, with editable content stored as Tiptap documents in `pages[].document`.

## Core workflow

1. Call `handout_get_workspace_context`, then resolve the site with `handout_list_sites` or create a private draft.
2. Immediately before editing, call `handout_get_site` with `include: ["content"]` and retain its `draftRevision`.
3. Call `handout_get_block_schemas` for every top-level block you plan to add or materially change. Structural dependencies are returned automatically. Treat `contentExpression`, attributes, options, and examples as authoritative.
4. Use `handout_edit_site` content mode with the narrowest atomic operation batch and the exact `expectedDraftRevision`. Use `replace_content` only for an intentional complete rewrite.
5. Call `handout_validate_site`; fix every issue and return the editor link for visual review.
6. Use variables plus `variableToken` nodes for reusable personalized content. Preview, then use `handout_upsert_variants` for recipient/account copies.
7. Publish only on explicit request. Read `handout_get_site` with `include: ["publicUrls"]` after publishing or variant changes; never construct links.
8. Use `handout_delete` without confirmation first. Proceed only after reviewing references and matching the exact returned `targetName`.

Use `handout_import_asset` for bounded PNG/JPEG/WebP workspace images, `handout_manage_automation` for webhook workflows, and `handout_query_tracking` only after the engagement summary. Public URL imports and webhook tests are open-world actions. Never target private infrastructure or expose signing secrets and delivery payloads.

## Content model

```json
{
  "schemaVersion": 3,
  "themeMode": "light",
  "settings": {
    "allowSearchIndexing": false,
    "siteTitle": "Acme implementation hub",
    "siteDescription": "A shared plan for Acme",
    "primaryColor": "neutral",
    "trackingConsentPopup": "popup-a",
    "trackingPrivacyPolicyUrl": "https://www.handout.link/privacy"
  },
  "variables": [],
  "pages": [{
    "id": "overview",
    "name": "Overview",
    "slug": "overview",
    "status": "visible",
    "sortOrder": 0,
    "document": { "type": "doc", "content": [] }
  }],
  "sidebar": {
    "sections": { "tabs": { "label": "Tabs" }, "links": { "label": "Links" }, "nextSteps": { "label": "Next steps" } },
    "links": [],
    "nextSteps": []
  }
}
```

Capabilities lists the available top-level blocks. `handout_get_block_schemas` returns exact node structure, attributes, defaults, option references, parents, children, marks, and minimal examples. Omit `nodeTypes` only when the complete catalog is genuinely needed. Read `handout://catalog/icons` only when using an icon-bearing block and `handout://catalog/design-options` only when using referenced design options. Do not invent structures. Editable copy belongs in node content, not attrs. Inline `variableToken.attrs.variableId` uses `variables[].id`; variant `variableValues` and `{{variable_key}}` URL templates use `variables[].key`. Keep stable semantic IDs, unique slugs, contiguous ordering, and natural variable fallbacks.

## Personalization

Keep one canonical site unless the user needs genuinely different structure. Reserved fields are recipient name (`name` / `recipient-name`), company (`company` / `recipient-company`), and website (`website` / `recipient_website`). Read variants through `handout_get_site`, use stable unique slugs, preview a representative sample, then batch upsert at most 100 at a time with `matchBy: "slug"`. Never infer sensitive or unverified personal facts.

## Safety

Publishing and team visibility can expose content publicly. Unpublishing removes availability. Version restore replaces the draft. Archive and delete remove content from normal use; delete is permanent. Perform these only with explicit user intent naming the target and action. Never request or return webhook signing secrets, tokens, retained webhook payloads, internal user IDs, or binary asset bodies.

On revision conflict, re-read and reapply only the requested change. Do not overwrite concurrent work. Start analytics with the summary and use narrow filters; engagement is activity evidence, not proof of identity or buying intent.

## Handoff

Report the exact site/variant changed, revision, validation result, draft versus public state, counts/errors for imports, and canonical editor/share links.
