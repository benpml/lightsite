import { Suspense, lazy, useEffect, type ComponentType } from "react"
import { HANDOUT_THEME_CSS } from "@handout/design-tokens"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useLocation,
} from "@tanstack/react-router"

import { AppThemeProvider } from "@/components/common/app-theme-provider"
import { createHandoutQueryClient } from "@/lib/api/query-client"

const queryClient = createHandoutQueryClient()

const InternalRouteFrame = lazyWithReload(() =>
  import("@/components/layout/internal-route-frame").then((module) => ({
    default: module.InternalRouteFrame,
  }))
)
const SitesPage = lazyWithReload(() =>
  import("@/features/sites/sites-page").then((module) => ({
    default: module.SitesPage,
  }))
)
const SiteDetailsPage = lazyWithReload(() =>
  import("@/features/sites/site-details-page").then((module) => ({
    default: module.SiteDetailsPage,
  }))
)
const RecipientDetailsPage = lazyWithReload(() =>
  import("@/features/sites/recipient-details-page").then((module) => ({
    default: module.RecipientDetailsPage,
  }))
)
const TrackingPage = lazyWithReload(() =>
  import("@/features/tracking/tracking-page").then((module) => ({
    default: module.TrackingPage,
  }))
)
const AutomationsPage = lazyWithReload(() =>
  import("@/features/automations/automations-page").then((module) => ({ default: module.AutomationsPage }))
)
const AutomationDetailPage = lazyWithReload(() =>
  import("@/features/automations/automation-detail-page").then((module) => ({ default: module.AutomationDetailPage }))
)
const TeamPage = lazyWithReload(() =>
  import("@/features/team/team-page").then((module) => ({
    default: module.TeamPage,
  }))
)
const SettingsPage = lazyWithReload(() =>
  import("@/features/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  }))
)
const OnboardingPage = lazyWithReload(() =>
  import("@/features/onboarding/onboarding-page").then((module) => ({
    default: module.OnboardingPage,
  }))
)
const JoinWorkspacePage = lazyWithReload(() =>
  import("@/features/onboarding/join-workspace-page").then((module) => ({
    default: module.JoinWorkspacePage,
  }))
)
const AuthPage = lazyWithReload(() =>
  import("@/features/auth/auth-page").then((module) => ({
    default: module.AuthPage,
  }))
)
const ResetPasswordPage = lazyWithReload(() =>
  import("@/features/auth/reset-password-page").then((module) => ({
    default: module.ResetPasswordPage,
  }))
)
const ExtensionConnectPage = lazyWithReload(() =>
  import("@/features/auth/extension-connect-page").then((module) => ({
    default: module.ExtensionConnectPage,
  }))
)
const EditorPage = lazyWithReload(() =>
  import("@/features/editor/editor-page").then((module) => ({
    default: module.EditorPage,
  }))
)
const DesignSystemPage = lazyWithReload(() =>
  import("@/features/design-system/design-system-page").then((module) => ({
    default: module.DesignSystemPage,
  }))
)
const DesignSystemAuditPage = lazyWithReload(() =>
  import("@/features/design-system/design-system-audit-page").then((module) => ({
    default: module.DesignSystemAuditPage,
  }))
)
const ColorPlaygroundPage = lazyWithReload(() =>
  import("@/features/design-system/color-playground-page").then((module) => ({
    default: module.ColorPlaygroundPage,
  }))
)
const ComponentIndexPage = lazyWithReload(() =>
  import("@/features/design-system/component-index-page").then((module) => ({
    default: module.ComponentIndexPage,
  }))
)
const PublicSitePage = lazyWithReload(() =>
  import("@/features/public-site/public-site-page").then((module) => ({
    default: module.PublicSitePage,
  }))
)

const dynamicImportReloadKey = "handout:dynamic-import-reload"

// React.lazy is intentionally prop-agnostic at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>
type LazyModule<TComponent extends AnyComponent> = { default: TComponent }

function lazyWithReload<TComponent extends AnyComponent>(
  loader: () => Promise<LazyModule<TComponent>>,
) {
  return lazy(async () => {
    try {
      const module = await loader()
      window.sessionStorage.removeItem(dynamicImportReloadKey)
      return module
    } catch (error) {
      if (isDynamicImportLoadError(error) && !window.sessionStorage.getItem(dynamicImportReloadKey)) {
        window.sessionStorage.setItem(dynamicImportReloadKey, "1")
        window.location.reload()
        return new Promise<LazyModule<TComponent>>(() => undefined)
      }

      throw error
    }
  })
}

function isDynamicImportLoadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  )
}

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: MarketingWebsiteRedirect,
})

const sitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites",
  component: SitesPage,
})

const siteDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites/$siteId",
  component: SiteDetailsPage,
})

const recipientDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites/$siteId/recipients/$recipientId",
  component: RecipientDetailsPage,
})

const trackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tracking",
  component: TrackingPage,
})

const automationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/automations",
  component: AutomationsPage,
})

const automationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/automations/$automationId",
  component: AutomationDetailPage,
})

const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team",
  component: TeamPage,
})

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "billing" } })
  },
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
})

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
})

const joinWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding/join",
  component: JoinWorkspacePage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
})

const extensionConnectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/extension-connect",
  component: ExtensionConnectPage,
})

const editIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/edit",
  beforeLoad: () => {
    throw redirect({
      to: "/edit/$siteId",
      params: { siteId: "delete-key-regression" },
    })
  },
})

const editRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/edit/$siteId",
  component: EditorPage,
})

const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system",
  component: DesignSystemPage,
})

const designSystemAuditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system/audit",
  component: DesignSystemAuditPage,
})

const colorPlaygroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system/colors",
  component: ColorPlaygroundPage,
})

const componentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/components",
  component: ComponentIndexPage,
})

const publicSiteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$workspaceSlug/$siteSlug",
  component: PublicSitePage,
})

const publicVariantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$workspaceSlug/$siteSlug/$variantSlug",
  component: PublicSitePage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  sitesRoute,
  siteDetailsRoute,
  recipientDetailsRoute,
  trackingRoute,
  automationsRoute,
  automationDetailRoute,
  teamRoute,
  billingRoute,
  settingsRoute,
  onboardingRoute,
  joinWorkspaceRoute,
  authRoute,
  resetPasswordRoute,
  extensionConnectRoute,
  editIndexRoute,
  editRoute,
  designSystemRoute,
  designSystemAuditRoute,
  colorPlaygroundRoute,
  componentsRoute,
  publicSiteRoute,
  publicVariantRoute,
])

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return (
    <AppThemeProvider>
      <style data-handout-theme-tokens>{HANDOUT_THEME_CSS}</style>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppThemeProvider>
  )
}

function RootLayout() {
  const location = useLocation()
  const isMarketingRoute = location.pathname === "/"
  const isEditRoute = location.pathname.startsWith("/edit")
  const isOnboardingRoute = location.pathname.startsWith("/onboarding")
  const isAuthRoute = location.pathname.startsWith("/auth")
  const isResetPasswordRoute = location.pathname.startsWith("/reset-password")
  const isExtensionConnectRoute = location.pathname.startsWith("/extension-connect")
  const isPublicRoute = isPublicSitePath(location.pathname)

  if (isEditRoute) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <InternalRouteFrame chrome="bare">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </InternalRouteFrame>
      </Suspense>
    )
  }

  if (
    isMarketingRoute ||
    isOnboardingRoute ||
    isAuthRoute ||
    isResetPasswordRoute ||
    isExtensionConnectRoute ||
    isPublicRoute
  ) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <InternalRouteFrame>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </InternalRouteFrame>
    </Suspense>
  )
}

const reservedAppSegments = new Set([
  "",
  "sites",
  "tracking",
  "automations",
  "team",
  "billing",
  "settings",
  "edit",
  "editor",
  "editor-next",
  "onboarding",
  "auth",
  "reset-password",
  "extension-connect",
  "design-system",
  "components",
])

function isPublicSitePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length !== 2 && segments.length !== 3) {
    return false
  }

  return !reservedAppSegments.has(segments[0] ?? "")
}

function RouteFallback() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-80 max-w-full rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

function MarketingWebsiteRedirect() {
  useEffect(() => {
    window.location.replace("https://www.handout.link")
  }, [])

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <a className="text-sm text-muted-foreground underline underline-offset-4" href="https://www.handout.link">
        Continue to Handout
      </a>
    </main>
  )
}
