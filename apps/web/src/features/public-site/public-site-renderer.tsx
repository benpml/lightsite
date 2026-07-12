import { useMemo, type ComponentProps } from "react"
import { renderPublicSiteHtml } from "@lightsite/site-document"

import type { PublishedSitePayload } from "./types"

export function PublicSiteRenderer({
  loading,
  payload,
}: {
  loading?: ComponentProps<"iframe">["loading"]
  payload: PublishedSitePayload
}) {
  const html = useMemo(
    () => renderPublicSiteHtml(payload, {
      includeTracking: true,
      origin: typeof window === "undefined" ? undefined : window.location.origin,
      runtimeMode: "inline",
    }),
    [payload],
  )

  return (
    <iframe
      className="block h-svh min-h-[640px] w-full border-0 bg-background"
      data-public-site-document=""
      loading={loading}
      sandbox="allow-popups allow-same-origin allow-scripts"
      srcDoc={html}
      title={payload.metadata.title}
    />
  )
}
