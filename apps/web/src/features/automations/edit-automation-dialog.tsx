import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Automation } from "@handout/contracts"
import type { AutomationTriggerEventType } from "@handout/domain"
import { IconEdit } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { getAutomationOptions, updateAutomation } from "./api"
import { automationEventOptions } from "./automation-form-options"
import { AutomationOptionChecklist } from "./automation-option-checklist"

export function EditAutomationDialog({ automation, workspaceId, disabled }: { automation: Automation; workspaceId: string; disabled: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(automation.name)
  const [endpointUrl, setEndpointUrl] = useState("")
  const [eventTypes, setEventTypes] = useState<AutomationTriggerEventType[]>(automation.trigger.eventTypes)
  const [siteScope, setSiteScope] = useState(automation.trigger.siteScope)
  const [siteIds, setSiteIds] = useState(automation.trigger.siteIds)
  const [recipientScope, setRecipientScope] = useState(automation.trigger.recipientScope)
  const [recipientIds, setRecipientIds] = useState(automation.trigger.recipientIds)
  const optionsQuery = useQuery({ queryKey: queryKeys.automationOptions(workspaceId), queryFn: ({ signal }) => getAutomationOptions(workspaceId, signal), enabled: open })
  const mutation = useMutation({
    mutationFn: () => updateAutomation(workspaceId, automation.id, {
      name,
      ...(endpointUrl.trim() ? { endpointUrl } : {}),
      trigger: { eventTypes, siteScope, siteIds, recipientScope, recipientIds },
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.automation(workspaceId, automation.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.automations(workspaceId) }),
      ])
      setOpen(false)
      toast.success("Automation updated")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const valid = Boolean(name.trim()) && eventTypes.length > 0 && (siteScope === "all" || siteIds.length > 0) && (recipientScope !== "selected" || recipientIds.length > 0)

  function reset() {
    setName(automation.name); setEndpointUrl(""); setEventTypes(automation.trigger.eventTypes); setSiteScope(automation.trigger.siteScope)
    setSiteIds(automation.trigger.siteIds); setRecipientScope(automation.trigger.recipientScope); setRecipientIds(automation.trigger.recipientIds)
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset() }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={disabled}><IconEdit data-icon="inline-start" />Edit setup</Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Edit automation</DialogTitle><DialogDescription>Changing events, visitors, sites, or the destination pauses this automation for a fresh test. Renaming it does not.</DialogDescription></DialogHeader>
      <FieldGroup>
        <Field><FieldLabel htmlFor="edit-automation-name">Name</FieldLabel><Input id="edit-automation-name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <FieldSet><FieldLegend variant="label">Events</FieldLegend><div className="grid gap-2 sm:grid-cols-2">{automationEventOptions.map((option) => <FieldLabel key={option.value}><Field orientation="horizontal"><Checkbox checked={eventTypes.includes(option.value)} onCheckedChange={(checked) => setEventTypes((current) => checked ? [...new Set([...current, option.value])] : current.filter((value) => value !== option.value))} /><span>{option.label}</span></Field></FieldLabel>)}</div></FieldSet>
        <Field><FieldLabel htmlFor="edit-automation-sites">Sites</FieldLabel><Select value={siteScope} onValueChange={(value) => setSiteScope(value as typeof siteScope)}><SelectTrigger id="edit-automation-sites"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All current and future sites</SelectItem><SelectItem value="selected">Only selected sites</SelectItem></SelectContent></Select>{siteScope === "selected" ? <AutomationOptionChecklist options={optionsQuery.data?.sites ?? []} selected={siteIds} onChange={setSiteIds} empty="No sites are available." loading={optionsQuery.isLoading} error={optionsQuery.isError} onRetry={() => void optionsQuery.refetch()} /> : null}</Field>
        <Field><FieldLabel htmlFor="edit-automation-visitors">Visitors</FieldLabel><Select value={recipientScope} onValueChange={(value) => setRecipientScope(value as typeof recipientScope)}><SelectTrigger id="edit-automation-visitors"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="anyone">Anyone</SelectItem><SelectItem value="named">Named recipients only</SelectItem><SelectItem value="unnamed">Anonymous visitors only</SelectItem><SelectItem value="selected">Only selected recipients</SelectItem></SelectContent></Select>{recipientScope === "selected" ? <AutomationOptionChecklist options={optionsQuery.data?.recipients ?? []} selected={recipientIds} onChange={setRecipientIds} empty="No recipients are available." loading={optionsQuery.isLoading} error={optionsQuery.isError} onRetry={() => void optionsQuery.refetch()} /> : null}</Field>
        <Field><FieldLabel htmlFor="edit-automation-url">New webhook URL <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id="edit-automation-url" type="url" spellCheck={false} autoCapitalize="none" value={endpointUrl} onChange={(event) => setEndpointUrl(event.target.value)} placeholder={`Keep ${automation.endpointHost}`} /><FieldDescription>Leave blank to keep the current destination.</FieldDescription></Field>
      </FieldGroup>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>{mutation.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
