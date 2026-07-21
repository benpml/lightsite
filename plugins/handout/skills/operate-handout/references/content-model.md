# Handout content model

`handout_get_capabilities` is authoritative. The current model is schema version 3 and each page owns a Tiptap `doc`.

## SiteContent shape

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
    "sections": {
      "tabs": { "label": "Tabs" },
      "links": { "label": "Links" },
      "nextSteps": { "label": "Next steps" }
    },
    "links": [],
    "nextSteps": []
  }
}
```

## Authoring rules

- Treat `pages[].document` as canonical content. Editable copy belongs in Tiptap node content, not node attributes.
- Use node attributes only for configuration such as IDs, layout, hrefs, media sources, and icon choices.
- Use `variableToken` nodes for inline personalized text. Its `attrs.variableId` must equal the matching `variables[].id`; recipient variants put values under the matching `variables[].key`. Keep useful fallbacks so the canonical link reads naturally.
- Use `{{variable_key}}` templates in URL-like attributes and sidebar hrefs, where `variable_key` is `variables[].key`.
- Use stable, semantic IDs and unique page slugs. Keep `sortOrder` contiguous.
- Preserve settings, variables, pages, and sidebar entries outside the requested edit.
- `handout_edit_site` reads the current draft, applies a typed operation batch, validates the complete result, and writes it atomically. Always pair content mode with the latest `expectedDraftRevision`. Use `replace_content` only when the entire site is intentionally being replaced.

Supported nodes, marks, and options can change. Never rely on a remembered list when capabilities are callable.

1. Read `siteContent.schemaDiscovery.topLevelBlocks` from `handout_get_capabilities`.
2. Choose the blocks required by the requested page—not every available block.
3. Call `handout_get_block_schemas` with those node types. Structural children such as `gridRow`, `gridCell`, card title/body nodes, and table cells are included automatically.
4. Follow each `contentExpression` exactly and use only listed attributes. Read an `optionsCatalog` resource only when the selected block references it.
5. Use `minimalExample` as a structural starting point, then replace empty content with useful copy. Read `handout://guides/content-patterns` for multi-block composition examples.

Use `handout://schema/site-document` only for exhaustive inspection or tooling. Routine authoring should use targeted schema lookup to avoid unnecessary context. If the schema fingerprint changes during a long workflow, refresh the selected block schemas before the next write.
