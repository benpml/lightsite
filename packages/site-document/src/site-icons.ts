import { SITE_ICON_SVG_BODIES } from "./site-icon-svg-bodies.generated"

const icon = <const TName extends string, const TLabel extends string>(
  name: TName,
  label: TLabel,
  tablerName: string = name,
) => ({ name, label, tablerName })

/** The only icon catalog used by the editor, Preview, and published sites. */
export const SITE_ICON_OPTIONS = [
  icon("activity", "Activity"), icon("adjustments", "Adjustments", "adjustments-horizontal"),
  icon("alert-circle", "Alert"), icon("archive", "Archive"), icon("arrow-down", "Arrow down"),
  icon("arrow-left", "Arrow left"), icon("arrow-right", "Arrow right"), icon("arrow-up", "Arrow up"),
  icon("arrow-up-right", "Arrow up right"), icon("award", "Award"), icon("bell", "Bell"),
  icon("bolt", "Bolt"), icon("book", "Book"), icon("bookmark", "Bookmark"), icon("box", "Box"),
  icon("briefcase", "Briefcase"), icon("browser", "Browser"), icon("building", "Building"),
  icon("bulb", "Bulb"), icon("calendar", "Calendar"), icon("chart", "Chart", "chart-bar"),
  icon("chart-dots", "Chart dots"), icon("chart-line", "Chart line"), icon("chart-pie", "Chart pie"),
  icon("check", "Check"), icon("chevron-down", "Chevron down"), icon("circle-check", "Circle check"),
  icon("circle-dashed", "Circle dashed"), icon("clipboard-check", "Clipboard check"), icon("clock", "Clock"),
  icon("cloud", "Cloud"), icon("code", "Code"), icon("coin", "Coin"), icon("command", "Command"),
  icon("compass", "Compass"), icon("copy", "Copy"), icon("credit-card", "Credit card"),
  icon("database", "Database"), icon("device-analytics", "Analytics"),
  icon("desktop", "Desktop", "device-desktop"), icon("laptop", "Laptop", "device-laptop"),
  icon("mobile", "Mobile", "device-mobile"), icon("diamond", "Diamond"), icon("dots", "Dots"),
  icon("download", "Download"), icon("edit", "Edit"), icon("eye", "Eye"),
  icon("file-analytics", "File analytics"), icon("file-check", "File check"),
  icon("file-description", "File description"), icon("file", "File", "file-text"), icon("filter", "Filter"),
  icon("flag", "Flag"), icon("flame", "Flame"), icon("folder", "Folder"), icon("gift", "Gift"),
  icon("globe", "Globe"), icon("graph", "Graph"), icon("heart", "Heart"),
  icon("help-circle", "Help"), icon("home", "Home"), icon("id", "ID"), icon("inbox", "Inbox"),
  icon("info-circle", "Info"), icon("key", "Key"), icon("dashboard", "Dashboard", "layout-dashboard"),
  icon("lifebuoy", "Support"), icon("link", "Link"), icon("list-check", "List check"), icon("lock", "Lock"),
  icon("mail", "Mail"), icon("map-pin", "Map pin"), icon("message", "Message"), icon("messages", "Messages"),
  icon("microphone", "Microphone"), icon("mood-smile", "Smile"), icon("menu", "Menu", "menu-2"),
  icon("notebook", "Notebook"), icon("notes", "Notes"),
  icon("palette", "Palette"), icon("paperclip", "Paperclip"), icon("pencil", "Pencil"), icon("phone", "Phone"),
  icon("photo", "Photo"), icon("plug", "Plug"), icon("presentation", "Presentation"), icon("puzzle", "Puzzle"),
  icon("qr-code", "QR code", "qrcode"), icon("quote", "Quote"), icon("rocket", "Rocket"),
  icon("rosette-check", "Rosette check", "rosette-discount-check"), icon("route", "Route"),
  icon("search", "Search"), icon("send", "Send"), icon("settings", "Settings"), icon("share", "Share"),
  icon("shield-check", "Shield check"), icon("shopping-cart", "Shopping cart"), icon("sparkles", "Sparkles"),
  icon("star", "Star"), icon("stars", "Stars"), icon("target", "Target", "target-arrow"),
  icon("template", "Template"), icon("thumb-up", "Thumb up"), icon("tools", "Tools"),
  icon("trending-up", "Trending up"), icon("trophy", "Trophy"), icon("truck-delivery", "Delivery"),
  icon("upload", "Upload"), icon("user", "User"), icon("user-check", "User check"),
  icon("user-plus", "User plus"), icon("users", "Users"), icon("users-group", "Users group"),
  icon("variable", "Variable"), icon("video", "Video"), icon("wallet", "Wallet"), icon("wand", "Wand"),
  icon("world", "World"), icon("writing", "Writing"), icon("x", "X"), icon("zoom-in", "Zoom in"),
] as const

export type SiteIconName = (typeof SITE_ICON_OPTIONS)[number]["name"]

export const SITE_ICON_COLOR_OPTIONS = [
  { name: "neutral", label: "Neutral" }, { name: "purple", label: "Purple" },
  { name: "blue", label: "Blue" }, { name: "cyan", label: "Cyan" },
  { name: "teal", label: "Teal" }, { name: "green", label: "Green" },
  { name: "yellow", label: "Yellow" }, { name: "orange", label: "Orange" },
  { name: "red", label: "Red" }, { name: "pink", label: "Pink" },
] as const

export type SiteIconColor = (typeof SITE_ICON_COLOR_OPTIONS)[number]["name"]

const supportedNames = new Set<string>(SITE_ICON_OPTIONS.map((option) => option.name))
const supportedColors = new Set<string>(SITE_ICON_COLOR_OPTIONS.map((option) => option.name))
const legacyColorNames: Readonly<Record<string, SiteIconColor>> = {
  indigo: "purple",
  sky: "cyan",
  emerald: "green",
  amber: "yellow",
  rose: "red",
}

export function normalizeSiteIconName(value: unknown, fallback: SiteIconName = "box"): SiteIconName {
  return typeof value === "string" && supportedNames.has(value) ? value as SiteIconName : fallback
}

export function normalizeSiteIconColor(value: unknown) {
  if (typeof value !== "string") {
    return "neutral"
  }

  const normalized = legacyColorNames[value] ?? value
  return supportedColors.has(normalized) ? normalized as SiteIconColor : "neutral"
}

export function getSiteIconSvgBody(value: unknown) {
  return SITE_ICON_SVG_BODIES[normalizeSiteIconName(value)]
}

export function renderSiteIconSvg(value: unknown) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getSiteIconSvgBody(value)}</svg>`
}
