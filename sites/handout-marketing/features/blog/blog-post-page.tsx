import Image from "next/image"

import { NoiseOverlay } from "@/components/common/noise-overlay"
import { SectionFrame } from "@/components/layout/section-frame"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ArticleBody } from "@/features/blog/components/article-body"
import { BlogPostCta } from "@/features/blog/components/blog-post-cta"
import {
  formatBlogPostDate,
  type BlogPost,
} from "@/features/blog/blog-content"

const siteUrl = "https://www.handout.link"

const navigation = [
  { href: "/pricing", label: "Pricing" },
  { href: "/examples", label: "Examples" },
  { href: "/#docs", label: "Docs" },
] as const

function BlogPostPage({ post }: { post: BlogPost }) {
  const articleText = getArticleText(post)
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`
  const seoJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${canonicalUrl}#article`,
        headline: post.title,
        description: post.seo.description,
        articleBody: articleText,
        articleSection: post.category,
        keywords: post.seo.keywords.join(", "),
        wordCount: articleText.split(/\s+/).filter(Boolean).length,
        inLanguage: "en-US",
        isAccessibleForFree: true,
        image: {
          "@type": "ImageObject",
          url: new URL(post.image.src, siteUrl).toString(),
          width: 1200,
          height: 1200,
        },
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        author: {
          "@type": "Organization",
          name: post.author.name,
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "Handout",
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/favicon.svg`,
          },
        },
        mainEntityOfPage: canonicalUrl,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Blog",
            item: `${siteUrl}/blog`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: post.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  }

  return (
    <main id="top" className="overflow-x-clip bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(seoJsonLd).replaceAll("<", "\\u003c"),
        }}
      />

      <SectionFrame
        divider="none"
        handles="none"
        bottomDivider
        innerClassName="flex h-[71px] items-center px-5"
      >
        <SiteHeader items={navigation} width="full" />
      </SectionFrame>

      <article>
        <SectionFrame
          divider="none"
          innerClassName="flex flex-col gap-8 px-4 pt-4 pb-8 md:px-8 md:pt-8 md:pb-12"
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-md">
            <Image
              src={post.image.src}
              alt={post.image.alt}
              fill
              sizes="(min-width: 1024px) 960px, calc(100vw - 64px)"
              className="object-cover"
              priority
            />
            <NoiseOverlay id={`blog-post-${post.slug}-noise`} variant="blog" />
            <div className="pointer-events-none absolute inset-0 z-10 rounded-md ring-1 ring-inset ring-border" />
          </div>

          <header className="flex w-full max-w-[699px] flex-col gap-2">
            <h1 className="text-title-md text-foreground sm:text-title-lg">
              {post.title}
            </h1>
            <time
              dateTime={post.publishedAt}
              className="text-body-xl text-tertiary-foreground sm:text-body-2xl"
            >
              {formatBlogPostDate(post.publishedAt)}
            </time>
          </header>
        </SectionFrame>

        <SectionFrame innerClassName="px-4 py-10 md:px-8">
          <ArticleBody blocks={post.body} />
        </SectionFrame>
      </article>

      <SectionFrame aria-hidden="true" innerClassName="h-[139px]" />
      <BlogPostCta />
      <SectionFrame aria-hidden="true" innerClassName="h-[104px]" />
      <SiteFooter />
    </main>
  )
}

function getArticleText(post: BlogPost) {
  return post.body
    .flatMap((block) => {
      if (block.type === "list") {
        return block.items
      }

      return block.text
    })
    .join(" ")
}

export { BlogPostPage }
