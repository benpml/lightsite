import { IconCalendarEvent, IconExternalLink } from "@tabler/icons-react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import {
  useCallback,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { getEmbedUrlHost } from "../../lib/embed-url"

const CALENDAR_EMBED_DEFAULT_HEIGHT = 420
const CALENDAR_EMBED_MIN_HEIGHT = 260
const CALENDAR_EMBED_MAX_HEIGHT = 900

export function CalendarEmbedView({ editor, getPos, node }: NodeViewProps) {
  const src = stringAttr(node.attrs.src, "")
  const host = src ? getEmbedUrlHost(src) : ""
  const height = numberAttr(node.attrs.height, CALENDAR_EMBED_DEFAULT_HEIGHT)
  const embedRef = useRef<HTMLDivElement | null>(null)
  const openSettings = useCallback(
    (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      const pos = typeof getPos === "function" ? getPos() : undefined

      if (typeof pos !== "number") {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      editor
        .chain()
        .focus()
        .openLightsiteNextCalendarEmbedSettings(pos, src ? "edit" : "create")
        .run()
    },
    [editor, getPos, src]
  )
  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return
      }

      const pos = typeof getPos === "function" ? getPos() : undefined

      if (typeof pos !== "number") {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      editor.chain().focus().setNodeSelection(pos).run()

      const startY = event.clientY
      const startHeight = height
      const element = embedRef.current
      let nextHeight = startHeight

      element?.setAttribute("data-resizing", "true")

      const commitHeight = () => {
        element?.removeAttribute("data-resizing")
        document.removeEventListener("pointermove", resize)
        document.removeEventListener("pointerup", stopResize)
        document.removeEventListener("pointercancel", stopResize)

        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes("calendarEmbed", { height: nextHeight })
          .run()
      }

      const resize = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault()
        nextHeight = clampHeight(startHeight + moveEvent.clientY - startY)

        if (element) {
          element.style.setProperty("--lightsite-calendar-embed-height", `${nextHeight}px`)
        }
      }

      const stopResize = (upEvent: PointerEvent) => {
        upEvent.preventDefault()
        commitHeight()
      }

      document.addEventListener("pointermove", resize)
      document.addEventListener("pointerup", stopResize)
      document.addEventListener("pointercancel", stopResize)
    },
    [editor, getPos, height]
  )

  return (
    <NodeViewWrapper
      as="figure"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="calendar-embed"
      className="lightsite-next-calendar-embed-shell"
    >
      {src ? (
        <div
          ref={embedRef}
          className="lightsite-next-calendar-embed"
          style={
            {
              "--lightsite-calendar-embed-height": `${height}px`,
            } as React.CSSProperties
          }
        >
          <div className="lightsite-next-calendar-embed-toolbar" contentEditable={false}>
            <div className="lightsite-next-calendar-embed-meta">
              <IconCalendarEvent aria-hidden="true" />
              <span>{host || "Calendar"}</span>
            </div>
            <button
              className="lightsite-next-calendar-embed-edit"
              type="button"
              onClick={openSettings}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <IconExternalLink aria-hidden="true" />
              Edit embed
            </button>
          </div>
          <iframe
            className="lightsite-next-calendar-embed-frame"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={src}
            title="Calendar"
          />
          <button
            aria-label="Resize calendar embed vertically"
            className="lightsite-next-calendar-embed-resize"
            contentEditable={false}
            type="button"
            onPointerDown={startResize}
          />
        </div>
      ) : (
        <button
          className="lightsite-next-calendar-embed-empty"
          contentEditable={false}
          type="button"
          onClick={openSettings}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <IconCalendarEvent aria-hidden="true" />
          <span className="lightsite-next-calendar-embed-empty-title">Add calendar embed</span>
          <span className="lightsite-next-calendar-embed-empty-description">
            Paste a calendar scheduling link or iframe code
          </span>
        </button>
      )}
    </NodeViewWrapper>
  )
}

function stringAttr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback
}

function numberAttr(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return clampHeight(parsed)
}

function clampHeight(value: number) {
  return Math.min(Math.max(Math.round(value), CALENDAR_EMBED_MIN_HEIGHT), CALENDAR_EMBED_MAX_HEIGHT)
}
