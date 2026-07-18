import Link from "next/link"
import { IconCreditCardOff } from "@tabler/icons-react"

import { NoiseOverlay } from "@/components/common/noise-overlay"
import { SectionFrame } from "@/components/layout/section-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

function MarketingCta() {
  return (
    <SectionFrame innerClassName="min-h-[497px]">
      <div
        className="relative isolate flex min-h-[497px] flex-col items-center overflow-hidden bg-cover bg-center pt-[137px] pb-8 text-center max-md:px-8"
        style={{ backgroundImage: "url(/images/home/cloud-light.jpg)" }}
      >
        <NoiseOverlay id="marketing-cta-noise" />
        <Badge variant="inverse" className="relative z-10">
          <IconCreditCardOff data-icon="inline-start" aria-hidden="true" />
          No card required
        </Badge>
        <div className="relative z-10 mt-6 flex w-full flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center gap-3">
            <h2 className="w-full max-w-[566px] text-title-lg text-inverse-foreground">
              Start right now for free.
            </h2>
            <p className="w-full text-body-lg text-inverse-secondary-foreground">
              Have your first handout ready to share in no time.
            </p>
          </div>
          <Button asChild variant="inverse" size="lg">
            <Link href={signupHref}>Start now</Link>
          </Button>
        </div>
      </div>
    </SectionFrame>
  )
}

export { MarketingCta }
