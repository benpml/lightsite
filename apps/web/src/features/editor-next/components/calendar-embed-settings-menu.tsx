import { IconCalendarEvent, IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { extractIframeSrc, getEmbedUrlHost, normalizeIframeEmbedUrl } from "../lib/embed-url"
import type { LightsiteNextCalendarEmbedSettingsTarget } from "../tiptap/extensions/calendar-embed-settings"

type EditorNextCalendarEmbedSettingsMenuProps = {
  editor: Editor
}

type CalendarEmbedSettingsStorage = {
  subscribe: (listener: (target: LightsiteNextCalendarEmbedSettingsTarget) => void) => () => void
}

export function EditorNextCalendarEmbedSettingsMenu({
  editor,
}: EditorNextCalendarEmbedSettingsMenuProps) {
  const [target, setTarget] = useState<LightsiteNextCalendarEmbedSettingsTarget | null>(null)
  const [srcDraft, setSrcDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const open = target !== null
  const isCreateMode = target?.mode === "create"

  const reset = useCallback(() => {
    setTarget(null)
    setSrcDraft("")
    setError(null)
    setPosition(null)
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
        lightsiteNextCalendarEmbedSettings: CalendarEmbedSettingsStorage
      }
    ).lightsiteNextCalendarEmbedSettings

    return storage.subscribe((nextTarget) => {
      setTarget(nextTarget)
      setSrcDraft(nextTarget.src)
      setError(null)
    })
  }, [editor])

  useLayoutEffect(() => {
    if (!target) {
      return
    }

    const updatePosition = () => {
      const node = editor.view.nodeDOM(target.pos)

      if (!(node instanceof HTMLElement)) {
        return
      }

      const rect = node.getBoundingClientRect()
      setPosition({
        x: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
        y: Math.min(rect.bottom + 8, window.innerHeight - 196),
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [editor, target])

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
      className="lightsite-next-calendar-settings-menu"
      role="dialog"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label
          className="lightsite-next-button-settings-label"
          htmlFor="lightsite-next-calendar-url"
        >
          Calendar link or embed code
        </label>
        <div className="lightsite-next-button-settings-field lightsite-next-button-settings-field-textarea">
          <IconLink aria-hidden="true" />
          <textarea
            ref={inputRef}
            aria-invalid={error ? "true" : undefined}
            id="lightsite-next-calendar-url"
            inputMode="url"
            placeholder="https://cal.com/team/demo or pasted embed code"
            rows={3}
            value={srcDraft}
            onChange={(event) => {
              setSrcDraft(event.currentTarget.value)
              setError(null)
            }}
          />
        </div>
        {previewHost ? (
          <div className="lightsite-next-calendar-settings-preview">
            <IconCalendarEvent aria-hidden="true" />
            {previewHost}
          </div>
        ) : (
          <div className="lightsite-next-calendar-settings-preview">
            Paste a link or embed code. Lightsite will handle either.
          </div>
        )}
        {error ? <div className="lightsite-next-button-settings-error">{error}</div> : null}
        <div className="lightsite-next-button-settings-actions">
          <button
            className="lightsite-next-button-settings-action"
            type="button"
            onClick={() => close(true)}
          >
            Cancel
          </button>
          <button
            className="lightsite-next-button-settings-action lightsite-next-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Add" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
