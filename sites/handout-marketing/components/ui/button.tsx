import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap outline-none transition-[background-color,color,box-shadow] select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:ring-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-control hover:bg-primary",
        secondary:
          "bg-secondary text-secondary-foreground shadow-control ring-1 ring-inset ring-border hover:bg-secondary-hover",
        tertiary:
          "bg-tertiary text-secondary-foreground hover:bg-muted",
        ghost:
          "bg-transparent text-secondary-foreground hover:bg-tertiary hover:text-secondary-foreground",
        "ghost-inverse":
          "bg-transparent text-inverse-foreground hover:bg-white-alpha-a200 hover:text-inverse-foreground",
        inverse:
          "bg-inverse-foreground text-foreground shadow-control hover:bg-inverse-foreground",
      },
      size: {
        sm: "h-[26px] rounded-sm px-2 text-label-md",
        md: "h-[31px] rounded-md px-2.5 text-label-lg",
        lg: "h-[35px] rounded-lg px-3 text-label-lg",
        icon: "size-[31px] rounded-md",
      },
    },
    compoundVariants: [
      {
        variant: "tertiary",
        size: "md",
        className: "rounded-[7px]",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  },
)

function Button({
  className,
  variant = "primary",
  size = "sm",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
