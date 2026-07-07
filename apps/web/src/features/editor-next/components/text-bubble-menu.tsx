import type React from "react"
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

type EditorNextTextBubbleMenuProps = {
  editor: Editor
}

type BubblePanel = "type" | "color" | "link" | "more" | null

type TextColorOption = {
  label: string
  ring: string
  value: string | null
}

type HighlightColorOption = {
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
  createTextColorOption("Indigo", "indigo"),
  createTextColorOption("Blue", "blue"),
  createTextColorOption("Sky", "sky"),
  createTextColorOption("Cyan", "cyan"),
  createTextColorOption("Teal", "teal"),
  createTextColorOption("Emerald", "emerald"),
  createTextColorOption("Amber", "amber"),
  createTextColorOption("Rose", "rose"),
  createTextColorOption("Pink", "pink"),
]

const highlightColors: HighlightColorOption[] = [
  { label: "None", value: null, swatch: null },
  createHighlightColorOption("Indigo", "indigo"),
  createHighlightColorOption("Blue", "blue"),
  createHighlightColorOption("Sky", "sky"),
  createHighlightColorOption("Cyan", "cyan"),
  createHighlightColorOption("Teal", "teal"),
  createHighlightColorOption("Emerald", "emerald"),
  createHighlightColorOption("Amber", "amber"),
  createHighlightColorOption("Rose", "rose"),
  createHighlightColorOption("Pink", "pink"),
]

export function EditorNextTextBubbleMenu({ editor }: EditorNextTextBubbleMenuProps) {
  const [activePanel, setActivePanel] = useState<BubblePanel>(null)
  const [linkHref, setLinkHref] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const editorState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => ({
      blockTypeLabel: getActiveTextTypeLabel(activeEditor),
      canClear: activeEditor.can().chain().focus().unsetAllMarks().run(),
      highlightColor: String(activeEditor.getAttributes("highlight").color ?? ""),
      isBold: activeEditor.isActive("bold"),
      isCode: activeEditor.isActive("code"),
      isItalic: activeEditor.isActive("italic"),
      isLink: activeEditor.isActive("link"),
      isStrike: activeEditor.isActive("strike"),
      isUnderline: activeEditor.isActive("underline"),
      linkHref: String(activeEditor.getAttributes("link").href ?? ""),
      textColor: String(activeEditor.getAttributes("textStyle").color ?? ""),
    }),
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
    setActivePanel(null)
  }

  const removeLink = () => {
    const command = editor.chain().focus()

    if (linkSelectionRef.current) {
      command.setTextSelection(linkSelectionRef.current)
    }

    command.extendMarkRange("link").unsetLink().run()
    setLinkHref("")
    setActivePanel(null)
  }

  const openLinkPanel = () => {
    const { from, to } = editor.state.selection

    linkSelectionRef.current = hasSelectedText(editor.state.selection) ? { from, to } : null
    setLinkHref(editor.getAttributes("link").href ?? "")
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
      <div ref={bubbleRef} className="lightsite-next-bubble-menu-shell">
        <div className="lightsite-next-bubble-menu">
          <SegmentButton
            label={editorState.blockTypeLabel}
            expanded={activePanel === "type"}
            onClick={() => setActivePanel(activePanel === "type" ? null : "type")}
          />
          <span className="lightsite-next-bubble-menu-separator" />
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
          <span className="lightsite-next-bubble-menu-separator" />
          <MenuButton label="Link" active={editorState.isLink} onClick={openLinkPanel}>
            <IconLink />
          </MenuButton>
          <ColorTrigger
            expanded={activePanel === "color"}
            textColor={editorState.textColor}
            highlightColor={editorState.highlightColor}
            onClick={() => setActivePanel(activePanel === "color" ? null : "color")}
          />
          <span className="lightsite-next-bubble-menu-separator" />
          <MenuButton
            label="More"
            active={activePanel === "more"}
            onClick={() => setActivePanel(activePanel === "more" ? null : "more")}
          >
            <IconDotsVertical />
          </MenuButton>
        </div>
        {activePanel === "type" ? (
          <div className="lightsite-next-bubble-panel lightsite-next-bubble-panel-type">
            {textTypeOptions.map((option) => {
              const Icon = option.icon
              const active = option.active(editor)

              return (
                <button
                  key={option.label}
                  type="button"
                  data-slot="editor-menu-item"
                  className="lightsite-next-bubble-panel-row"
                  data-active={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    option.run(editor)
                    setActivePanel(null)
                  }}
                >
                  <Icon className="lightsite-next-bubble-panel-row-icon" />
                  <span className="lightsite-next-bubble-panel-row-copy">
                    <span className="lightsite-next-bubble-panel-row-label">{option.label}</span>
                  </span>
                  {active ? <IconCheck className="lightsite-next-bubble-panel-row-check" /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        {activePanel === "color" ? (
          <div className="lightsite-next-bubble-panel lightsite-next-color-panel">
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
            className="lightsite-next-bubble-panel lightsite-next-link-panel"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              applyLink()
            }}
          >
            <label className="lightsite-next-link-panel-label" htmlFor="lightsite-next-link-input">
              Link
            </label>
            <InputGroup className="lightsite-next-link-panel-field">
              <InputGroupAddon>
                <IconLink className="lightsite-next-link-editor-icon" />
              </InputGroupAddon>
              <InputGroupInput
                id="lightsite-next-link-input"
                ref={linkInputRef}
                aria-label="Link URL"
                placeholder="Paste or type a link"
                value={linkHref}
                onChange={(event) => setLinkHref(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setActivePanel(null)
                    editor.commands.focus()
                  }
                }}
              />
            </InputGroup>
            <div className="lightsite-next-link-panel-actions">
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
          <div className="lightsite-next-bubble-panel lightsite-next-bubble-panel-more">
            <button
              type="button"
              data-slot="editor-menu-item"
              className="lightsite-next-bubble-panel-row"
              disabled={!editorState.canClear}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearFormatting}
            >
              <IconClearFormatting className="lightsite-next-bubble-panel-row-icon" />
              <span className="lightsite-next-bubble-panel-row-copy">
                <span className="lightsite-next-bubble-panel-row-label">Clear formatting</span>
              </span>
            </button>
            <button
              type="button"
              data-slot="editor-menu-item"
              className="lightsite-next-bubble-panel-row"
              disabled={!editorState.isLink}
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeLink}
            >
              <IconUnlink className="lightsite-next-bubble-panel-row-icon" />
              <span className="lightsite-next-bubble-panel-row-copy">
                <span className="lightsite-next-bubble-panel-row-label">Remove link</span>
              </span>
            </button>
            <button
              type="button"
              data-slot="editor-menu-item"
              className="lightsite-next-bubble-panel-row"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().removeEmptyTextStyle().unsetHighlight().run()
                setActivePanel(null)
              }}
            >
              <IconX className="lightsite-next-bubble-panel-row-icon" />
              <span className="lightsite-next-bubble-panel-row-copy">
                <span className="lightsite-next-bubble-panel-row-label">Clear colors</span>
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
        className="lightsite-next-color-trigger-glyph"
        style={
          {
            "--lightsite-next-current-text-color": textColor || "var(--popover-foreground)",
            "--lightsite-next-current-highlight-color": highlightColor || "transparent",
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
    <section className="lightsite-next-color-section">
      <div className="lightsite-next-color-section-label">{label}</div>
      <div className="lightsite-next-color-grid">{children}</div>
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
      className="lightsite-next-text-color-button"
      data-active={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      style={
        {
          "--lightsite-next-color-ring": option.ring,
          "--lightsite-next-color-value": option.value ?? "var(--popover-foreground)",
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
      className="lightsite-next-highlight-color-button"
      data-active={active}
      data-empty={option.value === null}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      style={
        {
          "--lightsite-next-highlight-value": option.value ?? "transparent",
          "--lightsite-next-highlight-swatch": option.swatch ?? "transparent",
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
  const value = editorColorValue(colorName)

  return {
    label,
    ring: value,
    value,
  }
}

function createHighlightColorOption(label: string, colorName: string): HighlightColorOption {
  const swatch = editorColorValue(colorName)

  return {
    label,
    swatch,
    value: `color-mix(in oklab, ${swatch} 30%, transparent)`,
  }
}

function editorColorValue(colorName: string) {
  return `var(--lightsite-editor-color-${colorName})`
}

function normalizeLinkHref(value: string) {
  const href = value.trim()

  if (!href) {
    return ""
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
    return href
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) {
    return `mailto:${href}`
  }

  return `https://${href}`
}
