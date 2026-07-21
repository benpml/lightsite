import type {
  BillingInterval,
  BillingSubscriptionStatus,
  BillingSummary,
  WorkspacePlan,
} from "@handout/contracts"

export const billingPrices = {
  core: { month: 49, year: 39 },
  pro: { month: 89, year: 72 },
} satisfies Record<"core" | "pro", Record<BillingInterval, number>>

export const billingPlanLabels = {
  free: "Free",
  core: "Basic",
  pro: "Pro",
} satisfies Record<WorkspacePlan, string>

export const managedSubscriptionStatuses = new Set<BillingSubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
])

export type PaidPlan = "core" | "pro"
type PlanActionKind = "checkout" | "current" | "portal" | "update"

export type BillingPlanAction = {
  disabled: boolean
  kind: PlanActionKind
  label: string
  plan: PaidPlan
  interval: BillingInterval
}

export type BillingSubscriptionNotice = {
  description: string
  destructive: boolean
  showPortal: boolean
  title: string
}

export type BillingCancellationState = "available" | "free" | "scheduled"

export function shouldShowUpgradePlan(plan: WorkspacePlan) {
  return plan !== "pro"
}

export function getBillingCancellationState(summary: BillingSummary): BillingCancellationState {
  if (summary.plan === "free") return "free"
  return summary.subscription?.cancelAtPeriodEnd ? "scheduled" : "available"
}

export function getBillingPlanAction(
  summary: BillingSummary,
  plan: PaidPlan,
  interval: BillingInterval,
): BillingPlanAction {
  const subscription = summary.subscription
  const isManaged = Boolean(
    subscription && managedSubscriptionStatuses.has(subscription.status),
  )

  if (!summary.canManageBilling) {
    return { disabled: true, kind: "current", label: "Admin access required", plan, interval }
  }

  if (isManaged && subscription) {
    const samePlan = summary.plan === plan
    const sameInterval = subscription.interval === interval

    if (samePlan && sameInterval && !subscription.cancelAtPeriodEnd) {
      return { disabled: true, kind: "current", label: "Current plan", plan, interval }
    }

    if (samePlan && sameInterval && subscription.cancelAtPeriodEnd) {
      return { disabled: false, kind: "update", label: "Resume subscription", plan, interval }
    }

    const label = samePlan
      ? `Switch to ${interval === "year" ? "annual" : "monthly"}`
      : plan === "pro"
        ? "Upgrade to Pro"
        : "Switch to Basic"
    return { disabled: false, kind: "update", label, plan, interval }
  }

  if (subscription && !["none", "canceled", "incomplete_expired"].includes(subscription.status)) {
    return {
      disabled: !summary.hasStripeCustomer,
      kind: "portal",
      label: "Resolve billing first",
      plan,
      interval,
    }
  }

  if (!subscription && summary.plan === plan) {
    return { disabled: true, kind: "current", label: "Current plan", plan, interval }
  }

  const label = summary.plan === plan
    ? `Start ${billingPlanLabels[plan]} billing`
    : plan === "pro"
      ? "Upgrade to Pro"
      : summary.plan === "pro"
        ? "Switch to Basic"
        : "Choose Basic"

  return { disabled: false, kind: "checkout", label, plan, interval }
}

export function getBillingSubscriptionNotice(
  summary: BillingSummary,
): BillingSubscriptionNotice | null {
  const subscription = summary.subscription
  if (!subscription) return null
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    return {
      title: "Payment needs attention",
      description: "Update your payment method to prevent an interruption to publishing and tracking.",
      destructive: true,
      showPortal: true,
    }
  }
  if (["incomplete", "paused"].includes(subscription.status)) {
    return {
      title: subscription.status === "paused" ? "Subscription paused" : "Subscription setup is incomplete",
      description: "Open billing to resolve the subscription before changing plans.",
      destructive: false,
      showPortal: true,
    }
  }
  return null
}
