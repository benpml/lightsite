import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconAlertTriangle, IconDeviceFloppy, IconRefresh, IconShieldCheck, IconVideo } from "@tabler/icons-react"
import type { TrackingV2TrackingSettings } from "@lightsite/tracking-schema"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { getTrackingV2SiteSettings, updateTrackingV2SiteSettings } from "./api"

type TrackingSiteSettingsPanelProps = {
  canManage: boolean
  siteId: string
  workspaceId: string
}

export function TrackingSiteSettingsPanel({
  canManage,
  siteId,
  workspaceId,
}: TrackingSiteSettingsPanelProps) {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
    queryFn: ({ signal }) => getTrackingV2SiteSettings(workspaceId, siteId, signal),
    enabled: workspaceId.length > 0 && siteId.length > 0,
  })
  const settings = settingsQuery.data

  if (settingsQuery.isLoading) {
    return <TrackingSiteSettingsLoadingState />
  }

  if (settingsQuery.isError || !settings) {
    return (
      <section className="flex flex-col gap-3">
        <TrackingPanelHeader />
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>Tracking settings could not be loaded</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(settingsQuery.error, "Tracking settings could not be loaded.")}
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="compact" onClick={() => void settingsQuery.refetch()}>
              <IconRefresh data-icon="inline-start" />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </section>
    )
  }

  const initialSettings = settings.siteOverride ?? settings.effective

  return (
    <TrackingSiteSettingsForm
      key={settingsSignature(initialSettings)}
      canManage={canManage}
      initialSettings={initialSettings}
      recordingDisclosureText={settings.recordingDisclosure.text}
      onSaved={async () => {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
        })
      }}
      siteId={siteId}
      workspaceId={workspaceId}
    />
  )
}

function TrackingSiteSettingsForm({
  canManage,
  initialSettings,
  onSaved,
  recordingDisclosureText,
  siteId,
  workspaceId,
}: {
  canManage: boolean
  initialSettings: TrackingV2TrackingSettings
  onSaved: () => Promise<void>
  recordingDisclosureText: string
  siteId: string
  workspaceId: string
}) {
  const [settings, setSettings] = useState<TrackingV2TrackingSettings>(initialSettings)
  const [recordingDisclosureAccepted, setRecordingDisclosureAccepted] = useState(initialSettings.recordingEnabled)
  const dirty = settingsSignature(settings) !== settingsSignature(initialSettings)
  const updateMutation = useMutation({
    mutationFn: () =>
      updateTrackingV2SiteSettings(workspaceId, siteId, {
        ...settings,
        ...(settings.recordingEnabled ? { recordingDisclosureAccepted } : {}),
      }),
    onSuccess: async () => {
      await onSaved()
      toast.success("Tracking settings saved")
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Tracking settings could not be saved."))
    },
  })
  const retentionBadges = useMemo(() => getRetentionBadges(settings), [settings])
  const disabled = !canManage || updateMutation.isPending

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TrackingPanelHeader />
        <Button
          size="compact"
          disabled={!canManage || !dirty || updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          <IconDeviceFloppy data-icon="inline-start" />
          Save
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        {!canManage ? (
          <Alert>
            <IconShieldCheck />
            <AlertTitle>Read only</AlertTitle>
            <AlertDescription>
              Workspace admins can change tracking settings.
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-0 divide-y rounded-lg border bg-background">
          <TrackingSwitchField
            checked={settings.enabled}
            disabled={disabled}
            description="Site visits, clicks, tab switches, shares, and webhooks."
            id="tracking-enabled"
            label="Activity tracking"
            onCheckedChange={(enabled) => {
              setSettings((current) => ({
                ...current,
                enabled,
              }))
            }}
          />
          <TrackingSwitchField
            checked={settings.captureIpAddress}
            disabled={disabled || !settings.enabled}
            description={`${settings.rawIpRetentionDays} day raw IP retention.`}
            id="tracking-ip-capture"
            label="Raw IP capture"
            onCheckedChange={(captureIpAddress) => {
              setSettings((current) => ({
                ...current,
                captureIpAddress,
              }))
            }}
          />
          <TrackingSwitchField
            checked={settings.recordingEnabled}
            disabled={disabled || !settings.enabled}
            description={`${formatDuration(settings.maxRecordingDurationSeconds)} cap per session.`}
            id="tracking-recording"
            label="Session recording"
            onCheckedChange={(recordingEnabled) => {
              setSettings((current) => ({
                ...current,
                recordingEnabled,
              }))
              setRecordingDisclosureAccepted(recordingEnabled || initialSettings.recordingEnabled)
            }}
          />
        </FieldGroup>

        <div className="flex flex-wrap gap-1.5">
          {retentionBadges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </div>

        {settings.recordingEnabled ? (
          <Alert>
            <IconVideo />
            <AlertTitle>Recording disclosure</AlertTitle>
            <AlertDescription>{recordingDisclosureText}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  )
}

function TrackingSwitchField({
  checked,
  description,
  disabled,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean
  description: string
  disabled: boolean
  id: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="items-center gap-3 px-3 py-3">
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

function TrackingPanelHeader() {
  return (
    <div className="flex min-w-0 flex-col">
      <h2 className="text-base leading-6 font-medium text-secondary-foreground">Tracking</h2>
      <p className="text-sm leading-5 text-muted-foreground">
        Site-level collection and recording controls
      </p>
    </div>
  )
}

function TrackingSiteSettingsLoadingState() {
  return (
    <section className="flex flex-col gap-3">
      <TrackingPanelHeader />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </section>
  )
}

function getRetentionBadges(settings: TrackingV2TrackingSettings) {
  return [
    `Events ${settings.eventRetentionDays}d`,
    `Raw IP ${settings.rawIpRetentionDays}d`,
    `Recordings ${settings.recordingRetentionDays}d`,
    `Recording cap ${formatDuration(settings.maxRecordingDurationSeconds)}`,
  ]
}

function formatDuration(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`
  }

  return `${seconds}s`
}

function settingsSignature(settings: TrackingV2TrackingSettings) {
  return JSON.stringify([
    settings.enabled,
    settings.captureIpAddress,
    settings.rawIpRetentionDays,
    settings.eventRetentionDays,
    settings.recordingEnabled,
    settings.recordingRetentionDays,
    settings.maxRecordingDurationSeconds,
  ])
}
