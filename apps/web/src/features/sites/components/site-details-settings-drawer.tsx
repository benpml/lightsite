import { useCallback, useMemo, useRef, type SetStateAction } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { AppBootstrapResponse, WorkspacePlan } from "@handout/contracts"
import type { SiteContent, SiteVariableDefinition } from "@handout/site-document"
import { toast } from "sonner"

import { SiteSettingsDrawer } from "@/features/site-settings/components/site-settings-drawer"
import {
  createSiteVariableDefinition,
  getSiteVariableUsageCounts,
  getUniqueSiteVariableKey,
  normalizeSiteVariableLabel,
  SYSTEM_SITE_VARIABLE_IDS,
} from "@/features/site-settings/model"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { useSiteCollaboration } from "../../editor/use-site-collaboration"

type VariableInput = Pick<SiteVariableDefinition, "defaultValue" | "description" | "label">

type SiteDetailsSettingsDrawerProps = {
  bootstrap: AppBootstrapResponse
  canManageTracking: boolean
  fallbackContent: SiteContent
  onOpenChange: (open: boolean) => void
  open: boolean
  plan: WorkspacePlan
  siteId: string
  siteName: string
  workspaceId: string
}

export function SiteDetailsSettingsDrawer({
  bootstrap,
  canManageTracking,
  fallbackContent,
  onOpenChange,
  open,
  plan,
  siteId,
  siteName,
  workspaceId,
}: SiteDetailsSettingsDrawerProps) {
  const queryClient = useQueryClient()
  const collaboration = useSiteCollaboration({ bootstrap, siteId })
  const {
    isReady,
    saveNow,
    siteDraft,
    updateSiteDraft,
  } = collaboration
  const hasChangesRef = useRef(false)
  const content = siteDraft ?? fallbackContent
  const usageCounts = useMemo(() => getSiteVariableUsageCounts(content), [content])

  const updateContent = useCallback((updater: SetStateAction<SiteContent>) => {
    if (!isReady) return
    hasChangesRef.current = true
    updateSiteDraft(updater)
  }, [isReady, updateSiteDraft])

  const createVariable = useCallback((input: VariableInput) => {
    updateContent((currentContent) => ({
      ...currentContent,
      variables: [
        ...currentContent.variables,
        createSiteVariableDefinition(input, currentContent.variables),
      ],
    }))
  }, [updateContent])

  const editVariable = useCallback((variableId: string, input: VariableInput) => {
    updateContent((currentContent) => ({
      ...currentContent,
      variables: currentContent.variables.map((variable) =>
        variable.id === variableId
          ? {
              ...variable,
              defaultValue: typeof input.defaultValue === "string" ? input.defaultValue : "",
              description: input.description?.trim() || undefined,
              key: input.label === variable.label
                ? variable.key
                : getUniqueSiteVariableKey(
                    input.label,
                    currentContent.variables.filter((candidate) => candidate.id !== variableId),
                  ),
              label: normalizeSiteVariableLabel(input.label),
            }
          : variable,
      ),
    }))
  }, [updateContent])

  const deleteVariable = useCallback((variableId: string) => {
    if (SYSTEM_SITE_VARIABLE_IDS.has(variableId)) return
    updateContent((currentContent) => ({
      ...currentContent,
      variables: currentContent.variables.filter((variable) => variable.id !== variableId),
    }))
  }, [updateContent])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen || !hasChangesRef.current || !isReady) {
      onOpenChange(nextOpen)
      return
    }

    void saveNow()
      .then(async () => {
        hasChangesRef.current = false
        await queryClient.invalidateQueries({
          queryKey: queryKeys.siteContent(workspaceId, siteId),
        })
        onOpenChange(false)
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Site settings could not be saved."))
      })
  }, [
    isReady,
    onOpenChange,
    queryClient,
    saveNow,
    siteId,
    workspaceId,
  ])

  return (
    <SiteSettingsDrawer
      canManageTracking={canManageTracking}
      content={content}
      loading={!isReady}
      onChange={updateContent}
      onCreateVariable={createVariable}
      onDeleteVariable={deleteVariable}
      onEditVariable={editVariable}
      onOpenChange={handleOpenChange}
      open={open}
      plan={plan}
      siteId={siteId}
      siteName={siteName}
      trigger={null}
      usageCounts={usageCounts}
      variables={content.variables}
      workspaceId={workspaceId}
    />
  )
}
