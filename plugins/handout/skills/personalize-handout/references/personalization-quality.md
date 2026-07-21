# Personalization quality

## Good personalization

Good personalization changes relevance while preserving truth. Useful inputs include the recipient's preferred display name, correct company name and domain, known use case, previously discussed priority, approved proof point, agreed timeline, and an account-specific CTA destination.

## Avoid

- Fabricated familiarity: “We know your team is struggling with…” without evidence.
- Unverified research presented as fact.
- Sensitive or protected traits.
- Hidden tracking details in visible copy.
- Unique prose per recipient when a variable plus strong canonical content is sufficient.
- Personalization that breaks grammar when a value is absent.

## Mapping review

Before a large upsert, verify:

1. Each input column maps to one existing or proposed variable.
2. Reserved name/company/website fields use their reserved keys.
3. URL variables include fully qualified safe URLs.
4. Every variable has a useful canonical default.
5. Slugs are stable and unique.
6. A sample render sounds natural for complete and incomplete rows.
7. Source columns not needed for rendering are excluded.
