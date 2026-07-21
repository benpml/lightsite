import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  IconCirclePlus,
  IconDotsVertical,
  IconLogout,
  IconMoon,
  IconRobot,
  IconSearch,
  IconShare3,
  IconSun,
  IconUserPlus,
  IconWorldLongitude,
} from "@tabler/icons-react"
import { Link, useLocation } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import type { SiteListItem } from "@handout/contracts"
import type { AppBootstrapResponse } from "@handout/contracts"

import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { primaryNavItems } from "@/data/sample-data"
import { authClient } from "@/features/auth/auth-client"
import { listSites } from "@/features/sites/api"
import { CreateSiteDialog } from "@/features/sites/components/create-site-dialog"
import { SiteShareDialog } from "@/features/sites/components/site-share-dialog"
import { disableDevAuthBypass } from "@/lib/api/dev-auth-bypass"
import { queryKeys } from "@/lib/api/query-keys"

type AppShellProps = {
  bootstrap: AppBootstrapResponse
  children: React.ReactNode
}

export function AppShell({ bootstrap, children }: AppShellProps) {
  const activeWorkspace = bootstrap.activeWorkspace
  const userName = bootstrap.user.name?.trim() || bootstrap.user.email
  const [createSiteOpen, setCreateSiteOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [shareTarget, setShareTarget] = useState<SiteListItem | null>(null)
  const sitesQuery = useQuery({
    queryKey: activeWorkspace
      ? queryKeys.sites(activeWorkspace.id)
      : ["sites", "inactive"],
    queryFn: ({ signal }) => listSites(signal),
    enabled: Boolean(activeWorkspace),
  })
  const shareableSites = sitesQuery.data?.sites ?? []

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)

    try {
      const result = await authClient.signOut()

      if (result.error) {
        throw new Error(result.error.message || "Log out failed.")
      }

      disableDevAuthBypass()
      window.location.replace("/auth")
    } catch {
      setIsSigningOut(false)
      toast.error("Could not log out. Try again.")
    }
  }

  return (
    <SidebarProvider className="bg-page-background">
      <MobileSidebarRouteSync />
      <Sidebar collapsible="offcanvas" className="shrink-0 group-data-[side=left]:border-r-0">
        <SidebarHeader>
          <div className="flex h-8 w-full items-center gap-2 px-1.5">
            <Link to="/sites" className="flex min-w-0 flex-1 items-center" aria-label="Handout">
              <span
                aria-hidden="true"
                className="h-[17px] w-[85px] bg-foreground"
                style={{
                  WebkitMask: "url('/handout-logo.svg') center / contain no-repeat",
                  mask: "url('/handout-logo.svg') center / contain no-repeat",
                }}
              />
            </Link>
            <AppThemeToggle />
          </div>
        </SidebarHeader>

        <div className="px-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="compact" className="w-full">
                <IconCirclePlus data-icon="inline-start" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {activeWorkspace ? (
                  <CreateSiteDialog
                    open={createSiteOpen}
                    onOpenChange={setCreateSiteOpen}
                    workspaceId={activeWorkspace.id}
                    workspaceSlug={activeWorkspace.slug}
                    trigger={
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          setCreateSiteOpen(true)
                        }}
                      >
                        <IconCirclePlus />
                        Create a site
                      </DropdownMenuItem>
                    }
                  />
                ) : null}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconShare3 />
                    Share a site
                  </DropdownMenuSubTrigger>
                  <ShareSiteSubmenu
                    isLoading={sitesQuery.isLoading}
                    onSelectSite={setShareTarget}
                    sites={shareableSites}
                  />
                </DropdownMenuSub>
                <DropdownMenuItem asChild>
                  <Link to="/team">
                    <IconUserPlus />
                    Invite team member
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <IconRobot />
                  Connect your AI
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {activeWorkspace && shareTarget ? (
            <SiteShareDialog
              onOpenChange={(open) => {
                if (!open) {
                  setShareTarget(null)
                }
              }}
              open
              siteId={shareTarget.id}
              siteVersion={shareTarget.publishedAt}
              siteSlug={shareTarget.slug}
              workspaceId={activeWorkspace.id}
              workspaceSlug={activeWorkspace.slug}
            />
          ) : null}
        </div>

        <SidebarContent>
          <NavGroup items={primaryNavItems} />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="default">
                    <RecipientAvatar
                      recipient={{ imageUrl: bootstrap.user.avatarUrl, name: userName }}
                      shape="circle"
                      size="2xs"
                    />
                    <span className="truncate font-semibold">{userName}</span>
                    <IconDotsVertical className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={isSigningOut}
                      onSelect={() => void handleSignOut()}
                    >
                      <IconLogout />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-page-background">
        <div
          data-app-main-pane-frame
          className="flex h-svh min-w-0 flex-1 flex-col gap-1.5 p-1.5 md:gap-0 md:py-1.5 md:pr-1.5 md:pl-0"
        >
          <div className="flex h-9 shrink-0 items-center gap-2 rounded-xl border bg-background px-2.5 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <Link to="/sites" className="flex min-w-0 flex-1 items-center" aria-label="Handout">
              <span
                aria-hidden="true"
                className="h-[17px] w-[85px] bg-foreground"
                style={{
                  WebkitMask: "url('/handout-logo.svg') center / contain no-repeat",
                  mask: "url('/handout-logo.svg') center / contain no-repeat",
                }}
              />
            </Link>
            <AppThemeToggle />
          </div>
          <div
            data-app-main-pane
            className="min-h-0 flex-1 overflow-auto rounded-xl border bg-background md:border-border-subtle"
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MobileSidebarRouteSync() {
  const location = useLocation()
  const { setOpenMobile } = useSidebar()

  useEffect(() => {
    setOpenMobile(false)
  }, [location.pathname, setOpenMobile])

  return null
}

function ShareSiteSubmenu({
  isLoading,
  onSelectSite,
  sites,
}: {
  isLoading: boolean
  onSelectSite: (site: SiteListItem) => void
  sites: SiteListItem[]
}) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleSites = normalizedQuery
    ? sites.filter((site) => site.name.toLocaleLowerCase().includes(normalizedQuery))
    : sites

  return (
    <DropdownMenuSubContent className="w-60 p-0">
      <InputGroup
        className="h-[34px] rounded-none border-0 bg-transparent px-3 shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <InputGroupAddon className="p-0 pr-1.5 [&>svg]:size-3.5!">
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search sites to share"
          className="h-full p-0"
          placeholder="Search sites"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </InputGroup>
      <DropdownMenuSeparator className="m-0" />
      <ScrollArea className="max-h-64 [&_[data-slot=scroll-area-viewport]]:max-h-64">
        <DropdownMenuGroup className="flex flex-col gap-0.5 p-1 pb-2">
          {isLoading ? (
            <DropdownMenuItem className="gap-2 px-2 py-1.5" disabled>
              Loading sites
            </DropdownMenuItem>
          ) : null}
          {!isLoading && sites.length === 0 ? (
            <DropdownMenuItem className="gap-2 px-2 py-1.5" disabled>
              No sites yet
            </DropdownMenuItem>
          ) : null}
          {!isLoading && sites.length > 0 && visibleSites.length === 0 ? (
            <DropdownMenuItem className="gap-2 px-2 py-1.5" disabled>
              No matching sites
            </DropdownMenuItem>
          ) : null}
          {visibleSites.map((site) => (
            <DropdownMenuItem
              className="gap-2 px-2 py-1.5"
              key={site.id}
              onSelect={() => onSelectSite(site)}
            >
              <IconWorldLongitude />
              <span className="truncate">{site.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </ScrollArea>
    </DropdownMenuSubContent>
  )
}

function AppThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="icon-compact"
      className="translate-x-1"
      aria-label={`Switch app to ${nextTheme} mode`}
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </Button>
  )
}

function NavGroup({ items }: { items: typeof primaryNavItems }) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href)) ||
              (item.href === "/design-system" && location.pathname.startsWith("/components"))
            const Icon = item.icon

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link to={item.href}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
