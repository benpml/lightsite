import { memo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCalendarClock,
  IconCards,
  IconChevronLeft,
  IconCloud,
  IconCloudCheck,
  IconCloudOff,
  IconCopy,
  IconEye,
  IconExternalLink,
  IconMoon,
  IconPencil,
  IconShare3,
  IconSun,
  IconUpload,
  IconWorldLongitude,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
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
import { EditorSiteSettingsMenu } from "./site-settings-menu"
import type { EditorMode, SiteTheme, SiteThemeMode } from "../types"
import type {
  EditorCollaborator,
  EditorSaveStatus,
} from "../use-site-collaboration"

export type EditorPublishStatus = "published" | "unpublished" | "unpublished-changes"

type EditorHeaderProps = {
  canRedo: boolean
  canUndo: boolean
  collaborators: EditorCollaborator[]
  isDeletingSite: boolean
  isDuplicatingSite: boolean
  isPublishing: boolean
  isRenamingSite: boolean
  lastPublishedAt: string | null
  liveSiteDisplayUrl: string
  liveSiteUrl: string
  mode: EditorMode
  onDeleteSite: () => Promise<void>
  onDuplicateSite: () => Promise<void>
  onModeChange: (mode: EditorMode) => void
  onPublish: () => Promise<void>
  onRedo: () => void
  onRenameSite: (name: string) => Promise<void>
  onShare: () => void
  onSiteThemeModeChange: (mode: SiteThemeMode) => void
  onToggleSiteTheme: () => void
  onUndo: () => void
  publishStatus: EditorPublishStatus
  recipientCount: number
  saveStatus: EditorSaveStatus
  siteName: string
  siteTheme: SiteTheme
  siteThemeMode: SiteThemeMode
}

export function EditorHeader({
  canRedo,
  canUndo,
  collaborators,
  isDeletingSite,
  isDuplicatingSite,
  isPublishing,
  isRenamingSite,
  lastPublishedAt,
  liveSiteDisplayUrl,
  liveSiteUrl,
  mode,
  onDeleteSite,
  onDuplicateSite,
  onModeChange,
  onPublish,
  onRedo,
  onRenameSite,
  onShare,
  onSiteThemeModeChange,
  onToggleSiteTheme,
  onUndo,
  publishStatus,
  recipientCount,
  saveStatus,
  siteName,
  siteTheme,
  siteThemeMode,
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
              aria-label={siteTheme === "dark" ? "Switch published page to light mode" : "Switch published page to dark mode"}
              onClick={onToggleSiteTheme}
            >
              {siteTheme === "dark" ? <IconSun /> : <IconMoon />}
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
                  recipientCount={recipientCount}
            />
            <EditorSiteSettingsMenu
                  isDeletingSite={isDeletingSite}
                  isDuplicatingSite={isDuplicatingSite}
                  isRenamingSite={isRenamingSite}
                  onDeleteSite={onDeleteSite}
                  onDuplicateSite={onDuplicateSite}
                  onRenameSite={onRenameSite}
                  onSiteThemeModeChange={onSiteThemeModeChange}
                  siteName={siteName}
                  siteThemeMode={siteThemeMode}
            />
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}

function EditorSaveStatusBadge({ status }: { status: EditorSaveStatus }) {
  const label = {
    connecting: "Connecting",
    offline: "Offline",
    saved: "Saved",
    saving: "Saving",
    unavailable: "Sync unavailable",
  }[status]
  const description = status === "offline"
    ? "Changes are safe on this device and will sync when you reconnect."
    : status === "unavailable"
      ? "This site could not connect to collaborative saving."
      : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="ghost" role="status" aria-label={description}>
          {status === "saving" || status === "connecting" ? (
            <Spinner data-icon="inline-start" />
          ) : status === "saved" ? (
            <IconCloudCheck data-icon="inline-start" />
          ) : status === "offline" ? (
            <IconCloudOff data-icon="inline-start" />
          ) : (
            <IconCloud data-icon="inline-start" />
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
            <Avatar size="md">
              <AvatarFallback>
                {getInitials(collaborator.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{collaborator.name} is editing</TooltipContent>
        </Tooltip>
      ))}
      {hiddenCount > 0 ? <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"
}

const EditorPublishMenu = memo(function EditorPublishMenu({
  isPublishing,
  lastPublishedAt,
  liveSiteDisplayUrl,
  liveSiteUrl,
  onPublish,
  onShare,
  publishStatus,
  recipientCount,
}: {
  isPublishing: boolean
  lastPublishedAt: string | null
  liveSiteDisplayUrl: string
  liveSiteUrl: string
  onPublish: () => Promise<void>
  onShare: () => void
  publishStatus: EditorPublishStatus
  recipientCount: number
}) {
  const [open, setOpen] = useState(false)
  const [publishedInCurrentOpen, setPublishedInCurrentOpen] = useState(false)
  const [showLiveSiteActions, setShowLiveSiteActions] = useState(false)
  const isPublished = publishStatus !== "unpublished"
  const recipientLabel = recipientCount === 0
    ? "No recipients yet"
    : `${recipientCount} recipient ${recipientCount === 1 ? "copy" : "copies"}`

  const publish = async () => {
    await onPublish()
    setPublishedInCurrentOpen(true)
  }

  const share = () => {
    setOpen(false)
    onShare()
  }

  const copyLiveSiteText = async () => {
    if (!liveSiteDisplayUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(liveSiteDisplayUrl)
      toast.success("Link copied")
    } catch {
      toast.error("Link could not be copied")
    }
  }

  const openLiveSite = () => {
    if (!liveSiteUrl) {
      return
    }

    window.open(liveSiteUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setPublishedInCurrentOpen(false)
          setShowLiveSiteActions(false)
        }
      }}
    >
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
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex flex-col p-1.5">
          {isPublished && liveSiteUrl ? (
            <div
              className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm leading-5 text-tertiary-foreground [&:focus-within_[data-live-site-actions]]:opacity-100 [&:hover_[data-live-site-actions]]:opacity-100"
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setShowLiveSiteActions(false)
                }
              }}
              onFocusCapture={() => setShowLiveSiteActions(true)}
              onMouseMove={() => setShowLiveSiteActions(true)}
              onPointerEnter={() => setShowLiveSiteActions(true)}
              onPointerLeave={() => setShowLiveSiteActions(false)}
            >
              <IconWorldLongitude className="size-3.5 shrink-0" />
              <button
                className="min-w-0 flex-1 cursor-pointer truncate text-left hover:text-foreground"
                onClick={openLiveSite}
                type="button"
              >
                {liveSiteDisplayUrl}
              </button>
              <div
                data-live-site-actions=""
                className={cn(
                  "flex shrink-0 items-center gap-0.5 transition-opacity",
                  showLiveSiteActions ? "opacity-100" : "opacity-0"
                )}
              >
                <Button
                  aria-label="Copy published link"
                  className="text-tertiary-foreground hover:text-accent-foreground"
                  size="icon-compact"
                  variant="ghost"
                  onClick={() => {
                    void copyLiveSiteText()
                  }}
                >
                  <IconCopy />
                </Button>
                <Button
                  aria-label="Open published site"
                  className="text-tertiary-foreground hover:text-accent-foreground"
                  size="icon-compact"
                  variant="ghost"
                  onClick={openLiveSite}
                >
                  <IconExternalLink />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm leading-5 text-tertiary-foreground">
              <IconWorldLongitude className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">Not yet published</span>
            </div>
          )}
          <div className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm leading-5 text-tertiary-foreground">
            <IconCalendarClock className="size-3.5 shrink-0" />
            <span>{getLastPublishedLabel(lastPublishedAt)}</span>
          </div>
          <div className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm leading-5 text-tertiary-foreground">
            <IconCards className="size-3.5 shrink-0" />
            <span>{recipientLabel}</span>
          </div>
          <div className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm leading-5 text-tertiary-foreground">
            <IconAlertTriangle className="size-3.5 shrink-0" />
            <span>Publishing updates site for all recipients</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1.5">
          <Button
            className="h-[30px] w-full"
            disabled={isPublishing}
            onClick={() => {
              if (publishedInCurrentOpen) {
                share()
                return
              }

              void publish()
            }}
            size="compact"
          >
            {isPublishing ? <Spinner data-icon="inline-start" /> : null}
            {publishedInCurrentOpen ? <IconShare3 data-icon="inline-start" /> : null}
            {publishedInCurrentOpen ? "Share" : "Publish"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

function EditorPublishStatusBadge({ status }: { status: EditorPublishStatus }) {
  const statusConfig = {
    published: {
      label: "Published",
      dotClassName: "bg-success",
    },
    unpublished: {
      label: "Unpublished",
      dotClassName: "bg-muted-faint",
    },
    "unpublished-changes": {
      label: "Unpublished changes",
      dotClassName: "bg-warning",
    },
  } satisfies Record<EditorPublishStatus, { dotClassName: string; label: string }>

  const config = statusConfig[status]

  return (
    <>
      <span
        aria-label={config.label}
        className={cn("size-2 shrink-0 rounded-full sm:hidden", config.dotClassName)}
        role="status"
      />
      <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
        <span aria-hidden="true" className={cn("size-[5px] rounded-full", config.dotClassName)} />
        {config.label}
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
