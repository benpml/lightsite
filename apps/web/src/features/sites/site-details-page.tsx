import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  IconCalendarPlus,
  IconCalendarStats,
  IconChevronLeft,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconPencil,
  IconRefresh,
  IconSettings,
  IconShare3,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconWorld,
} from "@tabler/icons-react"
import type { SiteDetailResponse } from "@handout/contracts"
import type { TrackingV2EventFeedItem } from "@handout/tracking-schema"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/common/loading-state"
import { TrackingEventCountBadge } from "@/components/data-display/tracking-event-count-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActiveWorkspace, useAppBootstrap } from "@/features/app-bootstrap/app-bootstrap-hooks"
import type { SiteRecipient } from "@/features/editor/recipients/recipient-model"
import { useSiteRecipients } from "@/features/editor/recipients/use-site-recipients"
import { listTrackingV2Events } from "@/features/tracking/api"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import {
  buildPublicSiteUrl,
  getPublicSiteDisplayUrl,
} from "@/lib/public-site-url"

import { deleteSite, getSite, getSiteContent } from "./api"
import { DeleteSiteDialog } from "./components/delete-site-dialog"
import { SiteDetailsSettingsDrawer } from "./components/site-details-settings-drawer"
import {
  DetailMetadataRow,
  RecipientLogoAvatar,
  SiteDetailPreviewCard,
  UserAvatar,
} from "./components/site-detail-ui"
import { SiteShareDialog } from "./components/site-share-dialog"
import { formatFullDateTime, formatRelativeTime } from "./site-date-format"
import { createSitePreviewPayload } from "./site-preview-payload"

export function SiteDetailsPage() {
  const params = useParams({ strict: false })
  const siteId = "siteId" in params && typeof params.siteId === "string" ? params.siteId : ""
  const activeWorkspace = useActiveWorkspace()
  const bootstrap = useAppBootstrap()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  const recipientActivityQuery = useQuery({
    queryKey: queryKeys.trackingSiteRecipientActivity(activeWorkspace.id, siteId),
    queryFn: ({ signal }) => listAllSiteTrackingEvents(activeWorkspace.id, siteId, signal),
    enabled: siteId.length > 0,
  })
  const {
    error: recipientsError,
    isLoading: recipientsLoading,
    recipients,
  } = useSiteRecipients({
    siteId,
    workspaceId: activeWorkspace.id,
  })
  const site = siteQuery.data?.site
  const recipientActivityCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const event of recipientActivityQuery.data ?? []) {
      if (event.recipient?.id) {
        counts.set(event.recipient.id, (counts.get(event.recipient.id) ?? 0) + 1)
      }
    }

    return counts
  }, [recipientActivityQuery.data])
  const draftContent = siteContentQuery.data?.draftContent
  const publicSitePath = site
    ? buildPublicSiteUrl(`${activeWorkspace.slug}/${site.slug}`)
    : ""
  const publicSiteDisplayUrl = site
    ? getPublicSiteDisplayUrl(`${activeWorkspace.slug}/${site.slug}`)
    : "handout.link/site"
  const previewPayload = site && draftContent
    ? createSitePreviewPayload({
        content: draftContent,
        site,
        workspace: activeWorkspace,
      })
    : null
  const deleteSiteMutation = useMutation({
    mutationFn: () => deleteSite(siteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sites(activeWorkspace.id) })
      toast.success("Site deleted")
      void navigate({ to: "/sites" })
    },
  })

  if (siteQuery.isLoading) {
    return <SiteDetailsLoadingState />
  }

  if (siteQuery.isError || !site) {
    return (
      <SiteDetailsErrorState
        message={getApiErrorMessage(siteQuery.error, "Site details could not be loaded.")}
        onRetry={() => void siteQuery.refetch()}
      />
    )
  }

  return (
    <div className="flex min-h-full flex-col px-6 pt-5 pb-6">
      <div className="mx-auto flex w-full max-w-[695px] flex-col">
        <div className="flex h-[26px] items-center gap-2">
          <Button asChild variant="ghost" size="icon-field" aria-label="Back to sites">
            <Link to="/sites">
              <IconChevronLeft />
            </Link>
          </Button>
          <Link
            to="/sites"
            className="min-w-0 flex-1 truncate text-sm leading-5 text-foreground"
          >
            Back
          </Link>
          <SiteDetailsOverflowMenu
            onDelete={() => setDeleteOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            settingsDisabled={!site.permissions.canEdit || !draftContent}
            site={site}
          />
        </div>

        <div className="mx-auto mt-7 flex w-full max-w-[640px] flex-col gap-9">
        <section className="@container/site-overview flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-[240px] flex-1 basis-0 flex-col gap-0.5">
              <h1 className="truncate text-xl leading-7 font-medium tracking-normal text-foreground">
                {site.name}
              </h1>
              <div className="flex min-w-0 items-center gap-1 text-sm leading-5 text-tertiary-foreground [&_svg]:size-3.5">
                <IconWorld />
                <span className="truncate">{publicSiteDisplayUrl}</span>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-start gap-2 @min-[540px]/site-overview:w-auto @min-[540px]/site-overview:min-w-[240px] @min-[540px]/site-overview:flex-1 @min-[540px]/site-overview:basis-0 @min-[540px]/site-overview:justify-end @min-[540px]/site-overview:pt-2.5">
              {site.status === "published" ? (
                <Button asChild variant="outline" size="compact" className="sm:w-[74px]">
                  <a href={publicSitePath} target="_blank" rel="noreferrer">
                    <IconExternalLink data-icon="inline-start" />
                    Open
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="compact" className="sm:w-[74px]" disabled>
                  <IconExternalLink data-icon="inline-start" />
                  Open
                </Button>
              )}
              <Button variant="outline" size="compact" className="sm:w-[76px]" onClick={() => setShareOpen(true)}>
                <IconShare3 data-icon="inline-start" />
                Share
              </Button>
              <Button asChild size="compact" className="sm:w-16">
                <Link to="/edit/$siteId" params={{ siteId }}>
                  <IconPencil data-icon="inline-start" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 @min-[540px]/site-overview:grid-cols-[216px_minmax(0,1fr)]">
            <SiteDetailPreviewCard
              isError={siteContentQuery.isError}
              isLoading={siteContentQuery.isLoading}
              onRetry={() => void siteContentQuery.refetch()}
              payload={previewPayload}
            />
            <SiteMetadataCard
              author={{
                avatarUrl: bootstrap.user.avatarUrl,
                name: bootstrap.user.name?.trim() || bootstrap.user.email,
              }}
              recipientCount={recipientsLoading ? site.recipientCount : recipients.length}
              site={site}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col">
            <h2 className="text-base leading-6 font-medium text-secondary-foreground">Recipients</h2>
            <p className="text-sm leading-5 text-muted-foreground">
              Created every time you share the site to a new recipient
            </p>
          </div>
          <RecipientsTable
            activityCounts={recipientActivityCounts}
            error={recipientsError ?? recipientActivityQuery.error}
            isLoading={recipientsLoading || recipientActivityQuery.isLoading}
            recipients={recipients}
            siteId={site.id}
          />
        </section>
        </div>
      </div>

      <SiteShareDialog
        onOpenChange={setShareOpen}
        open={shareOpen}
        siteId={site.id}
        siteVersion={site.publishedAt}
        siteSlug={site.slug}
        workspaceId={activeWorkspace.id}
        workspaceSlug={activeWorkspace.slug}
      />
      <DeleteSiteDialog
        key={deleteOpen ? `delete-${site.id}` : `delete-${site.id}-closed`}
        isDeleting={deleteSiteMutation.isPending}
        onDeleteSite={() => deleteSiteMutation.mutateAsync().then(() => undefined)}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        siteName={site.name}
      />
      {settingsOpen && draftContent ? (
        <SiteDetailsSettingsDrawer
          bootstrap={bootstrap}
          canManageTracking={activeWorkspace.role === "admin"}
          fallbackContent={draftContent}
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          plan={activeWorkspace.plan}
          siteId={site.id}
          siteName={site.name}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </div>
  )
}


function SiteDetailsOverflowMenu({
  onDelete,
  onOpenSettings,
  settingsDisabled,
  site,
}: {
  onDelete: () => void
  onOpenSettings: () => void
  settingsDisabled: boolean
  site: SiteDetailResponse["site"]
}) {
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
            <Link to="/edit/$siteId" params={{ siteId: site.id }}>
              <IconPencil />
              Open editor
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconCopy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={settingsDisabled} onSelect={onOpenSettings}>
            <IconSettings />
            Site settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <IconTrash />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SiteMetadataCard({
  author,
  recipientCount,
  site,
}: {
  author: { avatarUrl?: string | null; name: string }
  recipientCount: number
  site: SiteDetailResponse["site"]
}) {
  return (
    <div className="flex h-[150px] min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4">
      <DetailMetadataRow icon={IconUsersGroup} label="Recipients" value={recipientCount} />
      <DetailMetadataRow
        icon={IconUser}
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
        value={<span className="whitespace-nowrap">{formatFullDateTime(site.createdAt)}</span>}
      />
      <DetailMetadataRow
        icon={IconCalendarStats}
        label="Updated"
        value={<span className="whitespace-nowrap">{formatFullDateTime(site.updatedAt)}</span>}
      />
    </div>
  )
}

function RecipientsTable({
  activityCounts,
  error,
  isLoading,
  recipients,
  siteId,
}: {
  activityCounts: Map<string, number>
  error: Error | null
  isLoading: boolean
  recipients: SiteRecipient[]
  siteId: string
}) {
  const navigate = useNavigate()

  return (
    <Table className="table-fixed border-separate border-spacing-y-0.5">
      <colgroup>
        <col />
        <col className="w-[100px] sm:w-[116px]" />
        <col className="w-0 sm:w-[116px]" />
        <col className="w-16 sm:w-[70px]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead className="hidden sm:table-cell">Created</TableHead>
          <TableHead className="rounded-r-lg pr-3 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&:before]:block [&:before]:h-2 [&:before]:content-[''] [&_tr:last-child]:border-0">
        {isLoading ? (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
              <Spinner aria-label="Loading recipients" className="mx-auto" />
            </TableCell>
          </TableRow>
        ) : error ? (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={4} className="h-20 text-center text-destructive">
              Recipients could not be loaded.
            </TableCell>
          </TableRow>
        ) : recipients.length === 0 ? (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
              No recipients yet
            </TableCell>
          </TableRow>
        ) : (
          recipients.map((recipient) => {
            return (
              <TableRow
                key={recipient.id}
                className="group h-12 cursor-pointer border-0 hover:bg-transparent focus-visible:outline-none"
                role="link"
                tabIndex={0}
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
                    to: "/sites/$siteId/recipients/$recipientId",
                    params: { recipientId: recipient.id, siteId },
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return
                  }

                  event.preventDefault()
                  void navigate({
                    to: "/sites/$siteId/recipients/$recipientId",
                    params: { recipientId: recipient.id, siteId },
                  })
                }}
              >
                <TableCell className="rounded-l-lg py-2 pr-2 pl-2 transition-colors group-hover:bg-secondary">
                  <div className="flex min-w-0 items-center gap-3">
                    <RecipientLogoAvatar recipient={recipient} />
                    <span className="truncate font-medium text-foreground">
                      {recipient.name} @ {recipient.company}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-2 transition-colors group-hover:bg-secondary">
                  <TrackingEventCountBadge count={activityCounts.get(recipient.id) ?? 0} />
                </TableCell>
                <TableCell className="hidden py-2 text-tertiary-foreground transition-colors group-hover:bg-secondary sm:table-cell">
                  {formatRelativeTime(recipient.createdAt)}
                </TableCell>
                <TableCell
                  className="rounded-r-lg py-2 pr-3 text-right transition-colors group-hover:bg-secondary"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Button variant="ghost" size="icon-field" aria-label={`Actions for ${recipient.name}`}>
                    <IconDotsVertical />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

async function listAllSiteTrackingEvents(
  workspaceId: string,
  siteId: string,
  signal: AbortSignal
) {
  const events: TrackingV2EventFeedItem[] = []
  let cursor: string | undefined

  do {
    const page = await listTrackingV2Events(
      workspaceId,
      { cursor, limit: 100, siteId },
      signal
    )
    events.push(...page.events)
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  return events
}


function SiteDetailsLoadingState() {
  return <LoadingState placement="page" label="Loading site details" />
}

function SiteDetailsErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertTitle>Site could not be loaded</AlertTitle>
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
