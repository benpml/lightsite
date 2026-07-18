import type React from "react"
import { normalizeEditorHighlightColor, normalizeEditorTextColor } from "@handout/design-tokens"
import { HANDOUT_TEXT_LIMITS, normalizeWebsiteUrl } from "@handout/domain"
import { BubbleMenu } from "@tiptap/react/menus"
import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import {
  IconBlockquote,
  IconBold,
  IconCheck,
  IconChevronDown,
  IconClearFormatting,
  IconCode,
  IconDotsVertical,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconList,
  IconChecklist,
  IconListNumbers,
  IconPilcrow,
  IconStrikethrough,
  IconUnderline,
  IconUnlink,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

type EditorTextBubbleMenuProps = {
  editor: Editor
}

type BubblePanel = "type" | "color" | "link" | "more" | null

type TextColorOption = {
  label: string
  ring: string
  value: string | null
}

type HighlightColorOption = {
  border: string | null
  label: string
  swatch: string | null
  value: string | null
}

type TextTypeOption = {
  active: (editor: Editor) => boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  run: (editor: Editor) => void
}

const textTypeOptions: TextTypeOption[] = [
  {
    label: "Text",
    icon: IconPilcrow,
    active: (editor) => editor.isActive("paragraph"),
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    label: "Heading 1",
    icon: IconH1,
    active: (editor) => editor.isActive("heading", { level: 1 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: IconH2,
    active: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: IconH3,
    active: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Quote",
    icon: IconBlockquote,
    active: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "Code block",
    icon: IconCode,
    active: (editor) => editor.isActive("codeBlock"),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Bullet list",
    icon: IconList,
    active: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    icon: IconListNumbers,
    active: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Task list",
    icon: IconChecklist,
    active: (editor) => editor.isActive("taskList"),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
]

const textColors: TextColorOption[] = [
  { label: "Default", value: null, ring: "var(--popover-foreground)" },
  createTextColorOption("Purple", "purple"),
  createTextColorOption("Blue", "blue"),
  createTextColorOption("Cyan", "cyan"),
  createTextColorOption("Teal", "teal"),
  createTextColorOption("Green", "green"),
  createTextColorOption("Yellow", "yellow"),
  createTextColorOption("Orange", "orange"),
  createTextColorOption("Red", "red"),
  createTextColorOption("Pink", "pink"),
]

const highlightColors: HighlightColorOption[] = [
  { label: "None", value: null, swatch: null, border: null },
  createHighlightColorOption("Purple", "purple"),
  createHighlightColorOption("Blue", "blue"),
  createHighlightColorOption("Cyan", "cyan"),
  createHighlightColorOption("Teal", "teal"),
  createHighlightColorOption("Green", "green"),
  createHighlightColorOption("Yellow", "yellow"),
  createHighlightColorOption("Orange", "orange"),
  createHighlightColorOption("Red", "red"),
  createHighlightColorOption("Pink", "pink"),
]

const emptyTextBubbleMenuState = {
  blockTypeLabel: "Text",
  canClear: false,
  highlightColor: "",
  isBold: false,
  isCode: false,
  isItalic: false,
  isLink: false,
  isStrike: false,
  isUnderline: false,
  linkHref: "",
  textColor: "",
}

export function EditorTextBubbleMenu({ editor }: EditorTextBubbleMenuProps) {
  const [activePanel, setActivePanel] = useState<BubblePanel>(null)
  const [linkHref, setLinkHref] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const editorState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => {
      if (!activeEditor || activeEditor.isDestroyed) {
        return emptyTextBubbleMenuState
      }

      return {
        blockTypeLabel: getActiveTextTypeLabel(activeEditor),
        canClear: activeEditor.can().chain().focus().unsetAllMarks().run(),
        highlightColor: normalizeEditorHighlightColor(
          activeEditor.getAttributes("highlight").color,
        ),
        isBold: activeEditor.isActive("bold"),
        isCode: activeEditor.isActive("code"),
        isItalic: activeEditor.isActive("italic"),
        isLink: activeEditor.isActive("link"),
        isStrike: activeEditor.isActive("strike"),
        isUnderline: activeEditor.isActive("underline"),
        linkHref: String(activeEditor.getAttributes("link").href ?? ""),
        textColor: normalizeEditorTextColor(activeEditor.getAttributes("textStyle").color),
      }
    },
  })

  useEffect(() => {
    if (activePanel === "link") {
      window.requestAnimationFrame(() => linkInputRef.current?.focus())
    }
  }, [activePanel, editor])

  useEffect(() => {
    const handleSelectionUpdate = () => {
      if (
        !hasSelectedText(editor.state.selection) &&
        !bubbleRef.current?.contains(document.activeElement)
      ) {
        setActivePanel(null)
      }
    }

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor])

  useEffect(() => {
    if (activePanel === null) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && bubbleRef.current?.contains(event.target)) {
        return
      }

      setActivePanel(null)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [activePanel])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePanel(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const applyLink = () => {
    const href = normalizeLinkHref(linkHref)

    if (href === null) {
      setLinkError("Enter a valid public website URL.")
      return
    }

    if (!href) {
      const command = editor.chain().focus()

      if (linkSelectionRef.current) {
        command.setTextSelection(linkSelectionRef.current)
      }

      command.extendMarkRange("link").unsetLink().run()
      setActivePanel(null)
      return
    }

    const command = editor.chain().focus()

    if (linkSelectionRef.current) {
      command.setTextSelection(linkSelectionRef.current)
    }

    command.extendMarkRange("link").setLink({ href }).run()
    setLinkHref(href)
    setLinkError(null)
    setActivePanel(null)
  }

  const removeLink = () => {
    const command = editor.chain().focus()

    if (linkSelectionRef.current) {
      command.setTextSelection(linkSelectionRef.current)
    }

    command.extendMarkRange("link").unsetLink().run()
    setLinkHref("")
    setLinkError(null)
    setActivePanel(null)
  }

  const openLinkPanel = () => {
    const { from, to } = editor.state.selection

    linkSelectionRef.current = hasSelectedText(editor.state.selection) ? { from, to } : null
    setLinkHref(editor.getAttributes("link").href ?? "")
    setLinkError(null)
    setActivePanel("link")
  }

  const setTextColor = (value: string | null) => {
    const command = editor.chain().focus()

    if (value) {
      command.setColor(value).run()
    } else {
      command.unsetColor().removeEmptyTextStyle().run()
    }

    setActivePanel(null)
  }

  const setHighlightColor = (value: string | null) => {
    const command = editor.chain().focus()

    if (value) {
      command.setHighlight({ color: value }).run()
    } else {
      command.unsetHighlight().run()
    }

    setActivePanel(null)
  }

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run()
    setActivePanel(null)
  }

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      shouldShow={({ editor: activeEditor, state }) =>
        activeEditor.isEditable &&
        (hasSelectedText(state.selection) ||
          (activePanel !== null && Boolean(bubbleRef.current?.contains(document.activeElement))))
      }
      options={{
        placement: "top",
        offset: 10,
      }}
    >
      <div ref={bubbleRef} className="handout-editor-bubble-menu-shell">
        <div className="handout-editor-bubble-menu">
          <SegmentButton
            label={editorState.blockTypeLabel}
            expanded={activePanel === "type"}
            onClick={() => setActivePanel(activePanel === "type" ? null : "type")}
          />
          <span className="handout-editor-bubble-menu-separator" />
          <MenuButton
            label="Bold"
            active={editorState.isBold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <IconBold />
          </MenuButton>
          <MenuButton
            label="Italic"
            active={editorState.isItalic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <IconItalic />
          </MenuButton>
          <MenuButton
            label="Underline"
            active={editorState.isUnderline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <IconUnderline />
          </MenuButton>
          <MenuButton
            label="Strike"
            active={editorState.isStrike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <IconStrikethrough />
          </MenuButton>
          <MenuButton
            label="Inline code"
            active={editorState.isCode}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <IconCode />
          </MenuButton>
          <span className="handout-editor-bubble-menu-separator" />
          <MenuButton label="Link" active={editorState.isLink} onClick={openLinkPanel}>
            <IconLink />
          </MenuButton>
          <ColorTrigger
            expanded={activePanel === "color"}
            textColor={editorState.textColor}
            highlightColor={editorState.highlightColor}
            onClick={() => setActivePanel(activePanel === "color" ? null : "color")}
          />
          <span className="handout-editor-bubble-menu-separator" />
          <MenuButton
            label="More"
            active={activePanel === "more"}
            onClick={() => setActivePanel(activePanel === "more" ? null : "more")}
          >
            <IconDotsVertical />
          </MenuButton>
        </div>
        {activePanel === "type" ? (
          <div className="handout-editor-bubble-panel handout-editor-bubble-panel-type">
            {textTypeOptions.map((option) => {
              const Icon = option.icon
              const active = option.active(editor)

              return (
                <button
                  key={option.label}
                  type="button"
                  data-slot="editor-menu-item"
                  className="handout-editor-bubble-panel-row"
                  data-active={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    option.run(editor)
                    setActivePanel(null)
                  }}
                >
                  <Icon className="handout-editor-bubble-panel-row-icon" />
                  <span className="handout-editor-bubble-panel-row-copy">
                    <span className="handout-editor-bubble-panel-row-label">{option.label}</span>
                  </span>
                  {active ? <IconCheck className="handout-editor-bubble-panel-row-check" /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        {activePanel === "color" ? (
          <div className="handout-editor-bubble-panel handout-editor-color-panel">
            <ColorSection label="Text color">
              {textColors.map((option) => (
                <TextColorButton
                  key={option.label}
                  option={option}
                  active={colorValuesMatch(editorState.textColor, option.value)}
                  onSelect={() => setTextColor(option.value)}
                />
              ))}
            </ColorSection>
            <ColorSection label="Highlight color">
              {highlightColors.map((option) => (
                <HighlightColorButton
                  key={option.label}
                  option={option}
                  active={highlightValuesMatch(editorState.highlightColor, option)}
                  onSelect={() => setHighlightColor(option.value)}
                />
              ))}
            </ColorSection>
          </div>
        ) : null}
        {activePanel === "link" ? (
          <form
            className="handout-editor-bubble-panel handout-editor-link-panel"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              applyLink()
            }}
          >
            <label className="handout-editor-link-panel-label" htmlFor="handout-editor-link-input">
              Link
            </label>
            <InputGroup size="lg">
              <InputGroupAddon>
                <IconLink aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="handout-editor-link-input"
                ref={linkInputRef}
                aria-label="Link URL"
                aria-invalid={linkError ? true : undefined}
                inputMode="url"
                maxLength={HANDOUT_TEXT_LIMITS.url}
                placeholder="Paste or type a link"
                value={linkHref}
                onChange={(event) => {
                  setLinkHref(event.target.value)
                  setLinkError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setActivePanel(null)
                    editor.commands.focus()
                  }
                }}
              />
            </InputGroup>
            {linkError ? (
              <div className="px-1 text-xs text-destructive">{linkError}</div>
            ) : null}
            <div className="handout-editor-link-panel-actions">
              {editorState.isLink ? (
                <Button
                  type="button"
                  variant="editor"
                  size="compact"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={removeLink}
                >
                  Remove
                </Button>
              ) : null}
              <Button
                type="button"
                variant="editor"
                size="compact"
                className="text-tertiary-foreground hover:text-tertiary-foreground focus-visible:text-tertiary-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setActivePanel(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="compact">
                Apply
              </Button>
            </div>
          </form>
        ) : null}
        {activePanel === "more" ? (
          <div className="handout-editor-bubble-panel handout-editor-bubble-panel-more">
            <button
              type="button"
              data-slot="editor-menu-item"
              className="handout-editor-bubble-panel-row"
              disabled={!editorState.canClear}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearFormatting}
            >
              <IconClearFormatting className="handout-editor-bubble-panel-row-icon" />
              <span className="handout-editor-bubble-panel-row-copy">
                <span className="handout-editor-bubble-panel-row-label">Clear formatting</span>
              </span>
            </button>
            <button
              type="button"
              data-slot="editor-menu-item"
              className="handout-editor-bubble-panel-row"
              disabled={!editorState.isLink}
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeLink}
            >
              <IconUnlink className="handout-editor-bubble-panel-row-icon" />
              <span className="handout-editor-bubble-panel-row-copy">
                <span className="handout-editor-bubble-panel-row-label">Remove link</span>
              </span>
            </button>
            <button
              type="button"
              data-slot="editor-menu-item"
              className="handout-editor-bubble-panel-row"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().removeEmptyTextStyle().unsetHighlight().run()
                setActivePanel(null)
              }}
            >
              <IconX className="handout-editor-bubble-panel-row-icon" />
              <span className="handout-editor-bubble-panel-row-copy">
                <span className="handout-editor-bubble-panel-row-label">Clear colors</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </BubbleMenu>
  )
}

function hasSelectedText(selection: import("@tiptap/pm/state").Selection) {
  return selection instanceof TextSelection && !selection.empty
}

function SegmentButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="editor"
      size="editor-toolbar"
      aria-expanded={expanded}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span>{label}</span>
      <IconChevronDown />
    </Button>
  )
}

function MenuButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="editor"
      size="editor-toolbar-icon"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ColorTrigger({
  expanded,
  highlightColor,
  onClick,
  textColor,
}: {
  expanded: boolean
  highlightColor: string
  onClick: () => void
  textColor: string
}) {
  return (
    <Button
      type="button"
      variant="editor"
      size="editor-toolbar-swatch"
      aria-expanded={expanded}
      aria-label="Text and highlight color"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span
        className="handout-editor-color-trigger-glyph"
        style={
          {
            "--handout-editor-current-text-color": textColor || "var(--popover-foreground)",
            "--handout-editor-current-highlight-color": highlightColor || "transparent",
          } as React.CSSProperties
        }
      >
        A
      </span>
      <IconChevronDown />
    </Button>
  )
}

function ColorSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section className="handout-editor-color-section">
      <div className="handout-editor-color-section-label">{label}</div>
      <div className="handout-editor-color-grid">{children}</div>
    </section>
  )
}

function TextColorButton({
  active,
  onSelect,
  option,
}: {
  active: boolean
  onSelect: () => void
  option: TextColorOption
}) {
  return (
    <button
      type="button"
      aria-label={`${option.label} text color`}
      className="handout-editor-text-color-button"
      data-active={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      style={
        {
          "--handout-editor-color-ring": option.ring,
          "--handout-editor-color-value": option.value ?? "var(--popover-foreground)",
        } as React.CSSProperties
      }
    >
      A
    </button>
  )
}

function HighlightColorButton({
  active,
  onSelect,
  option,
}: {
  active: boolean
  onSelect: () => void
  option: HighlightColorOption
}) {
  return (
    <button
      type="button"
      aria-label={`${option.label} highlight color`}
      className="handout-editor-highlight-color-button"
      data-active={active}
      data-empty={option.value === null}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      style={
        {
          "--handout-editor-highlight-value": option.value ?? "transparent",
          "--handout-editor-highlight-swatch": option.swatch ?? "transparent",
          "--handout-editor-highlight-border": option.border ?? "transparent",
        } as React.CSSProperties
      }
    />
  )
}

function getActiveTextTypeLabel(editor: Editor) {
  return textTypeOptions.find((option) => option.active(editor))?.label ?? "Text"
}

function colorValuesMatch(currentValue: string, optionValue: string | null) {
  return optionValue ? currentValue.toLowerCase() === optionValue.toLowerCase() : !currentValue
}

function highlightValuesMatch(currentValue: string, option: HighlightColorOption) {
  const normalizedValue = currentValue.toLowerCase()

  if (!option.value) {
    return !currentValue
  }

  return (
    normalizedValue === option.value.toLowerCase() ||
    normalizedValue === option.swatch?.toLowerCase()
  )
}

function createTextColorOption(label: string, colorName: string): TextColorOption {
  return {
    label,
    ring: paletteColorValue(colorName, "border"),
    value: paletteColorValue(colorName, "foreground"),
  }
}

function createHighlightColorOption(label: string, colorName: string): HighlightColorOption {
  const background = paletteColorValue(colorName, "background")

  return {
    border: paletteColorValue(colorName, "border"),
    label,
    swatch: background,
    value: background,
  }
}

function paletteColorValue(colorName: string, role: "background" | "border" | "foreground") {
  return `var(--${colorName}-${role})`
}

function normalizeLinkHref(value: string) {
  const href = value.trim()

  if (!href) {
    return ""
  }

  const normalized = normalizeWebsiteUrl(href)

  return normalized.ok ? normalized.url : null
}
