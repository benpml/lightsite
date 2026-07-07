import { z } from "zod";

export const apiErrorIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    issues: z.array(apiErrorIssueSchema).optional(),
  }),
});

export type ApiErrorIssue = z.infer<typeof apiErrorIssueSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const siteStatusSchema = z.enum(["draft", "published", "archived"]);
export const siteVisibilitySchema = z.enum(["private", "team"]);

export const siteVariableDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text", "image", "url"]),
  defaultValue: z.unknown(),
});

export const siteHeaderChromeSchema = z.object({
  brandName: z.string(),
  logoUrl: z.string(),
  primaryButtonText: z.string(),
  primaryButtonHref: z.string(),
  secondaryButtonText: z.string(),
  secondaryButtonHref: z.string(),
  showSecondaryButton: z.boolean(),
});

export const siteHeroChromeSchema = z.object({
  avatarMode: z.enum(["single", "duo"]),
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  avatarImageUrl: z.string(),
  avatarImageVariableKey: z.string(),
  avatarImageAlt: z.string(),
  avatarImageSecondaryUrl: z.string(),
  avatarImageSecondaryVariableKey: z.string(),
  avatarImageSecondaryAlt: z.string(),
});

export const siteContentBlockSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  fields: z.record(z.string(), z.unknown()),
});

export const siteContentSchema = z.object({
  schemaVersion: z.literal(2),
  chrome: z.object({
    siteHeader: siteHeaderChromeSchema,
    hero: siteHeroChromeSchema,
  }),
  settings: z.object({
    showTableOfContents: z.boolean(),
    ogImageAssetId: z.string().trim().min(1).optional(),
    allowSearchIndexing: z.literal(false),
  }),
  variables: z.array(siteVariableDefinitionSchema),
  blocks: z.array(siteContentBlockSchema),
});

export const siteContentPayloadSchema = z.object({
  draftRevision: z.number().int().positive(),
  draftContent: siteContentSchema,
});

export const siteContentResponseSchema = siteContentPayloadSchema.extend({
  requestId: z.string(),
});

export const updateSiteContentRequestSchema = z.object({
  expectedDraftRevision: z.number().int().positive().optional(),
  draftContent: siteContentSchema,
  changeSummary: z.string().trim().max(500).optional(),
});

export const validateSiteContentRequestSchema = z.object({
  draftContent: siteContentSchema,
});

export const validateSiteContentResponseSchema = z.object({
  valid: z.boolean(),
  issues: z.array(apiErrorIssueSchema),
  requestId: z.string(),
});

export const siteListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: siteStatusSchema,
  visibility: siteVisibilitySchema.optional(),
  updatedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
});

export const listSitesResponseSchema = z.object({
  sites: z.array(siteListItemSchema),
  nextCursor: z.string().nullable(),
  requestId: z.string(),
});

export const createSiteRequestSchema = z.object({
  name: z.string().trim().min(1).max(160).default("Untitled Lightsite"),
  slug: z.string().trim().max(96).optional(),
});

export const createSiteResponseSchema = z.object({
  site: siteListItemSchema.pick({
    id: true,
    name: true,
    slug: true,
    status: true,
  }),
  requestId: z.string(),
});

export const updateSiteContentResponseSchema = z.object({
  site: siteListItemSchema,
  draftRevision: z.number().int().positive(),
  draftContent: siteContentSchema,
  requestId: z.string(),
});

export const updateSiteRequestSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().max(96).optional(),
  visibility: siteVisibilitySchema.optional(),
}).refine(
  (value) => value.name !== undefined || value.slug !== undefined || value.visibility !== undefined,
  {
    message: "At least one site field is required.",
  },
);

export const sitePermissionsSchema = z.object({
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDuplicate: z.boolean(),
  canPublish: z.boolean(),
  canUnpublish: z.boolean(),
  canArchive: z.boolean(),
  canRestore: z.boolean(),
});

export const siteDetailSchema = siteListItemSchema.extend({
  visibility: siteVisibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  permissions: sitePermissionsSchema,
});

export const siteDetailResponseSchema = z.object({
  site: siteDetailSchema,
  requestId: z.string(),
});

export const duplicateSiteResponseSchema = createSiteResponseSchema;

export const siteVersionKindSchema = z.enum([
  "initial",
  "autosave",
  "publish",
  "rollback",
  "migration",
]);

export const siteVersionSummarySchema = z.object({
  id: z.string(),
  siteId: z.string(),
  versionNumber: z.number().int().positive(),
  kind: siteVersionKindSchema,
  label: z.string().nullable(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});

export const listSiteVersionsResponseSchema = z.object({
  versions: z.array(siteVersionSummarySchema),
  nextCursor: z.string().nullable(),
  requestId: z.string(),
});

export const restoreSiteVersionResponseSchema = z.object({
  site: siteDetailSchema,
  version: siteVersionSummarySchema,
  requestId: z.string(),
});

export const publishSiteResponseSchema = z.object({
  site: siteDetailSchema,
  version: siteVersionSummarySchema,
  requestId: z.string(),
});

export const unpublishSiteResponseSchema = siteDetailResponseSchema;

export const siteVariantSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string(),
  slug: z.string(),
  recipientName: z.string().nullable(),
  recipientCompany: z.string().nullable(),
  variableValues: z.record(z.string(), z.unknown()),
  revisionNumber: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listSiteVariantsResponseSchema = z.object({
  variants: z.array(siteVariantSchema),
  nextCursor: z.string().nullable(),
  requestId: z.string(),
});

const upsertSiteVariantInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).max(96),
  name: z.string().trim().min(1).max(120),
  recipientName: z.string().trim().min(1).max(160).nullable().optional(),
  recipientCompany: z.string().trim().min(1).max(160).nullable().optional(),
  variableValues: z.record(z.string(), z.unknown()).default({}),
});

export const batchUpsertSiteVariantsRequestSchema = z.object({
  matchBy: z.enum(["id", "slug"]).default("slug"),
  variants: z.array(upsertSiteVariantInputSchema).min(1).max(100),
});

export const batchUpsertSiteVariantsResponseSchema = z.object({
  variants: z.array(siteVariantSchema),
  requestId: z.string(),
});

export type SiteStatus = z.infer<typeof siteStatusSchema>;
export type SiteVisibility = z.infer<typeof siteVisibilitySchema>;
export type SiteVariableDefinition = z.infer<typeof siteVariableDefinitionSchema>;
export type SiteHeaderChrome = z.infer<typeof siteHeaderChromeSchema>;
export type SiteHeroChrome = z.infer<typeof siteHeroChromeSchema>;
export type SiteContentBlock = z.infer<typeof siteContentBlockSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type SiteContentPayload = z.infer<typeof siteContentPayloadSchema>;
export type SiteContentResponse = z.infer<typeof siteContentResponseSchema>;
export type UpdateSiteContentRequest = z.input<typeof updateSiteContentRequestSchema>;
export type UpdateSiteContentResponse = z.infer<typeof updateSiteContentResponseSchema>;
export type ValidateSiteContentRequest = z.input<typeof validateSiteContentRequestSchema>;
export type ValidateSiteContentResponse = z.infer<typeof validateSiteContentResponseSchema>;
export type SiteListItem = z.infer<typeof siteListItemSchema>;
export type ListSitesResponse = z.infer<typeof listSitesResponseSchema>;
export type CreateSiteRequest = z.input<typeof createSiteRequestSchema>;
export type CreateSiteResponse = z.infer<typeof createSiteResponseSchema>;
export type UpdateSiteRequest = z.input<typeof updateSiteRequestSchema>;
export type SitePermissions = z.infer<typeof sitePermissionsSchema>;
export type SiteDetail = z.infer<typeof siteDetailSchema>;
export type SiteDetailResponse = z.infer<typeof siteDetailResponseSchema>;
export type DuplicateSiteResponse = z.infer<typeof duplicateSiteResponseSchema>;
export type SiteVersionKind = z.infer<typeof siteVersionKindSchema>;
export type SiteVersionSummary = z.infer<typeof siteVersionSummarySchema>;
export type ListSiteVersionsResponse = z.infer<typeof listSiteVersionsResponseSchema>;
export type RestoreSiteVersionResponse = z.infer<typeof restoreSiteVersionResponseSchema>;
export type PublishSiteResponse = z.infer<typeof publishSiteResponseSchema>;
export type UnpublishSiteResponse = z.infer<typeof unpublishSiteResponseSchema>;
export type SiteVariant = z.infer<typeof siteVariantSchema>;
export type ListSiteVariantsResponse = z.infer<typeof listSiteVariantsResponseSchema>;
export type BatchUpsertSiteVariantsRequest = z.input<typeof batchUpsertSiteVariantsRequestSchema>;
export type BatchUpsertSiteVariantsResponse = z.infer<typeof batchUpsertSiteVariantsResponseSchema>;

export const publicSiteResponseSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  requestId: z.string(),
});

export type PublicSiteResponse = z.infer<typeof publicSiteResponseSchema>;

export const trackingEventTypeSchema = z.enum([
  "site_viewed",
  "heartbeat",
  "scroll_depth_reached",
  "element_clicked",
  "button_clicked",
  "link_clicked",
  "calendar_booked",
  "link_preview_loaded",
]);

export const trackingEventSourceSchema = z.enum([
  "browser",
  "preview_html",
  "preview_og_image",
]);

export const trackingClassificationFilterSchema = z.enum([
  "all",
  "human",
  "bot",
  "preview",
]);

export const trackingDateRangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const trackingEventsQuerySchema = z.object({
  siteId: z.string().trim().min(1).optional(),
  variantId: z.string().trim().min(1).optional(),
  type: trackingEventTypeSchema.optional(),
  classification: trackingClassificationFilterSchema.default("all"),
  query: z.string().trim().max(160).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  cursor: z.string().trim().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const trackingSummaryQuerySchema = z.object({
  siteId: z.string().trim().min(1).optional(),
  variantId: z.string().trim().min(1).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const trackingSiteSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const trackingVariantSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  recipientName: z.string().nullable(),
  recipientCompany: z.string().nullable(),
});

export const trackingEventFeedItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  type: trackingEventTypeSchema,
  source: trackingEventSourceSchema,
  eventName: z.string(),
  site: trackingSiteSummarySchema,
  variant: trackingVariantSummarySchema.nullable(),
  targetLabel: z.string().nullable(),
  targetUrl: z.string().nullable(),
  occurredAt: z.string(),
  receivedAt: z.string(),
  isBot: z.boolean(),
  isPreview: z.boolean(),
});

export const trackingEventsResponseSchema = z.object({
  events: z.array(trackingEventFeedItemSchema),
  nextCursor: z.string().nullable(),
  requestId: z.string(),
});

export const trackingMetricSummarySchema = z.object({
  humanVisits: z.number().int().nonnegative(),
  uniqueSessions: z.number().int().nonnegative(),
  averageTimeSpentSeconds: z.number().nonnegative(),
  maxScrollDepth: z.number().int().nonnegative(),
  ctaClicks: z.number().int().nonnegative(),
  linkClicks: z.number().int().nonnegative(),
  previewLoads: z.number().int().nonnegative(),
  lastEngagedAt: z.string().nullable(),
});

export const trackingTopClickedElementSchema = z.object({
  elementId: z.string(),
  label: z.string(),
  href: z.string().nullable(),
  clickCount: z.number().int().nonnegative(),
  lastClickedAt: z.string(),
});

export const trackingVariantAnalyticsSchema = z.object({
  variant: trackingVariantSummarySchema,
  humanVisits: z.number().int().nonnegative(),
  ctaClicks: z.number().int().nonnegative(),
  maxScrollDepth: z.number().int().nonnegative(),
  previewLoads: z.number().int().nonnegative(),
  lastViewedAt: z.string().nullable(),
});

export const trackingSummaryResponseSchema = z.object({
  metrics: trackingMetricSummarySchema,
  topClickedElements: z.array(trackingTopClickedElementSchema),
  variants: z.array(trackingVariantAnalyticsSchema),
  requestId: z.string(),
});

export type TrackingEventType = z.infer<typeof trackingEventTypeSchema>;
export type TrackingEventSource = z.infer<typeof trackingEventSourceSchema>;
export type TrackingClassificationFilter = z.infer<typeof trackingClassificationFilterSchema>;
export type TrackingEventsQuery = z.infer<typeof trackingEventsQuerySchema>;
export type TrackingSummaryQuery = z.infer<typeof trackingSummaryQuerySchema>;
export type TrackingEventFeedItem = z.infer<typeof trackingEventFeedItemSchema>;
export type TrackingEventsResponse = z.infer<typeof trackingEventsResponseSchema>;
export type TrackingMetricSummary = z.infer<typeof trackingMetricSummarySchema>;
export type TrackingTopClickedElement = z.infer<typeof trackingTopClickedElementSchema>;
export type TrackingVariantAnalytics = z.infer<typeof trackingVariantAnalyticsSchema>;
export type TrackingSummaryResponse = z.infer<typeof trackingSummaryResponseSchema>;

export const workspaceRoleSchema = z.enum(["admin", "user"]);

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  websiteDomain: z.string(),
  logoAssetId: z.string().nullable(),
  plan: z.enum(["basic", "pro"]),
  status: z.enum(["active", "suspended", "scheduled_for_deletion", "deleted"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceSlugAvailabilityResponseSchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  requestId: z.string(),
});

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(64).optional(),
  website: z.string().trim().min(1).max(2048),
  logoAssetId: z.uuid().optional(),
});

export const createWorkspaceResponseSchema = z.object({
  workspace: workspaceSummarySchema,
  membership: z.object({
    id: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    role: z.literal("admin"),
    status: z.literal("active"),
  }),
  requestId: z.string(),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceSlugAvailabilityResponse = z.infer<typeof workspaceSlugAvailabilityResponseSchema>;
export type CreateWorkspaceRequest = z.input<typeof createWorkspaceRequestSchema>;
export type CreateWorkspaceResponse = z.infer<typeof createWorkspaceResponseSchema>;

export const onboardingNextStepSchema = z.enum([
  "verify_email",
  "account_setup",
  "workspace_setup",
  "invite_acceptance",
  "app",
]);

export const bootstrapWorkspaceSwitcherItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  websiteDomain: z.string(),
  logoUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  membershipId: z.string(),
});

export const appBootstrapResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    accountSetupComplete: z.boolean(),
    internalAccess: z.boolean(),
  }),
  activeWorkspace: bootstrapWorkspaceSwitcherItemSchema.nullable(),
  workspaces: z.array(bootstrapWorkspaceSwitcherItemSchema),
  onboarding: z.object({
    nextStep: onboardingNextStepSchema,
    pendingInviteId: z.string().optional(),
  }),
  requestId: z.string(),
});

export type OnboardingNextStep = z.infer<typeof onboardingNextStepSchema>;
export type BootstrapWorkspaceSwitcherItem = z.infer<typeof bootstrapWorkspaceSwitcherItemSchema>;
export type AppBootstrapResponse = z.infer<typeof appBootstrapResponseSchema>;

export const completeAccountSetupRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
});

export const setActiveWorkspaceRequestSchema = z.object({
  workspaceId: z.uuid(),
});

export type CompleteAccountSetupRequest = z.input<typeof completeAccountSetupRequestSchema>;
export type SetActiveWorkspaceRequest = z.input<typeof setActiveWorkspaceRequestSchema>;

export const workspaceLogoPreviewThemeSchema = z.enum(["light", "dark"]);

export const workspaceLogoPreviewQuerySchema = z.object({
  website: z.string().trim().min(1).max(2048),
  size: z.coerce.number().int().min(32).max(512).default(128),
  theme: workspaceLogoPreviewThemeSchema.default("light"),
});

export const workspaceLogoPreviewImageQuerySchema = z.object({
  domain: z.string().trim().min(1).max(253),
  size: z.coerce.number().int().min(32).max(512).default(128),
  theme: workspaceLogoPreviewThemeSchema.default("light"),
});

export const workspaceLogoPreviewResponseSchema = z.object({
  enabled: z.boolean(),
  domain: z.string(),
  imageUrl: z.string().nullable(),
  requestId: z.string(),
});

export type WorkspaceLogoPreviewTheme = z.infer<typeof workspaceLogoPreviewThemeSchema>;
export type WorkspaceLogoPreviewQuery = z.input<typeof workspaceLogoPreviewQuerySchema>;
export type WorkspaceLogoPreviewResponse = z.infer<typeof workspaceLogoPreviewResponseSchema>;
