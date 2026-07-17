import { GraphicPlaceholder } from "@/features/home/components/graphic-placeholder"
import {
  SectionCellDivider,
  SectionFrame,
} from "@/features/home/components/section-frame"
import { cn } from "@/lib/utils"

type FeatureBullet = {
  label: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
  iconSize?: 16 | 18 | 20
}

type FeatureRowProps = {
  title: React.ReactNode
  bullets: readonly FeatureBullet[]
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
  graphic: "easy" | "personalize" | "track" | "customize" | "automate"
}

function FeatureRow({ title, bullets, image, graphic }: FeatureRowProps) {
  return (
    <SectionFrame innerClassName="min-h-[417px]">
      <div className="grid min-h-[417px] md:grid-cols-2">
        <div className="relative flex min-h-[417px] items-center justify-center p-8">
          <SectionCellDivider />
          <div className="flex w-full max-w-[340px] flex-col gap-9">
            <h3 className="text-title-md text-foreground">{title}</h3>
            <ul className="flex flex-col gap-3.5" role="list">
              {bullets.map((bullet) => {
                const Icon = bullet.icon

                return (
                  <li
                    key={bullet.label}
                    className="flex min-h-[30px] items-center gap-3.5 text-body-3xl text-secondary-foreground"
                  >
                    <span className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-border bg-card text-foreground">
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          bullet.iconSize === 16
                            ? "size-4"
                            : bullet.iconSize === 20
                              ? "size-5"
                              : "size-[18px]",
                        )}
                      />
                    </span>
                    {bullet.label}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <div className="min-h-[417px] overflow-hidden">
          <GraphicPlaceholder image={image} variant={graphic} />
        </div>
      </div>
    </SectionFrame>
  )
}

function FeatureSpacer() {
  return <SectionFrame aria-hidden="true" innerClassName="h-9" />
}

export { FeatureRow, FeatureSpacer }
