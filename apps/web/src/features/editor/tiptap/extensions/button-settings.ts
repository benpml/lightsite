import { Extension } from "@tiptap/core"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"

import { findFirstTextSelectionPosition } from "./selection-utils"

export type LightsiteNextButtonSettingsTarget = {
  fullWidth: boolean
  href: string
  label: string
  mode: "create" | "edit"
  pos: number
}

type ButtonSettingsStorage = {
  openSettings: (target: LightsiteNextButtonSettingsTarget) => void
  subscribe: (listener: (target: LightsiteNextButtonSettingsTarget) => void) => () => void
}

type ButtonAttrs = {
  fullWidth?: boolean
  href?: string
}

type ButtonConfig = ButtonAttrs & {
  label?: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lightsiteNextButtonSettings: {
      openLightsiteNextButtonSettings: (
        pos?: number,
        mode?: LightsiteNextButtonSettingsTarget["mode"]
      ) => ReturnType
      previewLightsiteNextButtonDraft: (pos: number, attrs: ButtonConfig) => ReturnType
      removeLightsiteNextButtonDraft: (pos: number) => ReturnType
      setLightsiteNextButtonAttrs: (pos: number, attrs: ButtonConfig) => ReturnType
    }
  }
}

export const LightsiteNextButtonSettings = Extension.create<
  Record<string, never>,
  ButtonSettingsStorage
>({
  name: "lightsiteNextButtonSettings",

  addStorage() {
    const listeners = new Set<(target: LightsiteNextButtonSettingsTarget) => void>()

    return {
      openSettings: (target) => {
        listeners.forEach((listener) => listener(target))
      },
      subscribe: (listener) => {
        listeners.add(listener)

        return () => {
          listeners.delete(listener)
        }
      },
    }
  },

  addCommands() {
    return {
      openLightsiteNextButtonSettings:
        (pos, mode = "edit") =>
        ({ state, dispatch }) => {
          const target = resolveButtonTarget(state, pos)

          if (!target) {
            return false
          }

          if (dispatch) {
            dispatch(
              state.tr
                .setSelection(
                  NodeRangeSelection.create(
                    state.doc,
                    target.pos,
                    target.pos + target.node.nodeSize,
                    0
                  )
                )
                .scrollIntoView()
            )
            this.storage.openSettings({
              fullWidth: Boolean(target.node.attrs.fullWidth),
              href: typeof target.node.attrs.href === "string" ? target.node.attrs.href : "",
              label: target.node.textContent,
              mode,
              pos: target.pos,
            })
          }

          return true
        },
      removeLightsiteNextButtonDraft:
        (pos) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "buttonBlock") {
            return false
          }

          if (dispatch) {
            const paragraph = state.schema.nodes.paragraph?.create()
            const tr =
              state.doc.childCount <= 1 && paragraph
                ? state.tr.replaceWith(pos, pos + node.nodeSize, paragraph)
                : state.tr.delete(pos, pos + node.nodeSize)
            const selectionPos = Math.min(pos + 1, tr.doc.content.size)

            dispatch(
              tr
                .setSelection(TextSelection.near(tr.doc.resolve(selectionPos)))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
      previewLightsiteNextButtonDraft:
        (pos, attrs) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "buttonBlock") {
            return false
          }

          if (dispatch) {
            dispatch(createButtonUpdateTransaction(state, pos, node, attrs).setMeta("addToHistory", false))
          }

          return true
        },
      setLightsiteNextButtonAttrs:
        (pos, attrs) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "buttonBlock") {
            return false
          }

          if (dispatch) {
            const tr = createButtonUpdateTransaction(state, pos, node, attrs)

            const updatedNode = tr.doc.nodeAt(pos)
            const focusPosition = findFirstTextSelectionPosition(updatedNode, pos)

            dispatch(
              tr
                .setSelection(TextSelection.near(tr.doc.resolve(focusPosition)))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
    }
  },
})

function resolveButtonTarget(
  state: import("@tiptap/pm/state").EditorState,
  pos: number | undefined
) {
  if (typeof pos === "number") {
    const node = state.doc.nodeAt(pos)

    return node?.type.name === "buttonBlock" ? { node, pos } : null
  }

  const { selection } = state
  const $position = state.doc.resolve(
    Math.max(0, Math.min(selection.from, state.doc.content.size))
  )

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.name === "buttonBlock") {
      return { node, pos: $position.before(depth) }
    }
  }

  const topLevelPos = $position.depth > 0 ? $position.before(1) : 0
  const topLevelNode = state.doc.nodeAt(topLevelPos)

  return topLevelNode?.type.name === "buttonBlock" ? { node: topLevelNode, pos: topLevelPos } : null
}

function createButtonUpdateTransaction(
  state: import("@tiptap/pm/state").EditorState,
  pos: number,
  node: import("@tiptap/pm/model").Node,
  attrs: ButtonConfig
) {
  const nextAttrs = {
    ...node.attrs,
    ...attrs,
  }
  Reflect.deleteProperty(nextAttrs, "label")

  let tr = state.tr.setNodeMarkup(pos, undefined, nextAttrs)

  if (typeof attrs.label === "string") {
    const text = attrs.label.trim()

    tr = text
      ? tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(text))
      : tr.delete(pos + 1, pos + node.nodeSize - 1)
  }

  return tr
}
