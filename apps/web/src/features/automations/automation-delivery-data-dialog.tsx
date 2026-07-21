import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { IconCopy, IconDatabase } from "@tabler/icons-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { getAutomationDeliveryData } from "./api"

export function AutomationDeliveryDataDialog({ workspaceId, automationId, deliveryId, payloadRetained }: { workspaceId: string; automationId: string; deliveryId: string; payloadRetained: boolean }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: queryKeys.automationDelivery(workspaceId, automationId, deliveryId),
    queryFn: ({ signal }) => getAutomationDeliveryData(workspaceId, automationId, deliveryId, signal),
    enabled: open && payloadRetained,
  })
  const payload = query.data?.payload ?? null

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="sm"><IconDatabase data-icon="inline-start" />View data</Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
      <DialogHeader><DialogTitle>Data sent</DialogTitle><DialogDescription>This is the exact request body Handout sent. Response bodies are never saved.</DialogDescription></DialogHeader>
      {!payloadRetained || (!query.isLoading && !query.isError && payload === null) ? <Alert><AlertTitle>Sent data no longer retained</AlertTitle><AlertDescription>Request bodies are removed after 7 days. The safe delivery summary remains available for 30 days.</AlertDescription></Alert> : null}
      {query.isLoading ? <Skeleton className="h-64 w-full" /> : null}
      {query.isError ? <Alert variant="destructive"><AlertTitle>Sent data couldn’t load</AlertTitle><AlertDescription>{getApiErrorMessage(query.error)}</AlertDescription></Alert> : null}
      {payload ? <pre className="max-h-[55dvh] overflow-auto rounded-lg bg-muted p-4 text-xs leading-5"><code>{formatPayload(payload)}</code></pre> : null}
      <DialogFooter>{payload ? <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(payload); toast.success("Sent data copied") }}><IconCopy data-icon="inline-start" />Copy</Button> : null}<Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function formatPayload(payload: string) {
  try { return JSON.stringify(JSON.parse(payload), null, 2) }
  catch { return payload }
}
