import { IconArrowUpRight, IconCopy, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { FallingBefore } from "@/features/home/components/falling-before"
import { SectionFrame } from "@/features/home/components/section-frame"

function BeforeAfter() {
  return (
    <SectionFrame
      id="examples"
      centerTopHandle
      centerBottomHandle
      innerClassName="min-h-[553px]"
    >
      <div className="grid md:grid-cols-2">
        <div className="relative min-h-[553px] overflow-hidden border-b border-border md:border-r md:border-b-0">
          <div className="absolute top-10 left-8 z-10 flex max-w-[448px] flex-col gap-1.5 pr-8">
            <h2 className="text-title-sm">Before</h2>
            <p className="text-body-2xl text-muted-foreground">
              Scattered files and decks, long emails no one reads.
            </p>
          </div>
          <FallingBefore />
        </div>

        <div className="min-h-[553px] overflow-hidden p-8 sm:p-10">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-title-sm">After</h2>
            <p className="text-body-2xl text-muted-foreground">
              All your sales materials in one handout.link
            </p>
          </div>

          <div className="mt-11 flex flex-col gap-4">
            <div className="flex h-11 items-center gap-4 rounded-xl border border-border px-2 pr-2 pl-4">
              <span className="min-w-0 flex-1 truncate text-body-2xl text-foreground">
                handout.link/abcxyz
              </span>
              <Button size="md">
                <IconCopy data-icon aria-hidden="true" />
                Share
              </Button>
            </div>

            <div className="h-[290px] overflow-hidden rounded-2xl border border-border bg-background px-6 sm:px-9">
              <div className="flex h-full flex-col">
                <div className="flex h-[150px] flex-col items-center justify-center gap-4 border-b border-border text-center">
                  <div className="flex items-center gap-2 text-label-md text-tertiary-foreground">
                    <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">Acme</span>
                    <IconX aria-hidden="true" className="size-3 text-muted-foreground" />
                    <span className="rounded-md bg-card px-2 py-1 text-foreground">Brainbox</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-label-xs text-muted-foreground">Call recap + next steps</span>
                    <h3 className="text-title-xs">Title</h3>
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-3">
                  <p className="text-body-md text-muted-foreground">
                    Description text.
                  </p>
                  <Button variant="secondary" size="sm">
                    Button
                    <IconArrowUpRight data-icon aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}

export { BeforeAfter }
