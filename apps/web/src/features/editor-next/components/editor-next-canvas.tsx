import { EditorContent, useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"

import { EditorNextBlockControls } from "./block-controls"
import { EditorNextButtonSettingsPopover } from "./button-settings-popover"
import { EditorNextCalendarEmbedSettingsMenu } from "./calendar-embed-settings-menu"
import { EditorNextGifPickerDialog } from "./gif-picker-dialog"
import { EditorNextImageCardButtonSettingsPopover } from "./image-card-button-settings-popover"
import { EditorNextPageEmptyState } from "./page-empty-state"
import { getEditorNextEmptyStateKind } from "./page-empty-state-model"
import { EditorNextTextBubbleMenu } from "./text-bubble-menu"
import { EditorNextVariableCreatePopover } from "./variable-create-popover"
import { EditorNextVideoEmbedSettingsMenu } from "./video-embed-settings-menu"
import type { EditorNextMode } from "../types"

type EditorNextCanvasProps = {
  editor: Editor
  mode: EditorNextMode
}

export function EditorNextCanvas({ editor, mode }: EditorNextCanvasProps) {
  const isEditing = mode === "edit"
  const emptyStateKind = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => getEditorNextEmptyStateKind(currentEditor),
  })

  return (
    <div
      data-editor-next-canvas=""
      data-editor-next-mode={mode}
      className="relative h-full min-h-0 overflow-auto bg-background text-foreground"
    >
      <EditorContent
        editor={editor}
        className="lightsite-editor-next min-h-full"
        data-editor-next-mode={mode}
      />
      {isEditing && emptyStateKind ? (
        <EditorNextPageEmptyState editor={editor} kind={emptyStateKind} />
      ) : null}
      {isEditing ? (
        <>
          <EditorNextBlockControls editor={editor} />
          <EditorNextButtonSettingsPopover editor={editor} />
          <EditorNextCalendarEmbedSettingsMenu editor={editor} />
          <EditorNextVideoEmbedSettingsMenu editor={editor} />
          <EditorNextImageCardButtonSettingsPopover editor={editor} />
          <EditorNextVariableCreatePopover editor={editor} />
          <EditorNextTextBubbleMenu editor={editor} />
          <EditorNextGifPickerDialog editor={editor} />
        </>
      ) : null}
    </div>
  )
}
