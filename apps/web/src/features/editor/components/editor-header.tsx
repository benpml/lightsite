import { lazy, memo, Suspense, useState, type ReactNode, type SetStateAction } from "react"
import { Link } from "@tanstack/react-router"
import type { WorkspacePlan } from "@handout/contracts"
import type { SiteContent, SiteVariableDefinition } from "@handout/site-document"
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCards,
  IconChevronLeft,
  IconCircleCheck,
  IconClock,
  IconCloudOff,
  IconEye,
  IconMoon,
  IconPencil,
  IconRocket,
  IconShare3,
  IconSun,
  IconUpload,
  IconWorldLongitude,
} from "@tabler/icons-react"

import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { Badge } from "@/components/ui/badge"
import {
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SequenceProviderStack } from "./sequence-provider-icons"
import { EditorSiteSettingsMenu } from "./site-settings-menu"
import type { EditorMode, SiteTheme } from "../types"
import type {
  EditorCollaborator,
  EditorSaveStatus,
} from "../use-site-collaboration"

export type EditorPublishStatus = "published" | "unpublished" | "unpublished-changes"

const publishStatusConfig = {
  published: {
    badgeLabel: "Published",
    dotClassName: "bg-green-foreground",
    menuLabel: "Published",
  },
  unpublished: {
    badgeLabel: "Unpublished",
    dotClassName: "bg-muted-foreground",
    menuLabel: "Not yet published",
  },
  "unpublished-changes": {
    badgeLabel: "Unpublished changes",
    dotClassName: "bg-orange-foreground",
    menuLabel: "Unpublished Changes",
  },
} satisfies Record<EditorPublishStatus, {
  badgeLabel: string
  dotClassName: string
  menuLabel: string
}>

const loadSequenceEmbedDialog = () => import("./sequence-embed-dialog")
const SequenceEmbedDialog = lazy(() => loadSequenceEmbedDialog().then((module) => ({
  default: module.SequenceEmbedDialog,
})))
// Durable recipient creation must stay unavailable until the server issues
// revocable, budgeted campaign capabilities for sequence links.
const SEQUENCE_EMBED_ENABLED = false

type EditorHeaderProps = {
  canRedo: boolean
  canUndo: boolean
  canManageTracking: boolean
  collaborators: EditorCollaborator[]
  content: SiteContent
  isPublishing: boolean
  lastPublishedAt: string | null
  liveSiteDisplayUrl: string
  liveSiteUrl: string
  mode: EditorMode
  onContentChange: (content: SetStateAction<SiteContent>) => void
  onCreateVariable: (input: Pick<SiteVariableDefinition, "defaultValue" | "description" | "label">) => void
  onDeleteVariable: (variableId: string) => void
  onEditVariable: (variableId: string, input: Pick<SiteVariableDefinition, "defaultValue" | "description" | "label">) => void
  onModeChange: (mode: EditorMode) => void
  onPublish: () => Promise<void>
  onRedo: () => void
  onShare: () => void
  onToggleEditorTheme: () => void
  onUndo: () => void
  plan: WorkspacePlan
  publishStatus: EditorPublishStatus
  publicId: string
  recipientCount: number
  saveStatus: EditorSaveStatus
  editorTheme: SiteTheme
  siteName: string
  siteId: string
  usageCounts: Readonly<Record<string, number>>
  variables: SiteVariableDefinition[]
  workspaceId: string
}

export function EditorHeader({
  canRedo,
  canUndo,
  canManageTracking,
  collaborators,
  content,
  isPublishing,
  lastPublishedAt,
  liveSiteDisplayUrl,
  liveSiteUrl,
  mode,
  onContentChange,
  onCreateVariable,
  onDeleteVariable,
  onEditVariable,
  onModeChange,
  onPublish,
  onRedo,
  onShare,
  onToggleEditorTheme,
  onUndo,
  plan,
  publishStatus,
  publicId,
  recipientCount,
  saveStatus,
  editorTheme,
  siteName,
  siteId,
  usageCounts,
  variables,
  workspaceId,
}: EditorHeaderProps) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-20 flex h-[46px] shrink-0 items-center border-b border-border bg-background text-foreground">
        <div className="grid h-[30px] w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-2.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-compact"
              className="shrink-0 hover:text-accent-foreground"
              asChild
              aria-label="Back to sites"
            >
              <Link to="/sites">
                <IconChevronLeft />
              </Link>
            </Button>
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 truncate text-sm leading-5 font-medium tracking-normal text-foreground/80">
                {siteName}
              </h1>
              <EditorPublishStatusBadge status={publishStatus} />
              <EditorSaveStatusBadge status={saveStatus} />
            </div>
          </div>

          <div className="hidden min-w-0 items-center justify-center lg:flex">
            <EditorModeTabs mode={mode} onModeChange={onModeChange} />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
            <EditorCollaborators collaborators={collaborators} />
            <EditorModeToggle mode={mode} onModeChange={onModeChange} />
            <EditorHistoryControls
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo}
              onRedo={onRedo}
            />
            <Button
              variant="ghost"
              size="icon-compact"
              className="hidden text-tertiary-foreground hover:text-accent-foreground min-[480px]:inline-flex"
              aria-label={`Switch editor to ${editorTheme === "dark" ? "light" : "dark"} mode`}
              onClick={onToggleEditorTheme}
            >
              {editorTheme === "dark" ? <IconSun /> : <IconMoon />}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="hidden md:inline-flex" variant="outline" size="compact" onClick={onShare}>
                  <IconShare3 data-icon="inline-start" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share and edit recipients</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Share and edit recipients"
                  className="md:hidden"
                  variant="outline"
                  size="icon-compact"
                  onClick={onShare}
                >
                  <IconShare3 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share and edit recipients</TooltipContent>
            </Tooltip>
            <EditorPublishMenu
                  isPublishing={isPublishing}
                  lastPublishedAt={lastPublishedAt}
                  liveSiteDisplayUrl={liveSiteDisplayUrl}
                  liveSiteUrl={liveSiteUrl}
                  onPublish={onPublish}
                  onShare={onShare}
                  publishStatus={publishStatus}
                  publicId={publicId}
                  recipientCount={recipientCount}
                  variables={variables}
            />
            <EditorSiteSettingsMenu
                  canManageTracking={canManageTracking}
                  content={content}
                  onChange={onContentChange}
                  onCreateVariable={onCreateVariable}
                  onDeleteVariable={onDeleteVariable}
                  onEditVariable={onEditVariable}
                  plan={plan}
                  siteId={siteId}
                  siteName={siteName}
                  usageCounts={usageCounts}
                  variables={variables}
                  workspaceId={workspaceId}
            />
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}

function EditorSaveStatusBadge({ status }: { status: EditorSaveStatus }) {
  if (status !== "offline" && status !== "unavailable") {
    return null
  }

  const label = status === "offline" ? "Offline" : "Sync unavailable"
  const description = status === "offline"
    ? "Changes are safe on this device and will sync when you reconnect."
    : "This site could not connect to collaborative saving."

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="ghost" role="status" aria-label={description}>
          {status === "offline" ? (
            <IconCloudOff data-icon="inline-start" />
          ) : (
            <IconAlertTriangle data-icon="inline-start" />
          )}
          <span className="hidden min-[560px]:inline">{label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}

function EditorCollaborators({ collaborators }: { collaborators: EditorCollaborator[] }) {
  if (collaborators.length === 0) {
    return null
  }

  const visible = collaborators.slice(0, 3)
  const hiddenCount = collaborators.length - visible.length

  return (
    <AvatarGroup aria-label={`${collaborators.length} other editor${collaborators.length === 1 ? "" : "s"}`}>
      {visible.map((collaborator) => (
        <Tooltip key={collaborator.id}>
          <TooltipTrigger asChild>
            <RecipientAvatar
              recipient={{ name: collaborator.name }}
              shape="circle"
              size="md"
            />
          </TooltipTrigger>
          <TooltipContent>{collaborator.name} is editing</TooltipContent>
        </Tooltip>
      ))}
      {hiddenCount > 0 ? <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}

const EditorPublishMenu = memo(function EditorPublishMenu({
  isPublishing,
  lastPublishedAt,
  liveSiteDisplayUrl,
  liveSiteUrl,
  onPublish,
  onShare,
  publishStatus,
  publicId,
  recipientCount,
  variables,
}: {
  isPublishing: boolean
  lastPublishedAt: string | null
  liveSiteDisplayUrl: string
  liveSiteUrl: string
  onPublish: () => Promise<void>
  onShare: () => void
  publishStatus: EditorPublishStatus
  publicId: string
  recipientCount: number
  variables: SiteVariableDefinition[]
}) {
  const [open, setOpen] = useState(false)
  const [sequenceOpen, setSequenceOpen] = useState(false)
  const isPublished = publishStatus !== "unpublished"
  const recipientLabel = `${recipientCount} recipient ${recipientCount === 1 ? "copy" : "copies"}`
  const status = publishStatusConfig[publishStatus]

  const publish = async () => {
    try {
      await onPublish()
    } catch {
      setOpen(false)
    }
  }

  const share = () => {
    setOpen(false)
    onShare()
  }

  const openLiveSite = () => {
    if (!liveSiteUrl) {
      return
    }

    window.open(liveSiteUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Publish"
          className={cn(
            buttonVariants({ size: "compact" }),
            "max-[399px]:size-[30px] max-[399px]:px-0"
          )}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <IconUpload className="hidden max-[399px]:block" />
          )}
          <span className="max-[399px]:hidden">Publish</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[313px] rounded-xl p-0">
          <div className={cn(
            "flex flex-col px-1.5 pt-1.5 pb-2.5",
            publishStatus === "unpublished" ? "gap-1.5" : "gap-2.5"
          )}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm leading-5 font-medium text-secondary-foreground">
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", status.dotClassName)} />
                <span>{status.menuLabel}</span>
              </div>
              <div className="flex flex-col">
                <PublishDetailRow icon={<IconWorldLongitude />}>
                  {liveSiteDisplayUrl}
                </PublishDetailRow>
                <PublishDetailRow icon={<IconCards />}>
                  {recipientLabel}
                </PublishDetailRow>
                {isPublished ? (
                  <PublishDetailRow icon={<IconClock />}>
                    {getLastPublishedLabel(lastPublishedAt)}
                  </PublishDetailRow>
                ) : null}
              </div>
            </div>
            <div className={cn("flex flex-col px-1", isPublished && "gap-2")}>
              {publishStatus === "published" ? (
                <Button
                  className="w-full bg-muted text-muted-foreground hover:bg-muted disabled:opacity-100"
                  disabled
                  size="compact"
                  variant="secondary"
                >
                  <IconCircleCheck data-icon="inline-start" />
                  Published
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={isPublishing}
                  size="compact"
                  onClick={() => void publish()}
                >
                  {isPublishing ? <Spinner data-icon="inline-start" /> : <IconRocket data-icon="inline-start" />}
                  Publish
                </Button>
              )}
              {isPublished ? (
                <>
                  <Button className="w-full" size="compact" variant="outline" onClick={openLiveSite}>
                    <IconWorldLongitude data-icon="inline-start" />
                    View live site
                  </Button>
                  {SEQUENCE_EMBED_ENABLED ? (
                    <Button
                      className="w-full"
                      disabled={!publicId}
                      onFocus={() => void loadSequenceEmbedDialog()}
                      onPointerEnter={() => void loadSequenceEmbedDialog()}
                      size="compact"
                      variant="outline"
                      onClick={() => {
                        setOpen(false)
                        setSequenceOpen(true)
                      }}
                    >
                      <SequenceProviderStack />
                      Use in sequence
                    </Button>
                  ) : null}
                  <Button className="w-full" size="compact" variant="outline" onClick={share}>
                    <IconShare3 data-icon="inline-start" />
                    Share &amp; personalize
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {SEQUENCE_EMBED_ENABLED && sequenceOpen ? (
        <Suspense fallback={null}>
          <SequenceEmbedDialog
            onOpenChange={setSequenceOpen}
            open
            publicId={publicId}
            variables={variables}
          />
        </Suspense>
      ) : null}
    </>
  )
})

function PublishDetailRow({
  children,
  icon,
}: {
  children: ReactNode
  icon: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm leading-5 text-tertiary-foreground [&>svg]:size-3.5 [&>svg]:shrink-0">
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

function EditorPublishStatusBadge({ status }: { status: EditorPublishStatus }) {
  const config = publishStatusConfig[status]

  return (
    <>
      <span
        aria-label={config.badgeLabel}
        className={cn("size-2 shrink-0 rounded-full sm:hidden", config.dotClassName)}
        role="status"
      />
      <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
        <span aria-hidden="true" className={cn("size-[5px] rounded-full", config.dotClassName)} />
        {config.badgeLabel}
      </Badge>
    </>
  )
}

function getLastPublishedLabel(lastPublishedAt: string | null) {
  if (!lastPublishedAt) {
    return "Last published Never"
  }

  const publishedAt = new Date(lastPublishedAt).getTime()

  if (!Number.isFinite(publishedAt)) {
    return "Last published Unknown"
  }

  const elapsedMs = Math.max(0, Date.now() - publishedAt)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (elapsedMs < minuteMs) {
    return "Last published Just now"
  }

  if (elapsedMs < hourMs) {
    const minutes = Math.max(1, Math.round(elapsedMs / minuteMs))

    return `Last published ${minutes}m ago`
  }

  if (elapsedMs < dayMs) {
    const hours = Math.max(1, Math.round(elapsedMs / hourMs))

    return `Last published ${hours}h ago`
  }

  const days = Math.max(1, Math.round(elapsedMs / dayMs))

  return `Last published ${days}d ago`
}

function EditorModeTabs({
  mode,
  onModeChange,
}: {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
}) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => onModeChange(value as EditorMode)}
      className="flex-none gap-0"
      aria-label="Editor mode"
    >
      <TabsList className="h-[30px] rounded-full p-0.5">
        <TabsTrigger
          value="edit"
          className="h-[26px] w-[70px] flex-none rounded-full px-2 py-1 text-sm leading-5 font-medium data-[state=active]:shadow-sm"
        >
          Edit
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          className="h-[26px] w-[70px] flex-none rounded-full px-2 py-1 text-sm leading-5 font-medium data-[state=active]:shadow-sm"
        >
          Preview
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function EditorModeToggle({
  mode,
  onModeChange,
}: {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
}) {
  const isPreview = mode === "preview"
  const label = isPreview ? "Edit site" : "Preview site"

  return (
    <Button
      aria-label={label}
      className="lg:hidden"
      size="icon-compact"
      title={label}
      type="button"
      variant="ghost"
      onClick={() => onModeChange(isPreview ? "edit" : "preview")}
    >
      {isPreview ? <IconPencil /> : <IconEye />}
    </Button>
  )
}

function EditorHistoryControls({
  canRedo,
  canUndo,
  onRedo,
  onUndo,
}: {
  canRedo: boolean
  canUndo: boolean
  onRedo: () => void
  onUndo: () => void
}) {
  return (
    <div className="hidden items-center gap-0.5 md:flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Undo change"
              disabled={!canUndo}
              className={cn(
                canUndo ? "text-tertiary-foreground" : "text-muted-foreground",
                "hover:text-accent-foreground"
              )}
              onClick={onUndo}
            >
              <IconArrowBackUp />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Undo change</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Redo change"
              disabled={!canRedo}
              className={cn(
                canRedo ? "text-tertiary-foreground" : "text-muted-foreground",
                "hover:text-accent-foreground"
              )}
              onClick={onRedo}
            >
              <IconArrowForwardUp />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Redo change</TooltipContent>
      </Tooltip>
    </div>
  )
}
