import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

function TextLink({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="text-link"
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center text-body-md text-tertiary-foreground outline-none transition-colors hover:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  )
}

export { TextLink }
