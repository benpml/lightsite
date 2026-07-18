import Image from "next/image"
import Link from "next/link"

import { SectionCellDivider } from "@/components/layout/section-frame"
import { Separator } from "@/components/ui/separator"
import {
  formatBlogPostDate,
  type BlogPost,
} from "@/features/blog/blog-content"

type BlogCardProps = {
  post: BlogPost
  index: number
  count: number
}

function BlogCard({ post, index, count }: BlogCardProps) {
  const isLast = index === count - 1
  const isDesktopLastRow = index >= count - (count % 2 || 2)
  const hasDesktopColumnDivider = index % 2 === 0

  return (
    <article className="relative h-[377px] px-4 pt-4 pb-5">
      <Link
        href={`/blog/${post.slug}`}
        aria-labelledby={`${post.slug}-title`}
        className="flex h-full flex-col gap-6 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md">
          <Image
            src={post.image.src}
            alt={post.image.alt}
            fill
            sizes="(min-width: 768px) 480px, calc(100vw - 64px)"
            className="object-cover"
            priority={index < 2}
          />
          <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-border" />
        </div>

        <div className="flex min-w-0 flex-col gap-2 px-2">
          <h2
            id={`${post.slug}-title`}
            className="text-label-2xl text-foreground"
          >
            {post.title}
          </h2>
          <time
            dateTime={post.publishedAt}
            className="text-body-md text-neutral-500"
          >
            {formatBlogPostDate(post.publishedAt)}
          </time>
        </div>
      </Link>

      <SectionCellDivider
        mobile={!isLast}
        desktop={hasDesktopColumnDivider}
      />
      {!isDesktopLastRow ? (
        <Separator
          variant="section"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:block"
        />
      ) : null}
    </article>
  )
}

export { BlogCard }
