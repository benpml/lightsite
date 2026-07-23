import { describe, expect, it } from "vitest"

import {
  getDefaultAccountName,
  getDefaultWorkspaceName,
  getDefaultWorkspaceWebsite,
  resolveOnboardingStep,
  splitAccountName,
} from "./onboarding-state"
import type { AppBootstrapResponse } from "@handout/contracts"

function buildBootstrap(
  overrides: Partial<AppBootstrapResponse> = {},
): AppBootstrapResponse {
  return {
    user: {
      id: "user_123",
      email: "mira@acme-co.com",
      accountSetupComplete: false,
      internalAccess: false,
    },
    activeWorkspace: null,
    workspaces: [],
    onboarding: {
      nextStep: "account_setup",
    },
    requestId: "request_123",
    ...overrides,
  }
}

describe("onboarding state helpers", () => {
  it("maps server onboarding states to local steps", () => {
    expect(resolveOnboardingStep(buildBootstrap())).toBe("account")
    expect(
      resolveOnboardingStep(buildBootstrap({ onboarding: { nextStep: "workspace_setup" } })),
    ).toBe("workspace")
    expect(
      resolveOnboardingStep(buildBootstrap({ onboarding: { nextStep: "invite_acceptance" } })),
    ).toBe("workspace")
    expect(resolveOnboardingStep(buildBootstrap({ onboarding: { nextStep: "app" } }))).toBe("app")
  })

  it("uses the profile name before deriving an account setup fallback", () => {
    expect(getDefaultAccountName(buildBootstrap({ user: {
      id: "user_123",
      email: "mira@acme.com",
      name: "Mira Chen",
      accountSetupComplete: false,
      internalAccess: false,
    } }))).toBe("Mira Chen")
    expect(getDefaultAccountName(buildBootstrap())).toBe("mira")
  })

  it("derives a workspace name from valid work email domains only", () => {
    expect(getDefaultWorkspaceName("mira@acme-co.com")).toBe("Acme Co")
    expect(getDefaultWorkspaceName("mira@gmail.com")).toBe("My Workspace")
    expect(getDefaultWorkspaceWebsite("mira@acme-co.com")).toBe("acme-co.com")
    expect(getDefaultWorkspaceWebsite("mira+handout@acme-co.com")).toBe("acme-co.com")
    expect(getDefaultWorkspaceWebsite("mira@gmail.com")).toBe("")
  })

  it("splits account names without losing compound surnames", () => {
    expect(splitAccountName("Mira Chen")).toEqual({ firstName: "Mira", lastName: "Chen" })
    expect(splitAccountName("Ada Lovelace Byron")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace Byron",
    })
  })
})
