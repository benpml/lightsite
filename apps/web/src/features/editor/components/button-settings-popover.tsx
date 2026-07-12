import { IconArrowsHorizontal, IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"

import { getFormValue, normalizeButtonHref } from "../lib/button-link"
import type { LightsiteNextButtonSettingsTarget } from "../tiptap/extensions/button-settings"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorButtonSettingsPopoverProps = {
  editor: Editor
}

type ButtonSettingsStorage = {
  subscribe: (listener: (target: LightsiteNextButtonSettingsTarget) => void) => () => void
}

type ButtonSettingsError = {
  field: "href" | "label"
  message: string
}

export function EditorButtonSettingsPopover({ editor }: EditorButtonSettingsPopoverProps) {
  const [target, setTarget] = useState<LightsiteNextButtonSettingsTarget | null>(null)
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
      editor.chain().focus().removeLightsiteNextButtonDraft(activeTarget.pos).run()
      return
    }

    if (activeTarget) {
      editor
        .chain()
        .focus()
        .previewLightsiteNextButtonDraft(activeTarget.pos, {
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

      editor.commands.previewLightsiteNextButtonDraft(target.pos, attrs)
    },
    [editor, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as { lightsiteNextButtonSettings?: ButtonSettingsStorage }
    ).lightsiteNextButtonSettings

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
        .setLightsiteNextButtonAttrs(target.pos, {
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
      className="lightsite-editor-button-settings"
      role="dialog"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      aria-label="Button settings"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label className="lightsite-editor-button-settings-label" htmlFor="lightsite-editor-button-label">
          Button text
        </label>
        <div className="lightsite-editor-button-settings-field">
          <input
            ref={labelInputRef}
            id="lightsite-editor-button-label"
            maxLength={LIGHTSITE_TEXT_LIMITS.sidebarLabel}
            name="label"
            placeholder="Button"
            type="text"
            value={labelDraft}
            onChange={(event) => {
              const nextLabel = event.currentTarget.value

              setLabelDraft(nextLabel)
              setError(null)
              previewButtonDraft({ label: nextLabel.trim() || "Button" })
            }}
          />
        </div>
        {error?.field === "label" ? (
          <div className="lightsite-editor-button-settings-error">{error.message}</div>
        ) : null}
        <label className="lightsite-editor-button-settings-label" htmlFor="lightsite-editor-button-link">
          Button link
        </label>
        <div className="lightsite-editor-button-settings-field">
          <IconLink aria-hidden="true" />
          <input
            id="lightsite-editor-button-link"
            inputMode="url"
            maxLength={LIGHTSITE_TEXT_LIMITS.url}
            name="href"
            placeholder="https://example.com"
            type="text"
            value={hrefDraft}
            onChange={(event) => {
              setHrefDraft(event.currentTarget.value)
              setError(null)
            }}
          />
        </div>
        {error?.field === "href" ? (
          <div className="lightsite-editor-button-settings-error">{error.message}</div>
        ) : null}
        <button
          className="lightsite-editor-button-settings-toggle"
          type="button"
          aria-pressed={fullWidthDraft}
          onClick={() => {
            const nextFullWidth = !fullWidthDraft

            setFullWidthDraft(nextFullWidth)
            previewButtonDraft({ fullWidth: nextFullWidth })
          }}
        >
          <IconArrowsHorizontal aria-hidden="true" />
          <span className="lightsite-editor-button-settings-toggle-copy">
            <span>Fill width</span>
            <span>Stretch the button to the block width</span>
          </span>
          <span
            className={cn(
              "lightsite-editor-button-settings-switch",
              fullWidthDraft && "lightsite-editor-button-settings-switch-on"
            )}
            aria-hidden="true"
          />
        </button>
        <div className="lightsite-editor-button-settings-actions">
          <button className="lightsite-editor-button-settings-action" type="button" onClick={cancel}>
            Cancel
          </button>
          <button
            className="lightsite-editor-button-settings-action lightsite-editor-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
