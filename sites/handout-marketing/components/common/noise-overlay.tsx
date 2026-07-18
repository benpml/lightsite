import { cn } from "@/lib/utils"

const NOISE_TILE_SIZE = "256px 256px"

const noiseVariants = {
  default: {
    image: "/images/home/noise.png",
    size: NOISE_TILE_SIZE,
    className: "opacity-35 mix-blend-screen",
  },
  blog: {
    image: "/images/blog/post-noise.png",
    size: "332.5px 332.5px",
    className: "opacity-75 mix-blend-lighten",
  },
} as const

type NoiseOverlayProps = {
  id: string
  className?: string
  variant?: keyof typeof noiseVariants
}

function NoiseOverlay({
  id,
  className,
  variant = "default",
}: NoiseOverlayProps) {
  const noise = noiseVariants[variant]

  return (
    <div
      aria-hidden="true"
      data-noise-overlay={id}
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] size-full bg-top-left bg-repeat",
        noise.className,
        className,
      )}
      style={{
        backgroundImage: `url('${noise.image}')`,
        backgroundSize: noise.size,
      }}
    />
  )
}

export { NoiseOverlay }
