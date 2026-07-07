import {
  mergeAttributes,
  ResizableNodeView,
  type Editor,
  type ResizableNodeViewDirection,
} from "@tiptap/core"
import Image, { type ImageOptions } from "@tiptap/extension-image"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

import { readImageFileAsAttrs } from "../image-utils"

export const LightsiteImage = Image.extend<ImageOptions>({
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
    const resizeDirections = [...(directions ?? [])]

    return ({ node, getPos, HTMLAttributes, editor }) => {
      if (!node.attrs.src) {
        return createEmptyImageNodeView({
          editor,
          getPos,
          nodeTypeName: this.name,
        })
      }

      const element = document.createElement("img")
      element.draggable = false
      applyImageElementAttributes(element, this.options.HTMLAttributes, HTMLAttributes, node.attrs)

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

          applyImageElementAttributes(
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

function createEmptyImageNodeView({
  editor,
  getPos,
  nodeTypeName,
}: {
  editor: Editor
  getPos: () => number | undefined
  nodeTypeName: string
}) {
  const dom = document.createElement("div")
  const input = document.createElement("input")
  const button = document.createElement("button")
  const title = document.createElement("span")
  const description = document.createElement("span")

  dom.dataset.lightsiteImageEmpty = ""
  dom.dataset.node = "image"
  dom.className = "lightsite-next-image-empty"
  input.accept = "image/*"
  input.ariaHidden = "true"
  input.className = "lightsite-next-image-empty-input"
  input.hidden = true
  input.tabIndex = -1
  input.type = "file"
  button.className = "lightsite-next-image-empty-button"
  button.type = "button"
  title.className = "lightsite-next-image-empty-title"
  title.textContent = "Upload image"
  description.className = "lightsite-next-image-empty-description"
  description.textContent = "Click or drag an image file here"

  button.append(title, description)
  dom.append(input, button)

  const setImageFromFile = async (file: File) => {
    try {
      const pos = getPos()

      if (pos === undefined) {
        return
      }

      const attrs = await readImageFileAsAttrs(file)

      editor
        .chain()
        .focus()
        .setNodeSelection(pos)
        .updateAttributes(nodeTypeName, attrs)
        .run()
    } catch {
      dom.dataset.uploadError = "true"
      description.textContent = "This image could not be loaded"
    }
  }

  const handleClick = (event: MouseEvent) => {
    event.preventDefault()
    input.click()
  }
  const handleChange = () => {
    const file = input.files?.[0]
    input.value = ""

    if (file) {
      void setImageFromFile(file)
    }
  }
  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) {
      return
    }

    event.preventDefault()
    dom.dataset.dragActive = "true"
  }
  const handleDragLeave = (event: DragEvent) => {
    const relatedTarget = event.relatedTarget

    if (relatedTarget instanceof Node && dom.contains(relatedTarget)) {
      return
    }

    delete dom.dataset.dragActive
  }
  const handleDrop = (event: DragEvent) => {
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
      item.type.startsWith("image/")
    )

    if (!file) {
      return
    }

    event.preventDefault()
    delete dom.dataset.dragActive
    void setImageFromFile(file)
  }

  button.addEventListener("click", handleClick)
  input.addEventListener("change", handleChange)
  dom.addEventListener("dragover", handleDragOver)
  dom.addEventListener("dragleave", handleDragLeave)
  dom.addEventListener("drop", handleDrop)

  return {
    dom,
    destroy() {
      button.removeEventListener("click", handleClick)
      input.removeEventListener("change", handleChange)
      dom.removeEventListener("dragover", handleDragOver)
      dom.removeEventListener("dragleave", handleDragLeave)
      dom.removeEventListener("drop", handleDrop)
    },
    stopEvent(event: Event) {
      return (
        event.type === "change" ||
        event.type === "click" ||
        event.type === "drop" ||
        event.type.startsWith("drag")
      )
    },
    update(updatedNode: ProseMirrorNode) {
      return updatedNode.type.name === nodeTypeName && !updatedNode.attrs.src
    },
  }
}

function applyImageElementAttributes(
  element: HTMLImageElement,
  extensionAttributes: Record<string, unknown>,
  htmlAttributes: Record<string, unknown>,
  nodeAttributes: Record<string, unknown>
) {
  const mergedAttributes = mergeAttributes(extensionAttributes, htmlAttributes, nodeAttributes)

  for (const name of ["alt", "data-id", "id", "loading", "src", "title"]) {
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

    element.setAttribute(key, String(value))
  }

  if (typeof nodeAttributes.width === "number") {
    element.style.width = `${nodeAttributes.width}px`
  } else {
    element.style.removeProperty("width")
  }

  element.style.height = "auto"
}
