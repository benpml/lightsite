import { IconMail } from "@tabler/icons-react"

import apolloIconUrl from "@/assets/outreach-platforms/icon-apollo.jpg"
import instantlyIconUrl from "@/assets/outreach-platforms/icon-instantly.jpg"
import lemlistIconUrl from "@/assets/outreach-platforms/icon-lemlist.jpg"
import outreachIconUrl from "@/assets/outreach-platforms/icon-outreach.jpg"
import salesloftIconUrl from "@/assets/outreach-platforms/icon-salesloft.jpg"
import { cn } from "@/lib/utils"
import type { OutreachPlatformId } from "../lib/sequence-embed"

const providerIconUrls: Partial<Record<OutreachPlatformId, string>> = {
  apollo: apolloIconUrl,
  instantly: instantlyIconUrl,
  lemlist: lemlistIconUrl,
  outreach: outreachIconUrl,
  salesloft: salesloftIconUrl,
}

export function SequenceProviderStack() {
  return (
    <div aria-hidden="true" className="flex items-center">
      {(["instantly", "outreach", "apollo"] as const).map((platformId, index) => (
        <ProviderIcon
          className={cn("rounded-full ring-1 ring-background", index > 0 && "-ml-1")}
          key={platformId}
          platformId={platformId}
        />
      ))}
    </div>
  )
}

export function ProviderIcon({
  className,
  platformId,
}: {
  className?: string
  platformId: OutreachPlatformId
}) {
  if (platformId === "other") {
    return <IconMail aria-hidden="true" className={cn("size-3.5 shrink-0 text-tertiary-foreground", className)} />
  }

  const iconUrl = providerIconUrls[platformId]

  return (
    <img
      alt=""
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 rounded-[3px] object-cover", className)}
      src={iconUrl}
    />
  )
}
