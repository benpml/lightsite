import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      size: {
        md: "h-8",
        lg: "h-9",
        xl: "h-[38px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>

function Input({ className, size = "md", type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
}

function InputTrigger({
  className,
  size = "md",
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof inputVariants>) {
  return (
    <button
      type={type}
      data-slot="input-trigger"
      data-size={size}
      className={cn(inputVariants({ size }), "flex items-center gap-2 text-left", className)}
      {...props}
    />
  )
}

export { Input, InputTrigger, inputVariants }
export type { InputProps }
