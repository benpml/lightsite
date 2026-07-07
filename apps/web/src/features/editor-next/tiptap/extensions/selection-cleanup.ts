import { Extension } from "@tiptap/core"
import { isNodeRangeSelection } from "@tiptap/extension-node-range"
import { Plugin, TextSelection } from "@tiptap/pm/state"

export const LightsiteNextSelectionCleanup = Extension.create({
  name: "lightsiteNextSelectionCleanup",

  onSelectionUpdate() {
    if (!isNodeRangeSelection(this.editor.state.selection)) {
      this.editor.view.dom.classList.remove("ProseMirror-noderangeselection", "ProseMirror-hideselection")
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (view) => {
          const handlePointerDown = (event: PointerEvent) => {
            cleanupSelection(view, event)
          }

          document.addEventListener("pointerdown", handlePointerDown, true)

          return {
            destroy: () => {
              document.removeEventListener("pointerdown", handlePointerDown, true)
            },
          }
        },
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              cleanupSelection(view, event)
              return false
            },
          },
        },
      }),
    ]
  },
})

function cleanupSelection(view: import("@tiptap/pm/view").EditorView, event: MouseEvent | PointerEvent) {
  const target = event.target
  const editorPage = view.dom.closest("[data-editor-next-page]")

  if (
    view.state.selection instanceof TextSelection ||
    !(target instanceof Element) ||
    !editorPage?.contains(target) ||
    target.closest(
      ".lightsite-next-drag-handle, .lightsite-next-block-menu, .lightsite-next-button-settings, .lightsite-next-suggestion-menu"
    ) ||
    view.dom.contains(target)
  ) {
    return
  }

  const position = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  })?.pos
  const resolvedPosition = Math.max(
    1,
    Math.min(position ?? view.state.doc.content.size, view.state.doc.content.size)
  )

  view.dispatch(
    view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(resolvedPosition), -1))
  )
}
