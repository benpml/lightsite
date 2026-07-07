import { IconLink } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { getFormValue, normalizeButtonHref } from "../lib/button-link"
import type { LightsiteNextImageCardButtonSettingsTarget } from "../tiptap/extensions/image-card-button-settings"

type EditorNextImageCardButtonSettingsPopoverProps = {
  editor: Editor
}

type ImageCardButtonSettingsStorage = {
  subscribe: (
    listener: (target: LightsiteNextImageCardButtonSettingsTarget) => void
  ) => () => void
}

type ImageCardButtonSettingsError = {
  field: "href" | "label"
  message: string
}

export function EditorNextImageCardButtonSettingsPopover({
  editor,
}: EditorNextImageCardButtonSettingsPopoverProps) {
  const [target, setTarget] = useState<LightsiteNextImageCardButtonSettingsTarget | null>(null)
  const [labelDraft, setLabelDraft] = useState("")
  const [hrefDraft, setHrefDraft] = useState("")
  const [error, setError] = useState<ImageCardButtonSettingsError | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const open = target !== null
  const isCreateMode = target?.mode === "create"

  const reset = useCallback(() => {
    setTarget(null)
    setLabelDraft("")
    setHrefDraft("")
    setError(null)
    setPosition(null)
  }, [])

  const cancel = useCallback(() => {
    const activeTarget = target
    reset()

    if (activeTarget?.mode === "create") {
      editor.chain().focus().removeLightsiteNextImageCardButtonDraft(activeTarget.pos).run()
      return
    }

    editor.commands.focus()
  }, [editor, reset, target])

  const previewCreateDraft = useCallback(
    (attrs: { label?: string }) => {
      if (!target || target.mode !== "create") {
        return
      }

      editor.commands.previewLightsiteNextImageCardButtonDraft(target.pos, {
        includeButton: true,
        ...attrs,
      })
    },
    [editor, target]
  )

  useEffect(() => {
    const storage = (
      editor.storage as unknown as {
        lightsiteNextImageCardButtonSettings: ImageCardButtonSettingsStorage
      }
    ).lightsiteNextImageCardButtonSettings

    return storage.subscribe((nextTarget) => {
      const nextLabel = nextTarget.label || "Learn more"

      setTarget(nextTarget)
      setLabelDraft(nextLabel)
      setHrefDraft(nextTarget.href)
      setError(null)

      if (nextTarget.mode === "create") {
        editor.commands.previewLightsiteNextImageCardButtonDraft(nextTarget.pos, {
          includeButton: true,
          label: nextLabel,
        })
      }
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

      const button = node.querySelector<HTMLElement>(".lightsite-next-image-card-cta")
      const rect = (button ?? node).getBoundingClientRect()

      setPosition({
        x: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
        y: Math.min(rect.bottom + 8, window.innerHeight - 236),
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
        .setLightsiteNextImageCardButtonAttrs(target.pos, {
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
      className="lightsite-next-button-settings lightsite-next-image-card-button-settings"
      role="dialog"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <label className="lightsite-next-button-settings-label" htmlFor="lightsite-next-card-button-label">
          Button text
        </label>
        <div className="lightsite-next-button-settings-field">
          <input
            ref={labelInputRef}
            id="lightsite-next-card-button-label"
            name="label"
            placeholder="Learn more"
            type="text"
            value={labelDraft}
            onChange={(event) => {
              const nextLabel = event.currentTarget.value

              setLabelDraft(nextLabel)
              setError(null)
              previewCreateDraft({ label: nextLabel.trim() || "Learn more" })
            }}
          />
        </div>
        {error?.field === "label" ? (
          <div className="lightsite-next-button-settings-error">{error.message}</div>
        ) : null}
        <label className="lightsite-next-button-settings-label" htmlFor="lightsite-next-card-button-link">
          Button link
        </label>
        <div className="lightsite-next-button-settings-field">
          <IconLink aria-hidden="true" />
          <input
            id="lightsite-next-card-button-link"
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
