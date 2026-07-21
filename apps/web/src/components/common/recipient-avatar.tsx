import { useEffect, useState, type ComponentProps } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDevAuthBypassHeaders } from "@/lib/api/dev-auth-bypass"
import { getRecipientLogoUrl } from "@/lib/recipient-logo"
import { cn } from "@/lib/utils"

type RecipientAvatarIdentity = {
  company?: string | null
  imageUrl?: string | null
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
] as const

const recipientLogoRequests = new Map<string, Promise<string | null>>()

export function RecipientAvatar({
  className,
  recipient,
  shape = "square",
  size = "lg",
}: {
  className?: string
  recipient: RecipientAvatarIdentity | null
  shape?: ComponentProps<typeof Avatar>["shape"]
  size?: ComponentProps<typeof Avatar>["size"]
}) {
  const identity = recipient?.company?.trim() || recipient?.name?.trim() || "Handout"
  const fallback = identity.charAt(0).toUpperCase() || "L"
  const color = fallbackColors[stableHash(identity) % fallbackColors.length]
  const logoUrl = getRecipientLogoUrl(recipient?.website)
  const imageUrl = recipient?.imageUrl?.trim() || null

  if (imageUrl) {
    return (
      <RecipientAvatarFrame
        className={className}
        color={color}
        fallback={fallback}
        imageUrl={imageUrl}
        shape={shape}
        size={size}
      />
    )
  }

  if (logoUrl) {
    return (
      <FetchedRecipientAvatar
        key={logoUrl}
        className={className}
        color={color}
        fallback={fallback}
        logoUrl={logoUrl}
        shape={shape}
        size={size}
      />
    )
  }

  return (
    <RecipientAvatarFrame
      className={className}
      color={color}
      fallback={fallback}
      imageUrl={null}
      shape={shape}
      size={size}
    />
  )
}

function FetchedRecipientAvatar({
  className,
  color,
  fallback,
  logoUrl,
  shape,
  size,
}: {
  className?: string
  color: (typeof fallbackColors)[number]
  fallback: string
  logoUrl: string
  shape: ComponentProps<typeof Avatar>["shape"]
  size: ComponentProps<typeof Avatar>["size"]
}) {
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void getRecipientLogoDataUrl(logoUrl).then((dataUrl) => {
      if (active) setResolvedLogoUrl(dataUrl)
    })

    return () => {
      active = false
    }
  }, [logoUrl])

  return (
    <RecipientAvatarFrame
      className={className}
      color={color}
      fallback={fallback}
      imageUrl={resolvedLogoUrl}
      shape={shape}
      size={size}
    />
  )
}

function RecipientAvatarFrame({
  className,
  color,
  fallback,
  imageUrl,
  shape,
  size,
}: {
  className?: string
  color: (typeof fallbackColors)[number]
  fallback: string
  imageUrl: string | null
  shape: ComponentProps<typeof Avatar>["shape"]
  size: ComponentProps<typeof Avatar>["size"]
}) {
  return (
    <Avatar className={className} size={size} shape={shape}>
      {imageUrl ? (
        <AvatarImage alt="" src={imageUrl} />
      ) : null}
      <AvatarFallback className={cn(color.background, color.foreground, "font-medium")}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}

function getRecipientLogoDataUrl(logoUrl: string) {
  const existingRequest = recipientLogoRequests.get(logoUrl)
  if (existingRequest) return existingRequest

  const request = fetchRecipientLogoDataUrl(logoUrl).catch(() => null)
  recipientLogoRequests.set(logoUrl, request)
  return request
}

async function fetchRecipientLogoDataUrl(logoUrl: string) {
  const response = await fetch(logoUrl, {
    credentials: "include",
    headers: getDevAuthBypassHeaders(),
  })

  if (!response.ok) return null

  const contentType = response.headers.get("content-type") || "image/webp"
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ""

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }

  return `data:${contentType};base64,${btoa(binary)}`
}

function stableHash(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}
