---
name: analyze-handout-engagement
description: Analyze Handout site, page, recipient, and session engagement and turn it into grounded sales follow-up. Use when a seller asks who engaged, what content was viewed or clicked, which accounts need attention, how a site performed, or what follow-up action the evidence supports.
---

# Analyze Handout Engagement

Use observed activity as a signal, not mind reading. Follow `operate-handout` privacy rules and read [interpretation-guide.md](references/interpretation-guide.md).

## Workflow

1. Clarify or infer the narrowest useful site, recipient, and time window. State the window in the answer.
2. Call `handout_get_tracking_summary` first. This is usually enough for a performance recap.
3. Use `handout_query_tracking` with `view: "events"` only to answer a concrete question such as which CTA was clicked, which page attracted repeat navigation, or which sequence preceded a follow-up recommendation.
4. Use `handout_query_tracking` with `view: "sessions"` only when duration, active state, device family, or coarse location materially affects the requested analysis.
5. Separate observations from interpretation. Use exact counts and timestamps when available; mark inferences explicitly.
6. Recommend one proportionate next action per meaningful signal. Keep outreach helpful and tied to viewed content.

## Output format

Return:

- **Scope:** site/recipient filters and time window.
- **Observed:** visits, sessions, key clicks, navigation, recency, and data limitations.
- **Interpretation:** plausible meaning with calibrated confidence.
- **Next actions:** prioritized owner/action/timing, with suggested message angle when useful.
- **Unknowns:** attribution gaps, pagination, tracking consent, or missing data that could change the conclusion.

## Guardrails

- Do not call a visitor “interested,” “qualified,” or “ready to buy” solely from page activity.
- Do not identify a person from device or coarse location data.
- Do not expose raw tracking rows when an aggregate answers the question.
- Do not report zero as “no interest”; it may mean no visit, blocked tracking, missing consent, or a filter mismatch.
- If result cursors indicate more data than inspected, say the result is partial or continue pagination when needed.
