import * as React from "react"

import { CornerDecoration } from "@/components/common/corner-decoration"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type SectionFrameProps = React.ComponentProps<"section"> & {
  innerClassName?: string
  innerStyle?: React.CSSProperties
  centerTopHandle?: boolean
  centerBottomHandle?: boolean
  bottomDivider?: boolean
  topDividerClassName?: string
  topHandlesClassName?: string
  divider?: "top" | "none"
  handles?: "top" | "bottom" | "both" | "none"
  children?: React.ReactNode
}

function SectionFrame({
  className,
  innerClassName,
  innerStyle,
  centerTopHandle = false,
  centerBottomHandle = false,
  bottomDivider = false,
  topDividerClassName,
  topHandlesClassName,
  divider = "top",
  handles = "top",
  children,
  ...props
}: SectionFrameProps) {
  return (
    <section className={cn("relative", className)} {...props}>
      {divider === "top" && (
        <Separator
          variant="section"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10",
            topDividerClassName,
          )}
        />
      )}
      {bottomDivider && (
        <Separator
          variant="section"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        />
      )}
      <div
        style={innerStyle}
        className={cn(
          "relative mx-auto h-full w-[calc(100%-32px)] max-w-[1024px] lg:w-full",
          innerClassName,
        )}
      >
        <Separator
          variant="section"
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 h-full"
        />
        <Separator
          variant="section"
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 h-full"
        />
        {(handles === "top" || handles === "both") && (
          <>
            <CornerDecoration
              className={cn(
                "absolute top-[-5px] left-[-5px] z-20",
                topHandlesClassName,
              )}
            />
            <CornerDecoration
              className={cn(
                "absolute top-[-5px] right-[-5px] z-20",
                topHandlesClassName,
              )}
            />
          </>
        )}
        {(handles === "bottom" || handles === "both") && (
          <>
            <CornerDecoration className="absolute bottom-[-5px] left-[-5px] z-20" />
            <CornerDecoration className="absolute right-[-5px] bottom-[-5px] z-20" />
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
        <Separator
          variant="section"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 md:hidden"
        />
      )}
      {desktop && (
        <Separator
          variant="section"
          orientation="vertical"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden h-full md:block"
        />
      )}
    </>
  )
}

export { SectionCellDivider, SectionFrame }
