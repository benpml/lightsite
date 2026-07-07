import type { Editor } from "@tiptap/core"

import type { LightsiteVariableOption, LightsiteVariableValueMap } from "./schema"

export const editorNextVariableStorageKey = "lightsiteNextVariables"

export type LightsiteVariableStorage = {
  activeVariantId: string
  definitions: LightsiteVariableOption[]
  values: LightsiteVariableValueMap
}

export function getLightsiteVariableStorage(editor: Editor): LightsiteVariableStorage {
  const storage = editor.storage as unknown as Record<string, unknown>

  return storage[editorNextVariableStorageKey] as LightsiteVariableStorage
}

export function findLightsiteVariable(editor: Editor, variableId: string) {
  return getLightsiteVariableStorage(editor).definitions.find((variable) => variable.id === variableId)
}

export function getLightsiteVariableValue(editor: Editor, variableId: string) {
  const storage = getLightsiteVariableStorage(editor)
  const variable = storage.definitions.find((definition) => definition.id === variableId)
  const variantValue = storage.values[storage.activeVariantId]?.[variableId]

  return variantValue ?? variable?.defaultValue ?? ""
}

export function createLightsiteVariableId(name: string) {
  const slug = createLightsiteVariableSlug(name)
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `var-${slug || "variable"}-${suffix}`
}

export function createLightsiteVariableSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function getUniqueLightsiteVariableSlug(name: string, variables: LightsiteVariableOption[]) {
  const baseSlug = createLightsiteVariableSlug(name) || "variable"
  const existingSlugs = new Set(variables.map((variable) => variable.slug))
  let nextSlug = baseSlug
  let suffix = 2

  while (existingSlugs.has(nextSlug)) {
    nextSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return nextSlug
}

export function normalizeLightsiteVariableName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}
