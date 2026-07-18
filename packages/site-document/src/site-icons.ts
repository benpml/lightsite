import { SITE_ICON_SVG_BODIES } from "./site-icon-svg-bodies.generated"

const icon = <const TName extends string, const TLabel extends string>(
  name: TName,
  label: TLabel,
  tablerName: string = name,
) => ({ name, label, tablerName })

/** The only icon catalog used by the editor, Preview, and published sites. */
export const SITE_ICON_OPTIONS = [
  icon("activity", "Activity"), icon("address-book", "Address book"),
  icon("adjustments", "Adjustments", "adjustments-horizontal"), icon("affiliate", "Affiliate"),
  icon("ai", "AI"), icon("ai-agent", "AI agent"), icon("alarm", "Alarm"),
  icon("alert-circle", "Alert"), icon("anchor", "Anchor"), icon("api", "API"),
  icon("archive", "Archive"), icon("arrow-down", "Arrow down"),
  icon("arrow-left", "Arrow left"), icon("arrow-right", "Arrow right"), icon("arrow-up", "Arrow up"),
  icon("arrow-up-right", "Arrow up right"), icon("article", "Article"), icon("award", "Award"),
  icon("badge", "Badge"), icon("basket", "Basket"), icon("bell", "Bell"), icon("bolt", "Bolt"),
  icon("book", "Book"), icon("bookmark", "Bookmark"), icon("box", "Box"), icon("brain", "Brain"),
  icon("brand-apple", "Apple"), icon("brand-discord", "Discord"), icon("brand-facebook", "Facebook"),
  icon("brand-github", "GitHub"), icon("brand-google", "Google"), icon("brand-google-drive", "Google Drive"),
  icon("brand-instagram", "Instagram"), icon("brand-linkedin", "LinkedIn"),
  icon("brand-mastercard", "Mastercard"), icon("brand-notion", "Notion"), icon("brand-openai", "OpenAI"),
  icon("brand-paypal", "PayPal"), icon("brand-slack", "Slack"), icon("brand-stripe", "Stripe"),
  icon("brand-tiktok", "TikTok"), icon("brand-visa", "Visa"), icon("brand-whatsapp", "WhatsApp"),
  icon("brand-windows", "Windows"), icon("brand-x", "X / Twitter"), icon("brand-youtube", "YouTube"),
  icon("brand-zoom", "Zoom"), icon("briefcase", "Briefcase"), icon("browser", "Browser"),
  icon("building", "Building"), icon("building-bank", "Bank"), icon("building-store", "Store"),
  icon("buildings", "Buildings"), icon("bulb", "Bulb"), icon("calendar", "Calendar"),
  icon("calendar-event", "Calendar event"), icon("camera", "Camera"), icon("cash", "Cash"),
  icon("certificate", "Certificate"), icon("chart", "Chart", "chart-bar"),
  icon("chart-dots", "Chart dots"), icon("chart-line", "Chart line"), icon("chart-pie", "Chart pie"),
  icon("check", "Check"), icon("checklist", "Checklist"), icon("chevron-down", "Chevron down"),
  icon("circle-check", "Circle check"), icon("circle-dashed", "Circle dashed"),
  icon("clipboard", "Clipboard"), icon("clipboard-check", "Clipboard check"),
  icon("clipboard-list", "Clipboard list"), icon("clock", "Clock"),
  icon("cloud", "Cloud"), icon("code", "Code"), icon("coin", "Coin"), icon("command", "Command"),
  icon("compass", "Compass"), icon("contract", "Contract"), icon("copy", "Copy"),
  icon("credit-card", "Credit card"), icon("database", "Database"),
  icon("device-analytics", "Analytics"), icon("device-floppy", "Save"),
  icon("desktop", "Desktop", "device-desktop"), icon("laptop", "Laptop", "device-laptop"),
  icon("mobile", "Mobile", "device-mobile"), icon("diamond", "Diamond"), icon("discount", "Discount"),
  icon("door-enter", "Enter"), icon("dots", "Dots"), icon("download", "Download"),
  icon("edit", "Edit"), icon("external-link", "External link"), icon("eye", "Eye"),
  icon("file-analytics", "File analytics"), icon("file-certificate", "File certificate"),
  icon("file-check", "File check"), icon("file-description", "File description"),
  icon("file-dollar", "File dollar"), icon("file-invoice", "Invoice"),
  icon("file-report", "File report"), icon("file", "File", "file-text"),
  icon("filter", "Filter"), icon("fingerprint", "Fingerprint"), icon("flag", "Flag"),
  icon("flame", "Flame"), icon("folder", "Folder"), icon("forms", "Forms"), icon("gift", "Gift"),
  icon("globe", "Globe"), icon("graph", "Graph"), icon("headphones", "Headphones"),
  icon("heart", "Heart"), icon("heart-handshake", "Handshake"), icon("help-circle", "Help"),
  icon("hierarchy-2", "Hierarchy"), icon("history", "History"), icon("home", "Home"),
  icon("id", "ID"), icon("inbox", "Inbox"), icon("info-circle", "Info"), icon("key", "Key"),
  icon("dashboard", "Dashboard", "layout-dashboard"), icon("language", "Language"),
  icon("license", "License"), icon("lifebuoy", "Support"), icon("link", "Link"),
  icon("list-check", "List check"), icon("location", "Location"), icon("lock", "Lock"),
  icon("login", "Log in"), icon("logout", "Log out"), icon("mail", "Mail"),
  icon("mail-forward", "Forward mail"), icon("mail-opened", "Opened mail"), icon("map-pin", "Map pin"),
  icon("medal", "Medal"), icon("message", "Message"), icon("message-chatbot", "Chatbot"),
  icon("messages", "Messages"), icon("microphone", "Microphone"), icon("mood-smile", "Smile"),
  icon("menu", "Menu", "menu-2"), icon("network", "Network"), icon("notebook", "Notebook"),
  icon("notes", "Notes"), icon("package", "Package"), icon("palette", "Palette"),
  icon("paperclip", "Paperclip"), icon("pencil", "Pencil"), icon("phone", "Phone"),
  icon("photo", "Photo"), icon("plane", "Plane"), icon("player-play", "Play"), icon("plug", "Plug"),
  icon("plus", "Plus"), icon("presentation", "Presentation"), icon("progress", "Progress"),
  icon("puzzle", "Puzzle"), icon("qr-code", "QR code", "qrcode"), icon("quote", "Quote"),
  icon("receipt", "Receipt"), icon("refresh", "Refresh"), icon("report", "Report"),
  icon("report-analytics", "Report analytics"), icon("robot", "Robot"), icon("rocket", "Rocket"),
  icon("rosette-check", "Rosette check", "rosette-discount-check"), icon("route", "Route"),
  icon("school", "School"), icon("search", "Search"), icon("send", "Send"),
  icon("settings", "Settings"), icon("share", "Share"), icon("shield-check", "Shield check"),
  icon("shopping-bag", "Shopping bag"), icon("shopping-cart", "Shopping cart"),
  icon("signature", "Signature"), icon("sitemap", "Sitemap"), icon("sparkles", "Sparkles"),
  icon("speakerphone", "Announcement"), icon("star", "Star"), icon("stars", "Stars"),
  icon("tag", "Tag"), icon("target", "Target", "target-arrow"), icon("template", "Template"),
  icon("thumb-up", "Thumb up"), icon("timeline", "Timeline"), icon("tools", "Tools"),
  icon("trash", "Trash"), icon("trending-up", "Trending up"), icon("trophy", "Trophy"),
  icon("truck-delivery", "Delivery"),
  icon("upload", "Upload"), icon("user", "User"), icon("user-check", "User check"),
  icon("user-dollar", "User dollar"), icon("user-heart", "User heart"), icon("user-plus", "User plus"),
  icon("user-star", "User star"), icon("users", "Users"), icon("users-group", "Users group"),
  icon("variable", "Variable"), icon("video", "Video"), icon("wallet", "Wallet"), icon("wand", "Wand"),
  icon("world", "World"), icon("world-www", "Website"), icon("writing", "Writing"),
  icon("writing-sign", "Writing sign"), icon("x", "X"), icon("zoom-in", "Zoom in"),
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
