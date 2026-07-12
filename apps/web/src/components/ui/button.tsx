import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/80",
        outline:
          "border-border-strong bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-neutral-alpha-a900 dark:bg-neutral-alpha-a700 dark:hover:bg-neutral-alpha-a800",
        dashed:
          "border-border-strong border-dashed bg-background text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-neutral-alpha-a300 dark:hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        editor:
          "bg-transparent text-popover-foreground/70 shadow-none hover:bg-neutral-alpha-a500 hover:text-accent-foreground aria-expanded:bg-neutral-alpha-a500 aria-expanded:text-accent-foreground aria-pressed:bg-neutral-alpha-a500 aria-pressed:text-accent-foreground",
        ghost:
          "hover:bg-neutral-alpha-a500 hover:text-foreground aria-expanded:bg-neutral-alpha-a500 aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 text-tertiary-foreground disabled:text-muted-foreground",
        compact:
          "h-[30px] gap-1.5 rounded-lg px-2.5 text-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-compact":
          "size-[30px] rounded-lg text-tertiary-foreground disabled:text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5",
        "editor-toolbar":
          "h-7 gap-1 rounded-md px-2 text-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "editor-toolbar-icon":
          "size-7 rounded-md text-tertiary-foreground disabled:text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5",
        "editor-toolbar-swatch":
          "h-7 min-w-12 gap-1 rounded-md px-1.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-field":
          "size-[26px] rounded-lg text-tertiary-foreground disabled:text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] text-tertiary-foreground disabled:text-muted-foreground in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] text-tertiary-foreground disabled:text-muted-foreground in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9 text-tertiary-foreground disabled:text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
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
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
