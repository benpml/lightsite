import { IconArrowsHorizontal, IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

import { getFormValue, normalizeButtonHref } from "../lib/button-link"
import type { HandoutNextButtonSettingsTarget } from "../tiptap/extensions/button-settings"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorButtonSettingsPopoverProps = {
  editor: Editor
}

type ButtonSettingsStorage = {
  subscribe: (listener: (target: HandoutNextButtonSettingsTarget) => void) => () => void
}

type ButtonSettingsError = {
  field: "href" | "label"
  message: string
}

export function EditorButtonSettingsPopover({ editor }: EditorButtonSettingsPopoverProps) {
  const [target, setTarget] = useState<HandoutNextButtonSettingsTarget | null>(null)
  const [labelDraft, setLabelDraft] = useState("")
  const [hrefDraft, setHrefDraft] = useState("")
  const [fullWidthDraft, setFullWidthDraft] = useState(false)
  const [error, setError] = useState<ButtonSettingsError | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const open = target !== null
  const isCreateMode = target?.mode === "create"

  const reset = useCallback(() => {
    setTarget(null)
    setLabelDraft("")
    setHrefDraft("")
    setFullWidthDraft(false)
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    const activeTarget = target
    reset()

    if (activeTarget?.mode === "create") {
      editor.chain().focus().removeHandoutNextButtonDraft(activeTarget.pos).run()
      return
    }

    if (activeTarget) {
      editor
        .chain()
        .focus()
        .previewHandoutNextButtonDraft(activeTarget.pos, {
          fullWidth: activeTarget.fullWidth,
          href: activeTarget.href,
          label: activeTarget.label,
        })
        .run()
    }

    editor.commands.focus()
  }, [editor, reset, target])

  const previewButtonDraft = useCallback(
    (attrs: { fullWidth?: boolean; label?: string }) => {
      if (!target) {
        return
      }

      editor.commands.previewHandoutNextButtonDraft(target.pos, attrs)
    },
    [editor, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as { handoutNextButtonSettings?: ButtonSettingsStorage }
    ).handoutNextButtonSettings

    if (!storage) {
      return
    }

    return storage.subscribe((nextTarget) => {
      setTarget(nextTarget)
      setLabelDraft(nextTarget.label || "Button")
      setHrefDraft(nextTarget.href)
      setFullWidthDraft(nextTarget.fullWidth)
      setError(null)
    })
  }, [editor])

  const getAnchorRect = useCallback(() => {
    if (!target) {
      return null
    }

    const node = editor.view.nodeDOM(target.pos)

    return node instanceof HTMLElement ? node.getBoundingClientRect() : null
  }, [editor, target])
  const position = useFloatingEditorPopoverPosition({
    fallbackHeight: 336,
    fallbackWidth: 320,
    floatingRef: popoverRef,
    getAnchorRect,
    open,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const focusId = window.requestAnimationFrame(() => {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) {
        return
      }

      const node = target ? editor.view.nodeDOM(target.pos) : null

      if (event.target instanceof Node && node instanceof HTMLElement && node.contains(event.target)) {
        return
      }

      cancel()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusId)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [cancel, editor, open, target])

  const save = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()

      if (!target) {
        return
      }

      const form = event?.currentTarget
      const label = getFormValue(form, "label", labelDraft).trim()
      const normalized = normalizeButtonHref(getFormValue(form, "href", hrefDraft))

      if (!label) {
        setError({ field: "label", message: "Enter button text." })
        return
      }

      if (normalized === "") {
        setError({ field: "href", message: "Enter a website URL." })
        return
      }

      if (normalized === null) {
        setError({ field: "href", message: "Enter a valid public website URL." })
        return
      }

      editor
        .chain()
        .focus()
        .setHandoutNextButtonAttrs(target.pos, {
          fullWidth: fullWidthDraft,
          label,
          href: normalized,
        })
        .run()
      reset()
    },
    [editor, fullWidthDraft, hrefDraft, labelDraft, reset, target]
  )

  if (!open || !position) {
    return null
  }

  return (
    <div
      ref={popoverRef}
      className="handout-editor-button-settings"
      role="dialog"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      aria-label="Button settings"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <FieldGroup className="gap-3">
          <Field data-invalid={error?.field === "label" || undefined}>
            <FieldLabel htmlFor="handout-editor-button-label">Button text</FieldLabel>
            <Input
              ref={labelInputRef}
              id="handout-editor-button-label"
              aria-invalid={error?.field === "label" || undefined}
              maxLength={HANDOUT_TEXT_LIMITS.sidebarLabel}
              name="label"
              placeholder="Button"
              size="lg"
              type="text"
              value={labelDraft}
              onChange={(event) => {
                const nextLabel = event.currentTarget.value

                setLabelDraft(nextLabel)
                setError(null)
                previewButtonDraft({ label: nextLabel.trim() || "Button" })
              }}
            />
            <FieldError>{error?.field === "label" ? error.message : null}</FieldError>
          </Field>
          <Field data-invalid={error?.field === "href" || undefined}>
            <FieldLabel htmlFor="handout-editor-button-link">Button link</FieldLabel>
            <InputGroup size="lg">
              <InputGroupAddon>
                <IconLink aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="handout-editor-button-link"
                aria-invalid={error?.field === "href" || undefined}
                inputMode="url"
                maxLength={HANDOUT_TEXT_LIMITS.url}
                name="href"
                placeholder="https://example.com"
                type="text"
                value={hrefDraft}
                onChange={(event) => {
                  setHrefDraft(event.currentTarget.value)
                  setError(null)
                }}
              />
            </InputGroup>
            <FieldError>{error?.field === "href" ? error.message : null}</FieldError>
          </Field>
        </FieldGroup>
        <button
          className="handout-editor-button-settings-toggle"
          type="button"
          aria-pressed={fullWidthDraft}
          onClick={() => {
            const nextFullWidth = !fullWidthDraft

            setFullWidthDraft(nextFullWidth)
            previewButtonDraft({ fullWidth: nextFullWidth })
          }}
        >
          <IconArrowsHorizontal aria-hidden="true" />
          <span className="handout-editor-button-settings-toggle-copy">
            <span>Fill width</span>
            <span>Stretch the button to the block width</span>
          </span>
          <span
            className={cn(
              "handout-editor-button-settings-switch",
              fullWidthDraft && "handout-editor-button-settings-switch-on"
            )}
            aria-hidden="true"
          />
        </button>
        <div className="handout-editor-button-settings-actions">
          <button className="handout-editor-button-settings-action" type="button" onClick={cancel}>
            Cancel
          </button>
          <button
            className="handout-editor-button-settings-action handout-editor-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
