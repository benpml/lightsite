import { IconCalendarEvent, IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { extractIframeSrc, getEmbedUrlHost, normalizeIframeEmbedUrl } from "../lib/embed-url"
import type { LightsiteNextCalendarEmbedSettingsTarget } from "../tiptap/extensions/calendar-embed-settings"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorCalendarEmbedSettingsMenuProps = {
  editor: Editor
}

type CalendarEmbedSettingsStorage = {
  subscribe: (listener: (target: LightsiteNextCalendarEmbedSettingsTarget) => void) => () => void
}

export function EditorCalendarEmbedSettingsMenu({
  editor,
}: EditorCalendarEmbedSettingsMenuProps) {
  const [target, setTarget] = useState<LightsiteNextCalendarEmbedSettingsTarget | null>(null)
  const [srcDraft, setSrcDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const open = target !== null
  const isCreateMode = target?.mode === "create"

  const reset = useCallback(() => {
    setTarget(null)
    setSrcDraft("")
    setError(null)
  }, [])

  const close = useCallback(
    (removeDraft: boolean) => {
      const activeTarget = target
      reset()

      if (removeDraft && activeTarget?.mode === "create") {
        editor.chain().focus().removeLightsiteNextCalendarEmbedDraft(activeTarget.pos).run()
        return
      }

      editor.commands.focus()
    },
    [editor, reset, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as {
        lightsiteNextCalendarEmbedSettings?: CalendarEmbedSettingsStorage
      }
    ).lightsiteNextCalendarEmbedSettings

    if (!storage) {
      return
    }

    return storage.subscribe((nextTarget) => {
      setTarget(nextTarget)
      setSrcDraft(nextTarget.src)
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
    fallbackHeight: 360,
    fallbackWidth: 320,
    floatingRef: menuRef,
    getAnchorRect,
    open,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const focusId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return
      }

      const node = target ? editor.view.nodeDOM(target.pos) : null

      if (event.target instanceof Node && node instanceof HTMLElement && node.contains(event.target)) {
        return
      }

      close(true)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(true)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusId)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [close, editor, open, target])

  const save = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()

      if (!target) {
        return
      }

      const normalized = normalizeIframeEmbedUrl(srcDraft)

      if (!normalized.ok) {
        setError(normalized.message)
        return
      }

      editor
        .chain()
        .focus()
        .setLightsiteNextCalendarEmbedAttrs(target.pos, {
          src: normalized.url,
        })
        .run()
      reset()
    },
    [editor, reset, srcDraft, target]
  )

  if (!open || !position) {
    return null
  }

  const previewUrl = normalizeIframeEmbedUrl(srcDraft)
  const previewHost = previewUrl.ok ? getEmbedUrlHost(previewUrl.url) : getEmbedUrlHost(extractIframeSrc(srcDraft))

  return (
    <div
      ref={menuRef}
      aria-label={isCreateMode ? "Add calendar" : "Edit calendar"}
      className="lightsite-editor-calendar-settings-menu"
      role="dialog"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label
          className="lightsite-editor-button-settings-label"
          htmlFor="lightsite-editor-calendar-url"
        >
          Calendar link or embed code
        </label>
        <div className="lightsite-editor-button-settings-field lightsite-editor-button-settings-field-textarea">
          <IconLink aria-hidden="true" />
          <textarea
            ref={inputRef}
            aria-invalid={error ? "true" : undefined}
            id="lightsite-editor-calendar-url"
            inputMode="url"
            maxLength={LIGHTSITE_TEXT_LIMITS.embedCode}
            placeholder="Paste link or embed code"
            rows={3}
            value={srcDraft}
            onChange={(event) => {
              setSrcDraft(event.currentTarget.value)
              setError(null)
            }}
          />
        </div>
        {previewHost ? (
          <div className="lightsite-editor-calendar-settings-preview">
            <IconCalendarEvent aria-hidden="true" />
            {previewHost}
          </div>
        ) : (
          <div className="lightsite-editor-calendar-settings-preview">
            Paste a link or embed code. Lightsite will handle either.
          </div>
        )}
        {error ? <div className="lightsite-editor-button-settings-error">{error}</div> : null}
        <div className="lightsite-editor-button-settings-actions">
          <button
            className="lightsite-editor-button-settings-action"
            type="button"
            onClick={() => close(true)}
          >
            Cancel
          </button>
          <button
            className="lightsite-editor-button-settings-action lightsite-editor-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Add" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
