# Safety and privacy

## Public effects

Publishing creates a publicly reachable snapshot. Team visibility and share links can expose content outside the current conversation. Explain that effect before action and obtain explicit intent.

Do not place secrets, credentials, private notes, unsupported claims, or sensitive personal data in a site or recipient variant. Treat imported recipient data as customer-provided data and use only fields needed for the requested personalization.

## Destructive effects

Unpublishing removes public availability. Restoring a version replaces the current draft. Archiving removes a site from active work. Deleting is permanent. Call `handout_delete` without confirmation first, inspect its reference-aware preview, then confirm only with the exact returned `targetName` and a fresh draft revision when required.

Never ask for or expose access tokens, signing secrets, retained webhook payloads, internal user IDs, request IDs, binary asset bodies, or infrastructure configuration. Webhook tests and public URL imports are open-world actions. Asset import accepts only bounded PNG, JPEG, or WebP data or public HTTPS URLs; do not attempt private-network or credential-bearing URLs.

## Tracking

Start with `handout_get_tracking_summary`. Only request detailed events or sessions when they materially affect the answer. Use the narrowest site, recipient, and time filters available. Do not expose raw location, device, or session details unless the user needs them for a legitimate sales workflow.

Engagement is evidence of activity, not proof of identity, intent, budget, or purchase readiness. Use language such as “suggests,” “may indicate,” and “worth following up on.”
