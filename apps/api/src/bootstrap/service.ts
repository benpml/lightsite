import { validateTextLimit } from "@lightsite/domain";
import type { CurrentActor } from "../auth/current-actor";
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
    logoUrl: null,
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
