import { EditorContent, useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { SITE_DOCUMENT_CSS } from "@lightsite/site-document"

import { EditorBlockControls } from "./block-controls"
import { EditorButtonSettingsPopover } from "./button-settings-popover"
import { EditorCalendarEmbedSettingsMenu } from "./calendar-embed-settings-menu"
import { EditorGifPickerDialog } from "./gif-picker-dialog"
import { EditorImageCardButtonSettingsPopover } from "./image-card-button-settings-popover"
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
  editor: Editor
  emptyStateFallbackKind: EditorEmptyStateKind
  mode: EditorMode
}

export function EditorCanvas({ editor, emptyStateFallbackKind, mode }: EditorCanvasProps) {
  const isEditing = mode === "edit"
  const emptyStateKind = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      getEditorEmptyStateKind(currentEditor, emptyStateFallbackKind),
  })

  return (
    <div
      data-editor-canvas=""
      data-editor-mode={mode}
      className="relative h-full min-h-0 min-w-0 overflow-auto bg-background text-foreground"
    >
      <style data-lightsite-site-document-styles="">{SITE_DOCUMENT_CSS}</style>
      <EditorContent
        editor={editor}
        className="lightsite-editor ls-document-editor min-h-full min-w-0 w-full"
        data-empty-state-active={isEditing && emptyStateKind ? "" : undefined}
        data-editor-mode={mode}
      />
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
