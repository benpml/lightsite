import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

export type EditorEmptyStateKind = "first-page" | "added-page"
export type EditorEmptyStateTemplateId = "call-recap" | "product-overview" | "faqs"

export function getEditorEmptyStateKind(
  editor: Editor,
  fallbackKind: EditorEmptyStateKind
): EditorEmptyStateKind | null {
  const { doc } = editor.state
  const scaffold = getEditorEmptyStateScaffold(doc, fallbackKind)

  if (!scaffold || hasEditorBodyBlocksAfterScaffold(doc, scaffold.index)) {
    return null
  }

  return scaffold.kind
}

export function focusEditorEmptyStateStart(editor: Editor) {
  const { doc } = editor.state
  const scaffold = getEditorEmptyStateScaffold(doc, "first-page")

  if (!scaffold || hasEditorBodyBlocksAfterScaffold(doc, scaffold.index)) {
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

export function insertEditorEmptyStateParagraph(
  editor: Editor,
  kind: EditorEmptyStateKind
) {
  const nodes = createEditorEmptyStateScratchNodes(editor, kind)

  if (nodes.length === 0) {
    return false
  }

  return insertEditorEmptyStateNodes(editor, nodes)
}

export function insertEditorEmptyStateTemplate(
  editor: Editor,
  templateId: EditorEmptyStateTemplateId,
  kind: EditorEmptyStateKind
) {
  const templateNodes = createEditorEmptyStateTemplateNodes(editor, templateId, kind)

  if (templateNodes.length === 0) {
    return false
  }

  return insertEditorEmptyStateNodes(editor, templateNodes)
}

function insertEditorEmptyStateNodes(editor: Editor, nodes: ProseMirrorNode[]) {
  const { doc } = editor.state
  const scaffold = getEditorEmptyStateScaffold(doc, "first-page")

  if (!scaffold || hasEditorBodyBlocksAfterScaffold(doc, scaffold.index)) {
    return false
  }

  const firstNode = doc.child(scaffold.index)
  const replaceFrom = 0
  const replaceTo = firstNode.nodeSize
  const tr = editor.state.tr.replaceWith(replaceFrom, replaceTo, nodes)
  const selectionPosition = findFirstTextSelectionPosition(tr.doc) ?? 1

  editor.view.dispatch(
    tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPosition), 1)).scrollIntoView()
  )
  editor.view.focus()

  return true
}

function getEditorEmptyStateScaffold(
  doc: ProseMirrorNode,
  fallbackKind: EditorEmptyStateKind
): {
  index: number
  kind: EditorEmptyStateKind
} | null {
  const firstNode = doc.firstChild

  if (!firstNode) {
    return null
  }

  if (
    doc.childCount === 1 &&
    firstNode.type.name === "paragraph" &&
    firstNode.content.size === 0
  ) {
    return { index: 0, kind: fallbackKind }
  }

  if (firstNode.type.name === "pageTitleSection") {
    return { index: 0, kind: "first-page" }
  }

  if (firstNode.type.name === "heading" && firstNode.attrs.level === 1) {
    return { index: 0, kind: "added-page" }
  }

  return null
}

function hasEditorBodyBlocksAfterScaffold(doc: ProseMirrorNode, scaffoldIndex: number) {
  return doc.childCount > scaffoldIndex + 1
}

function createEditorEmptyStateScratchNodes(editor: Editor, kind: EditorEmptyStateKind) {
  const { schema } = editor.state
  const paragraphType = schema.nodes.paragraph

  if (!paragraphType) {
    return []
  }

  return [
    ...createEditorEmptyStateTitleNodes(editor, kind),
    paragraphType.create(),
  ]
}

function createEditorEmptyStateTemplateNodes(
  editor: Editor,
  templateId: EditorEmptyStateTemplateId,
  kind: EditorEmptyStateKind
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
      ...createEditorEmptyStateTitleNodes(editor, kind, "Call recap"),
      heading("Summary"),
      paragraph("Summarize the conversation, key takeaways, and agreed next steps."),
      heading("Next steps"),
      paragraph("Add owners, timing, and the follow-up items your prospect should expect."),
    ]
  }

  if (templateId === "product-overview") {
    return [
      ...createEditorEmptyStateTitleNodes(editor, kind, "Product overview"),
      heading("What it does"),
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

function createEditorEmptyStateTitleNodes(
  editor: Editor,
  kind: EditorEmptyStateKind,
  title?: string
) {
  const { schema } = editor.state

  if (kind === "first-page") {
    const pageTitleType = schema.nodes.pageTitleSection
    const pageTitleTitleType = schema.nodes.pageTitleTitle
    const pageTitleSubtitleType = schema.nodes.pageTitleSubtitle

    if (!pageTitleType || !pageTitleTitleType || !pageTitleSubtitleType) {
      return []
    }

    const titleContent = title ? schema.text(title) : undefined

    return [
      pageTitleType.create(
        { align: "center" },
        [
          pageTitleTitleType.create(null, titleContent),
          pageTitleSubtitleType.create(),
        ]
      ),
    ]
  }

  const headingType = schema.nodes.heading

  if (!headingType) {
    return []
  }

  return [
    title
      ? headingType.create({ level: 1 }, schema.text(title))
      : headingType.create({ level: 1 }),
  ]
}

function findFirstTextSelectionPosition(doc: ProseMirrorNode) {
  let selectionPosition: number | null = null

  doc.descendants((node, pos) => {
    if (selectionPosition !== null) {
      return false
    }

    if (node.isTextblock) {
      selectionPosition = pos + 1
      return false
    }

    return true
  })

  return selectionPosition
}

export function shouldHandleEditorEmptyStateEnter(editor: Editor, target: EventTarget | null) {
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
