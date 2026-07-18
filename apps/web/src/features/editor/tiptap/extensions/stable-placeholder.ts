import { Extension, isNodeEmpty, type Editor } from "@tiptap/core"
import type { PlaceholderOptions } from "@tiptap/extension-placeholder"
import type { Node } from "@tiptap/pm/model"
import { Plugin, type Selection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

function prepareDataAttribute(value: string) {
  const prepared = value
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/^[0-9-]+/, "")
    .replace(/^-+/, "")
    .toLowerCase()

  return `data-${prepared || "placeholder"}`
}

function resolveEmptyNodeClass(
  option: PlaceholderOptions["emptyNodeClass"],
  props: Parameters<Exclude<PlaceholderOptions["emptyNodeClass"], string>>[0],
) {
  return typeof option === "function" ? option(props) : option
}

export function buildStablePlaceholderDecorations({
  doc,
  editor,
  options,
  selection,
}: {
  doc: Node
  editor: Editor
  options: PlaceholderOptions
  selection: Selection
}) {
  if (!editor.isEditable && options.showOnlyWhenEditable) {
    return null
  }

  const decorations: Decoration[] = []
  const { anchor } = selection
  const dataAttribute = prepareDataAttribute(options.dataAttribute)

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (!node.type.isTextblock) {
      return options.includeChildren
    }

    const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize
    if ((hasAnchor || !options.showOnlyCurrent) && isNodeEmpty(node)) {
      const emptyNodeClass = resolveEmptyNodeClass(options.emptyNodeClass, {
        editor,
        hasAnchor,
        node,
        pos,
      })
      const classes = [emptyNodeClass]

      if (editor.isEmpty) {
        classes.push(options.emptyEditorClass)
      }

      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: classes.join(" "),
          [dataAttribute]:
            typeof options.placeholder === "function"
              ? options.placeholder({ editor, hasAnchor, node, pos })
              : options.placeholder,
        }),
      )
    }

    return options.includeChildren
  })

  return DecorationSet.create(doc, decorations)
}

/**
 * Tiptap's placeholder extension limits decorations to a scroll-derived
 * viewport range. That range is unreliable for nested card content rendered
 * beside media, so visible fields can lose their placeholders while scrolling.
 * Keep placeholder ownership in ProseMirror, but decorate the whole document.
 */
export const StablePlaceholder = Extension.create<PlaceholderOptions>({
  name: "placeholder",

  addOptions() {
    return {
      dataAttribute: "placeholder",
      emptyEditorClass: "is-editor-empty",
      emptyNodeClass: "is-empty",
      includeChildren: false,
      placeholder: "Write something …",
      showOnlyCurrent: true,
      showOnlyWhenEditable: true,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: ({ doc, selection }) =>
            buildStablePlaceholderDecorations({
              doc,
              editor: this.editor,
              options: this.options,
              selection,
            }),
        },
      }),
    ]
  },
})
