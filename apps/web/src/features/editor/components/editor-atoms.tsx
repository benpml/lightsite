import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type VariableChipProps = {
  children: ReactNode
  className?: string
}

export function VariableChip({ children, className }: VariableChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center rounded-md bg-variable-background px-1 text-xs font-medium leading-4 text-variable-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

export function LiveBadge() {
  return (
    <Badge variant="outline" className="gap-1">
      <span className="size-1.5 rounded-full bg-variable-foreground" />
      Live
    </Badge>
  )
}
