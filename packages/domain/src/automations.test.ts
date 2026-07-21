import { describe, expect, it } from "vitest";
import { AUTOMATION_RETRY_DELAYS_MS, canUseAutomations, getAutomationRetryAt, isAutomationTriggerEventType } from "./automations";

describe("automation policy", () => {
  it("only entitles Pro workspaces", () => {
    expect(canUseAutomations("free")).toBe(false);
    expect(canUseAutomations("core")).toBe(false);
    expect(canUseAutomations("pro")).toBe(true);
  });

  it("uses a bounded retry schedule", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(AUTOMATION_RETRY_DELAYS_MS).toHaveLength(7);
    expect(getAutomationRetryAt(1, now)?.toISOString()).toBe("2026-07-21T12:01:00.000Z");
    expect(getAutomationRetryAt(6, now)?.toISOString()).toBe("2026-07-22T12:00:00.000Z");
    expect(getAutomationRetryAt(7, now)).toBeNull();
  });

  it("does not treat server-side webhook audit events as triggers", () => {
    expect(isAutomationTriggerEventType("site_visit")).toBe(true);
    expect(isAutomationTriggerEventType("webhook_send")).toBe(false);
    expect(isAutomationTriggerEventType("slack_share")).toBe(false);
  });
});
