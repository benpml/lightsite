import { cn } from "@/lib/utils"

const SPECTRUM_GRADIENT = `conic-gradient(
  from -10deg,
  var(--red-foreground),
  var(--orange-foreground) 14%,
  var(--yellow-foreground) 25%,
  var(--green-foreground) 40%,
  var(--teal-foreground) 52%,
  var(--cyan-foreground) 62%,
  var(--blue-foreground) 74%,
  var(--purple-foreground) 88%,
  var(--pink-foreground)
)`

export function ColorSpectrumSwatch({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("rounded-full", className)}
      style={{ background: SPECTRUM_GRADIENT }}
    />
  )
}
