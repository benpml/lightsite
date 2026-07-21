import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconGripVertical,
  IconLink,
  IconMenu2,
  IconNotes,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWorldLongitude,
  IconX,
} from "@tabler/icons-react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import {
  SITE_ICON_OPTIONS,
  getSiteIconSvgBody,
  normalizeSiteIconName,
  type SiteIconName,
} from "@handout/site-document"

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input, InputTrigger } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
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
  EditorSidebarButtonInput,
  EditorSidebarButtonStyle,
  EditorSidebarLink,
  EditorSidebarSectionKey,
  EditorSidebarSections,
  EditorSitePage,
} from "../site-sidebar-model"
import { normalizeSidebarHref } from "../site-sidebar-model"
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
  primaryColorStyle: CSSProperties
  onAddButton: (input: EditorSidebarButtonInput) => void
  onAddLink: (input: { label: string; href: string }) => void
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onDeleteButton: (buttonId: string) => void
  onDeleteLink: (linkId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onRenameSection: (section: EditorSidebarSectionKey, label: string) => void
  onReorderButton: (activeButtonId: string, overButtonId: string) => void
  onReorderLink: (activeLinkId: string, overLinkId: string) => void
  onReorderPage: (activePageId: string, overPageId: string) => void
  onSelectPage: (pageId: string) => void
  onUpdateButton: (
    buttonId: string,
    input: EditorSidebarButtonInput
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
        className="handout-editor-sidebar-desktop flex h-full w-[289px] shrink-0 flex-col gap-6 bg-background px-6 pt-[26px] pb-5 text-foreground"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarContent {...props} isEditing={isEditing} />
        </div>
        <BuiltWithHandoutFooter />
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
    <div className="handout-editor-mobile-bar h-11 shrink-0 items-center gap-2 border-b border-border-subtle bg-background px-3">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5">
            <SidebarContent {...sidebarProps} isEditing={isEditing} />
          </div>
          <div className="px-4 pb-5">
            <BuiltWithHandoutFooter />
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0 truncate text-base leading-6 font-medium text-foreground">
        {activePageName}
      </div>
    </div>
  )
}

function BuiltWithHandoutFooter() {
  return (
    <div className="flex w-full shrink-0 items-center justify-center gap-1.5 text-sm leading-6 font-normal tracking-[-0.02em] text-tertiary-foreground">
      <span
        aria-hidden="true"
        className="h-[13px] w-3 shrink-0 bg-tertiary-foreground"
        style={{
          WebkitMask: 'url("/handout-logo-icon.svg") center / contain no-repeat',
          mask: 'url("/handout-logo-icon.svg") center / contain no-repeat',
        }}
      />
      <span>
        Built with{" "}
        <a
          className="text-inherit underline decoration-current [text-decoration-skip-ink:none] [text-underline-position:from-font]"
          href="https://www.handout.link"
          rel="noreferrer"
          target="_blank"
        >
          Handout
        </a>
      </span>
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
  onReorderButton,
  onReorderLink,
  onReorderPage,
  onSelectPage,
  onUpdateButton,
  onUpdateLink,
  primaryColorStyle,
  isEditing,
}: EditorSiteSidebarProps & {
  isEditing: boolean
}) {
  return (
    <div className="handout-editor-sidebar-content flex min-w-0 w-full flex-col gap-6">
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
          isEditing ? (
            <SortableSidebarPageList
              activePageId={activePageId}
              onDeletePage={onDeletePage}
              onRenamePage={onRenamePage}
              onReorderPage={onReorderPage}
              onSelectPage={onSelectPage}
              pages={model.pages}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {model.pages.map((page) => (
                <PageRow
                  key={page.id}
                  active={page.id === activePageId}
                  canDelete={false}
                  canReorder={false}
                  isEditing={false}
                  onDeletePage={onDeletePage}
                  onRenamePage={onRenamePage}
                  onSelectPage={onSelectPage}
                  page={page}
                />
              ))}
            </div>
          )
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
          isEditing ? (
            <SortableSidebarLinkList
              links={model.links}
              onDeleteLink={onDeleteLink}
              onReorderLink={onReorderLink}
              onUpdateLink={onUpdateLink}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {model.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  rel="noreferrer"
                  target="_blank"
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 text-tertiary-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                >
                  <IconWorldLongitude className="size-4 shrink-0 text-[var(--handout-sidebar-link-icon)]" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </a>
              ))}
            </div>
          )
        ) : null}
      </SidebarSection>

      <SidebarSection
        isEditing={isEditing}
        label={model.sections.nextSteps.label}
        sectionKey="nextSteps"
        addLabel="Add button"
        addControl={
          <ButtonEditorPopover
            onSave={onAddButton}
            primaryColorStyle={primaryColorStyle}
          />
        }
        emptyAddControl={
          <ButtonEditorPopover
            onSave={onAddButton}
            primaryColorStyle={primaryColorStyle}
            showTriggerTooltip={false}
            trigger={<EmptyAddContent label="Add button" />}
            triggerClassName={emptyAddButtonClassName}
          />
        }
        onRenameSection={onRenameSection}
      >
        {model.nextSteps.length > 0 ? (
          isEditing ? (
            <SortableSidebarButtonList
              buttons={model.nextSteps}
              onDeleteButton={onDeleteButton}
              onReorderButton={onReorderButton}
              onUpdateButton={onUpdateButton}
              primaryColorStyle={primaryColorStyle}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {model.nextSteps.map((button) => (
                <a
                  key={button.id}
                  href={button.href}
                  rel="noreferrer"
                  target="_blank"
                  className={cn(
                    "handout-editor-sidebar-button flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] px-3 text-[15px] leading-5 font-medium outline-none transition",
                    button.style === "filled"
                      ? "bg-[var(--handout-primary)] text-[var(--handout-primary-foreground)] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50"
                      : "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  )}
                >
                  {button.icon ? <SiteIconGlyph name={button.icon} size={15} /> : null}
                  <span className="min-w-0 truncate">{button.label}</span>
                </a>
              ))}
            </div>
          )
        ) : null}
      </SidebarSection>
    </div>
  )
}

type SortableSidebarListItem = {
  id: string
  label: string
}

function SortableSidebarList({
  children,
  gapClassName,
  itemKind,
  items,
  onReorder,
}: {
  children: ReactNode
  gapClassName: string
  itemKind: "button" | "link" | "tab"
  items: SortableSidebarListItem[]
  onReorder: (activeItemId: string, overItemId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const itemIds = useMemo(() => items.map((item) => item.id), [items])
  const announcements = useMemo<Announcements>(() => {
    const itemLabels = new Map(items.map((item) => [item.id, item.label]))
    const fallbackLabel = itemKind[0]?.toUpperCase() + itemKind.slice(1)
    const getLabel = (id: string | number) => itemLabels.get(String(id)) ?? fallbackLabel
    const getPosition = (id: string | number) => itemIds.indexOf(String(id)) + 1

    return {
      onDragStart: ({ active }) =>
        `Picked up ${getLabel(active.id)}. Position ${getPosition(active.id)} of ${items.length}.`,
      onDragOver: ({ active, over }) => over
        ? `${getLabel(active.id)} is over position ${getPosition(over.id)} of ${items.length}.`
        : `${getLabel(active.id)} is no longer over the ${itemKind} list.`,
      onDragEnd: ({ active, over }) => over
        ? `${getLabel(active.id)} was moved to position ${getPosition(over.id)} of ${items.length}.`
        : `${getLabel(active.id)} was returned to its original position.`,
      onDragCancel: ({ active }) => `Reordering ${getLabel(active.id)} was canceled.`,
    }
  }, [itemIds, itemKind, items])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return
    }

    onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: `To pick up a ${itemKind}, press space. Use the arrow keys to move it, then press space again to drop it.`,
        },
      }}
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={cn("flex flex-col", gapClassName)}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

function SortableSidebarPageList({
  activePageId,
  onDeletePage,
  onRenamePage,
  onReorderPage,
  onSelectPage,
  pages,
}: {
  activePageId: string
  onDeletePage: (pageId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onReorderPage: (activePageId: string, overPageId: string) => void
  onSelectPage: (pageId: string) => void
  pages: EditorSitePage[]
}) {
  const items = useMemo(
    () => pages.map((page) => ({
      id: page.id,
      label: `${page.name.trim() || "Untitled"} tab`,
    })),
    [pages]
  )

  return (
    <SortableSidebarList
      gapClassName="gap-1"
      itemKind="tab"
      items={items}
      onReorder={onReorderPage}
    >
      {pages.map((page) => (
        <SortablePageRow
          key={page.id}
          active={page.id === activePageId}
          canDelete={pages.length > 1}
          canReorder={pages.length > 1}
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          onSelectPage={onSelectPage}
          page={page}
        />
      ))}
    </SortableSidebarList>
  )
}

function SortableSidebarLinkList({
  links,
  onDeleteLink,
  onReorderLink,
  onUpdateLink,
}: {
  links: EditorSidebarLink[]
  onDeleteLink: (linkId: string) => void
  onReorderLink: (activeLinkId: string, overLinkId: string) => void
  onUpdateLink: (linkId: string, input: { label: string; href: string }) => void
}) {
  const items = useMemo(
    () => links.map((link) => ({
      id: link.id,
      label: `${link.label.trim() || "Untitled"} link`,
    })),
    [links]
  )

  return (
    <SortableSidebarList
      gapClassName="gap-1"
      itemKind="link"
      items={items}
      onReorder={onReorderLink}
    >
      {links.map((link) => (
        <SortableSidebarLink
          key={link.id}
          canReorder={links.length > 1}
          link={link}
          onDelete={() => onDeleteLink(link.id)}
          onSave={(input) => onUpdateLink(link.id, input)}
        />
      ))}
    </SortableSidebarList>
  )
}

function SortableSidebarButtonList({
  buttons,
  onDeleteButton,
  onReorderButton,
  onUpdateButton,
  primaryColorStyle,
}: {
  buttons: EditorSidebarButton[]
  onDeleteButton: (buttonId: string) => void
  onReorderButton: (activeButtonId: string, overButtonId: string) => void
  onUpdateButton: (
    buttonId: string,
    input: EditorSidebarButtonInput
  ) => void
  primaryColorStyle: CSSProperties
}) {
  const items = useMemo(
    () => buttons.map((button) => ({
      id: button.id,
      label: `${button.label.trim() || "Untitled"} button`,
    })),
    [buttons]
  )

  return (
    <SortableSidebarList
      gapClassName="gap-2"
      itemKind="button"
      items={items}
      onReorder={onReorderButton}
    >
      {buttons.map((button) => (
        <SortableSidebarButton
          key={button.id}
          button={button}
          canReorder={buttons.length > 1}
          onDelete={() => onDeleteButton(button.id)}
          onSave={(input) => onUpdateButton(button.id, input)}
          primaryColorStyle={primaryColorStyle}
        />
      ))}
    </SortableSidebarList>
  )
}

function SortableSidebarItem({
  accessibleLabel,
  canReorder,
  children,
  className,
  handleClassName,
  id,
  itemKind,
}: {
  accessibleLabel: string
  canReorder: boolean
  children: (props: { onSurfacePointerDown: PointerEventHandler<HTMLElement> }) => ReactNode
  className?: string
  handleClassName?: string
  id: string
  itemKind: "button" | "link" | "tab"
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    disabled: !canReorder,
  })
  const onSurfacePointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (event.pointerType !== "touch") {
      listeners?.onPointerDown?.(event)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/sidebar-sortable relative z-0",
        className,
        isDragging && "z-10 opacity-80 drop-shadow-md"
      )}
      data-sidebar-sortable-kind={itemKind}
      data-sidebar-sortable-dragging={isDragging ? "true" : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ onSurfacePointerDown })}
      {canReorder ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${accessibleLabel}`}
          className={cn(
            "absolute top-1/2 left-1 z-10 inline-flex size-7 -translate-y-1/2 touch-none cursor-grab items-center justify-center rounded-md text-tertiary-foreground opacity-0 outline-none transition-opacity active:cursor-grabbing group-hover/sidebar-sortable:opacity-70 group-focus-within/sidebar-sortable:opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5",
            handleClassName
          )}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical data-icon />
        </button>
      ) : null}
    </div>
  )
}

function SortableSidebarLink({
  canReorder,
  link,
  onDelete,
  onSave,
}: {
  canReorder: boolean
  link: EditorSidebarLink
  onDelete: () => void
  onSave: (input: { label: string; href: string }) => void
}) {
  const editorTriggerRef = useRef<HTMLButtonElement>(null)

  return (
    <SortableSidebarItem
      accessibleLabel={`${link.label.trim() || "untitled"} link`}
      canReorder={canReorder}
      className="group/sidebar-item flex h-9 w-full items-center rounded-lg text-tertiary-foreground transition hover:bg-muted hover:text-foreground focus-within:text-foreground"
      id={link.id}
      itemKind="link"
    >
      {({ onSurfacePointerDown }) => (
        <>
          <LinkEditorPopover
            link={link}
            onDelete={onDelete}
            onSave={onSave}
            onTriggerPointerDown={onSurfacePointerDown}
            triggerClassName="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 outline-none transition-[padding] group-hover/sidebar-item:pr-[62px] group-focus-within/sidebar-item:pr-[62px] focus-visible:bg-muted focus-visible:text-foreground"
            trigger={
              <>
                <IconWorldLongitude
                  className={cn(
                    "size-4 shrink-0 text-[var(--handout-sidebar-link-icon)] transition-opacity",
                    canReorder && "group-hover/sidebar-sortable:opacity-0 group-focus-within/sidebar-sortable:opacity-0"
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
              </>
            }
            triggerRef={editorTriggerRef}
          />
          <SidebarItemHoverActions
            itemKind="link"
            itemLabel={link.label}
            onDelete={onDelete}
            onEdit={() => editorTriggerRef.current?.click()}
          />
        </>
      )}
    </SortableSidebarItem>
  )
}

function SortableSidebarButton({
  button,
  canReorder,
  onDelete,
  onSave,
  primaryColorStyle,
}: {
  button: EditorSidebarButton
  canReorder: boolean
  onDelete: () => void
  onSave: (input: EditorSidebarButtonInput) => void
  primaryColorStyle: CSSProperties
}) {
  const editorTriggerRef = useRef<HTMLButtonElement>(null)
  const filled = button.style === "filled"

  return (
    <SortableSidebarItem
      accessibleLabel={`${button.label.trim() || "untitled"} button`}
      canReorder={canReorder}
      className={cn(
        "handout-editor-sidebar-button group/sidebar-item flex h-9 w-full items-center rounded-[10px] outline-none transition",
        filled
          ? "bg-[var(--handout-primary)] text-[var(--handout-primary-foreground)] hover:brightness-95 focus-within:ring-3 focus-within:ring-ring/50"
          : "border border-border bg-background text-foreground hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50"
      )}
      handleClassName={filled
        ? "text-[var(--handout-primary-foreground)]"
        : undefined}
      id={button.id}
      itemKind="button"
    >
      {({ onSurfacePointerDown }) => (
        <>
          <ButtonEditorPopover
            button={button}
            onDelete={onDelete}
            onSave={onSave}
            primaryColorStyle={primaryColorStyle}
            onTriggerPointerDown={onSurfacePointerDown}
            triggerClassName="flex h-full min-w-0 flex-1 items-center justify-center rounded-[10px] px-3 text-[15px] leading-5 font-medium outline-none transition-[padding] group-hover/sidebar-item:px-[62px] group-focus-within/sidebar-item:px-[62px]"
            trigger={
              <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5">
                {button.icon ? <SiteIconGlyph name={button.icon} size={15} /> : null}
                <span className="min-w-0 truncate text-center">{button.label}</span>
              </span>
            }
            triggerRef={editorTriggerRef}
          />
          <SidebarItemHoverActions
            itemKind="button"
            itemLabel={button.label}
            onDelete={onDelete}
            onEdit={() => editorTriggerRef.current?.click()}
            tone={filled ? "inverse" : "default"}
          />
        </>
      )}
    </SortableSidebarItem>
  )
}

function SidebarItemHoverActions({
  itemKind,
  itemLabel,
  onDelete,
  onEdit,
  tone = "default",
}: {
  itemKind: "button" | "link"
  itemLabel: string
  onDelete: () => void
  onEdit: () => void
  tone?: "default" | "inverse"
}) {
  const actionClassName = cn(
    "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5",
    tone === "inverse"
      ? "text-[var(--handout-primary-foreground)] hover:bg-background/15 focus-visible:bg-background/15"
      : "text-tertiary-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
  )

  return (
    <div className="pointer-events-none absolute top-1/2 right-1 z-20 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/sidebar-item:pointer-events-auto group-hover/sidebar-item:opacity-100 group-focus-within/sidebar-item:pointer-events-auto group-focus-within/sidebar-item:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${itemLabel} ${itemKind}`}
            className={actionClassName}
            onClick={onEdit}
          >
            <IconPencil data-icon />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Edit {itemKind}</TooltipContent>
      </Tooltip>
      <SidebarItemDeleteConfirmation
        actionClassName={actionClassName}
        itemKind={itemKind}
        itemLabel={itemLabel}
        onDelete={onDelete}
      />
    </div>
  )
}

function SidebarItemDeleteConfirmation({
  actionClassName,
  itemKind,
  itemLabel,
  onDelete,
}: {
  actionClassName: string
  itemKind: "button" | "link"
  itemLabel: string
  onDelete: () => void
}) {
  const sectionName = itemKind === "link" ? "Links" : "Next steps"

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <AlertDialogTrigger
              type="button"
              aria-label={`Delete ${itemLabel} ${itemKind}`}
              className={actionClassName}
            >
              <IconTrash data-icon />
            </AlertDialogTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Delete {itemKind}</TooltipContent>
      </Tooltip>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemKind}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {itemLabel} from the {sectionName} section. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PageRow({
  active,
  canDelete,
  canReorder,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  page,
  isEditing,
}: {
  active: boolean
  canDelete: boolean
  canReorder: boolean
  isEditing: boolean
  onDeletePage: (pageId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onSelectPage: (pageId: string) => void
  page: EditorSitePage
}) {
  return (
    <div className={getPageRowClassName(active)}>
      <PageRowContent
        active={active}
        canDelete={canDelete}
        canReorder={canReorder}
        isEditing={isEditing}
        onDeletePage={onDeletePage}
        onRenamePage={onRenamePage}
        onSelectPage={onSelectPage}
        page={page}
      />
    </div>
  )
}

function SortablePageRow({
  active,
  canDelete,
  canReorder,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  page,
}: Omit<Parameters<typeof PageRow>[0], "isEditing">) {
  return (
    <SortableSidebarItem
      accessibleLabel={`${page.name.trim() || "untitled"} tab`}
      canReorder={canReorder}
      className={getPageRowClassName(active)}
      handleClassName={active ? "text-[var(--handout-primary)]" : undefined}
      id={page.id}
      itemKind="tab"
    >
      {({ onSurfacePointerDown }) => (
        <PageRowContent
          active={active}
          canDelete={canDelete}
          canReorder={canReorder}
          isEditing
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          onSelectPage={onSelectPage}
          onSurfacePointerDown={onSurfacePointerDown}
          page={page}
        />
      )}
    </SortableSidebarItem>
  )
}

function PageRowContent({
  active,
  canDelete,
  canReorder,
  isEditing,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  onSurfacePointerDown,
  page,
}: {
  active: boolean
  canDelete: boolean
  canReorder: boolean
  isEditing: boolean
  onDeletePage: (pageId: string) => void
  onRenamePage: (pageId: string, name: string) => void
  onSelectPage: (pageId: string) => void
  onSurfacePointerDown?: PointerEventHandler<HTMLElement>
  page: EditorSitePage
}) {
  return (
    <>
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-base leading-6 outline-none focus-visible:bg-muted"
        onClick={() => onSelectPage(page.id)}
        onPointerDown={onSurfacePointerDown}
      >
        <IconNotes
          className={cn(
            "size-4 shrink-0 transition-opacity",
            active ? "text-[var(--handout-primary)]" : "text-muted-foreground",
            canReorder && "group-hover/sidebar-sortable:opacity-0 group-focus-within/sidebar-sortable:opacity-0"
          )}
        />
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
    </>
  )
}

function getPageRowClassName(active: boolean) {
  return cn(
    "group/page relative flex h-9 w-full items-center rounded-lg outline-none transition",
    active
      ? "bg-[var(--handout-primary-soft)] text-[var(--handout-primary)]"
      : "text-tertiary-foreground hover:bg-muted"
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
  const originalNameRef = useRef(page.name)

  const cancel = () => {
    onRenamePage(page.id, originalNameRef.current)
    setOpen(false)
  }

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
        onRenamePage(page.id, originalNameRef.current)
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open, onRenamePage, page.id])

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
                originalNameRef.current = page.name
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

              if (!draftName.trim()) {
                return
              }

              setOpen(false)
            }}
          >
            <Input
              autoFocus
              maxLength={HANDOUT_TEXT_LIMITS.siteName}
              value={draftName}
              onChange={(event) => {
                const nextName = event.target.value
                setDraftName(nextName)

                if (nextName.trim()) {
                  onRenamePage(page.id, nextName)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draftName.trim()) {
                  event.preventDefault()
                  setOpen(false)
                }
              }}
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                className={cancelButtonClassName}
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!draftName.trim()}>Done</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

/**
 * PUBLISHED-SITE PARITY: Keep this section-label hierarchy aligned with the
 * `.handout-sidebar-section > h2` rule used by Preview and published sites.
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
    <section
      className={cn(
        "flex flex-col",
        sectionKey === "nextSteps" ? "gap-2.5" : "gap-2"
      )}
    >
      <div className="group/section-header flex h-[26px] items-center gap-1">
        <h2 className="handout-editor-sidebar-section-title min-w-0 flex-1">
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
  "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm leading-5 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"

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
            maxLength={HANDOUT_TEXT_LIMITS.sectionLabel}
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
  onTriggerPointerDown,
  showTriggerTooltip,
  tooltipSide,
  trigger,
  triggerClassName,
  triggerRef,
}: {
  link?: EditorSidebarLink
  onDelete?: () => void
  onSave: (input: { label: string; href: string }) => void
  onTriggerPointerDown?: PointerEventHandler<HTMLElement>
  showTriggerTooltip?: boolean
  tooltipSide?: TooltipSide
  trigger?: ReactNode
  triggerClassName?: string
  triggerRef?: Ref<HTMLButtonElement>
}) {
  return (
    <SidebarItemEditorPopover
      initialHref={link?.href ?? ""}
      initialLabel={link?.label ?? ""}
      isEditing={Boolean(link)}
      onDelete={onDelete}
      onSave={(input) => onSave({ label: input.label, href: input.href })}
      onTriggerPointerDown={onTriggerPointerDown}
      title={link ? "Edit link" : "Add link"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={link ? "Edit link" : "Add link"}
      triggerIcon={<IconPlus />}
      triggerRef={triggerRef}
      triggerWrapperClassName={link ? "w-full" : undefined}
      tooltipLabel={showTriggerTooltip === false || link ? undefined : "Add link"}
      tooltipSide={tooltipSide}
    />
  )
}

function ButtonEditorPopover({
  button,
  onDelete,
  onSave,
  primaryColorStyle,
  showTriggerTooltip,
  tooltipSide,
  onTriggerPointerDown,
  trigger,
  triggerClassName,
  triggerRef,
}: {
  button?: EditorSidebarButton
  onDelete?: () => void
  onSave: (input: EditorSidebarButtonInput) => void
  primaryColorStyle: CSSProperties
  showTriggerTooltip?: boolean
  tooltipSide?: TooltipSide
  onTriggerPointerDown?: PointerEventHandler<HTMLElement>
  trigger?: ReactNode
  triggerClassName?: string
  triggerRef?: Ref<HTMLButtonElement>
}) {
  return (
    <SidebarItemEditorPopover
      initialHref={button?.href ?? ""}
      initialIcon={button?.icon}
      initialLabel={button?.label ?? ""}
      initialStyle={button?.style ?? "filled"}
      isEditing={Boolean(button)}
      onDelete={onDelete}
      onSave={onSave}
      onTriggerPointerDown={onTriggerPointerDown}
      popoverStyle={primaryColorStyle}
      showStyle
      showIcon
      title={button ? "Edit button" : "Add button"}
      trigger={trigger}
      triggerClassName={triggerClassName}
      triggerLabel={button ? "Edit button" : "Add button"}
      triggerIcon={<IconPlus />}
      triggerRef={triggerRef}
      triggerWrapperClassName={button ? "w-full" : undefined}
      tooltipLabel={showTriggerTooltip === false || button ? undefined : "Add button"}
      tooltipSide={tooltipSide}
    />
  )
}

function SidebarItemEditorPopover({
  initialHref,
  initialIcon,
  initialLabel,
  initialStyle = "filled",
  isEditing,
  onDelete,
  onSave,
  onTriggerPointerDown,
  popoverStyle,
  showStyle = false,
  showIcon = false,
  title,
  trigger,
  triggerClassName,
  triggerIcon,
  triggerLabel,
  triggerRef,
  triggerWrapperClassName,
  tooltipLabel,
  tooltipSide,
}: {
  initialHref: string
  initialIcon?: SiteIconName
  initialLabel: string
  initialStyle?: EditorSidebarButtonStyle
  isEditing: boolean
  onDelete?: () => void
  onSave: (input: EditorSidebarButtonInput) => void
  onTriggerPointerDown?: PointerEventHandler<HTMLElement>
  popoverStyle?: CSSProperties
  showStyle?: boolean
  showIcon?: boolean
  title: string
  trigger?: ReactNode
  triggerClassName?: string
  triggerIcon: ReactNode
  triggerLabel: string
  triggerRef?: Ref<HTMLButtonElement>
  triggerWrapperClassName?: string
  tooltipLabel?: string
  tooltipSide?: TooltipSide
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(initialLabel)
  const [href, setHref] = useState(initialHref)
  const [icon, setIcon] = useState<SiteIconName | undefined>(initialIcon)
  const [style, setStyle] = useState<EditorSidebarButtonStyle>(initialStyle)
  const [submitted, setSubmitted] = useState(false)
  const labelInputId = useId()
  const hrefInputId = useId()
  const originalValueRef = useRef<EditorSidebarButtonInput>({
    href: initialHref,
    icon: initialIcon,
    label: initialLabel,
    style: initialStyle,
  })
  const normalizedHref = normalizeSidebarHref(href)
  const isValid = label.trim().length > 0 && normalizedHref !== null
  const labelError = submitted && label.trim().length === 0
  const hrefError = submitted && normalizedHref === null

  const updateLiveItem = (nextValue: EditorSidebarButtonInput) => {
    if (!isEditing || !nextValue.label.trim()) {
      return
    }

    const nextNormalizedHref = normalizeSidebarHref(nextValue.href)

    if (!nextNormalizedHref) {
      return
    }

    onSave({ ...nextValue, href: nextNormalizedHref })
  }

  const setPopoverOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      originalValueRef.current = {
        href: initialHref,
        icon: initialIcon,
        label: initialLabel,
        style: initialStyle,
      }
      setLabel(initialLabel)
      setHref(initialHref)
      setIcon(initialIcon)
      setStyle(initialStyle)
      setSubmitted(false)
    }

    setOpen(nextOpen)
  }

  const save = () => {
    setSubmitted(true)

    if (!isValid || !normalizedHref) {
      return
    }

    if (!isEditing) {
      onSave({ label, href: normalizedHref, icon, style })
    }

    setPopoverOpen(false)
  }

  const cancel = () => {
    if (isEditing) {
      onSave(originalValueRef.current)
    }

    setPopoverOpen(false)
  }

  const renderedTrigger = useMemo(() => trigger ?? triggerIcon, [trigger, triggerIcon])

  const popoverTrigger = (
    <PopoverTrigger
      ref={triggerRef}
      type="button"
      aria-label={triggerLabel}
      onPointerDown={onTriggerPointerDown}
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
            <span className={cn("inline-flex", triggerWrapperClassName)}>{popoverTrigger}</span>
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
        style={popoverStyle}
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <FieldGroup className="gap-3">
            <Field data-invalid={labelError || undefined}>
              <FieldLabel htmlFor={labelInputId}>
                {showStyle ? "Button text" : "Name"}
              </FieldLabel>
              <Input
                id={labelInputId}
                autoFocus
                value={label}
                aria-invalid={labelError}
                maxLength={HANDOUT_TEXT_LIMITS.sidebarLabel}
                onChange={(event) => {
                  const nextLabel = event.target.value
                  setLabel(nextLabel)
                  updateLiveItem({ href, icon, label: nextLabel, style })
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isValid) {
                    event.preventDefault()
                    save()
                  }
                }}
                placeholder={showStyle ? "Book a call" : "Website"}
              />
              <FieldError>{labelError ? "Name is required." : null}</FieldError>
            </Field>
            <Field data-invalid={hrefError || undefined}>
              <FieldLabel htmlFor={hrefInputId}>URL</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <IconLink aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id={hrefInputId}
                  value={href}
                  aria-invalid={hrefError}
                  maxLength={HANDOUT_TEXT_LIMITS.url}
                  onChange={(event) => {
                    const nextHref = event.target.value
                    setHref(nextHref)
                    updateLiveItem({ href: nextHref, icon, label, style })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && isValid) {
                      event.preventDefault()
                      save()
                    }
                  }}
                  placeholder="https://example.com"
                />
              </InputGroup>
              <FieldError>
                {hrefError ? "Enter a valid public website URL." : null}
              </FieldError>
            </Field>
          </FieldGroup>
          {showIcon ? (
            <ButtonIconSelector
              value={icon}
              onChange={(nextIcon) => {
                setIcon(nextIcon)
                updateLiveItem({ href, icon: nextIcon, label, style })
              }}
            />
          ) : null}
          {showStyle ? (
            <ButtonStyleSelector
              value={style}
              onChange={(nextStyle) => {
                setStyle(nextStyle)
                updateLiveItem({ href, icon, label, style: nextStyle })
              }}
            />
          ) : null}
          <div className="flex items-center justify-between gap-2">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-muted-foreground"
                onClick={() => {
                  onDelete()
                  setPopoverOpen(false)
                }}
              >
                <IconTrash data-icon="inline-start" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                className={cancelButtonClassName}
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid}>
                {isEditing ? "Done" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function ButtonIconSelector({
  onChange,
  value,
}: {
  onChange: (icon: SiteIconName | undefined) => void
  value: SiteIconName | undefined
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = value
    ? SITE_ICON_OPTIONS.find((option) => option.name === value)
    : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Icon</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <InputTrigger
            aria-haspopup="menu"
            className={cn(!value && "text-muted-foreground")}
          >
            {value ? <SiteIconGlyph name={value} size={15} /> : null}
            <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? "No icon"}</span>
            <IconChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
            />
          </InputTrigger>
        </PopoverTrigger>
        <PopoverContent
          aria-label="Button icons"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="w-auto gap-0 overflow-hidden p-0"
          role="menu"
        >
          <div className="handout-editor-icon-scroll max-h-40 p-2" aria-label="Icons">
            <div className="grid grid-cols-8 gap-1">
              {SITE_ICON_OPTIONS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  aria-label={option.label}
                  aria-checked={option.name === value}
                  className={cn(
                    "handout-editor-icon-picker-button",
                    option.name === value && "handout-editor-icon-picker-button-active"
                  )}
                  role="menuitemradio"
                  onClick={() => {
                    onChange(option.name)
                    setOpen(false)
                  }}
                >
                  <SiteIconGlyph name={option.name} size={18} />
                </button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="p-1.5" data-button-icon-menu-footer>
            <Button
              type="button"
              aria-checked={!value}
              className="w-full justify-start"
              role="menuitemradio"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
            >
              <IconX data-icon="inline-start" />
              No icon
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SiteIconGlyph({ name, size }: { name: unknown; size: number }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{
        __html: getSiteIconSvgBody(normalizeSiteIconName(name)),
      }}
    />
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
          <span className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--handout-primary)] px-4 text-sm font-medium text-[var(--handout-primary-foreground)] shadow-xs">
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
