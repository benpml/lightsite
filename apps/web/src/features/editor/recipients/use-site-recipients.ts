import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { SiteVariant } from "@lightsite/contracts"

import {
  batchUpsertSiteVariants,
  deleteSiteVariant,
  listSiteVariants,
} from "@/features/sites/api"
import { queryKeys } from "@/lib/api/query-keys"

import {
  createSiteRecipient,
  updateSiteRecipient,
  type CreateSiteRecipientInput,
  type SiteRecipient,
  type UpdateSiteRecipientInput,
} from "./recipient-model"

type UseSiteRecipientsOptions = {
  siteId: string
  siteUri?: string
  workspaceId: string
}

export function useSiteRecipients({ siteId, siteUri, workspaceId }: UseSiteRecipientsOptions) {
  const queryClient = useQueryClient()
  const variantsQuery = useQuery({
    queryKey: queryKeys.siteVariants(workspaceId, siteId),
    queryFn: ({ signal }) => listSiteVariants(siteId, signal),
    enabled: siteId.length > 0,
  })
  const recipients = useMemo(
    () => (variantsQuery.data?.variants ?? []).map((variant) =>
      siteVariantToRecipient(variant, workspaceId)
    ),
    [variantsQuery.data?.variants, workspaceId]
  )

  const invalidateRecipients = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.siteVariants(workspaceId, siteId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sites(workspaceId) }),
    ])
  }, [queryClient, siteId, workspaceId])

  const createRecipient = useCallback(
    async (input: Omit<CreateSiteRecipientInput, "siteId" | "workspaceId">) => {
      const recipient = createSiteRecipient(
        { ...input, siteId, workspaceId },
        recipients
      )
      const response = await batchUpsertSiteVariants(siteId, {
        matchBy: "slug",
        variants: [recipientToVariantInput(recipient)],
      })
      const created = response.variants[0]

      if (!created) {
        throw new Error("The recipient was not returned after creation.")
      }

      await invalidateRecipients()
      return siteVariantToRecipient(created, workspaceId)
    },
    [invalidateRecipients, recipients, siteId, workspaceId]
  )

  const updateRecipient = useCallback(
    async (recipientId: string, input: UpdateSiteRecipientInput) => {
      const currentRecipient = recipients.find((recipient) => recipient.id === recipientId)

      if (!currentRecipient) {
        return null
      }

      const recipient = updateSiteRecipient(currentRecipient, input)
      const response = await batchUpsertSiteVariants(siteId, {
        matchBy: "id",
        variants: [recipientToVariantInput(recipient)],
      })
      const updated = response.variants[0]

      if (!updated) {
        throw new Error("The recipient was not returned after updating.")
      }

      await invalidateRecipients()
      return siteVariantToRecipient(updated, workspaceId)
    },
    [invalidateRecipients, recipients, siteId, workspaceId]
  )

  const deleteRecipient = useCallback(
    async (recipientId: string) => {
      await deleteSiteVariant(siteId, recipientId)
      await invalidateRecipients()
    },
    [invalidateRecipients, siteId]
  )

  return {
    createRecipient,
    deleteRecipient,
    error: variantsQuery.error,
    isLoading: variantsQuery.isLoading,
    recipients,
    siteUri: siteUri ?? siteId,
    updateRecipient,
  }
}

function siteVariantToRecipient(variant: SiteVariant, workspaceId: string): SiteRecipient {
  const values = Object.fromEntries(
    Object.entries(variant.variableValues).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : []
    )
  )

  return {
    company: variant.recipientCompany ?? "",
    createdAt: variant.createdAt,
    id: variant.id,
    linkSlug: variant.slug,
    name: variant.recipientName ?? variant.name,
    siteId: variant.siteId,
    updatedAt: variant.updatedAt,
    values,
    website: values.recipient_website ?? "",
    workspaceId,
  }
}

function recipientToVariantInput(recipient: SiteRecipient) {
  return {
    id: recipient.id,
    name: `${recipient.name} @ ${recipient.company}`,
    recipientCompany: recipient.company,
    recipientName: recipient.name,
    slug: recipient.linkSlug,
    variableValues: {
      ...recipient.values,
      "recipient-company": recipient.company,
      "recipient-name": recipient.name,
      recipient_website: recipient.website,
    },
  }
}
