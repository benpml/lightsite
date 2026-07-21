import { NoiseOverlay } from "@/components/common/noise-overlay"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { PersonalizeGraphic } from "@/features/home/components/personalize-graphic"
import { TrackVisitorsGraphic } from "@/features/home/components/track-visitors-graphic"

type GraphicVariant =
  | "easy"
  | "personalize"
  | "track"
  | "customize"
  | "automate"
  | "sharing"
  | "gmail"
  | "sequences"
  | "pages"
  | "compliance"
  | "modes"

type GraphicPlaceholderProps = {
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
  variant: GraphicVariant
  className?: string
}

const placeholderSurfaces: Record<GraphicVariant, readonly string[]> = {
  easy: [
    "top-[46px] left-[42px] h-[652px] w-[533px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
  ],
  personalize: [
    "top-9 left-[39.5px] h-[652px] w-[434px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
  ],
  track: [
    "top-[140px] left-[39.5px] h-[137px] w-[434px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
  ],
  customize: [
    "top-[140px] left-[39.5px] h-[137px] w-[434px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
  ],
  automate: [
    "top-[65px] left-[39px] h-[83px] w-[434px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
    "top-[253px] left-[39px] h-[83px] w-[434px] rounded-2xl max-md:right-8 max-md:left-8 max-md:w-auto",
  ],
  sharing: ["top-[59px] left-9 h-[52px] w-[229px] rounded-[10px]"],
  gmail: ["top-[-249px] right-[-95px] h-[365px] w-[360px] rounded-xl"],
  sequences: ["top-[23px] left-[63.667px] h-[574px] w-[671px] rounded-[10px]"],
  pages: ["top-[23px] left-[63.667px] h-[574px] w-[671px] rounded-[10px]"],
  compliance: ["top-[37px] left-[21px] h-24 w-[258px] rounded-sm"],
  modes: ["top-[31px] left-[42px] h-48 w-[218px] rounded-md"],
}

function GraphicPlaceholder({
  image,
  variant,
  className,
}: GraphicPlaceholderProps) {
  if (variant === "personalize") {
    return <PersonalizeGraphic />
  }

  if (variant === "track") {
    return <TrackVisitorsGraphic />
  }

  return (
    <div
      aria-hidden="true"
      data-graphic={variant}
      className={cn(
        "relative isolate size-full overflow-hidden bg-cover bg-center",
        className,
      )}
      style={{ backgroundImage: `url(/images/home/${image}.jpg)` }}
    >
      <NoiseOverlay id={`graphic-${variant}-noise`} />
      {placeholderSurfaces[variant].map((surfaceClassName, index) => (
        <Card
          key={`${variant}-${index}`}
          variant="canvas"
          className={cn("absolute z-10 py-0", surfaceClassName)}
        />
      ))}
    </div>
  )
}

export { GraphicPlaceholder }
export type { GraphicVariant }
