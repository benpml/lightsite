import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentType,
} from "react"
import type { Editor as TiptapEditor } from "@tiptap/core"
import DragHandle from "@tiptap/extension-drag-handle-react"
import {
  IconCodePlus,
  IconCopy,
  IconGripVertical,
  IconPlus,
  IconReplace,
  IconTrash,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import type { EditableBlockType } from "../editor-data"
import {
  blockOptionsTargetFromNode,
  deleteBlockAt,
  duplicateBlockAt,
  replaceBlockAt,
  updateBlockAttrsAt,
  type BlockOptionsTarget,
} from "../tiptap/block-operations"
import { editorBlockMenuItems } from "../tiptap/block-menu-items"
import { insertBlockAfterPosition } from "../tiptap/editor-blocks"

export type BlockControlsTarget = NonNullable<BlockOptionsTarget>

const blockControlsPosition = {
  placement: "left-start",
  strategy: "absolute",
} as const

export function EditorBlockControls({
  editor,
  onChangeGif,
}: {
  editor: TiptapEditor
  onChangeGif: (nodePos: number) => void
}) {
  const [, forceEditorRevision] = useState(0)
  const [target, setTarget] = useState<BlockControlsTarget | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const liveTarget = target ? getLiveBlockControlsTarget(editor, target) : null

  useEffect(() => {
    const handleEditorTransaction = () => {
      forceEditorRevision((revision) => revision + 1)
    }

    editor.on("transaction", handleEditorTransaction)

    return () => {
      editor.off("transaction", handleEditorTransaction)
    }
  }, [editor])

  const handleOpenChange = useCallback((open: boolean) => {
    if (open && !liveTarget) {
      return
    }

    setMenuOpen(open)
  }, [liveTarget])

  useEffect(() => {
    const shouldLock = addMenuOpen || menuOpen
    const transaction = editor.state.tr.setMeta("lockDragHandle", shouldLock)

    editor.view.dispatch(transaction)
  }, [addMenuOpen, editor, menuOpen])

  const handleNodeChange = useCallback((data: {
    node: Parameters<typeof blockOptionsTargetFromNode>[0]["node"]
    pos: number
  }) => {
    const nextTarget = blockOptionsTargetFromNode({
      node: data.node,
      pos: data.pos,
    })

    setTarget(nextTarget)

    if (!nextTarget) {
      setAddMenuOpen(false)
      setMenuOpen(false)
    }
  }, [])

  const handleElementDragStart = useCallback(() => {
    setAddMenuOpen(false)
    setMenuOpen(false)
  }, [])

  const handleElementDragEnd = useCallback(() => {
    setAddMenuOpen(false)
    setMenuOpen(false)
  }, [])

  const dragHandleNestedOptions = useMemo(() => false, [])

  return (
    <DragHandle
      editor={editor}
      className="z-50 flex h-6 w-[50px] -translate-x-0.5 items-center gap-0.5"
      computePositionConfig={blockControlsPosition}
      nested={dragHandleNestedOptions}
      onNodeChange={handleNodeChange}
      onElementDragStart={handleElementDragStart}
      onElementDragEnd={handleElementDragEnd}
    >
      <AddBlockMenu
        disabled={!liveTarget}
        open={addMenuOpen}
        onOpenChange={setAddMenuOpen}
        onSelect={(type) => {
          if (!liveTarget) {
            return
          }

          setAddMenuOpen(false)
          insertBlockAfterPosition(editor, liveTarget.pos, liveTarget.node, type)
        }}
      />
      <div className="relative h-6 w-4">
        <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-drag-handle=""
              disabled={!liveTarget}
              className={cn(
                "relative flex h-6 w-4 cursor-grab touch-none items-center justify-center rounded-[6px] text-muted-foreground outline-none hover:bg-secondary hover:text-foreground active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
                menuOpen && "cursor-default bg-secondary text-foreground"
              )}
              aria-label="Block options"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <IconGripVertical />
            </button>
          </DropdownMenuTrigger>
          {liveTarget ? (
            <EditorBlockOptionsMenu
              editor={editor}
              onChangeGif={onChangeGif}
              target={liveTarget}
            />
          ) : null}
        </DropdownMenu>
      </div>
    </DragHandle>
  )
}

function getLiveBlockControlsTarget(
  editor: TiptapEditor,
  target: BlockControlsTarget
): BlockControlsTarget | null {
  const node = editor.state.doc.nodeAt(target.pos)

  return blockOptionsTargetFromNode({ node, pos: target.pos })
}

function EditorBlockOptionsMenu({
  editor,
  onChangeGif,
  target,
}: {
  editor: TiptapEditor
  onChangeGif: (nodePos: number) => void
  target: NonNullable<BlockOptionsTarget>
}) {
  return (
    <DropdownMenuContent
      data-lightsite-block-options-menu=""
      align="start"
      side="bottom"
      sideOffset={6}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        window.requestAnimationFrame(() => {
          if (!editor.isDestroyed) {
            editor.view.focus()
          }
        })
      }}
      className={cn(
        target.blockType === "button" || target.blockType === "image-card"
          ? "w-[297px] overflow-hidden rounded-[14px] p-0"
          : "w-[253px] p-1.5"
      )}
    >
      {target.blockType === "button" ? (
        <div className="border-b border-border px-[14px] py-[14px]">
          <div className="flex flex-col gap-3">
            <BlockMenuField
              label="Button Text"
              placeholder="Button Text"
              value={toStringAttr(target.node.attrs.text)}
              onChange={(text) => updateBlockAttrsAt(editor, target.pos, target.node, { text })}
            />
            <BlockMenuField
              label="Button Link"
              placeholder="John Smith"
              value={toStringAttr(target.node.attrs.url)}
              onChange={(url) => updateBlockAttrsAt(editor, target.pos, target.node, { url })}
            />
          </div>
        </div>
      ) : null}
      {target.blockType === "image-card" ? (
        <div className="border-b border-border px-[14px] py-[14px]">
          <div className={cn("flex flex-col", target.node.attrs.includeButton ? "gap-3" : "gap-0")}>
            <label className="flex items-start gap-2">
              <Switch
                checked={Boolean(target.node.attrs.includeButton)}
                className="mt-0.5"
                aria-label="Include Button"
                onCheckedChange={(includeButton) =>
                  updateBlockAttrsAt(editor, target.pos, target.node, {
                    includeButton,
                    buttonText: includeButton
                      ? toStringAttr(target.node.attrs.buttonText) || "Button"
                      : target.node.attrs.buttonText,
                  })
                }
              />
              <span className="min-w-0 flex-1 pt-px text-sm leading-5 text-popover-foreground">
                Include Button
              </span>
            </label>
            {target.node.attrs.includeButton ? (
              <>
                <BlockMenuField
                  label="Button Text"
                  placeholder="Button Text"
                  value={toStringAttr(target.node.attrs.buttonText)}
                  onChange={(buttonText) =>
                    updateBlockAttrsAt(editor, target.pos, target.node, { buttonText })
                  }
                />
                <BlockMenuField
                  label="Button Link"
                  placeholder="John Smith"
                  value={toStringAttr(target.node.attrs.buttonUrl)}
                  onChange={(buttonUrl) =>
                    updateBlockAttrsAt(editor, target.pos, target.node, { buttonUrl })
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={cn("flex flex-col gap-0.5", target.blockType === "button" || target.blockType === "image-card" ? "px-1.5 py-1.5" : "")}>
        {target.blockType === "gif" ? (
          <BlockMenuItem
            icon={IconReplace}
            onSelect={() => onChangeGif(target.pos)}
          >
            Change GIF
          </BlockMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-[30px] px-2 py-1.5 [&_svg]:size-3.5">
            <IconReplace />
            Turn into
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[253px] p-1.5">
            {editorBlockMenuItems.map((item) => (
              <BlockMenuItem
                key={item.type}
                disabled={item.type === target.blockType}
                icon={item.icon}
                onSelect={() => replaceBlockAt(editor, target.pos, target.node, item.type)}
              >
                {item.label}
              </BlockMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <BlockMenuItem
          icon={IconCopy}
          onSelect={() => duplicateBlockAt(editor, target.pos, target.node)}
        >
          Duplicate
        </BlockMenuItem>
        <BlockMenuItem
          icon={IconTrash}
          variant="destructive"
          onSelect={() => deleteBlockAt(editor, target.pos, target.node)}
        >
          Delete
        </BlockMenuItem>
      </div>
    </DropdownMenuContent>
  )
}

function AddBlockMenu({
  disabled,
  open,
  onOpenChange,
  onSelect,
}: {
  disabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: EditableBlockType) => void
}) {
  return (
    <div
      data-lightsite-add-block-menu-root=""
      className="group relative size-6"
    >
      <button
        type="button"
        data-lightsite-add-block-trigger=""
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 [&_svg]:size-3.5"
        aria-label="Add block"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()

          if (!disabled) {
            onOpenChange(true)
          }
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return
          }

          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault()
            event.stopPropagation()
            onOpenChange(true)
          }
        }}
      >
        <IconPlus />
      </button>
      {!disabled && open ? (
        <div
          data-lightsite-add-block-menu=""
          role="menu"
          className="absolute left-0 top-7 z-50 h-[320px] w-[253px] overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div className="flex flex-col gap-0.5">
            {editorBlockMenuItems.map((item) => (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg]:size-3.5"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onSelect(item.type)
                }}
              >
                <item.icon />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BlockMenuField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-sm leading-5 font-medium text-tertiary-foreground">
          {label}
        </span>
        <button
          type="button"
          aria-label={`Insert variable into ${label}`}
          className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-xs"
        >
          <IconCodePlus className="size-3.5" />
        </button>
      </div>
      <Input
        className="h-8 rounded-md px-3 shadow-xs"
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </div>
  )
}

function BlockMenuItem({
  children,
  disabled,
  icon: Icon,
  onSelect,
  variant,
}: {
  children: React.ReactNode
  disabled?: boolean
  icon: ComponentType<{ className?: string }>
  onSelect: () => void
  variant?: "destructive"
}) {
  return (
    <DropdownMenuItem disabled={disabled} variant={variant} className="h-[30px] gap-2 px-2 py-1.5 [&_svg]:size-3.5" onClick={onSelect}>
      <Icon />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DropdownMenuItem>
  )
}

function toStringAttr(value: unknown) {
  return typeof value === "string" ? value : ""
}
