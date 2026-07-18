"use client"

import Link from "next/link"
import {
  IconBolt,
  IconBrowser,
  IconDeviceTvOld,
  IconRobot,
  IconRocket,
  IconScanEye,
  IconScanPosition,
  IconThumbUp,
  IconUsersGroup,
} from "@tabler/icons-react"

import { SectionCellDivider, SectionFrame } from "@/components/layout/section-frame"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const signupHref = "https://app.handout.link/auth?mode=sign-up"

const navigation = [
  { href: "/pricing", label: "Pricing" },
  { href: "/examples", label: "Examples" },
  { href: "/#docs", label: "Docs" },
] as const

const plans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    cta: "Start for free",
    annualSavings: false,
    features: [
      { label: "Try it out, see if you like it", icon: IconThumbUp },
      { label: "Build up to 5 sites", icon: IconBrowser },
      { label: "Let your AI build sites", icon: IconRobot },
    ],
  },
  {
    name: "Basic",
    monthlyPrice: "$49",
    annualPrice: "$39",
    cta: "Start with Basic",
    annualSavings: true,
    features: [
      { label: "Unlimited published sites", icon: IconRocket },
      { label: "Unlimited recipients", icon: IconUsersGroup },
      { label: "Activity tracking", icon: IconScanPosition },
    ],
  },
  {
    name: "Pro",
    monthlyPrice: "$89",
    annualPrice: "$72",
    cta: "Start with Core",
    annualSavings: true,
    features: [
      { label: "Trigger automations", icon: IconBolt },
      { label: "Advanced tracking", icon: IconScanEye },
      { label: "Watch session replays", icon: IconDeviceTvOld },
    ],
  },
] as const

type BillingPeriod = "monthly" | "annual"
type Plan = (typeof plans)[number]

function PricingPage() {
  return (
    <main id="top" className="overflow-x-clip bg-background">
      <SectionFrame
        divider="none"
        handles="none"
        bottomDivider
        innerClassName="flex h-[72px] items-center px-5"
      >
        <SiteHeader items={navigation} width="full" />
      </SectionFrame>

      <Tabs defaultValue="monthly" className="gap-0">
        <SectionFrame
          divider="none"
          innerClassName="flex min-h-[328px] flex-col items-center justify-end gap-9 px-6 pt-20 pb-12 sm:pt-24 lg:pt-32"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="max-w-[699px] text-title-md text-foreground sm:text-title-lg">
              Pays for itself in more deals won.
            </h1>
            <p className="max-w-[699px] text-body-xl text-tertiary-foreground sm:text-body-2xl">
              Explore our pricing. It’s free to start, then upgrade whenever you want.
            </p>
          </div>
          <TabsList aria-label="Billing period" className="w-[228px]">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual</TabsTrigger>
          </TabsList>
        </SectionFrame>

        <TabsContent value="monthly" className="mt-0">
          <PricingSection billing="monthly" />
        </TabsContent>
        <TabsContent value="annual" className="mt-0">
          <PricingSection billing="annual" />
        </TabsContent>
      </Tabs>

      <SectionFrame
        aria-hidden="true"
        divider="none"
        innerClassName="h-[104px]"
      />
      <SiteFooter />
    </main>
  )
}

function PricingSection({ billing }: { billing: BillingPeriod }) {
  return (
    <SectionFrame
      aria-label={`${billing === "annual" ? "Annual" : "Monthly"} pricing`}
      bottomDivider
      innerClassName="md:h-[472px]"
    >
      <div className="grid h-full md:grid-cols-3">
        {plans.map((plan, index) => (
          <PricingCard
            key={plan.name}
            plan={plan}
            billing={billing}
            divided={index < plans.length - 1}
          />
        ))}
      </div>
    </SectionFrame>
  )
}

function PricingCard({
  plan,
  billing,
  divided,
}: {
  plan: Plan
  billing: BillingPeriod
  divided: boolean
}) {
  const annual = billing === "annual"
  const price = annual ? plan.annualPrice : plan.monthlyPrice

  return (
    <article className="relative flex min-h-[472px] flex-col gap-10 overflow-hidden px-6 py-10 md:h-full md:min-h-0 md:px-8">
      {divided && <SectionCellDivider />}

      <div className="flex w-full flex-col gap-8">
        <div className="flex min-h-[28px] items-start gap-1.5">
          <h2 className="min-w-0 flex-1 text-title-sm text-tertiary-foreground">
            {plan.name}
          </h2>
          {annual && plan.annualSavings && (
            <Badge variant="success">Save 20%</Badge>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <p className="text-title-lg text-foreground">{price}</p>
          <p className="text-body-2xl text-muted-foreground">
            {annual && plan.name !== "Free"
              ? "Per seat/month billed annually"
              : "Per seat/month"}
          </p>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-3.5">
        {plan.features.map((feature) => {
          const Icon = feature.icon

          return (
            <li key={feature.label} className="flex items-center gap-3.5">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-card ring-1 ring-inset ring-border">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1 text-body-2xl text-secondary-foreground">
                {feature.label}
              </span>
            </li>
          )
        })}
      </ul>

      <Button asChild size="lg" className="w-full">
        <Link href={signupHref}>{plan.cta}</Link>
      </Button>
    </article>
  )
}

export { PricingPage }
