import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BillingRecord, BillingRepository } from "./repository"

const stripeMocks = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  createPortalSession: vi.fn(),
}))

vi.mock("stripe", () => ({
  default: class StripeMock {
    customers = { create: stripeMocks.createCustomer }
    billingPortal = { sessions: { create: stripeMocks.createPortalSession } }
  },
}))

import { createBillingService } from "./service"

const priceIds = {
  "core:month": undefined,
  "core:year": undefined,
  "pro:month": undefined,
  "pro:year": undefined,
}

describe("billing portal", () => {
  beforeEach(() => {
    stripeMocks.createCustomer.mockReset()
    stripeMocks.createPortalSession.mockReset()
  })

  it("creates and stores a Stripe customer before opening the portal", async () => {
    const setStripeCustomer = vi.fn(async (input: { workspaceId: string; stripeCustomerId: string }) =>
      billingRecord({
        workspaceId: input.workspaceId,
        stripeCustomerId: input.stripeCustomerId,
      }))
    const repository = billingRepository({ setStripeCustomer })
    stripeMocks.createCustomer.mockResolvedValue({ id: "cus_new" })
    stripeMocks.createPortalSession.mockResolvedValue({ url: "https://billing.stripe.test/portal" })
    const service = createBillingService(repository, {
      stripeSecretKey: "sk_test_example",
      webOrigin: "https://app.handout.test",
      priceIds,
    })

    await expect(service.createPortalSession({
      actor: {
        userId: "user-1",
        email: "owner@example.com",
        emailVerified: true,
        name: "Owner",
      },
      workspace: {
        id: "workspace-1",
        name: "Acme",
        plan: "pro",
        role: "admin",
      },
    })).resolves.toEqual({ url: "https://billing.stripe.test/portal" })

    expect(stripeMocks.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      email: "owner@example.com",
      metadata: expect.objectContaining({ workspaceId: "workspace-1" }),
    }))
    expect(setStripeCustomer).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      stripeCustomerId: "cus_new",
    })
    expect(stripeMocks.createPortalSession).toHaveBeenCalledWith({
      customer: "cus_new",
      return_url: "https://app.handout.test/settings?tab=billing",
    })
  })

  it("reuses the existing Stripe customer", async () => {
    const setStripeCustomer = vi.fn()
    const repository = billingRepository({
      record: billingRecord({ stripeCustomerId: "cus_existing" }),
      setStripeCustomer,
    })
    stripeMocks.createPortalSession.mockResolvedValue({ url: "https://billing.stripe.test/portal" })
    const service = createBillingService(repository, {
      stripeSecretKey: "sk_test_example",
      webOrigin: "https://app.handout.test",
      priceIds,
    })

    await service.createPortalSession({
      actor: {
        userId: "user-1",
        email: "owner@example.com",
        emailVerified: true,
      },
      workspace: {
        id: "workspace-1",
        name: "Acme",
        plan: "pro",
        role: "admin",
      },
    })

    expect(stripeMocks.createCustomer).not.toHaveBeenCalled()
    expect(setStripeCustomer).not.toHaveBeenCalled()
    expect(stripeMocks.createPortalSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_existing",
    }))
  })
})

function billingRepository(input: {
  record?: BillingRecord | null
  setStripeCustomer?: BillingRepository["setStripeCustomer"]
} = {}): BillingRepository {
  return {
    async countBillableWorkspaceSeats() { return 1 },
    async findByWorkspaceId() { return input.record ?? null },
    async findWorkspaceIdByStripeCustomerId() { return null },
    async findWorkspaceIdByStripeSubscriptionId() { return null },
    setStripeCustomer: input.setStripeCustomer ?? (async ({ workspaceId, stripeCustomerId }) =>
      billingRecord({ workspaceId, stripeCustomerId })),
    async syncSubscription() { throw new Error("Not used in this test.") },
  }
}

function billingRecord(overrides: Partial<BillingRecord> = {}): BillingRecord {
  const now = new Date("2026-07-19T00:00:00.000Z")
  return {
    workspaceId: "workspace-1",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    plan: "free",
    billingInterval: null,
    subscriptionStatus: null,
    seatCount: 1,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
