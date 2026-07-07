import type { PublishedSitePayload, PublicVariant } from "./types";

const acmeVariant: PublicVariant = {
  id: "variant-acme-mira",
  slug: "mira",
  name: "Mira at Acme",
  recipientName: "Mira",
  recipientCompany: "Acme",
  revisionNumber: 3,
  variableValues: {
    company_name: "Acme",
    recipient_website: "acme.com",
    rollout_window: "July launch window",
    primary_cta_url: "https://cal.com/lightsite/implementation-review",
  },
};

const northstarVariant: PublicVariant = {
  id: "variant-northstar-jules",
  slug: "jules",
  name: "Jules at Northstar",
  recipientName: "Jules",
  recipientCompany: "Northstar",
  revisionNumber: 2,
  variableValues: {
    company_name: "Northstar",
    recipient_website: "northstar.com",
    rollout_window: "Q3 expansion",
    primary_cta_url: "https://cal.com/lightsite/expansion-review",
  },
};

export const demoPublishedSite: PublishedSitePayload = {
  schemaVersion: 1,
  workspace: {
    id: "workspace-lightsite",
    slug: "lightsite",
    name: "Lightsite",
    websiteDomain: "lightsite.app",
    logoUrl: "/lightsite-logo.svg",
  },
  site: {
    id: "site-rollout-brief",
    slug: "rollout-brief",
    name: "Rollout brief",
    publishedVersionId: "version-rollout-brief-4",
    publishedAt: "2026-06-14T18:00:00.000Z",
  },
  metadata: {
    title: "Rollout brief for {{company_name}}",
    description: "A concise implementation plan, proof points, and next step for {{company_name}}.",
    ogImage: null,
    robots: "noindex,nofollow",
  },
  chrome: {
    siteHeader: {
      brandName: "Lightsite",
      logoUrl: "/lightsite-logo.svg",
      primaryButtonText: "Book implementation review",
      primaryButtonHref: "{{primary_cta_url}}",
      secondaryButtonText: "View workspace",
      secondaryButtonHref: "https://lightsite.app",
      showSecondaryButton: true,
    },
    hero: {
      avatarMode: "single",
      avatarImageUrl: "/lightsite-logo.svg",
      avatarImageSecondaryUrl: null,
      avatarImageAlt: "Lightsite",
      avatarImageSecondaryAlt: null,
      eyebrow: "{{rollout_window}}",
      title: "A focused rollout plan for {{company_name}}",
      subtitle:
        "A lightweight page your team can scan quickly: what changes, why it matters, and the cleanest next step.",
    },
  },
  variables: [
    {
      id: "recipient_website",
      name: "Recipient website",
      type: "url",
      defaultValue: "",
    },
    {
      id: "company_name",
      name: "Company name",
      type: "text",
      defaultValue: "your team",
    },
    {
      id: "rollout_window",
      name: "Rollout window",
      type: "text",
      defaultValue: "the next rollout",
    },
    {
      id: "primary_cta_url",
      name: "Primary CTA URL",
      type: "url",
      defaultValue: "https://cal.com/lightsite/implementation-review",
    },
  ],
  selectedVariant: acmeVariant,
  blocks: [
    {
      id: "heading-context",
      type: "heading",
      level: 2,
      text: "Why this matters now",
    },
    {
      id: "text-context",
      type: "text",
      text:
        "{{company_name}} can move faster when the buying team has one clean source of truth instead of a thread of repeated attachments, old PDFs, and missing context.",
    },
    {
      id: "divider-1",
      type: "divider",
      width: "content",
      spacing: "md",
    },
    {
      id: "heading-plan",
      type: "heading",
      level: 2,
      text: "Recommended path",
    },
    {
      id: "text-plan",
      type: "text",
      text:
        "Start with the core one-pager, personalize only the fields that change by account, then publish a stable link that sales can resend without rebuilding the page.",
    },
    {
      id: "quote-proof",
      type: "testimonial",
      quote:
        "The biggest win was getting every stakeholder onto the same short page before procurement started asking detailed questions.",
      name: "Maya Patel",
      role: "Revenue Operations, Pilot customer",
      avatar: null,
    },
    {
      id: "logos-proof",
      type: "logo-grid",
      logos: [
        {
          id: "asset-logo-acme",
          image: "/favicon.svg",
          name: "Acme",
        },
        {
          id: "asset-logo-northstar",
          image: "/favicon.svg",
          name: "Northstar",
        },
        {
          id: "asset-logo-apex",
          image: "/favicon.svg",
          name: "Apex",
        },
      ],
    },
    {
      id: "divider-2",
      type: "divider",
      width: "full",
      spacing: "lg",
    },
    {
      id: "heading-next",
      type: "heading",
      level: 2,
      text: "Next step",
    },
    {
      id: "text-next",
      type: "text",
      text:
        "If this direction looks right for {{company_name}}, the next review should confirm launch timing, owner, and the two proof points your internal champion needs.",
    },
    {
      id: "cta-primary",
      type: "button",
      label: "Book implementation review",
      href: "{{primary_cta_url}}",
      style: "filled",
    },
  ],
  tracking: {
    workspaceId: "workspace-lightsite",
    siteId: "site-rollout-brief",
    publishedVersionId: "version-rollout-brief-4",
    variantId: acmeVariant.id,
    variantRevision: acmeVariant.revisionNumber,
    mode: "engagement",
    token: null,
  },
};

export const demoVariants = [acmeVariant, northstarVariant];

export function getDemoPublishedSite(variantSlug: string | null): PublishedSitePayload | null {
  const selectedVariant = variantSlug ? (demoVariants.find((variant) => variant.slug === variantSlug) ?? null) : null;

  if (variantSlug && !selectedVariant) {
    return null;
  }

  return {
    ...demoPublishedSite,
    selectedVariant,
    tracking: {
      ...demoPublishedSite.tracking,
      variantId: selectedVariant?.id ?? null,
      variantRevision: selectedVariant?.revisionNumber ?? null,
    },
  };
}
