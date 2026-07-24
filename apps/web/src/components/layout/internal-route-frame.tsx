import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate } from "@tanstack/react-router"
import { IconArrowRight, IconRefresh, IconUserCheck } from "@tabler/icons-react"

import { LoadingState } from "@/components/common/loading-state"
import { AppShell } from "@/components/layout/app-shell"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
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
  return (
    <LoadingState
      placement="fullscreen"
      label={chrome === "bare" ? "Loading editor" : "Loading app"}
      className="bg-page-background"
    />
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
    description = devAuthErrorMessage ?? "Use your email to access your Handout workspace."
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
        <img src="/handout-logo.svg" alt="Handout" className="h-[17px] w-[85px]" />
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
