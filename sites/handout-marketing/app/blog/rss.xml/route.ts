import { getPublishedBlogPosts } from "@/features/blog/blog-content"

const siteUrl = "https://www.handout.link"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function GET() {
  const items = getPublishedBlogPosts()
    .map((post) => {
      const url = `${siteUrl}/blog/${post.slug}`

      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<description>${escapeXml(post.description)}</description>`,
        `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`,
        `<category>${escapeXml(post.category)}</category>`,
        "</item>",
      ].join("")
    })
    .join("")

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    "<title>Handout Blog</title>",
    `<link>${siteUrl}/blog</link>`,
    "<description>Product announcements, sales insights, and practical guides from Handout.</description>",
    "<language>en-us</language>",
    items,
    "</channel>",
    "</rss>",
  ].join("")

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
