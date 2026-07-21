import { HANDOUT_TEXT_LIMITS } from "@handout/domain";
import {
  siteContentPageSchema,
  siteContentSchema,
  siteDefaultsSchema,
  siteSidebarButtonSchema,
  siteSidebarLinkSchema,
  siteSidebarSchema,
  siteVariableDefinitionSchema,
  type SiteContent,
  type SiteContentPage,
  type SiteDefaults,
  type SiteSidebar,
  type SiteSidebarButton,
  type SiteSidebarLink,
  type SiteVariableDefinition,
} from "@handout/site-document";
export * from "./automations";
import { z } from "zod";

export {
  siteContentPageSchema,
  siteContentSchema,
  siteDefaultsSchema,
  siteSidebarButtonSchema,
  siteSidebarLinkSchema,
  siteSidebarSchema,
  siteVariableDefinitionSchema,
};

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

export const extensionAuthAuthorizeRequestSchema = z.object({
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  redirectUri: z.string().url().refine(
    (value) => /^https:\/\/[a-p]{32}\.chromiumapp\.org\/handout$/.test(value),
    { message: "Invalid Chrome extension redirect URI." },
  ),
});

export const extensionAuthAuthorizeResponseSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  requestId: z.string(),
});

export const extensionAuthExchangeRequestSchema = z.object({
  code: z.string().min(1),
  verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
});

export const extensionAuthExchangeResponseSchema = z.object({
  development: z.boolean(),
  token: z.string().min(1).nullable(),
  requestId: z.string(),
});

export type ExtensionAuthAuthorizeRequest = z.infer<typeof extensionAuthAuthorizeRequestSchema>;
export type ExtensionAuthAuthorizeResponse = z.infer<typeof extensionAuthAuthorizeResponseSchema>;
export type ExtensionAuthExchangeRequest = z.infer<typeof extensionAuthExchangeRequestSchema>;
export type ExtensionAuthExchangeResponse = z.infer<typeof extensionAuthExchangeResponseSchema>;

const boundedUnknownSchema: z.ZodType<unknown> = z.unknown().superRefine((value, context) => {
  validateUnknownStringLimits(value, context);
});

export const siteStatusSchema = z.enum(["draft", "published", "archived"]);
export const siteVisibilitySchema = z.enum(["private", "team"]);
export const siteThumbnailSchema = z.object({
  content: siteContentSchema,
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
  changeSummary: z.string().trim().max(HANDOUT_TEXT_LIMITS.changeSummary).optional(),
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
  publicId: z.string().default(""),
  name: z.string(),
  slug: z.string(),
  status: siteStatusSchema,
  recipientCount: z.number().int().nonnegative().default(0),
  thumbnail: siteThumbnailSchema.optional(),
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
  name: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.siteName).default("Untitled Handout"),
  slug: z.string().trim().max(96).optional(),
});

export const createSiteResponseSchema = z.object({
  site: siteListItemSchema.pick({
    id: true,
    publicId: true,
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
  name: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.siteName).optional(),
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
  shortCode: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/).nullable().default(null),
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
  id: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.variableName).optional(),
  slug: z.string().trim().min(1).max(96),
  name: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.variableName),
  recipientName: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.recipientName).nullable().optional(),
  recipientCompany: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.recipientCompany).nullable().optional(),
  variableValues: z.record(
    z.string().max(HANDOUT_TEXT_LIMITS.variableName),
    boundedUnknownSchema,
  ).default({}),
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
export type {
  SiteContent,
  SiteContentPage,
  SiteSidebar,
  SiteSidebarButton,
  SiteSidebarLink,
  SiteVariableDefinition,
};
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

export const workspaceRoleSchema = z.enum(["admin", "user"]);
export const workspacePlanSchema = z.enum(["free", "core", "pro"]);
export const workspaceInvitationStatusSchema = z.enum(["pending", "expired"]);

export const workspaceMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
  lastActiveAt: z.string().nullable(),
});

export const workspaceInvitationSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: workspaceRoleSchema,
  status: workspaceInvitationStatusSchema,
  invitedByName: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const workspaceTeamResponseSchema = z.object({
  members: z.array(workspaceMemberSchema),
  invitations: z.array(workspaceInvitationSchema),
  permissions: z.object({
    canManageMembers: z.boolean(),
  }),
  requestId: z.string(),
});

export const createWorkspaceInvitationRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(HANDOUT_TEXT_LIMITS.email).pipe(z.email()),
  role: workspaceRoleSchema,
});

export const createWorkspaceInvitationResponseSchema = z.object({
  result: z.enum(["member_added", "invitation_created"]),
  requestId: z.string(),
});

export const updateWorkspaceMemberRequestSchema = z.object({
  role: workspaceRoleSchema,
});

export const updateWorkspaceMemberResponseSchema = z.object({
  member: workspaceMemberSchema,
  requestId: z.string(),
});
export const billingIntervalSchema = z.enum(["month", "year"]);
export const billingSubscriptionStatusSchema = z.enum([
  "none",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  websiteDomain: z.string(),
  logoAssetId: z.string().nullable(),
  plan: workspacePlanSchema,
  status: z.enum(["active", "suspended", "scheduled_for_deletion", "deleted"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const billingSummarySchema = z.object({
  workspaceId: z.string(),
  plan: workspacePlanSchema,
  canPublish: z.boolean(),
  canManageBilling: z.boolean(),
  hasStripeCustomer: z.boolean(),
  subscription: z.object({
    status: billingSubscriptionStatusSchema,
    interval: billingIntervalSchema.nullable(),
    seatCount: z.number().int().positive(),
    currentPeriodEnd: z.string().nullable(),
    cancelAtPeriodEnd: z.boolean(),
  }).nullable(),
  requestId: z.string(),
});

export const createBillingCheckoutRequestSchema = z.object({
  plan: z.enum(["core", "pro"]),
  interval: billingIntervalSchema,
});

export const billingCheckoutResponseSchema = z.object({
  url: z.url(),
  requestId: z.string(),
});

export const billingPortalResponseSchema = billingCheckoutResponseSchema;

export const updateBillingSubscriptionRequestSchema = z.object({
  plan: z.enum(["core", "pro"]),
  interval: billingIntervalSchema,
});

export const updateBillingSubscriptionResponseSchema = z.object({
  success: z.literal(true),
  requestId: z.string(),
});

export const cancelBillingSubscriptionResponseSchema = z.object({
  cancelAtPeriodEnd: z.literal(true),
  currentPeriodEnd: z.string().nullable(),
  requestId: z.string(),
});

export const siteDefaultsResponseSchema = z.object({
  defaults: siteDefaultsSchema,
  requestId: z.string(),
});

export const updateSiteDefaultsRequestSchema = siteDefaultsSchema;

export const checkEmailChangeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(HANDOUT_TEXT_LIMITS.email).pipe(z.email()),
});

export const checkEmailChangeResponseSchema = z.object({
  available: z.literal(true),
  requestId: z.string(),
});

export const workspaceSlugAvailabilityResponseSchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  requestId: z.string(),
});

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.workspaceName),
  slug: z.string().trim().max(64).optional(),
  website: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.url),
  logoAssetId: z.uuid().optional(),
});

export const updateWorkspaceSettingsRequestSchema = z.object({
  name: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.workspaceName),
  website: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.url),
});

export const updateWorkspaceSettingsResponseSchema = z.object({
  workspace: workspaceSummarySchema,
  requestId: z.string(),
});

export const uploadWorkspaceLogoRequestSchema = z.object({
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataBase64: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
});

export const uploadWorkspaceLogoResponseSchema = z.object({
  logoAssetId: z.uuid(),
  logoUrl: z.string(),
  requestId: z.string(),
});

export const uploadProfileImageRequestSchema = uploadWorkspaceLogoRequestSchema;

export const uploadProfileImageResponseSchema = z.object({
  imageAssetId: z.uuid(),
  imageUrl: z.string(),
  requestId: z.string(),
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
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;
export type WorkspaceInvitationStatus = z.infer<typeof workspaceInvitationStatusSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type WorkspaceTeamResponse = z.infer<typeof workspaceTeamResponseSchema>;
export type CreateWorkspaceInvitationRequest = z.input<typeof createWorkspaceInvitationRequestSchema>;
export type CreateWorkspaceInvitationResponse = z.infer<typeof createWorkspaceInvitationResponseSchema>;
export type UpdateWorkspaceMemberRequest = z.input<typeof updateWorkspaceMemberRequestSchema>;
export type UpdateWorkspaceMemberResponse = z.infer<typeof updateWorkspaceMemberResponseSchema>;
export type BillingInterval = z.infer<typeof billingIntervalSchema>;
export type BillingSubscriptionStatus = z.infer<typeof billingSubscriptionStatusSchema>;
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export type CreateBillingCheckoutRequest = z.input<typeof createBillingCheckoutRequestSchema>;
export type BillingCheckoutResponse = z.infer<typeof billingCheckoutResponseSchema>;
export type BillingPortalResponse = z.infer<typeof billingPortalResponseSchema>;
export type UpdateBillingSubscriptionRequest = z.input<typeof updateBillingSubscriptionRequestSchema>;
export type UpdateBillingSubscriptionResponse = z.infer<typeof updateBillingSubscriptionResponseSchema>;
export type CancelBillingSubscriptionResponse = z.infer<typeof cancelBillingSubscriptionResponseSchema>;
export type SiteDefaultsResponse = z.infer<typeof siteDefaultsResponseSchema>;
export type UpdateSiteDefaultsRequest = z.input<typeof updateSiteDefaultsRequestSchema>;
export type CheckEmailChangeRequest = z.input<typeof checkEmailChangeRequestSchema>;
export type CheckEmailChangeResponse = z.infer<typeof checkEmailChangeResponseSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceSlugAvailabilityResponse = z.infer<typeof workspaceSlugAvailabilityResponseSchema>;
export type CreateWorkspaceRequest = z.input<typeof createWorkspaceRequestSchema>;
export type CreateWorkspaceResponse = z.infer<typeof createWorkspaceResponseSchema>;
export type UpdateWorkspaceSettingsRequest = z.input<typeof updateWorkspaceSettingsRequestSchema>;
export type UpdateWorkspaceSettingsResponse = z.infer<typeof updateWorkspaceSettingsResponseSchema>;
export type UploadWorkspaceLogoRequest = z.input<typeof uploadWorkspaceLogoRequestSchema>;
export type UploadWorkspaceLogoResponse = z.infer<typeof uploadWorkspaceLogoResponseSchema>;
export type UploadProfileImageRequest = z.input<typeof uploadProfileImageRequestSchema>;
export type UploadProfileImageResponse = z.infer<typeof uploadProfileImageResponseSchema>;
export type { SiteDefaults };

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
  plan: workspacePlanSchema,
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
  displayName: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.accountDisplayName),
});

export const setActiveWorkspaceRequestSchema = z.object({
  workspaceId: z.uuid(),
});

export type CompleteAccountSetupRequest = z.input<typeof completeAccountSetupRequestSchema>;
export type SetActiveWorkspaceRequest = z.input<typeof setActiveWorkspaceRequestSchema>;

export const workspaceLogoPreviewThemeSchema = z.enum(["light", "dark"]);

export const workspaceLogoPreviewQuerySchema = z.object({
  website: z.string().trim().min(1).max(HANDOUT_TEXT_LIMITS.url),
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

function validateUnknownStringLimits(
  value: unknown,
  context: z.RefinementCtx,
  path: Array<string | number> = [],
) {
  if (typeof value === "string") {
    if (value.length > HANDOUT_TEXT_LIMITS.blockText) {
      context.addIssue({
        code: "custom",
        message: `Text must be ${HANDOUT_TEXT_LIMITS.blockText.toLocaleString("en-US")} characters or fewer.`,
        path,
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateUnknownStringLimits(item, context, [...path, index]));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      validateUnknownStringLimits(item, context, [...path, key]);
    });
  }
}
