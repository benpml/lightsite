import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { VariableTokenView } from "./variable-token-view"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variableToken: {
      insertVariableToken: (attrs: {
        fallbackName: string
        variableId: string
      }) => ReturnType
    }
  }
}

export const VariableToken = Node.create({
  name: "variableToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      variableId: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-variable-id") ?? element.getAttribute("data-id") ?? "",
        renderHTML: (attributes) => ({ "data-variable-id": attributes.variableId }),
      },
      fallbackName: {
        default: "Variable",
        parseHTML: (element) =>
          element.getAttribute("data-variable-name") ??
          element.getAttribute("data-variable-label") ??
          "Variable",
        renderHTML: (attributes) => ({ "data-variable-name": attributes.fallbackName }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-variable-id]" }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-lightsite-variable": "",
        class: "lightsite-next-variable-token",
      }),
      `{${String(node.attrs.fallbackName || "Variable")}}`,
    ]
  },

  renderText({ node }) {
    return `{${String(node.attrs.fallbackName || "Variable")}}`
  },

  addCommands() {
    return {
      insertVariableToken:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableTokenView)
  },
})
