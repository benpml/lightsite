import { isNodeRangeSelection, NodeRangeSelection } from "@tiptap/extension-node-range"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import {
  IconClipboard,
  IconCopy,
  IconCopyPlus,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import {
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import {
  getCachedHandoutBlockClipboard,
  readHandoutBlockClipboard,
  writeSelectedHandoutBlocksToClipboard,
  type HandoutBlockClipboardPayload,
} from "../tiptap/extensions/block-clipboard"
import { getSelectedBlockRanges } from "../tiptap/extensions/block-selection"

type EditorBlockContextMenuProps = {
  children: ReactElement
  editor: Editor
  enabled: boolean
}

type ContextBlockTarget = {
  empty: boolean
  node: ProseMirrorNode
  pos: number
  scaffold: boolean
}

export function EditorBlockContextMenu({
  children,
  editor,
  enabled,
}: EditorBlockContextMenuProps) {
  const [target, setTarget] = useState<ContextBlockTarget | null>(null)
  const [clipboardPayload, setClipboardPayload] =
    useState<HandoutBlockClipboardPayload | null>(() =>
      getCachedHandoutBlockClipboard()
    )

  const refreshClipboard = useCallback(() => {
    setClipboardPayload(getCachedHandoutBlockClipboard())
    void readHandoutBlockClipboard().then(setClipboardPayload)
  }, [])

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const nextTarget = resolveContextBlockTarget(editor, event)

      if (!nextTarget) {
        setTarget(null)
        event.stopPropagation()
        return
      }

      selectContextBlockTarget(editor, nextTarget)
      setTarget(nextTarget)
      refreshClipboard()
    },
    [editor, refreshClipboard]
  )

  const copyBlocks = useCallback(() => {
    if (!target) {
      return
    }

    void writeSelectedHandoutBlocksToClipboard(editor, target.pos).then(
      (copied) => {
        if (copied) {
          setClipboardPayload(getCachedHandoutBlockClipboard())
        }
      }
    )
  }, [editor, target])

  const pasteBlocks = useCallback(() => {
    if (!clipboardPayload || !target) {
      return
    }

    editor.commands.insertHandoutNextBlockClipboard(
      clipboardPayload,
      target.pos
    )
  }, [clipboardPayload, editor, target])

  const duplicateBlocks = useCallback(() => {
    if (!target) {
      return
    }

    editor.commands.duplicateHandoutNextSelectedBlocks(target.pos)
  }, [editor, target])

  const deleteBlocks = useCallback(() => {
    editor.commands.deleteHandoutNextSelectedBlocks()
  }, [editor])

  const addBlock = useCallback(() => {
    if (!target) {
      return
    }

    openBlockPickerAtEmptyTarget(editor, target)
  }, [editor, target])

  if (!enabled) {
    return children
  }

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (!open) {
          setTarget(null)
        }
      }}
    >
      <ContextMenuTrigger
        asChild
        className="select-text"
        onContextMenuCapture={handleContextMenu}
      >
        {children}
      </ContextMenuTrigger>
      {target ? (
        <ContextMenuContent data-editor-block-context-menu="">
          <ContextMenuGroup>
            {target.empty ? (
              <>
                {clipboardPayload ? (
                  <ContextMenuItem onSelect={pasteBlocks}>
                    <IconClipboard />
                    Paste
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem onSelect={addBlock}>
                  <IconPlus />
                  Add block
                </ContextMenuItem>
              </>
            ) : (
              <>
                <ContextMenuItem onSelect={copyBlocks}>
                  <IconCopy />
                  Copy
                </ContextMenuItem>
                {clipboardPayload ? (
                  <ContextMenuItem onSelect={pasteBlocks}>
                    <IconClipboard />
                    Paste
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem onSelect={duplicateBlocks}>
                  <IconCopyPlus />
                  Duplicate
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={deleteBlocks}
                >
                  <IconTrash />
                  Delete
                </ContextMenuItem>
              </>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  )
}

function resolveContextBlockTarget(
  editor: Editor,
  event: ReactMouseEvent<HTMLElement>
): ContextBlockTarget | null {
  const eventTarget = event.target

  if (!(eventTarget instanceof Element)) {
    return null
  }

  const emptyState = eventTarget.closest(
    ".handout-editor-page-empty-state"
  )

  if (emptyState) {
    const node = editor.state.doc.firstChild

    return node
      ? { empty: true, node, pos: 0, scaffold: true }
      : null
  }

  if (!eventTarget.closest(".ProseMirror")) {
    return null
  }

  const coordinatePosition = editor.view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  })

  if (!coordinatePosition) {
    return null
  }

  const target = findBlockTargetAtPosition(
    editor.state.doc,
    coordinatePosition.inside >= 0
      ? coordinatePosition.inside
      : coordinatePosition.pos
  )

  return target
    ? {
        ...target,
        empty: isEmptyTextBlock(target.node),
        scaffold: false,
      }
    : null
}

function findBlockTargetAtPosition(
  doc: ProseMirrorNode,
  inputPosition: number
) {
  const position = Math.max(0, Math.min(inputPosition, doc.content.size))
  const directNode = doc.nodeAt(position)

  if (directNode?.type.isInGroup("block")) {
    return { node: directNode, pos: position }
  }

  const $position = doc.resolve(position)

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.isInGroup("block")) {
      return { node, pos: $position.before(depth) }
    }
  }

  const adjacentNode = $position.nodeBefore ?? $position.nodeAfter

  if (!adjacentNode?.type.isInGroup("block")) {
    return null
  }

  return {
    node: adjacentNode,
    pos: $position.nodeBefore
      ? position - adjacentNode.nodeSize
      : position,
  }
}

function selectContextBlockTarget(
  editor: Editor,
  target: ContextBlockTarget
) {
  const { doc, selection } = editor.state
  const targetTo = target.pos + target.node.nodeSize
  const selectedRanges = getSelectedBlockRanges(doc, selection)
  const targetIsSelected =
    isNodeRangeSelection(selection) &&
    selectedRanges.some(
      (range) => target.pos >= range.from && targetTo <= range.to
    )

  if (targetIsSelected) {
    return
  }

  editor.view.dispatch(
    editor.state.tr.setSelection(
      NodeRangeSelection.create(doc, target.pos, targetTo, 0)
    )
  )
}

function isEmptyTextBlock(node: ProseMirrorNode) {
  return node.isTextblock && node.content.size === 0
}

function openBlockPickerAtEmptyTarget(
  editor: Editor,
  target: ContextBlockTarget
) {
  if (target.scaffold) {
    editor
      .chain()
      .focus()
      .insertHandoutNextCommandParagraphAfter(target.pos)
      .run()
    return
  }

  const selectionPosition = Math.min(
    target.pos + 1,
    editor.state.doc.content.size
  )

  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.near(editor.state.doc.resolve(selectionPosition), 1)
    )
  )
  editor.chain().focus().insertContent("/").run()
}
