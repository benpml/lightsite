import Link from "next/link"
import {
  IconBrandOpenai,
  IconFileDescription,
  IconFiles,
  IconMail,
  IconMoonStars,
  IconRobot,
  IconShieldCheck,
  IconShare3,
  IconSparkles,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SectionFrame } from "@/features/home/components/section-frame"
import { cn } from "@/lib/utils"

type MarketingFeature = {
  title: string
  description: string
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
  icon: React.ComponentType<React.ComponentProps<"svg">>
}

const featureIcons = {
  sharing: IconShare3,
  gmail: IconMail,
  sequences: IconFileDescription,
  pages: IconFiles,
  compliance: IconShieldCheck,
  modes: IconMoonStars,
} as const

function FeatureCardRow({ items }: { items: readonly MarketingFeature[] }) {
  return (
    <SectionFrame innerClassName="min-h-[317px]">
      <div className="grid md:grid-cols-3">
        {items.map((item, index) => (
          <FeatureCard
            key={item.title}
            item={item}
            className={cn(
              index < items.length - 1 &&
                "border-b border-border md:border-r md:border-b-0",
            )}
          />
        ))}
      </div>
    </SectionFrame>
  )
}

function FeatureCard({
  item,
  className,
}: {
  item: MarketingFeature
  className?: string
}) {
  const Icon = item.icon

  return (
    <article
      className={cn(
        "flex min-h-[317px] flex-col items-center gap-6 overflow-hidden px-5 pt-5 pb-8",
        className,
      )}
    >
      <div
        className="coded-noise relative flex h-[171px] w-full items-center justify-center overflow-hidden rounded-[10px] bg-cover bg-center"
        style={{ backgroundImage: `url(/images/home/${item.image}.jpg)` }}
      >
        <Card
          variant="surface"
          className="relative z-10 flex h-[88px] w-[184px] items-center justify-center rounded-xl py-0"
        >
          <Icon aria-hidden="true" className="size-7 text-tertiary-foreground" />
        </Card>
      </div>
      <div className="flex w-full flex-col gap-2">
        <h3 className="text-title-xs">{item.title}</h3>
        <p className="text-body-lg text-muted-foreground">{item.description}</p>
      </div>
    </article>
  )
}

type AgentCard = {
  title: string
  description: string
  action: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
}

const agentCards: readonly AgentCard[] = [
  {
    title: "ChatGPT",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with GPT",
    icon: IconBrandOpenai,
  },
  {
    title: "Claude",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with Claude",
    icon: IconSparkles,
  },
  {
    title: "Other agents",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with any agent",
    icon: IconRobot,
  },
] as const

function AgentCardRow() {
  return (
    <SectionFrame innerClassName="min-h-[251.336px]">
      <div className="grid md:grid-cols-3">
        {agentCards.map((agent, index) => {
          const Icon = agent.icon
          return (
            <article
              key={agent.title}
              className={cn(
                "flex min-h-[251.336px] flex-col items-start px-7 pt-8 pb-9",
                index < agentCards.length - 1 &&
                  "border-b border-border md:border-r md:border-b-0",
              )}
            >
              <Icon aria-hidden="true" className="size-8 text-foreground" />
              <div className="mt-6 flex flex-col gap-2.5">
                <h3 className="text-title-xs">{agent.title}</h3>
                <p className="text-body-lg text-muted-foreground">
                  {agent.description}
                </p>
              </div>
              <Button asChild size="md" className="mt-auto">
                <Link href="https://app.handout.link/auth?mode=sign-up">
                  {agent.action}
                </Link>
              </Button>
            </article>
          )
        })}
      </div>
    </SectionFrame>
  )
}

export { AgentCardRow, FeatureCardRow, featureIcons }
export type { MarketingFeature }
