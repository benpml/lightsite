import { useEffect, useLayoutEffect, useRef } from "react"
import { IconFileText } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"

import {
  focusEditorNextEmptyStateStart,
  insertEditorNextEmptyStateParagraph,
  insertEditorNextEmptyStateTemplate,
  shouldHandleEditorNextEmptyStateEnter,
  type EditorNextEmptyStateKind,
  type EditorNextEmptyStateTemplateId,
} from "./page-empty-state-model"

type EditorNextPageEmptyStateProps = {
  editor: Editor
  kind: EditorNextEmptyStateKind
}

const starterTemplates: Array<{ id: EditorNextEmptyStateTemplateId; label: string }> = [
  { id: "call-recap", label: "Call recap" },
  { id: "product-overview", label: "Product overview" },
  { id: "faqs", label: "FAQs" },
]

export function EditorNextPageEmptyState({ editor, kind }: EditorNextPageEmptyStateProps) {
  const emptyStateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    focusEditorNextEmptyStateStart(editor)
  }, [editor, kind])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return
      }

      if (!shouldHandleEditorNextEmptyStateEnter(editor, event.target)) {
        return
      }

      if (!insertEditorNextEmptyStateParagraph(editor)) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [editor])

  useLayoutEffect(() => {
    const emptyStateElement = emptyStateRef.current
    const editorElement = editor.view.dom
    const canvasElement = emptyStateElement?.closest<HTMLElement>("[data-editor-next-canvas]")
    const anchorElement = editorElement.firstElementChild as HTMLElement | null

    if (!emptyStateElement || !canvasElement || !anchorElement) {
      return
    }

    const updatePosition = () => {
      const canvasRect = canvasElement.getBoundingClientRect()
      const anchorRect = anchorElement.getBoundingClientRect()

      emptyStateElement.style.setProperty(
        "--lightsite-empty-top",
        `${anchorRect.bottom - canvasRect.top + canvasElement.scrollTop + 32}px`
      )
      emptyStateElement.style.setProperty(
        "--lightsite-empty-left",
        `${anchorRect.left - canvasRect.left + canvasElement.scrollLeft}px`
      )
      emptyStateElement.style.setProperty("--lightsite-empty-width", `${anchorRect.width}px`)
    }

    updatePosition()

    const animationFrame = window.requestAnimationFrame(updatePosition)
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(canvasElement)
    resizeObserver.observe(anchorElement)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", updatePosition)
    }
  }, [editor, kind])

  return (
    <div
      ref={emptyStateRef}
      className="lightsite-next-page-empty-state"
      data-empty-state-kind={kind}
      onMouseDown={(event) => {
        event.preventDefault()
        focusEditorNextEmptyStateStart(editor)
      }}
    >
      <div className="lightsite-next-page-empty-state-inner">
        <section className="lightsite-next-page-empty-state-instructions">
          <p className="lightsite-next-page-empty-state-heading">Sites work like a doc.</p>
          <ul>
            <li>
              Press <strong>/</strong> to insert blocks.
            </li>
            <li>
              Press <strong>{"{"}</strong> to add variables for personalization
            </li>
            <li>
              Once ready, hit <strong>publish</strong>, then <strong>share</strong>
            </li>
          </ul>
        </section>

        <section className="lightsite-next-page-empty-state-section">
          <p className="lightsite-next-page-empty-state-heading">Start from a template:</p>
          <div className="lightsite-next-page-empty-state-items">
            {starterTemplates.map((template) => (
              <button
                className="lightsite-next-page-empty-state-item"
                key={template.id}
                type="button"
                onClick={() => insertEditorNextEmptyStateTemplate(editor, template.id)}
              >
                <IconFileText aria-hidden="true" />
                <span>{template.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="lightsite-next-page-empty-state-section">
          <p className="lightsite-next-page-empty-state-heading">Start from scratch:</p>
          <div className="lightsite-next-page-empty-state-items">
            <button
              className="lightsite-next-page-empty-state-item"
              type="button"
              onClick={() => insertEditorNextEmptyStateParagraph(editor)}
            >
              <IconFileText aria-hidden="true" />
              <span>Press Enter to start from scratch</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
