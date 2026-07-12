import { and, count, eq } from "drizzle-orm";
import {
  db as defaultDb,
  workspaceBilling,
  workspaceMembers,
  workspaces,
  type Database,
} from "@lightsite/db";
import type { BillingInterval, BillingSubscriptionStatus, WorkspacePlan } from "@lightsite/contracts";

export type BillingRecord = {
  workspaceId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: WorkspacePlan;
  billingInterval: BillingInterval | null;
  subscriptionStatus: BillingSubscriptionStatus | null;
  seatCount: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncSubscriptionInput = {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  plan: WorkspacePlan;
  effectivePlan: WorkspacePlan;
  billingInterval: BillingInterval | null;
  subscriptionStatus: BillingSubscriptionStatus;
  seatCount: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export interface BillingRepository {
  countActiveWorkspaceMembers(workspaceId: string): Promise<number>;
  findByWorkspaceId(workspaceId: string): Promise<BillingRecord | null>;
  findWorkspaceIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null>;
  findWorkspaceIdByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null>;
  setStripeCustomer(input: {
    workspaceId: string;
    stripeCustomerId: string;
  }): Promise<BillingRecord>;
  syncSubscription(input: SyncSubscriptionInput): Promise<BillingRecord>;
}

export function createDbBillingRepository(database: Database = defaultDb): BillingRepository {
  return {
    async countActiveWorkspaceMembers(workspaceId) {
      const [row] = await database
        .select({ value: count() })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, "active"),
        ));

      return row?.value ?? 0;
    },

    async findByWorkspaceId(workspaceId) {
      const [record] = await database
        .select()
        .from(workspaceBilling)
        .where(eq(workspaceBilling.workspaceId, workspaceId))
        .limit(1);

      return record ? toBillingRecord(record) : null;
    },

    async findWorkspaceIdByStripeCustomerId(stripeCustomerId) {
      const [record] = await database
        .select({ workspaceId: workspaceBilling.workspaceId })
        .from(workspaceBilling)
        .where(eq(workspaceBilling.stripeCustomerId, stripeCustomerId))
        .limit(1);

      return record?.workspaceId ?? null;
    },

    async findWorkspaceIdByStripeSubscriptionId(stripeSubscriptionId) {
      const [record] = await database
        .select({ workspaceId: workspaceBilling.workspaceId })
        .from(workspaceBilling)
        .where(eq(workspaceBilling.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);

      return record?.workspaceId ?? null;
    },

    async setStripeCustomer(input) {
      const now = new Date();
      const [record] = await database
        .insert(workspaceBilling)
        .values({
          workspaceId: input.workspaceId,
          stripeCustomerId: input.stripeCustomerId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: workspaceBilling.workspaceId,
          set: {
            stripeCustomerId: input.stripeCustomerId,
            updatedAt: now,
          },
        })
        .returning();

      if (!record) {
        throw new Error("Workspace billing customer upsert did not return a row.");
      }

      return toBillingRecord(record);
    },

    async syncSubscription(input) {
      return database.transaction(async (transaction) => {
        const now = new Date();
        const [billing] = await transaction
          .insert(workspaceBilling)
          .values({
            workspaceId: input.workspaceId,
            stripeCustomerId: input.stripeCustomerId,
            stripeSubscriptionId: input.stripeSubscriptionId,
            stripePriceId: input.stripePriceId,
            plan: input.plan,
            billingInterval: input.billingInterval,
            subscriptionStatus: input.subscriptionStatus,
            seatCount: input.seatCount,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: workspaceBilling.workspaceId,
            set: {
              stripeCustomerId: input.stripeCustomerId,
              stripeSubscriptionId: input.stripeSubscriptionId,
              stripePriceId: input.stripePriceId,
              plan: input.plan,
              billingInterval: input.billingInterval,
              subscriptionStatus: input.subscriptionStatus,
              seatCount: input.seatCount,
              currentPeriodEnd: input.currentPeriodEnd,
              cancelAtPeriodEnd: input.cancelAtPeriodEnd,
              updatedAt: now,
            },
          })
          .returning();

        if (!billing) {
          throw new Error("Workspace billing subscription upsert did not return a row.");
        }

        await transaction
          .update(workspaces)
          .set({
            plan: input.effectivePlan,
            updatedAt: now,
          })
          .where(eq(workspaces.id, input.workspaceId));

        return toBillingRecord(billing);
      });
    },
  };
}

function toBillingRecord(record: typeof workspaceBilling.$inferSelect): BillingRecord {
  return {
    workspaceId: record.workspaceId,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripePriceId: record.stripePriceId,
    plan: record.plan,
    billingInterval: record.billingInterval === "month" || record.billingInterval === "year"
      ? record.billingInterval
      : null,
    subscriptionStatus: toSubscriptionStatus(record.subscriptionStatus),
    seatCount: record.seatCount,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toSubscriptionStatus(status: string | null): BillingSubscriptionStatus | null {
  if (
    status === "none" ||
    status === "incomplete" ||
    status === "incomplete_expired" ||
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "paused"
  ) {
    return status;
  }

  return null;
}
