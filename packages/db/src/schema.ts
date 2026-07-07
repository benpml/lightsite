import { relations, sql } from "drizzle-orm";
import {
  boolean,
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

export const workspacePlanEnum = pgEnum("workspace_plan", ["basic", "pro"]);
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
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "site_viewed",
  "heartbeat",
  "scroll_depth_reached",
  "element_clicked",
  "button_clicked",
  "link_clicked",
  "calendar_booked",
  "link_preview_loaded",
]);
export const trackingSessionStateEnum = pgEnum("tracking_session_state", [
  "active",
  "ended",
  "expired",
  "bot_filtered",
  "discarded",
]);
export const trackingEventTypeEnum = pgEnum("tracking_event_type", [
  "site_viewed",
  "heartbeat",
  "scroll_depth_reached",
  "element_clicked",
  "button_clicked",
  "link_clicked",
  "calendar_booked",
  "link_preview_loaded",
]);
export const trackingEventSourceEnum = pgEnum("tracking_event_source", [
  "browser",
  "preview_html",
  "preview_og_image",
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

export type SiteVariableDefinition = {
  id: string;
  key: string;
  label: string;
  type: "text" | "image" | "url";
  defaultValue: unknown;
};

export type SiteContentBlock = {
  id: string;
  type: string;
  fields: Record<string, unknown>;
};

export type LegacySiteContent = {
  schemaVersion: 1;
  header: {
    avatarMode: "single" | "duo";
    title: string;
    subtitle?: string;
  };
  settings: {
    showTableOfContents: boolean;
    ogImageAssetId?: string;
    allowSearchIndexing: false;
  };
  variables: SiteVariableDefinition[];
  blocks: SiteContentBlock[];
};

export type SiteHeaderChrome = {
  brandName: string;
  logoUrl: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
  showSecondaryButton: boolean;
};

export type SiteHeroChrome = {
  avatarMode: "single" | "duo";
  eyebrow: string;
  title: string;
  subtitle: string;
  avatarImageUrl: string;
  avatarImageVariableKey: string;
  avatarImageAlt: string;
  avatarImageSecondaryUrl: string;
  avatarImageSecondaryVariableKey: string;
  avatarImageSecondaryAlt: string;
};

export type SiteContent = {
  schemaVersion: 2;
  chrome: {
    siteHeader: SiteHeaderChrome;
    hero: SiteHeroChrome;
  };
  settings: {
    showTableOfContents: boolean;
    ogImageAssetId?: string;
    allowSearchIndexing: false;
  };
  variables: SiteVariableDefinition[];
  blocks: SiteContentBlock[];
};

const recipientWebsiteVariable: SiteVariableDefinition = {
  id: "recipient_website",
  key: "recipient_website",
  label: "Recipient website",
  type: "url",
  defaultValue: "",
};

export const defaultSiteHeaderChrome: SiteHeaderChrome = {
  brandName: "Lightsite",
  logoUrl: "",
  primaryButtonText: "Book a call",
  primaryButtonHref: "",
  secondaryButtonText: "Learn more",
  secondaryButtonHref: "",
  showSecondaryButton: false,
};

export const defaultSiteHeroChrome: SiteHeroChrome = {
  avatarMode: "single",
  eyebrow: "",
  title: "Untitled Lightsite",
  subtitle: "",
  avatarImageUrl: "",
  avatarImageVariableKey: "",
  avatarImageAlt: "",
  avatarImageSecondaryUrl: "",
  avatarImageSecondaryVariableKey: "",
  avatarImageSecondaryAlt: "",
};

export const defaultSiteContent: SiteContent = {
  schemaVersion: 2,
  chrome: {
    siteHeader: defaultSiteHeaderChrome,
    hero: defaultSiteHeroChrome,
  },
  settings: {
    showTableOfContents: true,
    allowSearchIndexing: false,
  },
  variables: [recipientWebsiteVariable],
  blocks: [],
};

export function normalizeSiteContent(value: unknown): SiteContent {
  if (isSiteContentV2(value)) {
    return {
      schemaVersion: 2,
      chrome: {
        siteHeader: normalizeSiteHeaderChrome(value.chrome.siteHeader),
        hero: normalizeSiteHeroChrome(value.chrome.hero),
      },
      settings: normalizeSiteSettings(value.settings),
      variables: normalizeSiteVariables(value.variables),
      blocks: normalizeSiteBlocks(value.blocks),
    };
  }

  if (isLegacySiteContent(value)) {
    return {
      schemaVersion: 2,
      chrome: {
        siteHeader: { ...defaultSiteHeaderChrome },
        hero: {
          ...defaultSiteHeroChrome,
          avatarMode: value.header.avatarMode,
          title: value.header.title,
          subtitle: value.header.subtitle ?? "",
        },
      },
      settings: normalizeSiteSettings(value.settings),
      variables: normalizeSiteVariables(value.variables),
      blocks: normalizeSiteBlocks(value.blocks),
    };
  }

  return structuredClone(defaultSiteContent);
}

function isLegacySiteContent(value: unknown): value is LegacySiteContent {
  return isRecord(value)
    && value.schemaVersion === 1
    && isRecord(value.header)
    && Array.isArray(value.variables)
    && Array.isArray(value.blocks)
    && isRecord(value.settings);
}

function isSiteContentV2(value: unknown): value is SiteContent {
  return isRecord(value)
    && value.schemaVersion === 2
    && isRecord(value.chrome)
    && isRecord(value.chrome.siteHeader)
    && isRecord(value.chrome.hero)
    && isRecord(value.settings)
    && Array.isArray(value.variables)
    && Array.isArray(value.blocks);
}

function normalizeSiteHeaderChrome(value: unknown): SiteHeaderChrome {
  const input = isRecord(value) ? value : {};

  return {
    brandName: stringField(input, "brandName", defaultSiteHeaderChrome.brandName),
    logoUrl: stringField(input, "logoUrl", defaultSiteHeaderChrome.logoUrl),
    primaryButtonText: stringField(input, "primaryButtonText", defaultSiteHeaderChrome.primaryButtonText),
    primaryButtonHref: stringField(input, "primaryButtonHref", defaultSiteHeaderChrome.primaryButtonHref),
    secondaryButtonText: stringField(input, "secondaryButtonText", defaultSiteHeaderChrome.secondaryButtonText),
    secondaryButtonHref: stringField(input, "secondaryButtonHref", defaultSiteHeaderChrome.secondaryButtonHref),
    showSecondaryButton: booleanField(input, "showSecondaryButton", defaultSiteHeaderChrome.showSecondaryButton),
  };
}

function normalizeSiteHeroChrome(value: unknown): SiteHeroChrome {
  const input = isRecord(value) ? value : {};

  return {
    avatarMode: input.avatarMode === "duo" ? "duo" : defaultSiteHeroChrome.avatarMode,
    eyebrow: stringField(input, "eyebrow", defaultSiteHeroChrome.eyebrow),
    title: stringField(input, "title", defaultSiteHeroChrome.title),
    subtitle: stringField(input, "subtitle", defaultSiteHeroChrome.subtitle),
    avatarImageUrl: stringField(input, "avatarImageUrl", defaultSiteHeroChrome.avatarImageUrl),
    avatarImageVariableKey: stringField(input, "avatarImageVariableKey", defaultSiteHeroChrome.avatarImageVariableKey),
    avatarImageAlt: stringField(input, "avatarImageAlt", defaultSiteHeroChrome.avatarImageAlt),
    avatarImageSecondaryUrl: stringField(input, "avatarImageSecondaryUrl", defaultSiteHeroChrome.avatarImageSecondaryUrl),
    avatarImageSecondaryVariableKey: stringField(input, "avatarImageSecondaryVariableKey", defaultSiteHeroChrome.avatarImageSecondaryVariableKey),
    avatarImageSecondaryAlt: stringField(input, "avatarImageSecondaryAlt", defaultSiteHeroChrome.avatarImageSecondaryAlt),
  };
}

function normalizeSiteSettings(value: unknown): SiteContent["settings"] {
  const input = isRecord(value) ? value : {};

  return {
    showTableOfContents: booleanField(input, "showTableOfContents", true),
    ...(typeof input.ogImageAssetId === "string" && input.ogImageAssetId.trim().length > 0
      ? { ogImageAssetId: input.ogImageAssetId }
      : {}),
    allowSearchIndexing: false,
  };
}

function normalizeSiteVariables(value: unknown): SiteVariableDefinition[] {
  const variables: SiteVariableDefinition[] = Array.isArray(value)
    ? value.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.key !== "string" || typeof entry.label !== "string") {
        return [];
      }

      const type: SiteVariableDefinition["type"] = entry.type === "image" || entry.type === "url" ? entry.type : "text";

      return [{
        id: entry.id,
        key: entry.key,
        label: entry.label,
        type,
        defaultValue: entry.defaultValue,
      }];
    })
    : [];

  return ensureReservedSiteVariables(variables);
}

function ensureReservedSiteVariables(variables: SiteVariableDefinition[]) {
  if (variables.some((variable) => variable.key === recipientWebsiteVariable.key)) {
    return variables;
  }

  return [recipientWebsiteVariable, ...variables];
}

function normalizeSiteBlocks(value: unknown): SiteContentBlock[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.type !== "string" || !isRecord(entry.fields)) {
        return [];
      }

      return [{
        id: entry.id,
        type: entry.type,
        fields: entry.fields,
      }];
    })
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string, fallback: string) {
  return typeof record[key] === "string" ? record[key] as string : fallback;
}

function booleanField(record: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof record[key] === "boolean" ? record[key] as boolean : fallback;
}

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    websiteDomain: varchar("website_domain", { length: 253 }),
    logoAssetId: uuid("logo_asset_id"),
    plan: workspacePlanEnum("plan").notNull().default("basic"),
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

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => siteVariants.id, { onDelete: "set null" }),
    type: analyticsEventTypeEnum("type").notNull(),
    eventName: varchar("event_name", { length: 160 }).notNull(),
    targetLabel: varchar("target_label", { length: 180 }),
    targetUrl: text("target_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceOccurredAtIdx: index("analytics_events_workspace_occurred_at_idx").on(table.workspaceId, table.occurredAt),
    siteOccurredAtIdx: index("analytics_events_site_occurred_at_idx").on(table.siteId, table.occurredAt),
    variantOccurredAtIdx: index("analytics_events_variant_occurred_at_idx").on(table.variantId, table.occurredAt),
  }),
);

export const trackingSessions = pgTable(
  "tracking_sessions",
  {
    id: varchar("id", { length: 160 }).primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => siteVariants.id, { onDelete: "set null" }),
    variantRevision: integer("variant_revision"),
    publishedVersionId: uuid("published_version_id").notNull().references(() => siteVersions.id, { onDelete: "cascade" }),
    state: trackingSessionStateEnum("state").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    maxScrollDepth: integer("max_scroll_depth"),
    referrerHost: varchar("referrer_host", { length: 253 }),
    browserName: varchar("browser_name", { length: 80 }),
    osName: varchar("os_name", { length: 80 }),
    deviceType: varchar("device_type", { length: 40 }),
    country: varchar("country", { length: 2 }),
    isBot: boolean("is_bot").notNull().default(false),
    botName: varchar("bot_name", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceStartedAtIdx: index("tracking_sessions_workspace_started_at_idx").on(table.workspaceId, table.startedAt),
    siteStartedAtIdx: index("tracking_sessions_site_started_at_idx").on(table.siteId, table.startedAt),
    variantStartedAtIdx: index("tracking_sessions_variant_started_at_idx").on(table.variantId, table.startedAt),
  }),
);

export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: varchar("event_id", { length: 160 }).notNull(),
    batchId: varchar("batch_id", { length: 160 }).notNull(),
    visitorSessionId: varchar("visitor_session_id", { length: 160 })
      .references(() => trackingSessions.id, { onDelete: "set null" }),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => siteVariants.id, { onDelete: "set null" }),
    variantRevision: integer("variant_revision"),
    publishedVersionId: uuid("published_version_id").notNull().references(() => siteVersions.id, { onDelete: "cascade" }),
    type: trackingEventTypeEnum("type").notNull(),
    source: trackingEventSourceEnum("source").notNull(),
    eventName: varchar("event_name", { length: 160 }).notNull(),
    elementId: varchar("element_id", { length: 160 }),
    targetLabel: varchar("target_label", { length: 180 }),
    targetUrl: text("target_url"),
    isBot: boolean("is_bot").notNull().default(false),
    isPreview: boolean("is_preview").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex("tracking_events_event_id_idx").on(table.eventId),
    workspaceReceivedAtIdx: index("tracking_events_workspace_received_at_idx").on(table.workspaceId, table.receivedAt),
    siteReceivedAtIdx: index("tracking_events_site_received_at_idx").on(table.siteId, table.receivedAt),
    variantReceivedAtIdx: index("tracking_events_variant_received_at_idx").on(table.variantId, table.receivedAt),
    sessionReceivedAtIdx: index("tracking_events_session_received_at_idx").on(table.visitorSessionId, table.receivedAt),
  }),
);

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  sites: many(sites),
  versions: many(siteVersions),
}));

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
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

export const internalUserAccessRelations = relations(internalUserAccess, () => ({}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sites.workspaceId],
    references: [workspaces.id],
  }),
  variants: many(siteVariants),
  versions: many(siteVersions),
  access: many(siteAccess),
  analyticsEvents: many(analyticsEvents),
  trackingSessions: many(trackingSessions),
  trackingEvents: many(trackingEvents),
}));

export const siteVersionsRelations = relations(siteVersions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [siteVersions.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [siteVersions.siteId],
    references: [sites.id],
  }),
}));

export const siteVariantsRelations = relations(siteVariants, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [siteVariants.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [siteVariants.siteId],
    references: [sites.id],
  }),
}));

export const trackingSessionsRelations = relations(trackingSessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [trackingSessions.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingSessions.siteId],
    references: [sites.id],
  }),
  variant: one(siteVariants, {
    fields: [trackingSessions.variantId],
    references: [siteVariants.id],
  }),
  publishedVersion: one(siteVersions, {
    fields: [trackingSessions.publishedVersionId],
    references: [siteVersions.id],
  }),
  events: many(trackingEvents),
}));

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trackingEvents.workspaceId],
    references: [workspaces.id],
  }),
  site: one(sites, {
    fields: [trackingEvents.siteId],
    references: [sites.id],
  }),
  variant: one(siteVariants, {
    fields: [trackingEvents.variantId],
    references: [siteVariants.id],
  }),
  publishedVersion: one(siteVersions, {
    fields: [trackingEvents.publishedVersionId],
    references: [siteVersions.id],
  }),
  session: one(trackingSessions, {
    fields: [trackingEvents.visitorSessionId],
    references: [trackingSessions.id],
  }),
}));
