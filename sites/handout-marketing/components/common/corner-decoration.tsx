import * as React from "react"

import { cn } from "@/lib/utils"

function CornerDecoration({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="corner-decoration"
      className={cn(
        "inline-block size-2.5 rounded-[3px] border border-neutral-alpha-a600 bg-secondary",
        className,
      )}
      {...props}
    />
  )
}

export { CornerDecoration }
