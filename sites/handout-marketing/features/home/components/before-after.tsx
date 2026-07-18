import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FallingBefore } from "@/features/home/components/falling-before"
import {
  SectionCellDivider,
  SectionFrame,
} from "@/components/layout/section-frame"

function BeforeAfter() {
  return (
    <SectionFrame
      id="examples"
      centerTopHandle
      centerBottomHandle
      divider="none"
      innerClassName="min-h-[553px]"
    >
      <div className="grid md:grid-cols-2">
        <div className="relative min-h-[553px] overflow-hidden">
          <SectionCellDivider />
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
              <span className="shimmer shimmer-duration-4600 min-w-0 flex-1 truncate text-body-2xl text-foreground">
                handout.link/abcxyz
              </span>
              <Button size="md">
                Share
              </Button>
            </div>

            <HandoutPreview />
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}

function HandoutPreview() {
  return (
    <div className="h-[290px] overflow-hidden rounded-2xl border border-border bg-background px-6 sm:px-9">
      <div className="flex h-full flex-col">
        <Separator />
        <div className="flex h-[148px] shrink-0 flex-col items-center pt-[33px] pb-[23px] text-center">
          <div className="flex items-start gap-2">
            <MiniLogo label="A" tone="brand" />
            <MiniLogo label="B" tone="neutral" />
          </div>
          <div className="mt-4 flex w-full flex-col items-center gap-1">
            <h3 className="text-[18.524px] leading-none font-semibold tracking-[-0.03em]">
              Acme x Brainbox
            </h3>
            <p className="text-[10.585px] leading-4 tracking-[-0.02em] text-muted-foreground">
              Call recap + next steps
            </p>
          </div>
        </div>
        <Separator />
        <div className="py-[23px]">
          <div className="flex h-[93px] w-[362px] items-center gap-4 rounded-[9px] border border-border bg-background p-1 pr-3">
            <div className="h-[85px] w-[132px] shrink-0 rounded-[7px] border border-border bg-card" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div className="w-full">
                <p className="text-[10.585px] leading-4 font-medium text-foreground">
                  Title
                </p>
                <p className="text-[9.262px] leading-4 tracking-[-0.02em] text-tertiary-foreground">
                  Description text.
                </p>
              </div>
              <span className="flex h-5 items-center rounded-[7px] border border-border bg-secondary px-2 text-[9.262px] leading-none font-medium shadow-control">
                Button
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniLogo({
  label,
  tone,
}: {
  label: string
  tone: "brand" | "neutral"
}) {
  return (
    <span
      className={
        tone === "brand"
          ? "flex size-[35px] items-center justify-center rounded-[9px] border border-inverse-border bg-primary text-label-xs text-primary-foreground shadow-control"
          : "flex size-[35px] items-center justify-center rounded-[9px] border border-border bg-card text-label-xs text-card-foreground shadow-control"
      }
    >
      {label}
    </span>
  )
}

export { BeforeAfter }
