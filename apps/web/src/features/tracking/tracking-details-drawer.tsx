import type { ReactNode } from "react"
import {
  IconActivity,
  IconCalendarPlus,
  IconCalendarStats,
  IconCalendarX,
  IconChevronLeft,
  IconClick,
  IconClock,
  IconDeviceDesktop,
  IconEye,
  IconFile,
  IconLink,
  IconListTree,
  IconMapPin,
  IconNavigationX,
  IconNotes,
  IconRefresh,
  IconRoute,
  IconScan,
  IconTarget,
  IconUser,
  IconWorld,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type {
  TrackingDrawerRecipient,
  TrackingEventDrawerData,
  TrackingSessionDrawerData,
} from "./tracking-details-model"

type TrackingDetailsDrawerProps = {
  error?: string | null
  event: TrackingEventDrawerData | null
  events?: TrackingEventDrawerData[]
  isLoading?: boolean
  onBackToEvent?: () => void
  onBackToSession?: () => void
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
  onSelectEvent?: (event: TrackingEventDrawerData) => void
  onViewFullSession?: (event: TrackingEventDrawerData) => void
  open: boolean
  recordingReplay?: ReactNode
  session: TrackingSessionDrawerData | null
}

export function TrackingDetailsDrawer({
  error = null,
  event,
  events = [],
  isLoading = false,
  onBackToEvent,
  onBackToSession,
  onOpenChange,
  onRetry,
  onSelectEvent,
  onViewFullSession,
  open,
  recordingReplay,
  session,
}: TrackingDetailsDrawerProps) {
  const showsEvent = event !== null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-black/20 backdrop-blur-none"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="inset-y-1.5! right-1.5! h-auto! w-[calc(100%-12px)]! gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-lg sm:w-[526px]! sm:max-w-[526px]!"
      >
        <div className="h-full w-full min-w-0 overflow-x-hidden overflow-y-auto">
          <SheetTitle className="sr-only">
            {showsEvent ? "Event details" : "Session details"}
          </SheetTitle>

          {showsEvent && event ? (
            <EventDrawerContent
              event={event}
              onBackToSession={onBackToSession}
              onClose={() => onOpenChange(false)}
              onViewFullSession={onViewFullSession}
            />
          ) : (
            <SessionDrawerContent
              error={error}
              events={events}
              isLoading={isLoading}
              onBackToEvent={onBackToEvent}
              onClose={() => onOpenChange(false)}
              onRetry={onRetry}
              onSelectEvent={onSelectEvent}
              recordingReplay={recordingReplay}
              session={session}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SessionDrawerContent({
  error,
  events,
  isLoading,
  onBackToEvent,
  onClose,
  onRetry,
  onSelectEvent,
  recordingReplay,
  session,
}: {
  error: string | null
  events: TrackingEventDrawerData[]
  isLoading: boolean
  onBackToEvent?: () => void
  onClose: () => void
  onRetry?: () => void
  onSelectEvent?: (event: TrackingEventDrawerData) => void
  recordingReplay?: ReactNode
  session: TrackingSessionDrawerData | null
}) {
  return (
    <div className="flex min-h-full w-full min-w-0 flex-col gap-4 px-5 pt-4 pb-6">
      {onBackToEvent ? (
        <DrawerBackRow label="Back to event" onBack={onBackToEvent} onClose={onClose} />
      ) : null}
      <DrawerTitleRow
        icon={IconActivity}
        onClose={onBackToEvent ? undefined : onClose}
        size="sm"
        title="Session details"
      />

      {error ? (
        <Alert variant="destructive">
          <IconRoute />
          <AlertTitle>Session could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{error}</span>
            {onRetry ? (
              <Button variant="outline" size="compact" onClick={onRetry}>
                <IconRefresh data-icon="inline-start" />
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <SessionDrawerLoading /> : null}

      {!isLoading && !error && !session ? (
        <Empty className="min-h-72 rounded-xl border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon"><IconRoute /></EmptyMedia>
            <EmptyTitle>Session not found</EmptyTitle>
            <EmptyDescription>The selected session is no longer available.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      ) : null}

      {session ? (
        <div className="flex w-full min-w-0 flex-col gap-6">
          <SessionMetadataCard session={session} />
          {recordingReplay}
          <SessionEventTimeline events={events} onSelectEvent={onSelectEvent} />
        </div>
      ) : null}
    </div>
  )
}

function EventDrawerContent({
  event,
  onBackToSession,
  onClose,
  onViewFullSession,
}: {
  event: TrackingEventDrawerData
  onBackToSession?: () => void
  onClose: () => void
  onViewFullSession?: (event: TrackingEventDrawerData) => void
}) {
  return (
    <div className="flex min-h-full w-full min-w-0 flex-col gap-4 px-5 pt-4 pb-6">
      {onBackToSession ? (
        <DrawerBackRow label="Back to session" onBack={onBackToSession} onClose={onClose} />
      ) : null}

      <DrawerTitleRow
        icon={IconClick}
        onClose={onBackToSession ? undefined : onClose}
        title="Event details"
      />
      <EventMetadataCard event={event} />
      {onViewFullSession ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={event.sessionId === null}
          onClick={() => onViewFullSession(event)}
        >
          <IconActivity data-icon="inline-start" />
          View full session
        </Button>
      ) : null}
    </div>
  )
}

function DrawerBackRow({
  label,
  onBack,
  onClose,
}: {
  label: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="flex h-[26px] items-center">
      <Button
        variant="ghost"
        size="compact"
        className="h-[26px] gap-2.5 px-0 font-normal hover:bg-transparent"
        aria-label={label}
        onClick={onBack}
      >
        <IconChevronLeft data-icon="inline-start" />
        Back
      </Button>
      <Button variant="ghost" size="icon-field" className="ml-auto" aria-label="Close" onClick={onClose}>
        <IconX />
      </Button>
    </div>
  )
}

function DrawerTitleRow({
  icon: Icon,
  onClose,
  size = "default",
  title,
}: {
  icon: TablerIcon
  onClose?: () => void
  size?: "default" | "sm"
  title: string
}) {
  return (
    <div className="flex h-7 items-center gap-2.5">
      <Icon className={cn("shrink-0", size === "sm" ? "size-4" : "size-[18px]")} />
      <h2
        className={cn(
          "min-w-0 flex-1 truncate font-medium",
          size === "sm" ? "text-base leading-6" : "text-lg leading-7"
        )}
      >
        {title}
      </h2>
      {onClose ? (
        <Button variant="ghost" size="icon-field" aria-label="Close" onClick={onClose}>
          <IconX />
        </Button>
      ) : null}
    </div>
  )
}

function SessionMetadataCard({ session }: { session: TrackingSessionDrawerData }) {
  return (
    <MetadataCard>
      <MetadataRow icon={IconWorld} label="Site" value={session.siteName} />
      <MetadataRow icon={IconUser} label="Recipient" value={<RecipientValue recipient={session.recipient} />} />
      <MetadataRow icon={IconClock} label="Duration" value={session.totalDuration} />
      <MetadataRow icon={IconCalendarPlus} label="Started" value={formatDrawerDateTime(session.startedAt)} />
      <MetadataRow icon={IconCalendarX} label="Ended" value={formatDrawerDateTime(session.endedAt)} />
      <MetadataRow icon={IconNavigationX} label="End reason" value={session.endReason} />
      <MetadataRow icon={IconMapPin} label="Location" value={session.location} />
      <MetadataRow icon={IconDeviceDesktop} label="Device" value={session.device} />
      <MetadataRow icon={IconNotes} label="Initial page" value={session.initialPage} />
      <MetadataRow icon={IconActivity} label="Session id" value={shortId(session.id)} />
    </MetadataCard>
  )
}

function EventMetadataCard({ event }: { event: TrackingEventDrawerData }) {
  return (
    <MetadataCard>
      <MetadataRow
        icon={IconTarget}
        label="Event type"
        value={<span className="flex items-center gap-1.5"><IconClick className="size-3.5" />{event.type}</span>}
      />
      <MetadataRow icon={IconScan} label="Element" value={event.element} />
      <MetadataRow icon={IconWorld} label="Site" value={event.siteName} />
      <MetadataRow icon={IconNotes} label="Page" value={event.page} />
      <MetadataRow icon={IconUser} label="Recipient" value={<RecipientValue recipient={event.recipient} />} />
      <MetadataRow
        icon={IconActivity}
        label="Session id"
        value={event.sessionId ? shortId(event.sessionId) : "Sessionless"}
      />
      <MetadataRow icon={IconDeviceDesktop} label="Device" value={event.device} />
      <MetadataRow icon={IconMapPin} label="Location" value={event.location} />
      <MetadataRow icon={IconCalendarStats} label="Timestamp" value={formatDrawerDateTime(event.timestamp)} />
    </MetadataCard>
  )
}

function MetadataCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4">
      {children}
    </div>
  )
}

function MetadataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: TablerIcon
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex h-[22px] min-w-0 items-center gap-4 text-sm leading-5">
      <div className="flex w-28 shrink-0 items-center gap-1.5 text-tertiary-foreground [&_svg]:size-3.5">
        <Icon />
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1 truncate text-secondary-foreground">{value}</div>
    </div>
  )
}

function RecipientValue({ recipient }: { recipient: TrackingDrawerRecipient | null }) {
  const label = recipient
    ? recipient.company
      ? `${recipient.name} @ ${recipient.company}`
      : recipient.name
    : "Default public link"
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <RecipientAvatar recipient={recipient} size="xs" />
      <span className="truncate">{label}</span>
    </span>
  )
}

function SessionEventTimeline({
  events,
  onSelectEvent,
}: {
  events: TrackingEventDrawerData[]
  onSelectEvent?: (event: TrackingEventDrawerData) => void
}) {
  return (
    <section className="flex w-full min-w-0 flex-col gap-4">
      <SectionTitle icon={IconListTree}>Event Timeline</SectionTitle>
      {events.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">No events in this session</div>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[37.65%]" />
              <col className="w-[37.65%]" />
              <col className="w-[24.7%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-2! pr-4!">Action</TableHead>
                <TableHead className="pl-0! pr-4!">Details</TableHead>
                <TableHead className="pl-0! pr-3! text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="before:table-row before:h-2 before:content-['']">
              {events.map((event) => (
                <TableRow
                  key={event.id}
                  className="group h-11 cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectEvent?.(event)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return
                    keyboardEvent.preventDefault()
                    onSelectEvent?.(event)
                  }}
                >
                  <TableCell className="rounded-l-lg py-2 pr-4! pl-2! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    <div className="flex min-w-0 items-center gap-4 font-medium">
                      <EventGlyph event={event} />
                      <span className="truncate">{event.action}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 pr-4! pl-0! transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    <span className="block truncate">{event.details}</span>
                  </TableCell>
                  <TableCell className="rounded-r-lg py-2 pr-3! pl-0! text-right text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                    {event.elapsed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

function EventGlyph({ event }: { event: TrackingEventDrawerData }) {
  const normalizedType = event.type.toLowerCase()

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
      {normalizedType.includes("link") ? (
        <IconLink className="size-3.5" />
      ) : normalizedType.includes("site") || normalizedType.includes("open") ? (
        <IconEye className="size-3.5" />
      ) : normalizedType.includes("page") ? (
        <IconFile className="size-3.5" />
      ) : (
        <IconClick className="size-3.5" />
      )}
    </span>
  )
}

function SectionTitle({ children, icon: Icon }: { children: ReactNode; icon: TablerIcon }) {
  return (
    <h3 className="flex items-center gap-2 text-sm leading-5 font-medium">
      <Icon className="size-3.5" />
      {children}
    </h3>
  )
}

function SessionDrawerLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[342px] rounded-xl" />
      <Skeleton className="h-[382px] rounded-xl" />
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  )
}

function formatDrawerDateTime(value: string | null) {
  if (!value) return "Not yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)
  const day = date.getDate()
  const suffix = day % 10 === 1 && day !== 11
    ? "st"
    : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
        ? "rd"
        : "th"
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date)

  return `${month} ${day}${suffix} ${date.getFullYear()} at ${time}`
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value
}
