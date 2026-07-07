import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type Editor as TiptapEditor, type JSONContent } from "@tiptap/core"
import { NodeRange, isNodeRangeSelection } from "@tiptap/extension-node-range"
import {
  EditorContent,
  useEditor,
} from "@tiptap/react"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import {
  IconCodePlus,
  IconPhotoPlus,
  IconReplace,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { LightsitePageFooter } from "@/components/common/lightsite-page-footer"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatVariableToken,
  recipientWebsiteVariableKey,
  type EditorVariable,
  type VariantRecord,
} from "../editor-data"
import { GifPickerDialog } from "./gif-picker-dialog"
import {
  EditorBlockControls,
} from "./editor-block-controls"
import {
  FloatingVariablePicker,
  QuickInsertMenu,
  type VariablePickerState,
} from "./editor-command-overlays"
import {
  filterVariableItems,
  getCommandMenuItemCount,
  selectCommandMenuItem,
} from "../tiptap/command-menu-actions"
import {
  EditorGifPickerContext,
  EditorPreviewTextContext,
  EditorVariablePickerContext,
  useEditorVariablePicker,
} from "./editor-contexts"
import {
  DashedButton,
  ImagePickerButton,
  InlineAttrTextarea,
} from "./editor-inline-controls"
import {
  composeEditorContent,
  getEditorBodyContent,
  getEditorPageChrome,
  serializeEditorContent,
  type EditorHeroAttrs,
  type EditorPageChrome,
  type EditorSiteHeaderAttrs,
} from "../editor-document"
import {
  syncCommandMenu,
  type CommandMenuState,
} from "../tiptap/command-menu"
import {
  LightsiteBlockSelection,
  createDeleteBlockSelectionTransaction,
} from "../tiptap/block-selection"
import { LightsiteDocumentBehavior } from "../tiptap/document-behavior"
import { editorNodeExtensions } from "../tiptap/editor-nodes"
import {
  clearEditorSelection,
  removeEmptyTemporaryTextBlocks,
  updateBlockAttrsAt,
} from "../tiptap/block-operations"
import { type EditorGifSelection } from "../giphy"

export type EditorCanvasState = {
  canRedo: boolean
  canUndo: boolean
  snapshot: string
}

export type EditorCanvasActions = {
  redo: () => void
  undo: () => void
}

type EditorCanvasProps = {
  content: JSONContent
  colorMode: "light" | "dark"
  onActionsChange: (actions: EditorCanvasActions) => void
  onStateChange: (state: EditorCanvasState) => void
  preview?: boolean
  selectedVariant?: VariantRecord
  variables?: EditorVariable[]
  workspaceLogoUrl?: string | null
  workspaceName?: string
  workspaceWebsiteDomain?: string
}

type GifPickerTarget = {
  nodePos: number
} | null

export function EditorCanvas({
  colorMode,
  content,
  onActionsChange,
  onStateChange,
  preview,
  selectedVariant,
  variables = [],
  workspaceLogoUrl,
  workspaceName = "",
  workspaceWebsiteDomain = "",
}: EditorCanvasProps) {
  const [quickInsertMenu, setQuickInsertMenu] = useState<CommandMenuState>(null)
  const [quickInsertSelectedIndex, setQuickInsertSelectedIndexState] = useState(0)
  const [variablePicker, setVariablePicker] = useState<VariablePickerState>(null)
  const [variablePickerSelectedIndex, setVariablePickerSelectedIndexState] = useState(0)
  const [gifPickerTarget, setGifPickerTarget] = useState<GifPickerTarget>(null)
  const [pageChrome, setPageChrome] = useState<EditorPageChrome>(() =>
    getEditorPageChrome(content)
  )
  const editableContent = useMemo(() => getEditorBodyContent(content), [content])
  const editorRef = useRef<TiptapEditor | null>(null)
  const pageChromeRef = useRef(pageChrome)
  const lastEditorSnapshotRef = useRef(
    serializeEditorContent(composeEditorContent(pageChrome, editableContent))
  )
  const onStateChangeRef = useRef(onStateChange)
  const pendingEditorStateFrameRef = useRef<number | null>(null)
  const pendingEditorStateTimeoutRef = useRef<number | null>(null)
  const pendingSnapshotRefreshRef = useRef(false)
  const quickInsertMenuRef = useRef<CommandMenuState>(null)
  const quickInsertSelectedIndexRef = useRef(0)
  const variablePickerSelectedIndexRef = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const setQuickInsertSelectedIndex = useCallback((index: number) => {
    quickInsertSelectedIndexRef.current = index
    setQuickInsertSelectedIndexState(index)
  }, [])
  const setVariablePickerSelectedIndex = useCallback((index: number) => {
    variablePickerSelectedIndexRef.current = index
    setVariablePickerSelectedIndexState(index)
  }, [])
  const setCommandMenuState = useCallback((menu: CommandMenuState) => {
    if (commandMenuStateKey(quickInsertMenuRef.current) !== commandMenuStateKey(menu)) {
      setQuickInsertSelectedIndex(0)
    }

    quickInsertMenuRef.current = menu
    setQuickInsertMenu(menu)
  }, [setQuickInsertSelectedIndex])
  const openVariablePicker = useCallback((request: NonNullable<VariablePickerState>) => {
    setVariablePickerSelectedIndex(0)
    setVariablePicker(request)
  }, [setVariablePickerSelectedIndex])
  const openGifPicker = useCallback((nodePos: number) => {
    setGifPickerTarget({ nodePos })
  }, [])
  const closeVariablePicker = useCallback(() => {
    setVariablePicker(null)
  }, [])
  const closeGifPicker = useCallback(() => {
    setGifPickerTarget(null)
  }, [])
  const resolvePreviewText = useCallback((value: string) => (
    resolveVariableText({
      selectedVariant,
      value,
      variables,
    })
  ), [selectedVariant, variables])
  const emitEditorStateNow = useCallback((activeEditor: TiptapEditor, refreshSnapshot: boolean) => {
    if (refreshSnapshot) {
      lastEditorSnapshotRef.current = serializeEditorContent(
        composeEditorContent(pageChromeRef.current, activeEditor.getJSON())
      )
    }

    onStateChangeRef.current({
      canRedo: activeEditor.can().redo(),
      canUndo: activeEditor.can().undo(),
      snapshot: lastEditorSnapshotRef.current,
    })
  }, [])
  const scheduleEditorStateEmit = useCallback((activeEditor: TiptapEditor, refreshSnapshot: boolean) => {
    pendingSnapshotRefreshRef.current = pendingSnapshotRefreshRef.current || refreshSnapshot

    if (
      pendingEditorStateFrameRef.current !== null ||
      pendingEditorStateTimeoutRef.current !== null
    ) {
      return
    }

    pendingEditorStateFrameRef.current = window.requestAnimationFrame(() => {
      pendingEditorStateFrameRef.current = null

      pendingEditorStateTimeoutRef.current = window.setTimeout(() => {
        pendingEditorStateTimeoutRef.current = null

        const shouldRefreshSnapshot = pendingSnapshotRefreshRef.current
        pendingSnapshotRefreshRef.current = false

        if (!activeEditor.isDestroyed) {
          emitEditorStateNow(activeEditor, shouldRefreshSnapshot)
        }
      }, 0)
    })
  }, [emitEditorStateNow])

  const editor = useEditor({
    extensions: [
      NodeRange.configure({
        depth: 0,
        key: null,
      }),
      LightsiteBlockSelection,
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        dropcursor: {
          color: "var(--color-indigo-500)",
          width: 1,
        },
        heading: false,
        horizontalRule: false,
        trailingNode: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "textBlock") {
            return "Type here"
          }

          if (node.type.name === "headingBlock") {
            return node.attrs.level === 1 ? "Heading 1" : "Heading 2"
          }

          if (node.type.name === "iconListItem") {
            return "Text"
          }

          return ""
        },
        emptyNodeClass: "is-editor-empty",
      }),
      LightsiteDocumentBehavior,
      ...editorNodeExtensions,
    ],
    content: editableContent,
    editable: !preview,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("lightsite-document-editor", colorMode === "dark" && "dark"),
      },
      handleKeyDown: (_view, event) => {
        const activeMenu = quickInsertMenuRef.current

        if (event.key === "Escape") {
          setCommandMenuState(null)
          if (activeMenu) {
            return true
          }
        }

        if (
          (event.key === "Backspace" || event.key === "Delete") &&
          isNodeRangeSelection(_view.state.selection)
        ) {
          const transaction = createDeleteBlockSelectionTransaction(_view.state)

          if (!transaction) {
            return false
          }

          event.preventDefault()
          _view.dispatch(transaction)
          return true
        }

        if (
          activeMenu &&
          (event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Home" ||
            event.key === "End")
        ) {
          const itemCount = getCommandMenuItemCount(activeMenu, variables)

          event.preventDefault()

          if (itemCount > 0) {
            const currentIndex = Math.min(quickInsertSelectedIndexRef.current, itemCount - 1)
            const nextIndex =
              event.key === "ArrowDown"
                ? (currentIndex + 1) % itemCount
                : event.key === "ArrowUp"
                  ? (currentIndex - 1 + itemCount) % itemCount
                  : event.key === "Home"
                    ? 0
                    : itemCount - 1

            setQuickInsertSelectedIndex(nextIndex)
          }

          return true
        }

        if (activeMenu && (event.key === "Enter" || event.key === "Tab")) {
          const didSelect = editorRef.current
            ? selectCommandMenuItem(
                editorRef.current,
                activeMenu,
                variables,
                quickInsertSelectedIndexRef.current
              )
            : false

          event.preventDefault()

          if (didSelect) {
            setCommandMenuState(null)
            return true
          }

          return true
        }

        return false
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor
      emitEditorStateNow(editor, true)
      syncCommandMenu(editor, setCommandMenuState)
      window.requestAnimationFrame(() => {
        if (!editor.isDestroyed) {
          clearEditorSelection(editor)
        }
      })
    },
    onTransaction: ({ editor, transaction }) => {
      scheduleEditorStateEmit(editor, transaction.docChanged)
      syncCommandMenu(editor, setCommandMenuState)
    },
  })

  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])

  useEffect(() => {
    pageChromeRef.current = pageChrome

    if (editor) {
      emitEditorStateNow(editor, true)
    }
  }, [editor, emitEditorStateNow, pageChrome])

  useEffect(() => {
    return () => {
      if (pendingEditorStateFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingEditorStateFrameRef.current)
      }

      if (pendingEditorStateTimeoutRef.current !== null) {
        window.clearTimeout(pendingEditorStateTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(!preview)
  }, [editor, preview])

  useEffect(() => {
    if (!quickInsertMenu) {
      return
    }

    const itemCount = getCommandMenuItemCount(quickInsertMenu, variables)

    if (itemCount === 0 && quickInsertSelectedIndexRef.current !== 0) {
      setQuickInsertSelectedIndex(0)
      return
    }

    if (itemCount > 0 && quickInsertSelectedIndexRef.current >= itemCount) {
      setQuickInsertSelectedIndex(itemCount - 1)
    }
  }, [quickInsertMenu, setQuickInsertSelectedIndex, variables])

  useEffect(() => {
    if (!editor || preview) {
      return
    }

    const activeEditor = editor

    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (target instanceof Element && target.closest('[data-block-wrapper-type="text"]')) {
        return
      }

      window.requestAnimationFrame(() => removeEmptyTemporaryTextBlocks(activeEditor))
    }

    window.addEventListener("pointerdown", handlePointerDown, true)

    return () => window.removeEventListener("pointerdown", handlePointerDown, true)
  }, [editor, preview])

  useEffect(() => {
    if (!editor || preview) {
      return
    }

    const activeEditor = editor

    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Element) || shouldPreserveEditorSelection(target)) {
        return
      }

      clearEditorSelection(activeEditor)
      activeEditor.commands.blur()
    }

    window.addEventListener("pointerdown", handlePointerDown, true)

    return () => window.removeEventListener("pointerdown", handlePointerDown, true)
  }, [editor, preview])

  useEffect(() => {
    if (!editor) {
      return
    }

    onActionsChange({
      redo: () => editor.chain().focus().redo().run(),
      undo: () => editor.chain().focus().undo().run(),
    })
  }, [editor, onActionsChange])

  useEffect(() => {
    if (!variablePicker) {
      return
    }

    const itemCount = filterVariableItems(
      variables,
      variablePicker.query,
      variablePicker.allowedTypes
    ).length

    if (itemCount === 0 && variablePickerSelectedIndexRef.current !== 0) {
      setVariablePickerSelectedIndex(0)
      return
    }

    if (itemCount > 0 && variablePickerSelectedIndexRef.current >= itemCount) {
      setVariablePickerSelectedIndex(itemCount - 1)
    }
  }, [setVariablePickerSelectedIndex, variablePicker, variables])

  useEffect(() => {
    if (!variablePicker) {
      return
    }

    const activeVariablePicker = variablePicker

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const items = filterVariableItems(
        variables,
        activeVariablePicker.query,
        activeVariablePicker.allowedTypes
      )

      if (event.key === "Escape") {
        event.preventDefault()
        closeVariablePicker()
        return
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        event.preventDefault()

        if (items.length > 0) {
          const currentIndex = Math.min(variablePickerSelectedIndexRef.current, items.length - 1)
          const nextIndex =
            event.key === "ArrowDown"
              ? (currentIndex + 1) % items.length
              : event.key === "ArrowUp"
                ? (currentIndex - 1 + items.length) % items.length
                : event.key === "Home"
                  ? 0
                  : items.length - 1

          setVariablePickerSelectedIndex(nextIndex)
        }

        return
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()

        const variable =
          items[Math.max(0, Math.min(variablePickerSelectedIndexRef.current, items.length - 1))]

        if (variable) {
          activeVariablePicker.onSelect(variable)
          closeVariablePicker()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)

    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [closeVariablePicker, setVariablePickerSelectedIndex, variablePicker, variables])

  useEffect(() => {
    if (!variablePicker) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (target instanceof Element && target.closest("[data-lightsite-variable-picker]")) {
        return
      }

      closeVariablePicker()
    }

    window.addEventListener("pointerdown", handlePointerDown, true)

    return () => window.removeEventListener("pointerdown", handlePointerDown, true)
  }, [closeVariablePicker, variablePicker])

  useEffect(() => {
    if (!variablePicker) {
      return
    }

    const scrollContainer = scrollContainerRef.current

    function handleLayoutChange() {
      closeVariablePicker()
    }

    scrollContainer?.addEventListener("scroll", handleLayoutChange, { passive: true })
    window.addEventListener("resize", handleLayoutChange)

    return () => {
      scrollContainer?.removeEventListener("scroll", handleLayoutChange)
      window.removeEventListener("resize", handleLayoutChange)
    }
  }, [closeVariablePicker, variablePicker])

  const handleGifSelect = useCallback((selection: EditorGifSelection) => {
    const activeEditor = editorRef.current
    const target = gifPickerTarget

    if (!activeEditor || activeEditor.isDestroyed || !target) {
      return
    }

    const currentNode = activeEditor.state.doc.nodeAt(target.nodePos)

    if (!currentNode || currentNode.type.name !== "gifBlock") {
      closeGifPicker()
      return
    }

    updateBlockAttrsAt(activeEditor, target.nodePos, currentNode, {
      alt: selection.alt,
      giphyId: selection.giphyId,
      height: selection.height,
      promptOnMount: false,
      src: selection.src,
      width: selection.width,
    })
    closeGifPicker()

    window.requestAnimationFrame(() => {
      if (!activeEditor.isDestroyed) {
        activeEditor.view.focus()
      }
    })
  }, [closeGifPicker, gifPickerTarget])

  return (
    <EditorGifPickerContext.Provider value={{ openGifPicker }}>
      <EditorVariablePickerContext.Provider value={{ openVariablePicker }}>
      <EditorPreviewTextContext.Provider value={{ preview: Boolean(preview), resolveText: resolvePreviewText }}>
      <div
        ref={scrollContainerRef}
        className="h-full min-h-0 overflow-auto bg-background"
      >
        <div className="flex min-h-full min-w-[720px] justify-center bg-background text-foreground">
          <div className="flex min-h-full w-full max-w-[720px] flex-col">
            <div className={cn("mx-auto w-[600px] max-w-full font-site", colorMode === "dark" && "dark")}>
              <SiteHeaderChrome
                editable={!preview}
                header={pageChrome.header}
                workspaceLogoUrl={workspaceLogoUrl}
                workspaceName={workspaceName}
                workspaceWebsiteDomain={workspaceWebsiteDomain}
                onChange={(patch) =>
                  setPageChrome((current) => ({
                    ...current,
                    header: {
                      ...current.header,
                      ...patch,
                    },
                  }))
                }
              />
            </div>
            <div className={cn("mx-auto w-[600px] max-w-full font-site", colorMode === "dark" && "dark")}>
              <HeroChrome
                editable={!preview}
                hero={pageChrome.hero}
                recipientWebsiteDomain={getVariantVariableValue({
                  key: recipientWebsiteVariableKey,
                  variant: selectedVariant,
                  variables,
                })}
                selectedVariant={selectedVariant}
                variables={variables}
                workspaceLogoUrl={workspaceLogoUrl}
                workspaceWebsiteDomain={workspaceWebsiteDomain}
                onChange={(patch) =>
                  setPageChrome((current) => ({
                    ...current,
                    hero: {
                      ...current.hero,
                      ...patch,
                    },
                  }))
                }
              />
            </div>
            <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col pt-5" />
            <LightsitePageFooter className="mx-auto w-[600px] max-w-full" />
          </div>
        </div>
        {editor && !preview ? (
          <EditorBlockControls
            editor={editor}
            onChangeGif={openGifPicker}
          />
        ) : null}
        {editor && quickInsertMenu ? (
          <QuickInsertMenu
            editor={editor}
            menu={quickInsertMenu}
            selectedIndex={quickInsertSelectedIndex}
            onSelectedIndexChange={setQuickInsertSelectedIndex}
            variables={variables}
            onClose={() => setCommandMenuState(null)}
          />
        ) : null}
        {variablePicker ? (
          <FloatingVariablePicker
            menu={variablePicker}
            selectedIndex={variablePickerSelectedIndex}
            onSelectedIndexChange={setVariablePickerSelectedIndex}
            variables={variables}
            onClose={closeVariablePicker}
          />
        ) : null}
        <GifPickerDialog
          open={gifPickerTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeGifPicker()
            }
          }}
          onSelect={handleGifSelect}
        />
      </div>
      </EditorPreviewTextContext.Provider>
      </EditorVariablePickerContext.Provider>
    </EditorGifPickerContext.Provider>
  )
}

function SiteHeaderChrome({
  editable,
  header,
  workspaceLogoUrl,
  workspaceName,
  workspaceWebsiteDomain,
  onChange,
}: {
  editable: boolean
  header: EditorSiteHeaderAttrs
  workspaceLogoUrl?: string | null
  workspaceName?: string
  workspaceWebsiteDomain: string
  onChange: (patch: Partial<EditorSiteHeaderAttrs>) => void
}) {
  const customLogoUrl = header.logoUrl.trim()
  const logoUrl = customLogoUrl || resolveWorkspaceLogoSrc(workspaceLogoUrl, workspaceWebsiteDomain)
  const logoAlt = `${header.brandName.trim() || workspaceName?.trim() || "Workspace"} logo`

  return (
    <div data-editor-page-header="" className="flex h-[54px] shrink-0 items-center gap-2.5 overflow-hidden py-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {logoUrl ? (
          <>
            <ImagePickerButton
              className="h-5 justify-start rounded-none p-0"
              disabled={!editable}
              label={customLogoUrl ? "Change site logo" : "Upload site logo"}
              onChange={(logoUrl) => onChange({ logoUrl })}
            >
              <img
                src={logoUrl}
                alt={logoAlt}
                className="h-5 w-auto object-contain"
              />
            </ImagePickerButton>
            {customLogoUrl && editable ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Use workspace logo"
                onClick={() => onChange({ logoUrl: "" })}
              >
                <IconReplace />
              </Button>
            ) : null}
          </>
        ) : (
          <DashedButton disabled={!editable} onClick={() => onChange({ logoUrl: "/lightsite-logo.svg" })}>
            <IconPhotoPlus data-icon="inline-start" />
            Add Logo
          </DashedButton>
        )}
      </div>
      {header.showSecondaryButton ? (
        <DashedButton disabled={!editable}>
          {header.secondaryButtonText}
        </DashedButton>
      ) : null}
      <Button size="compact">{header.primaryButtonText}</Button>
    </div>
  )
}

function getVariantVariableValue({
  key,
  variant,
  variables,
}: {
  key: string
  variant?: VariantRecord
  variables: EditorVariable[]
}) {
  const variable = variables.find((item) => item.key === key)

  if (!variable) {
    return ""
  }

  return (variant?.values?.[variable.id] ?? variable.defaultValue).trim()
}

function resolveVariableText({
  selectedVariant,
  value,
  variables,
}: {
  selectedVariant?: VariantRecord
  value: string
  variables: EditorVariable[]
}) {
  if (!value.includes("{{")) {
    return value
  }

  return value.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, key: string) =>
    getVariantVariableValue({
      key,
      variant: selectedVariant,
      variables,
    })
  )
}

function buildLogoPreviewImageSrc(domain?: string) {
  const normalizedDomain = normalizeLogoDomain(domain)

  if (!normalizedDomain) {
    return ""
  }

  const params = new URLSearchParams({
    domain: normalizedDomain,
    size: "128",
    theme: "light",
  })

  return `/api/workspaces/logo-preview/image?${params.toString()}`
}

function resolveWorkspaceLogoSrc(logoUrl: string | null | undefined, domain?: string) {
  return logoUrl?.trim() || buildLogoPreviewImageSrc(domain)
}

function normalizeLogoDomain(value?: string) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return ""
  }

  try {
    const url = new URL(trimmedValue.includes("://") ? trimmedValue : `https://${trimmedValue}`)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")

    return hostname.includes(".") && !hostname.includes("..") ? hostname : ""
  } catch {
    return ""
  }
}

function HeroChrome({
  editable,
  hero,
  recipientWebsiteDomain,
  selectedVariant,
  variables,
  workspaceLogoUrl,
  workspaceWebsiteDomain,
  onChange,
}: {
  editable: boolean
  hero: EditorHeroAttrs
  recipientWebsiteDomain: string
  selectedVariant?: VariantRecord
  variables: EditorVariable[]
  workspaceLogoUrl?: string | null
  workspaceWebsiteDomain: string
  onChange: (patch: Partial<EditorHeroAttrs>) => void
}) {
  const defaultPrimarySrc = resolveWorkspaceLogoSrc(workspaceLogoUrl, workspaceWebsiteDomain)
  const primarySrc =
    resolveHeroAvatarVariableSrc({
      key: hero.avatarImageVariable,
      selectedVariant,
      variables,
    }) ||
    hero.avatarImage.trim() ||
    defaultPrimarySrc
  const secondarySrc =
    resolveHeroAvatarVariableSrc({
      key: hero.avatarImageSecondaryVariable,
      selectedVariant,
      variables,
    }) ||
    hero.avatarImageSecondary.trim() ||
    buildLogoPreviewImageSrc(recipientWebsiteDomain)

  return (
    <section data-editor-title-section="" className="flex min-h-[204px] shrink-0 flex-col items-center justify-center gap-4 overflow-hidden border-y border-border-subtle px-7 py-8 text-center">
      {hero.avatarHidden ? (
        editable ? (
          <DashedButton onClick={() => onChange({ avatarHidden: false })}>
            <IconPhotoPlus data-icon="inline-start" />
            Show avatar
          </DashedButton>
        ) : null
      ) : (
        <LegacyHeroAvatar
          disabled={!editable}
          primarySrc={primarySrc}
          primaryVariable={hero.avatarImageVariable}
          secondarySrc={secondarySrc}
          secondaryVariable={hero.avatarImageSecondaryVariable}
          onChangePrimary={(avatarImage) => onChange({ avatarImage, avatarImageVariable: "" })}
          onChangeSecondary={(avatarImageSecondary) =>
            onChange({ avatarImageSecondary, avatarImageSecondaryVariable: "" })
          }
          onHide={() => onChange({ avatarHidden: true })}
          onRemovePrimary={() => onChange({ avatarImage: "", avatarImageVariable: "" })}
          onRemoveSecondary={() => onChange({ avatarImageSecondary: "", avatarImageSecondaryVariable: "" })}
          onSetPrimaryVariable={(avatarImageVariable) => onChange({ avatarImage: "", avatarImageVariable })}
          onSetSecondaryVariable={(avatarImageSecondaryVariable) =>
            onChange({ avatarImageSecondary: "", avatarImageSecondaryVariable })
          }
        />
      )}
      <div className="flex max-w-full flex-col items-center gap-1">
        <InlineAttrTextarea
          ariaLabel="Site title"
          className="w-[400px] max-w-full text-center text-[28px] leading-9 font-medium"
          disabled={!editable}
          placeholder="Site Title"
          value={hero.title}
          onChange={(title) => onChange({ title })}
        />
        <InlineAttrTextarea
          ariaLabel="Site subtitle"
          className="w-[400px] max-w-full text-center text-xl leading-7 text-muted-foreground"
          disabled={!editable}
          placeholder="This is a subtitle"
          value={hero.subtitle}
          onChange={(subtitle) => onChange({ subtitle })}
        />
      </div>
    </section>
  )
}

function resolveHeroAvatarVariableSrc({
  key,
  selectedVariant,
  variables,
}: {
  key: string
  selectedVariant?: VariantRecord
  variables: EditorVariable[]
}) {
  return key
    ? getVariantVariableValue({
        key,
        variant: selectedVariant,
        variables,
      })
    : ""
}

export function LegacyHeroAvatar({
  disabled,
  onChangePrimary,
  onChangeSecondary,
  onHide,
  onRemovePrimary,
  onRemoveSecondary,
  onSetPrimaryVariable,
  onSetSecondaryVariable,
  primarySrc,
  primaryVariable,
  secondarySrc,
  secondaryVariable,
}: {
  disabled?: boolean
  onChangePrimary: (src: string) => void
  onChangeSecondary: (src: string) => void
  onHide: () => void
  onRemovePrimary: () => void
  onRemoveSecondary: () => void
  onSetPrimaryVariable: (variableKey: string) => void
  onSetSecondaryVariable: (variableKey: string) => void
  primarySrc?: string
  primaryVariable?: string
  secondarySrc?: string
  secondaryVariable?: string
}) {
  const variablePicker = useEditorVariablePicker()
  const hasDoubleAvatar = Boolean(secondarySrc || secondaryVariable)

  return (
    <div className="group/avatar relative flex items-center justify-center gap-[5px]">
      {!disabled ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Avatar settings"
              className="absolute top-4 left-[-28px] flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 shadow-xs transition-opacity hover:bg-secondary hover:text-foreground group-hover/avatar:opacity-100 data-[state=open]:bg-secondary data-[state=open]:text-foreground [&_svg]:size-3.5"
            >
              <IconSettings />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="h-[240px] w-[207px] overflow-hidden rounded-[14px] p-0"
          >
            <div className="flex h-[198px] flex-col gap-0.5 border-b px-1.5 py-1.5">
              <AvatarMenuImageRow
                label="Logo 1"
                src={primarySrc}
                variableKey={primaryVariable}
                onChange={onChangePrimary}
                onRemove={onRemovePrimary}
                onSetVariable={(triggerBounds) =>
                  variablePicker.openVariablePicker({
                    allowedTypes: ["image"],
                    left: triggerBounds.left,
                    onSelect: (variable: EditorVariable) => onSetPrimaryVariable(variable.key),
                    query: "",
                    top: triggerBounds.bottom + 4,
                  })
                }
              />
              <AvatarMenuImageRow
                label="Logo 2"
                src={secondarySrc}
                variableKey={secondaryVariable}
                onChange={onChangeSecondary}
                onRemove={onRemoveSecondary}
                onSetVariable={(triggerBounds) =>
                  variablePicker.openVariablePicker({
                    allowedTypes: ["image"],
                    left: triggerBounds.left,
                    onSelect: (variable: EditorVariable) => onSetSecondaryVariable(variable.key),
                    query: "",
                    top: triggerBounds.bottom + 4,
                  })
                }
              />
            </div>
            <button
              type="button"
              className="flex h-[42px] w-full items-center px-1.5 py-1.5 text-left text-sm leading-5 text-popover-foreground hover:bg-accent [&_svg]:size-3.5"
              onClick={onHide}
            >
              <span className="flex h-[30px] w-full items-center gap-2 rounded-sm px-2 py-1.5">
                <IconTrash />
                Hide section
              </span>
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <AvatarTile disabled={disabled} src={primarySrc} onChange={onChangePrimary} />
      {hasDoubleAvatar ? (
        <>
          <span className="h-px w-[17px] bg-border-subtle" />
          <AvatarTile disabled={disabled} src={secondarySrc} onChange={onChangeSecondary} />
        </>
      ) : null}
    </div>
  )
}

function AvatarTile({
  disabled,
  onChange,
  src,
}: {
  disabled?: boolean
  onChange: (src: string) => void
  src?: string
}) {
  return (
    <ImagePickerButton
      className="size-14 rounded-2xl border bg-background text-muted-foreground hover:bg-muted"
      disabled={disabled}
      label={src ? "Change avatar" : "Add avatar"}
      onChange={onChange}
    >
      {src ? (
        <span className="relative size-full">
          <img
            src={src}
            alt=""
            className="absolute top-1/2 left-1/2 h-auto w-10 -translate-x-1/2 -translate-y-1/2 object-contain"
          />
        </span>
      ) : (
        <span className="flex size-10 items-center justify-center rounded-[10px] border border-dashed bg-secondary text-muted-foreground [&_svg]:size-[18px]">
          <IconPhotoPlus />
        </span>
      )}
    </ImagePickerButton>
  )
}

function AvatarMenuImageRow({
  label,
  onChange,
  onRemove,
  onSetVariable,
  src,
  variableKey,
}: {
  label: string
  onChange: (src: string) => void
  onRemove: () => void
  onSetVariable: (triggerBounds: DOMRect) => void
  src?: string
  variableKey?: string
}) {
  const hasValue = Boolean(src || variableKey)

  return (
    <div className="flex h-[92px] w-full flex-col justify-center gap-2 rounded-sm px-2 pt-0.5 pb-1.5">
      <p className="h-5 text-sm leading-5 text-popover-foreground">{label}</p>
      <div className="flex h-14 w-full items-start gap-2">
        <AvatarMenuUploadSurface src={src} variableKey={variableKey} onChange={onChange} />
        <div className="flex h-14 w-6 shrink-0 flex-col items-start justify-center gap-2">
          {hasValue ? (
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()}`}
              className="flex size-6 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-secondary [&_svg]:size-3.5"
              onClick={onRemove}
            >
              <IconX />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Use variable for ${label.toLowerCase()}`}
            className="flex size-6 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-secondary [&_svg]:size-3.5"
            onClick={(event) => onSetVariable(event.currentTarget.getBoundingClientRect())}
          >
            <IconCodePlus />
          </button>
        </div>
      </div>
    </div>
  )
}

function AvatarMenuUploadSurface({
  onChange,
  src,
  variableKey,
}: {
  onChange: (src: string) => void
  src?: string
  variableKey?: string
}) {
  if (variableKey) {
    return (
      <div
        className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-[10px] border border-dashed border-variable-background bg-variable-background-secondary px-[5px] py-[3.333px]"
      >
        <span className="max-w-[116px] truncate rounded-md bg-variable-background px-1 pt-px pb-0.5 text-sm leading-4 text-variable-foreground">
          {formatVariableToken({ key: variableKey })}
        </span>
      </div>
    )
  }

  return (
    <ImagePickerButton
      className={cn(
        "h-14 min-w-0 flex-1 rounded-[10px] text-muted-foreground",
        src ? "border bg-background" : "border border-dashed bg-secondary px-[5px] py-[3.333px]",
        "[&_svg]:size-[18px]"
      )}
      label={src ? "Change avatar logo" : "Add avatar logo"}
      onChange={onChange}
    >
      {src ? <img src={src} alt="" className="max-h-10 max-w-[131px] object-contain" /> : <IconPhotoPlus />}
    </ImagePickerButton>
  )
}

function commandMenuStateKey(menu: CommandMenuState) {
  if (!menu) {
    return "closed"
  }

  return `${menu.kind}:${menu.query}:${menu.range.from}:${menu.range.to}`
}

function isEditableInteractionTarget(target: Element) {
  if (target.matches("[contenteditable='true']")) {
    return true
  }

  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [role='button'], [data-editor-text-content], [data-node-view-content], [data-radix-popper-content-wrapper]"
    )
  )
}

function shouldPreserveEditorSelection(target: Element) {
  if (
    target.closest(
      [
        "[data-radix-popper-content-wrapper]",
        "[data-lightsite-block-controls]",
        "[data-editor-page-header]",
        "[data-editor-title-section]",
      ].join(",")
    )
  ) {
    return true
  }

  if (!target.closest(".lightsite-document-editor")) {
    return false
  }

  return isEditorContentTarget(target) || isEditableInteractionTarget(target)
}

function isEditorContentTarget(target: Element) {
  return Boolean(
    target.closest(
      [
        "[data-block-wrapper-type]",
        ".lightsite-document-editor ul",
        ".lightsite-document-editor ol",
      ].join(",")
    )
  )
}
