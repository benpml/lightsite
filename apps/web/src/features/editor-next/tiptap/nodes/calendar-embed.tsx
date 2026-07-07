import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { CalendarEmbedView } from "./calendar-embed-view"

export const CalendarEmbed = Node.create({
  name: "calendarEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src") ?? "",
        renderHTML: (attributes) => ({ "data-src": attributes.src }),
      },
      height: {
        default: 420,
        parseHTML: (element) => normalizeHeight(element.getAttribute("data-height")),
        renderHTML: (attributes) => ({ "data-height": normalizeHeight(attributes.height) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-lightsite-calendar-embed=""]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = typeof node.attrs.src === "string" ? node.attrs.src : ""
    const height = normalizeHeight(node.attrs.height)

    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-height": height,
        "data-lightsite-calendar-embed": "",
      }),
      src
        ? [
            "iframe",
            {
              allow: "fullscreen",
              loading: "lazy",
              referrerpolicy: "no-referrer-when-downgrade",
              src,
              style: `height: ${height}px`,
              title: "Calendar",
            },
          ]
        : ["div", { "data-lightsite-calendar-embed-empty": "" }],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalendarEmbedView)
  },
})

function normalizeHeight(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 420

  if (!Number.isFinite(parsed)) {
    return 420
  }

  return Math.min(Math.max(Math.round(parsed), 260), 900)
}
