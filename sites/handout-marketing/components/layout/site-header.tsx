import Link from "next/link"
import { IconMenu2 } from "@tabler/icons-react"

import { Logo } from "@/components/common/logo"
import { Button } from "@/components/ui/button"
import { NavItem } from "@/components/layout/nav-item"
import { cn } from "@/lib/utils"

const defaultItems = [
  { href: "/pricing", label: "Pricing" },
  { href: "/examples", label: "Examples" },
  { href: "#docs", label: "Docs" },
] as const

type SiteHeaderProps = React.ComponentProps<"nav"> & {
  variant?: "normal" | "inverse" | "sticky"
  width?: "default" | "full"
  items?: ReadonlyArray<{ href: string; label: string }>
  loginHref?: string
  signupHref?: string
}

function SiteHeader({
  className,
  variant = "normal",
  width = "default",
  items = defaultItems,
  loginHref = "https://app.handout.link/auth",
  signupHref = "https://app.handout.link/auth?mode=sign-up",
  ...props
}: SiteHeaderProps) {
  const isInverse = variant === "inverse"
  const isSticky = variant === "sticky"
  const navVariant = isInverse ? "inverse" : "default"

  return (
    <nav
      aria-label="Primary navigation"
      data-slot="site-header"
      data-variant={variant}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center",
        isSticky
          ? "max-w-[640px] rounded-2xl bg-background py-2.5 pr-3 pl-3.5 shadow-xl ring-1 ring-inset ring-border"
          : width === "full"
            ? "max-w-none"
            : "max-w-[761px]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center justify-start gap-3.5">
        <Button
          type="button"
          aria-label="Navigation menu"
          variant={isInverse ? "ghost-inverse" : "ghost"}
          size="icon"
          className="md:hidden"
        >
          <IconMenu2 data-icon="inline-start" />
        </Button>
        <div className="hidden items-center gap-3.5 md:flex">
          {items.map((item) => (
            <NavItem key={item.href} href={item.href} variant={navVariant}>
              {item.label}
            </NavItem>
          ))}
        </div>
      </div>

      <Link
        href="/"
        aria-label="Handout home"
        className="shrink-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Logo
          color={isInverse ? "inverse" : "default"}
          type={isSticky ? "icon" : "full"}
        />
      </Link>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <NavItem href={loginHref} variant={navVariant} className="max-sm:hidden">
          Log in
        </NavItem>
        <Button asChild variant={isInverse ? "inverse" : "primary"} size="md">
          <Link href={signupHref}>Sign up</Link>
        </Button>
      </div>
    </nav>
  )
}

export { SiteHeader }
