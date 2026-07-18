import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getBlogPost, getPublishedBlogPosts } from "@/features/blog/blog-content"
import { BlogPostPage } from "@/features/blog/blog-post-page"

type BlogPostRouteProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getPublishedBlogPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return {}
  }

  const title = post.seo.title ?? `${post.title} — Handout`
  const canonical = `/blog/${post.slug}`

  return {
    title,
    description: post.seo.description,
    keywords: [...post.seo.keywords],
    alternates: { canonical },
    authors: [{ name: post.author.name, url: "https://www.handout.link" }],
    creator: post.author.name,
    publisher: "Handout",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title,
      description: post.seo.description,
      url: canonical,
      type: "article",
      siteName: "Handout",
      locale: "en_US",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      section: post.category,
      tags: [...post.seo.keywords],
      images: [
        {
          url: post.image.src,
          alt: post.image.alt,
          width: 1200,
          height: 1200,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.seo.description,
      images: [post.image.src],
    },
  }
}

export default async function Page({ params }: BlogPostRouteProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  return <BlogPostPage post={post} />
}
