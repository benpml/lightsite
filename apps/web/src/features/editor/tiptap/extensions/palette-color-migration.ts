import { Extension } from "@tiptap/core"
import { normalizeEditorHighlightColor, normalizeEditorTextColor } from "@lightsite/design-tokens"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Plugin } from "@tiptap/pm/state"

export const LightsitePaletteColorMigration = Extension.create({
  name: "lightsitePaletteColorMigration",

  onCreate({ editor }) {
    const transaction = createPaletteMigrationTransaction(editor.state)

    if (transaction) {
      editor.view.dispatch(transaction)
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          return transactions.some((transaction) => transaction.docChanged)
            ? createPaletteMigrationTransaction(newState)
            : null
        },
      }),
    ]
  },
})

export function createPaletteMigrationTransaction(state: EditorState): Transaction | null {
  const transaction = state.tr
  let changed = false

  state.doc.descendants((node, position) => {
    if (!node.isText) {
      return
    }

    for (const mark of node.marks) {
      const currentColor = mark.attrs.color
      const nextColor =
        mark.type.name === "textStyle"
          ? normalizeEditorTextColor(currentColor)
          : mark.type.name === "highlight"
            ? normalizeEditorHighlightColor(currentColor)
            : currentColor

      if (!currentColor || nextColor === currentColor) {
        continue
      }

      const from = position
      const to = position + node.nodeSize
      transaction.removeMark(from, to, mark)
      transaction.addMark(from, to, mark.type.create({ ...mark.attrs, color: nextColor }))
      changed = true
    }
  })

  return changed ? transaction.setMeta("addToHistory", false) : null
}
