---
name: build-sales-site
description: Plan, create, or substantially rewrite a polished Handout sales site. Use when a seller asks to build a deal room, proposal hub, product walkthrough, mutual action plan, follow-up site, onboarding hub, or other buyer-facing Handout from a brief, notes, or sales context.
---

# Build a Sales Site

Build a concise buyer experience, not a document dump. Use `operate-handout` for shared safety and revision rules.

## Gather the minimum brief

Infer what is safe from the conversation. Ask only for missing information that materially changes the result: audience, desired outcome, offer, evidence/assets, CTA, and timing. If context is thin, create a reviewable draft with clearly factual generic copy; do not invent customer facts, metrics, quotes, commitments, or legal claims.

Use [site-brief.md](assets/site-brief.md) when the user wants a structured intake. Read [site-quality.md](references/site-quality.md) before authoring.

## Build workflow

1. Call `handout_get_capabilities` and choose an existing site or create a private draft with `handout_create_site`.
2. Read current content and revision. If the site has meaningful content, preserve its information architecture unless the user requests a rewrite.
3. Draft a page plan. A strong default is Overview, Solution, Proof, and Next steps, but prefer fewer pages when they tell the story cleanly.
4. Choose the smallest useful set of native blocks. Call `handout_get_block_schemas` with those node types and read `handout://guides/content-patterns`. Read the icon or design option catalog only when a returned attribute references it.
5. Define reusable variables before inserting `variableToken` nodes. Use `variables[].id` in each token and `variables[].key` in variant values and URL templates. Use reserved recipient name, company, and website variables where appropriate.
6. Apply schema-v3 Tiptap content through `handout_edit_site` with typed operations and the latest `expectedDraftRevision`. Follow each returned `contentExpression` exactly; do not guess attributes or nesting.
7. Validate. Repair every schema or publish-readiness issue.
8. Present the page outline, key copy choices, validation status, and editor link. Invite visual review.
9. Publish only after explicit approval. After success, read `handout_get_site` with `include: ["publicUrls"]` and return the exact live link.

## Content standard

- Lead with the buyer's desired outcome and why this page exists.
- Make the offer, proof, plan, ownership, and next step scannable.
- Use short sections, concrete headings, meaningful links, and one primary CTA.
- Keep personalization relevant and professional. Avoid fake familiarity and unsupported account research.
- Make every page useful on its own while keeping a clear story across the sidebar.
- Prefer structured native nodes over simulated layouts in paragraphs.
- Keep the default page compelling when no recipient variant is selected.

## Final quality gate

Before handing off, confirm: no placeholders, no broken or invented links, no unsupported claims, useful variable fallbacks, consistent page names/slugs/order, a clear CTA, clean validation, and draft/public status stated exactly.
