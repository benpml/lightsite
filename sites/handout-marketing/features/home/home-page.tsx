import Link from "next/link"
import {
  IconBell,
  IconBolt,
  IconBrandSlack,
  IconCircleCheck,
  IconClick,
  IconCodeAsterix,
  IconCoin,
  IconCreditCardOff,
  IconEye,
  IconEyeglass2,
  IconLayoutGrid,
  IconPointer,
  IconScanPosition,
  IconUser,
  IconUsers,
  IconWand,
  IconWebhook,
} from "@tabler/icons-react"

import { Logo } from "@/components/common/logo"
import { NoiseOverlay } from "@/components/common/noise-overlay"
import { SiteHeader } from "@/components/layout/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TextLink } from "@/components/ui/text-link"
import { BeforeAfter } from "@/features/home/components/before-after"
import {
  AgentCardRow,
  FeatureCardRow,
  type MarketingFeature,
} from "@/features/home/components/feature-card-row"
import { FeatureRow, FeatureSpacer } from "@/features/home/components/feature-row"
import { SectionFrame } from "@/features/home/components/section-frame"
import { UnicornHeroScene } from "@/features/home/components/unicorn-hero-scene"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

const navigation = [
  { href: "#pricing", label: "Pricing" },
  { href: "#examples", label: "Examples" },
  { href: "#docs", label: "Docs" },
] as const

const heroBenefits = [
  { label: "Super easy", icon: IconCircleCheck },
  { label: "Build in minutes", icon: IconBolt },
  { label: "Start for free", icon: IconCoin },
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
    bullets: [
      { label: "Create in minutes", icon: IconBolt },
      { label: "Looks great by default", icon: IconEyeglass2 },
      { label: "AI can do it for you", icon: IconPointer },
    ],
    image: "cloud-deep",
    graphic: "easy",
  },
  {
    title: "Personalize for each recipient in seconds.",
    bullets: [
      { label: "Easily add variables", icon: IconCodeAsterix },
      { label: "Insert their logo automatically", icon: IconWand },
      { label: "Quickly personalize at scale", icon: IconUser },
    ],
    image: "cloud-light",
    graphic: "personalize",
  },
  {
    title: "Track who visited and what they did.",
    bullets: [
      { label: "Get alerted of visits", icon: IconScanPosition },
      { label: "Watch replays of sessions", icon: IconEye, iconSize: 16 },
      { label: "Know when forwarded internally", icon: IconBrandSlack },
    ],
    image: "cloud-soft",
    graphic: "track",
  },
  {
    title: "Customize without complexity.",
    bullets: [
      { label: "40+ blocks and templates", icon: IconLayoutGrid },
      { label: "Multiplayer editing", icon: IconUsers },
      { label: "Embed calendars and more", icon: IconWand },
    ],
    image: "cloud-deep",
    graphic: "customize",
  },
  {
    title: "Automate actions when buyers engage.",
    bullets: [
      { label: "Trigger actions via webhook", icon: IconWebhook },
      { label: "Follow up at the ideal moment", icon: IconClick, iconSize: 20 },
      { label: "Get alerted", icon: IconBell },
    ],
    image: "cloud-light",
    graphic: "automate",
  },
] as const

const featureCards: readonly MarketingFeature[] = [
  {
    title: "See when shared internally",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-light",
    graphic: "sharing",
  },
  {
    title: "Use inside Gmail",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-deep",
    graphic: "gmail",
  },
  {
    title: "Use inside your sequences",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-soft",
    graphic: "sequences",
  },
  {
    title: "Add multiple pages",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-light",
    graphic: "pages",
  },
  {
    title: "Stay compliant",
    description: "Don’t land in legal trouble. Add privacy consent to your sites and configure what to track.",
    image: "cloud-deep",
    graphic: "compliance",
  },
  {
    title: "Dark and light mode",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    image: "cloud-soft",
    graphic: "modes",
  },
] as const

function HomePage() {
  return (
    <main id="top" className="overflow-x-clip bg-background">
      <Hero />

      <SectionFrame
        handles="none"
        innerClassName="flex min-h-[497px] items-end justify-center px-8 pt-16 pb-24 text-center"
      >
        <div className="flex max-w-[699px] flex-col items-center gap-6">
          <Badge>Meet Handout</Badge>
          <h2 className="text-title-lg">
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
          <h2 className="text-title-lg">
            Why sales teams and prospects love it
          </h2>
        </div>
      </SectionFrame>

      {featureRows.map((feature, index) => (
        <div key={feature.bullets[0].label}>
          {index > 0 && <FeatureSpacer />}
          <FeatureRow {...feature} />
        </div>
      ))}

      <SectionFrame innerClassName="flex min-h-[497px] items-end justify-center pt-16 pb-[100px] text-center max-md:px-8">
        <div className="flex w-full flex-col items-center gap-6">
          <Badge>Features</Badge>
          <div className="flex w-full flex-col items-center gap-6">
            <h2 className="w-full max-w-[566px] text-title-lg">
              More reasons to try it.
            </h2>
            <p className="w-full text-body-lg text-muted-foreground">
              Get notified when your Handout is shared over Slack, Teams, or iMessage
            </p>
          </div>
        </div>
      </SectionFrame>

      <FeatureCardRow items={featureCards.slice(0, 3)} />
      <FeatureCardRow items={featureCards.slice(3, 6)} />

      <SectionFrame
        id="docs"
        innerClassName="flex min-h-[497px] items-end justify-center pt-16 pb-[100px] text-center max-md:px-8"
      >
        <div className="flex w-full flex-col items-center gap-6">
          <Badge>Features</Badge>
          <div className="flex w-full flex-col items-center gap-6">
            <h2 className="w-full max-w-[566px] text-title-lg">
              Let your agent build and personalize Handouts.
            </h2>
            <p className="w-full text-body-lg text-muted-foreground">
              Get notified when your Handout is shared over Slack, Teams, or iMessage
            </p>
          </div>
        </div>
      </SectionFrame>

      <AgentCardRow />
      <SectionFrame aria-hidden="true" innerClassName="h-[227px]" />

      <SectionFrame
        id="pricing"
        innerClassName="isolate flex min-h-[497px] flex-col items-center bg-cover bg-center pt-[137px] pb-8 text-center max-md:px-8"
        innerStyle={{ backgroundImage: "url(/images/home/cloud-light.jpg)" }}
      >
        <NoiseOverlay id="cta-noise" />
        <Badge variant="inverse" className="relative z-10">
          <IconCreditCardOff data-icon="inline-start" aria-hidden="true" />
          No card required
        </Badge>
        <div className="relative z-10 mt-6 flex w-full flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center gap-3">
            <h2 className="w-full max-w-[566px] text-title-lg text-inverse-foreground">
              Start right now for free.
            </h2>
            <p className="w-full text-body-lg text-inverse-secondary-foreground">
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
    <section className="relative isolate h-[938px] overflow-hidden text-inverse-foreground">
      <UnicornHeroScene />
      <NoiseOverlay id="hero-noise" />
      <div className="relative z-10 mx-auto h-full w-[calc(100%-32px)] max-w-[1024px] lg:w-full">
        <div className="pt-9">
          <SiteHeader
            variant="inverse"
            items={navigation}
            className="mx-auto"
          />
        </div>

        <div className="mx-auto mt-24 flex w-full max-w-[560px] flex-col items-center px-6 text-center sm:px-0">
          <h1 className="w-full max-w-[486px] text-title-xl">
            Create one pagers that close prospects.
          </h1>
          <p className="mt-[17px] w-full text-body-xl text-inverse-secondary-foreground sm:w-[439px] sm:text-body-2xl sm:whitespace-nowrap">
            Bundle your client-facing content in one sleek, trackable site.
          </p>
          <Button asChild variant="inverse" size="lg" className="mt-[45px] min-w-[133px]">
            <Link href={signupHref}>Start now for free</Link>
          </Button>
        </div>

        <div className="mx-auto mt-[68px] flex max-w-[761px] flex-col px-6 sm:px-0">
          <ul className="grid grid-cols-2 gap-x-2 gap-y-4 px-0 sm:flex sm:items-center sm:justify-between sm:px-8" role="list">
            {heroBenefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <li
                  key={benefit.label}
                  className="flex items-center justify-center gap-2 text-label-lg sm:text-label-xl sm:whitespace-nowrap"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {benefit.label}
                </li>
              )
            })}
          </ul>
          <Card
            variant="canvas"
            aria-hidden="true"
            className="mt-6 h-[652px] w-full rounded-[20px] py-0"
          />
        </div>
      </div>
    </section>
  )
}

const footerGroups = [
  {
    title: "Company",
    links: [
      { href: "#features", label: "Product" },
      { href: "#examples", label: "Examples" },
      { href: "#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#docs", label: "AI agents" },
      { href: "#features", label: "Features" },
      { href: "#top", label: "Overview" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#pricing", label: "Pricing" },
      { href: "#examples", label: "Examples" },
      { href: "mailto:hello@handout.link", label: "Contact" },
    ],
  },
] as const

function Footer() {
  return (
    <>
      <SectionFrame innerClassName="min-h-[359px] px-8 pt-14 pb-[100px]">
        <div className="flex w-full flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <Logo size="footer" />
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:contents">
            {footerGroups.map((group) => (
              <div key={`${group.title}-${group.links[0].label}`} className="flex flex-col gap-4">
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
    </>
  )
}

export { HomePage }
