import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-[27px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-label-lg whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring/50 [&_[data-icon]]:pointer-events-none [&_[data-icon]]:size-[15px] [&_[data-icon]]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-background text-foreground shadow-control ring-1 ring-inset ring-border",
        inverse:
          "bg-inverse-foreground/10 text-inverse-foreground shadow-badge-inverse ring-1 ring-inset ring-inverse-border",
        success:
          "bg-success-background text-success-foreground ring-1 ring-inset ring-success-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
