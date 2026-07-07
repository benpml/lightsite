import { Extension } from "@tiptap/core"
import { NodeRangeSelection } from "@tiptap/extension-node-range"
import { TextSelection } from "@tiptap/pm/state"

export type LightsiteNextImageCardButtonSettingsTarget = {
  href: string
  label: string
  mode: "create" | "edit"
  pos: number
}

type ImageCardButtonSettingsStorage = {
  openSettings: (target: LightsiteNextImageCardButtonSettingsTarget) => void
  subscribe: (
    listener: (target: LightsiteNextImageCardButtonSettingsTarget) => void
  ) => () => void
}

type ImageCardButtonConfig = {
  href?: string
  includeButton?: boolean
  label?: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lightsiteNextImageCardButtonSettings: {
      openLightsiteNextImageCardButtonSettings: (
        pos?: number,
        mode?: LightsiteNextImageCardButtonSettingsTarget["mode"]
      ) => ReturnType
      previewLightsiteNextImageCardButtonDraft: (
        pos: number,
        attrs: ImageCardButtonConfig
      ) => ReturnType
      removeLightsiteNextImageCardButtonDraft: (pos: number) => ReturnType
      setLightsiteNextImageCardButtonAttrs: (
        pos: number,
        attrs: ImageCardButtonConfig
      ) => ReturnType
    }
  }
}

export const LightsiteNextImageCardButtonSettings = Extension.create<
  Record<string, never>,
  ImageCardButtonSettingsStorage
>({
  name: "lightsiteNextImageCardButtonSettings",

  addStorage() {
    const listeners = new Set<(target: LightsiteNextImageCardButtonSettingsTarget) => void>()

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
      openLightsiteNextImageCardButtonSettings:
        (pos, mode) =>
        ({ state, dispatch }) => {
          const target = resolveImageCardTarget(state, pos)

          if (!target) {
            return false
          }

          const targetMode = mode ?? (target.node.attrs.includeButton ? "edit" : "create")

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
              href: typeof target.node.attrs.buttonUrl === "string" ? target.node.attrs.buttonUrl : "",
              label:
                typeof target.node.attrs.buttonLabel === "string" &&
                target.node.attrs.buttonLabel.trim()
                  ? target.node.attrs.buttonLabel
                  : "Learn more",
              mode: targetMode,
              pos: target.pos,
            })
          }

          return true
        },
      previewLightsiteNextImageCardButtonDraft:
        (pos, attrs) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "imageCard") {
            return false
          }

          if (dispatch) {
            dispatch(
              createImageCardButtonUpdateTransaction(state, pos, node, attrs).setMeta(
                "addToHistory",
                false
              )
            )
          }

          return true
        },
      removeLightsiteNextImageCardButtonDraft:
        (pos) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "imageCard") {
            return false
          }

          if (dispatch) {
            const tr = createImageCardButtonUpdateTransaction(state, pos, node, {
              includeButton: false,
            })
            dispatch(
              tr
                .setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
      setLightsiteNextImageCardButtonAttrs:
        (pos, attrs) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "imageCard") {
            return false
          }

          if (dispatch) {
            const tr = createImageCardButtonUpdateTransaction(state, pos, node, attrs)
            dispatch(
              tr
                .setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
    }
  },
})

function resolveImageCardTarget(
  state: import("@tiptap/pm/state").EditorState,
  pos: number | undefined
) {
  if (typeof pos === "number") {
    const node = state.doc.nodeAt(pos)

    return node?.type.name === "imageCard" ? { node, pos } : null
  }

  const { selection } = state
  const $position = state.doc.resolve(
    Math.max(0, Math.min(selection.from, state.doc.content.size))
  )

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.name === "imageCard") {
      return { node, pos: $position.before(depth) }
    }
  }

  const topLevelPos = $position.depth > 0 ? $position.before(1) : 0
  const topLevelNode = state.doc.nodeAt(topLevelPos)

  return topLevelNode?.type.name === "imageCard" ? { node: topLevelNode, pos: topLevelPos } : null
}

function createImageCardButtonUpdateTransaction(
  state: import("@tiptap/pm/state").EditorState,
  pos: number,
  node: import("@tiptap/pm/model").Node,
  attrs: ImageCardButtonConfig
) {
  const nextAttrs = {
    ...node.attrs,
    ...(attrs.href !== undefined ? { buttonUrl: attrs.href } : {}),
    ...(attrs.includeButton !== undefined ? { includeButton: attrs.includeButton } : {}),
    ...(attrs.label !== undefined ? { buttonLabel: attrs.label } : {}),
  }

  return state.tr.setNodeMarkup(pos, undefined, nextAttrs)
}
