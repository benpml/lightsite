import { useCallback, useEffect, useState } from "react"
import type {
  ExtensionAuthAuthorizeRequest,
  ExtensionAuthAuthorizeResponse,
} from "@lightsite/contracts"
import { IconCheck, IconPlugConnected } from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { apiRequest } from "@/lib/api/client"
import { isApiClientError } from "@/lib/api/errors"

type ConnectState = "connecting" | "complete" | "error"

export function ExtensionConnectPage() {
  const [request] = useState(parseExtensionConnectRequest)
  const [state, setState] = useState<ConnectState>("connecting")
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!request) {
      setState("error")
      setError("This extension connection link is invalid. Return to Gmail and try again.")
      return
    }

    setState("connecting")
    setError(null)
    try {
      const response = await apiRequest<ExtensionAuthAuthorizeResponse>(
        "/api/extension-auth/authorize",
        {
          method: "POST",
          body: request,
          responseSchema: extensionAuthorizeResponseSchema,
        },
      )
      setState("complete")
      const callback = new URL(response.redirectUri)
      callback.hash = new URLSearchParams({ code: response.code }).toString()
      window.location.replace(callback.toString())
    } catch (caughtError) {
      if (isApiClientError(caughtError) && caughtError.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`
        window.location.replace(`/auth?${new URLSearchParams({ returnTo }).toString()}`)
        return
      }
      setState("error")
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Lightsite could not connect to Gmail. Try again.",
      )
    }
  }, [request])

  useEffect(() => {
    const timeout = window.setTimeout(() => void connect(), 0)
    return () => window.clearTimeout(timeout)
  }, [connect])

  return (
    <main className="flex min-h-svh items-center justify-center bg-page-background p-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <img src="/lightsite-logo.svg" alt="Lightsite" className="h-[17px] w-[83px]" />
        {state === "error" ? (
          <Alert variant="destructive" className="text-left">
            <AlertTitle>Extension could not connect</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => void connect()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
              {state === "complete" ? <IconCheck /> : <IconPlugConnected />}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold">
                {state === "complete" ? "Lightsite connected" : "Connecting to Gmail"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {state === "complete"
                  ? "You can close this window and continue in Gmail."
                  : "This should only take a moment."}
              </p>
            </div>
            {state === "connecting" ? <Spinner /> : null}
          </div>
        )}
      </section>
    </main>
  )
}

function parseExtensionConnectRequest(): ExtensionAuthAuthorizeRequest | null {
  const params = new URLSearchParams(window.location.search)
  const redirectUri = params.get("redirect_uri")
  const codeChallenge = params.get("code_challenge")
  if (!redirectUri || !codeChallenge) return null
  return { redirectUri, codeChallenge }
}

const extensionAuthorizeResponseSchema = {
  parse(value: unknown): ExtensionAuthAuthorizeResponse {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Lightsite returned an invalid connection response.")
    }
    const response = value as Record<string, unknown>
    if (
      typeof response.code !== "string" ||
      typeof response.redirectUri !== "string" ||
      typeof response.requestId !== "string"
    ) {
      throw new Error("Lightsite returned an invalid connection response.")
    }
    return {
      code: response.code,
      redirectUri: response.redirectUri,
      requestId: response.requestId,
    }
  },
}
