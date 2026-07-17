import { cn } from "@/lib/utils"

type NoiseOverlayProps = {
  id: string
  className?: string
}

function NoiseOverlay({ id, className }: NoiseOverlayProps) {
  const filterId = `${id}-filter`

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] size-full opacity-75 mix-blend-lighten",
        className,
      )}
      preserveAspectRatio="none"
    >
      <filter
        id={filterId}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.72"
          numOctaves="4"
          seed="7"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.4" intercept="-0.25" />
          <feFuncG type="linear" slope="1.4" intercept="-0.25" />
          <feFuncB type="linear" slope="1.4" intercept="-0.25" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  )
}

export { NoiseOverlay }
