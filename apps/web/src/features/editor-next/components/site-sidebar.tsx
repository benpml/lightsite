import { useMemo, useState, type ReactNode } from "react"
import {
  IconArrowRight,
  IconFileText,
  IconLink,
  IconMenu2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWorld,
} from "@tabler/icons-react"

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
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type {
  EditorNextSidebarButton,
  EditorNextSidebarButtonStyle,
  EditorNextSidebarLink,
  EditorNextSidebarSectionKey,
  EditorNextSidebarSections,
  EditorNextSitePage,
} from "../site-sidebar-model"
import { isUrlish, normalizeSidebarHref } from "../site-sidebar-model"
import type { EditorNextMode } from "../types"

type EditorNextSidebarModel = {
  sections: EditorNextSidebarSections
  pages: EditorNextSitePage[]
  links: EditorNextSidebarLink[]
  nextSteps: EditorNextSidebarButton[]
}

type EditorNextSiteSidebarProps = {
  activePageId: string
  mode: EditorNextMode
  model: EditorNextSidebarModel
  onAddButton: (input: { label: string; href: string; style: EditorNextSidebarButtonStyle }) => void
  onAddLink: (input: { label: string; href: string }) => void
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onDeleteButton: (buttonId: string) => void
  onDeleteLink: (linkId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onRenameSection: (section: EditorNextSidebarSectionKey, label: string) => void
  onSelectPage: (pageId: string) => void
  onUpdateButton: (
    buttonId: string,
    input: { label: string; href: string; style: EditorNextSidebarButtonStyle }
  ) => void
  onUpdateLink: (linkId: string, input: { label: string; href: string }) => void
}

export function EditorNextSiteSidebar(props: EditorNextSiteSidebarProps) {
  const activePage =
    props.model.pages.find((page) => page.id === props.activePageId) ??
    props.model.pages[0] ??
    null
  const isEditing = props.mode === "edit"
  const hasPreviewNavigation =
    props.model.pages.length > 1 ||
    props.model.links.length > 0 ||
    props.model.nextSteps.length > 0

  if (!isEditing && !hasPreviewNavigation) {
    return null
  }

  return (
    <>
      <MobileSiteSidebar
        {...props}
        activePageName={activePage?.name ?? "Page"}
        isEditing={isEditing}
      />
      <aside
        aria-label={isEditing ? "Site sidebar editor" : "Site navigation"}
        className="hidden w-[289px] shrink-0 border-r border-transparent bg-background px-6 pt-[26px] text-foreground md:block"
      >
        <SidebarContent {...props} isEditing={isEditing} />
      </aside>
    </>
  )
}

function MobileSiteSidebar({
  activePageName,
  isEditing,
  ...sidebarProps
}: EditorNextSiteSidebarProps & {
  activePageName: string
  isEditing: boolean
}) {
  return (
    <div className="flex h-16 shrink-0 items-center border-b border-border-subtle bg-background px-5 md:hidden">
      <Sheet>
        <SheetTrigger
          type="button"
          aria-label="Open site navigation"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition hover:bg-muted focus-visible:bg-muted [&_svg]:size-6"
        >
          <IconMenu2 />
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[289px] max-w-[86vw] gap-0 bg-background p-0"
        >
          <SheetHeader className="border-b border-border-subtle px-6 py-5">
            <SheetTitle className="truncate text-base leading-6 font-medium">
              {activePageName}
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 pt-[26px]">
            <SidebarContent {...sidebarProps} isEditing={isEditing} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="ml-5 min-w-0 truncate text-base leading-6 font-medium text-foreground">
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
}: EditorNextSiteSidebarProps & {
  isEditing: boolean
}) {
  const visiblePages = isEditing || model.pages.length > 1 ? model.pages : []

  return (
    <div className="flex w-[241px] flex-col gap-4">
      <SidebarSection
        isEditing={isEditing}
        label={model.sections.tabs.label}
        sectionKey="tabs"
        addLabel="Add page"
        addControl={<HeaderAddButton label="Add page" onClick={onAddPage} />}
        emptyAddControl={<EmptyAddButton label="Add page" onClick={onAddPage} />}
        onRenameSection={onRenameSection}
      >
        {visiblePages.length > 0 ? (
          <div className="flex flex-col gap-1">
            {visiblePages.map((page) => (
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
                  triggerClassName="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 tracking-normal text-foreground outline-none transition hover:bg-muted focus-visible:bg-muted"
                  trigger={
                    <>
                      <IconWorld className="size-4 shrink-0 text-tertiary-foreground" />
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
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
  page: EditorNextSitePage
}) {
  return (
    <div
      className={cn(
        "group/page flex h-9 w-full items-center rounded-lg outline-none transition",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-foreground hover:bg-muted"
      )}
    >
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 tracking-normal outline-none focus-visible:bg-muted"
        onClick={() => onSelectPage(page.id)}
      >
        <IconFileText className="size-4 shrink-0 text-tertiary-foreground" />
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
  page: EditorNextSitePage
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        type="button"
        aria-label={`Delete ${page.name} tab`}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
      >
        <IconTrash />
      </AlertDialogTrigger>
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
  page: EditorNextSitePage
}) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(page.name)

  const setPopoverOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftName(page.name)
    }

    setOpen(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`Edit ${page.name} tab name`}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
      >
        <IconPencil />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        collisionPadding={12}
        className="w-[260px] gap-3 p-3"
      >
        <PopoverHeader>
          <PopoverTitle>Edit tab name</PopoverTitle>
        </PopoverHeader>
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
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

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
  onRenameSection: (section: EditorNextSidebarSectionKey, label: string) => void
  sectionKey: EditorNextSidebarSectionKey
  isEditing: boolean
}) {
  const hasItems = hasRenderableChildren(children)

  if (!isEditing && !hasItems) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="group/section-header flex h-[26px] items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-sm leading-6 font-normal tracking-normal text-secondary-foreground">
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
    <Button
      type="button"
      variant="ghost"
      size="icon-field"
      aria-label={label}
      className="text-tertiary-foreground hover:bg-muted hover:text-foreground"
      onClick={onClick}
    >
      <IconPlus />
    </Button>
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
  "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm leading-5 tracking-normal text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"

function SectionLabelPopover({
  label,
  onRenameSection,
  sectionKey,
}: {
  label: string
  onRenameSection: (section: EditorNextSidebarSectionKey, label: string) => void
  sectionKey: EditorNextSidebarSectionKey
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
      <PopoverTrigger
        type="button"
        aria-label={`Edit ${label} section name`}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground opacity-0 outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:opacity-100 group-hover/section-header:opacity-100 data-[state=open]:opacity-100 [&_svg]:size-3.5"
      >
        <IconPencil />
      </PopoverTrigger>
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
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
  trigger,
  triggerClassName,
}: {
  link?: EditorNextSidebarLink
  onDelete?: () => void
  onSave: (input: { label: string; href: string }) => void
  trigger?: ReactNode
  triggerClassName?: string
}) {
  return (
    <SidebarItemEditorPopover
      deleteLabel="Delete link"
      initialHref={link?.href ?? ""}
      initialLabel={link?.label ?? ""}
      onDelete={onDelete}
      onSave={(input) => onSave({ label: input.label, href: input.href })}
      title={link ? "Edit link" : "Add link"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel="Add link"
      triggerIcon={<IconPlus />}
    />
  )
}

function ButtonEditorPopover({
  button,
  onDelete,
  onSave,
  trigger,
  triggerClassName,
}: {
  button?: EditorNextSidebarButton
  onDelete?: () => void
  onSave: (input: { label: string; href: string; style: EditorNextSidebarButtonStyle }) => void
  trigger?: ReactNode
  triggerClassName?: string
}) {
  return (
    <SidebarItemEditorPopover
      deleteLabel="Delete button"
      initialHref={button?.href ?? ""}
      initialLabel={button?.label ?? ""}
      initialStyle={button?.style ?? "filled"}
      onDelete={onDelete}
      onSave={onSave}
      showStyle
      title={button ? "Edit button" : "Add button"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel="Add button"
      triggerIcon={<IconPlus />}
    />
  )
}

function SidebarItemEditorPopover({
  deleteLabel,
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
}: {
  deleteLabel: string
  initialHref: string
  initialLabel: string
  initialStyle?: EditorNextSidebarButtonStyle
  onDelete?: () => void
  onSave: (input: { label: string; href: string; style: EditorNextSidebarButtonStyle }) => void
  showStyle?: boolean
  title: string
  trigger?: ReactNode
  triggerClassName?: string
  triggerIcon: ReactNode
  triggerLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(initialLabel)
  const [href, setHref] = useState(initialHref)
  const [style, setStyle] = useState<EditorNextSidebarButtonStyle>(initialStyle)
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

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        type="button"
        aria-label={triggerLabel}
        className={cn(
          triggerClassName ??
            "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground [&_svg]:size-3.5"
        )}
      >
        {renderedTrigger}
      </PopoverTrigger>
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
            <span>Name</span>
            <Input
              autoFocus
              value={label}
              aria-invalid={labelError}
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
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
            {hrefError ? (
              <span className="text-xs font-normal text-destructive">Enter a valid URL.</span>
            ) : null}
          </label>
          {showStyle ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Button style">
              <Button
                type="button"
                variant={style === "filled" ? "secondary" : "outline"}
                onClick={() => setStyle("filled")}
              >
                Filled
              </Button>
              <Button
                type="button"
                variant={style === "outline" ? "secondary" : "outline"}
                onClick={() => setStyle("outline")}
              >
                Outline
              </Button>
            </div>
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
                {deleteLabel}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
