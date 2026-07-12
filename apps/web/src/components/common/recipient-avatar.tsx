import type { ComponentProps } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getRecipientLogoUrl } from "@/lib/recipient-logo"
import { cn } from "@/lib/utils"

type RecipientAvatarIdentity = {
  company?: string | null
  name?: string | null
  website?: string | null
}

const fallbackColors = [
  { background: "bg-purple-background", foreground: "text-purple-foreground" },
  { background: "bg-blue-background", foreground: "text-blue-foreground" },
  { background: "bg-cyan-background", foreground: "text-cyan-foreground" },
  { background: "bg-teal-background", foreground: "text-teal-foreground" },
  { background: "bg-green-background", foreground: "text-green-foreground" },
  { background: "bg-yellow-background", foreground: "text-yellow-foreground" },
  { background: "bg-orange-background", foreground: "text-orange-foreground" },
  { background: "bg-red-background", foreground: "text-red-foreground" },
  { background: "bg-pink-background", foreground: "text-pink-foreground" },
] as const

export function RecipientAvatar({
  className,
  recipient,
  size = "lg",
}: {
  className?: string
  recipient: RecipientAvatarIdentity | null
  size?: ComponentProps<typeof Avatar>["size"]
}) {
  const identity = recipient?.company?.trim() || recipient?.name?.trim() || "Lightsite"
  const fallback = identity.charAt(0).toUpperCase() || "L"
  const color = fallbackColors[stableHash(identity) % fallbackColors.length]
  const logoUrl = getRecipientLogoUrl(recipient?.website)

  return (
    <Avatar className={className} size={size} shape="square">
      {logoUrl ? <AvatarImage alt="" src={logoUrl} /> : null}
      <AvatarFallback className={cn(color.background, color.foreground, "font-medium")}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}

function stableHash(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}
