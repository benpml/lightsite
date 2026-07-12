import { relations, sql } from "drizzle-orm";
import {
  defaultSiteContent,
  normalizeSiteContent,
  type SiteContent,
  type SiteContentPage,
  type SiteSidebar,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type SiteVariableDefinition,
  type TiptapNode,
} from "@lightsite/site-document";
import {
  boolean,
  check,
  cidr,
  customType,
  date,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  bigint,
} from "drizzle-orm/pg-core";

export {
  defaultSiteContent,
  normalizeSiteContent,
  type SiteContent,
  type SiteContentPage,
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
  "available",
  "expired",
  "failed",
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
export const trackingSuppressionMarkerTypeEnum = pgEnum("tracking_suppression_marker_type", [
  "ip_address",
  "device_id",
  "user_id",
  "email_domain",
]);

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lastActiveWorkspaceIdx: index("user_profiles_last_active_workspace_idx").on(table.lastActiveWorkspaceId),
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
    workspaceSlugIdx: uniqueIndex("sites_workspace_slug_idx").on(table.workspaceId, table.slug),
    workspaceStatusUpdatedAtIdx: index("sites_workspace_status_updated_at_idx").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    publishedVersionIdx: index("sites_published_version_idx").on(table.publishedVersionId),
  }),
);

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
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    recipientName: varchar("recipient_name", { length: 160 }),
    recipientCompany: varchar("recipient_company", { length: 160 }),
    variableValues: jsonb("variable_values").$type<Record<string, unknown>>().notNull().default({}),
    revisionNumber: integer("revision_number").notNull().default(1),
    status: siteVariantStatusEnum("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    siteSlugIdx: uniqueIndex("site_variants_site_slug_idx").on(table.siteId, table.slug),
    workspaceUpdatedAtIdx: index("site_variants_workspace_updated_at_idx").on(table.workspaceId, table.updatedAt),
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
    captureIpAddress: boolean("capture_ip_address").notNull().default(true),
    rawIpRetentionDays: integer("raw_ip_retention_days").notNull().default(30),
    eventRetentionDays: integer("event_retention_days").notNull().default(365),
    recordingEnabled: boolean("recording_enabled").notNull().default(false),
    recordingRetentionDays: integer("recording_retention_days").notNull().default(30),
    maxRecordingDurationSeconds: integer("max_recording_duration_seconds").notNull().default(600),
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
      sql`${table.rawIpRetentionDays} >= 0
        and ${table.eventRetentionDays} >= ${table.rawIpRetentionDays}
        and ${table.recordingRetentionDays} >= 0
        and ${table.maxRecordingDurationSeconds} between 60 and 600`,
    ),
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
    publishedVersionId: uuid("published_version_id").notNull(),
    state: trackingRecipientSessionStateEnum("state").notNull().default("active"),
    eventTokenHash: varchar("event_token_hash", { length: 128 }).notNull(),
    deviceIdHash: varchar("device_id_hash", { length: 128 }),
    ipAddress: inet("ip_address"),
    ipAddressHash: varchar("ip_address_hash", { length: 128 }),
    city: varchar("city", { length: 120 }),
    region: varchar("region", { length: 120 }),
    countryCode: varchar("country_code", { length: 2 }),
    deviceType: varchar("device_type", { length: 40 }),
    osName: varchar("os_name", { length: 80 }),
    browserName: varchar("browser_name", { length: 80 }),
    userAgentFamily: varchar("user_agent_family", { length: 120 }),
    referrerHost: varchar("referrer_host", { length: 253 }),
    initialPath: varchar("initial_path", { length: 2048 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: trackingRecipientSessionEndReasonEnum("end_reason"),
    activeMs: integer("active_ms").notNull().default(0),
    durationMs: integer("duration_ms"),
    maxScrollDepthPercent: integer("max_scroll_depth_percent"),
    recordingStatus: trackingRecordingStatusEnum("recording_status").notNull().default("disabled"),
    recordingObjectKey: text("recording_object_key"),
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
    deviceHashIdx: index("tracking_recipient_sessions_device_hash_idx").on(table.workspaceId, table.deviceIdHash),
    ipHashIdx: index("tracking_recipient_sessions_ip_hash_idx").on(table.workspaceId, table.ipAddressHash),
    publishedVersionFk: foreignKey({
      name: "trk_rec_sessions_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [siteVersions.id],
    }).onDelete("cascade"),
    endedAfterStartedCheck: check(
      "tracking_recipient_sessions_ended_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
    durationCheck: check(
      "tracking_recipient_sessions_duration_check",
      sql`${table.activeMs} >= 0
        and (${table.durationMs} is null or ${table.durationMs} >= 0)
        and (${table.maxScrollDepthPercent} is null or ${table.maxScrollDepthPercent} between 0 and 100)`,
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
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    rrwebVersion: varchar("rrweb_version", { length: 40 }).notNull().default("rrweb-2.1.0"),
    runtimeVersion: varchar("runtime_version", { length: 80 }).notNull(),
    privacyVersion: integer("privacy_version").notNull().default(1),
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
    statusCheck: check(
      "tracking_recordings_status_check",
      sql`${table.status} in ('pending', 'recording', 'available', 'truncated', 'failed', 'expired', 'deleted')`,
    ),
    durationCheck: check(
      "tracking_recordings_duration_check",
      sql`${table.durationMs} >= 0
        and ${table.eventCount} >= 0
        and ${table.chunkCount} >= 0
        and ${table.compressedBytes} >= 0
        and ${table.maxDurationMs} between 60000 and 600000
        and ${table.maxChunkBytes} between 1024 and 524288
        and ${table.maxEvents} between 1 and 20000
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
    publicSessionId: varchar("public_session_id", { length: 160 }).notNull(),
    sequence: integer("sequence").notNull(),
    objectKey: text("object_key").notNull(),
    eventCount: integer("event_count").notNull(),
    compressedBytes: integer("compressed_bytes").notNull(),
    uncompressedBytes: integer("uncompressed_bytes"),
    checksumSha256: varchar("checksum_sha256", { length: 128 }).notNull(),
    firstEventAt: timestamp("first_event_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
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
    chunkCheck: check(
      "tracking_recording_chunks_check",
      sql`${table.sequence} >= 0
        and ${table.eventCount} > 0
        and ${table.compressedBytes} > 0
        and (${table.uncompressedBytes} is null or ${table.uncompressedBytes} >= ${table.compressedBytes})
        and (${table.firstEventAt} is null or ${table.lastEventAt} is null or ${table.lastEventAt} >= ${table.firstEventAt})`,
    ),
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
    usageCheck: check(
      "tracking_recording_usage_daily_check",
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
    type: trackingRecipientEventTypeEnum("type").notNull(),
    source: trackingRecipientEventSourceEnum("source").notNull(),
    tabLabel: varchar("tab_label", { length: 180 }),
    elementKind: trackingElementKindEnum("element_kind"),
    elementId: varchar("element_id", { length: 160 }),
    elementLabel: varchar("element_label", { length: 180 }),
    elementHref: text("element_href"),
    webhookId: uuid("webhook_id"),
    webhookUrl: text("webhook_url"),
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
    }).onDelete("set null"),
    publishedVersionFk: foreignKey({
      name: "trk_rec_events_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [siteVersions.id],
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
        (${table.type} = 'link_click' and ${table.elementHref} is not null and ${table.elementKind} in ('link', 'sidebar_link'))
        or (${table.type} = 'tab_switch' and ${table.elementKind} = 'tab')
        or (${table.type} = 'button_click' and ${table.elementKind} in ('button', 'sidebar_button', 'image_card', 'calendar', 'unknown'))
        or (${table.type} not in ('button_click', 'link_click', 'tab_switch'))
      )`,
    ),
    webhookDataCheck: check(
      "tracking_recipient_events_webhook_data_check",
      sql`(
        (${table.type} = 'webhook_send' and ${table.webhookId} is not null and ${table.webhookUrl} is not null)
        or (${table.type} <> 'webhook_send')
      )`,
    ),
  }),
);

export const trackingSuppressionMarkers = pgTable(
  "tracking_suppression_markers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 191 }).references(() => user.id, { onDelete: "set null" }),
    markerType: trackingSuppressionMarkerTypeEnum("marker_type").notNull(),
    markerHash: varchar("marker_hash", { length: 128 }).notNull(),
    label: varchar("label", { length: 160 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceMarkerIdx: uniqueIndex("tracking_suppression_workspace_marker_idx").on(
      table.workspaceId,
      table.markerType,
      table.markerHash,
    ),
    markerHashIdx: index("tracking_suppression_marker_hash_idx").on(table.markerHash),
    userLastSeenIdx: index("tracking_suppression_user_seen_idx").on(table.userId, table.lastSeenAt),
    expiresAtIdx: index("tracking_suppression_expires_idx").on(table.expiresAt),
    seenCheck: check(
      "tracking_suppression_seen_check",
      sql`${table.lastSeenAt} >= ${table.firstSeenAt}`,
    ),
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
  sites: many(sites),
  versions: many(siteVersions),
  trackingSettings: many(trackingSettings),
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
  trackingRecordings: many(trackingRecordings),
  trackingRecordingChunks: many(trackingRecordingChunks),
  trackingRecordingUsageDaily: many(trackingRecordingUsageDaily),
  trackingSuppressionMarkers: many(trackingSuppressionMarkers),
  trackingInternalIpRanges: many(trackingInternalIpRanges),
  billing: one(workspaceBilling, {
    fields: [workspaces.id],
    references: [workspaceBilling.workspaceId],
  }),
}));

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  trackingSuppressionMarkers: many(trackingSuppressionMarkers),
  createdTrackingInternalIpRanges: many(trackingInternalIpRanges),
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
  trackingRecipientSessions: many(trackingRecipientSessions),
  trackingRecipientEvents: many(trackingRecipientEvents),
  trackingRecordings: many(trackingRecordings),
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
  events: many(trackingRecipientEvents),
  recording: one(trackingRecordings, {
    fields: [trackingRecipientSessions.id],
    references: [trackingRecordings.sessionId],
  }),
  recordingChunks: many(trackingRecordingChunks),
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
  session: one(trackingRecipientSessions, {
    fields: [trackingRecipientEvents.sessionId],
    references: [trackingRecipientSessions.id],
  }),
}));

export const trackingSuppressionMarkersRelations = relations(trackingSuppressionMarkers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingSuppressionMarkers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(user, {
    fields: [trackingSuppressionMarkers.userId],
    references: [user.id],
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
