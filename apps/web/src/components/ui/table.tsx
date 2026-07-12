"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [fadeEdges, setFadeEdges] = React.useState({ left: false, right: false })

  const updateFadeEdges = React.useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth
    const nextFadeEdges = {
      left: maxScrollLeft > 1 && container.scrollLeft > 1,
      right: maxScrollLeft > 1 && container.scrollLeft < maxScrollLeft - 1,
    }

    setFadeEdges((currentFadeEdges) =>
      currentFadeEdges.left === nextFadeEdges.left &&
      currentFadeEdges.right === nextFadeEdges.right
        ? currentFadeEdges
        : nextFadeEdges
    )
  }, [])

  React.useLayoutEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    updateFadeEdges()

    const resizeObserver = new ResizeObserver(updateFadeEdges)
    resizeObserver.observe(container)

    const table = container.querySelector("table")
    if (table) {
      resizeObserver.observe(table)
    }

    return () => resizeObserver.disconnect()
  }, [updateFadeEdges])

  const maskImage = getTableScrollMask(fadeEdges)

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
      style={{ maskImage, WebkitMaskImage: maskImage }}
      onScroll={updateFadeEdges}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function getTableScrollMask({ left, right }: { left: boolean; right: boolean }) {
  if (left && right) {
    return "linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)"
  }

  if (left) {
    return "linear-gradient(to right, transparent, black 2rem)"
  }

  if (right) {
    return "linear-gradient(to right, black calc(100% - 2rem), transparent)"
  }

  return "none"
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b-0", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-7 bg-secondary px-2 py-1 text-left align-middle text-sm leading-5 font-medium whitespace-nowrap text-muted-foreground first:rounded-l-lg last:rounded-r-lg [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
