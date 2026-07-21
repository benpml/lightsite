import { z } from "zod";
import { AUTOMATION_LIMITS, AUTOMATION_TRIGGER_EVENT_TYPES } from "@handout/domain";

export const automationStateSchema = z.enum(["draft", "enabled", "paused", "needs_attention"]);
export const automationStateReasonSchema = z.enum([
  "user",
  "plan_changed",
  "delivery_failures",
  "usage_limit",
  "queue_limit",
]);
export const automationSiteScopeSchema = z.enum(["all", "selected"]);
export const automationRecipientScopeSchema = z.enum(["anyone", "named", "unnamed", "selected"]);
export const automationEventTypeSchema = z.enum(AUTOMATION_TRIGGER_EVENT_TYPES);
export const automationDeliveryStatusSchema = z.enum(["pending", "succeeded", "failed", "cancelled"]);

export const automationTriggerSchema = z.object({
  eventTypes: z.array(automationEventTypeSchema).min(1).max(AUTOMATION_TRIGGER_EVENT_TYPES.length),
  siteScope: automationSiteScopeSchema,
  siteIds: z.array(z.uuid()).max(AUTOMATION_LIMITS.maxSelectedSites).default([]),
  recipientScope: automationRecipientScopeSchema,
  recipientIds: z.array(z.uuid()).max(AUTOMATION_LIMITS.maxSelectedRecipients).default([]),
}).superRefine((value, context) => {
  if (new Set(value.eventTypes).size !== value.eventTypes.length) {
    context.addIssue({ code: "custom", path: ["eventTypes"], message: "Choose each event only once." });
  }
  if (new Set(value.siteIds).size !== value.siteIds.length) {
    context.addIssue({ code: "custom", path: ["siteIds"], message: "Choose each site only once." });
  }
  if (new Set(value.recipientIds).size !== value.recipientIds.length) {
    context.addIssue({ code: "custom", path: ["recipientIds"], message: "Choose each recipient only once." });
  }
  if (value.siteScope === "selected" && value.siteIds.length === 0) {
    context.addIssue({ code: "custom", path: ["siteIds"], message: "Choose at least one site." });
  }
  if (value.recipientScope === "selected" && value.recipientIds.length === 0) {
    context.addIssue({ code: "custom", path: ["recipientIds"], message: "Choose at least one recipient." });
  }
}).transform((value) => ({
  ...value,
  siteIds: value.siteScope === "selected" ? value.siteIds : [],
  recipientIds: value.recipientScope === "selected" ? value.recipientIds : [],
}));

export const createAutomationRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  endpointUrl: z.url().max(2_048),
  trigger: automationTriggerSchema,
});

export const updateAutomationRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  endpointUrl: z.url().max(2_048).optional(),
  trigger: automationTriggerSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one change is required.");

export const automationResponseSchema = z.object({
  id: z.uuid(),
  currentRevisionId: z.uuid(),
  name: z.string(),
  state: automationStateSchema,
  stateReason: automationStateReasonSchema.nullable(),
  endpointHost: z.string(),
  trigger: automationTriggerSchema,
  lastDeliveryAt: z.iso.datetime().nullable(),
  lastDeliveryStatus: automationDeliveryStatusSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const automationUsageSchema = z.object({
  attempts: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  resetsAt: z.iso.datetime(),
  pendingMessages: z.number().int().nonnegative(),
  pendingDeliveries: z.number().int().nonnegative(),
});

export const automationListResponseSchema = z.object({
  plan: z.enum(["free", "core", "pro"]),
  role: z.enum(["admin", "user"]),
  automations: z.array(automationResponseSchema),
  usage: automationUsageSchema,
});

export const automationDetailResponseSchema = z.object({
  automation: automationResponseSchema,
  hasSuccessfulTest: z.boolean(),
  signingSecret: z.string().optional(),
});

export const automationOptionSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  secondaryLabel: z.string().nullable(),
});

export const automationOptionsResponseSchema = z.object({
  sites: z.array(automationOptionSchema),
  recipients: z.array(automationOptionSchema.extend({ siteId: z.uuid() })),
});

export const automationDeliverySchema = z.object({
  id: z.uuid(),
  revisionId: z.uuid(),
  eventId: z.string(),
  eventType: automationEventTypeSchema,
  kind: z.enum(["live", "test"]),
  status: automationDeliveryStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  responseStatus: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  payloadRetained: z.boolean(),
  nextAttemptAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const automationActivityResponseSchema = z.object({
  deliveries: z.array(automationDeliverySchema),
  nextCursor: z.string().nullable(),
});

export const automationDeliveryDataResponseSchema = z.object({
  payload: z.string().max(AUTOMATION_LIMITS.maxPayloadBytes).nullable(),
});

export const automationActionResponseSchema = z.object({ automation: automationResponseSchema });
export const automationTestResponseSchema = z.object({ deliveryId: z.uuid() });
export const automationSecretResponseSchema = z.object({ signingSecret: z.string() });

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type Automation = z.infer<typeof automationResponseSchema>;
export type AutomationListResponse = z.infer<typeof automationListResponseSchema>;
export type AutomationDetailResponse = z.infer<typeof automationDetailResponseSchema>;
export type AutomationOptionsResponse = z.infer<typeof automationOptionsResponseSchema>;
export type AutomationActivityResponse = z.infer<typeof automationActivityResponseSchema>;
export type AutomationDelivery = z.infer<typeof automationDeliverySchema>;
export type AutomationDeliveryDataResponse = z.infer<typeof automationDeliveryDataResponseSchema>;
export type CreateAutomationRequest = z.infer<typeof createAutomationRequestSchema>;
export type UpdateAutomationRequest = z.infer<typeof updateAutomationRequestSchema>;
