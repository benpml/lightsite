import type { LightsiteVariableOption } from "./schema"

export const editorVariables: LightsiteVariableOption[] = [
  {
    id: "recipient-name",
    name: "Name",
    slug: "name",
    description: "The first name of the person receiving this page.",
    defaultValue: "you",
  },
  {
    id: "recipient-company",
    name: "Company",
    slug: "company",
    description: "The company receiving this page.",
    defaultValue: "your company",
  },
  {
    id: "recipient_website",
    name: "Website",
    slug: "website",
    description: "The recipient company's website, used to derive their logo when available.",
  },
  {
    id: "var-pain-point",
    name: "Pain point",
    slug: "pain-point",
    description: "The main business problem this page should speak to.",
    defaultValue: "manual follow-up",
  },
  {
    id: "var-company-logo",
    name: "Company logo",
    slug: "company-logo",
    description: "A logo image URL for the prospect company.",
  },
  {
    id: "var-booking-url",
    name: "Booking URL",
    slug: "booking-url",
    description: "The link prospects should use to book a meeting.",
    defaultValue: "https://example.com/book",
  },
]

export const editorVariableValues = {
  default: {
    "recipient-name": "you",
    "recipient-company": "your company",
    "var-pain-point": "manual follow-up",
    recipient_website: "linear.app",
    "var-booking-url": "https://example.com/book",
  },
}
