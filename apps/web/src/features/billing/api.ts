import type {
  BillingCheckoutResponse,
  BillingInterval,
  BillingPortalResponse,
  BillingSubscriptionStatus,
  BillingSummary,
  CreateBillingCheckoutRequest,
  WorkspacePlan,
} from "@lightsite/contracts"

import { apiRequest } from "@/lib/api/client"

export function getBillingSummary(signal?: AbortSignal) {
  return apiRequest("/api/billing", {
    responseSchema: billingSummaryResponseSchema,
    signal,
  })
}

export function createBillingCheckout(input: CreateBillingCheckoutRequest) {
  return apiRequest("/api/billing/checkout", {
    method: "POST",
    body: input,
    responseSchema: billingCheckoutResponseSchema,
  })
}

export function createBillingPortal() {
  return apiRequest("/api/billing/portal", {
    method: "POST",
    responseSchema: billingPortalResponseSchema,
  })
}

const workspacePlans = new Set<WorkspacePlan>(["free", "core", "pro"])
const billingIntervals = new Set<BillingInterval>(["month", "year"])
const subscriptionStatuses = new Set<BillingSubscriptionStatus>([
  "none",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
])

const billingSummaryResponseSchema = {
  parse(value: unknown): BillingSummary {
    const object = asRecord(value)
    const subscription = object.subscription === null ? null : asRecord(object.subscription)

    if (
      typeof object.workspaceId !== "string" ||
      typeof object.plan !== "string" ||
      !workspacePlans.has(object.plan as WorkspacePlan) ||
      typeof object.canPublish !== "boolean" ||
      typeof object.canManageBilling !== "boolean" ||
      typeof object.hasStripeCustomer !== "boolean" ||
      typeof object.requestId !== "string"
    ) {
      throw new Error("Invalid billing summary.")
    }

    return {
      workspaceId: object.workspaceId,
      plan: object.plan as WorkspacePlan,
      canPublish: object.canPublish,
      canManageBilling: object.canManageBilling,
      hasStripeCustomer: object.hasStripeCustomer,
      subscription: subscription ? parseSubscription(subscription) : null,
      requestId: object.requestId,
    }
  },
}

const billingCheckoutResponseSchema = {
  parse(value: unknown): BillingCheckoutResponse {
    const object = asRecord(value)

    if (typeof object.url !== "string" || typeof object.requestId !== "string") {
      throw new Error("Invalid billing checkout response.")
    }

    return {
      url: object.url,
      requestId: object.requestId,
    }
  },
}

const billingPortalResponseSchema = {
  parse(value: unknown): BillingPortalResponse {
    return billingCheckoutResponseSchema.parse(value)
  },
}

function parseSubscription(value: Record<string, unknown>): BillingSummary["subscription"] {
  if (
    typeof value.status !== "string" ||
    !subscriptionStatuses.has(value.status as BillingSubscriptionStatus) ||
    !(typeof value.interval === "string" || value.interval === null) ||
    (typeof value.interval === "string" && !billingIntervals.has(value.interval as BillingInterval)) ||
    typeof value.seatCount !== "number" ||
    !Number.isInteger(value.seatCount) ||
    value.seatCount < 1 ||
    !(typeof value.currentPeriodEnd === "string" || value.currentPeriodEnd === null) ||
    typeof value.cancelAtPeriodEnd !== "boolean"
  ) {
    throw new Error("Invalid billing subscription.")
  }

  return {
    status: value.status as BillingSubscriptionStatus,
    interval: value.interval as BillingInterval | null,
    seatCount: value.seatCount,
    currentPeriodEnd: value.currentPeriodEnd,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object.")
  }

  return value as Record<string, unknown>
}
