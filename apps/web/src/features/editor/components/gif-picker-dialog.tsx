import { Grid } from "@giphy/react-components"
import { IconSearch } from "@tabler/icons-react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  createLightsiteGifSelection,
  createLightsiteGiphyFetchGifs,
  hasLightsiteGiphyApiKey,
  lightsiteGiphyAttributionAssetPath,
  lightsiteGiphyClient,
} from "../tiptap/giphy"
import type { LightsiteNextGifPickerTarget } from "../tiptap/extensions/gif-picker"

type EditorGifPickerDialogProps = {
  editor: Editor
}

type GifPickerStorage = {
  subscribe: (listener: (target: LightsiteNextGifPickerTarget) => void) => () => void
}

export function EditorGifPickerDialog({ editor }: EditorGifPickerDialogProps) {
  const [target, setTarget] = useState<LightsiteNextGifPickerTarget | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridWidth, setGridWidth] = useState(864)
  const open = target !== null

  const close = useCallback(() => {
    setTarget(null)
    setQuery("")
    setDebouncedQuery("")
    editor.commands.focus()
  }, [editor])

  useEffect(() => {
    const storage = (
      editor.storage as unknown as { lightsiteNextGifPicker?: GifPickerStorage }
    ).lightsiteNextGifPicker

    if (!storage) {
      return
    }

    return storage.subscribe((nextTarget) => {
      setTarget(nextTarget)
      setQuery("")
      setDebouncedQuery("")
    })
  }, [editor])

  useEffect(() => {
    if (!open) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [open, query])

  useEffect(() => {
    if (!open) {
      return
    }

    const gridContainer = gridContainerRef.current

    if (!gridContainer) {
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.floor(gridContainer.clientWidth)

      if (nextWidth > 0) {
        setGridWidth(nextWidth)
      }
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(gridContainer)

    return () => observer.disconnect()
  }, [open])

  const fetchGifs = useMemo(() => {
    if (!hasLightsiteGiphyApiKey) {
      return null
    }

    return createLightsiteGiphyFetchGifs(debouncedQuery)
  }, [debouncedQuery])

  const columns = gridWidth >= 840 ? 4 : gridWidth >= 560 ? 3 : 2
  const gridKey = `${debouncedQuery || "trending"}:${columns}:${gridWidth}`

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close()
        }
      }}
    >
      <DialogContent
        showCloseButton
        className="lightsite-editor-gif-picker grid h-[min(720px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-[960px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[960px]"
      >
        <DialogHeader className="lightsite-editor-gif-picker-header gap-3 px-4 pt-4 pb-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Select GIF</DialogTitle>
            <DialogDescription>Search GIPHY and choose a GIF for this block.</DialogDescription>
          </div>
          <label className="relative block">
            <IconSearch
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              autoFocus
              className="lightsite-editor-gif-picker-search h-10 pl-9"
              maxLength={LIGHTSITE_TEXT_LIMITS.gifSearchQuery}
              placeholder="Search GIFs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </DialogHeader>

        <div ref={gridContainerRef} className="lightsite-editor-gif-picker-results min-h-0 overflow-y-auto px-4 py-4">
          {fetchGifs && lightsiteGiphyClient ? (
            <Grid
              key={gridKey}
              columns={columns}
              fetchGifs={fetchGifs}
              gutter={12}
              hideAttribution
              noLink
              noResultsMessage={
                <div className="lightsite-editor-gif-picker-empty flex h-32 items-center justify-center rounded-xl border border-dashed text-sm">
                  No GIFs found
                </div>
              }
              width={gridWidth}
              onGifClick={(gif, event) => {
                event.preventDefault()
                const activeTarget = target
                const selection = createLightsiteGifSelection(gif)

                if (!activeTarget || !selection.src) {
                  return
                }

                editor.chain().focus().setLightsiteNextGif(activeTarget.pos, selection).run()
                close()
              }}
            />
          ) : (
            <div className="lightsite-editor-gif-picker-empty flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm">
              Add VITE_GIPHY_API_KEY to enable GIF search in the editor.
            </div>
          )}
        </div>

        <div
          className={cn(
            "lightsite-editor-gif-picker-footer flex h-11 items-center px-4",
            hasLightsiteGiphyApiKey ? "justify-start" : "justify-end"
          )}
        >
          {hasLightsiteGiphyApiKey ? (
            <img
              alt="Powered by GIPHY"
              className="h-5 w-auto object-contain"
              src={lightsiteGiphyAttributionAssetPath}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
