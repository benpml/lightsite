import { cva, type VariantProps } from "class-variance-authority"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const loadingStateVariants = cva(
  "flex w-full items-center justify-center text-muted-foreground",
  {
    variants: {
      placement: {
        fullscreen: "min-h-svh",
        page: "min-h-[50vh] flex-1",
        section: "min-h-40",
        compact: "min-h-20",
      },
    },
    defaultVariants: {
      placement: "section",
    },
  },
)

function LoadingState({
  className,
  label = "Loading",
  placement,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof loadingStateVariants> & {
    label?: string
  }) {
  return (
    <div
      data-slot="loading-state"
      aria-busy="true"
      className={cn(loadingStateVariants({ placement }), className)}
      {...props}
    >
      <Spinner aria-label={label} />
    </div>
  )
}

export { LoadingState }
