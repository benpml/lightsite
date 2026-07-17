import { cn } from "@/lib/utils"

const FIGMA_NOISE_TILE_SIZE = "320px 320px"

type NoiseOverlayProps = {
  id: string
  className?: string
}

function NoiseOverlay({ id, className }: NoiseOverlayProps) {
  return (
    <div
      aria-hidden="true"
      data-noise-overlay={id}
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] size-full bg-top-left bg-repeat opacity-50 mix-blend-lighten",
        className,
      )}
      style={{
        backgroundImage: "url('/images/home/noise.webp')",
        backgroundSize: FIGMA_NOISE_TILE_SIZE,
      }}
    />
  )
}

export { NoiseOverlay }
