import Stripe from "stripe";
import type {
  BillingInterval,
  BillingSummary,
  BillingSubscriptionStatus,
  WorkspacePlan,
} from "@lightsite/contracts";
import type { CurrentActor } from "../auth/current-actor";
import type { BootstrapWorkspaceSwitcherItem } from "../bootstrap/service";
import type { BillingRecord, BillingRepository } from "./repository";

export type BillingWorkspaceContext = Pick<
  BootstrapWorkspaceSwitcherItem,
  "id" | "name" | "plan" | "role"
>;

export type BillingServiceConfig = {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  webOrigin: string;
  priceIds: Record<"core:month" | "core:year" | "pro:month" | "pro:year", string | undefined>;
};

export interface BillingService {
  getSummary(input: {
    workspace: BillingWorkspaceContext;
  }): Promise<Omit<BillingSummary, "requestId">>;
  createCheckoutSession(input: {
    actor: CurrentActor;
    workspace: BillingWorkspaceContext;
    plan: "core" | "pro";
    interval: BillingInterval;
  }): Promise<{ url: string }>;
  createPortalSession(input: {
    workspace: BillingWorkspaceContext;
  }): Promise<{ url: string }>;
  handleWebhook(input: {
    payload: Buffer;
    signature: string;
  }): Promise<void>;
}

export class BillingPermissionError extends Error {
  constructor() {
    super("Only workspace admins can manage billing.");
    this.name = "BillingPermissionError";
  }
}

export class BillingConfigurationError extends Error {
  constructor(message = "Billing is not configured.") {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

export class BillingPortalUnavailableError extends Error {
  constructor() {
    super("Billing portal is not available until a checkout session has created a Stripe customer.");
    this.name = "BillingPortalUnavailableError";
  }
}

export class BillingWebhookError extends Error {
  constructor(message = "Stripe webhook could not be verified.") {
    super(message);
    this.name = "BillingWebhookError";
  }
}

const activeSubscriptionStatuses = new Set<BillingSubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
]);

export function createBillingService(
  repository: BillingRepository,
  config: BillingServiceConfig,
): BillingService {
  const getStripe = () => {
    if (!config.stripeSecretKey) {
      throw new BillingConfigurationError("Stripe secret key is not configured.");
    }

    return new Stripe(config.stripeSecretKey);
  };

  return {
    async getSummary(input) {
      const billing = await repository.findByWorkspaceId(input.workspace.id);

      return serializeSummary({
        billing,
        workspace: input.workspace,
      });
    },

    async createCheckoutSession(input) {
      requireBillingAdmin(input.workspace);

      const priceId = getPriceId(config, input.plan, input.interval);
      const stripe = getStripe();
      const billing = await repository.findByWorkspaceId(input.workspace.id);
      const customerId = billing?.stripeCustomerId ?? await createCustomer({
        actor: input.actor,
        stripe,
        workspace: input.workspace,
      });

      if (!billing?.stripeCustomerId) {
        await repository.setStripeCustomer({
          workspaceId: input.workspace.id,
          stripeCustomerId: customerId,
        });
      }

      const seatCount = Math.max(1, await repository.countActiveWorkspaceMembers(input.workspace.id));
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: input.workspace.id,
        line_items: [
          {
            price: priceId,
            quantity: seatCount,
          },
        ],
        metadata: {
          workspaceId: input.workspace.id,
          plan: input.plan,
          interval: input.interval,
        },
        subscription_data: {
          metadata: {
            workspaceId: input.workspace.id,
            plan: input.plan,
            interval: input.interval,
          },
        },
        success_url: buildWebUrl(config.webOrigin, "/billing", {
          checkout: "success",
        }),
        cancel_url: buildWebUrl(config.webOrigin, "/billing", {
          checkout: "cancelled",
        }),
      });

      if (!session.url) {
        throw new BillingConfigurationError("Stripe did not return a checkout URL.");
      }

      return { url: session.url };
    },

    async createPortalSession(input) {
      requireBillingAdmin(input.workspace);

      const stripe = getStripe();
      const billing = await repository.findByWorkspaceId(input.workspace.id);

      if (!billing?.stripeCustomerId) {
        throw new BillingPortalUnavailableError();
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: billing.stripeCustomerId,
        return_url: buildWebUrl(config.webOrigin, "/billing"),
      });

      return { url: session.url };
    },

    async handleWebhook(input) {
      if (!config.stripeWebhookSecret) {
        throw new BillingWebhookError("Stripe webhook secret is not configured.");
      }

      let event: Stripe.Event;
      const stripe = getStripe();

      try {
        event = stripe.webhooks.constructEvent(
          input.payload,
          input.signature,
          config.stripeWebhookSecret,
        );
      } catch {
        throw new BillingWebhookError();
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const subscriptionId = getStripeId(session.subscription);

        if (session.mode === "subscription" && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(repository, config, subscription, {
            customerId: getStripeId(session.customer),
            workspaceId: session.metadata?.workspaceId ?? session.client_reference_id ?? undefined,
          });
        }

        return;
      }

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await syncSubscription(repository, config, event.data.object);
      }
    },
  };
}

async function createCustomer(input: {
  actor: CurrentActor;
  stripe: Stripe;
  workspace: BillingWorkspaceContext;
}) {
  const customer = await input.stripe.customers.create({
    email: input.actor.email,
    ...(input.actor.name ? { name: input.actor.name } : {}),
    metadata: {
      workspaceId: input.workspace.id,
      workspaceName: input.workspace.name,
    },
  });

  return customer.id;
}

async function syncSubscription(
  repository: BillingRepository,
  config: BillingServiceConfig,
  subscription: Stripe.Subscription,
  fallback: { customerId?: string | null; workspaceId?: string } = {},
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = getStripeId(subscription.customer) ?? fallback.customerId;
  const stripePrice = subscription.items.data[0]?.price ?? null;
  const stripePriceId = stripePrice?.id ?? null;
  const plan = getPlanFromSubscription(config, subscription, stripePriceId);
  const workspaceId =
    subscription.metadata.workspaceId ||
    fallback.workspaceId ||
    await repository.findWorkspaceIdByStripeSubscriptionId(stripeSubscriptionId) ||
    (stripeCustomerId ? await repository.findWorkspaceIdByStripeCustomerId(stripeCustomerId) : null);

  if (!workspaceId || !stripeCustomerId) {
    return;
  }

  const subscriptionStatus = toBillingSubscriptionStatus(subscription.status);
  const effectivePlan = activeSubscriptionStatuses.has(subscriptionStatus) ? plan : "free";

  await repository.syncSubscription({
    workspaceId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    plan,
    effectivePlan,
    billingInterval: toBillingInterval(stripePrice?.recurring?.interval ?? null),
    subscriptionStatus,
    seatCount: Math.max(1, subscription.items.data[0]?.quantity ?? 1),
    currentPeriodEnd: toDate((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

function serializeSummary(input: {
  billing: BillingRecord | null;
  workspace: BillingWorkspaceContext;
}): Omit<BillingSummary, "requestId"> {
  const subscriptionStatus = input.billing?.subscriptionStatus ?? null;

  return {
    workspaceId: input.workspace.id,
    plan: input.workspace.plan,
    canPublish: input.workspace.plan !== "free",
    canManageBilling: input.workspace.role === "admin",
    hasStripeCustomer: Boolean(input.billing?.stripeCustomerId),
    subscription: subscriptionStatus
      ? {
          status: subscriptionStatus,
          interval: input.billing?.billingInterval ?? null,
          seatCount: input.billing?.seatCount ?? 1,
          currentPeriodEnd: input.billing?.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: input.billing?.cancelAtPeriodEnd ?? false,
        }
      : null,
  };
}

function requireBillingAdmin(workspace: BillingWorkspaceContext) {
  if (workspace.role !== "admin") {
    throw new BillingPermissionError();
  }
}

function getPriceId(
  config: BillingServiceConfig,
  plan: "core" | "pro",
  interval: BillingInterval,
) {
  const priceId = config.priceIds[`${plan}:${interval}`];

  if (!priceId) {
    throw new BillingConfigurationError(`Stripe ${plan} ${interval} price is not configured.`);
  }

  return priceId;
}

function getPlanFromSubscription(
  config: BillingServiceConfig,
  subscription: Stripe.Subscription,
  priceId: string | null,
): WorkspacePlan {
  if (subscription.metadata.plan === "core" || subscription.metadata.plan === "pro") {
    return subscription.metadata.plan;
  }

  if (priceId === config.priceIds["pro:month"] || priceId === config.priceIds["pro:year"]) {
    return "pro";
  }

  if (priceId === config.priceIds["core:month"] || priceId === config.priceIds["core:year"]) {
    return "core";
  }

  return "free";
}

function toBillingSubscriptionStatus(status: Stripe.Subscription.Status): BillingSubscriptionStatus {
  if (
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

  return "none";
}

function toBillingInterval(interval: string | null): BillingInterval | null {
  if (interval === "month" || interval === "year") {
    return interval;
  }

  return null;
}

function toDate(timestamp: number | undefined) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

function getStripeId(value: string | { id?: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function buildWebUrl(origin: string, pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, origin);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
