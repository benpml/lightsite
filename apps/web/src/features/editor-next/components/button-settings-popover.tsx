import { IconArrowsHorizontal, IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"

import { getFormValue, normalizeButtonHref } from "../lib/button-link"
import type { LightsiteNextButtonSettingsTarget } from "../tiptap/extensions/button-settings"

type EditorNextButtonSettingsPopoverProps = {
  editor: Editor
}

type ButtonSettingsStorage = {
  subscribe: (listener: (target: LightsiteNextButtonSettingsTarget) => void) => () => void
}

type ButtonSettingsError = {
  field: "href" | "label"
  message: string
}

export function EditorNextButtonSettingsPopover({ editor }: EditorNextButtonSettingsPopoverProps) {
  const [target, setTarget] = useState<LightsiteNextButtonSettingsTarget | null>(null)
  const [labelDraft, setLabelDraft] = useState("")
  const [hrefDraft, setHrefDraft] = useState("")
  const [fullWidthDraft, setFullWidthDraft] = useState(false)
  const [error, setError] = useState<ButtonSettingsError | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
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
    setPosition(null)
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
      editor.storage as unknown as { lightsiteNextButtonSettings: ButtonSettingsStorage }
    ).lightsiteNextButtonSettings

    return storage.subscribe((nextTarget) => {
      setTarget(nextTarget)
      setLabelDraft(nextTarget.label || "Button")
      setHrefDraft(nextTarget.href)
      setFullWidthDraft(nextTarget.fullWidth)
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
        y: Math.min(rect.bottom + 8, window.innerHeight - 292),
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
        setError({ field: "href", message: "Enter a valid link." })
        return
      }

      if (normalized === null) {
        setError({ field: "href", message: "Enter a valid URL, email, phone, or page path." })
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
      className="lightsite-next-button-settings"
      role="dialog"
      style={{ left: position.x, top: position.y }}
      aria-label="Button settings"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label className="lightsite-next-button-settings-label" htmlFor="lightsite-next-button-label">
          Button text
        </label>
        <div className="lightsite-next-button-settings-field">
          <input
            ref={labelInputRef}
            id="lightsite-next-button-label"
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
          <div className="lightsite-next-button-settings-error">{error.message}</div>
        ) : null}
        <label className="lightsite-next-button-settings-label" htmlFor="lightsite-next-button-link">
          Button link
        </label>
        <div className="lightsite-next-button-settings-field">
          <IconLink aria-hidden="true" />
          <input
            id="lightsite-next-button-link"
            inputMode="url"
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
          <div className="lightsite-next-button-settings-error">{error.message}</div>
        ) : null}
        <button
          className="lightsite-next-button-settings-toggle"
          type="button"
          aria-pressed={fullWidthDraft}
          onClick={() => {
            const nextFullWidth = !fullWidthDraft

            setFullWidthDraft(nextFullWidth)
            previewButtonDraft({ fullWidth: nextFullWidth })
          }}
        >
          <IconArrowsHorizontal aria-hidden="true" />
          <span className="lightsite-next-button-settings-toggle-copy">
            <span>Fill width</span>
            <span>Stretch the button to the block width</span>
          </span>
          <span
            className={cn(
              "lightsite-next-button-settings-switch",
              fullWidthDraft && "lightsite-next-button-settings-switch-on"
            )}
            aria-hidden="true"
          />
        </button>
        <div className="lightsite-next-button-settings-actions">
          <button className="lightsite-next-button-settings-action" type="button" onClick={cancel}>
            Cancel
          </button>
          <button
            className="lightsite-next-button-settings-action lightsite-next-button-settings-action-primary"
            type="submit"
          >
            {isCreateMode ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
