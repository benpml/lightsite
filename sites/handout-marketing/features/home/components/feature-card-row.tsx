import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  GraphicPlaceholder,
  type GraphicVariant,
} from "@/features/home/components/graphic-placeholder"
import {
  SectionCellDivider,
  SectionFrame,
} from "@/components/layout/section-frame"

type MarketingFeature = {
  title: string
  description: string
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
  graphic: Extract<
    GraphicVariant,
    "sharing" | "gmail" | "sequences" | "pages" | "compliance" | "modes"
  >
}

function FeatureCardRow({ items }: { items: readonly MarketingFeature[] }) {
  return (
    <SectionFrame innerClassName="min-h-[317px]">
      <div className="grid md:grid-cols-3">
        {items.map((item, index) => (
          <FeatureCard
            key={item.title}
            item={item}
            divided={index < items.length - 1}
          />
        ))}
      </div>
    </SectionFrame>
  )
}

function FeatureCard({
  item,
  divided,
}: {
  item: MarketingFeature
  divided: boolean
}) {
  return (
    <article className="relative flex min-h-[317px] flex-col items-center gap-6 overflow-hidden px-5 pt-5 pb-8">
      {divided && <SectionCellDivider />}
      <div className="h-[171px] w-full overflow-hidden rounded-[10px] border border-border">
        <GraphicPlaceholder image={item.image} variant={item.graphic} />
      </div>
      <div className="flex w-full flex-col gap-2 text-center">
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
  logo: "openai" | "claude" | "other"
}

const agentCards: readonly AgentCard[] = [
  {
    title: "ChatGPT",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with GPT",
    logo: "openai",
  },
  {
    title: "Claude",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with Claude",
    logo: "claude",
  },
  {
    title: "Other agents",
    description: "Get notified when your Handout is shared over Slack, Teams, or iMessage",
    action: "Start with any agent",
    logo: "other",
  },
] as const

function AgentCardRow() {
  return (
    <SectionFrame innerClassName="min-h-[251.336px]">
      <div className="grid md:grid-cols-3">
        {agentCards.map((agent, index) => (
          <article
            key={agent.title}
            className="relative flex min-h-[251.336px] flex-col items-center px-7 pt-8 pb-9 text-center"
          >
            {index < agentCards.length - 1 && <SectionCellDivider />}
            <AgentLogo variant={agent.logo} />
            <div className="mt-6 flex w-full flex-col gap-2.5">
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
        ))}
      </div>
    </SectionFrame>
  )
}

function AgentLogo({ variant }: { variant: AgentCard["logo"] }) {
  if (variant === "openai") {
    return (
      <Image
        aria-hidden="true"
        src="/images/agents/openai.svg"
        alt=""
        width={32}
        height={33}
        className="h-[32.336px] w-8"
      />
    )
  }

  if (variant === "claude") {
    return (
      <Image
        aria-hidden="true"
        src="/images/agents/claude.svg"
        alt=""
        width={32}
        height={32}
        className="h-8 w-[31.875px]"
      />
    )
  }

  const logos = [
    { name: "Gemini", src: "/images/agents/gemini.svg" },
    { name: "Nous Research", src: "/images/agents/nous-research.svg" },
    { name: "OpenClaw", src: "/images/agents/openclaw.svg" },
    { name: "Grok", src: "/images/agents/grok.svg" },
    { name: "Copilot", src: "/images/agents/copilot.svg" },
  ] as const

  return (
    <div aria-hidden="true" className="flex h-8 items-center gap-1">
      {logos.map(({ name, src }) => (
        <Image
          key={name}
          src={src}
          alt=""
          width={32}
          height={32}
          className="size-8"
        />
      ))}
    </div>
  )
}

export { AgentCardRow, FeatureCardRow }
export type { MarketingFeature }
