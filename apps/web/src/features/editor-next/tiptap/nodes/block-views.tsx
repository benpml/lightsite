import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import {
  IconActivity,
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconArchive,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconAward,
  IconBell,
  IconBolt,
  IconBook,
  IconBookmark,
  IconBox,
  IconBriefcase,
  IconBrowser,
  IconBuilding,
  IconBulb,
  IconCalendar,
  IconChartBar,
  IconChartDots,
  IconChartLine,
  IconChartPie,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboardCheck,
  IconClock,
  IconCloud,
  IconCode,
  IconCoin,
  IconCommand,
  IconCompass,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDeviceAnalytics,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDiamond,
  IconDots,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileAnalytics,
  IconFileCheck,
  IconFileDescription,
  IconFileText,
  IconFilter,
  IconFlag,
  IconFlame,
  IconFolder,
  IconGift,
  IconGlobe,
  IconGraph,
  IconHeart,
  IconHelpCircle,
  IconHome,
  IconId,
  IconInbox,
  IconInfoCircle,
  IconKey,
  IconLayoutDashboard,
  IconLifebuoy,
  IconLink,
  IconListCheck,
  IconLock,
  IconMail,
  IconMapPin,
  IconMessage,
  IconMessages,
  IconMicrophone,
  IconMoodSmile,
  IconNotebook,
  IconPalette,
  IconPaperclip,
  IconPencil,
  IconPhone,
  IconPhoto,
  IconPlug,
  IconPresentation,
  IconPuzzle,
  IconQrcode,
  IconRocket,
  IconRosetteDiscountCheck,
  IconRoute,
  IconSearch,
  IconSend,
  IconSettings,
  IconShare,
  IconShieldCheck,
  IconShoppingCart,
  IconSparkles,
  IconStar,
  IconStars,
  IconTargetArrow,
  IconTemplate,
  IconThumbUp,
  IconTools,
  IconTrendingUp,
  IconTrophy,
  IconTruckDelivery,
  IconUpload,
  IconUser,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconVariable,
  IconVideo,
  IconWallet,
  IconWand,
  IconWorld,
  IconWriting,
  IconX,
  IconZoomIn,
} from "@tabler/icons-react"
import type { TablerIcon } from "@tabler/icons-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import type React from "react"

import { cn } from "@/lib/utils"
import { getDevAuthBypassHeaders } from "@/lib/api/dev-auth-bypass"

import { fitImageDimensions, loadImageDimensions, readImageFileAsAttrs } from "../image-utils"
import { getLightsiteVariableValue } from "../variable-state"

const iconListOptions = [
  { name: "activity", label: "Activity", icon: IconActivity },
  { name: "adjustments", label: "Adjustments", icon: IconAdjustmentsHorizontal },
  { name: "alert-circle", label: "Alert", icon: IconAlertCircle },
  { name: "archive", label: "Archive", icon: IconArchive },
  { name: "arrow-down", label: "Arrow down", icon: IconArrowDown },
  { name: "arrow-left", label: "Arrow left", icon: IconArrowLeft },
  { name: "arrow-right", label: "Arrow right", icon: IconArrowRight },
  { name: "arrow-up", label: "Arrow up", icon: IconArrowUp },
  { name: "arrow-up-right", label: "Arrow up right", icon: IconArrowUpRight },
  { name: "award", label: "Award", icon: IconAward },
  { name: "bell", label: "Bell", icon: IconBell },
  { name: "bolt", label: "Bolt", icon: IconBolt },
  { name: "book", label: "Book", icon: IconBook },
  { name: "bookmark", label: "Bookmark", icon: IconBookmark },
  { name: "box", label: "Box", icon: IconBox },
  { name: "briefcase", label: "Briefcase", icon: IconBriefcase },
  { name: "browser", label: "Browser", icon: IconBrowser },
  { name: "building", label: "Building", icon: IconBuilding },
  { name: "bulb", label: "Bulb", icon: IconBulb },
  { name: "calendar", label: "Calendar", icon: IconCalendar },
  { name: "chart", label: "Chart", icon: IconChartBar },
  { name: "chart-dots", label: "Chart dots", icon: IconChartDots },
  { name: "chart-line", label: "Chart line", icon: IconChartLine },
  { name: "chart-pie", label: "Chart pie", icon: IconChartPie },
  { name: "check", label: "Check", icon: IconCheck },
  { name: "chevron-down", label: "Chevron down", icon: IconChevronDown },
  { name: "circle-check", label: "Circle check", icon: IconCircleCheck },
  { name: "circle-dashed", label: "Circle dashed", icon: IconCircleDashed },
  { name: "clipboard-check", label: "Clipboard check", icon: IconClipboardCheck },
  { name: "clock", label: "Clock", icon: IconClock },
  { name: "cloud", label: "Cloud", icon: IconCloud },
  { name: "code", label: "Code", icon: IconCode },
  { name: "coin", label: "Coin", icon: IconCoin },
  { name: "command", label: "Command", icon: IconCommand },
  { name: "compass", label: "Compass", icon: IconCompass },
  { name: "copy", label: "Copy", icon: IconCopy },
  { name: "credit-card", label: "Credit card", icon: IconCreditCard },
  { name: "database", label: "Database", icon: IconDatabase },
  { name: "device-analytics", label: "Analytics", icon: IconDeviceAnalytics },
  { name: "desktop", label: "Desktop", icon: IconDeviceDesktop },
  { name: "laptop", label: "Laptop", icon: IconDeviceLaptop },
  { name: "mobile", label: "Mobile", icon: IconDeviceMobile },
  { name: "diamond", label: "Diamond", icon: IconDiamond },
  { name: "dots", label: "Dots", icon: IconDots },
  { name: "download", label: "Download", icon: IconDownload },
  { name: "edit", label: "Edit", icon: IconEdit },
  { name: "eye", label: "Eye", icon: IconEye },
  { name: "file-analytics", label: "File analytics", icon: IconFileAnalytics },
  { name: "file-check", label: "File check", icon: IconFileCheck },
  { name: "file-description", label: "File description", icon: IconFileDescription },
  { name: "file", label: "File", icon: IconFileText },
  { name: "filter", label: "Filter", icon: IconFilter },
  { name: "flag", label: "Flag", icon: IconFlag },
  { name: "flame", label: "Flame", icon: IconFlame },
  { name: "folder", label: "Folder", icon: IconFolder },
  { name: "gift", label: "Gift", icon: IconGift },
  { name: "globe", label: "Globe", icon: IconGlobe },
  { name: "graph", label: "Graph", icon: IconGraph },
  { name: "heart", label: "Heart", icon: IconHeart },
  { name: "help-circle", label: "Help", icon: IconHelpCircle },
  { name: "home", label: "Home", icon: IconHome },
  { name: "id", label: "ID", icon: IconId },
  { name: "inbox", label: "Inbox", icon: IconInbox },
  { name: "info-circle", label: "Info", icon: IconInfoCircle },
  { name: "key", label: "Key", icon: IconKey },
  { name: "dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { name: "lifebuoy", label: "Support", icon: IconLifebuoy },
  { name: "link", label: "Link", icon: IconLink },
  { name: "list-check", label: "List check", icon: IconListCheck },
  { name: "lock", label: "Lock", icon: IconLock },
  { name: "mail", label: "Mail", icon: IconMail },
  { name: "map-pin", label: "Map pin", icon: IconMapPin },
  { name: "message", label: "Message", icon: IconMessage },
  { name: "messages", label: "Messages", icon: IconMessages },
  { name: "microphone", label: "Microphone", icon: IconMicrophone },
  { name: "mood-smile", label: "Smile", icon: IconMoodSmile },
  { name: "notebook", label: "Notebook", icon: IconNotebook },
  { name: "palette", label: "Palette", icon: IconPalette },
  { name: "paperclip", label: "Paperclip", icon: IconPaperclip },
  { name: "pencil", label: "Pencil", icon: IconPencil },
  { name: "phone", label: "Phone", icon: IconPhone },
  { name: "photo", label: "Photo", icon: IconPhoto },
  { name: "plug", label: "Plug", icon: IconPlug },
  { name: "presentation", label: "Presentation", icon: IconPresentation },
  { name: "puzzle", label: "Puzzle", icon: IconPuzzle },
  { name: "qr-code", label: "QR code", icon: IconQrcode },
  { name: "rocket", label: "Rocket", icon: IconRocket },
  { name: "rosette-check", label: "Rosette check", icon: IconRosetteDiscountCheck },
  { name: "route", label: "Route", icon: IconRoute },
  { name: "search", label: "Search", icon: IconSearch },
  { name: "send", label: "Send", icon: IconSend },
  { name: "settings", label: "Settings", icon: IconSettings },
  { name: "share", label: "Share", icon: IconShare },
  { name: "shield-check", label: "Shield check", icon: IconShieldCheck },
  { name: "shopping-cart", label: "Shopping cart", icon: IconShoppingCart },
  { name: "sparkles", label: "Sparkles", icon: IconSparkles },
  { name: "star", label: "Star", icon: IconStar },
  { name: "stars", label: "Stars", icon: IconStars },
  { name: "target", label: "Target", icon: IconTargetArrow },
  { name: "template", label: "Template", icon: IconTemplate },
  { name: "thumb-up", label: "Thumb up", icon: IconThumbUp },
  { name: "tools", label: "Tools", icon: IconTools },
  { name: "trending-up", label: "Trending up", icon: IconTrendingUp },
  { name: "trophy", label: "Trophy", icon: IconTrophy },
  { name: "truck-delivery", label: "Delivery", icon: IconTruckDelivery },
  { name: "upload", label: "Upload", icon: IconUpload },
  { name: "user", label: "User", icon: IconUser },
  { name: "user-check", label: "User check", icon: IconUserCheck },
  { name: "user-plus", label: "User plus", icon: IconUserPlus },
  { name: "users", label: "Users", icon: IconUsers },
  { name: "users-group", label: "Users group", icon: IconUsersGroup },
  { name: "variable", label: "Variable", icon: IconVariable },
  { name: "video", label: "Video", icon: IconVideo },
  { name: "wallet", label: "Wallet", icon: IconWallet },
  { name: "wand", label: "Wand", icon: IconWand },
  { name: "world", label: "World", icon: IconWorld },
  { name: "writing", label: "Writing", icon: IconWriting },
  { name: "x", label: "X", icon: IconX },
  { name: "zoom-in", label: "Zoom in", icon: IconZoomIn },
] as const

const iconComponentByName = Object.fromEntries(
  iconListOptions.map((option) => [option.name, option.icon])
) as Record<string, TablerIcon>

const iconColorOptions = [
  { name: "neutral", label: "Neutral", className: "lightsite-next-icon-color-neutral" },
  { name: "indigo", label: "Indigo", className: "lightsite-next-icon-color-indigo" },
  { name: "blue", label: "Blue", className: "lightsite-next-icon-color-blue" },
  { name: "sky", label: "Sky", className: "lightsite-next-icon-color-sky" },
  { name: "cyan", label: "Cyan", className: "lightsite-next-icon-color-cyan" },
  { name: "teal", label: "Teal", className: "lightsite-next-icon-color-teal" },
  { name: "emerald", label: "Emerald", className: "lightsite-next-icon-color-emerald" },
  { name: "amber", label: "Amber", className: "lightsite-next-icon-color-amber" },
  { name: "rose", label: "Rose", className: "lightsite-next-icon-color-rose" },
  { name: "pink", label: "Pink", className: "lightsite-next-icon-color-pink" },
] as const

function useIconPickerMenu(editor: NodeViewProps["editor"]) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        return
      }

      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        editor.commands.focus(undefined, { scrollIntoView: false })
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [editor, open])

  const openMenu = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(true)
  }, [])

  const closeAndFocusEditor = useCallback(() => {
    setOpen(false)
    window.requestAnimationFrame(() => {
      editor.commands.focus(undefined, { scrollIntoView: false })
    })
  }, [editor])

  return {
    closeAndFocusEditor,
    menuId,
    open,
    openMenu,
    wrapperRef,
  }
}

function IconSelectorMenu({
  className,
  iconColor,
  iconName,
  menuId,
  onSelectColor,
  onSelectIcon,
}: {
  className?: string
  iconColor: string
  iconName: string
  menuId: string
  onSelectColor: (color: string) => void
  onSelectIcon: (icon: string) => void
}) {
  return (
    <div
      id={menuId}
      className={cn("lightsite-next-icon-picker", className)}
      contentEditable={false}
      role="menu"
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      <div className="lightsite-next-icon-color-rail" aria-label="Icon colors">
        {iconColorOptions.map((option) => (
          <button
            key={option.name}
            aria-label={option.label}
            className={cn(
              "lightsite-next-icon-color-button",
              option.className,
              option.name === iconColor && "lightsite-next-icon-color-button-active"
            )}
            role="menuitemradio"
            aria-checked={option.name === iconColor}
            type="button"
            onClick={() => onSelectColor(option.name)}
          />
        ))}
      </div>
      <div className="lightsite-next-icon-scroll" aria-label="Icons">
        <div className="lightsite-next-icon-picker-grid">
          {iconListOptions.map((option) => (
            <button
              key={option.name}
              aria-label={option.label}
              className={cn(
                "lightsite-next-icon-picker-button",
                option.name === iconName && "lightsite-next-icon-picker-button-active"
              )}
              role="menuitemradio"
              aria-checked={option.name === iconName}
              type="button"
              onClick={() => onSelectIcon(option.name)}
            >
              <option.icon
                aria-hidden="true"
                focusable="false"
                size={18}
                stroke={2}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function IconListItemView({ editor, node, updateAttributes }: NodeViewProps) {
  const { closeAndFocusEditor, menuId, open, openMenu, wrapperRef } = useIconPickerMenu(editor)
  const iconName = stringAttr(node.attrs.icon, "box")
  const iconColor = stringAttr(node.attrs.iconColor, "neutral")
  const iconColorClass = getIconColorClass(iconColor)

  const selectIcon = useCallback(
    (nextIcon: string) => {
      updateAttributes({ icon: nextIcon })
      closeAndFocusEditor()
    },
    [closeAndFocusEditor, updateAttributes]
  )

  const selectColor = useCallback(
    (nextColor: string) => {
      updateAttributes({ iconColor: nextColor })
    },
    [updateAttributes]
  )

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="lightsite-next-icon-list-inner"
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Change icon bullet"
        aria-controls={open ? menuId : undefined}
        className={cn("lightsite-next-icon-bullet", iconColorClass)}
        contentEditable={false}
        type="button"
        onClick={openMenu}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return
          }

          openMenu(event)
        }}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <IconGlyph name={iconName} size={14} />
      </button>
      <NodeViewContent className="lightsite-next-icon-list-content" />
      {open ? (
        <IconSelectorMenu
          iconColor={iconColor}
          iconName={iconName}
          menuId={menuId}
          onSelectColor={selectColor}
          onSelectIcon={selectIcon}
        />
      ) : null}
    </NodeViewWrapper>
  )
}

export function PageTitleSectionView({ editor, extension, node }: NodeViewProps) {
  const [failedWorkspaceLogoSrc, setFailedWorkspaceLogoSrc] = useState<string | null>(null)
  const [failedRecipientLogoSrc, setFailedRecipientLogoSrc] = useState<string | null>(null)
  const align = node.attrs.align === "left" || node.attrs.align === "right" ? "left" : "center"
  const options = extension.options as {
    workspaceLogoUrl?: string | null
    workspaceName?: string
    workspaceWebsiteDomain?: string
  }
  const workspaceName = options.workspaceName?.trim() || "Workspace"
  const resolvedWorkspaceLogoSrc =
    options.workspaceLogoUrl?.trim() ||
    buildLogoPreviewImageSrc(options.workspaceWebsiteDomain, getCurrentLogoTheme())
  const workspaceLogoSrc =
    resolvedWorkspaceLogoSrc && failedWorkspaceLogoSrc !== resolvedWorkspaceLogoSrc
      ? resolvedWorkspaceLogoSrc
      : null
  const recipientWebsite = getLightsiteVariableValue(editor, "recipient_website")
  const recipientLogoSrc = buildLogoPreviewImageSrc(recipientWebsite, getCurrentLogoTheme())
  const showRecipientLogo = Boolean(
    recipientLogoSrc && failedRecipientLogoSrc !== recipientLogoSrc
  )

  return (
    <NodeViewWrapper
      as="section"
      data-align={align}
      data-lightsite-next-block=""
      data-lightsite-next-block-type="page-title"
      className="lightsite-next-page-title-shell"
    >
      <div className="lightsite-next-page-title">
        <div className="lightsite-next-page-title-logos" contentEditable={false}>
          <LogoTile
            alt={`${workspaceName} logo`}
            fallbackImageSrc="/lightsite-logo.svg"
            fallback={workspaceName}
            src={workspaceLogoSrc}
            onError={() => {
              if (resolvedWorkspaceLogoSrc) {
                setFailedWorkspaceLogoSrc(resolvedWorkspaceLogoSrc)
              }
            }}
          />
          {recipientLogoSrc && showRecipientLogo ? (
            <LogoTile
              alt="Recipient company logo"
              fallback=""
              src={recipientLogoSrc}
              onError={() => {
                setFailedRecipientLogoSrc(recipientLogoSrc)
              }}
            />
          ) : null}
        </div>
        <NodeViewContent className="lightsite-next-page-title-content" />
      </div>
    </NodeViewWrapper>
  )
}

function LogoTile({
  alt,
  fallbackImageSrc,
  fallback,
  onError,
  src,
}: {
  alt: string
  fallbackImageSrc?: string
  fallback: string
  onError?: () => void
  src: string | null
}) {
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false)
  const imageSrc = src || (fallbackImageSrc && !fallbackImageFailed ? fallbackImageSrc : null)

  return (
    <div className="lightsite-next-page-title-logo-tile">
      {imageSrc ? (
        <img
          alt={alt}
          className="lightsite-next-page-title-logo-img"
          draggable={false}
          src={imageSrc}
          onError={() => {
            if (src) {
              onError?.()
              return
            }

            setFallbackImageFailed(true)
          }}
        />
      ) : (
        <span aria-hidden="true" className="lightsite-next-page-title-logo-fallback">
          {createLogoFallback(fallback)}
        </span>
      )}
    </div>
  )
}

function buildLogoPreviewImageSrc(input: string | null | undefined, theme: "light" | "dark") {
  const domain = normalizeLogoDomain(input)

  if (!domain) {
    return null
  }

  const params = new URLSearchParams({
    domain,
    size: "128",
    theme,
  })

  return `/api/workspaces/logo-preview/image?${params.toString()}`
}

type LogoGridPreviewResult = {
  dataUrl: string
  domain: string
}

async function fetchLogoPreviewDataUrl({
  theme,
  website,
}: {
  theme: "light" | "dark"
  website: string
}): Promise<LogoGridPreviewResult> {
  const params = new URLSearchParams({
    website,
    size: "128",
    theme,
  })
  const headers = getDevAuthBypassHeaders()
  const previewResponse = await fetch(`/api/workspaces/logo-preview?${params.toString()}`, {
    credentials: "include",
    headers,
  })
  const previewBody = await parseLogoGridPreviewResponse(previewResponse)

  if (!previewResponse.ok) {
    throw new Error(previewBody.message ?? "Could not load a logo for that website.")
  }

  if (!previewBody.enabled || !previewBody.imageUrl) {
    throw new Error("Logo search is not enabled in this environment.")
  }

  const imageResponse = await fetch(previewBody.imageUrl, {
    credentials: "include",
    headers,
  })

  if (!imageResponse.ok) {
    throw new Error(
      imageResponse.status === 404
        ? "No logo was found for that website."
        : "Could not load a logo for that website."
    )
  }

  return {
    dataUrl: await blobToDataUrl(await imageResponse.blob()),
    domain: previewBody.domain,
  }
}

async function parseLogoGridPreviewResponse(response: Response) {
  const body = await response.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return {
      domain: "",
      enabled: false,
      imageUrl: null,
      message: "Could not load a logo for that website.",
    }
  }

  const record = body as Record<string, unknown>
  const error = typeof record.error === "object" && record.error ? record.error as Record<string, unknown> : null

  return {
    domain: typeof record.domain === "string" ? record.domain : "",
    enabled: record.enabled === true,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
    message:
      typeof error?.message === "string"
        ? error.message
        : typeof record.message === "string"
          ? record.message
          : null,
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Could not read the logo image."))
    }
    reader.onerror = () => reject(new Error("Could not read the logo image."))
    reader.readAsDataURL(blob)
  })
}

function normalizeLogoDomain(input: string | null | undefined) {
  const value = input?.trim()

  if (!value) {
    return null
  }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`)
    const hostname = url.hostname.replace(/^www\./, "")

    return hostname.includes(".") ? hostname : null
  } catch {
    return null
  }
}

function getCurrentLogoTheme(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light"
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function createLogoFallback(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "L"
}

export function ImageCardView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const [uploadError, setUploadError] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const src = stringAttr(node.attrs.src, "")
  const alt = stringAttr(node.attrs.alt, "")
  const imageHeight = numberAttr(node.attrs.imageHeight)
  const imageWidth = numberAttr(node.attrs.imageWidth)
  const includeButton = Boolean(node.attrs.includeButton)
  const buttonLabel = stringAttr(node.attrs.buttonLabel, "Learn more") || "Learn more"
  const buttonUrl = stringAttr(node.attrs.buttonUrl, "")
  const imageAspectRatio =
    imageWidth && imageHeight ? `${imageWidth} / ${imageHeight}` : undefined

  useEffect(() => {
    if (!src || imageAspectRatio || typeof getPos !== "function") {
      return
    }

    let active = true

    void loadImageDimensions(src)
      .then((dimensions) => {
        if (!active) {
          return
        }

        const pos = getPos()

        if (typeof pos !== "number") {
          return
        }

        const currentNode = editor.state.doc.nodeAt(pos)

        if (currentNode?.type.name !== "imageCard" || currentNode.attrs.src !== src) {
          return
        }

        const fittedDimensions = fitImageDimensions(dimensions.width, dimensions.height)
        const tr = editor.state.tr
          .setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            imageHeight: fittedDimensions.height,
            imageWidth: fittedDimensions.width,
          })
          .setMeta("addToHistory", false)

        editor.view.dispatch(tr)
      })
      .catch(() => {
        if (active) {
          setUploadError(true)
        }
      })

    return () => {
      active = false
    }
  }, [editor, getPos, imageAspectRatio, src])

  const setImageFromFile = useCallback(
    async (file: File) => {
      try {
        const attrs = await readImageFileAsAttrs(file)

        updateAttributes({
          alt: attrs.alt,
          imageHeight: attrs.height,
          imageWidth: attrs.width,
          src: attrs.src,
        })
        setUploadError(false)
      } catch {
        setUploadError(true)
      }
    },
    [updateAttributes]
  )

  const openFilePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!editor.isEditable) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    inputRef.current?.click()
  }, [editor])

  const openButtonSettings = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!editor.isEditable) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (typeof getPos !== "function") {
        return
      }

      const pos = getPos()

      if (typeof pos !== "number") {
        return
      }

      editor.commands.openLightsiteNextImageCardButtonSettings(pos, "edit")
    },
    [editor, getPos]
  )

  const handleFileChange = useCallback(() => {
    const file = inputRef.current?.files?.[0]

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    if (file) {
      void setImageFromFile(file)
    }
  }, [setImageFromFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!editor.isEditable) {
      return
    }

    if (!event.dataTransfer.types.includes("Files")) {
      return
    }

    event.preventDefault()
    setDragActive(true)
  }, [editor])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!editor.isEditable) {
      return
    }

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setDragActive(false)
  }, [editor])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!editor.isEditable) {
        return
      }

      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith("image/")
      )

      if (!file) {
        return
      }

      event.preventDefault()
      setDragActive(false)
      void setImageFromFile(file)
    },
    [editor, setImageFromFile]
  )

  return (
    <NodeViewWrapper
      as="figure"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="image-card"
      className="lightsite-next-image-card-shell"
    >
      <div className="lightsite-next-image-card">
        <div
          className="lightsite-next-image-card-media"
          contentEditable={false}
          data-drag-active={dragActive ? "true" : undefined}
          data-has-image={src ? "true" : undefined}
          data-has-image-ratio={imageAspectRatio ? "true" : undefined}
          data-upload-error={uploadError ? "true" : undefined}
          style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            accept="image/*"
            aria-hidden="true"
            className="lightsite-next-image-empty-input"
            hidden
            tabIndex={-1}
            type="file"
            onChange={handleFileChange}
          />
          {src ? (
            <button
              aria-label="Replace image"
              className="lightsite-next-image-card-replace-button"
              title="Replace image"
              type="button"
              onClick={openFilePicker}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <img src={src} alt={alt} className="lightsite-next-image-card-img" />
            </button>
          ) : (
            <button
              className="lightsite-next-image-empty-button lightsite-next-image-card-empty-button"
              type="button"
              onClick={openFilePicker}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <span className="lightsite-next-image-empty-title">Upload image</span>
              <span className="lightsite-next-image-empty-description">
                {uploadError ? "This image could not be loaded" : "Click or drag an image file here"}
              </span>
            </button>
          )}
        </div>
        <div className="lightsite-next-image-card-copy">
          <NodeViewContent className="lightsite-next-card-content lightsite-next-image-card-content min-w-0" />
          {includeButton ? (
            <a
              className="lightsite-next-image-card-cta"
              href={buttonUrl || "#"}
              contentEditable={false}
              onClick={openButtonSettings}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              {buttonLabel}
            </a>
          ) : null}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export function LogoGridView() {
  return (
    <NodeViewWrapper
      as="section"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="logo-grid"
      className="lightsite-next-logo-grid-shell"
    >
      <NodeViewContent className="lightsite-next-logo-grid" />
    </NodeViewWrapper>
  )
}

export function LogoGridItemView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const [uploadError, setUploadError] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [logoMenuOpen, setLogoMenuOpen] = useState(false)
  const [domainInput, setDomainInput] = useState("")
  const [domainError, setDomainError] = useState<string | null>(null)
  const [domainLoading, setDomainLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const logoButtonRef = useRef<HTMLButtonElement | null>(null)
  const logoMenuRef = useRef<HTMLDivElement | null>(null)
  const domainInputId = useId()
  const src = stringAttr(node.attrs.src, "")
  const alt = stringAttr(node.attrs.alt, "Logo")
  const itemPos = typeof getPos === "function" ? getPos() : null
  const canRemove =
    typeof itemPos === "number" && getLogoGridItemCount(editor, itemPos) > 1

  useEffect(() => {
    if (!logoMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        target instanceof Node &&
        (logoMenuRef.current?.contains(target) || logoButtonRef.current?.contains(target))
      ) {
        return
      }

      setLogoMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLogoMenuOpen(false)
        editor.commands.focus(undefined, { scrollIntoView: false })
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [editor, logoMenuOpen])

  const setLogoFromFile = useCallback(
    async (file: File) => {
      try {
        const attrs = await readImageFileAsAttrs(file)

        updateAttributes({
          alt: attrs.alt || file.name.replace(/\.[^.]+$/, "") || "Logo",
          src: attrs.src,
        })
        setLogoMenuOpen(false)
        setDomainError(null)
        setUploadError(false)
      } catch {
        setUploadError(true)
      }
    },
    [updateAttributes]
  )

  const toggleLogoMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setLogoMenuOpen((open) => !open)
  }, [])

  const openFilePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    inputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(() => {
    const file = inputRef.current?.files?.[0]

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    if (file) {
      void setLogoFromFile(file)
    }
  }, [setLogoFromFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return
    }

    event.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith("image/")
      )

      if (!file) {
        return
      }

      event.preventDefault()
      setDragActive(false)
      void setLogoFromFile(file)
    },
    [setLogoFromFile]
  )

  const applyLogoFromDomain = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      const submittedValue =
        event?.currentTarget instanceof HTMLFormElement
          ? new FormData(event.currentTarget).get("logo_company_website")
          : domainInput
      const domain = normalizeLogoDomain(typeof submittedValue === "string" ? submittedValue : "")

      if (!domain) {
        setDomainError("Enter a valid company website.")
        return
      }

      setDomainLoading(true)
      setDomainError(null)

      try {
        const image = await fetchLogoPreviewDataUrl({
          website: domain,
          theme: getCurrentLogoTheme(),
        })

        updateAttributes({
          alt: image.domain,
          src: image.dataUrl,
        })
        setDomainInput(image.domain)
        setLogoMenuOpen(false)
        setUploadError(false)
      } catch (error) {
        setDomainError(
          error instanceof Error && error.message
            ? error.message
            : "Could not load a logo for that website."
        )
      } finally {
        setDomainLoading(false)
      }
    },
    [domainInput, updateAttributes]
  )

  const removeItem = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (typeof getPos !== "function") {
      return
    }

    const pos = getPos()

    if (typeof pos !== "number" || getLogoGridItemCount(editor, pos) <= 1) {
      return
    }

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run()
  }, [editor, getPos, node.nodeSize])

  const focusEmptyTitle = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return
      }

      const target =
        event.target instanceof Element
          ? event.target.closest("[data-lightsite-logo-grid-title]")
          : null

      if (!target || !target.classList.contains("is-empty")) {
        return
      }

      const resolved = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      })

      if (!resolved) {
        return
      }

      event.preventDefault()
      editor.view.dispatch(
        editor.state.tr
          .setSelection(TextSelection.near(editor.state.doc.resolve(resolved.pos)))
          .scrollIntoView()
      )
      editor.view.focus()
    },
    [editor]
  )

  return (
    <NodeViewWrapper
      as="article"
      className="lightsite-next-logo-grid-item"
      data-lightsite-logo-grid-item=""
      data-drag-active={dragActive ? "true" : undefined}
      data-has-logo={src ? "true" : undefined}
      data-upload-error={uploadError ? "true" : undefined}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={focusEmptyTitle}
    >
      <input
        ref={inputRef}
        accept="image/*"
        aria-hidden="true"
        className="lightsite-next-image-empty-input"
        contentEditable={false}
        hidden
        tabIndex={-1}
        type="file"
        onChange={handleFileChange}
      />
      <button
        ref={logoButtonRef}
        aria-expanded={logoMenuOpen}
        aria-label={src ? "Change logo" : "Add logo"}
        className="lightsite-next-logo-grid-logo-button"
        contentEditable={false}
        title={src ? "Change logo" : "Add logo"}
        type="button"
        onClick={toggleLogoMenu}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {src ? (
          <img alt={alt} className="lightsite-next-logo-grid-img" draggable={false} src={src} />
        ) : (
          <IconPhoto aria-hidden="true" focusable="false" size={20} stroke={2} />
        )}
      </button>
      {logoMenuOpen ? (
        <div
          ref={logoMenuRef}
          className="lightsite-next-logo-grid-menu"
          contentEditable={false}
          onMouseDown={(event) => {
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
        >
          <button
            className="lightsite-next-logo-grid-menu-item"
            type="button"
            onClick={openFilePicker}
          >
            <IconUpload aria-hidden="true" focusable="false" size={16} stroke={2} />
            <span>Upload image</span>
          </button>
          <div className="lightsite-next-logo-grid-menu-separator" />
          <form className="lightsite-next-logo-grid-domain-form" onSubmit={applyLogoFromDomain}>
            <label className="lightsite-next-logo-grid-domain-label" htmlFor={domainInputId}>
              Company website
            </label>
            <div className="lightsite-next-logo-grid-domain-control">
              <IconWorld aria-hidden="true" focusable="false" size={16} stroke={2} />
              <input
                id={domainInputId}
                autoComplete="off"
                className="lightsite-next-logo-grid-domain-input"
                disabled={domainLoading}
                name="logo_company_website"
                placeholder="acme.com"
                type="text"
                value={domainInput}
                onChange={(event) => {
                  setDomainInput(event.target.value)
                  setDomainError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation()
                    setLogoMenuOpen(false)
                  }
                }}
              />
            </div>
            {domainError ? (
              <p className="lightsite-next-logo-grid-domain-error">{domainError}</p>
            ) : null}
            {uploadError ? (
              <p className="lightsite-next-logo-grid-domain-error">Could not upload that image.</p>
            ) : null}
            <div className="lightsite-next-logo-grid-domain-actions">
              <button
                className="lightsite-next-logo-grid-domain-cancel"
                disabled={domainLoading}
                type="button"
                onClick={() => {
                  setLogoMenuOpen(false)
                  setDomainError(null)
                }}
              >
                Cancel
              </button>
              <button
                className="lightsite-next-logo-grid-domain-submit"
                disabled={domainLoading}
                type="submit"
              >
                {domainLoading ? "Loading" : "Use logo"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <NodeViewContent className="lightsite-next-logo-grid-title-content" />
      {canRemove ? (
        <button
          aria-label="Remove logo"
          className="lightsite-next-logo-grid-remove"
          contentEditable={false}
          title="Remove logo"
          type="button"
          onClick={removeItem}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <IconX aria-hidden="true" focusable="false" size={14} stroke={2} />
        </button>
      ) : null}
    </NodeViewWrapper>
  )
}

export function TestimonialCardView({ editor, node, updateAttributes }: NodeViewProps) {
  const [uploadError, setUploadError] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const src = stringAttr(node.attrs.src, "")
  const alt = stringAttr(node.attrs.alt, "")

  const setAvatarFromFile = useCallback(
    async (file: File) => {
      try {
        const attrs = await readImageFileAsAttrs(file)

        updateAttributes({
          alt: attrs.alt,
          avatarHeight: attrs.height,
          avatarWidth: attrs.width,
          src: attrs.src,
        })
        setUploadError(false)
      } catch {
        setUploadError(true)
      }
    },
    [updateAttributes]
  )

  const openFilePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    inputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(() => {
    const file = inputRef.current?.files?.[0]

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    if (file) {
      void setAvatarFromFile(file)
    }
  }, [setAvatarFromFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return
    }

    event.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith("image/")
      )

      if (!file) {
        return
      }

      event.preventDefault()
      setDragActive(false)
      void setAvatarFromFile(file)
    },
    [setAvatarFromFile]
  )

  const focusEmptyTextField = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      const target =
        event.target instanceof Element
          ? event.target.closest(
              "[data-lightsite-testimonial-author-name], [data-lightsite-testimonial-author-role], [data-lightsite-testimonial-quote]"
            )
          : null

      if (!target || !target.classList.contains("is-empty")) {
        return
      }

      const resolved = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      })

      if (!resolved) {
        return
      }

      event.preventDefault()
      editor.view.dispatch(
        editor.state.tr
          .setSelection(TextSelection.near(editor.state.doc.resolve(resolved.pos)))
          .scrollIntoView()
      )
      editor.view.focus()
    },
    [editor]
  )

  return (
    <NodeViewWrapper
      as="article"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="testimonial"
      className="lightsite-next-testimonial-card-shell"
    >
      <div
        className="lightsite-next-testimonial-card"
        data-drag-active={dragActive ? "true" : undefined}
        data-upload-error={uploadError ? "true" : undefined}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={focusEmptyTextField}
      >
        <input
          ref={inputRef}
          accept="image/*"
          aria-hidden="true"
          className="lightsite-next-image-empty-input"
          contentEditable={false}
          hidden
          tabIndex={-1}
          type="file"
          onChange={handleFileChange}
        />
        <button
          aria-label={src ? "Replace avatar" : "Upload avatar"}
          className="lightsite-next-testimonial-avatar"
          contentEditable={false}
          data-has-image={src ? "true" : undefined}
          title={src ? "Replace avatar" : "Upload avatar"}
          type="button"
          onClick={openFilePicker}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          {src ? (
            <img src={src} alt={alt} className="lightsite-next-testimonial-avatar-img" />
          ) : (
            <IconPhoto aria-hidden="true" focusable="false" size={20} stroke={2} />
          )}
        </button>
        <NodeViewContent className="lightsite-next-testimonial-content" />
      </div>
    </NodeViewWrapper>
  )
}

export function IconCardView({ editor, node, updateAttributes }: NodeViewProps) {
  const { closeAndFocusEditor, menuId, open, openMenu, wrapperRef } = useIconPickerMenu(editor)
  const iconName = stringAttr(node.attrs.icon, "bolt")
  const iconColor = stringAttr(node.attrs.iconColor, "neutral")
  const iconColorClass = getIconColorClass(iconColor)

  const selectIcon = useCallback(
    (nextIcon: string) => {
      updateAttributes({ icon: nextIcon })
      closeAndFocusEditor()
    },
    [closeAndFocusEditor, updateAttributes]
  )

  const selectColor = useCallback(
    (nextColor: string) => {
      updateAttributes({ iconColor: nextColor })
    },
    [updateAttributes]
  )

  return (
    <NodeViewWrapper
      as="article"
      data-lightsite-next-block=""
      data-lightsite-next-block-type="icon-card"
    >
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
        <div
          ref={wrapperRef}
          className="lightsite-next-icon-card-picker-anchor"
          contentEditable={false}
        >
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Change card icon"
            aria-controls={open ? menuId : undefined}
            className={cn("lightsite-next-icon-card-button", iconColorClass)}
            type="button"
            onClick={openMenu}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return
              }

              openMenu(event)
            }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <IconGlyph name={iconName} size={18} />
          </button>
          {open ? (
            <IconSelectorMenu
              className="lightsite-next-icon-picker-card"
              iconColor={iconColor}
              iconName={iconName}
              menuId={menuId}
              onSelectColor={selectColor}
              onSelectIcon={selectIcon}
            />
          ) : null}
        </div>
        <NodeViewContent className="lightsite-next-card-content min-w-0" />
      </div>
    </NodeViewWrapper>
  )
}

export function ButtonBlockView({ editor, getPos, node }: NodeViewProps) {
  const href = stringAttr(node.attrs.href, "")
  const fullWidth = Boolean(node.attrs.fullWidth)
  const openSettings = useCallback(
    (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      if (!editor.isEditable) {
        return
      }

      if (isButtonLabelEventTarget(event.target)) {
        return
      }

      if (typeof getPos !== "function") {
        return
      }

      const pos = getPos()

      if (typeof pos !== "number") {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      editor
        .chain()
        .focus()
        .openLightsiteNextButtonSettings(pos, href ? "edit" : "create")
        .run()
    },
    [editor, getPos, href]
  )

  return (
    <NodeViewWrapper
      data-lightsite-next-block=""
      data-lightsite-next-block-type="button"
      data-full-width={fullWidth ? "true" : undefined}
    >
      <div
        className={cn(
          "lightsite-next-button-block",
          fullWidth && "lightsite-next-button-block-full"
        )}
        data-link-empty={href ? undefined : "true"}
        title={href || "No link set"}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            openSettings(event)
          }
        }}
        onMouseDown={openSettings}
        tabIndex={0}
      >
        <NodeViewContent
          className="lightsite-next-button-label min-w-5 outline-none"
          data-lightsite-next-button-label=""
        />
      </div>
    </NodeViewWrapper>
  )
}

function isButtonLabelEventTarget(target: EventTarget | null) {
  const element =
    target instanceof Element ? target : target instanceof Text ? target.parentElement : null

  return Boolean(element?.closest("[data-lightsite-next-button-label]"))
}

function IconGlyph({ name, size }: { name: unknown; size: number }) {
  const Icon = typeof name === "string" ? iconComponentByName[name] : undefined
  const Glyph = Icon ?? IconBox

  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      size={size}
      stroke={2}
    />
  )
}

function getIconColorClass(color: string) {
  return (
    iconColorOptions.find((option) => option.name === color)?.className ??
    "lightsite-next-icon-color-neutral"
  )
}

function stringAttr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback
}

function numberAttr(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

function getLogoGridItemCount(editor: NodeViewProps["editor"], itemPos: number) {
  const safePosition = Math.max(0, Math.min(itemPos, editor.state.doc.content.size))
  const $position = editor.state.doc.resolve(safePosition)

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth)

    if (node.type.name === "logoGrid") {
      return node.childCount
    }
  }

  return 1
}
