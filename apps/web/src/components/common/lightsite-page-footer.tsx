import { cn } from "@/lib/utils"

export function LightsitePageFooter({ className }: { className?: string }) {
  return (
    <footer
      aria-label="Made with Lightsite"
      className={cn(
        "mt-auto flex h-11 shrink-0 items-center justify-center gap-2 border-t border-border-subtle text-sm text-muted-foreground",
        className
      )}
    >
      <span>Made with</span>
      <span
        aria-label="Lightsite"
        role="img"
        className="h-[17px] w-[83px] bg-muted-foreground"
        style={{
          WebkitMask: "url('/lightsite-logo.svg') center / contain no-repeat",
          mask: "url('/lightsite-logo.svg') center / contain no-repeat",
        }}
      />
    </footer>
  )
}
