import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { VideoEmbedView } from "./video-embed-view"

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      provider: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-provider") ?? "",
        renderHTML: (attributes) => ({ "data-provider": attributes.provider }),
      },
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src") ?? "",
        renderHTML: (attributes) => ({ "data-src": attributes.src }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-lightsite-video-embed=""]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = typeof node.attrs.src === "string" ? node.attrs.src : ""
    const provider = typeof node.attrs.provider === "string" ? node.attrs.provider : ""

    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-lightsite-video-embed": "",
        "data-provider": provider,
      }),
      src
        ? [
            "iframe",
            {
              allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
              allowfullscreen: "true",
              loading: "lazy",
              referrerpolicy: "strict-origin-when-cross-origin",
              src,
              title: provider ? `${provider} video` : "Video",
            },
          ]
        : ["div", { "data-lightsite-video-embed-empty": "" }],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView)
  },
})
