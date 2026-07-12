import { ReactNodeViewRenderer } from "@tiptap/react"
import { SiteVideoEmbed } from "@lightsite/site-document"

import { VideoEmbedView } from "./video-embed-view"

export const VideoEmbed = SiteVideoEmbed.extend({
  addNodeView: () => ReactNodeViewRenderer(VideoEmbedView),
})
