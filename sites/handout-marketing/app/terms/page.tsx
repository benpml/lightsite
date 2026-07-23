import type { Metadata } from "next"

import { legalConfig } from "@/features/legal/legal-config"
import { TermsPage } from "@/features/legal/terms-page"

export const metadata: Metadata = {
  title: "Terms of Service — Handout",
  description:
    "Business terms for Handout accounts, customer-created sites, tracking, session replay, integrations, and data processing.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — Handout",
    description:
      "Handout's Terms of Service, Session Replay Addendum, and Data Processing Addendum.",
    url: `${legalConfig.websiteUrl}/terms`,
    type: "website",
  },
}

export default function Page() {
  return <TermsPage />
}
