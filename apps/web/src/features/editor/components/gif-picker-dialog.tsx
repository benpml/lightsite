import { Grid } from "@giphy/react-components"
import { IconSearch } from "@tabler/icons-react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import type { Editor } from "@tiptap/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import {
  createHandoutGifSelection,
  createHandoutGiphyFetchGifs,
  hasHandoutGiphyApiKey,
  handoutGiphyAttributionAssetPaths,
  handoutGiphyClient,
} from "../tiptap/giphy"
import type { HandoutNextGifPickerTarget } from "../tiptap/extensions/gif-picker"

type EditorGifPickerDialogProps = {
  editor: Editor
}

type GifPickerStorage = {
  subscribe: (listener: (target: HandoutNextGifPickerTarget) => void) => () => void
}

export function EditorGifPickerDialog({ editor }: EditorGifPickerDialogProps) {
  const [target, setTarget] = useState<HandoutNextGifPickerTarget | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const gridResizeObserverRef = useRef<ResizeObserver | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const open = target !== null

  const close = useCallback(() => {
    setTarget(null)
    setQuery("")
    setDebouncedQuery("")
    setGridWidth(0)
    editor.commands.focus()
  }, [editor])

  const setGridContainer = useCallback((gridContainer: HTMLDivElement | null) => {
    gridResizeObserverRef.current?.disconnect()
    gridResizeObserverRef.current = null

    if (!gridContainer) {
      return
    }

    const updateWidth = (width: number) => {
      const nextWidth = Math.floor(width)

      if (nextWidth > 0) {
        setGridWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth
        )
      }
    }

    updateWidth(gridContainer.getBoundingClientRect().width)

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        updateWidth(entry.contentRect.width)
      }
    })
    observer.observe(gridContainer)
    gridResizeObserverRef.current = observer
  }, [])

  useEffect(() => {
    const storage = (
      editor.storage as unknown as { handoutNextGifPicker?: GifPickerStorage }
    ).handoutNextGifPicker

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

  const fetchGifs = useMemo(() => {
    if (!hasHandoutGiphyApiKey) {
      return null
    }

    return createHandoutGiphyFetchGifs(debouncedQuery)
  }, [debouncedQuery])

  const columns = gridWidth >= 840 ? 4 : gridWidth >= 560 ? 3 : 2
  const gridKey = debouncedQuery || "trending"

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
        className="handout-editor-gif-picker grid h-[min(720px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-[960px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[960px]"
      >
        <DialogHeader className="handout-editor-gif-picker-header gap-3 px-4 pt-4 pb-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Select GIF</DialogTitle>
            <DialogDescription>Search GIPHY and choose a GIF for this block.</DialogDescription>
          </div>
          <InputGroup size="xl">
            <InputGroupAddon>
              <IconSearch aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search GIFs"
              autoFocus
              maxLength={HANDOUT_TEXT_LIMITS.gifSearchQuery}
              placeholder="Search GIFs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </DialogHeader>

        <div className="handout-editor-gif-picker-results min-h-0 overflow-y-auto px-4 py-4">
          {fetchGifs && handoutGiphyClient ? (
            <div ref={setGridContainer} className="w-full">
              {gridWidth > 0 ? (
                <Grid
                  key={gridKey}
                  columns={columns}
                  fetchGifs={fetchGifs}
                  gutter={12}
                  hideAttribution
                  noLink
                  noResultsMessage={
                    <div className="handout-editor-gif-picker-empty flex h-32 items-center justify-center rounded-xl border border-dashed text-sm">
                      No GIFs found
                    </div>
                  }
                  width={gridWidth}
                  onGifClick={(gif, event) => {
                    event.preventDefault()
                    const activeTarget = target
                    const selection = createHandoutGifSelection(gif)

                    if (!activeTarget || !selection.src) {
                      return
                    }

                    editor.chain().focus().setHandoutNextGif(activeTarget.pos, selection).run()
                    close()
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div className="handout-editor-gif-picker-empty flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm">
              Add VITE_GIPHY_API_KEY to enable GIF search in the editor.
            </div>
          )}
        </div>

        <div
          className={cn(
            "handout-editor-gif-picker-footer flex h-11 items-center px-4",
            hasHandoutGiphyApiKey ? "justify-start" : "justify-end"
          )}
        >
          {hasHandoutGiphyApiKey ? (
            <>
              <img
                alt="Powered by GIPHY"
                className="h-5 w-auto object-contain dark:hidden"
                src={handoutGiphyAttributionAssetPaths.light}
              />
              <img
                alt="Powered by GIPHY"
                className="hidden h-5 w-auto object-contain dark:block"
                src={handoutGiphyAttributionAssetPaths.dark}
              />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
