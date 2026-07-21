import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Database, WebhookAutomationTrigger, WebhookPayloadSnapshot } from "@handout/db";
import {
  siteVariants,
  sites,
  trackingRecipientEvents,
  trackingRecipientSessions,
  webhookAutomationRevisions,
  webhookAutomations,
  webhookDeliveries,
  webhookMessages,
  webhookUsageMonthly,
  webhookWorkspaceQueueState,
  workspaces,
} from "@handout/db/schema";
import { AUTOMATION_LIMITS, canUseAutomations, getAutomationRetryAt } from "@handout/domain";
import type {
  Automation,
  AutomationDelivery,
  AutomationTrigger,
  CreateAutomationRequest,
  UpdateAutomationRequest,
} from "@handout/contracts";
import {
  automationAssociatedData,
  createAutomationSigningSecret,
  createWebhookSignature,
  decryptAutomationValue,
  encryptAutomationValue,
} from "./crypto";
import { parseAutomationDestination, sendSafeWebhook, UnsafeAutomationDestinationError } from "./destination";

export type AutomationWorkspaceContext = {
  id: string;
  plan: "free" | "core" | "pro";
  role: "admin" | "user";
};

export class AutomationServiceError extends Error {
  constructor(
    readonly code: "admin_required" | "invalid_destination" | "limit_reached" | "not_found" | "test_required" | "upgrade_required" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AutomationServiceError";
  }
}

type AutomationServiceOptions = {
  encryptionKey: Buffer;
  allowLocalDestinations?: boolean;
  now?: () => Date;
};

export function createAutomationService(database: Database, options: AutomationServiceOptions) {
  const now = options.now ?? (() => new Date());

  async function findAutomation(workspaceId: string, automationId: string) {
    const [row] = await database.select({
      automation: webhookAutomations,
      revision: webhookAutomationRevisions,
    }).from(webhookAutomations)
      .innerJoin(webhookAutomationRevisions, eq(webhookAutomations.currentRevisionId, webhookAutomationRevisions.id))
      .where(and(eq(webhookAutomations.workspaceId, workspaceId), eq(webhookAutomations.id, automationId)))
      .limit(1);
    return row ?? null;
  }

  async function list(workspace: AutomationWorkspaceContext) {
    const rows = await database.select({
      automation: webhookAutomations,
      revision: webhookAutomationRevisions,
    }).from(webhookAutomations)
      .innerJoin(webhookAutomationRevisions, eq(webhookAutomations.currentRevisionId, webhookAutomationRevisions.id))
      .where(eq(webhookAutomations.workspaceId, workspace.id))
      .orderBy(asc(webhookAutomations.name));
    return {
      plan: workspace.plan,
      role: workspace.role,
      automations: rows.map(toAutomation),
      usage: await getUsage(database, workspace.id, now()),
    };
  }

  return {
    list,

    async get(workspace: AutomationWorkspaceContext, automationId: string) {
      const row = await findAutomation(workspace.id, automationId);
      if (!row) throw notFound();
      return {
        automation: toAutomation(row),
        hasSuccessfulTest: await hasSuccessfulRevisionTest(
          database,
          workspace.id,
          automationId,
          row.revision.id,
          row.automation.stateReason === "plan_changed" ? row.automation.updatedAt : undefined,
        ),
      };
    },

    async options(workspace: AutomationWorkspaceContext) {
      const [siteRows, recipientRows] = await Promise.all([
        database.select({ id: sites.id, label: sites.name, secondaryLabel: sites.slug })
          .from(sites).where(and(eq(sites.workspaceId, workspace.id), or(eq(sites.status, "published"), eq(sites.status, "draft"))))
          .orderBy(asc(sites.name)),
        database.select({
          id: siteVariants.id,
          label: siteVariants.name,
          secondaryLabel: siteVariants.recipientCompany,
          siteId: siteVariants.siteId,
        }).from(siteVariants)
          .where(and(eq(siteVariants.workspaceId, workspace.id), eq(siteVariants.status, "active")))
          .orderBy(asc(siteVariants.name)),
      ]);
      return { sites: siteRows, recipients: recipientRows };
    },

    async create(workspace: AutomationWorkspaceContext, userId: string, input: CreateAutomationRequest) {
      requireAdminPro(workspace);
      const endpoint = parseDestination(input.endpointUrl, options.allowLocalDestinations);
      await validateTriggerSelections(database, workspace.id, input.trigger);
      const automationId = randomUUID();
      const revisionId = randomUUID();
      const signingSecret = createAutomationSigningSecret();
      const endpointEncrypted = encryptAutomationValue(input.endpointUrl, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "endpoint"));
      const secretEncrypted = encryptAutomationValue(signingSecret, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "secret"));
      const createdAt = now();
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        const [total] = await transaction.select({ count: sql<number>`count(*)::int` }).from(webhookAutomations)
          .where(eq(webhookAutomations.workspaceId, workspace.id));
        if ((total?.count ?? 0) >= AUTOMATION_LIMITS.maxTotalPerWorkspace) {
          throw new AutomationServiceError("limit_reached", `Pro includes up to ${AUTOMATION_LIMITS.maxTotalPerWorkspace} automations.`);
        }
        await transaction.insert(webhookAutomations).values({
          id: automationId,
          workspaceId: workspace.id,
          name: input.name,
          state: "draft",
          endpointHost: endpoint.host,
          currentRevisionId: revisionId,
          createdByUserId: userId,
          updatedByUserId: userId,
          createdAt,
          updatedAt: createdAt,
        });
        await transaction.insert(webhookAutomationRevisions).values({
          id: revisionId,
          automationId,
          workspaceId: workspace.id,
          revisionNumber: 1,
          trigger: input.trigger,
          endpointCiphertext: endpointEncrypted.ciphertext,
          endpointNonce: endpointEncrypted.nonce,
          signingSecretCiphertext: secretEncrypted.ciphertext,
          signingSecretNonce: secretEncrypted.nonce,
          createdByUserId: userId,
          createdAt,
        });
      });
      const row = await findAutomation(workspace.id, automationId);
      if (!row) throw unavailable();
      return { automation: toAutomation(row), hasSuccessfulTest: false, signingSecret };
    },

    async update(workspace: AutomationWorkspaceContext, userId: string, automationId: string, input: UpdateAutomationRequest) {
      requireAdminPro(workspace);
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      const trigger = input.trigger ?? current.revision.trigger;
      await validateTriggerSelections(database, workspace.id, trigger);
      const currentEndpoint = decryptField(current, options.encryptionKey, "endpoint");
      const endpointUrl = input.endpointUrl ?? currentEndpoint;
      const endpoint = parseDestination(endpointUrl, options.allowLocalDestinations);
      const configurationChanged = endpointUrl !== currentEndpoint || !areAutomationTriggersEqual(trigger, current.revision.trigger);
      if (!configurationChanged) {
        await database.update(webhookAutomations).set({
          name: input.name ?? current.automation.name,
          updatedByUserId: userId,
          updatedAt: now(),
        }).where(and(eq(webhookAutomations.id, automationId), eq(webhookAutomations.workspaceId, workspace.id)));
        const row = await findAutomation(workspace.id, automationId);
        if (!row) throw unavailable();
        return { automation: toAutomation(row) };
      }
      const signingSecret = decryptField(current, options.encryptionKey, "secret");
      const revisionId = randomUUID();
      const createdAt = now();
      const endpointEncrypted = encryptAutomationValue(endpointUrl, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "endpoint"));
      const secretEncrypted = encryptAutomationValue(signingSecret, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "secret"));
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        await assertCurrentRevision(transaction, workspace.id, automationId, current.revision.id);
        await transaction.update(webhookAutomationRevisions).set({ retiredAt: createdAt }).where(eq(webhookAutomationRevisions.id, current.revision.id));
        await transaction.insert(webhookAutomationRevisions).values({
          id: revisionId,
          automationId,
          workspaceId: workspace.id,
          revisionNumber: current.revision.revisionNumber + 1,
          trigger,
          endpointCiphertext: endpointEncrypted.ciphertext,
          endpointNonce: endpointEncrypted.nonce,
          signingSecretCiphertext: secretEncrypted.ciphertext,
          signingSecretNonce: secretEncrypted.nonce,
          createdByUserId: userId,
          createdAt,
        });
        await transaction.update(webhookAutomations).set({
          name: input.name ?? current.automation.name,
          endpointHost: endpoint.host,
          currentRevisionId: revisionId,
          state: current.automation.state === "draft" ? "draft" : "paused",
          stateReason: current.automation.state === "draft" ? null : "user",
          updatedByUserId: userId,
          updatedAt: createdAt,
        }).where(eq(webhookAutomations.id, automationId));
      });
      const row = await findAutomation(workspace.id, automationId);
      if (!row) throw unavailable();
      return { automation: toAutomation(row) };
    },

    async setState(workspace: AutomationWorkspaceContext, userId: string, automationId: string, state: "enabled" | "paused") {
      requireAdminPro(workspace);
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        await assertCurrentRevision(transaction, workspace.id, automationId, current.revision.id);
        if (state === "enabled" && current.automation.state !== "enabled") {
          const testConditions = [
            eq(webhookDeliveries.workspaceId, workspace.id),
            eq(webhookDeliveries.automationId, automationId),
            eq(webhookDeliveries.revisionId, current.revision.id),
            eq(webhookMessages.kind, "test"),
            eq(webhookDeliveries.status, "succeeded"),
          ];
          if (requiresFreshTest(current.automation.stateReason)) {
            testConditions.push(gt(webhookDeliveries.createdAt, current.automation.updatedAt));
          }
          const [successfulTest] = await transaction.select({ id: webhookDeliveries.id }).from(webhookDeliveries)
            .innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
            .where(and(...testConditions)).limit(1);
          if (!successfulTest) throw new AutomationServiceError("test_required", "Send a successful test before turning this automation on.");
          const [usage] = await transaction.select({ attempts: webhookUsageMonthly.deliveryAttempts }).from(webhookUsageMonthly)
            .where(and(eq(webhookUsageMonthly.workspaceId, workspace.id), eq(webhookUsageMonthly.month, monthStart(now())))).limit(1);
          if ((usage?.attempts ?? 0) >= AUTOMATION_LIMITS.monthlyDeliveryAttempts) {
            throw new AutomationServiceError("limit_reached", `The monthly delivery limit resets ${nextMonth(now()).toISOString()}.`);
          }
          const [enabled] = await transaction.select({ count: sql<number>`count(*)::int` }).from(webhookAutomations)
            .where(and(eq(webhookAutomations.workspaceId, workspace.id), eq(webhookAutomations.state, "enabled")));
          if ((enabled?.count ?? 0) >= AUTOMATION_LIMITS.maxEnabledPerWorkspace) throw new AutomationServiceError("limit_reached", "Pause another automation before enabling this one.");
        }
        await transaction.update(webhookAutomations).set({ state, stateReason: state === "paused" ? "user" : null, updatedByUserId: userId, updatedAt: now() })
          .where(and(eq(webhookAutomations.id, automationId), eq(webhookAutomations.workspaceId, workspace.id)));
      });
      const row = await findAutomation(workspace.id, automationId);
      if (!row) throw notFound();
      return { automation: toAutomation(row) };
    },

    async test(workspace: AutomationWorkspaceContext, automationId: string) {
      requireAdminPro(workspace);
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      const createdAt = now();
      const messageId = randomUUID();
      const eventId = `test_${randomUUID()}`;
      const testEventType = current.revision.trigger.eventTypes[0]!;
      const payload = createTestPayload(eventId, workspace.id, testEventType, createdAt);
      const payloadText = serializePayload(payload);
      const [delivery] = await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        await assertCurrentRevision(transaction, workspace.id, automationId, current.revision.id);
        const queue = await getQueueState(transaction, workspace.id);
        if (queue.pendingDeliveries >= AUTOMATION_LIMITS.maxPendingDeliveriesPerWorkspace) {
          throw new AutomationServiceError("limit_reached", "The delivery queue is full. Wait for pending deliveries before sending another test.");
        }
        const hourAgo = new Date(createdAt.getTime() - 60 * 60_000);
        const [testCounts] = await transaction.select({
          workspace: sql<number>`count(*)::int`,
          automation: sql<number>`count(*) filter (where ${webhookDeliveries.automationId} = ${automationId})::int`,
        }).from(webhookDeliveries).innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
          .where(and(eq(webhookDeliveries.workspaceId, workspace.id), eq(webhookMessages.kind, "test"), gt(webhookDeliveries.createdAt, hourAgo)));
        if ((testCounts?.automation ?? 0) >= AUTOMATION_LIMITS.maxTestsPerAutomationPerHour || (testCounts?.workspace ?? 0) >= AUTOMATION_LIMITS.maxTestsPerWorkspacePerHour) {
          throw new AutomationServiceError("limit_reached", "Too many tests were sent recently. Try again in an hour.");
        }
        await transaction.insert(webhookMessages).values({
          id: messageId,
          workspaceId: workspace.id,
          eventId,
          eventType: testEventType,
          kind: "test",
          payload,
          payloadText,
          fanoutStatus: "complete",
          createdAt,
          completedAt: createdAt,
        });
        const rows = await transaction.insert(webhookDeliveries).values({
          workspaceId: workspace.id,
          automationId,
          revisionId: current.revision.id,
          messageId,
          nextAttemptAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        }).returning({ id: webhookDeliveries.id });
        await incrementQueue(transaction, workspace.id, 0, 1, createdAt);
        return rows;
      });
      if (!delivery) throw unavailable();
      return { deliveryId: delivery.id };
    },

    async activity(workspace: AutomationWorkspaceContext, automationId: string, limit = 50, cursor?: { createdAt: Date; id: string }) {
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      const cursorCreatedAt = sql<Date>`date_trunc('milliseconds', ${webhookDeliveries.createdAt})`;
      const rows = await database.select({ delivery: webhookDeliveries, message: webhookMessages })
        .from(webhookDeliveries)
        .innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
        .where(and(
          eq(webhookDeliveries.workspaceId, workspace.id),
          eq(webhookDeliveries.automationId, automationId),
          cursor ? sql`(
            ${cursorCreatedAt} < ${cursor.createdAt.toISOString()}::timestamptz
            or (${cursorCreatedAt} = ${cursor.createdAt.toISOString()}::timestamptz and ${webhookDeliveries.id} < ${cursor.id}::uuid)
          )` : undefined,
        ))
        .orderBy(desc(cursorCreatedAt), desc(webhookDeliveries.id)).limit(Math.min(limit, 100) + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1)?.delivery;
      return {
        deliveries: page.map(toDelivery),
        nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
      };
    },

    async deliveryData(workspace: AutomationWorkspaceContext, automationId: string, deliveryId: string) {
      const [row] = await database.select({ payload: webhookMessages.payloadText })
        .from(webhookDeliveries)
        .innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
        .where(and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.automationId, automationId),
          eq(webhookDeliveries.workspaceId, workspace.id),
        )).limit(1);
      if (!row) throw notFound();
      return row;
    },

    async retry(workspace: AutomationWorkspaceContext, automationId: string, deliveryId: string) {
      requireAdminPro(workspace);
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      const [retryContext] = await database.select({ kind: webhookMessages.kind, payload: webhookMessages.payloadText, revisionId: webhookDeliveries.revisionId })
        .from(webhookDeliveries).innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
        .where(and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.workspaceId, workspace.id),
          eq(webhookDeliveries.automationId, automationId),
        )).limit(1);
      if (!retryContext || retryContext.revisionId !== current.revision.id) throw notFound();
      if (!retryContext.payload) throw new AutomationServiceError("unavailable", "The sent data is no longer retained and cannot be retried.");
      if (retryContext.kind === "live" && current.automation.state !== "enabled") {
        throw new AutomationServiceError("test_required", "Turn this automation on before retrying a live delivery.");
      }
      const retriedAt = now();
      const updated = await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        await assertCurrentRevision(transaction, workspace.id, automationId, current.revision.id);
        if (retryContext.kind === "live") {
          const [authoritative] = await transaction.select({ state: webhookAutomations.state }).from(webhookAutomations)
            .where(and(eq(webhookAutomations.id, automationId), eq(webhookAutomations.workspaceId, workspace.id))).limit(1);
          if (authoritative?.state !== "enabled") {
            throw new AutomationServiceError("test_required", "Turn this automation on before retrying a live delivery.");
          }
        }
        const queue = await getQueueState(transaction, workspace.id);
        if (queue.pendingDeliveries >= AUTOMATION_LIMITS.maxPendingDeliveriesPerWorkspace) {
          throw new AutomationServiceError("limit_reached", "The delivery queue is full. Wait for pending deliveries before retrying.");
        }
        const rows = await transaction.update(webhookDeliveries).set({
          status: "pending", manualRetryCount: sql`${webhookDeliveries.manualRetryCount} + 1`, errorCode: null, responseStatus: null,
          nextAttemptAt: retriedAt, completedAt: null, leasedUntil: null, leaseToken: null, updatedAt: retriedAt,
        }).where(and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.automationId, automationId),
          eq(webhookDeliveries.workspaceId, workspace.id),
          eq(webhookDeliveries.revisionId, current.revision.id),
          eq(webhookDeliveries.status, "failed"),
          lt(webhookDeliveries.manualRetryCount, AUTOMATION_LIMITS.maxManualRetries),
          lt(webhookDeliveries.attemptCount, AUTOMATION_LIMITS.maxAttempts),
        ))
          .returning({ id: webhookDeliveries.id });
        if (rows.length) await incrementQueue(transaction, workspace.id, 0, 1, retriedAt);
        return rows;
      });
      if (!updated.length) throw notFound();
    },

    async rotateSecret(workspace: AutomationWorkspaceContext, userId: string, automationId: string) {
      requireAdminPro(workspace);
      const current = await findAutomation(workspace.id, automationId);
      if (!current) throw notFound();
      const endpointUrl = decryptField(current, options.encryptionKey, "endpoint");
      const signingSecret = createAutomationSigningSecret();
      const revisionId = randomUUID();
      const createdAt = now();
      const endpointEncrypted = encryptAutomationValue(endpointUrl, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "endpoint"));
      const secretEncrypted = encryptAutomationValue(signingSecret, options.encryptionKey, automationAssociatedData(workspace.id, automationId, revisionId, "secret"));
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        await assertCurrentRevision(transaction, workspace.id, automationId, current.revision.id);
        await transaction.update(webhookAutomationRevisions).set({ retiredAt: createdAt }).where(eq(webhookAutomationRevisions.id, current.revision.id));
        await transaction.insert(webhookAutomationRevisions).values({
          id: revisionId, automationId, workspaceId: workspace.id, revisionNumber: current.revision.revisionNumber + 1,
          trigger: current.revision.trigger, endpointCiphertext: endpointEncrypted.ciphertext, endpointNonce: endpointEncrypted.nonce,
          signingSecretCiphertext: secretEncrypted.ciphertext, signingSecretNonce: secretEncrypted.nonce,
          createdByUserId: userId, createdAt,
        });
        await transaction.update(webhookAutomations).set({
          currentRevisionId: revisionId,
          state: "paused",
          stateReason: "user",
          updatedByUserId: userId,
          updatedAt: createdAt,
        }).where(eq(webhookAutomations.id, automationId));
      });
      return { signingSecret };
    },

    async remove(workspace: AutomationWorkspaceContext, automationId: string) {
      requireAdmin(workspace);
      const deleted = await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspace.id}, 0))`);
        const [pending] = await transaction.select({ count: sql<number>`count(*)::int` }).from(webhookDeliveries).where(and(
          eq(webhookDeliveries.automationId, automationId),
          eq(webhookDeliveries.workspaceId, workspace.id),
          eq(webhookDeliveries.status, "pending"),
        ));
        const rows = await transaction.delete(webhookAutomations).where(and(eq(webhookAutomations.id, automationId), eq(webhookAutomations.workspaceId, workspace.id))).returning({ id: webhookAutomations.id });
        if (rows.length && (pending?.count ?? 0) > 0) await incrementQueue(transaction, workspace.id, 0, -(pending?.count ?? 0), now());
        return rows;
      });
      if (!deleted.length) throw notFound();
    },
  };
}

export type AutomationOutboxMessageInput = {
  sourceEventRowId: string;
  eventId: string;
  eventType: "site_visit" | "button_click" | "link_click" | "tab_switch";
  workspaceId: string;
  siteId: string;
  recipientId: string | null;
  sessionId: string;
  occurredAt: Date;
  receivedAt: Date;
  pageId?: string | null;
  pageLabel?: string | null;
  fromPageId?: string | null;
  fromPageLabel?: string | null;
  elementKind?: string | null;
  elementId?: string | null;
  elementLabel?: string | null;
  destinationKind?: string | null;
  destinationHost?: string | null;
};

export async function enqueueAutomationMessage(database: Database, input: AutomationOutboxMessageInput) {
  await enqueueAutomationMessages(database, [input]);
}

export async function enqueueAutomationMessages(database: Database, inputs: AutomationOutboxMessageInput[]) {
  const byWorkspace = new Map<string, AutomationOutboxMessageInput[]>();
  for (const input of inputs) byWorkspace.set(input.workspaceId, [...(byWorkspace.get(input.workspaceId) ?? []), input]);
  for (const [workspaceId, workspaceInputs] of byWorkspace) {
    const enabled = await database.select({ trigger: webhookAutomationRevisions.trigger })
    .from(webhookAutomations)
    .innerJoin(webhookAutomationRevisions, eq(webhookAutomations.currentRevisionId, webhookAutomationRevisions.id))
    .innerJoin(workspaces, eq(webhookAutomations.workspaceId, workspaces.id))
    .where(and(
      eq(webhookAutomations.workspaceId, workspaceId),
      eq(webhookAutomations.state, "enabled"),
      eq(workspaces.plan, "pro"),
      isNull(webhookAutomationRevisions.retiredAt),
    ));
    if (!enabled.length) continue;
    const contextCache = new Map<string, Promise<AutomationEventContext | null>>();
    const prepared: PreparedAutomationMessage[] = [];
    for (const input of workspaceInputs) {
      if (enabled.some(({ trigger }) => trigger.eventTypes.includes(input.eventType))) {
        const message = await prepareAutomationMessage(database, input, contextCache);
        if (message) prepared.push(message);
      }
    }
    if (prepared.length) await admitAutomationMessages(database, workspaceId, prepared);
  }
}

type AutomationEventContext = NonNullable<Awaited<ReturnType<typeof loadAutomationEventContext>>>;
type PreparedAutomationMessage = NonNullable<Awaited<ReturnType<typeof prepareAutomationMessage>>>;

async function prepareAutomationMessage(database: Database, input: AutomationOutboxMessageInput, contextCache: Map<string, Promise<AutomationEventContext | null>>) {
  const contextKey = `${input.workspaceId}:${input.siteId}:${input.sessionId}:${input.recipientId ?? "public"}`;
  let contextPromise = contextCache.get(contextKey);
  if (!contextPromise) {
    contextPromise = loadAutomationEventContext(database, input);
    contextCache.set(contextKey, contextPromise);
  }
  const context = await contextPromise;
  if (!context) return;
  const payload: WebhookPayloadSnapshot = {
    schema_version: 1,
    test: false,
    event: { id: input.eventId, type: input.eventType, occurred_at: input.occurredAt.toISOString() },
    workspace: { id: input.workspaceId, name: context.workspaceName },
    site: { id: input.siteId, name: context.siteName, slug: context.siteSlug },
    recipient: input.recipientId ? { id: input.recipientId, name: context.recipientName, company: context.recipientCompany } : null,
    session: {
      id: context.publicSessionId,
      started_at: context.sessionStartedAt.toISOString(),
      device: { type: context.deviceType, os: context.osName, browser: context.browserName },
      location: { city: context.city, region: context.region, country_code: context.countryCode },
    },
    page: input.pageId ? { id: input.pageId, label: input.pageLabel ?? null, previous_id: input.fromPageId ?? null, previous_label: input.fromPageLabel ?? null } : null,
    element: (input.eventType === "button_click" || input.eventType === "link_click") && input.elementKind ? {
      id: input.elementId ?? null,
      label: input.elementLabel ?? null,
      kind: input.elementKind,
      destination: input.destinationKind || input.destinationHost ? { kind: input.destinationKind ?? null, host: input.destinationHost ?? null } : null,
    } : null,
  };
  const payloadText = serializePayload(payload);
  if (Buffer.byteLength(payloadText) > AUTOMATION_LIMITS.maxPayloadBytes) return;
  return { input, payload, payloadText };
}

async function admitAutomationMessages(database: Database, workspaceId: string, prepared: PreparedAutomationMessage[]) {
  const overflowed = await database.transaction(async (transaction) => {
    const receivedAt = prepared[0]!.input.receivedAt;
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`);
    const queue = await getQueueState(transaction, workspaceId);
    const available = Math.max(0, AUTOMATION_LIMITS.maxPendingMessagesPerWorkspace - queue.pendingMessages);
    const accepted = prepared.slice(0, available);
    const inserted = accepted.length ? await transaction.insert(webhookMessages).values(accepted.map(({ input, payload, payloadText }) => ({
      workspaceId,
      sourceEventRowId: input.sourceEventRowId,
      eventId: input.eventId,
      eventType: input.eventType,
      kind: "live" as const,
      payload,
      payloadText,
      createdAt: input.receivedAt,
      availableAt: input.receivedAt,
    }))).onConflictDoNothing().returning({ id: webhookMessages.id }) : [];
    if (inserted.length) await incrementQueue(transaction, workspaceId, inserted.length, 0, receivedAt);
    return accepted.length < prepared.length;
  });
  if (overflowed) {
    await database.update(webhookAutomations).set({ state: "needs_attention", stateReason: "queue_limit", updatedAt: prepared[0]!.input.receivedAt })
      .where(and(eq(webhookAutomations.workspaceId, workspaceId), eq(webhookAutomations.state, "enabled")));
  }
}

async function loadAutomationEventContext(database: Database, input: AutomationOutboxMessageInput) {
  const [context] = await database.select({
    workspaceName: workspaces.name,
    siteName: sites.name,
    siteSlug: sites.slug,
    recipientName: siteVariants.recipientName,
    recipientCompany: siteVariants.recipientCompany,
    publicSessionId: trackingRecipientSessions.publicSessionId,
    sessionStartedAt: trackingRecipientSessions.startedAt,
    deviceType: trackingRecipientSessions.deviceType,
    osName: trackingRecipientSessions.osName,
    browserName: trackingRecipientSessions.browserName,
    city: trackingRecipientSessions.city,
    region: trackingRecipientSessions.region,
    countryCode: trackingRecipientSessions.countryCode,
  }).from(sites)
    .innerJoin(workspaces, eq(workspaces.id, sites.workspaceId))
    .innerJoin(trackingRecipientSessions, and(
      eq(trackingRecipientSessions.id, input.sessionId),
      eq(trackingRecipientSessions.workspaceId, input.workspaceId),
      eq(trackingRecipientSessions.siteId, input.siteId),
    ))
    .leftJoin(siteVariants, eq(siteVariants.id, input.recipientId ?? "00000000-0000-0000-0000-000000000000"))
    .where(and(eq(sites.id, input.siteId), eq(sites.workspaceId, input.workspaceId))).limit(1);
  return context ?? null;
}

export function createAutomationWorker(database: Database, options: AutomationServiceOptions) {
  const now = options.now ?? (() => new Date());
  let lastRetentionAt = 0;
  let lastReconciliationAt = 0;
  let retentionRunning = false;
  let reconciliationRunning = false;
  return {
    async runOnce() {
      const current = now();
      let retained = false;
      if (!retentionRunning && current.getTime() - lastRetentionAt >= 60 * 60_000) {
        retentionRunning = true;
        try {
          retained = await pruneAutomationActivity(database, current);
          lastRetentionAt = retained ? 0 : current.getTime();
        } finally { retentionRunning = false; }
      }
      let reconciled = false;
      if (!reconciliationRunning && current.getTime() - lastReconciliationAt >= 30_000) {
        reconciliationRunning = true;
        try {
          reconciled = await reconcileOne(database, current);
          lastReconciliationAt = reconciled ? 0 : current.getTime();
        } finally { reconciliationRunning = false; }
      }
      const fannedOut = await fanoutOne(database, current);
      const delivered = await deliverOne(database, { ...options, now });
      return { retained, reconciled, fannedOut, delivered };
    },
  };
}

async function reconcileOne(database: Database, now: Date) {
  const [event] = await database.selectDistinct({
    id: trackingRecipientEvents.id,
    eventId: trackingRecipientEvents.eventId,
    type: trackingRecipientEvents.type,
    workspaceId: trackingRecipientEvents.workspaceId,
    siteId: trackingRecipientEvents.siteId,
    recipientId: trackingRecipientEvents.recipientId,
    sessionId: trackingRecipientEvents.sessionId,
    occurredAt: trackingRecipientEvents.occurredAt,
    receivedAt: trackingRecipientEvents.receivedAt,
    pageId: trackingRecipientEvents.pageId,
    pageLabel: trackingRecipientEvents.pageLabel,
    fromPageId: trackingRecipientEvents.fromPageId,
    fromPageLabel: trackingRecipientEvents.fromPageLabel,
    elementKind: trackingRecipientEvents.elementKind,
    elementId: trackingRecipientEvents.elementId,
    elementLabel: trackingRecipientEvents.elementLabel,
    destinationKind: trackingRecipientEvents.destinationKind,
    destinationHost: trackingRecipientEvents.destinationHost,
  }).from(trackingRecipientEvents)
    .innerJoin(webhookAutomations, and(eq(webhookAutomations.workspaceId, trackingRecipientEvents.workspaceId), eq(webhookAutomations.state, "enabled")))
    .innerJoin(workspaces, and(eq(workspaces.id, trackingRecipientEvents.workspaceId), eq(workspaces.plan, "pro")))
    .leftJoin(webhookMessages, eq(webhookMessages.sourceEventRowId, trackingRecipientEvents.id))
    .where(and(
      inArray(trackingRecipientEvents.type, ["site_visit", "button_click", "link_click", "tab_switch"]),
      gt(trackingRecipientEvents.receivedAt, new Date(now.getTime() - 10 * 60_000)),
      isNull(webhookMessages.id),
    )).orderBy(asc(trackingRecipientEvents.receivedAt)).limit(1);
  if (!event?.sessionId || !["site_visit", "button_click", "link_click", "tab_switch"].includes(event.type)) return false;
  await enqueueAutomationMessage(database, {
    sourceEventRowId: event.id,
    eventId: event.eventId,
    eventType: event.type as "site_visit" | "button_click" | "link_click" | "tab_switch",
    workspaceId: event.workspaceId,
    siteId: event.siteId,
    recipientId: event.recipientId,
    sessionId: event.sessionId,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    pageId: event.pageId,
    pageLabel: event.pageLabel,
    fromPageId: event.fromPageId,
    fromPageLabel: event.fromPageLabel,
    elementKind: event.elementKind,
    elementId: event.elementId,
    elementLabel: event.elementLabel,
    destinationKind: event.destinationKind,
    destinationHost: event.destinationHost,
  });
  return true;
}

async function fanoutOne(database: Database, now: Date) {
  const [message] = await database.select().from(webhookMessages)
    .where(and(
      eq(webhookMessages.fanoutStatus, "pending"),
      lt(webhookMessages.availableAt, new Date(now.getTime() + 1)),
      or(isNull(webhookMessages.leasedUntil), lt(webhookMessages.leasedUntil, now)),
    ))
    .orderBy(asc(webhookMessages.createdAt)).limit(1);
  if (!message) return false;
  const leaseToken = randomUUID();
  const leased = await database.update(webhookMessages).set({
    leaseToken,
    leasedUntil: new Date(now.getTime() + 30_000),
  }).where(and(
    eq(webhookMessages.id, message.id),
    eq(webhookMessages.fanoutStatus, "pending"),
    or(isNull(webhookMessages.leasedUntil), lt(webhookMessages.leasedUntil, now)),
  )).returning({ id: webhookMessages.id });
  if (!leased.length) return true;
      if (!message.payload) {
    await database.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${message.workspaceId}, 0))`);
      const updated = await transaction.update(webhookMessages).set({ fanoutStatus: "cancelled", completedAt: now, leaseToken: null, leasedUntil: null })
        .where(and(eq(webhookMessages.id, message.id), eq(webhookMessages.leaseToken, leaseToken), eq(webhookMessages.fanoutStatus, "pending")))
        .returning({ id: webhookMessages.id });
      if (updated.length) await incrementQueue(transaction, message.workspaceId, -1, 0, now);
    });
    return true;
  }
  const payload = message.payload;
  const rows = await database.select({ automation: webhookAutomations, revision: webhookAutomationRevisions, plan: workspaces.plan })
    .from(webhookAutomations)
    .innerJoin(webhookAutomationRevisions, eq(webhookAutomations.currentRevisionId, webhookAutomationRevisions.id))
    .innerJoin(workspaces, eq(webhookAutomations.workspaceId, workspaces.id))
    .where(and(eq(webhookAutomations.workspaceId, message.workspaceId), eq(webhookAutomations.state, "enabled"), eq(workspaces.plan, "pro"), isNull(webhookAutomationRevisions.retiredAt)));
  const matching = rows.filter((row) => matchesAutomationTrigger(row.revision.trigger, payload));
  let overflowedAutomationIds: string[] = [];
  const completed = await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${message.workspaceId}, 0))`);
    const ownership = await transaction.update(webhookMessages).set({ leasedUntil: new Date(now.getTime() + 30_000) })
      .where(and(eq(webhookMessages.id, message.id), eq(webhookMessages.leaseToken, leaseToken), eq(webhookMessages.fanoutStatus, "pending")))
      .returning({ id: webhookMessages.id });
    if (!ownership.length) return false;
    const queue = await getQueueState(transaction, message.workspaceId);
    const available = Math.max(0, AUTOMATION_LIMITS.maxPendingDeliveriesPerWorkspace - queue.pendingDeliveries);
    const pendingByAutomation = matching.length ? await transaction.select({
      automationId: webhookDeliveries.automationId,
      count: sql<number>`count(*)::int`,
    }).from(webhookDeliveries).where(and(
      inArray(webhookDeliveries.automationId, matching.map(({ automation }) => automation.id)),
      eq(webhookDeliveries.status, "pending"),
    )).groupBy(webhookDeliveries.automationId) : [];
    const pendingCounts = new Map(pendingByAutomation.map((row) => [row.automationId, row.count]));
    const withinAutomationLimit = matching.filter(({ automation }) => (pendingCounts.get(automation.id) ?? 0) < AUTOMATION_LIMITS.maxPendingDeliveriesPerAutomation);
    const accepted = withinAutomationLimit.slice(0, available);
    const acceptedIds = new Set(accepted.map(({ automation }) => automation.id));
    overflowedAutomationIds = matching.filter(({ automation }) => !acceptedIds.has(automation.id)).map(({ automation }) => automation.id);
    let insertedCount = 0;
    if (accepted.length) {
      const inserted = await transaction.insert(webhookDeliveries).values(accepted.map((row) => ({
        workspaceId: message.workspaceId,
        automationId: row.automation.id,
        revisionId: row.revision.id,
        messageId: message.id,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      }))).onConflictDoNothing().returning({ id: webhookDeliveries.id });
      insertedCount = inserted.length;
    }
    await transaction.update(webhookMessages).set({
      fanoutStatus: overflowedAutomationIds.length ? "cancelled" : "complete",
      completedAt: now,
      leaseToken: null,
      leasedUntil: null,
    }).where(and(eq(webhookMessages.id, message.id), eq(webhookMessages.leaseToken, leaseToken)));
    await incrementQueue(transaction, message.workspaceId, -1, insertedCount, now);
    return true;
  });
  if (!completed) return true;
  if (overflowedAutomationIds.length) {
    await database.update(webhookAutomations).set({ state: "needs_attention", stateReason: "queue_limit", updatedAt: now })
      .where(and(inArray(webhookAutomations.id, overflowedAutomationIds), eq(webhookAutomations.state, "enabled")));
  }
  return true;
}

async function pruneAutomationActivity(database: Database, now: Date) {
  const payloadCutoff = new Date(now.getTime() - AUTOMATION_LIMITS.payloadRetentionDays * 86_400_000);
  const activityCutoff = new Date(now.getTime() - AUTOMATION_LIMITS.activityRetentionDays * 86_400_000);
  const usageCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const redacted = await database.execute(sql`
    with expired as (
      select message.id
      from webhook_messages message
      where message.created_at < ${payloadCutoff.toISOString()}::timestamptz
        and message.payload_text is not null
        and message.fanout_status <> 'pending'
        and not exists (
          select 1 from webhook_deliveries delivery
          where delivery.message_id = message.id and delivery.status = 'pending'
        )
      order by message.created_at
      limit 250
    )
    update webhook_messages message
    set payload = null, payload_text = null, payload_redacted_at = ${now.toISOString()}::timestamptz
    from expired
    where message.id = expired.id
    returning message.id
  `);
  const deleted = await database.execute(sql`
    delete from webhook_messages
    where id in (
      select message.id
      from webhook_messages message
      where message.created_at < ${activityCutoff.toISOString()}::timestamptz
        and message.fanout_status <> 'pending'
        and not exists (
          select 1 from webhook_deliveries delivery
          where delivery.message_id = message.id and delivery.status = 'pending'
        )
      order by message.created_at
      limit 250
    )
    returning id
  `);
  const deletedRevisions = await database.execute(sql`
    delete from webhook_automation_revisions revision
    where revision.id in (
      select candidate.id
      from webhook_automation_revisions candidate
      where candidate.retired_at < ${activityCutoff.toISOString()}::timestamptz
        and not exists (
          select 1 from webhook_automations automation
          where automation.current_revision_id = candidate.id
        )
        and not exists (
          select 1 from webhook_deliveries delivery
          where delivery.revision_id = candidate.id
        )
      order by candidate.retired_at
      limit 250
    )
    returning revision.id
  `);
  const deletedUsage = await database.execute(sql`
    delete from webhook_usage_monthly usage
    where (usage.workspace_id, usage.month) in (
      select candidate.workspace_id, candidate.month
      from webhook_usage_monthly candidate
      where candidate.month < ${monthStart(usageCutoff)}::date
      order by candidate.month
      limit 250
    )
    returning usage.workspace_id
  `);
  return redacted.length > 0 || deleted.length > 0 || deletedRevisions.length > 0 || deletedUsage.length > 0;
}

async function deliverOne(database: Database, options: AutomationServiceOptions & { now: () => Date }) {
  const startedAt = options.now();
  const month = monthStart(startedAt);
  const [candidate] = await database.select({
    delivery: webhookDeliveries,
    message: webhookMessages,
    automation: webhookAutomations,
    revision: webhookAutomationRevisions,
    plan: workspaces.plan,
  }).from(webhookDeliveries)
    .innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
    .innerJoin(webhookAutomations, eq(webhookDeliveries.automationId, webhookAutomations.id))
    .innerJoin(webhookAutomationRevisions, eq(webhookDeliveries.revisionId, webhookAutomationRevisions.id))
    .innerJoin(workspaces, eq(webhookDeliveries.workspaceId, workspaces.id))
    .where(and(
      eq(webhookDeliveries.status, "pending"),
      lt(webhookDeliveries.nextAttemptAt, new Date(startedAt.getTime() + 1)),
      or(isNull(webhookDeliveries.leasedUntil), lt(webhookDeliveries.leasedUntil, startedAt)),
    )).orderBy(asc(webhookDeliveries.nextAttemptAt)).limit(1);
  if (!candidate) return false;

  if (candidate.plan !== "pro") {
    await database.update(webhookAutomations).set({ state: "paused", stateReason: "plan_changed", updatedAt: startedAt })
      .where(and(eq(webhookAutomations.workspaceId, candidate.delivery.workspaceId), eq(webhookAutomations.state, "enabled")));
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "plan_changed", startedAt);
    return true;
  }
  if ((candidate.automation.state !== "enabled" && candidate.message.kind !== "test") || candidate.revision.retiredAt) {
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "configuration_inactive", startedAt);
    return true;
  }
  if (!candidate.message.payloadText) {
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "payload_expired", startedAt);
    return true;
  }
  let endpoint: string;
  let secret: string;
  try {
    endpoint = decryptField(candidate, options.encryptionKey, "endpoint");
    secret = decryptField(candidate, options.encryptionKey, "secret");
  } catch {
    await failConfigurationDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, candidate.automation.id, startedAt);
    return true;
  }
  const leaseToken = randomUUID();
  const claim = await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${candidate.delivery.workspaceId}, 0))`);
    const [eligibility] = await transaction.select({
      state: webhookAutomations.state,
      currentRevisionId: webhookAutomations.currentRevisionId,
      plan: workspaces.plan,
      retiredAt: webhookAutomationRevisions.retiredAt,
    }).from(webhookAutomations)
      .innerJoin(workspaces, eq(webhookAutomations.workspaceId, workspaces.id))
      .innerJoin(webhookAutomationRevisions, eq(webhookAutomationRevisions.id, candidate.delivery.revisionId))
      .where(and(
        eq(webhookAutomations.id, candidate.delivery.automationId),
        eq(webhookAutomations.workspaceId, candidate.delivery.workspaceId),
      )).limit(1)
      .for("update");
    if (!eligibility || eligibility.plan !== "pro") return "plan_changed" as const;
    if (eligibility.currentRevisionId !== candidate.delivery.revisionId || eligibility.retiredAt || (candidate.message.kind === "live" && eligibility.state !== "enabled")) {
      return "inactive" as const;
    }
    const [usage] = await transaction.select({ attempts: webhookUsageMonthly.deliveryAttempts }).from(webhookUsageMonthly)
      .where(and(eq(webhookUsageMonthly.workspaceId, candidate.delivery.workspaceId), eq(webhookUsageMonthly.month, month))).limit(1);
    if ((usage?.attempts ?? 0) >= AUTOMATION_LIMITS.monthlyDeliveryAttempts) return "limit" as const;
    const leased = await transaction.update(webhookDeliveries).set({ leaseToken, leasedUntil: new Date(startedAt.getTime() + 30_000), updatedAt: startedAt })
      .where(and(eq(webhookDeliveries.id, candidate.delivery.id), eq(webhookDeliveries.status, "pending"), or(isNull(webhookDeliveries.leasedUntil), lt(webhookDeliveries.leasedUntil, startedAt))))
      .returning({ id: webhookDeliveries.id });
    if (!leased.length) return "busy" as const;
    await transaction.insert(webhookUsageMonthly).values({
      workspaceId: candidate.delivery.workspaceId,
      month,
      deliveryAttempts: 1,
      updatedAt: startedAt,
    }).onConflictDoUpdate({
      target: [webhookUsageMonthly.workspaceId, webhookUsageMonthly.month],
      set: { deliveryAttempts: sql`${webhookUsageMonthly.deliveryAttempts} + 1`, updatedAt: startedAt },
    });
    return "leased" as const;
  });
  if (claim === "plan_changed") {
    await database.update(webhookAutomations).set({ state: "paused", stateReason: "plan_changed", updatedAt: startedAt })
      .where(and(eq(webhookAutomations.workspaceId, candidate.delivery.workspaceId), eq(webhookAutomations.state, "enabled")));
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "plan_changed", startedAt);
    return true;
  }
  if (claim === "inactive") {
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "configuration_inactive", startedAt);
    return true;
  }
  if (claim === "limit") {
    await database.update(webhookAutomations).set({ state: "needs_attention", stateReason: "usage_limit", updatedAt: startedAt })
      .where(eq(webhookAutomations.id, candidate.automation.id));
    await cancelDelivery(database, candidate.delivery.id, candidate.delivery.workspaceId, "usage_limit", startedAt);
    return true;
  }
  if (claim === "busy") return true;
  const attemptCount = candidate.delivery.attemptCount + 1;
  const timestamp = Math.floor(startedAt.getTime() / 1000);
  const signature = createWebhookSignature({ id: candidate.delivery.id, timestamp, body: candidate.message.payloadText, secret });
  let responseStatus: number | null = null;
  let errorCode: string | null = null;
  let retryable = true;
  try {
    const response = await sendSafeWebhook({
      url: endpoint,
      body: candidate.message.payloadText,
      allowLocal: options.allowLocalDestinations,
      headers: {
        "webhook-id": candidate.delivery.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": signature,
        "idempotency-key": candidate.delivery.id,
        "x-handout-event": candidate.message.eventType,
        "x-handout-automation-id": candidate.automation.id,
        "x-handout-attempt": String(attemptCount),
      },
    });
    responseStatus = response.status;
    if (response.status < 200 || response.status >= 300) {
      errorCode = `http_${response.status}`;
      retryable = response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500;
    }
  } catch (error) {
    errorCode = error instanceof UnsafeAutomationDestinationError ? error.code : "network_error";
    retryable = !(error instanceof UnsafeAutomationDestinationError);
  }
  const completedAt = options.now();
  const success = errorCode === null;
  const retryAt = success || !retryable ? null : getAutomationRetryAt(attemptCount, completedAt);
  const terminal = success || retryAt === null;
  let failureCountAfterAttempt = candidate.automation.consecutiveFailureCount + (success ? 0 : 1);
  const applied = await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${candidate.delivery.workspaceId}, 0))`);
    const updatedDeliveries = await transaction.update(webhookDeliveries).set({
      status: success ? "succeeded" : terminal ? "failed" : "pending",
      attemptCount,
      responseStatus,
      errorCode,
      lastAttemptAt: completedAt,
      nextAttemptAt: retryAt ?? completedAt,
      completedAt: terminal ? completedAt : null,
      leasedUntil: null,
      leaseToken: null,
      updatedAt: completedAt,
    }).where(and(eq(webhookDeliveries.id, candidate.delivery.id), eq(webhookDeliveries.leaseToken, leaseToken)))
      .returning({ id: webhookDeliveries.id });
    if (!updatedDeliveries.length) return false;
    await transaction.insert(webhookUsageMonthly).values({
      workspaceId: candidate.delivery.workspaceId,
      month,
      deliveryAttempts: 0,
      succeededDeliveries: success ? 1 : 0,
      failedDeliveries: !success && terminal ? 1 : 0,
      updatedAt: completedAt,
    }).onConflictDoUpdate({
      target: [webhookUsageMonthly.workspaceId, webhookUsageMonthly.month],
      set: {
        succeededDeliveries: sql`${webhookUsageMonthly.succeededDeliveries} + ${success ? 1 : 0}`,
        failedDeliveries: sql`${webhookUsageMonthly.failedDeliveries} + ${!success && terminal ? 1 : 0}`,
        updatedAt: completedAt,
      },
    });
    if (terminal) await incrementQueue(transaction, candidate.delivery.workspaceId, 0, -1, completedAt);
    const [automationState] = await transaction.update(webhookAutomations).set({
      lastDeliveryAt: completedAt,
      lastDeliveryStatus: success ? "succeeded" : terminal ? "failed" : "pending",
      consecutiveFailureCount: success ? 0 : sql`${webhookAutomations.consecutiveFailureCount} + 1`,
    }).where(eq(webhookAutomations.id, candidate.automation.id))
      .returning({ consecutiveFailureCount: webhookAutomations.consecutiveFailureCount });
    failureCountAfterAttempt = automationState?.consecutiveFailureCount ?? failureCountAfterAttempt;
    return true;
  });
  if (!applied) return true;
  const configurationFailure = errorCode === "destination_unsafe" || ["http_401", "http_403", "http_404"].includes(errorCode ?? "");
  if (!success && (errorCode === "destination_unsafe" || failureCountAfterAttempt >= (configurationFailure ? 3 : 10))) {
    await database.update(webhookAutomations).set({ state: "needs_attention", stateReason: "delivery_failures", updatedAt: completedAt })
      .where(and(eq(webhookAutomations.id, candidate.automation.id), eq(webhookAutomations.state, "enabled")));
  }
  return true;
}

function parseDestination(value: string, allowLocal = false) {
  try { return parseAutomationDestination(value, { allowLocal }); }
  catch (error) {
    if (error instanceof UnsafeAutomationDestinationError) throw new AutomationServiceError("invalid_destination", error.message);
    throw error;
  }
}

function requireAdmin(workspace: AutomationWorkspaceContext) {
  if (workspace.role !== "admin") throw new AutomationServiceError("admin_required", "Only workspace admins can manage automations.");
}

function requireAdminPro(workspace: AutomationWorkspaceContext) {
  requireAdmin(workspace);
  if (!canUseAutomations(workspace.plan)) throw new AutomationServiceError("upgrade_required", "Webhook automations are available on Pro.");
}

function notFound() { return new AutomationServiceError("not_found", "Automation not found."); }
function unavailable() { return new AutomationServiceError("unavailable", "Automations are temporarily unavailable."); }

function toAutomation(row: { automation: typeof webhookAutomations.$inferSelect; revision: typeof webhookAutomationRevisions.$inferSelect }): Automation {
  return {
    id: row.automation.id,
    currentRevisionId: row.revision.id,
    name: row.automation.name,
    state: row.automation.state,
    stateReason: row.automation.stateReason,
    endpointHost: row.automation.endpointHost,
    trigger: row.revision.trigger,
    lastDeliveryAt: row.automation.lastDeliveryAt?.toISOString() ?? null,
    lastDeliveryStatus: row.automation.lastDeliveryStatus,
    createdAt: row.automation.createdAt.toISOString(),
    updatedAt: row.automation.updatedAt.toISOString(),
  };
}

function toDelivery(row: { delivery: typeof webhookDeliveries.$inferSelect; message: typeof webhookMessages.$inferSelect }): AutomationDelivery {
  return {
    id: row.delivery.id,
    revisionId: row.delivery.revisionId,
    eventId: row.message.eventId,
    eventType: row.message.eventType as AutomationDelivery["eventType"],
    kind: row.message.kind,
    status: row.delivery.status,
    attemptCount: row.delivery.attemptCount,
    responseStatus: row.delivery.responseStatus,
    errorCode: row.delivery.errorCode,
    payloadRetained: row.message.payloadText !== null,
    nextAttemptAt: row.delivery.status === "pending" ? row.delivery.nextAttemptAt.toISOString() : null,
    createdAt: row.delivery.createdAt.toISOString(),
    completedAt: row.delivery.completedAt?.toISOString() ?? null,
  };
}

function decryptField(row: { automation: typeof webhookAutomations.$inferSelect; revision: typeof webhookAutomationRevisions.$inferSelect }, key: Buffer, field: "endpoint" | "secret") {
  const revision = row.revision;
  return decryptAutomationValue(field === "endpoint"
    ? { ciphertext: revision.endpointCiphertext, nonce: revision.endpointNonce }
    : { ciphertext: revision.signingSecretCiphertext, nonce: revision.signingSecretNonce },
  key, automationAssociatedData(row.automation.workspaceId, row.automation.id, revision.id, field));
}

async function validateTriggerSelections(database: Database, workspaceId: string, trigger: AutomationTrigger) {
  if (trigger.siteScope === "selected") {
    const rows = await database.select({ id: sites.id }).from(sites).where(and(eq(sites.workspaceId, workspaceId), inArray(sites.id, trigger.siteIds)));
    if (rows.length !== new Set(trigger.siteIds).size) throw new AutomationServiceError("not_found", "One or more selected sites no longer exist.");
  }
  if (trigger.recipientScope === "selected") {
    const rows = await database.select({ id: siteVariants.id }).from(siteVariants).where(and(eq(siteVariants.workspaceId, workspaceId), eq(siteVariants.status, "active"), inArray(siteVariants.id, trigger.recipientIds)));
    if (rows.length !== new Set(trigger.recipientIds).size) throw new AutomationServiceError("not_found", "One or more selected recipients no longer exist.");
  }
}

async function hasSuccessfulRevisionTest(database: Database, workspaceId: string, automationId: string, revisionId: string, since?: Date) {
  const [row] = await database.select({ id: webhookDeliveries.id }).from(webhookDeliveries)
    .innerJoin(webhookMessages, eq(webhookDeliveries.messageId, webhookMessages.id))
    .where(and(
      eq(webhookDeliveries.workspaceId, workspaceId),
      eq(webhookDeliveries.automationId, automationId),
      eq(webhookDeliveries.revisionId, revisionId),
      eq(webhookMessages.kind, "test"),
      eq(webhookDeliveries.status, "succeeded"),
      since ? gt(webhookDeliveries.createdAt, since) : undefined,
    )).limit(1);
  return Boolean(row);
}

function requiresFreshTest(reason: typeof webhookAutomations.$inferSelect.stateReason) {
  return reason === "plan_changed" || reason === "delivery_failures" || reason === "queue_limit";
}

export function matchesAutomationTrigger(trigger: WebhookAutomationTrigger, payload: WebhookPayloadSnapshot) {
  const data = payload as { event?: { type?: string }; site?: { id?: string }; recipient?: { id?: string } | null };
  const eventType = data.event?.type ?? "";
  if (!trigger.eventTypes.includes(eventType as never)) return false;
  const siteId = data?.site?.id;
  if (trigger.siteScope === "selected" && (!siteId || !trigger.siteIds.includes(siteId))) return false;
  const recipientId = data?.recipient?.id ?? null;
  if (trigger.recipientScope === "named" && !recipientId) return false;
  if (trigger.recipientScope === "unnamed" && recipientId) return false;
  if (trigger.recipientScope === "selected" && (!recipientId || !trigger.recipientIds.includes(recipientId))) return false;
  return true;
}

export function areAutomationTriggersEqual(left: AutomationTrigger, right: WebhookAutomationTrigger) {
  return left.siteScope === right.siteScope &&
    left.recipientScope === right.recipientScope &&
    sameStringSet(left.eventTypes, right.eventTypes) &&
    sameStringSet(left.siteIds, right.siteIds) &&
    sameStringSet(left.recipientIds, right.recipientIds);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function serializePayload(payload: WebhookPayloadSnapshot) {
  return JSON.stringify(payload);
}

function createTestPayload(eventId: string, workspaceId: string, eventType: AutomationTrigger["eventTypes"][number], createdAt: Date): WebhookPayloadSnapshot {
  const isClick = eventType === "button_click" || eventType === "link_click";
  return {
    schema_version: 1,
    test: true,
    event: { id: eventId, type: eventType, occurred_at: createdAt.toISOString() },
    workspace: { id: workspaceId, name: "Example workspace" },
    site: { id: "00000000-0000-4000-8000-000000000001", name: "Example site", slug: "example-site" },
    recipient: { id: "00000000-0000-4000-8000-000000000002", name: "Jamie", company: "Example Company" },
    session: {
      id: "session_example",
      started_at: createdAt.toISOString(),
      device: { type: "desktop", os: "macOS", browser: "Chrome" },
      location: { city: "New York", region: "New York", country_code: "US" },
    },
    page: { id: "overview", label: "Overview", previous_id: eventType === "tab_switch" ? "introduction" : null, previous_label: eventType === "tab_switch" ? "Introduction" : null },
    element: isClick ? {
      id: "example-action",
      label: eventType === "button_click" ? "Book a call" : "Company website",
      kind: eventType === "button_click" ? "button" : "link",
      destination: { kind: "url", host: "example.com" },
    } : null,
  };
}

function monthStart(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`; }
function nextMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)); }

async function getQueueState(database: Pick<Database, "select">, workspaceId: string) {
  const [row] = await database.select().from(webhookWorkspaceQueueState).where(eq(webhookWorkspaceQueueState.workspaceId, workspaceId)).limit(1);
  return row ?? { pendingMessages: 0, pendingDeliveries: 0 };
}

async function assertCurrentRevision(database: Pick<Database, "select">, workspaceId: string, automationId: string, expectedRevisionId: string) {
  const [row] = await database.select({ currentRevisionId: webhookAutomations.currentRevisionId }).from(webhookAutomations)
    .where(and(eq(webhookAutomations.workspaceId, workspaceId), eq(webhookAutomations.id, automationId))).limit(1);
  if (!row) throw notFound();
  if (row.currentRevisionId !== expectedRevisionId) {
    throw new AutomationServiceError("unavailable", "This automation changed while the request was running. Refresh and try again.");
  }
}

async function getUsage(database: Database, workspaceId: string, date: Date) {
  const [usage, queue] = await Promise.all([
    database.select().from(webhookUsageMonthly).where(and(eq(webhookUsageMonthly.workspaceId, workspaceId), eq(webhookUsageMonthly.month, monthStart(date)))).limit(1),
    getQueueState(database, workspaceId),
  ]);
  return { attempts: usage[0]?.deliveryAttempts ?? 0, limit: AUTOMATION_LIMITS.monthlyDeliveryAttempts, resetsAt: nextMonth(date).toISOString(), pendingMessages: queue.pendingMessages, pendingDeliveries: queue.pendingDeliveries };
}

async function incrementQueue(database: Pick<Database, "insert">, workspaceId: string, messages: number, deliveries: number, date: Date) {
  await database.insert(webhookWorkspaceQueueState).values({ workspaceId, pendingMessages: Math.max(0, messages), pendingDeliveries: Math.max(0, deliveries), updatedAt: date })
    .onConflictDoUpdate({ target: webhookWorkspaceQueueState.workspaceId, set: {
      pendingMessages: sql`greatest(0, ${webhookWorkspaceQueueState.pendingMessages} + ${messages})`,
      pendingDeliveries: sql`greatest(0, ${webhookWorkspaceQueueState.pendingDeliveries} + ${deliveries})`,
      updatedAt: date,
    } });
}

async function cancelDelivery(database: Database, deliveryId: string, workspaceId: string, errorCode: string, date: Date) {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`);
    const updated = await transaction.update(webhookDeliveries).set({ status: "cancelled", errorCode, completedAt: date, leasedUntil: null, leaseToken: null, updatedAt: date })
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.status, "pending"))).returning({ id: webhookDeliveries.id });
    if (updated.length) await incrementQueue(transaction, workspaceId, 0, -1, date);
  });
}

async function failConfigurationDelivery(database: Database, deliveryId: string, workspaceId: string, automationId: string, date: Date) {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`);
    const updated = await transaction.update(webhookDeliveries).set({
      status: "failed",
      errorCode: "configuration_error",
      completedAt: date,
      leasedUntil: null,
      leaseToken: null,
      updatedAt: date,
    }).where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.status, "pending")))
      .returning({ id: webhookDeliveries.id });
    if (!updated.length) return;
    await incrementQueue(transaction, workspaceId, 0, -1, date);
    await transaction.update(webhookAutomations).set({
      state: "needs_attention",
      stateReason: "delivery_failures",
      lastDeliveryAt: date,
      lastDeliveryStatus: "failed",
      updatedAt: date,
    }).where(and(eq(webhookAutomations.id, automationId), eq(webhookAutomations.state, "enabled")));
  });
}
