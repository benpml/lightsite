import type { Editor, Range } from "@tiptap/core"
import { Extension } from "@tiptap/core"
import { EmojiSuggestionPluginKey, type EmojiItem } from "@tiptap/extension-emoji"
import { isChangeOrigin } from "@tiptap/extension-collaboration"
import { Fragment } from "@tiptap/pm/model"
import { PluginKey, type EditorState } from "@tiptap/pm/state"
import { ReactRenderer } from "@tiptap/react"
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion"
import { RESERVED_SITE_VARIABLE_IDS } from "@handout/site-document"
import {
  IconBlockquote,
  IconCalendarEvent,
  IconChecklist,
  IconClick,
  IconCode,
  IconCodeAsterisk,
  IconGif,
  IconGridDots,
  IconH1,
  IconH2,
  IconH3,
  IconBadge,
  IconLayoutGrid,
  IconLayoutNavbar,
  IconList,
  IconListDetails,
  IconListNumbers,
  IconMessage,
  IconMoodSmile,
  IconPhoto,
  IconPhotoAlt,
  IconPilcrow,
  IconCirclePlus,
  IconSeparatorHorizontal,
  IconTable,
  IconVideo,
} from "@tabler/icons-react"
import type React from "react"

import { createInsertedBlockContent, setSelectionInsideInsertedContent } from "./block-commands"
import {
  HandoutNextSuggestionMenuView,
  type HandoutNextSuggestionMenuHandle,
  type HandoutNextSuggestionMenuProps,
} from "./suggestion-menu-view"
import type {
  HandoutNextBlockType,
  HandoutVariableOption,
  HandoutVariableValueMap,
} from "../schema"
import {
  createHandoutVariableId,
  getHandoutVariableStorage,
  getUniqueHandoutVariableSlug,
  normalizeHandoutVariableName,
} from "../variable-state"

type MenuItem = {
  category: "Text" | "Lists" | "Cards and actions" | "Media" | "Structure"
  icon: typeof IconPilcrow
  id: HandoutNextBlockType
  label: string
  description: string
}

const slashPluginKey = new PluginKey("handoutNextSlash")
const variablePluginKey = new PluginKey("handoutNextVariable")
let activeSuggestionMenu:
  | {
      close: () => void
      owner: symbol
    }
  | null = null

type VariableMenuItem =
  | {
      icon: typeof IconCodeAsterisk
      type: "variable"
      variable: HandoutVariableOption
    }
  | {
      icon: typeof IconCirclePlus
      name: string
      type: "create"
    }

export type HandoutNextVariableCreatorTarget = {
  name: string
  range: Range
}

type HandoutNextVariableStorage = {
  activeVariantId: string
  definitions: HandoutVariableOption[]
  openCreator: (target: HandoutNextVariableCreatorTarget) => void
  subscribeCreator: (listener: (target: HandoutNextVariableCreatorTarget) => void) => () => void
  values: HandoutVariableValueMap
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    handoutNextVariables: {
      createAndInsertHandoutVariable: (
        range: Range,
        attrs: {
          defaultValue?: string
          description?: string
          name: string
        }
      ) => ReturnType
      createHandoutVariable: (attrs: {
        defaultValue?: string
        description?: string
        name: string
      }) => ReturnType
      openHandoutVariableCreator: (name: string, range: Range) => ReturnType
      setHandoutVariableDefinition: (
        variableId: string,
        attrs: Partial<Pick<HandoutVariableOption, "defaultValue" | "description" | "name">>
      ) => ReturnType
      setHandoutVariableScope: (
        scopeId: string,
        values: Record<string, string>
      ) => ReturnType
      setHandoutVariableValue: (variableId: string, value: string) => ReturnType
    }
  }
}

const slashItems: MenuItem[] = [
  {
    category: "Text",
    description: "Plain paragraph",
    icon: IconPilcrow,
    id: "paragraph",
    label: "Text",
  },
  {
    category: "Text",
    description: "Large section heading",
    icon: IconH1,
    id: "heading1",
    label: "Heading 1",
  },
  {
    category: "Text",
    description: "Compact heading",
    icon: IconH2,
    id: "heading2",
    label: "Heading 2",
  },
  {
    category: "Text",
    description: "Inline-weight heading",
    icon: IconH3,
    id: "heading3",
    label: "Heading 3",
  },
  {
    category: "Text",
    description: "Call out a quoted idea",
    icon: IconBlockquote,
    id: "blockquote",
    label: "Quote",
  },
  {
    category: "Text",
    description: "Preformatted code",
    icon: IconCode,
    id: "codeBlock",
    label: "Code block",
  },
  {
    category: "Text",
    description: "Inline Tiptap emoji node",
    icon: IconMoodSmile,
    id: "emoji",
    label: "Emoji",
  },
  {
    category: "Structure",
    description: "Page title with logos",
    icon: IconLayoutNavbar,
    id: "pageTitle",
    label: "Page title",
  },
  {
    category: "Lists",
    description: "Native unordered list",
    icon: IconList,
    id: "bulletList",
    label: "Bullet list",
  },
  {
    category: "Lists",
    description: "Native ordered list",
    icon: IconListNumbers,
    id: "orderedList",
    label: "Numbered list",
  },
  {
    category: "Lists",
    description: "Track mutual next steps",
    icon: IconChecklist,
    id: "taskList",
    label: "Task list",
  },
  {
    category: "Lists",
    description: "Editable custom list",
    icon: IconListDetails,
    id: "iconList",
    label: "Icon list",
  },
  {
    category: "Cards and actions",
    description: "Image with editable copy",
    icon: IconPhotoAlt,
    id: "imageCard",
    label: "Image card",
  },
  {
    category: "Cards and actions",
    description: "Card with icon and copy",
    icon: IconBadge,
    id: "iconCard",
    label: "Icon card",
  },
  {
    category: "Cards and actions",
    description: "Customer quote with author",
    icon: IconMessage,
    id: "testimonial",
    label: "Testimonial",
  },
  {
    category: "Cards and actions",
    description: "Grid of customer logos",
    icon: IconGridDots,
    id: "logoGrid",
    label: "Logo grid",
  },
  {
    category: "Cards and actions",
    description: "Add a clickable link",
    icon: IconClick,
    id: "button",
    label: "Button",
  },
  {
    category: "Media",
    description: "Native resizable image",
    icon: IconPhoto,
    id: "image",
    label: "Image",
  },
  {
    category: "Media",
    description: "Animated media block",
    icon: IconGif,
    id: "gif",
    label: "GIF",
  },
  {
    category: "Media",
    description: "Embed a booking calendar",
    icon: IconCalendarEvent,
    id: "calendar",
    label: "Calendar",
  },
  {
    category: "Media",
    description: "Embed hosted video",
    icon: IconVideo,
    id: "video",
    label: "Video",
  },
  {
    category: "Structure",
    description: "Columns or rows of blocks",
    icon: IconLayoutGrid,
    id: "grid",
    label: "Grid",
  },
  {
    category: "Structure",
    description: "Rows and columns of content",
    icon: IconTable,
    id: "table",
    label: "Table",
  },
  {
    category: "Structure",
    description: "Horizontal rule",
    icon: IconSeparatorHorizontal,
    id: "divider",
    label: "Divider",
  },
]

export const HandoutNextSlashCommands = Extension.create({
  name: "handoutNextSlashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<MenuItem, MenuItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowSpaces: true,
        allowedPrefixes: null,
        startOfLine: false,
        shouldShow: ({ transaction }) => !isChangeOrigin(transaction),
        allow: ({ state, range }) =>
          state.doc.resolve(range.from).parent.type.name === "paragraph" &&
          isLatestHandoutSuggestionTrigger(state, range),
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          replaceRangeWithBlock(editor, range, props.id)
        },
        render: () => createSuggestionMenu<MenuItem>({
          getCategory: (item) => item.category,
          getLabel: (item) => item.label,
          getDescription: (item) => item.description,
          getIcon: (item) => item.icon,
          pluginKey: slashPluginKey,
        }),
      }),
    ]
  },
})

export const HandoutNextVariables = Extension.create<
{
  activeVariantId: string
  values: HandoutVariableValueMap
  variables: HandoutVariableOption[]
},
HandoutNextVariableStorage
>({
  name: "handoutNextVariables",

  addOptions() {
    return { activeVariantId: "default", values: {}, variables: [] }
  },

  addStorage() {
    const creatorListeners = new Set<(target: HandoutNextVariableCreatorTarget) => void>()

    return {
      activeVariantId: this.options.activeVariantId,
      definitions: [...this.options.variables],
      openCreator: (target) => {
        creatorListeners.forEach((listener) => listener(target))
      },
      subscribeCreator: (listener) => {
        creatorListeners.add(listener)

        return () => {
          creatorListeners.delete(listener)
        }
      },
      values: { ...this.options.values },
    }
  },

  addCommands() {
    return {
      createAndInsertHandoutVariable:
        (range, attrs) =>
        ({ commands, editor }) => {
          const variable = createVariableDefinition(editor, attrs, false)

          if (!variable) {
            return false
          }

          return commands.insertContentAt(range, {
            type: "variableToken",
            attrs: { fallbackName: variable.name, variableId: variable.id },
          })
        },
      createHandoutVariable:
        (attrs) =>
        ({ editor }) => {
          return Boolean(createVariableDefinition(editor, attrs))
        },
      openHandoutVariableCreator:
        (name, range) =>
        () => {
          this.storage.openCreator({
            name: normalizeHandoutVariableName(name),
            range,
          })
          return true
        },
      setHandoutVariableDefinition:
        (variableId, attrs) =>
        ({ editor }) => {
          const storage = getHandoutVariableStorage(editor)
          const current = storage.definitions.find((definition) => definition.id === variableId)

          if (!current) {
            return false
          }

          const systemVariable = RESERVED_SITE_VARIABLE_IDS.has(variableId)
          const nextName = systemVariable || attrs.name === undefined
            ? current.name
            : normalizeHandoutVariableName(attrs.name)

          if (!nextName) {
            return false
          }

          storage.definitions = storage.definitions.map((definition) =>
            definition.id === variableId
              ? {
                  ...definition,
                  defaultValue:
                    attrs.defaultValue === undefined ? definition.defaultValue : attrs.defaultValue,
                  description:
                    attrs.description === undefined
                      ? definition.description
                      : attrs.description.trim() || undefined,
                  name: nextName,
                  slug:
                    systemVariable || nextName === definition.name
                      ? definition.slug
                      : getUniqueHandoutVariableSlug(
                          nextName,
                          storage.definitions.filter((item) => item.id !== variableId)
                        ),
                }
              : definition
          )

          dispatchVariableStorageChanged(editor)
          return true
        },
      setHandoutVariableScope:
        (scopeId, values) =>
        ({ editor }) => {
          const storage = getHandoutVariableStorage(editor)
          const nextScopeId = scopeId.trim() || "default"

          storage.activeVariantId = nextScopeId
          storage.values = {
            ...storage.values,
            [nextScopeId]: { ...values },
          }

          dispatchVariableStorageChanged(editor)
          return true
        },
      setHandoutVariableValue:
        (variableId, value) =>
        ({ editor }) => {
          const storage = getHandoutVariableStorage(editor)

          if (!storage.definitions.some((definition) => definition.id === variableId)) {
            return false
          }

          storage.values = {
            ...storage.values,
            [storage.activeVariantId]: {
              ...(storage.values[storage.activeVariantId] ?? {}),
              [variableId]: value,
            },
          }

          dispatchVariableStorageChanged(editor)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<VariableMenuItem, VariableMenuItem>({
        editor: this.editor,
        pluginKey: variablePluginKey,
        char: "{",
        allowSpaces: true,
        allowedPrefixes: null,
        shouldShow: ({ transaction }) => !isChangeOrigin(transaction),
        allow: ({ state, range }) =>
          isLatestHandoutSuggestionTrigger(state, range),
        items: ({ query }) => filterVariables(getHandoutVariableStorage(this.editor).definitions, query),
        command: ({ editor, range, props }) => {
          if (props.type === "create") {
            editor.commands.openHandoutVariableCreator(props.name, range)
            return
          }

          const variable = props.variable

          if (!variable) {
            return
          }

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertVariableToken({ fallbackName: variable.name, variableId: variable.id })
            .run()
        },
        render: () => createSuggestionMenu<VariableMenuItem>({
          getCategory: (item) => (item.type === "variable" ? "Existing variables" : null),
          getIcon: (item) => item.icon,
          getLabel: (item) =>
            item.type === "variable"
              ? item.variable.name
              : item.name
                ? `New variable: ${item.name}`
                : "New variable",
          getDescription: (item) =>
            item.type === "variable"
              ? item.variable.description || item.variable.defaultValue || "Variable"
              : "Create a reusable placeholder",
          getTone: (item) => (item.type === "variable" ? "variable" : "default"),
          pluginKey: variablePluginKey,
        }),
      }),
    ]
  },
})

export function createHandoutNextEmojiSuggestion() {
  return {
    allowSpaces: true,
    allowedPrefixes: null,
    pluginKey: EmojiSuggestionPluginKey,
    shouldShow: ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) =>
      !isChangeOrigin(transaction),
    allow: ({ state, range }: { state: import("@tiptap/pm/state").EditorState; range: Range }) => {
      const $from = state.doc.resolve(range.from)
      const emojiType = state.schema.nodes.emoji

      if (!emojiType || !$from.parent.type.contentMatch.matchType(emojiType)) {
        return false
      }

      const textBeforeTrigger = $from.parent.textBetween(0, $from.parentOffset)
      const textAfterSelection = $from.parent.textBetween(
        range.to - range.from + $from.parentOffset,
        $from.parent.content.size
      )

      return (
        isLatestHandoutSuggestionTrigger(state, range) &&
        (textBeforeTrigger.length === 0 || /\s$/.test(textBeforeTrigger)) &&
        (textAfterSelection.length === 0 || /^\s/.test(textAfterSelection))
      )
    },
    items: ({ editor, query }: { editor: Editor; query: string }) =>
      filterEmojiItems(editor.storage.emoji.emojis, query),
    render: () => createSuggestionMenu<EmojiItem>({
      getDescription: (item) =>
        item.shortcodes.length > 0 ? `:${item.shortcodes[0]}:` : item.group ?? "Emoji",
      getLabel: (item) => item.name.replaceAll("_", " "),
      getLeadingVisual: (item) => item.emoji ?? "",
      pluginKey: EmojiSuggestionPluginKey,
    }),
  }
}

function replaceRangeWithBlock(editor: Editor, range: Range, blockType: HandoutNextBlockType) {
  const { state, view } = editor
  const $from = state.doc.resolve(range.from)

  if ($from.parent.isTextblock) {
    const textblockStart = range.from - $from.parentOffset - 1
    const textblockEnd = textblockStart + $from.parent.nodeSize
    const triggerStartOffset = range.from - textblockStart - 1
    const triggerEndOffset = range.to - textblockStart - 1
    const textBeforeTrigger = $from.parent.textBetween(0, triggerStartOffset)
    const textAfterTrigger = $from.parent.textBetween(triggerEndOffset, $from.parent.content.size)

    if (`${textBeforeTrigger}${textAfterTrigger}`.trim().length === 0) {
      const tr = state.tr
        .delete(textblockStart, textblockEnd)
        .insert(textblockStart, createSliceFragment(editor, blockType))
      view.dispatch(setSelectionInsideInsertedContent(tr, textblockStart))
      if (blockType === "gif") {
        editor.commands.openHandoutNextGifPicker(textblockStart)
      }
      if (blockType === "button") {
        editor.commands.openHandoutNextButtonSettings(textblockStart, "create")
      }
      if (blockType === "calendar") {
        editor.commands.openHandoutNextCalendarEmbedSettings(textblockStart, "create")
      }
      if (blockType === "video") {
        editor.commands.openHandoutNextVideoEmbedSettings(textblockStart, "create")
      }
      view.focus()
      return
    }
  }

  editor.chain().focus().deleteRange(range).insertContent(createInsertedBlockContent(blockType)).run()
  if (blockType === "gif") {
    editor.commands.openHandoutNextGifPicker()
  }
  if (blockType === "button") {
    editor.commands.openHandoutNextButtonSettings(undefined, "create")
  }
  if (blockType === "calendar") {
    editor.commands.openHandoutNextCalendarEmbedSettings(undefined, "create")
  }
  if (blockType === "video") {
    editor.commands.openHandoutNextVideoEmbedSettings(undefined, "create")
  }
}

function createSliceFragment(editor: Editor, blockType: HandoutNextBlockType) {
  const content = createInsertedBlockContent(blockType)
  const contentItems = Array.isArray(content) ? content : [content]

  return Fragment.fromArray(contentItems.map((item) => editor.schema.nodeFromJSON(item)))
}

function filterSlashItems(query: string) {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return slashItems
  }

  return slashItems.filter((item) =>
    `${item.label} ${item.description} ${item.id}`.toLowerCase().includes(normalizedQuery)
  )
}

function filterVariables(variables: HandoutVariableOption[], query: string): VariableMenuItem[] {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return [
      { icon: IconCirclePlus, name: "", type: "create" as const },
      ...variables.map((variable) => ({
        icon: IconCodeAsterisk,
        type: "variable" as const,
        variable,
      })),
    ]
  }

  const matchingVariables = variables.filter((variable) =>
    `${variable.name} ${variable.slug} ${variable.description ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery)
  )
  const hasExactMatch = matchingVariables.some(
    (variable) => variable.name.toLowerCase() === normalizedQuery
  )
  const items: VariableMenuItem[] = matchingVariables.map((variable) => ({
    icon: IconCodeAsterisk,
    type: "variable",
    variable,
  }))

  if (!hasExactMatch) {
    const name = normalizeHandoutVariableName(query)

    if (name) {
      items.unshift({ icon: IconCirclePlus, name, type: "create" })
    }
  }

  return items
}

function createVariableDefinition(
  editor: Editor,
  attrs: {
    defaultValue?: string
    description?: string
    name: string
  },
  dispatchChange = true
) {
  const name = normalizeHandoutVariableName(attrs.name)

  if (!name) {
    return null
  }

  const storage = getHandoutVariableStorage(editor)
  const definition: HandoutVariableOption = {
    defaultValue: attrs.defaultValue ?? "",
    description: attrs.description?.trim() || undefined,
    id: createHandoutVariableId(name),
    name,
    slug: getUniqueHandoutVariableSlug(name, storage.definitions),
  }

  storage.definitions = [...storage.definitions, definition]
  if (attrs.defaultValue) {
    storage.values = {
      ...storage.values,
      [storage.activeVariantId]: {
        ...(storage.values[storage.activeVariantId] ?? {}),
        [definition.id]: attrs.defaultValue,
      },
    }
  }
  if (dispatchChange) {
    dispatchVariableStorageChanged(editor)
  }
  return definition
}

function dispatchVariableStorageChanged(editor: Editor) {
  const tr = editor.state.tr.setMeta("handoutNextVariablesChanged", true)
  editor.view.dispatch(tr)
}

function filterEmojiItems(items: EmojiItem[], query: string) {
  const normalizedQuery = normalizeQuery(query)
  const rankedItems = normalizedQuery
    ? items
        .map((item) => ({ item, score: getEmojiMatchScore(item, normalizedQuery) }))
        .filter((match): match is { item: EmojiItem; score: number } => match.score !== null)
        .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
        .map(({ item }) => item)
    : getDefaultEmojiItems(items)

  return rankedItems.slice(0, 40)
}

function getEmojiMatchScore(item: EmojiItem, query: string) {
  const fields = [
    { score: 0, values: item.shortcodes },
    { score: 1, values: [item.name] },
    { score: 2, values: item.tags },
    { score: 3, values: item.group ? [item.group] : [] },
  ]

  let bestScore: number | null = null

  for (const field of fields) {
    for (const value of field.values) {
      const normalizedValue = value.toLowerCase()
      let nextScore: number | null = null

      if (normalizedValue === query) {
        nextScore = field.score * 10
      } else if (normalizedValue.startsWith(query)) {
        nextScore = field.score * 10 + 1
      } else if (normalizedValue.includes(query)) {
        nextScore = field.score * 10 + 2
      }

      if (nextScore !== null && (bestScore === null || nextScore < bestScore)) {
        bestScore = nextScore
      }
    }
  }

  return bestScore
}

function getDefaultEmojiItems(items: EmojiItem[]) {
  const preferredShortcodes = [
    "sparkles",
    "wave",
    "smile",
    "heart",
    "thumbsup",
    "fire",
    "rocket",
    "eyes",
    "white_check_mark",
    "tada",
    "bulb",
    "star",
  ]

  return preferredShortcodes
    .map((shortcode) => items.find((item) => item.shortcodes.includes(shortcode)))
    .filter((item): item is EmojiItem => Boolean(item))
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase()
}

export function isLatestHandoutSuggestionTrigger(
  state: EditorState,
  range: Range
) {
  const $from = state.doc.resolve(range.from)
  const $to = state.doc.resolve(range.to)

  if ($from.parent !== $to.parent) {
    return false
  }

  const textThroughRange = $from.parent.textBetween(
    0,
    $to.parentOffset,
    "\0",
    "\0"
  )
  const latestTriggerOffset = Math.max(
    textThroughRange.lastIndexOf("/"),
    textThroughRange.lastIndexOf("{"),
    textThroughRange.lastIndexOf(":")
  )

  return latestTriggerOffset === $from.parentOffset
}

function createSuggestionMenu<TItem>({
  getCategory,
  getDescription,
  getIcon,
  getLabel,
  getLeadingVisual,
  getTone,
  pluginKey,
}: {
  getCategory?: (item: TItem) => string | null | undefined
  getDescription: (item: TItem) => string
  getIcon?: (item: TItem) => React.ComponentType<{ "aria-hidden"?: boolean }>
  getLabel: (item: TItem) => string
  getLeadingVisual?: (item: TItem) => string
  getTone?: (item: TItem) => "default" | "primary" | "variable"
  pluginKey: PluginKey
}) {
  const owner = Symbol("handoutSuggestionMenu")
  let props: SuggestionProps<TItem, TItem> | null = null
  let lastRect: DOMRect | null = null
  let renderer: ReactRenderer<
    HandoutNextSuggestionMenuHandle,
    HandoutNextSuggestionMenuProps<TItem>
  > | null = null
  let pendingExit = false
  let pendingExitTimer: number | null = null

  function cancelPendingExit() {
    pendingExit = false

    if (pendingExitTimer !== null) {
      window.clearTimeout(pendingExitTimer)
      pendingExitTimer = null
    }
  }

  function updatePosition() {
    if (!props || !renderer) {
      return
    }

    const rect =
      props.clientRect?.() ??
      props.decorationNode?.getBoundingClientRect() ??
      getActiveSuggestionRect() ??
      lastRect

    if (!rect) {
      return
    }

    lastRect = rect
    const menuRect = renderer.element.getBoundingClientRect()
    const menuHeight = menuRect.height || 288
    const belowTop = rect.bottom + 6
    const aboveTop = rect.top - menuHeight - 6
    const fitsBelow = belowTop + menuHeight <= window.innerHeight - 8
    const unclampedTop = fitsBelow ? belowTop : aboveTop

    renderer.element.style.display = "block"
    renderer.element.style.position = "fixed"
    renderer.element.style.left = `${Math.min(rect.left, window.innerWidth - 312)}px`
    renderer.element.style.top = `${Math.max(8, Math.min(unclampedTop, window.innerHeight - menuHeight - 8))}px`
    renderer.element.style.zIndex = "50"
    renderer.element.style.width = "fit-content"
  }

  function createRenderer(nextProps: SuggestionProps<TItem, TItem>) {
    if (renderer) {
      destroyRenderer()
    }

    if (activeSuggestionMenu?.owner !== owner) {
      activeSuggestionMenu?.close()
    }

    cancelPendingExit()
    props = nextProps
    const MenuComponent =
      HandoutNextSuggestionMenuView as React.ComponentType<
        HandoutNextSuggestionMenuProps<TItem>
      >
    const nextRenderer = new ReactRenderer<
      HandoutNextSuggestionMenuHandle,
      HandoutNextSuggestionMenuProps<TItem>
    >(MenuComponent, {
      editor: nextProps.editor,
      props: createMenuProps(nextProps),
    })
    renderer = nextRenderer
    getSuggestionMenuHost(nextProps.editor).append(nextRenderer.element)
    activeSuggestionMenu = { close: destroyRenderer, owner }
    document.addEventListener("pointerdown", handleOutsidePointerDown, true)
    window.addEventListener("blur", dismissSuggestionMenu)
    window.addEventListener("keydown", handleDismissKeyDown)
    updatePosition()
    window.requestAnimationFrame(updatePosition)
  }

  function updateRenderer(nextProps: SuggestionProps<TItem, TItem>) {
    cancelPendingExit()
    props = nextProps
    renderer?.updateProps(createMenuProps(nextProps))
    updatePosition()
    window.requestAnimationFrame(updatePosition)
  }

  function destroyRenderer() {
    cancelPendingExit()
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true)
    window.removeEventListener("blur", dismissSuggestionMenu)
    window.removeEventListener("keydown", handleDismissKeyDown)
    renderer?.destroy()
    renderer = null
    props = null
    lastRect = null

    if (activeSuggestionMenu?.owner === owner) {
      activeSuggestionMenu = null
    }
  }

  function dismissSuggestionMenu() {
    const editor = props?.editor

    if (editor && !editor.isDestroyed) {
      exitSuggestion(editor.view, pluginKey)
    }

    destroyRenderer()
  }

  function handleOutsidePointerDown(event: PointerEvent) {
    const target = event.target

    if (target instanceof Node && renderer?.element.contains(target)) {
      return
    }

    dismissSuggestionMenu()
  }

  function handleDismissKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Esc") {
      dismissSuggestionMenu()
    }
  }

  function createMenuProps(
    nextProps: SuggestionProps<TItem, TItem>
  ): HandoutNextSuggestionMenuProps<TItem> {
    return {
      command: (item) => {
        nextProps.command(item)
        destroyRenderer()
      },
      getCategory,
      getDescription,
      getIcon,
      getLabel,
      getLeadingVisual,
      getTone,
      items: nextProps.items,
      onPointerLeaveMenu: () => {
        if (pendingExit && shouldFinishExit()) {
          destroyRenderer()
        }
      },
      query: nextProps.query,
    }
  }

  function requestExit() {
    pendingExit = true

    if (pendingExitTimer !== null) {
      window.clearTimeout(pendingExitTimer)
    }

    pendingExitTimer = window.setTimeout(() => {
      pendingExitTimer = null

      if (shouldFinishExit()) {
        destroyRenderer()
      }
    }, 180)
  }

  function shouldFinishExit() {
    return Boolean(props?.editor.isDestroyed) || !renderer?.ref?.isPointerInside()
  }

  return {
    onStart(nextProps: SuggestionProps<TItem, TItem>) {
      createRenderer(nextProps)
    },
    onUpdate(nextProps: SuggestionProps<TItem, TItem>) {
      updateRenderer(nextProps)
    },
    onKeyDown(keyDownProps: SuggestionKeyDownProps) {
      return renderer?.ref?.onKeyDown(keyDownProps) ?? false
    },
    onExit() {
      requestExit()
    },
  }
}

function getActiveSuggestionRect() {
  return document.querySelector(".suggestion")?.getBoundingClientRect() ?? null
}

function getSuggestionMenuHost(editor: Editor) {
  return editor.view.dom.closest("[data-editor-page]") ?? document.body
}
