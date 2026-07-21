export const AUTOMATION_LIMITS = {
  maxEnabledPerWorkspace: 20,
  maxTotalPerWorkspace: 50,
  maxSelectedSites: 100,
  maxSelectedRecipients: 500,
  maxPayloadBytes: 16 * 1024,
  maxPendingMessagesPerWorkspace: 10_000,
  maxPendingDeliveriesPerWorkspace: 10_000,
  maxPendingDeliveriesPerAutomation: 2_000,
  monthlyDeliveryAttempts: 100_000,
  maxTestsPerAutomationPerHour: 10,
  maxTestsPerWorkspacePerHour: 50,
  payloadRetentionDays: 7,
  activityRetentionDays: 30,
  maxAutomaticAttempts: 7,
  maxManualRetries: 3,
  maxAttempts: 10,
  requestTimeoutMs: 5_000,
  connectTimeoutMs: 2_000,
} as const;

export const AUTOMATION_RETRY_DELAYS_MS = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 8 * 60 * 60_000, 24 * 60 * 60_000] as const;
export const AUTOMATION_WORKER_CONCURRENCY = 4;

export const AUTOMATION_TRIGGER_EVENT_TYPES = [
  "site_visit",
  "button_click",
  "link_click",
  "tab_switch",
] as const;

export type AutomationTriggerEventType = typeof AUTOMATION_TRIGGER_EVENT_TYPES[number];

export function isAutomationTriggerEventType(value: string): value is AutomationTriggerEventType {
  return (AUTOMATION_TRIGGER_EVENT_TYPES as readonly string[]).includes(value);
}

export function canUseAutomations(plan: "free" | "core" | "pro") {
  return plan === "pro";
}

export function getAutomationRetryAt(attemptNumber: number, now = new Date()) {
  if (attemptNumber >= AUTOMATION_LIMITS.maxAutomaticAttempts) return null;
  const delay = AUTOMATION_RETRY_DELAYS_MS[attemptNumber] ?? null;
  return delay === null ? null : new Date(now.getTime() + delay);
}
