# Lightsite App Spec

Lightsite is a lightweight sales site builder. It gives sales teams a place to quickly build, edit, personalize, publish, and track sites that can be sent to prospects who ask for more information.

> **Canonical editor/rendering update:** [site-rendering-architecture.md](./site-rendering-architecture.md) and [site-sidebar-pages-spec.md](./site-sidebar-pages-spec.md) supersede historical references in this document to flat product blocks, root `blocks`, page `blocks`, `chrome` content, or Tiptap being limited to rich-text fields. The implemented source of truth is schema-v3 `SiteContent`: each page owns one canonical Tiptap JSON `document`, and the same Tiptap Static Renderer powers Preview and published HTML. Do not use the historical shapes for implementation.

This document is the living product and architecture spec for the app. It will include feature behavior, user flows, data models, database table structure, backend API architecture, frontend architecture, editor behavior, permissions, publishing, hosting, analytics, and implementation notes.

Note: The prospect-specific sharing model is now defined as **Recipient Sharing** in [recipient-sharing-spec.md](recipient-sharing-spec.md). That model supersedes the older user-facing "variants", "site copies", and detached-copy terminology in this document for new product and implementation work.

Note: The fresh tracking rebuild is now defined in [tracking-implementation-spec.md](tracking-implementation-spec.md). That focused spec supersedes older tracking implementation details in this document until the tracking sections are merged or retired.

## Product And Architecture Principles

Lightsite is greenfield, so the foundation should optimize for correctness, clarity, maintainability, and low operating cost from the beginning.

### Product Principles

- The app should help sales teams move quickly without creating duplicated, unmanaged content.
- The site is the source of truth. Recipients personalize variables and tracking; they do not fork site content.
- Every prospect-facing link should be reliable, fast, trackable, and easy to reason about.
- Every internal workflow should have clear ownership, permissions, and failure states.
- V1 should be deliberately simple where simplicity protects the product: one site design, flat content blocks, and no separate section entity.
- The system should still be extensible for future styles, richer blocks, custom domains, deeper analytics, and team collaboration.

### Engineering Principles

- Server-side authorization is the source of truth. Frontend checks improve UX but never replace backend permission checks.
- Database constraints should enforce uniqueness and ownership wherever possible.
- User-facing identifiers such as workspace slugs, site slugs, and variant slugs should be validated consistently on both client and server.
- Public rendering should be fast and cacheable without making draft/published state ambiguous.
- Background/realtime systems should batch, debounce, and deduplicate work to avoid high costs.
- Secrets never belong in source code, client bundles, logs, public specs, or analytics payloads.
- Product state should have explicit lifecycle transitions, not implied booleans scattered through the app.
- The app should favor boring, inspectable data structures over clever abstractions.

## Canonical Product Model

### Core Objects

Lightsite is built around these core objects:

- **User**: A person with a login identity. A user can belong to one or more workspaces.
- **Workspace**: A company/team account. It owns sites, team members, assets, billing, public namespace, and workspace settings.
- **Workspace Member**: The join record between a user and a workspace. It defines the user's role inside that workspace.
- **Workspace Invite**: A pending invitation for an email address to join a workspace.
- **Site**: The master sales one-pager. It owns draft content, published content/snapshots, variables, variants, access rules, analytics, and version history.
- **Content Block**: A renderable/editable unit inside a site's flat content body, such as text, heading, image, button, video, divider, testimonial, or embed.
- **Divider Block**: The v1 replacement for sections. It creates visual separation without introducing grouped content complexity.
- **Variable**: A named placeholder that can be inserted into site content and given a default value.
- **Variant**: A recipient-specific link for a site. It contains variable overrides and tracking identity.
- **Asset**: A stored file, such as a workspace logo, site avatar, image block file, image variable value, or OG image.
- **Site Version**: An immutable checkpoint of site draft content and related editor state that can be inspected or restored.
- **Published Snapshot**: The immutable content payload currently served to public visitors.
- **Visitor Session**: An anonymous public visitor session used for tracking visits, scroll depth, time on page, and clicks.
- **Analytics Event**: A tracked event attributed to a workspace, site, optional variant, and optional visitor session.

### Ownership Rules

- A user does not directly own sites. Workspaces own sites.
- A user can act on a site only through workspace membership and site access rules.
- Workspace settings affect all new sites in that workspace unless a site has an explicit override.
- Workspace logo/avatar is the default avatar for new sites.
- Site content belongs to the site and should not be duplicated per variant.
- Variant values belong to the variant and should only store differences from the site's variable defaults.
- Analytics events belong to the workspace and site. They may also belong to a variant when the visitor used a variant link.
- Assets belong to a workspace and may be referenced by sites, variables, variants, or settings.

### Naming Rules

- Use **slug** for public URL namespace identifiers.
- Do not use `username` for workspace public namespace in product language, API contracts, database columns, route params, or UI copy.
- Use **workspace slug** for `/{workspace-slug}`.
- Use **site slug** for `/{workspace-slug}/{site-slug}`.
- Use **variant slug** for `/{workspace-slug}/{site-slug}/{variant-slug}`.
- Use **role** for workspace role: `admin` or `user`.
- Use **site access role** for site-level permission: `none`, `view_copy`, or `edit`.

### Lifecycle Rules

- A workspace has an explicit lifecycle state: `active`, `suspended`, `scheduled_for_deletion`, or `deleted`.
- A site can be draft, published, or archived.
- A draft site is visible only inside the authenticated app.
- A published site has a public published snapshot.
- An archived site is hidden from normal active views, cannot be publicly viewed, and should not receive new tracking events.
- A variant is usable only while its parent site is published.
- A suspended workspace keeps data intact but blocks publishing and public serving in V1.
- A deleted workspace enters a scheduled deletion state first. Public routes fail closed immediately, app access stops except recovery/admin flows, and hard deletion/retention cleanup happens through controlled jobs rather than casual cascades.

### Cross-Cutting Validation

- All externally provided strings should be trimmed before validation.
- Slugs should be lowercase, hyphen-separated, and ASCII.
- Slugs should reject empty values, reserved words, path traversal characters, whitespace, emoji, and punctuation other than hyphen.
- Public identifiers should have database-backed unique constraints, not only preflight checks.
- All create/update endpoints should return structured validation errors that map cleanly to form fields.
- Any client-side uniqueness check is advisory. The save endpoint must repeat the check and return a conflict if another request claimed the value first.

### Data Integrity Rules

- Every workspace-owned table should include `workspaceId` unless ownership is only reachable through a parent table and denormalization would create inconsistency.
- Every mutable business object should include `createdAt` and `updatedAt`.
- Important user actions should store actor IDs where useful: `createdByUserId`, `updatedByUserId`, `publishedByUserId`, `archivedByUserId`, `invitedByUserId`, `acceptedByUserId`.
- Destructive actions should be soft-delete or lifecycle-state based when recovery/history matters.
- Public visitor tracking should not require storing personally identifiable information.
- Multi-row writes that create ownership or permissions must be transactional.
- Retryable create operations should be idempotent where duplicate submissions are likely, especially invites, uploads, tracking events, and autosave/collaboration writes.
- The system should prefer append-only records for history-sensitive events: site versions, publish events, analytics events, and billing events.
- Avoid storing derived counts as source of truth unless they are cache fields with clear invalidation rules.

## Sites, Variables, And Variants

### Core Idea

Lightsite has one reusable sales one-pager called a **Site**. A sales rep builds the content once, inserts **Variables** anywhere the content should be personalized, then creates **Variants** for specific recipients/accounts.

So instead of duplicating a whole page for every prospect, the user creates one site and many personalized links.

### Sites

A **Site** is the master one-pager.

It owns:

- Name
- Slug / public base link
- Status: draft, published, archived
- Page content and layout
- Sharing/team access
- The set of variables used inside the content
- All recipient variants
- Version history

A site is edited in the builder. Changes to the site's structure/content should flow through to every variant, unless the differing part is specifically controlled by a variable.

Lightsite should use one canonical site design in V1. We do not need user-facing site style selection in the initial product surface. The content model should still be clean enough to support additional style systems without adding style switching now.

### Variables

A **Variable** is a reusable placeholder inside the site content.

Example:

```text
{{company_name}}
{{buyer_name}}
{{hero_image}}
```

Variables can be inserted from the editor/sidebar. In Figma, this shows up as variable chips like `{{example_a}}`, `{{variable}}`, and an "Insert Variable" menu with existing variables plus "New Variable."

Each variable should have:

- Key/name, like `company_name`
- Type, like text or image
- Default value
- Where it is used in the site content

The default value matters because the normal site link can render without a variant, and any variant can leave a variable blank to fall back to the default.

### Variants

A **Variant** is a recipient-specific version of a site.

Important: a variant is not a full copy of the page. It is a lightweight set of overrides plus a tracking link.

A variant owns:

- Name, like "John Doe at Acme"
- Custom link slug
- Variable values for that recipient
- Tracking identity
- Created/updated metadata

In the Figma modal, the variant edit state has:

- Name
- Custom link
- Variable values
- Text variable inputs
- Image variable upload
- Save Variant
- Duplicate Variant
- Delete Variant

So a variant answers: "When this recipient opens this site, what values should replace the variables, and how should we attribute engagement?"

### Rendering

When someone opens a link, the app resolves:

Base site link:

- Load the site
- Render content using default variable values
- Track events against the site, no specific variant

Variant link:

- Load the site
- Load the matching variant
- Render the same site content
- Replace variable defaults with that variant's values
- Track events against both the site and variant

Blank variant values should fall back to default values.

### Sharing

Sharing has two layers:

The default site link is for generic sharing:

```text
/{workspace-slug}/{site-slug}
```

Variant links are for specific people or accounts:

```text
/{workspace-slug}/{site-slug}/{variant-slug}
```

The variant link must be unique, editable, copyable, and trackable.

### Editor Flow

In the editor header, Figma shows:

- Variants
- Preview
- Share
- Publish
- More menu

That suggests this flow:

1. User builds the site.
2. User inserts variables where personalization should happen.
3. User previews the default version or a selected variant.
4. User publishes the site.
5. User creates/copies variant links for recipients.
6. Prospect visits the link.
7. Tracking records views/clicks against the site and, when applicable, the variant.

### Why This Is Powerful

The site is the source of truth. Variables define what can change. Variants define who the personalized version is for.

That gives sales teams:

- One page to maintain
- Many personalized recipient links
- No duplicated page content
- Per-recipient tracking
- Easy updates across every shared version

## Authentication, Accounts, And Onboarding

### Goals

Authentication and onboarding should do three things cleanly:

- Create a secure user account.
- Create or join the correct workspace.
- Collect enough workspace information to make the first site feel ready to use.

The app should keep **user account setup** separate from **workspace setup**. A user is the person logging in. A workspace is the company/team container where sites, members, billing, and public links live.

### Auth Provider

Lightsite should use BetterAuth for authentication.

BetterAuth should own:

- User identity
- Password/session behavior
- Email verification primitives, if enabled
- Secure auth cookies/session tokens
- Account linking behavior, if OAuth is added later

Lightsite should own:

- Work email validation rules
- Workspace creation and membership
- Invite acceptance logic
- Workspace selection
- App-specific roles and permissions
- Onboarding completion state

### Signup Rules

Signup should require a work email.

Validation rules:

- Email is required.
- Email is normalized by trimming and lowercasing the domain.
- Email must be syntactically valid.
- Email must not contain `+`.
- Email domain must not be a known personal email provider.
- Block domains should include Gmail, Googlemail, Outlook, Hotmail, Live, MSN, Yahoo, iCloud, Me, Mac, AOL, Proton, Protonmail, Hey, Fastmail, Zoho, Yandex, GMX, Mail.com, and other common personal mailbox providers.
- The blocklist applies to the email address domain itself, not the domain's MX/email host. A company using Google Workspace or Microsoft 365 on its own domain is allowed.
- The blocked-domain list should live in shared server code and be tested.
- The frontend may duplicate the blocked-domain check for instant feedback, but the backend is authoritative.

Failure behavior:

- Invalid syntax: "Enter a valid work email."
- Personal email domain: "Use your work email to create a workspace."
- Plus alias: "Use an email address without a plus alias."
- Existing account: use a safe continuation flow that does not unnecessarily expose account existence. For example, send the appropriate login/verification email and show neutral copy such as "Check your email to continue."

The app should avoid relying on email domain alone to create or join workspaces. A user with `jane@acme.com` should not automatically gain access to an existing Acme workspace unless invited or an explicit domain-join policy is added later.

### Login Rules

Login should be simple and secure:

- Email and password for v1 unless BetterAuth magic links/OAuth are intentionally added.
- Successful login redirects to the user's last active workspace if still accessible.
- If the user has exactly one workspace, load that workspace.
- If the user has multiple workspaces and no valid last active workspace, show workspace selection.
- If the user has no workspaces and no pending accepted invite, route to workspace setup.
- If the user has a pending invite token, complete invite acceptance before showing normal workspace routing.

### Logout Rules

- Logout ends the BetterAuth session.
- Client query caches should be cleared.
- Any editor collaboration connection should close immediately.
- The user should be routed to login.
- Public site routes should remain public and not depend on auth state.

### Session And Workspace Context

Authenticated app requests need both:

- `userId`, from BetterAuth
- `workspaceId`, from selected workspace context

Workspace context should be explicit:

- The selected workspace can be stored client-side for UX.
- Every authenticated API request that reads or mutates workspace-owned data should resolve and validate workspace membership on the server.
- Do not trust a workspace ID from the client without checking that the current user is a member.
- If the selected workspace is no longer accessible, return a structured workspace access error and route the user to workspace selection.

Recommended API behavior:

- Use a server middleware/helper to build an `AuthContext`.
- `AuthContext` should include user, selected workspace, workspace member, workspace role, and separate internal access metadata where relevant.
- Route handlers should call permission helpers rather than hand-rolling checks.

### User Account Setup

User account setup is about the person, not the company.

Fields:

- Name
- Email, from signup/auth
- Optional avatar later

Rules:

- Name should be required before entering the main app.
- Email should not be editable in v1 unless BetterAuth account management is explicitly added.
- User avatar is optional and should not block onboarding.
- User account setup completion should be independent from workspace setup completion.

States:

- New signup with no name: show account setup.
- New signup with name but no workspace: show workspace setup.
- Invited user with no name: ask for name, then accept invite.
- Existing user accepting invite: skip account setup if already complete.

### Workspace Setup

Workspace setup creates the company/team container.

Required fields:

- Workspace name
- Workspace slug
- Website

Optional fields:

- Workspace logo/avatar

Rules:

- Workspace name is required.
- Workspace slug is autogenerated from workspace name but editable.
- Workspace slug must be globally unique.
- Workspace website is required during setup because it powers logo discovery and gives future enrichment hooks.
- Workspace logo is optional but should be strongly encouraged.
- If a logo is selected during setup, it becomes the workspace avatar and the default avatar for new sites.

Slug generation:

- Convert workspace name to lowercase.
- Trim leading/trailing whitespace.
- Replace runs of spaces and punctuation with a single hyphen.
- Remove unsupported characters.
- Remove leading/trailing hyphens.
- Keep the slug within the configured length limit.
- If the generated slug is empty, require manual input.

Slug validation:

- Required.
- Lowercase letters, numbers, and hyphens only.
- Cannot start or end with hyphen.
- Cannot contain consecutive hyphens.
- Must be globally unique.
- Must not be a reserved route or reserved system slug.

Reserved slugs should include:

- `app`
- `api`
- `auth`
- `admin`
- `login`
- `logout`
- `signup`
- `new`
- `settings`
- `dashboard`
- `sites`
- `site`
- `tracking`
- `team`
- `billing`
- `support`
- `help`
- `docs`
- `www`
- `assets`
- `static`
- `public`

Uniqueness check behavior:

- Run a debounced availability check after the slug is dirty and locally valid.
- Show checking, available, unavailable, and error states.
- Disable final save unless the slug is locally valid and the latest availability result says available.
- Final create endpoint must repeat the uniqueness check inside the database write.
- If another user claims the slug between check and save, return a conflict and keep the user on the form.

Website validation:

- Accept domains or full URLs.
- Normalize to a canonical domain for storage and logo lookup.
- Strip protocol, path, query, and hash when storing the company domain.
- Reject localhost, private IP ranges, malformed domains, and obvious placeholder domains.
- Keep the original input only if useful for display/debugging; canonical domain is what product logic should use.

### logo.dev Integration

During workspace setup, Lightsite should use logo.dev to suggest a workspace logo from the entered website.

Rules:

- The logo.dev token lives in `LOGO_DEV_TOKEN`.
- The token must only be used server-side.
- The client should call a Lightsite API endpoint such as `POST /api/workspace-logo-preview`.
- The server fetches or proxies the logo.dev image and returns a Lightsite-owned preview/asset URL. The browser must never receive a logo.dev URL containing the token.
- Do not expose the raw token to the browser.
- Do not log the full logo.dev URL with token.

Expected logo.dev URL format:

```text
https://img.logo.dev/{website_domain}?token={token}&size={size}&retina=true&format=webp&theme={theme}
```

Recommended behavior:

- Default size: 128 or 256 for workspace setup preview.
- Default theme: choose the theme that best fits the app's current mode, but store the selected image asset rather than depending on theme-specific remote URLs forever.
- Let the user accept the suggested logo, upload their own, or skip.
- If accepted, copy/store the logo as a Lightsite asset so future rendering does not depend on repeated logo.dev requests.
- If logo.dev fails, show a quiet fallback state and let the user upload manually.
- If the website changes, offer to refresh the suggested logo without overwriting a manually selected logo automatically.

Failure cases:

- Missing token: logo suggestion feature is disabled, but workspace setup still works.
- No logo found: show upload/manual option.
- Slow request: show loading state and allow the user to continue.
- Invalid website: do not call logo.dev.

### Workspace Creation Transaction

Workspace creation should be atomic.

On final submit, create:

- Workspace
- Workspace member for the creator with `admin` role
- Workspace settings/defaults
- Workspace logo asset reference, if selected
- Initial billing/trial record if billing exists

If any required part fails, the transaction should roll back. The user should not end up with a workspace but no membership.

After successful creation:

- Set the new workspace as active.
- Mark workspace onboarding complete.
- Route to first-site creation or the main sites page empty state.

### Onboarding Paths

#### New User Creating A Workspace

1. User signs up with work email.
2. User verifies email if verification is enabled.
3. User completes account setup.
4. User enters workspace name.
5. App generates editable workspace slug.
6. User enters website.
7. App fetches suggested logo from logo.dev through the backend.
8. User accepts logo, uploads another logo, or skips.
9. User submits workspace setup.
10. Backend atomically creates workspace and admin membership.
11. User lands in the new workspace.
12. User is prompted to create first site or sees the empty Sites page.

#### Invited User Joining Workspace

1. User opens invite link.
2. Backend validates invite token, expiry, email, and workspace.
3. If user is logged out, route to signup/login.
4. If user has no account, require signup with the invited email.
5. If user is logged in as a different email, show a clear account mismatch state.
6. User completes account setup if needed.
7. Backend creates workspace membership and marks invite accepted.
8. User lands in the invited workspace.

#### Existing User Creating Another Workspace

1. User opens workspace switcher.
2. User chooses create workspace.
3. User completes workspace setup.
4. Backend creates workspace and admin membership.
5. App switches active workspace to the new workspace.

### Onboarding Edge Cases

- If a user abandons onboarding after signup, login should resume the next incomplete step.
- If workspace creation fails because slug was taken, keep all entered fields and only require slug correction.
- If logo fetch fails, never block workspace creation.
- If invite is expired, show a clear expired state and allow requesting a new invite.
- If invite was revoked, show revoked state.
- If invite was already accepted, route the user to that workspace when possible.
- If an existing user is removed from a workspace while active in it, the next request should invalidate that workspace context.

## Workspaces

### Workspace Purpose

A workspace is the company/team boundary for Lightsite.

It owns:

- Sites
- Variants
- Analytics
- Members
- Invites
- Workspace assets
- Billing
- Public URL namespace
- Workspace defaults

### Workspace Fields

Workspace records should include these V1-compatible fields:

- `id`
- `name`
- `slug`
- `websiteDomain`
- `logoAssetId`
- `plan`
- `createdAt`
- `updatedAt`
- `status`
- `scheduledDeletionAt`, nullable
- `deletedAt`, nullable

Migration/invariant note:

- Workspace public identifiers must be named `slug` in code, database columns, API contracts, and UI copy. Do not use `username` for workspace URL namespace behavior.

### Workspace Switching

Users can belong to multiple workspaces.

Switcher behavior:

- Show workspaces where the user has active membership.
- Display workspace logo/avatar, name, and role where useful.
- Selecting a workspace updates active workspace context.
- After switching, route to the same logical page if possible only when the route does not reference workspace-owned IDs from the previous workspace.
- If the current route references a site from another workspace, route to the target workspace's Sites page.

Persistence:

- Store last active workspace per user.
- Validate last active workspace on login.
- If inaccessible, ignore it and show workspace selection or default to another workspace.

Failure states:

- No workspace memberships: show workspace setup.
- Workspace deleted or membership removed: show workspace unavailable and route to another valid workspace.
- Network failure during switch: keep current workspace active and show a non-destructive error.

### Workspace Settings

Workspace settings should include:

- Workspace name
- Workspace slug
- Website
- Logo/avatar
- Team members
- Invites
- Billing plan later
- Danger zone later

Slug changes:

- Only admins can change workspace slug.
- Changing workspace slug changes public URLs for all sites in the workspace.
- Before saving a slug change, show a warning that old links may stop working unless redirects are implemented.
- Decision for v1: allow workspace slug changes only while the workspace has no published sites.
- After any site has been published, block workspace slug changes until redirect support exists.
- Later, if redirects are added, slug changes should create workspace-slug redirect records so old public links continue to resolve.

Logo changes:

- Only admins can change workspace logo.
- Changing workspace logo updates the default for future sites.
- Decision for v1: new sites copy the workspace logo as their initial avatar.
- Existing sites keep their selected avatar unless manually changed.
- Changing the workspace logo should not silently change already-created sites.

Website changes:

- Only admins can change workspace website.
- Changing website can offer a logo refresh.
- It should not automatically overwrite logo.

## User Management

### Roles

Workspace roles:

- **Admin**: Can manage workspace settings, users, invites, billing, and all workspace-owned sites.
- **User**: Can create sites, work on sites they can access, and view team surfaces according to product rules.

Internal access:

- `isDeveloper` belongs on an internal user/admin access record, not on a workspace membership.
- It is not editable through normal UI.
- It can unlock dev/debug tools for the Lightsite team.
- It should never grant customer workspace admin permissions accidentally unless explicitly combined with admin checks in internal-only code.

### Member List

The Team page should show:

- Avatar
- Name
- Email
- Role
- Invite/member status
- More menu actions

States:

- Active members
- Pending invites
- Failed/expired invites, if useful

### Inviting Users

V1 invite behavior: only workspace admins can invite, revoke, and resend invites.

Rationale:

- Invites grant workspace access and should start from the safer permission model.
- The product can later add a workspace setting that allows all members to invite, but the default should not make membership expansion implicit.

Invite fields:

- Email
- Role, default `user`

Rules:

- Invite email must pass the same work email rules.
- No `+` aliases.
- Do not allow inviting an email that is already an active member.
- If an invite already exists for the same email/workspace, allow resend rather than creating duplicates.
- Invites should expire.
- Invites should be revocable.
- Invite acceptance must verify that the accepting account email matches the invited email.

Recommended invite lifecycle:

- `pending`
- `accepted`
- `revoked`
- `expired`

### Changing Roles

Admins can change another member's role.

Rules:

- A user cannot change their own role.
- A user cannot demote the last admin in the workspace.
- A user cannot remove the last admin in the workspace.
- Role changes should require confirmation when demoting an admin.
- Role changes should be written to an audit log later, or at least be easy to audit from timestamps and actor IDs.

### Removing Users

Admins can remove other members.

Rules:

- A user cannot remove themselves through the member row action.
- A user cannot remove the last admin.
- Removing a user immediately invalidates their access to workspace-owned app routes.
- Any active collaboration sessions for that workspace should be disconnected or rejected on the next authorization check.
- Sites created by the removed user remain in the workspace.
- Historical analytics and version history should keep actor references where possible.

### Self-Service Leaving

Self-service workspace leaving is excluded from V1. Users who need to leave should ask a workspace admin to remove them.

If added in a later scoped release:

- User can leave a workspace if they are not the last admin.
- Last admin must transfer admin role or delete workspace.

### Permission Foundations

Backend permission checks should be centralized.

Recommended permission helpers:

- `requireAuthenticatedUser`
- `requireWorkspaceMember`
- `requireWorkspaceAdmin`
- `canCreateSite`
- `canViewSite`
- `canEditSite`
- `canCopySite`
- `canManageSiteAccess`
- `canManageWorkspaceMembers`
- `canManageWorkspaceSettings`

Never scatter permission logic across route handlers as one-off conditionals. Route handlers should express intent by calling helpers.

### Workspace Permission Matrix

| Action | Admin | User |
| --- | --- | --- |
| View workspace | Yes | Yes |
| Switch into workspace | Yes | Yes |
| Edit workspace name | Yes | No |
| Edit workspace slug | Yes | No |
| Edit workspace website | Yes | No |
| Edit workspace logo | Yes | No |
| Invite members | Yes | No |
| Revoke invites | Yes | No |
| Change member roles | Yes | No |
| Remove members | Yes | No |
| Manage billing | Yes | No |
| Create site | Yes, subject to plan | Yes, subject to plan |
| View team-shared sites | Yes | Yes |
| View private site created by someone else | Yes | Only with site access |
| Edit any site | Yes | Only with edit access |
| Archive/delete any site | Yes | Only own/editable site if allowed by site rules |

### Failure And Security Cases

- If a permission check fails, return `403` with a stable error code.
- If a workspace/site does not exist or the user cannot know it exists, prefer `404` to avoid leaking existence.
- Do not include private emails or member lists in public site payloads.
- Do not include workspace invite tokens in logs.
- Invitation tokens should be high entropy and stored hashed if practical.
- Race conditions around last-admin checks should be protected by transaction/locking or database constraints where possible.

## Sites And Site Management

### Site Purpose

A site is the master sales one-pager that a team builds, publishes, personalizes with variants, and tracks.

The site object should be designed around these truths:

- The site is owned by a workspace.
- The site draft is the editable source of truth.
- The public visitor sees a published snapshot, not the mutable draft.
- Variants personalize a published site; they do not duplicate the site.
- Analytics and public links should continue to make sense even as drafts change.

### Site Fields

Site records should include these V1-compatible fields:

- `id`
- `workspaceId`
- `createdByUserId`
- `updatedByUserId`
- `publishedByUserId`
- `archivedByUserId`
- `name`
- `slug`
- `status`
- `visibility`
- `draftContent`
- `publishedVersionId`
- `defaultAvatarAssetId`
- `ogImageAssetId`
- `showTableOfContents`
- `publishedAt`
- `lastUnpublishedAt`
- `archivedAt`
- `createdAt`
- `updatedAt`

Notes:

- Greenfield schema should distinguish editable draft content from immutable public published snapshots.
- `styleKey` should not be user-facing for V1. If a transitional column exists during early cleanup, it should default to the only supported design and must not drive a visible style selector.
- `visibility` controls app/team access, not whether the public link is live. Public availability is controlled by `status` and published snapshot state.

### Site Statuses

Site statuses:

- `draft`
- `published`
- `archived`

Meaning:

- `draft`: Editable inside the app. No public site is available.
- `published`: Public snapshot is available. Draft may continue changing after publish.
- `archived`: Hidden from normal active views. Public snapshot is unavailable. Editing and tracking are disabled except restore/unarchive flows.

Status transition rules:

| From | To | Allowed? | Notes |
| --- | --- | --- | --- |
| draft | published | Yes | Requires successful publish validation and snapshot creation. |
| published | draft | Yes | This is unpublish. Public link stops resolving. Draft remains. |
| draft | archived | Yes | Archive inactive draft. |
| published | archived | Yes | Archive also unpublishes public snapshot. |
| archived | draft | Yes | Restore/unarchive as draft. Public link remains unavailable until republished. |
| archived | published | No direct transition | Must restore to draft, validate, then publish. |

### Draft And Published Content

The editor should always edit draft content.

Publishing should create a durable published snapshot:

- Public visitors see the published snapshot.
- Draft edits after publish do not affect public visitors until republished.
- Public tracking should include the published version ID when possible.
- Variant variable values apply on top of the published snapshot's variable definitions.

This separation prevents a half-edited draft from leaking to prospects and gives version history a clear model.

Recommended model:

- `sites.draftContent`: current editable content.
- `sites.publishedVersionId`: points to the version currently public.
- `site_versions.content`: immutable content snapshot.
- `site_versions.kind`: `autosave`, `manual`, `publish`, `rollback`, or similar.
- Public rendering loads the `publishedVersionId` snapshot, not `sites.draftContent`.

Greenfield requirement: published content should be stored in immutable version/snapshot records from the start. Do not add a mutable published-content column on `sites`.

### Site Slug Rules

Site slug controls the default public site path:

```text
/{workspace-slug}/{site-slug}
```

Rules:

- Site slug is unique within a workspace.
- Archived sites keep their slug reserved.
- Site slug is autogenerated from the site name but editable.
- Site slug follows the same local slug rules as workspace slug.
- Site slug must not conflict with reserved words for the workspace route.
- Slug availability checks should be debounced in the UI and repeated by the save endpoint.

Reserved site slugs should include:

- `new`
- `edit`
- `settings`
- `variants`
- `share`
- `analytics`
- `tracking`
- `preview`
- `public`
- `assets`

Changing site slug:

- Allowed while site is draft.
- Decision for v1: block site slug changes while the site is published.
- To change a published site's slug in v1, the user must unpublish, change the slug, then republish.
- Later, if redirects are added, published slug changes should create site-slug redirect records so old public links continue to resolve.
- Users can also duplicate the site to a new draft with a new slug.

### Site Visibility And Access

Visibility controls who can see the site inside the authenticated app:

- `private`: visible to creator, workspace admins, and explicitly granted members.
- `team`: visible to the entire workspace team.

Visibility does not control public visitor access. Public visitor access is controlled by publish status.

Recommended access model:

- Workspace admins can view/edit/manage all workspace sites.
- Site creator can view/edit/manage their own site unless removed from workspace.
- Users with explicit `edit` access can edit.
- Users with `view_copy` access can view inside app and duplicate/copy but cannot mutate the original.
- Users with `none` access have no explicit access.
- Entire-team site access can grant `view_copy` or `edit` to all current and future members.

Edge cases:

- If a site creator is removed from the workspace, the site remains in the workspace.
- If the creator is removed, admins can reassign ownership/creator display later, but the historical `createdByUserId` should remain.
- Decision for v1: if a user has both entire-team access and explicit member access, the strongest role wins.
- Avoid explicit deny rules until there is a clear product need.
- Public site visitors do not need workspace membership.

### Plan Limits

Workspace plan controls how many active sites can exist.

Initial limits from the brief:

- Basic: 1 total site
- Pro: 100 total sites

Clarifications:

- Count draft and published sites toward the limit.
- Decision for v1: archived sites count toward the plan limit because they retain data, versions, variants, and analytics.
- Deleted sites, if hard-delete exists later, do not count.
- Duplicating a site counts as creating a site and must enforce limits.
- Restoring an archived site should not change the count if archived sites count.
- Plan enforcement happens server-side in the create/duplicate/restore endpoints.
- The UI should show a clear upgrade/limit state before the user fills a create form that cannot succeed.

If we want archived sites not to count later, it should be a deliberate billing/product decision with clear cleanup and retention rules.

### Sites Page

The Sites page is the main management surface for workspace sites.

It should support:

- Search
- Sort
- Filter by status
- Filter by visibility/access
- Create site
- Open editor
- Open public link when published
- Open share/variants modal
- Duplicate
- Publish/unpublish
- Archive/restore
- Team access management

Table columns:

- Name
- Status
- Created at
- Updated at
- Created by
- Visibility/access
- Views or recent engagement summary
- Row actions

Search behavior:

- Search by site name.
- Later search by creator, slug, and recipient/variant may be useful.
- For small workspaces, client-side search is acceptable after fetching a paginated first page only if the server result set is bounded.
- Recommended architecture: server-side search/sort/filter from the start so large workspaces do not require a rewrite.

Sort behavior:

- Default sort: recently updated first.
- Supported sorts: name, created at, updated at, status, views later.
- Sort should be stable and deterministic. Use `id` as a secondary sort when needed.

Pagination:

- Use cursor or keyset pagination for real data.
- Avoid offset pagination for large workspaces.
- Cursor should include sort field and stable tie-breaker.

Empty states:

- No sites in workspace: show create-first-site action.
- No search results: show clear filters/search action.
- Plan limit reached: show limit state and upgrade path.
- No accessible sites but team has sites: explain that no sites are shared with the user yet.

### Create Site Flow

Create site starts from:

- Sidebar "New site"
- Sites page "Create site"
- Empty state action

Required fields:

- Site name

Generated fields:

- Site slug, generated from name
- Site avatar, copied from workspace logo/avatar if present
- Initial draft content, using default starter content

Flow:

1. User opens create site modal.
2. User enters site name.
3. App generates slug silently or in an advanced field if shown.
4. Backend checks plan limit and slug uniqueness on submit.
5. Backend creates site as draft.
6. Backend creates first site version or initial draft checkpoint if versioning is already implemented.
7. User is routed to editor.

Failure cases:

- Plan limit reached: do not create site.
- Slug conflict: ask user to adjust name/slug.
- Workspace missing/inaccessible: route to workspace selection.
- Network/server failure: keep modal state and allow retry.

### Duplicate Site Flow

Duplicating creates a new draft site from an existing site.

Rules:

- Duplicate is allowed for users who can edit the source or have `view_copy` access.
- Duplicate must enforce plan limits.
- Duplicate should copy draft content if duplicating from inside editor.
- Duplicate from Sites page should copy the latest draft for users with edit access; for view/copy-only users, copy the latest published snapshot if they cannot access draft.
- Duplicate should not copy analytics events.
- Duplicate should not copy public publish state.
- Duplicate should not copy variants by default for v1 unless explicitly offered.
- Duplicate should copy variables and their defaults because they are part of content.
- Duplicate should copy asset references safely. Assets should remain workspace-owned and reference-counted or retained.

New duplicated site:

- Status: draft
- Name: `Copy of {original name}` or similar
- Slug: generated unique slug
- Created by: duplicating user
- Visibility: private by default

V1 decision:

- Duplicated sites are private draft sites owned by the duplicating user.
- Team/site-specific access is not copied.
- Admins retain implicit admin access through workspace role rules.

### Archive And Restore Flow

Archive is the primary non-destructive removal action.

Archive behavior:

- Archived sites are hidden from default Sites page views.
- Archived sites are not publicly available.
- Archiving a published site unpublishes it immediately.
- Archiving should preserve draft content, published versions, variants, analytics, and access records.
- Tracking ingestion should reject new events for archived sites.

Restore behavior:

- Restoring an archived site returns it to draft.
- Restore does not automatically republish.
- Restore should preserve variants and version history.
- Restore should be available to admins and users with manage rights.

Confirmation copy should make clear:

- Published links will stop working.
- New tracking will stop.
- Existing analytics/history remain.

### Delete Site Flow

Decision for v1: do not support hard delete. Use archive as the destructive-feeling removal action.

If hard delete is added later:

- It should require stronger confirmation than archive.
- It should be limited to workspace admins or active site creators/editors with an explicit hard-delete permission.
- It should define whether analytics are deleted or anonymized.
- It should define asset cleanup.
- It should define whether slugs can be reused.

Avoid hard delete until retention, billing, and audit rules are decided.

### Site Row Actions

Row actions should be contextual:

Draft site:

- Edit
- Preview draft
- Publish
- Duplicate
- Share/team access
- Archive

Published site:

- Edit
- Open public link
- Share
- Variants
- Unpublish
- Duplicate
- Team access
- Archive

Archived site:

- Restore
- Duplicate, optional
- View history, optional

Actions the user cannot perform should be hidden or disabled with an explanation depending on context. Destructive unavailable actions should generally be hidden to reduce clutter.

## Publishing And Public Links

### Publishing Purpose

Publishing turns an internal draft into a stable public snapshot.

Publishing should guarantee:

- The public page can render without authenticated app state.
- Public visitors never see partial draft edits.
- The snapshot can be attributed to a site version.
- Variant links continue to resolve against the correct published site.
- Tracking can record the published version viewed.

### Publish Validation

Before publishing, validate:

- Site has a non-empty name.
- Site has a valid slug.
- Site belongs to an active workspace.
- Workspace slug is valid.
- Site is not archived.
- Current user can publish/edit the site.
- Draft content schema is valid.
- Required blocks have required fields.
- Referenced variables exist.
- Variable default values are valid for their type.
- Referenced assets exist and are accessible.
- Public rendering can produce metadata and OG image.

Warnings, not hard blockers:

- Missing subtitle.
- Missing custom OG image.
- Empty optional blocks.
- Variables with blank defaults if variants will supply values.

Hard blockers:

- Invalid content schema.
- Broken required asset references.
- Missing required URL/button target.
- Invalid embed URL.
- Site archived.
- User lacks permission.

### Publish Flow

1. User clicks Publish.
2. App opens publish dialog.
3. App runs validation or fetches validation result from backend.
4. Dialog shows public default link, variant count, last published state, and validation issues.
5. User confirms publish.
6. Backend validates again.
7. Backend creates an immutable `publish` site version from current draft.
8. Backend points `site.publishedVersionId` to the new version.
9. Backend sets status to `published`.
10. Backend sets `publishedAt` and `publishedByUserId`.
11. UI shows published state and enables share actions.

The publish transaction should be atomic. There should never be a state where status is `published` but no published version exists.

### Republish Flow

Republishing updates the public snapshot from the current draft.

Rules:

- Existing public URL stays the same unless slug changed before republishing.
- Existing variants remain.
- Current variant values continue to apply to variables with matching IDs.
- If the new draft removed a variable, old variant values for that variable become unused but should not necessarily be deleted immediately.
- If the new draft added a variable, variants fall back to the new variable default until customized.
- Analytics before and after republish should be distinguishable by published version ID.

Republish should create a new `publish` site version.

### Unpublish Flow

Unpublishing makes public links unavailable while preserving draft and history.

Rules:

- Status changes from `published` to `draft`.
- Published version can remain stored for history but is no longer served.
- Decision for v1: default site link returns 404.
- Variant links also return 404.
- Tracking ingestion rejects public events for unpublished site links.
- Share buttons remain visible in app only as disabled or explanatory states.

Confirmation should say:

- Visitors will no longer be able to access the site.
- Variant links will stop working.
- New tracking events will stop.
- Existing analytics and versions will remain.

### Public URL Structure

Default public site link:

```text
https://lightsite.app/{workspace-slug}/{site-slug}
```

Variant public link:

```text
https://lightsite.app/{workspace-slug}/{site-slug}/{variant-slug}
```

Rules:

- Public URL resolution should be case-insensitive for slugs by normalizing to lowercase.
- Redirect uppercase/mixedcase requests to canonical lowercase if needed.
- Query parameters should not affect identity unless explicitly supported later.
- Public rendering should not expose draft content.
- Public rendering should not expose private workspace/member data.

### Link Availability

A link is available when:

- Workspace exists and is active.
- Site exists in workspace.
- Site status is `published`.
- Site has a valid `publishedVersionId`.
- Variant link, if present, matches a variant for the site.
- Variant is not disabled/deleted if we add variant lifecycle later.

A link is unavailable when:

- Workspace slug not found.
- Site slug not found.
- Site is draft.
- Site is archived.
- Site has no published snapshot.
- Variant slug not found.
- Variant belongs to another site.

Recommended response:

- Unknown/unavailable public routes should return `404`.
- Do not reveal whether a draft/private/archived site exists.

### Share Modal

The Share modal should be available for published sites.

It should show:

- Default public link.
- Copy link action.
- Open link action.
- Variant entry point.
- Current publish state.
- Optional last published time.

If the site is draft:

- Share action should guide the user to publish first.
- Do not create public links that imply the site is live.

If the site is archived:

- Share action should be disabled or hidden.

### Variants Entry From Sharing

The Share modal and Variants button should connect cleanly:

- Share modal focuses on copying the default link and directing to variant links.
- Variants modal manages recipient-specific links and variable values.
- Creating a variant from share should return the user to a copyable variant link.

### Slack And Link Preview Behavior

Public links need OG metadata.

Rules:

- Every published site should have an OG title, description, and image.
- OG image should be configurable in the editor.
- If no custom OG image is set, use a Lightsite-generated default.
- Variant links may use the same OG image as the site unless variant-specific OG images are added later.
- OG image requests from Slack/preview bots can be used as a signal that a link was shared/unfurled, but this is probabilistic.

Do not overstate Slack share tracking:

- We can track likely Slack unfurls by detecting Slackbot/preview user agents requesting OG metadata/image.
- This does not prove a human shared the link in Slack in all cases.
- It may also be triggered by paste previews or automated tools.
- Analytics UI should label this carefully, such as "Slack preview loaded" rather than "Shared on Slack" unless confidence is high.

Cost/performance:

- OG images should be static or cached.
- Do not dynamically render expensive OG images for every request.
- If dynamic OG generation is needed, cache by site version and variant key.

## Site Version History And Rollback

### Version History Purpose

Version history lets users recover from mistakes, inspect previous states, and safely roll back after bad edits.

It should support:

- Automatic checkpoints.
- Publish checkpoints.
- Manual checkpoints are excluded from V1 unless explicitly scoped as a product requirement.
- Rollback to a previous version.
- Clear timestamps and actors.

### Site Version Fields

A site version should include:

- `id`
- `workspaceId`
- `siteId`
- `versionNumber`
- `kind`
- `label`
- `content`
- `variablesSnapshot`
- `createdByUserId`
- `createdAt`
- `publishedAt`, if this version was published
- `metadata`

Version kinds:

- `initial`
- `autosave`
- `manual`
- `publish`
- `rollback`
- `migration`

Rules:

- Versions are immutable.
- Version numbers are monotonically increasing per site.
- Version creation should be transactional with the state change that depends on it, especially publish and rollback.
- Versions should store enough data to render or restore the site even if the current draft schema changes later.

### What Creates A Version

Create a version when:

- Site is created: `initial`.
- Site is published: `publish`.
- User rolls back: `rollback`.
- Content migration changes saved content: `migration`.
- Autosave checkpoint interval is reached: `autosave`.

Autosave version strategy:

- Do not create a version for every keystroke.
- Draft autosave can update `sites.draftContent` frequently, but version checkpoints should be throttled.
- Recommended checkpoint cadence: create an autosave version at most every few minutes per actively edited site, and only when content changed meaningfully.
- Create a checkpoint when a different user begins editing after another user's changes, to improve recovery.
- Create a checkpoint before destructive operations like large block deletion, if practical.

### Rollback Behavior

Rollback restores a previous version into the current draft.

Rules:

- Rollback does not directly change the public published snapshot.
- After rollback, the site has draft changes and must be republished to affect public visitors.
- Rollback creates a new `rollback` version containing the restored content.
- Rollback should not delete later versions.
- Rollback should preserve the full history chain.
- Rollback should require edit permission.
- If the site is archived, rollback should be blocked until restored.

Flow:

1. User opens version history.
2. User selects a version.
3. App shows preview/details of that version.
4. User clicks restore.
5. Confirmation explains that current draft will be replaced and history will be preserved.
6. Backend creates a rollback version from selected content.
7. Backend updates current draft to selected content.
8. Editor reloads or applies restored document state.

### Version History UI

Version history should show:

- Version timestamp.
- Actor name/avatar.
- Version kind.
- Publish badge when relevant.
- Label when present.
- Restore action.
- Preview action.

The UI should avoid implying that restoring a version immediately changes the public site. It changes the draft. The user must publish/republish.

### Version Retention

Version history can grow quickly, so retention should be intentional.

V1 decision:

- Keep all publish, rollback, initial, and migration versions.
- Keep autosave versions with a retention policy.
- Collapse or prune dense autosave versions after a time window if storage becomes an issue.
- Never prune the currently published version.

Initial retention policy:

- Keep all autosave versions from the last 24 hours.
- Keep hourly autosave versions for the last 7 days.
- Keep daily autosave versions for the last 30 days.
- Keep publish/rollback/manual versions indefinitely, subject to plan/retention policy later.

Implementation sequencing:

- The schema must support retention pruning.
- The first implementation can keep all versions until volume requires pruning.
- Pruning must be centralized in one retention job, not scattered through editor code.

### Version And Variable Compatibility

Versions should preserve variable definitions as they existed at that time.

Rollback rules:

- Restoring an older version restores its variable definitions/defaults into draft.
- Existing variants may have values for variables that no longer exist in the restored version; keep those values but treat them as unused.
- Existing variants may be missing values for variables restored from the older version; fall back to restored defaults.
- Public variant rendering uses the currently saved variant values against the published snapshot's variable definitions.
- The variant editor should clearly label whether a variable is live on the published page or draft-only until the next publish.

This avoids destructive data loss and keeps rollback safe.

## Editor And Content Architecture

### Editor Purpose

The editor is where users build the draft version of a site.

It must feel fast, safe, and calm:

- Users should be able to edit without thinking about saving.
- Users should be able to undo mistakes immediately.
- Users should be able to recover from larger mistakes through version history.
- Multiple teammates should be able to edit the same site without overwriting each other.
- Public visitors should never see half-finished draft edits until the user publishes.

### Editor Product Shape

The editor has three main areas:

- Header: navigation, site name/status, variants, preview, share, publish, more menu.
- Canvas: the editable site content.
- Inspector sidebar: settings for the selected page/block/field.

The editor always edits the site's draft content.

Editor modes:

- **Edit mode**: normal editable draft state.
- **Preview mode**: renders the draft or selected variant as a visitor would see it, without publishing.
- **Variant preview mode**: renders draft or published content with a selected variant's variable values.
- **Read-only mode**: for users with view/copy access or archived sites.

### Editor State Boundaries

The editor should keep these state layers separate:

- **Canonical draft content**: persisted site draft JSON.
- **Local working state**: in-memory editor state with unsaved local changes.
- **Collaboration state**: active multi-user operations/presence for the current site.
- **Published snapshot**: immutable public content that is not edited directly.
- **Version history**: immutable checkpoints for restore/recovery.

Do not let these layers blur. Most editor bugs come from treating local working state, saved draft state, and published state as the same thing.

### Content Ownership

Lightsite should own the product content schema.

Tiptap/ProseMirror should power rich text editing inside rich-text fields, but the entire site should not be an opaque editor-specific blob.

Recommended architecture:

- Site content is a Lightsite JSON document.
- The document has a flat ordered array of product blocks.
- Blocks have stable IDs and typed data.
- Rich text fields inside blocks store Tiptap/ProseMirror JSON.
- Variable chips inside rich text are custom inline atom nodes.
- Non-rich-text block settings are normal typed JSON fields.

This gives us:

- Durable content independent of one editor implementation.
- Easier rendering on public pages.
- Easier validation and migrations.
- Easier analytics instrumentation per block.
- Easier future block additions.

### Tiptap Usage

Tiptap should be used where it is strongest:

- Rich text fields.
- Inline formatting.
- Link marks.
- Variable chips as inline atom nodes.
- Keyboard shortcuts inside text.
- Input/paste rules.
- Rich text undo/redo.

Tiptap should not own:

- Workspace/site lifecycle.
- Publishing.
- Public route resolution.
- Block ordering outside rich text.
- Variant data.
- Permissions.

Tiptap implementation rules:

- Use `immediatelyRender: false` for SSR-safe React setup where relevant.
- Use stable custom extensions for variable chips.
- Use schema-defined nodes/marks instead of one-off HTML parsing.
- Use commands for editor operations so toolbar/sidebar behavior is testable.
- Use input/paste rules carefully and make them undoable.
- Do not serialize arbitrary HTML as source of truth.

## Content Schema

### Goals

The content schema should be:

- Explicit.
- Versioned.
- Portable.
- Validatable.
- Easy to render publicly.
- Easy to migrate.
- Friendly to collaboration and partial updates.

### Top-Level Draft Content Shape

Conceptual shape:

```ts
type SiteContent = {
  schemaVersion: number
  header: SiteHeader
  settings: SiteSettings
  variables: SiteVariable[]
  blocks: SiteBlock[]
}
```

Rules:

- `schemaVersion` is required.
- `header` is always present.
- `settings` is always present.
- `variables` is the current draft variable registry.
- `blocks` is flat and ordered.
- No separate section entity exists in V1.

### Header Schema

The header is always present.

Conceptual shape:

```ts
type SiteHeader = {
  avatarMode: "single" | "duo"
  primaryAvatarAssetId?: string
  secondaryAvatarAssetId?: string
  title: RichTextValue
  subtitle?: RichTextValue
}
```

Rules:

- Header title is required.
- Header subtitle is optional.
- Header title and subtitle can contain text variables.
- Avatar can be the workspace logo copied at site creation.
- Duo avatar mode requires two avatar assets or clear fallback behavior.
- If avatar assets are missing or deleted, render a safe fallback.

Decision for v1:

- Support `single` avatar first.
- Keep schema capable of `duo`, but do not expose duo UI until the design/flow is ready.

### Site Settings Schema

Conceptual shape:

```ts
type SiteSettings = {
  showTableOfContents: boolean
  ogImageAssetId?: string
}
```

Rules:

- `showTableOfContents` defaults to false or true based on final product preference.
- OG image is configurable in the editor.
- If no OG image is set, use the Lightsite default OG image.
- Settings changes are draft changes and require publish/republish to affect public pages unless the setting is explicitly app-only.

### Block Schema

All blocks share common fields:

```ts
type BaseBlock = {
  id: string
  type: string
  createdAt: string
  updatedAt: string
  createdByUserId?: string
}
```

Rules:

- Block IDs are stable UUIDs or collision-resistant IDs.
- Block IDs never change during reorder.
- Reordering changes only block order, not block identity.
- Every block type has a typed data payload.
- Unknown block types should fail validation in the editor and render a safe unsupported-block fallback in internal previews.
- Public publish should block unknown unsupported block types.

### Flat Blocks, No Sections

Decision for v1: no section entity.

The site body is a flat ordered list of blocks.

Use divider blocks for visual separation:

- Regular divider.
- Full-width divider.
- Divider labels/titles are excluded from V1 and must not appear in the schema until intentionally designed.

Why:

- Simpler editor state.
- Simpler drag/reorder.
- Simpler collaboration operations.
- Fewer nested edge cases.
- Easier public rendering.

Revisit sections only if the product needs:

- Nested grouped drag behavior.
- Section-level templates.
- Section-level permissions.
- Section-level analytics grouping.
- Automatic table of contents grouping that cannot be solved with headings.

### Rich Text Value

Rich text fields should use JSON, not HTML.

Conceptual shape:

```ts
type RichTextValue = {
  type: "doc"
  content: ProseMirrorNode[]
}
```

Rules:

- Store only allowed nodes and marks.
- Sanitize and validate pasted content.
- Links should be marks with validated URLs.
- Variables should be inline atom nodes.
- Rendering should convert rich text JSON to safe React/HTML using our renderer, not `dangerouslySetInnerHTML`.
- Public rendering should have a strict allowlist of tags/attributes.

### Content Validation

Content validation should run:

- On editor load.
- Before autosave persistence.
- Before publish.
- During migration.
- During public rendering as a defensive check.

Validation should check:

- Schema version is supported.
- Header exists.
- Blocks are known and valid.
- IDs are unique.
- Variable references point to existing variables.
- Required fields are present.
- URLs are valid and allowed.
- Asset IDs exist and belong to the workspace.
- Embed domains are allowed.

Validation failure behavior:

- Editor load: show repair/recovery state if content is invalid.
- Autosave: reject invalid write and keep local state with error.
- Publish: block publish with actionable messages.
- Public rendering: fail closed with 404 or safe error; never leak stack traces.

### Content Migrations

Content schema changes should use explicit migrations.

Rules:

- Every content document has `schemaVersion`.
- Migrations are pure functions from one schema version to the next.
- Migrations should be tested with saved fixtures.
- Migrations should be idempotent where possible.
- Major migrations should create a `migration` site version.
- Public snapshots should either be migrated on read with caching or migrated in a controlled background job.

Avoid silent best-effort transforms in random render paths. Migrations should be centralized and observable.

## Blocks

### Block Design Principles

Blocks should be predictable, typed, and composable.

Rules:

- Every block has a stable `id`.
- Every interactive public element inside a block should have a stable element ID for tracking.
- Block settings should be explicit, not encoded in CSS class strings.
- Blocks should use design tokens and shadcn-compliant components in the editor UI.
- Public block rendering should not depend on authenticated app components.
- Blocks should be resilient to missing optional data.

### Text Block

Purpose:

- General rich text content.

Fields:

- `richText`

Supports:

- Bold
- Italic
- Links
- Bulleted/numbered lists if desired
- Inline variables

Rules:

- Text block can contain text variables.
- Text block should not contain arbitrary embeds.
- Empty text blocks are allowed during editing but should be cleaned up or ignored in public rendering if truly empty.

### Heading Block

Purpose:

- Structure the page and support table of contents.

Fields:

- `level`: likely `2` or `3` for body headings
- `richText`
- `includeInTableOfContents`

Rules:

- Heading text can contain text variables.
- Heading IDs for anchor links should derive from block ID, not heading text, so links do not break when text changes.
- Heading levels should be constrained to the site design.

### Button / Link Block

Purpose:

- Primary CTA or resource link.

Fields:

- `label`
- `url`
- `style`
- `elementId`

Variable support:

- Label can use text variables.
- URL can use URL/text variables if explicitly allowed and validated.

Rules:

- URL is required to publish.
- URLs must be validated and normalized.
- Public clicks should be tracked using `elementId`, label snapshot, and URL snapshot.
- External links should use safe attributes.
- If a URL is invalid, publish is blocked.

### Image Block

Purpose:

- Display uploaded image or image variable.

Fields:

- `assetId`
- `alt`
- `caption`
- `aspectRatio`
- `fit`
- `variableId`, optional

Rules:

- Image can be fixed asset or attached to an image variable.
- Alt text should be editable.
- Missing image should render a safe placeholder in editor and block publish only if the image is required.
- Public rendering should use optimized image URLs.

### Video / Embed Block

Purpose:

- Embed video or supported external content.

Fields:

- `url`
- `provider`
- `title`
- `aspectRatio`

Rules:

- Only allow supported providers/domains.
- Convert URLs to safe embed URLs server-side or through trusted parsing utilities.
- Do not allow arbitrary iframe HTML from users in v1.
- Publish blocks invalid or unsupported embed URLs.
- Track clicks/interactions only where technically possible and privacy-safe.

### Divider Block

Purpose:

- Visual separation in place of sections.

Fields:

- `width`: `content` or `full`
- `spacing`

Rules:

- Divider is a real block and can be reordered.
- Full-width means full site content width according to the site design, not browser viewport unless explicitly designed.
- Divider has no public tracking by default.
- Divider labels are excluded from V1. If added, they must be accessible and represented in the block schema.

### Accordion Block

Purpose:

- Compact FAQ or grouped details.

Fields:

- `items`: array of title/body pairs
- `allowMultipleOpen`, optional

Rules:

- Item titles can contain text variables.
- Item bodies can contain rich text and variables.
- Items have stable IDs for reordering/tracking if needed.
- Empty item title/body blocks block publishing until the user fixes or removes them.

### Table Block

Purpose:

- Compare pricing, options, implementation plans, or structured details.

Fields:

- `columns`
- `rows`

Rules:

- Cells can contain plain text or constrained rich text.
- Variables can be allowed in text cells.
- Keep v1 table simple: no merged cells, nested blocks, or formulas.
- Validate max rows/columns to avoid layout/performance problems.

### Testimonial Block

Purpose:

- Show customer quote/social proof.

Fields:

- `quote`
- `personName`
- `personTitle`
- `company`
- `avatarAssetId`

Rules:

- Text fields can use variables where useful.
- Missing avatar should render a fallback.
- Quote is required to publish if block exists.

### Logos Block

Purpose:

- Show customer/partner logos.

Fields:

- `logos`: array of asset references with names/alt text

Rules:

- Each logo has stable ID.
- Alt/name required for accessibility.
- Validate max logo count.
- Missing assets should block publish or be removed with confirmation.

### Calendar Embed Blocks

Supported initial calendar blocks:

- Cal.com embed.
- Calendly embed.

Rules:

- Store provider-specific config in typed fields.
- Do not store arbitrary embed scripts.
- Validate allowed domains and URL structure.
- Calendar booking-complete tracking is excluded from V1 unless a supported provider exposes a reliable, privacy-safe event.
- Embed loading should not block the entire public page.
- Public rendering should lazy-load embeds where possible.

### Unsupported Or Future Blocks

Unknown future blocks should be handled safely:

- Editor: show unsupported block with type and recovery options.
- Public publish: block publishing unsupported blocks.
- Public render: if an old published snapshot contains a now-unsupported block, render a safe fallback or migrate.

## Variables

### Variable Purpose

Variables define which parts of a site can be personalized per variant.

They should be treated as first-class site-level objects, not just string placeholders.

### Variable Schema

Conceptual shape:

```ts
type SiteVariable = {
  id: string
  key: string
  label: string
  type: "text" | "image" | "url"
  defaultValue: VariableValue
  createdAt: string
  updatedAt: string
}
```

Variable value shape:

```ts
type VariableValue =
  | { type: "text"; value: string }
  | { type: "image"; assetId?: string; alt?: string }
  | { type: "url"; value: string }
```

Rules:

- `id` is stable and used internally.
- `key` is human-readable and shown in chips like `{{company_name}}`.
- `key` must be unique within the site.
- `key` should be lowercase snake_case.
- `label` can be human-friendly for UI.
- Variable type cannot be changed casually if existing content/variants rely on it.

### Variable References In Content

Variables in rich text should be inline atom nodes.

Conceptual Tiptap node attributes:

```ts
{
  type: "variable",
  attrs: {
    variableId: "var_123",
    key: "company_name"
  }
}
```

Rules:

- `variableId` is the source of truth.
- `key` is included for readability and fallback display.
- If `key` changes, references remain stable because they use `variableId`.
- If a referenced variable is deleted or missing, render a broken-variable chip in the editor and block publish until resolved.

### Creating Variables

Creation entry points:

- Insert Variable menu.
- Add Variable button in inspector fields.
- Typing/pasting a recognized variable pattern, if supported.

Flow:

1. User opens Insert Variable.
2. User selects an existing variable or chooses New Variable.
3. User enters key/name and default value.
4. App validates key uniqueness locally and server-side.
5. Variable is created in draft variable registry.
6. Variable chip is inserted into the current field.

Rules:

- Creating a variable is a draft content change.
- Creating a variable should participate in undo/redo.
- Variable creation should sync to other active editors.
- If two users create the same key concurrently, server should resolve by accepting one and returning conflict for the other.

### Renaming Variables

Renaming changes the key/label, not the variable ID.

Rules:

- All chips update display because they reference the same variable ID.
- Variant values stay attached because they key by variable ID.
- Key uniqueness must be validated.
- Rename should create a draft change and sync to collaborators.
- Publish should use the new key in rendered output only for display/debug, not identity.

### Deleting Variables

Deleting variables is risky because variants may contain values.

V1 behavior:

- If variable is used in content, block deletion and show where it is used.
- User must remove all references first.
- If variable is unused in content but has variant values, allow deletion with confirmation.
- Deleting a variable does not immediately hard-delete historical values from versions.
- Variant values for deleted variables may be retained as orphaned/unused data for recovery until cleanup.

### Variable Defaults And Variant Overrides

Resolution order:

1. Variant override, if present and non-empty.
2. Site variable default value.
3. Type-specific empty fallback.

Rules:

- Blank text override means use default unless the product explicitly adds "force blank."
- Missing image override means use default image.
- Missing URL override means use default URL.
- Invalid variant override should be surfaced in variant editor and block saving/publishing if it would break a published page.

### Variable Types

V1 variable types:

- Text
- Image
- URL

Text:

- Can appear in rich text fields, headings, button labels, accordion text, table cells, testimonial fields.

Image:

- Can appear in image blocks, avatars, testimonial avatars, logo-like fields where supported.

URL:

- Can appear in button/link URLs and supported URL fields.

Do not allow every variable type everywhere. Each field should declare which variable types it accepts.

### Variable Menu

Insert Variable menu should show:

- Existing variables.
- Variable type.
- Search/filter.
- New Variable action.

New Variable flow should collect:

- Key/name.
- Type.
- Default value.

The menu should be fast and local for normal sites. Server writes happen through the editor save/collaboration system, not every menu keystroke.

## Autosave, Undo, Redo, And Recovery

### Autosave Goals

Autosave should protect work without making the app expensive or noisy.

Rules:

- Autosave updates draft content, not published content.
- Autosave should be batched and debounced.
- Autosave should save meaningful document changes, not every cursor movement.
- Autosave status should be visible but unobtrusive.
- Failed autosave should not silently discard local work.

Recommended behavior:

- Debounce normal content saves around 800-1500ms after edits.
- Flush pending changes on blur, route change, tab visibility hidden, and editor unmount where possible.
- Save block operations in batches.
- Do not persist presence/cursor updates to Postgres.
- Do not create a version checkpoint for every autosave.

Autosave states:

- Saved.
- Saving.
- Unsaved changes.
- Offline/reconnecting.
- Save failed.

Save failure behavior:

- Keep local changes in memory.
- Retry with backoff.
- Warn before navigating away if there are unsaved local changes that have not been persisted.
- If conflict cannot be resolved automatically, show recovery UI with local and server states.

### Dirty State

Dirty state means draft differs from the last successfully persisted draft.

Published-dirty state means draft differs from the currently published version.

The UI should distinguish:

- "Saving..." for persistence.
- "Saved" for draft persistence.
- "Unpublished changes" for draft changes not reflected publicly.

These are different and should not be conflated.

### Undo / Redo

Undo/redo should be local to the user's editor session.

Rules:

- Undo reverts the current user's recent local operations.
- Undo should not blindly revert other users' collaborative changes.
- Redo reapplies the user's undone local operations.
- Undo stack can reset after full page reload.
- Version history covers cross-session recovery.
- Rollback covers larger recovery.

In collaborative editing:

- Rich text should use a collaboration-aware undo manager if using CRDT/Yjs.
- Block-level undo should track local operations and transform/validate against current document state.
- If an operation can no longer be undone cleanly because another user changed the same object, show a small failure state rather than corrupting document order.

Keyboard shortcuts:

- `Mod+Z`: undo.
- `Mod+Shift+Z` / `Mod+Y`: redo.
- Shortcuts apply to the focused editor field/block.

Undoable operations:

- Text edits.
- Variable insertion.
- Block insert.
- Block delete.
- Block reorder.
- Inspector field changes.
- Variable create/rename/delete when safe.

Not necessarily undoable:

- Publish.
- Unpublish.
- Archive.
- Restore from version history.
- Team access changes.

Those are recovered through confirmations, lifecycle actions, and version history.

### Recovery

Recovery paths:

- Local undo/redo for immediate mistakes.
- Autosave retry for transient network failures.
- Version history rollback for larger mistakes.
- Published snapshot remains stable until republish.

The editor should avoid scary data-loss states:

- If save fails, keep editing possible when safe.
- If collaboration disconnects, continue locally and reconnect when possible.
- If the user loses permission while editing, stop accepting writes and explain what happened.
- If the site is archived by another user while open, switch to read-only and show archived state.

## Multi-User Editing And Sync

### Collaboration Goals

Multiple users editing the same site should see each other's changes without overwriting work.

The system should be:

- Good enough for normal sales-team collaboration.
- Cheap to run.
- Resilient to disconnects.
- Explicit about conflict boundaries.
- Built so richer realtime can be added without replacing the content model.

### V1 Collaboration Model

Use active-session realtime sync only inside the editor.

Architecture:

- WebSocket connection per active editor tab.
- Room/channel per `siteId`.
- Server verifies user workspace membership and site edit permission before joining.
- Presence messages are ephemeral.
- Content changes are sent as typed operations or CRDT updates.
- Server broadcasts changes to other active editors.
- Persistence is debounced/batched to Postgres.

Do not use realtime subscriptions across the whole app. Only editor sessions need live collaboration.

### Change Representation

Represent changes as operations, not whole-document overwrites, wherever practical.

Operation categories:

- Block insert.
- Block update.
- Block delete.
- Block reorder.
- Header update.
- Settings update.
- Variable create/update/delete.
- Rich text update.
- Asset attach/detach.

Each operation should include:

- Operation ID.
- Site ID.
- Client ID/session ID.
- Actor user ID.
- Base document revision or CRDT clock.
- Timestamp.
- Operation payload.

Rules:

- Operation IDs should make retries idempotent.
- Server should ignore duplicate operation IDs from the same client/session.
- Operations should be validated before applying.
- Operations should be permission-checked before applying.

### Rich Text Collaboration

For rich text fields, use a collaboration-aware approach.

Recommended path:

- Use Tiptap/ProseMirror with Yjs or an equivalent CRDT layer for rich text fields.
- Use custom variable atom nodes inside the rich text schema.
- Persist rich text as part of the product content snapshot.
- Keep Yjs/CRDT implementation details out of public rendering.

Why:

- Rich text concurrent editing is hard to make correct with last-write-wins.
- CRDTs handle simultaneous text edits better.
- Tiptap has established collaboration patterns.

Cost control:

- Only create collaboration rooms for active editor sessions.
- Close rooms when no clients remain.
- Persist snapshots on debounce rather than every CRDT update.
- Do not store every CRDT update forever unless needed for debugging.
- Version checkpoints are separate from raw collaboration update streams.

### Block-Level Collaboration

Block operations should use stable IDs and deterministic ordering.

Rules:

- Reorder operations should operate on block IDs, not array indexes only.
- If two users reorder simultaneously, server should apply operations deterministically.
- If one user deletes a block while another edits it, delete wins for document structure, but the editor may offer recovery through undo/version history.
- Scalar setting conflicts can use last-write-wins with actor/timestamp metadata.
- Rich text conflicts should be handled by CRDT.

Ordering strategy:

- Use ordered list with stable block IDs.
- For high-concurrency ordering, consider fractional positions or CRDT array type.
- V1 can use server-sequenced operations as long as all clients converge to server order.

### Presence

Presence should include:

- User ID.
- Name/avatar.
- Current selected block ID.
- Current field/selection summary when safe.
- Last active timestamp.

Rules:

- Presence is ephemeral.
- Presence is not written to Postgres.
- Presence heartbeat should be low frequency, such as every 10-20 seconds, plus immediate updates on selection changes with debounce.
- Disconnect stale presence automatically.
- Do not expose private user info to public site visitors.

### Persistence Strategy

Persistence should be low-cost and durable.

Recommended approach:

- Apply accepted operations to the server's current room/document state.
- Broadcast accepted operations to connected clients.
- Debounce draft persistence to Postgres.
- Persist immediately on important boundaries: publish, rollback, editor close where possible, permission loss, server shutdown hook where possible.
- Store latest `documentRevision` on the site draft.
- Use optimistic client UI but treat server acceptance as canonical.

Persistence cadence:

- Batch frequent edits.
- Avoid writes for cursor/presence.
- Avoid writes for every keystroke when CRDT updates are very frequent.
- Create version checkpoints less frequently than draft persistence.

Failure behavior:

- If persistence fails but room is active, keep retrying and show save failed state.
- If server restarts, clients reconnect and reload latest persisted draft.
- Clients with unsaved local changes should attempt to resubmit after reconnect.
- If the server rejects operations after reconnect due to stale permissions or archived state, switch to read-only and preserve local recovery where possible.

### Permissions During Collaboration

Permissions can change while a user is editing.

Rules:

- Joining a room requires edit permission.
- Server should periodically or event-trigger validate active editor permissions.
- If user loses edit permission, server should stop accepting operations and notify client.
- Client should switch to read-only.
- If site is archived/unpublished/published by another user, clients should receive state updates.

Publishing while others edit:

- Publishing should use the latest persisted/accepted draft state.
- If there are active unsaved collaboration operations, publish should either flush them first or block until save catches up.
- Publish response should tell all active editors that a new published version exists.

Rollback while others edit:

- Rollback is a disruptive operation.
- It should require confirmation if other editors are active.
- After rollback, active editors should reload from the restored draft or receive a full document replacement operation.
- Local undo stacks may reset after rollback.

### Performance And Cost Guardrails

Guardrails:

- Realtime only in editor rooms.
- No database writes for presence.
- Debounced content persistence.
- Throttled version checkpoints.
- Lazy-load heavy editor extensions.
- Lazy-load embeds in public rendering.
- Cap max blocks, table sizes, accordion items, image sizes, and rich text document size.
- Use asset optimization and CDN caching for public media.
- Validate payload sizes on every write.

Suggested limits for v1, adjustable:

- Max blocks per site: 100.
- Max rich text field size: define by character/node count before implementation.
- Max image upload size: define in asset spec.
- Max table size: 10 columns x 100 rows or smaller if design demands.
- Max accordion items: 25.

These limits protect the editor, public rendering, tracking payloads, and database costs.

## Variants And Recipient Personalization

### Variant Purpose

A variant is a recipient-specific link for a site.

It lets a sales user:

- Personalize content using variable overrides.
- Send a unique trackable link to a prospect or account.
- Understand engagement for that recipient/account.

A variant is intentionally lightweight. It should not fork site content or create a copy of the page.

### Variant Fields

A variant should include:

- `id`
- `workspaceId`
- `siteId`
- `name`
- `slug`
- `recipientName`
- `recipientCompany`
- `variableValues`
- `revisionNumber`
- `status`, if variant lifecycle is added later
- `createdByUserId`
- `updatedByUserId`
- `createdAt`
- `updatedAt`
- `lastViewedAt`
- `viewCount`, optional cached summary

Notes:

- Variant variable values must be stored by stable `variableId`, not by mutable variable key/name.
- Store `workspaceId` on variants if it materially improves query simplicity and permission checks. Even though site implies workspace, denormalizing `workspaceId` can make analytics and list queries cheaper and safer when constrained by workspace.
- Variant changes are live link configuration. Changing a variant value for a variable that exists in the current published snapshot affects that variant's public page after save, without republishing site structure.
- Every variant save should increment `revisionNumber`, update `updatedAt`, and emit audit/activity metadata so live public personalization changes are traceable.

### Variant URL

Variant public link:

```text
https://lightsite.app/{workspace-slug}/{site-slug}/{variant-slug}
```

Rules:

- Variant slug is unique within a site.
- Variant slugs remain reserved while the variant is soft-deleted so old links cannot accidentally resolve to a different recipient later.
- Variant slug follows standard slug rules.
- Variant slug should be editable.
- Variant slug changes should warn that old links stop working unless redirects are implemented.
- Decision for v1: do not implement variant slug redirects.
- Changing a variant slug invalidates the old link after confirmation.
- Changing a variant slug must reserve the previous slug as a tombstone so it cannot be reused by another variant while historical links may exist.

Default variant:

- The base site link is not a stored variant.
- The base site link renders with default variable values and tracks events with no `variantId`.
- The UI may call this "Default link" or "Default version," but the database does not need a fake default variant row.

### Variant Lifecycle

V1 can keep variant lifecycle simple:

- Variants exist or are deleted.
- There is no separate published/draft state for variants.
- A variant link is usable only when the parent site is published.
- Variant metadata and variable override changes are saved live. Site content, layout, default variables, and settings still require publish/republish.

Future lifecycle states may include:

- Active
- Disabled
- Archived

Decision for v1:

- No disabled/archive state for variants.
- Delete removes the variant from active use, but analytics retain historical `variantId` references where possible.

### Variant List Modal

The Variants modal should support:

- Search variants.
- View variant names.
- Create new variant.
- Open/edit existing variant.
- Duplicate variant.
- Delete variant.
- Copy variant link.

Initial state:

- Title: Site Variants.
- Description: "Customize your site content and tracking link for each recipient."
- Search input.
- List of variants.
- New Variant button.

List item behavior:

- Shows variant name.
- Hover reveals quick actions like duplicate and delete.
- Clicking row opens edit variant state.
- Copy link can be available either in row actions or edit state.

Empty state:

- Explain variants personalize content and tracking per recipient.
- Primary action: New Variant.

### Create Variant Flow

Flow:

1. User opens Variants modal.
2. User clicks New Variant.
3. App opens variant edit form.
4. User enters name.
5. App generates editable slug from name.
6. App shows variable value fields from current draft or published context.
7. User fills overrides as needed.
8. Backend validates name, slug, permissions, variable values, and slug reservation conflicts.
9. Backend creates variant.
10. UI shows copyable variant link.

Default values:

- Name starts empty.
- Slug generated from name.
- Variable overrides start blank, meaning use defaults.

Creation should not require every variable to be overridden.

### Edit Variant Flow

Variant edit form should include:

- Name.
- Custom link slug.
- Variable values.
- Copy link action.
- More menu with duplicate/delete.
- Save Variant button.

Rules:

- Save validates all fields server-side.
- Slug uniqueness is checked with debounce and repeated on save against active variants, soft-deleted variants, and slug reservations.
- Variable fields are generated from the current variable registry and labeled by whether they affect the current published snapshot.
- Blank override means fallback to default.
- Invalid URL/image/text overrides block save.
- If parent site is unpublished, the form can still edit variant values, but link copy/open should explain the site must be published before the link works.
- If the parent site is published, saving a value for a published variable updates the public variant output after save.
- If the field is draft-only, saving it has no public effect until the site is republished with that variable.

### Duplicate Variant Flow

Duplicating a variant creates a new variant with copied variable overrides.

Rules:

- New name should be generated, such as `Copy of {variant name}`.
- New slug should be generated and made unique.
- Variable overrides are copied.
- Analytics are not copied.
- Created by is the duplicating user.
- Duplicate requires edit/manage permission on the site.

Use cases:

- Same company, different stakeholder.
- Similar personalization for a new account.

### Delete Variant Flow

Deleting a variant should require confirmation.

Confirmation should explain:

- The variant link will stop working.
- Existing analytics remain.
- The variant slug remains reserved while retained so the old link cannot point to a different recipient.
- This cannot be undone through normal UI unless we add variant archive/restore later.

Rules:

- Deleting a variant should not delete analytics events.
- Analytics events should keep `variantId` if referential integrity allows soft deletion.
- If hard-deleting variants would set analytics `variantId` to null, keep enough denormalized label/name metadata on analytics events to preserve historical meaning.

V1 decision:

- Soft-delete variants with `deletedAt`.
- Public route treats deleted variants as 404.
- Variant list hides deleted variants by default.
- Do not allow creating another variant with the same slug while the deleted variant is retained.
- Do not allow creating another variant with any prior slug reserved by a variant slug tombstone.

This preserves tracking history and avoids confusing analytics.

### Variant Variable Values

Variant values are stored by variable ID.

Conceptual shape:

```ts
type VariantVariableValues = Record<string, VariableValue>
```

Where the key is `variableId`.

Rules:

- Do not key variant values by variable key/name.
- Keep values for missing/deleted variables as inactive/orphaned values until cleanup.
- Show active variable fields based on current site variable registry.
- Preserve inactive values so rollback can recover them.
- Validate values according to variable type.

Type behavior:

- Text variable: text input or textarea depending on intended field usage.
- Image variable: image upload/asset picker with clear/remove.
- URL variable: URL input with normalization/validation.

### Variant Resolution

When rendering a variant:

1. Load published site snapshot.
2. Load site variables from the published snapshot.
3. Load variant by slug for the same site.
4. For each variable reference, resolve value:
   - Variant override if present and non-empty.
   - Published snapshot default.
   - Type-specific fallback.
5. Render resolved content.
6. Track view/clicks with `variantId`.

Important:

- Public variant rendering should resolve against the published snapshot, not the latest draft variables.
- Public rendering uses the latest saved variant value for variables present in the published snapshot.
- Variant edit UI may show draft variables while editing if the user is in draft context, but those fields must be labeled as unpublished.
- If a draft has unpublished variable changes, user should understand those variables need republish before public output changes.
- Tracking events should include the variant revision number or revision ID used at render time so analytics can explain changes in public personalization.

### Variant Preview

Variant preview should allow users to preview:

- Draft content with selected variant values.
- Published content with selected variant values, if the site is published.

The UI should clearly label which one is being previewed.

V1 decision:

- Editor preview uses current draft with selected variant values.
- Public/open-link preview uses published snapshot with selected variant values.
- Publish dialog can warn if draft variables differ from published variables.

### Variant Permissions

Variant management follows site edit/manage permissions.

Rules:

- Users who can edit a site can create/edit/delete variants.
- Users with view/copy access can view/copy variant links if the site is shared with them, but should not edit variant values unless granted edit.
- Workspace admins can manage all variants.
- Public visitors cannot list or infer variants.

### Variant Edge Cases

- Parent site unpublished: variant links return 404.
- Parent site archived: variant links return 404.
- Variant deleted: variant link returns 404.
- Variant slug changed: old link returns 404 in v1.
- Variable removed from site: old variant value becomes inactive but preserved.
- Variable type changed: block type change if existing values are incompatible unless a migration path is provided.
- Variant name duplicate: allowed if slug differs, though UI may warn. Slug is the unique public identifier.
- Slug collision during save: return conflict and keep form open.

## Sharing

### Sharing Purpose

Sharing is how users copy and manage links for prospects.

There are two link types:

- Default site link.
- Variant recipient link.

Sharing should always make publish state obvious. Users should not copy a link that appears live when it will 404.

### Share Modal Behavior

Published site:

- Show default public link.
- Show copy button.
- Show open link button.
- Show variant management entry point.
- Show latest published timestamp.
- Optionally show "unpublished changes" indicator if draft differs from published snapshot.

Draft site:

- Show message that the site must be published before sharing.
- Primary action: Publish.
- Do not show a live-looking copyable public link unless clearly marked unavailable.

Archived site:

- Sharing disabled.
- Explain that archived sites are not public.

### Copy Link Behavior

Rules:

- Copy action should write canonical URL to clipboard.
- Show success/failure feedback.
- If clipboard API fails, select/show URL for manual copy.
- Copying a link can be tracked as internal app analytics later, but not public prospect analytics.

### Link Warnings

Warn users when:

- Changing workspace slug would affect all public links. Blocked after publish in v1.
- Changing published site slug is attempted. Blocked in v1.
- Changing variant slug will break that variant link. Allowed with confirmation in v1.
- Unpublishing will make all site and variant links unavailable.
- Archiving will make all links unavailable and stop tracking.

### Link Redirects

Decision for v1:

- No workspace/site/variant slug redirects.
- Block workspace/site slug changes after publish.
- Allow variant slug changes with warning, old link 404s.

Future redirect support should use explicit redirect tables:

- Workspace slug redirects.
- Site slug redirects scoped to workspace/site.
- Variant slug redirects scoped to site/variant.

Redirects should avoid ambiguous chains and should have loop protection.

## Public Site Rendering

### Public Rendering Purpose

Public rendering serves published sites to prospects.

It should be:

- Fast.
- Stable.
- Cacheable.
- Safe.
- Independent from authenticated app state.
- Strictly based on published snapshots.

Public rendering is not the editor. It should not load editor-only code, collaboration code, internal member data, or draft content.

### Public Route Resolution

Routes:

```text
/{workspace-slug}/{site-slug}
/{workspace-slug}/{site-slug}/{variant-slug}
```

Resolution steps:

1. Normalize slugs to lowercase.
2. Find active workspace by workspace slug.
3. Find site by workspace and site slug.
4. Confirm site status is `published`.
5. Confirm site has `publishedVersionId`.
6. If variant slug is present, find active variant by site and variant slug; if the slug is reserved/tombstoned or belongs to a deleted variant, return public-safe 404.
7. Load published site version.
8. Resolve variables.
9. Render public page.
10. Start tracking only after a valid public page is served.

Fail closed:

- Workspace missing: 404.
- Site missing: 404.
- Site draft: 404.
- Site archived: 404.
- Published version missing: 404 and internal error alert/log.
- Variant missing/deleted: 404.
- Variant belongs to another site: 404.

Do not reveal whether a private draft exists.

### Public Payload

Public rendering should receive a minimal payload:

- Workspace public display fields needed for the page.
- Site public fields.
- Published content snapshot.
- Resolved variable values.
- Public asset URLs.
- Tracking configuration.
- SEO/OG metadata.

It should not include:

- Workspace member list.
- User emails.
- Draft content.
- Unused variants.
- Internal permissions.
- Invite data.
- Billing data.
- Raw secret tokens.

### Snapshot Rendering

Public rendering uses published version content.

Rules:

- Do not render `sites.draftContent` publicly.
- Do not render unpublished variable definitions publicly.
- Do not fetch editor collaboration state.
- Do not modify the published snapshot during rendering.
- Rendering should be deterministic for the same snapshot and variant values.

If a public page throws during render:

- Show a safe error page or 404.
- Log enough internal metadata to diagnose: workspace ID, site ID, published version ID, variant ID if present, error code.
- Do not show stack traces or raw content in the public response.

### Variable Resolution In Public Rendering

Resolution uses the published snapshot's variable registry.

For each variable reference:

1. Find variable definition in published snapshot.
2. If variant exists, find variant value for `variableId`.
3. If variant value is present and valid, use it.
4. Otherwise use published default value.
5. If default is also missing, use safe type fallback.

Type fallbacks:

- Text: empty string or visible fallback only in internal preview, not public.
- Image: omit image or render designed placeholder if required by layout.
- URL: omit/disable link if optional; block publish for required URL fields.

Public rendering should avoid visible broken variable chips. Broken variable references should be caught at publish validation.

### Public Page HTML

Public HTML should include:

- Valid title.
- Meta description.
- Canonical URL.
- Open Graph tags.
- Twitter card tags if useful.
- Favicon/app metadata.
- Initial HTML content for fast first paint.
- Minimal hydration if interactivity is needed.

Performance goals:

- Public pages should be fast on mobile.
- Avoid loading editor libraries on public pages.
- Avoid loading all shadcn/internal app components if a smaller public rendering bundle can be used.
- Lazy-load heavy embeds and media.
- Use optimized images.
- Keep tracking script small and defer non-critical work.

### SEO And Indexing

These are sales one-pagers sent to prospects, not SEO landing pages by default.

Decision for v1:

- Public sites default to `noindex,nofollow`.
- No customer-facing indexing setting ships in V1.
- OG previews should still work with `noindex`.
- Robots behavior should not block Slack/LinkedIn/email preview bots from fetching metadata/images.

Future:

- Search indexing requires an explicit product decision, workspace/site opt-in, and privacy review.
- Custom domains require the custom-domain routing and verification model defined later in this spec.

### OG Metadata

Every published site should have:

- `og:title`
- `og:description`
- `og:image`
- `og:url`
- `og:type`

Defaults:

- Title: site header title resolved with default/variant values where safe.
- Description: site subtitle or default workspace/site description.
- Image: configured site OG image or Lightsite default OG image.

Rules:

- OG image is configurable in editor.
- If no custom OG image exists, use a generated/default Lightsite image.
- Variant links can use the same OG image as the base site in v1.
- If title/subtitle contain variables, variant links may resolve them for OG metadata if doing so is cheap and safe.
- OG metadata must be generated from published snapshot, not draft.

### OG Image Strategy

Decision for v1:

- Use uploaded/configured OG image if present.
- Otherwise use a static Lightsite default OG image.
- Do not build expensive dynamic OG rendering until required.

Future dynamic OG:

- Generate image per published version.
- Cache generated image by `siteId` and `publishedVersionId`; include `variantId` only if variant-specific OG images are added.
- Never regenerate on every request.
- Store generated images as assets or cache them at the edge.

### Slack And Preview Bot Handling

Slack and other apps load OG metadata/images to create previews.

We can use this as a signal:

- Slackbot requests page metadata.
- Slackbot requests OG image.
- Similar preview bots may do the same.

Rules:

- Treat bot preview loads differently from human page views.
- Do not count preview bot metadata requests as normal site visits.
- Record a separate event such as `link_preview_loaded`.
- Include detected platform when confident: Slack, LinkedIn, Microsoft Teams, etc.
- Label analytics carefully. Use "Slack preview loaded" rather than "Shared on Slack" unless we have stronger evidence.

Implementation notes:

- Detection uses user-agent and requested resource.
- Store bot classification in metadata.
- Keep bot detection list maintainable and testable.
- Avoid high-cardinality raw user-agent storage in primary analytics tables; store normalized bot/client fields and optional raw data with retention limits if needed.

### Public Caching

Public pages should be cache-friendly but must respect publish/unpublish.

Recommended strategy:

- Cache rendered public pages by workspace slug, site slug, published version ID, and variant slug plus variant revision when a variant is present.
- Cache assets aggressively with immutable URLs.
- Use short TTL or explicit invalidation for route-level HTML if deployment stack supports it.
- On publish/republish/unpublish/archive, invalidate affected public route cache.
- Variant pages can be cached if variable resolution is deterministic, includes variant revision in the cache key, and does not include visitor-specific data.

Important:

- Do not cache draft/unpublished 404s forever.
- Do not cache permission-dependent authenticated app responses as public.
- Do not put tracking identifiers into cache keys unless necessary.

### Public Error Pages

Public error behavior:

- 404 for missing/unpublished/archived/deleted resources.
- Generic unavailable page only if product wants branded messaging later.
- Never reveal "this site is unpublished" to unauthenticated visitors.
- Never reveal workspace/team/member details.

### Public Rendering Security

Security rules:

- No arbitrary user HTML.
- Strict rich text renderer allowlist.
- Sanitize URLs.
- Disallow `javascript:` and dangerous protocols.
- Restrict iframes/embeds to supported providers.
- Use safe link attributes for external links.
- Use Content Security Policy where practical.
- Do not expose secret tokens or internal IDs unnecessarily.

### Public Rendering Observability

Log:

- Public render failures.
- Missing published snapshots.
- Asset resolution failures.
- Embed provider validation failures.
- Unexpected variable resolution failures.

Do not log:

- Full visitor IP unless required and privacy-reviewed.
- Sensitive query params.
- Secret tokens.
- Full page content unless in controlled debug tooling.

## Tracking And Analytics

### Tracking Purpose

Tracking tells sales teams whether a prospect engaged with a shared site.

It should answer:

- Did they open it?
- Which link did they open?
- Was it the default link or a variant?
- How long did they spend?
- How far did they scroll?
- What did they click?
- Did a link preview/unfurl happen in Slack or another tool?

Tracking should be useful without becoming invasive or expensive.

### Privacy Principles

- Track engagement with the shared site, not personal browsing beyond the site.
- Do not require cookies for basic tracking if a privacy-safe session token is enough.
- Avoid storing raw IP addresses by default.
- Avoid storing full raw user-agent indefinitely.
- Do not fingerprint aggressively.
- Be clear internally that analytics are directional, not perfect identity proof.
- Public visitor tracking should not expose visitor data to other visitors.

### Event Taxonomy

Core event types:

- `site_viewed`
- `heartbeat`
- `scroll_depth_reached`
- `element_clicked`
- `button_clicked`
- `link_clicked`
- `calendar_booked`
- `link_preview_loaded`

Notes:

- `button_clicked` can be a specialized form of `element_clicked`.
- `link_clicked` can be used for normal links if useful.
- `calendar_booked` is excluded from V1 unless a supported provider exposes a reliable, privacy-safe booking event.
- `link_preview_loaded` is for Slack/preview bots and should not count as a human view.

### Visitor Session

A visitor session groups events from one public page visit.

Visitor session fields:

- `id`
- `workspaceId`
- `siteId`
- `variantId`, nullable for default link sessions
- `variantRevision`, nullable and present when a variant was rendered
- `publishedVersionId`
- `startedAt`
- `lastSeenAt`
- `endedAt`, optional/inferred
- `durationMs`, computed/inferred
- `maxScrollDepth`
- `referrerHost`
- `browserName`, optional normalized
- `osName`, optional normalized
- `deviceType`, optional normalized
- `country`, optional if privacy/product allows
- `isBot`
- `botName`, optional

Rules:

- Session ID should be opaque and random.
- Store session ID in memory/session storage where possible, not necessarily long-lived cookies.
- A new public page open can create a new session.
- If the visitor reloads quickly, it is acceptable to create a new session in v1 unless session continuity is needed.
- Do not use session ID to track users across unrelated Lightsite sites unless explicitly designed and privacy-reviewed.
- Any `anonymousVisitorId` must be scoped to the site/link context or another privacy-reviewed boundary. Do not create a global cross-workspace visitor identifier in v1.

### Event Fields

Analytics event should include:

- `id`
- `workspaceId`
- `siteId`
- `variantId`, nullable for default link events
- `variantRevision`, nullable and present when a variant was rendered
- `publishedVersionId`
- `visitorSessionId`
- `type`
- `eventName`
- `elementId`
- `targetLabel`
- `targetUrl`
- `occurredAt`
- `metadata`

Metadata can include:

- Scroll percent.
- Time-on-page sample.
- Click coordinates relative to element, if useful later.
- Bot/platform classification.
- Provider-specific calendar metadata.

Rules:

- Avoid unbounded metadata.
- Validate metadata shape by event type.
- Avoid storing full arbitrary URL query strings if they may include sensitive data.
- Normalize `targetUrl` and consider stripping query params unless needed.

### Site View Tracking

When a valid public page is loaded:

- Create visitor session.
- Send `site_viewed`.
- Attribute to workspace, site, published version, and optional variant.
- Include referrer host when available.
- Do not count known preview bots as human views.

Bot behavior:

- If request is metadata/image-only from preview bot, record `link_preview_loaded`.
- If a bot loads the full page, classify as bot and do not include in human engagement summaries by default.

### Time Spent Tracking

Time spent should be estimated using active heartbeats.

Recommended client behavior:

- Start timer after page becomes visible.
- Pause when page is hidden.
- Send heartbeat periodically while visible, such as every 15 seconds.
- Send final beacon on page hide/unload where supported.
- Use `navigator.sendBeacon` for final events where available.

Rules:

- Do not send heartbeat every second.
- Server should deduplicate/throttle heartbeats.
- Compute duration from accepted heartbeat windows rather than trusting a single client-supplied total.
- Cap maximum single-session duration to avoid inflated numbers from abandoned tabs.

Recommended caps:

- Ignore inactive hidden time.
- Cap continuous visible heartbeat gap at a reasonable interval, such as 30-60 seconds.
- Cap total session duration for summary purposes, such as 1-2 hours, unless product needs longer.

### Scroll Depth Tracking

Track max scroll depth, not every scroll event.

Recommended thresholds:

- 25%
- 50%
- 75%
- 90%
- 100%

Client behavior:

- Observe scroll position.
- When a new threshold is reached, enqueue event.
- Send each threshold once per session.
- Also update visitor session max scroll depth.

Rules:

- Throttle scroll calculations.
- Handle short pages gracefully.
- Do not track pixel-by-pixel scroll.

### Element Click Tracking

Track meaningful clicks on configured public elements.

Trackable elements:

- Button/link blocks.
- Calendar embed CTAs when possible.
- File/resource links if added.
- Navigation/table-of-contents clicks if useful.

Each trackable element should have:

- Stable `elementId`.
- Block ID.
- Element type.
- Label snapshot.
- URL snapshot if applicable.

Client behavior:

- Attach tracking attributes during public rendering.
- On click, enqueue event.
- For outbound links, use `sendBeacon` or short non-blocking request.
- Do not noticeably delay navigation.

Rules:

- Do not track every click anywhere on page in v1.
- Track intentional elements.
- Do not record text selection, mouse movement, or keystrokes.
- If target URL has sensitive params, store sanitized URL.

### Calendar Tracking

Calendar tracking is provider-dependent.

V1:

- Track clicks on calendar embed/button.
- Do not guarantee booking completion unless provider integration supports it.

Future:

- Cal.com webhook or OAuth-based booking signal.
- Calendly webhook or embed event integration.
- Store `calendar_booked` only when provider signal is reliable.

### Link Preview / Slack Detection

Preview event:

- `link_preview_loaded`

When to record:

- Known preview bot requests OG metadata/page.
- Known preview bot requests OG image.

Metadata:

- `platform`: `slack`, `teams`, `linkedin`, etc. when known.
- `resource`: `html`, `og_image`, etc.
- `userAgentFamily`: normalized bot family.

Rules:

- Do not count preview loads as human visits.
- Deduplicate repeated bot requests for the same link over a short window.
- Avoid creating noisy duplicate events when bot requests both HTML and image.
- Label as "preview loaded" in UI.

Deduplication suggestion:

- Unique-ish key: workspaceId + siteId + variantId + variantRevision + platform + publishedVersionId + short time bucket.
- Time bucket could be 5-15 minutes.

### Tracking Ingestion API

Use a dedicated public ingestion endpoint.

Requirements:

- Accept batched events.
- Validate event payload.
- Rate limit by site/session/IP-ish signal without relying on storing raw IP forever.
- Reject events for unpublished/archived/missing sites.
- Reject events with mismatched variant/site.
- Enforce payload size limits.
- Be resilient to duplicate events.

Recommended endpoint:

```text
POST /api/public/tracking/events
```

Payload should include:

- Public tracking token or signed context from rendered page.
- Visitor session ID.
- Event batch.

Tracking context:

- Public page can embed a short-lived signed tracking context containing site ID, variant ID, published version ID.
- The client should not be trusted to choose arbitrary workspace/site IDs.
- Server verifies signature/context before accepting events.

### Tracking Script

Public tracking script should be:

- Small.
- Deferred.
- Dependency-light.
- Batched.
- Defensive.

It should:

- Initialize session.
- Send view event.
- Track heartbeats.
- Track scroll thresholds.
- Track trackable element clicks.
- Flush on visibility change/pagehide.

It should not:

- Load editor code.
- Block rendering.
- Throw uncaught errors that break the public page.
- Send excessive events.

### Bot Filtering

Bot filtering should happen at multiple levels:

- Request-time user-agent classification.
- Event ingestion classification.
- Analytics query filters.

Rules:

- Store normalized bot flag/name.
- Exclude bots from human engagement metrics by default.
- Allow internal debugging view if useful.
- Maintain bot detection as a tested utility.

Known bot classes:

- Slackbot/link expander.
- Microsoft Teams/Skype preview.
- LinkedIn bot.
- Twitter/X bot.
- Facebook bot.
- Generic crawlers.
- Search engine crawlers.

### Analytics Aggregations

Do not compute every dashboard number by scanning raw events forever.

V1 can start with indexed raw events if volume is tiny, but schema should support aggregation.

Useful summaries:

- Site total human views.
- Variant total human views.
- Last viewed at.
- Average time spent.
- Max/average scroll depth.
- Click counts per element.
- Preview loads by platform.

Aggregation strategy:

- Store raw events append-only.
- Update lightweight summary fields asynchronously or transactionally where cheap.
- Use background jobs for heavier rollups when needed.
- Keep query indexes aligned with Tracking page and site detail views.

### Tracking Page

The Tracking page should show a searchable/sortable feed.

Feed item should show:

- Event icon.
- Event name.
- Site name.
- Variant/recipient name if applicable.
- Target label or URL.
- Timestamp.
- Human vs preview/bot classification where relevant.

Filters:

- Site.
- Variant.
- Event type.
- Date range.
- Human events vs preview/bot events.

Search:

- Site name.
- Variant name.
- Target label.
- Recipient/company if stored.

Default view:

- Human engagement events first.
- Preview events can be included but visually distinct.

### Site And Variant Analytics UI

Site-level analytics should show:

- Total human views.
- Unique-ish sessions.
- Average time spent.
- Scroll depth distribution.
- Top clicked elements.
- Variant leaderboard.
- Recent activity.

Variant-level analytics should show:

- Views.
- Last viewed.
- Time spent.
- Max scroll depth.
- Clicks.
- Preview loads.

Important:

- Avoid pretending we know the visitor's exact identity unless the link itself is recipient-specific.
- For default links, analytics are link-level/session-level, not person-level.

### Retention

Retention affects cost and privacy.

V1 decision:

- Keep raw events long enough to be useful for sales follow-up.
- Keep aggregated summaries longer.
- Decide plan-based retention later.

Possible future policy:

- Basic: 90 days raw events.
- Pro: 1 year raw events.
- Aggregates: longer retention.

Do not hard-code retention behavior into scattered jobs. Centralize retention policy.

### Tracking Failure Cases

- Tracking endpoint down: public page still works.
- Event rejected: do not retry forever.
- Visitor offline: best-effort flush later during same session.
- Beacon blocked by browser/ad blocker: accept data loss.
- Duplicate events: dedupe where possible.
- Clock skew: server receive time is canonical for ordering; client time can be metadata.
- Variant deleted after page loaded: accept events if signed context is still within its short TTL and preserve historical attribution.

## Assets And Uploads

### Asset Purpose

Assets are workspace-owned files used by:

- Workspace logo/avatar.
- Site avatar/logo.
- Image blocks.
- Image variable values.
- Testimonial avatars.
- Logos block.
- OG images.
- Future downloadable resources.

Assets should be managed as first-class records, not loose URLs scattered through JSON.

### Asset Fields

An asset should include:

- `id`
- `workspaceId`
- `uploadedByUserId`
- `source`
- `kind`
- `status`
- `originalFilename`
- `mimeType`
- `sizeBytes`
- `width`
- `height`
- `storageKey`
- `publicUrl`
- `blurDataUrl` or placeholder metadata, optional
- `alt`
- `createdAt`
- `updatedAt`
- `deletedAt`

Sources:

- `upload`
- `logo_dev`
- `generated`
- `imported`

Kinds:

- `workspace_logo`
- `site_avatar`
- `image`
- `variant_image`
- `og_image`
- `logo`
- `avatar`

Statuses:

- `uploading`
- `ready`
- `failed`
- `deleted`

### Storage Strategy

Use object storage for assets.

Requirements:

- Stable storage keys.
- Public CDN URLs for public assets.
- Ability to delete or mark assets deleted.
- Ability to generate transformed/optimized variants.
- Reasonable local development story.

Likely providers:

- Cloudflare R2.
- S3-compatible storage.
- Supabase Storage if using Supabase for Postgres/auth later.

Provider choice can be finalized in hosting/deployment spec.

### Upload Flow

Recommended direct-upload flow:

1. Client requests upload intent from API.
2. Server validates workspace permission, file metadata, intended kind, and size.
3. Server returns signed upload URL or upload token.
4. Client uploads directly to object storage.
5. Client notifies API upload completed.
6. Server verifies object exists and metadata is valid.
7. Server creates/updates asset record as `ready`.
8. Client can attach asset ID to workspace/site/block/variable.

Decision for v1 architecture: use direct-to-object-storage uploads for production. A server-proxied upload path may exist only for local development or tests, not as the production design.

### File Validation

Validate:

- MIME type.
- File extension.
- File size.
- Image dimensions.
- Image decodability.
- Workspace permission.
- Intended usage/kind.

Allowed image types for v1:

- WebP.
- PNG.
- JPEG.

V1 decision:

- Do not allow user-uploaded SVG for public rendering.
- Add SVG later only with strict sanitization.

Rules:

- Do not trust client-provided MIME type alone.
- Inspect file signature where practical.
- Reject executable/scriptable formats.
- Strip or ignore EXIF metadata if possible.
- Enforce max dimensions to prevent image bombs.
- Generate optimized derivatives for public rendering.

### Size Limits

Suggested v1 limits:

- Workspace logo: 2 MB.
- Site avatar/logo: 2 MB.
- General image block: 10 MB.
- OG image: 5 MB.
- Logos block asset: 2 MB each.

Image dimension limits:

- Reject extremely large images.
- Downscale public derivatives.
- Keep original only if needed.

These should be constants in shared config, not magic numbers in components.

### Image Optimization

Public rendering should use optimized assets.

Rules:

- Generate or request appropriately sized image variants.
- Serve WebP/AVIF where supported if provider pipeline makes it easy.
- Keep original if needed for future transformations.
- Use width/height metadata to avoid layout shift.
- Use lazy loading for below-fold images.
- Use eager loading only for above-fold critical images.

### Asset Ownership And Access

Assets belong to a workspace.

Rules:

- Authenticated app access requires workspace membership.
- Public access is allowed only for assets referenced by published public pages or public OG images.
- Public asset URLs should not expose secret storage paths if avoidable.
- If an asset is detached from all public pages, it can remain accessible if URL is known unless private asset serving is implemented; document this tradeoff.

V1 decision:

- Treat uploaded site assets as public once used in a published page.
- Do not store sensitive files in Lightsite assets.
- Communicate through product design that uploaded public-site assets may be publicly accessible.

### Attaching Assets

Asset references should use asset IDs in content/settings, not raw URLs.

Examples:

- Workspace `logoAssetId`.
- Site `defaultAvatarAssetId`.
- Site settings `ogImageAssetId`.
- Image block `assetId`.
- Image variable default `assetId`.
- Variant image override `assetId`.

Benefits:

- Ownership validation.
- Cleanup/orphan detection.
- Easier migration between storage providers.
- Central metadata and optimization.

### logo.dev Asset Flow

Workspace setup can suggest a logo from logo.dev.

Rules:

- The server uses `LOGO_DEV_TOKEN`.
- Client never receives token.
- If user accepts the suggested logo, copy it into Lightsite asset storage.
- Do not depend on the logo.dev URL at public render time.
- Store asset source as `logo_dev`.
- Store original website domain used for lookup in metadata if useful.

Failure behavior:

- logo.dev unavailable: user can upload or skip.
- logo.dev returns poor/wrong logo: user can upload another.
- Workspace website changes: offer refresh, do not overwrite automatically.

### OG Images

OG images are assets.

Rules:

- Site can reference custom `ogImageAssetId`.
- If absent, public rendering uses Lightsite default OG image.
- Future generated OG images should be stored/cached as assets tied to published version.
- OG images should have recommended dimensions and cropping guidance.

Recommended dimensions:

- 1200 x 630 for standard Open Graph.

Validation:

- Warn if aspect ratio is poor.
- Allow crop/fit tools later.

### Orphan Cleanup

Uploads can become orphaned when a user uploads but never saves/attaches.

Rules:

- Assets can be unattached for a short retention window.
- Track attachment references through content/settings or reference table.
- Periodic cleanup can remove unattached assets older than a threshold.
- Do not delete assets referenced by any site version that may be restored.
- Do not delete assets referenced by published snapshots.

V1 approach:

- Keep asset records even after detach.
- Mark unused assets as candidates for cleanup.
- Cleanup job checks references across current drafts, published versions, site versions, variants, and workspace settings.

### Asset Deletion

Deleting an asset should be safe.

Rules:

- If asset is referenced by current draft, block deletion or require replacing/removing references.
- If asset is referenced by published snapshot, block deletion.
- If asset is referenced by version history only, either keep it or warn that old versions may not restore perfectly.
- Soft-delete asset record before deleting storage object if we need recovery.

V1 decision:

- Do not expose a global asset library delete flow yet.
- Let users remove/replace assets from the place they are used.
- Keep underlying assets until cleanup policy is implemented.

### Upload Security

Security rules:

- Require auth for app uploads.
- Verify workspace membership and permission.
- Restrict file types.
- Strip unsafe metadata where possible.
- Do not allow user SVG unless sanitized.
- Do not allow HTML uploads for public rendering.
- Scan files if provider/tooling makes it practical.
- Set safe content-type headers.
- Prevent path traversal by never using raw filenames as storage keys.

### Upload UX

Upload UI should support:

- Drag/drop.
- Click to upload.
- Progress state.
- Error state.
- Replace.
- Remove.
- Preview.

Image variable upload should say:

- Upload image or leave empty for default.

Failure messages should be specific:

- File too large.
- Unsupported file type.
- Image dimensions too large.
- Upload failed.
- Permission changed.

## Backend Architecture

### Backend Goals

The backend should be boring, explicit, secure, and easy to evolve.

It should provide:

- Authentication integration.
- Workspace context resolution.
- Centralized permission enforcement.
- Typed request validation.
- Transactional writes for multi-row business operations.
- Stable error responses.
- Public rendering data.
- Tracking ingestion.
- Realtime editor collaboration.
- Background jobs for cleanup/rollups.

### Backend App Structure

Recommended high-level structure:

```text
apps/api/src/
  app.ts
  server.ts
  env.ts
  auth/
  context/
  middleware/
  modules/
    auth/
    workspaces/
    members/
    invites/
    sites/
    editor/
    variants/
    public-sites/
    tracking/
    assets/
    billing/
  jobs/
  lib/
```

Rules:

- Feature modules own their routes, service functions, validators, and permission calls.
- Route handlers should stay thin.
- Business logic belongs in services/use-case functions.
- Database access should be explicit and testable.
- Shared helpers should not become a dumping ground; prefer module-local helpers until reuse is real.

### Request Context

Every API request should build a request context.

Authenticated app context:

- Request ID.
- User/session from BetterAuth.
- Selected workspace ID or slug where applicable.
- Workspace member record.
- Workspace role.
- Internal access metadata.
- Logger.

Public context:

- Request ID.
- Normalized slugs.
- Bot classification.
- Public IP-derived/rate-limit metadata, privacy-safe.
- Logger.

Rules:

- App routes requiring auth must call `requireAuthenticatedUser`.
- Workspace-owned routes must call `requireWorkspaceMember`.
- Admin routes must call `requireWorkspaceAdmin`.
- Site-owned routes must call site permission helpers.
- Do not manually reconstruct auth/workspace checks in each route.

### API Route Groups

Recommended route groups:

```text
/api/auth/*
/api/me
/api/workspaces
/api/workspaces/:workspaceId
/api/workspaces/:workspaceId/members
/api/workspaces/:workspaceId/invites
/api/workspaces/:workspaceId/sites
/api/sites/:siteId
/api/sites/:siteId/editor
/api/sites/:siteId/versions
/api/sites/:siteId/variants
/api/sites/:siteId/access
/api/assets
/api/public/sites/:workspaceSlug/:siteSlug
/api/public/sites/:workspaceSlug/:siteSlug/:variantSlug
/api/public/tracking/events
/api/public/og/:workspaceSlug/:siteSlug/*
```

Notes:

- App APIs can use internal IDs.
- Public routes use slugs.
- Public rendering endpoints should return only public-safe data.
- Tracking endpoints should be separate from app analytics querying.
- Public route params and API contracts must use `workspaceSlug`; do not ship username-style workspace route params or ambiguous `/api/sites/public/*` contracts.

### Validation

All inputs should be validated at API boundaries.

Rules:

- Validate params.
- Validate query.
- Validate body.
- Validate file metadata before upload intents.
- Validate content schema before draft persistence and publish.
- Validate permissions after resolving resource ownership.

Recommended:

- Use a schema validation library consistently.
- Keep validators close to modules.
- Reuse shared slug/email/content validators across frontend and backend where practical.
- Return structured field errors for forms.

Validation response shape:

```ts
type ApiValidationError = {
  code: "VALIDATION_ERROR"
  message: string
  fields: Record<string, string[]>
}
```

### Error Response Shape

Use stable error codes.

Conceptual shape:

```ts
type ApiError = {
  code: string
  message: string
  requestId: string
  fields?: Record<string, string[]>
  details?: unknown
}
```

Rules:

- User-facing `message` should be safe.
- Internal error details should not leak in production.
- Include `requestId` for support/debugging.
- Use `401` for unauthenticated.
- Use `403` for authenticated but forbidden.
- Use `404` when resource is missing or should not be knowable.
- Use `409` for uniqueness/conflict races.
- Use `422` for validation errors.
- Use `429` for rate limits.

### Transactions

Use transactions for operations that must not partially apply.

Transactional operations:

- Workspace creation.
- Invite acceptance.
- Site creation.
- Site duplication.
- Publish/republish.
- Rollback.
- Archive/unarchive when it affects status and public availability.
- Variant create/update when slug uniqueness and values are saved.
- Role change/removal with last-admin checks.
- Asset finalize when linking to workspace objects.

Rules:

- Keep transactions short.
- Do not perform slow network calls inside DB transactions.
- Pre-fetch remote data before transaction or write pending state and finalize afterward.
- Use row locks or safe constraints for race-sensitive checks.

### Idempotency

Use idempotency where duplicate submissions are likely.

Good candidates:

- Workspace creation final submit.
- Invite resend.
- Invite acceptance.
- Site create/duplicate.
- Upload finalize.
- Tracking batch ingestion.
- Collaboration operation application.

Rules:

- Client-generated operation IDs can dedupe collaboration writes.
- Tracking event IDs can dedupe batched events.
- Idempotency keys should be scoped to user/workspace/action.

### Pagination

Use cursor/keyset pagination for lists that can grow.

Lists:

- Sites.
- Variants.
- Tracking events.
- Members/invites, if large later.
- Assets, if asset library is added.

Rules:

- Cursor includes sort field and stable tie-breaker.
- Sort order is deterministic.
- Search/filter parameters are part of cursor context.
- Cursor should be opaque to clients.

Avoid offset pagination for large/high-churn tables like tracking events.

### Rate Limiting

Rate limit:

- Signup/login.
- Invite sends.
- Slug availability checks.
- logo.dev preview endpoint.
- Upload intent creation.
- Public tracking ingestion.
- Public page requests if abused.

Rules:

- Rate limits should be route-specific.
- Public tracking rate limits should not break normal visitor tracking.
- Slug availability checks should be debounced on the client and rate-limited on server.
- Invite sends should have per-workspace and per-user limits.

### Realtime Service

Realtime collaboration should be isolated from normal REST routes.

Options:

- Same API process with WebSocket support for v1.
- Separate realtime service later if scaling demands it.

Rules:

- Authenticate WebSocket connection.
- Authorize room join by site edit permission.
- Room ID is site ID.
- Presence is ephemeral.
- Persist document changes through debounced server-controlled writes.
- Close rooms when inactive.
- Do not let clients join arbitrary rooms without server permission.

Cost controls:

- No database writes for presence.
- Batch content persistence.
- Keep collaboration rooms only for active editors.
- Avoid retaining raw CRDT update logs forever unless specifically needed.

### Tracking Ingestion Service

Tracking ingestion should be optimized for cheap writes and safety.

Rules:

- Accept batches.
- Validate signed tracking context.
- Validate event types.
- Classify bot/client.
- Deduplicate event IDs.
- Insert raw events append-only.
- Update session summary/rollups cheaply.
- Reject events for unavailable sites except short-TTL already-rendered contexts if chosen.

Do not use heavy synchronous analytics queries during ingestion.

### Background Jobs

Background jobs may handle:

- Asset cleanup.
- Image optimization/transcoding.
- Analytics rollups.
- Version retention pruning.
- Invite expiry.
- Tracking retention.
- Webhook handling.
- Email sending.

Rules:

- Jobs should be idempotent.
- Jobs should be observable.
- Jobs should store failure state/retry count where needed.
- Jobs should not require the web request to stay open.

V1 can start with simple scheduled scripts/cron if volume is low, but the architecture should keep jobs separate from request handlers.

### Logging

Log:

- Request ID.
- Route.
- Status.
- Duration.
- Workspace ID where applicable.
- User ID where applicable.
- Error code.

Do not log:

- Passwords.
- Auth tokens.
- Invite tokens.
- logo.dev token.
- Full signed tracking context.
- Sensitive URL query params.
- Full page content.

### Backend Testing Requirements

Backend tests should cover:

- Auth/workspace context.
- Permission helpers.
- Slug validation and uniqueness races.
- Work email validation.
- Workspace creation transaction.
- Invite acceptance.
- Last-admin protections.
- Site lifecycle transitions.
- Publish/rollback transactions.
- Public route 404 behavior.
- Variant resolution.
- Tracking ingestion validation/deduplication.
- Asset upload finalize validation.

Permission tests are especially important. Every route that mutates workspace/site data should have allowed and forbidden cases.

## API Contracts

### API Contract Principles

API contracts should be boring and consistent.

Rules:

- App APIs use internal IDs.
- Public APIs use slugs or signed public context.
- Every mutating endpoint validates auth, workspace membership, permissions, and input.
- Every list endpoint supports deterministic pagination before it becomes painful.
- Every mutation returns the updated resource or enough data to update the client cache.
- Every route returns stable error codes.
- No route should return draft/private fields unless it is an authenticated app route and the user has permission.

### Response Envelope

Use simple JSON responses.

Success:

```ts
type ApiSuccess<T> = T
```

Error:

```ts
type ApiError = {
  code: string
  message: string
  requestId: string
  fields?: Record<string, string[]>
}
```

List:

```ts
type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
}
```

Rules:

- Do not wrap every success in `{ data }` unless we choose that pattern everywhere.
- Be consistent once chosen.
- Errors should not use one-off shapes like `{ error: string }`.

### Health

`GET /api/health`

Auth:

- Public.

Returns:

- Service health.
- No secrets.
- No database details unless using a separate internal health endpoint.

### Current User

`GET /api/me`

Auth:

- Optional/auth-aware.

Returns:

- Current session/user if authenticated.
- Accessible workspaces.
- Last active workspace.
- Current onboarding state.

Rules:

- Do not return all workspace sites here.
- This endpoint supports app bootstrap only.

### Workspace Availability

`GET /api/workspaces/slug-availability?slug=...`

Auth:

- Required.

Validates:

- Slug local rules.
- Reserved slugs.
- Uniqueness.

Returns:

- Available/unavailable.
- Field error if invalid.

Rate limit:

- Yes, because it is called during typing.

### Workspace Logo Preview

`POST /api/workspaces/logo-preview`

Auth:

- Required.

Body:

- Website domain or URL.
- Theme/size options, constrained.

Behavior:

- Normalize website.
- Use logo.dev server-side.
- Return preview URL or unavailable state.
- Do not expose token.

Errors:

- Invalid website.
- Rate limited.
- Logo unavailable should be a normal non-error result if request succeeded.

### Workspaces

`GET /api/workspaces`

Auth:

- Required.

Returns:

- Workspaces where user is active member.

`POST /api/workspaces`

Auth:

- Required.

Creates:

- Workspace.
- Admin membership.
- Optional logo asset link.

Transaction:

- Required.

Errors:

- Validation.
- Slug conflict.
- Idempotency conflict.

`GET /api/workspaces/:workspaceId`

Auth:

- Workspace member.

Returns:

- Workspace details and current member role.

`PATCH /api/workspaces/:workspaceId`

Auth:

- Workspace admin.

Updates:

- Name.
- Website.
- Logo.
- Slug only while allowed.

Errors:

- Slug blocked because workspace has published site.
- Slug conflict.
- Permission denied.

### Workspace Members

`GET /api/workspaces/:workspaceId/members`

Auth:

- Workspace member.

Returns:

- Active members.
- Pending invites for workspace admins. Non-admin members can see active members but do not need invite administration data in v1.

`PATCH /api/workspaces/:workspaceId/members/:memberId`

Auth:

- Workspace admin.

Updates:

- Role.

Errors:

- Cannot change own role.
- Cannot demote last admin.
- Target missing/removed.

`DELETE /api/workspaces/:workspaceId/members/:memberId`

Auth:

- Workspace admin.

Behavior:

- Removes/deactivates member.

Errors:

- Cannot remove self.
- Cannot remove last admin.

### Workspace Invites

`POST /api/workspaces/:workspaceId/invites`

Auth:

- Workspace member for v1 invite policy.

Body:

- Email.
- Role.

Behavior:

- Validate work email.
- Create or resend pending invite.
- Queue/send email.

Errors:

- Already member.
- Invalid email.
- Rate limited.

`POST /api/workspaces/:workspaceId/invites/:inviteId/resend`

Auth:

- Admin or the original inviter.

`DELETE /api/workspaces/:workspaceId/invites/:inviteId`

Auth:

- Admin.

Behavior:

- Revoke pending invite.

`POST /api/invites/accept`

Auth:

- Required after login/signup.

Body:

- Raw invite token.

Behavior:

- Hash token.
- Validate invite.
- Verify authenticated email matches invite email.
- Create membership transactionally.
- Mark invite accepted.

### Sites

`GET /api/workspaces/:workspaceId/sites`

Auth:

- Workspace member.

Query:

- Search.
- Status.
- Visibility/access.
- Sort.
- Cursor.

Returns:

- Sites effective-accessible to the user.
- Admins get all workspace sites.

`POST /api/workspaces/:workspaceId/sites`

Auth:

- Workspace member.

Behavior:

- Enforce plan limit.
- Create draft site.
- Create initial version.
- Copy workspace logo as site avatar if present.

Errors:

- Plan limit.
- Slug conflict.
- Validation.

`GET /api/sites/:siteId`

Auth:

- Can view site.

Returns:

- Site metadata.
- Effective permissions.
- Not full editor payload unless intended.

`PATCH /api/sites/:siteId`

Auth:

- Can edit site.

Updates:

- Name.
- Draft slug only if allowed.
- Visibility.
- Avatar/OG/settings.

Errors:

- Published slug change blocked.
- Slug conflict.
- Archived.

`POST /api/sites/:siteId/duplicate`

Auth:

- Can edit or view_copy site.

Behavior:

- Enforce plan limit.
- Create private draft copy.

`POST /api/sites/:siteId/archive`

Auth:

- Can archive/manage site.

Behavior:

- Archive.
- Public links stop resolving.

`POST /api/sites/:siteId/restore`

Auth:

- Can manage site.

Behavior:

- Restore archived site as draft.

### Editor

`GET /api/sites/:siteId/editor`

Auth:

- Can view site.

Returns:

- Draft content if can edit.
- Read-only draft or published-safe app preview content if view_copy.
- Effective permissions.
- Draft revision.
- Variants summary.
- Active editor presence endpoint info if can edit.

Rules:

- Archived sites return read-only archived state.

`PATCH /api/sites/:siteId/editor/draft`

Auth:

- Can edit site.

Behavior:

- Persist draft content or accepted operation batch.
- Validate content.
- Increment draft revision.

Notes:

- Realtime collaboration may use WebSocket for operations, but REST fallback/save endpoint should exist.

`POST /api/sites/:siteId/editor/validate`

Auth:

- Can edit site.

Behavior:

- Validate draft for publish/readiness.

### Publishing

`POST /api/sites/:siteId/publish`

Auth:

- Can publish/edit site.

Behavior:

- Flush/use latest accepted draft.
- Validate.
- Create publish version.
- Set `publishedVersionId`.
- Set status published.

Transaction:

- Required.

`POST /api/sites/:siteId/unpublish`

Auth:

- Can publish/edit site.

Behavior:

- Set status draft.
- Keep versions.
- Public routes 404.

### Versions

`GET /api/sites/:siteId/versions`

Auth:

- Can edit site.

Returns:

- Version list metadata.

`GET /api/sites/:siteId/versions/:versionId`

Auth:

- Can edit site.

Returns:

- Version content preview.

`POST /api/sites/:siteId/versions/:versionId/restore`

Auth:

- Can edit site.

Behavior:

- Create rollback version.
- Replace draft content.
- Notify active editors.

### Variants

`GET /api/sites/:siteId/variants`

Auth:

- Can view/copy site.

Query:

- Search.
- Cursor.

Returns:

- Variant list.
- User permissions for variant actions.
- Current `revisionNumber`.

`POST /api/sites/:siteId/variants`

Auth:

- Can edit site.

Creates:

- Variant.
- Rejects slugs used by retained variants or slug reservations.

`GET /api/sites/:siteId/variants/:variantId`

Auth:

- Can view/copy site.

Returns:

- Variant detail and active variable fields.
- Current `revisionNumber`.

`PATCH /api/sites/:siteId/variants/:variantId`

Auth:

- Can edit site.

Updates:

- Name.
- Slug.
- Variable values.
- Increments `revisionNumber`.
- Creates a slug reservation when slug changes.

Errors:

- Slug conflict or reserved slug.
- Invalid values.

`POST /api/sites/:siteId/variants/:variantId/duplicate`

Auth:

- Can edit site.

`DELETE /api/sites/:siteId/variants/:variantId`

Auth:

- Can edit site.

Behavior:

- Soft-delete variant.

### Site Access

`GET /api/sites/:siteId/access`

Auth:

- Can manage site access or admin.

Returns:

- Entire-team access.
- Member access rows.
- Effective permissions.

`PUT /api/sites/:siteId/access`

Auth:

- Can manage site access.

Behavior:

- Replace access config transactionally or apply structured changes.

Rules:

- Validate member IDs belong to same workspace.
- Prevent self-lockout edge cases per spec.

### Assets

`POST /api/assets/upload-intents`

Auth:

- Workspace member.

Behavior:

- Validate intended kind/size/type.
- Return signed direct-upload info.

`POST /api/assets/:assetId/finalize`

Auth:

- Workspace member and asset owner/context.

Behavior:

- Verify object exists.
- Inspect metadata.
- Mark ready.

`GET /api/assets`

Auth:

- Workspace member.

Use:

- Future asset picker/library.

### Public Site Data

`GET /api/public/sites/:workspaceSlug/:siteSlug`

Auth:

- Public.

Returns:

- Public payload for default link.

`GET /api/public/sites/:workspaceSlug/:siteSlug/:variantSlug`

Auth:

- Public.

Returns:

- Public payload for variant link.

Rules:

- 404 for missing/unpublished/archived.
- Never return draft content.

### Tracking

`POST /api/public/tracking/events`

Auth:

- Public signed tracking context.

Behavior:

- Accept event batch.
- Validate context.
- Deduplicate.
- Insert raw events/update session.

`GET /api/workspaces/:workspaceId/tracking/events`

Auth:

- Workspace member.

Query:

- Site.
- Variant.
- Event type.
- Date range.
- Search.
- Human/bot/preview filter.
- Cursor.

Returns:

- Paginated tracking feed.

### Analytics Summaries

`GET /api/sites/:siteId/analytics`

Auth:

- Can view site analytics.

Returns:

- Site-level summary.
- Variant leaderboard.
- Top clicked elements.
- Recent events.

`GET /api/sites/:siteId/variants/:variantId/analytics`

Auth:

- Can view site analytics.

Returns:

- Variant-level summary.

## Service And Use-Case Boundaries

### Service Layer Purpose

Services own business behavior. Routes own HTTP.

This keeps route handlers thin and prevents duplicated permission/transaction logic.

### Service Inventory

Workspaces:

- `createWorkspace`
- `updateWorkspace`
- `checkWorkspaceSlugAvailability`
- `switchWorkspaceContext`
- `fetchLogoPreview`

Members/invites:

- `listMembers`
- `inviteMember`
- `resendInvite`
- `revokeInvite`
- `acceptInvite`
- `changeMemberRole`
- `removeMember`

Sites:

- `listSites`
- `createSite`
- `updateSite`
- `duplicateSite`
- `archiveSite`
- `restoreSite`
- `resolveSiteAccess`

Editor/content:

- `loadEditorState`
- `applyEditorOperations`
- `validateSiteContent`
- `persistDraft`
- `createAutosaveCheckpoint`

Publishing/versions:

- `publishSite`
- `unpublishSite`
- `listSiteVersions`
- `restoreSiteVersion`
- `createSiteVersion`

Variants:

- `listVariants`
- `createVariant`
- `updateVariant`
- `duplicateVariant`
- `deleteVariant`
- `resolveVariantValues`

Public:

- `resolvePublicSite`
- `buildPublicPayload`
- `buildOgMetadata`
- `classifyPreviewBot`

Tracking:

- `ingestTrackingBatch`
- `createOrUpdateVisitorSession`
- `recordPreviewLoad`
- `listTrackingEvents`
- `getSiteAnalytics`

Assets:

- `createUploadIntent`
- `finalizeUpload`
- `attachAsset`
- `cleanupUnusedAssets`

### Service Rules

- Services receive typed inputs, context, and transaction handle when needed.
- Services do not read raw HTTP request/response.
- Services perform permission checks or require caller to pass verified permission context, consistently by module.
- Services should be easy to test without running the full HTTP server.
- Services should return typed domain results or throw typed application errors.

### Typed Application Errors

Services should throw stable errors:

- `UnauthenticatedError`
- `ForbiddenError`
- `NotFoundError`
- `ValidationError`
- `ConflictError`
- `RateLimitError`
- `PlanLimitError`
- `ArchivedResourceError`
- `PublishValidationError`

HTTP layer maps these to API responses.

Do not throw raw database errors directly to route responses.

### Permission Helper Contract

Permission helpers should return explicit decisions.

Example shape:

```ts
type PermissionDecision = {
  allowed: boolean
  reason?: string
  role?: string
}
```

Rules:

- Mutating services should fail closed.
- Permission checks should be fast and indexed.
- Site access checks should resolve admin, creator, explicit member, and entire-team access.
- Public route access does not use site access helpers.

### Slug Availability Race Handling

Every slug availability flow has two steps:

1. Advisory check endpoint.
2. Final write with unique DB constraint.

Rules:

- Final write is authoritative.
- Unique constraint errors map to `409 CONFLICT`.
- Client keeps form data and asks user to choose another slug.

### Publish Transaction Contract

`publishSite` transaction must:

1. Lock or read current site state safely.
2. Verify user permission.
3. Verify site is not archived.
4. Validate latest accepted draft content.
5. Create site version kind `publish`.
6. Set `publishedVersionId`.
7. Set status `published`.
8. Set publish actor/timestamp.
9. Commit.
10. Trigger cache invalidation after commit.

Cache invalidation should not happen before commit.

### Rollback Transaction Contract

`restoreSiteVersion` transaction must:

1. Verify permission.
2. Verify site not archived.
3. Load selected immutable version.
4. Create new version kind `rollback`.
5. Replace draft content with selected version content.
6. Increment draft revision.
7. Commit.
8. Notify editor rooms after commit.

Rollback does not update `publishedVersionId`.

### Tracking Ingestion Contract

`ingestTrackingBatch` should:

1. Verify signed tracking context.
2. Check context TTL.
3. Validate event count and payload sizes.
4. Resolve site/variant/published version from context.
5. Classify bot/client.
6. Deduplicate event IDs.
7. Upsert/update visitor session.
8. Insert accepted events.
9. Update cheap summary fields if configured.

It should not:

- Perform expensive analytics aggregation inline.
- Trust client-provided workspace/site IDs without signature.
- Throw errors that break public page UX.

## Frontend Query And Mutation Contracts

### Query Key Rules

Query keys should be stable, typed, and workspace-aware.

Rules:

- Include workspace ID for workspace-scoped resources.
- Include filters in list query keys.
- Include site ID for site-scoped resources.
- Do not include unstable object references; use serialized primitive filter objects.
- Keep public route queries separate from app route queries.

### Core Query Keys

```ts
["me"]
["workspaces"]
["workspace", workspaceId]
["members", workspaceId, filters]
["sites", workspaceId, filters]
["site", workspaceId, siteId]
["editor", workspaceId, siteId]
["siteVersions", workspaceId, siteId, filters]
["variants", workspaceId, siteId, filters]
["variant", workspaceId, siteId, variantId]
["trackingEvents", workspaceId, filters]
["siteAnalytics", workspaceId, siteId, filters]
["publicSite", workspaceSlug, siteSlug, variantSlug ?? null]
```

### Mutation Invalidation Rules

Workspace update:

- Invalidate `["workspaces"]`.
- Invalidate `["workspace", workspaceId]`.
- Update app shell active workspace cache.

Member/invite mutation:

- Invalidate `["members", workspaceId]`.

Create site:

- Invalidate `["sites", workspaceId, *]`.
- Optionally set `["site", workspaceId, siteId]`.

Update site metadata:

- Update `["site", workspaceId, siteId]`.
- Invalidate relevant sites lists.

Draft save:

- Update editor query/cache state.
- Do not invalidate entire sites list on every autosave.
- Update sites list updated timestamp on lower frequency or after save settles.

Publish/unpublish/archive/restore:

- Invalidate site detail.
- Invalidate sites lists.
- Invalidate public preview/public route cache where applicable.
- Invalidate analytics only if status affects displayed availability.

Variant mutation:

- Invalidate variants list/detail.
- Invalidate site detail if variant count shown.

Tracking event ingestion:

- Public script does not touch authenticated Query cache.
- Authenticated Tracking page refetches on interval/manual refresh if desired.

### Optimistic Updates

Use optimistic updates only when rollback is straightforward:

- Local UI toggles.
- Simple metadata edits.
- Variant form save after server success preferred.

Avoid optimistic updates for:

- Publish.
- Rollback.
- Archive.
- Role changes.
- Last-admin-sensitive actions.
- Plan-limit-sensitive creation.

Editor content uses its own optimistic local/collaboration model, not generic Query optimistic updates.

### API Client

Frontend should use a single API client wrapper.

Responsibilities:

- Attach credentials.
- Parse success/error responses.
- Surface typed errors.
- Include request ID in errors when present.
- Redirect or notify on auth/workspace errors through central handling.

Rules:

- Components should not hand-roll `fetch` parsing.
- Components should not inspect raw HTTP status everywhere.
- Form helpers map `fields` errors to UI.

### Realtime Client Contract

Editor realtime client should:

- Connect only on editor route.
- Authenticate with current session.
- Join only authorized site room.
- Send operation IDs.
- Handle accepted/rejected operations.
- Handle presence updates.
- Handle permission lost.
- Handle room document replacement after rollback.
- Disconnect on route leave/logout.

It should not:

- Live in global app shell.
- Persist presence to Query cache.
- Re-render the entire editor canvas on every presence heartbeat.

## Database Schema

### Database Goals

The database should make illegal states hard.

Goals:

- Clear ownership boundaries.
- Strong uniqueness constraints.
- Fast workspace-scoped queries.
- Durable version/publish history.
- Append-only analytics events.
- Safe soft-delete where history matters.
- Room to add billing, custom domains, and richer analytics.

### Naming Conventions

Rules:

- Table names are plural snake_case.
- Columns are snake_case.
- Product language uses `slug`, not `username`, for public namespaces.
- Timestamps use `created_at`, `updated_at`, and lifecycle-specific fields like `published_at`, `archived_at`, `deleted_at`.
- Foreign keys include referenced entity name, e.g. `workspace_id`, `site_id`, `variant_id`.
- Actor columns use `*_by_user_id`.

### Auth Tables

BetterAuth owns its required auth tables.

Lightsite should not duplicate auth credentials.

Lightsite may need an app profile table if BetterAuth user fields are insufficient:

```text
user_profiles
- user_id primary/unique
- name
- avatar_asset_id nullable
- onboarding_completed_at nullable
- created_at
- updated_at
```

Rules:

- Use BetterAuth user ID as foreign key/reference.
- Do not store password/auth secrets outside BetterAuth.

### Workspaces

```text
workspaces
- id uuid primary key
- name varchar not null
- slug varchar not null unique
- website_domain varchar not null
- logo_asset_id uuid nullable
- plan workspace_plan not null default basic
- status workspace_status not null default active
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable
```

Indexes:

- Unique `slug`.
- Index `status`.

Notes:

- Workspace URL namespace is stored as `slug`.
- `website_domain` should store canonical domain.

### Workspace Members

```text
workspace_members
- id uuid primary key
- workspace_id uuid not null
- user_id varchar not null
- role workspace_role not null
- is_developer boolean not null default false
- created_at timestamptz not null
- updated_at timestamptz not null
- removed_at timestamptz nullable
```

Indexes/constraints:

- Unique active membership by `workspace_id`, `user_id`.
- Index by `user_id`.
- Index by `workspace_id`.

Rules:

- Last-admin protection is enforced in service transaction.
- `removed_at` enables historical actor references.

### Workspace Invites

```text
workspace_invites
- id uuid primary key
- workspace_id uuid not null
- email varchar not null
- role workspace_role not null default user
- token_hash varchar not null unique
- status invite_status not null default pending
- invited_by_user_id varchar not null
- accepted_by_user_id varchar nullable
- expires_at timestamptz not null
- accepted_at timestamptz nullable
- revoked_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null
```

Indexes/constraints:

- Unique pending invite by `workspace_id`, normalized `email`.
- Index by `token_hash`.
- Index by `workspace_id`, `status`.

Rules:

- Store token hash, not raw token.
- Invite email normalized.

### Sites

```text
sites
- id uuid primary key
- workspace_id uuid not null
- created_by_user_id varchar not null
- updated_by_user_id varchar nullable
- published_by_user_id varchar nullable
- archived_by_user_id varchar nullable
- name varchar not null
- slug varchar not null
- status site_status not null default draft
- visibility site_visibility not null default private
- draft_content jsonb not null
- draft_revision integer not null default 0
- published_version_id uuid nullable
- default_avatar_asset_id uuid nullable
- og_image_asset_id uuid nullable
- published_at timestamptz nullable
- last_unpublished_at timestamptz nullable
- archived_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null
```

Indexes/constraints:

- Unique `workspace_id`, `slug`.
- Index `workspace_id`, `status`, `updated_at`.
- Index `published_version_id`.

Rules:

- Published site must have `published_version_id`.
- Archived site should not be publicly served even if `published_version_id` remains.
- Draft revision increments on accepted persisted editor changes.

### Site Versions

```text
site_versions
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- version_number integer not null
- kind site_version_kind not null
- label varchar nullable
- content jsonb not null
- variables_snapshot jsonb not null
- created_by_user_id varchar nullable
- created_at timestamptz not null
- published_at timestamptz nullable
- metadata jsonb not null default {}
```

Indexes/constraints:

- Unique `site_id`, `version_number`.
- Index `workspace_id`, `site_id`, `created_at`.
- Index `site_id`, `kind`, `created_at`.

Rules:

- Versions are immutable.
- Publish and rollback create versions transactionally.

### Site Variables

Variables can live inside content JSON, but a table may be useful for querying and variants.

Recommended architecture:

- Store variable registry in site content snapshots for version safety.
- Also store current draft variables in a normalized `site_variables` table if query/edit performance needs it.

Potential table:

```text
site_variables
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- key varchar not null
- label varchar not null
- type variable_type not null
- default_value jsonb not null
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable
```

Indexes/constraints:

- Unique active `site_id`, `key`.
- Index `workspace_id`, `site_id`.

Decision:

- Product source of truth for a published version is the version content snapshot.
- If `site_variables` table exists, it reflects current draft variables for app workflows.

### Site Variants

```text
site_variants
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- name varchar not null
- slug varchar not null
- recipient_name varchar nullable
- recipient_company varchar nullable
- recipient_email varchar nullable
- variable_values jsonb not null default {}
- revision_number integer not null default 1
- created_by_user_id varchar nullable
- updated_by_user_id varchar nullable
- last_viewed_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable
```

Indexes/constraints:

- Unique retained `site_id`, `slug`, including soft-deleted variants.
- Index `workspace_id`, `site_id`.
- Index `site_id`, `last_viewed_at`.

Rules:

- Use soft-delete so analytics can retain variant meaning.
- `variable_values` keys are variable IDs.
- Increment `revision_number` on every saved variant change.
- Public tracking records should capture the variant revision used for render/click attribution.

### Site Variant Slug Reservations

```text
site_variant_slug_reservations
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- variant_id uuid not null
- slug varchar not null
- reason varchar not null
- created_by_user_id varchar nullable
- created_at timestamptz not null
```

Indexes/constraints:

- Unique `site_id`, `slug`.
- Index `variant_id`, `created_at`.

Rules:

- Create a reservation when a variant slug changes.
- Create or preserve a reservation when a variant is soft-deleted.
- Public route should return 404 for reserved old variant slugs.
- Reservations prevent old prospect links from resolving to a different recipient later.

### Site Access

```text
site_access
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- workspace_member_id uuid nullable
- entire_team boolean not null default false
- role site_access_role not null
- created_by_user_id varchar nullable
- created_at timestamptz not null
- updated_at timestamptz not null
```

Constraints:

- Unique active `site_id`, `workspace_member_id` where member not null.
- Unique active entire-team row per site.
- Check that either `workspace_member_id` is set or `entire_team` is true.
- Check that both are not set simultaneously.

### Assets

```text
assets
- id uuid primary key
- workspace_id uuid not null
- uploaded_by_user_id varchar nullable
- source asset_source not null
- kind asset_kind not null
- status asset_status not null
- original_filename varchar nullable
- mime_type varchar not null
- size_bytes integer not null
- width integer nullable
- height integer nullable
- storage_key text not null
- public_url text nullable
- alt text nullable
- metadata jsonb not null default {}
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable
```

Indexes:

- `workspace_id`, `kind`.
- `workspace_id`, `created_at`.
- Unique `storage_key`.

### Visitor Sessions

```text
visitor_sessions
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- variant_id uuid nullable
- variant_revision integer nullable
- published_version_id uuid not null
- started_at timestamptz not null
- last_seen_at timestamptz not null
- ended_at timestamptz nullable
- duration_ms integer nullable
- max_scroll_depth integer nullable
- referrer_host varchar nullable
- browser_name varchar nullable
- os_name varchar nullable
- device_type varchar nullable
- is_bot boolean not null default false
- bot_name varchar nullable
- metadata jsonb not null default {}
```

Indexes:

- `workspace_id`, `started_at`.
- `site_id`, `started_at`.
- `variant_id`, `started_at`.

### Analytics Events

```text
analytics_events
- id uuid primary key
- workspace_id uuid not null
- site_id uuid not null
- variant_id uuid nullable
- variant_revision integer nullable
- published_version_id uuid nullable
- visitor_session_id uuid nullable
- type analytics_event_type not null
- event_name varchar not null
- element_id varchar nullable
- target_label varchar nullable
- target_url text nullable
- metadata jsonb not null default {}
- occurred_at timestamptz not null
- received_at timestamptz not null
```

Indexes:

- `workspace_id`, `occurred_at`.
- `site_id`, `occurred_at`.
- `variant_id`, `occurred_at`.
- `visitor_session_id`.
- Optional partial indexes by event type if needed.

Rules:

- Raw events are append-only.
- Summaries can be cached elsewhere.

### Analytics Summaries

Optional but likely useful:

```text
site_analytics_daily
- workspace_id
- site_id
- date
- human_views
- preview_loads
- total_time_ms
- click_count
- max_scroll_depth
```

```text
variant_analytics_daily
- workspace_id
- site_id
- variant_id
- date
- human_views
- preview_loads
- total_time_ms
- click_count
- max_scroll_depth
```

Decision:

- Start with raw events and indexed queries if volume is low.
- Design event schema so daily rollups can be added without rewriting ingestion.

### Billing Tables

Future billing:

```text
workspace_subscriptions
- id
- workspace_id
- provider
- provider_customer_id
- provider_subscription_id
- plan
- status
- current_period_start
- current_period_end
- created_at
- updated_at
```

Billing should be workspace-owned.

### Audit Log

Audit log may be useful for admin/security actions.

Potential table:

```text
audit_events
- id
- workspace_id
- actor_user_id
- action
- target_type
- target_id
- metadata
- occurred_at
```

Good candidates:

- Role changes.
- Member removals.
- Workspace slug changes.
- Publish/unpublish/archive.
- Site access changes.

Decision:

- Not required for earliest v1, but schema and service boundaries should make it easy to add.

### Database Migration Rules

- Use migrations for every schema change.
- Never edit applied migrations.
- Content JSON migrations are separate from SQL migrations but should be coordinated.
- Backfills should be idempotent.
- Add nullable columns first, backfill, then enforce non-null in later migration when needed.
- Add indexes concurrently where supported/needed for large tables.

## Frontend Architecture

### Frontend Goals

The frontend should be organized by product feature and optimized for a fast app/editor/public experience.

It should:

- Use the Lightsite design system consistently.
- Keep app, editor, and public rendering bundles separate where practical.
- Avoid loading heavy editor/collaboration code outside the editor.
- Avoid loading internal app code on public pages.
- Use server data as source of truth.
- Keep client state local and purposeful.
- Make loading/error/empty states first-class.

### Technology

Frontend stack:

- React.
- Vite.
- TanStack Router.
- TanStack Query.
- Shadcn primitives as base UI.
- Tabler icons for app-owned product UI.
- Tiptap for rich text fields in the editor.

Rules:

- App-owned UI uses shadcn primitives and Lightsite component wrappers.
- Product icons use `@tabler/icons-react`.
- Avoid one-off components that bypass the design system.
- Heavy editor modules should be code-split.
- Public site renderer should not import authenticated app shell/editor modules.

### Route Groups

Conceptual route groups:

```text
/login
/signup
/accept-invite/:token
/onboarding/account
/onboarding/workspace

/sites
/sites/:siteId/edit
/sites/:siteId/preview
/tracking
/team
/settings/profile
/settings/workspace
/settings/billing
/design-system

/{workspaceSlug}/{siteSlug}
/{workspaceSlug}/{siteSlug}/{variantSlug}
```

Notes:

- Authenticated app routes use internal IDs.
- Public visitor routes use slugs.
- Public routes should use a separate public rendering path/bundle if possible.
- Design system route is internal/dev-only or protected later.

### Feature Folder Structure

Recommended frontend structure:

```text
apps/web/src/
  app/
    router/
    providers/
    query-client.ts
  components/
    ui/
    layout/
    primitives/
    composed/
  features/
    auth/
    onboarding/
    workspaces/
    sites/
    editor/
    variants/
    sharing/
    tracking/
    team/
    settings/
    public-site/
    assets/
  lib/
    api/
    validation/
    slugs/
    permissions/
    dates/
  data/
```

Rules:

- `components/ui` contains shadcn primitives and globally reusable primitive variants.
- `components/layout` contains app shell/sidebar/header.
- `features/*` contains product feature UI, hooks, query definitions, and feature-local components.
- Cross-feature shared product components can move to `components/composed` only after reuse is real.
- Avoid large barrel files that accidentally pull entire feature bundles into unrelated routes.

### Data Fetching

Use TanStack Query for server state.

Rules:

- Query keys should be structured and workspace-aware.
- Mutations should invalidate/update only relevant queries.
- Do not use global state for server data that belongs in Query cache.
- Use optimistic updates only when rollback behavior is clear.
- Mutations should handle `401`, `403`, `404`, `409`, `422`, and `429` consistently.
- Route loaders can prefetch critical data to avoid waterfalls.

Example query key shape:

```ts
["workspace", workspaceId]
["sites", workspaceId, filters]
["site", workspaceId, siteId]
["site-versions", workspaceId, siteId]
["variants", workspaceId, siteId, filters]
["tracking-events", workspaceId, filters]
```

Waterfall avoidance:

- Fetch independent data in parallel.
- Start route-level critical queries early.
- Avoid nested components each discovering they need their own blocking request.
- Use Suspense/loading boundaries where appropriate.

### Client State Boundaries

Use local React state for:

- Form drafts.
- Modal open state.
- Local filters before submit/debounce.
- UI-only selection.

Use URL state for:

- Search/filter/sort/pagination when shareable or reload-persistent.

Use TanStack Query for:

- Server resources.
- Workspace/site/member/variant/tracking data.

Use editor-specific state for:

- Active editor document.
- Local undo/redo.
- Collaboration session.
- Current selection.
- Presence.

Do not put high-frequency editor state in app-wide context that re-renders the shell.

### Forms

Forms should be consistent and validation-driven.

Rules:

- Client validates for fast feedback.
- Server validates authoritatively.
- Server field errors map to form fields.
- Slug availability checks are debounced.
- Save buttons disable only when required; do not trap users in impossible states.
- Preserve user input on validation/server errors.
- Destructive confirmations use explicit text and consequences.

Forms to specify/build:

- Signup.
- Login.
- Account setup.
- Workspace setup.
- Invite user.
- Workspace settings.
- Create site.
- Site settings.
- Variant edit.
- Publish dialog.
- Share/team access.

### Loading, Empty, Error States

Every route/surface should define:

- Loading state.
- Empty state.
- Error state.
- Permission denied state.
- Not found state.

Rules:

- Loading states should preserve layout to avoid jarring shifts.
- Empty states should offer the next useful action.
- `403` should explain lack of access inside the app.
- Public `404` should not reveal private existence.
- Retry actions should be available for transient failures.

### App Shell

The app shell contains:

- Sidebar navigation.
- Workspace/account controls.
- Main content inset.
- Current route header where appropriate.

Rules:

- Shell should not re-render on every editor keystroke.
- Shell should load lightweight data only: current user, active workspace, nav counts if needed.
- Workspace switcher should validate membership and route safely.
- Sidebar should be responsive/mobile-capable before launch if mobile app usage is expected.

### Editor Frontend Architecture

Editor should be isolated as its own heavy feature.

Rules:

- Lazy-load editor route.
- Lazy-load Tiptap extensions that are not needed elsewhere.
- Keep collaboration client scoped to editor route lifecycle.
- Destroy editor/collaboration resources on route leave.
- Keep high-frequency state in refs/editor store, not broad React context.
- Subscribe UI controls to derived state, not the entire editor document.
- Debounce expensive derived calculations like table of contents.

Editor submodules:

```text
features/editor/
  editor-page.tsx
  canvas/
  inspector/
  blocks/
  rich-text/
  collaboration/
  autosave/
  history/
  validation/
```

### Public Site Frontend

Public site rendering should be separate from the authenticated app shell.

Rules:

- No app sidebar/header.
- No editor dependencies.
- No collaboration dependencies.
- Minimal client JavaScript.
- Tracking script is deferred and defensive.
- Embeds lazy-load.
- Images optimized.

If public rendering stays inside the same Vite app initially, still enforce module boundaries so public routes do not import app/editor bundles.

### Bundle And Performance Rules

- Avoid broad barrel imports for heavy modules.
- Prefer direct imports when it keeps bundles smaller.
- Dynamically import heavy editor, charting, and collaboration code.
- Defer third-party scripts.
- Use passive listeners for scroll tracking.
- Avoid unnecessary memoization for simple values, but memoize expensive derived editor/rendering work.
- Use `startTransition` or deferred values for non-urgent UI updates like search/filter result rendering.
- Keep public tracking script dependency-free or near dependency-free.

### Frontend Testing

Frontend tests should cover:

- Auth/onboarding form validation.
- Workspace slug availability states.
- Workspace switching.
- Sites table filters/actions.
- Publish/share modal states.
- Variant create/edit/delete flows.
- Editor content schema operations.
- Variable chip insertion/rendering.
- Permission-based UI states.
- Public route rendering.
- Tracking script behavior with mocked beacon/fetch.

Use E2E tests for critical flows:

- Signup/onboarding.
- Create site.
- Insert variable.
- Create variant.
- Publish.
- Open public variant link.
- Track view/click.
- Invite teammate.

## Settings

### Settings Areas

Settings should be organized into clear areas:

- Profile settings.
- Workspace settings.
- Team settings.
- Billing settings.
- Developer/internal settings, hidden unless allowed.

Avoid a generic settings dumping ground.

### Profile Settings

Profile settings belong to the user.

Fields:

- Name.
- User avatar later.
- Email display.

Rules:

- Email change is not v1 unless BetterAuth account-management flow is specified.
- Profile changes affect user display across workspaces.
- User profile changes do not change workspace membership roles.

### Workspace Settings

Workspace settings belong to the workspace.

Fields:

- Name.
- Slug.
- Website.
- Logo/avatar.

Rules:

- Admin only.
- Workspace slug change blocked after any site has been published.
- Website change can offer logo.dev refresh.
- Logo change affects future sites only.

### Team Settings

Team settings include:

- Active members.
- Pending invites.
- Role changes.
- Member removal.
- Invite resend/revoke.

Rules:

- Follows User Management rules.
- Last-admin protections always enforced server-side.

### Billing Settings

Billing settings include:

- Current plan.
- Usage limits.
- Upgrade/downgrade.
- Payment/customer portal later.

Rules:

- Admin only.
- Billing provider integration should be isolated.
- Plan limits enforced by backend, not only UI.

### Danger Zone

Danger zone actions are later-stage:

- Leave workspace.
- Delete workspace.
- Hard-delete site if ever added.

Rules:

- Strong confirmation.
- Server-side permission checks.
- Clear data consequences.
- Prefer disabled/unavailable until retention/audit rules exist.

## Billing And Plans

### Plan Model

Initial plans:

- Basic.
- Pro.

Initial site limits:

- Basic: 1 total site.
- Pro: 100 total sites.

Rules:

- Backend enforces limits.
- UI shows usage before blocking where possible.
- Archived sites count in v1.
- Plan limits should be centralized in config/service code.

### Future Plan Dimensions

Potential limits:

- Sites.
- Team members.
- Variants per site/workspace.
- Monthly tracked events.
- Raw analytics retention.
- Asset storage.
- Custom domains.
- Collaboration seats.

Do not hard-code plan behavior directly into UI components or route handlers.

### Upgrade Prompts

Upgrade prompts should appear when:

- Creating site would exceed limit.
- Duplicating site would exceed limit.
- Feature is plan-gated later.
- Tracking retention/view is plan-gated later.

Prompts should explain:

- Current plan.
- Current usage.
- Required plan.
- Next action.

### Billing Provider

Future provider is likely Stripe.

Rules:

- Billing is workspace-owned.
- Store provider IDs in billing tables.
- Verify webhooks.
- Treat billing webhooks as source of truth for subscription status.
- Do not trust client-side checkout completion alone.

## Hosting And Deployment

### Hosting Goals

Hosting should be:

- Cheap and simple for v1.
- Easy to operate.
- Able to scale public page traffic separately from editor/API traffic.
- Friendly to preview deployments.
- Not locked into a dead-end architecture.

### V1 Hosting Shape

Recommended starting architecture:

- Web app/public frontend: Vercel or similar static/edge-friendly hosting.
- API: Railway, Render, Fly.io, or similar Node hosting.
- Postgres: managed Postgres, ideally Neon, Supabase, Railway Postgres, or Render Postgres.
- Object storage: Cloudflare R2 or S3-compatible storage.
- Realtime: API process WebSocket initially, separate service later if needed.
- Background jobs: same platform cron/scheduled jobs initially, worker service later.

Decision should optimize for speed and simplicity now, while keeping clean boundaries:

- Frontend does not assume API and web are the same server.
- Public rendering can be moved/optimized independently.
- Assets are in object storage/CDN, not local filesystem.
- Realtime can be split later.

### Environments

Required environments:

- Local.
- Preview.
- Production.

Potential later:

- Staging.

Rules:

- Each environment has separate database.
- Production secrets are not used in preview/local.
- Preview environments can use disposable or shared preview database depending on cost, but must not touch production data.
- Public URLs and auth callback URLs must be environment-specific.

### Environment Variables

Expected variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `WEB_ORIGIN`
- `API_PORT`
- `LOGO_DEV_TOKEN`
- Object storage access keys/bucket/region.
- Public asset CDN base URL.
- Stripe keys later.
- Email provider keys later.

Rules:

- Secrets are server-only.
- Client-exposed env vars must be prefixed/managed explicitly and reviewed.
- Never expose `LOGO_DEV_TOKEN` to the client.
- Never commit real production secrets.
- `.env.example` contains placeholders only.

### Public Page Hosting Strategy

Public pages can be rendered through:

- The web app route layer, fetching public payloads from API.
- API-rendered HTML later if needed.
- Edge/serverless rendering later if public traffic demands it.

V1 should prioritize correctness:

- Public route fetches published snapshot by slug.
- Public bundle excludes editor/app shell.
- Public responses are cacheable with version-aware invalidation.

Scaling path:

- Cache public route payloads by published version and by variant revision when a variant is present.
- Move public rendering to edge/serverless if needed.
- Use CDN for assets.
- Use lightweight tracking endpoint separate from render path.

### Realtime Hosting

V1:

- WebSocket support in API process is acceptable if hosting provider supports it.
- If provider/serverless environment does not support WebSockets well, use a managed realtime provider or separate Fly/Railway service.

Rules:

- Realtime service authenticates and authorizes room joins.
- Realtime room state is ephemeral.
- Persistent draft state goes to Postgres through debounced saves.
- If realtime service restarts, clients reload latest persisted draft and reconnect.

### Deployment Rules

- Run typecheck, lint, tests, and build before production deploy.
- Run database migrations before app code that depends on them.
- Use backwards-compatible migration patterns.
- Keep deploy rollback path clear.
- Avoid deploys that require coordinated manual DB edits.

### Cost Controls

Cost controls:

- Public pages cache by published version and variant revision when applicable.
- Assets served from CDN/object storage.
- Tracking events batched.
- Presence not persisted.
- Version checkpoints throttled.
- Analytics rollups instead of scanning raw events forever.
- Heavy editor code lazy-loaded.
- Dynamic OG generation avoided in v1.

## Security And Privacy

### Security Goals

Security should be built into the architecture, not patched onto routes later.

Core goals:

- Protect customer workspaces.
- Protect unpublished sales content.
- Protect invite flows.
- Prevent public route data leaks.
- Prevent XSS from editor content.
- Protect secrets.
- Keep tracking privacy-conscious.

### Auth And Session Security

Rules:

- Use BetterAuth secure session defaults.
- Use secure cookies in production.
- Use CSRF protections where relevant.
- Password reset/email flows handled by BetterAuth/provider.
- Invalidate sessions appropriately on logout.
- Workspace membership removed means access stops on next request/realtime check.

### Authorization

Rules:

- Every workspace-owned read/write checks membership.
- Every site-owned read/write checks site permissions.
- Frontend permission checks are UX only.
- Backend permission helpers are the source of truth.
- Public routes never use app permissions to leak draft/private state.

### XSS Protection

Highest-risk area: editor content rendered publicly.

Rules:

- Store rich text as structured JSON.
- Render with allowlisted nodes/marks.
- Do not render arbitrary HTML.
- Sanitize URLs.
- Block dangerous protocols.
- Restrict embeds to allowed providers.
- Use CSP where practical.
- Escape all text by default.

### Upload Safety

Rules:

- Validate file type and signature.
- Avoid user SVG in v1 unless sanitized.
- Do not allow HTML/script uploads for public rendering.
- Use safe content-type headers.
- Do not use raw filenames for storage paths.
- Strip metadata where practical.

### Tracking Privacy

Rules:

- Avoid storing raw IP addresses by default.
- Normalize user-agent into useful fields instead of retaining raw forever.
- Do not fingerprint aggressively.
- Keep event metadata bounded.
- Do not collect form inputs/keystrokes.
- Do not track mouse movement.
- Public analytics are workspace-private.

### Secret Handling

Secrets:

- BetterAuth secret.
- Database URL.
- logo.dev token.
- Storage credentials.
- Stripe/email provider credentials later.

Rules:

- No secrets in client bundles.
- No secrets in logs.
- No secrets in docs except local `.env` when explicitly configured.
- Rotate if exposed.
- Use environment secret manager in production.

### Rate Limiting And Abuse

Rate-limit:

- Auth attempts.
- Signup.
- Invite sends.
- Slug checks.
- Upload intents.
- Public tracking ingestion.
- Public page abuse if needed.

Abuse cases:

- Invite spam.
- Tracking endpoint spam.
- Huge upload attempts.
- Slug enumeration.
- Public page scraping.

Responses should be safe and not reveal unnecessary existence information.

### Auditability

Important actions should be auditable:

- Workspace settings changes.
- Role changes.
- Member removals.
- Invite sends/revokes.
- Publish/unpublish/archive.
- Site access changes.

V1 can start with actor/timestamp columns and structured logs. Add audit table when needed.

## Operational Basics

### Logging And Monitoring

Monitor:

- API errors.
- Public render errors.
- Tracking ingestion failures.
- Realtime disconnect/error rates.
- Job failures.
- Database migration failures.
- Asset upload failures.

Log with:

- Request ID.
- User/workspace/site IDs where applicable.
- Error code.
- Duration.

Do not log secrets or sensitive content.

### Error Monitoring

Use an error monitoring service when available.

Rules:

- Group errors by stable codes.
- Include request ID.
- Redact sensitive payloads.
- Separate public render errors from app/editor errors.

### Database Backups

Rules:

- Managed Postgres backups enabled in production.
- Point-in-time recovery preferred.
- Test restore process before relying on it.
- Keep migrations in source control.

### Local Development

Local dev should be easy:

- One command to start web/API where practical.
- Local Postgres or documented managed dev DB.
- `.env.example` up to date.
- Seed script for demo workspace/sites.
- Clear reset command.

Seed data should include:

- Workspace.
- Admin user/member.
- Sample site.
- Variables.
- Variants.
- Tracking events.

### Testing Strategy

Testing layers:

- Unit tests.
- Integration tests.
- API tests.
- Content schema/migration tests.
- Permission matrix tests.
- Frontend component tests where useful.
- E2E tests for critical flows.

Critical backend tests:

- Work email validation.
- Workspace slug uniqueness race.
- Workspace creation transaction.
- Invite acceptance/revocation.
- Last-admin protections.
- Site create/duplicate/archive.
- Publish/republish/unpublish.
- Rollback.
- Variant create/edit/delete.
- Public 404 behavior.
- Tracking ingestion validation.
- Asset upload finalize.

Critical frontend/E2E tests:

- Signup/onboarding workspace setup.
- logo.dev fallback state mocked.
- Create site.
- Editor autosave visible state.
- Insert variable.
- Create variant.
- Publish site.
- Open public variant link.
- Track view/click.
- Invite teammate.
- Permission denied states.

### Content Schema Tests

Content tests should include:

- Valid sample documents.
- Invalid block IDs.
- Unknown block types.
- Missing variables.
- Broken asset references.
- Migration from old schema version.
- Public renderer safe output.

### Performance Testing

Performance should be checked for:

- Public page first load.
- Editor load.
- Editor typing latency.
- Large site with max-ish blocks.
- Tracking script overhead.
- Sites table with many records.
- Tracking feed with many events.

Protect against:

- Editor re-rendering whole app on keystrokes.
- Public route loading editor bundles.
- Tracking script sending too many events.
- Analytics queries scanning raw event table without indexes.

### Release Checklist

Before launch:

- Auth flows tested.
- Workspace setup tested.
- Permissions tested.
- Public draft leakage impossible.
- Publish/unpublish/archive tested.
- Tracking privacy reviewed.
- Asset upload security reviewed.
- Rate limits configured.
- Backups enabled.
- Error monitoring enabled.
- Production secrets configured.
- `.env.example` current.

## App Shell And Navigation

### Shell Purpose

The app shell is the stable workspace for authenticated users.

It should:

- Make primary navigation obvious.
- Keep workspace context visible.
- Keep account/team actions discoverable.
- Avoid distracting from repeated sales workflows.
- Stay lightweight and independent from high-frequency editor state.

The app shell is not used for public visitor pages.

### Primary Navigation

Primary sidebar routes:

- Sites.
- Tracking.
- Team.
- Settings.

Optional/internal routes:

- Design system.
- Component index.
- Developer/debug views if internal access is enabled.

Rules:

- Active route should be visually clear.
- Route labels should be stable.
- Sidebar should not include marketing/help text that explains the app.
- Sidebar actions should be compact and predictable.
- "New site" should be available from the sidebar and Sites page.

### Header Behavior

Authenticated app pages may have a content header.

Rules:

- Header title should reflect current route or object.
- Header actions should be route-specific.
- Header should not duplicate sidebar navigation.
- Header should preserve stable height to avoid layout shifts.

Examples:

- Sites page: title + Create site.
- Tracking page: title + filters/search if appropriate.
- Team page: title + Invite user.
- Settings page: title + relevant save/status.
- Editor: custom editor header, not generic page header.

### Workspace Switcher

Workspace switcher should show:

- Current workspace logo/avatar.
- Current workspace name.
- List of accessible workspaces.
- Create workspace action.

Rules:

- Switching workspace updates active workspace context.
- If current route is workspace-scoped but not object-specific, keep same route in new workspace.
- If current route references a site/member/variant from previous workspace, route to the new workspace's Sites page.
- If selected workspace becomes inaccessible, show workspace unavailable and route to another accessible workspace or workspace setup.

Performance:

- Workspace list is small for most users and can be loaded with app bootstrap.
- Do not refetch heavy workspace data just to open the switcher.

### Account Menu

Account menu should include:

- User name/email.
- Profile settings.
- Workspace switcher/create workspace if not elsewhere.
- Log out.

Future:

- Theme mode.
- Help/docs.
- Developer tools when `isDeveloper` is true.

Rules:

- Logout clears query cache and closes realtime connections.
- Account menu should not expose admin-only workspace actions to non-admins.

### Route Guards

Route guard behavior:

- Public routes are available without auth.
- Auth routes redirect authenticated users to app home/workspace.
- App routes require authenticated user.
- Workspace app routes require active workspace membership.
- Site editor routes require site access.
- Settings/team admin subroutes require admin where applicable.

Failure routing:

- `401`: redirect to login with return URL where safe.
- `403`: show permission denied page inside app.
- `404`: show not found for inaccessible/missing object.
- Lost workspace access: route to workspace selection.

### Global Loading And Error Boundaries

The app should have:

- Root app loading state.
- Route-level loading states.
- Route-level error boundaries.
- Editor-specific error boundary.
- Public-route error boundary.

Rules:

- An editor runtime error should not break the entire authenticated app permanently.
- Public rendering errors should not show app shell.
- Error states should include request ID when available.

### Responsive Behavior

V1 should be desktop-first because editing complex one-pagers is primarily a desktop workflow.

Still required:

- Public pages must be fully mobile responsive.
- Authenticated app should not be unusable on tablet.
- Sidebar should collapse or become drawer on small screens.
- Editor may show "desktop recommended" if full editing is too constrained on mobile.

Rules:

- Do not let mobile shell layout overlap content.
- Public site mobile experience is launch-critical.
- Editor mobile creation can be limited if explicitly messaged.

### App Bootstrap Data

On app load, fetch minimal bootstrap data:

- Current user.
- Accessible workspaces.
- Active workspace.
- Current workspace member/role.

Do not fetch:

- All sites.
- All tracking events.
- Editor data.
- Full member list.

This keeps the app shell light and avoids startup waterfalls.

### App Shell State Boundaries

App shell may subscribe to:

- Current user.
- Active workspace.
- Current route.
- Lightweight nav state.

App shell must not subscribe to:

- Editor document content.
- Editor selection.
- Collaboration presence changes.
- Tracking feed live data.

This avoids re-rendering the entire app on high-frequency updates.

## Team Access And Site Permissions

### Purpose

Team access defines who can view, copy, edit, and manage a site inside the authenticated workspace.

It is separate from:

- Workspace role.
- Public visitor access.
- Variant link access.

Workspace admins have broad workspace authority. Site access gives non-admin users scoped access to specific sites.

### Site Access Roles

Site access roles:

- `none`
- `view_copy`
- `edit`

Meaning:

- `none`: no explicit access.
- `view_copy`: can view inside app, preview, copy/duplicate, and copy share links if published.
- `edit`: can edit draft, manage variants, publish if allowed, and update site settings.

Workspace admins:

- Can view/manage all sites regardless of site access records.

Creator:

- Can manage their created site while they remain an active workspace member, unless product later adds ownership transfer/revocation rules.

### Access Precedence

Decision for v1:

- Workspace admin access wins.
- Site creator access applies while creator is active member.
- Explicit member access and entire-team access combine by strongest role.
- No explicit deny/override semantics in v1.

Role strength:

```text
none < view_copy < edit
```

This is simple and avoids confusing "why can't I access this if the team has access?" states.

### Visibility vs Access

Site visibility:

- `private`
- `team`

Rules:

- `private` means only creator, admins, and explicitly granted users can see it.
- `team` means all active workspace members can see it with the configured team role.
- Visibility affects authenticated app access.
- Visibility does not affect public link availability.
- Public link availability is publish-status based.

### Team Access Modal

Team access modal should allow:

- View current access state.
- Toggle/share with entire team.
- Choose entire-team access role: view & copy or edit.
- Search workspace members.
- Add specific member access.
- Change member access role.
- Remove member access.

Rows should show:

- Member avatar.
- Name.
- Email.
- Current access role.

Role controls:

- None/remove.
- View & copy.
- Edit.

Rules:

- Admins can manage access for any site.
- Users with edit access can manage site access.
- Users with edit access cannot remove admin access because admin access is implicit.
- A non-admin user cannot remove their own edit access on a site where they are the only non-admin editor.

### Entire-Team Sharing

Entire-team access applies to:

- Current workspace members.
- Future workspace members.

Rules:

- If entire-team access is set to `view_copy`, all members can see/copy.
- If set to `edit`, all members can edit.
- Changing entire-team role updates effective access immediately.
- Removing entire-team access leaves explicit member access intact.

UI should clearly say:

- "Anyone in this workspace, including future members."

### Specific Member Sharing

Rules:

- Specific member access grants access only to that workspace member.
- If member is removed from workspace, their site access no longer applies.
- Access rows can remain historically or be cascaded/deleted; effective access must stop immediately.

Recommended data behavior:

- `site_access.workspace_member_id` cascades on workspace member removal.
- Historical actions remain in audit/version metadata by user ID.

### Permission Matrix For Site Actions

| Action | Admin | Creator | Edit Access | View & Copy |
| --- | --- | --- | --- | --- |
| See site in Sites page | Yes | Yes | Yes | Yes |
| Open editor read-only | Yes | Yes | Yes | Yes |
| Edit draft content | Yes | Yes | Yes | No |
| Duplicate site | Yes | Yes | Yes | Yes |
| Manage variants | Yes | Yes | Yes | No |
| Copy published links | Yes | Yes | Yes | Yes |
| Publish/republish | Yes | Yes | Yes | No |
| Unpublish | Yes | Yes | Yes | No |
| Archive | Yes | Yes | Yes | No |
| Manage team access | Yes | Yes | Yes | No |
| View analytics | Yes | Yes | Yes | Yes, if site shared |

If this is too permissive later, the spec can split `edit` and `manage` roles. V1 keeps roles simple.

### Access Failure States

If user lacks access:

- Sites page: do not show private inaccessible sites.
- Direct editor URL: show 404 or permission denied depending on whether user can know the site exists. Recommended app behavior: show permission denied if site exists in current workspace but user lacks access.
- Public route: access rules do not apply; only publish status matters.

If access changes while user is editing:

- Realtime server stops accepting operations.
- Client switches to read-only.
- Show message: access changed.

If site is archived while user is viewing:

- Editor switches to read-only archived state.
- Public link returns 404.

## End-To-End User Flows

### Flow Principles

Every important workflow should define:

- Entry point.
- Preconditions.
- Steps.
- Backend state changes.
- Success state.
- Failure states.
- Permission behavior.
- Tracking/analytics side effects if any.

These flows should become the basis for E2E tests.

### Sign Up With Work Email

Entry points:

- Signup page.
- Invite acceptance page for new user.

Preconditions:

- User is logged out.

Steps:

1. User enters work email.
2. User enters password or follows BetterAuth signup method.
3. Client validates email syntax, no plus alias, and personal-domain blocklist.
4. Server repeats validation.
5. BetterAuth creates user/session.
6. App routes to account setup or invite continuation.

Success state:

- User exists.
- Session active.
- User proceeds to account setup.

Failure states:

- Personal email: show work-email requirement.
- Plus alias: show no-plus-alias error.
- Existing account: route to login.
- BetterAuth failure: show safe auth error.

### User Account Setup

Preconditions:

- Authenticated user.
- User profile missing required name.

Steps:

1. User enters name.
2. Client validates non-empty.
3. Server saves profile.
4. App determines next step.

Next step:

- Pending invite: continue invite acceptance.
- No workspace: workspace setup.
- Existing workspace: app home.

Failure states:

- Name invalid.
- Session expired.
- Network failure.

### Workspace Setup

Preconditions:

- Authenticated user.
- User has no active workspace or chose create workspace.

Steps:

1. User enters workspace name.
2. App generates editable slug.
3. User edits slug if desired.
4. App checks slug availability with debounce.
5. User enters website.
6. App normalizes website domain.
7. Server fetches logo.dev preview if configured.
8. User accepts suggested logo, uploads own logo, or skips.
9. User submits.
10. Server validates all fields.
11. Server creates workspace and admin membership transactionally.
12. App sets active workspace.
13. App routes to Sites empty state or create-first-site prompt.

Backend state changes:

- Workspace created.
- Workspace member created with admin role.
- Workspace logo asset created if selected.
- Last active workspace set.

Failure states:

- Slug unavailable.
- Slug claimed between check and submit.
- Website invalid.
- logo.dev unavailable.
- Upload failed.
- Transaction failure.

Rules:

- logo.dev failure never blocks workspace setup.
- Transaction failure cannot leave workspace without admin membership.

### Accept Invite

Preconditions:

- Valid invite token.

Steps:

1. User opens invite link.
2. Server validates token hash, status, expiry, workspace.
3. If logged out, user signs up/logs in.
4. Server checks authenticated email matches invite email.
5. User completes account setup if needed.
6. Server creates workspace membership transactionally.
7. Invite marked accepted.
8. App switches to invited workspace.

Failure states:

- Token invalid.
- Token expired.
- Invite revoked.
- Invite already accepted.
- Logged-in email mismatch.
- User already active member.

Rules:

- Invite tokens should not be logged.
- Acceptance should be idempotent where possible.

### Switch Workspace

Preconditions:

- User belongs to multiple workspaces.

Steps:

1. User opens workspace switcher.
2. User selects workspace.
3. App updates active workspace.
4. App validates route compatibility.
5. App routes appropriately.

Route behavior:

- Generic route like `/sites`: stay on same route.
- Object route like editor for previous workspace's site: route to `/sites`.
- Settings route: stay if settings section exists for new workspace and user has permission.

Failure states:

- Workspace no longer accessible.
- Network failure.

### Invite Teammate

Preconditions:

- User is active workspace member.
- Invite policy allows user to invite.

Steps:

1. User opens Team page.
2. User clicks Invite.
3. User enters work email and role.
4. Client validates email.
5. Server validates email and permission.
6. Server creates or resends pending invite.
7. Email is sent.
8. Pending invite appears in Team page.

Failure states:

- Personal email.
- Plus alias.
- Already member.
- Invite already pending.
- Rate limit.
- Email provider failure.

Rules:

- If email provider fails after invite record creation, invite should show send-failed/resend state or job retry.

### Change Member Role

Preconditions:

- Current user is admin.
- Target user is active member.

Steps:

1. Admin opens member menu.
2. Admin chooses role change.
3. If demoting admin, confirmation dialog appears.
4. Server checks current user admin.
5. Server checks target is not current user.
6. Server checks target is not last admin.
7. Server updates role.

Failure states:

- Target is self.
- Target is last admin.
- Permission lost.
- Target already removed.

### Remove Member

Preconditions:

- Current user is admin.
- Target user is active member and not self.

Steps:

1. Admin opens member menu.
2. Admin chooses remove.
3. Confirmation explains access removal.
4. Server checks admin permission and last-admin rule.
5. Server removes/deactivates membership.
6. Active sessions/realtime access stop on next check.

State changes:

- Member removed/deactivated.
- Site access records stop applying.
- Created sites remain in workspace.

### Create First Site

Preconditions:

- Active workspace.
- User can create site.
- Plan limit not reached.

Steps:

1. User clicks New site/Create site.
2. User enters site name.
3. App generates slug.
4. Server validates plan limit and slug uniqueness.
5. Server creates draft site.
6. Server creates initial site version.
7. App routes to editor.

State changes:

- Draft site created.
- Initial content copied from default template.
- Workspace logo copied as site avatar if available.

Failure states:

- Plan limit reached.
- Slug conflict.
- Workspace inaccessible.

### Build/Edit Site

Preconditions:

- User has edit access.
- Site is draft or published, not archived.

Steps:

1. User opens editor.
2. App loads site draft, variants summary, permissions.
3. Editor initializes local state.
4. Collaboration room joins if enabled.
5. User edits content.
6. Autosave persists draft.
7. UI shows saved/unpublished changes state.

State changes:

- Draft content updates.
- Draft revision increments.
- Autosave checkpoint may be created on cadence.
- Published snapshot unchanged.

Failure states:

- Permission lost.
- Site archived by another user.
- Autosave failure.
- Collaboration reconnect.
- Invalid content operation.

### Insert Variable

Preconditions:

- User is editing a supported field.

Steps:

1. User opens Insert Variable menu.
2. User selects existing variable or creates new one.
3. If new, user enters key/type/default.
4. Server/editor validates unique variable key.
5. Variable is added to draft registry.
6. Variable atom chip is inserted into rich text or attached to field.
7. Autosave/collaboration syncs change.

Failure states:

- Duplicate variable key.
- Invalid key.
- Unsupported variable type for field.
- Concurrent create conflict.

### Create Variant

Preconditions:

- User has edit access.
- Site exists.

Steps:

1. User opens Variants modal.
2. User clicks New Variant.
3. User enters name.
4. App generates slug.
5. User fills variable overrides.
6. Server validates slug and values.
7. Variant is created.
8. UI shows copyable link.

State changes:

- Variant row created.
- Variable overrides saved by variable ID.

Failure states:

- Slug conflict.
- Invalid variable value.
- Parent site archived.
- Permission lost.

### Publish Site

Preconditions:

- User has publish/edit access.
- Site is not archived.
- Draft content exists.

Steps:

1. User clicks Publish.
2. Publish dialog opens.
3. Validation runs.
4. User confirms.
5. Backend flushes/uses latest accepted draft.
6. Backend validates again.
7. Backend creates publish version.
8. Backend points site to published version.
9. Status becomes published.
10. UI shows share options.

Failure states:

- Invalid content.
- Broken asset.
- Missing required URL.
- Unsaved collaboration operations cannot flush.
- Permission lost.
- Site archived during publish.

Rules:

- Publish transaction must be atomic.
- Public rendering only sees new snapshot after publish succeeds.

### Republish Site

Preconditions:

- Site is already published.
- Draft differs from published version.

Steps:

1. User clicks Publish/Republish.
2. Dialog shows unpublished changes and current public link.
3. User confirms.
4. Backend creates new publish version.
5. Public snapshot updates.
6. Active editors are notified.

State changes:

- New publish version.
- `publishedVersionId` changes.
- Analytics after this point reference new version.

### Unpublish Site

Preconditions:

- Site is published.
- User has permission.

Steps:

1. User chooses Unpublish.
2. Confirmation explains links stop working and tracking stops.
3. User confirms.
4. Backend sets status to draft and records `lastUnpublishedAt`.
5. Public routes return 404.
6. Share UI becomes publish-first state.

State changes:

- Published version retained but not served.
- Existing analytics retained.

### Share Default Link

Preconditions:

- Site is published.
- User can view/copy/share.

Steps:

1. User opens Share modal.
2. Modal shows canonical default link.
3. User copies link.
4. App confirms copied.

Failure states:

- Clipboard unavailable.
- Site unpublished after modal opened.
- Permission lost.

### Share Variant Link

Preconditions:

- Site has variant.
- Site is published for link to work.

Steps:

1. User opens Variants modal or Share modal.
2. User selects/creates variant.
3. UI shows canonical variant link.
4. User copies link.

If site is not published:

- Show link as unavailable or prompt to publish.
- Do not imply prospect can open it yet.

### Prospect Opens Default Link

Preconditions:

- Site is published.

Steps:

1. Prospect opens `/{workspaceSlug}/{siteSlug}`.
2. Public route resolves workspace/site.
3. Server loads published snapshot.
4. Variables resolve to defaults.
5. Public page renders.
6. Tracking script sends human view if not bot.
7. Scroll/click/time events are tracked.

Failure states:

- Unpublished/archived/missing: 404.
- Render error: safe error/404 and internal log.
- Tracking blocked: page still works.

### Prospect Opens Variant Link

Preconditions:

- Site is published.
- Variant exists and is active.

Steps:

1. Prospect opens `/{workspaceSlug}/{siteSlug}/{variantSlug}`.
2. Public route resolves workspace/site/variant.
3. Server loads published snapshot.
4. Variables resolve with variant overrides.
5. Public page renders.
6. Tracking attributes events to variant.

Failure states:

- Variant deleted/missing: 404.
- Parent site unpublished/archived: 404.
- Tracking blocked: page still works.

### Slack Preview Loaded

Preconditions:

- A public link is pasted into Slack or similar tool.

Steps:

1. Slackbot requests URL metadata and/or OG image.
2. Server classifies request as preview bot.
3. Server returns OG metadata/image.
4. Tracking records `link_preview_loaded` with platform.
5. Event is excluded from human views.

Rules:

- Deduplicate repeated preview fetches.
- UI labels event as preview loaded, not confirmed human view.

### View Tracking

Preconditions:

- User has access to workspace and site analytics.

Steps:

1. User opens Tracking page.
2. App fetches paginated event feed.
3. User searches/filters/sorts.
4. User opens site/variant detail if built.

Rules:

- Human events and preview/bot events should be visually distinct.
- Feed queries are server-side paginated.
- Raw event table queries must use indexes.

Failure states:

- No events.
- Filter returns no results.
- Permission denied.

### Roll Back Site Version

Preconditions:

- User has edit access.
- Site has versions.
- Site not archived.

Steps:

1. User opens version history.
2. User previews a version.
3. User chooses restore.
4. Confirmation explains draft replacement and public site unchanged.
5. Backend creates rollback version.
6. Backend updates draft content.
7. Editor reloads restored draft.
8. User may republish.

Failure states:

- Version missing.
- Permission lost.
- Site archived.
- Active editors present; confirmation required and clients reload.

### Archive Site

Preconditions:

- User has archive/manage permission.

Steps:

1. User chooses Archive.
2. Confirmation explains public links stop and tracking stops.
3. Backend sets status archived and `archivedAt`.
4. Site disappears from default active list.
5. Public links return 404.

State retained:

- Draft content.
- Versions.
- Variants.
- Analytics.
- Access records.

### Restore Archived Site

Preconditions:

- User has manage permission.
- Site is archived.

Steps:

1. User views archived filter/list.
2. User chooses Restore.
3. Backend sets status draft and clears/restores archived state.
4. Site returns to active draft list.

Rules:

- Restore does not republish.
- User must publish again for public links.

### Duplicate Site

Preconditions:

- User has edit or view_copy access.
- Plan limit allows another site.

Steps:

1. User chooses Duplicate.
2. Backend determines copy source based on permission.
3. Backend creates private draft copy.
4. Variables/defaults copied.
5. Variants and analytics not copied.
6. User is routed to new draft or sees it in list.

Failure states:

- Plan limit reached.
- Source inaccessible.
- Asset reference invalid.

### Collaboration Flow

Preconditions:

- Two users have edit access.
- Site not archived.

Steps:

1. User A opens editor and joins room.
2. User B opens editor and joins same room.
3. Presence appears.
4. User A edits text.
5. User B sees accepted changes.
6. Server batches persistence.
7. Autosave status updates.

Conflict examples:

- Same rich text field: CRDT resolves.
- Same scalar setting: last accepted write wins.
- Block deleted while edited: delete wins; recovery via undo/version history.

Failure states:

- User loses access.
- Realtime disconnects.
- Server restarts.
- Rollback occurs.

### Upgrade From Plan Limit

Preconditions:

- User attempts create/duplicate site beyond plan limit.

Steps:

1. UI detects current usage when possible.
2. User sees plan limit state.
3. Admin can go to billing/upgrade.
4. Non-admin sees ask-admin messaging.

Backend:

- Always enforces limit even if UI missed it.

## Design System And UI Quality

### Design System Purpose

The design system should make Lightsite easier to build, not harder.

It should provide:

- Consistent primitives.
- Predictable spacing and sizing.
- Clear tokens.
- Reusable composed components.
- Accessible interaction patterns.
- A stable basis for editor and app surfaces.

The design system should not become a dumping ground for product-specific one-offs.

### Source Of Truth

Sources of truth:

- Figma file for visual decisions and shadcn token alignment.
- `apps/web/src/index.css` for theme tokens.
- `apps/web/src/components/ui` for shadcn primitives and reusable primitive variants.
- `apps/web/src/components/layout` for shell/page chrome.
- `features/*/components` for feature-owned UI.
- `AGENTS.md` for repo-level component organization rules.

Rules:

- Base shadcn tokens come from the Figma mode variable collection.
- Lightsite semantic tokens are allowed when they represent product meaning.
- Current Lightsite semantic tokens include `page-background`, `tertiary-foreground`, `variable-*`, and `editing-*`.
- Add new semantic tokens only when the meaning is reusable and product-level.
- Do not introduce raw Tailwind color palettes inside product components.

### Component Ownership

Component ownership:

- `components/ui`: primitive layer.
- `components/layout`: app shell, sidebar, headers, route chrome.
- `components/common`: app-wide composed components with proven reuse.
- `components/data-display`: reusable tables, lists, metrics, empty states.
- `components/feedback`: confirmations, alerts, toast helpers.
- `features/*/components`: feature-specific UI.

Promotion rule:

- One feature uses it: keep in feature.
- Two or more unrelated features use it: promote to shared composed folder.
- App frame uses it: move to layout.
- Primitive behavior changes everywhere: update primitive.

### shadcn Primitive Rules

Rules:

- Use shadcn primitives as the base for app UI.
- Modify base primitives only when the change is reusable across the app.
- Add variants with `cva` when a reusable variant is needed.
- Avoid product-specific props in primitive components.
- Do not wrap primitives with hidden styling that makes behavior unpredictable.
- Preserve upstream accessibility behavior when modifying primitives.

Examples:

- Button size/variant used app-wide belongs in `components/ui/button`.
- Site-specific action button composition belongs in feature components.
- Confirmation dialog pattern belongs in feedback/common if reused.

### Icon Rules

Rules:

- Product UI uses `@tabler/icons-react`.
- Icons from Figma should be matched with Tabler equivalents.
- Keep generated shadcn primitive internals stable unless intentionally migrating primitive icons.
- Buttons with leading/trailing icons use `data-icon`.
- Icon-only buttons require accessible labels and tooltips where meaning is not obvious.

### Tables And Lists

Tables/lists are central to Sites, Tracking, Team, and future asset views.

Rules:

- Use consistent table/list primitives.
- Server-side pagination for growing data.
- Search/filter/sort state should be URL-backed when useful.
- Empty, loading, and error states are required.
- Row action menus should be keyboard accessible.
- Destructive row actions require confirmation.

### Dialogs And Drawers

Rules:

- Use shadcn dialog/sheet/drawer primitives.
- Dialogs must have title and description.
- Escape/click-outside behavior should be intentional for forms with unsaved changes.
- Destructive confirmations should state consequences.
- Modals should not contain unrelated navigation.
- Avoid nested modals unless unavoidable; prefer replacing modal content state.

Important modals:

- Create site.
- Publish.
- Share.
- Variants.
- Team access.
- Invite member.
- Role change confirmation.
- Archive/unpublish confirmation.
- Version restore confirmation.

### Form UX

Rules:

- Required fields are clear.
- Field-level errors map from server validation.
- Submit buttons should show pending state.
- Preserve input on error.
- Debounced validation should show checking/available/unavailable states.
- Avoid disabling fields without explanation.
- Confirmation dialogs are used for destructive or link-breaking actions.

### Editor UI Quality

Editor-specific rules:

- Selection states should be obvious but not noisy.
- Variable chips should be visually distinct and keyboard navigable.
- Hover controls should not shift layout.
- Drag handles should appear predictably.
- Inspector sidebar should show controls relevant to current selection.
- Autosave state should be visible but calm.
- Collaboration presence should not distract from editing.

### Public Site UI Quality

Public site rules:

- Mobile rendering is launch-critical.
- Public pages should be visually polished and fast.
- Public pages should not show internal app controls.
- Broken/missing optional content should fail gracefully.
- Required broken content should be caught before publish.
- External embeds should lazy-load and not destabilize layout.

### Design System Page

The design system page should remain a live internal reference.

It should show:

- Tokens.
- Base primitives.
- App-specific composed components.
- Editor states.
- Variable chips.
- Public rendering blocks.
- Empty/loading/error states.

Rules:

- Design system examples should use real app components where possible.
- Do not let the design system page become the only place a component works.

## Accessibility

### Accessibility Goals

Lightsite should be accessible by default.

Goals:

- Keyboard-accessible authenticated app.
- Keyboard-accessible editor controls where practical.
- Accessible public pages.
- Clear focus states.
- Semantic HTML.
- Color contrast that meets WCAG AA for core UI.

### General Rules

- Use semantic elements before ARIA.
- Every icon-only button has an accessible name.
- Form fields have labels.
- Errors are associated with fields.
- Dialogs trap focus and restore focus on close.
- Menus are keyboard navigable.
- Focus states are visible.
- Text contrast meets AA.
- Do not rely on color alone to communicate status.

### Editor Accessibility

Editor accessibility is harder and should be handled intentionally.

Rules:

- Text editing must remain keyboard usable.
- Toolbar/inspector controls must be reachable by keyboard.
- Variable chips should have readable labels.
- Drag/reorder should have non-pointer alternatives or at least not block core editing.
- Selection state should be communicated visually and with accessible labels where appropriate.
- Autosave status should be available to assistive tech without being noisy.

Recommended:

- Provide keyboard shortcuts for common editor actions.
- Provide menu-based alternatives for block insert/delete/reorder.

### Public Site Accessibility

Public pages should be accessible to prospects.

Rules:

- Correct heading structure.
- Images have alt text or are marked decorative.
- Buttons/links have clear labels.
- External links are still normal links.
- Embeds include titles where possible.
- Accordions are keyboard accessible.
- Tables have appropriate semantics.
- Color contrast is checked for public design.

Publish validation should warn or block:

- Missing alt text on meaningful images.
- Empty button labels.
- Invalid heading structure if severe.
- Empty required text.

### Motion And Interaction

Rules:

- Respect reduced-motion preferences.
- Avoid required hover-only interactions.
- Keep animations subtle and non-blocking.
- Do not animate layout in ways that make text hard to read.

### Accessibility Testing

Testing should include:

- Keyboard pass through primary app routes.
- Screen-reader label checks for forms/dialogs.
- Automated accessibility checks for core pages.
- Public site generated from sample content.
- Editor smoke test for keyboard text editing and toolbar access.

Accessibility issues found in primitives should be fixed at the primitive layer when reusable.

## Email And Notifications

### Purpose

Email and notifications should support core product workflows without becoming a noisy engagement system.

V1 email exists for:

- Authentication.
- Verification.
- Workspace invitations.
- Security-sensitive account actions.
- Billing/provider-required notices.
- Critical operational notices, if needed.

V1 should not include generic marketing notifications, digest emails, or activity spam unless we explicitly add a notification product surface.

### Email Ownership

BetterAuth should own auth-specific email flows when possible.

Auth email flows:

- Email verification.
- Password reset.
- Magic link, if added later.
- Account security notifications, if supported by the auth setup.

Lightsite owns product email flows:

- Workspace invitation.
- Invitation accepted.
- Workspace membership removed, optional.
- Role changed, optional.
- Billing-related app notices not owned by the billing provider.

The billing provider should own legally/financially sensitive billing emails where possible:

- Receipts.
- Payment failures.
- Subscription changes.
- Tax invoices.

### Email Provider Abstraction

Do not call an email vendor directly from route handlers.

Use an email service boundary:

```txt
sendWorkspaceInviteEmail(input)
sendInviteAcceptedEmail(input)
sendMembershipRemovedEmail(input)
sendRoleChangedEmail(input)
```

Rules:

- Email sends should be job-backed for product flows.
- Route handlers enqueue email jobs after successful transactions.
- Jobs should be idempotent.
- Email templates should be typed and versioned.
- Provider failures should not leave core database transactions half-complete.
- Email send attempts should be logged without storing secrets or full tokens.

V1 decision:

- Use a simple email provider abstraction even if the first implementation uses one provider.
- Store minimal email delivery state for invites.
- Keep auth emails inside BetterAuth unless customization requires a wrapper.

### Email Jobs

Email job payloads should reference database IDs, not duplicate all state.

Example:

```txt
{
  type: "workspace_invite",
  inviteId: "...",
  requestedByUserId: "...",
  idempotencyKey: "workspace-invite:{inviteId}:created"
}
```

Job execution:

1. Load the latest needed records.
2. Verify the record still requires email.
3. Render template from canonical data.
4. Send through provider.
5. Store delivery attempt result.

Rules:

- If an invite is revoked before a job runs, do not send.
- If an invite is accepted before a retry, do not send.
- Retry transient provider failures.
- Do not retry permanent validation failures indefinitely.
- Protect against duplicate sends with idempotency keys.

### Workspace Invitation Email

Invite email includes:

- Workspace name.
- Inviter name.
- Recipient email.
- Accept invite link.
- Expiration date.
- Support/contact footer.

Invite email must not include:

- Raw invite token except inside the URL.
- Workspace-private data.
- Site content.
- Analytics.

Invite link rules:

- Token is high entropy.
- Token is stored hashed.
- Token expires.
- Token can be revoked.
- Token is single-use once accepted.
- Accepting an invite requires the signed-in email to match the invite email unless an explicit admin transfer flow is added.

Existing-account flow:

- User opens invite link.
- If signed in as the invited email, continue.
- If signed in as a different email, show account mismatch.
- If not signed in, route to sign up/log in and return to invite.

### Email Verification And Work Email Policy

The work email requirement applies before account creation.

Rules:

- Normalize email before validation.
- Reject `+` addressing.
- Reject known personal email providers.
- Reject malformed domains.
- Store the normalized email as canonical.
- Do not reveal whether an account exists during unauthenticated auth flows.

Email verification:

- Required before workspace setup unless BetterAuth/session policy intentionally permits limited pre-verification onboarding.
- Verified email is required for inviting others.
- Verified email is required for publishing public sites.

Rationale:

- Prevents spammy throwaway onboarding.
- Reduces abuse of public page hosting.
- Protects workspace ownership.

### In-App Notifications

V1 should not build a full notification center.

Use:

- Toasts for immediate action results.
- Inline banners for durable state.
- Email for invites/auth/security.
- Activity/audit logs for admin review later.

Examples:

- Site published: toast.
- Autosave failed: persistent inline editor state.
- Invite sent: toast and invite row delivery state.
- Access removed while user is editing: blocking inline/error state and route away.
- Plan limit reached: inline upgrade prompt.

Do not create unread counters, notification inbox tables, or cross-workspace alert systems in v1 unless a clear workflow requires them.

### Notification Preferences

V1 can defer user notification preferences if the only product email is required transactional email.

If preferences are added:

- Store preferences per user, not per workspace, unless workspace-specific settings are needed.
- Required transactional/security emails cannot be disabled.
- Optional product notifications must be opt-out.
- Marketing email consent must be separate from product email.

Suggested preference model later:

```txt
user_notification_preferences
  user_id
  workspace_invite_accepted_email_enabled
  site_view_digest_email_enabled
  collaboration_mentions_email_enabled
  created_at
  updated_at
```

V1 decision:

- Do not add preferences until optional notification emails exist.

### Deliverability

Email deliverability basics:

- Use a verified sending domain.
- Configure SPF, DKIM, and DMARC.
- Use stable from addresses.
- Keep reply-to intentional.
- Avoid sending from arbitrary customer domains.
- Include physical mailing address/legal footer where required by provider/policy.
- Monitor bounces and complaints when provider supports it.

Invite emails should come from a Lightsite address in v1.

Future:

- Custom workspace sending domains only if there is clear demand.
- Custom domains require DNS verification and careful abuse controls.

### Email Rate Limits And Abuse Controls

Rate-limit:

- Signups per IP/domain.
- Verification email resend.
- Password reset requests.
- Invites per workspace per hour/day.
- Invite resend per invite.

Rules:

- Rate limits should fail gracefully with human-readable messages.
- Admins should not be able to spam unlimited invites.
- Repeated email failures should surface in the invite row.
- Public hosting/publishing should remain gated by verified accounts and plan limits.

### Email Observability

Track:

- Email job created.
- Provider send attempted.
- Provider accepted.
- Provider rejected.
- Bounce/complaint, if webhook exists.

Do not log:

- Full invite tokens.
- Password reset tokens.
- Verification tokens.
- Provider API keys.
- Full rendered email bodies unless explicitly needed in local dev.

Development mode:

- Use a local email sink or provider test mode.
- Make email previews available to developers without sending real mail.
- Never send emails from seed data to real external addresses by accident.

## Product Analytics And Internal Metrics

### Purpose

Lightsite has two analytics domains that must remain separate:

- Customer-facing prospect tracking for published one-pagers.
- Internal product analytics for understanding app usage and reliability.

Customer-facing tracking answers:

- Did prospects view this site?
- How long did they spend?
- How far did they scroll?
- What did they click?
- Did a link preview load in Slack or another client?

Internal product analytics answers:

- Are users completing onboarding?
- Are users creating and publishing sites?
- Are variants being used?
- Are collaboration and tracking features working?
- Where are errors or performance bottlenecks?

These two systems should not share event names, payload schemas, or dashboards casually.

### Internal Event Rules

Internal product analytics should be privacy-conscious and low-cardinality.

Rules:

- Do not send site body content.
- Do not send rich text values.
- Do not send variable values.
- Do not send prospect email addresses unless explicitly needed and documented.
- Prefer stable internal IDs over names.
- Avoid arbitrary strings as event properties.
- Avoid high-cardinality properties like full URLs, raw slugs, or freeform search queries.
- Include workspace ID and user ID only when needed for product analytics.
- Keep environment, app version, and route name for debugging.

Examples of allowed events:

```txt
signup_started
signup_completed
workspace_created
workspace_slug_check_completed
logo_suggestion_loaded
site_created
site_duplicated
site_published
site_unpublished
site_archived
variant_created
share_link_copied
invite_sent
invite_accepted
editor_session_started
editor_autosave_failed
tracking_dashboard_opened
```

Examples of disallowed/default-avoid properties:

```txt
siteTitle
prospectCompanyName
variableValue
richTextHTML
fullPublicUrl
inviteToken
uploadedFileName
```

### Event Naming

Use event names that are:

- Past tense for completed actions.
- Stable.
- Product-level.
- Snake case.

Recommended pattern:

```txt
object_action
```

Examples:

- `workspace_created`
- `site_published`
- `variant_deleted`
- `invite_accepted`

Avoid:

- UI-specific event names such as `button_clicked_blue`.
- A/B-test names in canonical event names.
- Route names as event names when the action is the meaningful event.

### Internal Analytics Implementation

Implementation options:

- Start with a hosted product analytics tool if cheap and easy.
- Keep an internal wrapper so the vendor can be replaced.
- Never call analytics SDKs directly across feature code.

Frontend wrapper:

```txt
analytics.track("site_published", {
  workspaceId,
  siteId,
  source: "editor_publish_dialog"
})
```

Backend wrapper:

```txt
productAnalytics.track({
  event: "site_published",
  workspaceId,
  userId,
  properties: { versionNumber }
})
```

Rules:

- Critical lifecycle events should be emitted server-side after transactions commit.
- UI-only interaction events may be emitted client-side.
- Client-side events are best-effort and should not drive billing or permissions.
- The wrapper should no-op cleanly in local development unless explicitly enabled.

### Funnel Metrics

Core onboarding funnel:

1. Signup started.
2. Account created.
3. Email verified.
4. User profile completed.
5. Workspace setup started.
6. Workspace created.
7. First site created.
8. First site published.
9. First link copied/shared.
10. First tracked view received.

Core activation metric:

- A workspace publishes a site and receives at least one non-bot public view.

Secondary activation metric:

- A workspace creates at least one variant and copies its share link.

### Reliability Metrics

Track operational metrics separately from product analytics.

Operational metrics:

- API request latency.
- Error rate by route.
- Job queue depth.
- Email job failure count.
- Tracking ingestion rate.
- Realtime connection count.
- Realtime room count.
- Autosave failures.
- Publish failures.
- Public site render latency.
- Database query latency for hot paths.

Rules:

- Operational metrics should support alerting.
- Product analytics should support product decisions.
- Do not rely on product analytics for incident detection.

### Customer Analytics Integrity

For public site tracking:

- Events are accepted only with signed public tracking context.
- Server verifies site/version/variant IDs.
- Bots and preview clients are classified.
- Duplicate preview loads are deduped.
- Heartbeat events are bounded.
- Event timestamps are server-received timestamps for canonical ordering.

For internal analytics:

- Do not treat client-side event counts as authoritative.
- Do not use product analytics events for security decisions.
- Do not join customer-facing tracking to internal user behavior unless there is a clear product need and privacy review.

### Dashboards

Minimum internal dashboards:

- Onboarding funnel.
- Site creation/publish funnel.
- Publish failure rate.
- Tracking ingestion volume.
- Public page latency.
- Email job failure rate.
- Realtime connection health.

Minimum customer-facing dashboards are covered in Tracking And Analytics.

### Data Retention

Internal product analytics retention should be shorter and cheaper than core app data unless a tool/provider handles retention.

Recommended:

- Keep raw internal analytics in vendor/tool according to plan limits.
- Keep operational logs short-lived.
- Keep audit logs longer because they support security and support workflows.
- Keep customer-facing tracking according to plan and privacy policy.

## Compliance And Legal Basics

### Purpose

Lightsite is not a compliance-heavy enterprise product at launch, but public page hosting, prospect tracking, uploaded content, and workspace user management create legal and privacy obligations.

V1 should establish clean defaults so compliance can grow without painful rewrites.

### Required Public Documents

Before production launch, provide:

- Terms of Service.
- Privacy Policy.
- Cookie/tracking disclosure.
- Acceptable Use Policy.
- Contact/support email.

These documents should explain:

- Lightsite hosts user-created sales pages.
- Workspace members can publish public links.
- Public page visits may be tracked.
- Prospect interaction events may be visible to workspace members.
- Uploaded assets are stored and served.
- Abuse/content removal contact path.

### Tracking Disclosure

Because public pages track visits, scroll depth, time spent, and clicks, the product must be explicit about tracking behavior.

V1 decisions:

- Avoid third-party ad trackers on public sites.
- Avoid invasive fingerprinting.
- Prefer first-party event IDs and session IDs.
- Do not attempt to identify anonymous visitors by personal data unless explicitly supplied through a future form/integration.
- Do not use cookies if local/session storage plus signed context is sufficient.

If cookies are used:

- Document the cookie names and purposes.
- Decide whether consent banners are required for target markets.
- Make public site tracking degrade gracefully when tracking is disabled.

### Data Processing

Workspace data includes:

- User account data.
- Workspace membership data.
- Site content.
- Uploaded assets.
- Public visitor analytics.
- Audit logs.

Rules:

- Keep data ownership at workspace level.
- Do not expose one workspace's data to another workspace.
- Support deleting or anonymizing user profile data later without corrupting workspace audit records.
- Keep audit logs actor-aware but resilient if a user is later deactivated/deleted.

### Content Moderation And Abuse

Public hosting creates abuse risk.

V1 controls:

- Work email signup only.
- Email verification before publishing.
- Plan limits.
- Publish rate limits.
- Asset upload limits.
- Ability for internal admins to unpublish abusive content.
- Abuse report contact path.

Future controls:

- Automated malware/phishing checks on links.
- Asset scanning.
- Domain reputation checks.
- Workspace suspension.
- Public page takedown workflow.

### Legal Holds And Deletion

Do not implement casual hard deletion for workspace-owned core records in v1.

Rules:

- Archive product objects.
- Soft-delete memberships/invites/variants where useful.
- Preserve audit logs.
- Design for future data export and deletion requests.
- Avoid foreign key cascades that destroy business history unexpectedly.

Hard deletion should be reserved for:

- Expired tokens.
- Temporary upload artifacts.
- Local/dev seed data.
- Explicit future privacy deletion workflows.

### Terms Enforcement

Internal admins may need to:

- Suspend workspace publishing.
- Unpublish a site.
- Disable a workspace.
- Review public page metadata.
- Contact workspace admins.

These actions must be:

- Permissioned to internal admins only.
- Audited.
- Reversible where practical.
- Clear in their effect on public pages.

## Developer, Support, And Admin Tooling

### Purpose

Developer and admin tooling should make Lightsite easier to operate without creating hidden product behavior or permission bypasses.

V1 should distinguish:

- Local developer tools.
- Internal support tools.
- Workspace admin tools.
- Product-facing settings.

These are different surfaces with different risk profiles.

### Internal Admin Role

Internal admin access is separate from workspace admin access.

Workspace admin:

- Belongs to a workspace.
- Can manage that workspace.
- Cannot see other workspaces.

Internal admin:

- Belongs to Lightsite operations.
- Can access explicitly allowed internal tools.
- Can perform support/moderation actions across workspaces when necessary.

Rules:

- Do not model internal admin as a normal workspace role.
- Do not grant internal admin by joining every workspace.
- Do not let internal admin paths reuse workspace admin checks casually.
- Internal admin status should be stored on the user profile or a dedicated internal-access table.
- Internal admin actions must be audited.

### Internal Admin Surface

V1 internal admin should be minimal.

Allowed internal admin capabilities:

- Search workspace by ID/slug/domain.
- View workspace metadata.
- View workspace billing plan/status metadata.
- View workspace member list metadata.
- View site metadata.
- View public URL metadata.
- Unpublish abusive public site.
- Suspend workspace publishing.
- Trigger/resend safe operational jobs where appropriate.
- View recent operational errors tied to a workspace.

Not allowed in v1 by default:

- Editing customer site content.
- Reading draft content without explicit support escalation.
- Reading private analytics details unless needed for support.
- Impersonation.
- Downloading workspace data.
- Deleting workspace data.
- Changing billing manually outside provider-approved flows.

If support eventually needs content access:

- Add an explicit support access request/approval flow.
- Time-bound access.
- Audit every access.
- Show customer-facing support-access status if appropriate.

### Impersonation

Do not implement impersonation in v1.

Rationale:

- Impersonation is high-risk.
- It can hide permission bugs.
- It complicates audit logs.
- It creates privacy and trust issues.

Future impersonation requirements if added:

- Internal admin only.
- Justification required.
- Time-limited session.
- Banner visible at all times.
- No destructive actions by default.
- Audit both impersonator and target user.
- Never impersonate for public visitor behavior.

### Audit Log

Audit logs should capture important security and business actions.

Audit event examples:

```txt
workspace.created
workspace.updated
workspace.slug_changed
workspace.logo_changed
member.invited
member.invite_revoked
member.invite_accepted
member.role_changed
member.removed
site.created
site.updated_metadata
site.published
site.unpublished
site.archived
site.restored
site.duplicated
site.access_changed
variant.created
variant.updated
variant.deleted
asset.uploaded
asset.deleted
billing.plan_changed
internal.site_unpublished
internal.workspace_publishing_suspended
```

Audit record shape:

```txt
audit_log
  id
  workspace_id nullable
  actor_user_id nullable
  actor_kind enum user|system|internal_admin
  action
  target_type
  target_id
  metadata jsonb
  ip_hash nullable
  user_agent_hash nullable
  created_at
```

Rules:

- Audit logs are append-only.
- Avoid storing sensitive payloads in metadata.
- Store identifiers and small before/after values where helpful.
- Do not store full site content in audit metadata.
- System jobs should use `actor_kind=system`.
- Internal admin actions must include internal actor ID.

### Local Developer Tools

Local developer tooling should speed up safe iteration.

Useful local tools:

- Seed database command.
- Reset local database command.
- Create local test workspace.
- Create local demo site.
- Create local demo tracking events.
- Local email sink.
- Local object storage emulator or filesystem storage adapter.
- Local realtime server.

Rules:

- Local seed data must not use real customer emails by accident.
- Local commands should require explicit environment checks before destructive actions.
- Production database URLs should be protected from reset/seed commands.
- Seed data should cover empty, normal, and edge states.

Demo states to seed:

- Workspace with no sites.
- Workspace with draft site.
- Workspace with published site.
- Site with variants.
- Site with tracking events.
- Team with pending invite.
- Plan limit reached state.
- Editor content with every block type.

### Debug Surfaces

Debug information should be useful in development and safe in production.

Development debug can show:

- Query keys.
- API response timing.
- Current workspace/site IDs.
- Feature flags.
- Realtime connection state.
- Autosave queue state.

Production debug should not show:

- Secrets.
- Tokens.
- Raw auth/session data.
- Signed tracking context internals.
- Full error stack traces to end users.

Production error UI should show:

- Human-readable message.
- Recovery action.
- Support/debug ID when available.

### Feature Flags

Feature flags are useful, but should not become a shadow permission system.

Use feature flags for:

- Gradual rollout.
- Internal testing.
- Experimental UI.
- Risky infrastructure changes.

Do not use feature flags for:

- Enforcing paid plan limits.
- Security permissions.
- Workspace role checks.
- Public access control.

Rules:

- Backend owns authoritative access and limits.
- Frontend flags can hide/show UI only.
- Server-side flags should be evaluated in service boundaries.
- Flag names should be stable and documented.

### Environment Configuration

Configuration should be explicit and typed.

Rules:

- Validate required environment variables on startup.
- Do not read `process.env` throughout the app.
- Centralize config parsing.
- Separate public frontend env from server-only env.
- Never expose server-only secrets through Vite public variables.
- Keep `.env.example` complete but secret-free.

Important config categories:

- Database.
- BetterAuth.
- App URLs.
- Public site URLs.
- Object storage.
- Email provider.
- logo.dev token.
- Realtime.
- Analytics.
- Billing.

Startup should fail fast when required production config is missing.

Local development can allow safe defaults only for local-only services.

### Background Jobs

Jobs should be first-class because email, tracking aggregation, asset cleanup, and future billing sync should not run inline in request handlers.

Job categories:

- Email send.
- Tracking aggregation.
- Asset cleanup.
- Expired invite cleanup.
- Published page cache invalidation/warmup.
- Billing webhook follow-up.
- Data export generation.

Rules:

- Jobs are idempotent.
- Jobs use database IDs as inputs.
- Jobs record attempts.
- Jobs have bounded retries.
- Jobs distinguish transient and permanent failures.
- Jobs should be safe to run more than once.
- Long-running jobs should emit progress/state.

V1 can start with a simple queue, but service boundaries should not assume synchronous execution.

## Data Portability, Import, And Export

### Purpose

Lightsite content should not be trapped inside opaque UI state.

The app should use portable, versioned JSON schemas for:

- Draft site content.
- Published versions.
- Variable definitions.
- Variant overrides.

This makes rollback, export, migrations, support, and future integrations much easier.

### Site Export

V1 should support internal/exportable site JSON even if the customer-facing export UI ships later.

Export should include:

- Site metadata.
- Content schema version.
- Draft or published content.
- Variables.
- Variant definitions and overrides, optional.
- Asset references.
- Public settings.
- OG settings.

Export should not include by default:

- Analytics events.
- Visitor sessions.
- Workspace member data.
- Internal audit logs.
- Secret signed URLs.
- Raw storage keys if they expose internals.

Site export format:

```txt
lightsite_site_export
  exportVersion
  exportedAt
  source
  site
  variables
  variants
  assets
```

Rules:

- Export uses stable IDs where preserving relationships matters.
- Export may also include human-readable keys/names.
- Export should be schema-validated.
- Export should never be the only backup strategy.

### Workspace Export

Workspace-level export is more sensitive and can be deferred.

Future workspace export may include:

- Workspace metadata.
- Sites.
- Published versions.
- Variants.
- Assets.
- Members.
- Audit log subset.
- Tracking summaries.
- Raw tracking event export, if plan/legal policy allows.

Rules:

- Workspace export requires admin permission.
- Large exports should be async jobs.
- Exports expire.
- Export download links are signed and short-lived.
- Export creation is audited.
- Export download is audited when practical.

### Tracking Export

Tracking export is valuable for sales teams but can become large.

V1 customer-facing tracking export options:

- CSV export of filtered event feed.
- CSV export of visitor/session summary.
- CSV export of site/variant aggregate summary.

Rules:

- Exports use current filters.
- Server-side limits apply.
- Large exports are async.
- Raw event export may be gated by plan later.
- Bot/preview classifications should be included so users can interpret data.

CSV columns should be stable and documented.

Example event export columns:

```txt
occurred_at
event_type
site_title
variant_name
session_id
visitor_label
element_id
element_label
scroll_depth
time_spent_seconds
is_bot
is_preview
```

### Import

Do not build broad customer-facing import in v1 unless a clear use case appears.

Supported v1 import-like flows:

- Duplicate existing Lightsite site.
- Restore from version history.
- Internal migration scripts.
- Developer seed fixtures.

Future import requirements:

- Validate schema before writing.
- Map assets safely.
- Sanitize rich text.
- Reject unknown block types unless migration exists.
- Preserve variable IDs or map them deterministically.
- Create draft only; do not publish imported content automatically.
- Audit import.

### Schema Versioning And Migrations

Every persisted content document should include `schemaVersion`.

Rules:

- App code should know how to read the current schema.
- Older schemas should be migrated at read or write boundaries.
- Publishing should persist the current schema version.
- Migrations should be deterministic and tested.
- Do not scatter migration logic across UI components.

Preferred pattern:

```txt
parseSiteContent(raw)
  -> validates known schema
  -> migrates to current shape
  -> returns typed content
```

Migration tests should cover:

- Old rich text structures.
- Renamed block fields.
- Added required defaults.
- Removed/deprecated fields.
- Variable reference preservation.
- Variant override preservation.

### Backups

Backups are separate from user export.

Backup requirements:

- Automated database backups.
- Point-in-time recovery if hosting supports it.
- Object storage retention/versioning where affordable.
- Documented restore procedure.
- Periodic restore drill.

Rules:

- Do not rely on user exports for disaster recovery.
- Do not rely on version history for database recovery.
- Backups should include enough data to restore published sites and analytics.

### Data Deletion And Retention

V1 should define retention even if UI controls are limited.

Suggested retention:

- Draft content: retained while site exists.
- Published versions: retained according to plan/version policy.
- Variants: retained until deleted/soft-deleted.
- Raw tracking events: retained for a fixed period by plan.
- Tracking summaries: retained longer than raw events.
- Audit logs: retained long enough for security/support.
- Expired tokens: deleted quickly.
- Temporary uploads: deleted quickly.

Rules:

- Retention jobs should be idempotent.
- Retention deletions should not break summaries.
- Public pages should not depend on raw tracking events.
- User deletion/anonymization should preserve workspace records where legally appropriate.

### Data Portability Security

Export and import are high-risk surfaces.

Rules:

- Require workspace admin for workspace exports.
- Require edit/manage permission for site exports.
- Use short-lived signed download URLs.
- Do not email exported data as attachments.
- Validate export request scope server-side.
- Rate-limit export creation.
- Audit export creation.
- Protect against path traversal and object key guessing.
- Scan imported assets if import supports external files later.

## Support And Incident Response

### Support Principles

Support workflows should be honest about what support can and cannot see.

Rules:

- Prefer metadata over content access.
- Prefer customer-shared links/screenshots over internal content reads.
- Keep support actions audited.
- Make dangerous actions reversible where possible.
- Do not patch customer data manually in production except through documented runbooks.

### Support Identifiers

UI errors and backend logs should share stable support identifiers.

Use:

- Request ID.
- Workspace ID.
- User ID.
- Site ID.
- Error code.
- Timestamp.

Customer-facing error messages should not expose:

- Stack traces.
- SQL errors.
- Secret config names.
- Internal storage keys.

### Incident Categories

Important incident classes:

- Public pages unavailable.
- Publishing broken.
- Tracking ingestion delayed.
- Auth/session failures.
- Realtime collaboration degraded.
- Email delivery failing.
- Asset uploads failing.
- Database migration issue.
- Billing webhook failures.

Each incident class should have:

- Detection signal.
- User impact.
- Immediate mitigation.
- Owner.
- Recovery verification.
- Post-incident notes if significant.

### Degraded Mode

When non-critical systems fail, core usage should degrade gracefully.

Examples:

- Internal analytics provider down: app continues.
- Email provider down: invites show pending/error, core app continues.
- Tracking aggregation delayed: raw tracking still ingests if possible.
- Realtime down: editor can fall back to single-user editing/autosave with warning.
- Asset thumbnail generation delayed: use original or placeholder.
- Public page cache issue: serve from origin if possible.

Rules:

- Do not block publishing because internal product analytics failed.
- Do not block editing because collaboration presence failed.
- Do not lose draft edits because aggregation jobs failed.
- Do block publishing if content validation, asset availability, or permission checks fail.

## Templates And Starter Content

### Purpose

Templates should help sales teams create useful one-pagers quickly without making the editor or content model template-specific.

Templates are not a separate rendering system. A template is a prebuilt site draft payload plus metadata.

Goals:

- Faster first site creation.
- Consistent page quality.
- Good examples of variables.
- Good examples of blocks.
- Clean onboarding into the editor.

Non-goals for v1:

- Template marketplace.
- Workspace-owned template library.
- Template-level permissions.
- Live template inheritance.
- Updating existing sites when a template changes.

### Template Model

A template should contain:

- Template ID.
- Name.
- Description.
- Category.
- Preview image.
- Content schema version.
- Site draft content.
- Default variables.
- Recommended title/slug seed.
- Required assets or asset placeholders.

Template content should use the same schema as normal site drafts.

Rules:

- Creating a site from a template copies template content into the new site.
- The new site has no live relationship to the template after creation.
- Template IDs should be stable.
- Template content must pass the same validation as user-created content.
- Templates should not contain customer-specific data.
- Templates should not require network calls during site creation.

### V1 Templates

V1 should start with a small curated set.

Suggested initial templates:

- General product one-pager.
- Enterprise follow-up.
- Demo recap.
- Pricing/packaging follow-up.
- Implementation overview.
- Case study share.

Default first-site behavior:

- If the workspace is new, show template choices during create-site.
- Include a blank/minimal template.
- Preselect the most useful default template.
- New site uses workspace logo/avatar as the default site avatar.

### Template Variables

Templates should demonstrate variables intentionally.

Good template variables:

- Prospect company.
- Prospect name.
- Prospect logo/image.
- Pain point.
- Recommended plan.
- Next step URL.
- Calendar URL.

Rules:

- Variables in templates use stable generated IDs after copy.
- Variable keys should be human-readable.
- Template variable defaults should be safe and generic.
- Template-created variables are normal site variables after creation.
- Removing a template variable from a created site follows normal variable deletion rules.

### Template Assets

Templates should avoid relying on external asset URLs.

Rules:

- Template preview images are app-owned assets.
- Template placeholder images should be bundled or stored as app-owned assets.
- Creating a site should copy or reference template assets according to asset ownership rules.
- User-uploaded workspace logo should replace the default avatar slot where appropriate.
- Missing optional template assets should not block site creation.

### Template Validation

Templates must be tested like product code.

Validation should check:

- Content schema is current or migratable.
- No unknown block types.
- Required block fields are present.
- Variable references point to existing variables.
- Asset references are valid.
- Public rendering works.
- Mobile rendering is acceptable.

Template regressions should fail tests because broken templates create broken first impressions.

### Future Template Library

Future workspace template library requirements:

- Workspace admins can save a site as a template.
- Template is copied into new sites.
- Template can include variables and assets.
- Template updates do not mutate existing sites.
- Template visibility can be workspace-only.
- Template deletion does not affect sites created from it.

Do not build template inheritance unless there is a strong product need. It makes versioning, variants, rollback, and assets substantially more complex.

## Editor Commands, Shortcuts, And Interaction Model

### Purpose

The editor should feel fast and predictable because sales teams will build and edit pages under time pressure.

All editor actions should flow through explicit commands where practical.

Commands make it easier to support:

- Toolbar actions.
- Keyboard shortcuts.
- Context menus.
- Undo/redo.
- Collaboration.
- Testing.
- Permission checks.
- Analytics.

### Command Model

Editor commands are typed operations that describe user intent.

Examples:

```txt
insertBlock
deleteBlock
duplicateBlock
moveBlock
updateBlockProps
updateRichText
insertVariableReference
createVariable
renameVariable
deleteVariable
updateSiteSettings
updateHeader
setSelectedBlock
clearSelection
```

Rules:

- UI controls dispatch commands.
- Commands validate local preconditions.
- Commands update local editor state optimistically when safe.
- Commands are translated into persistence/realtime operations where needed.
- Commands that affect content should be undoable unless explicitly marked non-undoable.
- Commands should be typed and tested.
- Commands should not perform direct API calls from arbitrary components.

### Command Boundaries

Commands can be local-only or persisted.

Local-only commands:

- Select block.
- Open inspector panel.
- Toggle preview mode.
- Set active toolbar menu.
- Change local zoom/viewport.

Persisted commands:

- Insert block.
- Delete block.
- Move block.
- Update block data.
- Update rich text field.
- Create variable.
- Rename variable.
- Delete variable.
- Update page settings.

Server-only commands:

- Publish.
- Rollback.
- Archive.
- Restore archived site.
- Duplicate site.
- Create variant.
- Delete variant.

Rules:

- Local-only commands do not write to server.
- Persisted commands enter autosave/collaboration pipeline.
- Server-only commands use service-layer APIs and should not be modeled as editor document changes.

### Undo / Redo Integration

Undo and redo should operate on user-visible content changes.

Undoable:

- Text edits.
- Insert/delete/duplicate block.
- Reorder block.
- Block setting changes.
- Variable reference insert/remove inside content.
- Site header/content setting changes that live in the draft document.

Not undoable in v1:

- Publish.
- Rollback.
- Archive.
- Create/delete variant.
- Share link copy.
- Access changes.
- Billing/settings outside editor.

Rules:

- Undo stack is local to the browser/editor session.
- Undo should not silently undo changes made by other collaborators.
- Remote changes can be integrated into the document but should not appear as local undo history.
- Version history handles cross-session recovery.
- Rollback replaces the draft and resets local undo/redo state after confirmation.

### Keyboard Shortcuts

V1 keyboard shortcuts:

```txt
mod+z              undo
mod+shift+z        redo
mod+y              redo
mod+s              force autosave/status refresh; does not publish
escape             clear selection/close transient menu
delete/backspace   delete selected block when block chrome is focused
mod+b              bold in rich text
mod+i              italic in rich text
mod+k              add/edit link in rich text
slash              open insert menu in empty rich text context
```

Rules:

- Shortcuts must not hijack browser/system shortcuts outside editor focus.
- Destructive shortcuts require correct focus/selection.
- Shortcut behavior must be documented in code and tested.
- Tooltips can show shortcuts.
- Users should be able to accomplish core actions without shortcuts.

### Selection Model

The editor needs a clear selection model.

Selection states:

- No selection.
- Rich text cursor/selection inside a block field.
- Block selected.
- Nested item selected, such as accordion item or table cell, if supported.

Rules:

- Only one primary selection exists at a time.
- Inspector reflects current primary selection.
- Block chrome appears on hover/focus/selection without changing layout.
- Keyboard focus and visual selection should not disagree.
- Deleting a selected block should move selection to a predictable neighboring block.
- If selected block is removed by another collaborator, selection clears with a calm notice if needed.

### Insert Menu

The insert menu is the primary way to add blocks and variables.

Entry points:

- Slash command in text context.
- Add block button between blocks.
- Toolbar/menu button.

Insert menu contents:

- Blocks.
- Variables.
- Embeds.
- Divider.
- Recently used items, later if useful.

Rules:

- Menu search should be client-side because the command list is small.
- Menu items should be keyboard navigable.
- Disabled items should explain why.
- Inserted blocks get stable IDs immediately.
- New block defaults should be valid and publishable when possible.

### Inspector Model

The inspector should expose settings for the current selection.

Rules:

- No selection shows page/site settings or a helpful empty state.
- Block selection shows block settings.
- Rich text selection shows text controls in toolbar, not a bloated sidebar.
- Unsupported block settings should not appear.
- Changes in inspector use the same command pipeline as canvas interactions.
- Inspector state should not own the source of truth for content.

### Drag And Reorder

Drag should be helpful but not the only way to reorder.

Rules:

- Drag handles appear without shifting layout.
- Drag reorder uses stable block IDs.
- Reorder operations are undoable.
- Reorder operations are persisted as block order changes, not delete/recreate.
- Keyboard/menu alternatives should exist for move up/down.
- Collaboration conflict rule: if a block is deleted while being dragged, delete wins.

### Editor Error Handling

Editor errors should preserve user work.

Rules:

- Autosave failure shows persistent status and retry.
- Local content should remain in memory after save failure.
- If realtime disconnects, editing can continue locally with warning if safe.
- If permissions are revoked, stop persistence and route away after explaining.
- If schema parse fails, show recovery UI and avoid overwriting server content.
- If an asset upload fails, keep block state and allow retry/replace.
- If publish validation fails, link errors to exact blocks/settings.

### Editor Performance

Performance rules:

- Avoid re-rendering the whole editor for every keystroke.
- Rich text fields should isolate editor updates.
- Large block lists should keep block components memoized where practical.
- Autosave batches changes.
- Presence updates do not cause full document rerenders.
- Inspector updates should be scoped to selected block.
- Avoid storing derived editor UI state in persisted document JSON.

Targets:

- Typing should feel immediate.
- Dragging should remain smooth on normal one-pager sizes.
- Opening editor should fetch one compact editor payload plus assets needed for first render.
- Expensive validation can run debounced or during publish, not on every keypress.

## Search, Filtering, Sorting, And Lists

### Purpose

Lists are core product surfaces in Lightsite:

- Sites.
- Variants.
- Tracking events.
- Team members.
- Invites.
- Assets later.
- Internal admin workspaces/sites.

List behavior should be consistent, server-backed where data can grow, and easy to deep-link.

### List Contract

Every growing list endpoint should define:

- Filters.
- Search query.
- Sort field.
- Sort direction.
- Cursor/page size.
- Returned items.
- Returned pagination metadata.
- Empty state meaning.

Example shape:

```txt
GET /api/sites?workspaceId=...&status=published&q=acme&sort=updatedAt.desc&cursor=...

{
  data: [...],
  pagination: {
    nextCursor,
    hasMore
  }
}
```

Rules:

- Do not fetch unbounded lists in app screens.
- Default page sizes should be conservative.
- Endpoints should have stable default sort.
- Filters should be validated server-side.
- Unknown filters should fail clearly or be ignored intentionally; prefer failing in API routes.
- Sort fields must be allowlisted.
- Cursor pagination is preferred for large/append-heavy lists.

### URL State

Use URL-backed state when list state is useful to preserve/share.

URL-backed:

- Sites search/filter/sort.
- Tracking search/filter/sort.
- Team filter/search if added.
- Internal admin search.

Local-only:

- Small variant modal search.
- Insert menu search.
- Temporary combobox search.

Rules:

- URL state should be parseable and validated.
- Invalid URL params fall back to defaults.
- Do not put sensitive values in URL params.
- Keep URLs readable.
- Debounce search updates.

### Search Semantics

V1 search should be simple and predictable.

Sites search fields:

- Site title.
- Site slug.
- Creator name/email, later if needed.

Variant search fields:

- Variant name.
- Variant slug.
- Recipient label/email if stored.

Tracking search fields:

- Event type.
- Variant name.
- Site title.
- Element label.
- Visitor/session label if available.

Team search fields:

- Member name.
- Member email.
- Invite email.

Rules:

- Search is case-insensitive.
- Trim search input.
- Minimum query length can be used for expensive searches.
- Avoid searching full rich text content in v1.
- Avoid search behavior that depends on unpublished content unless user is in editor-specific context.

### Sorting

Common sort fields:

- `createdAt`.
- `updatedAt`.
- `publishedAt`.
- `lastViewedAt`.
- `name`.
- `status`.

Rules:

- Sort by stable tie-breaker, usually ID or created timestamp.
- Do not sort by derived counts unless the value is materialized/indexed.
- Do not let arbitrary column names reach SQL.
- UI labels should map to explicit API sort keys.

### Filters

Sites filters:

- Status: draft, published, archived.
- Access: owned, shared with me, team.
- Creator later.

Tracking filters:

- Site.
- Variant.
- Event type.
- Date range.
- Bot/preview classification.

Team filters:

- Role.
- Status: active, invited.

Rules:

- Filter combinations should be composable.
- Empty filter results should show reset action.
- Filter counts are nice-to-have and should not be required for v1.
- Date filters should use explicit time zones.

### Empty, Loading, And Error States

Every list needs:

- Initial loading state.
- Empty state with next action.
- No-results state after filters/search.
- Error state with retry.
- Pagination loading state.

Rules:

- Empty state should not imply data loss.
- No-results state should preserve current filters.
- Retry should re-run the same query.
- Bulk actions should be hidden until selected rows exist.

### Table And Row Actions

Rules:

- Row actions should reflect permissions.
- Destructive actions require confirmation.
- Disabled actions should explain why when visible.
- Row action menus are keyboard accessible.
- Opening a row should not conflict with selecting text or opening a row menu.
- Tables should work on small screens through responsive layout or alternate list cards.

### Selection And Bulk Actions

V1 can avoid bulk actions except where clearly needed.

Future bulk actions:

- Archive multiple sites.
- Export tracking events.
- Revoke multiple invites.

Rules for future bulk actions:

- Server validates permissions per item.
- Partial success must be reported clearly.
- Destructive bulk actions require confirmation.
- Bulk action jobs are async for large sets.

### List Performance

Performance rules:

- Use database indexes for common filters/sorts.
- Avoid N+1 queries for row metadata.
- Use summaries/materialized counts for expensive aggregates.
- Do not calculate tracking totals inline for every Sites page row unless cached.
- Keep row payloads compact.
- Prefetch detail data only when the UX benefits.

Frontend rules:

- Use TanStack Query keys that include filter/sort/search state.
- Use placeholder/previous data during pagination when helpful.
- Debounce search.
- Do not put large list state in global client stores.

## Integrations And Webhooks

### Purpose

Integrations should expand Lightsite without contaminating the core product model.

Core Lightsite should work without any third-party integration except:

- Auth provider.
- Database.
- Asset storage.
- Email provider for production email.
- Optional analytics/error monitoring providers.

All external product integrations should be isolated behind provider adapters.

### Integration Categories

Likely integration categories:

- Calendar embeds and booking signals.
- Slack/link preview detection.
- CRM enrichment or sync later.
- Logo lookup through logo.dev.
- Billing provider.
- Product analytics.
- Error monitoring.
- Email provider.
- Asset storage.

Rules:

- Integrations should not own core product state.
- Integration failures should degrade gracefully.
- Provider-specific data should be stored in provider-specific metadata fields, not sprayed across core tables.
- External IDs should be indexed when used for webhook lookup.
- Secrets should be server-only.

### Provider Adapter Pattern

Use adapter interfaces for external providers.

Examples:

```txt
EmailProvider
  sendEmail(message)

LogoProvider
  getLogoSuggestion(domain)

BillingProvider
  createCheckoutSession(input)
  verifyWebhook(input)

CalendarProvider
  normalizeEmbedUrl(url)
  verifyWebhook(input)

StorageProvider
  createUploadUrl(input)
  createReadUrl(input)
  deleteObject(input)
```

Rules:

- Feature code depends on Lightsite services, not provider SDKs.
- Provider SDKs live at infrastructure boundaries.
- Provider errors are translated into typed application/provider errors.
- Provider calls have timeouts.
- Provider calls that can be retried should be job-backed where possible.

### Webhook Principles

Webhooks are untrusted external input.

Rules:

- Verify signatures before parsing business payloads where provider supports signatures.
- Store raw event metadata only when useful and safe.
- Use provider event ID for idempotency.
- Acknowledge only after durable processing or durable enqueue, depending on provider retry behavior.
- Process business logic in jobs when work is slow.
- Never trust webhook payload alone for billing/security-critical state if provider API lookup is required.

Webhook event table shape:

```txt
provider_webhook_events
  id
  provider
  provider_event_id
  event_type
  status
  received_at
  processed_at nullable
  error_code nullable
  safe_metadata jsonb
```

### Billing Webhooks

Billing provider webhooks should be source of truth for subscription status changes.

Rules:

- Verify signature.
- Idempotently store event.
- Map provider customer/subscription IDs to workspace billing record.
- Update subscription state in a transaction.
- Emit audit event for plan/status changes.
- Do not grant paid access based only on client-side checkout success.
- Checkout success page should wait for backend billing status or show pending state.

Failure cases:

- Unknown provider customer ID: store event as unresolved and alert/log.
- Duplicate webhook: no-op after idempotency check.
- Out-of-order event: reconcile with provider state where possible.
- Provider unavailable during reconciliation: retry job.

### Calendar Integrations

V1 calendar support can start with embeds.

Supported v1:

- Cal.com embed URL.
- Calendly embed URL.
- Button/link to calendar URL.

Rules:

- Validate allowed calendar domains.
- Normalize embed URLs.
- Sandbox embeds where possible.
- Lazy-load calendar embeds on public pages.
- Provide a static fallback link if embed fails.
- Do not claim booking completion unless a provider integration confirms it.

Future booking tracking:

- Provider webhook.
- OAuth connection.
- Embed postMessage event only if provider documents it and it is trustworthy enough for the use case.

Tracking rule:

- Button/embed click can be tracked in v1.
- Confirmed booking requires provider-backed signal.

### Slack And Preview Detection

Slack sharing detection should remain probabilistic.

Signals:

- Slackbot or known preview client requests page metadata.
- Slackbot or known preview client requests OG image.
- Public tracking event records `link_preview_loaded`.

Rules:

- Label as preview/unfurl loaded, not guaranteed human share.
- Deduplicate repeated preview loads.
- Keep bot classification separate from human visits.
- Do not inflate visitor counts with preview bots.
- Store enough metadata to show source client when known.

### CRM Integrations

Do not build CRM sync in v1.

Future CRM principles:

- Workspace admin connects CRM.
- Sync is opt-in.
- CRM mappings are explicit.
- Lightsite remains source of truth for site content.
- CRM may receive activity summaries/events.
- CRM errors do not block public page tracking.
- Sync jobs are idempotent and retryable.

Potential future CRM events:

- Site link copied.
- Variant viewed.
- CTA clicked.
- Meeting booked.

Privacy:

- Do not push anonymous visitor tracking into CRM as a named contact without a reliable identity source.

### Integration Health

Each integration should expose health/diagnostics internally.

Track:

- Last successful call.
- Last failure.
- Error code/category.
- Retry status.
- Connected/disconnected state where applicable.

User-facing settings should show only actionable status:

- Connected.
- Needs attention.
- Reconnect.
- Provider unavailable, try later.

### Integration Testing

Testing requirements:

- Provider adapters have unit tests with mocked provider responses.
- Webhook signature verification is tested.
- Duplicate webhook behavior is tested.
- Out-of-order billing events are tested.
- Calendar URL normalization is tested.
- logo.dev failure paths are tested.
- Provider outage behavior is tested.

## Custom Domains And Public URL Strategy

### Purpose

Public links are central to Lightsite. The default public URL system must be stable enough for v1 and flexible enough for custom domains later.

V1 public URLs:

```txt
https://lightsite.app/{workspaceSlug}/{siteSlug}
https://lightsite.app/{workspaceSlug}/{siteSlug}/{variantSlug}
```

Custom domains are future scope, but the routing model should not prevent them.

### URL Ownership

Workspace owns the default namespace:

- `workspaceSlug`.
- Site slugs under that workspace.
- Variant slugs under a site.

Future custom domain ownership:

- Workspace owns custom domain connection.
- Domain can route to one workspace.
- Domain can optionally map root to a default site later.
- Domain can optionally preserve site/variant path structure.

Rules:

- Do not let two workspaces claim the same custom domain.
- Do not let one custom domain point to multiple workspaces unless explicit routing rules are added.
- Do not use email domain ownership as custom domain verification.
- Do not assume workspace website equals custom domain.

### Default URL Stability

Default Lightsite URLs should be stable.

Rules:

- Workspace slug changes are allowed only before any site has been published.
- Site slug changes are blocked while published until redirects exist.
- Variant slug changes break old variant links in v1 and require confirmation.
- Unpublish returns public links to 404.
- Archive returns public links to 404.

Future redirect support:

- Slug changes can create redirect records.
- Redirects should point only within same workspace/site ownership boundary.
- Redirect chains should be collapsed.
- Redirect loops must be prevented.
- Redirects should preserve analytics attribution where practical.

### Custom Domain Model

Future table:

```txt
workspace_domains
  id
  workspace_id
  domain
  normalized_domain
  status enum pending|verified|active|failed|disabled
  verification_type enum dns_txt|cname
  verification_token_hash
  provider_metadata jsonb
  verified_at nullable
  activated_at nullable
  disabled_at nullable
  created_by_user_id
  created_at
  updated_at
```

Rules:

- Normalize domains to lowercase punycode/canonical form.
- Reject localhost/private/internal domains.
- Reject domains already claimed by another workspace.
- Store verification tokens securely.
- Track status transitions.
- Audit domain add/remove/activate/disable.

### DNS Verification

Custom domains require proof of control.

Supported future verification:

- DNS TXT record.
- CNAME target, depending on hosting provider.

Rules:

- Verification checks run server-side.
- Verification status is cached but refreshable.
- Failed checks should explain the expected record.
- Verification token should be unique per domain.
- Removing a domain invalidates its verification.

### TLS And Hosting

Custom domain TLS should be handled by the hosting platform when possible.

Rules:

- Do not manually manage certificates unless required.
- Domain activation waits for TLS readiness.
- Public routing must fail closed before activation.
- If TLS provisioning fails, default Lightsite URLs still work.
- Domain status should surface actionable errors.

### Custom Domain Routing

Future routing options:

Option A:

```txt
https://sales.customer.com/{siteSlug}
https://sales.customer.com/{siteSlug}/{variantSlug}
```

Option B:

```txt
https://sales.customer.com -> default site
https://sales.customer.com/{variantSlug} -> default site variant
```

Preferred first custom-domain model:

- Domain maps to workspace.
- Path still includes site slug and optional variant slug.

Rationale:

- Supports multiple sites per workspace.
- Avoids default-site ambiguity.
- Keeps routing close to v1 default URL model.

### Custom Domain Analytics

Tracking should attribute the same way regardless of domain.

Rules:

- Site/version/variant identity comes from signed tracking context, not hostname alone.
- Public route resolution records hostname as metadata.
- Analytics may show domain/source URL later.
- Cache keys include hostname only when response differs by hostname.

### Custom Domain Security

Risks:

- Domain takeover.
- Stale DNS.
- Phishing/abuse.
- Host header attacks.

Rules:

- Validate host headers against known default domains and active custom domains.
- Do not render arbitrary workspaces for unknown hostnames.
- Disable custom domain when ownership cannot be verified after repeated checks if provider supports this workflow.
- Internal admins can disable abusive domains.
- Do not allow custom domains on free/basic plans unless product intentionally allows it.

## Entitlements, Limits, And Plan Enforcement

### Purpose

Plan limits should be enforced centrally and predictably.

Billing plans affect what a workspace can do. They should not be scattered across UI components, route handlers, and one-off checks.

### Entitlement Model

An entitlement is a named capability or limit.

Examples:

```txt
sites.max_active
members.max
variants.max_per_site
assets.storage_bytes
tracking.raw_retention_days
tracking.export_enabled
custom_domains.enabled
collaboration.enabled
templates.workspace_library_enabled
```

Rules:

- Backend services enforce entitlements.
- Frontend uses entitlements to shape UI, not to provide authority.
- Entitlements should be resolved once per request/workspace context where practical.
- Entitlements should be easy to test.
- Plan definitions should live in one server-side module/table, not component constants.

### V1 Plan Enforcement

Initial enforced limits:

- Active site count.
- Publishing allowed only for verified workspaces/users.
- Asset upload file size.
- Invite rate limits.

Deferred plan dimensions:

- Member count.
- Variant count.
- Tracking retention.
- Tracking export.
- Custom domains.
- Workspace template library.

Rules:

- Even deferred dimensions should have named entitlement placeholders if likely.
- Do not show upgrade UI for features that do not exist.
- Do not block normal v1 usage with imaginary plan limits.

### Usage Calculation

Usage should be calculated from source-of-truth records or maintained summaries with clear invalidation.

Examples:

- Active site count: count sites where status is draft or published; archived sites count in v1 per site plan-limit rules.
- Storage bytes: sum asset sizes, later materialized.
- Member count: active workspace members.
- Variant count: non-deleted variants for a site.

Rules:

- Services re-check usage inside mutations that create limited resources.
- Race conditions should be handled by transaction locks or database constraints where needed.
- UI usage display can be slightly stale; backend enforcement cannot be.
- Usage summaries should include `calculatedAt` if cached.

### Limit UX

Limit states should be clear and useful.

Admin UX:

- Explain current usage.
- Explain limit.
- Provide upgrade/billing action if available.

Non-admin UX:

- Explain limit.
- Suggest contacting an admin.
- Do not show billing controls they cannot use.

Rules:

- Do not let users fill long forms only to fail an obvious limit at submit when usage is already known.
- Still enforce on submit because usage can change.
- Limit errors should use typed error codes.

### Billing State And Grace Periods

Billing status should be separate from plan definition.

Billing states:

- Trialing.
- Active.
- Past due.
- Canceled.
- Unpaid.
- Suspended.

Rules:

- Billing webhook weirdness should not automatically transition a workspace to `suspended`.
- Past-due grace behavior should be explicit.
- Suspended workspaces cannot publish new changes.
- Once a workspace is explicitly `suspended`, existing public pages fail closed in V1.

V1 decision:

- Keep billing simple until paid plans ship.
- Store plan/status fields so future enforcement does not require schema churn.
- Do not implement automatic billing suspension until billing provider integration and grace policy are defined.

### Entitlement Checks

Service helpers:

```txt
requireCanCreateSite(workspaceId)
requireCanPublishSite(workspaceId, siteId)
requireCanInviteMember(workspaceId)
requireCanUploadAsset(workspaceId, file)
requireCanCreateVariant(siteId)
```

Rules:

- Helpers return typed failures.
- Helpers include current usage and limit when useful.
- Helpers are called inside service methods, not only route handlers.
- Tests cover allowed, at-limit, over-limit, and race cases.

### Plan Changes

Upgrade:

- Higher limits apply after billing state confirms.
- UI can show pending state after checkout.
- Server remains source of truth.

Downgrade:

- Existing resources above new limit remain visible.
- Creating new resources is blocked until usage is under limit or plan upgrades.
- Publishing behavior for existing sites must be decided per feature.

V1 downgrade rule:

- Do not implement self-serve downgrade effects until paid billing exists.
- Design services so over-limit workspaces can be represented without data deletion.

### Entitlement Testing

Tests should cover:

- Site creation at limit.
- Duplicate at limit.
- Archive/restore with limits.
- Invite rate/limit behavior.
- Upload size limit.
- Backend rejects even if frontend hides limit.
- Race where two creates happen simultaneously.
- Plan/status changes from billing webhook.

## Error Taxonomy And Failure UX

### Purpose

Errors should be predictable for developers and understandable for users.

Lightsite should avoid generic failures that force frontend code to inspect strings or guess recovery behavior.

Goals:

- Stable error codes.
- Consistent HTTP status usage.
- Field-level validation errors.
- Clear retry/recovery behavior.
- Good internal diagnostics.
- No leaked secrets or stack traces.

### Error Shape

All API errors should use a consistent envelope.

Shape:

```txt
{
  error: {
    code: "SITE_SLUG_TAKEN",
    message: "This site URL is already in use.",
    requestId: "...",
    fields: {
      slug: ["This URL is already in use."]
    },
    details: {
      limit: 10,
      currentUsage: 10
    }
  }
}
```

Rules:

- `code` is stable and machine-readable.
- `message` is safe to show to users.
- `requestId` is present for server-generated errors.
- `fields` exists only for field-level validation.
- `details` includes safe structured data only.
- Do not put secrets, tokens, SQL, stack traces, raw provider payloads, or private content in error responses.

### HTTP Status Mapping

Use status codes consistently:

- `400`: malformed request shape or invalid query params.
- `401`: unauthenticated.
- `403`: authenticated but not allowed.
- `404`: resource not found or intentionally hidden.
- `409`: conflict/race/state mismatch.
- `422`: semantic validation failure with field errors.
- `429`: rate limited.
- `500`: unexpected server error.
- `502`: upstream provider failure when relevant.
- `503`: service unavailable.

Rules:

- Do not use `200` with error payloads.
- Do not expose whether hidden resources exist across workspace boundaries.
- Prefer `404` for public routes when a resource is unavailable, unpublished, archived, or unauthorized to the public.
- Use `409` for slug races, version conflicts, already-accepted invites, and state transitions that are no longer valid.

### Core Error Codes

Auth/account:

```txt
AUTH_REQUIRED
AUTH_EMAIL_NOT_VERIFIED
AUTH_WORK_EMAIL_REQUIRED
AUTH_PERSONAL_EMAIL_BLOCKED
AUTH_EMAIL_PLUS_ALIAS_BLOCKED
AUTH_ACCOUNT_MISMATCH
AUTH_SESSION_EXPIRED
```

Workspace:

```txt
WORKSPACE_REQUIRED
WORKSPACE_NOT_FOUND
WORKSPACE_SLUG_TAKEN
WORKSPACE_SLUG_LOCKED
WORKSPACE_LAST_ADMIN_REQUIRED
WORKSPACE_ACCESS_DENIED
```

Sites:

```txt
SITE_NOT_FOUND
SITE_ACCESS_DENIED
SITE_SLUG_TAKEN
SITE_SLUG_LOCKED_WHILE_PUBLISHED
SITE_ARCHIVED
SITE_PLAN_LIMIT_REACHED
SITE_INVALID_STATE
```

Publishing:

```txt
PUBLISH_VALIDATION_FAILED
PUBLISH_DRAFT_NOT_SAVED
PUBLISH_ASSET_MISSING
PUBLISH_UNSUPPORTED_BLOCK
PUBLISH_PERMISSION_DENIED
PUBLISH_CONFLICT
```

Editor:

```txt
EDITOR_REVISION_CONFLICT
EDITOR_SCHEMA_INVALID
EDITOR_AUTOSAVE_FAILED
EDITOR_REALTIME_UNAVAILABLE
EDITOR_PERMISSION_REVOKED
```

Variables/variants:

```txt
VARIABLE_NOT_FOUND
VARIABLE_IN_USE
VARIABLE_TYPE_CONFLICT
VARIANT_NOT_FOUND
VARIANT_SLUG_TAKEN
VARIANT_DELETED
VARIANT_VALUE_INVALID
```

Assets:

```txt
ASSET_UPLOAD_TOO_LARGE
ASSET_TYPE_UNSUPPORTED
ASSET_SCAN_FAILED
ASSET_NOT_FOUND
ASSET_IN_USE
ASSET_FINALIZE_FAILED
```

Tracking:

```txt
TRACKING_CONTEXT_INVALID
TRACKING_CONTEXT_EXPIRED
TRACKING_EVENT_INVALID
TRACKING_RATE_LIMITED
```

Billing/entitlements:

```txt
ENTITLEMENT_REQUIRED
PLAN_LIMIT_REACHED
BILLING_STATUS_BLOCKED
BILLING_PROVIDER_UNAVAILABLE
```

Integrations:

```txt
PROVIDER_UNAVAILABLE
PROVIDER_TIMEOUT
WEBHOOK_SIGNATURE_INVALID
WEBHOOK_EVENT_DUPLICATE
INTEGRATION_NOT_CONNECTED
```

### Validation Errors

Validation errors should map cleanly to UI fields.

Rules:

- Server validation is authoritative.
- Frontend validation mirrors common rules for speed.
- Field keys should match form field names where possible.
- Array/nested errors should use stable paths.
- Submit should preserve user input.
- Validation should be deterministic.

Example:

```txt
fields: {
  "workspace.name": ["Workspace name is required."],
  "workspace.slug": ["Only lowercase letters, numbers, and hyphens are allowed."],
  "website": ["Enter a valid company website."]
}
```

### Conflict Errors

Conflict errors happen when state changed between load and submit.

Examples:

- Slug became unavailable.
- Invite was already accepted.
- Site was archived while editor was open.
- User lost access while editing.
- Publish attempted from stale draft revision.
- Billing/plan changed while creating a site.

Rules:

- Use `409`.
- Include current state when safe.
- Tell the UI whether reload/retry is appropriate.
- Do not blindly overwrite current server state.

### Retry Semantics

Errors should indicate whether retry is useful.

Retryable:

- Network failure.
- `503`.
- Provider timeout.
- Temporary email send failure.
- Realtime reconnect.
- Autosave transient failure.

Not retryable without changes:

- Validation error.
- Permission denied.
- Plan limit reached.
- Unsupported file type.
- Deleted/archived resource.

Rules:

- Automatic retries should use bounded exponential backoff.
- Mutations with side effects need idempotency keys before automatic retry.
- UI retry buttons should preserve the original action context.
- Background jobs should classify transient vs permanent failure.

### User-Facing Failure UX

Failure UX patterns:

- Form field error for editable input problems.
- Toast for lightweight action failures.
- Inline persistent banner for state that blocks progress.
- Empty/error state for failed page/list load.
- Confirmation dialog for destructive state changes.
- Full-page error boundary for unrecoverable route errors.

Rules:

- Errors should explain what happened and what the user can do.
- Avoid blaming the user.
- Provider messages are sanitized before display.
- Do not repeatedly toast autosave errors on every failed retry.
- Destructive failure states should confirm whether the action did or did not happen.

### Public Error UX

Public pages should fail safely and quietly.

Rules:

- Unpublished, archived, deleted, unavailable, and unknown public links return a neutral 404.
- Public 404 should not reveal workspace/site existence.
- Public 500 should show a generic error page.
- Tracking failures never block public page viewing.
- Missing optional media should render fallback/empty state.
- Missing required published assets should be caught before publish.

### Logging Errors

Server logs should include:

- Request ID.
- User ID when authenticated.
- Workspace ID when available.
- Site ID when available.
- Error code.
- HTTP status.
- Safe error category.
- Provider name when relevant.

Server logs should not include:

- Tokens.
- Passwords.
- Raw invite links.
- Full rich text content.
- Uploaded file bytes.
- Full provider webhook payloads unless sanitized and explicitly needed.

## Quality Gates, Testing, And CI

### Purpose

Testing should protect the product model, permissions, editor correctness, and public rendering.

Lightsite should not rely on manual clicking as the main quality strategy.

Quality goals:

- Safe auth and permissions.
- Reliable publishing.
- Stable public links.
- Correct variable/variant rendering.
- Durable editor saves.
- Low-regression UI foundation.
- Confident migrations.

### Test Pyramid

Use layered tests:

- Unit tests for pure logic.
- Service tests for use cases and permissions.
- API tests for route contracts.
- Component tests for reusable UI and feature widgets.
- E2E tests for critical user flows.
- Visual regression tests for design system/public page basics when practical.
- Load/performance smoke tests for hot paths.

Rules:

- Do not over-test implementation details.
- Test permissions and state transitions heavily.
- Test public rendering with fixture content.
- Keep E2E tests focused and stable.
- Every bug fix should add the lowest-level test that would have caught it when practical.

### Critical Unit Tests

Unit tests should cover:

- Work email validation and blocked domains.
- Slug generation and normalization.
- Slug validation.
- Website domain normalization.
- logo.dev domain parsing.
- Variable resolution.
- Variant override resolution.
- Content schema parsing.
- Content migrations.
- Publish validation.
- Entitlement calculation.
- Error code mapping.
- Date/time formatting helpers.
- Tracking event normalization.
- Bot classification utility.
- Calendar URL normalization.

### Critical Service Tests

Service tests should cover:

- Workspace creation transaction.
- Workspace slug availability race.
- Invite create/resend/revoke/accept.
- Last-admin protection.
- Site create/duplicate/archive/restore.
- Site access changes.
- Publish transaction.
- Rollback transaction.
- Variant create/edit/delete.
- Asset finalize and ownership validation.
- Tracking ingestion.
- Entitlement enforcement.
- Audit event creation.

Every service test should exercise both allowed and forbidden cases where permissions matter.

### API Contract Tests

API tests should cover:

- Auth required routes.
- Workspace context enforcement.
- Stable response envelope.
- Stable error envelope.
- Field-level validation errors.
- Cursor pagination.
- Idempotency behavior.
- Rate-limit behavior where practical.
- Public site route 404 behavior.
- Tracking endpoint accepting/rejecting signed contexts.

Rules:

- API tests should not depend on frontend components.
- API error codes should be asserted.
- Cross-workspace access attempts should be tested.

### Frontend Component Tests

Component tests should cover:

- Forms render server validation errors.
- Dialogs trap/restore focus through primitives.
- Tables/lists show loading/empty/no-results/error states.
- Share modal link states by publish status.
- Variant modal create/edit/delete states.
- Access modal permission rows.
- Editor inspector command dispatch.
- Variable chips render and can be selected.
- Design system component variants.

Avoid:

- Brittle snapshots of entire pages.
- Testing shadcn internals directly.
- Mocking so deeply that permission behavior disappears.

### E2E Test Suite

Critical E2E flows:

1. Sign up with work email.
2. Reject personal email and plus alias.
3. Complete user profile.
4. Create workspace with slug uniqueness check.
5. Create first site from template.
6. Edit site content and autosave.
7. Insert variable.
8. Create variant.
9. Publish site.
10. Open public default link.
11. Open public variant link.
12. Track public view/click.
13. View tracking feed.
14. Invite teammate.
15. Accept invite.
16. Change/remove member with last-admin protection.
17. Roll back site version.
18. Archive/unpublish and verify public 404.

Rules:

- E2E should use seeded deterministic data.
- E2E should not depend on real email delivery; use email sink/test hooks.
- E2E should not depend on real logo.dev; mock or fixture provider responses.
- E2E should verify public rendering in desktop and mobile viewport.

### Visual And Design Regression

Visual regression is valuable for:

- App shell.
- Sites table.
- Tracking page.
- Team page.
- Design system page.
- Public page default template.
- Editor selected/hover states.
- Variable chips.
- Publish/share dialogs.

Rules:

- Keep visual snapshots focused.
- Avoid visual tests for highly dynamic timestamps/cursors.
- Mask unstable content.
- Use real design tokens.
- Run visual tests before major UI refactors.

### Accessibility Testing

Accessibility checks should include:

- Automated checks for core routes.
- Keyboard navigation for app shell and dialogs.
- Keyboard route through editor basic actions.
- Public page heading/landmark checks.
- Form label/error association checks.
- Icon-only button accessible names.

Rules:

- Accessibility failures in primitives should be fixed at primitive layer.
- Public page accessibility is launch-critical.
- Editor accessibility issues should be tracked intentionally if not solved immediately.

### Performance Testing

Performance tests should cover:

- Public page load with representative content.
- Editor load with representative content.
- Typing in rich text field.
- Drag/reorder blocks.
- Sites page with many sites.
- Tracking page with many events.
- Publish transaction.
- Tracking ingestion burst.

Rules:

- Test representative worst-normal cases, not only tiny demo content.
- Performance budgets should fail CI only after budgets are stable.
- Record baseline metrics before optimization work.

### CI Gates

Required CI checks before merge/main deploy:

- Typecheck.
- Lint.
- Unit tests.
- API/service tests.
- Build web.
- Build API.
- Database migration check.
- Content schema fixture migration tests.

Recommended before production deploy:

- E2E smoke suite.
- Public rendering smoke.
- Accessibility smoke.
- Bundle size report.
- Migration dry run on staging-like data.

Rules:

- Do not deploy code that depends on migrations before migrations are applied safely.
- CI should fail on type errors.
- CI should fail on known broken critical tests.
- Flaky tests should be fixed or isolated quickly; do not normalize rerunning forever.

### Test Data And Fixtures

Maintain fixtures for:

- Empty workspace.
- Basic workspace.
- Workspace at plan limit.
- Draft site.
- Published site.
- Site with every block type.
- Site with variables/variants.
- Site with broken publish validation fixture.
- Tracking events.
- Team with pending invite.
- Archived site.

Rules:

- Fixtures should be deterministic.
- Fixtures should not contain real customer data.
- Content schema fixtures should be versioned.
- Use factories/builders to avoid giant unreadable test setup.

## Performance, Caching, And Scalability

### Purpose

Lightsite should feel lightweight because the product promise is speed and simplicity.

Performance goals:

- Public pages load fast.
- Editor typing is immediate.
- Autosave does not feel heavy.
- Tracking ingestion is cheap.
- Sites/tracking lists scale without rewrites.
- Public page hosting does not become expensive at low volume.

### Performance Domains

Treat these as separate domains:

- Public page rendering.
- Authenticated app shell.
- Editor/collaboration.
- API/service layer.
- Database queries.
- Tracking ingestion.
- Background jobs.
- Asset delivery.

Optimizing one domain should not make another less correct.

Example:

- Public pages can be aggressively cached by published version.
- Authenticated app data must respect permissions and should not use public caches.

### Public Page Budgets

Public pages are prospect-facing and should be fast on mobile.

Targets for representative v1 page:

- Initial HTML/route response: fast enough to feel instant on normal connections.
- Minimal JavaScript.
- No authenticated app bundle.
- Images optimized and lazy-loaded.
- Embeds lazy-loaded.
- Tracking script small and non-blocking.

Rules:

- Public pages should not import editor code.
- Public pages should not import app shell code.
- Public rendering should use published snapshot payloads only.
- Public pages should render meaningful content without waiting for tracking.
- Public pages should degrade gracefully if tracking endpoint fails.
- Public pages should avoid layout shift by reserving media dimensions.

### Authenticated App Budgets

App shell should load only what the current route needs.

Rules:

- Bootstrap current user/workspace/membership once.
- Do not load all sites in app shell.
- Do not load analytics in app shell.
- Route-level data fetching should be scoped.
- Large tables use pagination.
- Heavy editor code should be route-split.
- Design system/dev pages should not inflate production route bundles.

Initial app route should fetch:

- Current user.
- Active workspace.
- Workspace memberships/switcher summary.
- Minimal navigation counts only if cheap.

### Editor Performance Budgets

Editor performance priorities:

1. Typing latency.
2. Selection/hover responsiveness.
3. Autosave reliability.
4. Drag/reorder smoothness.
5. Collaboration stability.

Rules:

- Do not store every keystroke in global React state.
- Keep rich text editor state localized.
- Memoize block rendering where practical.
- Batch persisted operations.
- Debounce validation that is not immediately needed.
- Keep presence out of the persisted document.
- Avoid rerendering the full block list from presence updates.
- Uploads should not block editing other content.

Large page handling:

- One-pagers are expected to be moderate size.
- Still protect against pathological block counts.
- Set soft guidance and hard validation limits for block count, table size, accordion item count, and embed count.

### Database Performance

Database rules:

- Index every foreign key used in lookups.
- Index common workspace-scoped list queries.
- Use compound indexes for hot filters/sorts.
- Avoid N+1 queries.
- Avoid unbounded `count(*)` on large event tables in request paths.
- Use cursor pagination for append-heavy tables.
- Keep JSONB flexible, but extract/index fields needed for filtering.

Hot queries:

- Resolve workspace by slug.
- Resolve site by workspace/site slug.
- Resolve variant by site/variant slug.
- Load current published version.
- Load sites list for workspace.
- Load tracking feed for workspace/site.
- Insert tracking events.
- Check slug uniqueness.
- Check membership/permission.

Rules:

- Every hot query should have a known index.
- Slow query logs should be monitored.
- Query plans should be checked before adding large new list/filter features.

### Tracking Ingestion Performance

Tracking can grow faster than app data.

Rules:

- Tracking endpoint should do minimal synchronous work.
- Validate signed context.
- Classify obvious bot/preview client.
- Insert normalized event.
- Defer heavy aggregation to background jobs.
- Use batching where practical.
- Rate-limit abusive sources.
- Keep payloads small.

Do not:

- Recalculate dashboards on every event insert.
- Run expensive joins for every tracking event.
- Block public page view on analytics write.
- Store full user-agent/IP raw data as primary analytics shape.

### Analytics Aggregation Performance

Aggregation strategy:

- Raw events are append-only.
- Summaries are derived.
- Summary jobs can run periodically or incrementally.
- Tracking UI can combine recent raw events with cached summaries if needed.

Rules:

- Summary jobs are idempotent.
- Summary rows include date/workspace/site/version/variant dimensions as needed.
- Late-arriving events should be handled by recomputing a recent window.
- Bot/preview events should be aggregatable separately from human visits.
- Retention jobs should delete raw data only after summaries remain useful.

### Public Caching

Public route cache key should be based on:

- Workspace slug or active custom domain.
- Site slug.
- Variant slug if present.
- Published version ID.
- Variant revision if a variant is present.
- Rendering mode if needed.

Rules:

- Published content is immutable by version, so it is cache-friendly.
- Publish/republish changes the active published version and invalidates route cache.
- Unpublish/archive invalidates route cache and returns 404.
- Variant changes increment variant revision and invalidate affected variant route cache.
- Draft changes do not invalidate public cache until publish.
- Do not cache personalized responses by visitor.

### Authenticated Caching

Authenticated app caching should use TanStack Query and respect permissions.

Rules:

- Query keys include workspace/site IDs and filters.
- Clear cache on logout.
- Clear or scope cache on workspace switch.
- Do not share authenticated API responses through CDN public cache.
- Mutations invalidate or update exact affected queries.
- Permission loss should invalidate affected queries and route away.

### Asset Delivery Performance

Rules:

- Serve public assets through object storage/CDN.
- Store dimensions and metadata on image assets.
- Generate optimized variants where useful.
- Lazy-load non-critical images.
- Use responsive image sizes for public pages when possible.
- Do not proxy production asset reads through the API unless authorization requires it.

Upload performance:

- Direct-to-storage upload.
- API finalizes metadata.
- Large processing work happens in jobs.
- UI shows progress and retry.

### Realtime Scalability

Realtime should be efficient and bounded.

Rules:

- Rooms are per site/editor session.
- Presence is ephemeral.
- Presence messages are throttled.
- Content operations are batched where possible.
- Persistence is debounced.
- Server does not write every cursor movement to Postgres.
- Idle/disconnected clients are cleaned up.
- Reconnect reloads latest persisted draft if needed.

Cost control:

- Use one connection per browser tab/editor room.
- Avoid broadcasting to users without access.
- Avoid storing verbose operation history forever outside version checkpoints.

### Background Job Scalability

Rules:

- Jobs have idempotency keys.
- Jobs are chunked for large datasets.
- Jobs store progress when long-running.
- Jobs have backoff and retry limits.
- Jobs should not monopolize the database.
- Heavy jobs should run off request path.

Large jobs:

- Tracking export.
- Workspace export.
- Retention pruning.
- Asset cleanup.
- Summary backfill.
- Migration backfill.

### Performance Observability

Track:

- Public page response latency.
- API route latency by route.
- Database query latency for hot paths.
- Tracking ingestion rate and latency.
- Job queue depth.
- Job failure rate.
- Realtime room count/connection count.
- Editor autosave latency.
- Asset upload finalize latency.
- Cache hit/miss where available.

Rules:

- Metrics should be tagged by environment.
- Avoid high-cardinality labels like raw URL or raw slug in metrics.
- Use IDs sparingly in logs, not metrics labels.

### Scaling Path

V1 path:

- Single web app.
- API service.
- Postgres.
- Object storage/CDN.
- Simple job runner/cron.
- Realtime in API process or adjacent service if supported.

Next scaling moves:

- Separate worker process.
- Separate realtime service.
- Read-optimized summaries for analytics.
- CDN/edge caching for public pages.
- Queue-backed tracking ingestion if volume requires.
- Database read replicas only after query/index/summarization basics are exhausted.

Do not introduce distributed complexity before measured need.

## Time, Dates, Time Zones, And Locale

### Purpose

Time bugs are subtle and expensive, especially for tracking, billing, invites, version history, and activity feeds.

Lightsite should use a consistent time model from the start.

### Storage Rules

Rules:

- Store timestamps in UTC.
- Use timezone-aware timestamp types in Postgres.
- Server-generated timestamps are canonical for persistence.
- Client timestamps can be metadata, not source of truth.
- Store dates separately only when the domain concept is date-only.

Examples:

- `createdAt`: UTC timestamp.
- `publishedAt`: UTC timestamp.
- `expiresAt`: UTC timestamp.
- Tracking event canonical occurrence: server receive timestamp.
- Workspace reporting timezone: future workspace setting.

### Display Rules

Default display:

- Authenticated app uses user's browser locale/timezone unless workspace setting is added.
- Public pages rarely need absolute timestamps.
- Tracking dashboards should make date ranges clear.

Rules:

- Use relative time for recent app activity when helpful.
- Always provide absolute timestamp in tooltips or detail views for audit-like data.
- Date range filters should state timezone.
- Exported CSV should include UTC timestamps and, if useful, formatted local time columns.

### Date Ranges

Tracking filters need precise ranges.

Rules:

- Date range UI should convert selected local days into UTC boundaries on the server.
- Server should receive explicit start/end timestamps or validated date range plus timezone.
- End boundaries should be exclusive where practical.
- Presets should be defined clearly: today, yesterday, last 7 days, last 30 days.
- Do not rely on client-only filtering for canonical analytics ranges.

### Invite And Token Expiration

Rules:

- Expiration uses server time.
- Expired invites cannot be accepted.
- Expired tokens should show a clear recovery path.
- Resending invite creates or rotates token according to invite policy.
- Do not extend token lifetime silently unless resend is explicit.

### Version History Time

Version history should show:

- Created timestamp.
- Actor.
- Version kind.
- Published timestamp when relevant.

Rules:

- Sort versions by server-created timestamp and version number.
- Do not use client autosave time as canonical ordering.
- If two versions are close together, version number breaks ties.

### Tracking Time

Tracking has multiple time concepts:

- Event received at server.
- Event generated at client.
- Session started.
- Session ended/inferred.
- Heartbeat intervals.

Rules:

- Server receive time is canonical for ordering.
- Client time can help diagnose delays but cannot override ordering.
- Time spent is inferred from bounded heartbeats.
- Session timeout rules should be explicit.
- Late events should be accepted only within signed context/retention rules.

### Billing Time

Billing time comes from provider events.

Rules:

- Store provider timestamps and server received timestamps.
- Provider subscription period boundaries come from provider.
- Grace periods are calculated server-side.
- Do not trust client checkout completion time for entitlement changes.

### Locale And Formatting

V1 can be English-only.

Rules:

- Keep user-facing strings centralized enough to avoid hard-to-find copies.
- Format numbers/dates through helpers.
- Do not bake formatted dates into persisted data.
- Do not use locale-specific strings as API values.

Future localization:

- API values remain stable enums/codes.
- UI labels map from codes.
- Date/number formatting uses locale helpers.

## Release, Migration, And Backfill Safety

### Purpose

Lightsite should be safe to change after real users and public links exist.

Release safety matters because:

- Public links may be shared externally.
- Published versions must remain renderable.
- Tracking data can grow quickly.
- Auth and billing mistakes are high-impact.
- Content schema changes can affect every site.

### Release Principles

Rules:

- Prefer small, reversible releases.
- Separate schema changes from behavior changes when risk is meaningful.
- Use backwards-compatible database migrations.
- Use content migrations with fixtures and tests.
- Do not delete data in the same release that stops using it.
- Feature flags can gate rollout but cannot replace permission checks.
- Public rendering should remain compatible with currently published versions.

### Deployment Environments

Environments:

- Local.
- Preview/branch deployment, if hosting supports it.
- Staging.
- Production.

Rules:

- Staging should use production-like config without production secrets/data exposure.
- Preview deployments should not send real emails.
- Preview deployments should not process production webhooks.
- Staging should be able to run migrations against staging data.
- Production deploys should have clear preflight checks.

### Database Migration Pattern

Use expand/contract migrations.

Pattern:

1. Expand: add nullable column/table/index.
2. Deploy code that writes both old and new shape if needed.
3. Backfill existing data.
4. Deploy code that reads new shape.
5. Verify.
6. Contract: remove old column/code in later release.

Rules:

- Never edit applied migrations.
- Avoid long locking migrations.
- Add indexes concurrently where provider/tooling supports it.
- Backfill in batches.
- Keep migrations idempotent where tooling allows.
- Document manual steps.
- Test migration on staging-like data before production.

### Content Schema Migration Pattern

Content JSON migrations are separate from SQL migrations.

Rules:

- Every content document has `schemaVersion`.
- Parser migrates known older versions to current typed shape.
- Migration functions are deterministic.
- Migration functions are tested with fixtures.
- Publishing should write current schema version.
- Major migrations create a `migration` site version if they alter saved content.
- Public rendering must handle published snapshots from older schema versions until migrated.

Migration options:

- Migrate on read and persist on next save.
- Migrate in background job.
- Migrate during publish only.

V1 decision:

- Use read-time migration for compatibility.
- Persist current schema on editor save/publish.
- Use background migrations only when needed for performance or data cleanup.

### Backfills

Backfills should be safe, resumable, and observable.

Backfill examples:

- Add normalized workspace domain.
- Add asset dimensions.
- Add tracking summaries.
- Add denormalized site title to analytics event exports.
- Add published version cache records.
- Add new entitlement usage summaries.

Rules:

- Process in batches.
- Track progress.
- Use stable ordering.
- Be idempotent.
- Be resumable after failure.
- Avoid loading entire tables into memory.
- Avoid holding long transactions.
- Emit metrics/logs.
- Include dry-run mode for risky backfills.

### Rollback Strategy

Code rollback is not the same as data rollback.

Rules:

- Releases should be backwards-compatible enough that code rollback works.
- Do not deploy irreversible schema contractions with risky code.
- If a migration cannot be rolled back safely, document that before deploy.
- Public rendering compatibility should cover at least one previous content schema version.
- Data repair scripts should be reviewed carefully.

Rollback examples:

- Bad UI release: rollback app code.
- Bad migration adding nullable column: usually safe to leave column.
- Bad backfill: pause job, repair data, resume or roll forward.
- Bad content migration: restore from version history only if per-site content changed; otherwise roll forward with parser fix.

### Feature Flags And Rollouts

Use flags for rollout control.

Flag types:

- Internal-only.
- Workspace allowlist.
- Percentage rollout.
- Kill switch.

Rules:

- Flags should have owners and intended removal dates.
- Stale flags should be removed.
- Critical security/permission behavior must not depend only on frontend flags.
- Backend flags must be evaluated server-side.
- Flagged code should be tested both on and off for risky changes.

### Release Checklist

Before production release:

- Typecheck passes.
- Lint passes.
- Unit/service/API tests pass.
- Build passes.
- Critical E2E smoke passes.
- Migrations reviewed.
- New environment variables added to `.env.example` and deploy config.
- Feature flags configured.
- Public page smoke checked if public rendering changed.
- Tracking smoke checked if tracking changed.
- Rollback plan understood.

After production release:

- Check error rate.
- Check API latency.
- Check public page latency if touched.
- Check job failures if touched.
- Check tracking ingestion if touched.
- Check auth/session errors if touched.
- Check provider webhook failures if touched.

### Production Data Access

Production data should be treated carefully.

Rules:

- Do not run one-off SQL without review for risky changes.
- Prefer scripted, versioned maintenance jobs.
- Log manual support/admin actions.
- Never use production data in local development without approved anonymization.
- Do not export customer content casually for debugging.

### Incident Roll Forward

Sometimes roll forward is safer than rollback.

Use roll forward when:

- Schema migrated forward and old code cannot read new data.
- Provider webhook state changed externally.
- Public content schema needs parser compatibility fix.
- Data repair is small and clear.

Rules:

- Keep roll-forward patches narrow.
- Add tests for the incident.
- Document what happened and what was changed.

## Browser, Device, And Responsive Support

### Purpose

Lightsite has two very different device requirements:

- Public pages must work beautifully on mobile and desktop.
- The authenticated editor can be optimized for desktop, but must fail gracefully on small screens.

### Browser Support

V1 support:

- Latest Chrome.
- Latest Safari.
- Latest Firefox.
- Latest Edge.
- Mobile Safari for public pages.
- Chrome on Android for public pages.

Rules:

- Public pages should avoid browser APIs without broad support or safe fallbacks.
- Authenticated app can require modern browsers.
- Editor can show unsupported-browser messaging for severe incompatibilities.
- Do not build for Internet Explorer.

### Public Mobile Requirements

Public pages:

- Fully responsive.
- No horizontal overflow.
- Tap targets are usable.
- Text is readable.
- Images preserve aspect ratio.
- Embeds have mobile fallback or responsive behavior.
- CTA buttons are easy to tap.
- Tracking script works without blocking rendering.

Public mobile testing should include:

- Default link.
- Variant link.
- Page with all block types.
- Long page with tracking scroll depth.
- Missing optional media.
- Calendar embed/fallback.

### App Mobile Requirements

Authenticated app:

- Login/signup/onboarding works on mobile.
- Sites list is usable on mobile.
- Tracking page is usable at basic level on mobile.
- Team/settings can be usable or simplified.
- App shell/sidebar does not overlap content.

Editor:

- V1 may recommend desktop for full editing.
- Mobile editor should not corrupt content.
- If editing is limited, message clearly.
- Public preview/mobile preview should be available.

### Responsive Layout Rules

Rules:

- Define stable breakpoints.
- Avoid text overlapping controls.
- Avoid fixed-width tables without responsive fallback.
- Use horizontal scrolling only for genuinely tabular dense data, and make it clear.
- Modals/sheets should fit mobile viewport.
- Sticky headers/footers should not cover form actions.
- Test browser zoom and larger text where practical.

### Pointer And Input Modes

Rules:

- Hover controls must have focus/tap equivalents.
- Drag operations should have menu/keyboard alternatives.
- Tooltips should not be the only way to access required information.
- Context menus should work with keyboard.
- Form inputs should use correct mobile keyboard types.

### Offline And Poor Network Behavior

V1 should handle poor network gracefully.

Rules:

- App should show clear retry on failed route loads.
- Editor autosave should show unsaved/error state.
- Public pages should render if initial HTML/assets load, even if tracking fails.
- Tracking uses best-effort send/beacon and accepts data loss.
- Uploads show failed/retry state.
- Realtime reconnects or asks user to reload.

Do not promise full offline editing in v1.

## Content Security, Sanitization, And Embed Policy

### Purpose

Lightsite stores user-created content and renders it publicly. XSS and embed abuse are core risks.

### Rich Text Sanitization

Rules:

- Store rich text as structured JSON, not arbitrary HTML.
- Render only supported nodes/marks.
- Strip unsupported attributes.
- Validate URLs.
- Escape text by default.
- Do not allow arbitrary inline scripts/styles.
- Do not accept pasted HTML without schema normalization.

### URL Sanitization

Rules:

- Allow `https` URLs by default.
- Allow `mailto` only where explicitly supported.
- Reject `javascript:`, `data:`, and other unsafe protocols.
- Normalize URLs before storage where appropriate.
- Display external links safely.
- Use `rel="noopener noreferrer"` for external links opened in new tabs.

### Embed Allowlist

Embeds should be allowlisted.

V1 allowed providers:

- Cal.com.
- Calendly.
- YouTube/Vimeo only if video block supports them.

Rules:

- Do not store arbitrary embed scripts.
- Store provider and normalized embed URL.
- Render iframe with restricted attributes.
- Use sandbox where provider compatibility allows.
- Lazy-load embeds.
- Provide fallback links.
- Block publish for unsupported embed providers.

### Content Security Policy

Use CSP where practical.

Goals:

- Restrict scripts.
- Restrict frames to allowed providers.
- Restrict image/media sources.
- Prevent inline script execution where possible.

Rules:

- Public pages may need a stricter CSP than authenticated app.
- Avoid unsafe-inline scripts.
- If inline boot payload is required, use nonce/hash strategy where supported.
- Tracking script should comply with CSP.
- Provider embed requirements should be documented.

### Public Rendering Safety

Rules:

- Public renderer should be pure and schema-driven.
- Unknown blocks render safe fallback in previews and should be blocked before publish.
- Public renderer should not evaluate user code.
- Public renderer should not trust client-provided tracking IDs.
- Public renderer should not expose draft content.

### Security Tests

Tests should include:

- Unsafe URL rejection.
- Pasted HTML normalization.
- Unsupported embed blocked.
- XSS fixture rendered harmlessly.
- Public renderer escapes text.
- CSP smoke for public page.
- Cross-workspace asset access blocked.
- Public route does not expose unpublished draft.

## Recipients, Prospects, And Variant Identity

### Purpose

Lightsite is for sending useful one-pagers to prospects, but v1 should not become a CRM.

Variants can represent a personalized link for:

- A prospect.
- A company/account.
- A buying committee.
- A generic segment.
- A one-off follow-up.

V1 stores enough recipient context to make variants understandable and analytics useful, without creating contact ownership, dedupe, lifecycle, or CRM sync complexity.

### V1 Recipient Model

V1 recipient data lives on the variant as lightweight metadata.

Fields:

```txt
site_variants
  recipient_label nullable
  recipient_email nullable
  recipient_company nullable
  recipient_external_url nullable
```

Meaning:

- `recipient_label`: display label, such as "Jane at Acme" or "Acme buying committee".
- `recipient_email`: optional email for human context; not used for auth or identity.
- `recipient_company`: optional company/account name.
- `recipient_external_url`: optional CRM/account/person URL later, if manually supplied.

Rules:

- Recipient fields are optional.
- Variant name remains required.
- Recipient metadata does not create a contact record.
- Recipient email is not proof of visitor identity.
- Recipient fields should not be used for public route authorization.
- Recipient fields should not be exposed on public pages unless explicitly rendered in content through variables.

### Visitor Identity

Public visitors are anonymous by default.

Rules:

- A variant link identifies the link/variant, not necessarily the person viewing it.
- Do not claim "Jane viewed" solely because Jane's email is stored on the variant.
- Analytics can show "Variant: Jane at Acme" or "Link: Jane at Acme".
- Visitor/session rows should remain anonymous unless a future explicit identity capture exists.
- Slack/preview bots should never be treated as recipient identity.

UI copy should prefer:

- "Jane at Acme link viewed."
- "Variant viewed."
- "Session from this link."

Avoid:

- "Jane viewed the page" unless identity is known.

### Recipient Privacy

Recipient data is potentially personal data.

Rules:

- Keep recipient fields minimal.
- Do not require recipient email to create a variant.
- Do not store unnecessary personal notes in recipient fields.
- Do not include recipient email in public HTML metadata.
- Do not include recipient email in internal product analytics.
- Exports that include recipient data should require workspace permissions and clear labeling.

### Variant Naming

Variant naming should support human workflows.

Rules:

- Variant name is internal app display.
- Variant slug is public URL segment.
- Recipient label can default from variant name during creation but remains separate.
- Changing variant name does not change slug.
- Changing recipient metadata does not change slug.

Suggested creation defaults:

- If recipient company exists: variant name defaults to company.
- If recipient name/email exists: variant name defaults to recipient label.
- Slug generated from variant name and made unique within site.

### Recipient Data In Variables

Recipient fields and variables are separate.

Rules:

- Variant variable overrides control rendered personalization.
- Recipient metadata is for internal organization/analytics labels.
- Creating a variant can optionally prefill variable overrides from recipient fields.
- Later edits to recipient metadata do not automatically mutate variable overrides unless user explicitly applies them.

Example:

- Recipient company: `Acme`.
- Variable override for `{{company_name}}`: `Acme`.
- If user later changes recipient company to `Acme Corp`, do not silently change rendered content.

### Future Contacts

Do not build full contacts in v1.

Future contact model may include:

- Workspace-owned contacts.
- Accounts/companies.
- Contact-to-variant relationship.
- CRM external IDs.
- Import/export.
- Consent/privacy controls.
- Activity rollup by contact/account.

Rules for future contact model:

- Contact identity must be explicit.
- Variant recipient metadata should migrate cleanly into contact links.
- Analytics should distinguish known contact events from anonymous link events.
- CRM sync should be opt-in and provider-isolated.

### Recipient Search

V1 search can search variant recipient metadata.

Searchable:

- Variant name.
- Recipient label.
- Recipient company.
- Recipient email if stored.

Rules:

- Search is workspace/site-scoped.
- Search results do not expose recipient metadata across workspaces.
- Recipient email search should be exact or normalized enough to avoid surprises.

### Recipient Deletion And Redaction

Because recipient metadata may be personal data, redaction should be possible later.

V1 decision:

- Deleting a variant soft-deletes the variant but preserves analytics.
- Recipient metadata remains on soft-deleted variant unless a future privacy deletion/redaction workflow is added.
- Manual admin/support redaction should be possible through a controlled script or future admin tool.

Future redaction:

- Clear recipient fields.
- Preserve variant ID and analytics attribution.
- Replace display labels with "Redacted variant".
- Audit the redaction.

## Activity Feed, Audit Visibility, And Collaboration Notes

### Purpose

Lightsite needs two different histories:

- Product activity that helps users understand what happened.
- Security/audit history that helps admins/support investigate important actions.

These should not be blurred.

### Product Activity

Product activity is user-facing and workspace-scoped.

Useful activity examples:

- Site created.
- Site published.
- Site unpublished.
- Site archived/restored.
- Version restored.
- Variant created/deleted.
- Access changed.
- Teammate invited.
- Invite accepted.

V1 decision:

- Do not build a full activity feed UI unless needed for launch workflows.
- Store enough actor/timestamp/audit data that a feed can be added later.
- Show local activity context where it matters, such as version history and tracking events.

### Audit History

Audit history is authoritative and admin/support-oriented.

Rules:

- Audit records are append-only.
- Audit records should be created in the same transaction as the action when practical.
- Audit metadata must be safe and minimal.
- Audit records should not contain full site content.
- Internal admin actions are audit-required.
- Billing changes are audit-required.
- Permission changes are audit-required.

Audit visibility:

- Workspace admins may eventually see a filtered workspace audit log.
- Internal admins may see broader operational audit details.
- Regular users should not see sensitive admin/support audit metadata.

### Site-Level History

Site-level history should be split:

- Version history for content restoration.
- Publish history for public state.
- Access history for permissions.
- Analytics history for visitor behavior.

Rules:

- Version history is not a substitute for audit history.
- Analytics events are not a substitute for audit history.
- Audit history is not a substitute for version restore.

### Collaboration Notes And Comments

Do not build comments in v1.

Rationale:

- Comments introduce mentions, notifications, permissions, resolution state, email preferences, and retention questions.
- The core product can launch without comments.
- Sales teams can collaborate in their existing tools while Lightsite proves the editor/publishing workflow.

Future comments requirements:

- Site-scoped comments.
- Block-anchored comments.
- Resolved/unresolved state.
- Mentions.
- Email/in-app notifications.
- Permission-aware visibility.
- Comment deletion/redaction.
- Audit for moderation actions.

Rules if added later:

- Comments must not be stored inside site content JSON.
- Comments should reference stable block IDs.
- Deleted blocks should preserve comment history or mark comments orphaned.
- Comments should not render on public pages.

### Review And Approval

Do not build formal approval workflows in v1.

Future approval workflow may include:

- Draft review request.
- Approver role.
- Required approval before publish.
- Approval comments.
- Audit record on approval.
- Bypass permissions for admins.

Rules if added later:

- Approval state should be separate from draft content.
- Publishing service enforces approval requirement.
- Approval should bind to a draft revision/version.
- Any edit after approval should invalidate approval or require clear policy.

### Activity Notifications

V1 notification policy remains simple:

- Toasts for immediate actions.
- Email for auth/invites/security.
- No notification center.
- No comment notifications because comments do not exist in v1.

Future activity notifications should be:

- Preference-aware.
- Workspace-aware.
- Permission-aware.
- Batched when noisy.
- Not sent for every autosave/edit operation.

## User Profiles, Preferences, And Account Lifecycle

### Purpose

User accounts represent people. Workspace memberships represent what those people can do inside a company workspace.

These concepts must stay separate.

User profile owns:

- Name.
- User avatar.
- Email display.
- Personal preferences.
- Account onboarding state.

Workspace membership owns:

- Workspace role.
- Workspace access.
- Invite acceptance.
- Membership status.
- Workspace-specific permissions.

### Profile Fields

Profile fields:

```txt
user_profiles
  user_id
  display_name
  avatar_asset_id nullable
  onboarding_completed_at nullable
  default_workspace_id nullable
  created_at
  updated_at
```

Rules:

- Email belongs to auth provider/user account, not profile display fields.
- Display name is required after account setup.
- User avatar is optional.
- Profile avatar should not become workspace logo.
- Profile avatar should not affect site avatars.
- Profile updates do not change historical actor display stored in immutable records unless the UI resolves live user profile by ID.

### Account Setup

Account setup is separate from workspace setup.

Required:

- Display name.
- Verified work email before workspace creation/publishing.

Optional:

- None in v1.

Rules:

- If user signs up from invite, account setup happens before or during invite acceptance.
- If profile is incomplete, route to account setup after auth.
- If workspace setup is incomplete, route to workspace setup after account setup.
- Do not create a workspace before account setup unless the flow explicitly allows it transactionally.

### User Avatar

V1 avatar options:

- Initials fallback.

Rules:

- User avatar upload is deferred in v1.
- If auth provider exposes a safe avatar URL later, treat it as external display metadata, not a Lightsite asset.
- Removing avatar falls back to initials.

Future avatar upload requirements:

- Avatar uploads use normal asset validation.
- Avatar assets are user-owned or account-scoped, not workspace-owned.
- Do not let user avatar work block workspace logo/site avatar features, which are more product-critical.

### Default Workspace

Users can belong to multiple workspaces.

Rules:

- Store last active workspace or default workspace per user.
- On login, route to last active workspace if membership still valid.
- If last active workspace is unavailable, choose another active membership.
- If no workspace exists, route to workspace setup or invite acceptance.
- Workspace switch updates last active workspace.

### User Preferences

V1 preferences can be minimal.

Suggested preferences:

- Last active workspace.
- Basic UI preferences if needed.
- Notification preferences only when optional notifications exist.

Rules:

- Do not build a large preferences system before product needs it.
- Preferences should be user-scoped unless they clearly belong to workspace.
- Preferences should never control permissions.
- Preference failures should not block core app usage.

### Email Changes

Do not support self-serve email change in v1 unless BetterAuth setup includes it cleanly.

If added later:

- New email must pass work email policy.
- New email must be verified.
- Personal domains and plus aliases remain blocked.
- Existing workspace memberships remain tied to user ID, not email string.
- Pending invites may need reconciliation.
- Audit/security email should be sent.

### Account Deactivation And Deletion

Do not build full account deletion in v1 unless required for launch/legal.

Future deletion/anonymization rules:

- User can be removed from workspaces.
- Historical actor IDs in audit/version records remain.
- Display name may be anonymized if privacy deletion requires it.
- Workspace-owned sites remain with the workspace.
- Created/published history should not disappear.
- Last-admin protections still apply before deleting/deactivating a user with admin memberships.

Recommended future approach:

- Deactivate account login.
- Remove active sessions.
- Preserve immutable audit references.
- Anonymize profile fields where required.

### Session Lifecycle

Rules:

- Logout clears client query cache and realtime connections.
- Password reset/session revocation should invalidate relevant sessions if supported.
- Removed workspace membership stops access on next request and next realtime permission check.
- Role changes take effect on next request and should update active clients quickly where practical.

## Workspace Lifecycle, Leaving, And Deletion

### Purpose

Workspace lifecycle must protect company data, public links, and team continuity.

Workspace lifecycle states:

- Active.
- Suspended.
- Scheduled for deletion.
- Deleted.

V1 should support active workspaces, suspension state handling, and admin-driven member removal. Self-service workspace leaving and customer-facing workspace deletion are excluded from V1.

### Leaving A Workspace

Self-service workspace leaving is excluded from V1. This section defines the rules for a later scoped release.

Rules:

- Last admin cannot leave.
- If user is the only admin, they must promote another member first. Workspace deletion/suspension is a separate admin/support flow and should not bypass admin continuity by accident.
- Leaving removes current access immediately.
- Historical actions remain attributed to user ID.
- Sites created by leaving user remain workspace-owned.
- Private sites created by leaving user should not become inaccessible to all admins.

Required behavior when this is added:

- Admins can access all workspace-owned sites, including private sites created by former members.
- Leaving user loses access to all workspace data immediately.

### Removing A Member

Admins can remove members subject to protections.

Rules:

- Admin cannot remove the last admin.
- Removing a member revokes workspace access immediately.
- Active editor sessions for that member are disconnected or become unauthorized on next check.
- Site access rows for removed member can remain historically or be disabled; effective access must stop.
- Removing an active member revokes pending invites for the same normalized email in the same workspace.

Site ownership/display:

- `createdByUserId` remains historical.
- `updatedByUserId` remains historical.
- `publishedByUserId` remains historical.
- Current site manageability is determined by workspace role/access, not by whether creator is still active.

### Ownership-Like Responsibilities

Lightsite does not need a separate "workspace owner" role in v1.

V1 roles:

- Admin.
- User.

Rules:

- Admins collectively own workspace administration.
- Last-admin protection provides continuity.
- Billing access is admin-only in v1.
- If future owner role is added, it should be separate from historical creator fields.

Future owner role may control:

- Billing ownership.
- Workspace deletion.
- Transfer of primary ownership.
- Support escalation approval.

### Workspace Suspension

Suspension is an internal/admin-controlled V1 state. Billing-driven suspension can be wired later when paid billing and grace policy are defined.

Suspension may happen because:

- Billing failure after grace period.
- Abuse/moderation.
- Security concern.

Suspended workspace behavior:

- Users can log in.
- Workspace may show suspended banner.
- Editing is read-only in V1.
- Publishing is blocked.
- Public routes fail closed in V1.
- Admin/support action required to restore.

Rules:

- Suspension reason should be stored.
- Suspension action is audited.
- Internal admins can suspend for abuse.
- Billing suspension should be driven by billing state/policy.

### Workspace Deletion

Do not build self-serve hard workspace deletion in v1.

Rationale:

- Workspace deletion affects sites, public links, variants, assets, analytics, audit logs, billing, and legal retention.
- Mistakes are high-impact.
- Archive/suspension/removal flows are enough for early product operations.

Future deletion requirements:

- Admin-only unless a future owner role is explicitly introduced.
- Strong confirmation.
- Delay window/cooling-off period.
- Billing cancellation handling.
- Public links disabled.
- Data export option before deletion.
- Retention/anonymization policy.
- Audit record.

Deletion should be staged:

1. Mark workspace deletion requested.
2. Disable new publishing.
3. Disable public links or schedule disable.
4. Wait cooling-off period.
5. Delete/anonymize according to retention policy.

### Workspace Slug Changes

Workspace slug is part of public URL namespace.

Rules:

- Workspace slug can change only before any site has ever been published.
- After first publish, slug is locked until redirect support exists.
- Slug change is audited.
- Slug availability checks must be race-safe.

Future redirect support can relax this, but should be explicit and tested.

### Workspace Website Changes

Workspace website is used for:

- Company identity.
- Logo suggestion.
- Internal display.

Rules:

- Website changes do not automatically change workspace slug.
- Website changes do not automatically overwrite workspace logo.
- User can request a new logo suggestion after website change.
- New suggested logo must be accepted before becoming workspace logo.
- Existing sites keep their copied/default avatar unless manually changed.

### Domain Join Policy

Do not allow automatic joining by email domain in v1.

Rationale:

- Work email domain is not sufficient proof of authorization.
- Multiple companies can share domains.
- Agencies/consultants may use client domains in complex ways.
- Automatic join can leak workspace existence.

Future domain-join policy requirements:

- Admin enables domain join.
- Domain is verified.
- New users with matching verified email can request/join.
- Join behavior is audited.
- Admin can disable.

### Workspace Recovery

Recovery cases:

- Last admin leaves attempt: block before it happens.
- Last admin account inaccessible: support process.
- Workspace slug typo before publish: admin can change.
- Workspace logo wrong: admin can change.
- Website wrong: admin can change.

Support recovery should require:

- Identity verification.
- Audit record.
- Minimal necessary access.
- No silent data edits.

## First-Run Experience And Empty States

### Purpose

First-run experience should get a sales team from blank workspace to shareable page quickly.

First-run should not teach every feature. It should guide the next useful action.

### First Workspace State

After workspace setup, route user to one of:

- Create first site flow.
- Sites page with strong empty state and create action.

V1 decision:

- Route to create first site/template selection when workspace has zero sites.

Empty state should include:

- Clear title.
- One sentence of context.
- Primary create action.
- Optional secondary link to design system/docs only in development/internal contexts.

### First Site Creation

First site creation should ask for:

- Site name.
- Site slug, generated from name and editable.
- Template choice.

Should not ask for:

- Every style setting.
- Billing prompts unless limit reached.
- Advanced access rules.
- Custom domain.

Defaults:

- Private draft visibility.
- Workspace logo copied as site avatar.
- Starter template.
- No variants until the user creates recipient-specific links.

### First Publish Guidance

Publish flow should guide through required readiness only.

Publish validation should surface:

- Missing title/required text.
- Broken variable references.
- Missing required assets.
- Invalid URLs/embeds.
- Unsupported blocks.
- Missing alt text warnings for meaningful images.

Avoid:

- Long generic education panels.
- Blocking on optional perfection.
- Hiding exact block that needs fixing.

### Empty State Inventory

Required empty states:

- No sites.
- No archived sites.
- No tracking events.
- No variants.
- No team members beyond self, if team page needs it.
- No pending invites.
- No search results.
- No assets if asset library is added.
- No version history beyond initial state.

Rules:

- Empty states should be specific to the current filter/state.
- Empty states should include the next action when one exists.
- No-results empty states should offer reset filters/search.
- Empty states should not use marketing-style filler.

### Onboarding Persistence

Onboarding progress should be resumable.

Rules:

- Store enough state to know next incomplete step.
- Do not create duplicate workspaces on retry.
- Workspace creation transaction must be idempotent or protected from double submit.
- Logo suggestion failure does not block onboarding.
- User can skip optional logo upload.
- User cannot finish workspace setup without valid unique workspace slug and website.

### First-Run Analytics

Internal analytics should track funnel steps without content:

- Account setup completed.
- Workspace setup started/completed.
- Logo suggestion loaded/accepted/skipped.
- First site create started/completed.
- Template selected.
- First publish completed.
- First link copied.

Rules:

- Do not send site content or variable values.
- Use template ID, not template content.
- Use workspace/user IDs according to internal analytics policy.

## Public Page Composition And Visitor Experience

### Purpose

The public page is the product from the prospect's point of view.

It should feel polished, focused, fast, and intentional. It should not feel like an internal editor preview or a generic document dump.

Public page goals:

- Clear company/team identity.
- Clear recipient-relevant content.
- Clear next action.
- Fast mobile experience.
- Reliable tracking.
- No internal app chrome.
- No draft leakage.

### Public Page Structure

V1 public page structure:

```txt
PublicPage
  Metadata/head
  Page shell
  Header/identity area
  Ordered block body
  Optional footer
  Tracking bootstrap
```

Rules:

- Render from published snapshot only.
- Resolve variables before rendering visible content.
- Use the single canonical Lightsite public design.
- Do not render editor controls.
- Do not render internal comments, audit metadata, or access controls.
- Do not fetch authenticated app data.
- Do not require JavaScript for core content to appear.

### Public Header

The public header establishes identity and context.

Header content:

- Site avatar/logo.
- Site title.
- Optional subtitle.
- Optional sender/company context.
- Primary CTA if configured.

Rules:

- Header is always present in content schema.
- Header can render compactly if optional fields are empty.
- Header avatar uses site avatar first, then workspace/default copied avatar, then fallback.
- Header should not expose workspace settings not intentionally copied into the site.
- Header should remain stable across draft changes until republish.

### Header Avatar

Header avatar source priority:

1. Site-specific avatar asset.
2. Avatar copied from workspace at site creation.
3. Safe initials/brand fallback.

Rules:

- Workspace logo changes do not automatically mutate existing site avatars.
- Missing/deleted avatar asset renders fallback in editor and should be caught before publish if required by the design.
- Public avatar image should be optimized.
- Public avatar should include appropriate alt text or be decorative depending on exact rendering.

### Public Body

Body is a flat ordered list of blocks.

Rules:

- Block order comes from published snapshot.
- Empty editor-only placeholder blocks should not render publicly.
- Blocks with required missing data should be blocked before publish.
- Optional missing block fields should render gracefully.
- Unknown block types in current draft block publish.
- Unknown block types in old published snapshots should render safe fallback only if migration is unavailable.

### Public Footer

V1 footer should be minimal.

Footer may include:

- Lightsite attribution if required by plan.
- Privacy/tracking disclosure link if required.
- Workspace/company link if configured later.

Rules:

- Footer should not distract from the page CTA.
- Footer should not expose internal workspace/user data.
- Footer attribution should be plan/entitlement-controlled if added.

### Internal Preview vs Public Page

Editor preview and public rendering should be visually close but not identical in data source.

Preview modes:

- Draft preview: current draft content.
- Variant draft preview: current draft with selected variant values.
- Published preview/open link: published snapshot.

Rules:

- Preview UI must label draft vs published context.
- Draft preview may show internal validation hints outside the page canvas.
- Public open link never shows validation hints.
- Public open link never reads draft content.

### Visitor Interaction Principles

Public page interaction should be straightforward.

Rules:

- Links act like links.
- Buttons have clear labels.
- Accordions are accessible.
- Embeds are lazy-loaded.
- Media is optimized.
- Tracking is non-blocking.
- Failed tracking does not change visitor experience.
- External links should not trap the visitor.

### Public Page Failure Modes

Public failure behavior:

- Unknown route: neutral 404.
- Unpublished site: neutral 404.
- Archived site: neutral 404.
- Deleted variant: neutral 404.
- Missing optional media: fallback/empty render.
- Missing required media: should have been blocked at publish; if it still occurs, render safe fallback and log.
- Embed provider unavailable: show fallback link if available.
- Tracking unavailable: page still works.

## Public Navigation, Anchors, And Table Of Contents

### Purpose

Public pages may become long. Navigation should help prospects scan without adding section entities to the content model.

V1 should use headings and divider blocks, not separate section objects.

### Anchor Links

Headings can support anchor links.

Rules:

- Anchor IDs derive from stable block IDs, not heading text.
- Changing heading text does not break anchor links.
- Deleted heading removes that anchor.
- Anchor links should scroll to the correct block without header overlap.
- Anchor links should not expose draft-only block IDs.

### Table Of Contents

Table of contents is optional.

V1 decision:

- Do not enable a public table of contents by default.
- Keep content schema setting available or easy to add later.
- If enabled later, derive TOC from heading blocks in published snapshot.

Future TOC rules:

- Include heading blocks above configured levels.
- Exclude empty headings.
- Use block IDs for anchors.
- Keep mobile TOC compact.
- Track TOC link clicks as element clicks.

### Divider As Visual Section

Divider block provides visual separation.

Rules:

- Divider can be regular width or full content width.
- Divider is not a parent container.
- Divider does not create nested permissions.
- Divider does not create grouped drag behavior.
- Divider can be used with heading blocks to create section-like flow.

### Public Header Navigation

Do not build a complex public nav in v1.

Allowed v1 header actions:

- Primary CTA.
- Optional secondary link if content schema supports it later.

Not in v1:

- Multi-link nav.
- Dropdowns.
- Sticky marketing nav.
- User-configurable nav menus.

Rationale:

- One-pagers should stay focused.
- Blocks and CTAs provide enough navigation/action surface.
- Complex nav implies a larger site builder, not a lightweight sales one-pager.

### Scroll Behavior

Rules:

- Public page scroll depth tracking should use document/body height after media layout stabilizes where practical.
- Lazy media should not break scroll depth thresholds.
- Anchor scroll should respect reduced motion preferences.
- Sticky elements should not cover anchored headings.

## CTA, Link, And Button Behavior

### Purpose

CTAs are the primary conversion mechanism for Lightsite pages.

They must be easy to configure, safe to render, trackable, and reliable.

### CTA Types

V1 CTA forms:

- Header primary CTA.
- Button/link block.
- Calendar embed/button.
- Rich text link.

Future CTA forms:

- Form submit.
- File download.
- Multi-step action.
- CRM-connected action.

### CTA Fields

Common CTA fields:

```txt
label
url
style
openInNewTab
trackingLabel nullable
```

Rules:

- Label is required.
- URL is required for link CTAs.
- URL must be valid and safe.
- Style uses supported design variants, not arbitrary colors.
- Tracking label is optional; default to visible label snapshot.
- CTA element ID must be stable.

### URL Handling

Rules:

- Accept `https://` URLs by default.
- Accept `mailto:` only in explicitly supported fields.
- Reject unsafe protocols.
- Normalize URLs on save or publish validation.
- Preserve user-visible URL intent.
- Block publish for invalid required URLs.
- Optional invalid URLs should be omitted or surfaced before publish depending on field.

Variables in URLs:

- URL variables can be used only in URL-compatible fields.
- Resolved URL must pass validation.
- Missing URL variable falls back to default.
- Invalid resolved variant URL should block variant save or publish/open readiness depending on context.

### Link Tracking

Tracked link events should include:

- Workspace ID.
- Site ID.
- Published version ID.
- Variant ID if present.
- Session ID.
- Element ID.
- Block ID if applicable.
- Link type.
- Label snapshot.
- URL snapshot.
- Timestamp.

Rules:

- Track click before navigation using beacon/best-effort mechanism.
- Do not block navigation waiting for tracking.
- Do not store sensitive query params if URL snapshot policy later redacts them.
- External destination is not proof the visitor completed the action.

### Open Behavior

Default behavior:

- External links open in new tab when configured.
- Same-page anchors scroll in same page.
- `mailto:` opens mail client.
- Calendar embeds/buttons follow provider behavior.

Rules:

- External new-tab links use safe `rel` attributes.
- Button visual style must not change semantic link behavior.
- Disabled CTAs should not render publicly; publish should catch invalid required CTAs.

### CTA Accessibility

Rules:

- CTA labels must be descriptive.
- Icon-only CTAs are not allowed in public page content v1.
- Buttons that navigate should render as links with button styling.
- Buttons that perform actions should be real buttons.
- Focus states must be visible.
- Tap targets must be mobile-friendly.

### CTA Analytics UI

Analytics should show CTA activity clearly.

Suggested display:

- CTA label.
- Block/title context if available.
- Variant.
- Count.
- Last clicked time.
- Session detail.

Rules:

- Use label snapshot from click time for historical accuracy.
- If current label changed after republish, analytics should still make old clicks understandable.
- Do not merge different CTAs solely because labels match.

## Media, File Display, And Asset Library Behavior

### Purpose

Media makes pages feel real and useful, but it is also a source of performance, accessibility, and broken-publish risk.

### Media Types

V1 public media:

- Images.
- Logos.
- Avatars.
- OG images.
- Video embeds from allowlisted providers.
- Calendar embeds from allowlisted providers.

Not v1:

- Arbitrary file downloads.
- PDFs embedded inline.
- Audio blocks.
- User-uploaded SVG.
- Arbitrary HTML embeds.

### Image Rendering

Rules:

- Store width/height metadata.
- Reserve layout space to avoid layout shift.
- Use optimized image URLs.
- Lazy-load non-critical images.
- Do not lazy-load first meaningful hero/header image if it harms perceived load.
- Require alt text for meaningful images.
- Allow decorative images to have empty alt only when explicitly marked decorative.

### Logo Blocks

Logo blocks display a set of company/customer logos.

Rules:

- Each logo item has stable ID.
- Each logo has asset ID.
- Each logo has name/alt text.
- Missing logo asset blocks publish unless removed/replaced.
- Logo list should wrap responsively.
- Logo click-through is not v1 unless explicitly added.

### Video Embeds

Rules:

- Store provider and normalized embed URL.
- Render iframe only for allowlisted providers.
- Lazy-load video embed.
- Provide title for iframe.
- Provide fallback link.
- Block publish for unsupported provider.
- Track play only if provider event integration is reliable; v1 tracks embed click/interaction at most.

### Calendar Embeds

Rules:

- Store provider and normalized URL.
- Render provider embed when valid.
- Provide fallback link.
- Lazy-load embed.
- Track click/open.
- Do not claim booking completion without provider-backed signal.

### Asset Library

Do not build a full asset library UI in v1.

V1 asset access:

- Upload/select assets from the place they are used.
- Replace/remove assets from block/settings controls.
- Store assets in workspace scope for site/public usage.

Future asset library requirements:

- Workspace asset browser.
- Search/filter by type.
- Usage references.
- Delete safety.
- Replace asset.
- Asset metadata editing.
- Bulk cleanup.

Rules for future library:

- Deleting referenced asset is blocked or requires replacement.
- Usage count must include drafts, published versions, variants, templates, and workspace settings.
- Asset search should be server-backed.

### Asset Replacement

Replacing an asset in a block/settings field:

- Upload or select new asset.
- Update content reference to new asset ID.
- Old asset remains stored until cleanup determines it is unused.
- Replacement is a draft change and requires publish to affect public page.

Rules:

- Do not mutate the old asset object to point to a new file.
- Preserve version history renderability.
- Public pages keep using published asset reference until republish.

### Media Publish Readiness

Publish blockers:

- Required image missing.
- Referenced asset missing/deleted.
- Unsupported file type.
- Image processing failed when optimized URL is required.
- Required alt text missing for meaningful image.
- Unsupported embed provider.
- Invalid embed URL.

Warnings:

- Large image could slow page.
- Poor OG image aspect ratio.
- Decorative image missing explicit decorative flag.
- Video/calendar fallback link missing if embed provider is fragile.

### Media Privacy

Rules:

- Public page media should be treated as public once published.
- Do not upload sensitive files to public-site assets.
- Asset URLs should avoid exposing storage internals where practical.
- Private/auth-only assets are future scope and require separate serving model.

## SEO, Metadata, And Link Previews

### Purpose

Lightsite pages are primarily shareable sales pages, not SEO landing pages.

V1 should make link previews polished while defaulting to privacy-safe indexing behavior.

### Metadata Fields

Site settings should support:

```txt
metaTitle
metaDescription
ogImageAssetId
allowSearchIndexing
```

V1 default:

- `allowSearchIndexing = false`
- No customer-facing indexing toggle in V1 unless the feature is intentionally enabled behind a scoped product decision.

Rules:

- Meta title falls back to site title.
- Meta description falls back to subtitle/summary when available.
- OG image falls back to Lightsite default OG image.
- Variant links use same metadata as site unless variant-specific metadata is added later.
- Metadata renders from published snapshot.

### Robots And Indexing

V1 rules:

- Public pages default to `noindex,nofollow`.
- If search indexing is enabled in a later scoped release, workspace/site must intentionally opt in.
- Archived/unpublished/404 pages are noindex.
- Preview/draft routes are noindex.

Rationale:

- Sales one-pagers may contain prospect-specific context.
- Variants may include recipient/company names.
- Default privacy is safer.

### Link Preview Behavior

Link preview clients may request:

- HTML metadata.
- OG image.
- Favicon.
- Images/assets.

Rules:

- Preview requests should not count as human visits.
- Preview requests can create `link_preview_loaded` events.
- Preview events are bot/preview classified.
- Deduplicate repeated preview requests.
- OG image route should be cacheable.
- OG image route should not require authenticated access for published pages.

### OG Image Configuration

Rules:

- Custom OG image must be a valid image asset.
- Recommended aspect ratio: 1200 x 630.
- Warn on poor aspect ratio.
- If no custom OG image, use Lightsite default.
- Do not generate dynamic OG images per request in v1.

Future:

- Generate static OG image per published version.
- Store/cached generated image.
- Optional variant-specific OG images.

### Metadata Privacy

Rules:

- Do not include recipient email in metadata.
- Do not include internal notes in metadata.
- Do not include draft content in metadata.
- Variant-specific metadata, if added later, must be reviewed for privacy.

### Metadata Validation

Publish validation should warn:

- Missing meta description.
- Poor OG image ratio.
- Very long title/description.

Publish validation should block:

- Invalid OG asset reference.
- Missing required fallback metadata if renderer cannot produce safe defaults.

### Favicon And Branding

V1:

- Use Lightsite favicon for public pages.
- Site/workspace custom favicon is not v1.

Future custom favicon:

- Workspace/site setting.
- Valid image asset.
- Size/type validation.
- Cache invalidation on publish.

## Editor Field Registry And Block Capabilities

### Purpose

The editor should not hardcode field behavior in scattered components.

Each block type and field should declare its capabilities in one typed registry so the editor, inspector, variable menu, validation, public renderer, and analytics agree.

Goals:

- Predictable variable support.
- Consistent validation.
- Reusable inspector controls.
- Safer block additions.
- Cleaner publish readiness.
- Easier testing.

### Field Registry Concept

Each editable field should define:

```txt
fieldKey
fieldKind
label
required
supportsVariables
allowedVariableTypes
validationRules
inspectorControl
publicRenderBehavior
trackingBehavior
```

Example:

```txt
button.label
  fieldKind: text
  required: true
  supportsVariables: true
  allowedVariableTypes: [text]

button.url
  fieldKind: url
  required: true
  supportsVariables: true
  allowedVariableTypes: [url, text]
```

Rules:

- Field definitions are typed.
- Field definitions live near block definitions, not inside random UI components.
- Inspector controls are derived from field definitions where practical.
- Publish validation uses field definitions.
- Variable insertion uses field definitions.
- Public rendering assumes content has passed field validation.

### Field Kinds

V1 field kinds:

- Plain text.
- Rich text.
- URL.
- Asset/image.
- Boolean.
- Select enum.
- Number.
- Reorderable item list.
- Provider embed URL.

Rules:

- Field kind determines editor control.
- Field kind determines variable compatibility.
- Field kind determines validation shape.
- Field kind does not determine visual layout by itself.

### Variable Compatibility Matrix

V1 variable types:

- Text.
- Image.
- URL.

Compatibility:

| Field kind | Text variable | Image variable | URL variable |
| --- | --- | --- | --- |
| Plain text | Yes | No | No |
| Rich text | Yes | No | No |
| URL | Yes, if result validates as URL | No | Yes |
| Asset/image | No | Yes | No |
| Boolean | No | No | No |
| Select enum | No | No | No |
| Number | No | No | No |
| Provider embed URL | No | No | Yes, if provider validates |

Rules:

- Do not allow every variable type everywhere.
- Variable insertion menu should only show compatible variables for current field.
- Creating a new variable from a field should default to a compatible type.
- If a field changes capability later, migrations must preserve existing content or block incompatible usage clearly.

### Block Capability Registry

Each block type should define:

```txt
blockType
displayName
description
icon
category
defaultData
fields
canDuplicate
canDelete
canReorder
canTrackClicks
publicRenderer
editorRenderer
validation
```

Rules:

- New block types require registry entry.
- Unsupported block types should not silently render as empty.
- Block defaults must produce editable, non-crashing blocks.
- Blocks inserted into draft get stable IDs immediately.
- Public renderer should be separate from editor renderer.

### Inspector Controls

Inspector controls should be composed from field definitions and block-specific sections.

Rules:

- Simple fields use shared controls.
- Complex fields can use custom composed controls.
- Controls dispatch editor commands.
- Controls do not mutate document state directly.
- Controls show field-level validation when available.
- Controls should preserve unsaved input during transient validation errors.

Shared controls:

- Text input.
- Textarea.
- Rich text mini toolbar where appropriate.
- URL input.
- Asset picker/uploader.
- Select.
- Toggle.
- Number input.
- Reorderable list editor.

### Block Defaults

Block defaults should be useful and valid for editing.

Rules:

- Defaults should not include fake customer-specific data.
- Defaults should be safe if accidentally published, but publish validation should still catch incomplete required fields.
- Defaults should not create assets.
- Defaults should not create variables unless the insert action explicitly creates one.
- Defaults should include stable nested IDs for repeated items.

Examples:

- Button block default label: "Learn more"; URL empty, publish-blocking until filled.
- Heading block default text: empty editable heading.
- Divider block default width: regular.
- Accordion block default: one item with stable ID and empty title/body.

### Field-Level Dirty State

The editor may need to know which field changed.

Rules:

- Document dirty state remains the main saved/unsaved signal.
- Field-level dirty state is UI-local.
- Field-level dirty state should not be persisted in site content.
- Field validation can be local while editing and authoritative on save/publish.

### Nested Item Identity

Blocks with repeated nested items need stable item IDs.

Examples:

- Accordion items.
- Table rows/cells if individually tracked later.
- Logo items.
- Testimonial items if repeated later.

Rules:

- Nested item IDs are generated on insert.
- Reordering nested items preserves IDs.
- Deleting nested item removes it from current draft but history remains in versions.
- Tracking nested item clicks uses nested item ID where useful.

### Block Addition Process

Adding a new block requires:

1. Content schema type.
2. Block registry entry.
3. Editor renderer.
4. Public renderer.
5. Inspector controls.
6. Default data.
7. Publish validation.
8. Migration behavior if schema changes.
9. Tests.
10. Design system/public page examples if visible.

Rules:

- Do not add a block only to editor without public renderer.
- Do not add a block only to public renderer without editor controls.
- Do not add a block without publish validation.

## Schema Limits, Quotas, And Guardrails

### Purpose

Limits protect performance, cost, usability, and public page quality.

Limits should be explicit and centralized, not scattered through UI conditions.

### Content Limits

Initial v1 limits:

```txt
maxBlocksPerSite: 100
maxVariablesPerSite: 100
maxVariantsPerSite: 250
maxAccordionItemsPerBlock: 20
maxLogoItemsPerBlock: 30
maxTableRows: 25
maxTableColumns: 8
maxRichTextDocumentBytesPerField: 50000
maxPlainTextChars: 5000
maxHeadingChars: 160
maxButtonLabelChars: 80
maxUrlChars: 2048
```

Rules:

- Limits should be enforced server-side.
- Frontend should surface limits before submit where useful.
- Publish validation should catch over-limit content.
- Limits should return typed validation errors.
- Limit changes should be treated as product changes and tested.

### Asset Limits

Initial v1 asset limits:

```txt
maxImageUploadBytes: 10MB
maxOgImageUploadBytes: 5MB
maxWorkspaceLogoUploadBytes: 2MB
allowedImageTypes: webp, png, jpeg
```

Rules:

- File size limit is enforced before direct upload where possible and again during finalize.
- MIME type and file signature are validated.
- Image dimensions are read and stored.
- Oversized images should show a clear error.
- SVG uploads are not allowed for public rendering in v1.

### Tracking Limits

Initial v1 tracking guardrails:

```txt
maxHeartbeatIntervalSeconds: 15
maxSessionDurationHours: 12
scrollDepthThresholds: 25,50,75,90,100
maxClickEventsPerSessionSoft: 500
trackingContextTtlHours: 24
```

Rules:

- Tracking context TTL should balance public page reliability with abuse protection.
- Server may drop excessive events from a session.
- Heartbeats are bounded.
- Duplicate scroll threshold events are deduped per session/site/version/variant.

### Slug Limits

Slug rules:

```txt
minSlugLength: 2
maxSlugLength: 64
allowed: lowercase letters, numbers, hyphen
must not start/end with hyphen
no consecutive hyphens
reserved slugs blocked
```

Rules:

- Workspace slugs are globally unique.
- Site slugs are unique within workspace.
- Variant slugs are unique within site.
- Slug validation is shared between frontend and backend, backend authoritative.

### Rate Limits

Rate limits should protect:

- Signup.
- Login attempts.
- Password reset.
- Verification email resend.
- Workspace slug availability checks.
- Site slug availability checks.
- Invite creation/resend.
- Asset uploads.
- Tracking ingestion.
- Public route abuse.

Rules:

- Rate limit keys should avoid leaking personal data.
- Rate-limit responses use `429` and stable error code.
- User-facing copy should say when to try again if known.
- Internal/admin bypass should be rare and audited if used.

### Plan Quotas vs Technical Limits

Plan quotas and technical limits are different.

Technical limits:

- Protect system correctness/performance.
- Apply to all plans unless intentionally raised.

Plan quotas:

- Product/billing entitlements.
- Can vary by plan.

Rules:

- Do not conflate technical validation errors with plan-limit errors.
- Technical over-limit: `422` validation error.
- Plan quota reached: `PLAN_LIMIT_REACHED` or entitlement error.
- UI should explain the difference.

### Limit Configuration

Rules:

- Hard technical limits live in shared server config/module.
- Frontend imports/generated constants can mirror user-facing limits.
- Limits used in database constraints should be documented.
- Tests should assert important limits.
- Do not store every limit in environment variables; most are product constants.

## Publish Validation Registry

### Purpose

Publishing should be boringly reliable.

Publish validation is the final gate between editable draft content and public prospect-facing content.

### Validation Layers

Validation layers:

1. Field-level schema validation.
2. Block-level validation.
3. Cross-document validation.
4. Asset validation.
5. Public rendering validation.
6. Metadata validation.
7. Permission/state validation.

Rules:

- Editor save can allow incomplete drafts.
- Publish cannot allow broken public pages.
- Validation returns actionable errors linked to block/field where possible.
- Warnings do not block publish.
- Blockers prevent publish.

### Validation Result Shape

Validation result:

```txt
{
  blockers: [
    {
      code,
      message,
      path,
      blockId,
      fieldKey,
      severity: "blocker"
    }
  ],
  warnings: [
    {
      code,
      message,
      path,
      blockId,
      fieldKey,
      severity: "warning"
    }
  ]
}
```

Rules:

- `path` is stable and maps to editor UI.
- `blockId` exists for block-specific errors.
- `fieldKey` exists for field-specific errors.
- Validation codes are stable.
- UI can focus the block/field from validation result.

### Blockers

Publish blockers:

- Invalid content schema.
- Unsupported block type.
- Missing required header title.
- Missing required block field.
- Broken variable reference.
- Variable type incompatible with field.
- Invalid resolved URL.
- Missing required asset.
- Unsupported embed provider.
- Missing meaningful image alt text when required by policy.
- Site archived.
- User lacks publish permission.
- Workspace/user email verification missing.
- Plan/billing state blocks publish.

### Warnings

Publish warnings:

- Missing meta description.
- No custom OG image.
- Poor OG image aspect ratio.
- Large image.
- Empty optional block.
- Very long text that may look poor on mobile.
- No CTA configured.
- No variants created.

Rules:

- Warnings should be specific and actionable.
- User can publish with warnings.
- Warnings should not become noisy nagging.

### Variant Publish Readiness

Variants do not have their own publish state, but they can become broken if variables or URLs change.

Rules:

- Publishing validates base defaults.
- Publishing should also validate active variant overrides where feasible.
- Invalid variant override should be surfaced before publish.
- A variant with invalid URL/image override should be marked needs attention.
- Public variant route should fail safely if a variant override becomes invalid unexpectedly.

### Validation Timing

Run validation:

- On publish dialog open.
- On publish submit.
- After relevant editor changes with debounce if publish dialog is open.
- In tests/fixtures.

Rules:

- Submit-time backend validation is authoritative.
- Client-side validation is for speed and guidance.
- Validation should be deterministic for same draft/version/assets.

### Publish Dialog UX

Publish dialog should show:

- Public URL.
- Publish/republish state.
- Last published timestamp.
- Blockers.
- Warnings.
- Variant readiness summary.
- Primary publish action disabled until blockers are resolved.

Rules:

- Clicking a blocker focuses the block/field.
- Warnings are visually distinct from blockers.
- Dialog should not hide exact issue locations.
- If validation becomes stale, show validating state.

### Validation Tests

Tests should cover:

- Empty required title.
- Broken variable reference.
- Invalid URL.
- Unsupported embed.
- Missing image asset.
- Missing image alt text.
- Unknown block.
- Variant override invalid URL.
- Archived site publish attempt.
- Permission denied.
- Plan/billing blocked.

## Implementation Sequence And Milestones

### Purpose

The spec is large. Implementation should proceed in deliberate slices that preserve architecture without trying to ship every future capability at once.

Each milestone should leave the app in a coherent state.

### Milestone 0: Foundation

Scope:

- Monorepo/project structure.
- Environment config validation.
- Database setup/migrations.
- BetterAuth wiring.
- App shell.
- Design tokens/shadcn primitives.
- Error envelope.
- Request context.
- Permission helper skeleton.

Done when:

- User can run app locally.
- API health works.
- Auth/session shape is clear.
- App shell loads with mocked or real current user/workspace.
- Design system page renders base primitives.

### Milestone 1: Workspace And Auth Onboarding

Scope:

- Work email signup/login.
- User account setup.
- Workspace setup.
- Slug availability.
- Website normalization.
- logo.dev preview and accept-to-asset flow.
- Workspace switcher.

Done when:

- New user can create workspace.
- Invited user path is structurally supported or intentionally gated to next milestone.
- Workspace logo becomes default for new sites.
- Invalid emails/slugs/websites fail cleanly.

### Milestone 2: Sites CRUD And Templates

Scope:

- Sites list.
- Create site from template.
- Site slug uniqueness.
- Archive/restore.
- Duplicate.
- Plan limit enforcement hooks.
- Empty states.

Done when:

- Workspace can manage draft sites.
- Sites have draft content.
- Templates create valid draft content.
- Admin/user permissions are enforced.

### Milestone 3: Editor MVP

Scope:

- Editor shell.
- Flat block list.
- Core blocks: heading, text, button/link, image, divider.
- Inspector controls.
- Autosave draft.
- Local undo/redo.
- Variable creation/insertion.
- Publish validation preview.

Done when:

- User can build a simple one-pager.
- Draft saves reliably.
- Variables render in draft preview.
- Broken content is surfaced.

### Milestone 4: Publishing And Public Rendering

Scope:

- Publish transaction.
- Site versions.
- Public route resolution.
- Public renderer.
- Public metadata/OG defaults.
- Public 404 behavior.
- Public caching basics.

Done when:

- Published public link works.
- Draft changes do not leak.
- Unpublish/archive returns 404.
- Published snapshot remains immutable.

### Milestone 5: Variants And Sharing

Scope:

- Variant list/create/edit/delete.
- Variant variable overrides.
- Variant public route.
- Share modal.
- Copy default/variant links.
- Variant preview.

Done when:

- User can create a personalized link.
- Variant renders published snapshot with overrides.
- Deleted variant returns 404.
- Share states are clear for draft/published/archived sites.

### Milestone 6: Tracking

Scope:

- Public tracking context.
- Site view.
- Heartbeat/time spent.
- Scroll depth.
- Link/button clicks.
- Preview bot classification.
- Tracking ingestion.
- Tracking page feed and summary basics.

Done when:

- Public views and clicks appear in tracking.
- Preview bots are separated.
- Tracking failure does not affect public page.
- Tracking feed is paginated/filterable enough for v1.

### Milestone 7: Team Access

Scope:

- Invite members.
- Accept/revoke/resend invite.
- Admin/user roles.
- Site access modal.
- Entire-team access.
- Specific member access.
- Last-admin protection.

Done when:

- Admin can invite teammates.
- Members can collaborate according to role.
- Access changes are enforced backend-side.
- Removed users lose access.

### Milestone 8: Collaboration And Version History

Scope:

- Active editor presence.
- Multi-user content sync.
- Debounced persistence.
- Version history UI.
- Rollback.
- Conflict handling.

Done when:

- Two users can edit without overwriting each other in normal cases.
- Rollback restores draft, not public page.
- Presence is helpful and low-cost.
- Realtime disconnects degrade safely.

### Milestone 9: Production Hardening

Scope:

- Email provider.
- Job runner.
- Asset cleanup basics.
- Audit log.
- Error monitoring.
- CI/E2E smoke.
- Security headers/CSP.
- Rate limits.
- Backup verification.

Done when:

- App can be safely used by real teams.
- Public pages are fast and safe.
- Critical flows have tests.
- Operational failures are observable.

### Sequencing Rules

Rules:

- Do not build collaboration before single-user editor/publish is solid.
- Do not build custom domains before default public links are stable.
- Do not build CRM sync before variants/tracking semantics are stable.
- Do not build full asset library before asset usage/deletion rules are proven.
- Do not build comments/approval before core team access and publish workflow are stable.
- Do not build paid plan enforcement before billing state and entitlement helpers exist.

### Cut Scope Aggressively, Not Architecture

If schedule pressure appears:

- Cut optional blocks.
- Cut user avatar upload.
- Cut custom domains.
- Cut comments/approval.
- Cut full activity feed.
- Cut asset library UI.
- Cut custom favicon.

Do not cut:

- Backend permission enforcement.
- Draft vs published separation.
- Work email validation.
- Publish validation.
- Immutable published versions.
- Public route safety.
- Basic tests for auth/permissions/publish.

## Job Queue, Scheduled Work, And Async Processing

### Purpose

Lightsite needs asynchronous work, but async work should stay boring, observable, idempotent, and cheap.

Jobs support:

- Transactional email.
- Invite cleanup.
- Asset processing and cleanup.
- Tracking aggregation.
- Tracking retention.
- Version retention pruning.
- Export generation.
- Billing webhook follow-up.
- Public cache invalidation/warmup.
- Migration/backfill tasks.

Jobs must not become hidden product state machines with unclear ownership.

### Job Principles

Rules:

- Request handlers enqueue jobs; they do not perform slow work inline.
- Jobs reference canonical database IDs, not large copied payloads.
- Jobs are idempotent.
- Jobs have bounded retries.
- Jobs record attempts and final status.
- Jobs distinguish transient failure from permanent failure.
- Jobs can be safely retried after process crash.
- Jobs never assume they are the only worker unless a lock guarantees it.

### Job Table

V1 can use a Postgres-backed job table before adding a dedicated queue.

Shape:

```txt
jobs
  id uuid primary key
  type text not null
  status enum queued|running|succeeded|failed|dead|canceled
  priority integer not null default 0
  run_at timestamptz not null
  locked_at timestamptz nullable
  locked_by text nullable
  attempts integer not null default 0
  max_attempts integer not null
  idempotency_key text nullable unique
  payload jsonb not null
  last_error_code text nullable
  last_error_message text nullable
  created_at timestamptz not null
  updated_at timestamptz not null
  completed_at timestamptz nullable
```

Rules:

- Payloads contain IDs and small parameters only.
- Do not store secrets in job payloads.
- Do not store full email bodies in job payloads.
- Do not store full site content in job payloads unless the job is explicitly a versioned export generation job and access is controlled.
- Job type names are stable.

### Job Claiming

Workers should claim jobs safely.

Rules:

- Claim due queued jobs ordered by priority/run time.
- Use row-level locking or equivalent mechanism.
- Set `locked_at` and `locked_by`.
- Handle worker crash by expiring stale locks.
- A job that exceeds lock timeout can be retried by another worker.
- Job handlers must still be idempotent because locks are not a substitute for correctness.

### Retry Policy

Retry policy should be explicit per job type.

Transient failures:

- Provider timeout.
- Network issue.
- Transient database contention.
- Rate-limited provider.
- Transient object storage failure.

Permanent failures:

- Missing required source record.
- Revoked invite.
- Invalid email address rejected permanently.
- Unsupported asset type.
- Export requester lost permission before generation.

Rules:

- Transient failures retry with exponential backoff and jitter.
- Permanent failures mark job failed/dead without repeated retries.
- Jobs should record safe error codes.
- Jobs should not retry forever.
- Operators should be able to inspect dead jobs.

### Idempotency

Every job that changes state needs idempotency.

Examples:

```txt
workspace-invite-email:{inviteId}:created
tracking-summary:{workspaceId}:{date}
asset-cleanup:{assetId}
export-generate:{exportId}
billing-webhook:{provider}:{providerEventId}
```

Rules:

- Duplicate enqueue with same idempotency key should return existing queued/running/succeeded job where appropriate.
- Job handler should check target state before acting.
- Email jobs check whether email still needs sending.
- Cleanup jobs check references immediately before deletion.
- Summary jobs can recompute and upsert.

### Job Types

Core v1 job types:

- `email.workspace_invite`.
- `email.invite_accepted`.
- `asset.process_upload`.
- `asset.cleanup_orphaned`.
- `tracking.aggregate_daily`.
- `tracking.retention_prune`.
- `invite.expire_pending`.
- `export.generate_tracking_csv`.
- `cache.invalidate_public_page`.

Future job types:

- `billing.reconcile_subscription`.
- `workspace.export`.
- `site.export`.
- `content.backfill_schema`.
- `domain.verify_custom_domain`.
- `moderation.scan_public_page`.

### Email Jobs

Rules:

- Enqueue after transaction commits.
- Load invite/member/workspace at execution time.
- Skip if invite revoked/accepted/expired.
- Record delivery attempt.
- Support resend by creating a new idempotency key or explicit resend event.
- Do not block invite creation on provider send.

### Tracking Aggregation Jobs

Rules:

- Aggregate by workspace/site/version/variant/date dimensions.
- Recompute recent windows to handle late events.
- Separate human, bot, and preview classifications.
- Upsert summaries.
- Do not delete raw events until summaries are safe.
- Job should be chunked by workspace/date when volume grows.

### Export Jobs

Rules:

- Export jobs require permission at request time and again at generation time.
- Generated export files are stored in private storage.
- Download URLs are short-lived.
- Exports expire.
- Export generation is audited.
- Export download is audited where practical.
- Exports should not be emailed as attachments.

### Cache Invalidation Jobs

Rules:

- Cache invalidation is triggered after publish/republish/unpublish/archive/variant change.
- Invalidation job references site/version/variant IDs.
- Cache invalidation failure should be observable.
- Public route correctness must not depend solely on cache invalidation; origin should still enforce current publish state.
- Repeated invalidation jobs for same route can be coalesced.

### Worker Deployment

V1 worker options:

- Same API process with scheduled runner for local/dev.
- Separate worker process for production when platform supports it.
- Managed queue later if volume requires.

Rules:

- Worker startup validates environment.
- Worker logs job start/success/failure.
- Worker has graceful shutdown.
- Worker should stop claiming new jobs on shutdown and finish or release current jobs.
- Production should run at least one worker if async features are enabled.

### Job Observability

Track:

- Queue depth by type.
- Oldest queued job age.
- Running job count.
- Success/failure count by type.
- Dead job count.
- Retry count.
- Job duration.

Alerts:

- Email jobs dead above threshold.
- Tracking aggregation lag above threshold.
- Export jobs stuck.
- Asset processing failures spike.
- Billing webhook follow-up dead jobs.

### Job Testing

Tests should cover:

- Idempotent duplicate enqueue.
- Transient retry.
- Permanent failure.
- Stale lock recovery.
- Email skipped after invite revoked.
- Asset cleanup blocked when asset referenced.
- Tracking summary recomputation.
- Export permission lost before generation.

## Retention, Cleanup, And Data Lifecycle

### Purpose

Retention and cleanup protect cost, privacy, performance, and restoreability.

Lightsite should keep what users need, remove what is unsafe or wasteful, and avoid deleting records that preserve business history.

### Lifecycle Categories

Data categories:

- Core workspace records.
- Site draft content.
- Published versions.
- Autosave/checkpoint versions.
- Variants.
- Assets.
- Raw tracking events.
- Tracking summaries.
- Invites/tokens.
- Jobs.
- Exports.
- Audit logs.
- Operational logs.

Each category needs a retention policy.

### Retention Policy Table

Initial v1 policy:

| Data | Retention |
| --- | --- |
| Workspace records | Retained while workspace active |
| Site draft content | Retained while site exists |
| Published versions | Retained indefinitely in v1 |
| Rollback/manual versions | Retained indefinitely in v1 |
| Autosave versions | Retained until pruning policy implemented |
| Variants | Soft-deleted; retained for analytics attribution |
| Raw tracking events | Retained until plan policy is implemented; design for pruning |
| Tracking summaries | Retained longer than raw events |
| Invites | Pending until accepted/revoked/expired; expired tokens pruned |
| Jobs | Succeeded jobs pruned after operational window |
| Exports | Expire and delete generated file |
| Audit logs | Retained long-term |
| Temporary uploads | Pruned quickly if unattached |

Rules:

- Retention policy is centralized.
- Retention jobs are idempotent.
- Retention jobs are auditable for destructive actions.
- Retention should never break public rendering or version restore.

### Asset Cleanup

Asset cleanup is reference-sensitive.

References to check:

- Workspace logo.
- Site avatar/default avatar.
- Current draft content.
- Published versions.
- Version history that can be restored.
- Variant overrides.
- Templates.
- OG image settings.
- Pending export files if relevant.

Rules:

- Do not delete storage object while any live/restorable reference exists.
- Mark asset as cleanup candidate before hard deletion.
- Re-check references at deletion time.
- Keep deleted asset record if needed for audit/debug.
- Temporary unattached uploads can be pruned after a short window.

### Invite And Token Cleanup

Rules:

- Invite tokens are stored hashed.
- Expired invite tokens cannot be used.
- Expired pending invites can remain visible as expired for a period.
- Token hashes can be pruned or rotated after expiry.
- Revoked invites remain for audit/history.
- Accepted invites remain linked to accepted membership where useful.

### Tracking Retention

Tracking retention has privacy and cost implications.

Rules:

- Raw events are append-only until pruned.
- Summaries survive raw pruning.
- Pruning should process by date/workspace chunks.
- Pruning should not remove events newer than policy.
- Pruning should not remove events needed for active export job.
- Raw event deletion should be logged as system action with counts, not individual event payloads.

Future plan-based policy:

- Basic: shorter raw retention.
- Pro: longer raw retention.
- Aggregates: retained longer across plans.

### Version Retention

Rules:

- Never prune current published version.
- Never prune publish/rollback/manual versions in v1.
- Autosave/checkpoint pruning can collapse dense history later.
- Pruning should preserve meaningful restore points.
- Pruning must not break asset cleanup reference checks.

### Export Retention

Rules:

- Export records persist after file expiry for audit.
- Generated export files expire.
- Expired export download links stop working.
- Regenerating export requires new permission check.
- Export files are stored outside public asset namespace.

### Job Retention

Rules:

- Succeeded low-risk jobs can be pruned after operational window.
- Failed/dead jobs retained longer for debugging.
- Job payloads must be safe enough to retain.
- Do not retain huge payloads in job table.

### Legal/Privacy Deletion

V1 should be designed for future deletion/redaction even if self-serve deletion is deferred.

Potential redaction targets:

- User profile display name/avatar.
- Recipient metadata on variants.
- Raw tracking IP/user-agent metadata if stored.
- Export files.

Rules:

- Redaction should preserve relational integrity.
- Redaction should preserve audit event existence while removing personal display values where required.
- Redaction actions are audited.
- Do not cascade-delete workspace history casually.

### Cleanup Testing

Tests should cover:

- Temporary upload pruned.
- Referenced asset not pruned.
- Published-version asset not pruned.
- Expired invite cannot be accepted.
- Tracking summary survives raw event prune.
- Export file expires.
- Succeeded jobs pruned.
- Dead jobs retained.

## Audit Ledger And Security Event Model

### Purpose

Audit records should explain important actions without exposing sensitive content.

The audit ledger is not an activity feed, analytics store, or debug log. It is a durable record of security/business actions.

### Audit Event Shape

Shape:

```txt
audit_events
  id
  workspace_id nullable
  actor_user_id nullable
  actor_kind enum user|system|internal_admin
  action text
  target_type text
  target_id text
  metadata jsonb
  request_id nullable
  ip_hash nullable
  user_agent_hash nullable
  created_at
```

Rules:

- Append-only.
- No full site content.
- No secrets/tokens.
- No raw invite links.
- No provider secrets.
- Metadata contains safe IDs, counts, small before/after values, and reason codes.

### Required Audit Events

Required v1 audit events:

- Workspace created.
- Workspace settings changed.
- Workspace logo changed.
- Workspace website changed.
- Workspace slug changed.
- Member invited.
- Invite revoked.
- Invite accepted.
- Invite resent.
- Member role changed.
- Member removed.
- Site created.
- Site duplicated.
- Site archived/restored.
- Site published/republished/unpublished.
- Site access changed.
- Version restored.
- Variant created/updated/deleted.
- Asset uploaded/finalized/deleted.
- Export generated.
- Internal admin moderation action.

Future required events:

- Billing plan/status changed.
- Custom domain added/verified/removed.
- Workspace suspended/restored.
- Support content access granted.
- Data redaction/deletion.

### Actor Kinds

Actor kinds:

- `user`: normal authenticated user.
- `system`: automated job/system action.
- `internal_admin`: Lightsite operator/support action.

Rules:

- User actions include user ID.
- System actions include job ID in metadata where useful.
- Internal admin actions include internal actor user ID and reason.
- If actor user is later anonymized, audit event remains.

### Audit Metadata

Allowed metadata examples:

```txt
{
  "siteId": "...",
  "versionId": "...",
  "fromRole": "user",
  "toRole": "admin",
  "reasonCode": "abuse",
  "count": 123
}
```

Rules:

- Keep metadata small.
- Use stable keys.
- Avoid freeform sensitive text.
- Do not store rich text.
- Do not store recipient email unless required and reviewed; prefer variant ID.

### Audit Visibility

V1:

- Audit ledger is internal/backend only.
- Surface local history in version history, tracking, and team invite/member states.

Future workspace audit UI:

- Admin-only.
- Filter by action/actor/date.
- Show safe metadata only.
- No raw internal support notes.

### Audit Integrity

Rules:

- Audit event should be inserted in same transaction as business action where practical.
- If audit insert fails for security-critical action, fail the action.
- If audit insert fails for low-risk system cleanup, log and retry where appropriate.
- Audit records are not edited; corrections are appended.

### Security Events

Security events may overlap with audit events but can also feed monitoring.

Examples:

- Repeated failed login.
- Rate limit exceeded.
- Invalid webhook signature.
- Invalid tracking context spike.
- Cross-workspace access denied.
- Internal admin action.

Rules:

- Security monitoring should avoid high-cardinality labels.
- Security events should not expose secrets.
- Abuse patterns should be observable.

## Moderation, Abuse, And Support Operations

### Purpose

Public page hosting creates abuse risk. Lightsite needs a minimal operational path for takedowns and support without building a huge moderation system in v1.

### Abuse Risks

Risks:

- Phishing pages.
- Malware links.
- Impersonation.
- Spammy public hosting.
- Sensitive data accidentally published.
- Abusive uploads.
- Excessive tracking/event abuse.

V1 risk reducers:

- Work email signup.
- Email verification before publishing.
- Plan/site limits.
- Upload type/size limits.
- Public route rate limits.
- Internal unpublish/suspend tools.
- Abuse contact path.

### Internal Takedown Actions

Internal admins may need to:

- Unpublish a site.
- Suspend publishing for a workspace.
- Disable a public custom domain later.
- Mark workspace under review.
- Contact workspace admins.

Rules:

- Takedown actions require internal admin permission.
- Takedown actions require reason code.
- Takedown actions are audited.
- Takedown should be reversible where practical.
- Takedown should fail closed for public routes.

Reason codes:

- `phishing`.
- `malware`.
- `spam`.
- `impersonation`.
- `policy_violation`.
- `billing`.
- `security_review`.
- `other`.

### Support Access

V1 support should prefer metadata and customer-provided context.

Allowed:

- View workspace metadata.
- View member metadata.
- View site metadata.
- View public link status.
- View recent operational errors.
- Trigger safe resend/retry actions.

Not allowed by default:

- Edit customer content.
- Read draft content.
- Export customer data.
- Impersonate users.
- Change billing manually.

Rules:

- Any future support content access must be time-bound, reasoned, and audited.
- Customer-visible support access status can be added later.
- Support should not use direct database edits for normal actions.

### Abuse Reports

V1 can start with a simple abuse contact email or form.

Future abuse report record:

```txt
abuse_reports
  id
  public_url
  workspace_id nullable
  site_id nullable
  reporter_email nullable
  reason
  description
  status
  created_at
  reviewed_at nullable
```

Rules:

- Abuse report should not require reporter account.
- Reports should avoid exposing whether private/unpublished resources exist.
- Internal review links resolve resources safely.
- Actions taken from report are audited.

### Moderation State

Future moderation fields:

```txt
workspaces.moderation_status
sites.moderation_status
sites.unpublished_by_internal_admin_at
sites.internal_unpublish_reason
```

Rules:

- Moderation state is separate from normal user archive/unpublish.
- Internal unpublish should explain to workspace admins where appropriate.
- Re-publishing after internal takedown requires internal/admin policy.

### Support Runbooks

Runbooks should exist for:

- User cannot access workspace.
- Last admin inaccessible.
- Public site down.
- Publish failed.
- Tracking missing.
- Invite not received.
- Asset upload failed.
- Suspected phishing/abuse page.
- Billing/webhook mismatch later.

Runbooks should include:

- What support can inspect.
- What support must not inspect.
- Safe remediation.
- Audit requirements.
- Escalation path.

## API Versioning, Contracts, And Compatibility

Lightsite should treat its internal API contracts as product infrastructure, not incidental route code. The first version can move quickly because the product is young, but the API should still have explicit compatibility rules so frontend, public rendering, tracking, background jobs, and future integrations do not drift apart.

The primary goal is not to over-build a public developer platform early. The goal is to make every app boundary typed, validated, observable, and evolvable from day one.

### API Surfaces

Lightsite has several distinct API surfaces:

- Authenticated app API for the dashboard, editor, settings, team, tracking analytics, and billing.
- Public site read API for resolving and rendering published sites.
- Tracking ingest API for anonymous visitor events.
- Asset API for uploads, transforms, signed access, and public asset reads.
- Realtime sync API for editor collaboration.
- Background job/internal API used by workers and scheduled jobs.
- Webhook ingress API for future billing, email, CRM, analytics, or enrichment providers.
- Future external API for customers or integrations, only if the product needs it.

Rules:

- Each surface should have an explicit owner module.
- Do not share route handlers between authenticated app routes and public routes.
- Public rendering routes should never depend on authenticated app session state.
- Tracking ingest should stay intentionally small, fast, and isolated.
- Webhooks should have separate signature verification and idempotency handling per provider.
- Internal worker APIs should not be reachable from the public internet unless protected by platform-level private networking or strong service authentication.

### Route Versioning

The initial internal app API should use an implicit `v1` contract through route grouping and shared schemas. It does not need URL-level `/v1` for every app route unless the backend framework convention strongly prefers that.

For external-facing or long-lived surfaces, include explicit versioning:

- Public tracking script: `/track/v1/script.js` or an equivalent immutable script URL.
- Tracking ingest: `/api/track/v1/events`.
- Public site payloads: include `payloadVersion` in returned render data.
- Webhook processors: pin provider API versions in config and test fixtures.
- Future customer API: use `/api/v1/...` from the start.

Compatibility rules:

- Additive response fields are allowed.
- Removing fields is breaking.
- Renaming fields is breaking.
- Changing enum values is breaking unless clients are explicitly tolerant.
- Narrowing accepted input is breaking unless it only rejects invalid data that previously should not have been accepted.
- Expanding accepted input is allowed if validation and permissions remain correct.
- Changing default sort, filter, or pagination behavior is breaking if a client-visible list changes meaning.
- Changing event semantics is breaking even if the JSON shape stays the same.

Breaking changes require:

- A migration plan.
- A compatibility window where both old and new clients work when practical.
- Frontend rollout order documented in the PR or release notes.
- Contract tests updated intentionally.
- For public scripts or APIs, a new versioned endpoint instead of silently changing behavior.

### Request And Response Shape

Authenticated app API responses should follow a consistent shape. The exact framework implementation can vary, but the semantics should be stable.

Successful single-resource response:

```ts
type ApiSuccess<T> = {
  data: T
  meta?: ApiMeta
}
```

Successful list response:

```ts
type ApiListSuccess<T> = {
  data: T[]
  page: {
    nextCursor: string | null
    previousCursor?: string | null
    hasMore: boolean
    limit: number
  }
  meta?: ApiMeta
}
```

Error response:

```ts
type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
    requestId: string
  }
}
```

Rules:

- `message` is safe to show to a user only when the error code is marked user-facing.
- `details` must never include secrets, tokens, raw stack traces, internal SQL, or provider payloads with sensitive data.
- Every response should include or expose a request ID.
- The frontend should branch on `error.code`, not error message text.
- The backend should log full diagnostic context server-side, keyed by request ID.
- Public APIs should return minimal error information to avoid leaking whether a private resource exists.

### Error Codes

Error codes should be stable, typed strings. They should be grouped by domain.

Examples:

```txt
auth.session_required
auth.email_not_verified
auth.work_email_required
auth.email_plus_alias_blocked

workspace.not_found
workspace.slug_unavailable
workspace.last_admin_protected
workspace.member_limit_reached

site.not_found
site.slug_unavailable
site.publish_validation_failed
site.version_conflict
site.archived

variant.not_found
variant.slug_unavailable
variant.fallback_required

editor.operation_rejected
editor.schema_invalid
editor.lock_conflict
editor.realtime_unavailable

tracking.payload_invalid
tracking.rate_limited
tracking.consent_required

asset.upload_too_large
asset.mime_type_not_allowed
asset.scan_pending
asset.scan_failed

billing.plan_required
billing.limit_exceeded

system.unavailable
system.rate_limited
system.validation_failed
```

Rules:

- Add new codes deliberately.
- Do not reuse an old code for a different condition.
- Keep a central registry with:
  - code
  - HTTP status
  - user-facing message policy
  - retryability
  - telemetry severity
- Client copy can live in the frontend, but backend codes are canonical.

### Pagination, Filtering, And Sorting

All list APIs should use cursor pagination unless there is a strong reason not to.

Rules:

- Do not use offset pagination for large or frequently changing tables.
- Cursor payloads should be opaque to clients.
- Cursor ordering must be deterministic.
- Every cursor-paginated query needs a stable tie-breaker, usually `id`.
- Default limits should be conservative.
- Maximum limits should be enforced server-side.
- Filters should be explicit query parameters, not one-off search blobs.
- Sort fields should be allowlisted.
- Search endpoints should document whether search is prefix, substring, full-text, or fuzzy.

Recommended list shape:

```ts
type CursorPageRequest = {
  cursor?: string
  limit?: number
  sort?: string
  direction?: "asc" | "desc"
}
```

Do not let the client send raw SQL column names. Map public sort keys to internal columns.

### Idempotency

Any mutation that can be retried by the browser, a worker, or a provider should support idempotency.

Requires idempotency:

- Publishing a site.
- Creating a site from a template.
- Duplicating a site.
- Accepting an invite.
- Upload completion.
- Tracking batch ingest.
- Webhook handling.
- Billing actions later.
- Background jobs that call third-party providers.

Rules:

- Client-generated idempotency keys should be accepted for user-triggered mutations where duplicate creation would be harmful.
- Server-generated operation IDs should be used for background jobs.
- Provider webhook event IDs should be stored and deduped.
- Idempotency records should include workspace scope when relevant.
- Idempotency responses should return the original result where practical.
- Failed attempts should be carefully classified:
  - validation failures can be safely returned again
  - transient failures can be retried
  - partial success requires operation-specific recovery

### Optimistic Concurrency

Resources that users can edit in multiple tabs or sessions need version checks.

Use optimistic concurrency for:

- Site drafts.
- Site settings.
- Variant definitions.
- Variables.
- Workspace settings.
- User profile preferences.
- Plan-sensitive settings.

Common pattern:

```ts
type VersionedMutation = {
  expectedVersion: number
  changes: unknown
}
```

Rules:

- Mutations should reject stale writes with `site.version_conflict` or a domain-specific conflict code.
- The frontend should refetch, merge when safe, and ask the user when the conflict cannot be resolved automatically.
- Editor content collaboration can use operation-level conflict handling, but coarse resource settings still need version checks.
- Published snapshots should be immutable and should not use optimistic concurrency after creation.

### API Schema Ownership

All request and response schemas should be defined once and reused across server validation, frontend typing, tests, and documentation.

Recommended structure:

```txt
packages/
  contracts/
    src/
      api/
      auth/
      workspaces/
      sites/
      editor/
      tracking/
      assets/
      billing/
      errors.ts
      pagination.ts
```

Rules:

- Route handlers validate input at the boundary.
- Service methods receive validated, typed input.
- Frontend API clients consume the same inferred types or generated types.
- Do not duplicate Zod schemas in feature components.
- Do not let database models become public API contracts.
- API schemas should expose product concepts, not persistence details.
- Contract tests should fail when a route returns a shape that does not match the schema.

If the backend uses a framework with first-class typed routes, keep the same ownership principle: contracts live at the API boundary and are imported by both sides intentionally.

### Frontend API Client

React components should not call `fetch` directly.

Use a small typed API client layer:

```txt
apps/web/src/lib/api/
  client.ts
  errors.ts
  query-keys.ts

apps/web/src/features/sites/
  api.ts
```

Rules:

- `client.ts` owns base URL, credentials, headers, request ID propagation, JSON parsing, and error normalization.
- Feature `api.ts` files own product-specific calls.
- TanStack Query hooks use feature API functions.
- Query keys are stable and centralized enough to avoid accidental cache collisions.
- Mutations should invalidate or update only the affected query scopes.
- Realtime updates should reconcile with query cache through one small integration layer.
- Components should receive domain data, not raw response envelopes.

### Realtime API Compatibility

Realtime collaboration messages should be versioned independently from REST responses.

Every realtime message should include:

```ts
type RealtimeEnvelope<T> = {
  protocolVersion: 1
  workspaceId: string
  siteId: string
  clientId: string
  messageId: string
  sentAt: string
  type: string
  payload: T
}
```

Rules:

- Unknown message types should be ignored safely or trigger a controlled reconnect.
- Clients should tolerate receiving their own acknowledged operations.
- Message IDs should support dedupe.
- Protocol changes that alter operation meaning require a new protocol version.
- Presence messages should be cheaper and less durable than content operations.
- The server should validate every operation before broadcasting.

### Tracking API Compatibility

Tracking events are both product data and analytics infrastructure. They must be stable.

Rules:

- Every event includes `schemaVersion`.
- The tracking script includes its script version.
- Event names are append-only.
- Event property meanings are append-only.
- Deprecating an event requires a transform or analytics migration plan.
- Ingest should accept known older versions for a defined window.
- Public tracking must never require authenticated app cookies.
- Tracking ingest should not reveal whether a private workspace, site, or recipient exists.

Recommended event envelope:

```ts
type TrackingEventEnvelope = {
  schemaVersion: 1
  eventId: string
  sessionId: string
  anonymousVisitorId: string
  siteId: string
  variantId?: string
  variantRevision?: number
  recipientId?: string
  occurredAt: string
  eventName: string
  properties: Record<string, unknown>
}
```

### Public Renderer Compatibility

Published public pages should render from immutable published payloads, not live editor draft data.

Rules:

- Published payloads include `renderSchemaVersion`.
- Public renderer supports the current version and a small number of recent versions.
- If a published payload is too old, migrate it asynchronously or render through a compatibility adapter.
- Do not mutate published payloads in place during render.
- Public rendering should never call editor-only APIs.
- Public route resolution should produce a minimal render payload that excludes draft-only fields, internal notes, audit fields, permissions, and workspace settings not needed for rendering.

### Webhook Compatibility

Provider webhooks should be treated as untrusted input.

Rules:

- Verify provider signatures before parsing into product actions.
- Store raw event metadata needed for debugging, but avoid storing sensitive full payloads unless there is a specific retention need.
- Deduplicate by provider event ID.
- Parse into an internal event model.
- Process internal events idempotently.
- Pin provider API versions where possible.
- Add fixtures for every webhook event type used by the app.
- Alert on unknown required event types after billing or critical integrations exist.

### API Documentation

Internal docs should exist even before a public API exists.

Each API module should document:

- Route purpose.
- Auth requirement.
- Permission requirement.
- Request schema.
- Response schema.
- Error codes.
- Side effects.
- Idempotency behavior.
- Cache behavior.
- Rate limit behavior.
- Observability fields.

Docs can be generated from schemas later, but the source of truth must stay close to the route and contract definitions.

### API Contract Testing

Contract testing should cover:

- Request validation rejects malformed data.
- Response schemas match contract.
- Error codes are stable.
- Permission boundaries are enforced.
- Cursor pagination is deterministic.
- Idempotency prevents duplicate side effects.
- Public routes exclude private fields.
- Tracking ingest accepts supported event versions.
- Webhook fixtures parse correctly.

Do not rely only on frontend tests to validate API behavior. API contracts are a backend boundary and need backend-level tests.

## Environment Configuration And Secret Management

Lightsite should have typed, explicit configuration from the start. Configuration drift is one of the easiest ways for a clean app to become fragile, especially once there are public URLs, tracking scripts, email, storage, workers, and preview deployments.

The rule is simple: every environment variable is documented, validated, owned, and classified as public or secret.

### Config Ownership

Create one server-side config module and one client-side public config module.

Recommended structure:

```txt
apps/server/src/config/
  env.ts
  public-url.ts
  secrets.ts

apps/web/src/config/
  public-env.ts
```

Rules:

- Server config parses `process.env` once at startup.
- Client config only reads explicitly public `VITE_*` variables.
- Never import server config into frontend code.
- Never expose provider secrets through `VITE_*`.
- Do not read `process.env` throughout the codebase.
- Do not silently default production secrets.
- Fail fast in production when required config is missing.
- Local development can have safe defaults only for non-secret local services.

### Environment Variable Categories

Core app:

```txt
NODE_ENV
APP_ENV
APP_NAME
APP_BASE_URL
WEB_BASE_URL
API_BASE_URL
PUBLIC_SITE_BASE_URL
TRACKING_BASE_URL
```

Database:

```txt
DATABASE_URL
DATABASE_POOL_MIN
DATABASE_POOL_MAX
DATABASE_SSL_MODE
```

Auth:

```txt
BETTER_AUTH_SECRET
BETTER_AUTH_URL
AUTH_TRUSTED_ORIGINS
SESSION_COOKIE_DOMAIN
SESSION_COOKIE_SECURE
```

Email:

```txt
EMAIL_PROVIDER
EMAIL_FROM
EMAIL_REPLY_TO
EMAIL_API_KEY
EMAIL_WEBHOOK_SECRET
```

Storage:

```txt
STORAGE_PROVIDER
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY
STORAGE_PUBLIC_BASE_URL
STORAGE_UPLOAD_MAX_BYTES
```

Logo enrichment:

```txt
LOGO_DEV_TOKEN
LOGO_DEV_BASE_URL
LOGO_DEV_DEFAULT_SIZE
LOGO_DEV_DEFAULT_THEME
```

Realtime:

```txt
REALTIME_PROVIDER
REALTIME_URL
REALTIME_SERVICE_TOKEN
REALTIME_PRESENCE_TTL_SECONDS
REALTIME_OPERATION_BATCH_MS
```

Jobs:

```txt
JOB_QUEUE_PROVIDER
JOB_WORKER_CONCURRENCY
JOB_RETRY_MAX_ATTEMPTS
JOB_RETRY_BASE_DELAY_MS
```

Tracking:

```txt
TRACKING_INGEST_RATE_LIMIT_PER_MINUTE
TRACKING_SESSION_TTL_MINUTES
TRACKING_BOT_FILTER_ENABLED
TRACKING_IP_HASH_SECRET
```

Billing later:

```txt
BILLING_PROVIDER
BILLING_SECRET_KEY
BILLING_WEBHOOK_SECRET
BILLING_PRICE_ID_TEAM
```

Observability:

```txt
LOG_LEVEL
SENTRY_DSN
SENTRY_ENVIRONMENT
OTEL_EXPORTER_OTLP_ENDPOINT
```

Frontend public variables:

```txt
VITE_APP_ENV
VITE_WEB_BASE_URL
VITE_API_BASE_URL
VITE_PUBLIC_SITE_BASE_URL
VITE_TRACKING_BASE_URL
```

Rules:

- `.env.example` must include every variable with safe placeholders.
- `.env.local` can include developer values and must not be committed.
- Production secrets should live in the hosting provider secret manager.
- Preview deployments should use isolated config where possible.
- Staging should not reuse production database, storage bucket, auth secret, or webhook secrets.

### Secret Classification

Classify config as:

- Public: safe to expose to browsers and logs.
- Internal: not secret, but should not be browser-visible.
- Secret: credentials, signing keys, provider tokens, database URLs.
- Derived secret: values that become sensitive when combined with other data, such as signed URLs or invite tokens.

Rules:

- Secrets must never be logged.
- Derived secrets must be redacted in logs.
- URLs containing tokens must be redacted before logging.
- Provider tokens must not be persisted in user-editable settings.
- If a token appears in an error message from a provider, sanitize before returning or logging.
- Support/admin tools should display secret presence and age, not secret values.

The `LOGO_DEV_TOKEN` is a secret. Logo fetches can use it server-side during onboarding and workspace settings refresh. The browser should never construct logo.dev URLs with the token directly.

### Config Validation

Use a schema validator for environment variables.

Validation should check:

- Required variables by environment.
- URL format.
- Numeric ranges.
- Boolean parsing.
- Enum values.
- Secret minimum length where useful.
- Public URL origin compatibility.
- Cookie domain compatibility with app/public domains.

Rules:

- Production startup should fail on invalid config.
- Worker startup should validate worker-required config.
- Web startup should validate web-required config.
- Tests should use a test config builder rather than depending on the developer machine.
- Config validation should have unit tests for missing, malformed, and valid environments.

### Environment Modes

Use explicit environment modes:

- `local`: developer machine.
- `test`: automated tests.
- `preview`: branch or pull request deployment.
- `staging`: production-like internal environment.
- `production`: customer-facing production.

Rules:

- Do not branch on only `NODE_ENV` for product behavior.
- Use `APP_ENV` for deployment behavior.
- Local can allow insecure cookies only on localhost.
- Preview environments should have distinct auth callback URLs.
- Staging should send emails only to allowlisted domains or use a sandbox provider.
- Production should have strict cookies, HTTPS-only public URLs, and complete observability.

### Public URL Strategy In Config

Lightsite needs multiple URL classes:

- App dashboard URL.
- API URL.
- Public site URL.
- Tracking URL.
- Asset URL.
- Custom domain URLs later.

Rules:

- Do not infer all URLs from a single base URL.
- Public site URL generation should use a central helper.
- Tracking script URLs should use tracking config, not app config.
- Email links should use app config for dashboard actions and public-site config for published links.
- Webhook callback URLs should be environment-specific.
- Custom domains should be resolved through database mapping, not config.

### Rotation And Revocation

Secret rotation should be possible without emergency code changes.

Rules:

- Signing secrets that need rotation should support key IDs or a primary/secondary window.
- Webhook secrets are per provider and per environment.
- Session secrets should follow BetterAuth rotation guidance when available.
- Asset signed URL keys should have short TTLs so rotation impact is limited.
- Tracking IP hash secret rotation should be planned because it changes dedupe/identity behavior.
- Store metadata about secret creation and rotation outside the app when the hosting platform supports it.

### Config In Tests

Tests should not depend on real provider secrets.

Rules:

- Unit tests use test config builders.
- Integration tests use local service credentials.
- E2E tests use deterministic test-only values.
- Tests must fail if code tries to read missing production-like secrets unexpectedly.
- Snapshot tests must not include real env values.
- CI should scan output for common secret patterns.

### Config Documentation

Maintain a config reference in the repo.

Each variable should document:

- Name.
- Required environments.
- Public/internal/secret classification.
- Example value.
- Owner.
- Used by web/server/worker.
- Rotation notes if secret.
- Failure mode when missing.

This can live in the config module comments, a generated markdown file, or both. The important thing is that `.env.example`, runtime validation, and docs stay synchronized.

## Local Development, Seed Data, And Fixtures

Local development should be boring in the best possible way. A developer should be able to clone the repo, install dependencies, start local services, run migrations, seed useful data, and open a working app without tribal knowledge.

The local environment should resemble production architecture where it matters, but use cheap local substitutes where provider fidelity is not useful.

### One-Command Development

Target developer flow:

```txt
pnpm install
pnpm dev:setup
pnpm dev
```

`dev:setup` should:

- Verify required runtime versions.
- Create local env files from examples if missing.
- Start or verify local Postgres.
- Run migrations.
- Seed baseline data.
- Print app, API, public-site, and email-preview URLs.

`dev` should start:

- Web app.
- API server.
- Worker process if needed.
- Realtime service or local adapter.
- Local email preview/sink.

Rules:

- Do not require production provider accounts for normal local development.
- Do not require paid services to run the core app locally.
- Do not use production secrets locally.
- Commands should be idempotent.
- Commands should print clear remediation when a port or service is unavailable.

### Local Services

Recommended local services:

- Postgres for primary data.
- Local file storage directory or S3-compatible emulator.
- Email sink such as Mailpit or equivalent.
- In-memory or local queue adapter for early development.
- Local realtime adapter for editor collaboration.
- Optional local Redis only if the architecture truly needs Redis early.

Rules:

- Keep local service choices documented.
- Use the same database engine locally and in production.
- Avoid SQLite as a local substitute for Postgres because constraints, JSONB, indexing, and concurrency differ.
- If a cloud-only provider is used later, wrap it behind an adapter so local development can still run without it.

### Seed Data Goals

Seed data should exercise real product flows, not just create an admin account.

Baseline seed should include:

- One workspace with a completed setup flow.
- Workspace slug, website, and logo avatar.
- Owner user.
- Admin user.
- Member user.
- Pending invite.
- Several sites in different states:
  - draft
  - published
  - unpublished draft changes
  - archived
  - duplicated from another site
- Site with complete variable usage.
- Site with multiple variants.
- Site with recipient-specific link.
- Site with version history.
- Site with tracking data.
- Site with all supported block types.
- Site that intentionally fails publish validation for testing.
- Assets in image, PDF, and unsupported/rejected states.

Rules:

- Seeds must be deterministic.
- Seeds should not call external providers by default.
- Seeds should not send real emails.
- Seed passwords or auth helpers should be local-only.
- Seed domains should use reserved/example domains.
- IDs can be deterministic where useful for tests, but avoid coupling production logic to seeded IDs.

### Fixture Scenarios

Create named fixture scenarios for test and development.

Suggested scenarios:

```txt
empty-workspace
new-user-onboarding
workspace-setup-incomplete
slug-conflict
team-invites
single-draft-site
published-site-with-tracking
multi-variant-site
large-site
all-blocks-site
asset-heavy-site
editor-collaboration
plan-limit-reached
public-site-404
public-site-password-protected-later
```

Rules:

- E2E tests should select fixtures by scenario name.
- Fixture setup should be faster than rebuilding the whole seed database when possible.
- Fixture data should include edge cases, not only happy paths.
- Each fixture should document what behavior it exists to test.

### Local Auth

Local auth should support realistic flows without making development painful.

Rules:

- BetterAuth should run locally with local callback URLs.
- Work-email validation should stay enabled, but local test domains should be allowlisted.
- Plus-address blocking should stay enabled.
- Email verification can be completed through the local email sink.
- Invite acceptance should use real local invite links.
- Developer-only shortcut login can exist only in local/test and must be impossible in production.
- Seed users should be clearly marked as local/dev.

### Local Logo Fetching

Workspace setup uses logo.dev in production-like flows, but local development should not depend on external network calls.

Rules:

- The logo fetcher should have an adapter.
- Local default can return deterministic placeholder logos.
- Integration tests can mock logo.dev responses.
- Staging can call logo.dev with staging rate limits.
- Failures should not block workspace setup if the user can upload or skip the logo.
- Never expose the logo.dev token in browser logs, network requests, or seeded data.

### Local Tracking Data

Tracking is hard to build well without realistic data. Seeded tracking should include:

- Single visit.
- Repeat visitor.
- Known recipient visit.
- Anonymous visit.
- Slack/OG image fetch signal.
- Bot-like visit filtered from primary analytics.
- Long read session.
- Short bounce.
- Scroll-depth events.
- CTA clicks.
- Asset clicks.
- Multiple variants for comparison.

Rules:

- Generated event timestamps should be relative or deterministic.
- Analytics aggregations should be testable without waiting for scheduled jobs.
- Local tracking scripts should point to local ingest.
- Local public pages should render tracking only when the app config enables it.

### Reset And Destructive Commands

Local reset commands are useful but dangerous.

Rules:

- Destructive commands must clearly state the target database.
- Production reset commands must not exist.
- Staging destructive commands require explicit environment confirmation.
- Local reset can require typing the local database name or passing `--yes`.
- Reset should drop local uploads and queued jobs only when explicitly requested.

### Developer Documentation

The repo should include a local development guide with:

- Required tools and versions.
- Setup commands.
- Common ports.
- Env variable setup.
- Migration commands.
- Seed commands.
- Test commands.
- Troubleshooting for database, auth, ports, email, assets, and realtime.
- How to add a new fixture.
- How to inspect public pages locally.
- How to run the tracking pipeline locally.

The guide should be short enough to stay maintained. Prefer commands that encode behavior over pages of manual steps.

## Database Invariants, Constraints, And Index Strategy

The database should enforce the invariants that must never be violated. Application validation is useful for user experience, but correctness should not depend only on route code.

The rule: if corrupt data would cause security, billing, publishing, ownership, analytics, or recovery problems, encode the invariant in the database or in a transaction pattern with tests.

### General Database Principles

Rules:

- Every table has a primary key.
- Every row has `created_at`.
- Mutable rows have `updated_at`.
- Soft-deletable rows have `deleted_at`.
- User-owned mutations record `created_by_user_id` and/or `updated_by_user_id` where useful.
- Workspace-owned tables include `workspace_id` unless they are truly global.
- Publicly addressable rows should not expose sequential IDs.
- Use foreign keys for ownership relationships.
- Use check constraints for simple enum-like and numeric rules.
- Use partial or retained unique indexes according to each table's identifier reuse policy.
- Keep JSONB for flexible content payloads, not for core relational ownership.
- Do not store derived counters as canonical truth unless the update path is transactional or repairable.

### Workspace Invariants

Invariants:

- Workspace slug is unique among retained workspaces, including suspended workspaces and workspaces scheduled for deletion.
- Workspace slug is normalized before save.
- Workspace slug is not a reserved word.
- Workspace must always have at least one active admin.
- Workspace setup completion should not be true until required fields exist.
- Workspace website should be normalized and validated.
- Workspace logo asset must belong to the same workspace or be an allowed external fetched logo record.
- Hard-purging a workspace should reserve its previous slug if any public links may have existed, so old links cannot later resolve to a different customer.

Database support:

```sql
unique index workspaces_slug_retained_unique
  on workspaces (slug)
  where deleted_at is null;
```

The last-admin rule usually cannot be enforced by a simple constraint. Enforce it with a transaction that locks the workspace membership set before demoting, removing, or deleting an admin.

### Membership And Invite Invariants

Invariants:

- A user can have only one active membership per workspace.
- A pending invite should be unique by workspace and normalized email unless multiple explicit invite attempts are tracked separately.
- Invite token hashes are unique.
- Invite tokens are never stored raw.
- Invite expiration is enforced server-side.
- Accepted invites cannot be accepted again.
- A user cannot accept an invite with a different email unless the product explicitly supports admin-approved email changes.

Database support:

```sql
unique index workspace_memberships_unique_active
  on workspace_memberships (workspace_id, user_id)
  where deleted_at is null;

unique index workspace_invites_pending_email_unique
  on workspace_invites (workspace_id, normalized_email)
  where accepted_at is null
    and revoked_at is null
    and deleted_at is null;

unique index workspace_invites_token_hash_unique
  on workspace_invites (token_hash);
```

### Site Invariants

Invariants:

- Site belongs to exactly one workspace.
- Site slug is unique within a workspace among all retained non-deleted sites, including archived sites.
- The base/default public link is not represented by a variant row.
- A published site points to an immutable published version.
- Draft content can change; published content is snapshot-based.
- Archived sites cannot be edited, published, or tracked as active.
- Duplicated sites get new IDs, slugs, draft versions, and sharing tokens.
- Site public access state is explicit.
- Site moderation state is separate from user-driven publish state.

Database support:

```sql
unique index sites_workspace_slug_retained_unique
  on sites (workspace_id, slug)
  where deleted_at is null;

index sites_workspace_updated_at_idx
  on sites (workspace_id, updated_at desc, id desc);

index sites_public_lookup_idx
  on sites (workspace_id, slug)
  where deleted_at is null;
```

Publishing should happen in a transaction:

- Validate draft.
- Create immutable site version row.
- Create or update published pointer.
- Record audit event.
- Enqueue cache invalidation or publish fanout job.

Do not update published content in place.

### Variant Invariants

Invariants:

- Variant belongs to one site.
- Variant slug is unique within site for all retained variants and reserved historical slugs.
- There is no canonical/default variant row; the base site link renders published defaults without `variantId`.
- Variant overrides are keyed by stable variable IDs.
- Variant overrides can reference draft-only variables, but public rendering only applies overrides for variables present in the published snapshot.
- Variant metadata and override changes are live configuration and must increment a variant revision.
- Deleted variants should not resolve from public links.
- Reserved old variant slugs should not resolve from public links and should not be reusable.

Database support:

```sql
unique index site_variants_site_slug_retained_unique
  on site_variants (site_id, slug);

unique index site_variant_slug_reservations_unique
  on site_variant_slug_reservations (site_id, slug);
```

### Variable Invariants

Invariants:

- Variable key is unique within site.
- Variable key is stable after creation unless all references are migrated transactionally.
- Variable key follows a strict format.
- Variable type is explicit.
- Default value matches type.
- Required variables must have values before publish unless a safe fallback exists.
- Variant overrides must match variable type.

Database support can enforce key uniqueness and type enum. Deep value validation should happen through shared schemas before persistence and again before publishing.

```sql
unique index site_variables_site_key_active_unique
  on site_variables (site_id, key)
  where deleted_at is null;
```

### Content And Block Invariants

Invariants:

- Draft content document must match the current editor schema.
- Published content document must match its `renderSchemaVersion`.
- Blocks have stable IDs.
- Block IDs are unique within a site document.
- Block references to assets, variables, and anchors must resolve.
- Divider elements replace sections in V1 and can optionally render full-width.
- Unsupported block types cannot be published.
- Unknown future block types should fail closed in the editor and public renderer unless a compatibility adapter exists.

Because content is likely stored as structured JSON, the database should enforce coarse validity and the app should enforce deep schema validity.

Rules:

- Store schema version with every content document.
- Validate on write.
- Validate on publish.
- Validate in migration tests.
- Keep repair tools for corrupted draft content.
- Public renderer should receive already-validated published content.

### Asset Invariants

Invariants:

- Asset belongs to a workspace.
- Site-specific asset usage references assets in the same workspace.
- Upload completion cannot attach an asset to a workspace the user cannot access.
- Asset MIME type is validated server-side.
- Asset size is validated server-side.
- Asset scan state gates public use if scanning is enabled.
- Deleting an asset that is used by a published site requires either blocking deletion or preserving the published asset.
- Public assets should resolve through immutable object keys or versioned URLs.

Indexes:

```sql
index assets_workspace_created_at_idx
  on assets (workspace_id, created_at desc, id desc);

index asset_usages_asset_idx
  on asset_usages (asset_id);

index asset_usages_site_idx
  on asset_usages (site_id);
```

### Version History Invariants

Invariants:

- Site versions are immutable.
- Version number is unique per site.
- Each version records the user or system action that created it.
- Rollback creates a new draft or new version; it does not mutate history.
- Published pointers can move, but the target version row cannot change.
- Version payload includes schema versions needed to render or restore.

Database support:

```sql
unique index site_versions_site_version_unique
  on site_versions (site_id, version_number);

index site_versions_site_created_at_idx
  on site_versions (site_id, created_at desc, id desc);
```

### Tracking Invariants

Tracking tables should be append-oriented.

Invariants:

- Raw events are immutable after ingest except for privacy deletion/anonymization fields.
- Event IDs are unique within the tracking ingestion scope.
- Event timestamps are preserved separately from ingestion timestamps.
- Session attribution is deterministic.
- Bot-filtered events are marked, not silently mixed with primary analytics.
- Aggregates can be rebuilt from raw or normalized event tables for the retention window.
- Recipient identity must not be inferred into a workspace-visible person unless the link or integration legitimately identifies them.

Indexes:

```sql
unique index tracking_events_event_id_unique
  on tracking_events (event_id);

index tracking_events_site_time_idx
  on tracking_events (site_id, occurred_at desc);

index tracking_events_variant_time_idx
  on tracking_events (variant_id, occurred_at desc);

index tracking_sessions_site_started_idx
  on tracking_sessions (site_id, started_at desc);
```

Partitioning by time can be introduced when volume requires it. The schema should not assume one forever-growing hot table is acceptable at scale.

### Audit And Security Event Invariants

Invariants:

- Audit events are append-only.
- Security events are append-only.
- Actor, target, action, and timestamp are required.
- Workspace-scoped events include workspace ID.
- System events identify the system component.
- Sensitive metadata is redacted before persistence.
- Audit events should survive normal user deletion where legally permitted and required for security/accounting.

Indexes:

```sql
index audit_events_workspace_time_idx
  on audit_events (workspace_id, created_at desc, id desc);

index security_events_user_time_idx
  on security_events (user_id, created_at desc, id desc);
```

### Soft Delete And Cascades

Soft delete is useful for recovery and audit, but it can create uniqueness and permission bugs if not designed carefully.

Rules:

- Use `deleted_at` consistently.
- Every query for active records must filter `deleted_at is null`.
- Use partial unique indexes for active uniqueness.
- Avoid cascading hard deletes for user-visible core data.
- Hard delete only for retention jobs, privacy deletion, local reset, or data with no recovery/audit value.
- Deleting a workspace should enter a scheduled deletion state before hard delete.
- Public route resolution must ignore deleted and archived records.
- Public slugs/identifiers should remain reserved during soft-delete/scheduled-deletion states, or be moved into explicit reservation tables before hard purge.
- Analytics retention deletion should not break aggregate dashboards; keep anonymized aggregates where policy allows.

### Transaction Patterns

Use transactions for:

- Workspace setup completion.
- Workspace slug change.
- Membership role changes.
- Last-admin checks.
- Invite acceptance.
- Site creation with draft content and no variant rows.
- Site duplication.
- Publish.
- Rollback.
- Default variant promotion.
- Asset upload completion.
- Billing entitlement updates later.
- Webhook event processing.

Rules:

- Lock the smallest set of rows needed.
- Prefer unique constraints over application pre-checks for race-prone uniqueness.
- Convert database constraint failures into stable API error codes.
- Keep external network calls outside database transactions.
- Use outbox/job patterns for side effects that happen after commit.

### Index Review

Every query used by main user flows should have an index plan.

Core query paths:

- Resolve current user session.
- List workspaces for user.
- Resolve workspace by slug.
- List sites by workspace.
- Search/filter sites.
- Resolve public site by workspace slug and site slug.
- Resolve public site by share token or variant slug.
- Load site editor draft.
- Load site versions.
- Load variables and variants.
- Load team members and invites.
- Load tracking dashboard.
- Ingest tracking event by event ID/session.
- Load audit events for workspace.

Rules:

- Add indexes based on actual query shape.
- Avoid speculative indexes for flows that do not exist yet.
- Review query plans before launch.
- Watch for N+1 queries in list endpoints.
- Keep compound index order aligned with filters and sort.
- Revisit indexes after analytics volume exists.

### Schema Migration Safety

Database migrations should be small, reviewable, and reversible where practical.

Rules:

- Separate schema changes from data backfills when the table is large.
- Add nullable columns before backfilling and enforcing not-null.
- Backfill in batches.
- Add indexes concurrently where supported and needed.
- Avoid long table locks in production.
- Write down rollback strategy for risky migrations.
- Never edit an already-applied production migration.
- Migration names should describe the product change.
- CI should run migrations from empty database and from a recent snapshot path when available.

## Type System, Shared Packages, And Validation Boundaries

Lightsite should use TypeScript as a product safety tool, not just as editor autocomplete. The most important types should describe domain contracts, not implementation accidents.

The goal is to make invalid states hard to represent at module boundaries and impossible to persist at system boundaries.

### Shared Package Boundaries

Recommended package structure:

```txt
packages/
  contracts/       # API request/response schemas, error codes, pagination
  domain/          # domain types, enums, IDs, permission concepts
  content-schema/  # editor/public content document schemas
  tracking-schema/ # tracking event schemas
  config-schema/   # optional shared config metadata, not secret values
```

Rules:

- Shared packages must not import app runtime code.
- Shared packages must not import database clients.
- Shared packages must not import React.
- Backend can import all shared packages.
- Frontend can import contracts, domain, content schema, and tracking schema if they are browser-safe.
- Keep package dependency direction one-way.
- Avoid circular imports.

### Domain Types

Use branded or opaque IDs where practical:

```ts
type WorkspaceId = Brand<string, "WorkspaceId">
type SiteId = Brand<string, "SiteId">
type VariantId = Brand<string, "VariantId">
type UserId = Brand<string, "UserId">
```

Rules:

- Do not pass raw strings through domain services when a branded ID would prevent mixups.
- Keep serialization simple; IDs are still strings at the API boundary.
- Use enums or literal unions for stable product states.
- Keep state machines explicit for publish state, moderation state, invite state, and upload state.

### Validation Boundaries

Validate at every trust boundary:

- Browser form input before submission for user experience.
- API request body on server.
- URL params on server.
- Provider webhook payloads.
- Tracking ingest payloads.
- Realtime operations.
- Background job payloads.
- Database reads of JSON content before rendering if data may be old.

Rules:

- Frontend validation is not a security boundary.
- Server validation is required even when frontend validates.
- Service methods should not accept `unknown`.
- Database writes should receive already-validated values.
- Public rendering should validate or adapt published payload versions.
- Validation errors should map to stable error codes.

### Content Schema Versioning

Editor content has its own schema lifecycle.

Rules:

- Every document includes `schemaVersion`.
- Every block includes `type` and stable `id`.
- Block-specific data is validated by block schema.
- Rich text content is sanitized and schema-validated.
- Variables are represented by explicit nodes/marks, not raw string interpolation.
- Migrations are pure functions from one version to the next.
- Migration tests cover representative old documents.
- Public renderer supports published documents through adapters or migrations.

### Generated Types And Runtime Schemas

TypeScript types alone do not validate runtime data. Use runtime schemas at boundaries.

Rules:

- Prefer schema-first contracts where inferred TypeScript types come from runtime schemas.
- Avoid manually maintaining separate TS types and validation schemas for the same payload.
- If code generation is used, generation must be deterministic and part of CI.
- Generated files should be clearly marked.
- Do not edit generated files by hand.

### Frontend Type Rules

Rules:

- Feature components consume domain view models or typed API results.
- Components should not know database column names.
- Components should not branch on raw backend error messages.
- TanStack Query keys should be typed helpers where practical.
- Route params should be parsed and validated before use.
- Editor state should have explicit types for selection, hover, drag, undo, and presence.
- Avoid `any`; if unknown data is unavoidable, narrow it immediately.

### Backend Type Rules

Rules:

- Route handlers parse input and call services with typed commands.
- Services return typed results or throw typed domain errors.
- Repositories map between database rows and domain models.
- Database row types should not leak to API responses.
- Background job handlers parse job payloads.
- Webhook handlers parse provider events into internal events before business logic.
- Permission checks should receive typed actor/resource/action inputs.

### Type And Schema Testing

Testing should include:

- Schema accepts valid examples.
- Schema rejects invalid examples.
- Content migrations preserve required semantics.
- API examples compile against exported types.
- Error code registry has no duplicates.
- Event registry has no duplicate or malformed event names.
- Public render payload excludes private fields.
- Type-level tests for important helper utilities if they become complex.

## Authorization Model, Policy Enforcement, And Resource Scoping

Authorization should be a first-class architecture layer in Lightsite. The app is collaborative, workspace-scoped, and publishes public pages, which means authorization mistakes can expose customer content, allow unauthorized edits, or leak analytics. Permission checks should be centralized, tested, and expressed in product language.

The core rule: every authenticated action is evaluated as an actor attempting an action on a resource inside a workspace context.

### Authorization Inputs

Permission checks should receive explicit inputs:

```ts
type AuthorizationInput = {
  actor: {
    userId: UserId
    developer: boolean
  }
  workspace?: {
    workspaceId: WorkspaceId
    role: "admin" | "user"
    membershipId: WorkspaceMembershipId
  }
  resource?: {
    type: string
    id: string
    workspaceId?: WorkspaceId
    ownerUserId?: UserId
    creatorMembershipId?: WorkspaceMembershipId
  }
  action: string
}
```

Rules:

- Do not infer workspace access from email domain.
- Do not infer site access from public link access.
- Do not infer customer workspace admin access from internal developer access.
- Do not authorize by checking only whether an ID exists.
- Resolve the resource and its workspace before checking permissions.
- Always scope database reads by workspace where the resource is workspace-owned.

### Actor Types

Lightsite has several actor types:

- Authenticated user.
- Workspace member.
- Workspace admin.
- Internal developer/admin.
- Public visitor.
- Public bot/link preview client.
- Background system actor.
- Provider webhook actor.

Rules:

- Public visitors never receive workspace membership permissions.
- Link preview clients are public visitors with bot classification, not trusted actors.
- Background system actors can perform system-owned work only through explicit job types.
- Webhook actors can trigger provider-specific flows only after signature verification.
- Internal developer/admin status does not bypass customer workspace authorization unless the action is an explicitly internal support action.

### Resource Types

Authorize at the resource level for:

- Workspace.
- Workspace member.
- Workspace invite.
- Site.
- Site draft.
- Site published snapshot.
- Site version.
- Site variant.
- Site variable.
- Site access rule.
- Asset.
- Tracking analytics.
- Export.
- Billing configuration.
- Audit event.
- Internal admin/support resource.

Rules:

- Child resources inherit workspace scope from their parent.
- Child resource authorization should verify both child existence and parent ownership.
- Never trust a client-sent `workspaceId` without verifying the target resource belongs to that workspace.
- Cross-workspace IDs in requests should return a safe not-found or permission error according to the route policy.

### Action Registry

Actions should be named consistently and registered centrally.

Recommended action names:

```txt
workspace.read
workspace.update
workspace.delete
workspace.switch

member.list
member.invite
member.update_role
member.remove

site.create
site.read
site.edit
site.duplicate
site.archive
site.restore
site.delete
site.publish
site.unpublish
site.manage_access
site.view_analytics

variant.create
variant.read
variant.update
variant.delete

asset.create_upload
asset.read
asset.update
asset.delete

billing.read
billing.manage

audit.read

internal.support_read_metadata
internal.support_takedown
internal.support_grant_content_access_later
```

Rules:

- Use action names in logs, audit events, tests, and permission errors.
- Do not create one-off action strings inside route handlers.
- Adding a new mutating route requires adding or reusing an action.
- Permission tests should cover every registered action.

### Workspace Role Policy

V1 workspace roles:

- `admin`
- `user`

Admin can:

- Manage workspace settings.
- Manage members and invites.
- Manage all sites in the workspace.
- Manage billing later.
- View workspace audit and analytics surfaces according to product design.
- Recover access to private sites created by former members.

User can:

- Create sites if plan limits allow.
- Read sites they created or that are shared with them.
- Edit sites where they have effective edit access.
- Duplicate sites where they have `view_copy` or edit access.
- Invite teammates only when the actor is a workspace admin in v1.
- View tracking for sites they can access if the tracking page is not admin-only.

Rules:

- Admin authority is workspace-scoped.
- A workspace admin in one workspace has no power in another workspace.
- Admins are not internal Lightsite staff.
- User permissions can be expanded through site access, not through hidden route exceptions.
- Last-admin protections apply to role changes, removal, leaving, and account deactivation.

### Site Access Policy

Effective site access is derived from:

- Workspace admin role.
- Site creator membership, if still active.
- Explicit member access.
- Entire-team access.
- Archived/deleted state.
- Workspace suspension/moderation state.

Effective roles:

- `none`
- `view_copy`
- `edit`

Rules:

- Workspace admin always wins for authenticated app access.
- `edit` wins over `view_copy`.
- Entire-team access applies to all active current and future members.
- Removed workspace members immediately lose effective access even if access rows remain historically.
- Archived sites can be read by admins for restore/inspection but cannot be edited or publicly served.
- Deleted sites are unavailable except through retention/recovery tooling.
- Site access does not grant public visitor access; publish state controls public pages.

### Permission Resolution Flow

For authenticated resource routes:

1. Authenticate session.
2. Resolve selected or route workspace.
3. Verify active workspace membership.
4. Resolve target resource scoped to the workspace.
5. Compute effective permission.
6. Validate input.
7. Execute service transaction.
8. Emit audit/security events where required.

Rules:

- Authentication happens before authorization.
- Resource resolution must be workspace-scoped.
- Input validation should happen before expensive work, but permission checks must still protect resource existence.
- For sensitive routes, prefer resolving permission before returning field-level validation details.
- Permission failures should be deterministic and use stable error codes.

### Not Found vs Permission Denied

Response policy should avoid leaking private resource existence.

Authenticated app routes:

- If the resource is in the current workspace and the user can know the workspace exists, `403` can be used for insufficient access.
- If the resource is in another workspace or inaccessible workspace, return `404` or a generic not-found error.
- If the resource does not exist, return `404`.

Public routes:

- Unpublished, archived, deleted, suspended, or nonexistent pages should return public-safe `404` unless a different product-specific page is required.
- Do not reveal whether a private draft exists.
- Do not reveal workspace member or site access details.

Admin/support routes:

- Internal tools can distinguish more states, but must require internal permission and audit access.

### Permission Caching

Permission checks must be correct before they are clever.

Rules:

- Do not cache permission decisions across requests in a way that delays revocation.
- Request-local caching is allowed for repeated checks on the same resource.
- Realtime sessions should revalidate permissions when membership, role, site access, archive state, or suspension state changes.
- Frontend cached permissions are hints for UI only.
- TanStack Query cache must be invalidated when role/access changes.
- If a permission cache is added later, it must have short TTLs, explicit invalidation, and conservative fallback.

### Frontend Permission Model

The frontend should receive effective permission summaries to render the right controls, but backend remains authoritative.

Recommended shape:

```ts
type SitePermissions = {
  canRead: boolean
  canEdit: boolean
  canPublish: boolean
  canManageAccess: boolean
  canDuplicate: boolean
  canArchive: boolean
  canViewAnalytics: boolean
}
```

Rules:

- Hide or disable unavailable actions in the UI.
- Mutations still handle `403` because permissions can change after the page loads.
- Read-only editor mode should be a first-class state.
- Lost access while editing should stop persistence and preserve local recovery where safe.
- Do not build UI flows that require users to guess why an action disappeared.

### Internal Admin And Support Access

Internal access must be separate from workspace access.

Rules:

- Internal admin users cannot silently become workspace admins.
- Internal support metadata access is allowed only through internal routes.
- Future content access requires explicit reason, time-bound grant, audit trail, and preferably customer-visible status.
- Internal takedown/suspension actions require internal admin permission.
- Impersonation should be avoided unless truly necessary; if added, it must never bypass audit.

### Authorization Testing

Authorization tests should cover:

- Every action for admin and user.
- Cross-workspace access attempts.
- Removed member access.
- Last-admin protection.
- Site explicit access.
- Entire-team access.
- Site creator access after creator leaves.
- Archived site behavior.
- Public route behavior.
- Realtime room join and permission revocation.
- Background job permission recheck where applicable.
- Export permission at request and generation time.
- Internal admin separation from workspace admin.

Permission tests should be service-level and route-level. UI tests are not enough.

## Observability, Logging, Metrics, And Tracing

Lightsite should be observable from the beginning. Observability is not just production debugging; it is how we verify publishing, tracking, collaboration, public rendering, and background jobs behave correctly without inspecting customer content.

The goal is to answer: what happened, who or what initiated it, which workspace/site was affected, how long it took, whether it succeeded, and where to look next.

### Observability Principles

Rules:

- Every request has a request ID.
- Every background job has a job ID.
- Every publish operation has an operation ID.
- Every tracking batch has an ingest ID.
- Logs are structured.
- Metrics are low-cardinality.
- Traces connect web/API/worker operations where practical.
- Customer content is not logged.
- Secrets are never logged.
- Audit logs are separate from diagnostic logs.

### Request Context

Every backend request should attach:

```ts
type RequestContext = {
  requestId: string
  traceId?: string
  userId?: UserId
  workspaceId?: WorkspaceId
  membershipId?: WorkspaceMembershipId
  routeName: string
  ipClass?: "public" | "private" | "unknown"
  userAgentClass?: "browser" | "bot" | "provider" | "unknown"
}
```

Rules:

- Use IDs, not names or emails, in routine logs.
- Hash or omit IP addresses unless needed for security/rate limiting.
- Do not log full user agents in high-volume logs if classification is sufficient.
- Redact query params that may contain tokens.
- Include request ID in API error responses.

### Structured Logging

Log events should be machine-searchable.

Recommended fields:

```txt
timestamp
level
message
event
requestId
traceId
userId
workspaceId
siteId
jobId
operationId
durationMs
status
errorCode
```

Rules:

- Use consistent event names.
- Avoid free-form logs for critical workflows.
- Log workflow boundaries, not every internal function call.
- Do not log draft content, rich text, variable values, recipient names, email addresses, tokens, provider secrets, or raw webhook payloads.
- Use log levels consistently:
  - `debug` for local and short-lived diagnostic detail
  - `info` for normal workflow milestones
  - `warn` for recoverable unusual conditions
  - `error` for failed operations requiring attention

### Metrics

Operational metrics should be low-cardinality and alertable.

Core metrics:

```txt
http_requests_total
http_request_duration_ms
api_errors_total
auth_failures_total
permission_denials_total
site_publish_total
site_publish_duration_ms
site_publish_failures_total
public_render_total
public_render_duration_ms
public_render_errors_total
tracking_events_ingested_total
tracking_events_rejected_total
tracking_ingest_duration_ms
tracking_queue_lag_ms
realtime_rooms_active
realtime_connections_active
realtime_operations_total
job_claimed_total
job_completed_total
job_failed_total
job_retry_total
job_queue_depth
email_send_total
asset_upload_total
asset_upload_failed_total
```

Rules:

- Do not use raw workspace slug, site slug, email, URL, or user ID as metric labels.
- Use route names instead of raw paths.
- Use error codes instead of error messages.
- Use coarse plan/environment labels where needed.
- Track public rendering latency separately from authenticated app latency.
- Track tracking ingest rejection reasons.

### Tracing

Tracing is most useful for workflows that cross services.

Trace:

- Authenticated API requests.
- Publish transaction and post-commit jobs.
- Public render origin request.
- Tracking ingest batch.
- Asset upload completion.
- Email job.
- Export job.
- Webhook processing.
- Realtime operation persistence.

Rules:

- Propagate trace/request IDs into jobs created by a request.
- Traces should not include content payloads.
- Slow spans should identify the system boundary: database, storage, provider, cache, queue.
- Keep sampling configurable by environment.

### Dashboards

Initial dashboards should cover:

- API health.
- Public page health.
- Publish success/failure.
- Tracking ingestion volume and rejection rate.
- Background job depth and failure rate.
- Database latency and connection usage.
- Asset upload failure rate.
- Email delivery failure rate.
- Realtime connection count and operation rate.
- Error rate by route.

Dashboard rules:

- Every launch-critical workflow should have at least one dashboard signal.
- Dashboards should use operational metrics, not customer analytics tables.
- Dashboards should avoid customer-identifying dimensions.

### Alerting

Initial alerts:

- App/API elevated error rate.
- Public rendering elevated error rate.
- Public rendering latency above budget.
- Publish failures above threshold.
- Tracking ingest outage or high rejection spike.
- Job queue lag above threshold.
- Worker process not running.
- Database connection saturation.
- Database backup failure.
- Email provider failures for transactional email.
- Storage upload failure spike.

Rules:

- Alerts should be actionable.
- Alert descriptions should include runbook links.
- Avoid paging on noisy non-actionable metrics.
- Separate product analytics anomalies from operational incidents.

### Frontend Observability

The web app should capture:

- Route-level load errors.
- Mutation failures by error code.
- Editor crash boundaries.
- Public preview render errors.
- Performance marks for slow editor operations.
- Asset upload failures.
- Realtime disconnect/reconnect loops.

Rules:

- Do not send site content or variable values to error monitoring.
- Redact form values by default.
- Include app version/build SHA.
- Include route name, not full URL when URLs may contain private identifiers.

### Public Renderer Observability

Public pages are the customer-facing output of the product and should have their own signals.

Track:

- Route resolution success/failure.
- Render payload version.
- Cache hit/miss.
- Origin render time.
- Asset load failures where observable.
- Public 404 rate.
- Bot/link-preview traffic classification.

Rules:

- Do not log prospect-identifying URL parameters unless explicitly designed and privacy-reviewed.
- Public render errors should not reveal internal details to visitors.
- Public render failures should include enough request ID context for support to investigate.

### Tracking Observability

Tracking ingest should expose:

- Accepted events.
- Rejected events by reason.
- Bot-filtered events.
- Invalid schema version events.
- Rate-limited events.
- Batch sizes.
- Ingest latency.
- Aggregation lag.
- Event processing lag.

Rules:

- Tracking telemetry should not become a second copy of raw tracking data.
- Do not put anonymous visitor IDs into metrics labels.
- Sampling can apply to diagnostic logs but not to aggregate counters needed for operations.

### Audit Logs vs Diagnostic Logs

Audit logs answer "who changed what important thing?" Diagnostic logs answer "what happened in the system?"

Rules:

- Do not use diagnostic logs as the source of truth for audit.
- Do not expose diagnostic logs to customers.
- Do not put customer content in audit metadata unless the audit event explicitly requires a safe summary.
- Audit retention and diagnostic log retention can differ.
- Audit events should be queryable by workspace and target resource.

## Rate Limiting, Throttling, And Cost Controls

Rate limits should protect Lightsite from abuse, accidental loops, provider costs, and noisy clients without harming normal sales workflows. The app has several high-risk surfaces: signup, invites, slug checks, logo fetching, uploads, publishing, tracking ingest, public rendering, and realtime collaboration.

The goal is to enforce limits at the right layer with clear user feedback and privacy-safe keys.

### Rate Limit Principles

Rules:

- Rate limits are enforced server-side.
- Frontend debounce improves UX but is not protection.
- Public endpoints need stricter abuse controls than authenticated app endpoints.
- Limits should be scoped to the smallest meaningful actor.
- Limit keys should avoid raw personal data.
- Costly provider calls should have their own limit.
- Rate limit responses use stable error codes and retry hints.
- Limits should be configurable per environment.

### Limit Key Strategy

Potential limit keys:

- User ID.
- Workspace ID.
- Site ID.
- IP hash.
- Session ID.
- Invite email hash.
- Domain hash.
- Public route token hash.
- Provider account ID.

Rules:

- Do not store raw IP as a long-lived rate limit key unless legally reviewed.
- Hash email/domain keys where raw value is not needed.
- Combine keys for sensitive flows, such as user plus workspace plus action.
- Avoid keys that let one public visitor block an entire customer workspace unless the abuse risk requires it.
- For authenticated routes, prefer user/workspace keys over IP-only keys.

### Signup And Auth Limits

Limit:

- Signup attempts by email hash and IP hash.
- Login attempts by email hash and IP hash.
- Password reset requests by email hash.
- Email verification resend.
- Invite acceptance attempts by token hash/IP hash.

Rules:

- Work email validation should happen before creating expensive downstream work.
- Personal email and plus-alias rejections should not trigger provider emails.
- Do not reveal whether an email already has an account through rate limit messaging.
- Auth limits should work with BetterAuth rather than fighting it.

### Slug Availability Limits

Workspace and site slug availability checks are easy to spam.

Rules:

- Client debounces checks.
- Server rate-limits by user/workspace/IP hash.
- Availability endpoint should do only normalization, reserved-word check, and indexed uniqueness lookup.
- Do not perform expensive side effects in availability checks.
- Save endpoint must enforce uniqueness again through database constraint.

### logo.dev Limits

Logo fetching can create external provider cost and latency.

Rules:

- Fetch logos server-side only.
- Cache successful logo lookups by normalized domain and theme/size.
- Cache failed lookups for a short TTL to prevent repeated misses.
- Rate-limit lookup attempts by user/workspace/domain hash.
- Do not block workspace setup on logo fetch failure.
- Do not expose provider error detail directly to the client.

### Invite And Email Limits

Limit:

- Invites created per workspace per hour/day.
- Invites to the same email per day.
- Invite resend frequency.
- Verification email resend frequency.
- Notification email bursts.

Rules:

- Idempotently reuse pending invites where appropriate.
- Do not let a user spam arbitrary domains before work email validation.
- Email jobs should dedupe where possible.
- Email failures should not cause tight retry loops.

### Upload Limits

Limit:

- Upload initiation by user/workspace.
- Upload size by plan and technical maximum.
- Concurrent uploads per user.
- Total storage per workspace.
- Accepted MIME types.

Rules:

- Validate size and MIME before issuing upload credentials.
- Revalidate upload metadata after upload completion.
- Do not process unbounded images.
- Use image dimension limits in addition to byte limits.
- Failed or abandoned uploads should be cleaned up.

### Publish Limits

Publishing can trigger validation, version creation, cache invalidation, and jobs.

Limit:

- Publish attempts per site per minute.
- Publish attempts per workspace per hour.
- Cache invalidation frequency per public URL.
- Republish attempts for unchanged drafts.

Rules:

- Do not create duplicate versions for identical publish payloads unless explicitly useful.
- Publish validation can run more often than publish, but should still avoid expensive repeated work.
- Rate-limited publish should preserve draft changes.
- Publish rate limits should be generous enough for normal iteration.

### Tracking Ingest Limits

Tracking ingest needs high throughput but must resist abuse.

Limit dimensions:

- Site/variant.
- Public route token.
- IP hash.
- Session ID.
- Batch size.
- Event count per session.
- Payload byte size.

Rules:

- Accept batches to reduce request count.
- Reject oversized batches early.
- Drop or sample noisy low-value event types if necessary before impacting critical events.
- Bot/link-preview traffic should be classified separately from human engagement.
- Rate limiting should not allow one bad visitor to disable all analytics for a customer site unless abuse is severe.
- Store rejection counters for visibility.

### Public Render Limits

Public pages should stay available even under noisy traffic.

Rules:

- Put CDN caching in front of public pages where possible.
- Rate-limit uncached origin requests by IP hash/hostname/path.
- Keep route resolution indexed and cheap.
- Avoid expensive per-request personalization in V1.
- Serve cached 404s carefully so newly published pages appear quickly.
- Use stale-while-revalidate if supported and safe.

### Realtime Limits

Realtime collaboration can become costly if presence and operations are too chatty.

Limit:

- Active rooms per user.
- Connections per user.
- Connections per site.
- Presence update frequency.
- Operation batch frequency.
- Operation payload size.
- Reconnect rate.

Rules:

- Presence is ephemeral and low-priority.
- Content operations are validated and batched.
- Idle clients should reduce presence frequency or disconnect.
- Reconnect storms should back off.
- Permission revocation should close or downgrade sessions promptly.

### Rate Limit UX

User-facing rate limit copy should be calm and specific enough to help.

Rules:

- Show retry time when available.
- Preserve user input.
- Do not blame the user.
- For background operations, show queued/degraded state where applicable.
- For public pages, prefer generic unavailable or try-again behavior.
- For auth routes, avoid account enumeration.

### Rate Limit Testing

Tests should cover:

- Limit key construction.
- Boundary behavior at exact limit.
- Retry-after values.
- Cross-workspace isolation.
- Auth rate limits without enumeration.
- Slug save uniqueness despite availability race.
- Tracking oversized batch rejection.
- Upload completion revalidation.
- Realtime reconnect backoff.

## Backup, Restore, And Disaster Recovery

Backups are not a checkbox. Lightsite will host customer-facing public pages and collect engagement data, so recovery must be designed before production usage creates pressure.

The goal is to recover from accidental deletion, bad migrations, provider outages, corrupted content, compromised credentials, and regional/platform failures with clear tradeoffs.

### Recovery Objectives

Define launch targets:

- Production database RPO: 15 minutes or better if managed Postgres makes this affordable.
- Production database RTO: same day for full restore, faster for point-in-time rollback when supported.
- Public page availability RTO: minutes for app-level issues, longer only for provider/regional failures.
- Asset recovery RPO: match storage provider versioning/backup capability.
- Config/secret recovery: documented through hosting provider and secret manager.

Rules:

- RPO/RTO targets should be documented per environment.
- Do not claim enterprise recovery guarantees until tested.
- Test restore procedures before relying on them.

### Backup Scope

Back up:

- Postgres database.
- Uploaded assets needed for public pages and version restore.
- Published render payloads if stored outside Postgres.
- Job queue state if jobs are not safely reconstructable.
- Configuration metadata, not secret values in repo.
- Deployment manifests/infrastructure configuration.

Do not treat as sufficient backups:

- User exports.
- Site version history.
- CDN cache.
- Browser local recovery.
- Logs.

### Database Backups

Rules:

- Use managed Postgres automated backups in production.
- Enable point-in-time recovery where affordable.
- Keep staging backups separate from production.
- Encrypt backups at rest.
- Restrict backup access.
- Document restore steps.
- Run restore drills on a schedule.
- Verify restored database migrations can run forward.

### Asset Backups

Rules:

- Use storage versioning or lifecycle protection for assets referenced by published pages and restorable versions.
- Do not delete assets that are referenced by retained site versions.
- Keep object keys stable and non-guessable.
- Store enough metadata in Postgres to verify asset ownership and restore references.
- Test restoring a published site with assets from backup.

### Restore Procedures

Restore procedures should cover:

- Full environment restore.
- Point-in-time database restore.
- Single workspace recovery where feasible.
- Single site accidental deletion recovery.
- Asset restore.
- Published page restore after bad deploy.
- Content schema migration rollback/forward recovery.

Rules:

- Full restore should be documented step-by-step.
- Single-resource recovery should be treated as an admin/support operation with audit.
- Restores should not silently overwrite newer customer changes without explicit decision.
- If restoring from backup into production, isolate and validate before cutover.

### Corruption Recovery

Possible corruption cases:

- Bad editor operation creates invalid draft content.
- Bad content migration creates invalid documents.
- Publish bug creates invalid published payload.
- Tracking aggregation bug creates wrong summaries.
- Asset processing bug creates broken optimized images.

Recovery rules:

- Draft corruption: use last valid autosave/checkpoint/version where available.
- Published corruption: keep previous published snapshot and roll forward with corrected renderer or snapshot pointer.
- Migration corruption: stop rollout, preserve raw old payloads, run fixed migration.
- Analytics corruption: rebuild aggregates from retained raw/normalized events.
- Asset derivative corruption: regenerate derivatives from original asset.

### Disaster Scenarios

Runbooks should exist for:

- Database unavailable.
- Database data corruption.
- Public renderer outage.
- API outage.
- Worker outage.
- Tracking ingest outage.
- Storage provider outage.
- Email provider outage.
- Realtime provider outage.
- Bad deployment.
- Secret leak.
- Account/workspace compromise.

Each runbook should include:

- Detection signals.
- Immediate mitigation.
- Customer impact.
- Data risk.
- Recovery steps.
- Validation steps.
- Communication owner.
- Post-incident follow-up.

### Restore Testing

Test:

- Empty database migrations.
- Restore from backup into staging.
- Point-in-time restore if supported.
- Public page rendering after restore.
- Asset availability after restore.
- Version rollback after restore.
- Tracking dashboard after aggregate rebuild.
- Auth/session behavior after restore.

Rules:

- A backup that has never been restored is only a hope.
- Restore tests should be scheduled before meaningful customer usage.
- Record restore duration and issues.

## Privacy, Consent, And Data Governance

Lightsite should be privacy-conscious by design because the product combines user accounts, workspace collaboration, uploaded sales content, public links, and prospect engagement tracking.

The practical standard: collect what is needed, explain it honestly, avoid surprising tracking, keep data scoped, and make deletion/retention behavior predictable.

### Data Categories

Classify data into:

- User account data: name, work email, avatar, preferences.
- Workspace data: company name, slug, website, logo.
- Team data: memberships, roles, invites.
- Site content: draft blocks, rich text, variables, assets.
- Published public content: immutable snapshots and public assets.
- Recipient/prospect data: names or labels entered for variants/links if added.
- Visitor analytics: session, page views, clicks, scroll, time spent, bot classification.
- Operational data: logs, metrics, traces, jobs.
- Audit/security data: important actions and security events.
- Billing data later.

Rules:

- Each category should have an owner, retention policy, and access policy.
- Avoid mixing operational telemetry with customer analytics.
- Avoid storing recipient/prospect personal data unless it serves a clear product workflow.

### Data Minimization

Rules:

- Do not track keystrokes, mouse movement, text selection, or form input content.
- Do not collect full IP addresses unless a reviewed security need exists.
- Prefer IP hashing or coarse geolocation if location is needed later.
- Do not set long-lived cross-site identifiers for public tracking in V1.
- Do not use tracking data for unrelated advertising.
- Do not expose visitor-level data beyond what the product promises.
- Do not collect calendar booking details unless an integration explicitly requires it.

### Public Tracking Disclosure

Public pages should have honest tracking behavior.

Rules:

- Privacy policy should disclose page view, time spent, scroll depth, click tracking, and link preview/bot detection.
- If cookies are used, document cookie names and purpose.
- Prefer session storage or memory-based session IDs where product needs allow.
- If target markets require consent banners for analytics, add consent-aware tracking modes before launch in those markets.
- Tracking should degrade gracefully when blocked by browser/privacy tools.

### Consent Modes

Support explicit tracking modes in configuration even if V1 uses one default:

```txt
tracking_mode = off | essential_only | engagement
```

Meaning:

- `off`: no visitor engagement events, public page still renders.
- `essential_only`: minimal operational events only, no prospect engagement dashboard.
- `engagement`: page views, time, scroll, and click events according to policy.

Rules:

- V1 tracking mode is controlled by system/workspace policy, not by a broad customer-facing settings surface.
- Public page renderer should know whether to include the tracking script.
- Tracking ingest should reject events when tracking is disabled for the site/workspace.
- Disabling tracking should not break public page rendering.

### Access To Personal Data

Rules:

- Workspace admins can see workspace/team data.
- Site editors can see site content and analytics according to access policy.
- Internal support sees metadata only by default.
- Internal content access requires explicit future support-access workflow.
- Public visitors cannot access non-public data.
- Exports containing personal or visitor data require admin permission or a clearly defined permission.

### Deletion And Redaction

Deletion behavior should be explicit:

- User account deletion may anonymize authorship while preserving workspace audit records where legally allowed.
- Workspace deletion schedules workspace-owned data for deletion.
- Site deletion follows workspace retention/recovery policy.
- Tracking deletion follows retention policy and privacy deletion requests.
- Recipient/prospect deletion should remove or redact identifying metadata while preserving aggregate analytics when allowed.
- Audit/security logs may be retained for legitimate security/accounting needs.

Rules:

- Deletion jobs should be idempotent.
- Deletion should not break retained audit references; use anonymized display where needed.
- Public pages should stop serving immediately when a site/workspace is deleted or suspended, even if hard deletion is scheduled later.

### Data Residency And Subprocessors

V1 does not need enterprise data residency, but architecture should avoid making it impossible.

Rules:

- Document primary hosting region.
- Document key subprocessors: hosting, database, storage, email, observability, logo.dev, billing later.
- Do not scatter customer data across unnecessary providers.
- Do not send site content to providers that do not need it.
- If AI features are added later, add a separate data-use policy and opt-in/setting review.

### Privacy Testing

Tests and reviews should cover:

- Public payload excludes draft/private fields.
- Tracking events do not include content text.
- Logs redact tokens and emails where required.
- Exports require permission.
- Deleted/unpublished pages do not render.
- Tracking disabled mode prevents script inclusion and ingest acceptance.
- User deletion anonymizes or removes expected fields.
- Support/admin access is audited.

## Domain State Machines And Transition Guards

Lightsite should model product state explicitly. Booleans are useful for simple flags, but core lifecycle state should not be implied from scattered nullable timestamps or UI assumptions. Every important state transition should have a named command, validation rules, permission rules, side effects, and tests.

The goal is to make invalid states hard to create and easy to diagnose.

### State Machine Principles

Rules:

- Each lifecycle has a single canonical state field unless there is a strong reason not to.
- Timestamps describe when transitions happened; they do not replace the canonical state.
- Transition commands should live in services/use-cases, not UI components.
- Every transition checks permissions server-side.
- Every transition validates current state before changing state.
- Every transition should be idempotent when safe or return a clear conflict when repeated.
- Every important transition emits audit/domain events after commit.
- UI labels can be friendly, but backend state names should be stable.

### Workspace State

Canonical workspace states:

```txt
active
suspended
scheduled_for_deletion
deleted
```

Allowed transitions:

| From | To | Command | Notes |
| --- | --- | --- | --- |
| active | suspended | suspendWorkspace | Internal/admin or billing/support action |
| suspended | active | restoreWorkspace | Internal/admin or support action |
| active | scheduled_for_deletion | scheduleWorkspaceDeletion | Admin/support controlled |
| suspended | scheduled_for_deletion | scheduleWorkspaceDeletion | Admin/support controlled |
| scheduled_for_deletion | active | cancelWorkspaceDeletion | Only before deletion deadline |
| scheduled_for_deletion | deleted | finalizeWorkspaceDeletion | Background job |

Rules:

- Public pages fail closed for suspended, scheduled-for-deletion, and deleted workspaces in V1. Any later exception requires an explicit product/security decision and tests.
- Authenticated app access stops for scheduled-for-deletion workspaces except recovery/admin surfaces.
- Workspace slug remains reserved for all retained and deleted/reserved states.
- Final deletion should happen through a job that is idempotent and auditable.
- Billing cancellation later should not hard-delete workspace data inline.

Invalid states:

- Workspace has no active admin.
- Workspace is `active` but setup completion fields are missing.
- Workspace is `deleted` but public routes still resolve.
- Workspace slug is reusable while any old public link may exist.

### Workspace Membership State

Canonical membership states:

```txt
active
removed
left
deactivated
```

Rules:

- Only active memberships grant workspace access.
- Removed/left/deactivated memberships should not grant site access even if site access rows remain.
- Role changes apply only to active memberships.
- Last-admin protection applies before any transition that would remove or downgrade an active admin.
- Historical membership rows can remain for audit and attribution.

Allowed transitions:

| From | To | Command |
| --- | --- | --- |
| active | removed | removeWorkspaceMember |
| active | left | leaveWorkspace |
| active | deactivated | deactivateUserMembership |
| removed | active | reinstateMember, admin/support only if product supports it |
| left | active | rejoinViaInvite |

Transition guard examples:

- `leaveWorkspace` is blocked when actor is the last active admin.
- `removeWorkspaceMember` is blocked when target is the last active admin.
- `changeMemberRole(admin -> user)` is blocked when target is the last active admin.
- Removing a member invalidates realtime sessions and app query caches for that user/workspace.

### Invite State

Canonical invite states:

```txt
pending
accepted
revoked
expired
```

Rules:

- Only `pending` invites can be accepted, revoked, or resent.
- Invite token hashes are single-use.
- Accepting an invite creates or activates workspace membership in the same transaction.
- Invite acceptance requires account email to match normalized invited email.
- Expired invites cannot be accepted even if token hash exists.
- Revoked invites should not send future emails.

Allowed transitions:

| From | To | Command |
| --- | --- | --- |
| pending | accepted | acceptInvite |
| pending | revoked | revokeInvite |
| pending | expired | expireInvite |
| expired | pending | recreateInvite or resendAsNewInvite |
| revoked | pending | recreateInvite |

Race handling:

- Two accept attempts for the same token should result in one accepted membership and one stable conflict/already-accepted response.
- Revoke and accept racing should be resolved transactionally. Whichever commits first wins; the other receives a stable conflict.
- Resending an invite should not create duplicate pending invite rows for the same email/workspace.

### Site State

Canonical site states:

```txt
draft
published
archived
```

Rules:

- `draft` means no public page is live.
- `published` means `publishedVersionId` is non-null and points to an immutable publish version.
- `archived` means hidden from active lists, not editable, not publicly served, and not accepting new tracking.
- Archived sites retain slugs, versions, variants, assets, access rows, and analytics.
- Restoring an archived site returns it to `draft`, not directly to `published`.

Allowed transitions:

| From | To | Command | Side Effect |
| --- | --- | --- | --- |
| draft | published | publishSite | Create publish version, update pointer, invalidate cache |
| published | published | republishSite | Create new publish version, update pointer, invalidate cache |
| published | draft | unpublishSite | Clear public availability, invalidate cache |
| draft | archived | archiveSite | Hide from active lists |
| published | archived | archiveSite | Disable public page and tracking |
| archived | draft | restoreSite | Restore app editability |

Blocked transitions:

- `archived -> published` directly.
- `draft -> draft` publish-like no-op that creates a version without content changes unless a manual checkpoint command exists.
- `published -> published` without a new publish version.
- Editing archived site content.
- Tracking archived site visits as active engagement.

Invalid states:

- `published` without `publishedVersionId`.
- `draft` with public route resolving as live.
- `archived` with public route resolving as live.
- `publishedVersionId` points to a mutable or non-publish snapshot.

### Published Snapshot State

Published snapshots are immutable records, but the pointer from a site to the current snapshot changes.

Rules:

- Publish creates a new immutable version/snapshot record.
- Republish creates a new immutable version/snapshot record.
- Rollback restores old content into draft; it does not move the public pointer.
- Public renderer reads only the current published pointer.
- Current published version must never be pruned.
- Public cache keys include published version ID.

Commands:

- `createPublishVersion`
- `activatePublishedVersion`
- `deactivatePublishedVersion`
- `restoreVersionToDraft`

Guardrails:

- Never mutate snapshot payload in place.
- Public routes render only published snapshot payloads.
- Never delete assets required by retained published snapshots.

### Variant State

V1 variant states:

```txt
active
deleted
```

Rules:

- Active variants can resolve publicly only while parent site is published.
- Deleted variants do not resolve publicly.
- Deleted variants remain retained for analytics attribution.
- Variant slug remains reserved after deletion.
- Variant slug changes reserve the old slug as a tombstone.
- Variant value changes are live configuration and increment `revisionNumber`.

Allowed transitions:

| From | To | Command |
| --- | --- | --- |
| active | active | updateVariant |
| active | deleted | deleteVariant |

Blocked transitions:

- Create variant with a slug used by an active variant, deleted variant, or slug reservation.
- Restore deleted variant without explicit restore design.
- Reuse a reserved old variant slug.
- Update variant if parent site is archived or actor lacks edit permission.

### Asset And Upload State

Canonical asset/upload states:

```txt
pending_upload
uploaded
processing
ready
rejected
deleted
```

Rules:

- Only `ready` assets can be used in published public pages.
- Upload initiation creates a pending asset record.
- Upload completion verifies object existence, size, MIME, workspace ownership, and intended use.
- Processing creates derivatives but does not change ownership.
- Rejected assets cannot be attached to publishable content.
- Deleted assets cannot be attached to new content.
- Assets referenced by retained published snapshots or restorable versions cannot be hard-deleted.

Allowed transitions:

| From | To | Command |
| --- | --- | --- |
| pending_upload | uploaded | completeUpload |
| uploaded | processing | startAssetProcessing |
| processing | ready | markAssetReady |
| uploaded | ready | markAssetReady, if no processing needed |
| pending_upload | rejected | rejectUpload |
| uploaded | rejected | rejectAsset |
| ready | deleted | deleteAsset, only if not live/restorable |

Failure handling:

- Abandoned pending uploads are cleaned by scheduled job.
- Processing failures move to `rejected` or `processing_failed` if separate state is needed.
- Public renderer must have fallback behavior for missing optional assets and block publish for required missing assets.

### Job State

Canonical job states:

```txt
queued
running
succeeded
failed_retryable
failed_permanent
dead
cancelled
```

Rules:

- Jobs are claimed atomically.
- Running jobs have a lease/heartbeat.
- Stale running jobs can return to queued if lease expires.
- Retryable failures back off.
- Permanent failures do not retry endlessly.
- Dead jobs require inspection or automated dead-letter handling.
- Jobs that change business state must be idempotent.

Invalid states:

- Job is `succeeded` but side effect did not happen and cannot be reconstructed.
- Job is retried with a different idempotency identity.
- Job payload contains stale copied content when canonical IDs should be reloaded.

### Tracking Session State

Canonical tracking session states:

```txt
active
ended
expired
bot_filtered
discarded
```

Rules:

- Human engagement summaries include active/ended sessions, not bot-filtered/discarded sessions.
- Bot preview requests create preview events, not normal visitor sessions unless a real page view occurs.
- Session end can be inferred by heartbeat timeout.
- Server receive time is canonical for ordering.
- Anonymous visitor/session identifiers must not become global cross-workspace identities.

Transition examples:

- `active -> ended` when explicit unload/beacon or timeout summary exists.
- `active -> expired` when no close event arrives.
- `active -> bot_filtered` if later classification determines it is a bot.
- `active -> discarded` if payload is invalid or policy disallows tracking.

### Moderation State

Moderation should remain separate from normal site status.

Canonical moderation states:

```txt
clear
flagged
taken_down
appeal_pending
restored
```

Rules:

- Moderation takedown can block public rendering even if site status is `published`.
- Moderation state should not mutate draft/published content.
- Internal moderation actions require internal permission and audit.
- Restoration should return to the prior product state when safe.

### State Machine Testing

Tests should cover:

- Every allowed transition.
- Every blocked transition.
- Permission failure for each sensitive transition.
- Idempotent repeat behavior.
- Racing transitions, especially invite accept/revoke, publish/archive, slug change/create, and member removal/role change.
- Audit/domain events emitted only after successful commit.
- Public route behavior after state changes.
- Realtime session behavior after permission/state changes.

## Transactional Side Effects, Outbox, And Domain Events

Lightsite should not perform important side effects inline before the database transaction commits. Publishing, invites, cache invalidation, tracking aggregation, email, asset processing, analytics summaries, and realtime notifications all need reliable handoff without creating duplicate side effects.

Use a transactional outbox pattern for business events that need post-commit processing.

### Side Effect Principles

Rules:

- Database state changes happen first and commit atomically.
- Side effects are represented as durable outbox events/jobs in the same transaction.
- Workers process outbox events after commit.
- Side effects are idempotent.
- Dispatch failure should not corrupt core state.
- Core state should be reconstructable from database records even if a side effect is delayed.
- External network calls should not happen inside database transactions.
- Realtime notifications can be fast, but canonical recovery should come from refetching persisted state.

### Outbox Table

Recommended table:

```text
outbox_events
- id uuid primary key
- workspace_id uuid nullable
- aggregate_type varchar not null
- aggregate_id uuid not null
- event_type varchar not null
- event_version integer not null
- payload jsonb not null default {}
- idempotency_key text nullable unique
- status outbox_event_status not null default queued
- available_at timestamptz not null
- attempts integer not null default 0
- last_error_code varchar nullable
- last_error_message text nullable
- created_at timestamptz not null
- processed_at timestamptz nullable
```

Statuses:

```txt
queued
processing
processed
failed_retryable
failed_permanent
dead
cancelled
```

Rules:

- Payloads contain IDs and small metadata, not full site content unless the event is explicitly a versioned export/render payload job.
- Event payloads should include schema version.
- Outbox rows are created inside the same transaction as the business change.
- Workers claim rows atomically.
- Processed rows can be retained for debugging for a defined retention period.
- Dead rows should be visible in internal admin/developer tooling.

### Domain Event Naming

Domain events should be named in product language:

```txt
workspace.created
workspace.updated
workspace.suspended
workspace.restored
workspace.deletion_scheduled

member.invited
member.invite_accepted
member.invite_revoked
member.role_changed
member.removed

site.created
site.updated
site.published
site.unpublished
site.archived
site.restored
site.version_restored_to_draft
site.access_changed

variant.created
variant.updated
variant.slug_reserved
variant.deleted

asset.upload_completed
asset.ready
asset.rejected
asset.deleted

tracking.event_ingested
tracking.summary_window_due

email.requested
cache.public_route_invalidated
```

Rules:

- Event names are stable.
- Event versions increment when payload semantics change.
- Do not reuse an event name for a different meaning.
- Event payloads should include actor where relevant.
- Audit events and outbox events can be created from the same command, but they are not the same thing.

### Publish Side Effects

Publishing should create outbox events for:

- Public route cache invalidation.
- Public route warmup if useful.
- Realtime editor notification.
- Activity feed/audit visibility.
- Search/list summary update if a read model exists.

Rules:

- Publish transaction creates immutable version and updates site pointer before outbox dispatch.
- Cache invalidation event references site ID and published version ID.
- Public route correctness must not depend only on cache invalidation; origin still checks current state.
- If cache invalidation fails, public origin should still render correct content after cache TTL or manual purge.

### Variant Side Effects

Variant create/update/delete should create outbox events for:

- Public route cache invalidation for that variant.
- Activity/audit visibility.
- Analytics metadata refresh if summaries denormalize variant name/company.

Rules:

- Variant update increments `revisionNumber` before invalidation.
- Cache invalidation references site ID, variant ID, old revision, and new revision.
- Slug changes create slug reservation in the transaction and invalidate old/new route paths.
- Deleted variant routes return 404 even if old cache has content; origin check is authoritative.

### Invite And Email Side Effects

Invite creation should:

- Create invite row.
- Create outbox event/job for invite email.
- Return UI state without waiting on email provider.

Rules:

- Email send job reloads invite state before sending.
- If invite is revoked/accepted before send, job no-ops.
- Provider message ID is recorded.
- Retry transient failures.
- Permanent email failures should be visible to admins with resend action.

### Tracking Side Effects

Tracking ingest should keep synchronous work minimal:

- Validate payload.
- Classify bot/preview client.
- Insert raw/normalized event.
- Enqueue summary aggregation when needed.

Rules:

- Summary aggregation is not performed inline for every event.
- Aggregation jobs should dedupe by site/window/event type.
- Late events should update recent windows.
- Rejected events should emit counters, not outbox rows unless investigation is needed.

### Realtime Side Effects

Realtime notifications are useful, but they are not canonical persistence.

Rules:

- Mutations that affect active editors should enqueue or publish a post-commit notification.
- If realtime notification fails, clients eventually recover by refetching.
- Notifications should include resource IDs and versions/revisions.
- Do not include full draft content in broad notifications.
- Permission/state changes should notify affected clients to refetch or downgrade to read-only.

### Outbox Dispatching

Worker behavior:

1. Claim queued event with lease.
2. Mark processing.
3. Execute handler idempotently.
4. Mark processed or retry/fail.
5. Record attempts and error code.

Rules:

- Handlers should be small and owned by feature modules.
- Handler errors should be classified as retryable/permanent.
- Provider calls should use provider idempotency when available.
- Workers should limit concurrency per event type if order matters.
- Events for the same aggregate can be processed in order where necessary, but avoid global ordering requirements.

### Outbox Testing

Tests should cover:

- Business transaction creates expected outbox events.
- No outbox event is created when transaction fails.
- Duplicate processing does not duplicate external side effects.
- Handler reloads latest state before acting.
- Revoked invite email job no-ops.
- Publish cache invalidation handles deleted/archived state.
- Variant slug change invalidates old and new paths.
- Dead-letter behavior is visible.

## Data Access Layer, Workspace Isolation, And Query Ownership

Lightsite is a multi-workspace app. The data access layer should make cross-workspace leaks difficult, not merely unlikely. Workspace scoping, permission checks, and resource ownership should be encoded in repositories/query helpers and service boundaries.

The goal is simple: a route should not be able to accidentally load or mutate another workspace's data because a developer forgot one `where` clause.

### Data Access Principles

Rules:

- Feature modules own their repositories/queries.
- Repositories return domain records or persistence DTOs, not API response shapes.
- Route handlers do not assemble complex SQL directly.
- Services coordinate transactions, permissions, and repository calls.
- Every workspace-owned query is scoped by workspace ID directly or through a verified parent.
- Cross-workspace admin/support queries live in internal modules only.
- Public route queries are separate from authenticated app queries.
- Tracking ingest writes are separate from analytics read queries.

### Request-Scoped Database Context

Authenticated request context should include:

- User ID.
- Active workspace ID.
- Membership ID.
- Workspace role.
- Request ID.
- Transaction handle when inside a transaction.

Repository functions should accept a context object rather than raw global database access when they need tenant scope.

Example:

```ts
type WorkspaceDbContext = {
  db: DbClient
  workspaceId: WorkspaceId
  requestId: string
}
```

Rules:

- Do not let arbitrary route code pass a client-supplied workspace ID into repository methods.
- Resolve active workspace and membership before creating workspace-scoped context.
- Public route context is separate and does not include membership.
- Internal support context must be explicit and audited.

### Repository Function Patterns

Preferred pattern:

```ts
sitesRepository.getByIdForWorkspace(ctx, siteId)
sitesRepository.listAccessibleForMember(ctx, memberId, filters)
sitesRepository.getPublishedBySlugs(publicCtx, workspaceSlug, siteSlug)
```

Avoid:

```ts
sitesRepository.getById(siteId)
```

unless the function is internal, clearly named, and used only after ownership has already been verified.

Rules:

- Function names should communicate scoping.
- Write methods should require workspace-scoped context.
- Public read methods should return public-safe projections only.
- Internal unscoped methods should be rare and prefixed/namespaced as internal.

### Tenant Isolation

Isolation rules:

- Workspace-owned tables include `workspace_id` where useful for direct scoping.
- Joins should include workspace constraints on both parent and child when practical.
- Public slugs resolve to workspace first, then site, then variant.
- Analytics queries always scope by workspace and site/variant filters.
- Asset access validates workspace ownership before returning signed upload/read details.
- Background jobs reload records by ID and verify expected workspace/state before acting.

Optional database-level protection:

- Postgres Row Level Security can be considered later, but should not be introduced casually.
- If RLS is used, app-level permission checks still remain for product behavior and UX.
- Without RLS, repository/service tests must aggressively cover cross-workspace isolation.

### Read Models And Projections

Some pages need efficient list data that differs from normalized write models.

Read models can be useful for:

- Sites table summaries.
- Tracking dashboards.
- Workspace switcher summaries.
- Asset library summaries.
- Variant list summaries.

Rules:

- Read models are derived, not canonical.
- Rebuild path must exist.
- Read model updates should happen through outbox/jobs or transactionally where simple.
- UI can tolerate slightly stale read models, but backend enforcement cannot.
- Do not enforce permissions or plan limits from stale read models.

### JSONB Access Rules

Content JSON is useful, but it must not become an unqueryable dumping ground for core relationships.

Rules:

- Core ownership and lifecycle fields live in relational columns.
- JSONB content includes schema version.
- JSONB documents are validated before write and publish.
- Queries should not depend heavily on deep JSON paths unless indexed and intentional.
- Variable/asset references inside JSON should be validated against relational records.
- Migrations should operate through content schema migration functions, not arbitrary string replacement.

### Transaction Ownership

Service functions should own transaction boundaries for business commands.

Rules:

- Route handlers call one service command per business action where possible.
- Repositories should not start nested transactions without explicit pattern support.
- External provider calls happen after commit via outbox/jobs.
- Audit/outbox rows are inserted inside the same transaction as the business change.
- Transaction functions should return durable IDs and versions/revisions needed by the caller.

### Data Access Testing

Tests should cover:

- Cross-workspace reads fail.
- Cross-workspace writes fail.
- Public projections exclude private fields.
- Repository scoping cannot be bypassed accidentally.
- Background job reload verifies workspace/state.
- Asset ownership checks.
- Analytics queries do not leak across sites/workspaces.
- Internal support queries require internal context and audit.

## Public Link Integrity, Canonicalization, Reservations, And Redirect Readiness

Public links are the product's output. Sales teams will paste them into emails, Slack, CRM notes, and follow-ups. Old links should never accidentally resolve to the wrong customer, site, or recipient. Link integrity matters more than convenience.

V1 should be conservative: lock or reserve identifiers rather than implementing complex redirects too early.

### Public Identifier Rules

Public identifiers:

- Workspace slug.
- Site slug.
- Variant slug.
- Custom domain later.

Rules:

- Slugs are normalized to lowercase ASCII.
- Slugs reject reserved words.
- Slugs reject path traversal and ambiguous characters.
- Slugs are unique in their scope.
- Slugs remain reserved while records are retained.
- Slugs that previously resolved to a prospect-specific variant should not be reused for a different recipient.
- Public routes should canonicalize casing with redirect only when safe.

### Canonical URL Generation

Canonical URL generation should happen through one helper/module.

Inputs:

- Environment public site base URL.
- Workspace slug or custom domain.
- Site slug.
- Optional variant slug.

Rules:

- Do not hand-build public URLs in components.
- Share modal, email templates, tracking payloads, and public metadata should use the same helper.
- Canonical URLs should omit tracking identifiers by default.
- UTM parameters, if added later, should be explicit and not part of route identity.
- Query params should never be required to resolve the site/variant.

### Route Resolution Order

Default domain route resolution:

1. Normalize path segments.
2. Reject reserved/global routes.
3. Resolve workspace by slug.
4. Verify workspace public availability.
5. Resolve site by slug within workspace.
6. Verify site public availability and moderation state.
7. Resolve variant by slug if present.
8. Verify variant is active and not tombstoned.
9. Load published snapshot.
10. Render public-safe payload.

Rules:

- Reserved/tombstoned slugs return public-safe 404.
- Unpublished/archived/deleted/taken-down pages return public-safe 404.
- Public route should not reveal which part of resolution failed.
- Tracking should start only after successful resolution.

### Reservation Records

Reservation records protect old public identifiers.

Use reservations for:

- Variant old slugs after slug change.
- Variant slugs after soft deletion.
- Workspace slugs after hard purge if public links may have existed.
- Site slugs after hard purge if public links may have existed.

Rules:

- Reservation rows are scoped to the appropriate parent.
- Reservation creation happens in the same transaction as slug change/delete.
- Availability checks include reservation tables.
- Public routes treat reservations as unavailable.
- Admin/support tooling can inspect reservation reason.

### Redirect Policy

V1 redirect policy:

- No workspace slug redirects.
- No site slug redirects for published sites.
- No variant slug redirects.
- Workspace slug changes are blocked after any site has been published.
- Site slug changes are blocked while the site is published.
- Variant slug changes are allowed with confirmation, but old slug returns 404 and remains reserved.

Why:

- Redirects create attribution, privacy, cache, and ownership complexity.
- Variant redirects could silently route a prospect-specific old link to changed personalization.
- Blocking/reserving is safer until redirect support is designed.

### Redirect-Ready Design

If redirects are added later, they should use explicit tables:

```text
workspace_slug_redirects
site_slug_redirects
variant_slug_redirects
```

Rules:

- Redirects are scoped to original owner/workspace/site.
- Redirects cannot cross workspace boundaries.
- Redirects have status, reason, created actor, and timestamps.
- Redirects are not created by default for variant changes without privacy review.
- Redirect loops are impossible by constraint or validation.
- Redirects preserve analytics attribution intentionally.
- Redirect cache rules are separate from page cache rules.

### Custom Domain Interaction

Custom domains add another public identifier layer.

Rules:

- Custom domain resolution should map hostname to workspace/site configuration before path resolution.
- Domain verification is required before activation.
- Domain ownership loss should disable routing after grace process.
- Custom domains should not bypass site publish/moderation/variant checks.
- Slug reservations still matter under custom domains when paths include site/variant slugs.
- A custom domain should not let one workspace serve another workspace's site by path trickery.

### Link Integrity Testing

Tests should cover:

- Uppercase path canonicalization.
- Reserved global route conflicts.
- Workspace slug conflict and reservation.
- Site slug conflict and archived-site reservation.
- Variant slug conflict and tombstone reservation.
- Variant old slug returns 404 after change.
- Deleted variant old slug returns 404.
- Published site slug cannot change.
- Workspace slug cannot change after public links exist.
- Public route does not reveal unpublished/archived/deleted state.
- Cache invalidation for publish/unpublish/archive/variant revision.
- Custom domain route ownership later.

## Frontend Routing, Navigation, And URL State Contracts

The frontend route layer should make workspace context, object identity, public links, loading states, and permission failures predictable. Routing should not become a pile of component-level redirects. Route behavior should be centralized enough that a user can switch workspaces, lose access, refresh a deep link, or open a stale URL without landing in a broken state.

The goal is to make every route answer four questions clearly:

- Who can load this route?
- What data does this route require?
- What URL state is shareable/persistent?
- What happens when access, workspace, or object state changes?

### Route Taxonomy

Lightsite has distinct route classes:

- Public marketing/auth routes.
- Auth routes.
- Account setup routes.
- Workspace setup routes.
- Authenticated workspace routes.
- Workspace admin/settings routes.
- Site object routes.
- Editor routes.
- Public site routes.
- Internal/developer routes.
- Design system/dev routes.

Rules:

- Public site routes must stay separate from authenticated app routes.
- Public site routes use slugs and public route resolution.
- Authenticated app routes use internal IDs after workspace context is resolved.
- Internal/developer routes require explicit internal access, not workspace admin.
- Design system routes should be development/internal only and must not load in public page bundles.
- Editor routes are heavy and should be route-split.

### Route Ownership

Each route should have an owner feature.

Recommended structure:

```txt
apps/web/src/routes/
  auth/
  onboarding/
  app/
  public-site/
  internal/

apps/web/src/features/<feature>/routes.tsx
```

Rules:

- Route files compose feature screens; they should not contain business logic.
- Feature screens own page-level layout and data requirements.
- Shared app shell owns sidebar/header/workspace chrome.
- Public site rendering uses a separate route tree and bundle boundary where possible.
- Route-level data loaders should call typed feature API functions.

### Auth And Workspace Guards

Guard order:

1. Resolve session.
2. Resolve current user.
3. Resolve account setup status.
4. Resolve active workspace or invite/onboarding context.
5. Resolve workspace membership.
6. Resolve route-specific resource.
7. Resolve route-specific permissions.

Rules:

- Login is not enough for workspace routes; active membership is required.
- Account setup should run before workspace setup.
- Invite acceptance can interrupt normal onboarding flow when the invite token is valid.
- If the user has no workspace and no valid invite, route to workspace setup.
- If the selected workspace is inaccessible, route to workspace selection/setup with a clear message.
- Public site routes do not depend on auth state.

### Workspace-Aware Navigation

Workspace switching is a route transition, not only a dropdown value change.

Rules:

- Switching workspace updates active workspace state server-side or in a durable user preference.
- Route compatibility is checked before preserving the current path.
- Generic workspace routes can stay on the same logical route:
  - `/sites`
  - `/tracking`
  - `/team`
  - `/settings`
- Object-specific routes should not carry object IDs across workspaces:
  - editor route
  - site detail
  - variant modal deep link
  - tracking filtered to a site
- When object route is incompatible, route to the equivalent list page in the new workspace.
- If the new workspace lacks permission for the current settings subroute, route to a safe settings overview or Sites page.
- Query caches should be workspace-keyed so data from the previous workspace cannot flash in the new workspace.

### Route Parameters

Rules:

- App route params that are IDs must be validated before use.
- Public route slug params must be normalized before route resolution.
- Query params must be parsed through typed schemas.
- Unknown query params should be ignored unless the route owns them.
- Invalid query params should fall back to defaults or show a safe validation state, depending on the route.
- Never pass raw route params into SQL/repository methods without validation and ownership resolution.

### URL State

Use URL state for state that should survive refresh or be shareable inside the app:

- Search query.
- Sort key.
- Sort direction.
- Filters.
- Pagination cursor when useful.
- Selected tab.
- Modal deep links only when they represent meaningful route state.
- Tracking date range.
- Site/variant analytics filter.

Do not use URL state for:

- Unsaved form values.
- Editor selection.
- Hover state.
- Drag state.
- Open dropdown menus.
- Raw tokens after they have been consumed.
- Sensitive values.

Rules:

- URL state schemas should live near the route.
- URL defaults should be stable.
- Query key construction should include URL state that affects server data.
- Copying a URL should not leak invite tokens, upload tokens, or private identifiers beyond what the route requires.

### Modal And Drawer Routing

Some surfaces can be modal states, but they should not become hidden routes with unclear behavior.

Modal route candidates:

- Create site.
- Share site.
- Variants list/edit.
- Site access.
- Version history.
- Invite teammate.
- Confirm destructive action.

Rules:

- A modal can be URL-addressable only when refresh/back/forward behavior is clear.
- Closing a URL-backed modal returns to the parent route.
- Browser back should close the modal before leaving the parent page.
- Non-URL modals should not affect route state.
- Avoid stacking modals. Replace modal content state or use a drawer/sheet for multi-step flows.
- Forms with unsaved changes should guard close/back/escape intentionally.

### Navigation Guards For Unsaved Work

Unsaved changes appear in:

- Editor draft operations not yet persisted.
- Variant edit form.
- Workspace settings form.
- Site settings form.
- Team invite form.
- Asset upload in progress.

Rules:

- Editor autosave should reduce the need for navigation blocking, but local unsaved/retryable changes still need protection.
- Form routes/modals should warn before close/navigation when dirty and not submitted.
- Browser unload guards should be used sparingly and only for real potential data loss.
- Route changes should attempt safe flush when possible.
- If flush fails, show clear recovery options rather than trapping the user indefinitely.

### Route Loading Strategy

Rules:

- App shell loads only session, user, active workspace, workspace switcher summary, and cheap nav metadata.
- Route screens load their own data.
- Heavy editor code is lazy-loaded only for editor routes.
- Tracking analytics charts are lazy-loaded below route shell.
- Public site bundle does not import editor, app shell, internal admin, or dashboard chart code.
- Route-level skeletons should match final layout dimensions to avoid jarring shifts.
- Critical route requests should start early through route loaders where the router supports it.

### Route Error Strategy

Route-level errors should be handled by class:

- `401`: route to login with safe return URL.
- `403`: show permission denied or route to a safe parent depending on existence-leak policy.
- `404`: show not found for missing/inaccessible object.
- `409`: show stale/conflict UI and refetch.
- `422`: show field errors for form routes.
- `429`: show rate-limit state with retry guidance.
- `5xx`: show retryable route error and request ID.

Rules:

- Public route errors should not show authenticated app shell.
- Editor route errors should not crash the entire app shell.
- App shell errors should have a safe fallback to workspace selection/login.
- Errors should include request ID when available.
- Components should branch on typed error codes, not raw message strings.

### Route Testing

Tests should cover:

- Deep link to app route while logged out.
- Deep link after login return.
- User with account setup incomplete.
- User with workspace setup incomplete.
- Invite acceptance while logged in and logged out.
- Workspace switch on object route.
- Lost workspace access during route load.
- Lost site access while editor route is open.
- Invalid route params.
- Invalid URL state.
- Public route 404 safety.
- Public route bundle boundary.
- Modal back/forward behavior.

## Forms, Validation UX, And Submit Lifecycle

Forms are where users feel quality most directly. Lightsite should have a consistent form architecture so signup, onboarding, workspace settings, site settings, variant editing, invites, publishing, and destructive confirmations all behave predictably.

The goal is to keep form code boring: typed schemas, consistent field errors, preserved input, no duplicate submits, no hidden destructive behavior, and clean recovery from server errors.

### Form Principles

Rules:

- Every form has an owner feature.
- Every form has a runtime validation schema.
- Client validation improves speed; server validation is authoritative.
- Field errors map to field paths.
- Form-level errors explain non-field failures.
- User input is preserved on validation, conflict, rate-limit, and server errors.
- Submit buttons disable only while the current submit is in flight.
- Duplicate submits are prevented with idempotency where needed.
- Destructive forms require confirmation.
- Link-breaking forms require explicit warning.

### Form Stack

Recommended pattern:

- Shared form primitives from shadcn `Field`, `FieldGroup`, `FieldSet`, inputs, selects, checkboxes, switches, and buttons.
- Feature-owned form components.
- Runtime schemas shared with server contracts where practical.
- Small form helpers to map API field errors into UI.

Rules:

- Do not create one-off form layouts for every feature.
- Do not bypass shared field primitives for product forms.
- Do not put product-specific form behavior into `components/ui`.
- Use composed common components only when at least two unrelated features need the same pattern.

### Field Error Shape

Server validation errors should return field paths that the frontend can map directly.

Example:

```ts
type FieldError = {
  path: string
  code: string
  message: string
}
```

Rules:

- `path` should match form field names where possible.
- Array/nested fields should use stable paths.
- `code` should be stable and machine-readable.
- `message` should be safe for display.
- Unknown field errors should fall back to a form-level error with request ID.

### Validation Timing

Use validation timing by field type:

- Required simple fields: validate on blur and submit.
- Slugs: validate local rules immediately, availability with debounce, authority on submit.
- URLs/domains: validate on blur and submit; normalize before save where possible.
- File uploads: validate before upload credentials and after upload completion.
- Rich text/content: validate locally while editing for guidance, authoritatively on autosave/publish.
- Destructive confirmation text: validate continuously.

Rules:

- Do not show aggressive errors before the user interacts with a field unless submit failed.
- Debounced validations should expose `checking`, `available`, `unavailable`, and `error`.
- Debounced validation results are advisory.
- Submit must revalidate everything server-side.
- If a debounced result is stale, ignore it.

### Submit Lifecycle

Standard lifecycle:

1. User edits fields.
2. Client validates local schema.
3. Submit starts and disables submit control.
4. Request sends idempotency key when duplicate side effects are possible.
5. Server validates permissions, state, and input.
6. Server commits transaction and enqueues side effects.
7. Response returns updated resource or next route/action.
8. Frontend updates cache or invalidates queries.
9. Form marks clean or closes/navigates.

Failure behavior:

- `422`: show field/form errors, preserve input.
- `409`: show conflict and refresh relevant availability/resource state.
- `403`: show permission lost and disable mutation controls.
- `429`: show retry timing, preserve input.
- `5xx`: show retry with request ID, preserve input.
- Network error: show retry, keep dirty state.

### Idempotent Form Submits

Use idempotency for:

- Workspace creation.
- Site creation.
- Site duplication.
- Invite creation/resend.
- Upload completion.
- Publish.
- Rollback.
- Export request.
- Billing actions later.

Rules:

- Idempotency key should be generated when form interaction begins or submit begins, depending on flow.
- Retrying the same submit uses the same key.
- Editing fields after a failed submit can generate a new key if the operation meaning changed.
- Server response should be stable for repeated successful submits.
- UI should not create duplicate records if the user double-clicks, refreshes, or retries after timeout.

### Slug Form Pattern

Use for:

- Workspace slug.
- Site slug.
- Variant slug.

Rules:

- Generate slug from name only while slug field is pristine.
- Once user edits slug manually, stop overwriting it.
- Validate local slug rules immediately.
- Debounce availability checks.
- Availability checks include active records, retained records, and reservation/tombstone records.
- Submit repeats availability through database constraints.
- Conflict response preserves all other form fields.
- If a slug is blocked because the link was historically used, explain that it is unavailable without exposing another customer's data.

### File Upload Form Pattern

Upload fields should handle:

- Pre-upload validation.
- Upload credential request.
- Direct upload or server upload.
- Upload progress.
- Completion/finalize call.
- Processing state.
- Ready/rejected state.
- Replace/remove.

Rules:

- Do not attach pending uploads to publishable content.
- Finalize validates workspace, size, MIME, and object existence.
- Upload controls should recover from network errors.
- Replacing an asset should not delete the old asset until the new one is ready and saved.
- Removing an asset that is required for publish should mark the form/content as publish-blocking.

### Destructive And Link-Breaking Forms

Destructive/link-breaking actions:

- Archive site.
- Unpublish site.
- Delete variant.
- Change variant slug.
- Change workspace slug before public links exist.
- Change site slug while draft.
- Remove member.
- Revoke invite.
- Delete asset if allowed.
- Workspace deletion later.

Rules:

- Use confirmation dialogs for destructive actions.
- Use explicit copy explaining user-visible impact.
- Require typed confirmation for high-impact or irreversible actions.
- Link-breaking actions should mention old links will stop working.
- Submit should be idempotent.
- Success should produce clear state change and navigation if current route is no longer valid.

### Form Accessibility

Rules:

- Every field has a label.
- Error messages are associated with fields.
- Required fields are communicated accessibly.
- Submit errors are announced.
- Focus moves to first invalid field on submit failure.
- Dialog forms trap focus and restore focus on close.
- Disabled controls should still have accessible explanation where needed.
- Loading spinners must not be the only state indicator.

### Form Testing

Tests should cover:

- Valid submit.
- Client validation error.
- Server field error.
- Form-level server error.
- Conflict/race error.
- Duplicate submit.
- Permission lost.
- Rate limit.
- Network retry.
- Dirty close guard.
- Focus management.
- Screen-reader error association.

## Mutation Lifecycle, Cache Invalidation, And Realtime Reconciliation

Lightsite should have a consistent client-side mutation model. Server state comes from the API. Local UI state exists for interaction. Realtime messages notify and reconcile. The frontend should not maintain parallel truth that slowly diverges from the backend.

The goal is to make every mutation predictable: what it changes, which queries update, which realtime events arrive, what happens on failure, and how stale clients recover.

### Mutation Principles

Rules:

- Mutations call typed feature API functions.
- Mutations receive typed responses.
- Mutations branch on typed error codes.
- Mutations update or invalidate query cache intentionally.
- Mutations do not manually mutate unrelated feature caches.
- Optimistic updates are used only when rollback is simple and correctness risk is low.
- Permission/state errors disable or hide affected controls after refetch.
- Realtime messages reconcile through one integration layer, not scattered component listeners.

### Mutation Categories

Low-risk optimistic candidates:

- Local list row rename when server returns updated row.
- Mark notification read later.
- Toggle local UI preference.

Prefer server-confirmed updates:

- Workspace setup.
- Workspace slug change.
- Invite create/revoke/resend.
- Role changes.
- Site create/duplicate/archive/restore.
- Publish/unpublish.
- Variant create/update/delete.
- Asset finalize/delete.
- Billing actions.

Editor content:

- Uses editor autosave/collaboration model.
- Should not use generic TanStack optimistic mutation for every keystroke.
- Query cache should store loaded draft metadata, not every editor operation.

### Query Key Ownership

Query keys should be typed helpers.

Rules:

- Query keys include workspace ID for workspace-scoped data.
- Query keys include site ID for site-scoped data.
- Query keys include filters/sort/search/date range.
- Public route queries are separate from app route queries.
- Do not key authenticated queries by workspace slug when internal workspace ID is available.
- Do not include sensitive tokens in query keys.
- Do not include unstable objects without normalization.

Recommended helper pattern:

```ts
queryKeys.sites.list(workspaceId, filters)
queryKeys.sites.detail(workspaceId, siteId)
queryKeys.sites.editor(workspaceId, siteId)
queryKeys.variants.list(workspaceId, siteId, filters)
queryKeys.tracking.summary(workspaceId, filters)
```

### Mutation Response Shape

Mutations should return enough data to update UI without broad refetch when safe.

Examples:

- Create site returns created site summary and route target.
- Archive site returns updated site state.
- Publish returns site status, published version ID, public URL, validation summary, and updated timestamps.
- Variant update returns variant detail, revision number, public URL, and affected cache hint.
- Invite create returns invite row state.
- Role update returns member row state.

Rules:

- Do not return entire workspace/site graphs for small mutations.
- Do not return private/draft data to users without permission.
- Include version/revision fields used for conflict detection.
- Include request ID in error responses.

### Cache Update Strategy

Use direct cache updates when:

- Response includes a complete updated row already in a list.
- The mutation affects one known detail query.
- Rollback/refetch is cheap if needed.

Use invalidation when:

- Mutation affects list membership.
- Mutation affects aggregate counts.
- Mutation affects permissions.
- Mutation affects public cache.
- Mutation affects multiple features.
- Mutation side effects are asynchronous.

Always invalidate/refetch on:

- Workspace switch.
- Membership role changes.
- Site access changes.
- Publish/unpublish/archive/restore.
- Variant slug change.
- Tracking date range changes.
- Billing/entitlement changes later.

### Realtime Reconciliation

Realtime messages should carry enough version data for clients to decide whether to apply, ignore, or refetch.

Message should include:

- Resource type.
- Resource ID.
- Workspace ID.
- Site ID where relevant.
- Event type.
- Version/revision number.
- Actor ID where safe.
- Timestamp.

Rules:

- If message version is older than local state, ignore.
- If message version is newer and patch is safe, apply.
- If message cannot be safely applied, invalidate/refetch.
- If user lost permission, close/downgrade route and clear sensitive cached data.
- If site archived while editor is open, switch editor to read-only and route away if needed.
- If publish occurs while editor is open, update published-dirty state.
- If variant revision changes while preview is open, refetch preview payload.

### Conflict Handling

Conflict cases:

- Stale site settings version.
- Stale workspace settings version.
- Variant edited in two tabs.
- Role/access changed during mutation.
- Publish attempted from stale draft revision.
- Slug claimed between availability check and submit.
- Asset deleted while still referenced.

Rules:

- Server returns `409` with stable code and current resource version where safe.
- UI preserves user input.
- UI offers refetch/merge/retry only when meaningful.
- Blind overwrite is not allowed for settings/content with meaningful concurrent changes.
- For low-risk fields, server can accept last-write-wins only if specified.

### Mutation Feedback

Feedback rules:

- Use inline success state for forms when the user remains on the form.
- Use toast for background/non-blocking successes.
- Use dialog/body copy for destructive confirmations.
- Do not show a toast for every autosave.
- Autosave should use subtle saved/saving/error indicators.
- Publish success should show public link/share action.
- Error toasts should include retry path or request ID when useful.
- Avoid stacking many toasts from batch operations.

### Mutation Testing

Tests should cover:

- Cache update after create/update/delete.
- Invalidation after publish/archive/access change.
- Workspace-scoped cache isolation.
- Optimistic rollback where used.
- Realtime message older/newer version behavior.
- Permission lost during mutation.
- Conflict response handling.
- Duplicate submit/idempotency.
- Public cache hint on variant revision change.

## Loading, Empty, Error, And Feedback System

Lightsite should feel calm even when data is loading, unavailable, empty, or broken. These states should be designed as part of the product, not added at the end.

The goal is to keep users oriented: where they are, what is happening, what they can do next, and whether their work is safe.

### State Principles

Rules:

- Every route defines loading, empty, error, and permission-denied states.
- Every list defines empty, no-results, loading, and error states.
- Every mutation defines pending, success, error, and retry behavior.
- Public pages fail closed without exposing internals.
- Editor states prioritize preserving user work.
- Request IDs are available for support on unexpected failures.
- Skeletons match final layout dimensions.
- Avoid layout jumps from loading content.

### Loading States

Use:

- App bootstrap loader for initial auth/workspace resolution.
- Route skeleton for page-level data.
- Table/list skeleton for rows.
- Button loading state for submits.
- Inline field loading state for debounced availability checks.
- Upload progress state for files.
- Editor saving indicator for autosave.
- Chart loading state for tracking dashboards.

Rules:

- Do not block the entire app shell for route-level loading.
- Do not show spinners where skeletons would better preserve layout.
- Do not hide already-loaded data during background refetch unless stale data is dangerous.
- Loading controls should prevent duplicate actions where necessary.

### Empty States

Empty states:

- No sites yet.
- No search results.
- No tracking events yet.
- No variants yet.
- No team members beyond current user.
- No pending invites.
- No assets yet.
- No archived sites.
- No version history beyond initial state.

Rules:

- True empty states should guide the next best action.
- No-results states should offer reset filters/search.
- Permission-limited empty states should not imply data does not exist if the user lacks access.
- Empty states should avoid long educational copy inside dense product surfaces.
- Empty states should use existing design system components.

### Error States

Error classes:

- Validation error.
- Permission error.
- Not found.
- Conflict/stale data.
- Rate limited.
- Network unavailable.
- Provider unavailable.
- Unexpected server error.
- Public render error.

Rules:

- Expected errors should be inline and actionable.
- Unexpected errors should include request ID.
- Permission errors should explain what the user can do next.
- Not-found errors should avoid leaking inaccessible objects.
- Conflict errors should offer refetch/retry/merge when useful.
- Provider errors should not expose provider secrets or raw payloads.
- Public render errors should be generic to visitors and detailed in logs.

### Toasts And Notifications

Use toasts for:

- Copy link success/failure.
- Invite sent.
- Background save failed and needs attention.
- Archive/restore success.
- Export started/ready later.
- Non-blocking provider failure.

Do not use toasts for:

- Critical blocking validation.
- Main form field errors.
- Every autosave success.
- Permission denial that requires route/body explanation.
- Public visitor errors.

Rules:

- Toast text should be short.
- Toasts should not be the only place a user can recover.
- Destructive success toasts should include undo only when undo is real and safe.
- Batch actions should summarize instead of emitting many toasts.

### Permission-Denied States

Rules:

- If user lacks access to a known workspace route, show permission-denied with a path back to a safe page.
- If showing existence would leak private data, show not found.
- If access was revoked while on a route, explain that access changed and route away or downgrade.
- Admin-only settings should be hidden for non-admins where possible, and server still enforces.
- Public routes never show app permission explanations.

### Degraded States

Degraded modes:

- Realtime unavailable.
- Tracking ingestion delayed.
- Email provider delayed.
- Asset processing delayed.
- Public cache invalidation delayed.
- Background workers delayed.

Rules:

- Core editing should continue when realtime is unavailable, with clear collaboration downgrade.
- Public rendering should not depend on tracking availability.
- Invite creation should not fail just because email provider delivery is delayed if email can be queued.
- Publish should succeed if cache invalidation is delayed, but should surface operational alerts internally.
- User-facing degraded messages should be calm and only shown when they affect user action.

### Feedback Testing

Tests should cover:

- Route skeletons render without layout break.
- Empty states for each primary list.
- No-results states with filter reset.
- Field validation errors.
- Form-level errors.
- Permission-denied and not-found distinction.
- Conflict UI.
- Rate-limit UI.
- Toast dedupe for repeated actions.
- Realtime degraded editor mode.
- Public render safe error.

## Editor Canvas, Inspector, And Interaction Contracts

The editor is the core product surface. It should feel fast, direct, and calm for sales teams who are editing under pressure. The editor should not feel like a generic page builder with endless layout freedom. It should provide enough structure that users can make polished sales one-pagers quickly without breaking the public page.

The editor should be built around a flat block canvas, a focused inspector, and a small set of predictable commands.

### Editor Surface Anatomy

Primary regions:

- Editor header.
- Left or top navigation back to app context.
- Canvas.
- Block insertion controls.
- Floating rich text toolbar where appropriate.
- Inspector/sidebar.
- Publish/share/preview actions.
- Presence/collaboration indicators.
- Save/sync status.

Rules:

- Editor route owns editor chrome; app shell should not re-render on every editor state change.
- Canvas owns block rendering and selection.
- Inspector owns settings for current selection.
- Header owns document-level actions and status.
- Rich text toolbar appears only when rich text selection is active.
- Global app navigation should remain available without crowding editing controls.

### Canvas Model

Canvas displays:

- Header/site intro area.
- Flat ordered block list.
- Optional footer/public metadata preview if useful.

Rules:

- Blocks render in the same order as draft content.
- Blocks have stable dimensions where controls appear so hover/selection chrome does not shift layout.
- Canvas selection/hover chrome must not become part of public content.
- Empty blocks should remain easy to select and edit.
- Unsupported blocks in internal draft preview should show a controlled unsupported state, not crash the editor.
- Public preview should use the public renderer path as closely as practical.

### Block Chrome

Block chrome can include:

- Drag handle.
- Insert-before/after affordance.
- Duplicate action.
- Delete action.
- More menu.
- Selection outline.
- Collaboration presence marker.

Rules:

- Chrome appears on hover, focus, keyboard navigation, or selection.
- Chrome must not cause layout shift.
- Chrome controls must be keyboard reachable.
- Icon-only controls must have accessible names and tooltips.
- Destructive controls require clear focus/selection and confirmation when destructive impact is larger than a single easy-to-undo operation.
- Block controls should use Tabler icons through shared button primitives.

### Selection States

Selection states:

```txt
none
page
block
rich_text
nested_item
asset_field
```

Rules:

- Only one primary selection exists at a time.
- Selection state is UI-local and should not be persisted to draft content.
- Selection should survive benign rerenders.
- Selection should clear if the selected block is deleted.
- Selection should move predictably after delete:
  - next block if one exists
  - previous block if no next block exists
  - page selection if no blocks remain
- Rich text selection controls should not replace block-level inspector unexpectedly.
- Nested item selection must include parent block ID and nested item ID.

### Hover And Focus

Rules:

- Hover state is pointer-only assistance and not required for core actions.
- Keyboard focus should reveal equivalent controls.
- Focus and selection can differ, but the UI should make their difference understandable.
- Do not hide required controls behind hover-only UI.
- Focus rings should use design tokens and remain visible on light/dark backgrounds.

### Insert Behavior

Insert entry points:

- Empty canvas primary insert.
- Between-block insert control.
- Slash command in rich text context.
- Header/button action.
- Keyboard shortcut.

Rules:

- Inserted blocks get stable IDs immediately.
- Insert location is explicit:
  - after selected block
  - before selected block
  - at end
  - inside allowed nested context
- Insert menu order should prioritize common sales one-pager blocks.
- Insert menu should not show unsupported/future blocks.
- Inserted block defaults should be safe, editable, and non-crashing.
- Required public fields can start empty in draft but must block publish until filled.

### Drag And Reorder

Rules:

- Drag reorder operates on stable block IDs.
- Dragging should not mutate content until drop/commit.
- Drop indicator should be clear and token-compliant.
- Keyboard reorder should exist for accessibility or at minimum be planned before editor launch criteria are complete.
- Dragging a block over invalid targets should show no-drop state.
- If a block is deleted by another collaborator during drag, delete wins and drag cancels.
- Reorder is undoable.
- Reorder participates in collaboration/autosave pipeline as a block-order operation, not as a full-document rewrite when possible.

### Inspector Behavior

Inspector modes:

- Page/site settings when no block is selected.
- Block settings when a block is selected.
- Nested item settings when a nested item is selected.
- Read-only state when user lacks edit permission.
- Archived/unpublished/published context notices where relevant.

Rules:

- Inspector controls are generated from the field registry where possible.
- Inspector should not show fields the selected block does not support.
- Inspector changes dispatch editor commands.
- Inspector input preserves unsaved values during transient validation failures.
- Inspector should label draft-only fields that will not affect the published page until republish.
- Inspector should avoid long explanatory copy; use concise labels, helper text, and validation messages.
- Inspector width should be stable.
- Closing/collapsing inspector should not lose unsaved field edits.

### Rich Text Toolbar

Rules:

- Toolbar appears near selection where it does not obscure text being edited.
- Toolbar uses shadcn primitives and Tabler icons.
- Toolbar actions dispatch editor commands.
- Toolbar reflects active marks accurately.
- Toolbar should not show marks/extensions unsupported by the current field.
- Variable insertion should be available from supported rich text fields.
- Toolbar must be keyboard accessible.

### Preview Modes

Preview modes:

- Draft desktop preview.
- Draft mobile preview.
- Published preview.
- Variant preview.
- Public open-link preview.

Rules:

- Draft preview renders unsaved/current draft state.
- Published preview renders the current published snapshot.
- Variant preview labels whether it is previewing draft or published content.
- Public open-link preview should use the same route/payload path as public visitors when possible.
- Preview should not record visitor analytics.
- Preview should not expose draft preview URLs publicly.
- Preview should surface validation hints outside the public page canvas, not inside public content.

### Editor Status Indicators

Status indicators:

- Saved.
- Saving.
- Unsaved changes.
- Offline/retrying.
- Realtime connected/degraded.
- Read-only.
- Published.
- Draft changes since publish.
- Validation issues.

Rules:

- Do not use a toast for every autosave.
- Save status should be visible but not noisy.
- Publish status and save status are distinct.
- Draft changes since publish should be clear before sharing.
- Realtime degraded status should explain collaboration impact, not imply content is lost.

### Editor Accessibility

Rules:

- Core editing can be done with keyboard.
- Block selection is keyboard reachable.
- Insert menu is keyboard searchable.
- Dialogs/sheets trap focus.
- Toolbar buttons have accessible labels.
- Selection state should be conveyed visually and through accessible naming where practical.
- Drag-only actions need keyboard alternatives or documented launch caveat with follow-up before broad release.
- Editor should respect reduced motion.

### Editor Surface Testing

Tests should cover:

- Select block by click and keyboard.
- Insert block at beginning/middle/end.
- Delete block and selection moves predictably.
- Reorder block.
- Inspector changes dispatch correct command.
- Rich text toolbar applies marks.
- Variable insertion in supported field.
- Read-only mode blocks edits.
- Archived site opens read-only/recovery state.
- Draft preview does not track analytics.
- Public preview excludes editor chrome.
- Realtime degraded indicator appears without losing edits.

## Editor Operation Model And Document Integrity

The editor should not persist arbitrary document blobs for every interaction. User intent should flow through typed operations/commands so autosave, collaboration, undo/redo, validation, and version history can remain predictable.

The document can still be stored as JSON, but changes should be expressed as structured operations wherever practical.

### Operation Principles

Rules:

- Operations describe intent, not UI mechanics.
- Operations reference stable IDs.
- Operations are validated before applying.
- Operations are undoable when user-facing.
- Operations are permission-checked before persistence.
- Operations should be small enough to sync efficiently.
- Operations should not include private UI state such as hover or inspector open state.
- Full-document replace is reserved for migrations, rollback restore, import, or recovery.

### Operation Envelope

Recommended shape:

```ts
type EditorOperationEnvelope = {
  operationId: string
  clientId: string
  siteId: SiteId
  baseDraftRevision: number
  createdAt: string
  operation: EditorOperation
}
```

Rules:

- `operationId` supports dedupe.
- `clientId` supports collaboration echo handling.
- `baseDraftRevision` supports conflict detection.
- Server assigns canonical revision/order on accept.
- Operations should be stored or compacted according to autosave/version strategy.

### Core Operations

Block operations:

```txt
insertBlock
updateBlockField
deleteBlock
duplicateBlock
moveBlock
replaceBlock
```

Nested item operations:

```txt
insertNestedItem
updateNestedItem
deleteNestedItem
moveNestedItem
```

Variable operations:

```txt
createVariable
updateVariable
renameVariableKey
deleteVariable
insertVariableReference
removeVariableReference
```

Document operations:

```txt
updateSiteHeader
updatePageSetting
updateMetadata
restoreVersionToDraft
replaceDraftDocument
```

Rules:

- Each operation has a schema.
- Each operation has validation.
- Each operation declares whether it is undoable.
- Each operation declares publish validation implications.
- Each operation declares whether it can be safely merged with adjacent operations.

### Draft Revision Model

Rules:

- Draft has a monotonically increasing `draftRevision`.
- Accepted persisted operations advance `draftRevision`.
- Autosave checkpoints record latest persisted draft revision.
- Collaboration broadcasts accepted revision.
- Client can hold local pending operations ahead of server revision.
- If pending operations cannot apply after server changes, client enters conflict/recovery flow.

### Undo And Redo Integrity

Rules:

- Undo stack is local to the user's editor session.
- Undo/redo applies inverse operations where practical.
- Remote collaborator changes should not appear in local undo stack.
- Undo after remote change should transform against current document or be disabled with a clear reason.
- Publish, rollback, archive, and permission changes clear or checkpoint undo state as appropriate.
- Undo should not resurrect deleted assets that are no longer available.
- Undo should not bypass permissions.

### Operation Batching

Batch operations for:

- Typing in rich text.
- Drag reorder final drop.
- Multiple inspector field changes committed together.
- Paste of structured content.
- Template insertion.

Rules:

- Batching should reduce write volume without making recovery unclear.
- Batch boundaries should align with undo boundaries.
- Autosave can debounce batches but should flush on route leave/visibility hidden.
- Large batches should be size-limited.

### Validation Layers For Operations

Validation layers:

1. Operation schema.
2. Permission/state check.
3. Document structural validation.
4. Field/block validation.
5. Reference validation.
6. Limits/quotas.

Rules:

- Invalid operation is rejected and not broadcast.
- Rejected local operation should preserve user input where possible.
- Server rejection returns stable code and current draft revision.
- Client should refetch when it cannot reconcile.

### Full Document Replacement

Allowed for:

- Rollback restore.
- Template apply to empty draft.
- Import.
- Content schema migration.
- Support repair tooling.

Rules:

- Full replace creates a clear version/checkpoint.
- Active editors are notified to reload.
- Local pending operations must be reconciled or discarded with recovery.
- Full replace requires strong validation before commit.
- Full replace should not happen for ordinary block edits.

### Document Integrity Tests

Tests should cover:

- Each operation validates and applies correctly.
- Operation rejects missing/foreign block IDs.
- Move operations preserve all blocks exactly once.
- Delete operation removes references or creates validation errors as designed.
- Variable rename preserves references by ID.
- Undo/redo inverse behavior.
- Remote change plus local pending operation.
- Full replacement reloads active editors.
- Operation dedupe by `operationId`.

## Media Picker, Uploads, And Asset Usage UX

Lightsite needs media, but a full asset library can wait. V1 should still have a clean media picker/upload flow that works for workspace logo, site avatar, image blocks, image variables, OG image, and logo/testimonial blocks without creating messy asset ownership or deletion behavior.

The key idea: asset upload and asset usage are different. Upload creates an asset. Saving content/settings creates a usage reference.

### Media Entry Points

Media entry points:

- Workspace logo setup/settings.
- Site avatar/default header image if supported.
- Image block.
- Image variable override.
- Logo block item.
- Testimonial avatar if supported.
- OG image.
- Public favicon/branding later.

Rules:

- Every media entry point declares accepted asset kinds.
- Every media entry point declares required dimensions/aspect guidance.
- Every media entry point declares whether asset is required for publish.
- Every media entry point writes usage references on save, not upload alone.
- Uploading a file does not automatically publish it.

### Media Picker Modes

V1 picker modes:

- Upload new.
- Reuse recent workspace assets if simple and available.
- Clear/remove current asset.
- Replace current asset.

Rules:

- Reuse recent assets can be a small picker, not a full asset library.
- Picker filters by compatible kind/MIME.
- Picker should not show assets from other workspaces.
- Picker should not show rejected/deleted assets.
- Picker should show processing state.
- Picker should prevent selecting assets that cannot be used publicly.

### Upload UX

Upload flow:

1. User chooses file or drops file.
2. Client validates rough size/type.
3. Server creates pending upload.
4. Client uploads.
5. Client finalizes upload.
6. Server validates and processes.
7. Asset becomes ready or rejected.
8. Form/content field references ready asset.

Rules:

- File input preserves current field value until replacement is ready.
- Upload progress is visible.
- Failed upload can retry without clearing form.
- Unsupported type error appears before upload where possible.
- Server finalize errors are authoritative.
- Large image handling should explain compression/resize if performed.
- Upload cancellation should leave existing saved asset intact.

### Asset Usage References

Recommended usage table:

```text
asset_usages
- id uuid primary key
- workspace_id uuid not null
- asset_id uuid not null
- usage_type varchar not null
- site_id uuid nullable
- site_version_id uuid nullable
- variant_id uuid nullable
- block_id varchar nullable
- field_path varchar nullable
- created_at timestamptz not null
```

Rules:

- Draft usage can be recalculated from draft content/settings.
- Published usage is captured from immutable published snapshot.
- Version usage is retained for restorable versions.
- Variant usage references image variable overrides and recipient-specific media.
- Usage records support safe deletion/orphan cleanup.
- Usage rebuild job should exist for repair.

### Asset Replacement

Rules:

- Replacing an image in draft creates a new usage reference after save.
- Old asset remains if used by published snapshots, versions, variants, or other fields.
- If old asset becomes unused, orphan cleanup can remove it after retention window.
- Replacing workspace logo affects future new sites by default, not existing site avatars unless explicitly applied.
- Replacing OG image is a draft site-setting change in V1 and affects public link previews only after publish/republish.

V1 contract:

- Treat OG image as site setting that requires publish to affect public metadata.
- Treat workspace logo as live workspace setting.
- Treat variant image variable overrides as live variant configuration when the variable exists in published snapshot.

### Asset Deletion UX

V1 should avoid a global destructive asset library delete flow.

Rules:

- Users remove asset references from fields.
- Backend cleanup handles orphaned files.
- If a delete action is exposed for an asset, it must show where the asset is used.
- Assets referenced by published snapshots or retained versions cannot be hard-deleted.
- Deleting/rejecting an asset should never break current public pages.

### Media Publish Readiness

Publish validation should check:

- Required media fields have ready assets.
- Asset belongs to workspace.
- Asset MIME/kind is allowed for field.
- Asset is not rejected/deleted.
- Asset dimensions are acceptable where strict dimensions are required.
- Public asset URL can be generated.
- Alt text exists where required.

Warnings:

- Large image may slow public page.
- Missing optional alt text.
- Poor OG image aspect ratio.
- Logo/image may appear low quality.

### Media Picker Testing

Tests should cover:

- Upload valid image.
- Reject invalid MIME.
- Reject oversized file.
- Upload failure retry.
- Replace keeps old asset until save.
- Remove optional asset.
- Required asset blocks publish.
- Cross-workspace asset selection blocked.
- Rejected asset cannot publish.
- Asset usage rebuild preserves public page dependencies.

## Tracking Dashboard, Metrics, And Analytics UX

Tracking is a sales workflow, not a generic analytics product. The dashboard should help a rep quickly understand whether a prospect engaged, which link they used, what they clicked, and whether follow-up is worthwhile. It should avoid false precision and avoid exposing more visitor data than the product needs.

The dashboard should combine high-level summaries with a readable activity feed.

### Tracking Page Purpose

The Tracking page should answer:

- Which sites are getting viewed?
- Which variants/recipients are engaging?
- How recently did engagement happen?
- How long did visitors spend?
- How far did they scroll?
- Which CTAs/assets/elements were clicked?
- Did a Slack/preview unfurl happen?
- Which engagement looks human versus bot/preview?

Rules:

- Do not count preview bots as human visits.
- Do not imply exact identity for anonymous default-link visitors.
- Label variant/recipient engagement based on the link used.
- Show timestamps in workspace/user-friendly local time.
- Make filters and date ranges clear.

### Dashboard Layout

Recommended layout:

- Date range control.
- Workspace/site/variant filters.
- Summary metric row.
- Engagement trend chart.
- Top sites/variants list.
- Recent activity feed.
- Top clicked elements.
- Scroll depth summary.
- Bot/preview section or filter.

Rules:

- Do not load every raw event for the whole workspace on initial render.
- Summary cards use aggregated endpoints.
- Activity feed uses cursor pagination.
- Charts should lazy-load below the main route shell.
- Empty states should guide users to publish/share a site.

### Core Metrics

Metrics:

- Human visits.
- Unique sessions.
- Average time spent.
- Median time spent if enough data.
- Max/average scroll depth.
- CTA clicks.
- Link clicks.
- Asset clicks/downloads.
- Last engaged at.
- Slack/preview loads.
- Variant engagement count.

Rules:

- Define metric formulas in backend analytics code, not UI components.
- Show preview loads separately from human visits.
- Time spent should exclude obvious bots and extremely short invalid sessions according to documented rules.
- Unique sessions are not unique people.
- Avoid showing tiny-sample percentages without context.

### Date Ranges

Default ranges:

- Last 7 days.
- Last 30 days.
- Last 90 days.
- Custom range.

Rules:

- Date ranges use workspace reporting timezone or user timezone until workspace timezone exists.
- Range end is exclusive internally.
- UI labels should be clear about inclusivity.
- Query params store selected range.
- Large ranges should use aggregated data, not raw event scans.

### Filters

Filters:

- Site.
- Variant/recipient.
- Event type.
- Human/bot/preview classification.
- Referrer host.
- Date range.

Rules:

- Filters are URL-backed.
- Filter options are scoped to current workspace.
- Variant filter only shows variants for selected site when site filter exists.
- Hidden/inaccessible sites do not appear for users without access.
- Filtered no-results state offers reset.

### Activity Feed

Feed events:

- Site viewed.
- Variant viewed.
- CTA clicked.
- Link clicked.
- Asset clicked/downloaded.
- Scroll threshold reached.
- Time spent summary.
- Preview loaded.

Rules:

- Feed is cursor-paginated.
- Feed rows use human-readable event labels.
- Feed rows include site/variant context where permitted.
- Feed rows include bot/preview badge where relevant.
- Feed rows should not include raw IP.
- Feed rows should not include recipient email unless product policy explicitly allows it and user has permission.
- Feed deduplicates noisy events where a summary row is clearer.

### Click Analytics

Click analytics should show:

- Element label snapshot.
- Element type.
- Site.
- Variant if present.
- Published version.
- Click count.
- Last clicked.

Rules:

- Label snapshot comes from click time.
- If current content changed, old click labels remain understandable.
- Query params in clicked URLs should be redacted according to URL snapshot policy.
- Do not track arbitrary clicks outside configured public elements in v1.
- Click table should be sortable and paginated.

### Scroll And Time Analytics

Rules:

- Scroll depth uses threshold events and session max scroll depth.
- Do not store every scroll position.
- Time spent uses heartbeat/visibility/unload signals and server receive time.
- Time spent should cap unrealistic sessions.
- Background tabs should not accumulate active reading time.
- Show scroll/time metrics as directional engagement, not perfect truth.

### Variant Analytics

Variant analytics should show:

- Variant name.
- Recipient/company label.
- Public link.
- Last viewed.
- Human visits.
- CTA clicks.
- Max/average scroll depth.
- Time spent.
- Preview loads.

Rules:

- Variant analytics use `variantId` and `variantRevision` for attribution.
- If variant metadata changes, historical analytics remain linked to the variant and can show current label plus historical event label snapshots where needed.
- Deleted variants can appear in historical analytics if they have retained events, labeled as deleted.
- Copy link action is available only if parent site is published and variant active.

### Analytics Permissions

Rules:

- Workspace admins can view analytics for workspace sites.
- Users can view analytics only for sites they can access according to site access policy.
- Public visitors cannot access analytics.
- Tracking export requires explicit permission.
- Analytics endpoints must scope by workspace and allowed site IDs.
- If access is removed, analytics route clears cached data and routes away or shows permission state.

### Analytics Performance

Rules:

- Dashboard summaries read from aggregate tables where available.
- Activity feed reads from indexed event/session tables.
- Avoid `count(*)` over huge raw event sets in request path.
- Use cursor pagination for feed.
- Use date-bucketed summaries for charts.
- Cache low-risk summaries briefly by workspace/filter/date range.
- Recompute recent buckets to handle late events.
- Separate bot/preview aggregates from human engagement aggregates.

### Analytics Accuracy And Copy

Rules:

- Use labels like "Visits" and "Sessions," not "People," unless identity is reliable.
- Use "Slack preview loaded" rather than "Shared on Slack."
- Use "Time on page" or "Time spent" with tooltip/copy explaining it is estimated.
- Use "Scroll depth" as maximum observed scroll threshold.
- Avoid false precision in small samples.
- Explain when tracking is disabled, blocked, or still processing.

### Tracking Dashboard Testing

Tests should cover:

- Empty tracking dashboard.
- Published site with no views.
- Human view appears in summaries/feed.
- Preview bot does not count as human visit.
- Variant filter scopes results.
- Deleted variant historical analytics.
- Date range query params.
- Click label snapshot.
- Scroll/time aggregation.
- Permission-denied analytics route.
- Large event feed pagination.
- Summary uses aggregate endpoint.

## Sites Management Surface And List Workflows

The Sites page is the home base for sales teams. It should make it obvious which one-pagers exist, which are live, which need attention, who can access them, and what action to take next. It should stay dense enough for repeated operational use without becoming a spreadsheet of implementation details.

The Sites page should optimize for:

- Find the right site quickly.
- Create a new site quickly.
- Understand live/draft/archived state.
- Open editor or public link confidently.
- Share or personalize a published site.
- Avoid destructive mistakes.

### Sites Page Data Contract

Each row should be backed by a site list summary, not the full site document.

Recommended row fields:

```ts
type SiteListItem = {
  id: SiteId
  workspaceId: WorkspaceId
  name: string
  slug: string
  status: "draft" | "published" | "archived"
  visibility: "private" | "team"
  effectiveAccess: "admin" | "creator" | "edit" | "view_copy"
  publicUrl?: string
  publishedVersionId?: SiteVersionId
  hasUnpublishedChanges: boolean
  variantsCount: number
  lastViewedAt?: string
  humanVisitsCount?: number
  createdByUser?: UserSummary
  updatedAt: string
  publishedAt?: string
  archivedAt?: string
}
```

Rules:

- Do not load draft content in the Sites list.
- Do not load full analytics raw events in the Sites list.
- Row permissions should be precomputed enough to render actions.
- Counts can be slightly stale if marked as summaries and not used for enforcement.
- List response is cursor-paginated.
- Sorts are stable and deterministic.

### Sites Table Columns

Default columns:

- Site name.
- Status.
- Visibility/access.
- Last updated.
- Published state.
- Variants.
- Views/last viewed summary if cheap.
- Row actions.

Rules:

- Status should separate `published` from `hasUnpublishedChanges`.
- Published site with draft changes should show a distinct "Unpublished changes" indicator.
- Archived rows should be visually subdued and hidden from default active view unless archive filter is selected.
- Private/team visibility should describe app access, not public link availability.
- Public link indicator appears only when the site is published and not archived/taken down.

### Sites Search And Filters

Search should cover:

- Site name.
- Site slug.
- Variant/recipient metadata when server-side support exists.
- Creator/updater display name only when indexed and useful.

Filters:

- Status.
- Visibility.
- Access: owned/created by me, shared with me, team.
- Published state: live, draft-only, unpublished changes.
- Archived.
- Date range updated/published if useful.

Rules:

- Search/filter/sort state is URL-backed.
- Empty search query resets to default list.
- No-results state offers reset.
- Server search is authoritative for large workspaces.
- Do not fetch all sites just to search client-side once workspaces can grow.

### Create Site Flow

Create flow should be fast.

Inputs:

- Name.
- Optional template.
- Optional slug if advanced field is shown.
- Visibility default.

Defaults:

- Name starts empty.
- Slug generated from name while slug field is pristine.
- Visibility defaults to private.
- Workspace logo becomes default site avatar.
- Starter template provides useful sales one-pager structure.

Rules:

- Plan limit is checked before and during submit.
- Slug uniqueness is enforced by database constraint.
- Duplicate submit cannot create duplicate sites.
- Successful create routes to editor.
- Failed create preserves input.
- If template creation partially fails, transaction rolls back; user should not get a half-created site.

### Site Row Primary Action

Primary row action:

- Editable access: open editor.
- View/copy access: open read-only preview/detail and allow duplicate.
- Archived: open archived detail or restore action depending on permissions.

Rules:

- Primary action should match what most users expect from the row.
- Public link opening should be a separate action so users do not confuse editor/app view with prospect view.
- Inaccessible private sites should not appear.
- Sites shared with the user should make their access level clear.

### Site Row Actions

Actions:

- Edit/open.
- Preview draft.
- Open public link.
- Copy public link.
- Share.
- Variants.
- Tracking.
- Duplicate.
- Version history.
- Team access.
- Archive.
- Restore archived.
- Unpublish.

Rules:

- Actions should reflect permissions and state.
- Disabled actions need a useful explanation only when visible.
- Hidden actions are acceptable for actions the user clearly cannot perform.
- Destructive actions require confirmation.
- Link-breaking actions require clear warning.
- Actions that depend on publish state should update immediately after publish/unpublish/archive.

### Duplicate Site Flow

Rules:

- Duplicating creates a new draft site.
- Duplicate never copies public publish state.
- Duplicate creates a new slug.
- Duplicate copies draft content for editors and published snapshot for view/copy-only users who cannot access draft.
- Duplicate does not copy variants by default in v1.
- Duplicate does not copy analytics.
- Duplicate does not copy site access rows by default.
- Duplicate preserves asset references only when the user/workspace can access the assets and asset usage is valid.
- Duplicate enforces plan limits.

UX:

- Allow user to rename before or after creation.
- Route to editor after successful duplication when user can edit new site.
- Show clear failure if source became inaccessible.

### Archive And Restore From Sites Page

Archive rules:

- Archive disables public page if site was published.
- Archive rejects new tracking.
- Archive keeps versions, variants, assets, analytics, and access history.
- Archive should be reversible.
- Archive requires edit/manage permission according to site access rules.

Restore rules:

- Restore returns site to draft.
- Restore does not republish automatically.
- Restore keeps slug reserved and same slug if available under retained uniqueness.
- Restore should not bypass plan rules if future policy changes archived counts.

UX:

- Archive confirmation explains public links stop working.
- Restore confirmation explains site returns as draft and must be republished.
- Archived filter/list makes restoration discoverable.

### Sites Page Empty States

States:

- No sites yet.
- No accessible sites but workspace has sites.
- No search results.
- Archived-only view empty.
- Plan limit reached before create.

Rules:

- True empty state offers create site.
- No accessible sites explains that no sites are shared with the user.
- No-results state offers reset filters.
- Plan limit state explains limit and upgrade/admin path without showing a dead create form.

### Sites Management Testing

Tests should cover:

- Empty workspace sites page.
- Sites list with draft/published/archived/unpublished-changes rows.
- Search/filter/sort URL state.
- Row actions by permission.
- Create site success and duplicate submit.
- Plan limit blocked create.
- Duplicate from editor access.
- Duplicate from view/copy access.
- Archive published site disables public route.
- Restore archived site returns draft.
- Workspace switch clears previous workspace rows.

## Publish, Share, And Version History Dialog Contracts

Publishing and sharing are the moment where internal work becomes prospect-facing. These flows must be unusually clear. Users should never wonder whether a draft change is live, whether a link works, or whether restoring a version changed the public page.

### Publish Dialog Purpose

Publish dialog should answer:

- Is this site ready to publish?
- What will become public?
- What link will be live?
- Are there warnings the user should fix?
- What happens to existing variants?
- What changed since last publish?

### Publish Dialog States

States:

```txt
not_published_ready
not_published_blocked
published_no_changes
published_with_draft_changes_ready
published_with_draft_changes_blocked
publishing
published_success
publish_failed
```

Rules:

- Dialog opens with latest validation state or starts validation immediately.
- Validation result can become stale after editor changes.
- Submit button is disabled for blockers.
- Warnings do not block publish unless configured as blockers.
- Successful publish shows public link and share actions.
- Publish failure preserves dialog state and shows request ID.

### Publish Validation Display

Display:

- Blockers.
- Warnings.
- Linked block/field.
- Quick action to focus block/field.
- Public metadata readiness.
- Asset readiness.
- Variable default readiness.
- Variant readiness summary.

Rules:

- Do not bury blockers inside a long checklist.
- Errors should map to exact block/field where possible.
- Global errors should appear separately.
- Publish validation should not mutate content.
- Publish validation should be authoritative on submit even if client validation passed.

### Publish Transaction UX

Rules:

- Publish creates immutable version and updates public pointer atomically.
- UI should not show live status until server confirms.
- On success, update site status, published version ID, published timestamp, and public URL state.
- On success, editor "unpublished changes" indicator clears.
- On success, active collaborators receive publish notification.
- On failure after transaction commit but before client receives response, retry/refetch should detect published state and avoid duplicate versions where idempotency applies.

### Republish UX

Republish should show:

- Current public link.
- Draft changes since last publish.
- Variant impact summary.
- Metadata/OG image impact.
- Tracking continuity note only if needed.

Rules:

- Republish does not change public URL.
- Republish creates a new published version.
- Existing variant links remain.
- Existing variant values apply to matching published variable IDs.
- Draft-only variant fields become live only after republish includes those variables.
- Analytics before/after republish remain distinguishable by published version ID.

### Unpublish UX

Unpublish confirmation should explain:

- Public links will stop working.
- Existing analytics remain.
- Draft and versions remain.
- Site can be republished later.

Rules:

- Unpublish does not delete variants.
- Unpublish rejects new tracking for public links.
- Unpublish invalidates public route cache.
- Unpublish should not remove published version history.

### Share Modal

Share modal should show:

- Published status.
- Default public link.
- Copy link action.
- Open public link action.
- Variant entry point.
- Link warning states.
- Optional sharing helper text.

Rules:

- If site is unpublished, do not show copyable live link as if it works.
- If site has unpublished draft changes, warn that shared link reflects last published version.
- Copy action copies canonical URL.
- Copy success/failure uses toast.
- Open public link uses canonical public URL.
- Share modal should not create variants implicitly.

### Variants From Share

Rules:

- Share modal can link to Variants modal.
- Creating a variant from share returns to a copyable variant link.
- If parent site is unpublished, variant can be created but link is unavailable until publish.
- Variant link copy should include warning if draft-only variable changes are not live.

### Version History Dialog

Version history should show:

- Version type.
- Created timestamp.
- Actor.
- Label/summary if available.
- Published marker.
- Current draft marker if applicable.
- Restore action for restorable versions.
- Preview action.

Rules:

- Version history loads paginated.
- Current published version is clearly marked.
- Rollback/restore updates draft only.
- Restore does not change public page until publish.
- Restore creates a new rollback version.
- Restore requires edit permission.
- Restore blocked for archived site until restored.
- Preview of old version should not mutate draft.

### Version Restore Confirmation

Confirmation should explain:

- Draft will be replaced with selected version.
- Public page will not change until publish.
- Current draft will be preserved in version history/checkpoint if required by implementation.
- Active collaborators may need to reload.

Rules:

- Restore should be idempotent or protected from duplicate submit.
- Restore should notify active editor clients.
- Restore should preserve variant values and mark inactive values as unused when variables differ.

### Publish/Share/History Testing

Tests should cover:

- First publish ready.
- First publish blocked.
- Republish with draft changes.
- Publish idempotency on retry.
- Unpublish published site.
- Share modal unpublished state.
- Share modal unpublished-changes warning.
- Copy default link.
- Create/copy variant from share.
- Version history pagination.
- Restore version affects draft only.
- Restore then publish changes public version.
- Active editor receives publish/restore notification.

## Team Management, Invites, And Site Access UX

Team management controls who can enter the workspace. Site access controls who can view, copy, edit, publish, and manage a particular site inside the workspace. The UI should keep these concepts adjacent but distinct.

V1 rule: workspace admins manage members and invites. Site editors/admins manage site access according to site access policy.

### Team Page Purpose

Team page should let admins:

- View active members.
- View pending/expired/revoked invites.
- Invite a teammate.
- Resend invite.
- Revoke invite.
- Change member role.
- Remove member.
- Understand last-admin protections.

Non-admin users can:

- View active members if product chooses team visibility.
- Not see invite administration actions.
- Not see sensitive invite tokens or delivery internals.

### Member List Contract

Member row fields:

```ts
type MemberListItem = {
  membershipId: WorkspaceMembershipId
  userId: UserId
  name: string
  email: string
  avatarUrl?: string
  role: "admin" | "user"
  status: "active"
  joinedAt: string
  lastActiveAt?: string
  canChangeRole: boolean
  canRemove: boolean
}
```

Rules:

- Member list is workspace-scoped.
- Current user row should be identifiable.
- Last admin controls should be disabled with explanation.
- Removed members do not appear in active list.
- Member emails are authenticated app data only and never public payload data.

### Invite List Contract

Invite row fields:

```ts
type InviteListItem = {
  inviteId: WorkspaceInviteId
  email: string
  role: "admin" | "user"
  status: "pending" | "accepted" | "revoked" | "expired" | "send_failed"
  invitedByUser?: UserSummary
  createdAt: string
  expiresAt: string
  lastSentAt?: string
  canResend: boolean
  canRevoke: boolean
}
```

Rules:

- Raw invite token is never returned in list responses.
- Invite links are only sent by email unless a secure copy-link admin flow is explicitly added.
- Resend creates a new email job and can rotate token according to invite policy.
- Revoked/accepted invites cannot be accepted.
- Expired invites can be recreated through a new invite/resend flow.
- Repeated provider failures show row-level delivery error and retry action.

### Invite Teammate Flow

Inputs:

- Email.
- Role, default `user`.

Rules:

- Admin-only in v1.
- Email must pass work-email rules.
- Email cannot contain plus alias.
- Existing active member is blocked.
- Existing pending invite is reused/resendable.
- Submit is idempotent.
- Invite email send happens through job/outbox.
- UI shows pending invite immediately after invite row is created.
- Email provider failure does not remove invite row; it shows delivery state.

### Role Change Flow

Rules:

- Admin-only.
- Cannot change own role.
- Cannot demote last admin.
- Role change is transactional.
- Role change emits audit event.
- Role change invalidates affected user's app/realtime permissions.
- If demoted user is currently in admin-only settings, route them away.

UX:

- Changing role should require confirmation only when reducing privilege or affecting current access.
- Last-admin disabled action should explain why.
- Success updates member row and permissions quickly.

### Remove Member Flow

Rules:

- Admin-only.
- Cannot remove self from member row action.
- Cannot remove last admin.
- Removal deactivates membership.
- Effective site access stops immediately.
- Realtime sessions are disconnected or become unauthorized.
- Pending invites for same email are revoked where appropriate.
- Historical actor references remain.

UX:

- Confirmation explains workspace access removal.
- If member created private sites, admins retain access to workspace-owned sites.
- Success removes row from active list.

### Site Access Modal Purpose

Site access modal controls authenticated app access to a site.

It should answer:

- Who can see this site inside Lightsite?
- Who can edit it?
- Can everyone on the team access it?
- What can the current user do?

Rules:

- Public visitor access is not controlled here.
- Publish status controls public link availability.
- Site access changes are server-authoritative.
- Site access changes notify active editor clients.

### Site Access Modal Fields

Controls:

- Visibility: private/team.
- Entire-team role: none, view & copy, edit.
- Specific member grants.
- Member search.
- Effective access display.

Rules:

- Workspace admins have implicit full access and cannot be removed through site access rows.
- Site creator access applies while creator has active membership unless access policy changes.
- Strongest role wins between entire-team and explicit member access.
- Removed members should not appear as active grant targets.
- Existing grants for removed members do not grant effective access.
- Non-admin editors should not be able to remove their only route to editing if that would make site unmanageable for non-admin editors.

### Site Access Roles UX

Roles:

- `none`: no explicit access.
- `view_copy`: can view inside app, preview, copy/share links if published, and duplicate.
- `edit`: can edit draft, manage variants, publish if allowed, and update site settings/access according to policy.

Rules:

- Role labels should be user-facing: "No access", "View & copy", "Edit".
- Tooltips/help text can explain exact permissions.
- Public link access should be described separately.
- Access modal should not imply prospects need workspace access.

### Team And Access Testing

Tests should cover:

- Admin invites teammate.
- Non-admin cannot invite.
- Existing member invite blocked.
- Pending invite resend.
- Invite revoke.
- Invite email send failure row state.
- Role change success.
- Self role change blocked.
- Last admin demotion/removal blocked.
- Remove member revokes site access.
- Site access entire-team grants.
- Site access explicit member grants.
- Strongest role wins.
- Access change while editor open.
- Public link unaffected by team access change.

## Settings, Account, Workspace, And Danger Zone Contracts

Settings should be organized by ownership: user account settings belong to the person; workspace settings belong to the company/team; team settings manage members; billing settings manage plan state. Mixing these creates confusing permissions and accidental side effects.

### Settings Navigation

Settings areas:

- Profile.
- Workspace.
- Team.
- Billing.
- Developer/internal, hidden.
- Danger zone inside relevant area, not a global junk drawer.

Rules:

- Profile settings are available to every authenticated user.
- Workspace settings are admin-only in v1.
- Team settings are admin-only for invite/member mutation; member viewing can be broader if product keeps it.
- Billing settings are admin-only.
- Internal settings require internal access, not workspace admin.
- Settings route guards should hide admin-only routes for non-admins and server still enforces.

### Profile Settings

Fields:

- Name.
- Avatar if supported.
- Email display.
- Default workspace preference.
- Notification preferences when optional notifications exist.

Rules:

- Email is display-only in v1 unless BetterAuth account management is explicitly implemented.
- Profile changes do not change workspace memberships.
- Avatar upload uses normal asset validation if stored by Lightsite.
- Deleting/changing profile should not mutate immutable audit records.
- Profile settings should not contain workspace role controls.

### Workspace Settings

Fields:

- Workspace name.
- Workspace slug.
- Website/domain.
- Workspace logo/avatar.
- Default site avatar behavior.

Rules:

- Admin-only.
- Workspace slug changes are blocked after any site has been published until redirect support exists.
- Website is normalized to canonical domain.
- Website change can offer logo refresh but should not overwrite manual logo automatically.
- Logo change affects future new sites by default, not existing site avatars unless explicit apply action exists.
- Workspace settings changes are version/conflict protected.
- Workspace settings changes emit audit events.

### Workspace Logo Refresh

Rules:

- Fetch through server-side logo.dev integration.
- Browser never receives tokenized logo.dev URL.
- Suggested logo is previewed before applying.
- Applying suggested logo stores/copies it as Lightsite asset.
- Failure does not block settings save.
- Refresh should not overwrite current logo without explicit confirmation.

### Public URL Settings

V1:

- Show workspace slug.
- Show site slug in site settings/editor.
- Explain slug lock rules.
- No custom domains yet unless implemented deliberately.

Rules:

- Workspace slug edit is blocked after public links exist.
- Site slug edit is blocked while site is published.
- Variant slug edit is allowed with warning and tombstone reservation.
- Settings copy should explain old links can stop working when changes are allowed.
- Slug availability checks include reservations.

### Team Settings

Team settings can be the Team page or a settings subroute.

Rules:

- Do not duplicate team management logic across multiple pages.
- If Team exists as primary nav, settings can link to it rather than reimplement it.
- Member/invite mutations should use the same API and cache keys everywhere.
- Admin-only invite controls should not appear for non-admins.

### Danger Zones

Danger zones:

- Archive site in site settings or Sites page.
- Unpublish site in publish/share context.
- Remove member in team row.
- Revoke invite in invite row.
- Workspace deletion later.
- Account deletion later.

Rules:

- Keep danger zones close to the resource they affect.
- Do not put unrelated destructive actions on one page.
- Use clear confirmation copy.
- Require typed confirmation for workspace deletion/account deletion when added.
- Destructive actions are audited.
- Destructive actions are idempotent or conflict-safe.

### Settings Versioning And Conflicts

Rules:

- Workspace settings mutations include expected version.
- Site settings mutations include expected version or draft revision.
- Profile settings include user profile version if concurrent edits matter.
- Stale writes return conflict and current version where safe.
- UI preserves attempted changes and offers reload/merge where meaningful.

### Settings Testing

Tests should cover:

- Profile update.
- Workspace name update.
- Workspace slug blocked after publish.
- Website normalization.
- Logo refresh success/failure.
- Non-admin workspace settings denied.
- Team settings route permission.
- Billing settings route permission.
- Settings conflict response.
- Danger zone confirmation.

## Billing, Entitlements, Limits, And Upgrade UX

Billing should stay simple until real paid plans are enabled, but the app should not scatter plan logic through components. Entitlements and limits should be resolved server-side and exposed to the frontend as product state.

V1 can start with generous/free limits and clear placeholders, but enforcement architecture should be real.

### Billing Surface Purpose

Billing/settings should answer:

- What plan is this workspace on?
- What limits apply?
- How much usage exists?
- Who can manage billing?
- What happens when a limit is reached?
- Is billing connected/healthy when paid plans exist?

Rules:

- Workspace admins can view billing settings.
- Non-admins can see limit errors relevant to their action, but not billing management controls.
- Public pages should not depend on frontend billing state.
- Billing provider webhooks are source of truth for subscription state once paid billing exists.
- Frontend checkout success is never source of truth.

### Entitlement Resolution

Entitlements should be resolved by backend for each workspace.

Example:

```ts
type WorkspaceEntitlements = {
  planKey: string
  limits: {
    sitesMax: number
    membersMax?: number
    variantsPerSiteMax?: number
    storageBytesMax?: number
    trackingRetentionDays: number
  }
  features: {
    trackingEnabled: boolean
    customDomainsEnabled: boolean
    teamAccessEnabled: boolean
  }
}
```

Rules:

- Backend services enforce entitlements.
- Frontend uses entitlements to shape UI.
- Do not enforce limits from stale frontend state.
- Do not show upgrade UI for features that do not exist.
- Do not invent paid-plan friction before pricing/product decisions exist.
- Entitlement changes invalidate relevant query caches.

### Usage Calculation

Usage dimensions:

- Active/archived sites according to product policy.
- Active members.
- Pending invites if member limit includes invites.
- Variants per site.
- Storage bytes.
- Tracking retention.
- Custom domains later.

Rules:

- Usage used for enforcement is computed server-side.
- Usage shown in UI can be cached/slightly stale.
- Usage should explain what counts.
- Archived sites count in v1 because they retain versions, variants, assets, and analytics.
- Hard-deleted resources do not count after retention cleanup completes.

### Limit Reached UX

Limit surfaces:

- Create site.
- Duplicate site.
- Restore archived site if policy requires.
- Invite member.
- Create variant if variant limits exist.
- Upload asset if storage limit exists.
- View tracking beyond retention if plan-gated.

Rules:

- Show limit before long forms where possible.
- Server still enforces on submit.
- Preserve user input if limit is discovered on submit.
- Explain the limit in plain language.
- Show admin-only upgrade/manage billing action where available.
- For non-admins, explain they need an admin to upgrade/manage plan.
- Do not dead-end the user; offer back/cancel/save draft where possible.

### Billing States

Possible billing states when paid plans exist:

```txt
free
trialing
active
past_due
payment_failed
canceling
canceled
grace_period
paused
```

Rules:

- Do not transition a workspace to `suspended` from a single transient billing webhook failure.
- Define grace behavior before enforcing billing suspension.
- Resource creation can be blocked during past-due grace before workspace suspension is applied.
- Once billing policy explicitly suspends the workspace, V1 public routes fail closed.
- Billing state transitions are audited.
- Billing webhooks are idempotent and reconciled.

### Upgrade Flow

Rules:

- Upgrade entry points should appear only where meaningful.
- Checkout starts from backend-created session.
- Checkout success page waits for backend billing confirmation or shows pending state.
- Webhook updates workspace billing state.
- Entitlement cache invalidates after billing state changes.
- Failed checkout returns user to previous context without losing work.
- Non-admin upgrade attempts route to ask-admin state.

### Downgrade And Over-Limit Future Policy

Do not implement automatic destructive downgrade effects until product policy exists.

Future downgrade policy should decide:

- Are existing resources grandfathered?
- Which actions are blocked?
- Are public pages affected?
- How long is grace period?
- What happens to tracking retention?
- What happens to assets over storage limit?
- What admin messaging is required?

Rules:

- Never delete customer content automatically just because a plan changes.
- Prefer blocking creation/new publishes over destructive cleanup.
- Retention cleanup should follow documented policy and jobs.

### Billing Testing

Tests should cover:

- Entitlement server enforcement.
- Frontend limit display.
- Non-admin limit reached state.
- Admin upgrade entry.
- Create site blocked at site limit.
- Invite blocked at member limit if enabled.
- Archived sites count according to v1 policy.
- Checkout success pending backend confirmation.
- Billing webhook idempotency.
- Entitlement cache invalidation.

## Authentication, Session, And Account Security Contracts

Authentication should be boring, safe, and mostly delegated to BetterAuth. Lightsite should not invent its own auth system around BetterAuth. The app layer should define product rules around work email, account setup, workspace routing, invite acceptance, session-aware UI, and authorization context.

The separation is important:

- BetterAuth owns credentials, auth sessions, password reset, verification tokens, auth cookies, and provider-specific auth flows.
- Lightsite owns user profile completion, workspace membership, onboarding state, roles, permissions, and product routing.

### Auth Principles

Rules:

- Do not store passwords or auth secrets in Lightsite app tables.
- Do not duplicate BetterAuth credential state.
- Do not build parallel session cookies for authenticated app access.
- Do not rely on frontend auth state for protected API access.
- Every protected API request verifies BetterAuth session server-side.
- Every workspace-owned API request verifies active workspace membership server-side.
- Public site routes remain accessible without BetterAuth session.
- Auth error responses avoid account enumeration.

### Auth Methods

V1 recommended auth method:

- Email and password through BetterAuth.
- Email verification if BetterAuth setup supports it cleanly.

Explicitly out of V1 unless intentionally added:

- OAuth/social login.
- SAML/SSO.
- Magic links.
- Passwordless-only auth.
- Self-serve email change.

Rules:

- Do not expose UI for auth methods not configured.
- Auth method changes should not change workspace/user data model.
- OAuth later must still enforce work-email rules and invite matching.
- Magic links later must still avoid account enumeration.

### Signup Contract

Signup inputs:

- Work email.
- Password or configured BetterAuth credential input.
- Optional name if auth form collects it; account setup still verifies profile completion.

Validation:

- Email syntax.
- Work-email domain blocklist.
- No plus alias.
- Password policy delegated to BetterAuth where possible.

Flow:

1. User submits signup.
2. Client performs local validation for immediate feedback.
3. Server/BetterAuth performs authoritative auth creation.
4. Lightsite creates/updates app profile record if needed.
5. User is routed to email verification, account setup, invite continuation, or workspace setup based on state.

Rules:

- Do not create workspace before account setup/workspace setup transaction.
- Signup should not send logo.dev or workspace provider calls.
- Existing account flow should use neutral copy and safe continuation.
- Failed signup preserves entered non-sensitive fields.
- Password values are never logged.

### Login Contract

Login inputs:

- Email.
- Password or configured BetterAuth login method.

Flow:

1. User submits login.
2. BetterAuth validates credentials.
3. App loads current user/app profile.
4. App resolves next route:
   - pending invite continuation
   - account setup
   - workspace setup
   - last active workspace
   - workspace selector

Rules:

- Failed login uses neutral error copy.
- Do not reveal whether email exists.
- If email is unverified and verification is required, route to verification/resend state.
- If last active workspace is inaccessible, choose another accessible workspace or route to workspace setup/selection.
- Login should not prefetch sensitive workspace data until membership is confirmed.

### Logout Contract

Rules:

- Logout ends BetterAuth session.
- Clear authenticated TanStack Query cache.
- Disconnect realtime/editor sessions.
- Clear local editor presence state.
- Preserve local non-sensitive UI preferences if appropriate.
- Route to login or public home.
- Public site pages should not be affected by logout.

### Email Verification

Rules:

- Verification is required before workspace setup unless product intentionally allows limited pre-verification onboarding.
- Verification resend is rate-limited.
- Verification flow should be neutral about account existence.
- Verification success resumes intended flow.
- Verification token handling belongs to BetterAuth/provider.
- Lightsite stores only app profile verification-derived state if needed for routing; BetterAuth remains source of truth for auth verification.

### Password Reset

Rules:

- Password reset flow belongs to BetterAuth.
- Reset request response should be neutral.
- Reset requests are rate-limited.
- Successful reset should invalidate sessions according to BetterAuth capability/policy.
- Lightsite should route user after reset based on account/workspace setup state.
- Password reset tokens are never logged or stored in Lightsite app tables.

### Session Context

App session bootstrap should return:

```ts
type AppBootstrap = {
  user: {
    id: UserId
    email: string
    name?: string
    avatarUrl?: string
    accountSetupComplete: boolean
    internalAccess?: boolean
  }
  activeWorkspace?: {
    id: WorkspaceId
    slug: string
    name: string
    logoUrl?: string
    role: "admin" | "user"
    membershipId: WorkspaceMembershipId
  }
  workspaces: WorkspaceSwitcherItem[]
  onboarding: {
    nextStep: "verify_email" | "account_setup" | "workspace_setup" | "invite_acceptance" | "app"
    pendingInviteId?: string
  }
}
```

Rules:

- Bootstrap data should be small.
- Do not include all sites, members, analytics, or draft content.
- Do not expose internal access details beyond what UI needs.
- Workspace switcher includes only active memberships.
- Removed/suspended workspaces do not appear unless a recovery/admin flow needs them.

### Session Expiration

Rules:

- API `401` should route authenticated app to login with safe return URL.
- Return URL must be same-origin and should not include consumed tokens.
- Editor should preserve local recoverable changes before routing where possible.
- Realtime disconnect caused by auth expiration should show session-expired state.
- Public routes should not redirect to login because no session exists.

### Internal Access

Internal access is separate from workspace roles.

Rules:

- Internal access is not stored on workspace membership.
- Internal access does not grant customer workspace admin permissions.
- Internal routes require internal access checks.
- Internal support actions are audited.
- Internal access should be granted/revoked through controlled operational process, not normal workspace UI.

### Auth Security Testing

Tests should cover:

- Signup work-email validation.
- Signup plus alias rejection.
- Signup personal-domain rejection.
- Existing account neutral response.
- Login success.
- Login failure neutral response.
- Logout clears app cache and realtime.
- Email verification routing.
- Password reset neutral request.
- Session expired on app route.
- Public route unaffected by auth.
- Workspace membership required after auth.
- Internal access does not imply workspace admin.

## Invite Acceptance, Account Setup, And Workspace Setup Contracts

Onboarding should be resilient. Users may arrive from signup, login, invite links, expired invites, multiple workspaces, incomplete profile state, or interrupted workspace setup. The app should resume the correct next step without duplicating workspaces, losing invite context, or granting access based on email domain alone.

### Onboarding State Machine

Onboarding states:

```txt
needs_email_verification
needs_account_setup
needs_invite_acceptance
needs_workspace_setup
ready_for_app
blocked_invite_expired
blocked_invite_revoked
blocked_account_mismatch
```

Rules:

- Account setup and workspace setup are separate.
- Invite acceptance can happen before workspace setup if user is joining an existing workspace.
- Workspace setup creates a new workspace only for users not accepting an existing workspace invite.
- Onboarding state should be derived from user/auth/profile/membership/invite state, not stored as a fragile single flag.
- If an onboarding step is interrupted, login resumes the next required step.

### Account Setup

Account setup fields:

- Display name.
- Optional avatar later.

Rules:

- Display name is required for app usability.
- Email comes from BetterAuth and is not edited in profile setup.
- Account setup completion should be stored on app profile.
- Account setup does not create workspace membership by itself.
- Account setup should preserve invite continuation context.

UX:

- Keep account setup short.
- Do not ask for workspace/company fields here.
- If user came from invite, mention they will join the invited workspace after setup.
- If user already has profile complete, skip.

### Invite Link Entry

Invite link may be opened by:

- Logged-out user.
- Logged-in matching user.
- Logged-in different user.
- Existing account without profile complete.
- New user.
- User already active member.
- Expired/revoked/accepted invite.

Rules:

- Raw invite token is validated server-side.
- Raw invite token should be removed from URL after safe capture/validation where possible.
- Logged-out user routes to signup/login with invite continuation.
- Logged-in matching user can accept after profile setup if needed.
- Logged-in different user sees account mismatch and can switch accounts/logout.
- Existing active member routes to workspace without creating duplicate membership.
- Expired/revoked invite shows clear blocked state.
- Accepted invite can route to workspace if current user is the accepted user; otherwise show safe unavailable state.

### Invite Acceptance Transaction

Transaction:

1. Resolve invite by token hash.
2. Lock invite row.
3. Verify invite is pending and unexpired.
4. Verify authenticated email matches normalized invite email.
5. Verify workspace is active.
6. Verify user is not already active member.
7. Create membership.
8. Mark invite accepted.
9. Audit `member.invite_accepted`.
10. Invalidate workspace switcher/bootstrap cache.

Rules:

- Race between accept/revoke is resolved transactionally.
- Duplicate accept returns stable already-accepted/conflict response.
- Invite token is single-use.
- Acceptance does not depend on email domain matching workspace website.

### Workspace Setup Fields

Workspace setup fields:

- Workspace name.
- Workspace slug.
- Website/domain.
- Workspace logo/avatar.

Rules:

- Workspace name required.
- Workspace slug required and globally unique/reserved-safe.
- Website/domain required.
- Logo optional but strongly encouraged.
- Workspace creator becomes admin.
- Workspace setup transaction creates workspace, settings/defaults, creator membership, and initial billing/trial record if applicable.
- Failed transaction leaves no partial workspace.
- Duplicate submit cannot create duplicate workspaces.

### Workspace Slug Setup

Rules:

- Generate from workspace name while slug field is pristine.
- User can edit.
- Local validation rejects reserved/invalid slugs immediately.
- Debounced availability check includes active/retained/reserved slugs.
- Submit enforces uniqueness with database constraint.
- If slug is claimed between check and submit, preserve all other fields.
- Slug is locked after public links exist.

### Workspace Website Setup

Rules:

- Accept domain or URL input.
- Normalize to canonical domain.
- Strip protocol, path, query, and hash.
- Reject localhost, private IPs, placeholder domains, malformed domains.
- Store canonical domain.
- Do not use website domain as authorization proof.
- Website domain powers logo lookup and future enrichment only.

### Workspace Logo Setup

Sources:

- Suggested logo via logo.dev.
- User upload.
- Skip/default fallback.

Rules:

- logo.dev is called server-side only.
- Browser never receives tokenized logo.dev URL.
- Suggested logo is copied into Lightsite asset storage when accepted.
- User can upload instead.
- User can skip.
- logo.dev failure does not block workspace setup.
- Manually selected/uploaded logo is not overwritten by later logo suggestion.
- Workspace logo becomes default site avatar for future new sites.

### Post-Setup Landing

After workspace setup:

- If template/first-site flow exists, guide to create first site.
- Otherwise route to Sites page empty state.

Rules:

- Do not drop user into a blank dashboard with no next action.
- Do not force billing prompts during first workspace setup unless hard limit requires it.
- Do not auto-publish anything.
- Do not auto-create variants.

### Onboarding Recovery

Recovery cases:

- Browser closes after signup before account setup.
- Browser closes after account setup before workspace setup.
- Workspace setup submit times out but transaction succeeds.
- Invite accepted but client loses response.
- logo.dev request fails.
- User signs in as different account during invite flow.

Rules:

- On login/bootstrap, derive next step from durable state.
- Idempotency keys protect workspace creation.
- Invite acceptance retry detects accepted state.
- Logo suggestion can be retried independently.
- Account mismatch provides clear sign out/switch account path.

### Onboarding Testing

Tests should cover:

- New signup to account setup.
- Account setup to workspace setup.
- Workspace setup successful transaction.
- Workspace setup duplicate submit.
- Slug race during workspace setup.
- Invalid website.
- logo.dev success.
- logo.dev failure.
- Invite logged-out user.
- Invite logged-in matching user.
- Invite logged-in mismatched user.
- Expired invite.
- Revoked invite.
- Already accepted invite.
- User already member.
- Resume interrupted onboarding after login.

## Public Page Runtime, Tracking Script, And Visitor Safety

Public pages are the customer-facing output of Lightsite. They should be fast, stable, accessible, cacheable, and independent from authenticated app code. Tracking should never block rendering, never collect more than needed, and never make public page availability depend on analytics infrastructure.

### Public Runtime Principles

Rules:

- Public page renders without BetterAuth session.
- Public page uses published snapshot only.
- Public page does not import app shell/editor/internal code.
- Public page should render meaningful content before tracking initializes.
- Tracking failure does not break page rendering.
- Embed failure does not break page rendering.
- Public page does not expose draft/private/internal fields.
- Public page is cacheable by published version and variant revision.

### Public Page Boot Order

Recommended boot order:

1. Resolve public route server-side.
2. Load published snapshot and variant values.
3. Render HTML with metadata and critical content.
4. Load public CSS/assets.
5. Defer tracking script.
6. Lazy-load below-fold media/embeds.
7. Initialize tracking only after route is confirmed valid.

Rules:

- Do not wait for tracking ingest to render page.
- Do not require client-side JS for core content where possible.
- Do not execute embed scripts before user can see primary content.
- Do not include authenticated user/session data.

### Tracking Context

Public HTML can include a small signed/opaque tracking context.

Context should include:

- Site ID.
- Workspace ID.
- Published version ID.
- Variant ID when present.
- Variant revision when present.
- Tracking mode.
- Expiration.
- Signature/key ID.

Rules:

- Context should not include recipient email.
- Context should not include workspace slug/site slug if IDs are enough.
- Context should be short-lived or scoped so it cannot be reused indefinitely.
- Ingest validates signature and current publish/tracking state.
- Ingest does not reveal whether a private resource exists.

### Tracking Script Contract

Script responsibilities:

- Initialize session.
- Send page view.
- Track time spent.
- Track scroll thresholds.
- Track configured element clicks.
- Track preview/bot requests only server-side where appropriate.
- Flush best-effort on visibility change/pagehide.

Rules:

- Script is versioned.
- Script is dependency-free or near dependency-free.
- Script is small enough for public page budget.
- Script does not require authenticated cookies.
- Script uses sendBeacon/fetch keepalive where available.
- Script batches events.
- Script dedupes scroll thresholds per session.
- Script avoids tracking text selection, mouse movement, keystrokes, form input values, or arbitrary clicks.
- Script respects tracking mode/disabled state.

### Visitor Session Identity

Rules:

- Session ID is opaque and random.
- Use memory/session storage where possible.
- Avoid long-lived cross-site cookies in v1.
- Anonymous visitor ID, if used, is scoped to site/link context or privacy-reviewed boundary.
- Do not identify default-link visitors as people.
- Variant link visitor is attributed to variant/link, not authenticated identity.

### Time Spent Runtime

Rules:

- Track active visible time.
- Pause when tab hidden.
- Cap session duration to prevent abandoned-tab inflation.
- Send periodic heartbeat at conservative interval.
- Do not send heartbeat so often that costs grow unnecessarily.
- Summaries use server receive time and documented caps.

### Scroll Runtime

Rules:

- Track thresholds, not every scroll position.
- Thresholds should be configurable constants.
- Fire each threshold once per session/site/version/variant.
- Recalculate document height after media load where practical.
- Respect reduced motion for scroll behaviors.
- Do not block scrolling with heavy listeners; use passive/throttled listeners.

### Click Runtime

Rules:

- Track configured public elements only.
- Element IDs come from stable block/nested item IDs.
- Capture label snapshot and URL snapshot.
- Redact sensitive query params according to URL snapshot policy.
- Use best-effort send before navigation.
- Do not delay navigation for analytics.
- Do not track arbitrary clicks on text/body.

### Bot And Preview Handling

Rules:

- Server classifies known preview/bot user agents during metadata/OG requests.
- Preview loads create `link_preview_loaded`, not human visit.
- Slack/preview detection is probabilistic and labeled carefully.
- Bot filtering should not require public page JavaScript.
- Known bots should be excluded from human engagement metrics by default.

### Public Runtime Failure Modes

Failure handling:

- Tracking script blocked: page still works.
- Ingest endpoint down: page still works; events may be lost.
- Asset missing: optional fallback or publish-blocking if required.
- Embed blocked: show fallback link/state.
- Renderer error: public-safe error/404 and internal log.
- Stale cache: origin still enforces current publish state.

### Public Runtime Testing

Tests should cover:

- Public page loads without auth.
- Public page excludes app/editor bundles.
- Default link page view tracked.
- Variant link page view tracked with variant revision.
- Tracking disabled omits/blocks script events.
- Scroll threshold dedupe.
- Click tracking does not block navigation.
- Hidden tab does not accumulate active time.
- Slackbot request records preview event.
- Tracking endpoint failure does not break page.
- Public cache key changes on publish/variant revision.

## Embed Provider, Iframe, And Third-Party Runtime Policy

Embeds make sales one-pagers useful, especially calendar booking and video, but they are also a security, performance, privacy, and layout risk. V1 should support only allowlisted providers with normalized URLs and safe fallbacks.

### Embed Principles

Rules:

- No arbitrary HTML embeds in v1.
- No arbitrary script embeds in v1.
- Supported providers are allowlisted.
- Embed URLs are normalized and stored as structured provider data.
- Provider-specific parsing happens server-side or in shared validators.
- Unsupported providers block publish.
- Embeds lazy-load.
- Embeds have fallback links.
- Embeds use sandbox/restricted iframe attributes where provider compatibility allows.

### Supported V1 Providers

Recommended V1:

- Cal.com.
- Calendly.
- YouTube or Vimeo only if video block ships.

Rules:

- Do not add providers without validator, renderer, CSP review, fallback behavior, and tests.
- Provider list lives in shared config/registry.
- Provider display names and URL examples live near validators.
- Provider renderer should not be custom-written in random blocks.

### Embed Data Shape

Recommended shape:

```ts
type EmbedValue = {
  provider: "cal_com" | "calendly" | "youtube" | "vimeo"
  originalUrl: string
  normalizedUrl: string
  embedUrl: string
  fallbackUrl: string
  title?: string
}
```

Rules:

- Store original URL for user reference/debugging if safe.
- Render from normalized/embed URL.
- Do not store pasted iframe HTML.
- Do not store provider scripts.
- Validate protocol and hostname.
- Reject private/local URLs.

### Calendar Embed Behavior

Rules:

- V1 tracks click/open/interaction, not confirmed booking.
- Confirmed booking requires provider integration/webhook.
- If provider embed fails, show fallback booking link.
- Calendar embeds should not block the rest of the page.
- Calendar embed titles should be accessible.
- Calendar provider scripts should be deferred/lazy where possible.

### Video Embed Behavior

Rules:

- Video embed is optional v1.
- Use privacy-conscious embed URLs where provider supports them.
- Lazy-load video iframe/thumbnail.
- Do not autoplay with sound.
- Track video play only if provider event integration is reliable and privacy-reviewed.
- Otherwise track embed click/interaction only.

### Iframe Security

Rules:

- Use `sandbox` attribute where compatible.
- Restrict `allow` attributes to what provider needs.
- Set iframe `title`.
- Use `loading="lazy"` where appropriate.
- Use `referrerpolicy` when useful.
- Prevent user-controlled iframe attributes.
- CSP should restrict frame sources to allowlisted providers.

### Embed Layout

Rules:

- Embeds reserve aspect ratio/height to prevent layout shift.
- Mobile layout must not overflow horizontally.
- Failed embed state should fit in page design.
- Embed block should have clear settings in inspector.
- Public renderer should not let provider content overlap Lightsite UI.

### Embed Privacy

Rules:

- Embeds may send visitor data to provider when loaded.
- Lazy loading reduces unnecessary provider requests.
- Privacy policy should mention third-party embeds if enabled.
- Do not load third-party embeds in editor previews unnecessarily if a lightweight placeholder can represent them.
- Avoid adding third-party ad/tracker scripts.

### Embed Testing

Tests should cover:

- Valid Cal.com URL normalizes.
- Valid Calendly URL normalizes.
- Unsupported provider rejected.
- Pasted iframe HTML rejected.
- Private/local URL rejected.
- Public embed renders iframe with safe attributes.
- Fallback link renders.
- Embed lazy-load behavior.
- Mobile embed does not overflow.
- CSP allows supported provider and blocks unsupported provider.

## Design System Governance, Component Contracts, And UI Consistency

Lightsite should feel like one coherent product even as features grow. The design system should make implementation faster and safer, not become a second product or a folder full of disconnected examples. shadcn primitives are the base layer. Lightsite-specific components should be composed from those primitives, use the Figma/shadcn token system, and live in the right ownership layer.

The goal is to prevent component drift before the app has dozens of screens.

### Design System Principles

Rules:

- shadcn primitives live in `components/ui`.
- Primitive-level behavior, variants, sizing, and styling belong in the primitive file only when reusable app-wide.
- Product-specific components do not belong in `components/ui`.
- Feature-specific UI starts inside the owning feature.
- Shared composed components move to common/shared folders only after real reuse exists.
- Product UI uses semantic tokens, not raw color palettes.
- Product icons use `@tabler/icons-react`.
- Components should support loading, empty, disabled, error, and permission-aware states where relevant.
- Component APIs should be boring, typed, and narrowly scoped.

### Component Ownership Layers

Ownership layers:

```txt
components/ui              # shadcn primitives and primitive variants
components/layout          # app shell, sidebar, page chrome
components/common          # reused composed product components
components/data-display    # tables, metric cards, feeds, empty states
components/feedback        # confirmations, alerts, toasts
features/*/components      # feature-owned product UI
features/*/screens         # route-level feature screens
```

Rules:

- Do not skip from feature-specific need directly to global component.
- Promote only when at least two unrelated features need the same composed behavior.
- Promotion should move tests/stories/examples with the component.
- Avoid circular imports between shared components and features.
- Shared components should not import feature API hooks.

### Primitive Customization Rules

Modify shadcn primitives when:

- The change should apply everywhere.
- The variant is reusable.
- The sizing/state behavior is part of the design system.
- Accessibility behavior needs central improvement.

Do not modify primitives when:

- The change is specific to Sites, Editor, Tracking, Team, or Settings.
- The component needs product data.
- The style is a one-screen exception.
- The behavior depends on route/feature state.

Rules:

- Prefer `cva` variants for reusable visual variants.
- Keep primitive props close to shadcn conventions.
- Preserve upstream accessibility behavior unless intentionally improving it.
- Document any intentional primitive divergence.

### Token Usage

Rules:

- Use semantic tokens like `bg-background`, `text-muted-foreground`, `bg-page-background`, `text-tertiary-foreground`, `editing-*`, and `variable-*`.
- Do not use raw hex values in product components.
- Do not introduce local color scales in feature CSS.
- Typography, radius, spacing, and shadow choices should follow shadcn/Figma token values.
- If a new semantic token is needed, add it to the central theme and document its purpose.
- Do not create separate theme CSS files.

### Table And Data Display Components

Tables/lists power Sites, Tracking, Team, Assets, and Billing.

Rules:

- Data tables support loading, empty, no-results, error, and permission-limited states.
- Sorting/filtering state is controlled by route/query state where shareable.
- Row actions use a consistent menu pattern.
- Destructive row actions require confirmation.
- Tables should be keyboard navigable.
- Dense operational tables should not use decorative card layouts.
- Large lists use pagination/cursors.
- Columns should have stable widths where possible to avoid jitter.

### Dialog, Sheet, And Drawer Patterns

Rules:

- Use Dialog for focused decisions/forms.
- Use Sheet/Drawer for side panels and inspector-like flows.
- Use AlertDialog/confirmation pattern for destructive/link-breaking actions.
- Avoid nested modals.
- Multi-step modals replace internal content instead of stacking.
- Escape/click-outside behavior is intentional for dirty forms.
- Focus traps and return focus are required.
- Dialog width/height should fit content and remain usable on mobile.

### Command And Action Components

Rules:

- Buttons represent commands.
- Icon-only buttons require accessible labels and tooltips.
- Button variants communicate hierarchy consistently.
- Loading buttons preserve size.
- Disabled buttons should explain why when the reason is not obvious.
- Dangerous actions use destructive variants and confirmation.
- Copy-link controls have consistent success/failure feedback.

### Design System Page

The design system page should show:

- Tokens.
- Primitive variants.
- App layout components.
- Common data displays.
- Feedback states.
- Forms.
- Tables.
- Modals/drawers.
- Editor-specific controls where useful.
- Real product examples with mock data.

Rules:

- Design system page is internal/dev-only.
- It should use actual components, not screenshots.
- It should include edge states, not only happy paths.
- It should not become the only place a component works.
- It should be updated when shared primitives/components change.

### Component Quality Checklist

Before promoting a component:

- Typed props.
- Clear ownership.
- No feature API imports unless feature-owned.
- Loading/empty/error states if data-bearing.
- Keyboard accessible.
- Uses tokens.
- Uses Tabler icons where applicable.
- Handles long text.
- Handles mobile width.
- Has focused tests or visual examples.
- Does not create a new color/type/radius pattern unnecessarily.

### Design System Testing

Tests should cover:

- Primitive variants render.
- Button/icon accessible labels.
- Dialog focus trap/return.
- Table empty/no-results/loading states.
- Form field error association.
- Long text layout.
- Mobile viewport layout.
- Design system route protected/internal.
- No public bundle imports design system/dev routes.

## Accessibility, Responsive Behavior, And Cross-Browser Contracts

Accessibility and responsive behavior should be designed into the app, not patched at the end. Lightsite has three different surfaces with different requirements: the authenticated app, the editor, and public pages. Public pages are launch-critical on mobile. The editor can be optimized for desktop, but it still needs graceful behavior and clear messaging.

### Accessibility Principles

Rules:

- Interactive controls have accessible names.
- Keyboard users can complete core workflows.
- Focus is visible.
- Focus order matches visual order.
- Dialogs trap and restore focus.
- Errors are associated with fields.
- Color is not the only state indicator.
- Motion respects reduced-motion preferences.
- Public pages should be screen-reader and keyboard usable.
- Editor accessibility limitations must be explicit and tracked before launch.

### Authenticated App Accessibility

Core app workflows:

- Sign up/login.
- Onboarding.
- Workspace switcher.
- Sites list/search/filter.
- Create site.
- Publish/share.
- Team invite/member management.
- Settings forms.
- Tracking dashboard filter/feed.

Rules:

- These workflows should be usable by keyboard.
- Form validation moves focus to first invalid field on submit.
- Route changes set sensible focus.
- Toasts do not hide critical information.
- Tables support keyboard access to row actions.
- Sidebar/drawer navigation works at mobile and desktop sizes.

### Editor Accessibility

Editor launch baseline:

- Type/edit text fields.
- Select block.
- Insert block.
- Delete block with confirmation/undo path.
- Use inspector fields.
- Publish.
- Open preview/share/version history.

Rules:

- Drag/reorder should have keyboard alternative or documented launch caveat with follow-up.
- Hover-only controls must have focus equivalents.
- Rich text toolbar is keyboard reachable.
- Variable chips are navigable and understandable.
- Read-only mode is announced through UI text/state, not color only.
- Presence indicators do not interfere with screen readers.

### Public Page Accessibility

Public pages should support:

- Mobile and desktop layouts.
- Keyboard navigation.
- Screen reader-friendly headings.
- Meaningful link/button labels.
- Image alt text.
- Accessible accordions.
- Accessible tables where table block is used.
- Embeds with titles and fallback links.

Rules:

- Publish validation should warn/block missing required alt text.
- Heading hierarchy should not be impossible to follow.
- Public CTAs should be real links/buttons.
- Public page should not require JavaScript for basic reading.
- Tracking script must not steal focus or trap input.

### Responsive Contracts

Breakpoints should be tokenized/standardized.

Public page:

- Mobile first.
- Content readable without horizontal scroll.
- Media scales within container.
- Tables use responsive strategy for genuinely tabular content.
- Embeds reserve space and do not overflow.
- Header/footer remain usable.

Authenticated app:

- App shell usable on laptop/desktop.
- Tablet usable for browsing/tracking/settings.
- Mobile app shell can be simplified but should not overlap content.
- Dense tables can use horizontal scroll only where unavoidable and clearly indicated.

Editor:

- Desktop recommended.
- Tablet may be usable if layout supports it.
- Mobile editing can show limited/editing-not-recommended state if full editor is not practical.
- Public preview mobile mode remains available in editor.

### Browser Support

Recommended support:

- Latest Chrome/Edge.
- Latest Safari.
- Latest Firefox.
- Mobile Safari/Chrome for public pages.

Rules:

- Public pages receive the broadest support.
- Authenticated app can target modern evergreen browsers.
- Editor can require modern browser capabilities, but unsupported browser message should be clear.
- Do not rely on APIs without fallback/polyfill decision.

### Accessibility And Responsive Testing

Tests should cover:

- Axe/accessibility checks for core app pages.
- Keyboard navigation through dialogs/forms.
- Public page mobile screenshot.
- Public page desktop screenshot.
- Editor desktop smoke.
- Editor small-screen behavior.
- Reduced motion mode.
- High zoom/large text.
- Table responsive behavior.
- Embed mobile overflow.
- Screen-reader labels for icon buttons.

## Release Readiness, QA Matrix, And Acceptance Gates

Lightsite should ship in deliberate slices. A large spec is only useful if implementation has gates that preserve quality. Each milestone should have acceptance criteria, test coverage, performance checks, migration safety, and rollback expectations.

### Release Principles

Rules:

- Small releases beat giant risky launches.
- Each release has an owner and scope.
- Every release defines what is intentionally not included.
- Database migrations are backward-compatible where practical.
- Public route behavior is smoke-tested before release.
- Auth/permission changes receive extra review.
- Tracking changes receive privacy/performance review.
- Editor changes receive recovery/undo review.

### Definition Of Done

For a feature to be done:

- Spec section exists or is updated.
- API contracts are typed.
- Database migrations are written and reviewed if needed.
- Permission checks are implemented server-side.
- UI states include loading/empty/error/permission states.
- Tests cover happy path and meaningful failure path.
- Analytics/observability added if workflow is important.
- Docs/config updated if behavior depends on environment.
- No known data-loss path.
- No public/private data leak path.

### QA Matrix

Core QA areas:

- Auth and onboarding.
- Workspace setup/switching.
- Sites list/create/duplicate/archive/restore.
- Editor content editing.
- Variables and variants.
- Publish/unpublish/share.
- Public rendering.
- Tracking ingest/dashboard.
- Team/invites/access.
- Settings/billing limits.
- Assets/uploads.

For each area verify:

- Happy path.
- Permission denied.
- Network failure.
- Validation failure.
- Race/conflict where applicable.
- Mobile/responsive where applicable.
- Accessibility baseline.

### Pre-Release Checklist

Checklist:

- Typecheck passes.
- Lint passes.
- Unit tests pass.
- API contract tests pass.
- Service permission tests pass.
- E2E smoke passes.
- Public page visual smoke passes.
- Accessibility smoke passes.
- Migrations run from empty database.
- Migrations run on seeded database.
- Build output checked for public/app bundle separation.
- Env validation passes in target environment.
- Observability dashboards/alerts exist for changed critical flows.
- Rollback plan is known.

### Migration Acceptance

Migration release rules:

- Additive schema change first.
- Backfill separately for large data.
- Enforce not-null/constraints only after backfill.
- No long locks on large production tables.
- Old app version can run during migration window when practical.
- Migration rollback strategy documented.
- Content schema migrations have fixtures.
- Published snapshots remain renderable.

### Public Launch Gates

Before public pages are used by real prospects:

- Public route cannot render drafts.
- Published snapshot immutable.
- Unpublish/archive returns public-safe 404.
- Public page excludes app/editor bundle.
- Public page mobile responsive.
- Tracking failure does not break page.
- OG image works.
- Slack preview detected/labeled correctly.
- CSP/embed policy smoke-tested.
- Asset URLs stable.

### Editor Launch Gates

Before editor is considered usable:

- Create/edit/delete/reorder blocks.
- Autosave/retry works.
- Undo/redo works for core operations.
- Publish validation blocks broken public page.
- Version history restore works.
- Local recovery handles failed save.
- Read-only mode works.
- Permission loss while editing handled.
- Editor performance acceptable with max v1 content size.

### Release Rollback

Rules:

- Code rollback should not require database rollback for normal additive migrations.
- Feature flags can disable new surfaces but not replace permission checks.
- Public renderer rollback must keep current published snapshots renderable.
- Bad content migration should roll forward with fix and use version history only for per-site repair.
- Tracking schema mistakes should preserve raw events for reprocessing where possible.

## Support, Internal Admin, And Operational Tooling Contracts

Support and internal admin tooling should help operate Lightsite without creating hidden product behavior or privacy risk. Internal tools should prefer metadata, request IDs, audit events, and safe status views over direct content access.

### Support Principles

Rules:

- Support access is least-privilege.
- Internal support metadata access is separate from customer workspace admin.
- Content access is not part of v1 support by default.
- Any future content access is time-bound, reasoned, audited, and preferably customer-visible.
- Internal actions are audited.
- Support tools should never expose secrets.
- Support tools should not mutate customer data except through explicit controlled actions.

### Support Identifiers

Support workflows should use:

- Request ID.
- Workspace ID.
- Site ID.
- Published version ID.
- Variant ID.
- Job ID.
- Outbox event ID.
- User ID.
- Provider event ID.

Rules:

- UI errors should show request ID for unexpected failures.
- Support should be able to search by request ID.
- Logs and audit events should correlate by request ID/trace ID.
- Avoid asking customers for internal IDs when public URL is enough to locate metadata safely.

### Internal Admin Surfaces

V1 internal surfaces can include:

- Workspace metadata lookup.
- User metadata lookup.
- Site/public status lookup.
- Publish/cache status.
- Job/outbox status.
- Email delivery status for invites.
- Abuse report/takedown metadata.
- Feature flag view.

Rules:

- Product admin exposes constrained operational actions only; database consoles are excluded.
- No secret display.
- No silent impersonation.
- No customer content viewing by default.
- Mutating internal actions require reason and audit.
- Dangerous internal actions require confirmation.

### Support Runbooks

Runbooks should exist for:

- User cannot log in.
- User stuck in onboarding.
- Invite not received.
- Invite accepted by wrong account attempt.
- Workspace slug unavailable.
- Public site returns 404.
- Publish failed.
- Tracking missing.
- Asset upload failed.
- Realtime collaboration degraded.
- Billing limit unexpectedly blocks action.
- Suspected abuse/phishing public page.

Each runbook should include:

- What the user sees.
- What support can inspect.
- What support must not inspect.
- Likely causes.
- Safe remediation.
- Escalation path.
- Audit requirements.

### Operational Tools Testing

Tests/reviews should cover:

- Internal route requires internal access.
- Workspace admin cannot access internal tools.
- Internal metadata lookup does not expose content/secrets.
- Takedown action audited.
- Job retry action audited.
- Support search by request ID.
- Abuse report creates reviewable record.

## Monorepo, Package Boundaries, And Build Ownership

The repository should make the clean path the easy path. Lightsite will grow across app UI, public rendering, editor logic, backend APIs, workers, schemas, tests, and operational scripts. The package structure should keep those responsibilities separate enough that a change in one area does not quietly leak into another.

Recommended workspace shape:

```txt
apps/
  web/                    # React/Vite authenticated app, editor, public preview shell where applicable
  server/                 # Node API server, auth integration, application services
  worker/                 # background jobs, outbox processing, analytics rollups, media work

packages/
  contracts/              # shared API contracts, DTO schemas, typed route shapes
  domain/                 # pure domain rules and policy helpers with no framework dependency
  content-schema/         # site document schema, block registry, validation, migrations
  tracking-schema/        # tracking payload schemas, event names, aggregation contracts
  config/                 # environment parsing, typed runtime config, safe defaults
  test-fixtures/          # factories, seeded objects, realistic sample site documents
```

This can start as a small workspace, but the ownership lines should exist from the beginning. We should not wait for the repo to become painful before separating editor schema, public rendering contracts, API contracts, and operational code.

### Package Ownership

Ownership rules:

- `apps/web` owns React routes, UI composition, TanStack Router/Query setup, shadcn usage, and browser-only behavior.
- `apps/server` owns HTTP APIs, BetterAuth wiring, request context, service orchestration, database transactions, authorization checks, and response shaping.
- `apps/worker` owns asynchronous execution only. It should not expose request/response code and should not import React.
- `packages/contracts` owns schemas used between frontend and backend. It should not import database clients, React, or server runtime utilities.
- `packages/domain` owns pure business logic: slug validation, role checks, plan gates, publish state transitions, invite state transitions, variable resolution policies, and safe link semantics.
- `packages/content-schema` owns the site document schema, block schemas, document validation, document migrations, and publish-readiness checks.
- `packages/tracking-schema` owns tracking event schema names, payload validation, bot/preload classification enums, and aggregation input contracts.
- `packages/config` owns environment variable validation and typed config objects.
- `packages/test-fixtures` owns realistic builders for users, workspaces, sites, variables, variants, assets, visits, and published snapshots.

The rule of thumb: if logic must be identical in more than one runtime, put it in a package. If logic is runtime-specific, keep it in the app that owns that runtime.

### Dependency Direction

Allowed dependency direction:

```txt
apps/* -> packages/*
packages/contracts -> no app packages
packages/domain -> contracts where useful, no apps, no database client
packages/content-schema -> contracts/domain where useful, no apps
packages/tracking-schema -> contracts/domain where useful, no apps
packages/config -> no apps
packages/test-fixtures -> contracts/domain/content-schema/tracking-schema
```

Rules:

- Packages must not import from `apps/*`.
- Public-rendering code must not import editor-only UI, app shell code, internal admin code, or authenticated-app data hooks.
- Editor-heavy dependencies should stay out of public-page bundles unless the public route truly needs them.
- Backend-only dependencies should never be reachable from `apps/web` browser bundles.
- A package should expose a narrow API through `exports`; avoid importing private package internals across package boundaries.
- Shared packages should avoid broad barrels that make it easy to import too much.
- Types and pure helpers may cross boundaries; runtime clients and stateful services should stay in their owning app.

Failure mode this prevents: a public page accidentally pulling in editor code, app shell UI, private API clients, or a huge dependency because a convenience export looked harmless.

### Build Targets

Each workspace should have explicit targets:

- `typecheck`: TypeScript type checking for that workspace.
- `lint`: code style, import boundaries, hook rules, and package boundary rules.
- `test`: unit and integration tests owned by that workspace.
- `build`: production build or compiled output where applicable.
- `check`: aggregate command that runs the expected local quality gate for that workspace.

Root-level commands should orchestrate all workspaces:

```txt
dev                 # starts local app dependencies and app servers
check               # typecheck + lint + tests expected before merge
typecheck           # all workspaces
lint                # all workspaces
test                # all non-e2e tests
test:e2e            # browser e2e tests
db:migrate          # apply migrations
db:seed             # seed local development data
db:reset:local      # reset local database only, with explicit local safety check
contracts:check     # ensure generated/shared contracts are current
```

CI should run the same commands that developers run locally. Hidden CI-only behavior creates a slow feedback loop and makes quality feel arbitrary.

### Bundle Boundaries

The app should treat bundle composition as an architecture concern:

- Authenticated app shell bundle can include app navigation, tables, settings, and editor entry points.
- Editor bundle can include Tiptap, collaboration code, block controls, media picker, and editor command surface.
- Public page bundle should be lean: renderer, public content schema, variable resolver, tracking client, media helpers, and embed runtime only.
- Tracking client should be very small and should not import app analytics dashboards.
- Design-system route can import broad component examples because it is internal to the app and not part of public rendering.
- Admin/support surfaces should be code-split behind internal routes.

Public page performance depends on keeping the public runtime boring and small. The public viewer should not pay for the builder.

### Contract And Schema Generation

Generated artifacts are allowed when they improve correctness, but they need ownership:

- Generated files must be clearly marked at the top.
- Generated files should be deterministic.
- Generation commands should be documented and runnable locally.
- CI should fail when generated artifacts are stale.
- Generated files should not contain secrets or environment-specific values.
- Hand edits to generated files are not allowed; edit the source schema instead.

Candidate generated artifacts:

- API client types.
- Route contract types.
- Database type snapshots if using a typed query tool.
- OpenAPI or internal API documentation.
- Event schema documentation.
- Content-schema JSON schema for validation tooling.

### Dependency Management

Dependency rules:

- Add dependencies at the narrowest workspace that needs them.
- Avoid two libraries for the same job unless there is a documented reason.
- Do not add a dependency for a tiny helper that can be expressed clearly in app code.
- Do not add a dependency that increases the public bundle without measuring the impact.
- Keep editor-only packages out of public routes.
- Keep server-only packages out of browser code.
- Keep worker-only packages out of API request paths.
- Prefer boring, maintained libraries for core infrastructure.

Review questions for any new dependency:

- Which workspace owns it?
- Does it affect public page bundle size?
- Does it affect cold start or request latency?
- Does it introduce a security-sensitive parser, sanitizer, upload handler, or auth surface?
- Does it duplicate a capability we already have?
- Is the package actively maintained?

### Package Testing

Testing should follow ownership:

- `packages/domain`: pure unit tests for role logic, state machines, slug policy, plan gates, and permission predicates.
- `packages/content-schema`: schema validation, document migrations, invalid document rejection, publish-readiness checks, variable resolution, and block registry behavior.
- `packages/tracking-schema`: payload validation, event version compatibility, bot/preload classification inputs, and aggregation contract shape.
- `packages/contracts`: request/response schema validation and compatibility tests.
- `apps/server`: API authorization, transactions, service orchestration, error mapping, and database integration tests.
- `apps/web`: route behavior, form states, mutation flows, editor UI wiring, accessibility checks, and public renderer smoke tests.
- `apps/worker`: idempotency, retry behavior, outbox processing, rollup correctness, and dead-letter handling.

Shared packages should be easy to test because they should be mostly pure. If a shared package requires browser, database, or network setup to test normal business rules, it likely owns too much.

## Developer Workflow, Code Review, And Implementation Hygiene

Lightsite should be pleasant to build because the development workflow prevents uncertainty. Every feature should have a clear place to live, a clear test shape, clear environment requirements, and clear review criteria.

### Local Development Workflow

Local development should support:

- One command to start the common local stack.
- Local Postgres with seeded demo workspace, demo users, sites, variables, variants, assets, tracking events, and published snapshots.
- A deterministic seed that can be reset without damaging non-local environments.
- Mail capture in local development instead of sending real invite or auth email.
- Local object storage or a stable mock for uploads.
- Local worker process for jobs that are part of normal flows.
- A way to run app without optional third-party integrations.
- Clear `.env.example` with every required and optional variable documented.

Local seed data should include:

- A completed workspace with logo and website.
- A user who has not completed onboarding.
- Workspace members with `admin` and `user` roles, plus removed/revoked membership scenarios.
- Sites in draft, published, unpublished, archived, and deleted-like states.
- A site with variables and multiple variants.
- A site with version history.
- A site with failed publish job.
- Tracking data with real visitor sessions, bot-like events, and empty analytics state.
- Invite states: pending, accepted, expired, revoked.

Good seeds make edge cases visible before they become production surprises.

### Change Readiness Checklist

A change is ready when the author can answer:

- What product behavior changed?
- Which workspace owns the code?
- Which database tables or contracts changed?
- Which permissions apply?
- Which loading, empty, error, and success states exist?
- How does the feature behave for stale data?
- How does it behave for slow network?
- How does it behave for concurrent edits or duplicate submits?
- What is the rollback path?
- What was tested?
- What telemetry proves it is working?
- Does it change public-page performance or tracking cost?
- Does it require a migration, backfill, flag, or runbook update?

This checklist should be lightweight in practice, but every item represents a class of bug that is expensive to discover late.

### Code Review Standards

Code review should prioritize correctness, ownership, and future maintainability.

Review should check:

- Authorization is enforced server-side, not only by hiding UI.
- Workspace scoping exists on every workspace-owned read and write.
- Public routes cannot access private draft content.
- Private app routes do not rely on public link secrecy for permissions.
- Database constraints back up important invariants.
- Transactions wrap multi-row state changes.
- Idempotency exists for retried actions.
- Query keys match invalidation boundaries.
- Mutations update or invalidate the correct cache.
- Forms handle pending, success, validation, and unexpected error states.
- Editor changes do not break undo/redo, collaboration, publish validation, or version history.
- Tracking changes protect public-page performance and event volume.
- Public rendering changes do not import app/editor-only code.
- New variants or primitives follow the design-system rules in `AGENTS.md`.
- Errors use typed error codes and safe messages.
- Logs include request IDs but no secrets.
- Tests cover the risky behavior, not only the happy path.

Review should not reward cleverness. The best implementation should be obvious to the next person reading it six months later.

### Decision Records

Major decisions should be captured in short decision records.

Decision records should be used for:

- Hosting/provider decisions.
- Auth integration decisions.
- Realtime collaboration architecture.
- Public-page cache strategy.
- Tracking storage and aggregation strategy.
- Database migration strategy.
- Large dependency additions.
- Billing provider decisions.
- Custom domain architecture.
- Content schema versioning changes.
- Permission model changes.

Each decision record should include:

- Date.
- Status.
- Context.
- Decision.
- Consequences.
- Alternatives considered.
- Follow-up work.

Decision records should live in a predictable docs folder and be referenced from `app-spec.md` when they refine or finalize a spec decision.

### Naming And File Conventions

Conventions:

- Route files should be named after the route or route group they own.
- Feature components should be named by product behavior, not generic shape.
- Shared components should have names that make reuse expectations clear.
- Hooks that call APIs should live near their feature unless they are truly app-wide.
- Server services should be named after business capabilities, not database tables.
- Repository/data-access modules should not contain product orchestration.
- Type names should distinguish persisted rows, public DTOs, editor document nodes, and UI view models.
- Test fixture builders should create valid objects by default and make invalid cases explicit.

Avoid names like `utils`, `helpers`, or `misc` for new modules. If a helper has no clear owner, the ownership problem should be solved before the helper spreads.

### Documentation Maintenance

`app-spec.md` should stay ahead of implementation decisions, but not become a museum.

Rules:

- Product behavior changes should update the spec in the same change.
- Architecture changes should update the spec or add a decision record.
- Environment variable changes should update `.env.example` and config docs.
- New public events should update tracking schema docs.
- New content blocks should update content-schema docs and design-system examples.
- New permissions should update role/authorization sections.
- New operational workflows should update runbooks.
- Removed features should be removed from spec references once code is removed.

Stale documentation is worse than missing documentation because it creates false confidence. The spec should be reviewed as part of meaningful product and architecture changes.

### Engineering Quality Signals

Healthy signals:

- Small, owned modules.
- Pure domain tests are fast.
- Public page bundle remains small.
- Migrations are understandable and reversible where possible.
- Most application behavior can be tested without full browser setup.
- The app works from seeded local data.
- Errors are searchable by request ID.
- Feature flags have owners and removal dates.
- Background jobs are idempotent.
- Editor schema changes come with migrations.

Unhealthy signals:

- Shared folders become dumping grounds.
- Client code imports server-only modules.
- Public renderer imports editor code.
- Authorization rules are repeated as inline conditionals across many routes.
- Query invalidation becomes broad because ownership is unclear.
- Operational fixes require direct database editing.
- New behavior appears only in UI code with no server/domain invariant.
- Tests require large setup for simple rules.

The goal is not process for its own sake. The goal is to keep the app easy to change without having to hold the whole system in one person’s head.

## Feature Flags, Rollouts, And Kill Switches

Feature flags should help Lightsite release carefully, degrade safely, and recover quickly. They should not become a shadow permission system or a place where unfinished product behavior hides indefinitely.

### Flag Principles

Rules:

- Flags are for rollout, operational control, and controlled degradation.
- Flags are not a replacement for workspace roles, entitlements, or authorization checks.
- Server-side behavior must be controlled by server-evaluated flags.
- Client-side flags can hide UI, but cannot grant capability by themselves.
- Every flag needs an owner, purpose, default state, rollout criteria, and removal date.
- Flags should be typed, centrally registered, and discoverable.
- Flag values should be included in relevant diagnostics without exposing sensitive data.
- Production flag changes should be audited.

Flag types:

- Boolean flags for simple on/off behavior.
- Percentage rollout flags for gradual exposure.
- Workspace allowlist flags for beta customers.
- Environment flags for dev/staging/production differences.
- Kill switches for operational shutdown of risky subsystems.

### Flag Registry

Each flag definition should include:

- Key.
- Description.
- Owner.
- Category.
- Default values by environment.
- Allowed value type.
- Rollout strategy.
- Expiration or review date.
- Related runbook.
- Related analytics or health metrics.
- Whether the flag is safe to expose to the client.

Example categories:

- `editor`
- `public-rendering`
- `tracking`
- `publishing`
- `realtime`
- `billing`
- `integrations`
- `internal-admin`

Flags that affect public rendering or tracking should be especially conservative because they can affect anonymous traffic volume, analytics integrity, and page speed.

### Rollout Workflow

Rollout should follow a predictable path:

1. Ship code behind a server-side default-off flag when the change is risky.
2. Enable in local and staging.
3. Validate automated tests and seeded manual flows.
4. Enable for an internal workspace.
5. Enable for a small set of beta workspaces.
6. Watch errors, latency, event volume, and customer-visible behavior.
7. Expand gradually.
8. Remove the flag after rollout is complete and confidence is high.

Flags should not live forever. Removing completed flags keeps code paths simple and lowers test burden.

### Required Kill Switches

V1 should support operational controls for:

- Disable tracking ingestion while keeping public pages online.
- Disable click tracking while keeping visit tracking online.
- Disable scroll/depth sampling while keeping visit tracking online.
- Disable Slack/share-preview classification if OG image behavior causes noise.
- Disable logo.dev fetching while allowing manual logo upload.
- Disable email sending while preserving invite records.
- Disable publishing new versions while keeping current public pages online.
- Disable public embeds from a provider while preserving page layout.
- Disable realtime collaboration and fall back to single-editor saves.
- Disable asset uploads while preserving existing assets.
- Disable analytics rollups while preserving raw event ingest if needed.
- Disable public-page indexing for emergency privacy response.

Kill switches should have clear user-facing behavior. For example, disabling publishing should show a precise app error and should not corrupt draft state. Disabling tracking should not break public page rendering.

### Flag Evaluation

Evaluation rules:

- Server decisions should be evaluated near the service boundary.
- Client should receive only flags safe for UI rendering.
- Public pages should receive the minimum flag state needed to render correctly.
- Flag values should be cached carefully to avoid adding latency to public page loads.
- Critical kill switches should be fast to propagate.
- Tests should be able to override flag state deterministically.

Do not scatter raw flag checks deep inside unrelated code. Prefer small policy helpers or feature-gate functions that explain the behavior being gated.

### Flag Testing

Tests should cover:

- Default flag values per environment.
- Server-side enforcement for gated backend behavior.
- Client UI hidden state when a client-safe flag is off.
- Kill switch behavior for publishing, tracking, email, assets, realtime, and embeds.
- Flag removal path when rollout completes.
- Audit event creation for production flag changes.

Every meaningful flag creates at least two code paths. If both paths are not tested or removed promptly, flags become a source of bugs.

## Data Repair, Backfills, And Operational Scripts

Operational scripts should be treated as product code. They touch real customer data, often under pressure, and they need the same discipline as request handlers and background jobs.

### Script Principles

Rules:

- Scripts should be typed.
- Scripts should be reviewed.
- Scripts should be dry-run by default.
- Scripts should require explicit scope.
- Scripts should be idempotent where possible.
- Scripts should log safe summaries.
- Scripts should write audit records for production mutations.
- Scripts should never print secrets, tokens, raw auth credentials, or sensitive customer content.
- Scripts should refuse to run against production unless the production mode is explicit.
- Scripts should support batch sizes and resume markers for large work.
- Scripts should be safe to interrupt and resume.

Direct production database editing should not be a normal remediation path. If an operational action is likely to happen more than once, it deserves a script or an internal tool.

### Script Structure

Each script should define:

- Purpose.
- Inputs.
- Required environment.
- Dry-run output.
- Mutation behavior.
- Idempotency key or replay behavior.
- Batch size.
- Resume strategy.
- Audit behavior.
- Rollback or follow-up verification.

Scripts should use the same domain rules and repositories as the application where practical. A script that bypasses product invariants can create data the app cannot understand.

### Required Operational Scripts

V1 or near-V1 should include scripts for:

- Rebuild published snapshot metadata.
- Revalidate published snapshots against the current content schema.
- Rebuild asset usage references.
- Rebuild tracking session summaries from raw events.
- Recompute site analytics aggregates for a date range.
- Reprocess failed outbox messages.
- Expire old invites.
- Revoke pending invites for a workspace.
- Backfill workspace logo metadata after logo.dev fetches.
- Backfill missing workspace slug tombstones.
- Rebuild search/read models if a read model is introduced.
- Detect and report invalid draft documents.
- Migrate draft documents to a newer content schema version.
- Recalculate plan usage counters.
- Recalculate storage usage.
- Recalculate public link status from published snapshot state.
- Re-run safe OG image generation for sites that need refreshed previews.

Each script should have a small fixture-backed test for the core transformation and at least one integration test for database scoping if it mutates rows.

### Backfill Safety

Backfill rules:

- Process in deterministic order.
- Use small batches.
- Track progress.
- Avoid long-running transactions.
- Use advisory locks or job locks where needed.
- Respect tenant/workspace boundaries.
- Prefer append/update patterns that can be retried safely.
- Validate output before committing if possible.
- Rate-limit external API calls.
- Allow pause/resume.

Backfills should not compete with normal app traffic. Heavy backfills should run from workers or controlled script environments with throttling.

### Data Repair Review

Before running a production repair, capture:

- Problem statement.
- Customer impact.
- Scope of affected records.
- Proposed command and dry-run output.
- Expected mutation count.
- Rollback or mitigation.
- Verification query or dashboard.
- Approver.
- Incident/support ticket link where applicable.

After running:

- Store final output safely.
- Confirm mutation count.
- Verify affected flows.
- Add a test or invariant if the issue exposed a missing guard.
- Update runbook if the issue can recur.

### Script Output

Script output should be useful without being risky:

- Show workspace/site IDs when necessary.
- Show counts, status transitions, and skipped reasons.
- Redact emails where full email is not needed.
- Do not print draft content, published content, auth tokens, session tokens, or raw tracking identifiers.
- Write machine-readable output for CI or support workflows when useful.

Good operational scripts make support safer and engineering calmer.

## Documentation, Decision Records, And Spec Maintenance

Documentation should make the system easier to change. Lightsite’s docs should explain product behavior, architecture decisions, operational behavior, and implementation conventions without forcing every reader to reconstruct intent from code.

### Documentation Map

Recommended documentation ownership:

- `app-spec.md`: product behavior, system architecture, data model intent, flow contracts, and cross-cutting requirements.
- `AGENTS.md`: coding conventions, component organization, shadcn rules, and implementation expectations for agents/contributors.
- `docs/decisions/`: decision records for major architecture and product tradeoffs.
- `docs/runbooks/`: operational runbooks for support and incident response.
- `docs/api/`: generated or maintained API contract notes.
- `docs/events/`: tracking event catalog and analytics semantics.
- `docs/content-schema/`: block schema, validation, migrations, and examples.
- `.env.example`: environment variable inventory and safe local defaults.

Docs should be close to the people who need them. Product architecture belongs in the spec; operational steps belong in runbooks; implementation conventions belong in `AGENTS.md`.

### Spec Update Rules

Update `app-spec.md` when:

- Product behavior changes.
- A user flow changes.
- Data model meaning changes.
- Permission rules change.
- Public link or publishing behavior changes.
- Tracking semantics change.
- Content schema behavior changes.
- Hosting/deployment architecture changes.
- New operational capabilities are introduced.
- A prior assumption becomes incorrect.

Do not require the spec to capture every internal implementation detail. The spec should capture behavior and architecture that future changes must respect.

### Decision Record Rules

Use a decision record when:

- There are multiple reasonable architecture paths.
- The decision affects cost, scaling, maintenance, security, or customer-visible behavior.
- The decision would be hard to infer from code.
- Reversing the decision later would be expensive.

Decision record template:

```txt
# ADR: Short Decision Title

Date:
Status:

Context:

Decision:

Consequences:

Alternatives Considered:

Follow-Up:
```

Decision records should be short enough to read and specific enough to prevent repeating the same debate.

### Documentation Quality Checks

Docs are healthy when:

- A new engineer can understand the main product model without asking for a live walkthrough.
- A contributor can find where a feature belongs before writing code.
- A support person can resolve common issues without direct database access.
- A reviewer can compare a change against written behavior.
- A schema change explains migration expectations.
- A production incident produces an improved runbook or invariant.

Docs are unhealthy when:

- They describe behavior the app no longer has.
- They use vague future promises instead of concrete rules.
- They duplicate the same rule in conflicting places.
- They hide required steps in chat history.
- They describe implementation details but not why those choices exist.

### Keeping Docs Current

Maintenance rules:

- Add docs updates to the change readiness checklist.
- Review docs during releases for areas touched by the release.
- Link decision records from the spec when a decision finalizes a section.
- Remove obsolete sections once code and product behavior move on.
- Keep examples realistic and aligned with seed data.
- Prefer generated API/event/schema references where possible, with handwritten explanations for intent.

The spec should remain a living operating manual for the app, not a one-time planning artifact.

## Spec Coverage And Implementation Audit

This section is the implementation audit matrix for the spec above. It is not a backlog of undefined product areas. Each item should be checked against the written contract, implementation, tests, and operational behavior before the corresponding feature is considered ready.

### Audit Status Values

Use these statuses when implementation starts:

- `specified`: behavior is defined in this document.
- `implemented`: code exists and follows the spec.
- `tested`: automated or manual acceptance coverage exists for the risky paths.
- `operationally-ready`: logs, metrics, runbooks, migrations, and recovery paths exist where needed.
- `deferred`: intentionally not in the current build slice, with no code path pretending otherwise.

### Product Model Audit

Check that implementation preserves:

- Workspace, user, site, block, divider, variable, variant, asset, version, invite, visitor session, analytics event, job, and audit event ownership.
- Draft content versus published snapshot separation.
- Variant personalization without forked site content.
- Flat block list with divider elements instead of a separate section entity in V1.
- Stable public identifiers and reservation records for workspace/site/variant slugs.
- Explicit lifecycle states instead of scattered booleans.
- Server-side authorization as the source of truth.

### Auth, Account, And Onboarding Audit

Check that implementation covers:

- Work-email signup enforcement, personal-domain blocking, and `+` email rejection.
- BetterAuth session creation, verification, login, logout, reset, and invite entry points.
- Account setup separated from workspace setup.
- Workspace setup with name, editable unique slug, website, logo suggestion, logo upload/selection, and recovery from partial setup.
- logo.dev called only through the backend with token in environment config.
- Invited-user flows for new accounts and existing accounts.
- Workspace selection and default workspace behavior.
- Internal access separated from workspace roles.

### Workspace, Team, And Permission Audit

Check that implementation covers:

- Workspace switching, settings, logo changes, website changes, slug changes, and lifecycle rules.
- Member list, pending invites, expired/revoked invites, role changes, removal, and self-protection rules.
- Admin-only invite behavior in V1.
- Site-level access for specific members and entire-team access.
- Permission resolution order for workspace admins, site access rows, entire-team access, and revoked members.
- Permission-denied UX that avoids unnecessary existence leaks.
- Audit events for sensitive membership and access changes.

### Sites, Publishing, And Versioning Audit

Check that implementation covers:

- Sites list search, sort, filters, status display, empty states, row actions, and plan-limit behavior.
- Site create, duplicate, archive, restore, unpublish, and delete-like flows.
- Publish validation with blockers, warnings, variant readiness, and asset/content checks.
- Publish transaction creates immutable published snapshots and version checkpoints.
- Republish does not mutate prior snapshots.
- Version history supports restore without deleting later versions.
- Rollback creates a new draft/checkpoint and preserves auditability.
- Public links fail closed for unpublished, archived, deleted, suspended, or unavailable resources.

### Editor, Content Schema, And Collaboration Audit

Check that implementation covers:

- Typed editor operations instead of arbitrary document replacement for normal changes.
- Autosave, dirty state, undo/redo, recovery, validation, and version checkpoint behavior.
- Tiptap usage isolated to rich text fields and editor-specific UI.
- Block registry, field registry, variable compatibility matrix, and publish validation registry.
- Stable block IDs and nested item IDs.
- Drag/reorder, selection, hover, focus, inspector, toolbar, insert menu, preview modes, and responsive editor behavior.
- Presence separated from content operations.
- Collaboration persistence through debounced/batched operations with server authority.
- Reconnect, stale revision, conflict, and permission-change behavior.

### Variables, Recipients, And Sharing Audit

Check that implementation covers:

- Variable creation, insertion, renaming, deletion, defaults, usage checks, and recipient values.
- Text, image, and URL variable types in V1.
- Safe variable resolution for editor preview, recipient preview, publish validation, and public rendering.
- Recipient create, edit, delete, generated stable link, slug reservation, search, preview, email embed, and analytics identity.
- Share modal for default site links and recipient links.
- Copy-link behavior, unpublished warnings, public availability checks, and link change/delete confirmations.
- Slack/link preview detection through bot/OG request signals without treating preview loads as human visits.

### Public Rendering, Tracking, And Visitor Safety Audit

Check that implementation covers:

- Public route resolution for default site links and recipient links.
- Lean public bundle with no app shell, editor, or internal admin imports.
- Published snapshot rendering independent of mutable drafts.
- Public metadata, configurable OG image, default OG image, robots behavior, and privacy-safe previews.
- Mobile-first public page rendering and failure states.
- Tracking script boot order that cannot break page rendering.
- Visit, time spent, scroll depth, click, link, variant, and bot/preload classification events.
- Event ingestion rate limits, batching, privacy minimization, retention, rollups, and analytics accuracy copy.
- Public caching, asset delivery, and CDN behavior that cannot leak private app data.

### Assets, Media, And Embeds Audit

Check that implementation covers:

- Workspace logo, site avatar, image block, image variable, OG image, logo block, and testimonial media use cases.
- Upload validation, storage keys, MIME/type checking, size limits, image optimization, and safe public asset delivery.
- Asset usage references, replacement behavior, deletion/orphan cleanup, and publish readiness.
- Server-side URL/embed sanitization.
- Supported V1 embed providers with allowlisted behavior.
- Editor embed placeholders where full third-party loading would be noisy or slow.
- Asset and embed failure states that are clear and do not corrupt content.

### Backend, Database, And API Audit

Check that implementation covers:

- Request context with actor, workspace, request ID, session, flags, and config.
- Service/use-case boundaries for auth, workspaces, sites, editor, publishing, variants, assets, tracking, analytics, invites, billing, and audit.
- API contracts with typed request/response schemas, typed errors, pagination, idempotency, and optimistic concurrency.
- Database constraints for workspace scoping, unique slugs, invite uniqueness, variant reservations, content versions, and audit immutability.
- Transaction boundaries for multi-row mutations.
- Outbox/domain events for side effects.
- Background jobs for email, tracking rollups, cleanup, exports, cache invalidation, and retries.
- Data access layer that prevents cross-workspace leakage.

### Frontend, Design System, And UX Audit

Check that implementation covers:

- TanStack Router/Query route ownership, loaders, query keys, mutations, cache invalidation, and realtime reconciliation.
- Feature folder boundaries that match `AGENTS.md`.
- shadcn primitives in `components/ui` and product compositions outside primitive files.
- Tabler icons for product UI.
- Loading, empty, error, permission-denied, degraded, optimistic, and success states.
- Forms with validation timing, field errors, submit lifecycle, idempotency, and accessibility.
- App shell, sidebar, workspace switcher, account menu, and route guards.
- Design-system page that shows primitives, variants, composed components, states, and token usage.
- Responsive behavior and text fitting across app, editor, and public surfaces.

### Security, Privacy, And Compliance Audit

Check that implementation covers:

- Auth/session security, CSRF/cookie posture, rate limits, and account enumeration protection.
- Workspace-scoped authorization in every protected read/write.
- XSS protection for rich text, content JSON, public rendering, embeds, and URLs.
- Upload safety and asset-serving constraints.
- Tracking privacy, data minimization, anonymous visitor handling, bot filtering, retention, deletion/redaction readiness, and public disclosure.
- Secret management and environment validation.
- Audit ledger for security-sensitive events.
- Abuse/moderation states, public takedown behavior, and support-safe metadata access.

### Operations, Reliability, And Cost Audit

Check that implementation covers:

- Logging, metrics, tracing, dashboards, alerts, and request ID correlation.
- Backup, restore, disaster recovery, restore testing, and corruption recovery.
- Release gates, migration safety, backfills, rollback/roll-forward behavior, and production data access rules.
- Feature flags, rollout ownership, expiration/removal, and kill switches.
- Job queue idempotency, retry policy, dead-letter handling, and observability.
- Operational scripts with dry-run, scope, idempotency, audit, and safe output.
- Runbooks for auth, onboarding, invites, slugs, publishing, tracking, uploads, realtime, billing limits, and abuse.
- Cost controls for tracking ingest, realtime, asset storage, public rendering, analytics rollups, and external APIs.

### Implementation Exit Criteria

Before a feature is considered ready:

- The behavior maps to a section in this spec or the spec is updated.
- Server-side permissions and database invariants exist.
- API contracts and client types agree.
- UI has loading, empty, error, success, and permission states.
- Public/private boundaries are verified.
- Tests cover happy path, permission failure, validation failure, race/conflict case, and important edge case.
- Observability exists for unexpected failures.
- Runbook or operational notes exist for customer-facing failure modes.
- Feature flags or kill switches exist when rollout risk justifies them.
- Normal recovery paths use reviewed product actions, scripts, or runbooks instead of editing production data directly.
