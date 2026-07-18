"use client"

import * as React from "react"

import { SectionFrame } from "@/components/layout/section-frame"
import { Button } from "@/components/ui/button"
import { BlogCard } from "@/features/blog/components/blog-card"
import type { BlogPost } from "@/features/blog/blog-content"

const INITIAL_POST_COUNT = 8
const POSTS_PER_LOAD = 4

function BlogGrid({ posts }: { posts: readonly BlogPost[] }) {
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_POST_COUNT)
  const visiblePosts = posts.slice(0, visibleCount)
  const hasMorePosts = visibleCount < posts.length

  return (
    <>
      <SectionFrame
        bottomDivider
        innerClassName="grid grid-cols-1 md:grid-cols-2"
      >
        {visiblePosts.map((post, index) => (
          <BlogCard
            key={post.slug}
            post={post}
            index={index}
            count={visiblePosts.length}
          />
        ))}
      </SectionFrame>

      <SectionFrame
        divider="none"
        innerClassName="flex h-[99px] items-center justify-center px-8 py-8"
      >
        {hasMorePosts ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + POSTS_PER_LOAD, posts.length),
              )
            }
          >
            Load more
          </Button>
        ) : (
          <p className="text-center text-body-lg text-tertiary-foreground">
            You&apos;ve reached the end
          </p>
        )}
      </SectionFrame>
    </>
  )
}

export { BlogGrid }
