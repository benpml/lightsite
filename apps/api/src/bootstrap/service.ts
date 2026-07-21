import { validateTextLimit } from "@handout/domain";
import {
  defaultSiteDefaults,
  normalizeSiteDefaults,
  type SiteDefaults,
} from "@handout/site-document";
import type { CurrentActor } from "../auth/current-actor";
import { readImageDimensions } from "../uploads/image-dimensions";
import type {
  BootstrapRepository,
  BootstrapWorkspaceMembershipRecord,
} from "./repository";

export type AppBootstrap = {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    accountSetupComplete: boolean;
    internalAccess: boolean;
  };
  activeWorkspace: BootstrapWorkspaceSwitcherItem | null;
  workspaces: BootstrapWorkspaceSwitcherItem[];
  onboarding: {
    nextStep: "verify_email" | "account_setup" | "workspace_setup" | "invite_acceptance" | "app";
    pendingInviteId?: string;
  };
};

export type BootstrapWorkspaceSwitcherItem = {
  id: string;
  slug: string;
  name: string;
  websiteDomain: string;
  logoUrl: string | null;
  plan: "free" | "core" | "pro";
  role: "admin" | "user";
  membershipId: string;
};

export interface BootstrapService {
  getBootstrap(actor: CurrentActor): Promise<AppBootstrap>;
  completeAccountSetup(input: {
    actor: CurrentActor;
    displayName: string;
  }): Promise<AppBootstrap>;
  setActiveWorkspace(input: {
    actor: CurrentActor;
    workspaceId: string;
  }): Promise<AppBootstrap>;
  getSiteDefaults(actor: CurrentActor): Promise<SiteDefaults>;
  updateSiteDefaults(input: { actor: CurrentActor; defaults: SiteDefaults }): Promise<SiteDefaults>;
  isEmailAvailable(input: { actor: CurrentActor; email: string }): Promise<boolean>;
  uploadProfileImage(input: {
    actor: CurrentActor;
    fileName: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    dataBase64: string;
  }): Promise<{ imageAssetId: string; imageUrl: string }>;
  getProfileImage(assetId: string): Promise<{ contentType: string; content: Buffer } | null>;
}

export class WorkspaceMembershipRequiredError extends Error {
  constructor() {
    super("Workspace is not available for the current user.");
    this.name = "WorkspaceMembershipRequiredError";
  }
}

export class AccountSetupValidationError extends Error {
  readonly code = "account.display_name_invalid";

  constructor(message: string) {
    super(message);
    this.name = "AccountSetupValidationError";
  }
}

export class ProfileImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileImageUploadError";
  }
}

export function createBootstrapService(repository: BootstrapRepository): BootstrapService {
  const getBootstrap = async (actor: CurrentActor): Promise<AppBootstrap> => {
    const [profile, internalAccess, memberships] = await Promise.all([
      repository.findUserProfile(actor.userId),
      repository.findInternalUserAccess(actor.userId),
      repository.listActiveWorkspaceMemberships(actor.userId),
    ]);
    const workspaceItems = memberships.map(toWorkspaceSwitcherItem);
    const activeWorkspace = pickActiveWorkspace(
      workspaceItems,
      profile?.lastActiveWorkspaceId ?? null,
    );
    const accountSetupComplete = Boolean(profile?.accountSetupCompletedAt);

    return {
      user: {
        id: actor.userId,
        email: actor.email,
        ...(actor.name ? { name: actor.name } : {}),
        ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
        accountSetupComplete,
        internalAccess: Boolean(
          internalAccess?.canAccessDebugTools || internalAccess?.canAccessSupportTools,
        ),
      },
      activeWorkspace,
      workspaces: workspaceItems,
      onboarding: {
        nextStep: resolveNextStep({
          emailVerified: actor.emailVerified,
          accountSetupComplete,
          hasActiveWorkspace: activeWorkspace !== null,
        }),
      },
    };
  };

  return {
    getBootstrap,

    async completeAccountSetup(input) {
      const displayNameResult = validateTextLimit(
        input.displayName.trim(),
        "accountDisplayName",
        "Name",
      );

      if (!displayNameResult.ok || !displayNameResult.value.trim()) {
        throw new AccountSetupValidationError(
          displayNameResult.ok ? "Name is required." : displayNameResult.message,
        );
      }

      await repository.completeAccountSetup({
        userId: input.actor.userId,
        displayName: displayNameResult.value,
      });

      return getBootstrap({
        ...input.actor,
        name: displayNameResult.value,
      });
    },

    async setActiveWorkspace(input) {
      const membership = await repository.findActiveWorkspaceMembership(
        input.actor.userId,
        input.workspaceId,
      );

      if (!membership) {
        throw new WorkspaceMembershipRequiredError();
      }

      await repository.setLastActiveWorkspace({
        userId: input.actor.userId,
        workspaceId: input.workspaceId,
      });

      return getBootstrap(input.actor);
    },

    async getSiteDefaults(actor) {
      const profile = await repository.findUserProfile(actor.userId);
      return profile?.siteDefaults
        ? normalizeSiteDefaults(profile.siteDefaults)
        : defaultSiteDefaults;
    },

    async updateSiteDefaults(input) {
      const defaults = normalizeSiteDefaults(input.defaults);
      await repository.updateSiteDefaults({ userId: input.actor.userId, defaults });
      return defaults;
    },

    async isEmailAvailable(input) {
      return repository.isEmailAvailable({
        userId: input.actor.userId,
        email: input.email.trim().toLowerCase(),
      });
    },

    async uploadProfileImage(input) {
      const content = Buffer.from(input.dataBase64, "base64");
      if (!content.byteLength || content.byteLength > 1_048_576) {
        throw new ProfileImageUploadError("Choose a square image no larger than 1 MB.");
      }
      const dimensions = readImageDimensions(content, input.contentType);
      if (!dimensions || dimensions.width !== dimensions.height) {
        throw new ProfileImageUploadError("Profile images must be square PNG, JPEG, or WebP images.");
      }
      const asset = await repository.saveUserProfileImage({
        userId: input.actor.userId,
        fileName: input.fileName,
        contentType: input.contentType,
        width: dimensions.width,
        height: dimensions.height,
        content,
      });
      return {
        imageAssetId: asset.id,
        imageUrl: `/api/me/profile-image-assets/${asset.id}`,
      };
    },

    async getProfileImage(assetId) {
      return repository.findUserProfileImage(assetId);
    },
  };
}

function toWorkspaceSwitcherItem(
  record: BootstrapWorkspaceMembershipRecord,
): BootstrapWorkspaceSwitcherItem {
  return {
    id: record.workspace.id,
    slug: record.workspace.slug,
    name: record.workspace.name,
    websiteDomain: record.workspace.websiteDomain ?? "",
    logoUrl: record.workspace.logoAssetId
      ? `/api/workspaces/logo-assets/${record.workspace.logoAssetId}`
      : null,
    plan: record.workspace.plan,
    role: record.membership.role,
    membershipId: record.membership.id,
  };
}

function pickActiveWorkspace(
  workspaces: BootstrapWorkspaceSwitcherItem[],
  lastActiveWorkspaceId: string | null,
) {
  return (
    workspaces.find((workspace) => workspace.id === lastActiveWorkspaceId) ??
    workspaces[0] ??
    null
  );
}

function resolveNextStep(input: {
  emailVerified: boolean;
  accountSetupComplete: boolean;
  hasActiveWorkspace: boolean;
}): AppBootstrap["onboarding"]["nextStep"] {
  if (!input.emailVerified) {
    return "verify_email";
  }

  if (!input.accountSetupComplete) {
    return "account_setup";
  }

  if (!input.hasActiveWorkspace) {
    return "workspace_setup";
  }

  return "app";
}
