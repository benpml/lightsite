import type { BlogPostBlock } from "@/features/blog/blog-content"

type HeadingBlock = Extract<BlogPostBlock, { type: "heading" }>
type ContentBlock = Exclude<BlogPostBlock, HeadingBlock>

type ArticleSection = {
  heading?: HeadingBlock
  content: ContentBlock[]
}

function ArticleBody({ blocks }: { blocks: readonly BlogPostBlock[] }) {
  const sections = groupArticleBlocks(blocks)

  return (
    <div className="flex w-full flex-col gap-8">
      {sections.map((section, index) => (
        <section
          key={`${section.heading?.text ?? "introduction"}-${index}`}
          className="flex w-full max-w-[699px] flex-col gap-2"
        >
          {section.heading ? <ArticleHeading heading={section.heading} /> : null}
          <div className="flex flex-col gap-4">
            {section.content.map((block, blockIndex) => (
              <ArticleContentBlock
                key={`${block.type}-${blockIndex}`}
                block={block}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ArticleHeading({ heading }: { heading: HeadingBlock }) {
  switch (heading.level ?? 2) {
    case 4:
      return <h4 className="text-title-xs text-foreground">{heading.text}</h4>
    case 3:
      return <h3 className="text-title-sm text-foreground">{heading.text}</h3>
    case 2:
      return <h2 className="text-title-md text-foreground">{heading.text}</h2>
  }
}

function ArticleContentBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-2 pl-5 text-body-xl text-tertiary-foreground marker:text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case "quote":
      return (
        <blockquote className="border-l border-border pl-5 text-body-xl text-tertiary-foreground">
          {block.text}
        </blockquote>
      )
    case "paragraph":
      return <p className="text-body-xl text-tertiary-foreground">{block.text}</p>
  }
}

function groupArticleBlocks(blocks: readonly BlogPostBlock[]) {
  const sections: ArticleSection[] = []

  for (const block of blocks) {
    if (block.type === "heading") {
      sections.push({ heading: block, content: [] })
      continue
    }

    const currentSection = sections.at(-1)

    if (currentSection) {
      currentSection.content.push(block)
    } else {
      sections.push({ content: [block] })
    }
  }

  return sections
}

export { ArticleBody }
