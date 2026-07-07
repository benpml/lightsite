import { useDeferredValue, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  IconArchive,
  IconCirclePlus,
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconFilter,
  IconRefresh,
  IconSearch,
  IconWorldLongitude,
} from "@tabler/icons-react"
import type { SiteListItem, SiteStatus } from "@lightsite/contracts"

import { SiteStatusBadge } from "@/components/common/status-badge"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { listSites } from "./api"
import { CreateSiteDialog } from "./components/create-site-dialog"

export function SitesPage() {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const activeWorkspace = useActiveWorkspace()
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites(activeWorkspace.id),
    queryFn: ({ signal }) => listSites(signal),
  })
  const sites = sitesQuery.data?.sites
  const siteCount = sites?.length ?? 0

  const visibleSites = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return (sites ?? []).filter((site) => {
      return (
        normalizedQuery.length === 0 ||
        site.name.toLowerCase().includes(normalizedQuery) ||
        site.slug.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [deferredQuery, sites])

  return (
    <div className="flex min-h-full flex-col gap-4 px-6 pt-5 pb-6">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-medium leading-7 tracking-normal">Sites</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Create and manage sites and variants of your sites.
          </p>
        </div>
        <div className="shrink-0">
          <CreateSiteDialog
            workspaceId={activeWorkspace.id}
            workspaceSlug={activeWorkspace.slug}
            trigger={
              <Button size="compact">
                <IconCirclePlus data-icon="inline-start" />
                New Site
              </Button>
            }
          />
        </div>
      </div>

      <div className="max-w-md">
        <InputGroup>
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sites"
          />
        </InputGroup>
      </div>

      {sitesQuery.isLoading ? <SitesLoadingState /> : null}
      {sitesQuery.isError ? (
        <SitesErrorState
          message={getApiErrorMessage(sitesQuery.error, "Sites could not be loaded.")}
          onRetry={() => void sitesQuery.refetch()}
        />
      ) : null}
      {sitesQuery.isSuccess && siteCount === 0 ? (
        <SitesEmptyState workspaceId={activeWorkspace.id} workspaceSlug={activeWorkspace.slug} />
      ) : null}
      {sitesQuery.isSuccess && siteCount > 0 && visibleSites.length === 0 ? (
        <SitesFilteredEmptyState
          workspaceId={activeWorkspace.id}
          workspaceSlug={activeWorkspace.slug}
        />
      ) : null}
      {sitesQuery.isSuccess && visibleSites.length > 0 ? (
        <SitesTable sites={visibleSites} workspaceSlug={activeWorkspace.slug} />
      ) : null}
    </div>
  )
}

function SitesTable({ sites, workspaceSlug }: { sites: SiteListItem[]; workspaceSlug: string }) {
  const navigate = useNavigate()

  return (
    <div className="min-w-0 overflow-x-auto">
      <Table className="min-w-[720px] border-separate border-spacing-y-0.5">
        <colgroup>
          <col />
          <col className="w-[140px]" />
          <col className="w-[140px]" />
          <col className="w-[48px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="border-b hover:bg-transparent">
            <TableHead className="h-7 border-b border-border-subtle px-2 py-1 text-sm font-medium leading-5 text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="h-7 border-b border-border-subtle px-2 py-1 text-sm font-medium leading-5 text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="h-7 border-b border-border-subtle px-2 py-1 text-sm font-medium leading-5 text-muted-foreground">
              Updated
            </TableHead>
            <TableHead className="h-7 border-b border-border-subtle px-0 py-1" />
          </TableRow>
        </TableHeader>
        <TableBody className="[&:before]:block [&:before]:h-0.5 [&:before]:content-[''] [&_tr:last-child]:border-0">
          {sites.map((site) => (
            <TableRow
              key={site.id}
              tabIndex={0}
              role="link"
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return
                }

                void navigate({
                  to: "/editor/$siteId",
                  params: { siteId: site.id },
                })
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return
                }

                event.preventDefault()
                void navigate({
                  to: "/editor/$siteId",
                  params: { siteId: site.id },
                })
              }}
              className="group h-16 border-0 cursor-pointer hover:bg-transparent focus-visible:outline-none"
            >
              <TableCell className="rounded-l-lg bg-background py-2 pr-2 pl-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <div className="flex min-w-0 items-center gap-4">
                  <SiteThumbnail status={site.status} />
                  <div className="flex min-w-0 flex-col justify-center gap-0.5 text-sm leading-5">
                    <div className="max-w-[280px] truncate font-medium text-foreground">
                      {site.name}
                    </div>
                    <div className="max-w-[320px] truncate text-muted-foreground">
                      /{workspaceSlug}/{site.slug}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="bg-background px-2 py-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <SiteStatusBadge status={site.status} />
              </TableCell>
              <TableCell className="bg-background px-2 py-2 text-sm leading-5 text-tertiary-foreground transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                {formatSiteDate(site)}
              </TableCell>
              <TableCell
                className="rounded-r-lg bg-background py-2 pr-2 pl-0 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <SiteActions site={site} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SiteActions({ site }: { site: SiteListItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-field" aria-label={`Actions for ${site.name}`}>
          <IconDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/editor/$siteId" params={{ siteId: site.id }}>
              <IconEdit />
              Open editor
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconCopy />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={site.status === "archived"}>
            <IconArchive />
            Archive
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SitesLoadingState() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex h-16 items-center gap-4 rounded-lg px-2">
          <Skeleton className="h-12 w-[38px] rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  )
}

function SitesErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Sites could not be loaded</AlertTitle>
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

function SitesEmptyState({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  return (
    <Empty className="min-h-[360px]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconWorldLongitude />
        </EmptyMedia>
        <EmptyTitle>No sites yet</EmptyTitle>
        <EmptyDescription>
          Create the first one-pager for this workspace. It starts as a private draft.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateSiteDialog workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
      </EmptyContent>
    </Empty>
  )
}

function SitesFilteredEmptyState({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  return (
    <Empty className="min-h-[360px]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconFilter />
        </EmptyMedia>
        <EmptyTitle>No sites match this view</EmptyTitle>
        <EmptyDescription>
          Adjust the search or create a new site for this workspace.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateSiteDialog workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
      </EmptyContent>
    </Empty>
  )
}

function SiteThumbnail({ status }: { status: SiteStatus }) {
  return (
    <div className="relative h-12 w-[38px] shrink-0 overflow-hidden rounded-md border bg-background">
      <div className="absolute inset-x-[9px] top-1.5 flex justify-center gap-1">
        <span className="size-0.5 rounded-full bg-muted-foreground" />
        <span className="size-0.5 rounded-full bg-muted-foreground" />
      </div>
      <div className="absolute top-[15px] left-[8px] h-0.5 w-[22px] rounded-full bg-muted" />
      <div className="absolute top-[20px] left-[8px] h-0.5 w-4 rounded-full bg-muted" />
      <div className="absolute right-[5px] bottom-[5px] left-[5px] h-3 rounded-sm bg-foreground" />
      <div className="absolute right-[7px] bottom-[7px] left-[7px] h-1 rounded-[2px] bg-background/20" />
      <span
        className="absolute top-1 right-1 size-1.5 rounded-full bg-muted-foreground"
        data-status={status}
      />
    </div>
  )
}

function formatSiteDate(site: SiteListItem) {
  const value = site.updatedAt ?? site.createdAt

  if (!value) {
    return "Just now"
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)
}
