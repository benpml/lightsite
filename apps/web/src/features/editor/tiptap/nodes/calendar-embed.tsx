import { ReactNodeViewRenderer } from "@tiptap/react"
import { SiteCalendarEmbed } from "@lightsite/site-document"

import { CalendarEmbedView } from "./calendar-embed-view"

export const CalendarEmbed = SiteCalendarEmbed.extend({
  addNodeView: () => ReactNodeViewRenderer(CalendarEmbedView),
})
