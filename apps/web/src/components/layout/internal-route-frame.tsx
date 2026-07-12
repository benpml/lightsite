import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate } from "@tanstack/react-router"
import { IconArrowRight, IconRefresh, IconUserCheck } from "@tabler/icons-react"

import { AppShell } from "@/components/layout/app-shell"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppBootstrapProvider } from "@/features/app-bootstrap/app-bootstrap-context"
import { getAppBootstrap } from "@/features/app-bootstrap/api"
import { enableAndProvisionDevAuthBypass } from "@/features/dev-auth/api"
import { getApiErrorMessage, isApiClientError } from "@/lib/api/errors"
import {
  disableDevAuthBypass,
  isDevAuthBypassActive,
  isDevAuthBypassAvailable,
} from "@/lib/api/dev-auth-bypass"
import { queryKeys } from "@/lib/api/query-keys"

type InternalRouteFrameProps = {
  children: React.ReactNode
  chrome?: "app" | "bare"
}

export function InternalRouteFrame({ children, chrome = "app" }: InternalRouteFrameProps) {
  const bootstrapQuery = useQuery({
    queryKey: queryKeys.me(),
    queryFn: async ({ signal }) => {
      try {
        return await getAppBootstrap(signal)
      } catch (error) {
        if (
          isApiClientError(error) &&
          error.status === 401 &&
          isDevAuthBypassAvailable() &&
          !isDevAuthBypassActive()
        ) {
          return enableAndProvisionDevAuthBypass(signal)
        }

        throw error
      }
    },
  })

  if (bootstrapQuery.isLoading) {
    return (
      <TooltipProvider>
        <InternalLoadingState chrome={chrome} />
        <Toaster />
      </TooltipProvider>
    )
  }

  if (bootstrapQuery.isError) {
    return (
      <TooltipProvider>
        <InternalUnavailableState
          error={bootstrapQuery.error}
          onRetry={() => bootstrapQuery.refetch()}
        />
        <Toaster />
      </TooltipProvider>
    )
  }

  const bootstrap = bootstrapQuery.data

  if (!bootstrap) {
    return (
      <TooltipProvider>
        <InternalLoadingState chrome={chrome} />
        <Toaster />
      </TooltipProvider>
    )
  }

  if (!bootstrap.activeWorkspace || bootstrap.onboarding.nextStep !== "app") {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <TooltipProvider>
      <AppBootstrapProvider value={bootstrap}>
        {chrome === "app" ? <AppShell bootstrap={bootstrap}>{children}</AppShell> : children}
      </AppBootstrapProvider>
      <Toaster />
    </TooltipProvider>
  )
}

function InternalLoadingState({ chrome }: { chrome: InternalRouteFrameProps["chrome"] }) {
  if (chrome === "bare") {
    return (
      <div className="flex min-h-dvh flex-col gap-1.5 bg-page-background p-1.5">
        <div className="flex h-[46px] shrink-0 items-center px-2.5">
          <Skeleton className="h-7 w-48" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_303px] gap-1.5">
          <Skeleton className="h-full rounded-xl" />
          <Skeleton className="h-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-page-background">
      <aside className="hidden w-60 shrink-0 bg-sidebar p-3 md:flex md:flex-col md:gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-full" />
        <div className="flex flex-col gap-2 pt-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 bg-page-background py-1.5 pr-1.5">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background p-6">
          <div className="flex max-w-5xl flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function InternalUnavailableState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void | Promise<unknown>
}) {
  const [isEnablingDevAuth, setIsEnablingDevAuth] = useState(false)
  const [devAuthErrorMessage, setDevAuthErrorMessage] = useState<string | null>(null)
  const [devAuthActive, setDevAuthActive] = useState(() => isDevAuthBypassActive())
  const isAuthError = isApiClientError(error) && error.status === 401
  const canUseDevAuth = isAuthError && isDevAuthBypassAvailable()
  const devAuthLoadError = !isAuthError && devAuthActive && isDevAuthBypassAvailable()
  let title = "App could not be loaded"
  let description = getApiErrorMessage(error, "Refresh the app or try again in a moment.")

  if (isAuthError) {
    title = "Sign in to continue"
    description = devAuthErrorMessage ?? "Use a work email to access your Lightsite workspace."
  }

  if (devAuthLoadError) {
    title = "Dev login could not be loaded"
    description = "Make sure the API is running, or reset dev login and try again."
  }

  const handleUseDevAuth = async () => {
    setIsEnablingDevAuth(true)
    setDevAuthErrorMessage(null)

    try {
      await enableAndProvisionDevAuthBypass()
      setDevAuthActive(true)
      await onRetry()
    } catch {
      disableDevAuthBypass()
      setDevAuthActive(false)
      setDevAuthErrorMessage("Dev login failed. Make sure the API is running, then try again.")
      await onRetry()
    } finally {
      setIsEnablingDevAuth(false)
    }
  }

  const handleResetDevAuth = async () => {
    disableDevAuthBypass()
    setDevAuthActive(false)
    await onRetry()
  }

  return (
    <div className="flex min-h-dvh bg-page-background p-4">
      <main className="m-auto flex w-full max-w-md flex-col gap-6">
        <img src="/lightsite-logo.svg" alt="Lightsite" className="h-[17px] w-[83px]" />
        <Alert variant={isAuthError ? "default" : "destructive"}>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
          <AlertAction>
            {devAuthLoadError ? (
              <Button size="compact" variant="outline" onClick={handleResetDevAuth}>
                Reset
              </Button>
            ) : canUseDevAuth ? (
              <Button size="compact" onClick={handleUseDevAuth} disabled={isEnablingDevAuth}>
                {isEnablingDevAuth ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <IconUserCheck data-icon="inline-start" />
                )}
                Dev login
              </Button>
            ) : isAuthError ? (
              <Button size="compact" asChild>
                <Link to="/auth">
                  Sign in
                  <IconArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <Button size="compact" variant="outline" onClick={onRetry}>
                <IconRefresh data-icon="inline-start" />
                Retry
              </Button>
            )}
          </AlertAction>
        </Alert>
      </main>
    </div>
  )
}
