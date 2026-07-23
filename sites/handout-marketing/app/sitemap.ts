import type { MetadataRoute } from "next"

import { getPublishedBlogPosts } from "@/features/blog/blog-content"

const siteUrl = "https://www.handout.link"

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/examples`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.4 },
  ]

  const postRoutes: MetadataRoute.Sitemap = getPublishedBlogPosts().map(
    (post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt ?? post.publishedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  )

  return [...staticRoutes, ...postRoutes]
}
