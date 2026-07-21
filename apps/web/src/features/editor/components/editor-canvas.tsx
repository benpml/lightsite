import { EditorContent, useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { SITE_DOCUMENT_CSS } from "@handout/site-document"
import { useLayoutEffect, useRef } from "react"

import { EditorBlockControls } from "./block-controls"
import { EditorButtonSettingsPopover } from "./button-settings-popover"
import { EditorCalendarEmbedSettingsMenu } from "./calendar-embed-settings-menu"
import { EditorGifPickerDialog } from "./gif-picker-dialog"
import { EditorImageCardButtonSettingsPopover } from "./image-card-button-settings-popover"
import { EditorPageNavigation } from "./page-navigation"
import { EditorPageEmptyState } from "./page-empty-state"
import {
  getEditorEmptyStateKind,
  type EditorEmptyStateKind,
} from "./page-empty-state-model"
import { EditorTextBubbleMenu } from "./text-bubble-menu"
import { EditorVariableCreatePopover } from "./variable-create-popover"
import { EditorVideoEmbedSettingsMenu } from "./video-embed-settings-menu"
import type { EditorMode } from "../types"

type EditorCanvasProps = {
  activePageId: string
  editor: Editor
  emptyStateFallbackKind: EditorEmptyStateKind
  mode: EditorMode
  nextPage: { id: string; name: string } | null
  previousPage: { id: string; name: string } | null
  onSelectPage: (pageId: string) => void
}

export function EditorCanvas({
  activePageId,
  editor,
  emptyStateFallbackKind,
  mode,
  nextPage,
  previousPage,
  onSelectPage,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const isEditing = mode === "edit"
  const hasPageNavigation = Boolean(previousPage || nextPage)
  const emptyStateKind = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor && !currentEditor.isDestroyed
        ? getEditorEmptyStateKind(currentEditor, emptyStateFallbackKind)
        : null,
  })

  useLayoutEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const resetScroll = () => {
      canvas.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }

    resetScroll()
    const animationFrame = window.requestAnimationFrame(resetScroll)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [activePageId])

  return (
    <div
      ref={canvasRef}
      data-editor-canvas=""
      data-editor-mode={mode}
      data-has-page-navigation={hasPageNavigation ? "" : undefined}
      className="handout-document-editor relative h-full min-h-0 min-w-0 overflow-auto bg-background text-foreground"
    >
      <style data-handout-site-document-styles="">{SITE_DOCUMENT_CSS}</style>
      <EditorContent
        editor={editor}
        className="handout-editor min-h-full min-w-0 w-full"
        data-empty-state-active={isEditing && emptyStateKind ? "" : undefined}
        data-editor-mode={mode}
      />
      {isEditing ? (
        <EditorPageNavigation
          nextPage={nextPage}
          previousPage={previousPage}
          onSelectPage={onSelectPage}
        />
      ) : null}
      {isEditing && emptyStateKind ? (
        <EditorPageEmptyState editor={editor} kind={emptyStateKind} />
      ) : null}
      {isEditing ? (
        <>
          <EditorBlockControls editor={editor} />
          <EditorButtonSettingsPopover editor={editor} />
          <EditorCalendarEmbedSettingsMenu editor={editor} />
          <EditorVideoEmbedSettingsMenu editor={editor} />
          <EditorImageCardButtonSettingsPopover editor={editor} />
          <EditorVariableCreatePopover editor={editor} />
          <EditorTextBubbleMenu editor={editor} />
          <EditorGifPickerDialog editor={editor} />
        </>
      ) : null}
    </div>
  )
}
