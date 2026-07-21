import { describe, expect, it } from "vitest";
import type { WebhookAutomationTrigger, WebhookPayloadSnapshot } from "@handout/db";
import { areAutomationTriggersEqual, matchesAutomationTrigger } from "./service";

const trigger: WebhookAutomationTrigger = {
  eventTypes: ["button_click"],
  siteScope: "selected",
  siteIds: ["11111111-1111-4111-8111-111111111111"],
  recipientScope: "selected",
  recipientIds: ["22222222-2222-4222-8222-222222222222"],
};

const payload: WebhookPayloadSnapshot = {
  schema_version: 1,
  event: { id: "event-1", type: "button_click", occurred_at: "2026-07-21T12:00:00.000Z" },
  site: { id: "11111111-1111-4111-8111-111111111111" },
  recipient: { id: "22222222-2222-4222-8222-222222222222" },
};

describe("automation matching", () => {
  it("matches the allowlisted event and selected site and recipient", () => {
    expect(matchesAutomationTrigger(trigger, payload)).toBe(true);
    expect(matchesAutomationTrigger(trigger, { ...payload, event: { type: "link_click" } })).toBe(false);
    expect(matchesAutomationTrigger(trigger, { ...payload, recipient: null })).toBe(false);
  });

  it("compares trigger sets without depending on JSON object or array order", () => {
    expect(areAutomationTriggersEqual(
      { ...trigger, eventTypes: ["button_click", "site_visit"], siteIds: [...trigger.siteIds, "33333333-3333-4333-8333-333333333333"] },
      { ...trigger, eventTypes: ["site_visit", "button_click"], siteIds: ["33333333-3333-4333-8333-333333333333", ...trigger.siteIds] },
    )).toBe(true);
  });
});
