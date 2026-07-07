import { useEffect, useRef } from "react"
import type { Editor as TiptapEditor } from "@tiptap/core"

import type {
  EditableBlockType,
  EditorVariable,
  EditorVariableType,
} from "../editor-data"
import {
  insertBlockFromCommandMenu,
  insertVariableFromCommandMenu,
  type CommandMenuState,
} from "../tiptap/command-menu"
import {
  filterCommandItems,
  filterVariableItems,
} from "../tiptap/command-menu-actions"
import { editorBlockMenuItems } from "../tiptap/block-menu-items"

export type VariablePickerState = {
  allowedTypes?: EditorVariableType[]
  left: number
  onSelect: (variable: EditorVariable) => void
  query: string
  top: number
} | null

export function QuickInsertMenu({
  editor,
  menu,
  onClose,
  onSelectedIndexChange,
  selectedIndex,
  variables,
}: {
  editor: TiptapEditor
  menu: NonNullable<CommandMenuState>
  onClose: () => void
  onSelectedIndexChange: (index: number) => void
  selectedIndex: number
  variables: EditorVariable[]
}) {
  const left = Math.max(8, Math.min(menu.left, window.innerWidth - 265))
  const top = Math.max(8, Math.min(menu.top, window.innerHeight - 332))
  const items = menu.kind === "block" ? filterCommandItems(editorBlockMenuItems, menu.query) : []
  const variableItems = menu.kind === "variable" ? filterVariableItems(variables, menu.query) : []
  const activeIndex = Math.max(
    0,
    Math.min(selectedIndex, Math.max(0, (menu.kind === "block" ? items.length : variableItems.length) - 1))
  )

  function handleInsertBlock(type: EditableBlockType) {
    insertBlockFromCommandMenu(editor, menu, type)
    onClose()
  }

  function handleInsertVariable(variable: EditorVariable) {
    insertVariableFromCommandMenu(editor, menu, variable)
    onClose()
  }

  return (
    <div
      data-lightsite-command-menu={menu.kind}
      className="fixed z-50 w-[253px] overflow-hidden rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left, top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {menu.kind === "block" ? (
        <div className="max-h-[320px] overflow-y-auto">
          {items.length > 0 ? items.map((item, index) => (
            <CommandMenuButton
              key={item.type}
              selected={index === activeIndex}
              onMouseEnter={() => onSelectedIndexChange(index)}
              onClick={() => handleInsertBlock(item.type)}
            >
              <item.icon />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </CommandMenuButton>
          )) : <CommandMenuEmpty />}
        </div>
      ) : (
        <VariableMenuList
          items={variableItems}
          selectedIndex={activeIndex}
          onSelectedIndexChange={onSelectedIndexChange}
          onSelect={handleInsertVariable}
        />
      )}
    </div>
  )
}

export function FloatingVariablePicker({
  menu,
  onClose,
  onSelectedIndexChange,
  selectedIndex,
  variables,
}: {
  menu: NonNullable<VariablePickerState>
  onClose: () => void
  onSelectedIndexChange: (index: number) => void
  selectedIndex: number
  variables: EditorVariable[]
}) {
  const left = Math.max(8, Math.min(menu.left, window.innerWidth - 265))
  const top = Math.max(8, Math.min(menu.top, window.innerHeight - 332))
  const items = filterVariableItems(variables, menu.query, menu.allowedTypes)
  const activeIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, items.length - 1)))

  function handleSelect(variable: EditorVariable) {
    menu.onSelect(variable)
    onClose()
  }

  return (
    <div
      data-lightsite-variable-picker=""
      className="fixed z-50 w-[253px] overflow-hidden rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left, top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <VariableMenuList
        items={items}
        selectedIndex={activeIndex}
        onSelectedIndexChange={onSelectedIndexChange}
        onSelect={handleSelect}
      />
    </div>
  )
}

function CommandMenuButton({
  children,
  onClick,
  onMouseEnter,
  selected,
}: {
  children: React.ReactNode
  onClick: () => void
  onMouseEnter?: () => void
  selected?: boolean
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!selected) {
      return
    }

    buttonRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-selected={selected}
      data-selected={selected ? "" : undefined}
      className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-selected:bg-accent data-selected:text-accent-foreground [&_svg]:size-3.5"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </button>
  )
}

function CommandMenuEmpty() {
  return (
    <div className="flex h-[30px] items-center px-2 py-1.5 text-sm text-muted-foreground">
      No results
    </div>
  )
}

function VariableMenuList({
  items,
  onSelectedIndexChange,
  onSelect,
  selectedIndex = 0,
}: {
  items: EditorVariable[]
  onSelectedIndexChange?: (index: number) => void
  onSelect: (variable: EditorVariable) => void
  selectedIndex?: number
}) {
  return (
    <div className="max-h-[320px] overflow-y-auto">
      {items.length > 0 ? items.map((variable, index) => (
        <CommandMenuButton
          key={variable.id}
          selected={index === selectedIndex}
          onMouseEnter={() => onSelectedIndexChange?.(index)}
          onClick={() => onSelect(variable)}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-variable-background text-[10px] font-medium text-variable-foreground">
            {"{"}
          </span>
          <span className="min-w-0 flex-1 truncate">{variable.label}</span>
        </CommandMenuButton>
      )) : <CommandMenuEmpty />}
    </div>
  )
}
