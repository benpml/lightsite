import { IconExternalLink, IconVideo } from "@tabler/icons-react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useCallback, type KeyboardEvent, type MouseEvent } from "react"

import { getVideoEmbedHost } from "../../lib/video-embed-url"

export function VideoEmbedView({ editor, getPos, node }: NodeViewProps) {
  const src = stringAttr(node.attrs.src, "")
  const provider = stringAttr(node.attrs.provider, "")
  const host = src ? getVideoEmbedHost(src) : ""
  const label = provider || host || "Video"
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
        .openLightsiteNextVideoEmbedSettings(pos, src ? "edit" : "create")
        .run()
    },
    [editor, getPos, src]
  )

  return (
    <NodeViewWrapper
      as="figure"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="video-embed"
      className="lightsite-next-video-embed-shell"
    >
      {src ? (
        <div className="lightsite-next-video-embed">
          <div className="lightsite-next-video-embed-toolbar" contentEditable={false}>
            <div className="lightsite-next-video-embed-meta">
              <IconVideo aria-hidden="true" />
              <span>{label}</span>
            </div>
            <button
              className="lightsite-next-video-embed-edit"
              type="button"
              onClick={openSettings}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <IconExternalLink aria-hidden="true" />
              Edit video
            </button>
          </div>
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="lightsite-next-video-embed-frame"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={src}
            title={provider ? `${provider} video` : "Video"}
          />
        </div>
      ) : (
        <button
          className="lightsite-next-video-embed-empty"
          contentEditable={false}
          type="button"
          onClick={openSettings}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <IconVideo aria-hidden="true" />
          <span className="lightsite-next-video-embed-empty-title">Add video embed</span>
          <span className="lightsite-next-video-embed-empty-description">
            Paste a YouTube, Vimeo, Loom, or iframe embed code
          </span>
        </button>
      )}
    </NodeViewWrapper>
  )
}

function stringAttr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback
}
