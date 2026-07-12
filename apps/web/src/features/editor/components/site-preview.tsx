import { useMemo } from "react"
import {
  renderPublicSitePreviewHtml,
  type SiteContent,
} from "@lightsite/site-document"

type EditorSitePreviewProps = {
  activePageSlug: string | null
  content: SiteContent
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

  return (
    <iframe
      className="h-full min-h-0 w-full border-0 bg-background"
      data-editor-site-preview=""
      sandbox="allow-popups allow-scripts"
      srcDoc={html}
      title={`${siteName} preview`}
    />
  )
}
