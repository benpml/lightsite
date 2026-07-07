# Lightsite Recipient Sharing Spec

This document defines the new share model for sending a Lightsite site to prospects.

Recipient sharing replaces the older site-copy, detachable-copy, and user-editable-link model. A user does not create a separate editable page copy. They create a recipient for a site, fill that recipient's variable values, and receive a stable recipient link plus an email embed.

## Product Model

- A **Site** is the base one-pager the sales team edits.
- A **Recipient** is a prospect-specific share target for that site.
- A recipient stores lightweight identity fields and variable values.
- The site content remains owned by the base site.
- Recipient links personalize variables and tracking, not the underlying site document.

## Required Recipient Fields

- `Name`: first name of the person receiving the site. Required.
- `Company`: company name. Required.
- `Website`: optional company website used for logo.dev logo lookup.
- Custom variable values: one field for each user-created site variable.

`{name}` and `{company}` are always available variables in the editor variable menu:

- `{name}` default value: `you`
- `{company}` default value: `your company`

The UI should show friendly labels like `Name` and `Company`; users should not need to see internal slug formats.

## Link Rules

Recipient links are generated, not hand-authored:

```text
https://lightsite.io/{siteUri}/{recipientSlug}
```

Example:

```text
https://lightsite.io/a8f2k/david-linear
```

Rules:

- `siteUri` is a compact random public identifier for the site.
- `recipientSlug` is generated from company and name.
- If the slug collides, append a short random suffix.
- Once created, the recipient link stays stable.
- Editing recipient name, company, website, or variables must not change the existing link.
- Old recipient slugs must never resolve to a different recipient.

## Share Modal UX

The editor top bar `Share` button opens the recipient share modal.

The modal has two entry states:

- `New recipient`
- `Past recipients`

If a site already has recipients, opening the modal starts on `Past recipients`. Otherwise it starts on `New recipient`.

### New Recipient

Fields:

- Name
- Company
- Website
- Custom variables

Behavior:

- `Create link` is disabled until Name and Company are non-empty.
- Website is normalized before logo lookup.
- Custom variable fields use the variable's default value as placeholder/fallback.
- Creating a recipient opens that recipient's detail/share view immediately.

### Past Recipients

Show a compact searchable list later; V1 can start with a compact list.

Each row shows:

- Company logo when website is available and logo.dev resolves it.
- Fallback initial when no logo is available or the logo fails to load.
- Display text: `{Name} @ {Company}`.

Clicking a row opens the recipient detail/share view.

### Recipient Detail

Left column:

- Recipient avatar/logo.
- `{Name} @ {Company}` summary.
- Delete recipient.
- Editable Name, Company, Website, and custom variable fields.

Right column:

- Recipient link field.
- `Copy link`.
- `Copy embed`.
- Visual email embed preview.

Required identity fields should not persist empty values. Let users edit naturally, then commit valid values.

## Email Embed

The email embed copies HTML and plain text to the clipboard.

HTML shape:

```html
<a href="{recipientPublicUrl}" target="_blank" rel="noopener noreferrer">
  <img src="{recipientScreenshotUrl}" alt="{Name} at {Company}" />
</a>
```

Rules:

- The screenshot must represent the page with that recipient's variable values.
- The image links to the recipient public URL.
- Plain-text clipboard fallback is the same recipient public URL.
- The screenshot endpoint should be cacheable by recipient revision and invalidated when relevant site content or recipient variables change.

## Backend Shape

Recommended table:

```sql
site_recipients (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  site_id uuid not null references sites(id),
  site_uri varchar(32) not null,
  link_slug varchar(96) not null,
  name varchar(160) not null,
  company varchar(160) not null,
  website varchar(255) not null default '',
  variable_values jsonb not null default '{}',
  screenshot_asset_id uuid null,
  screenshot_revision integer not null default 1,
  archived_at timestamptz null,
  created_by_user_id varchar(191) null,
  updated_by_user_id varchar(191) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

- unique `(site_id, link_slug)`
- index `(workspace_id, site_id, updated_at desc)`
- unique or reserved mapping for `(site_uri, link_slug)` in public resolution

Do not add detached content fields. If recipient-specific content editing is ever reconsidered, it should be a separate product decision and not hidden in this table.

## API Shape

Authenticated editor API:

```text
GET    /api/sites/:siteId/recipients
POST   /api/sites/:siteId/recipients
PATCH  /api/sites/:siteId/recipients/:recipientId
DELETE /api/sites/:siteId/recipients/:recipientId
POST   /api/sites/:siteId/recipients/:recipientId/screenshot
```

Public API/rendering:

```text
GET /{siteUri}/{recipientSlug}
GET /{siteUri}/{recipientSlug}/embed.png
```

Public resolution must not leak whether a private workspace, site, or recipient exists. Return a generic unavailable page for missing, archived, unpublished, or unauthorized public resources.

## Tracking

Recipient links should attach recipient context to tracking sessions and events:

- `workspaceId`
- `siteId`
- `recipientId`
- `sitePublishedVersionId`
- recipient revision or variable revision where useful

Do not expose recipient email because V1 does not collect email. Slack/Open Graph preview bot loads should be tracked as preview activity, not human visits.

## Explicit Non-Goals

- No detached recipient content editing.
- No user-authored public slug field.
- No separate recipient-specific editor context.
- No email sending from Lightsite in V1.
- No CRM contact dedupe or lifecycle management.
