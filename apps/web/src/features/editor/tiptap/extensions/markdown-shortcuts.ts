import { Extension } from "@tiptap/core"
import { Plugin, TextSelection } from "@tiptap/pm/state"

export const LightsiteNextMarkdownShortcuts = Extension.create({
  name: "lightsiteNextMarkdownShortcuts",
  priority: 1100,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          return repairBundledListShortcut(newState)
        },
        props: {
          handleTextInput: (view, from, to, text) => {
            const shortcutText = text.replace(/\u00a0/g, " ")

            if (shortcutText !== " " && shortcutText !== "- " && shortcutText !== "1. ") {
              return false
            }

            const { state } = view

            if (from !== to || !state.selection.empty) {
              return false
            }

            const target = getListShortcutTarget(
              state,
              shortcutText === " " ? undefined : shortcutText.trim()
            )

            if (!target) {
              return false
            }

            const list = target.listType.create(
              target.listAttrs,
              target.listItemType.create(null, target.paragraphType.create())
            )
            const tr = state.tr.replaceWith(target.from, target.to, list)
            const selectionPos = getListTextSelectionPosition(target.from)

            view.dispatch(
              tr
                .setSelection(TextSelection.near(tr.doc.resolve(selectionPos)))
                .scrollIntoView()
            )
            view.focus()

            return true
          },
        },
      }),
    ]
  },
})

function repairBundledListShortcut(state: import("@tiptap/pm/state").EditorState) {
  const { doc, schema } = state
  let pos = 0

  for (let index = 0; index < doc.childCount - 1; index += 1) {
    const node = doc.child(index)
    const nextNode = doc.child(index + 1)
    const repairedText = getBundledShortcutText(node, nextNode)

    if (repairedText === null || repairedText.length === 0) {
      pos += node.nodeSize
      continue
    }

    const paragraphType = schema.nodes.paragraph
    const listItemType = schema.nodes.listItem

    if (!paragraphType || !listItemType) {
      return null
    }

    const paragraph = paragraphType.create(null, schema.text(repairedText))
    const listItem = listItemType.create(null, paragraph)
    const replacementList = node.type.create(node.attrs, listItem)
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize + nextNode.nodeSize, replacementList)
    const selectionPos = getListTextSelectionPosition(pos, repairedText.length)

    return tr
      .setSelection(TextSelection.create(tr.doc, selectionPos))
      .scrollIntoView()
  }

  return null
}

function getListTextSelectionPosition(listPosition: number, textOffset = 0) {
  return listPosition + 3 + textOffset
}

function getBundledShortcutText(
  node: import("@tiptap/pm/model").Node,
  nextNode: import("@tiptap/pm/model").Node
) {
  if (
    (node.type.name !== "bulletList" && node.type.name !== "orderedList") ||
    node.childCount !== 1 ||
    nextNode.type.name !== "paragraph"
  ) {
    return null
  }

  const firstItem = node.firstChild

  if (!firstItem || firstItem.textContent.trim().length > 0) {
    return null
  }

  const nextText = nextNode.textContent

  if (!/^[\s\u00a0]+\S/.test(nextText)) {
    return null
  }

  return nextText.replace(/^[\s\u00a0]+/, "")
}

function getListShortcutTarget(
  state: import("@tiptap/pm/state").EditorState,
  explicitText?: string
) {
  const { selection, schema } = state
  const { $from } = selection
  const parent = $from.parent

  if (parent.type.name !== "paragraph" || $from.parentOffset !== parent.content.size) {
    return null
  }

  const text = explicitText ?? parent.textContent
  const paragraphType = schema.nodes.paragraph
  const listItemType = schema.nodes.listItem

  if (!paragraphType || !listItemType) {
    return null
  }

  if (text === "-") {
    const listType = schema.nodes.bulletList

    if (!listType) {
      return null
    }

    return {
      from: $from.before(),
      listAttrs: null,
      listItemType,
      listType,
      paragraphType,
      to: $from.after(),
    }
  }

  if (text === "1.") {
    const listType = schema.nodes.orderedList

    if (!listType) {
      return null
    }

    return {
      from: $from.before(),
      listAttrs: { start: 1 },
      listItemType,
      listType,
      paragraphType,
      to: $from.after(),
    }
  }

  return null
}
