import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

export function findFirstTextSelectionPosition(node: ProseMirrorNode | null, pos: number) {
  if (!node) {
    return pos
  }

  if (node.isTextblock) {
    return pos + 1
  }

  let found: number | null = null

  node.descendants((child, childPos) => {
    if (found !== null || !child.isTextblock) {
      return found === null
    }

    found = pos + childPos + 1
    return false
  })

  return found ?? pos + 1
}
