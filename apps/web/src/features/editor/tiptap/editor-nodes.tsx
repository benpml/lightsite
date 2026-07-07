/* eslint-disable react-refresh/only-export-components */
import {
  useEffect,
  useRef,
  type ComponentType,
  type KeyboardEvent,
} from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react"
import {
  IconCalendarEvent,
  IconChevronDown,
  IconPlayerPlayFilled,
  IconQuote,
  IconVideo,
  IconX,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { EditableBlockType } from "../editor-data"
import { isEditorContentNode } from "./editor-blocks"
import {
  AvatarUploadSurface,
  GifSelectSurface,
  IconSelector,
  InlineAddButton,
  InlineAttrInput,
  InlineIconButton,
  LogoUploadSurface,
  MediaUploadSurface,
} from "../components/editor-inline-controls"
import {
  useEditorGifPicker,
  useEditorPreviewText,
} from "../components/editor-contexts"

function nodeAttrs(defaults: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [key, { default: defaultValue }])
  )
}

const TextBlockNode = Node.create({
  name: "textBlock",
  group: "block",
  content: "inline*",
  defining: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return nodeAttrs({ temporary: false })
  },
  parseHTML() {
    return [{ tag: "p[data-lightsite-node='text-block']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-lightsite-node": "text-block" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(TextBlockView, { contentDOMElementTag: "span" })
  },
})

const HeadingBlockNode = Node.create({
  name: "headingBlock",
  group: "block",
  content: "inline*",
  defining: true,
  draggable: false,
  selectable: true,
  addAttributes() {
    return nodeAttrs({ level: 1 })
  },
  parseHTML() {
    return [{ tag: "h1[data-lightsite-node='heading-block']" }, { tag: "h2[data-lightsite-node='heading-block']" }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      node.attrs.level === 1 ? "h1" : "h2",
      mergeAttributes(HTMLAttributes, { "data-lightsite-node": "heading-block" }),
      0,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(HeadingBlockView, { contentDOMElementTag: "span" })
  },
})

const IconListNode = Node.create({
  name: "iconList",
  group: "block",
  content: "iconListItem+",
  defining: true,
  draggable: false,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-lightsite-node='icon-list']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lightsite-node": "icon-list" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(IconListView)
  },
})

const IconListItemNode = Node.create({
  name: "iconListItem",
  content: "inline*",
  defining: true,
  addAttributes() {
    return {
      icon: {
        default: "box",
        keepOnSplit: false,
      },
      iconTone: {
        default: "default",
        keepOnSplit: false,
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-lightsite-node='icon-list-item']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-lightsite-node": "icon-list-item" }),
      0,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(IconListItemView, { contentDOMElementTag: "span" })
  },
})

const SectionDividerNode = atomicNode("sectionDivider", "divider", SectionDividerView)
const ImageBlockNode = atomicNode("imageBlock", "image", ImageBlockView, { alt: "Image", caption: "", src: "" })
const GifBlockNode = atomicNode("gifBlock", "gif", GifBlockView, {
  alt: "GIF",
  giphyId: "",
  height: null,
  promptOnMount: false,
  src: "",
  width: null,
})
const ImageCardBlockNode = atomicNode("imageCardBlock", "image-card", ImageCardBlockView, {
  alt: "Image",
  body: "Description text.",
  buttonText: "Button",
  buttonUrl: "",
  includeButton: true,
  src: "",
  title: "Title",
})
const IconCardBlockNode = atomicNode("iconCardBlock", "icon-card", IconCardBlockView, {
  body: "Description example.",
  icon: "box",
  iconTone: "default",
  includeIcon: true,
  title: "Example Title",
})
const ButtonBlockNode = atomicNode("buttonBlock", "button", ButtonBlockView, {
  style: "outline",
  text: "Button",
  url: "",
})
const CalendarBlockNode = atomicNode("calendarBlock", "calendar", CalendarBlockView, {
  text: "Book a call",
  url: "",
})
const AccordionBlockNode = atomicNode("accordionBlock", "accordion", AccordionBlockView, { items: [] })
const VideoBlockNode = atomicNode("videoBlock", "video", VideoBlockView, { thumbnail: "", url: "" })
const TestimonialBlockNode = atomicNode("testimonialBlock", "testimonial", TestimonialBlockView, {
  avatar: "",
  name: "Alex Morgan",
  quote: "Lightsite helped us send a polished, personalized follow-up in minutes.",
  role: "VP Sales, Acme",
})
const LogoGridBlockNode = atomicNode("logoGridBlock", "logo-grid", LogoGridBlockView, { logos: [] })

export const editorNodeExtensions = [
  TextBlockNode,
  HeadingBlockNode,
  SectionDividerNode,
  IconListNode,
  IconListItemNode,
  ImageBlockNode,
  GifBlockNode,
  ImageCardBlockNode,
  IconCardBlockNode,
  ButtonBlockNode,
  CalendarBlockNode,
  AccordionBlockNode,
  VideoBlockNode,
  TestimonialBlockNode,
  LogoGridBlockNode,
]

function atomicNode(
  name: string,
  dataName: string,
  component: ComponentType<ReactNodeViewProps>,
  attributes: Record<string, unknown> = {}
) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    draggable: false,
    selectable: true,
    addAttributes() {
      return nodeAttrs(attributes)
    },
    parseHTML() {
      return [{ tag: `div[data-lightsite-node='${dataName}']` }]
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-lightsite-node": dataName })]
    },
    addNodeView() {
      return ReactNodeViewRenderer(component)
    },
  })
}

function TextBlockView(props: ReactNodeViewProps) {
  const previewText = useEditorPreviewText()
  const className = "block min-h-6 whitespace-pre-wrap text-base leading-6 text-secondary-foreground"

  return (
    <EditableBlockShell blockType="text" nodeView={props}>
      {previewText.preview ? (
        <span data-editor-text-content="" className={className}>
          {previewText.resolveText(props.node.textContent) || "\u00A0"}
        </span>
      ) : (
        <NodeViewContent<"span">
          as="span"
          data-editor-text-content=""
          className={className}
          onBlurCapture={() => removeEmptyTemporaryTextBlock(props)}
          onInputCapture={() => {
            if (props.node.attrs.temporary) {
              props.updateAttributes({ temporary: false })
            }
          }}
        />
      )}
    </EditableBlockShell>
  )
}

function HeadingBlockView(props: ReactNodeViewProps) {
  const level = Number(props.node.attrs.level ?? 1)
  const previewText = useEditorPreviewText()
  const className = cn(
    "block min-h-7 whitespace-pre-wrap font-medium tracking-normal",
    level === 1 ? "text-xl leading-7" : "text-base leading-7"
  )

  return (
    <EditableBlockShell blockType={level === 1 ? "title" : "heading"} nodeView={props}>
      {previewText.preview ? (
        <span data-editor-text-content="" className={className}>
          {previewText.resolveText(props.node.textContent) || "\u00A0"}
        </span>
      ) : (
        <NodeViewContent<"span">
          as="span"
          data-editor-text-content=""
          className={className}
        />
      )}
    </EditableBlockShell>
  )
}

function SectionDividerView(props: ReactNodeViewProps) {
  return (
    <EditableBlockShell blockType="divider" nodeView={props}>
      <div className="py-3">
        <div className="h-px bg-border-subtle" />
      </div>
    </EditableBlockShell>
  )
}

function IconListView(props: ReactNodeViewProps) {
  return (
    <EditableBlockShell blockType="icon-list" nodeView={props}>
      <NodeViewContent
        as="div"
        className="flex w-[544px] max-w-full flex-col gap-1.5"
      />
    </EditableBlockShell>
  )
}

function IconListItemView(props: ReactNodeViewProps) {
  const editable = props.editor.isEditable
  const previewText = useEditorPreviewText()
  const contentClassName = "block min-h-6 min-w-0 flex-1 whitespace-pre-wrap text-base leading-6 outline-none"

  return (
    <NodeViewWrapper
      as="div"
      data-icon-list-item=""
      className="flex items-center gap-2"
    >
      <IconSelector
        disabled={!editable}
        icon={props.node.attrs.icon ?? "box"}
        tone={props.node.attrs.iconTone ?? "default"}
        size="sm"
        onChange={(patch) => props.updateAttributes(patch)}
      />
      {previewText.preview ? (
        <span data-editor-text-content="" className={contentClassName}>
          {previewText.resolveText(props.node.textContent) || "\u00A0"}
        </span>
      ) : (
        <NodeViewContent<"span">
          as="span"
          data-editor-text-content=""
          className={contentClassName}
        />
      )}
    </NodeViewWrapper>
  )
}

function ImageBlockView(props: ReactNodeViewProps) {
  return (
    <EditableBlockShell blockType="image" nodeView={props}>
      <MediaUploadSurface
        alt={props.node.attrs.alt}
        disabled={!props.editor.isEditable}
        src={props.node.attrs.src}
        onChange={(src) => props.updateAttributes({ src })}
      />
    </EditableBlockShell>
  )
}

function GifBlockView(props: ReactNodeViewProps) {
  const gifPicker = useEditorGifPicker()
  const { editor, node, updateAttributes } = props
  const isEditable = editor.isEditable
  const promptOnMount = node.attrs.promptOnMount
  const position = getNodePosition(props)
  const autoOpenHandledRef = useRef(false)

  useEffect(() => {
    if (!promptOnMount) {
      autoOpenHandledRef.current = false
      return
    }

    if (
      !isEditable ||
      position === null ||
      autoOpenHandledRef.current
    ) {
      return
    }

    autoOpenHandledRef.current = true
    updateAttributes({ promptOnMount: false })
    gifPicker.openGifPicker(position)
  }, [
    gifPicker,
    isEditable,
    position,
    promptOnMount,
    updateAttributes,
  ])

  return (
    <EditableBlockShell blockType="gif" nodeView={props}>
      <GifSelectSurface
        alt={props.node.attrs.alt}
        disabled={!props.editor.isEditable}
        height={props.node.attrs.height}
        src={props.node.attrs.src}
        width={props.node.attrs.width}
        onOpenPicker={() => {
          if (position !== null) {
            gifPicker.openGifPicker(position)
          }
        }}
      />
    </EditableBlockShell>
  )
}

function ImageCardBlockView(props: ReactNodeViewProps) {
  const editable = props.editor.isEditable

  return (
    <EditableBlockShell blockType="image-card" nodeView={props}>
      <div className="rounded-[14px] border bg-background p-1.5 pr-5">
        <div className="flex h-32 items-center gap-6 rounded-xl">
          <MediaUploadSurface
            alt={props.node.attrs.alt}
            className="h-32 w-[200px] shrink-0 rounded-[10px] border-0 bg-transparent"
            disabled={!props.editor.isEditable}
            src={props.node.attrs.src}
            onChange={(src) => props.updateAttributes({ src })}
          />
          <div className="min-w-0 flex-1">
            <InlineAttrInput
              ariaLabel="Image card title"
              className="text-base leading-6 font-medium"
              disabled={!editable}
              value={props.node.attrs.title}
              onChange={(title) => props.updateAttributes({ title })}
            />
            <InlineAttrInput
              ariaLabel="Image card body"
              className="text-sm leading-6 text-tertiary-foreground"
              disabled={!editable}
              value={props.node.attrs.body}
              onChange={(body) => props.updateAttributes({ body })}
            />
            {props.node.attrs.includeButton ? (
              <Button variant="outline" size="compact" className="mt-1">
                {props.node.attrs.buttonText}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </EditableBlockShell>
  )
}

function IconCardBlockView(props: ReactNodeViewProps) {
  const editable = props.editor.isEditable

  return (
    <EditableBlockShell blockType="icon-card" nodeView={props}>
      <div className="rounded-[14px] border bg-background px-4 pt-4 pb-4">
        {props.node.attrs.includeIcon ? (
          <IconSelector
            disabled={!editable}
            icon={props.node.attrs.icon}
            tone={props.node.attrs.iconTone ?? "default"}
            onChange={(patch) => props.updateAttributes(patch)}
          />
        ) : null}
        <InlineAttrInput
          ariaLabel="Icon card title"
          className={cn("text-xl leading-7 font-medium", props.node.attrs.includeIcon && "mt-3")}
          disabled={!editable}
          value={props.node.attrs.title}
          onChange={(title) => props.updateAttributes({ title })}
        />
        <InlineAttrInput
          ariaLabel="Icon card body"
          className="text-sm leading-6 text-tertiary-foreground"
          disabled={!editable}
          value={props.node.attrs.body}
          onChange={(body) => props.updateAttributes({ body })}
        />
      </div>
    </EditableBlockShell>
  )
}

function ButtonBlockView(props: ReactNodeViewProps) {
  const style = props.node.attrs.style === "filled" ? "filled" : "outline"

  return (
    <EditableBlockShell blockType="button" nodeView={props}>
      <Button variant={style === "filled" ? "default" : "outline"} size="compact">
        {props.node.attrs.text}
      </Button>
    </EditableBlockShell>
  )
}

function CalendarBlockView(props: ReactNodeViewProps) {
  return (
    <EditableBlockShell blockType="calendar" nodeView={props}>
      <Button size="compact">
        <IconCalendarEvent data-icon="inline-start" />
        {props.node.attrs.text}
      </Button>
    </EditableBlockShell>
  )
}

function AccordionBlockView(props: ReactNodeViewProps) {
  const items = ensureAccordionItems(props.node.attrs.items)
  const editable = props.editor.isEditable

  return (
    <EditableBlockShell blockType="accordion" nodeView={props}>
      <div className="overflow-hidden rounded-[14px] border bg-background">
        {items.map((item) => (
          <div key={item.id} className="border-b last:border-b-0">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={item.expanded ? "Collapse item" : "Expand item"}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none [&_svg]:size-3.5"
                  disabled={!editable}
                  onClick={() => updateAccordionItem(props, item.id, { expanded: !item.expanded })}
                >
                  <IconChevronDown
                    className={cn("transition-transform", !item.expanded && "-rotate-90")}
                  />
                </button>
                <InlineAttrInput
                  ariaLabel="Accordion title"
                  className="min-w-0 flex-1 text-base leading-6 font-medium"
                  disabled={!editable}
                  placeholder="Title"
                  value={item.title}
                  onKeyDown={(event) => handleAccordionTitleKeyDown(event, props, item.id)}
                  onChange={(title) => updateAccordionItem(props, item.id, { title })}
                />
              </div>
              {item.expanded ? (
                <InlineAttrInput
                  ariaLabel="Accordion body"
                  className="ml-8 text-sm leading-6 text-tertiary-foreground"
                  disabled={!editable}
                  placeholder="Description"
                  value={item.body}
                  onChange={(body) => updateAccordionItem(props, item.id, { body })}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </EditableBlockShell>
  )
}

function VideoBlockView(props: ReactNodeViewProps) {
  return (
    <EditableBlockShell blockType="video" nodeView={props}>
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="relative h-[241px] w-full overflow-hidden bg-primary text-primary-foreground">
          {props.node.attrs.thumbnail ? (
            <img src={props.node.attrs.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-primary text-primary-foreground/80">
              <IconVideo />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-[72px] items-center justify-center rounded-full bg-primary-foreground/35">
              <IconPlayerPlayFilled />
            </span>
          </span>
        </div>
      </div>
    </EditableBlockShell>
  )
}

function TestimonialBlockView(props: ReactNodeViewProps) {
  const editable = props.editor.isEditable

  return (
    <EditableBlockShell blockType="testimonial" nodeView={props}>
      <div className="rounded-2xl border bg-background p-4">
        <InlineAttrInput
          ariaLabel="Quote"
          className="text-base leading-6"
          disabled={!editable}
          value={props.node.attrs.quote}
          onChange={(quote) => props.updateAttributes({ quote })}
        />
        <div className="mt-4 flex items-center gap-3">
          {editable ? (
            <AvatarUploadSurface
              alt={props.node.attrs.name}
              src={props.node.attrs.avatar}
              onChange={(avatar) => props.updateAttributes({ avatar })}
            />
          ) : (
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground">
              {props.node.attrs.avatar ? <img src={props.node.attrs.avatar} alt="" className="size-full object-cover" /> : <IconQuote />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <InlineAttrInput
              ariaLabel="Name"
              className="text-sm leading-5 font-medium"
              disabled={!editable}
              value={props.node.attrs.name}
              onChange={(name) => props.updateAttributes({ name })}
            />
            <InlineAttrInput
              ariaLabel="Role"
              className="text-sm leading-5 text-tertiary-foreground"
              disabled={!editable}
              value={props.node.attrs.role}
              onChange={(role) => props.updateAttributes({ role })}
            />
          </div>
        </div>
      </div>
    </EditableBlockShell>
  )
}

function LogoGridBlockView(props: ReactNodeViewProps) {
  const logos = ensureLogos(props.node.attrs.logos)
  const editable = props.editor.isEditable

  return (
    <EditableBlockShell blockType="logo-grid" nodeView={props}>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {logos.map((logo) => (
          <div key={logo.id} className="group/logo relative flex h-[116px] flex-col items-center justify-start rounded-lg text-center text-tertiary-foreground hover:bg-muted">
            <LogoUploadSurface
              alt={logo.name}
              disabled={!editable}
              src={logo.image}
              onChange={(image) => updateLogoItem(props, logo.id, { image })}
            />
            <InlineAttrInput
              ariaLabel="Logo name"
              className="mt-2 h-6 px-2 text-center text-base leading-6 text-foreground"
              disabled={!editable}
              value={logo.name}
              onKeyDown={(event) => handleLogoKeyDown(event, props, logo.id)}
              onChange={(name) => updateLogoItem(props, logo.id, { name })}
            />
            {editable ? (
              <span className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-within/logo:opacity-100">
                <InlineIconButton
                  label="Delete logo"
                  onClick={() => removeLogoItem(props, logo.id)}
                >
                  <IconX />
                </InlineIconButton>
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {editable ? (
        <InlineAddButton className="mt-3" onClick={() => addLogoItem(props)}>
          Add logo
        </InlineAddButton>
      ) : null}
    </EditableBlockShell>
  )
}

function EditableBlockShell({
  blockType,
  children,
  nodeView,
}: {
  blockType: EditableBlockType
  children: React.ReactNode
  nodeView: ReactNodeViewProps
}) {
  return (
    <NodeViewWrapper
      data-block-wrapper-type={blockType}
      data-block-drag-surface=""
      data-editor-block=""
      data-card-block={
        blockType === "image-card" || blockType === "icon-card" ? "true" : undefined
      }
      data-block-type={blockType}
      as="div"
      className={cn(
        "group/editor-block relative w-full rounded-[10px] px-1.5 transition-colors outline-none",
        blockPadding(blockType),
        blockSpacingClass(nodeView, blockType)
      )}
    >
      {children}
    </NodeViewWrapper>
  )
}

function blockPadding(blockType: EditableBlockType) {
  if (blockType === "title" || blockType === "heading") {
    return "py-0.5"
  }

  if (blockType === "text") {
    return "py-1"
  }

  return "py-1.5"
}

function blockSpacingClass(nodeView: ReactNodeViewProps, blockType: EditableBlockType) {
  const position = getNodePosition(nodeView)

  if (position === null) {
    return ""
  }

  const blockIndex = nodeView.editor.state.doc.resolve(position).index()

  if (blockIndex <= 0) {
    return ""
  }

  const previousNode = nodeView.editor.state.doc.child(blockIndex - 1)

  if (!isEditorContentNode(previousNode.type.name)) {
    return ""
  }

  return isCardBlockType(blockType) && isCardNode(previousNode.type.name) ? "mt-[2px]" : "mt-1"
}

function isCardBlockType(blockType: EditableBlockType) {
  return blockType === "image-card" || blockType === "icon-card"
}

function isCardNode(nodeTypeName: string) {
  return nodeTypeName === "imageCardBlock" || nodeTypeName === "iconCardBlock"
}

function removeEmptyTemporaryTextBlock(nodeView: ReactNodeViewProps) {
  window.requestAnimationFrame(() => {
    const position = getNodePosition(nodeView)

    if (position === null) {
      return
    }

    const node = nodeView.editor.state.doc.nodeAt(position)

    if (!node || node.type.name !== "textBlock" || !node.attrs.temporary || node.textContent.trim() !== "") {
      return
    }

    if (nodeView.editor.state.doc.childCount <= 1) {
      nodeView.updateAttributes({ temporary: false })
      return
    }

    nodeView.editor
      .chain()
      .deleteRange({ from: position, to: position + node.nodeSize })
      .run()
  })
}

function getNodePosition(nodeView: ReactNodeViewProps) {
  const position = nodeView.getPos()
  return typeof position === "number" ? position : null
}

type AccordionItem = {
  body: string
  expanded: boolean
  id: string
  title: string
}

function ensureAccordionItems(value: unknown): AccordionItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is AccordionItem =>
        Boolean(item && typeof item === "object" && "id" in item && "title" in item)
      )
    : []
}

function updateAccordionItem(nodeView: ReactNodeViewProps, itemId: string, patch: Partial<AccordionItem>) {
  const items = ensureAccordionItems(nodeView.node.attrs.items)
  nodeView.updateAttributes({
    items: items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  })
}

function addAccordionItem(nodeView: ReactNodeViewProps, afterItemId?: string) {
  const items = ensureAccordionItems(nodeView.node.attrs.items)
  const item: AccordionItem = {
    body: "Description",
    expanded: true,
    id: createLocalId("accordion"),
    title: "Title",
  }

  if (!afterItemId) {
    nodeView.updateAttributes({ items: [...items, item] })
    return
  }

  const nextItems = items.flatMap((currentItem) =>
    currentItem.id === afterItemId ? [currentItem, item] : [currentItem]
  )

  nodeView.updateAttributes({ items: nextItems })
}

function removeAccordionItem(nodeView: ReactNodeViewProps, itemId: string) {
  const items = ensureAccordionItems(nodeView.node.attrs.items)

  if (items.length <= 1) {
    nodeView.updateAttributes({
      items: items.map((item) => (item.id === itemId ? { ...item, body: "", title: "" } : item)),
    })
    return
  }

  nodeView.updateAttributes({ items: items.filter((item) => item.id !== itemId) })
}

function handleAccordionTitleKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  nodeView: ReactNodeViewProps,
  itemId: string
) {
  if (event.key === "Enter") {
    event.preventDefault()
    addAccordionItem(nodeView, itemId)
    return
  }

  if (event.key === "Backspace" && event.currentTarget.value === "") {
    event.preventDefault()
    removeAccordionItem(nodeView, itemId)
  }
}

type LogoItem = {
  id: string
  image?: string
  name: string
}

function ensureLogos(value: unknown): LogoItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is LogoItem =>
        Boolean(item && typeof item === "object" && "id" in item && "name" in item)
      )
    : []
}

function updateLogoItem(nodeView: ReactNodeViewProps, logoId: string, patch: Partial<LogoItem>) {
  const logos = ensureLogos(nodeView.node.attrs.logos)
  nodeView.updateAttributes({
    logos: logos.map((logo) => (logo.id === logoId ? { ...logo, ...patch } : logo)),
  })
}

function addLogoItem(nodeView: ReactNodeViewProps, afterLogoId?: string) {
  const logos = ensureLogos(nodeView.node.attrs.logos)
  const logo: LogoItem = {
    id: createLocalId("logo"),
    name: "Logo",
  }

  if (!afterLogoId) {
    nodeView.updateAttributes({ logos: [...logos, logo] })
    return
  }

  const nextLogos = logos.flatMap((currentLogo) =>
    currentLogo.id === afterLogoId ? [currentLogo, logo] : [currentLogo]
  )

  nodeView.updateAttributes({ logos: nextLogos })
}

function removeLogoItem(nodeView: ReactNodeViewProps, logoId: string) {
  const logos = ensureLogos(nodeView.node.attrs.logos)

  if (logos.length <= 1) {
    nodeView.updateAttributes({
      logos: logos.map((logo) => (logo.id === logoId ? { ...logo, image: "", name: "" } : logo)),
    })
    return
  }

  nodeView.updateAttributes({ logos: logos.filter((logo) => logo.id !== logoId) })
}

function handleLogoKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  nodeView: ReactNodeViewProps,
  logoId: string
) {
  if (event.key === "Enter") {
    event.preventDefault()
    addLogoItem(nodeView, logoId)
    return
  }

  if (event.key === "Backspace" && event.currentTarget.value === "") {
    event.preventDefault()
    removeLogoItem(nodeView, logoId)
  }
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
