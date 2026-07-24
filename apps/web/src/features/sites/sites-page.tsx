import { useDeferredValue, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import {
  IconCirclePlus,
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconFilter,
  IconRefresh,
  IconSearch,
  IconShare3,
  IconTrash,
  IconWorldLongitude,
} from "@tabler/icons-react"
import type { SiteListItem } from "@handout/contracts"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { SiteStatusBadge } from "@/components/common/status-badge"
import { LoadingState } from "@/components/common/loading-state"
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

import { deleteSite, listSites } from "./api"
import { CreateSiteDialog } from "./components/create-site-dialog"
import { DeleteSiteDialog } from "./components/delete-site-dialog"
import { SitePreviewDocumentFrame } from "./components/site-detail-ui"
import { SiteShareDialog } from "./components/site-share-dialog"
import { formatRelativeTime } from "./site-date-format"
import { createSitePreviewPayload } from "./site-preview-payload"

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
                Create a site
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
            maxLength={HANDOUT_TEXT_LIMITS.searchQuery}
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
  const activeWorkspace = useActiveWorkspace()
  const { resolvedTheme } = useTheme()
  const previewTheme = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <div className="min-w-0 overflow-hidden">
      <Table className="table-fixed border-separate border-spacing-y-0.5">
        <colgroup>
          <col />
          <col className="w-[96px]" />
          <col className="w-[76px]" />
          <col className="w-[96px]" />
          <col className="w-[84px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="px-1 text-right">
              <span className="block text-right">Recipients</span>
            </TableHead>
            <TableHead className="text-right">
              <span className="block text-right">Updated</span>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  to: "/sites/$siteId",
                  params: { siteId: site.id },
                })
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return
                }

                event.preventDefault()
                void navigate({
                  to: "/sites/$siteId",
                  params: { siteId: site.id },
                })
              }}
              className="group h-16 border-0 cursor-pointer hover:bg-transparent focus-visible:outline-none"
            >
              <TableCell className="min-w-0 overflow-hidden rounded-l-lg py-2 pr-2 pl-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <div className="flex min-w-0 items-center gap-4">
                  <SiteThumbnail
                    site={site}
                    themeMode={previewTheme}
                    workspace={activeWorkspace}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-sm leading-5">
                    <div className="truncate font-medium text-foreground">
                      {site.name}
                    </div>
                    <div className="truncate text-muted-foreground">
                      /{workspaceSlug}/{site.slug}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-2 py-2 transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                <SiteStatusBadge status={site.status} />
              </TableCell>
              <TableCell className="px-1 py-2 text-right text-sm leading-5 text-tertiary-foreground tabular-nums transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                {site.recipientCount}
              </TableCell>
              <TableCell className="px-2 py-2 text-right text-sm leading-5 text-tertiary-foreground tabular-nums transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary">
                {formatRelativeTime(site.updatedAt ?? site.createdAt)}
              </TableCell>
              <TableCell
                className="rounded-r-lg py-2 pr-2 pl-6 text-right transition-colors group-hover:bg-secondary group-focus-visible:bg-secondary"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <SiteActions
                  site={site}
                  workspaceId={activeWorkspace.id}
                  workspaceSlug={workspaceSlug}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SiteActions({
  site,
  workspaceId,
  workspaceSlug,
}: {
  site: SiteListItem
  workspaceId: string
  workspaceSlug: string
}) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const deleteSiteMutation = useMutation({
    mutationFn: () => deleteSite(site.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sites(workspaceId) })
      toast.success("Site deleted")
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-field" aria-label={`Actions for ${site.name}`}>
            <IconDotsVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to="/edit/$siteId" params={{ siteId: site.id }}>
                <IconEdit />
                Open editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <IconShare3 />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem>
              <IconCopy />
              Duplicate
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <IconTrash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SiteShareDialog
        onOpenChange={setShareOpen}
        open={shareOpen}
        siteId={site.id}
        siteVersion={site.publishedAt}
        siteSlug={site.slug}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
      <DeleteSiteDialog
        key={deleteOpen ? `delete-${site.id}` : `delete-${site.id}-closed`}
        isDeleting={deleteSiteMutation.isPending}
        onDeleteSite={() => deleteSiteMutation.mutateAsync().then(() => undefined)}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        siteName={site.name}
      />
    </>
  )
}

function SitesLoadingState() {
  return <LoadingState placement="section" label="Loading sites" />
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

function SiteThumbnail({
  site,
  themeMode,
  workspace,
}: {
  site: SiteListItem
  themeMode: "dark" | "light"
  workspace: ReturnType<typeof useActiveWorkspace>
}) {
  const payload = useMemo(() => {
    if (!site.thumbnail) {
      return null
    }

    return createSitePreviewPayload({
      content: {
        ...site.thumbnail.content,
        themeMode,
      },
      site,
      workspace,
    })
  }, [site, themeMode, workspace])

  return (
    <div
      aria-hidden="true"
      className="relative h-12 w-[38px] shrink-0 overflow-hidden rounded-md border bg-card"
    >
      {payload ? (
        <SitePreviewDocumentFrame
          canvasClassName="scale-[0.04167]"
          className="absolute top-1 left-1/2 h-12 w-[30px] -translate-x-1/2 rounded-[3px]"
          loading="lazy"
          payload={payload}
        />
      ) : (
        <Skeleton className="absolute top-1 left-1/2 h-12 w-[30px] -translate-x-1/2 rounded-[3px]" />
      )}
    </div>
  )
}
