import { Extension } from "@tiptap/core"
import { LIGHTSITE_COLLECTION_LIMITS, LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import { Plugin } from "@tiptap/pm/state"

export const LightsiteNextDocumentLimits = Extension.create({
  name: "lightsiteNextDocumentLimits",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged) {
            return true
          }

          return (
            transaction.doc.childCount <= LIGHTSITE_COLLECTION_LIMITS.blocksPerTab &&
            topLevelBlocksAreWithinTextLimit(transaction.doc)
          )
        },
      }),
    ]
  },
})

function topLevelBlocksAreWithinTextLimit(doc: import("@tiptap/pm/model").Node) {
  let valid = true

  doc.forEach((node) => {
    if (!valid) {
      return
    }

    if (node.textContent.length > LIGHTSITE_TEXT_LIMITS.blockText) {
      valid = false
    }
  })

  return valid
}
