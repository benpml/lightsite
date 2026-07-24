import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconAlertTriangle, IconDeviceFloppy, IconPlus, IconRefresh, IconShieldCheck, IconTrash } from "@tabler/icons-react"
import type { TrackingV2TrackingSettings } from "@handout/tracking-schema"
import { toast } from "sonner"

import { LoadingState } from "@/components/common/loading-state"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import {
  createTrackingV2InternalIpRange,
  deleteTrackingV2InternalIpRange,
  getTrackingV2SiteSettings,
  listTrackingV2InternalIpRanges,
  updateTrackingV2SiteSettings,
} from "./api"

type TrackingSiteSettingsPanelProps = {
  canManage: boolean
  siteId: string
  workspaceId: string
}

const retentionOptions = [30, 90, 180, 365] as const

export function TrackingSiteSettingsPanel({ canManage, siteId, workspaceId }: TrackingSiteSettingsPanelProps) {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId),
    queryFn: ({ signal }) => getTrackingV2SiteSettings(workspaceId, siteId, signal),
    enabled: workspaceId.length > 0 && siteId.length > 0,
  })

  if (settingsQuery.isLoading) return <TrackingSiteSettingsLoadingState />
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <section className="flex flex-col gap-3">
        <TrackingPanelHeader />
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>Tracking settings could not be loaded</AlertTitle>
          <AlertDescription>{getApiErrorMessage(settingsQuery.error, "Tracking settings could not be loaded.")}</AlertDescription>
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

  const initialSettings = settingsQuery.data.siteOverride ?? settingsQuery.data.effective
  return (
    <TrackingSiteSettingsForm
      key={settingsSignature(initialSettings)}
      canManage={canManage}
      initialSettings={initialSettings}
      onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.trackingSiteSettings(workspaceId, siteId) })}
      siteId={siteId}
      workspaceId={workspaceId}
    />
  )
}

function TrackingSiteSettingsForm({
  canManage,
  initialSettings,
  onSaved,
  siteId,
  workspaceId,
}: {
  canManage: boolean
  initialSettings: TrackingV2TrackingSettings
  onSaved: () => Promise<unknown>
  siteId: string
  workspaceId: string
}) {
  const [settings, setSettings] = useState(initialSettings)
  const dirty = settingsSignature(settings) !== settingsSignature(initialSettings)
  const updateMutation = useMutation({
    mutationFn: () => updateTrackingV2SiteSettings(workspaceId, siteId, {
      ...settings,
      ...(settings.recordingEnabled ? { recordingDisclosureAccepted: true } : {}),
    }),
    onSuccess: async () => {
      await onSaved()
      toast.success("Tracking settings saved")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Tracking settings could not be saved.")),
  })
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
            <AlertDescription>Workspace admins can change tracking settings.</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-0 divide-y rounded-lg border bg-background">
          <Field orientation="horizontal" className="items-center gap-3 px-3 py-3">
            <Switch
              id="tracking-enabled"
              aria-label="Activity tracking"
              checked={settings.enabled}
              disabled={disabled}
              onCheckedChange={(enabled) => setSettings((current) => ({
                ...current,
                enabled,
                ...(!enabled ? { recordingEnabled: false } : {}),
              }))}
            />
            <FieldContent>
              <FieldTitle>Activity tracking</FieldTitle>
              <FieldDescription>Site opens and modeled button, link, tab, Slack preview, and webhook events.</FieldDescription>
            </FieldContent>
          </Field>

          <Field orientation="horizontal" className="items-center gap-3 px-3 py-3">
            <FieldContent>
              <FieldTitle>Retention</FieldTitle>
              <FieldDescription>Sessions and events are permanently removed after this period.</FieldDescription>
            </FieldContent>
            <Select
              value={String(settings.eventRetentionDays)}
              disabled={disabled}
              onValueChange={(value) => {
                const eventRetentionDays = Number(value) as TrackingV2TrackingSettings["eventRetentionDays"]
                setSettings((current) => ({ ...current, eventRetentionDays }))
              }}
            >
              <SelectTrigger className="w-32" aria-label="Tracking retention">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {retentionOptions.map((days) => <SelectItem key={days} value={String(days)}>{days} days</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <InternalTrafficSettings canManage={canManage} workspaceId={workspaceId} />

        <Alert>
          <IconShieldCheck />
          <AlertTitle>Privacy-safe collection</AlertTitle>
          <AlertDescription>
            Raw IP addresses, persistent device identifiers, page paths, referrers, typed values, and complete destinations are not stored. Location is approximate and may be unavailable.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  )
}

function InternalTrafficSettings({ canManage, workspaceId }: { canManage: boolean; workspaceId: string }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState("")
  const [cidr, setCidr] = useState("")
  const queryKey = queryKeys.trackingInternalIpRanges(workspaceId)
  const rangesQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => listTrackingV2InternalIpRanges(workspaceId, signal),
    enabled: workspaceId.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: () => createTrackingV2InternalIpRange(workspaceId, { label, cidr }),
    onSuccess: async () => {
      setLabel("")
      setCidr("")
      await queryClient.invalidateQueries({ queryKey })
      toast.success("Internal network saved")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Internal network could not be saved.")),
  })
  const deleteMutation = useMutation({
    mutationFn: (rangeId: string) => deleteTrackingV2InternalIpRange(workspaceId, rangeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success("Internal network removed")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Internal network could not be removed.")),
  })
  const pending = createMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium text-secondary-foreground">Internal traffic</h3>
        <p className="text-sm text-muted-foreground">
          Opens from these office or VPN networks are excluded. Team opens elsewhere may still be counted.
        </p>
      </div>

      {rangesQuery.isLoading ? (
        <LoadingState placement="compact" label="Loading internal networks" />
      ) : null}
      {rangesQuery.isError ? (
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>Internal networks could not be loaded</AlertTitle>
          <AlertAction>
            <Button variant="outline" size="icon-sm" aria-label="Retry internal networks" onClick={() => void rangesQuery.refetch()}>
              <IconRefresh />
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {rangesQuery.data?.ranges.map((range) => (
        <div key={range.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-secondary-foreground">{range.label}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{range.cidr}</p>
          </div>
          {canManage ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${range.label}`}
              disabled={pending}
              onClick={() => deleteMutation.mutate(range.id)}
            >
              <IconTrash />
            </Button>
          ) : null}
        </div>
      ))}

      {canManage ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            aria-label="Internal network label"
            placeholder="Office or VPN"
            value={label}
            disabled={pending}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Input
            aria-label="IP address or CIDR range"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="203.0.113.0/24"
            value={cidr}
            disabled={pending}
            onChange={(event) => setCidr(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={pending || !label.trim() || !cidr.trim()}
            onClick={() => createMutation.mutate()}
          >
            <IconPlus data-icon="inline-start" />
            Add
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function TrackingPanelHeader() {
  return (
    <div className="flex min-w-0 flex-col">
      <h2 className="text-base leading-6 font-medium text-secondary-foreground">Tracking</h2>
      <p className="text-sm leading-5 text-muted-foreground">Site-level activity and retention controls</p>
    </div>
  )
}

function TrackingSiteSettingsLoadingState() {
  return (
    <section className="flex flex-col gap-3">
      <TrackingPanelHeader />
      <LoadingState placement="section" label="Loading tracking settings" />
    </section>
  )
}

function settingsSignature(settings: TrackingV2TrackingSettings) {
  return [
    settings.enabled,
    settings.eventRetentionDays,
    settings.recordingEnabled,
    settings.recordingRetentionDays,
    settings.maxRecordingDurationSeconds,
  ].join(":")
}
