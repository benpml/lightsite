import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import {
  IconLink,
  IconMenu2,
  IconNotes,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  EditorSidebarButton,
  EditorSidebarButtonStyle,
  EditorSidebarLink,
  EditorSidebarSectionKey,
  EditorSidebarSections,
  EditorSitePage,
} from "../site-sidebar-model"
import { isUrlish, normalizeSidebarHref } from "../site-sidebar-model"
import type { EditorMode } from "../types"

type EditorSidebarModel = {
  sections: EditorSidebarSections
  pages: EditorSitePage[]
  links: EditorSidebarLink[]
  nextSteps: EditorSidebarButton[]
}

type TooltipSide = ComponentProps<typeof TooltipContent>["side"]

const cancelButtonClassName =
  "text-tertiary-foreground hover:text-tertiary-foreground focus-visible:text-tertiary-foreground"

type EditorSiteSidebarProps = {
  activePageId: string
  mode: EditorMode
  model: EditorSidebarModel
  onAddButton: (input: { label: string; href: string; style: EditorSidebarButtonStyle }) => void
  onAddLink: (input: { label: string; href: string }) => void
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onDeleteButton: (buttonId: string) => void
  onDeleteLink: (linkId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onRenameSection: (section: EditorSidebarSectionKey, label: string) => void
  onSelectPage: (pageId: string) => void
  onUpdateButton: (
    buttonId: string,
    input: { label: string; href: string; style: EditorSidebarButtonStyle }
  ) => void
  onUpdateLink: (linkId: string, input: { label: string; href: string }) => void
}

export function EditorSiteSidebar(props: EditorSiteSidebarProps) {
  const activePage =
    props.model.pages.find((page) => page.id === props.activePageId) ??
    props.model.pages[0] ??
    null
  const isEditing = props.mode === "edit"
  const hasPreviewNavigation =
    props.model.pages.length > 0 ||
    props.model.links.length > 0 ||
    props.model.nextSteps.length > 0

  if (!isEditing && !hasPreviewNavigation) {
    return null
  }

  return (
    <TooltipProvider>
      <MobileSiteSidebar
        {...props}
        activePageName={activePage?.name ?? "Page"}
        isEditing={isEditing}
      />
      <aside
        aria-label={isEditing ? "Site sidebar editor" : "Site navigation"}
        className="ls-editor-sidebar-desktop w-[289px] shrink-0 border-r border-transparent bg-background px-6 pt-[26px] text-foreground"
      >
        <SidebarContent {...props} isEditing={isEditing} />
      </aside>
    </TooltipProvider>
  )
}

/**
 * PUBLISHED-SITE PARITY: This edit-only sidebar shell must mirror the public
 * sidebar semantics in `packages/site-document/src/styles.ts`.
 */
function MobileSiteSidebar({
  activePageName,
  isEditing,
  ...sidebarProps
}: EditorSiteSidebarProps & {
  activePageName: string
  isEditing: boolean
}) {
  return (
    <div className="ls-editor-mobile-bar h-11 shrink-0 items-center gap-2 border-b border-border-subtle bg-background px-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open site navigation"
            className="text-tertiary-foreground"
          >
            <IconMenu2 data-icon />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="data-[side=left]:w-[min(289px,86vw)] gap-0 bg-background p-0"
        >
          <SheetHeader className="flex h-11 flex-row items-center border-b border-border-subtle px-4 py-0 pr-12">
            <SheetTitle className="truncate text-base leading-6 font-medium text-tertiary-foreground">
              {activePageName}
            </SheetTitle>
          </SheetHeader>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close site navigation"
              className="absolute top-2 right-2 text-tertiary-foreground"
            >
              <IconX data-icon />
            </Button>
          </SheetClose>
          <div className="px-4 pt-5">
            <SidebarContent {...sidebarProps} isEditing={isEditing} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0 truncate text-base leading-6 font-medium text-foreground">
        {activePageName}
      </div>
    </div>
  )
}

function SidebarContent({
  activePageId,
  model,
  onAddButton,
  onAddLink,
  onAddPage,
  onDeletePage,
  onDeleteButton,
  onDeleteLink,
  onRenamePage,
  onRenameSection,
  onSelectPage,
  onUpdateButton,
  onUpdateLink,
  isEditing,
}: EditorSiteSidebarProps & {
  isEditing: boolean
}) {
  return (
    <div className="ls-editor-sidebar-content flex min-w-0 w-full flex-col gap-4">
      <SidebarSection
        isEditing={isEditing}
        label={model.sections.tabs.label}
        sectionKey="tabs"
        addLabel="Add tab"
        addControl={<HeaderAddButton label="Add tab" onClick={onAddPage} />}
        emptyAddControl={<EmptyAddButton label="Add tab" onClick={onAddPage} />}
        onRenameSection={onRenameSection}
      >
        {model.pages.length > 0 ? (
          <div className="flex flex-col gap-1">
            {model.pages.map((page) => (
              <PageRow
                key={page.id}
                active={page.id === activePageId}
                canDelete={model.pages.length > 1}
                isEditing={isEditing}
                onDeletePage={onDeletePage}
                onRenamePage={onRenamePage}
                onSelectPage={onSelectPage}
                page={page}
              />
            ))}
          </div>
        ) : null}
      </SidebarSection>

      <SidebarSection
        isEditing={isEditing}
        label={model.sections.links.label}
        sectionKey="links"
        addLabel="Add link"
        addControl={<LinkEditorPopover onSave={onAddLink} />}
        emptyAddControl={
          <LinkEditorPopover
            onSave={onAddLink}
            showTriggerTooltip={false}
            trigger={<EmptyAddContent label="Add link" />}
            triggerClassName={emptyAddButtonClassName}
          />
        }
        onRenameSection={onRenameSection}
      >
        {model.links.length > 0 ? (
          <div className="flex flex-col gap-1">
            {model.links.map((link) => (
              isEditing ? (
                <LinkEditorPopover
                  key={link.id}
                  link={link}
                  onDelete={() => onDeleteLink(link.id)}
                  onSave={(input) => onUpdateLink(link.id, input)}
                  tooltipSide="right"
                  triggerClassName="group/sidebar-link flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 tracking-normal text-foreground outline-none transition hover:bg-muted focus-visible:bg-muted"
                  trigger={
                    <>
                      <IconWorld className="size-4 shrink-0 text-tertiary-foreground" />
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      <IconPencil className="size-3.5 shrink-0 text-tertiary-foreground opacity-0 transition-opacity group-hover/sidebar-link:opacity-100 group-focus-visible/sidebar-link:opacity-100" />
                    </>
                  }
                />
              ) : (
                <a
                  key={link.id}
                  href={link.href}
                  rel="noreferrer"
                  target="_blank"
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 tracking-normal text-foreground outline-none transition hover:bg-muted focus-visible:bg-muted"
                >
                  <IconWorld className="size-4 shrink-0 text-tertiary-foreground" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </a>
              )
            ))}
          </div>
        ) : null}
      </SidebarSection>

      <SidebarSection
        isEditing={isEditing}
        label={model.sections.nextSteps.label}
        sectionKey="nextSteps"
        addLabel="Add button"
        addControl={<ButtonEditorPopover onSave={onAddButton} />}
        emptyAddControl={
          <ButtonEditorPopover
            onSave={onAddButton}
            showTriggerTooltip={false}
            trigger={<EmptyAddContent label="Add button" />}
            triggerClassName={emptyAddButtonClassName}
          />
        }
        onRenameSection={onRenameSection}
      >
        {model.nextSteps.length > 0 ? (
          <div className="flex flex-col gap-2">
            {model.nextSteps.map((button) => (
              isEditing ? (
                <ButtonEditorPopover
                  key={button.id}
                  button={button}
                  onDelete={() => onDeleteButton(button.id)}
                  onSave={(input) => onUpdateButton(button.id, input)}
                  tooltipSide="right"
                  triggerClassName={cn(
                    "flex h-9 w-full items-center justify-center gap-2 rounded-[10px] px-3 text-[15px] leading-5 font-medium tracking-normal outline-none transition",
                    button.style === "filled"
                      ? "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                      : "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  )}
                  trigger={<span className="min-w-0 truncate">{button.label}</span>}
                />
              ) : (
                <a
                  key={button.id}
                  href={button.href}
                  rel="noreferrer"
                  target="_blank"
                  className={cn(
                    "flex h-9 w-full items-center justify-center gap-2 rounded-[10px] px-3 text-[15px] leading-5 font-medium tracking-normal outline-none transition",
                    button.style === "filled"
                      ? "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                      : "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  )}
                >
                  <span className="min-w-0 truncate">{button.label}</span>
                </a>
              )
            ))}
          </div>
        ) : null}
      </SidebarSection>
    </div>
  )
}

function PageRow({
  active,
  canDelete,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  page,
  isEditing,
}: {
  active: boolean
  canDelete: boolean
  isEditing: boolean
  onDeletePage: (pageId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onSelectPage: (pageId: string) => void
  page: EditorSitePage
}) {
  return (
    <div
      className={cn(
        "group/page relative flex h-9 w-full items-center rounded-lg outline-none transition",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-tertiary-foreground hover:bg-muted"
      )}
    >
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 tracking-normal outline-none focus-visible:bg-muted"
        onClick={() => onSelectPage(page.id)}
      >
        <IconNotes className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{page.name}</span>
      </button>
      {isEditing ? (
        <div className="mr-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/page:opacity-100 group-focus-within/page:opacity-100">
          <PageRenamePopover page={page} onRenamePage={onRenamePage} />
          {canDelete ? (
            <PageDeleteConfirmation page={page} onDeletePage={onDeletePage} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PageDeleteConfirmation({
  onDeletePage,
  page,
}: {
  onDeletePage: (pageId: string) => void
  page: EditorSitePage
}) {
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <AlertDialogTrigger
              type="button"
              aria-label={`Delete ${page.name} tab`}
              className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
            >
              <IconTrash />
            </AlertDialogTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>Delete tab</TooltipContent>
      </Tooltip>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete tab?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the {page.name} page from this site. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onDeletePage(page.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PageRenamePopover({
  onRenamePage,
  page,
}: {
  onRenamePage: (pageId: string, name: string) => void
  page: EditorSitePage
}) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(page.name)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  return (
    <div ref={panelRef} className="relative inline-flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <button
              type="button"
              aria-label={`Edit ${page.name} tab name`}
              className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
              onClick={() => {
                setDraftName(page.name)
                setOpen(true)
              }}
            >
              <IconPencil />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Edit tab name</TooltipContent>
      </Tooltip>
      {open ? (
        <div
          role="dialog"
          aria-label="Edit tab name"
          className="absolute top-0 left-full z-50 ml-2 flex w-[260px] flex-col gap-3 rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="font-medium">Edit tab name</div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              onRenamePage(page.id, draftName)
              setOpen(false)
            }}
          >
            <Input
              autoFocus
              maxLength={LIGHTSITE_TEXT_LIMITS.siteName}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cancelButtonClassName}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

/**
 * PUBLISHED-SITE PARITY: Keep this section-label hierarchy aligned with the
 * `.ls-sidebar-section > h2` rule used by Preview and published sites.
 */
function SidebarSection({
  addControl,
  addLabel,
  children,
  emptyAddControl,
  label,
  onRenameSection,
  sectionKey,
  isEditing,
}: {
  addControl: ReactNode
  addLabel: string
  children: ReactNode
  emptyAddControl: ReactNode
  label: string
  onRenameSection: (section: EditorSidebarSectionKey, label: string) => void
  sectionKey: EditorSidebarSectionKey
  isEditing: boolean
}) {
  const hasItems = hasRenderableChildren(children)

  if (!isEditing && !hasItems) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="group/section-header flex h-[26px] items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-sm leading-6 font-medium tracking-normal text-muted-foreground">
          {label}
        </h2>
        {isEditing ? (
          <SectionLabelPopover
            label={label}
            sectionKey={sectionKey}
            onRenameSection={onRenameSection}
          />
        ) : null}
        {isEditing && hasItems ? addControl : null}
      </div>
      {children}
      {isEditing && !hasItems ? <div aria-label={addLabel}>{emptyAddControl}</div> : null}
    </section>
  )
}

function HeaderAddButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-field"
          aria-label={label}
          className="text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClick}
        >
          <IconPlus />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EmptyAddButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={emptyAddButtonClassName}
      onClick={onClick}
    >
      <EmptyAddContent label={label} />
    </button>
  )
}

function EmptyAddContent({ label }: { label: string }) {
  return (
    <>
      <IconPlus className="size-3.5 shrink-0" />
      <span>{label}</span>
    </>
  )
}

const emptyAddButtonClassName =
  "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm leading-5 tracking-normal text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"

function SectionLabelPopover({
  label,
  onRenameSection,
  sectionKey,
}: {
  label: string
  onRenameSection: (section: EditorSidebarSectionKey, label: string) => void
  sectionKey: EditorSidebarSectionKey
}) {
  const [open, setOpen] = useState(false)
  const [draftLabel, setDraftLabel] = useState(label)

  const setPopoverOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftLabel(label)
    }

    setOpen(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger
              type="button"
              aria-label={`Edit ${label} section name`}
              className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground opacity-0 outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 group-hover/section-header:opacity-100 data-[state=open]:opacity-100 [&_svg]:size-3.5"
            >
              <IconPencil />
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>Edit section name</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        collisionPadding={12}
        className="w-[260px] gap-3 p-3"
      >
        <PopoverHeader>
          <PopoverTitle>Edit section name</PopoverTitle>
        </PopoverHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            onRenameSection(sectionKey, draftLabel)
            setOpen(false)
          }}
        >
          <Input
            autoFocus
            maxLength={LIGHTSITE_TEXT_LIMITS.sectionLabel}
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className={cancelButtonClassName}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function LinkEditorPopover({
  link,
  onDelete,
  onSave,
  showTriggerTooltip,
  tooltipSide,
  trigger,
  triggerClassName,
}: {
  link?: EditorSidebarLink
  onDelete?: () => void
  onSave: (input: { label: string; href: string }) => void
  showTriggerTooltip?: boolean
  tooltipSide?: TooltipSide
  trigger?: ReactNode
  triggerClassName?: string
}) {
  return (
    <SidebarItemEditorPopover
      initialHref={link?.href ?? ""}
      initialLabel={link?.label ?? ""}
      onDelete={onDelete}
      onSave={(input) => onSave({ label: input.label, href: input.href })}
      title={link ? "Edit link" : "Add link"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={link ? "Edit link" : "Add link"}
      triggerIcon={<IconPlus />}
      tooltipLabel={showTriggerTooltip === false ? undefined : link ? "Edit link" : "Add link"}
      tooltipSide={tooltipSide}
    />
  )
}

function ButtonEditorPopover({
  button,
  onDelete,
  onSave,
  showTriggerTooltip,
  tooltipSide,
  trigger,
  triggerClassName,
}: {
  button?: EditorSidebarButton
  onDelete?: () => void
  onSave: (input: { label: string; href: string; style: EditorSidebarButtonStyle }) => void
  showTriggerTooltip?: boolean
  tooltipSide?: TooltipSide
  trigger?: ReactNode
  triggerClassName?: string
}) {
  return (
    <SidebarItemEditorPopover
      initialHref={button?.href ?? ""}
      initialLabel={button?.label ?? ""}
      initialStyle={button?.style ?? "filled"}
      onDelete={onDelete}
      onSave={onSave}
      showStyle
      title={button ? "Edit button" : "Add button"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={button ? "Edit button" : "Add button"}
      triggerIcon={<IconPlus />}
      tooltipLabel={showTriggerTooltip === false ? undefined : button ? "Edit button" : "Add button"}
      tooltipSide={tooltipSide}
    />
  )
}

function SidebarItemEditorPopover({
  initialHref,
  initialLabel,
  initialStyle = "filled",
  onDelete,
  onSave,
  showStyle = false,
  title,
  trigger,
  triggerClassName,
  triggerIcon,
  triggerLabel,
  tooltipLabel,
  tooltipSide,
}: {
  initialHref: string
  initialLabel: string
  initialStyle?: EditorSidebarButtonStyle
  onDelete?: () => void
  onSave: (input: { label: string; href: string; style: EditorSidebarButtonStyle }) => void
  showStyle?: boolean
  title: string
  trigger?: ReactNode
  triggerClassName?: string
  triggerIcon: ReactNode
  triggerLabel: string
  tooltipLabel?: string
  tooltipSide?: TooltipSide
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(initialLabel)
  const [href, setHref] = useState(initialHref)
  const [style, setStyle] = useState<EditorSidebarButtonStyle>(initialStyle)
  const [submitted, setSubmitted] = useState(false)
  const labelError = submitted && label.trim().length === 0
  const hrefError = submitted && !isUrlish(href)

  const setPopoverOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setLabel(initialLabel)
      setHref(initialHref)
      setStyle(initialStyle)
      setSubmitted(false)
    }

    setOpen(nextOpen)
  }

  const save = () => {
    setSubmitted(true)
    const normalizedHref = normalizeSidebarHref(href)

    if (!label.trim() || !normalizedHref) {
      return
    }

    onSave({ label, href: normalizedHref, style })
    setOpen(false)
  }

  const renderedTrigger = useMemo(() => trigger ?? triggerIcon, [trigger, triggerIcon])

  const popoverTrigger = (
    <PopoverTrigger
      type="button"
      aria-label={triggerLabel}
      className={cn(
        triggerClassName ??
          "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
      )}
    >
      {renderedTrigger}
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      {tooltipLabel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{popoverTrigger}</span>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{tooltipLabel}</TooltipContent>
        </Tooltip>
      ) : (
        popoverTrigger
      )}
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        collisionPadding={12}
        className="w-[304px] gap-3 p-3"
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{showStyle ? "Button text" : "Name"}</span>
            <Input
              autoFocus
              value={label}
              aria-invalid={labelError}
              maxLength={LIGHTSITE_TEXT_LIMITS.sidebarLabel}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={showStyle ? "Book a call" : "Website"}
            />
            {labelError ? (
              <span className="text-xs font-normal text-destructive">Name is required.</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>URL</span>
            <div className="relative">
              <IconLink className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={href}
                aria-invalid={hrefError}
                className="pl-8"
                maxLength={LIGHTSITE_TEXT_LIMITS.url}
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
            {hrefError ? (
              <span className="text-xs font-normal text-destructive">Enter a valid public website URL.</span>
            ) : null}
          </label>
          {showStyle ? (
            <ButtonStyleSelector value={style} onChange={setStyle} />
          ) : null}
          <div className="flex items-center justify-between gap-2">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-muted-foreground"
                onClick={() => {
                  onDelete()
                  setOpen(false)
                }}
              >
                <IconTrash data-icon="inline-start" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cancelButtonClassName}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ButtonStyleSelector({
  onChange,
  value,
}: {
  onChange: (style: EditorSidebarButtonStyle) => void
  value: EditorSidebarButtonStyle
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Style</span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Button style">
        <button
          type="button"
          aria-pressed={value === "filled"}
          className={cn(
            "flex h-14 items-center justify-center rounded-lg border bg-transparent px-2 outline-none transition hover:bg-neutral-alpha-a200 focus-visible:bg-neutral-alpha-a200 focus-visible:ring-3 focus-visible:ring-ring/50",
            value === "filled"
              ? "border-transparent shadow-[inset_0_0_0_1px_var(--selection-foreground)]"
              : "border-border shadow-none"
          )}
          onClick={() => onChange("filled")}
        >
          <span className="inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background shadow-xs">
            Primary
          </span>
        </button>
        <button
          type="button"
          aria-pressed={value === "outline"}
          className={cn(
            "flex h-14 items-center justify-center rounded-lg border bg-transparent px-2 outline-none transition hover:bg-neutral-alpha-a200 focus-visible:bg-neutral-alpha-a200 focus-visible:ring-3 focus-visible:ring-ring/50",
            value === "outline"
              ? "border-transparent shadow-[inset_0_0_0_1px_var(--selection-foreground)]"
              : "border-border shadow-none"
          )}
          onClick={() => onChange("outline")}
        >
          <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-background px-4 text-sm font-medium text-foreground shadow-xs dark:border-neutral-alpha-a900 dark:bg-neutral-alpha-a700">
            Secondary
          </span>
        </button>
      </div>
    </div>
  )
}

function hasRenderableChildren(children: ReactNode) {
  if (!children) {
    return false
  }

  if (Array.isArray(children)) {
    return children.some(Boolean)
  }

  return true
}
