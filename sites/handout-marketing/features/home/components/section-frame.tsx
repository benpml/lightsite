import * as React from "react"

import { CornerDecoration } from "@/components/common/corner-decoration"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type SectionFrameProps = React.ComponentProps<"section"> & {
  innerClassName?: string
  innerStyle?: React.CSSProperties
  centerTopHandle?: boolean
  centerBottomHandle?: boolean
  divider?: "top" | "none"
  handles?: "top" | "none"
  children?: React.ReactNode
}

function SectionFrame({
  className,
  innerClassName,
  innerStyle,
  centerTopHandle = false,
  centerBottomHandle = false,
  divider = "top",
  handles = "top",
  children,
  ...props
}: SectionFrameProps) {
  return (
    <section
      className={cn("relative isolate", className)}
      {...props}
    >
      {divider === "top" && (
        <Separator className="pointer-events-none absolute inset-x-0 top-0" />
      )}
      <div
        style={innerStyle}
        className={cn(
          "relative mx-auto h-full w-[calc(100%-32px)] max-w-[1024px] lg:w-full",
          innerClassName,
        )}
      >
        <Separator
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 h-full"
        />
        <Separator
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 h-full"
        />
        {divider === "top" && handles === "top" && (
          <>
            <CornerDecoration className="absolute top-[-5px] left-[-5px] z-20" />
            <CornerDecoration className="absolute top-[-5px] right-[-5px] z-20" />
          </>
        )}
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

type SectionCellDividerProps = {
  mobile?: boolean
  desktop?: boolean
}

function SectionCellDivider({
  mobile = true,
  desktop = true,
}: SectionCellDividerProps) {
  return (
    <>
      {mobile && (
        <Separator className="pointer-events-none absolute inset-x-0 bottom-0 z-10 md:hidden" />
      )}
      {desktop && (
        <Separator
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden h-full md:block"
        />
      )}
    </>
  )
}

export { SectionCellDivider, SectionFrame }
