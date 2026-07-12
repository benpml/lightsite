import type { LightsiteVariableOption } from "@/features/editor/tiptap/schema"
import { editorVariables } from "@/features/editor/tiptap/variables"
import { RecipientShareDialog } from "@/features/editor/recipients/recipient-share-dialog"
import { useSiteRecipients } from "@/features/editor/recipients/use-site-recipients"

type SiteShareDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
  siteId: string
  siteVersion?: string | null
  siteSlug: string
  workspaceId: string
  workspaceSlug: string
}

const shareVariableIds = new Set([
  "recipient-name",
  "recipient-company",
  "var-company-logo",
])

const shareVariables: LightsiteVariableOption[] = editorVariables.filter((variable) =>
  shareVariableIds.has(variable.id)
)

export function SiteShareDialog({
  onOpenChange,
  open,
  siteId,
  siteSlug,
  siteVersion,
  workspaceId,
  workspaceSlug,
}: SiteShareDialogProps) {
  const {
    createRecipient,
    deleteRecipient,
    recipients,
    siteUri,
    updateRecipient,
  } = useSiteRecipients({
    siteId,
    siteUri: `${workspaceSlug}/${siteSlug}`,
    workspaceId,
  })

  return (
    <RecipientShareDialog
      createRecipient={createRecipient}
      deleteRecipient={deleteRecipient}
      onOpenChange={onOpenChange}
      open={open}
      recipients={recipients}
      siteUri={siteUri}
      siteVersion={siteVersion}
      updateRecipient={updateRecipient}
      variables={shareVariables}
    />
  )
}
