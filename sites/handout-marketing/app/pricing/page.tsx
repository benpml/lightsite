import type { Metadata } from "next"

import { PricingPage } from "@/features/pricing/pricing-page"

export const metadata: Metadata = {
  title: "Pricing — Handout",
  description: "Start free, then choose the Handout plan that fits your team.",
}

export default function Page() {
  return <PricingPage />
}
