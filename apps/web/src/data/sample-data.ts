import type { ComponentType, SVGProps } from "react"
import {
  IconBook,
  IconBox,
  IconChartBar,
  IconClock,
  IconCopy,
  IconEye,
  IconMouse,
  IconPalette,
  IconScanPosition,
  IconSettings2,
  IconUsersGroup,
  IconWorldLongitude,
} from "@tabler/icons-react"

export type NavItem = {
  title: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export type WorkspaceRole = "admin" | "user"
export type SiteStatus = "draft" | "published" | "archived"
export type SiteVisibility = "private" | "team"
export type SiteAccessLevel = "admin" | "edit" | "view_copy"
export type TrackingEventType =
  | "site_viewed"
  | "button_clicked"
  | "link_preview_loaded"
  | "scroll_depth"

export type WorkspaceSummary = {
  id: string
  name: string
  slug: string
  websiteDomain: string
  initials: string
  role: WorkspaceRole
}

export type CurrentUser = {
  id: string
  name: string
  email: string
  initials: string
}

export type SiteRecord = {
  id: string
  name: string
  slug: string
  status: SiteStatus
  visibility: SiteVisibility
  access: SiteAccessLevel
  variants: number
  views: number
  updatedAt: string
  createdAt: string
  publishedAt?: string
  hasUnpublishedChanges: boolean
  author: {
    name: string
    initials: string
  }
}

export type TrackingEventRecord = {
  id: string
  type: TrackingEventType
  siteId: string
  siteName: string
  variantName: string
  eventName: string
  target: string
  timestamp: string
  isPreviewBot?: boolean
}

export type TeamMemberRecord = {
  id: string
  name: string
  email: string
  role: WorkspaceRole
  avatar: string
  joinedAt: string
  lastActiveAt: string
  isCurrentUser?: boolean
}

export type WorkspaceInviteRecord = {
  id: string
  email: string
  role: WorkspaceRole
  status: "pending" | "expired" | "revoked" | "send_failed"
  invitedBy: string
  sentAt: string
}

export const currentUser: CurrentUser = {
  id: "user-ben",
  name: "Ben Segarra",
  email: "ben@lightsite.app",
  initials: "BS",
}

export const workspaces: WorkspaceSummary[] = [
  {
    id: "workspace-lightsite",
    name: "Lightsite",
    slug: "lightsite",
    websiteDomain: "lightsite.app",
    initials: "LS",
    role: "admin",
  },
  {
    id: "workspace-northstar",
    name: "Northstar",
    slug: "northstar",
    websiteDomain: "northstar.example",
    initials: "NS",
    role: "user",
  },
]

export const activeWorkspace = workspaces[0]

export const primaryNavItems: NavItem[] = [
  { title: "Sites", href: "/sites", icon: IconWorldLongitude },
  { title: "Tracking", href: "/tracking", icon: IconScanPosition },
  { title: "Team", href: "/team", icon: IconUsersGroup },
  { title: "Settings", href: "/settings", icon: IconSettings2 },
]

export const systemNavItems: NavItem[] = [
  { title: "Design system", href: "/design-system", icon: IconPalette },
  { title: "Components", href: "/components", icon: IconBox },
]

export const sites: SiteRecord[] = [
  {
    id: "site-acme-rollout",
    name: "Acme rollout brief",
    slug: "acme-rollout",
    status: "published",
    visibility: "team",
    access: "admin",
    variants: 6,
    views: 148,
    updatedAt: "22m ago",
    createdAt: "3d ago",
    publishedAt: "2h ago",
    hasUnpublishedChanges: true,
    author: {
      name: "Ben",
      initials: "BS",
    },
  },
  {
    id: "site-q3-expansion",
    name: "Q3 expansion packet",
    slug: "q3-expansion",
    status: "draft",
    visibility: "private",
    access: "edit",
    variants: 0,
    views: 0,
    updatedAt: "5h ago",
    createdAt: "1d ago",
    hasUnpublishedChanges: false,
    author: {
      name: "Maya",
      initials: "MP",
    },
  },
  {
    id: "site-orbit-security",
    name: "Orbit security follow-up",
    slug: "orbit-security",
    status: "published",
    visibility: "private",
    access: "view_copy",
    variants: 3,
    views: 72,
    updatedAt: "1d ago",
    createdAt: "6d ago",
    publishedAt: "1d ago",
    hasUnpublishedChanges: false,
    author: {
      name: "Rina",
      initials: "RC",
    },
  },
  {
    id: "site-legacy-proof",
    name: "Legacy proof packet",
    slug: "legacy-proof",
    status: "archived",
    visibility: "team",
    access: "admin",
    variants: 1,
    views: 31,
    updatedAt: "2w ago",
    createdAt: "1mo ago",
    hasUnpublishedChanges: false,
    author: {
      name: "Ben",
      initials: "BS",
    },
  },
]

export const trackingEvents: TrackingEventRecord[] = [
  {
    id: "event-1",
    type: "site_viewed",
    siteId: "site-acme-rollout",
    eventName: "Site viewed",
    siteName: "Acme rollout brief",
    variantName: "Mira at Acme",
    target: "Variant link",
    timestamp: "14m ago",
  },
  {
    id: "event-2",
    type: "button_clicked",
    siteId: "site-acme-rollout",
    eventName: "Button clicked",
    siteName: "Acme rollout brief",
    variantName: "Default link",
    target: "Book implementation review",
    timestamp: "52m ago",
  },
  {
    id: "event-3",
    type: "link_preview_loaded",
    siteId: "site-acme-rollout",
    eventName: "Slack preview loaded",
    siteName: "Acme rollout brief",
    variantName: "Mira at Acme",
    target: "OG image request",
    timestamp: "1h ago",
    isPreviewBot: true,
  },
  {
    id: "event-4",
    type: "scroll_depth",
    siteId: "site-orbit-security",
    eventName: "Reached 75%",
    siteName: "Orbit security follow-up",
    variantName: "Default link",
    target: "Public page",
    timestamp: "5h ago",
  },
]

export const teamMembers: TeamMemberRecord[] = [
  {
    id: "member-ben",
    name: "Ben Segarra",
    email: "ben@lightsite.app",
    role: "admin",
    avatar: "BS",
    joinedAt: "Jan 8",
    lastActiveAt: "Now",
    isCurrentUser: true,
  },
  {
    id: "member-maya",
    name: "Maya Patel",
    email: "maya@lightsite.app",
    role: "user",
    avatar: "MP",
    joinedAt: "Jan 10",
    lastActiveAt: "18m ago",
  },
  {
    id: "member-rina",
    name: "Rina Cohen",
    email: "rina@lightsite.app",
    role: "user",
    avatar: "RC",
    joinedAt: "Jan 14",
    lastActiveAt: "2h ago",
  },
]

export const workspaceInvites: WorkspaceInviteRecord[] = [
  {
    id: "invite-1",
    email: "sam@lightsite.app",
    role: "user",
    status: "pending",
    invitedBy: "Ben",
    sentAt: "1d ago",
  },
  {
    id: "invite-2",
    email: "ops@lightsite.app",
    role: "user",
    status: "send_failed",
    invitedBy: "Ben",
    sentAt: "3d ago",
  },
]

export const componentNames = [
  "Accordion",
  "Alert",
  "Alert Dialog",
  "Aspect Ratio",
  "Avatar",
  "Badge",
  "Breadcrumb",
  "Button",
  "Button Group",
  "Calendar",
  "Card",
  "Carousel",
  "Chart",
  "Checkbox",
  "Collapsible",
  "Combobox",
  "Command",
  "Context Menu",
  "Dialog",
  "Drawer",
  "Dropdown Menu",
  "Empty",
  "Field",
  "Form",
  "Hover Card",
  "Input",
  "Input Group",
  "Input OTP",
  "Item",
  "Kbd",
  "Label",
  "Menubar",
  "Native Select",
  "Navigation Menu",
  "Pagination",
  "Popover",
  "Progress",
  "Radio Group",
  "Resizable",
  "Scroll Area",
  "Select",
  "Separator",
  "Sheet",
  "Sidebar",
  "Skeleton",
  "Slider",
  "Sonner",
  "Spinner",
  "Switch",
  "Table",
  "Tabs",
  "Textarea",
  "Toggle",
  "Toggle Group",
  "Tooltip",
]

export const publicPageBlocks = [
  "Problem summary",
  "Recommended rollout",
  "Proof points",
  "Pricing notes",
  "Next meeting",
]

export const launchStats = [
  { label: "Live sites", value: "2", detail: "1 has unpublished draft changes" },
  { label: "Tracked sessions", value: "251", detail: "Preview bots filtered separately" },
  { label: "Variants", value: "10", detail: "Across published links" },
]

export const quickLinks: NavItem[] = [
  { title: "Brief", href: "/", icon: IconBook },
]

export function getEventIcon(type: TrackingEventType) {
  switch (type) {
    case "site_viewed":
      return IconEye
    case "button_clicked":
      return IconMouse
    case "link_preview_loaded":
      return IconCopy
    case "scroll_depth":
      return IconChartBar
  }
}

export function getSiteStatusLabel(status: SiteStatus) {
  switch (status) {
    case "draft":
      return "Draft"
    case "published":
      return "Published"
    case "archived":
      return "Archived"
  }
}

export function getRoleLabel(role: WorkspaceRole) {
  return role === "admin" ? "Admin" : "User"
}

export function getPublishedSites() {
  return sites.filter((site) => site.status === "published")
}

export function getActiveSites() {
  return sites.filter((site) => site.status !== "archived")
}

export function getLastUpdatedSite() {
  return sites[0]
}

export const appHealthItems = [
  { label: "Draft autosave", value: "Ready", icon: IconClock },
  { label: "Public links", value: "2 live", icon: IconWorldLongitude },
  { label: "Team access", value: "3 members", icon: IconUsersGroup },
]
