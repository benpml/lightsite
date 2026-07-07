import { Link } from "@tanstack/react-router"
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCards,
  IconChevronDown,
  IconChevronLeft,
  IconCircleX,
  IconCopy,
  IconDotsVertical,
  IconEye,
  IconLink,
  IconTrash,
  IconVariable,
  IconWorldLongitude,
  IconCalendarClock,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LiveBadge } from "./editor-atoms"
import { type VariantRecord } from "../editor-data"

type EditorHeaderProps = {
  canRedo: boolean
  canUndo: boolean
  changeStatus: "idle" | "updating"
  preview: boolean
  siteName: string
  onRedo: () => void
  onPreviewChange: (preview: boolean) => void
  onOpenVariants: () => void
  onUndo: () => void
  onSelectVariant: (variantId: string) => void
  selectedVariantId: string
  selectedVariantName: string
  variants: VariantRecord[]
}

export function EditorHeader({
  canRedo,
  canUndo,
  changeStatus,
  preview,
  siteName,
  onRedo,
  onPreviewChange,
  onOpenVariants,
  onSelectVariant,
  onUndo,
  selectedVariantId,
  selectedVariantName,
  variants,
}: EditorHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[46px] shrink-0 items-center bg-page-background">
      <div className="flex h-[30px] w-full items-center px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-compact"
            className="text-tertiary-foreground hover:text-foreground"
            asChild
            aria-label="Back to sites"
          >
            <Link to="/sites">
              <IconChevronLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm leading-5 font-medium tracking-normal">{siteName}</h1>
            {preview ? <LiveBadge /> : <EditorChangeBadge status={changeStatus} />}
          </div>
        </div>

        {preview ? (
          <div className="flex min-w-0 flex-1 justify-center px-1.5">
            <PreviewVariantMenu
              selectedVariantId={selectedVariantId}
              selectedVariantName={selectedVariantName}
              variants={variants}
              onSelectVariant={onSelectVariant}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          {preview ? (
            <Button variant="outline" size="compact" onClick={() => onPreviewChange(false)}>
              <IconCircleX data-icon="inline-start" />
              Exit Preview
            </Button>
          ) : (
            <>
              <EditorHistoryControls
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={onUndo}
                onRedo={onRedo}
              />
              <Button variant="outline" size="compact" onClick={onOpenVariants}>
                <IconCards data-icon="inline-start" />
                Variants
              </Button>
              <Button variant="outline" size="compact" onClick={() => onPreviewChange(true)}>
                <IconEye data-icon="inline-start" />
                Preview
              </Button>
              <Button variant="outline" size="compact">
                <IconLink data-icon="inline-start" />
                Share
              </Button>
              <PublishMenu />
              <MoreMenu />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function PreviewVariantMenu({
  onSelectVariant,
  selectedVariantId,
  selectedVariantName,
  variants,
}: {
  onSelectVariant: (variantId: string) => void
  selectedVariantId: string
  selectedVariantName: string
  variants: VariantRecord[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="compact"
          className="w-[220px] max-w-full justify-between"
          aria-label="Preview variant"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <IconVariable data-icon="inline-start" />
            <span className="truncate">{selectedVariantName}</span>
          </span>
          <IconChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel>Preview as</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedVariantId} onValueChange={onSelectVariant}>
          {variants.map((variant) => (
            <DropdownMenuRadioItem key={variant.id} value={variant.id}>
              <span className="min-w-0 flex-1 truncate">{variant.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditorChangeBadge({ status }: { status: EditorHeaderProps["changeStatus"] }) {
  if (status === "updating") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Spinner className="size-3" />
        Updating
      </Badge>
    )
  }

  return <Badge variant="outline">Local draft</Badge>
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
    <TooltipProvider>
      <div className="hidden items-center gap-0.5 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <IconArrowBackUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <IconArrowForwardUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

function PublishMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="compact">Publish</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Publish checklist</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <IconWorldLongitude />
            Shareable site link ready
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconCards />
            Variant defaults ready
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconCalendarClock />
            Last edited today
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Publish</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-compact" aria-label="More editor actions">
          <IconDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <IconCopy />
            Duplicate site
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <IconTrash />
            Delete draft
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
