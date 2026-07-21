---
name: personalize-handout
description: Create or update personalized Handout copies for recipients, accounts, opportunities, or partners. Use for importing recipient lists, mapping variables, generating variant slugs and values, checking personalization quality, or producing recipient-specific share links without duplicating the canonical site.
---

# Personalize Handout

Keep one canonical site. Personalize with variable definitions and recipient variants; do not duplicate the whole site per account unless the user explicitly needs structurally different content.

## Prepare

1. Follow the shared rules in `operate-handout`.
2. Resolve the site, call `handout_get_site` with `include: ["content", "variables", "variants"]`, and inspect variable definitions and usage.
3. Normalize the user's rows against [recipient-import.csv](assets/recipient-import.csv). Keep a source field only if it is needed for the site.
4. Read [personalization-quality.md](references/personalization-quality.md) and propose the field mapping when inputs are ambiguous.

## Variable strategy

Use the reserved fields when they fit:

- `name` / `recipient-name` for the recipient's display name.
- `company` / `recipient-company` for the account name.
- `website` / `recipient_website` for a company website or domain.

Create custom variables only for content reused across meaningful cohorts, such as industry, use case, primary challenge, approved proof point, plan date, or CTA URL. Do not create a variable for every sentence.

Custom variable references are intentionally different by surface: inline `variableToken.attrs.variableId` uses the definition `id`; `variableValues` and `{{variable_key}}` URL templates use the definition `key`.

If the canonical content lacks required tokens, call `handout_get_block_schemas` for `variableToken` and every containing block you must edit, update the canonical content once using the latest draft revision, validate it, then create variants. Every variable needs a natural default value so the base site remains complete.

## Upsert variants

1. Read existing variants with `handout_get_site` to avoid duplicates.
2. Generate stable lowercase slugs from the account or recipient. Resolve collisions deterministically; do not silently overwrite an unrelated row.
3. Prepare at most 100 variants per `handout_upsert_variants` call and use `matchBy: "slug"` for imports. Include `recipientName`, `recipientCompany`, and only supported `variableValues`.
4. Call the tool with `preview: true` for a representative sample: first row, last row, rows with missing fields, and any collision or unusual value.
5. Upsert only after the mapping is clear. This action does not publish the canonical site.
6. Read `handout_get_site` with `include: ["publicUrls"]`; return recipient names/account names with exact URLs and clearly state whether the underlying site is published.

## Data quality

- Reject or flag blank identifiers, duplicate slugs with conflicting data, malformed URLs, secrets, and fields that exceed Handout limits.
- Never infer personal facts, sensitive traits, buying intent, or unverified company claims.
- Preserve deliberate capitalization in names and companies while normalizing slugs.
- If a field is missing, use the canonical fallback; do not write visible placeholders such as `TBD`, `{{name}}`, or `undefined`.
- Deleting a variant is permanent and requires explicit intent naming the target.

## Handoff

Report created, updated, skipped, and errored counts; list conflicts; show a small preview; state canonical draft/public status; and provide exact URLs. Do not paste sensitive source columns that were not used.
