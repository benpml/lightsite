import type { Metadata } from "next"

import { ExamplesPage } from "@/features/examples/examples-page"

export const metadata: Metadata = {
  title: "Examples — Handout",
  description: "Explore Handout examples and get inspired for your next one pager.",
}

export default function Page() {
  return <ExamplesPage />
}
