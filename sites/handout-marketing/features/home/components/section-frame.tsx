import * as React from "react"

import { CornerDecoration } from "@/components/common/corner-decoration"
import { cn } from "@/lib/utils"

type SectionFrameProps = React.ComponentProps<"section"> & {
  innerClassName?: string
  innerStyle?: React.CSSProperties
  centerTopHandle?: boolean
  centerBottomHandle?: boolean
  children?: React.ReactNode
}

function SectionFrame({
  className,
  innerClassName,
  innerStyle,
  centerTopHandle = false,
  centerBottomHandle = false,
  children,
  ...props
}: SectionFrameProps) {
  return (
    <section
      className={cn("relative", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border"
      />
      <div
        style={innerStyle}
        className={cn(
          "relative mx-auto h-full w-[calc(100%-32px)] max-w-[1024px] border-x border-border lg:w-full",
          innerClassName,
        )}
      >
        <CornerDecoration className="absolute top-[-5px] left-[-6px] z-20" />
        <CornerDecoration className="absolute top-[-5px] right-[-6px] z-20" />
        {centerTopHandle && (
          <CornerDecoration className="absolute top-[-5px] left-1/2 z-20 hidden -translate-x-1/2 md:block" />
        )}
        {centerBottomHandle && (
          <CornerDecoration className="absolute bottom-[-5px] left-1/2 z-20 hidden -translate-x-1/2 md:block" />
        )}
        {children}
      </div>
    </section>
  )
}

export { SectionFrame }
