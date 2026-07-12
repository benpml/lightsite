import { IconBraces } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type { LightsiteNextVariableCreatorTarget } from "../tiptap/extensions/suggestion-menu"
import { useFloatingEditorPopoverPosition } from "./use-floating-editor-popover-position"

type EditorVariableCreatePopoverProps = {
  editor: Editor
}

type VariableStorage = {
  subscribeCreator: (listener: (target: LightsiteNextVariableCreatorTarget) => void) => () => void
}

export function EditorVariableCreatePopover({
  editor,
}: EditorVariableCreatePopoverProps) {
  const [target, setTarget] = useState<LightsiteNextVariableCreatorTarget | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [defaultValueDraft, setDefaultValueDraft] = useState("")
  const [error, setError] = useState("")
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const nameId = useId()
  const descriptionId = useId()
  const defaultValueId = useId()
  const open = target !== null

  const reset = useCallback(() => {
    setTarget(null)
    setNameDraft("")
    setDescriptionDraft("")
    setDefaultValueDraft("")
    setError("")
  }, [])

  useEffect(() => {
    const storage = (
      editor.storage as unknown as { lightsiteNextVariables?: VariableStorage }
    ).lightsiteNextVariables

    if (!storage) {
      return
    }

    return storage.subscribeCreator((nextTarget) => {
      setTarget(nextTarget)
      setNameDraft(nextTarget.name)
      setDescriptionDraft("")
      setDefaultValueDraft("")
      setError("")
    })
  }, [editor])

  const getAnchorRect = useCallback(() => {
    if (!target) {
      return null
    }

    const coords = editor.view.coordsAtPos(target.range.from)

    return DOMRect.fromRect({
      height: coords.bottom - coords.top,
      width: coords.right - coords.left,
      x: coords.left,
      y: coords.top,
    })
  }, [editor, target])
  const position = useFloatingEditorPopoverPosition({
    fallbackHeight: 420,
    fallbackWidth: 416,
    floatingRef: popoverRef,
    getAnchorRect,
    open,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const focusId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) {
        return
      }

      reset()
      editor.commands.focus(undefined, { scrollIntoView: false })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        reset()
        editor.commands.focus(undefined, { scrollIntoView: false })
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusId)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [editor, open, reset])

  const save = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!target) {
        return
      }

      const name = nameDraft.trim().replace(/\s+/g, " ")

      if (!name) {
        setError("Name the variable.")
        return
      }

      editor
        .chain()
        .focus()
        .createAndInsertLightsiteVariable(target.range, {
          defaultValue: defaultValueDraft,
          description: descriptionDraft,
          name,
        })
        .run()
      reset()
    },
    [defaultValueDraft, descriptionDraft, editor, nameDraft, reset, target]
  )

  if (!open || !position) {
    return null
  }

  return (
    <div
      ref={popoverRef}
      className="lightsite-editor-variable-create"
      role="dialog"
      aria-label="Create variable"
      style={{ left: position.x, maxHeight: position.maxHeight, top: position.y }}
      onWheel={(event) => event.stopPropagation()}
    >
      <form className="grid gap-3" onSubmit={save}>
        <div className="lightsite-editor-variable-create-header">
          <IconBraces aria-hidden />
          <span>New variable</span>
        </div>
        <p className="lightsite-editor-variable-create-description">
          Create a variable to insert custom content for each recipient.
        </p>
        <div className="lightsite-editor-variable-field">
          <label htmlFor={nameId}>Name</label>
          <Input
            id={nameId}
            ref={nameInputRef}
            className="lightsite-editor-variable-control"
            maxLength={LIGHTSITE_TEXT_LIMITS.variableName}
            placeholder="Enter a variable name..."
            value={nameDraft}
            onChange={(event) => {
              setNameDraft(event.target.value)
              setError("")
            }}
            onClick={(event) => event.currentTarget.focus()}
          />
          {error ? <span className="lightsite-editor-variable-create-error">{error}</span> : null}
        </div>
        <div className="lightsite-editor-variable-field">
          <label htmlFor={descriptionId}>Description</label>
          <Textarea
            id={descriptionId}
            className="lightsite-editor-variable-control min-h-18 resize-none"
            maxLength={LIGHTSITE_TEXT_LIMITS.variableDescription}
            placeholder="Optional. Useful for AI and teammates."
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onClick={(event) => event.currentTarget.focus()}
          />
        </div>
        <div className="lightsite-editor-variable-field">
          <label htmlFor={defaultValueId}>Default value</label>
          <Textarea
            id={defaultValueId}
            className="lightsite-editor-variable-control min-h-18 resize-none"
            maxLength={LIGHTSITE_TEXT_LIMITS.variableDefaultValue}
            placeholder="Optional fallback"
            value={defaultValueDraft}
            onChange={(event) => setDefaultValueDraft(event.target.value)}
            onClick={(event) => event.currentTarget.focus()}
          />
        </div>
        <div className="lightsite-editor-variable-popover-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="lightsite-editor-variable-cancel"
            onClick={reset}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Create
          </Button>
        </div>
      </form>
    </div>
  )
}
