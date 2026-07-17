import { cn } from "@/lib/utils"

const NOISE_TILE_SIZE = "256px 256px"

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
        "pointer-events-none absolute inset-0 z-[1] size-full bg-top-left bg-repeat opacity-35 mix-blend-screen",
        className,
      )}
      style={{
        backgroundImage: "url('/images/home/noise.png')",
        backgroundSize: NOISE_TILE_SIZE,
      }}
    />
  )
}

export { NoiseOverlay }
