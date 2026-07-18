import Link from "next/link"

import { MarketingCta } from "@/components/common/marketing-cta"
import { SectionFrame } from "@/components/layout/section-frame"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { ExampleCard } from "@/features/examples/components/example-card"
import { getPublishedExamples } from "@/features/examples/examples-content"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

const navigation = [
  { href: "/pricing", label: "Pricing" },
  { href: "/examples", label: "Examples" },
  { href: "/#docs", label: "Docs" },
] as const

function ExamplesPage() {
  const examples = getPublishedExamples()

  return (
    <main id="top" className="overflow-x-clip bg-background">
      <SectionFrame
        divider="none"
        handles="none"
        bottomDivider
        innerClassName="flex h-[71px] items-center px-5"
      >
        <SiteHeader items={navigation} width="full" />
      </SectionFrame>

      <SectionFrame
        divider="none"
        innerClassName="flex h-[356px] flex-col items-center justify-end gap-8 px-6 pt-32 pb-20"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="w-full max-w-[699px] text-title-md text-foreground sm:text-title-lg">
            Examples
          </h1>
          <p className="text-body-xl text-tertiary-foreground sm:text-body-2xl">
            Check out some Handout examples to get inspired.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={signupHref}>Start now for free</Link>
        </Button>
      </SectionFrame>

      <SectionFrame
        innerClassName="grid grid-cols-1 md:grid-cols-3"
      >
        {examples.map((example, index) => (
          <ExampleCard
            key={example.slug}
            example={example}
            index={index}
            count={examples.length}
          />
        ))}
      </SectionFrame>

      <SectionFrame aria-hidden="true" innerClassName="h-[104px]" />
      <MarketingCta />
      <SectionFrame aria-hidden="true" innerClassName="h-[104px]" />
      <SiteFooter />
    </main>
  )
}

export { ExamplesPage }
