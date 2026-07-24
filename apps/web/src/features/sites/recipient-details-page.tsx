import { useId, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import {
  IconActivity,
  IconBolt,
  IconBrandSlack,
  IconCalendarPlus,
  IconCalendarStats,
  IconChevronLeft,
  IconClick,
  IconCode,
  IconCopy,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDotsVertical,
  IconExternalLink,
  IconEye,
  IconFile,
  IconLink,
  IconPencil,
  IconPlayerPlay,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import type { SiteDetailResponse } from "@handout/contracts"
import type {
  TrackingV2EventFeedItem,
  TrackingV2SessionSummary,
} from "@handout/tracking-schema"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/common/loading-state"
import { TrackingEventCountBadge } from "@/components/data-display/tracking-event-count-badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActiveWorkspace, useAppBootstrap } from "@/features/app-bootstrap/app-bootstrap-hooks"
import {
  buildRecipientPublicUrl,
  createRecipientEmailEmbedHtml,
  normalizeOptionalRecipientWebsite,
  type SiteRecipient,
} from "@/features/editor/recipients/recipient-model"
import { useSiteRecipients } from "@/features/editor/recipients/use-site-recipients"
import { editorVariables } from "@/features/editor/tiptap/variables"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { getSite, getSiteContent } from "./api"
import {
  DetailMetadataRow,
  RecipientLogoAvatar,
  SiteDetailPreviewCard,
  UserAvatar,
} from "./components/site-detail-ui"
import { formatFullDateTime, formatRelativeTime } from "./site-date-format"
import { createSitePreviewPayload } from "./site-preview-payload"
import {
  getTrackingDashboardActivity,
  getTrackingV2Session,
  listTrackingV2Events,
} from "../tracking/api"
import { TrackingDetailsDrawer } from "../tracking/tracking-details-drawer"
import {
  toEventDrawerData,
  toSessionDrawerData,
  type TrackingEventDrawerData,
} from "../tracking/tracking-details-model"

const customRecipientVariables = editorVariables.filter(
  (variable) =>
    variable.id !== "recipient-name" &&
    variable.id !== "recipient-company" &&
    variable.id !== "recipient_website"
)

export function RecipientDetailsPage() {
  const params = useParams({ strict: false })
  const siteId = "siteId" in params && typeof params.siteId === "string" ? params.siteId : ""
  const recipientId =
    "recipientId" in params && typeof params.recipientId === "string" ? params.recipientId : ""
  const activeWorkspace = useActiveWorkspace()
  const bootstrap = useAppBootstrap()
  const [editOpen, setEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TrackingEventDrawerData | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [eventReturnsToSession, setEventReturnsToSession] = useState(false)
  const [sessionBackEvent, setSessionBackEvent] = useState<TrackingEventDrawerData | null>(null)
  const siteQuery = useQuery({
    queryKey: queryKeys.site(activeWorkspace.id, siteId),
    queryFn: ({ signal }) => getSite(siteId, signal),
    enabled: siteId.length > 0,
  })
  const siteContentQuery = useQuery({
    queryKey: queryKeys.siteContent(activeWorkspace.id, siteId),
    queryFn: ({ signal }) => getSiteContent(siteId, signal),
    enabled: siteId.length > 0,
  })
  const trackingQuery = useQuery({
    queryKey: queryKeys.trackingDashboard(activeWorkspace.id, { recipientId, siteId }),
    queryFn: ({ signal }) => getTrackingDashboardActivity(
      activeWorkspace.id,
      { recipientId, siteId },
      signal
    ),
    enabled: siteId.length > 0 && recipientId.length > 0,
  })
  const sessionDetailQuery = useQuery({
    queryKey: queryKeys.trackingSession(activeWorkspace.id, selectedSessionId ?? ""),
    queryFn: ({ signal }) => getTrackingV2Session(
      activeWorkspace.id,
      selectedSessionId ?? "",
      signal
    ),
    enabled: selectedSessionId !== null,
  })
  const sessionEventsQuery = useQuery({
    queryKey: queryKeys.trackingSessionEvents(activeWorkspace.id, selectedSessionId ?? ""),
    queryFn: ({ signal }) => listTrackingV2Events(
      activeWorkspace.id,
      { limit: 100, sessionId: selectedSessionId ?? "" },
      signal
    ),
    enabled: selectedSessionId !== null,
  })
  const {
    error: recipientsError,
    isLoading: recipientsLoading,
    recipients,
    siteUri,
    updateRecipient,
  } = useSiteRecipients({
    siteId,
    siteUri: siteQuery.data?.site
      ? `${activeWorkspace.slug}/${siteQuery.data.site.slug}`
      : undefined,
    workspaceId: activeWorkspace.id,
  })
  const site = siteQuery.data?.site
  const recipient = recipients.find((item) => item.id === recipientId) ?? null
  const trackingEvents = useMemo(() => trackingQuery.data?.events ?? [], [trackingQuery.data?.events])
  const trackingSessions = useMemo(() => trackingQuery.data?.sessions ?? [], [trackingQuery.data?.sessions])
  const selectedSessionFallback = useMemo(
    () => trackingSessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, trackingSessions]
  )
  const selectedSession = sessionDetailQuery.data?.session ?? selectedSessionFallback
  const selectedSessionEvents = useMemo(() => {
    if (sessionEventsQuery.data) return sessionEventsQuery.data.events
    if (!selectedSessionId) return []
    return trackingEvents.filter((event) => event.sessionId === selectedSessionId)
  }, [selectedSessionId, sessionEventsQuery.data, trackingEvents])
  const sessionDrawerEvents = useMemo(
    () => [...selectedSessionEvents]
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
      .map(toEventDrawerData),
    [selectedSessionEvents]
  )
  const sessionEventCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of trackingEvents) {
      if (event.sessionId) counts.set(event.sessionId, (counts.get(event.sessionId) ?? 0) + 1)
    }
    return counts
  }, [trackingEvents])
  const draftContent = siteContentQuery.data?.draftContent
  const recipientPublicUrl =
    recipient ? buildRecipientPublicUrl({ recipient, siteUri }) : "https://handout.link/site/recipient"
  const recipientDisplayUrl = recipientPublicUrl.replace(/^https?:\/\//, "")
  const previewPayload = useMemo(() => {
    if (!site || !draftContent || !recipient) {
      return null
    }

    const basePayload = createSitePreviewPayload({
      content: draftContent,
      site,
      workspace: activeWorkspace,
    })

    return {
      ...basePayload,
      selectedVariant: {
        id: recipient.id,
        slug: recipient.linkSlug,
        name: `${recipient.name} @ ${recipient.company}`,
        recipientCompany: recipient.company,
        recipientName: recipient.name,
        revisionNumber: 1,
        variableValues: {
          ...recipient.values,
          "recipient-company": recipient.company,
          "recipient-name": recipient.name,
          recipient_website: recipient.website,
        },
      },
    }
  }, [activeWorkspace, draftContent, recipient, site])

  if (siteQuery.isLoading || recipientsLoading) {
    return <RecipientDetailsLoadingState />
  }

  if (siteQuery.isError || recipientsError || !site) {
    return (
      <RecipientDetailsErrorState
        message={getApiErrorMessage(siteQuery.error ?? recipientsError, "Recipient details could not be loaded.")}
        onRetry={() => void siteQuery.refetch()}
      />
    )
  }

  if (!recipient) {
    return (
      <RecipientDetailsErrorState
        message="This recipient could not be found for the current site."
        onRetry={() => undefined}
      />
    )
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(recipientPublicUrl)
    toast.success("Recipient link copied")
  }

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(
      createRecipientEmailEmbedHtml({ recipient, siteUri })
    )
    toast.success("Email embed copied")
  }

  return (
    <div className="flex min-h-full flex-col px-6 pt-5 pb-6">
      <div className="mx-auto flex w-full max-w-[695px] flex-col">
        <div className="flex h-[30px] items-center gap-2">
          <Button asChild variant="ghost" size="icon-field" aria-label={`Back to ${site.name}`}>
            <Link to="/sites/$siteId" params={{ siteId }}>
              <IconChevronLeft />
            </Link>
          </Button>
          <Link
            to="/sites/$siteId"
            params={{ siteId }}
            className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground"
          >
            Back
          </Link>
          <RecipientDetailsOverflowMenu
            onCopyLink={() => void copyLink()}
            onEdit={() => setEditOpen(true)}
            recipient={recipient}
          />
        </div>

        <div className="mx-auto mt-7 flex w-full max-w-[640px] flex-col gap-9">
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-[240px] flex-1 basis-0 items-start gap-3">
                <RecipientLogoAvatar recipient={recipient} size="xl" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <h1 className="truncate text-xl leading-7 font-medium tracking-normal text-foreground">
                    {recipient.name} @ {recipient.company}
                  </h1>
                  <p className="truncate text-sm leading-5 text-tertiary-foreground">
                    {recipientDisplayUrl}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-[341px] sm:flex-none sm:flex-nowrap sm:justify-end sm:pt-[9px]">
                <Button variant="outline" size="compact" className="sm:w-16" onClick={() => setEditOpen(true)}>
                  <IconPencil data-icon="inline-start" />
                  Edit
                </Button>
                <Button asChild variant="outline" size="compact" className="sm:w-[74px]">
                  <a href={recipientPublicUrl} target="_blank" rel="noreferrer">
                    <IconExternalLink data-icon="inline-start" />
                    Open
                  </a>
                </Button>
                <Button variant="outline" size="compact" className="sm:w-[83px]" onClick={() => void copyEmbed()}>
                  <IconCode data-icon="inline-start" />
                  Embed
                </Button>
                <Button size="compact" className="sm:w-24" onClick={() => void copyLink()}>
                  <IconLink data-icon="inline-start" />
                  Copy link
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[216px_minmax(0,1fr)]">
              <SiteDetailPreviewCard
                isError={siteContentQuery.isError}
                isLoading={siteContentQuery.isLoading}
                onRetry={() => void siteContentQuery.refetch()}
                payload={previewPayload}
              />
              <RecipientMetadataCard
                activityCount={trackingEvents.length}
                author={{
                  avatarUrl: bootstrap.user.avatarUrl,
                  name: bootstrap.user.name?.trim() || bootstrap.user.email,
                }}
                recipient={recipient}
                site={site}
              />
            </div>
          </section>

          <SessionsSection
            error={trackingQuery.error}
            eventCounts={sessionEventCounts}
            isLoading={trackingQuery.isLoading}
            onSelectSession={(session) => {
              setSelectedEvent(null)
              setEventReturnsToSession(false)
              setSessionBackEvent(null)
              setSelectedSessionId(session.id)
            }}
            onRetry={() => void trackingQuery.refetch()}
            sessions={trackingSessions}
          />
          <EventsSection
            error={trackingQuery.error}
            events={trackingEvents}
            isLoading={trackingQuery.isLoading}
            onSelectEvent={(event) => {
              setSelectedSessionId(null)
              setEventReturnsToSession(false)
              setSessionBackEvent(null)
              setSelectedEvent(toEventDrawerData(event))
            }}
            onRetry={() => void trackingQuery.refetch()}
          />
        </div>
      </div>

      <EditRecipientDialog
        onOpenChange={setEditOpen}
        onUpdate={async (input) => {
          await updateRecipient(recipient.id, input)
          toast.success("Recipient updated")
        }}
        open={editOpen}
        recipient={recipient}
      />
      <TrackingDetailsDrawer
        error={sessionDetailQuery.error || sessionEventsQuery.error
          ? getApiErrorMessage(
              sessionDetailQuery.error ?? sessionEventsQuery.error,
              "Session details could not be loaded."
            )
          : null}
        event={selectedEvent}
        events={sessionDrawerEvents}
        isLoading={sessionDetailQuery.isFetching && !sessionDetailQuery.data}
        onBackToEvent={sessionBackEvent
          ? () => {
              setSelectedSessionId(null)
              setSelectedEvent(sessionBackEvent)
              setSessionBackEvent(null)
            }
          : undefined}
        onBackToSession={selectedEvent && eventReturnsToSession
          ? () => {
              setSelectedEvent(null)
              setEventReturnsToSession(false)
            }
          : undefined}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null)
            setSelectedSessionId(null)
            setEventReturnsToSession(false)
            setSessionBackEvent(null)
          }
        }}
        onSelectEvent={(event) => {
          setSelectedEvent(event)
          setEventReturnsToSession(true)
        }}
        onViewFullSession={(event) => {
          if (eventReturnsToSession) {
            setSelectedEvent(null)
            setEventReturnsToSession(false)
            return
          }

          setSessionBackEvent(event)
          setSelectedEvent(null)
          if (event.sessionId) setSelectedSessionId(event.sessionId)
        }}
        onRetry={() => {
          void sessionDetailQuery.refetch()
          void sessionEventsQuery.refetch()
        }}
        open={selectedEvent !== null || selectedSessionId !== null}
        session={selectedSession ? toSessionDrawerData(selectedSession) : null}
      />
    </div>
  )
}

function RecipientDetailsOverflowMenu({
  onCopyLink,
  onEdit,
  recipient,
}: {
  onCopyLink: () => void
  onEdit: () => void
  recipient: SiteRecipient
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-field" aria-label={`Actions for ${recipient.name}`}>
          <IconDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onEdit}>
            <IconPencil />
            Edit recipient
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyLink}>
            <IconCopy />
            Copy link
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RecipientMetadataCard({
  activityCount,
  author,
  recipient,
  site,
}: {
  activityCount: number
  author: { avatarUrl?: string | null; name: string }
  recipient: SiteRecipient
  site: SiteDetailResponse["site"]
}) {
  return (
    <div className="flex h-[150px] min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4">
      <DetailMetadataRow
        icon={IconActivity}
        label="Activity"
        value={<TrackingEventCountBadge count={activityCount} />}
      />
      <DetailMetadataRow
        icon={IconPencil}
        label="Author"
        value={
          <span className="flex min-w-0 items-center gap-1">
            <UserAvatar avatarUrl={author.avatarUrl} name={author.name} />
            <span className="truncate">{author.name}</span>
          </span>
        }
      />
      <DetailMetadataRow
        icon={IconCalendarPlus}
        label="Created"
        value={formatFullDateTime(recipient.createdAt || site.createdAt)}
      />
      <DetailMetadataRow
        icon={IconCalendarStats}
        label="Updated"
        value={formatFullDateTime(recipient.updatedAt || site.updatedAt)}
      />
    </div>
  )
}

function SessionsSection({
  error,
  eventCounts,
  isLoading,
  onSelectSession,
  onRetry,
  sessions,
}: {
  error: unknown
  eventCounts: Map<string, number>
  isLoading: boolean
  onSelectSession: (session: TrackingV2SessionSummary) => void
  onRetry: () => void
  sessions: TrackingV2SessionSummary[]
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Sessions"
        description="Actions tracked for this recipient site."
      />
      {isLoading ? (
        <TrackingSectionLoading />
      ) : error ? (
        <TrackingSectionError message="Sessions could not be loaded." onRetry={onRetry} />
      ) : sessions.length === 0 ? (
        <TrackingSectionEmpty message="No sessions have been recorded for this recipient." />
      ) : (
        <Table className="table-fixed border-separate border-spacing-y-0.5">
          <colgroup>
            <col className="w-[136px]" />
            <col className="w-[136px]" />
            <col className="w-[136px]" />
            <col className="w-[136px]" />
            <col className="w-[96px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Duration</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&:before]:block [&:before]:h-2 [&:before]:content-[''] [&_tr:last-child]:border-0">
            {sessions.map((session) => (
              <SessionRow
                eventCount={eventCounts.get(session.id) ?? 0}
                key={session.id}
                onSelectSession={onSelectSession}
                session={session}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function EventsSection({
  error,
  events,
  isLoading,
  onSelectEvent,
  onRetry,
}: {
  error: unknown
  events: TrackingV2EventFeedItem[]
  isLoading: boolean
  onSelectEvent: (event: TrackingV2EventFeedItem) => void
  onRetry: () => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Events"
        description="Actions tracked for this recipient site."
      />
      {isLoading ? (
        <TrackingSectionLoading />
      ) : error ? (
        <TrackingSectionError message="Events could not be loaded." onRetry={onRetry} />
      ) : events.length === 0 ? (
        <TrackingSectionEmpty message="No events have been recorded for this recipient." />
      ) : (
        <Table className="table-fixed border-separate border-spacing-y-0.5">
          <colgroup>
            <col className="w-[260px]" />
            <col />
            <col className="w-[112px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&:before]:block [&:before]:h-2 [&:before]:content-[''] [&_tr:last-child]:border-0">
            {events.map((event) => {
              const drawerEvent = toEventDrawerData(event)

              return (
                <TableRow
                  key={event.id}
                  className="group h-11 cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectEvent(event)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return
                    keyboardEvent.preventDefault()
                    onSelectEvent(event)
                  }}
                >
                  <TableCell className="rounded-l-lg py-2 pr-2 pl-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    <div className="flex min-w-0 items-center gap-4 text-sm leading-5 font-medium text-foreground">
                      <TrackingEventIcon event={event} />
                      <span className="truncate">{drawerEvent.action}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-sm leading-5 text-secondary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    <span className="block truncate">{drawerEvent.details}</span>
                  </TableCell>
                  <TableCell className="rounded-r-lg py-2 pr-3 text-right text-sm leading-5 text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    {formatRelativeTime(event.occurredAt)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function SessionRow({
  eventCount,
  onSelectSession,
  session,
}: {
  eventCount: number
  onSelectSession: (session: TrackingV2SessionSummary) => void
  session: TrackingV2SessionSummary
}) {
  return (
    <TableRow
      className="group h-11 cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
      role="button"
      tabIndex={0}
      onClick={() => onSelectSession(session)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelectSession(session)
        }
      }}
    >
      <TableCell className="rounded-l-lg py-2 pr-2 pl-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
        <div className="flex items-center gap-3 text-sm leading-5 font-medium">
          <EventIcon icon={IconActivity} />
          {formatTrackingDuration(session.durationMs ?? session.activeMs)}
        </div>
      </TableCell>
      <TableCell className="py-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
        <TrackingEventCountBadge count={eventCount} />
      </TableCell>
      <TableCell className="py-2 text-sm leading-5 text-secondary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
        <span className="flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5">
          {isMobileDevice(session.device.type) ? <IconDeviceMobile /> : <IconDeviceDesktop />}
          <span className="truncate">{formatDeviceLabel(session.device)}</span>
        </span>
      </TableCell>
      <TableCell className="py-2 text-sm leading-5 text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
        {formatRelativeTime(session.lastSeenAt)}
      </TableCell>
      <TableCell className="rounded-r-lg py-2 pr-3 text-right transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onSelectSession(session)
          }}
        >
          <IconPlayerPlay data-icon="inline-start" />
          Watch
        </Button>
      </TableCell>
    </TableRow>
  )
}

function SectionHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col">
      <h2 className="text-base leading-6 font-medium text-secondary-foreground">{title}</h2>
      <p className="text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function EventIcon({ icon: Icon }: { icon: typeof IconActivity }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-tertiary-foreground [&_svg]:size-3.5">
      <Icon />
    </span>
  )
}

function TrackingEventIcon({ event }: { event: TrackingV2EventFeedItem }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-tertiary-foreground [&_svg]:size-3.5">
      {event.type === "slack_share" ? (
        <IconBrandSlack />
      ) : event.type === "webhook_send" ? (
        <IconBolt />
      ) : event.type === "link_click" ? (
        <IconLink />
      ) : event.type === "button_click" ? (
        <IconClick />
      ) : event.type === "tab_switch" ? (
        <IconFile />
      ) : (
        <IconEye />
      )}
    </span>
  )
}

function TrackingSectionLoading() {
  return <LoadingState placement="compact" label="Loading recipient activity" />
}

function TrackingSectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Tracking could not be loaded</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="compact" onClick={onRetry}>
          <IconRefresh data-icon="inline-start" />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  )
}

function TrackingSectionEmpty({ message }: { message: string }) {
  return <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{message}</div>
}

function formatTrackingDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function formatDeviceLabel(device: TrackingV2SessionSummary["device"]) {
  return [device.type, device.os].filter(Boolean).join(", ") || "Unknown"
}

function isMobileDevice(deviceType: string | null) {
  return deviceType?.toLowerCase().includes("mobile") ?? false
}

type RecipientEditDraft = {
  company: string
  name: string
  values: Record<string, string>
  website: string
}

function EditRecipientDialog({
  onOpenChange,
  onUpdate,
  open,
  recipient,
}: {
  onOpenChange: (open: boolean) => void
  onUpdate: (input: Pick<SiteRecipient, "company" | "name" | "values" | "website">) => Promise<void>
  open: boolean
  recipient: SiteRecipient
}) {
  const [draft, setDraft] = useState<RecipientEditDraft>(() => createRecipientDraft(recipient))
  const idPrefix = useId()
  const nameInvalid = draft.name.trim().length === 0
  const companyInvalid = draft.company.trim().length === 0
  const websiteValidation = useMemo(
    () => normalizeOptionalRecipientWebsite(draft.website),
    [draft.website]
  )
  const canSave = !nameInvalid && !companyInvalid && websiteValidation.ok

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(createRecipientDraft(recipient))
    }

    onOpenChange(nextOpen)
  }

  const saveChanges = async () => {
    if (!canSave) {
      return
    }

    try {
      await onUpdate({
        company: draft.company,
        name: draft.name,
        values: draft.values,
        website: websiteValidation.website,
      })
      onOpenChange(false)
    } catch {
      toast.error("Recipient could not be updated")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] w-[384px] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl bg-background p-0 text-foreground shadow-xl sm:h-[434px] sm:max-w-[384px]"
        showCloseButton={false}
      >
        <DialogHeader className="flex h-10 flex-row items-center justify-between border-b px-3 py-0">
          <DialogTitle className="px-1.5 text-sm leading-5 font-medium">
            Edit recipient
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Close edit recipient dialog">
              <IconX />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <RecipientLogoAvatar recipient={recipient} size="md" />
            <span className="truncate text-sm leading-5 font-medium">
              {recipient.name} @ {recipient.company}
            </span>
          </div>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5" data-invalid={nameInvalid ? true : undefined}>
              <FieldLabel
                htmlFor={`${idPrefix}-name`}
                className="text-xs leading-4 text-tertiary-foreground"
              >
                Name
              </FieldLabel>
              <Input
                id={`${idPrefix}-name`}
                aria-invalid={nameInvalid}
                maxLength={HANDOUT_TEXT_LIMITS.recipientName}
                value={draft.name}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    name: event.target.value,
                  }))
                }
              />
              {nameInvalid ? <FieldError>Name is required.</FieldError> : null}
            </Field>
            <Field className="gap-1.5" data-invalid={companyInvalid ? true : undefined}>
              <FieldLabel
                htmlFor={`${idPrefix}-company`}
                className="text-xs leading-4 text-tertiary-foreground"
              >
                Company
              </FieldLabel>
              <Input
                id={`${idPrefix}-company`}
                aria-invalid={companyInvalid}
                maxLength={HANDOUT_TEXT_LIMITS.recipientCompany}
                value={draft.company}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    company: event.target.value,
                  }))
                }
              />
              {companyInvalid ? <FieldError>Company is required.</FieldError> : null}
            </Field>
            <Field className="gap-1.5" data-invalid={!websiteValidation.ok ? true : undefined}>
              <FieldLabel
                htmlFor={`${idPrefix}-website`}
                className="text-xs leading-4 text-tertiary-foreground"
              >
                Website
              </FieldLabel>
              <Input
                id={`${idPrefix}-website`}
                aria-invalid={!websiteValidation.ok}
                inputMode="url"
                maxLength={HANDOUT_TEXT_LIMITS.url}
                value={draft.website}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    website: event.target.value,
                  }))
                }
              />
              {!websiteValidation.ok ? <FieldError>{websiteValidation.message}</FieldError> : null}
            </Field>
            {customRecipientVariables.map((variable) => (
              <Field key={variable.id} className="gap-1.5">
                <FieldLabel
                  htmlFor={`${idPrefix}-${variable.id}`}
                  className="text-xs leading-4 text-tertiary-foreground"
                >
                  {variable.name}
                </FieldLabel>
                <Input
                  id={`${idPrefix}-${variable.id}`}
                  maxLength={HANDOUT_TEXT_LIMITS.recipientVariableValue}
                  placeholder={variable.defaultValue || "Enter value..."}
                  value={draft.values[variable.id] ?? ""}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      values: {
                        ...currentDraft.values,
                        [variable.id]: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
            ))}
          </FieldGroup>
        </div>
        <DialogFooter className="mx-0 mb-0 h-[54px] flex-row justify-end gap-2 rounded-none border-t bg-card p-3">
          <DialogClose asChild>
            <Button variant="ghost" size="compact">
              Cancel
            </Button>
          </DialogClose>
          <Button size="compact" disabled={!canSave} onClick={saveChanges}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function createRecipientDraft(recipient: SiteRecipient): RecipientEditDraft {
  return {
    company: recipient.company,
    name: recipient.name,
    values: { ...recipient.values },
    website: recipient.website,
  }
}

function RecipientDetailsLoadingState() {
  return <LoadingState placement="page" label="Loading recipient details" />
}

function RecipientDetailsErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertTitle>Recipient could not be loaded</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="compact" onClick={onRetry}>
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
