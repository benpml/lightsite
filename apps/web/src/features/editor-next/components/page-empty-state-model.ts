import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

export type EditorNextEmptyStateKind = "first-page" | "added-page"
export type EditorNextEmptyStateTemplateId = "call-recap" | "product-overview" | "faqs"

export function getEditorNextEmptyStateKind(editor: Editor): EditorNextEmptyStateKind | null {
  const { doc } = editor.state
  const scaffold = getEditorNextEmptyStateScaffold(doc)

  if (!scaffold || hasEditorNextBodyBlocksAfterScaffold(doc, scaffold.index)) {
    return null
  }

  return scaffold.kind
}

export function focusEditorNextEmptyStateStart(editor: Editor) {
  const { doc } = editor.state
  const scaffold = getEditorNextEmptyStateScaffold(doc)

  if (!scaffold || hasEditorNextBodyBlocksAfterScaffold(doc, scaffold.index)) {
    editor.commands.focus()
    return
  }

  const firstNode = doc.child(scaffold.index)
  const selectionPosition = Math.max(1, firstNode.nodeSize - 1)
  const tr = editor.state.tr.setSelection(
    TextSelection.near(editor.state.doc.resolve(selectionPosition), -1)
  )

  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
}

export function insertEditorNextEmptyStateParagraph(editor: Editor) {
  const paragraph = editor.state.schema.nodes.paragraph?.create()

  if (!paragraph) {
    return false
  }

  return insertEditorNextEmptyStateNodes(editor, [paragraph])
}

export function insertEditorNextEmptyStateTemplate(
  editor: Editor,
  templateId: EditorNextEmptyStateTemplateId
) {
  const templateNodes = createEditorNextEmptyStateTemplateNodes(editor, templateId)

  if (templateNodes.length === 0) {
    return false
  }

  return insertEditorNextEmptyStateNodes(editor, templateNodes)
}

function insertEditorNextEmptyStateNodes(editor: Editor, nodes: ProseMirrorNode[]) {
  const { doc } = editor.state
  const scaffold = getEditorNextEmptyStateScaffold(doc)

  if (!scaffold || hasEditorNextBodyBlocksAfterScaffold(doc, scaffold.index)) {
    return false
  }

  const firstNode = doc.child(scaffold.index)
  const insertAt = firstNode.nodeSize
  const tr = editor.state.tr.insert(insertAt, nodes)
  editor.view.dispatch(
    tr
      .setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)))
      .scrollIntoView()
  )
  editor.view.focus()

  return true
}

function getEditorNextEmptyStateScaffold(doc: ProseMirrorNode): {
  index: number
  kind: EditorNextEmptyStateKind
} | null {
  const firstNode = doc.firstChild

  if (!firstNode) {
    return null
  }

  if (firstNode.type.name === "pageTitleSection") {
    return { index: 0, kind: "first-page" }
  }

  if (firstNode.type.name === "heading" && firstNode.attrs.level === 1) {
    return { index: 0, kind: "added-page" }
  }

  return null
}

function hasEditorNextBodyBlocksAfterScaffold(doc: ProseMirrorNode, scaffoldIndex: number) {
  return doc.childCount > scaffoldIndex + 1
}

function createEditorNextEmptyStateTemplateNodes(
  editor: Editor,
  templateId: EditorNextEmptyStateTemplateId
) {
  const { schema } = editor.state
  const paragraphType = schema.nodes.paragraph
  const headingType = schema.nodes.heading

  if (!paragraphType || !headingType) {
    return []
  }

  const heading = (text: string) =>
    headingType.create({ level: 2 }, schema.text(text))
  const paragraph = (text: string) =>
    paragraphType.create(null, schema.text(text))

  if (templateId === "call-recap") {
    return [
      heading("Call recap"),
      paragraph("Summarize the conversation, key takeaways, and agreed next steps."),
      heading("Next steps"),
      paragraph("Add owners, timing, and the follow-up items your prospect should expect."),
    ]
  }

  if (templateId === "product-overview") {
    return [
      heading("Product overview"),
      paragraph("Explain what the product does and why it matters for this prospect."),
      heading("Why it fits"),
      paragraph("Connect the product to their priorities, pain points, or use case."),
    ]
  }

  return [
    heading("FAQs"),
    paragraph("Answer the questions prospects usually ask before moving forward."),
    heading("What happens next?"),
    paragraph("Clarify the next step and what they should do if they are interested."),
  ]
}

export function shouldHandleEditorNextEmptyStateEnter(editor: Editor, target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true
  }

  const editorRoot = target.closest(".ProseMirror")

  if (editorRoot) {
    const { selection } = editor.state

    return selection instanceof NodeSelection || selection.$from.depth <= 1
  }

  return !target.closest(
    'a, button, input, textarea, select, [role="button"], [contenteditable="true"]'
  )
}
