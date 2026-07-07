import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Grid } from "@giphy/react-components"
import { IconSearch } from "@tabler/icons-react"

import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  createGifSelection,
  createGiphyFetchGifs,
  giphyAttributionAssetPath,
  giphyClient,
  hasGiphyApiKey,
  type EditorGifSelection,
} from "../giphy"

type GifPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (selection: EditorGifSelection) => void
}

export function GifPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: GifPickerDialogProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridWidth, setGridWidth] = useState(864)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("")
      setDebouncedQuery("")
    }

    onOpenChange(nextOpen)
  }, [onOpenChange])

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
    if (!hasGiphyApiKey) {
      return null
    }

    return createGiphyFetchGifs(debouncedQuery)
  }, [debouncedQuery])

  const columns = gridWidth >= 840 ? 4 : gridWidth >= 560 ? 3 : 2
  const gridKey = `${debouncedQuery || "trending"}:${columns}:${gridWidth}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="grid h-[min(720px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-[960px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[960px]"
      >
        <DialogHeader className="gap-3 border-b px-4 pt-4 pb-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Select GIF</DialogTitle>
            <DialogDescription>
              Search GIPHY and choose a GIF for this block.
            </DialogDescription>
          </div>
          <label className="relative block">
            <IconSearch
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              placeholder="Search GIFs"
              value={query}
              className="h-10 pl-9"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </DialogHeader>
        <div
          ref={gridContainerRef}
          className="min-h-0 overflow-y-auto px-4 py-4"
        >
          {fetchGifs && giphyClient ? (
            <Grid
              key={gridKey}
              columns={columns}
              width={gridWidth}
              gutter={12}
              noLink
              hideAttribution
              fetchGifs={fetchGifs}
              noResultsMessage={
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  No GIFs found
                </div>
              }
              onGifClick={(gif, event) => {
                event.preventDefault()
                const selection = createGifSelection(gif)

                if (!selection.src) {
                  return
                }

                onSelect(selection)
                handleOpenChange(false)
              }}
            />
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 text-center text-sm text-muted-foreground">
              Add `VITE_GIPHY_API_KEY` to enable GIF search in the editor.
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 items-center border-t px-4",
            hasGiphyApiKey ? "justify-start" : "justify-end"
          )}
        >
          {hasGiphyApiKey ? (
            <img
              src={giphyAttributionAssetPath}
              alt="Powered by GIPHY"
              className="h-5 w-auto object-contain"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
