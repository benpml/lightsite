import { Extension } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"

import type { LightsiteGifSelection } from "../giphy"

export type LightsiteNextGifPickerTarget = {
  pos: number
}

type GifPickerStorage = {
  openPicker: (target: LightsiteNextGifPickerTarget) => void
  subscribe: (listener: (target: LightsiteNextGifPickerTarget) => void) => () => void
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lightsiteNextGifPicker: {
      openLightsiteNextGifPicker: (pos?: number) => ReturnType
      setLightsiteNextGif: (pos: number, selection: LightsiteGifSelection) => ReturnType
    }
  }
}

export const LightsiteNextGifPicker = Extension.create<Record<string, never>, GifPickerStorage>({
  name: "lightsiteNextGifPicker",

  addStorage() {
    const listeners = new Set<(target: LightsiteNextGifPickerTarget) => void>()

    return {
      openPicker: (target) => {
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
      openLightsiteNextGifPicker:
        (pos) =>
        ({ state, dispatch }) => {
          const target = resolveGifTarget(state, pos)

          if (!target) {
            return false
          }

          if (dispatch) {
            dispatch(
              state.tr
                .setSelection(NodeSelection.create(state.doc, target.pos))
                .scrollIntoView()
            )
            this.storage.openPicker({ pos: target.pos })
          }

          return true
        },
      setLightsiteNextGif:
        (pos, selection) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)

          if (!node || node.type.name !== "gifBlock" || !selection.src) {
            return false
          }

          if (dispatch) {
            const tr = state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              alt: selection.alt,
              giphyId: selection.giphyId,
              height: selection.height ?? node.attrs.height,
              src: selection.src,
              title: selection.title,
              width: selection.width ?? node.attrs.width,
            })

            dispatch(
              tr
                .setSelection(NodeSelection.create(tr.doc, pos))
                .scrollIntoView()
            )
          }

          return true
        },
    }
  },
})

function resolveGifTarget(
  state: import("@tiptap/pm/state").EditorState,
  pos: number | undefined
) {
  if (typeof pos === "number") {
    const node = state.doc.nodeAt(pos)

    return node?.type.name === "gifBlock" ? { node, pos } : null
  }

  const { selection } = state

  if (selection instanceof NodeSelection && selection.node.type.name === "gifBlock") {
    return { node: selection.node, pos: selection.from }
  }

  const $position = state.doc.resolve(Math.max(0, Math.min(selection.from, state.doc.content.size)))
  const topLevelPos = $position.depth > 0 ? $position.before(1) : 0
  const topLevelNode = state.doc.nodeAt(topLevelPos)

  return topLevelNode?.type.name === "gifBlock" ? { node: topLevelNode, pos: topLevelPos } : null
}
