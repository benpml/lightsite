import type { HandoutVariableOption } from "./schema"

export const editorVariables: HandoutVariableOption[] = [
  {
    id: "recipient-name",
    name: "Name",
    slug: "name",
    description: "Recipient first name",
    defaultValue: "you",
  },
  {
    id: "recipient-company",
    name: "Company",
    slug: "company",
    description: "Recipient company name",
    defaultValue: "your company",
  },
  {
    id: "recipient_website",
    name: "Website",
    slug: "website",
    description: "Recipient company website domain",
  },
]

export const editorVariableValues = {
  default: {
    "recipient-name": "you",
    "recipient-company": "your company",
    recipient_website: "",
  },
}
