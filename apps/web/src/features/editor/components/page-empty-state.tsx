import { useEffect, useLayoutEffect, useRef } from "react"
import { IconFileText } from "@tabler/icons-react"
import type { Editor } from "@tiptap/react"

import {
  focusEditorEmptyStateStart,
  insertEditorEmptyStateParagraph,
  insertEditorEmptyStateTemplate,
  shouldHandleEditorEmptyStateEnter,
  type EditorEmptyStateKind,
  type EditorEmptyStateTemplateId,
} from "./page-empty-state-model"

type EditorPageEmptyStateProps = {
  editor: Editor
  kind: EditorEmptyStateKind
}

const starterTemplates: Array<{ id: EditorEmptyStateTemplateId; label: string }> = [
  { id: "call-recap", label: "Call recap" },
  { id: "product-overview", label: "Product overview" },
  { id: "faqs", label: "FAQs" },
]

export function EditorPageEmptyState({ editor, kind }: EditorPageEmptyStateProps) {
  const emptyStateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    focusEditorEmptyStateStart(editor)
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

      if (!shouldHandleEditorEmptyStateEnter(editor, event.target)) {
        return
      }

      if (!insertEditorEmptyStateParagraph(editor, kind)) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [editor, kind])

  useLayoutEffect(() => {
    const emptyStateElement = emptyStateRef.current
    const editorElement = editor.view.dom
    const canvasElement = emptyStateElement?.closest<HTMLElement>("[data-editor-canvas]")

    if (!emptyStateElement || !canvasElement) {
      return
    }

    const updatePosition = () => {
      const anchorElement = editorElement.firstElementChild as HTMLElement | null

      if (!anchorElement) {
        return
      }

      const canvasRect = canvasElement.getBoundingClientRect()
      const anchorRect = anchorElement.getBoundingClientRect()
      const fallbackWidth = Math.max(0, Math.min(612, canvasRect.width - 104))
      const fallbackLeft = Math.max(0, (canvasRect.width - fallbackWidth) / 2)
      const anchorWidth = anchorRect.width > 1 ? anchorRect.width : fallbackWidth
      const anchorLeft =
        anchorRect.width > 1 && anchorRect.left >= canvasRect.left
          ? anchorRect.left - canvasRect.left + canvasElement.scrollLeft
          : fallbackLeft + canvasElement.scrollLeft
      const isHiddenParagraphScaffold =
        anchorElement.matches("p.lightsite-editor-placeholder-hidden.is-editor-empty") &&
        anchorRect.height <= 1
      const anchorTop =
        anchorRect.top >= canvasRect.top
          ? anchorRect.top - canvasRect.top + canvasElement.scrollTop
          : 80 + canvasElement.scrollTop
      const anchorBottom =
        anchorRect.height > 1 && anchorRect.bottom >= canvasRect.top
          ? anchorRect.bottom - canvasRect.top + canvasElement.scrollTop
          : anchorTop
      const emptyStateTop = isHiddenParagraphScaffold
        ? anchorTop
        : anchorBottom + 32

      emptyStateElement.style.setProperty(
        "--lightsite-empty-top",
        `${emptyStateTop}px`
      )
      emptyStateElement.style.setProperty(
        "--lightsite-empty-left",
        `${anchorLeft}px`
      )
      emptyStateElement.style.setProperty("--lightsite-empty-width", `${anchorWidth}px`)
    }

    updatePosition()

    const animationFrame = window.requestAnimationFrame(updatePosition)
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(canvasElement)
    resizeObserver.observe(editorElement)
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
      className="lightsite-editor-page-empty-state"
      data-empty-state-kind={kind}
      onMouseDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('a, button, input, textarea, select, [role="button"]')
        ) {
          return
        }

        event.preventDefault()
        focusEditorEmptyStateStart(editor)
      }}
    >
      <div className="lightsite-editor-page-empty-state-inner">
        <section className="lightsite-editor-page-empty-state-instructions">
          <p className="lightsite-editor-page-empty-state-heading">Sites work like a doc.</p>
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

        <section className="lightsite-editor-page-empty-state-section">
          <p className="lightsite-editor-page-empty-state-heading">Start from a template:</p>
          <div className="lightsite-editor-page-empty-state-items">
            {starterTemplates.map((template) => (
              <button
                className="lightsite-editor-page-empty-state-item"
                key={template.id}
                type="button"
                onClick={() => insertEditorEmptyStateTemplate(editor, template.id, kind)}
              >
                <IconFileText aria-hidden="true" />
                <span>{template.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="lightsite-editor-page-empty-state-section">
          <p className="lightsite-editor-page-empty-state-heading">Start from scratch:</p>
          <div className="lightsite-editor-page-empty-state-items">
            <button
              className="lightsite-editor-page-empty-state-item"
              type="button"
              onClick={() => insertEditorEmptyStateParagraph(editor, kind)}
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
