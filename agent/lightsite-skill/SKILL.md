# Lightsite Agent Skill

Use this skill when creating, editing, publishing, or analyzing Lightsite sites through the Lightsite MCP server.

## Core Model

Lightsite sites are JSON-first. The editable source of truth is `SiteContent`; agents should create and update that JSON directly, then validate it before publishing.

```json
{
  "schemaVersion": 2,
  "chrome": {
    "siteHeader": {
      "brandName": "Lightsite",
      "logoUrl": "",
      "primaryButtonText": "Book a call",
      "primaryButtonHref": "",
      "secondaryButtonText": "Learn more",
      "secondaryButtonHref": "",
      "showSecondaryButton": false
    },
    "hero": {
      "avatarMode": "single",
      "eyebrow": "",
      "title": "Untitled Lightsite",
      "subtitle": "",
      "avatarImageUrl": "",
      "avatarImageVariableKey": "",
      "avatarImageAlt": "",
      "avatarImageSecondaryUrl": "",
      "avatarImageSecondaryVariableKey": "",
      "avatarImageSecondaryAlt": ""
    }
  },
  "settings": {
    "showTableOfContents": true,
    "allowSearchIndexing": false
  },
  "variables": [],
  "blocks": []
}
```

Public variants do not fork site content. Variants only set `variableValues` for variables already present in the site JSON.

## Workflow

1. Call `lightsite_get_capabilities`.
2. For existing sites, call `lightsite_list_sites`, then `lightsite_get_site_content`.
3. For new sites, call `lightsite_create_site`, then write full `SiteContent` JSON with `lightsite_update_site_content`.
4. Always include `expectedDraftRevision` from `lightsite_get_site_content` when updating content.
5. Call `lightsite_validate_site_content` before publishing.
6. Use `lightsite_batch_upsert_variants` for account or recipient lists.
7. Publish only after the user explicitly asks.
8. Use `lightsite_update_site` to set `visibility: "team"` before sharing or browser-testing public URLs.
9. Use `lightsite_get_public_urls` after publishing or variant changes when the user needs share links.
10. For analytics, call `lightsite_get_tracking_summary` before `lightsite_list_tracking_events`.

## Content Rules

- Header chrome, hero chrome, variables, and body blocks all belong in the same canonical `SiteContent` JSON payload.
- Use a flat ordered `blocks` array; do not invent sections.
- Keep block IDs stable, readable, and unique.
- Use variables for repeated personalized values: company name, recipient name, pain point, proof point, CTA URL, and calendar link.
- Keep body blocks concise. Lightsite is a sales one-pager, not a long landing page.
- Use only `heading`, `text`, `divider`, `cta`, and `quote` for publishable draft content until the MCP reports additional `supportedDraftBlockTypes`.
- Read `siteContent.draftBlockDefinitions` from `lightsite_get_capabilities` before inventing block fields; it is the source of truth for required and optional fields.
- Store draft blocks as `{ "id": "...", "type": "...", "fields": { ... } }`.
- Do not publish if validation returns issues.

## Draft Block Examples

```json
{
  "id": "heading-context",
  "type": "heading",
  "fields": {
    "level": 2,
    "text": "Why this matters now"
  }
}
```

```json
{
  "id": "text-context",
  "type": "text",
  "fields": {
    "text": "{{company_name}} can move faster when the buying team has one clean page to review."
  }
}
```

```json
{
  "id": "cta-primary",
  "type": "cta",
  "fields": {
    "label": "Book implementation review",
    "href": "{{primary_cta_url}}",
    "style": "primary"
  }
}
```

```json
{
  "id": "quote-proof",
  "type": "quote",
  "fields": {
    "quote": "Lightsite helped us send a polished, personalized follow-up in minutes.",
    "personName": "Mira Singh",
    "personTitle": "Revenue Operations Lead",
    "company": "{{company_name}}"
  }
}
```

## Variant Batch Example

```json
{
  "matchBy": "slug",
  "variants": [
    {
      "slug": "mira-acme",
      "name": "Mira at Acme",
      "recipientName": "Mira Singh",
      "recipientCompany": "Acme",
      "variableValues": {
        "company_name": "Acme",
        "primary_cta_url": "https://example.com/acme"
      }
    }
  ]
}
```
