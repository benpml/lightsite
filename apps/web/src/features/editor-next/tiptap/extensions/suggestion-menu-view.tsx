import type { SuggestionKeyDownProps } from "@tiptap/suggestion"
import type React from "react"
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

export type LightsiteNextSuggestionMenuHandle = {
  isPointerInside: () => boolean
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export type LightsiteNextSuggestionMenuProps<TItem> = {
  command: (item: TItem) => void
  getCategory?: (item: TItem) => string | null | undefined
  getDescription: (item: TItem) => string
  getIcon?: (item: TItem) => React.ComponentType<{ "aria-hidden"?: boolean }>
  getLabel: (item: TItem) => string
  getLeadingVisual?: (item: TItem) => string
  getTone?: (item: TItem) => "default" | "primary" | "variable"
  items: TItem[]
  onPointerLeaveMenu: () => void
  query: string
}

function LightsiteNextSuggestionMenuComponent<TItem>(
  {
    command,
    getCategory,
    getIcon,
    getLabel,
    getLeadingVisual,
    getTone,
    items,
    onPointerLeaveMenu,
    query,
  }: LightsiteNextSuggestionMenuProps<TItem>,
  ref: React.ForwardedRef<LightsiteNextSuggestionMenuHandle>
) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pointerInsideRef = useRef(false)
  const [menuState, setMenuState] = useState({
    activeIndex: 0,
    query,
  })
  const activeIndex =
    menuState.query === query
      ? Math.min(menuState.activeIndex, Math.max(items.length - 1, 0))
      : 0

  const setActiveItem = useCallback((nextIndex: number) => {
    setMenuState({
      activeIndex: nextIndex,
      query,
    })
  }, [query])

  useLayoutEffect(() => {
    positionMenuWrapper(menuRef.current)
    const frame = window.requestAnimationFrame(() => positionMenuWrapper(menuRef.current))

    return () => window.cancelAnimationFrame(frame)
  }, [items.length, query])

  useLayoutEffect(() => {
    const activeItem = itemRefs.current[activeIndex]

    if (!activeItem) {
      return
    }

    activeItem.scrollIntoView({ block: "nearest" })
  }, [activeIndex, items.length])

  useImperativeHandle(
    ref,
    () => ({
      isPointerInside() {
        return pointerInsideRef.current
      },
      onKeyDown({ event }) {
        if (items.length === 0) {
          return false
        }

        if (event.key === "ArrowDown") {
          setActiveItem((activeIndex + 1) % items.length)
          return true
        }

        if (event.key === "ArrowUp") {
          setActiveItem((activeIndex - 1 + items.length) % items.length)
          return true
        }

        if (event.key === "Home") {
          setActiveItem(0)
          return true
        }

        if (event.key === "End") {
          setActiveItem(items.length - 1)
          return true
        }

        if (event.key === "Enter" || event.key === "Tab") {
          command(items[activeIndex])
          return true
        }

        return false
      },
    }),
    [activeIndex, command, items, setActiveItem]
  )

  const markPointerInside = useCallback(() => {
    pointerInsideRef.current = true
  }, [])

  const markPointerOutside = useCallback(() => {
    pointerInsideRef.current = false
    onPointerLeaveMenu()
  }, [onPointerLeaveMenu])

  if (items.length === 0) {
    return (
      <div
        ref={menuRef}
        className="lightsite-next-suggestion-menu"
        data-interaction="keyboard"
        role="listbox"
        onMouseDown={preventMenuMouseDown}
        onPointerEnter={markPointerInside}
        onPointerLeave={markPointerOutside}
        onPointerDown={stopMenuPointerDown}
      >
        <div className="lightsite-next-suggestion-empty">No matches</div>
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      className="lightsite-next-suggestion-menu"
      data-interaction="keyboard"
      role="listbox"
      onMouseDown={preventMenuMouseDown}
      onPointerEnter={markPointerInside}
      onPointerLeave={markPointerOutside}
      onPointerDown={stopMenuPointerDown}
    >
      {items.map((item, index) => {
        const category = getCategory?.(item) ?? null
        const previousCategory = index > 0 ? (getCategory?.(items[index - 1]) ?? null) : null
        const showCategory = Boolean(category && category !== previousCategory)
        const separateCategory = showCategory && index > 0
        const label = getLabel(item)
        const Icon = getIcon?.(item)
        const leadingVisual = getLeadingVisual?.(item)
        const tone = getTone?.(item) ?? "default"
        const active = index === activeIndex

        return (
          <div key={`${label}:${index}`}>
            {showCategory ? (
              <div
                className="lightsite-next-suggestion-category"
                data-separated={separateCategory ? "true" : "false"}
              >
                {category}
              </div>
            ) : null}
            <button
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              aria-selected={active}
              className="lightsite-next-suggestion-item"
              data-active={active ? "true" : "false"}
              data-tone={tone}
              role="option"
              type="button"
              onClick={() => command(item)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveItem(index)}
              onMouseOver={() => setActiveItem(index)}
              onPointerEnter={() => setActiveItem(index)}
            >
              {Icon ? (
                <span className="lightsite-next-suggestion-icon">
                  <Icon aria-hidden />
                </span>
              ) : null}
              {leadingVisual ? (
                <span className="lightsite-next-suggestion-leading">{leadingVisual}</span>
              ) : null}
              <span className="lightsite-next-suggestion-copy">
                <span className="lightsite-next-suggestion-label">{label}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function preventMenuMouseDown(event: React.MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function stopMenuPointerDown(event: React.PointerEvent) {
  event.stopPropagation()
}

function positionMenuWrapper(menu: HTMLDivElement | null) {
  const wrapper = menu?.parentElement
  const anchor = document.querySelector(".suggestion")

  if (!menu || !wrapper || !(anchor instanceof HTMLElement)) {
    return
  }

  const anchorRect = anchor.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const menuHeight = menuRect.height || 288
  const belowTop = anchorRect.bottom + 6
  const aboveTop = anchorRect.top - menuHeight - 6
  const fitsBelow = belowTop + menuHeight <= window.innerHeight - 8
  const top = fitsBelow ? belowTop : aboveTop

  wrapper.style.display = "block"
  wrapper.style.position = "fixed"
  wrapper.style.left = `${Math.max(8, Math.min(anchorRect.left, window.innerWidth - 312))}px`
  wrapper.style.top = `${Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8))}px`
  wrapper.style.width = "fit-content"
  wrapper.style.zIndex = "50"
}

export const LightsiteNextSuggestionMenuView = forwardRef(
  LightsiteNextSuggestionMenuComponent
) as <TItem>(
  props: LightsiteNextSuggestionMenuProps<TItem> & {
    ref?: React.ForwardedRef<LightsiteNextSuggestionMenuHandle>
  }
) => React.ReactElement
