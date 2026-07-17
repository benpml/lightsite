import { IconCheck } from "@tabler/icons-react"

import { GraphicPlaceholder } from "@/features/home/components/graphic-placeholder"
import { SectionFrame } from "@/features/home/components/section-frame"

type FeatureRowProps = {
  title: React.ReactNode
  bullets: readonly string[]
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
}

function FeatureRow({ title, bullets, image }: FeatureRowProps) {
  return (
    <SectionFrame innerClassName="min-h-[417px]">
      <div className="grid min-h-[417px] md:grid-cols-2">
        <div className="flex min-h-[417px] items-center border-b border-border p-8 md:border-r md:border-b-0">
          <div className="mx-auto flex w-full max-w-[340px] flex-col gap-8">
            <h3 className="text-title-md text-foreground">{title}</h3>
            <ul className="flex flex-col gap-3.5" role="list">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex min-h-[30px] items-center gap-2.5 text-body-2xl text-tertiary-foreground"
                >
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-tertiary text-foreground">
                    <IconCheck data-icon aria-hidden="true" className="size-4" />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-h-[417px] overflow-hidden">
          <GraphicPlaceholder image={image} />
        </div>
      </div>
    </SectionFrame>
  )
}

function FeatureSpacer() {
  return <SectionFrame aria-hidden="true" innerClassName="h-9" />
}

export { FeatureRow, FeatureSpacer }
