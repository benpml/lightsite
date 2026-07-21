import type { AutomationTriggerEventType } from "@handout/domain"

export const automationEventOptions: Array<{ value: AutomationTriggerEventType; label: string; description: string }> = [
  { value: "site_visit", label: "Someone visits", description: "Send once when a new visit starts." },
  { value: "button_click", label: "Someone clicks a button", description: "Includes the button label and safe destination details." },
  { value: "link_click", label: "Someone clicks a link", description: "Includes the link label and destination host." },
  { value: "tab_switch", label: "Someone changes page", description: "Includes the page they opened." },
]
