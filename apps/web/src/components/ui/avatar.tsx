import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type AvatarSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
type AvatarShape = "circle" | "square"

const avatarSizeClasses: Record<AvatarSize, string> = {
  "2xs": "size-4",
  xs: "size-[18px]",
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
  xl: "size-10",
  "2xl": "size-[60px]",
}

const avatarSquareRadiusClasses: Record<AvatarSize, string> = {
  "2xs": "rounded-sm",
  xs: "rounded-sm",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-md",
  xl: "rounded-lg",
  "2xl": "rounded-lg",
}

function Avatar({
  className,
  shape = "circle",
  size = "lg",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  shape?: AvatarShape
  size?: AvatarSize
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-shape={shape}
      data-size={size}
      className={cn(
        "group/avatar relative flex shrink-0 overflow-hidden select-none",
        avatarSizeClasses[size],
        shape === "circle" ? "rounded-full" : avatarSquareRadiusClasses[size],
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-[inherit] object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] bg-background text-sm text-foreground group-data-[size=2xs]/avatar:text-[9px] group-data-[size=xs]/avatar:text-[10px] group-data-[size=sm]/avatar:text-[11px] group-data-[size=md]/avatar:text-xs group-data-[size=xl]/avatar:text-base group-data-[size=2xl]/avatar:text-xl",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=2xs]/avatar:size-1.5 group-data-[size=2xs]/avatar:[&>svg]:hidden",
        "group-data-[size=xs]/avatar:size-1.5 group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=md]/avatar:size-2.5 group-data-[size=md]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-3 group-data-[size=xl]/avatar:[&>svg]:size-2",
        "group-data-[size=2xl]/avatar:size-4 group-data-[size=2xl]/avatar:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=2xl]/avatar-group:size-[60px] group-has-data-[size=xl]/avatar-group:size-10 group-has-data-[size=md]/avatar-group:size-6 group-has-data-[size=sm]/avatar-group:size-5 group-has-data-[size=xs]/avatar-group:size-[18px] group-has-data-[size=2xs]/avatar-group:size-4 [&>svg]:size-4 group-has-data-[size=2xl]/avatar-group:[&>svg]:size-6 group-has-data-[size=xl]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
