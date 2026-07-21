import { useState, type ReactNode, type SetStateAction } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconLock } from "@tabler/icons-react"
import type { WorkspacePlan } from "@handout/contracts"
import {
  HANDOUT_PRIVACY_POLICY_URL,
  type SiteContent,
  type SiteTrackingConsentPopup,
} from "@handout/site-document"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  getTrackingV2SiteSettings,
  updateTrackingV2SiteSettings,
} from "@/features/tracking/api"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { cn } from "@/lib/utils"

import { trackingConsentOptions } from "../model"

type TrackingSettingsProps = {
  canManage: boolean
  content: SiteContent
  onChange: (content: SetStateAction<SiteContent>) => void
  plan: WorkspacePlan
  siteId: string
  workspaceId: string
}

export function TrackingSettings({
  canManage,
  content,
  onChange,
  plan,
  siteId,
  workspaceId,
}: TrackingSettingsProps) {
  const queryClient = useQueryClient()
  const [agreementOpen, setAgreementOpen] = useState(false)
  const settingsQuery = useQuery({
    queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
    queryFn: ({ signal }) => getTrackingV2SiteSettings(workspaceId, siteId, signal),
    enabled: Boolean(workspaceId && siteId),
  })
  const currentTracking = settingsQuery.data
    ? settingsQuery.data.siteOverride ?? settingsQuery.data.effective
    : null
  const activityMutation = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!currentTracking) throw new Error("Tracking settings are not ready.")
      return updateTrackingV2SiteSettings(workspaceId, siteId, {
        ...currentTracking,
        enabled,
        ...(!enabled ? { recordingEnabled: false } : {}),
        ...(enabled && currentTracking.recordingEnabled
          ? { recordingDisclosureAccepted: true }
          : {}),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
      })
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Activity tracking could not be updated.")),
  })
  const replayMutation = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!currentTracking) throw new Error("Tracking settings are not ready.")
      return updateTrackingV2SiteSettings(workspaceId, siteId, {
        ...currentTracking,
        enabled: enabled ? true : currentTracking.enabled,
        recordingEnabled: enabled,
        ...(enabled ? { recordingDisclosureAccepted: true } : {}),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
      })
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Session replay could not be updated.")),
  })
  const trackingEnabled = activityMutation.isPending
    ? activityMutation.variables
    : currentTracking?.enabled ?? false
  const isPro = plan === "pro"
  const replayAvailable = isPro && settingsQuery.data?.recordingAvailable === true
  const replayEnabled = replayMutation.isPending
    ? replayMutation.variables
    : replayAvailable && (currentTracking?.recordingEnabled ?? false)
  const selectedConsent =
    trackingConsentOptions.find(
      (option) => option.value === content.settings.trackingConsentPopup,
    ) ?? trackingConsentOptions[0]
  const updateSettings = (settings: Partial<SiteContent["settings"]>) => {
    onChange((currentContent) => ({
      ...currentContent,
      settings: { ...currentContent.settings, ...settings },
    }))
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h2 className="text-sm leading-5 font-medium text-foreground">Tracking</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          Track sessions and visitor actions
        </p>
      </div>

      <Card className="gap-0 overflow-hidden rounded-xl bg-card py-0 ring-1 ring-border-subtle">
        <SettingRow
          description="Track visitor actions on the site"
          title="Activity tracking"
          control={
            settingsQuery.isLoading ? (
              <Skeleton className="h-[18px] w-7 rounded-full" />
            ) : (
              <Switch
                aria-label="Activity tracking"
                checked={trackingEnabled}
                disabled={!canManage || !currentTracking || activityMutation.isPending}
                size="compact"
                onCheckedChange={(checked) => activityMutation.mutate(checked)}
              />
            )
          }
        />
        <SettingRow
          className="border-t border-border-subtle"
          description={
            !isPro
              ? "Watch how visitors use the site"
              : replayAvailable
                ? "Watch how visitors use the site"
                : "Replay storage is not configured for this environment."
          }
          disabled={!replayAvailable}
          title="Session replay"
          badge={
            !isPro ? (
              <Badge className="bg-blue-background text-blue-foreground" variant="secondary">
                <IconLock data-icon="inline-start" />
                Upgrade
              </Badge>
            ) : null
          }
          control={
            <Switch
              aria-label="Session replay"
              checked={replayEnabled}
              disabled={
                !canManage || !replayAvailable || !currentTracking || replayMutation.isPending
              }
              size="compact"
              onCheckedChange={(checked) => {
                if (!checked) {
                  replayMutation.mutate(false)
                  return
                }
                setAgreementOpen(true)
              }}
            />
          }
        />
      </Card>

      <Field className="gap-3">
        <div>
          <FieldTitle>Tracking consent popup</FieldTitle>
          <FieldDescription>
            Ask visitor tracking consent before they enter the site.
          </FieldDescription>
        </div>
        <Select
          value={content.settings.trackingConsentPopup}
          onValueChange={(value) =>
            updateSettings({ trackingConsentPopup: value as SiteTrackingConsentPopup })
          }
        >
          <SelectTrigger
            aria-label="Tracking consent popup"
            className="h-[60px]! w-full rounded-[12px] px-3 py-0!"
          >
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="text-sm leading-5 font-medium text-foreground">
                {selectedConsent.label}
              </span>
              <span className="line-clamp-2 text-xs leading-4 whitespace-normal text-muted-foreground">
                {selectedConsent.description}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent align="end" className="w-[336px]" position="popper">
            {trackingConsentOptions.map((option) => (
              <SelectItem
                key={option.value}
                className="py-2"
                disabled={replayEnabled && option.value === "none"}
                value={option.value}
              >
                <span className="flex flex-col items-start">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {content.settings.trackingConsentPopup === "none" ? null : (
          <ConsentPopupPreview
            variant={content.settings.trackingConsentPopup}
          />
        )}
      </Field>
      <ReplayAgreementDialog
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        onAgree={() => {
          replayMutation.mutate(true)
          setAgreementOpen(false)
        }}
      />
    </div>
  )
}

function SettingRow({
  badge,
  className,
  control,
  description,
  disabled = false,
  title,
}: {
  badge?: ReactNode
  className?: string
  control: ReactNode
  description: string
  disabled?: boolean
  title: string
}) {
  return (
    <Field
      className={cn("h-16 items-center gap-2.5 px-4 py-3", className)}
      data-disabled={disabled || undefined}
      orientation="horizontal"
    >
      <div>{control}</div>
      <FieldContent className={disabled ? "opacity-60" : undefined}>
        <div className="flex items-center gap-2">
          <FieldTitle>{title}</FieldTitle>
          {badge}
        </div>
        <FieldDescription className="text-sm leading-5">{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

export function ConsentPopupPreview({ variant }: {
  variant: Exclude<SiteTrackingConsentPopup, "none">
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border bg-card py-4 pr-3 pl-4">
      <div className="mx-auto flex w-full max-w-[324px] flex-col gap-3 rounded-xl border bg-popover px-3 pt-2 pb-3">
        <div className="flex w-full flex-col items-center gap-0.5">
          <div className="flex w-full items-center py-[4.1px]">
            <h3 className="text-xs leading-4 font-medium">We value your privacy</h3>
          </div>
          <p className="text-[10px] leading-[13.667px] text-tertiary-foreground">
            This site uses cookies and other technology upon consent to help the owner understand
            how you use it, including session behavior and where you click and scroll. By selecting
            {" "}Allow and proceed, you consent to this as described in the{" "}
            <a
              className="cursor-pointer underline underline-offset-1"
              href={HANDOUT_PRIVACY_POLICY_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Privacy Policy
            </a>
            .
            {variant === "popup-a" ? (
              <>
                {" "}You may decline and enter <span className="underline">here</span>.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-[4.1px]">
          {variant === "popup-b" ? (
            <Button
              className="h-[22px] flex-1 rounded-[6.834px] px-2 text-[9.567px]"
              variant="outline"
            >
              Deny and proceed
            </Button>
          ) : null}
          <Button className="h-[22px] flex-1 rounded-[6.834px] px-2 text-[9.567px]">
            Allow and proceed
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ReplayAgreementDialog({
  onAgree,
  onOpenChange,
  open,
}: {
  onAgree: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [agreed, setAgreed] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setAgreed(false)
      }}
    >
      <DialogContent className="h-[549px] max-h-[calc(100svh-24px)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 rounded-2xl px-4 pt-2 pb-4 sm:max-w-[440px]">
        <DialogHeader className="gap-0.5 pr-8">
          <DialogTitle className="leading-6">Enable session replay?</DialogTitle>
          <DialogDescription className="leading-5">
            You must read and agree to the following before proceeding.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 rounded-xl border bg-card">
          <div className="space-y-3 p-4 text-sm leading-5 text-tertiary-foreground">
            <p>
              Session replay captures visible non-masked page content, clicks, cursor movement,
              scrolling, viewport changes, and timing.
            </p>
            <p>By enabling session replay, you and the organization you represent agree that:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                You are solely responsible for determining and complying with all laws applicable
                to you, your sites, your recipients, and your use of session replay, including
                privacy, data protection, cookie and similar-technology, wiretap, and electronic
                communications laws.
              </li>
              <li>
                Before recording begins, you will give each recipient clear and conspicuous notice
                and obtain their freely given, specific, informed, unambiguous, and affirmative
                consent.
              </li>
              <li>
                Your notice will explain what is recorded, why it is recorded, how it is used and
                retained, and that Handout processes the recording on your behalf.
              </li>
              <li>
                You will retain verifiable evidence of who consented, when and how they consented,
                and the notice presented to them. You will make withdrawal as easy as consent and
                promptly stop recording and honor applicable privacy requests.
              </li>
              <li>
                You will not use session replay on services directed to children or where
                recordings may contain sensitive or regulated information, credentials, payment
                information, health information, or other content prohibited by Handout’s policies.
              </li>
              <li>
                You are responsible for your sites, notices, consent process, privacy policy, replay
                configuration, authorized users, recordings, exports, and anyone with whom you share
                them. Handout does not provide legal advice or determine whether your use is lawful.
              </li>
              <li>
                Handout may suspend or disable session replay where it reasonably believes your use
                violates these requirements, applicable law, or third-party rights.
              </li>
            </ul>
            <p>
              To the maximum extent permitted by law, you and your organization agree to defend,
              indemnify, and hold harmless Handout, its affiliates, and their personnel from claims,
              investigations, proceedings, penalties, fines, damages, losses, liabilities, costs,
              and reasonable legal fees arising from your use or misuse of session replay, your
              content or configuration, your failure to obtain or document valid consent, or your
              violation of applicable law or third-party rights.
            </p>
          </div>
        </ScrollArea>
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border bg-card p-4 text-sm leading-5">
          <Checkbox
            checked={agreed}
            className="mt-0.5"
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <span>
            I’m authorized to act for my organization and agree to the above, Session Replay
            Addendum, and Terms of Service.
          </span>
        </label>
        <DialogFooter className="-mx-4 -mb-4 rounded-b-2xl bg-transparent px-4 pt-3 pb-4 sm:flex-col">
          <Button className="w-full" disabled={!agreed} onClick={onAgree}>
            Agree and enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
