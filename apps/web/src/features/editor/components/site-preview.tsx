import { useMemo, type SyntheticEvent } from "react"
import {
  renderPublicSitePreviewHtml,
  SITE_DOCUMENT_IFRAME_SANDBOX,
  type SiteContent,
} from "@handout/site-document"

import { cn } from "@/lib/utils"

type EditorSitePreviewProps = {
  activePageSlug: string | null
  content: SiteContent
  isReady: boolean
  onReady: () => void
  siteId: string
  siteName: string
  siteSlug: string
  workspace: {
    id: string
    logoUrl: string | null
    name: string
    slug: string
    websiteDomain: string | null
  }
}

export function EditorSitePreview({
  activePageSlug,
  content,
  isReady,
  onReady,
  siteId,
  siteName,
  siteSlug,
  workspace,
}: EditorSitePreviewProps) {
  // PUBLISHED-SITE PARITY: Preview must use the deployed-site renderer, never a React recreation.
  const html = useMemo(
    () => renderPublicSitePreviewHtml(content, {
      activePageSlug,
      siteId,
      siteName,
      siteSlug,
      workspaceId: workspace.id,
      workspaceLogoUrl: workspace.logoUrl,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      workspaceWebsiteDomain: workspace.websiteDomain,
    }),
    [activePageSlug, content, siteId, siteName, siteSlug, workspace],
  )

  const markReadyAfterFontsLoad = async (event: SyntheticEvent<HTMLIFrameElement>) => {
    const previewDocument = event.currentTarget.contentDocument

    if (previewDocument?.fonts) {
      await previewDocument.fonts.ready
    }

    onReady()
  }

  return (
    <iframe
      className={cn(
        "absolute inset-0 h-full min-h-0 w-full border-0 bg-background transition-opacity duration-150 ease-out",
        isReady ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      data-editor-site-preview=""
      onLoad={markReadyAfterFontsLoad}
      sandbox={SITE_DOCUMENT_IFRAME_SANDBOX}
      srcDoc={html}
      title={`${siteName} preview`}
    />
  )
}
