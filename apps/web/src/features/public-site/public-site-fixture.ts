import {
  createDefaultSiteContent,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
} from "@lightsite/site-document"

const variants = {
  acme: {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "mira",
    name: "Mira at Acme",
    recipientName: "Mira Singh",
    recipientCompany: "Acme",
    revisionNumber: 1,
    variableValues: {
      company_name: "Acme",
      recipient_website: "acme.com",
    },
  },
  northstar: {
    id: "55555555-5555-4555-8555-555555555555",
    slug: "noah",
    name: "Noah at Northstar",
    recipientName: "Noah Rivera",
    recipientCompany: "Northstar",
    revisionNumber: 1,
    variableValues: {
      company_name: "Northstar",
      recipient_website: "northstar.example",
    },
  },
} as const

export function getDemoPublishedSite(variant: keyof typeof variants | "default" = "default"): PublishedSitePayload {
  const content = createDefaultSiteContent("Rollout brief")
  content.themeMode = "dark"
  content.variables.push({
    id: "company_name",
    key: "company_name",
    label: "Company name",
    type: "text",
    defaultValue: "Your company",
  })
  content.pages[0]!.document = {
    type: "doc",
    content: [
      {
        type: "pageTitleSection",
        attrs: { id: "hero", align: "center" },
        content: [
          {
            type: "pageTitleTitle",
            content: [
              { type: "text", text: "A rollout brief for " },
              { type: "variableToken", attrs: { variableId: "company_name", fallbackName: "Company" } },
            ],
          },
          {
            type: "pageTitleSubtitle",
            content: [{ type: "text", text: "A focused plan for the buying committee." }],
          },
        ],
      },
      {
        type: "heading",
        attrs: { id: "why-now", level: 2 },
        content: [{ type: "text", text: "Why this matters now" }],
      },
      {
        type: "paragraph",
        attrs: { id: "overview" },
        content: [
          { type: "text", text: "Keep the " },
          { type: "text", text: "full Tiptap document", marks: [{ type: "bold" }] },
          { type: "text", text: " intact from editor to publish." },
        ],
      },
      {
        type: "buttonBlock",
        attrs: { id: "book-call", href: "https://example.com/book", fullWidth: false },
        content: [{ type: "text", text: "Book a call" }],
      },
    ],
  }

  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "acme",
      name: "Acme",
      websiteDomain: "acme.com",
      logoUrl: null,
    },
    site: {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "rollout-brief",
      name: "Rollout brief",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      publishedAt: "2026-07-09T12:00:00.000Z",
    },
    metadata: {
      title: "Rollout brief",
      description: "A focused plan for the buying committee.",
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: variant === "default" ? null : variants[variant],
    tracking: {
      version: 2,
      workspaceId: "11111111-1111-4111-8111-111111111111",
      siteId: "22222222-2222-4222-8222-222222222222",
      publishedVersionId: "33333333-3333-4333-8333-333333333333",
      recipientId: variant === "default" ? null : variants[variant].id,
      recipientRevision: variant === "default" ? null : variants[variant].revisionNumber,
      trackingMode: "events_and_recording",
    },
  }
}
