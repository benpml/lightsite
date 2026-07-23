import type { AppBootstrapResponse } from "@handout/contracts"
import { isPersonalEmailDomain, validateEmail } from "@handout/domain"

export type OnboardingStep = "verify_email" | "account" | "workspace"

export function resolveOnboardingStep(bootstrap: AppBootstrapResponse): OnboardingStep | "app" {
  switch (bootstrap.onboarding.nextStep) {
    case "verify_email":
      return "verify_email"
    case "account_setup":
      return "account"
    case "workspace_setup":
    case "invite_acceptance":
      return "workspace"
    case "app":
      return "app"
  }
}

export function getDefaultAccountName(bootstrap: AppBootstrapResponse) {
  const existingName = bootstrap.user.name?.trim()

  if (existingName) {
    return existingName
  }

  return bootstrap.user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? ""
}

export function getDefaultWorkspaceName(email: string) {
  const validation = getWorkspaceEmailDomain(email)

  if (!validation) {
    return "My Workspace"
  }

  const companyLabel = validation.split(".")[0]?.replace(/[-_]+/g, " ").trim()

  if (!companyLabel) {
    return "My Workspace"
  }

  return companyLabel
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}

export function getDefaultWorkspaceWebsite(email: string) {
  return getWorkspaceEmailDomain(email) ?? ""
}

export function splitAccountName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts.shift() ?? "",
    lastName: parts.join(" "),
  }
}

function getWorkspaceEmailDomain(email: string) {
  const validation = validateEmail(email)
  if (!validation.ok || isPersonalEmailDomain(validation.domain)) return null
  return validation.domain
}
