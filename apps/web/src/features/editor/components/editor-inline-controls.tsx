import {
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react"
import {
  IconAlien,
  IconBalloon,
  IconBox,
  IconBrandSlack,
  IconCalendarEvent,
  IconClick,
  IconDatabase,
  IconDeviceDesktop,
  IconFlag,
  IconGif,
  IconHeart,
  IconMail,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconQuote,
  IconRocket,
  IconShield,
  IconStars,
  IconTargetArrow,
  IconUsers,
  IconVideo,
  IconWorld,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { IconName, IconTone } from "../tiptap/editor-blocks"

const iconOptions: Array<{
  icon: IconName
  label: string
}> = [
  { icon: "box", label: "Box" },
  { icon: "alien", label: "Alien" },
  { icon: "balloon", label: "Balloon" },
  { icon: "stars", label: "Stars" },
  { icon: "rocket", label: "Rocket" },
  { icon: "target", label: "Target" },
  { icon: "shield", label: "Shield" },
  { icon: "users", label: "Users" },
  { icon: "world", label: "World" },
  { icon: "desktop", label: "Desktop" },
  { icon: "database", label: "Database" },
  { icon: "mail", label: "Mail" },
  { icon: "phone", label: "Phone" },
  { icon: "heart", label: "Heart" },
  { icon: "flag", label: "Flag" },
  { icon: "calendar", label: "Calendar" },
  { icon: "video", label: "Video" },
  { icon: "quote", label: "Quote" },
  { icon: "slack", label: "Slack" },
  { icon: "click", label: "Click" },
]

const iconToneOptions: Array<{
  tone: IconTone
  label: string
  value: string
}> = [
  { tone: "default", label: "Default", value: "var(--foreground)" },
  { tone: "violet", label: "Violet", value: "var(--color-violet-500)" },
  { tone: "blue", label: "Blue", value: "var(--color-blue-500)" },
  { tone: "cyan", label: "Cyan", value: "var(--color-cyan-500)" },
  { tone: "teal", label: "Teal", value: "var(--color-teal-500)" },
  { tone: "amber", label: "Amber", value: "var(--color-amber-500)" },
  { tone: "rose", label: "Rose", value: "var(--color-rose-500)" },
  { tone: "pink", label: "Pink", value: "var(--color-pink-500)" },
]

export function InlineAttrInput({
  ariaLabel,
  className,
  disabled,
  onChange,
  onKeyDown,
  placeholder,
  value,
  ...inputProps
}: {
  ariaLabel: string
  className?: string
  disabled?: boolean
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  value: string
} & Omit<
  React.ComponentProps<"input">,
  "aria-label" | "className" | "disabled" | "onChange" | "onKeyDown" | "placeholder" | "value"
>) {
  return (
    <input
      aria-label={ariaLabel}
      className={cn("block w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-default", className)}
      disabled={disabled}
      placeholder={placeholder}
      value={value ?? ""}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
      {...inputProps}
    />
  )
}

export function InlineAttrTextarea({
  ariaLabel,
  className,
  disabled,
  onChange,
  onKeyDown,
  placeholder,
  value,
  ...textareaProps
}: {
  ariaLabel: string
  className?: string
  disabled?: boolean
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  value: string
} & Omit<
  React.ComponentProps<"textarea">,
  "aria-label" | "className" | "disabled" | "onChange" | "onKeyDown" | "placeholder" | "value"
>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      className={cn(
        "block w-full min-w-0 resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-default",
        className
      )}
      disabled={disabled}
      placeholder={placeholder}
      rows={1}
      value={value ?? ""}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
      {...textareaProps}
    />
  )
}

export function InlineIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3.5"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function InlineAddButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn("flex h-[30px] w-fit items-center gap-1.5 rounded-md px-2 text-sm leading-5 text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3.5", className)}
      onClick={onClick}
    >
      <IconPlus />
      {children}
    </button>
  )
}

export function DashedButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      variant="dashed"
      size="compact"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function MediaUploadSurface({
  alt,
  className,
  disabled,
  onChange,
  src,
}: {
  alt?: string
  className?: string
  disabled?: boolean
  onChange: (src: string) => void
  src?: string
}) {
  return (
    <ImagePickerButton
      className={cn(
        "h-[220px] w-full rounded-lg text-muted-foreground hover:bg-muted",
        src ? "bg-background" : "border border-dashed bg-muted/40",
        className
      )}
      disabled={disabled}
      label="Choose image"
      onChange={onChange}
    >
      {src ? <img src={src} alt={alt ?? ""} className="size-full object-cover" /> : <IconPhoto />}
    </ImagePickerButton>
  )
}

export function GifSelectSurface({
  alt,
  disabled,
  height,
  onOpenPicker,
  src,
  width,
}: {
  alt?: string
  disabled?: boolean
  height?: number | null
  onOpenPicker: () => void
  src?: string
  width?: number | null
}) {
  const aspectRatio =
    typeof width === "number" && width > 0 && typeof height === "number" && height > 0
      ? `${width} / ${height}`
      : "16 / 9"

  return (
    <button
      type="button"
      aria-label={src ? "Change GIF" : "Choose GIF"}
      style={{ aspectRatio }}
      className={cn(
        "flex min-h-32 w-full items-center justify-center overflow-hidden rounded-lg text-muted-foreground hover:bg-muted disabled:pointer-events-none",
        src ? "bg-background" : "border border-dashed bg-muted/40"
      )}
      disabled={disabled}
      onClick={onOpenPicker}
    >
      {src ? <img src={src} alt={alt ?? ""} className="size-full object-cover" /> : <IconGif />}
    </button>
  )
}

export function AvatarUploadSurface({
  alt,
  onChange,
  src,
}: {
  alt?: string
  onChange: (src: string) => void
  src?: string
}) {
  return (
    <ImagePickerButton
      className="size-9 rounded-full border bg-secondary text-secondary-foreground hover:bg-muted"
      label="Choose avatar"
      onChange={onChange}
    >
      {src ? <img src={src} alt={alt ?? ""} className="size-full object-cover" /> : <IconQuote />}
    </ImagePickerButton>
  )
}

export function LogoUploadSurface({
  alt,
  disabled,
  onChange,
  src,
}: {
  alt?: string
  disabled?: boolean
  onChange: (src: string) => void
  src?: string
}) {
  return (
    <ImagePickerButton
      className="mt-4 size-10 rounded-lg border bg-background text-muted-foreground hover:bg-muted"
      disabled={disabled}
      label="Choose logo"
      onChange={onChange}
    >
      {src ? <img src={src} alt={alt ?? ""} className="size-full object-contain" /> : <IconPhoto />}
    </ImagePickerButton>
  )
}

export function ImagePickerButton({
  children,
  className,
  disabled,
  label,
  onChange,
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  label: string
  onChange: (src: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelectFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      return
    }

    const reader = new FileReader()

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        onChange(reader.result)
      }
    })

    reader.readAsDataURL(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        tabIndex={-1}
        onChange={(event) => handleSelectFile(event.target.files?.[0])}
      />
      <button
        type="button"
        aria-label={label}
        className={cn("flex shrink-0 items-center justify-center overflow-hidden disabled:pointer-events-none", className)}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </button>
    </>
  )
}

export function IconSelector({
  disabled,
  icon,
  onChange,
  size = "default",
  tone = "default",
}: {
  disabled?: boolean
  icon: IconName
  onChange?: (patch: { icon?: IconName; iconTone?: IconTone }) => void
  size?: "default" | "sm"
  tone?: IconTone
}) {
  const iconColor = getIconToneValue(tone)
  const trigger = (
    <button
      type="button"
      data-icon-selector-trigger=""
      aria-label="Change icon"
      className={cn(
        "flex shrink-0 items-center justify-center border bg-background text-foreground hover:bg-secondary disabled:pointer-events-none",
        size === "sm"
          ? "size-6 rounded-md [&_svg]:size-4"
          : "size-10 rounded-[10px] [&_svg]:size-5"
      )}
      disabled={disabled || !onChange}
      style={{ color: iconColor }}
    >
      <EditorIconGlyph icon={icon} />
    </button>
  )

  if (!onChange || disabled) {
    return trigger
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="h-[226px] w-64 gap-0 overflow-hidden rounded-xl p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex h-[226px] w-full items-start">
          <div className="flex h-full w-[38px] shrink-0 flex-col gap-1.5 border-r px-[9px] py-3">
            {iconToneOptions.map((option) => (
              <button
                key={option.tone}
                type="button"
                aria-label={option.label}
                className={cn(
                  "size-5 rounded-full ring-offset-background",
                  option.tone === tone && "ring-2 ring-foreground ring-offset-2"
                )}
                style={{ backgroundColor: option.value }}
                onClick={() => onChange({ iconTone: option.tone })}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="flex max-h-[202px] flex-wrap content-start items-center gap-1 overflow-y-auto">
              {iconOptions.map((option) => (
                <button
                  key={option.icon}
                  type="button"
                  aria-label={option.label}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md p-0.5 hover:bg-secondary [&_svg]:size-[18px]",
                    option.icon === icon && "bg-secondary"
                  )}
                  style={{ color: iconColor }}
                  onClick={() => onChange({ icon: option.icon })}
                >
                  <EditorIconGlyph icon={option.icon} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function EditorIconGlyph({ icon }: { icon: IconName }) {
  if (icon === "alien") return <IconAlien />
  if (icon === "balloon") return <IconBalloon />
  if (icon === "calendar") return <IconCalendarEvent />
  if (icon === "click") return <IconClick />
  if (icon === "database") return <IconDatabase />
  if (icon === "desktop") return <IconDeviceDesktop />
  if (icon === "flag") return <IconFlag />
  if (icon === "heart") return <IconHeart />
  if (icon === "mail") return <IconMail />
  if (icon === "phone") return <IconPhone />
  if (icon === "quote") return <IconQuote />
  if (icon === "rocket") return <IconRocket />
  if (icon === "shield") return <IconShield />
  if (icon === "slack") return <IconBrandSlack />
  if (icon === "stars") return <IconStars />
  if (icon === "target") return <IconTargetArrow />
  if (icon === "users") return <IconUsers />
  if (icon === "video") return <IconVideo />
  if (icon === "world") return <IconWorld />

  return <IconBox />
}

function getIconToneValue(tone: IconTone) {
  return iconToneOptions.find((option) => option.tone === tone)?.value ?? "var(--foreground)"
}
