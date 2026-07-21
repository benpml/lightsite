import { describe, expect, it } from "vitest"
import type { BillingSummary } from "@handout/contracts"

import {
  getBillingCancellationState,
  getBillingPlanAction,
  getBillingSubscriptionNotice,
  shouldShowUpgradePlan,
} from "./model"

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    workspaceId: "workspace-1",
    plan: "free",
    canPublish: false,
    canManageBilling: true,
    hasStripeCustomer: false,
    subscription: null,
    requestId: "request-1",
    ...overrides,
  }
}

function subscription(overrides: Partial<NonNullable<BillingSummary["subscription"]>> = {}) {
  return {
    status: "active" as const,
    interval: "month" as const,
    seatCount: 1,
    currentPeriodEnd: "2026-08-19T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    ...overrides,
  }
}

describe("billing plan actions", () => {
  it("shows Upgrade plan for Free and Basic, but not Pro", () => {
    expect(shouldShowUpgradePlan("free")).toBe(true)
    expect(shouldShowUpgradePlan("core")).toBe(true)
    expect(shouldShowUpgradePlan("pro")).toBe(false)
  })

  it("keeps cancellation available for every paid plan", () => {
    expect(getBillingCancellationState(summary())).toBe("free")
    expect(getBillingCancellationState(summary({ plan: "core" }))).toBe("available")
    expect(getBillingCancellationState(summary({ plan: "pro" }))).toBe("available")
    expect(getBillingCancellationState(summary({
      plan: "pro",
      subscription: subscription({ cancelAtPeriodEnd: true }),
    }))).toBe("scheduled")
  })

  it("starts checkout for a free workspace", () => {
    expect(getBillingPlanAction(summary(), "core", "month")).toMatchObject({
      kind: "checkout",
      label: "Choose Basic",
      disabled: false,
    })
  })

  it("marks the exact active plan and interval as current", () => {
    const billing = summary({
      plan: "core",
      hasStripeCustomer: true,
      subscription: subscription(),
    })
    expect(getBillingPlanAction(billing, "core", "month")).toMatchObject({
      kind: "current",
      label: "Current plan",
      disabled: true,
    })
    expect(getBillingPlanAction(billing, "core", "year")).toMatchObject({
      kind: "update",
      label: "Switch to annual",
    })
    expect(getBillingPlanAction(billing, "pro", "month")).toMatchObject({
      kind: "update",
      label: "Upgrade to Pro",
    })
  })

  it("offers resume for a scheduled cancellation", () => {
    const billing = summary({
      plan: "pro",
      hasStripeCustomer: true,
      subscription: subscription({ interval: "year", cancelAtPeriodEnd: true }),
    })
    expect(getBillingPlanAction(billing, "pro", "year")).toMatchObject({
      kind: "update",
      label: "Resume subscription",
      disabled: false,
    })
  })

  it("does not expose a broken cancellation-era update", () => {
    const billing = summary({
      plan: "free",
      hasStripeCustomer: true,
      subscription: subscription({ status: "paused" }),
    })
    expect(getBillingPlanAction(billing, "pro", "month")).toMatchObject({
      kind: "portal",
      label: "Resolve billing first",
    })
  })

  it("handles a paid entitlement with no Stripe subscription", () => {
    const billing = summary({ plan: "pro", canPublish: true })
    expect(getBillingPlanAction(billing, "pro", "month")).toMatchObject({
      kind: "current",
      label: "Current plan",
      disabled: true,
    })
    expect(getBillingPlanAction(billing, "core", "month")).toMatchObject({
      kind: "checkout",
      label: "Switch to Basic",
      disabled: false,
    })
  })

  it("disables all plan changes for non-admins", () => {
    expect(getBillingPlanAction(summary({ canManageBilling: false }), "pro", "month")).toMatchObject({
      kind: "current",
      label: "Admin access required",
      disabled: true,
    })
  })

  it.each(["past_due", "unpaid"] as const)("routes %s subscriptions to payment recovery", (status) => {
    expect(getBillingSubscriptionNotice(summary({
      subscription: subscription({ status }),
    }))).toMatchObject({
      title: "Payment needs attention",
      destructive: true,
      showPortal: true,
    })
  })

  it.each(["incomplete", "paused"] as const)("routes %s subscriptions to billing resolution", (status) => {
    expect(getBillingSubscriptionNotice(summary({
      subscription: subscription({ status }),
    }))).toMatchObject({
      destructive: false,
      showPortal: true,
    })
  })

  it("does not show a recovery notice for a healthy subscription", () => {
    expect(getBillingSubscriptionNotice(summary({ subscription: subscription() }))).toBeNull()
  })
})
