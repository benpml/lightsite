import { describe, expect, it } from "vitest";
import { createAutomationRequestSchema } from "./automations";

describe("automation contracts", () => {
  const valid = {
    name: "Notify CRM",
    endpointUrl: "https://hooks.example.com/handout",
    trigger: { eventTypes: ["site_visit"], siteScope: "all", siteIds: [], recipientScope: "anyone", recipientIds: [] },
  };

  it("accepts the simple all-sites rule", () => {
    expect(createAutomationRequestSchema.parse(valid).name).toBe("Notify CRM");
  });

  it("requires selections when a selected scope is used", () => {
    const result = createAutomationRequestSchema.safeParse({ ...valid, trigger: { ...valid.trigger, siteScope: "selected" } });
    expect(result.success).toBe(false);
  });

  it("bounds event types to the supported tracking registry", () => {
    const result = createAutomationRequestSchema.safeParse({ ...valid, trigger: { ...valid.trigger, eventTypes: ["webhook_send"] } });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate choices and removes IDs that do not apply to the selected scope", () => {
    const duplicate = createAutomationRequestSchema.safeParse({ ...valid, trigger: { ...valid.trigger, eventTypes: ["site_visit", "site_visit"] } });
    expect(duplicate.success).toBe(false);

    const parsed = createAutomationRequestSchema.parse({
      ...valid,
      trigger: {
        ...valid.trigger,
        siteIds: ["11111111-1111-4111-8111-111111111111"],
        recipientIds: ["22222222-2222-4222-8222-222222222222"],
      },
    });
    expect(parsed.trigger.siteIds).toEqual([]);
    expect(parsed.trigger.recipientIds).toEqual([]);
  });
});
