import { IconLink, IconVideo } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group"

import { getVideoEmbedHost, normalizeVideoEmbedUrl } from "../lib/video-embed-url"
import type { HandoutNextVideoEmbedSettingsTarget } from "../tiptap/extensions/video-embed-settings"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorVideoEmbedSettingsMenuProps = {
  editor: Editor
}

type VideoEmbedSettingsStorage = {
  subscribe: (listener: (target: HandoutNextVideoEmbedSettingsTarget) => void) => () => void
}

export function EditorVideoEmbedSettingsMenu({ editor }: EditorVideoEmbedSettingsMenuProps) {
  const [target, setTarget] = useState<HandoutNextVideoEmbedSettingsTarget | null>(null)
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
        editor.chain().focus().removeHandoutNextVideoEmbedDraft(activeTarget.pos).run()
        return
      }

      editor.commands.focus()
    },
    [editor, reset, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as {
        handoutNextVideoEmbedSettings?: VideoEmbedSettingsStorage
      }
    ).handoutNextVideoEmbedSettings

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

      const normalized = normalizeVideoEmbedUrl(srcDraft)

      if (!normalized.ok) {
        setError(normalized.message)
        return
      }

      editor
        .chain()
        .focus()
        .setHandoutNextVideoEmbedAttrs(target.pos, {
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
      className="handout-editor-video-settings-menu"
      role="dialog"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="handout-editor-video-url">Video link or embed code</FieldLabel>
          <InputGroup>
            <InputGroupAddon className="self-start">
              <IconLink aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupTextarea
              ref={inputRef}
              aria-invalid={!!error || undefined}
              id="handout-editor-video-url"
              inputMode="url"
              maxLength={HANDOUT_TEXT_LIMITS.embedCode}
              placeholder="Paste link or embed code"
              rows={3}
              value={srcDraft}
              onChange={(event) => {
                setSrcDraft(event.currentTarget.value)
                setError(null)
              }}
            />
          </InputGroup>
          {previewLabel ? (
            <div className="handout-editor-video-settings-preview">
              <IconVideo aria-hidden="true" />
              {previewLabel}
            </div>
          ) : (
            <div className="handout-editor-video-settings-preview">
              Paste a video link or embed code. Handout will handle either.
            </div>
          )}
          <FieldError>{error}</FieldError>
        </Field>
        <div className="handout-editor-button-settings-actions">
          <button
            className="handout-editor-button-settings-action"
            type="button"
            onClick={() => close(true)}
          >
            Cancel
          </button>
          <button
            className="handout-editor-button-settings-action handout-editor-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Add" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
