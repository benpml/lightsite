import type {
  AppBootstrapResponse,
  BootstrapWorkspaceSwitcherItem,
  CompleteAccountSetupRequest,
  OnboardingNextStep,
  SetActiveWorkspaceRequest,
  WorkspacePlan,
  WorkspaceRole,
} from "@lightsite/contracts"

import { apiRequest } from "@/lib/api/client"

export function getAppBootstrap(signal?: AbortSignal) {
  return apiRequest("/api/me", {
    responseSchema: appBootstrapResponseSchema,
    signal,
  })
}

export function setActiveWorkspace(input: SetActiveWorkspaceRequest) {
  return apiRequest("/api/me/active-workspace", {
    method: "PUT",
    body: input,
    responseSchema: appBootstrapResponseSchema,
  })
}

export function completeAccountSetup(input: CompleteAccountSetupRequest) {
  return apiRequest("/api/me/profile", {
    method: "PATCH",
    body: {
      displayName: input.displayName.trim(),
    },
    responseSchema: appBootstrapResponseSchema,
  })
}

const workspaceRoles = new Set<WorkspaceRole>(["admin", "user"])
const workspacePlans = new Set<WorkspacePlan>(["free", "core", "pro"])
const onboardingNextSteps = new Set<OnboardingNextStep>([
  "verify_email",
  "account_setup",
  "workspace_setup",
  "invite_acceptance",
  "app",
])

export const appBootstrapResponseSchema = {
  parse(value: unknown): AppBootstrapResponse {
    const object = asRecord(value)
    const user = asRecord(object.user)
    const onboarding = asRecord(object.onboarding)
    const activeWorkspace =
      object.activeWorkspace === null ? null : parseWorkspaceSwitcherItem(object.activeWorkspace)
    const workspaces = Array.isArray(object.workspaces)
      ? object.workspaces.map(parseWorkspaceSwitcherItem)
      : null

    if (
      typeof object.requestId !== "string" ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.accountSetupComplete !== "boolean" ||
      typeof user.internalAccess !== "boolean" ||
      typeof onboarding.nextStep !== "string" ||
      !onboardingNextSteps.has(onboarding.nextStep as OnboardingNextStep) ||
      !workspaces
    ) {
      throw new Error("Invalid app bootstrap response.")
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: typeof user.name === "string" ? user.name : undefined,
        avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : undefined,
        accountSetupComplete: user.accountSetupComplete,
        internalAccess: user.internalAccess,
      },
      activeWorkspace,
      workspaces,
      onboarding: {
        nextStep: onboarding.nextStep as OnboardingNextStep,
        pendingInviteId:
          typeof onboarding.pendingInviteId === "string" ? onboarding.pendingInviteId : undefined,
      },
      requestId: object.requestId,
    }
  },
}

function parseWorkspaceSwitcherItem(value: unknown): BootstrapWorkspaceSwitcherItem {
  const object = asRecord(value)

  if (
    typeof object.id !== "string" ||
    typeof object.slug !== "string" ||
    typeof object.name !== "string" ||
    typeof object.websiteDomain !== "string" ||
    typeof object.plan !== "string" ||
    !workspacePlans.has(object.plan as WorkspacePlan) ||
    typeof object.role !== "string" ||
    !workspaceRoles.has(object.role as WorkspaceRole) ||
    typeof object.membershipId !== "string"
  ) {
    throw new Error("Invalid workspace switcher item.")
  }

  return {
    id: object.id,
    slug: object.slug,
    name: object.name,
    websiteDomain: object.websiteDomain,
    logoUrl: typeof object.logoUrl === "string" ? object.logoUrl : null,
    plan: object.plan as WorkspacePlan,
    role: object.role as WorkspaceRole,
    membershipId: object.membershipId,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object.")
  }

  return value as Record<string, unknown>
}
