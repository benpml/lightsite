import { IconLink, IconVideo } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { getVideoEmbedHost, normalizeVideoEmbedUrl } from "../lib/video-embed-url"
import type { LightsiteNextVideoEmbedSettingsTarget } from "../tiptap/extensions/video-embed-settings"

type EditorNextVideoEmbedSettingsMenuProps = {
  editor: Editor
}

type VideoEmbedSettingsStorage = {
  subscribe: (listener: (target: LightsiteNextVideoEmbedSettingsTarget) => void) => () => void
}

export function EditorNextVideoEmbedSettingsMenu({ editor }: EditorNextVideoEmbedSettingsMenuProps) {
  const [target, setTarget] = useState<LightsiteNextVideoEmbedSettingsTarget | null>(null)
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
        editor.chain().focus().removeLightsiteNextVideoEmbedDraft(activeTarget.pos).run()
        return
      }

      editor.commands.focus()
    },
    [editor, reset, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as {
        lightsiteNextVideoEmbedSettings: VideoEmbedSettingsStorage
      }
    ).lightsiteNextVideoEmbedSettings

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

      const normalized = normalizeVideoEmbedUrl(srcDraft)

      if (!normalized.ok) {
        setError(normalized.message)
        return
      }

      editor
        .chain()
        .focus()
        .setLightsiteNextVideoEmbedAttrs(target.pos, {
          provider: normalized.provider,
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

  const previewUrl = normalizeVideoEmbedUrl(srcDraft)
  const previewLabel = previewUrl.ok
    ? previewUrl.provider || getVideoEmbedHost(previewUrl.url)
    : target?.provider || getVideoEmbedHost(srcDraft)

  return (
    <div
      ref={menuRef}
      aria-label={isCreateMode ? "Add video" : "Edit video"}
      className="lightsite-next-video-settings-menu"
      role="dialog"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label className="lightsite-next-button-settings-label" htmlFor="lightsite-next-video-url">
          Video link or embed code
        </label>
        <div className="lightsite-next-button-settings-field lightsite-next-button-settings-field-textarea">
          <IconLink aria-hidden="true" />
          <textarea
            ref={inputRef}
            aria-invalid={error ? "true" : undefined}
            id="lightsite-next-video-url"
            inputMode="url"
            placeholder="YouTube, Vimeo, Loom, or pasted iframe code"
            rows={3}
            value={srcDraft}
            onChange={(event) => {
              setSrcDraft(event.currentTarget.value)
              setError(null)
            }}
          />
        </div>
        {previewLabel ? (
          <div className="lightsite-next-video-settings-preview">
            <IconVideo aria-hidden="true" />
            {previewLabel}
          </div>
        ) : (
          <div className="lightsite-next-video-settings-preview">
            Paste a video link or embed code. Lightsite will handle either.
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
