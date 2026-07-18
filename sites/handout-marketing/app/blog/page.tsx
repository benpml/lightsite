import type { Metadata } from "next"

import { BlogPage } from "@/features/blog/blog-page"

export const metadata: Metadata = {
  title: "Blog — Handout",
  description:
    "Product announcements, sales insights, and practical guides from Handout.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog — Handout",
    description:
      "Product announcements, sales insights, and practical guides from Handout.",
    url: "/blog",
    type: "website",
  },
}

export default function Page() {
  return <BlogPage />
}
