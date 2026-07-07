import { useDeferredValue, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  IconArrowDown,
  IconBolt,
  IconClock,
  IconEye,
  IconExternalLink,
  IconFilter,
  IconMouse,
  IconRefresh,
  IconSearch,
  IconWorldSearch,
} from "@tabler/icons-react"
import type {
  TrackingClassificationFilter,
  TrackingEventFeedItem,
  TrackingEventType,
} from "@lightsite/contracts"

import { Badge } from "@/components/ui/badge"
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { listSites } from "@/features/sites/api"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { getTrackingSummary, listTrackingEvents, type TrackingEventFilters } from "./api"

type DateRange = "7d" | "30d" | "90d"

const eventTypeOptions: Array<{ value: "all" | TrackingEventType; label: string }> = [
  { value: "all", label: "All events" },
  { value: "site_viewed", label: "Views" },
  { value: "link_clicked", label: "Link clicks" },
  { value: "button_clicked", label: "Button clicks" },
  { value: "element_clicked", label: "Element clicks" },
  { value: "scroll_depth_reached", label: "Scroll" },
  { value: "heartbeat", label: "Time spent" },
  { value: "link_preview_loaded", label: "Previews" },
]

const classificationOptions: Array<{ value: TrackingClassificationFilter; label: string }> = [
  { value: "all", label: "All traffic" },
  { value: "human", label: "Human" },
  { value: "preview", label: "Preview" },
  { value: "bot", label: "Bot" },
]

export function TrackingPage() {
  const activeWorkspace = useActiveWorkspace()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [dateRange, setDateRange] = useState<DateRange>("30d")
  const [siteId, setSiteId] = useState("all")
  const [variantId, setVariantId] = useState("all")
  const [eventType, setEventType] = useState<"all" | TrackingEventType>("all")
  const [classification, setClassification] = useState<TrackingClassificationFilter>("all")
  const dateFilters = useMemo(() => getDateRangeFilter(dateRange), [dateRange])
  const summaryFilters = useMemo<TrackingEventFilters>(() => ({
    ...dateFilters,
    ...(siteId === "all" ? {} : { siteId }),
    ...(variantId === "all" ? {} : { variantId }),
  }), [dateFilters, siteId, variantId])
  const eventFilters = useMemo<TrackingEventFilters>(() => ({
    ...summaryFilters,
    ...(eventType === "all" ? {} : { type: eventType }),
    ...(classification === "all" ? {} : { classification }),
    ...(deferredQuery.trim() ? { query: deferredQuery.trim() } : {}),
  }), [classification, deferredQuery, eventType, summaryFilters])

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites(activeWorkspace.id),
    queryFn: ({ signal }) => listSites(signal),
  })
  const summaryQuery = useQuery({
    queryKey: queryKeys.trackingSummary(activeWorkspace.id, summaryFilters),
    queryFn: ({ signal }) => getTrackingSummary(activeWorkspace.id, summaryFilters, signal),
  })
  const eventsQuery = useInfiniteQuery({
    queryKey: queryKeys.trackingEvents(activeWorkspace.id, eventFilters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listTrackingEvents(
        activeWorkspace.id,
        {
          ...eventFilters,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        signal
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const eventPages = useMemo(() => eventsQuery.data?.pages ?? [], [eventsQuery.data?.pages])
  const events = useMemo(() => dedupeEvents(eventPages.flatMap((page) => page.events)), [eventPages])
  const variantSelectValue =
    variantId !== "all" &&
    summaryQuery.data &&
    !summaryQuery.data.variants.some((variant) => variant.variant.id === variantId)
      ? "all"
      : variantId
  const isInitialLoading = summaryQuery.isLoading || (eventsQuery.isLoading && eventPages.length === 0)
  const hasNoEvents = !isInitialLoading && !eventsQuery.isError && events.length === 0

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pt-5 pb-6">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-medium leading-7 tracking-normal">Tracking</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Prospect engagement across published site and variant links.
          </p>
        </div>
        <Button
          variant="outline"
          size="compact"
          onClick={() => {
            void summaryQuery.refetch()
            void eventsQuery.refetch()
          }}
        >
          <IconRefresh data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-sm">
          <InputGroup>
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tracking"
            />
          </InputGroup>
        </div>

        <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
          <SelectTrigger size="sm" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger size="sm" className="min-w-44">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {(sitesQuery.data?.sites ?? []).map((site) => (
              <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={variantSelectValue} onValueChange={setVariantId}>
          <SelectTrigger size="sm" className="min-w-44">
            <SelectValue placeholder="Variant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All variants</SelectItem>
            {(summaryQuery.data?.variants ?? []).map((variant) => (
              <SelectItem key={variant.variant.id} value={variant.variant.id}>
                {variant.variant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventType} onValueChange={(value) => setEventType(value as "all" | TrackingEventType)}>
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eventTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={classification} onValueChange={(value) => setClassification(value as TrackingClassificationFilter)}>
          <SelectTrigger size="sm" className="min-w-34">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classificationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {summaryQuery.isError || eventsQuery.isError ? (
        <TrackingErrorState
          message={getApiErrorMessage(summaryQuery.error ?? eventsQuery.error, "Tracking could not be loaded.")}
          onRetry={() => {
            void summaryQuery.refetch()
            void eventsQuery.refetch()
          }}
        />
      ) : null}

      {isInitialLoading ? <TrackingLoadingState /> : null}

      {!isInitialLoading && summaryQuery.data ? (
        <>
          <MetricGrid metrics={summaryQuery.data.metrics} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="flex min-w-0 flex-col gap-3">
              <SectionHeading title="Activity feed" />
              {hasNoEvents ? <TrackingEmptyState /> : (
                <ActivityFeed
                  events={events}
                  isFetching={eventsQuery.isFetching}
                  hasNextPage={Boolean(eventsQuery.hasNextPage)}
                  onLoadMore={() => {
                    if (eventsQuery.hasNextPage) {
                      void eventsQuery.fetchNextPage()
                    }
                  }}
                />
              )}
            </section>
            <aside className="flex min-w-0 flex-col gap-4">
              <TopClickedElements elements={summaryQuery.data.topClickedElements} />
              <VariantLeaderboard variants={summaryQuery.data.variants} />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricGrid({ metrics }: { metrics: NonNullable<Awaited<ReturnType<typeof getTrackingSummary>>>["metrics"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Visits" value={metrics.humanVisits.toLocaleString()} detail={`${metrics.uniqueSessions.toLocaleString()} sessions`} icon={IconEye} />
      <Metric label="Time spent" value={formatDuration(metrics.averageTimeSpentSeconds)} detail="Average visible time" icon={IconClock} />
      <Metric label="Scroll depth" value={`${metrics.maxScrollDepth}%`} detail="Max observed threshold" icon={IconArrowDown} />
      <Metric label="Clicks" value={(metrics.ctaClicks + metrics.linkClicks).toLocaleString()} detail={`${metrics.previewLoads.toLocaleString()} preview loads`} icon={IconMouse} />
    </div>
  )
}

function Metric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string
  icon: typeof IconEye
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-24 items-start gap-3 rounded-lg border bg-background p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-medium leading-8 tracking-normal">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      </div>
    </div>
  )
}

function ActivityFeed({
  events,
  hasNextPage,
  isFetching,
  onLoadMore,
}: {
  events: TrackingEventFeedItem[]
  hasNextPage: boolean
  isFetching: boolean
  onLoadMore: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Target</TableHead>
            <TableHead className="text-right">Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <EventIcon event={event} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{event.eventName}</span>
                      {event.isPreview ? <Badge variant="secondary">Preview</Badge> : null}
                      {event.isBot && !event.isPreview ? <Badge variant="secondary">Bot</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatEventType(event.type)}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-medium">{event.site.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {event.variant?.name ?? "Default link"}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground">
                {event.targetLabel ?? event.targetUrl ?? "Public page"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatTimestamp(event.receivedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasNextPage ? (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="compact" onClick={onLoadMore} disabled={isFetching}>
            <IconFilter data-icon="inline-start" />
            {isFetching ? "Loading" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function TopClickedElements({
  elements,
}: {
  elements: NonNullable<Awaited<ReturnType<typeof getTrackingSummary>>>["topClickedElements"]
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Top clicks" />
      <div className="rounded-lg border bg-background">
        {elements.length === 0 ? (
          <SideEmpty label="No clicks yet" />
        ) : elements.map((element) => (
          <div key={element.elementId} className="flex items-center gap-3 border-b p-3 last:border-b-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <IconExternalLink className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{element.label}</div>
              <div className="truncate text-xs text-muted-foreground">{element.href ?? "No URL"}</div>
            </div>
            <Badge variant="secondary">{element.clickCount}</Badge>
          </div>
        ))}
      </div>
    </section>
  )
}

function VariantLeaderboard({
  variants,
}: {
  variants: NonNullable<Awaited<ReturnType<typeof getTrackingSummary>>>["variants"]
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Variants" />
      <div className="rounded-lg border bg-background">
        {variants.length === 0 ? (
          <SideEmpty label="No variant activity" />
        ) : variants.map((variant) => (
          <div key={variant.variant.id} className="flex items-center gap-3 border-b p-3 last:border-b-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <IconBolt className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{variant.variant.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {variant.variant.recipientCompany ?? variant.variant.recipientName ?? "Recipient link"}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-medium">{variant.humanVisits}</div>
              <div className="text-xs text-muted-foreground">visits</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrackingLoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
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

function TrackingEmptyState() {
  return (
    <Empty className="min-h-80 rounded-lg border bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconWorldSearch />
        </EmptyMedia>
        <EmptyTitle>No tracking events yet</EmptyTitle>
        <EmptyDescription>
          Publish and share a public link to start collecting visits, clicks, scroll depth, and preview loads.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  )
}

function SideEmpty({ label }: { label: string }) {
  return <div className="p-4 text-sm text-muted-foreground">{label}</div>
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-sm font-medium">{title}</h2>
}

function EventIcon({ event }: { event: TrackingEventFeedItem }) {
  const Icon = event.type === "link_preview_loaded"
    ? IconWorldSearch
    : event.type.includes("click")
      ? IconMouse
      : event.type === "heartbeat"
        ? IconClock
        : IconEye

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className="size-4" />
    </div>
  )
}

function getDateRangeFilter(range: DateRange) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  const to = new Date()
  const from = new Date(to)

  from.setDate(from.getDate() - days)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.round(seconds / 60)}m`
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatEventType(type: TrackingEventType) {
  return type.replaceAll("_", " ")
}

function dedupeEvents(events: TrackingEventFeedItem[]) {
  const seen = new Set<string>()

  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false
    }

    seen.add(event.id)
    return true
  })
}
