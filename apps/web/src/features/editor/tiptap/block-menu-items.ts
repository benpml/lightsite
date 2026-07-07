import type { ComponentType } from "react"
import {
  IconBrandSlack,
  IconCalendarEvent,
  IconClick,
  IconGif,
  IconH1,
  IconH2,
  IconId,
  IconLayoutRows,
  IconList,
  IconListDetails,
  IconListNumbers,
  IconPhoto,
  IconQuote,
  IconScan,
  IconStars,
  IconTextSize,
  IconVideo,
} from "@tabler/icons-react"

import type { EditableBlockType } from "../editor-data"

export type EditorBlockMenuItem = {
  type: EditableBlockType
  label: string
  icon: ComponentType<{ className?: string }>
}

export const editorBlockMenuItems: EditorBlockMenuItem[] = [
  { type: "text", label: "Text", icon: IconTextSize },
  { type: "title", label: "Heading 1", icon: IconH1 },
  { type: "heading", label: "Heading 2", icon: IconH2 },
  { type: "divider", label: "Divider", icon: IconScan },
  { type: "bullet-list", label: "Bullet List", icon: IconList },
  { type: "number-list", label: "Number List", icon: IconListNumbers },
  { type: "icon-list", label: "Icon List", icon: IconListDetails },
  { type: "image", label: "Image", icon: IconPhoto },
  { type: "gif", label: "GIF", icon: IconGif },
  { type: "video", label: "Video", icon: IconVideo },
  { type: "icon-card", label: "Icon Card", icon: IconStars },
  { type: "image-card", label: "Image Card", icon: IconId },
  { type: "accordion", label: "Accordion", icon: IconLayoutRows },
  { type: "button", label: "Button", icon: IconClick },
  { type: "calendar", label: "Calendar", icon: IconCalendarEvent },
  { type: "logo-grid", label: "Logo Grid", icon: IconBrandSlack },
  { type: "testimonial", label: "Testimonial", icon: IconQuote },
]
