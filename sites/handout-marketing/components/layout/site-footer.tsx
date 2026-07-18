import Link from "next/link"

import { Logo } from "@/components/common/logo"
import { SectionFrame } from "@/components/layout/section-frame"
import { Button } from "@/components/ui/button"
import { TextLink } from "@/components/ui/text-link"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

const footerGroups = [
  {
    title: "Company",
    links: [
      { href: "/#features", label: "Product" },
      { href: "/examples", label: "Examples" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#docs", label: "AI agents" },
      { href: "/#features", label: "Features" },
      { href: "/#top", label: "Overview" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/examples", label: "Examples" },
      { href: "/blog", label: "Blog" },
    ],
  },
] as const

function SiteFooter() {
  return (
    <footer>
      <SectionFrame innerClassName="min-h-[359px] px-8 pt-14 pb-[100px]">
        <div className="flex w-full flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <Logo size="footer" />
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:contents">
            {footerGroups.map((group) => (
              <div
                key={`${group.title}-${group.links[0].label}`}
                className="flex flex-col gap-4"
              >
                <h2 className="text-label-md text-foreground">{group.title}</h2>
                <div className="flex flex-col items-start gap-3">
                  {group.links.map((link) => (
                    <TextLink key={link.label} href={link.href}>
                      {link.label}
                    </TextLink>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-start justify-start gap-1.5 sm:justify-end">
              <Button asChild variant="tertiary" size="md">
                <Link href="https://app.handout.link/auth">Log in</Link>
              </Button>
              <Button asChild size="md">
                <Link href={signupHref}>Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      </SectionFrame>
      <SectionFrame innerClassName="flex h-[52px] items-center justify-center">
        <p className="text-body-md text-muted-foreground">© 2026 Handout</p>
      </SectionFrame>
    </footer>
  )
}

export { SiteFooter }
