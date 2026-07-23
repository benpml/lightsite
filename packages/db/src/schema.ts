import { relations, sql } from "drizzle-orm";
import {
  defaultSiteContent,
  normalizeSiteContent,
  type SiteContent,
  type SiteContentPage,
  type SiteDefaults,
  type SiteSidebar,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type SiteVariableDefinition,
  type TiptapNode,
} from "@handout/site-document";
import type { TrackingV2ManifestPayload } from "@handout/tracking-schema";
import {
  boolean,
  bigint,
  check,
  cidr,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export {
  defaultSiteContent,
  normalizeSiteContent,
  type SiteContent,
  type SiteContentPage,
  type SiteDefaults,
  type SiteSidebar,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type SiteVariableDefinition,
  type TiptapNode,
};

export const workspacePlanEnum = pgEnum("workspace_plan", ["free", "core", "pro"]);
export const workspaceRoleEnum = pgEnum("workspace_role", ["admin", "user"]);
export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "suspended",
  "scheduled_for_deletion",
  "deleted",
]);
export const workspaceMemberStatusEnum = pgEnum("workspace_member_status", ["active", "removed"]);
export const workspaceInvitationStatusEnum = pgEnum("workspace_invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);
export const siteStatusEnum = pgEnum("site_status", ["draft", "published", "archived"]);
export const siteVisibilityEnum = pgEnum("site_visibility", ["private", "team"]);
export const siteAccessRoleEnum = pgEnum("site_access_role", ["none", "view_copy", "edit"]);
export const siteVersionKindEnum = pgEnum("site_version_kind", [
  "initial",
  "autosave",
  "publish",
  "rollback",
  "migration",
]);
export const siteVariantStatusEnum = pgEnum("site_variant_status", ["active", "deleted"]);
export const trackingSettingScopeEnum = pgEnum("tracking_setting_scope", [
  "workspace",
  "site",
  "recipient",
]);
export const trackingRecipientSessionStateEnum = pgEnum("tracking_recipient_session_state", [
  "active",
  "ended",
  "expired",
  "suppressed",
]);
export const trackingRecipientSessionEndReasonEnum = pgEnum("tracking_recipient_session_end_reason", [
  "pagehide",
  "visibility_timeout",
  "idle_timeout",
  "max_duration",
  "heartbeat_timeout",
  "server_expired",
  "unknown",
]);
export const trackingRecordingStatusEnum = pgEnum("tracking_recording_status", [
  "disabled",
  "pending",
  "recording",
  "available",
  "truncated",
  "failed",
  "expired",
  "deleted",
]);
export const trackingRecipientEventTypeEnum = pgEnum("tracking_recipient_event_type", [
  "site_visit",
  "button_click",
  "link_click",
  "tab_switch",
  "slack_share",
  "webhook_send",
]);
export const trackingRecipientEventSourceEnum = pgEnum("tracking_recipient_event_source", [
  "browser",
  "server",
  "slack_og_image",
  "webhook",
]);
export const trackingElementKindEnum = pgEnum("tracking_element_kind", [
  "button",
  "link",
  "tab",
  "sidebar_button",
  "sidebar_link",
  "image_card",
  "calendar",
  "unknown",
]);
export const trackingDestinationKindEnum = pgEnum("tracking_destination_kind", [
  "external_web",
  "email",
  "phone",
  "calendar",
  "download",
  "internal_tab",
  "other",
]);
export const webhookAutomationStateEnum = pgEnum("webhook_automation_state", ["draft", "enabled", "paused", "needs_attention"]);
export const webhookAutomationStateReasonEnum = pgEnum("webhook_automation_state_reason", ["user", "plan_changed", "delivery_failures", "usage_limit", "queue_limit"]);
export const webhookAutomationSiteScopeEnum = pgEnum("webhook_automation_site_scope", ["all", "selected"]);
export const webhookAutomationRecipientScopeEnum = pgEnum("webhook_automation_recipient_scope", ["anyone", "named", "unnamed", "selected"]);
export const webhookMessageKindEnum = pgEnum("webhook_message_kind", ["live", "test"]);
export const webhookFanoutStatusEnum = pgEnum("webhook_fanout_status", ["pending", "complete", "cancelled"]);
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", ["pending", "succeeded", "failed", "cancelled"]);
export const workspaceAssetPurposeEnum = pgEnum("workspace_asset_purpose", ["image", "logo", "og_image", "avatar"]);

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return new Uint8Array(value);
  },
  toDriver(value) {
    return Buffer.from(value);
  },
});

export const user = pgTable(
  "user",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("user_email_idx").on(table.email),
    emailLowerIdx: uniqueIndex("user_email_lower_idx").on(sql`lower(${table.email})`),
  }),
);

export const session = pgTable(
  "session",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 191 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenIdx: uniqueIndex("session_token_idx").on(table.token),
    userIdx: index("session_user_idx").on(table.userId),
    expiresAtIdx: index("session_expires_at_idx").on(table.expiresAt),
  }),
);

export const account = pgTable(
  "account",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 191 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountIdx: uniqueIndex("account_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
    userIdx: index("account_user_idx").on(table.userId),
  }),
);

export const verification = pgTable(
  "verification",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
    expiresAtIdx: index("verification_expires_at_idx").on(table.expiresAt),
  }),
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    websiteDomain: varchar("website_domain", { length: 253 }),
    logoAssetId: uuid("logo_asset_id"),
    plan: workspacePlanEnum("plan").notNull().default("free"),
    status: workspaceStatusEnum("status").notNull().default("active"),
    scheduledDeletionAt: timestamp("scheduled_deletion_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("workspaces_slug_idx").on(table.slug),
    statusIdx: index("workspaces_status_idx").on(table.status),
  }),
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: varchar("user_id", { length: 191 })
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    accountSetupCompletedAt: timestamp("account_setup_completed_at", { withTimezone: true }),
    lastActiveWorkspaceId: uuid("last_active_workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    siteDefaults: jsonb("site_defaults").$type<SiteDefaults>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lastActiveWorkspaceIdx: index("user_profiles_last_active_workspace_idx").on(table.lastActiveWorkspaceId),
  }),
);

export const workspaceLogoAssets = pgTable(
  "workspace_logo_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index("workspace_logo_assets_workspace_idx").on(table.workspaceId),
    sizeCheck: check("workspace_logo_assets_size_check", sql`${table.byteSize} between 1 and 1048576`),
    squareCheck: check("workspace_logo_assets_square_check", sql`${table.width} = ${table.height}`),
  }),
);

export const workspaceAssets = pgTable(
  "workspace_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedByUserId: varchar("uploaded_by_user_id", { length: 191 }).notNull().references(() => user.id, { onDelete: "restrict" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    purpose: workspaceAssetPurposeEnum("purpose").notNull().default("image"),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    content: bytea("content").notNull(),
    sourceHost: varchar("source_host", { length: 253 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index("workspace_assets_workspace_idx").on(table.workspaceId),
    createdAtIdx: index("workspace_assets_created_at_idx").on(table.workspaceId, table.createdAt),
    sizeCheck: check("workspace_assets_size_check", sql`${table.byteSize} between 1 and 5242880`),
    dimensionsCheck: check("workspace_assets_dimensions_check", sql`${table.width} between 1 and 12000 and ${table.height} between 1 and 12000`),
  }),
);

export const userProfileImageAssets = pgTable(
  "user_profile_image_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 191 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_profile_image_assets_user_idx").on(table.userId),
    sizeCheck: check("user_profile_image_assets_size_check", sql`${table.byteSize} between 1 and 1048576`),
    squareCheck: check("user_profile_image_assets_square_check", sql`${table.width} = ${table.height}`),
  }),
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 191 }).notNull(),
    role: workspaceRoleEnum("role").notNull().default("user"),
    status: workspaceMemberStatusEnum("status").notNull().default("active"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceUserIdx: uniqueIndex("workspace_members_workspace_user_idx").on(table.workspaceId, table.userId),
    userIdx: index("workspace_members_user_idx").on(table.userId),
    activeWorkspaceRoleIdx: index("workspace_members_active_workspace_role_idx").on(
      table.workspaceId,
      table.status,
      table.role,
    ),
  }),
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: workspaceRoleEnum("role").notNull().default("user"),
    status: workspaceInvitationStatusEnum("status").notNull().default("pending"),
    invitedByUserId: varchar("invited_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    acceptedByUserId: varchar("accepted_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceEmailIdx: uniqueIndex("workspace_invitations_workspace_email_idx").on(
      table.workspaceId,
      table.email,
    ),
    emailStatusIdx: index("workspace_invitations_email_status_idx").on(table.email, table.status),
    workspaceStatusIdx: index("workspace_invitations_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
  }),
);

export const workspaceBilling = pgTable(
  "workspace_billing",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    plan: workspacePlanEnum("plan").notNull().default("free"),
    billingInterval: varchar("billing_interval", { length: 16 }),
    subscriptionStatus: varchar("subscription_status", { length: 64 }),
    seatCount: integer("seat_count").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stripeCustomerIdx: uniqueIndex("workspace_billing_stripe_customer_idx")
      .on(table.stripeCustomerId)
      .where(sql`${table.stripeCustomerId} is not null`),
    stripeSubscriptionIdx: uniqueIndex("workspace_billing_stripe_subscription_idx")
      .on(table.stripeSubscriptionId)
      .where(sql`${table.stripeSubscriptionId} is not null`),
    planStatusIdx: index("workspace_billing_plan_status_idx").on(table.plan, table.subscriptionStatus),
  }),
);

export const internalUserAccess = pgTable(
  "internal_user_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 191 }).notNull(),
    canAccessDebugTools: boolean("can_access_debug_tools").notNull().default(false),
    canAccessSupportTools: boolean("can_access_support_tools").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("internal_user_access_user_idx").on(table.userId),
  }),
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: varchar("public_id", { length: 16 }).notNull(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),
    updatedByUserId: varchar("updated_by_user_id", { length: 191 }),
    publishedByUserId: varchar("published_by_user_id", { length: 191 }),
    archivedByUserId: varchar("archived_by_user_id", { length: 191 }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    status: siteStatusEnum("status").notNull().default("draft"),
    visibility: siteVisibilityEnum("visibility").notNull().default("private"),
    draftContent: jsonb("draft_content").$type<SiteContent>().notNull().default(defaultSiteContent),
    draftRevision: integer("draft_revision").notNull().default(1),
    publishedVersionId: uuid("published_version_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastUnpublishedAt: timestamp("last_unpublished_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicIdIdx: uniqueIndex("sites_public_id_idx").on(table.publicId),
    workspaceSlugIdx: uniqueIndex("sites_workspace_slug_idx").on(table.workspaceId, table.slug),
    workspaceStatusUpdatedAtIdx: index("sites_workspace_status_updated_at_idx").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    publishedVersionIdx: index("sites_published_version_idx").on(table.publishedVersionId),
  }),
);

export const siteCollaborationDocuments = pgTable(
  "site_collaboration_documents",
  {
    siteId: uuid("site_id")
      .primaryKey()
      .references(() => sites.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    state: bytea("state").notNull(),
    updatedByUserId: varchar("updated_by_user_id", { length: 191 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceUpdatedAtIdx: index("site_collaboration_workspace_updated_at_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  }),
);

export const siteVersions = pgTable(
  "site_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    kind: siteVersionKindEnum("kind").notNull(),
    label: varchar("label", { length: 160 }),
    content: jsonb("content").$type<SiteContent>().notNull(),
    variablesSnapshot: jsonb("variables_snapshot").$type<SiteVariableDefinition[]>().notNull().default([]),
    createdByUserId: varchar("created_by_user_id", { length: 191 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siteVersionNumberIdx: uniqueIndex("site_versions_site_version_number_idx").on(table.siteId, table.versionNumber),
    siteCreatedAtIdx: index("site_versions_site_created_at_idx").on(table.siteId, table.createdAt),
    workspaceCreatedAtIdx: index("site_versions_workspace_created_at_idx").on(table.workspaceId, table.createdAt),
  }),
);

export const siteVariants = pgTable(
  "site_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shortCode: varchar("short_code", { length: 16 }).notNull(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    recipientName: varchar("recipient_name", { length: 160 }),
    recipientCompany: varchar("recipient_company", { length: 160 }),
    variableValues: jsonb("variable_values").$type<Record<string, unknown>>().notNull().default({}),
    publicLinkKey: varchar("public_link_key", { length: 64 }),
    revisionNumber: integer("revision_number").notNull().default(1),
    status: siteVariantStatusEnum("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    shortCodeIdx: uniqueIndex("site_variants_short_code_idx").on(table.shortCode),
    sitePublicLinkIdx: uniqueIndex("site_variants_site_public_link_idx").on(
      table.siteId,
      table.publicLinkKey,
    ),
    siteSlugIdx: uniqueIndex("site_variants_site_slug_idx").on(table.siteId, table.slug),
    workspaceUpdatedAtIdx: index("site_variants_workspace_updated_at_idx").on(table.workspaceId, table.updatedAt),
  }),
);

export const siteVariantShortCodeAliases = pgTable(
  "site_variant_short_code_aliases",
  {
    shortCode: varchar("short_code", { length: 16 }).primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => siteVariants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    variantIdx: index("site_variant_short_code_aliases_variant_idx").on(table.variantId),
  }),
);

export const recipientLogoAssets = pgTable(
  "recipient_logo_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 253 }).notNull(),
    theme: varchar("theme", { length: 8 }).notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceDomainThemeIdx: uniqueIndex("recipient_logo_assets_workspace_domain_theme_idx")
      .on(table.workspaceId, table.domain, table.theme),
    workspaceUpdatedAtIdx: index("recipient_logo_assets_workspace_updated_at_idx")
      .on(table.workspaceId, table.updatedAt),
    sizeCheck: check("recipient_logo_assets_size_check", sql`${table.byteSize} between 1 and 1048576`),
    squareCheck: check("recipient_logo_assets_square_check", sql`${table.width} = ${table.height}`),
    themeCheck: check("recipient_logo_assets_theme_check", sql`${table.theme} in ('light', 'dark')`),
  }),
);

export const siteAccess = pgTable(
  "site_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id").references(() => workspaceMembers.id, { onDelete: "cascade" }),
    entireTeam: boolean("entire_team").notNull().default(false),
    role: siteAccessRoleEnum("role").notNull().default("view_copy"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siteMemberIdx: uniqueIndex("site_access_site_member_idx")
      .on(table.siteId, table.workspaceMemberId)
      .where(sql`${table.workspaceMemberId} is not null`),
    siteEntireTeamIdx: uniqueIndex("site_access_site_entire_team_idx")
      .on(table.siteId)
      .where(sql`${table.entireTeam} = true`),
    siteIdx: index("site_access_site_idx").on(table.siteId),
  }),
);

export const trackingSettings = pgTable(
  "tracking_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => siteVariants.id, { onDelete: "cascade" }),
    scope: trackingSettingScopeEnum("scope").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    eventRetentionDays: integer("event_retention_days").notNull().default(90),
    recordingEnabled: boolean("recording_enabled").notNull().default(false),
    recordingRetentionDays: integer("recording_retention_days").notNull().default(14),
    maxRecordingDurationSeconds: integer("max_recording_duration_seconds").notNull().default(600),
    recordingTermsVersion: varchar("recording_terms_version", { length: 40 }),
    recordingTermsAcceptedAt: timestamp("recording_terms_accepted_at", { withTimezone: true }),
    recordingTermsAcceptedByUserId: varchar("recording_terms_accepted_by_user_id", { length: 191 })
      .references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceScopeIdx: index("tracking_settings_workspace_scope_idx").on(table.workspaceId, table.scope),
    siteIdx: index("tracking_settings_site_idx").on(table.siteId),
    recipientIdx: index("tracking_settings_recipient_idx").on(table.recipientId),
    workspaceUniqueIdx: uniqueIndex("tracking_settings_workspace_unique_idx")
      .on(table.workspaceId)
      .where(sql`${table.scope} = 'workspace'`),
    siteUniqueIdx: uniqueIndex("tracking_settings_site_unique_idx")
      .on(table.siteId)
      .where(sql`${table.scope} = 'site'`),
    recipientUniqueIdx: uniqueIndex("tracking_settings_recipient_unique_idx")
      .on(table.recipientId)
      .where(sql`${table.scope} = 'recipient'`),
    scopeCheck: check(
      "tracking_settings_scope_check",
      sql`(
        (${table.scope} = 'workspace' and ${table.siteId} is null and ${table.recipientId} is null)
        or (${table.scope} = 'site' and ${table.siteId} is not null and ${table.recipientId} is null)
        or (${table.scope} = 'recipient' and ${table.siteId} is not null and ${table.recipientId} is not null)
      )`,
    ),
    retentionCheck: check(
      "tracking_settings_retention_check",
      sql`${table.eventRetentionDays} in (30, 90, 180, 365)
        and ${table.recordingRetentionDays} in (7, 14, 30)
        and ${table.maxRecordingDurationSeconds} between 60 and 600`,
    ),
    recordingTermsCheck: check(
      "tracking_settings_recording_terms_check",
      sql`${table.recordingEnabled} = false or (
        ${table.enabled} = true
        and
        ${table.recordingTermsVersion} is not null
        and ${table.recordingTermsAcceptedAt} is not null
      )`,
    ),
  }),
);

export const trackingEventManifests = pgTable(
  "tracking_event_manifests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    publishedVersionId: uuid("published_version_id").notNull(),
    recipientId: uuid("recipient_id"),
    recipientRevision: integer("recipient_revision"),
    schemaVersion: integer("schema_version").notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<TrackingV2ManifestPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recipientUniqueIdx: uniqueIndex("tracking_event_manifests_recipient_unique_idx")
      .on(table.publishedVersionId, table.recipientId, table.recipientRevision, table.schemaVersion)
      .where(sql`${table.recipientId} is not null`),
    defaultUniqueIdx: uniqueIndex("tracking_event_manifests_default_unique_idx")
      .on(table.publishedVersionId, table.schemaVersion)
      .where(sql`${table.recipientId} is null`),
    workspaceCreatedAtIdx: index("tracking_event_manifests_workspace_created_idx").on(table.workspaceId, table.createdAt),
    siteCreatedAtIdx: index("tracking_event_manifests_site_created_idx").on(table.siteId, table.createdAt),
    recipientRevisionCheck: check(
      "tracking_event_manifests_recipient_revision_check",
      sql`(
        (${table.recipientId} is null and ${table.recipientRevision} is null)
        or (${table.recipientId} is not null and ${table.recipientRevision} is not null and ${table.recipientRevision} >= 0)
      )`,
    ),
    schemaVersionCheck: check("tracking_event_manifests_schema_version_check", sql`${table.schemaVersion} > 0`),
    publishedVersionFk: foreignKey({
      name: "trk_event_manifests_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [siteVersions.id],
    }).onDelete("cascade"),
    recipientFk: foreignKey({
      name: "trk_event_manifests_recipient_fk",
      columns: [table.recipientId],
      foreignColumns: [siteVariants.id],
    }).onDelete("cascade"),
  }),
);

export const trackingRecipientSessions = pgTable(
  "tracking_recipient_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicSessionId: varchar("public_session_id", { length: 160 }).notNull(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => siteVariants.id, { onDelete: "set null" }),
    publishedVersionId: uuid("published_version_id"),
    manifestId: uuid("manifest_id"),
    recipientRevision: integer("recipient_revision"),
    initialPageId: varchar("initial_page_id", { length: 160 }).notNull(),
    initialPageLabel: varchar("initial_page_label", { length: 180 }).notNull(),
    state: trackingRecipientSessionStateEnum("state").notNull().default("active"),
    eventTokenHash: varchar("event_token_hash", { length: 128 }).notNull(),
    city: varchar("city", { length: 120 }),
    region: varchar("region", { length: 120 }),
    countryCode: varchar("country_code", { length: 2 }),
    deviceType: varchar("device_type", { length: 40 }),
    osName: varchar("os_name", { length: 80 }),
    browserName: varchar("browser_name", { length: 80 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: trackingRecipientSessionEndReasonEnum("end_reason"),
    activeMs: integer("active_ms").notNull().default(0),
    durationMs: integer("duration_ms"),
    recordingStatus: trackingRecordingStatusEnum("recording_status").notNull().default("disabled"),
    recordingDurationMs: integer("recording_duration_ms"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicSessionIdx: uniqueIndex("tracking_recipient_sessions_public_idx").on(table.publicSessionId),
    workspaceStartedAtIdx: index("tracking_recipient_sessions_workspace_started_idx").on(table.workspaceId, table.startedAt),
    siteStartedAtIdx: index("tracking_recipient_sessions_site_started_idx").on(table.siteId, table.startedAt),
    recipientStartedAtIdx: index("tracking_recipient_sessions_recipient_started_idx").on(table.recipientId, table.startedAt),
    workspaceLastSeenIdx: index("tracking_recipient_sessions_workspace_seen_idx").on(table.workspaceId, table.lastSeenAt),
    activeLastSeenIdx: index("tracking_recipient_sessions_active_seen_idx")
      .on(table.lastSeenAt)
      .where(sql`${table.state} = 'active'`),
    recordingSettlementIdx: index("tracking_recipient_sessions_recording_settle_idx")
      .on(table.updatedAt, table.id)
      .where(sql`${table.state} in ('ended', 'expired') and ${table.recordingStatus} in ('pending', 'recording')`),
    manifestIdx: index("tracking_recipient_sessions_manifest_idx").on(table.manifestId),
    publishedVersionFk: foreignKey({
      name: "trk_rec_sessions_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [siteVersions.id],
    }).onDelete("set null"),
    manifestFk: foreignKey({
      name: "trk_rec_sessions_manifest_fk",
      columns: [table.manifestId],
      foreignColumns: [trackingEventManifests.id],
    }).onDelete("set null"),
    endedAfterStartedCheck: check(
      "tracking_recipient_sessions_ended_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
    durationCheck: check(
      "tracking_recipient_sessions_duration_check",
      sql`${table.activeMs} >= 0
        and (${table.durationMs} is null or ${table.durationMs} >= 0)
        and (${table.recordingDurationMs} is null or ${table.recordingDurationMs} between 0 and 600000)`,
    ),
  }),
);

export const trackingRecordings = pgTable(
  "tracking_recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => siteVariants.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").notNull(),
    publicSessionId: varchar("public_session_id", { length: 160 }).notNull(),
    status: trackingRecordingStatusEnum("status").notNull().default("pending"),
    rrwebVersion: varchar("rrweb_version", { length: 40 }).notNull().default("2.1.0"),
    runtimeVersion: varchar("runtime_version", { length: 80 }).notNull(),
    privacyVersion: integer("privacy_version").notNull().default(1),
    visitorNoticeVersion: integer("visitor_notice_version").notNull(),
    consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }).notNull(),
    consentSource: varchar("consent_source", { length: 20 }).notNull(),
    uploadTokenHash: varchar("upload_token_hash", { length: 128 }).notNull(),
    maxDurationMs: integer("max_duration_ms").notNull(),
    maxChunkBytes: integer("max_chunk_bytes").notNull(),
    maxEvents: integer("max_events").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    compressedBytes: integer("compressed_bytes").notNull().default(0),
    uncompressedBytes: integer("uncompressed_bytes").notNull().default(0),
    objectPrefix: text("object_prefix").notNull(),
    stopReason: varchar("stop_reason", { length: 80 }),
    finalSequence: integer("final_sequence"),
    errorCode: varchar("error_code", { length: 80 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionUniqueIdx: uniqueIndex("tracking_recordings_session_unique_idx").on(table.sessionId),
    workspaceStartedAtIdx: index("tracking_recordings_workspace_started_idx").on(table.workspaceId, table.startedAt),
    statusExpiresAtIdx: index("tracking_recordings_status_expires_idx").on(table.status, table.expiresAt),
    sessionFk: foreignKey({
      name: "trk_recordings_session_fk",
      columns: [table.sessionId],
      foreignColumns: [trackingRecipientSessions.id],
    }).onDelete("cascade"),
    boundsCheck: check(
      "tracking_recordings_bounds_check",
      sql`${table.durationMs} >= 0
        and ${table.eventCount} >= 0
        and ${table.chunkCount} >= 0
        and ${table.compressedBytes} >= 0
        and ${table.uncompressedBytes} >= 0
        and ${table.maxDurationMs} between 60000 and 600000
        and ${table.maxChunkBytes} between 1024 and 524288
        and ${table.maxEvents} between 1 and 20000
        and ${table.visitorNoticeVersion} > 0
        and ${table.consentSource} in ('prompt', 'remembered')
        and (${table.finalSequence} is null or ${table.finalSequence} >= 0)
        and (${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt})`,
    ),
  }),
);

export const trackingRecordingChunks = pgTable(
  "tracking_recording_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recordingId: uuid("recording_id").notNull().references(() => trackingRecordings.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    sequence: integer("sequence").notNull(),
    objectKey: text("object_key").notNull(),
    eventCount: integer("event_count").notNull(),
    compressedBytes: integer("compressed_bytes").notNull(),
    uncompressedBytes: integer("uncompressed_bytes").notNull(),
    hasFullSnapshot: boolean("has_full_snapshot"),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    firstEventAt: timestamp("first_event_at", { withTimezone: true }).notNull(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recordingSequenceIdx: uniqueIndex("tracking_recording_chunks_recording_sequence_idx").on(table.recordingId, table.sequence),
    workspaceReceivedAtIdx: index("tracking_recording_chunks_workspace_received_idx").on(table.workspaceId, table.receivedAt),
    sessionFk: foreignKey({
      name: "trk_recording_chunks_session_fk",
      columns: [table.sessionId],
      foreignColumns: [trackingRecipientSessions.id],
    }).onDelete("cascade"),
    boundsCheck: check(
      "tracking_recording_chunks_bounds_check",
      sql`${table.sequence} >= 0
        and ${table.eventCount} > 0
        and ${table.compressedBytes} > 0
        and ${table.uncompressedBytes} > 0
        and ${table.lastEventAt} >= ${table.firstEventAt}`,
    ),
  }),
);

export const trackingRecordingObjectDeletions = pgTable(
  "tracking_recording_object_deletions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectKey: text("object_key").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    objectKeyUniqueIdx: uniqueIndex("tracking_recording_object_deletions_object_key_idx").on(table.objectKey),
    createdAtIdx: index("tracking_recording_object_deletions_created_idx").on(table.createdAt),
    boundsCheck: check("tracking_recording_object_deletions_attempts_check", sql`${table.attemptCount} >= 0`),
  }),
);

export const trackingRecordingUsageDaily = pgTable(
  "tracking_recording_usage_daily",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    recordingCount: integer("recording_count").notNull().default(0),
    compressedBytes: bigint("compressed_bytes", { mode: "number" }).notNull().default(0),
  },
  (table) => ({
    primaryIdx: uniqueIndex("tracking_recording_usage_daily_workspace_date_idx").on(table.workspaceId, table.date),
    boundsCheck: check(
      "tracking_recording_usage_daily_bounds_check",
      sql`${table.recordingCount} >= 0 and ${table.compressedBytes} >= 0`,
    ),
  }),
);

export const trackingRecipientEvents = pgTable(
  "tracking_recipient_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: varchar("event_id", { length: 160 }).notNull(),
    batchId: varchar("batch_id", { length: 160 }),
    sessionId: uuid("session_id"),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => siteVariants.id, { onDelete: "set null" }),
    publishedVersionId: uuid("published_version_id"),
    manifestId: uuid("manifest_id"),
    recipientRevision: integer("recipient_revision"),
    type: trackingRecipientEventTypeEnum("type").notNull(),
    source: trackingRecipientEventSourceEnum("source").notNull(),
    pageId: varchar("page_id", { length: 160 }),
    pageLabel: varchar("page_label", { length: 180 }),
    fromPageId: varchar("from_page_id", { length: 160 }),
    fromPageLabel: varchar("from_page_label", { length: 180 }),
    elementKind: trackingElementKindEnum("element_kind"),
    elementId: varchar("element_id", { length: 160 }),
    elementLabel: varchar("element_label", { length: 180 }),
    destinationKind: trackingDestinationKindEnum("destination_kind"),
    destinationHost: varchar("destination_host", { length: 253 }),
    webhookId: uuid("webhook_id"),
    webhookEndpointHost: varchar("webhook_endpoint_host", { length: 253 }),
    scriptVersion: varchar("script_version", { length: 80 }),
    requestId: varchar("request_id", { length: 160 }),
    eventData: jsonb("event_data").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex("tracking_recipient_events_event_id_idx").on(table.eventId),
    workspaceReceivedAtIdx: index("tracking_recipient_events_workspace_received_idx").on(table.workspaceId, table.receivedAt),
    siteReceivedAtIdx: index("tracking_recipient_events_site_received_idx").on(table.siteId, table.receivedAt),
    recipientReceivedAtIdx: index("tracking_recipient_events_recipient_received_idx").on(table.recipientId, table.receivedAt),
    sessionReceivedAtIdx: index("tracking_recipient_events_session_received_idx").on(table.sessionId, table.receivedAt),
    manifestIdx: index("tracking_recipient_events_manifest_idx").on(table.manifestId),
    workspaceTypeReceivedAtIdx: index("tracking_recipient_events_workspace_type_received_idx").on(
      table.workspaceId,
      table.type,
      table.receivedAt,
    ),
    webhookIdx: index("tracking_recipient_events_webhook_idx").on(table.webhookId),
    sessionFk: foreignKey({
      name: "trk_rec_events_session_fk",
      columns: [table.sessionId],
      foreignColumns: [trackingRecipientSessions.id],
    }).onDelete("cascade"),
    publishedVersionFk: foreignKey({
      name: "trk_rec_events_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [siteVersions.id],
    }).onDelete("set null"),
    manifestFk: foreignKey({
      name: "trk_rec_events_manifest_fk",
      columns: [table.manifestId],
      foreignColumns: [trackingEventManifests.id],
    }).onDelete("set null"),
    browserSessionCheck: check(
      "tracking_recipient_events_session_scope_check",
      sql`(
        (${table.type} in ('site_visit', 'button_click', 'link_click', 'tab_switch') and ${table.sessionId} is not null)
        or (${table.type} in ('slack_share', 'webhook_send') and ${table.sessionId} is null)
      )`,
    ),
    sourceCheck: check(
      "tracking_recipient_events_source_check",
      sql`(
        (${table.type} in ('site_visit', 'button_click', 'link_click', 'tab_switch') and ${table.source} = 'browser')
        or (${table.type} = 'slack_share' and ${table.source} = 'slack_og_image')
        or (${table.type} = 'webhook_send' and ${table.source} = 'webhook')
      )`,
    ),
    elementCheck: check(
      "tracking_recipient_events_element_check",
      sql`(
        (${table.type} in ('button_click', 'link_click', 'tab_switch') and ${table.elementLabel} is not null)
        or (${table.type} not in ('button_click', 'link_click', 'tab_switch'))
      )`,
    ),
    clickDataCheck: check(
      "tracking_recipient_events_click_data_check",
      sql`(
        (${table.type} = 'link_click' and ${table.destinationKind} is not null and ${table.elementKind} = 'sidebar_link')
        or (${table.type} = 'tab_switch' and ${table.elementKind} = 'tab')
        or (${table.type} = 'button_click' and ${table.destinationKind} is not null and ${table.elementKind} in ('button', 'sidebar_button', 'image_card'))
        or (${table.type} not in ('button_click', 'link_click', 'tab_switch'))
      )`,
    ),
    webhookDataCheck: check(
      "tracking_recipient_events_webhook_data_check",
      sql`(
        (${table.type} = 'webhook_send' and ${table.webhookId} is not null and ${table.webhookEndpointHost} is not null)
        or (${table.type} <> 'webhook_send')
      )`,
    ),
  }),
);

export type WebhookAutomationTrigger = {
  eventTypes: Array<"site_visit" | "button_click" | "link_click" | "tab_switch">;
  siteScope: "all" | "selected";
  siteIds: string[];
  recipientScope: "anyone" | "named" | "unnamed" | "selected";
  recipientIds: string[];
};

export type WebhookPayloadSnapshot = Record<string, unknown>;

export const webhookAutomations = pgTable(
  "webhook_automations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    state: webhookAutomationStateEnum("state").notNull().default("draft"),
    stateReason: webhookAutomationStateReasonEnum("state_reason"),
    endpointHost: varchar("endpoint_host", { length: 253 }).notNull(),
    currentRevisionId: uuid("current_revision_id"),
    consecutiveFailureCount: integer("consecutive_failure_count").notNull().default(0),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    lastDeliveryStatus: webhookDeliveryStatusEnum("last_delivery_status"),
    createdByUserId: varchar("created_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: varchar("updated_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceStateIdx: index("webhook_automations_workspace_state_idx").on(table.workspaceId, table.state),
    currentRevisionIdx: index("webhook_automations_current_revision_idx").on(table.currentRevisionId),
    failureCountCheck: check("webhook_automations_failure_count_check", sql`${table.consecutiveFailureCount} >= 0`),
    currentRevisionCheck: check("webhook_automations_current_revision_check", sql`${table.currentRevisionId} is not null`),
  }),
);

export const webhookAutomationRevisions = pgTable(
  "webhook_automation_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    automationId: uuid("automation_id").notNull().references(() => webhookAutomations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    trigger: jsonb("trigger").$type<WebhookAutomationTrigger>().notNull(),
    endpointCiphertext: text("endpoint_ciphertext").notNull(),
    endpointNonce: varchar("endpoint_nonce", { length: 64 }).notNull(),
    signingSecretCiphertext: text("signing_secret_ciphertext").notNull(),
    signingSecretNonce: varchar("signing_secret_nonce", { length: 64 }).notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdByUserId: varchar("created_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    automationRevisionIdx: uniqueIndex("webhook_automation_revisions_number_idx").on(table.automationId, table.revisionNumber),
    automationIdentityIdx: uniqueIndex("webhook_automation_revisions_identity_idx").on(table.automationId, table.id),
    workspaceCreatedIdx: index("webhook_automation_revisions_workspace_created_idx").on(table.workspaceId, table.createdAt),
    revisionNumberCheck: check("webhook_automation_revisions_number_check", sql`${table.revisionNumber} > 0`),
  }),
);

export const webhookMessages = pgTable(
  "webhook_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sourceEventRowId: uuid("source_event_row_id"),
    eventId: varchar("event_id", { length: 160 }).notNull(),
    eventType: trackingRecipientEventTypeEnum("event_type").notNull(),
    kind: webhookMessageKindEnum("kind").notNull().default("live"),
    payload: jsonb("payload").$type<WebhookPayloadSnapshot>(),
    payloadText: text("payload_text"),
    payloadRedactedAt: timestamp("payload_redacted_at", { withTimezone: true }),
    fanoutStatus: webhookFanoutStatusEnum("fanout_status").notNull().default("pending"),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    eventKindIdx: uniqueIndex("webhook_messages_event_kind_idx").on(table.workspaceId, table.eventId, table.kind),
    fanoutIdx: index("webhook_messages_fanout_idx").on(table.fanoutStatus, table.availableAt, table.createdAt),
    workspaceCreatedIdx: index("webhook_messages_workspace_created_idx").on(table.workspaceId, table.createdAt),
    payloadPairCheck: check("webhook_messages_payload_pair_check", sql`(${table.payload} is null) = (${table.payloadText} is null)`),
    payloadSizeCheck: check("webhook_messages_payload_size_check", sql`${table.payloadText} is null or octet_length(${table.payloadText}) <= 16384`),
    eventTypeCheck: check("webhook_messages_event_type_check", sql`${table.eventType} in ('site_visit', 'button_click', 'link_click', 'tab_switch')`),
  }),
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id").notNull().references(() => webhookAutomations.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").notNull().references(() => webhookAutomationRevisions.id, { onDelete: "restrict" }),
    messageId: uuid("message_id").notNull().references(() => webhookMessages.id, { onDelete: "cascade" }),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    manualRetryCount: integer("manual_retry_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    responseStatus: integer("response_status"),
    errorCode: varchar("error_code", { length: 80 }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    messageAutomationIdx: uniqueIndex("webhook_deliveries_message_automation_idx").on(table.messageId, table.automationId),
    dispatchIdx: index("webhook_deliveries_dispatch_idx").on(table.status, table.nextAttemptAt, table.createdAt),
    automationCreatedIdx: index("webhook_deliveries_automation_created_idx").on(table.automationId, table.createdAt),
    workspaceCreatedIdx: index("webhook_deliveries_workspace_created_idx").on(table.workspaceId, table.createdAt),
    attemptsCheck: check("webhook_deliveries_attempts_check", sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= 10 and ${table.manualRetryCount} >= 0 and ${table.manualRetryCount} <= 3`),
    responseStatusCheck: check("webhook_deliveries_response_status_check", sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`),
  }),
);

export const webhookWorkspaceQueueState = pgTable(
  "webhook_workspace_queue_state",
  {
    workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
    pendingMessages: integer("pending_messages").notNull().default(0),
    pendingDeliveries: integer("pending_deliveries").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    countsCheck: check("webhook_workspace_queue_state_counts_check", sql`${table.pendingMessages} >= 0 and ${table.pendingDeliveries} >= 0`),
  }),
);

export const webhookUsageMonthly = pgTable(
  "webhook_usage_monthly",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    month: date("month").notNull(),
    deliveryAttempts: integer("delivery_attempts").notNull().default(0),
    succeededDeliveries: integer("succeeded_deliveries").notNull().default(0),
    failedDeliveries: integer("failed_deliveries").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceMonthIdx: uniqueIndex("webhook_usage_monthly_workspace_month_idx").on(table.workspaceId, table.month),
    countsCheck: check("webhook_usage_monthly_counts_check", sql`${table.deliveryAttempts} >= 0 and ${table.succeededDeliveries} >= 0 and ${table.failedDeliveries} >= 0`),
  }),
);

export const trackingInternalIpRanges = pgTable(
  "tracking_internal_ip_ranges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ipRange: cidr("ip_range").notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: varchar("created_by_user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceRangeIdx: uniqueIndex("tracking_internal_ip_workspace_range_idx").on(table.workspaceId, table.ipRange),
    workspaceEnabledIdx: index("tracking_internal_ip_workspace_enabled_idx").on(table.workspaceId, table.enabled),
  }),
);

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  sites: many(sites),
  versions: many(siteVersions),
  trackingSettings: many(trackingSettings),
  trackingEventManifests: many(trackingEventManifests),
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
  trackingRecordings: many(trackingRecordings),
  trackingRecordingChunks: many(trackingRecordingChunks),
  trackingRecordingUsageDaily: many(trackingRecordingUsageDaily),
  trackingInternalIpRanges: many(trackingInternalIpRanges),
  billing: one(workspaceBilling, {
    fields: [workspaces.id],
    references: [workspaceBilling.workspaceId],
  }),
}));

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  createdTrackingInternalIpRanges: many(trackingInternalIpRanges),
  acceptedTrackingSettings: many(trackingSettings),
  workspaceInvitationsSent: many(workspaceInvitations, { relationName: "workspaceInvitationSender" }),
  workspaceInvitationsAccepted: many(workspaceInvitations, { relationName: "workspaceInvitationRecipient" }),
  profile: one(userProfiles, {
    fields: [user.id],
    references: [userProfiles.userId],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
  lastActiveWorkspace: one(workspaces, {
    fields: [userProfiles.lastActiveWorkspaceId],
    references: [workspaces.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const verificationRelations = relations(verification, () => ({}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
  invitedBy: one(user, {
    fields: [workspaceInvitations.invitedByUserId],
    references: [user.id],
    relationName: "workspaceInvitationSender",
  }),
  acceptedBy: one(user, {
    fields: [workspaceInvitations.acceptedByUserId],
    references: [user.id],
    relationName: "workspaceInvitationRecipient",
  }),
}));

export const workspaceBillingRelations = relations(workspaceBilling, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceBilling.workspaceId],
    references: [workspaces.id],
  }),
}));

export const internalUserAccessRelations = relations(internalUserAccess, () => ({}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sites.workspaceId],
    references: [workspaces.id],
  }),
  variants: many(siteVariants),
  versions: many(siteVersions),
  access: many(siteAccess),
  trackingSettings: many(trackingSettings),
  trackingEventManifests: many(trackingEventManifests),
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
}));

export const siteVersionsRelations = relations(siteVersions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [siteVersions.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [siteVersions.siteId],
    references: [sites.id],
  }),
  trackingEventManifests: many(trackingEventManifests),
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
}));

export const siteVariantsRelations = relations(siteVariants, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [siteVariants.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [siteVariants.siteId],
    references: [sites.id],
  }),
  trackingSettings: many(trackingSettings),
  trackingEventManifests: many(trackingEventManifests),
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
  trackingRecordings: many(trackingRecordings),
}));

export const trackingSettingsRelations = relations(trackingSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingSettings.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingSettings.siteId],
    references: [sites.id],
  }),
  recipient: one(siteVariants, {
    fields: [trackingSettings.recipientId],
    references: [siteVariants.id],
  }),
  recordingTermsAcceptedBy: one(user, {
    fields: [trackingSettings.recordingTermsAcceptedByUserId],
    references: [user.id],
  }),
}));

export const trackingEventManifestsRelations = relations(trackingEventManifests, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [trackingEventManifests.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingEventManifests.siteId],
    references: [sites.id],
  }),
  publishedVersion: one(siteVersions, {
    fields: [trackingEventManifests.publishedVersionId],
    references: [siteVersions.id],
  }),
  recipient: one(siteVariants, {
    fields: [trackingEventManifests.recipientId],
    references: [siteVariants.id],
  }),
  sessions: many(trackingRecipientSessions),
  events: many(trackingRecipientEvents),
}));

export const trackingRecordingsRelations = relations(trackingRecordings, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [trackingRecordings.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingRecordings.siteId],
    references: [sites.id],
  }),
  recipient: one(siteVariants, {
    fields: [trackingRecordings.recipientId],
    references: [siteVariants.id],
  }),
  session: one(trackingRecipientSessions, {
    fields: [trackingRecordings.sessionId],
    references: [trackingRecipientSessions.id],
  }),
  chunks: many(trackingRecordingChunks),
}));

export const trackingRecordingChunksRelations = relations(trackingRecordingChunks, ({ one }) => ({
  recording: one(trackingRecordings, {
    fields: [trackingRecordingChunks.recordingId],
    references: [trackingRecordings.id],
  }),
  workspace: one(workspaces, {
    fields: [trackingRecordingChunks.workspaceId],
    references: [workspaces.id],
  }),
  session: one(trackingRecipientSessions, {
    fields: [trackingRecordingChunks.sessionId],
    references: [trackingRecipientSessions.id],
  }),
}));

export const trackingRecordingUsageDailyRelations = relations(trackingRecordingUsageDaily, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingRecordingUsageDaily.workspaceId],
    references: [workspaces.id],
  }),
}));

export const trackingRecipientSessionsRelations = relations(trackingRecipientSessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [trackingRecipientSessions.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingRecipientSessions.siteId],
    references: [sites.id],
  }),
  recipient: one(siteVariants, {
    fields: [trackingRecipientSessions.recipientId],
    references: [siteVariants.id],
  }),
  publishedVersion: one(siteVersions, {
    fields: [trackingRecipientSessions.publishedVersionId],
    references: [siteVersions.id],
  }),
  manifest: one(trackingEventManifests, {
    fields: [trackingRecipientSessions.manifestId],
    references: [trackingEventManifests.id],
  }),
  events: many(trackingRecipientEvents),
  recording: one(trackingRecordings, {
    fields: [trackingRecipientSessions.id],
    references: [trackingRecordings.sessionId],
  }),
}));

export const trackingRecipientEventsRelations = relations(trackingRecipientEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingRecipientEvents.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingRecipientEvents.siteId],
    references: [sites.id],
  }),
  recipient: one(siteVariants, {
    fields: [trackingRecipientEvents.recipientId],
    references: [siteVariants.id],
  }),
  publishedVersion: one(siteVersions, {
    fields: [trackingRecipientEvents.publishedVersionId],
    references: [siteVersions.id],
  }),
  manifest: one(trackingEventManifests, {
    fields: [trackingRecipientEvents.manifestId],
    references: [trackingEventManifests.id],
  }),
  session: one(trackingRecipientSessions, {
    fields: [trackingRecipientEvents.sessionId],
    references: [trackingRecipientSessions.id],
  }),
}));

export const trackingInternalIpRangesRelations = relations(trackingInternalIpRanges, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingInternalIpRanges.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(user, {
    fields: [trackingInternalIpRanges.createdByUserId],
    references: [user.id],
  }),
}));
