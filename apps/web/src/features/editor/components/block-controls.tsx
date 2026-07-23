import { DragHandle } from "@tiptap/extension-drag-handle-react"
import { HANDOUT_TEXT_LIMITS, normalizeWebsiteUrl } from "@handout/domain"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import {
  IconAlignCenter,
  IconAlignLeft,
  IconArrowsHorizontal,
  IconBadge,
  IconBlockquote,
  IconCalendarEvent,
  IconCheck,
  IconChecklist,
  IconClipboard,
  IconClick,
  IconCode,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconCopy,
  IconCopyPlus,
  IconGif,
  IconGridDots,
  IconGripVertical,
  IconH1,
  IconH2,
  IconH3,
  IconLink,
  IconLayoutGrid,
  IconLayoutNavbar,
  IconLayoutSidebar,
  IconList,
  IconListDetails,
  IconListNumbers,
  IconMessage,
  IconMoodSmile,
  IconPilcrow,
  IconPhoto,
  IconPhotoAlt,
  IconPlus,
  IconRefresh,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconSeparatorHorizontal,
  IconTable,
  IconVideo,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { cn } from "@/lib/utils"

import { fitImageDimensions, loadImageDimensions, uploadImageFileAsAttrs } from "../tiptap/image-utils"
import {
  getCachedHandoutBlockClipboard,
  readHandoutBlockClipboard,
  writeSelectedHandoutBlocksToClipboard,
  type HandoutBlockClipboardPayload,
} from "../tiptap/extensions/block-clipboard"
import type { HandoutNextBlockType } from "../tiptap/schema"

type EditorBlockControlsProps = {
  editor: Editor
}

type BlockTarget = {
  node: ProseMirrorNode
  pos: number
}

type BlockMenuAnchorRect = {
  bottom: number
  left: number
  top: number
}

type BlockMenuPosition = {
  maxHeight: number
  x: number
  y: number
}

const blockMenuOffset = 6
const blockMenuViewportPadding = 12
const blockMenuWidth = 278
const blockMenuMaxHeight = 480

const compactBlockHandleAlignment = {
  name: "handoutCompactBlockHandleAlignment",
  fn({
    rects,
    y,
  }: {
    rects: { floating: { height: number }; reference: { height: number } }
    y: number
  }) {
    if (rects.reference.height > 40) {
      return {}
    }

    return {
      y: y + (rects.reference.height - rects.floating.height) / 2,
    }
  },
}

const compactBlockHandlePositionConfig = {
  middleware: [compactBlockHandleAlignment],
}

export function EditorBlockControls({ editor }: EditorBlockControlsProps) {
  const activeWorkspace = useActiveWorkspace()
  const [activeBlock, setActiveBlock] = useState<BlockTarget | null>(null)
  const lastActiveBlockRef = useRef<BlockTarget | null>(null)
  const [menuTarget, setMenuTarget] = useState<BlockTarget | null>(null)
  const [menuAnchorRect, setMenuAnchorRect] = useState<BlockMenuAnchorRect | null>(null)
  const [menuPosition, setMenuPosition] = useState<BlockMenuPosition | null>(null)
  const [menuTableCellPosition, setMenuTableCellPosition] = useState<number | null>(null)
  const [imageUrlDraft, setImageUrlDraft] = useState("")
  const [imageUrlFormOpen, setImageUrlFormOpen] = useState(false)
  const [imageReplaceError, setImageReplaceError] = useState<string | null>(null)
  const [clipboardPayload, setClipboardPayload] =
    useState<HandoutBlockClipboardPayload | null>(() =>
      getCachedHandoutBlockClipboard()
    )
  const imageUploadInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuOpen = menuPosition !== null && menuTarget !== null
  const canTurnInto = menuTarget?.node.type.isInGroup("block") ?? false
  const currentBlockType = menuTarget ? getHandoutNextBlockType(menuTarget.node) : null
  const gridContext = menuTarget ? resolveGridMenuContext(editor, menuTarget) : null
  const tableHeaderState =
    menuTarget?.node.type.name === "table" ? getTableHeaderState(menuTarget.node) : null
  const turnIntoGroups = useMemo(
    () =>
      [
        {
          label: "Text",
          items: [
            { icon: IconPilcrow, label: "Text", type: "paragraph" },
            { icon: IconH1, label: "Heading 1", type: "heading1" },
            { icon: IconH2, label: "Heading 2", type: "heading2" },
            { icon: IconH3, label: "Heading 3", type: "heading3" },
            { icon: IconBlockquote, label: "Quote", type: "blockquote" },
            { icon: IconCode, label: "Code block", type: "codeBlock" },
            { icon: IconMoodSmile, label: "Emoji", type: "emoji" },
          ],
        },
        {
          label: "Lists",
          items: [
            { icon: IconList, label: "Bullet list", type: "bulletList" },
            { icon: IconListNumbers, label: "Numbered list", type: "orderedList" },
            { icon: IconChecklist, label: "Task list", type: "taskList" },
            { icon: IconListDetails, label: "Icon list", type: "iconList" },
          ],
        },
        {
          label: "Cards and actions",
          items: [
            { icon: IconPhotoAlt, label: "Image card", type: "imageCard" },
            { icon: IconBadge, label: "Icon card", type: "iconCard" },
            { icon: IconMessage, label: "Testimonial", type: "testimonial" },
            { icon: IconGridDots, label: "Logo grid", type: "logoGrid" },
            { icon: IconClick, label: "Button", type: "button" },
          ],
        },
        {
          label: "Media",
          items: [
            { icon: IconPhoto, label: "Image", type: "image" },
            { icon: IconGif, label: "GIF", type: "gif" },
            { icon: IconCalendarEvent, label: "Calendar", type: "calendar" },
            { icon: IconVideo, label: "Video", type: "video" },
          ],
        },
        {
          label: "Structure",
          items: [
            { icon: IconLayoutNavbar, label: "Page title", type: "pageTitle" },
            { icon: IconLayoutGrid, label: "Grid", type: "grid" },
            { icon: IconTable, label: "Table", type: "table" },
            { icon: IconSeparatorHorizontal, label: "Divider", type: "divider" },
          ],
        },
      ] satisfies Array<{
        label: string
        items: Array<{
          icon: typeof IconPilcrow
          label: string
          type: HandoutNextBlockType
        }>
      }>,
    []
  )

  const closeMenu = useCallback(() => {
    setMenuAnchorRect(null)
    setMenuPosition(null)
    setMenuTarget(null)
    setMenuTableCellPosition(null)
    setImageUrlFormOpen(false)
    setImageReplaceError(null)
  }, [])

  useEffect(() => {
    editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", menuOpen))
  }, [editor, menuOpen])

  const updateMenuPosition = useCallback(() => {
    if (!menuAnchorRect) {
      return
    }

    const measuredHeight = menuRef.current?.offsetHeight ?? blockMenuMaxHeight
    const nextPosition = computeBlockMenuPosition(menuAnchorRect, measuredHeight)
    setMenuPosition((currentPosition) =>
      currentPosition &&
      currentPosition.x === nextPosition.x &&
      currentPosition.y === nextPosition.y &&
      currentPosition.maxHeight === nextPosition.maxHeight
        ? currentPosition
        : nextPosition
    )
  }, [menuAnchorRect])

  useLayoutEffect(() => {
    if (!menuOpen) {
      return
    }

    updateMenuPosition()
  })

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)

    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [menuOpen, updateMenuPosition])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handleOutsideInteraction = (event: Event) => {
      const target = event.target

      if (
        target instanceof Element &&
        (menuRef.current?.contains(target) ||
          target.closest(".handout-editor-drag-handle"))
      ) {
        return
      }

      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    document.addEventListener("pointerdown", handleOutsideInteraction, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeMenu, menuOpen])

  const runBlockCommand = useCallback(
    (command: (pos: number) => void) => {
      const target = resolveStoredBlockTarget(editor, menuTarget)

      if (!target) {
        return
      }

      command(target.pos)
      closeMenu()
    },
    [closeMenu, editor, menuTarget]
  )

  const runDeleteBlockCommand = useCallback(() => {
    const target = resolveDeleteBlockTarget(editor, menuTarget)

    if (!target) {
      closeMenu()
      return
    }

    editor.chain().focus().deleteHandoutNextBlock(target.pos).run()
    closeMenu()
  }, [closeMenu, editor, menuTarget])

  const runCopyBlockCommand = useCallback(() => {
    const target = resolveStoredBlockTarget(editor, menuTarget)

    if (!target) {
      closeMenu()
      return
    }

    closeMenu()
    void writeSelectedHandoutBlocksToClipboard(editor, target.pos).then(
      (copied) => {
        if (copied) {
          setClipboardPayload(getCachedHandoutBlockClipboard())
        }
      }
    )
  }, [closeMenu, editor, menuTarget])

  const runPasteBlockCommand = useCallback(() => {
    const target = resolveStoredBlockTarget(editor, menuTarget)

    if (!target || !clipboardPayload) {
      closeMenu()
      return
    }

    editor.commands.insertHandoutNextBlockClipboard(
      clipboardPayload,
      target.pos
    )
    closeMenu()
  }, [clipboardPayload, closeMenu, editor, menuTarget])

  const runTableCommand = useCallback(
    (command: () => boolean) => {
      const target = resolveStoredBlockTarget(editor, menuTarget)

      if (!target || target.node.type.name !== "table") {
        closeMenu()
        return
      }

      const focusPosition =
        resolveTableCommandPosition(editor, target, menuTableCellPosition) ??
        findFirstTextSelectionPositionInTarget(target)

      if (focusPosition === null) {
        closeMenu()
        return
      }

      editor.commands.setTextSelection(focusPosition)
      editor.commands.focus()
      command()
      closeMenu()
    },
    [closeMenu, editor, menuTableCellPosition, menuTarget]
  )

  const updateImageBlock = useCallback(
    (
      target: BlockTarget,
      attrs: { src: string; alt?: string; title?: string; width?: number; height?: number }
    ) => {
      const resolvedTarget = resolveStoredBlockTarget(editor, target)

      if (!resolvedTarget || resolvedTarget.node.type.name !== "image") {
        return false
      }

      return editor
        .chain()
        .focus()
        .setNodeSelection(resolvedTarget.pos)
        .updateAttributes("image", attrs)
        .run()
    },
    [editor]
  )

  const updateImageCardBlock = useCallback(
    (
      target: BlockTarget,
      attrs: { src: string; alt?: string; width?: number; height?: number }
    ) => {
      const resolvedTarget = resolveStoredBlockTarget(editor, target)

      if (!resolvedTarget || resolvedTarget.node.type.name !== "imageCard") {
        return false
      }

      const node = editor.state.doc.nodeAt(resolvedTarget.pos)

      if (!node || node.type.name !== "imageCard") {
        return false
      }

      editor.view.dispatch(
        editor.state.tr
          .setNodeMarkup(resolvedTarget.pos, undefined, {
            ...node.attrs,
            alt: attrs.alt ?? node.attrs.alt ?? "",
            imageHeight: attrs.height ?? null,
            imageWidth: attrs.width ?? null,
            src: attrs.src,
          })
          .scrollIntoView()
      )

      editor.view.focus()
      return true
    },
    [editor]
  )

  const updateTestimonialCardBlock = useCallback(
    (
      target: BlockTarget,
      attrs: { src: string; alt?: string; width?: number; height?: number }
    ) => {
      const resolvedTarget = resolveStoredBlockTarget(editor, target)

      if (!resolvedTarget || resolvedTarget.node.type.name !== "testimonialCard") {
        return false
      }

      const node = editor.state.doc.nodeAt(resolvedTarget.pos)

      if (!node || node.type.name !== "testimonialCard") {
        return false
      }

      editor.view.dispatch(
        editor.state.tr
          .setNodeMarkup(resolvedTarget.pos, undefined, {
            ...node.attrs,
            alt: attrs.alt ?? node.attrs.alt ?? "",
            avatarHeight: attrs.height ?? null,
            avatarWidth: attrs.width ?? null,
            src: attrs.src,
          })
          .scrollIntoView()
      )

      editor.view.focus()
      return true
    },
    [editor]
  )

  const replaceImageFromFile = useCallback(
    async (file: File) => {
      const target = resolveStoredBlockTarget(editor, menuTarget)

      if (
        !target ||
        (target.node.type.name !== "image" &&
          target.node.type.name !== "imageCard" &&
          target.node.type.name !== "testimonialCard")
      ) {
        return
      }

      try {
        setImageReplaceError(null)
        const attrs = await uploadImageFileAsAttrs(file, activeWorkspace.id)

        const updated =
          target.node.type.name === "image"
            ? updateImageBlock(target, attrs)
            : target.node.type.name === "imageCard"
              ? updateImageCardBlock(target, attrs)
              : updateTestimonialCardBlock(target, attrs)

        if (updated) {
          closeMenu()
        }
      } catch {
        setImageReplaceError("This image could not be loaded.")
      }
    },
    [
      activeWorkspace.id,
      closeMenu,
      editor,
      menuTarget,
      updateImageBlock,
      updateImageCardBlock,
      updateTestimonialCardBlock,
    ]
  )

  const replaceImageFromUrl = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const target = resolveStoredBlockTarget(editor, menuTarget)
      const src = imageUrlDraft.trim()

      if (!target || target.node.type.name !== "image" || !src) {
        return
      }

      const normalized = normalizeWebsiteUrl(src)

      if (!normalized.ok) {
        setImageReplaceError("Enter a valid public image URL.")
        return
      }

      try {
        setImageReplaceError(null)
        const dimensions = await loadImageDimensions(normalized.url)
        const fitted = fitImageDimensions(dimensions.width, dimensions.height)

        if (
          updateImageBlock(target, {
            alt: target.node.attrs.alt ?? "Image",
            height: fitted.height,
            src: normalized.url,
            title: target.node.attrs.title ?? "Image",
            width: fitted.width,
          })
        ) {
          closeMenu()
        }
      } catch {
        setImageReplaceError("This image URL could not be loaded.")
      }
    },
    [closeMenu, editor, imageUrlDraft, menuTarget, updateImageBlock]
  )

  const openMenuFromElement = useCallback(
    (element: HTMLElement) => {
      const target = resolveActiveBlockTarget(editor, activeBlock ?? lastActiveBlockRef.current)

      if (!target) {
        return
      }

      const tableCellPosition =
        target.node.type.name === "table"
          ? findActiveTableCellTextSelectionPosition(editor, target)
          : null

      editor.view.dispatch(
        editor.state.tr.setSelection(
          NodeRangeSelection.create(editor.state.doc, target.pos, target.pos + target.node.nodeSize, 0)
        )
      )
      editor.view.focus()

      const rect = element.getBoundingClientRect()
      setMenuTarget(target)
      setImageUrlDraft(
        (target.node.type.name === "image" ||
          target.node.type.name === "imageCard" ||
          target.node.type.name === "testimonialCard") &&
          typeof target.node.attrs.src === "string"
          ? target.node.attrs.src
          : ""
      )
      setImageUrlFormOpen(false)
      setImageReplaceError(null)
      setMenuTableCellPosition(tableCellPosition)
      const anchorRect = {
        bottom: rect.bottom,
        left: rect.left,
        top: rect.top,
      }

      setMenuAnchorRect(anchorRect)
      setMenuPosition(computeBlockMenuPosition(anchorRect, blockMenuMaxHeight))
      setClipboardPayload(getCachedHandoutBlockClipboard())
      void readHandoutBlockClipboard().then(setClipboardPayload)
    },
    [activeBlock, editor]
  )

  const insertBlockAfterActive = useCallback(() => {
    const target = resolveActiveBlockTarget(editor, activeBlock ?? lastActiveBlockRef.current)

    if (!target) {
      return
    }

    closeMenu()
    if (target.node.type.name === "iconListItem") {
      editor.chain().focus().insertHandoutNextIconListItemAfter(target.pos).run()
      return
    }

    editor.chain().focus().insertHandoutNextCommandParagraphAfter(target.pos).run()
  }, [activeBlock, closeMenu, editor])

  const clearDropcursorAfterDrag = useCallback(() => {
    // The floating DragHandle is mounted next to the editor DOM, so its native
    // dragend event does not bubble through ProseMirror's dropcursor plugin.
    // Forwarding it lets that plugin perform its own normal cleanup.
    editor.view.dom.dispatchEvent(new Event("dragend", { bubbles: true }))
  }, [editor])

  const handleActiveBlockChange = useCallback(({
    node,
    pos,
  }: {
    node: ProseMirrorNode | null
    pos: number
  }) => {
    const nextActiveBlock = node ? { node, pos } : null

    if (nextActiveBlock) {
      lastActiveBlockRef.current = nextActiveBlock
    }
    setActiveBlock(nextActiveBlock)
  }, [])

  return (
    <>
      <input
        ref={imageUploadInputRef}
        accept="image/*"
        aria-hidden="true"
        className="sr-only"
        hidden
        tabIndex={-1}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""

          if (file) {
            void replaceImageFromFile(file)
          }
        }}
      />
      <DragHandle
        editor={editor}
        className="handout-editor-drag-handle"
        computePositionConfig={compactBlockHandlePositionConfig}
        onElementDragEnd={clearDropcursorAfterDrag}
        onElementDragStart={closeMenu}
        onNodeChange={handleActiveBlockChange}
        pluginKey="handoutNextDragHandle"
      >
        <button
          aria-label="Insert block"
          className="handout-editor-side-button"
          data-handout-editor-block-plus=""
          draggable={false}
          title="Insert block"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            insertBlockAfterActive()
          }}
          onDragStart={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <IconPlus />
        </button>
        <span
          aria-label="Block menu"
          className="handout-editor-side-button handout-editor-drag-grip"
          data-handout-editor-block-handle=""
          role="button"
          tabIndex={0}
          title="Block menu"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openMenuFromElement(event.currentTarget)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            openMenuFromElement(event.currentTarget)
          }}
        >
          <IconGripVertical />
        </span>
      </DragHandle>
      {menuOpen ? (
        <div
          ref={menuRef}
          data-editor-block-menu=""
          className="handout-editor-block-menu"
          role="menu"
          style={{ left: menuPosition.x, maxHeight: menuPosition.maxHeight, top: menuPosition.y }}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onWheel={(event) => {
            event.stopPropagation()
          }}
        >
          {menuTarget?.node.type.name === "imageCard" ? (
            <>
              <div className="handout-editor-block-menu-label">Image card</div>
              <BlockMenuItem
                icon={menuTarget.node.attrs.src ? IconRefresh : IconUpload}
                label={menuTarget.node.attrs.src ? "Replace image" : "Upload image"}
                onClick={() => {
                  imageUploadInputRef.current?.click()
                }}
              />
              <BlockMenuItem
                icon={IconLink}
                label="Button"
                onClick={() => {
                  runBlockCommand((pos) => {
                    const node = editor.state.doc.nodeAt(pos)
                    const mode = node?.attrs.includeButton ? "edit" : "create"

                    editor.commands.openHandoutNextImageCardButtonSettings(pos, mode)
                  })
                }}
              />
              {menuTarget.node.attrs.includeButton ? (
                <BlockMenuItem
                  icon={IconX}
                  label="Remove button"
                  onClick={() => {
                    runBlockCommand((pos) => {
                      const node = editor.state.doc.nodeAt(pos)

                      if (!node) {
                        return
                      }

                      editor.view.dispatch(
                        editor.state.tr
                          .setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            includeButton: false,
                          })
                          .scrollIntoView()
                      )
                    })
                  }}
                />
              ) : null}
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "testimonialCard" ? (
            <>
              <div className="handout-editor-block-menu-label">Testimonial</div>
              <BlockMenuItem
                icon={menuTarget.node.attrs.src ? IconRefresh : IconUpload}
                label={menuTarget.node.attrs.src ? "Replace avatar" : "Upload avatar"}
                onClick={() => {
                  imageUploadInputRef.current?.click()
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "image" ? (
            <>
              <div className="handout-editor-block-menu-label">Image</div>
              <BlockMenuItem
                icon={IconUpload}
                label="Upload image"
                onClick={() => {
                  imageUploadInputRef.current?.click()
                }}
              />
              <BlockMenuItem
                icon={IconLink}
                label="Replace from URL"
                onClick={() => {
                  setImageUrlFormOpen((isOpen) => !isOpen)
                  setImageReplaceError(null)
                }}
              />
              {imageUrlFormOpen ? (
                <form className="handout-editor-block-menu-url-form" onSubmit={replaceImageFromUrl}>
                  <Field data-invalid={!!imageReplaceError || undefined}>
                    <Input
                      autoFocus
                      aria-invalid={!!imageReplaceError || undefined}
                      inputMode="url"
                      maxLength={HANDOUT_TEXT_LIMITS.url}
                      placeholder="https://example.com/image.png"
                      type="text"
                      value={imageUrlDraft}
                      onChange={(event) => {
                        setImageUrlDraft(event.currentTarget.value)
                        setImageReplaceError(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault()
                          setImageUrlFormOpen(false)
                          setImageReplaceError(null)
                          return
                        }

                        if (event.key === "Enter") {
                          event.preventDefault()
                          event.currentTarget.form?.requestSubmit()
                        }
                      }}
                    />
                    <FieldError>{imageReplaceError}</FieldError>
                  </Field>
                  <div className="handout-editor-block-menu-url-actions">
                    <button
                      className="handout-editor-block-menu-url-button handout-editor-block-menu-url-button-cancel"
                      type="button"
                      onClick={() => {
                        setImageUrlFormOpen(false)
                        setImageReplaceError(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button className="handout-editor-block-menu-url-button" type="submit">
                      Replace
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "gifBlock" ? (
            <>
              <div className="handout-editor-block-menu-label">GIF</div>
              <BlockMenuItem
                icon={IconGif}
                label="Change GIF"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().openHandoutNextGifPicker(pos).run()
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "calendarEmbed" ? (
            <>
              <div className="handout-editor-block-menu-label">Calendar</div>
              <BlockMenuItem
                icon={IconCalendarEvent}
                label="Edit calendar"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().openHandoutNextCalendarEmbedSettings(pos, "edit").run()
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "videoEmbed" ? (
            <>
              <div className="handout-editor-block-menu-label">Video</div>
              <BlockMenuItem
                icon={IconVideo}
                label="Edit video"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().openHandoutNextVideoEmbedSettings(pos, "edit").run()
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "buttonBlock" ? (
            <>
              <div className="handout-editor-block-menu-label">Button</div>
              <BlockMenuItem
                icon={IconLink}
                label="Edit button"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().openHandoutNextButtonSettings(pos, "edit").run()
                  })
                }}
              />
              <BlockMenuItem
                active={menuTarget.node.attrs.fullWidth === true}
                icon={IconArrowsHorizontal}
                label="Fill width"
                trailing={
                  <span
                    className={cn(
                      "handout-editor-block-menu-switch",
                      menuTarget.node.attrs.fullWidth === true && "handout-editor-block-menu-switch-on"
                    )}
                    aria-hidden="true"
                  />
                }
                onClick={() => {
                  runBlockCommand((pos) => {
                    const node = editor.state.doc.nodeAt(pos)

                    if (!node || node.type.name !== "buttonBlock") {
                      return
                    }

                    editor
                      .chain()
                      .focus()
                      .setHandoutNextButtonAttrs(pos, {
                        fullWidth: node.attrs.fullWidth !== true,
                      })
                      .run()
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "pageTitleSection" ? (
            <>
              <div className="handout-editor-block-menu-label">Page title</div>
              <BlockMenuItem
                active={menuTarget.node.attrs.align !== "left" && menuTarget.node.attrs.align !== "right"}
                icon={IconAlignCenter}
                label="Center"
                onClick={() => {
                  runBlockCommand((pos) => {
                    updatePageTitleAlignment(editor, pos, "center")
                  })
                }}
              />
              <BlockMenuItem
                active={menuTarget.node.attrs.align === "left" || menuTarget.node.attrs.align === "right"}
                icon={IconAlignLeft}
                label="Left"
                onClick={() => {
                  runBlockCommand((pos) => {
                    updatePageTitleAlignment(editor, pos, "left")
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "logoGrid" ? (
            <>
              <div className="handout-editor-block-menu-label">Logo grid</div>
              <BlockMenuItem
                icon={IconPlus}
                label="Add logo"
                onClick={() => {
                  runBlockCommand((pos) => {
                    addLogoGridItem(editor, pos)
                  })
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {menuTarget?.node.type.name === "table" ? (
            <>
              <div className="handout-editor-block-menu-label">Table</div>
              <BlockMenuItem
                icon={IconRowInsertTop}
                label="Add row above"
                onClick={() => {
                  runTableCommand(() => editor.commands.addRowBefore())
                }}
              />
              <BlockMenuItem
                icon={IconRowInsertBottom}
                label="Add row below"
                onClick={() => {
                  runTableCommand(() => editor.commands.addRowAfter())
                }}
              />
              <BlockMenuItem
                icon={IconColumnInsertLeft}
                label="Add column left"
                onClick={() => {
                  runTableCommand(() => editor.commands.addColumnBefore())
                }}
              />
              <BlockMenuItem
                icon={IconColumnInsertRight}
                label="Add column right"
                onClick={() => {
                  runTableCommand(() => editor.commands.addColumnAfter())
                }}
              />
              <BlockMenuItem
                icon={IconLayoutNavbar}
                label={tableHeaderState?.hasHeaderRow ? "Remove header row" : "Include header row"}
                onClick={() => {
                  runTableCommand(() => editor.commands.toggleHeaderRow())
                }}
              />
              <BlockMenuItem
                icon={IconLayoutSidebar}
                label={
                  tableHeaderState?.hasHeaderColumn
                    ? "Remove header column"
                    : "Include header column"
                }
                onClick={() => {
                  runTableCommand(() => editor.commands.toggleHeaderColumn())
                }}
              />
              <BlockMenuItem
                danger
                icon={IconRowRemove}
                label="Delete current row"
                onClick={() => {
                  runTableCommand(() => editor.commands.deleteRow())
                }}
              />
              <BlockMenuItem
                danger
                icon={IconColumnRemove}
                label="Delete current column"
                onClick={() => {
                  runTableCommand(() => editor.commands.deleteColumn())
                }}
              />
              <BlockMenuItem
                danger
                icon={IconTrash}
                label="Delete table"
                onClick={() => {
                  runTableCommand(() => editor.commands.deleteTable())
                }}
              />
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          {gridContext ? (
            <>
              <div className="handout-editor-block-menu-label">Grid</div>
              <BlockMenuItem
                icon={IconRowInsertTop}
                label="Add row above"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().addHandoutNextGridRow(pos, "before").run()
                  })
                }}
              />
              <BlockMenuItem
                icon={IconRowInsertBottom}
                label="Add row below"
                onClick={() => {
                  runBlockCommand((pos) => {
                    editor.chain().focus().addHandoutNextGridRow(pos, "after").run()
                  })
                }}
              />
              {gridContext.columnCount < 3 ? (
                <>
                  <BlockMenuItem
                    icon={IconColumnInsertLeft}
                    label="Add column left"
                    onClick={() => {
                      runBlockCommand((pos) => {
                        editor.chain().focus().addHandoutNextGridColumn(pos, "before").run()
                      })
                    }}
                  />
                  <BlockMenuItem
                    icon={IconColumnInsertRight}
                    label="Add column right"
                    onClick={() => {
                      runBlockCommand((pos) => {
                        editor.chain().focus().addHandoutNextGridColumn(pos, "after").run()
                      })
                    }}
                  />
                </>
              ) : null}
              {gridContext.rowCount > 1 ? (
                <>
                  {gridContext.rowIndex > 0 ? (
                    <BlockMenuItem
                      danger
                      icon={IconRowRemove}
                      label="Delete row above"
                      onClick={() => {
                        runBlockCommand((pos) => {
                          editor.chain().focus().deleteHandoutNextGridRow(pos, "before").run()
                        })
                      }}
                    />
                  ) : null}
                  {gridContext.rowIndex < gridContext.rowCount - 1 ? (
                    <BlockMenuItem
                      danger
                      icon={IconRowRemove}
                      label="Delete row below"
                      onClick={() => {
                        runBlockCommand((pos) => {
                          editor.chain().focus().deleteHandoutNextGridRow(pos, "after").run()
                        })
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              {gridContext.columnCount > 1 ? (
                <>
                  {gridContext.cellIndex > 0 ? (
                    <BlockMenuItem
                      danger
                      icon={IconColumnRemove}
                      label="Delete column left"
                      onClick={() => {
                        runBlockCommand((pos) => {
                          editor
                            .chain()
                            .focus()
                            .deleteHandoutNextGridColumn(pos, "before")
                            .run()
                        })
                      }}
                    />
                  ) : null}
                  {gridContext.cellIndex < gridContext.columnCount - 1 ? (
                    <BlockMenuItem
                      danger
                      icon={IconColumnRemove}
                      label="Delete column right"
                      onClick={() => {
                        runBlockCommand((pos) => {
                          editor
                            .chain()
                            .focus()
                            .deleteHandoutNextGridColumn(pos, "after")
                            .run()
                        })
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              <div className="handout-editor-block-menu-separator" />
            </>
          ) : null}
          <BlockMenuItem
            icon={IconCopy}
            label="Copy"
            onClick={runCopyBlockCommand}
          />
          {clipboardPayload ? (
            <BlockMenuItem
              icon={IconClipboard}
              label="Paste"
              onClick={runPasteBlockCommand}
            />
          ) : null}
          <BlockMenuItem
            icon={IconCopyPlus}
            label="Duplicate"
            onClick={() => {
              runBlockCommand((pos) => {
                editor.chain().focus().duplicateHandoutNextBlock(pos).run()
              })
            }}
          />
          {menuTarget?.node.type.name !== "table" ? (
            <BlockMenuItem
              danger
              icon={IconTrash}
              label="Delete"
              onClick={runDeleteBlockCommand}
            />
          ) : null}
          {canTurnInto ? (
            <>
              <div className="handout-editor-block-menu-separator" />
              <div className="handout-editor-block-menu-label">Turn into</div>
              {turnIntoGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 ? <div className="handout-editor-block-menu-separator" /> : null}
                  {groupIndex > 0 ? (
                    <div className="handout-editor-block-menu-label">{group.label}</div>
                  ) : null}
                  {group.items.map((item) => (
                    <BlockMenuItem
                      active={currentBlockType === item.type}
                      icon={item.icon}
                      key={item.type}
                      label={item.label}
                      onClick={() => {
                        runBlockCommand((pos) => {
                          editor.chain().focus().turnHandoutNextBlockInto(pos, item.type).run()
                        })
                      }}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function BlockMenuItem({
  active = false,
  danger = false,
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  active?: boolean
  danger?: boolean
  icon: typeof IconPilcrow
  label: string
  onClick: () => void
  trailing?: ReactNode
}) {
  return (
    <button
      className={cn(
        "handout-editor-block-menu-item",
        danger && "handout-editor-block-menu-item-danger"
      )}
      data-active={active ? "true" : undefined}
      role="menuitem"
      type="button"
      onClick={onClick}
    >
      <Icon />
      <span className="handout-editor-block-menu-item-copy">
        <span className="handout-editor-block-menu-item-label">{label}</span>
      </span>
      {trailing ?? (active ? <IconCheck className="handout-editor-block-menu-item-check" /> : null)}
    </button>
  )
}

function updatePageTitleAlignment(editor: Editor, pos: number, align: "center" | "left") {
  const node = editor.state.doc.nodeAt(pos)

  if (!node || node.type.name !== "pageTitleSection") {
    return
  }

  editor.view.dispatch(
    editor.state.tr
      .setNodeMarkup(pos, undefined, {
        ...node.attrs,
        align,
      })
      .scrollIntoView()
  )
  editor.view.focus()
}

function addLogoGridItem(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos)
  const itemType = editor.schema.nodes.logoGridItem
  const titleType = editor.schema.nodes.logoGridItemTitle

  if (!node || node.type.name !== "logoGrid" || !itemType || !titleType) {
    return
  }

  const item = itemType.create(
    {
      alt: "",
      src: "",
    },
    titleType.create()
  )
  const insertPosition = pos + node.nodeSize - 1

  editor.view.dispatch(editor.state.tr.insert(insertPosition, item).scrollIntoView())
  editor.commands.focus(insertPosition + 2)
}

function resolveActiveBlockTarget(editor: Editor, activeBlock: BlockTarget | null) {
  const storedTarget = resolveStoredBlockTarget(editor, activeBlock)
  const selectionTarget = resolveSelectionBlockTarget(editor)

  if (
    storedTarget?.node.type.name === "gridBlock" &&
    selectionTarget &&
    selectionTarget.node.type.name !== "gridBlock" &&
    isTargetInsideGrid(editor, selectionTarget, storedTarget)
  ) {
    return selectionTarget
  }

  return storedTarget ?? selectionTarget
}

function resolveStoredBlockTarget(editor: Editor, target: BlockTarget | null): BlockTarget | null {
  if (!target) {
    return null
  }

  const directNode = editor.state.doc.nodeAt(target.pos)

  if (directNode && isSameBlockTarget(directNode, target.node)) {
    return { node: directNode, pos: target.pos }
  }

  const targetId = getBlockId(target.node)

  if (!targetId) {
    return null
  }

  let found: BlockTarget | null = null

  editor.state.doc.descendants((node, pos) => {
    if (found) {
      return false
    }

    if (node.type.isInGroup("block") && getBlockId(node) === targetId) {
      found = { node, pos }
      return false
    }

    return true
  })

  return found
}

function resolveDeleteBlockTarget(editor: Editor, target: BlockTarget | null): BlockTarget | null {
  const resolvedTarget = resolveStoredBlockTarget(editor, target)

  if (!resolvedTarget) {
    return null
  }

  if (resolvedTarget.node.type.name !== "gridBlock") {
    return resolvedTarget
  }

  const gridContentTarget = findSingleMeaningfulGridContentTarget(resolvedTarget)

  return gridContentTarget
}

function findSingleMeaningfulGridContentTarget(gridTarget: BlockTarget): BlockTarget | null {
  let found: BlockTarget | null = null
  let foundCount = 0
  let rowPos = gridTarget.pos + 1

  gridTarget.node.forEach((row) => {
    let cellPos = rowPos + 1

    row.forEach((cell) => {
      let childPos = cellPos + 1

      cell.forEach((child) => {
        if (isMeaningfulGridCellBlock(child)) {
          found = { node: child, pos: childPos }
          foundCount += 1
        }

        childPos += child.nodeSize
      })

      cellPos += cell.nodeSize
    })

    rowPos += row.nodeSize
  })

  return foundCount === 1 ? found : null
}

function isMeaningfulGridCellBlock(node: ProseMirrorNode) {
  return !(node.type.name === "paragraph" && node.textContent.trim().length === 0)
}

function resolveSelectionBlockTarget(editor: Editor): BlockTarget | null {
  const { doc, selection } = editor.state
  const position = Math.max(0, Math.min(selection.from, doc.content.size))
  const $position = doc.resolve(position)

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.isInGroup("block")) {
      return { node, pos: $position.before(depth) }
    }
  }

  return null
}

function isTargetInsideGrid(editor: Editor, target: BlockTarget, gridTarget: BlockTarget) {
  const { doc } = editor.state
  const position = Math.max(0, Math.min(target.pos, doc.content.size))
  const $position = doc.resolve(position)

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if (
      $position.node(depth).type.name === "gridBlock" &&
      $position.before(depth) === gridTarget.pos
    ) {
      return true
    }
  }

  return false
}

function isSameBlockTarget(currentNode: ProseMirrorNode, storedNode: ProseMirrorNode) {
  if (currentNode.type.name !== storedNode.type.name) {
    return false
  }

  const currentId = getBlockId(currentNode)
  const storedId = getBlockId(storedNode)

  if (currentId || storedId) {
    return currentId === storedId
  }

  return true
}

function getBlockId(node: ProseMirrorNode) {
  const id = node.attrs.id

  return typeof id === "string" && id.length > 0 ? id : null
}

function getHandoutNextBlockType(node: ProseMirrorNode): HandoutNextBlockType | null {
  switch (node.type.name) {
    case "paragraph":
      if (isEmojiOnlyParagraph(node)) {
        return "emoji"
      }

      return "paragraph"
    case "heading":
      if (node.attrs.level === 1) {
        return "heading1"
      }

      return node.attrs.level === 2 ? "heading2" : "heading3"
    case "blockquote":
      return "blockquote"
    case "bulletList":
      return "bulletList"
    case "orderedList":
      return "orderedList"
    case "taskList":
      return "taskList"
    case "pageTitleSection":
      return "pageTitle"
    case "codeBlock":
      return "codeBlock"
    case "horizontalRule":
      return "divider"
    case "iconList":
      return "iconList"
    case "image":
      return "image"
    case "imageCard":
      return "imageCard"
    case "gifBlock":
      return "gif"
    case "calendarEmbed":
      return "calendar"
    case "videoEmbed":
      return "video"
    case "iconCard":
      return "iconCard"
    case "testimonialCard":
      return "testimonial"
    case "logoGrid":
      return "logoGrid"
    case "buttonBlock":
      return "button"
    case "gridBlock":
      return "grid"
    case "table":
      return "table"
    default:
      return null
  }
}

function findFirstTextSelectionPositionInTarget(target: BlockTarget) {
  let found: number | null = null

  target.node.descendants((node, pos) => {
    if (found !== null || !node.isTextblock) {
      return found === null
    }

    found = target.pos + 1 + pos + 1
    return false
  })

  return found
}

function findActiveTableCellTextSelectionPosition(editor: Editor, tableTarget: BlockTarget) {
  const { doc, selection } = editor.state
  const position = Math.max(0, Math.min(selection.from, doc.content.size))

  return findTableCellTextSelectionPositionAt(editor, tableTarget, position)
}

function resolveTableCommandPosition(
  editor: Editor,
  tableTarget: BlockTarget,
  preferredPosition: number | null
) {
  if (preferredPosition === null) {
    return null
  }

  return findTableCellTextSelectionPositionAt(editor, tableTarget, preferredPosition)
}

function findTableCellTextSelectionPositionAt(
  editor: Editor,
  tableTarget: BlockTarget,
  position: number
) {
  const { doc } = editor.state
  const resolvedPosition = Math.max(0, Math.min(position, doc.content.size))
  const $position = doc.resolve(resolvedPosition)
  let cellDepth: number | null = null
  let tableDepth: number | null = null

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (
      cellDepth === null &&
      (node.type.name === "tableCell" || node.type.name === "tableHeader")
    ) {
      cellDepth = depth
    }

    if (node.type.name === "table") {
      tableDepth = depth
      break
    }
  }

  if (
    cellDepth === null ||
    tableDepth === null ||
    $position.before(tableDepth) !== tableTarget.pos
  ) {
    return null
  }

  return findFirstTextSelectionPositionInTarget({
    node: $position.node(cellDepth),
    pos: $position.before(cellDepth),
  })
}

function getTableHeaderState(table: ProseMirrorNode) {
  const firstRow = table.firstChild
  let hasHeaderRow = firstRow !== null && firstRow.childCount > 0

  firstRow?.forEach((cell) => {
    if (cell.type.name !== "tableHeader") {
      hasHeaderRow = false
    }
  })

  let hasHeaderColumn = table.childCount > 0

  table.forEach((row) => {
    const firstCell = row.firstChild

    if (!firstCell || firstCell.type.name !== "tableHeader") {
      hasHeaderColumn = false
    }
  })

  return { hasHeaderColumn, hasHeaderRow }
}

function resolveGridMenuContext(editor: Editor, target: BlockTarget) {
  const resolvedTarget = resolveStoredBlockTarget(editor, target) ?? target
  const { doc } = editor.state
  const node = doc.nodeAt(resolvedTarget.pos)

  if (node?.type.name === "gridBlock") {
    return {
      cellIndex: 0,
      columnCount: getGridColumnCount(node),
      rowIndex: 0,
      rowCount: node.childCount,
    }
  }

  const $position = doc.resolve(
    Math.max(0, Math.min(resolvedTarget.pos + 1, doc.content.size))
  )

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === "gridCell") {
      if (depth < 2) {
        return null
      }

      const grid = $position.node(depth - 2)

      if (grid?.type.name !== "gridBlock") {
        return null
      }

      return {
        cellIndex: $position.index(depth - 1),
        columnCount: getGridColumnCount(grid),
        rowIndex: $position.index(depth - 2),
        rowCount: grid.childCount,
      }
    }
  }

  return null
}

function getGridColumnCount(grid: ProseMirrorNode) {
  const attrColumns = Number.parseInt(String(grid.attrs.columns ?? ""), 10)

  if (Number.isFinite(attrColumns) && attrColumns > 0) {
    return Math.min(4, attrColumns)
  }

  let maxCells = 1

  grid.forEach((row) => {
    maxCells = Math.max(maxCells, row.childCount)
  })

  return Math.min(3, maxCells)
}

function computeBlockMenuPosition(
  anchorRect: BlockMenuAnchorRect,
  measuredHeight: number
): BlockMenuPosition {
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const maxViewportHeight = Math.max(160, viewportHeight - blockMenuViewportPadding * 2)
  const preferredHeight = Math.min(
    Math.max(1, measuredHeight),
    blockMenuMaxHeight,
    maxViewportHeight
  )
  const availableBelow =
    viewportHeight - blockMenuViewportPadding - anchorRect.bottom - blockMenuOffset
  const availableAbove = anchorRect.top - blockMenuViewportPadding - blockMenuOffset
  const shouldPlaceAbove = availableBelow < preferredHeight && availableAbove > availableBelow
  const availableHeight = shouldPlaceAbove ? availableAbove : availableBelow
  const maxHeight = Math.max(
    160,
    Math.min(blockMenuMaxHeight, maxViewportHeight, Math.max(0, availableHeight))
  )
  const height = Math.min(preferredHeight, maxHeight)
  const maxX = viewportWidth - blockMenuViewportPadding - blockMenuWidth
  const x = Math.max(blockMenuViewportPadding, Math.min(anchorRect.left, maxX))
  const y = shouldPlaceAbove
    ? Math.max(blockMenuViewportPadding, anchorRect.top - blockMenuOffset - height)
    : Math.min(
        anchorRect.bottom + blockMenuOffset,
        viewportHeight - blockMenuViewportPadding - height
      )

  return {
    maxHeight,
    x: Math.round(x),
    y: Math.round(y),
  }
}

function isEmojiOnlyParagraph(node: ProseMirrorNode) {
  if (node.type.name !== "paragraph" || node.childCount === 0) {
    return false
  }

  let hasEmoji = false
  let hasNonWhitespaceText = false

  node.forEach((child) => {
    if (child.type.name === "emoji") {
      hasEmoji = true
      return
    }

    if (child.isText && child.textContent.trim().length === 0) {
      return
    }

    hasNonWhitespaceText = true
  })

  return hasEmoji && !hasNonWhitespaceText
}
