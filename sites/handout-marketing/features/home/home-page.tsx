import Link from "next/link"
import {
  IconBolt,
  IconCheck,
  IconCreditCardOff,
  IconRocket,
} from "@tabler/icons-react"

import { Logo } from "@/components/common/logo"
import { SiteHeader } from "@/components/layout/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TextLink } from "@/components/ui/text-link"
import { BeforeAfter } from "@/features/home/components/before-after"
import {
  AgentCardRow,
  FeatureCardRow,
  featureIcons,
  type MarketingFeature,
} from "@/features/home/components/feature-card-row"
import { FeatureRow, FeatureSpacer } from "@/features/home/components/feature-row"
import { SectionFrame } from "@/features/home/components/section-frame"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

const navigation = [
  { href: "#pricing", label: "Pricing" },
  { href: "#examples", label: "Examples" },
  { href: "#docs", label: "Docs" },
] as const

const heroBenefits = [
  { label: "Super easy", icon: IconBolt },
  { label: "Build in minutes", icon: IconRocket },
  { label: "Start for free", icon: IconCheck },
  { label: "No card required", icon: IconCreditCardOff },
] as const

const featureRows = [
  {
    title: (
      <>
        Super easy to build.
        <br />
        Just like a doc.
      </>
    ),
    bullets: ["Create in minutes", "Looks great by default", "AI can do it for you"],
    image: "cloud-deep",
  },
  {
    title: "Personalize for each recipient in seconds.",
    bullets: ["Easily add variables", "Insert their logo automatically", "Quickly personalize at scale"],
    image: "cloud-light",
  },
  {
    title: "Track who visited and what they did.",
    bullets: ["Get alerted of visits", "Watch replays of sessions", "Know when forwarded internally"],
    image: "cloud-soft",
  },
  {
    title: "Customize without complexity.",
    bullets: ["40+ blocks and templates", "Multiplayer editing", "Embed calendars and more"],
    image: "cloud-deep",
  },
  {
    title: "Automate actions when buyers engage.",
    bullets: ["Trigger actions via webhook", "Follow up at the ideal moment", "Get alerted"],
    image: "cloud-light",
  },
] as const

const featureCards: readonly MarketingFeature[] = [
  {
    title: "See when shared internally",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-light",
    icon: featureIcons.sharing,
  },
  {
    title: "Use inside Gmail",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-deep",
    icon: featureIcons.gmail,
  },
  {
    title: "Use inside your sequences",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-soft",
    icon: featureIcons.sequences,
  },
  {
    title: "Add multiple pages",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-light",
    icon: featureIcons.pages,
  },
  {
    title: "Stay compliant",
    description: "Don’t land in legal trouble. Add privacy consent to your sites and configure what to track.",
    image: "cloud-deep",
    icon: featureIcons.compliance,
  },
  {
    title: "Dark and light mode",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-soft",
    icon: featureIcons.modes,
  },
] as const

function HomePage() {
  return (
    <main id="top" className="overflow-x-clip bg-background">
      <Hero />

      <SectionFrame innerClassName="flex min-h-[497px] items-end justify-center px-8 pt-16 pb-24 text-center">
        <div className="flex max-w-[699px] flex-col items-center gap-6">
          <Badge>Meet Handout</Badge>
          <h2 className="text-title-md md:text-title-lg">
            When prospects need information, send them a Handout link.
          </h2>
        </div>
      </SectionFrame>

      <BeforeAfter />

      <SectionFrame
        id="features"
        innerClassName="flex min-h-[497px] items-end justify-center px-8 pt-16 pb-24 text-center"
      >
        <div className="flex max-w-[491px] flex-col items-center gap-6">
          <Badge>Features</Badge>
          <h2 className="text-title-md md:text-title-lg">
            Why sales teams and prospects love it
          </h2>
        </div>
      </SectionFrame>

      {featureRows.map((feature, index) => (
        <div key={feature.bullets[0]}>
          {index > 0 && <FeatureSpacer />}
          <FeatureRow {...feature} />
        </div>
      ))}

      <SectionFrame innerClassName="flex min-h-[497px] items-end justify-center px-8 pt-16 pb-[100px] text-center">
        <div className="flex w-full flex-col items-center gap-6">
          <Badge>Features</Badge>
          <div className="flex w-full flex-col items-center gap-6">
            <h2 className="w-full max-w-[566px] text-title-md md:text-title-lg">
              More reasons to try it.
            </h2>
            <p className="w-full text-body-2xl text-muted-foreground">
              Get notified when your Handout is shared over Slack, Teams, or iMessage
            </p>
          </div>
        </div>
      </SectionFrame>

      <FeatureCardRow items={featureCards.slice(0, 3)} />
      <FeatureCardRow items={featureCards.slice(3, 6)} />

      <SectionFrame
        id="docs"
        innerClassName="flex min-h-[497px] items-end justify-center px-8 pt-16 pb-[100px] text-center"
      >
        <div className="flex w-full flex-col items-center gap-6">
          <Badge>Features</Badge>
          <div className="flex w-full flex-col items-center gap-6">
            <h2 className="w-full max-w-[566px] text-title-md md:text-title-lg">
              Let your agent build and personalize Handouts.
            </h2>
            <p className="w-full text-body-2xl text-muted-foreground">
              Get notified when your Handout is shared over Slack, Teams, or iMessage
            </p>
          </div>
        </div>
      </SectionFrame>

      <AgentCardRow />
      <SectionFrame aria-hidden="true" innerClassName="h-[227px]" />

      <SectionFrame
        id="pricing"
        innerClassName="coded-noise flex min-h-[497px] flex-col items-center overflow-hidden bg-cover bg-center px-8 pt-[137px] pb-8 text-center"
        innerStyle={{ backgroundImage: "url(/images/home/cloud-light.jpg)" }}
      >
        <Badge variant="inverse" className="relative z-10">
          <IconCreditCardOff data-icon aria-hidden="true" className="size-[15px]" />
          No card required
        </Badge>
        <div className="relative z-10 mt-6 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-title-md text-inverse-foreground md:text-title-lg">
              Start right now for free.
            </h2>
            <p className="text-body-lg text-inverse-secondary-foreground sm:text-body-3xl">
              Have your first handout ready to share in no time.
            </p>
          </div>
          <Button asChild variant="inverse" size="lg">
            <Link href={signupHref}>Start now</Link>
          </Button>
        </div>
      </SectionFrame>

      <SectionFrame aria-hidden="true" innerClassName="h-[104px]" />
      <Footer />
    </main>
  )
}

function Hero() {
  return (
    <section className="coded-noise relative h-[938px] overflow-hidden bg-[url('/images/home/hero.jpg')] bg-cover bg-center text-inverse-foreground">
      <div className="relative z-10 mx-auto h-full w-[calc(100%-32px)] max-w-[1024px] border-x border-inverse-border lg:w-full">
        <SiteHeader
          variant="inverse"
          items={navigation}
          className="mx-auto max-w-[761px] pt-9"
        />

        <div className="mx-auto mt-24 flex w-full max-w-[620px] flex-col items-center px-6 text-center">
          <h1 className="w-full max-w-[486px] text-title-md md:text-title-xl">
            Create one pagers that close prospects.
          </h1>
          <p className="mt-4 w-full text-body-xl text-inverse-secondary-foreground sm:text-body-2xl">
            Bundle your client-facing content in one sleek, trackable site.
          </p>
          <Button asChild variant="inverse" size="lg" className="mt-[18px]">
            <Link href={signupHref}>Start now for free</Link>
          </Button>
        </div>

        <div className="mx-auto mt-[92px] flex max-w-[761px] flex-col px-6 sm:px-0">
          <ul className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-6" role="list">
            {heroBenefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <li
                  key={benefit.label}
                  className="flex items-center justify-center gap-2 text-label-lg sm:text-label-xl sm:whitespace-nowrap"
                >
                  <Icon data-icon aria-hidden="true" className="size-4" />
                  {benefit.label}
                </li>
              )
            })}
          </ul>
          <Card
            variant="canvas"
            aria-hidden="true"
            className="mt-[23px] h-[652px] w-full rounded-[20px] py-0"
          />
        </div>
      </div>
    </section>
  )
}

const footerGroups = [
  [
    { href: "#features", label: "Product" },
    { href: "#examples", label: "Examples" },
    { href: "#pricing", label: "Pricing" },
  ],
  [
    { href: "#docs", label: "AI agents" },
    { href: "#features", label: "Features" },
    { href: "#top", label: "Overview" },
  ],
  [
    { href: "mailto:hello@handout.link", label: "Contact" },
    { href: "https://app.handout.link/auth", label: "Log in" },
    { href: signupHref, label: "Sign up" },
  ],
] as const

function Footer() {
  return (
    <>
      <SectionFrame innerClassName="min-h-[359px] px-8 pt-14 pb-[100px]">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <Logo />
          <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-4 md:max-w-[710px]">
            {footerGroups.map((group) => (
              <div key={group[0].label} className="flex flex-col gap-4">
                {group.map((link) => (
                  <TextLink key={link.label} href={link.href}>
                    {link.label}
                  </TextLink>
                ))}
              </div>
            ))}
            <div className="flex items-start justify-start gap-1.5 sm:justify-end">
              <Button asChild variant="ghost" size="md">
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
    </>
  )
}

export { HomePage }
