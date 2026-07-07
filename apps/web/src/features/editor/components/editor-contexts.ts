import { createContext, useContext } from "react"

import type { VariablePickerState } from "./editor-command-overlays"

export const EditorVariablePickerContext = createContext<{
  openVariablePicker: (request: NonNullable<VariablePickerState>) => void
} | null>(null)

export const EditorGifPickerContext = createContext<{
  openGifPicker: (nodePos: number) => void
} | null>(null)

export const EditorPreviewTextContext = createContext<{
  preview: boolean
  resolveText: (value: string) => string
}>({
  preview: false,
  resolveText: (value) => value,
})

export function useEditorVariablePicker() {
  const value = useContext(EditorVariablePickerContext)

  if (!value) {
    throw new Error("Editor variable picker context is unavailable.")
  }

  return value
}

export function useEditorPreviewText() {
  return useContext(EditorPreviewTextContext)
}

export function useEditorGifPicker() {
  const value = useContext(EditorGifPickerContext)

  if (!value) {
    throw new Error("Editor GIF picker context is unavailable.")
  }

  return value
}
