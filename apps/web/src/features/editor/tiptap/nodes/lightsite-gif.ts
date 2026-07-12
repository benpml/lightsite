import {
  mergeAttributes,
  ResizableNodeView,
  type Editor,
  type ResizableNodeViewDirection,
} from "@tiptap/core"
import { SiteGifBlock } from "@lightsite/site-document"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

export const LightsiteGif = SiteGifBlock.extend({
  addNodeView() {
    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } =
      this.options.resize && this.options.resize.enabled
        ? this.options.resize
        : {
            alwaysPreserveAspectRatio: true,
            directions: ["left", "right"] satisfies ResizableNodeViewDirection[],
            minHeight: 120,
            minWidth: 180,
          }
    const resizeDirections = [...(directions ?? [])] as ResizableNodeViewDirection[]

    return ({ node, getPos, HTMLAttributes, editor }) => {
      if (!node.attrs.src) {
        return createEmptyGifNodeView({ editor, getPos })
      }

      const element = document.createElement("img")
      element.draggable = false
      applyGifElementAttributes(element, this.options.HTMLAttributes, HTMLAttributes, node.attrs)

      const nodeView = new ResizableNodeView({
        element,
        editor,
        node,
        getPos,
        onResize: (width) => {
          element.style.width = `${width}px`
          element.style.height = "auto"
        },
        onCommit: () => {
          const pos = getPos()

          if (pos === undefined) {
            return
          }

          const rect = element.getBoundingClientRect()

          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes(this.name, {
              height: Math.round(rect.height),
              width: Math.round(rect.width),
            })
            .run()
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type || !updatedNode.attrs.src) {
            return false
          }

          applyGifElementAttributes(
            element,
            this.options.HTMLAttributes,
            HTMLAttributes,
            updatedNode.attrs
          )
          return true
        },
        options: {
          directions: resizeDirections,
          min: {
            height: minHeight,
            width: minWidth,
          },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
        },
      })

      element.style.height = "auto"

      return nodeView
    }
  },
})

function createEmptyGifNodeView({
  editor,
  getPos,
}: {
  editor: Editor
  getPos: () => number | undefined
}) {
  const dom = document.createElement("div")
  const button = document.createElement("button")
  const title = document.createElement("span")
  const description = document.createElement("span")

  dom.dataset.lightsiteGifEmpty = ""
  dom.dataset.node = "gifBlock"
  dom.className = "lightsite-editor-gif-empty"
  button.className = "lightsite-editor-gif-empty-button"
  button.type = "button"
  title.className = "lightsite-editor-gif-empty-title"
  title.textContent = "Select GIF"
  description.className = "lightsite-editor-gif-empty-description"
  description.textContent = "Search GIPHY and choose an animated GIF"

  button.append(title, description)
  dom.append(button)

  const openPicker = (event: MouseEvent) => {
    event.preventDefault()
    const pos = getPos()

    if (pos === undefined) {
      return
    }

    editor.chain().focus().openLightsiteNextGifPicker(pos).run()
  }

  button.addEventListener("click", openPicker)

  return {
    dom,
    destroy() {
      button.removeEventListener("click", openPicker)
    },
    stopEvent(event: Event) {
      return event.type === "click"
    },
    update(updatedNode: ProseMirrorNode) {
      return updatedNode.type.name === "gifBlock" && !updatedNode.attrs.src
    },
  }
}

function applyGifElementAttributes(
  element: HTMLImageElement,
  extensionAttributes: Record<string, unknown>,
  htmlAttributes: Record<string, unknown>,
  nodeAttributes: Record<string, unknown>
) {
  const mergedAttributes = mergeAttributes(extensionAttributes, htmlAttributes, nodeAttributes)

  for (const name of ["alt", "data-giphy-id", "data-id", "id", "loading", "src", "title"]) {
    element.removeAttribute(name)
  }

  for (const [key, value] of Object.entries(mergedAttributes)) {
    if (value == null || key === "width" || key === "height") {
      continue
    }

    if (key === "id") {
      element.setAttribute("data-id", String(value))
      continue
    }

    if (key === "giphyId") {
      element.setAttribute("data-giphy-id", String(value))
      continue
    }

    element.setAttribute(key, String(value))
  }

  if (typeof nodeAttributes.width === "number") {
    element.style.width = `${nodeAttributes.width}px`
  } else {
    element.style.removeProperty("width")
  }

  element.style.height = "auto"
}
