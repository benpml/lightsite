import Link from "next/link"

import { NoiseOverlay } from "@/components/common/noise-overlay"
import { SectionCellDivider } from "@/components/layout/section-frame"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { ExampleEntry } from "@/features/examples/examples-content"

type ExampleCardProps = {
  example: ExampleEntry
  index: number
  count: number
}

function ExampleCard({ example, index, count }: ExampleCardProps) {
  const isLast = index === count - 1
  const isDesktopRowOne = index < 3
  const hasDesktopColumnDivider = (index + 1) % 3 !== 0

  return (
    <article
      id={example.slug}
      aria-labelledby={`${example.slug}-title`}
      className="relative flex min-h-[416px] flex-col gap-6 overflow-hidden px-4 pt-4 pb-5"
    >
      <ExamplePreview example={example} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-2">
          <h2
            id={`${example.slug}-title`}
            className="text-label-2xl text-foreground"
          >
            {example.title}
          </h2>
          <p className="text-body-2xl text-neutral-500">
            {example.description}
          </p>
        </div>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href={example.href}>View example</Link>
        </Button>
      </div>

      <SectionCellDivider
        mobile={!isLast}
        desktop={hasDesktopColumnDivider}
      />
      {isDesktopRowOne ? (
        <Separator
          variant="section"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:block"
        />
      ) : null}
    </article>
  )
}

function ExamplePreview({ example }: { example: ExampleEntry }) {
  const previewStyle = example.previewImage
    ? {
        backgroundImage: `url(${example.previewImage.src})`,
        backgroundPosition: example.previewImage.position ?? "top center",
      }
    : undefined

  return (
    <div
      aria-hidden="true"
      className="relative h-64 shrink-0 overflow-hidden rounded-md"
    >
      <div
        className="absolute top-[-140px] left-[-11px] h-[407px] w-[487px] max-w-none bg-cover bg-center"
        style={{ backgroundImage: "url(/images/home/cloud-light.jpg)" }}
      />
      <div
        className="absolute top-[-414px] left-[-433px] h-[1080px] w-[1295px] max-w-none bg-cover bg-center"
        style={{
          backgroundImage: "url(/images/examples/preview-gradient.png)",
        }}
      />
      <div
        className="absolute inset-x-4 top-4 bottom-0 rounded-t-md bg-background bg-cover bg-no-repeat"
        style={previewStyle}
      />
      <NoiseOverlay
        id={`example-preview-${example.slug}`}
        className="opacity-75"
      />
      <div className="pointer-events-none absolute inset-0 z-20 rounded-md ring-1 ring-inset ring-border" />
    </div>
  )
}

export { ExampleCard }
