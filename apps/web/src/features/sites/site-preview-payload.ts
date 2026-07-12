import {
  getSiteMetadata,
  PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
  type PublishedSitePayload,
  type SiteContent,
} from "@lightsite/site-document"
import type { SiteListItem } from "@lightsite/contracts"

type CreateSitePreviewPayloadInput = {
  content: SiteContent
  site: Pick<
    SiteListItem,
    "id" | "slug" | "name" | "publishedAt" | "updatedAt" | "createdAt"
  >
  workspace: {
    id: string
    logoUrl: string | null
    name: string
    slug: string
    websiteDomain: string | null
  }
}

export function createSitePreviewPayload({
  content,
  site,
  workspace,
}: CreateSitePreviewPayloadInput): PublishedSitePayload {
  const publishedVersionId = "draft-preview"
  const metadata = getSiteMetadata(content, site.name)

  return {
    schemaVersion: PUBLIC_SITE_PAYLOAD_SCHEMA_VERSION,
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      websiteDomain: workspace.websiteDomain ?? "",
      logoUrl: workspace.logoUrl,
    },
    site: {
      id: site.id,
      slug: site.slug,
      name: site.name,
      publishedVersionId,
      publishedAt: site.publishedAt ?? site.updatedAt ?? site.createdAt ?? "1970-01-01T00:00:00.000Z",
    },
    metadata: {
      title: metadata.title,
      description: metadata.description,
      ogImageUrl: null,
      robots: "noindex,nofollow",
    },
    content,
    selectedVariant: null,
    tracking: {
      version: 2,
      workspaceId: workspace.id,
      siteId: site.id,
      publishedVersionId,
      recipientId: null,
      recipientRevision: null,
      trackingMode: "off",
    },
  }
}
