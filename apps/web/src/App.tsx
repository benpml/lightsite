import { Suspense, lazy } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  Outlet,
  Navigate,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useLocation,
} from "@tanstack/react-router"

import { createLightsiteQueryClient } from "@/lib/api/query-client"

const queryClient = createLightsiteQueryClient()

const InternalRouteFrame = lazy(() =>
  import("@/components/layout/internal-route-frame").then((module) => ({
    default: module.InternalRouteFrame,
  }))
)
const SitesPage = lazy(() =>
  import("@/features/sites/sites-page").then((module) => ({
    default: module.SitesPage,
  }))
)
const TrackingPage = lazy(() =>
  import("@/features/tracking/tracking-page").then((module) => ({
    default: module.TrackingPage,
  }))
)
const TeamPage = lazy(() =>
  import("@/features/team/team-page").then((module) => ({
    default: module.TeamPage,
  }))
)
const SettingsPage = lazy(() =>
  import("@/features/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  }))
)
const OnboardingPage = lazy(() =>
  import("@/features/onboarding/onboarding-page").then((module) => ({
    default: module.OnboardingPage,
  }))
)
const EditorPage = lazy(() =>
  import("@/features/editor/editor-page").then((module) => ({
    default: module.EditorPage,
  }))
)
const EditorNextPage = lazy(() =>
  import("@/features/editor-next/editor-next-page").then((module) => ({
    default: module.EditorNextPage,
  }))
)
const DesignSystemPage = lazy(() =>
  import("@/features/design-system/design-system-page").then((module) => ({
    default: module.DesignSystemPage,
  }))
)
const ComponentIndexPage = lazy(() =>
  import("@/features/design-system/component-index-page").then((module) => ({
    default: module.ComponentIndexPage,
  }))
)
const PublicSitePage = lazy(() =>
  import("@/features/public-site/public-site-page").then((module) => ({
    default: module.PublicSitePage,
  }))
)

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/sites" })
  },
})

const sitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites",
  component: SitesPage,
})

const trackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tracking",
  component: TrackingPage,
})

const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team",
  component: TeamPage,
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

const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editor/$siteId",
  component: EditorPage,
})

const editorNextIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editor-next",
  beforeLoad: () => {
    throw redirect({
      to: "/editor-next/$siteId",
      params: { siteId: "delete-key-regression" },
    })
  },
})

const editorNextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editor-next/$siteId",
  component: EditorNextPage,
})

const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system",
  component: DesignSystemPage,
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
  trackingRoute,
  teamRoute,
  settingsRoute,
  onboardingRoute,
  editorRoute,
  editorNextIndexRoute,
  editorNextRoute,
  designSystemRoute,
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

function RootLayout() {
  const location = useLocation()
  const isBareEditorNextRoute =
    location.pathname === "/editor-next" || location.pathname === "/editor-next/"
  const isEditorRoute = location.pathname.startsWith("/editor")
  const isOnboardingRoute = location.pathname.startsWith("/onboarding")
  const isPublicRoute = isPublicSitePath(location.pathname)

  if (isBareEditorNextRoute) {
    return (
      <Navigate
        to="/editor-next/$siteId"
        params={{ siteId: "delete-key-regression" }}
        replace
      />
    )
  }

  if (isEditorRoute) {
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

  if (isOnboardingRoute || isPublicRoute) {
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
  "team",
  "settings",
  "editor",
  "editor-next",
  "onboarding",
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
