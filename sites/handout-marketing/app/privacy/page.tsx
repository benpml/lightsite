import type { Metadata } from "next"

import { PrivacyPage } from "@/features/legal/privacy-page"
import { legalConfig } from "@/features/legal/legal-config"

export const metadata: Metadata = {
  title: "Privacy Policy — Handout",
  description:
    "Handout's privacy practices for app users, customer-created sites, visitor tracking, session replay, and connected services.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — Handout",
    description:
      "How Handout handles account, customer, recipient, and customer-site visitor information.",
    url: `${legalConfig.websiteUrl}/privacy`,
    type: "website",
  },
}

export default function Page() {
  return <PrivacyPage />
}
