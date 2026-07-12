import { Extension } from "@tiptap/core"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

export type LightsiteNextVideoEmbedSettingsTarget = {
  mode: "create" | "edit"
  pos: number
  provider: string
  src: string
}

type VideoEmbedSettingsStorage = {
  openSettings: (target: LightsiteNextVideoEmbedSettingsTarget) => void
  subscribe: (listener: (target: LightsiteNextVideoEmbedSettingsTarget) => void) => () => void
}

type VideoEmbedAttrs = {
  provider?: string
  src?: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lightsiteNextVideoEmbedSettings: {
      openLightsiteNextVideoEmbedSettings: (
        pos?: number,
        mode?: LightsiteNextVideoEmbedSettingsTarget["mode"]
      ) => ReturnType
      removeLightsiteNextVideoEmbedDraft: (pos: number) => ReturnType
      setLightsiteNextVideoEmbedAttrs: (pos: number, attrs: VideoEmbedAttrs) => ReturnType
    }
  }
}

export const LightsiteNextVideoEmbedSettings = Extension.create<
  Record<string, never>,
  VideoEmbedSettingsStorage
>({
  name: "lightsiteNextVideoEmbedSettings",

  addStorage() {
    const listeners = new Set<(target: LightsiteNextVideoEmbedSettingsTarget) => void>()

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
      openLightsiteNextVideoEmbedSettings:
        (pos, mode = "edit") =>
        ({ state, dispatch }) => {
          const target = resolveVideoEmbedTarget(state, pos)

          if (!target) {
            return false
          }

          if (dispatch) {
            dispatch(
              state.tr
                .setSelection(NodeSelection.create(state.doc, target.pos))
                .scrollIntoView()
            )
            this.storage.openSettings({
              mode,
              pos: target.pos,
              provider:
                typeof target.node.attrs.provider === "string" ? target.node.attrs.provider : "",
              src: typeof target.node.attrs.src === "string" ? target.node.attrs.src : "",
            })
          }

          return true
        },
      removeLightsiteNextVideoEmbedDraft:
        (pos) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "videoEmbed") {
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
      setLightsiteNextVideoEmbedAttrs:
        (pos, attrs) =>
        ({ state, dispatch, view }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "videoEmbed") {
            return false
          }

          if (dispatch) {
            const tr = state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              ...attrs,
            })

            dispatch(
              tr
                .setSelection(NodeSelection.create(tr.doc, pos))
                .scrollIntoView()
            )
            view.focus()
          }

          return true
        },
    }
  },
})

function resolveVideoEmbedTarget(
  state: import("@tiptap/pm/state").EditorState,
  pos: number | undefined
) {
  if (typeof pos === "number") {
    const node = state.doc.nodeAt(pos)

    return node?.type.name === "videoEmbed" ? { node, pos } : null
  }

  const { selection } = state

  if (selection instanceof NodeSelection && selection.node.type.name === "videoEmbed") {
    return { node: selection.node, pos: selection.from }
  }

  const $position = state.doc.resolve(Math.max(0, Math.min(selection.from, state.doc.content.size)))

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.name === "videoEmbed") {
      return { node, pos: $position.before(depth) }
    }
  }

  const topLevelPos = $position.depth > 0 ? $position.before(1) : 0
  const topLevelNode = state.doc.nodeAt(topLevelPos)

  if (topLevelNode?.type.name === "videoEmbed") {
    return { node: topLevelNode, pos: topLevelPos }
  }

  let previousVideoEmbed: { node: import("@tiptap/pm/model").Node; pos: number } | null = null

  state.doc.nodesBetween(0, Math.max(0, Math.min(selection.from, state.doc.content.size)), (node, nodePos) => {
    if (node.type.name === "videoEmbed") {
      previousVideoEmbed = { node, pos: nodePos }
    }

    return true
  })

  return previousVideoEmbed
}
