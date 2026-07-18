import Image from "next/image"
import Link from "next/link"

import { Logo } from "@/components/common/logo"
import { NoiseOverlay } from "@/components/common/noise-overlay"
import { SectionFrame } from "@/components/layout/section-frame"
import { Button } from "@/components/ui/button"

function BlogPostCta() {
  return (
    <SectionFrame bottomDivider innerClassName="h-[497px]">
      <div className="relative isolate flex h-full flex-col items-center justify-center overflow-hidden pb-8 text-center max-md:px-8">
        <Image
          src="/images/blog/post-cta-background.png"
          alt=""
          aria-hidden="true"
          width={1295}
          height={1080}
          className="absolute top-[-172.84%] left-[-86.45%] h-[328.97%] w-[191.45%] max-w-none"
        />
        <NoiseOverlay id="blog-post-cta-noise" variant="blog" />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <Logo
            type="icon"
            color="inverse"
            className="h-8 w-[30.4px]"
          />
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <h2 className="w-full max-w-[566px] text-title-md text-inverse-foreground sm:text-title-lg">
                All your sales materials in a single, trackable link.
              </h2>
              <p className="text-body-lg text-inverse-secondary-foreground">
                Build sales one pagers that convert prospects with Handout.
              </p>
            </div>
            <Button asChild variant="inverse" size="lg">
              <Link href="/#features">Learn more</Link>
            </Button>
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}

export { BlogPostCta }
