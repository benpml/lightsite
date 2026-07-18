import { GraphicPlaceholder } from "@/features/home/components/graphic-placeholder"
import {
  SectionCellDivider,
  SectionFrame,
} from "@/components/layout/section-frame"
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
  topDivider?: "always" | "desktop" | "none"
}

function FeatureRow({
  title,
  bullets,
  image,
  graphic,
  topDivider = "desktop",
}: FeatureRowProps) {
  const hasTopDivider = topDivider !== "none"
  const hasDesktopOnlyTopDivider = topDivider === "desktop"

  return (
    <SectionFrame
      bottomDivider
      divider={hasTopDivider ? "top" : "none"}
      handles={hasTopDivider ? "both" : "bottom"}
      innerClassName="min-h-[417px]"
      topDividerClassName={hasDesktopOnlyTopDivider ? "hidden md:block" : undefined}
      topHandlesClassName={hasDesktopOnlyTopDivider ? "hidden md:block" : undefined}
    >
      <div className="grid min-h-[417px] md:grid-cols-2">
        <div className="relative order-2 flex min-h-0 items-center justify-center px-8 py-10 md:order-1 md:min-h-[417px] md:p-8">
          <SectionCellDivider mobile={false} />
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
        <div className="relative order-1 h-[417px] overflow-hidden md:order-2">
          <SectionCellDivider desktop={false} />
          <GraphicPlaceholder image={image} variant={graphic} />
        </div>
      </div>
    </SectionFrame>
  )
}

function FeatureSpacer() {
  return (
    <SectionFrame
      aria-hidden="true"
      className="hidden md:block"
      divider="none"
      handles="none"
      innerClassName="h-9"
    />
  )
}

export { FeatureRow, FeatureSpacer }
