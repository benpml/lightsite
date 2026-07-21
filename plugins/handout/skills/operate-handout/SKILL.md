---
name: operate-handout
description: Safely operate a Handout workspace through its MCP tools. Use for listing, creating, reading, editing, duplicating, publishing, unpublishing, archiving, restoring, deleting, or sharing Handout sales sites and pages, and whenever another Handout skill needs the canonical operating rules.
---

# Operate Handout

Use Handout as the system of record. Keep one canonical site, use variables and recipient variants for personalization, and keep the user in control of public or destructive actions.

## Start every workflow

1. Call `handout_get_capabilities` before authoring content. It is the runtime source of truth for schema version, available top-level blocks, variables, schema fingerprint, and connection mode.
2. Call `handout_get_workspace_context`, then resolve the target site with `handout_list_sites` or `handout_get_site`; never guess an ID from a name.
3. For edits, call `handout_get_site` with `include: ["content"]` immediately before writing and preserve its `draftRevision` as `expectedDraftRevision`.
4. Before adding or materially changing blocks, call `handout_get_block_schemas` with the intended node types. Treat the returned content expressions, attributes, defaults, option catalogs, dependencies, and examples as authoritative; never infer them from a node name.
5. Make the narrowest change that satisfies the request with `handout_edit_site` content operations. Use `replace_content` only for an intentional complete rewrite; never create React-side or page-builder state beside Tiptap.
6. Call `handout_validate_site` after authoring. Fix all validation failures and give the user the editor URL for visual review.

## Focused operations

- Read only what the task needs with `handout_get_site` includes: page summaries, variables, complete content, variants, public URLs, or versions.
- Use `handout_import_asset` for bounded PNG, JPEG, or WebP files. Prefer stored asset URLs over embedding base64 in site content. Public URL imports must be HTTPS and must never target local/private infrastructure.
- Use `handout_get_workspace_context` automation includes for automation state/options/activity. Use `handout_manage_automation` for validation and mutation. Never ask for, display, or persist a webhook signing secret or retained delivery payload.
- Start tracking with `handout_get_tracking_summary`; use `handout_query_tracking` only for a concrete event/session question.
- Use `handout_delete` for every permanent target type. Variables and assets can be blocked by live references; remove those references through normal revision-checked edits before previewing again.

## Approval boundaries

- Creating a private draft, editing draft content, duplicating a site, and upserting variants are reversible workspace actions. Perform them when the user clearly asks.
- Publishing, unpublishing, changing visibility to `team`, restoring a historical version, archiving, and deleting require explicit intent naming the action and target.
- Before publishing, summarize the site, recipient count, validation result, and public effect; ask for approval if it was not already explicit.
- Preview `handout_delete` first. Review references and impact, then confirm only with the exact returned `targetName`. Never use deletion as cleanup.
- Never claim a site is live until the publish tool succeeds. Never invent a link; read `handout_get_site` with `include: ["publicUrls"]`.

## Editing conflicts

If `handout_edit_site` reports a revision conflict, stop. Re-read current content, compare it with the intended change, reapply only the requested operation, validate, and retry with the new revision. Do not overwrite another editor's work.

## Choose the focused workflow

- For creating or substantially rewriting a site, use the `build-sales-site` skill.
- For account or recipient copies, use `personalize-handout`.
- For buyer activity and follow-up, use `analyze-handout-engagement`.
- Read [content-model.md](references/content-model.md) when constructing Tiptap JSON or sidebar content.
- Read [safety-and-privacy.md](references/safety-and-privacy.md) before public, destructive, or detailed tracking operations.

## Handoff

Return what changed, what remains draft versus public, validation status, recipient count when relevant, and the canonical editor/share links. State any missing approval or visual review plainly.
