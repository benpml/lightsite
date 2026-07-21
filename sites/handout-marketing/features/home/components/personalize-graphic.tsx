"use client"

import * as React from "react"
import Image from "next/image"

const PROFILE_REVEAL_DELAYS_MS = [180, 170, 150, 150, 150, 150] as const
const PROFILE_HOLD_MS = 2200
const PROFILE_FADE_MS = 300
const PROFILE_SKELETON_SETTLE_MS = 120

const personalizeProfiles = [
  {
    partner: "Linear",
    logo: "/images/home/personalize-partner-linear.svg",
    challenges: [
      "Long sales cycles",
      "Slow deal velocity",
      "Pipeline friction",
      "Too many sales materials",
      "Not enough tracking insights",
    ],
  },
  {
    partner: "Northstar",
    logo: "/images/home/personalize-partner-northstar.svg",
    challenges: [
      "Inconsistent follow-up",
      "Technical buyers need detail",
      "Proof is spread across tools",
      "Stakeholders join late",
      "No signal after the call",
    ],
  },
  {
    partner: "Upright",
    logo: "/images/home/personalize-partner-upright.svg",
    challenges: [
      "Complex approval process",
      "Too many decision makers",
      "Security reviews take weeks",
      "Pricing context gets lost",
      "Next steps are unclear",
    ],
  },
  {
    partner: "Waferscale",
    logo: "/images/home/personalize-partner-waferscale.svg",
    challenges: [
      "Enterprise deals move slowly",
      "Multiple technical reviewers",
      "Proof points get buried",
      "Materials become outdated",
      "No clear buying signal",
    ],
  },
  {
    partner: "Antimetal",
    logo: "/images/home/personalize-partner-antimetal.svg",
    challenges: [
      "Cost savings feel abstract",
      "Buyers need tailored proof",
      "Champions lack context",
      "Follow-up takes too long",
      "Interest is hard to measure",
    ],
  },
  {
    partner: "Breakpoint",
    logo: "/images/home/personalize-partner-breakpoint.svg",
    challenges: [
      "Discovery notes get lost",
      "Follow-ups take too long",
      "Decks feel generic",
      "Champions need context",
      "Engagement stays invisible",
    ],
  },
  {
    partner: "Espeon",
    logo: "/images/home/personalize-partner-espeon.svg",
    challenges: [
      "Use cases vary by team",
      "Proof is hard to find",
      "Materials lack context",
      "Stakeholders join late",
      "Momentum fades after calls",
    ],
  },
  {
    partner: "Flagbase",
    logo: "/images/home/personalize-partner-flagbase.svg",
    challenges: [
      "Rollouts involve many teams",
      "Requirements keep changing",
      "Security details get buried",
      "Buyers need one clear plan",
      "Next steps lack ownership",
    ],
  },
] as const

const challengePlaceholderWidths = [112, 104, 96, 152, 164] as const

function wait(delay: number, timers: Set<number>) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      resolve()
    }, delay)

    timers.add(timer)
  })
}

function PersonalizeGraphic() {
  const graphicRef = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [activeProfileIndex, setActiveProfileIndex] = React.useState(0)
  const [revealedValueCount, setRevealedValueCount] = React.useState<number>(
    PROFILE_REVEAL_DELAYS_MS.length,
  )
  const activeProfile = personalizeProfiles[activeProfileIndex]
  const resolvedRevealedValueCount =
    isVisible && !prefersReducedMotion
      ? revealedValueCount
      : PROFILE_REVEAL_DELAYS_MS.length

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  React.useEffect(() => {
    const graphic = graphicRef.current
    if (!graphic) return

    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setIsVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 },
    )

    observer.observe(graphic)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!isVisible || prefersReducedMotion) return

    let cancelled = false
    const timers = new Set<number>()

    const runLoop = async () => {
      await wait(0, timers)
      if (cancelled) return
      setRevealedValueCount(PROFILE_REVEAL_DELAYS_MS.length)
      await wait(PROFILE_HOLD_MS, timers)

      while (!cancelled) {
        setRevealedValueCount(0)
        await wait(PROFILE_FADE_MS, timers)
        if (cancelled) return

        setActiveProfileIndex(
          (currentIndex) => (currentIndex + 1) % personalizeProfiles.length,
        )
        await wait(PROFILE_SKELETON_SETTLE_MS, timers)

        for (let index = 0; index < PROFILE_REVEAL_DELAYS_MS.length; index += 1) {
          await wait(PROFILE_REVEAL_DELAYS_MS[index], timers)
          if (cancelled) return
          setRevealedValueCount(index + 1)
        }

        await wait(PROFILE_HOLD_MS, timers)
      }
    }

    void runLoop()

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [isVisible, prefersReducedMotion])

  return (
    <div
      ref={graphicRef}
      aria-hidden="true"
      data-graphic="personalize"
      className="relative isolate size-full overflow-hidden"
    >
      <Image
        alt=""
        src="/images/home/personalize-background.png"
        width={1295}
        height={1080}
        priority={false}
        className="pointer-events-none absolute top-[-430px] left-1/2 h-[891px] w-[1068px] max-w-none -translate-x-[400.5px] object-cover"
      />

      <div className="absolute top-9 left-[39px] z-10 h-[918px] w-[437px] overflow-hidden rounded-[14px] border border-border bg-background max-md:right-8 max-md:left-8 max-md:w-auto">
        <div className="flex h-full p-8">
          <div className="flex w-full max-w-[373px] flex-col gap-5">
            <div className="flex w-full flex-col gap-[26px]">
              <div className="flex items-start gap-2">
                <FigmaLogomark src="/images/home/personalize-acme.svg" />
                <PartnerLogomark
                  src={activeProfile.logo}
                  revealed={resolvedRevealedValueCount >= 1}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex h-6 items-start text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground">
                  <span className="shrink-0">Acme x&nbsp;</span>
                  <PartnerName
                    revealed={resolvedRevealedValueCount >= 1}
                  >
                    {activeProfile.partner}
                  </PartnerName>
                </div>
                <p className="text-[15px] leading-[1.5] tracking-[-0.02em] text-secondary-foreground">
                  Call recap and next steps
                </p>
              </div>

              <div className="h-px w-full bg-border" />
            </div>

            <div className="flex w-full flex-col pb-9">
              <div className="flex w-full flex-col gap-3.5">
                <p className="text-[18px] font-semibold leading-7 tracking-[-0.03em] text-foreground">
                  Challenges you’ve shared
                </p>
                <ul className="flex flex-col text-[15px] leading-[1.5] tracking-[-0.02em] text-secondary-foreground">
                  {activeProfile.challenges.map((challenge, index) => (
                    <li key={challenge} className="flex h-[22.5px] items-center gap-2">
                      <span className="w-4 shrink-0 text-center">•</span>
                      <AnimatedValue
                        revealed={resolvedRevealedValueCount >= index + 2}
                        placeholderWidth={challengePlaceholderWidths[index]}
                        className="h-[22.5px] flex-1"
                        contentClassName="leading-[1.5]"
                      >
                        {challenge}
                      </AnimatedValue>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="h-px w-full bg-neutral-100" />
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute top-0 left-1/2 z-20 h-[417px] w-[925px] -translate-x-[413.5px] bg-top-left bg-repeat opacity-75 mix-blend-lighten"
        style={{
          backgroundImage: "url('/images/home/personalize-noise.png')",
          backgroundSize: "332.5px 332.5px",
        }}
      />
    </div>
  )
}

function FigmaLogomark({ src }: { src: string }) {
  return (
    <div className="relative size-[52px] shrink-0">
      <Image
        alt=""
        src={src}
        width={54}
        height={55}
        className="absolute top-0 -left-px h-[55px] w-[54px] max-w-none"
      />
    </div>
  )
}

function PartnerLogomark({
  src,
  revealed,
}: {
  src: string
  revealed: boolean
}) {
  return (
    <div className="relative size-[52px] shrink-0 overflow-hidden rounded-[12px] bg-white shadow-[0_1px_1px_rgba(42,42,42,0.08),0_3px_3px_-1px_rgba(42,42,42,0.08)]">
      <Image
        key={src}
        alt=""
        src={src}
        width={52}
        height={52}
        className={`personalize-value-reveal absolute inset-0 size-full object-cover ${revealed ? "is-visible" : ""}`}
      />
      <span
        className={`personalize-placeholder-logo absolute inset-0 ${revealed ? "opacity-0" : "opacity-100"}`}
      />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_3px_3px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(0,0,0,0.1)]" />
    </div>
  )
}

function PartnerName({
  revealed,
  children,
}: {
  revealed: boolean
  children: React.ReactNode
}) {
  return (
    <span className="relative block h-6 min-w-[116px]">
      <span
        className={`personalize-value-reveal block whitespace-nowrap ${revealed ? "is-visible" : ""}`}
      >
        {children}
      </span>
      <span
        className={`personalize-placeholder-bar absolute top-1/2 left-0 w-[82px] -translate-y-1/2 ${revealed ? "opacity-0" : "opacity-100"}`}
      />
    </span>
  )
}

function AnimatedValue({
  revealed,
  placeholderWidth,
  className,
  contentClassName,
  children,
}: {
  revealed: boolean
  placeholderWidth: number
  className: string
  contentClassName: string
  children: React.ReactNode
}) {
  return (
    <span className={`relative block ${className}`}>
      <span
        className={`personalize-value-reveal block whitespace-nowrap ${revealed ? "is-visible" : ""} ${contentClassName}`}
      >
        {children}
      </span>
      <span
        className={`personalize-placeholder-bar absolute top-1/2 left-0 -translate-y-1/2 ${revealed ? "opacity-0" : "opacity-100"}`}
        style={{ width: placeholderWidth }}
      />
    </span>
  )
}

export { PersonalizeGraphic }
