import {
  IconCards,
  IconCirclePlus,
  IconDotsVertical,
} from "@tabler/icons-react"
import { Link, useLocation } from "@tanstack/react-router"
import type { AppBootstrapResponse } from "@lightsite/contracts"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import { primaryNavItems } from "@/data/sample-data"

type AppShellProps = {
  bootstrap: AppBootstrapResponse
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider className="bg-page-background">
      <Sidebar collapsible="none" className="shrink-0">
        <SidebarHeader>
          <Link to="/sites" className="flex h-8 w-full items-center px-1.5">
            <img src="/lightsite-logo.svg" alt="Lightsite" className="h-[17px] w-[83px]" />
          </Link>
        </SidebarHeader>

        <div className="px-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="compact" className="w-full">
                <IconCirclePlus data-icon="inline-start" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to="/editor/$siteId" params={{ siteId: "demo-site" }}>
                    <IconCirclePlus />
                    New site
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/editor/$siteId" params={{ siteId: "demo-site" }}>
                    <IconCards />
                    New site variant
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <SidebarContent>
          <NavGroup items={primaryNavItems} />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="default">
                <Avatar className="size-4 rounded">
                  <AvatarFallback className="rounded text-[9px]">BS</AvatarFallback>
                </Avatar>
                <span className="truncate font-semibold">User Name</span>
                <IconDotsVertical className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-page-background">
        <div
          data-app-main-pane-frame
          className="flex h-svh min-w-0 flex-1 flex-col py-1.5 pr-1.5"
        >
          <div
            data-app-main-pane
            className="min-h-0 flex-1 overflow-auto rounded-xl border bg-background"
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
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
