import type { ComponentProps, ReactNode } from "react"
import {
  IconRefresh,
  type TablerIcon,
} from "@tabler/icons-react"

import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PublicSiteRenderer } from "@/features/public-site/public-site-renderer"
import { cn } from "@/lib/utils"
import type { SiteRecipient } from "@/features/editor/recipients/recipient-model"

import type { createSitePreviewPayload } from "../site-preview-payload"

type SitePreviewPayload = ReturnType<typeof createSitePreviewPayload>

export function SiteDetailPreviewCard({
  isError,
  isLoading,
  onRetry,
  payload,
}: {
  isError: boolean
  isLoading: boolean
  onRetry: () => void
  payload: SitePreviewPayload | null
}) {
  return (
    <div className="relative h-[150px] overflow-hidden rounded-xl border bg-card p-4">
      {isLoading ? <Skeleton className="h-full w-full rounded-lg" /> : null}
      {isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Preview unavailable</p>
          <Button variant="outline" size="xs" onClick={onRetry}>
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        </div>
      ) : null}
      {payload ? (
        <SitePreviewDocumentFrame
          canvasClassName="scale-[0.2347]"
          className="absolute top-5 left-1/2 h-[236px] w-[169px] -translate-x-1/2 rounded-[10px]"
          payload={payload}
        />
      ) : null}
    </div>
  )
}

export function SitePreviewDocumentFrame({
  canvasClassName,
  className,
  loading,
  payload,
}: {
  canvasClassName: string
  className?: string
  loading?: ComponentProps<"iframe">["loading"]
  payload: SitePreviewPayload
}) {
  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden border bg-background shadow-xs",
        className
      )}
    >
      <div className={cn("h-[1008px] w-[720px] origin-top-left", canvasClassName)}>
        <PublicSiteRenderer loading={loading} payload={payload} />
      </div>
    </div>
  )
}

export function DetailMetadataRow({
  icon: Icon,
  label,
  labelWidth = "w-[100px]",
  value,
}: {
  icon: TablerIcon
  label: string
  labelWidth?: string
  value: ReactNode
}) {
  return (
    <div className="flex min-h-[22px] items-center gap-4 text-sm leading-5">
      <div className={`flex ${labelWidth} shrink-0 items-center gap-1.5 text-tertiary-foreground [&_svg]:size-3.5`}>
        <Icon />
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1 text-secondary-foreground">{value}</div>
    </div>
  )
}

export function ActivityBadge({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <Badge
      variant="outline"
      className={active ? "border-border text-foreground" : undefined}
    >
      {active ? <span className="size-1.5 rounded-full bg-variable-foreground" /> : null}
      {children}
    </Badge>
  )
}

export function RecipientLogoAvatar({
  recipient,
  size = "lg",
}: {
  recipient: SiteRecipient
  size?: ComponentProps<typeof Avatar>["size"]
}) {
  return (
    <RecipientAvatar recipient={recipient} size={size} />
  )
}

export function UserAvatar({ size = "2xs" }: { size?: ComponentProps<typeof Avatar>["size"] }) {
  return (
    <Avatar size={size}>
      <AvatarFallback>J</AvatarFallback>
    </Avatar>
  )
}
