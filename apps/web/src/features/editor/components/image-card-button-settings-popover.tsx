import { IconLink } from "@tabler/icons-react"
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

import { getFormValue, normalizeButtonHref } from "../lib/button-link"
import type { HandoutNextImageCardButtonSettingsTarget } from "../tiptap/extensions/image-card-button-settings"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorImageCardButtonSettingsPopoverProps = {
  editor: Editor
}

type ImageCardButtonSettingsStorage = {
  subscribe: (
    listener: (target: HandoutNextImageCardButtonSettingsTarget) => void
  ) => () => void
}

type ImageCardButtonSettingsError = {
  field: "href" | "label"
  message: string
}

export function EditorImageCardButtonSettingsPopover({
  editor,
}: EditorImageCardButtonSettingsPopoverProps) {
  const [target, setTarget] = useState<HandoutNextImageCardButtonSettingsTarget | null>(null)
  const [labelDraft, setLabelDraft] = useState("")
  const [hrefDraft, setHrefDraft] = useState("")
  const [error, setError] = useState<ImageCardButtonSettingsError | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const open = target !== null
  const isCreateMode = target?.mode === "create"

  const reset = useCallback(() => {
    setTarget(null)
    setLabelDraft("")
    setHrefDraft("")
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    const activeTarget = target
    reset()

    if (activeTarget?.mode === "create") {
      editor.chain().focus().removeHandoutNextImageCardButtonDraft(activeTarget.pos).run()
      return
    }

    editor.commands.focus()
  }, [editor, reset, target])

  const previewCreateDraft = useCallback(
    (attrs: { label?: string }) => {
      if (!target || target.mode !== "create") {
        return
      }

      editor.commands.previewHandoutNextImageCardButtonDraft(target.pos, {
        includeButton: true,
        ...attrs,
      })
    },
    [editor, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as {
        handoutNextImageCardButtonSettings?: ImageCardButtonSettingsStorage
      }
    ).handoutNextImageCardButtonSettings

    if (!storage) {
      return
    }

    return storage.subscribe((nextTarget) => {
      const nextLabel = nextTarget.label || "Learn more"

      setTarget(nextTarget)
      setLabelDraft(nextLabel)
      setHrefDraft(nextTarget.href)
      setError(null)

      if (nextTarget.mode === "create") {
        editor.commands.previewHandoutNextImageCardButtonDraft(nextTarget.pos, {
          includeButton: true,
          label: nextLabel,
        })
      }
    })
  }, [editor])

  const getAnchorRect = useCallback(() => {
    if (!target) {
      return null
    }

    const node = editor.view.nodeDOM(target.pos)

    if (!(node instanceof HTMLElement)) {
      return null
    }

    const button = node.querySelector<HTMLElement>(".handout-editor-image-card-cta")

    return (button ?? node).getBoundingClientRect()
  }, [editor, target])
  const position = useFloatingEditorPopoverPosition({
    fallbackHeight: 272,
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
  }, [cancel, open])

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
        .setHandoutNextImageCardButtonAttrs(target.pos, {
          href: normalized,
          includeButton: true,
          label,
        })
        .run()
      reset()
    },
    [editor, hrefDraft, labelDraft, reset, target]
  )

  if (!open || !position) {
    return null
  }

  return (
    <div
      ref={popoverRef}
      aria-label="Image card button settings"
      className="handout-editor-button-settings handout-editor-image-card-button-settings"
      role="dialog"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <FieldGroup className="gap-3">
          <Field data-invalid={error?.field === "label" || undefined}>
            <FieldLabel htmlFor="handout-editor-card-button-label">Button text</FieldLabel>
            <Input
              ref={labelInputRef}
              id="handout-editor-card-button-label"
              aria-invalid={error?.field === "label" || undefined}
              maxLength={HANDOUT_TEXT_LIMITS.sidebarLabel}
              name="label"
              placeholder="Learn more"
              size="lg"
              type="text"
              value={labelDraft}
              onChange={(event) => {
                const nextLabel = event.currentTarget.value

                setLabelDraft(nextLabel)
                setError(null)
                previewCreateDraft({ label: nextLabel.trim() || "Learn more" })
              }}
            />
            <FieldError>{error?.field === "label" ? error.message : null}</FieldError>
          </Field>
          <Field data-invalid={error?.field === "href" || undefined}>
            <FieldLabel htmlFor="handout-editor-card-button-link">Button link</FieldLabel>
            <InputGroup size="lg">
              <InputGroupAddon>
                <IconLink aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="handout-editor-card-button-link"
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
