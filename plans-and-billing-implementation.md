# Plans and Billing Implementation Plan

## Product Contract

Lightsite has three workspace plans:

- Free: try Lightsite for free, create up to 10 draft sites, upgrade only when publishing.
- Core: $49 per user per month, or $39 per user per month when billed annually. Includes unlimited published sites and unlimited recipients, subject to abuse guardrails.
- Pro: $89 per user per month, or $69 per user per month when billed annually. Includes Core plus unlimited session replays and API access. Pro remains backend-supported but hidden from primary UI until those features ship.

## Billing Model

- Billing is owned by the workspace.
- `workspaces.plan` is the effective app-access plan: `free`, `core`, or `pro`.
- Stripe state is mirrored into a dedicated `workspace_billing` table.
- Checkout uses subscription mode with a seat quantity equal to active workspace members, minimum 1.
- Customer Portal is the self-serve surface for payment method updates, invoice history, cancel/reactivate, and plan changes once a Stripe customer exists.
- Webhooks are the source of truth after checkout: checkout completion, subscription updates, and subscription deletion update the workspace billing mirror and effective plan.

## Access Rules

- Free workspaces can create and duplicate up to 10 non-archived sites.
- Core and Pro workspaces can create, duplicate, publish, and manage recipients without app-level count limits. Abuse guardrails remain server-side policy, not user-facing quotas.
- Publishing on Free returns `billing.upgrade_required` with enough structured detail for UI to route users to billing.
- Non-admin users cannot create checkout or portal sessions.

## App Surfaces

- Add `/billing` as an internal app route and sidebar item.
- Billing page shows current plan, monthly/annual toggle, Core upgrade CTA, and a manage-billing CTA when a Stripe customer exists.
- Pro appears only as a muted "coming soon" plan teaser, without checkout CTA.
- Publish failures caused by plan gating should show a billing-specific message and route admins to `/billing`.
- Site creation failures at the Free draft-site cap should route admins to `/billing`.

## Stripe Configuration

Required API environment:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CORE_MONTHLY_PRICE_ID=price_1Tr09bDjpuLjWOLKK5Q7XFlF`
- `STRIPE_CORE_ANNUAL_PRICE_ID=price_1Tr09bDjpuLjWOLK8CnBv7mY`
- `STRIPE_PRO_MONTHLY_PRICE_ID=price_1Tr09cDjpuLjWOLKMrtNJ5pW`
- `STRIPE_PRO_ANNUAL_PRICE_ID=price_1Tr09cDjpuLjWOLKQG2TIGVx`

Created Stripe products:

- Core: `prod_UqhY2ZQ3xrBuTP`
- Pro: `prod_UqhYyY3dYZXIf2`

Required frontend/API origins:

- `WEB_ORIGIN` is used for Checkout success/cancel and Portal return URLs.

## Implementation Checklist

- [x] Update database enum/schema and add `workspace_billing`.
- [x] Add billing contracts.
- [x] Add API env validation for Stripe.
- [x] Add billing repository/service/router and webhook handling.
- [x] Wire billing service into app before JSON body parsing for webhooks.
- [x] Update workspace plan types from `basic/pro` to `free/core/pro`.
- [x] Enforce Free site and publish rules in the site service.
- [x] Add billing API client and route UI.
- [x] Add sidebar navigation and publish/limit upgrade handling.
- [x] Add focused backend and frontend contract tests.
- [x] Run typecheck/tests and local smoke checks.

## Verification Checklist

- API contracts parse billing summary, checkout, and portal responses.
- Free workspace can create 10 draft sites and cannot create the 11th.
- Free workspace cannot publish and receives `billing.upgrade_required`.
- Core workspace can publish.
- Checkout endpoint rejects non-admin users.
- Portal endpoint rejects workspaces without a Stripe customer.
- Webhook endpoint uses raw body verification before JSON parsing.
- App bootstrap includes plan data and the web parser accepts it.
- Billing page works from app navigation and uses canonical primitives/tokens.
