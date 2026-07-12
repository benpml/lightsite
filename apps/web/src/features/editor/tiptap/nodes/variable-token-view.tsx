import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import { IconBraces, IconTrash } from "@tabler/icons-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { findLightsiteVariable } from "../variable-state"

type VariableDraft = {
  defaultValue: string
  description: string
  name: string
}

export function VariableTokenView({ deleteNode, editor, node }: NodeViewProps) {
  const variableId = String(node.attrs.variableId || "")
  const fallbackName = String(node.attrs.fallbackName || "Variable")
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [, setVersion] = useState(0)
  const nameId = useId()
  const defaultValueId = useId()
  const descriptionId = useId()

  const variable = findLightsiteVariable(editor, variableId)
  const [draft, setDraft] = useState<VariableDraft>(() =>
    createDraft(variable?.name ?? fallbackName, variable?.description, variable?.defaultValue)
  )

  useEffect(() => {
    const handleTransaction = () => setVersion((currentVersion) => currentVersion + 1)

    editor.on("transaction", handleTransaction)
    return () => {
      editor.off("transaction", handleTransaction)
    }
  }, [editor])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        return
      }

      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        editor.commands.focus(undefined, { scrollIntoView: false })
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [editor, open])

  const save = useCallback(() => {
    const name = draft.name.trim()

    if (!variable || !name) {
      return
    }

    editor.commands.setLightsiteVariableDefinition(variable.id, {
      defaultValue: draft.defaultValue,
      description: draft.description,
      name,
    })
    setOpen(false)
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [draft, editor, variable])

  const removeReference = useCallback(() => {
    setOpen(false)
    deleteNode()
    editor.commands.focus(undefined, { scrollIntoView: false })
  }, [deleteNode, editor])

  const openPopover = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDraft(
      createDraft(
        variable?.name ?? fallbackName,
        variable?.description,
        variable?.defaultValue
      )
    )
    setOpen(true)
  }, [fallbackName, variable])

  const updateDraft = useCallback((field: keyof VariableDraft, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }, [])

  const displayName = variable?.name ?? fallbackName
  const chipText = `{${displayName}}`

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      className="lightsite-editor-variable-wrapper"
      contentEditable={false}
      data-lightsite-variable-wrapper=""
    >
      <button
        className="lightsite-editor-variable-token"
        data-missing={variable ? "false" : "true"}
        type="button"
        onClick={openPopover}
        onMouseDown={(event) => event.preventDefault()}
      >
        <span>{chipText}</span>
      </button>
      {open ? (
        <span
          className="lightsite-editor-variable-popover"
          role="dialog"
          aria-label={`${displayName} variable`}
          onMouseDown={(event) => {
            event.stopPropagation()
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {variable ? (
            <>
              <span className="lightsite-editor-variable-popover-header">
                <span className="lightsite-editor-variable-popover-title">
                  <IconBraces aria-hidden />
                  Edit variable
                </span>
                <button
                  className="lightsite-editor-variable-popover-delete"
                  type="button"
                  onClick={removeReference}
                >
                  <IconTrash aria-hidden />
                  Remove
                </button>
              </span>
              <VariableField id={nameId} label="Name">
                <Input
                  id={nameId}
                  className="lightsite-editor-variable-control"
                  maxLength={LIGHTSITE_TEXT_LIMITS.variableName}
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  onClick={(event) => event.currentTarget.focus()}
                />
              </VariableField>
              <VariableField id={defaultValueId} label="Default value">
                <Input
                  id={defaultValueId}
                  className="lightsite-editor-variable-control"
                  maxLength={LIGHTSITE_TEXT_LIMITS.variableDefaultValue}
                  placeholder="Optional fallback for preview/share"
                  value={draft.defaultValue}
                  onChange={(event) => updateDraft("defaultValue", event.target.value)}
                  onClick={(event) => event.currentTarget.focus()}
                />
              </VariableField>
              <VariableField id={descriptionId} label="Description">
                <Textarea
                  id={descriptionId}
                  className="lightsite-editor-variable-control min-h-20 resize-none"
                  maxLength={LIGHTSITE_TEXT_LIMITS.variableDescription}
                  placeholder="Helps AI and teammates understand what should go here."
                  value={draft.description}
                  onChange={(event) => updateDraft("description", event.target.value)}
                  onClick={(event) => event.currentTarget.focus()}
                />
              </VariableField>
              <span className="lightsite-editor-variable-popover-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="lightsite-editor-variable-cancel"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!draft.name.trim()} onClick={save}>
                  Save
                </Button>
              </span>
            </>
          ) : (
            <>
              <span className="lightsite-editor-variable-popover-title">Missing variable</span>
              <span className="lightsite-editor-variable-popover-note">
                This placeholder no longer has a variable definition.
              </span>
              <span className="lightsite-editor-variable-popover-actions">
                <Button type="button" variant="outline" size="sm" onClick={removeReference}>
                  Remove reference
                </Button>
              </span>
            </>
          )}
        </span>
      ) : null}
    </NodeViewWrapper>
  )
}

function VariableField({
  children,
  id,
  label,
}: {
  children: React.ReactNode
  id: string
  label: string
}) {
  return (
    <div className="lightsite-editor-variable-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

function createDraft(
  name: string,
  description: string | undefined,
  defaultValue: string | undefined
): VariableDraft {
  return {
    defaultValue: defaultValue ?? "",
    description: description ?? "",
    name,
  }
}
