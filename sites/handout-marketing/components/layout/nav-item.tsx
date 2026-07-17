import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const navItemVariants = cva(
  "inline-flex h-[27px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-label-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: "text-secondary-foreground",
        inverse: "text-inverse-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

type NavItemProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof navItemVariants>

function NavItem({ className, variant, ...props }: NavItemProps) {
  return (
    <Link
      data-slot="nav-item"
      data-variant={variant}
      className={cn(navItemVariants({ variant }), className)}
      {...props}
    />
  )
}

export { NavItem, navItemVariants }
