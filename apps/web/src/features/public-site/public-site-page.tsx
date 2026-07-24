import { useEffect, useMemo, useState } from "react"
import { useParams } from "@tanstack/react-router"

import { LoadingState } from "@/components/common/loading-state"
import { getPublicSitePayload, type PublicSiteLookupResult } from "./public-site-api"
import { usePublicMetadata, usePublicUnavailableMetadata } from "./public-metadata"
import { PublicSiteRenderer } from "./public-site-renderer"
import type { PublishedSitePayload } from "./types"

export function PublicSitePage() {
  const params = useParams({ strict: false })
  const workspaceSlug = normalizeRouteSlug("workspaceSlug" in params ? params.workspaceSlug : null)
  const siteSlug = normalizeRouteSlug("siteSlug" in params ? params.siteSlug : null)
  const variantSlug = normalizeRouteSlug("variantSlug" in params ? params.variantSlug : null)

  if (!workspaceSlug || !siteSlug) {
    return <PublicUnavailablePage />
  }

  return (
    <RemotePublicSitePage
      key={`${workspaceSlug}/${siteSlug}/${variantSlug ?? ""}`}
      workspaceSlug={workspaceSlug}
      siteSlug={siteSlug}
      variantSlug={variantSlug}
    />
  )
}

function RemotePublicSitePage({
  siteSlug,
  variantSlug,
  workspaceSlug,
}: {
  workspaceSlug: string
  siteSlug: string
  variantSlug: string | null
}) {
  const lookup = useMemo(
    () => ({
      workspaceSlug,
      siteSlug,
      variantSlug,
    }),
    [siteSlug, variantSlug, workspaceSlug],
  )
  const remotePayload = usePublicSiteLookup(lookup)

  if (remotePayload.status === "loading") {
    return <PublicLoadingPage />
  }

  if (remotePayload.status === "unavailable") {
    return <PublicUnavailablePage />
  }

  return <ResolvedPublicSitePage payload={remotePayload.payload} />
}

function ResolvedPublicSitePage({ payload }: { payload: PublishedSitePayload }) {
  usePublicMetadata(payload)

  return <PublicSiteRenderer payload={payload} />
}

function PublicUnavailablePage() {
  usePublicUnavailableMetadata()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 font-site text-foreground">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-muted-foreground">Handout</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">This page is unavailable</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          The link may be unpublished, archived, or no longer available.
        </p>
      </div>
    </main>
  )
}

function PublicLoadingPage() {
  usePublicUnavailableMetadata()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 font-site text-foreground">
      <LoadingState placement="fullscreen" label="Loading site" />
    </main>
  )
}

function usePublicSiteLookup(lookup: {
  workspaceSlug: string
  siteSlug: string
  variantSlug: string | null
}): PublicSiteLookupResult | { status: "loading" } {
  const [result, setResult] = useState<PublicSiteLookupResult | { status: "loading" }>(
    { status: "loading" },
  )

  useEffect(() => {
    const abortController = new AbortController()

    getPublicSitePayload(lookup, abortController.signal)
      .then((nextResult) => {
        setResult(nextResult)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return
        }

        setResult({ status: "unavailable" })
      })

    return () => {
      abortController.abort()
    }
  }, [lookup])

  return result
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function normalizeRouteSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}
