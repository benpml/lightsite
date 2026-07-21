import { useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  IconActivity,
  IconBolt,
  IconBrandSlack,
  IconClock,
  IconClick,
  IconEye,
  IconPlayerPlay,
  IconRefresh,
  IconWorldSearch,
} from "@tabler/icons-react"
import type {
  TrackingV2EventFeedItem,
  TrackingV2EventType,
  TrackingV2SessionSummary,
} from "@handout/tracking-schema"

import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { Button } from "@/components/ui/button"
import { TrackingEventCountBadge } from "@/components/data-display/tracking-event-count-badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { cn } from "@/lib/utils"

import {
  getTrackingV2Session,
  getTrackingDashboardActivity,
  listTrackingV2Events,
} from "./api"
import { dedupeTrackingV2Events } from "./model"
import { TrackingDetailsDrawer } from "./tracking-details-drawer"
import { TrackingRecordingReplay } from "./recording-replay"
import {
  toEventDrawerData,
  toSessionDrawerData,
  type TrackingEventDrawerData,
} from "./tracking-details-model"

type TrackingTab = "events" | "sessions"
const REPLAY_STATUS_POLL_INTERVAL_MS = 5_000

export function TrackingPage() {
  const activeWorkspace = useActiveWorkspace()
  const [activeTab, setActiveTab] = useState<TrackingTab>("sessions")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TrackingEventDrawerData | null>(null)
  const [eventReturnsToSession, setEventReturnsToSession] = useState(false)
  const [sessionBackEvent, setSessionBackEvent] = useState<TrackingEventDrawerData | null>(null)
  const dashboardQuery = useQuery({
    queryKey: queryKeys.trackingDashboard(activeWorkspace.id),
    queryFn: ({ signal }) =>
      getTrackingDashboardActivity(activeWorkspace.id, {}, signal),
  })
  const selectedSessionRecordingStatus = dashboardQuery.data?.sessions
    .find((session) => session.id === selectedSessionId)?.recording.status
  const eventsQuery = useInfiniteQuery({
    queryKey: queryKeys.trackingEvents(activeWorkspace.id, { limit: 50 }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listTrackingV2Events(
        activeWorkspace.id,
        {
          limit: 50,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        signal
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const sessionDetailQuery = useQuery({
    queryKey: queryKeys.trackingSession(activeWorkspace.id, selectedSessionId ?? ""),
    enabled: selectedSessionId !== null,
    queryFn: ({ signal }) =>
      getTrackingV2Session(activeWorkspace.id, selectedSessionId ?? "", signal),
    refetchInterval: (query) => {
      const status = query.state.data?.session.recording.status ?? selectedSessionRecordingStatus
      return status === "pending" || status === "recording"
        ? REPLAY_STATUS_POLL_INTERVAL_MS
        : false
    },
    refetchIntervalInBackground: false,
  })
  const sessionEventsQuery = useQuery({
    queryKey: queryKeys.trackingSessionEvents(activeWorkspace.id, selectedSessionId ?? ""),
    enabled: selectedSessionId !== null,
    queryFn: ({ signal }) =>
      listTrackingV2Events(
        activeWorkspace.id,
        {
          limit: 100,
          sessionId: selectedSessionId ?? "",
        },
        signal
      ),
  })

  const eventPages = useMemo(() => eventsQuery.data?.pages ?? [], [eventsQuery.data?.pages])
  const events = useMemo(() => dedupeTrackingV2Events(
    eventPages.flatMap((page) => page.events)
  ), [eventPages])
  const sessions = useMemo(
    () => dashboardQuery.data?.sessions ?? [],
    [dashboardQuery.data?.sessions]
  )
  const selectedSessionFallback = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  )
  const selectedSessionEvents = useMemo(() => {
    if (sessionEventsQuery.data) {
      return sessionEventsQuery.data.events
    }

    return selectedSessionId
      ? events.filter((event) => event.sessionId === selectedSessionId)
      : []
  }, [events, selectedSessionId, sessionEventsQuery.data])
  const selectedSession = sessionDetailQuery.data?.session ?? selectedSessionFallback
  const sessionDrawerEvents = useMemo(
    () => [...selectedSessionEvents]
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
      .map(toEventDrawerData),
    [selectedSessionEvents]
  )
  const sessionEventCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const event of dashboardQuery.data?.events ?? []) {
      if (event.sessionId) {
        counts.set(event.sessionId, (counts.get(event.sessionId) ?? 0) + 1)
      }
    }

    return counts
  }, [dashboardQuery.data?.events])
  const eventsAreLoading = eventsQuery.isLoading && eventPages.length === 0
  const sessionsAreLoading = dashboardQuery.isLoading

  return (
    <div className="-mx-px -mt-px min-h-full px-6 pt-5 pb-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TrackingTab)}
        className="gap-3"
      >
        <div className="flex w-[297px] flex-col">
          <h1 className="text-lg font-medium leading-7 tracking-normal">Tracking</h1>
          <p className="-mt-px truncate text-sm leading-5 text-muted-foreground">
            {activeTab === "events"
              ? "View recipient actions across your sites"
              : "Create and manage sites and variants of your sites."}
          </p>
        </div>

        <TabsList variant="line" className="h-[42px]! w-full justify-start gap-2 rounded-none border-b border-border-subtle p-0">
          <TabsTrigger value="sessions" className="h-full flex-none rounded-none px-1 py-1.5 after:bottom-[-1px]! after:h-px!">
            <IconActivity data-icon="inline-start" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="events" className="h-full flex-none rounded-none px-1 py-1.5 after:bottom-[-1px]! after:h-px!">
            <IconClick data-icon="inline-start" />
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="pt-2">
          {dashboardQuery.isError ? (
            <TrackingErrorState
              message={getApiErrorMessage(dashboardQuery.error, "Tracking sessions could not be loaded.")}
              onRetry={() => void dashboardQuery.refetch()}
            />
          ) : sessionsAreLoading ? (
            <TrackingTableLoadingState rowHeight="h-[52px]" />
          ) : sessions.length === 0 ? (
            <TrackingEmptyState kind="sessions" />
          ) : (
            <SessionsTable
              eventCounts={sessionEventCounts}
              onOpenSession={(sessionId) => {
                setSelectedEvent(null)
                setEventReturnsToSession(false)
                setSessionBackEvent(null)
                setSelectedSessionId(sessionId)
              }}
              sessions={sessions}
            />
          )}
        </TabsContent>

        <TabsContent value="events" className="pt-2">
          {eventsQuery.isError ? (
            <TrackingErrorState
              message={getApiErrorMessage(eventsQuery.error, "Tracking events could not be loaded.")}
              onRetry={() => void eventsQuery.refetch()}
            />
          ) : eventsAreLoading ? (
            <TrackingTableLoadingState rowHeight="h-10" />
          ) : events.length === 0 ? (
            <TrackingEmptyState kind="events" />
          ) : (
            <EventsTable
              events={events}
              hasNextPage={Boolean(eventsQuery.hasNextPage)}
              isFetching={eventsQuery.isFetching}
              onLoadMore={() => void eventsQuery.fetchNextPage()}
              onOpenEvent={(event) => {
                setSelectedSessionId(null)
                setEventReturnsToSession(false)
                setSessionBackEvent(null)
                setSelectedEvent(toEventDrawerData(event))
              }}
            />
          )}
        </TabsContent>
      </Tabs>

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
            setSelectedSessionId(null)
            setSelectedEvent(null)
            setEventReturnsToSession(false)
            setSessionBackEvent(null)
          }
        }}
        onSelectEvent={(event) => {
          setSelectedEvent(event)
          setEventReturnsToSession(true)
        }}
        onViewFullSession={(event) => {
          if (!event.sessionId) return

          if (eventReturnsToSession) {
            setSelectedEvent(null)
            setEventReturnsToSession(false)
            return
          }

          setSessionBackEvent(event)
          setSelectedEvent(null)
          setSelectedSessionId(event.sessionId)
        }}
        onRetry={() => {
          void sessionDetailQuery.refetch()
          void sessionEventsQuery.refetch()
        }}
        open={selectedSessionId !== null || selectedEvent !== null}
        recordingReplay={selectedSession && selectedSession.recording.status !== "disabled" ? (
          <TrackingRecordingReplay
            session={selectedSession}
            variant="drawer"
            workspaceId={activeWorkspace.id}
          />
        ) : undefined}
        session={selectedSession ? toSessionDrawerData(selectedSession) : null}
      />
    </div>
  )
}

function EventsTable({
  events,
  hasNextPage,
  isFetching,
  onLoadMore,
  onOpenEvent,
}: {
  events: TrackingV2EventFeedItem[]
  hasNextPage: boolean
  isFetching: boolean
  onLoadMore: () => void
  onOpenEvent: (event: TrackingV2EventFeedItem) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Table className="min-w-[695px] table-fixed">
        <colgroup>
          <col className="w-[260px]" />
          <col className="w-[116px]" />
          <col className="w-[116px]" />
          <col className="w-[116px]" />
          <col className="w-[87px]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-2! pr-4!">Recipient</TableHead>
            <TableHead className="pl-0! pr-4!">Site</TableHead>
            <TableHead className="pl-0! pr-4!">Event</TableHead>
            <TableHead className="pl-0! pr-4!">Details</TableHead>
            <TableHead className="pl-0! pr-3! text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="before:table-row before:h-2 before:content-['']">
          {events.map((event) => (
            <TableRow
              key={event.id}
              role="button"
              tabIndex={0}
              className="group h-10 cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
              onClick={() => onOpenEvent(event)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                  keyboardEvent.preventDefault()
                  onOpenEvent(event)
                }
              }}
            >
              <TableCell className="rounded-l-lg pl-2! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <div className="flex min-w-0 items-center gap-3">
                  <TrackingRecipientAvatar item={event} size="md" />
                  <span className="truncate font-medium">{formatEventRecipient(event)}</span>
                </div>
              </TableCell>
              <TableCell className="pl-0! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <span className="block truncate">{event.site.name}</span>
              </TableCell>
              <TableCell className="pl-0! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <div className="flex min-w-0 items-center gap-1.5 font-medium">
                  <EventTypeIcon event={event} />
                  <span className="truncate">{formatEventType(event.type)}</span>
                </div>
              </TableCell>
              <TableCell className="pl-0! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <EventDetailsValue event={event} />
              </TableCell>
              <TableCell className="truncate rounded-r-lg pl-0! pr-3! text-right text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                {formatRelativeTime(event.occurredAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={isFetching}>
            {isFetching ? "Loading" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function EventDetailsValue({ event }: { event: TrackingV2EventFeedItem }) {
  const details = formatEventDetails(event)

  return (
    <span className={cn("block truncate", details === "-" && "text-muted-foreground")}>
      {details}
    </span>
  )
}

function SessionsTable({
  eventCounts,
  onOpenSession,
  sessions,
}: {
  eventCounts: Map<string, number>
  onOpenSession: (sessionId: string) => void
  sessions: TrackingV2SessionSummary[]
}) {
  return (
    <Table className="min-w-[695px] table-fixed">
      <colgroup>
        <col className="w-[260px]" />
        <col className="w-[116px]" />
        <col className="w-[116px]" />
        <col className="w-[116px]" />
        <col className="w-[87px]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-2! pr-4!">Recipient</TableHead>
          <TableHead className="pl-0! pr-4!">Duration</TableHead>
          <TableHead className="pl-0! pr-4!">Activity</TableHead>
          <TableHead className="pl-0! pr-4!">When</TableHead>
          <TableHead className="pl-0! pr-3! text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="before:table-row before:h-2 before:content-['']">
        {sessions.map((session) => (
          <TableRow
            key={session.id}
            role="button"
            tabIndex={0}
            className="group h-[52px] cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
            onClick={() => onOpenSession(session.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onOpenSession(session.id)
              }
            }}
          >
            <TableCell className="rounded-l-lg pl-2! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
              <div className="flex min-w-0 items-center gap-3">
                <TrackingRecipientAvatar item={session} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{formatSessionRecipient(session)}</div>
                  <div className="truncate text-xs leading-4 text-muted-foreground">{session.site.name}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="truncate pl-0! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">{formatDurationMs(session.durationMs ?? session.activeMs)}</TableCell>
            <TableCell className="pl-0! pr-4! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
              <TrackingEventCountBadge count={eventCounts.get(session.id) ?? 0} />
            </TableCell>
            <TableCell className="truncate pl-0! pr-4! text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
              {formatRelativeTime(session.lastSeenAt)}
            </TableCell>
            <TableCell className="rounded-r-lg pl-0! pr-3! text-right transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
              <Button
                variant="outline"
                size="sm"
                className="w-[75px]"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenSession(session.id)
                }}
              >
                {session.recording.available
                  ? <IconPlayerPlay data-icon="inline-start" />
                  : <IconEye data-icon="inline-start" />}
                {session.recording.available ? "Watch" : "View"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TrackingRecipientAvatar({
  item,
  size,
}: {
  item: TrackingV2EventFeedItem | TrackingV2SessionSummary
  size: "md" | "lg"
}) {
  return (
    <RecipientAvatar
      recipient={item.recipient
        ? {
            company: item.recipient.recipientCompany,
            name: item.recipient.recipientName ?? item.recipient.name,
            website: item.recipient.website,
          }
        : { name: item.site.name }}
      size={size}
    />
  )
}

function EventTypeIcon({ event }: { event: TrackingV2EventFeedItem }) {
  if (event.type === "slack_share") {
    return <IconBrandSlack className="size-3.5 shrink-0 text-tertiary-foreground" />
  }

  const Icon = event.type === "webhook_send"
    ? IconBolt
    : event.type === "button_click" || event.type === "link_click" || event.type === "tab_switch"
      ? IconClick
      : IconEye

  return <Icon className="size-3.5 shrink-0" />
}

function TrackingTableLoadingState({ rowHeight }: { rowHeight: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 rounded-lg" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className={rowHeight} />
      ))}
    </div>
  )
}

function TrackingErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-background p-4">
      <div>
        <div className="text-sm font-medium">Tracking is unavailable</div>
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
      <Button variant="outline" size="compact" onClick={onRetry}>
        <IconRefresh data-icon="inline-start" />
        Retry
      </Button>
    </div>
  )
}

function TrackingEmptyState({ kind }: { kind: TrackingTab }) {
  const isEvents = kind === "events"

  return (
    <Empty className="min-h-80 rounded-lg border bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isEvents ? <IconWorldSearch /> : <IconClock />}
        </EmptyMedia>
        <EmptyTitle>{isEvents ? "No tracking events yet" : "No sessions yet"}</EmptyTitle>
        <EmptyDescription>
          {isEvents
            ? "Publish and share a recipient link to start collecting recipient activity."
            : "New recipient visits will appear here as sessions."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  )
}

function formatEventRecipient(event: TrackingV2EventFeedItem) {
  return formatRecipientLabel(event.recipient)
}

function formatSessionRecipient(session: TrackingV2SessionSummary) {
  return formatRecipientLabel(session.recipient)
}

function formatRecipientLabel(
  recipient: TrackingV2EventFeedItem["recipient"] | TrackingV2SessionSummary["recipient"]
) {
  if (!recipient) {
    return "Default public link"
  }

  const name = recipient.recipientName ?? recipient.name
  return recipient.recipientCompany ? `${name} @ ${recipient.recipientCompany}` : name
}

function formatEventDetails(event: TrackingV2EventFeedItem) {
  if (event.element?.label) {
    return `“${event.element.label}”`
  }

  if (event.tab?.label) {
    return `“${event.tab.label}”`
  }

  if (event.webhook?.endpointHost) {
    return event.webhook.endpointHost
  }

  return "-"
}

function formatDurationMs(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000)

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000))

  if (elapsedSeconds < 60) {
    return elapsedSeconds < 10 ? "Just now" : `${elapsedSeconds}s ago`
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`
  }

  const elapsedDays = Math.floor(elapsedHours / 24)
  return elapsedDays < 7 ? `${elapsedDays}d ago` : formatTimestamp(value)
}

function formatEventType(type: TrackingV2EventType) {
  const label = type.replaceAll("_", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}
