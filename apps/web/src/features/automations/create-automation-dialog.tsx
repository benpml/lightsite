import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { AutomationTriggerEventType } from "@handout/domain"
import { IconArrowLeft, IconArrowRight, IconBolt, IconCheck, IconCopy, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { createAutomation, getAutomationOptions } from "./api"
import { automationEventOptions } from "./automation-form-options"
import { AutomationOptionChecklist } from "./automation-option-checklist"

export function CreateAutomationDialog({ workspaceId, disabled = false }: { workspaceId: string; disabled?: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [name, setName] = useState("Visitor activity")
  const [endpointUrl, setEndpointUrl] = useState("")
  const [eventTypes, setEventTypes] = useState<AutomationTriggerEventType[]>(["site_visit"])
  const [siteScope, setSiteScope] = useState<"all" | "selected">("all")
  const [siteIds, setSiteIds] = useState<string[]>([])
  const [recipientScope, setRecipientScope] = useState<"anyone" | "named" | "unnamed" | "selected">("anyone")
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [created, setCreated] = useState<{ id: string; signingSecret?: string } | null>(null)
  const optionsQuery = useQuery({
    queryKey: queryKeys.automationOptions(workspaceId),
    queryFn: ({ signal }) => getAutomationOptions(workspaceId, signal),
    enabled: open,
  })
  const mutation = useMutation({
    mutationFn: () => createAutomation(workspaceId, {
      name,
      endpointUrl,
      trigger: { eventTypes, siteScope, siteIds, recipientScope, recipientIds },
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automations(workspaceId) })
      setCreated({ id: result.automation.id, signingSecret: result.signingSecret })
      setStep(4)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const canContinue = step === 1
    ? eventTypes.length > 0
    : step === 2
      ? (siteScope === "all" || siteIds.length > 0) && (recipientScope !== "selected" || recipientIds.length > 0)
      : name.trim().length > 0 && endpointUrl.trim().length > 0
  const rule = useMemo(() => buildRule(eventTypes, siteScope, siteIds.length, recipientScope, recipientIds.length), [eventTypes, siteScope, siteIds.length, recipientScope, recipientIds.length])

  function reset() {
    setStep(1); setCreated(null); setName("Visitor activity"); setEndpointUrl(""); setEventTypes(["site_visit"])
    setSiteScope("all"); setSiteIds([]); setRecipientScope("anyone"); setRecipientIds([])
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger asChild>
        <Button size="compact" disabled={disabled}>
          <IconPlus data-icon="inline-start" /> New automation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {step < 4 ? (
          <>
            <DialogHeader>
              <div className="pr-8">
                <DialogTitle>New automation</DialogTitle>
                <DialogDescription>Step {step} of 3 · {step === 1 ? "Choose an event" : step === 2 ? "Choose who and where" : "Connect your app"}</DialogDescription>
              </div>
              <Progress value={step * 33.333} aria-label={`Step ${step} of 3`} />
            </DialogHeader>

            {step === 1 ? (
              <FieldSet>
                <FieldLegend>When should Handout send this?</FieldLegend>
                <FieldDescription>Choose one or more visitor actions. You can change these later.</FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  {automationEventOptions.map((option) => (
                    <FieldLabel key={option.value}>
                      <Field orientation="horizontal">
                        <Checkbox
                          checked={eventTypes.includes(option.value)}
                          onCheckedChange={(checked) => setEventTypes((current) => checked
                            ? [...new Set([...current, option.value])]
                            : current.filter((value) => value !== option.value))}
                        />
                        <div>
                          <div>{option.label}</div>
                          <FieldDescription>{option.description}</FieldDescription>
                        </div>
                      </Field>
                    </FieldLabel>
                  ))}
                </FieldGroup>
              </FieldSet>
            ) : null}

            {step === 2 ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="automation-sites">Which sites?</FieldLabel>
                  <Select value={siteScope} onValueChange={(value) => setSiteScope(value as "all" | "selected")}>
                    <SelectTrigger id="automation-sites"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All current and future sites</SelectItem>
                      <SelectItem value="selected">Only selected sites</SelectItem>
                    </SelectContent>
                  </Select>
                  {siteScope === "selected" ? <AutomationOptionChecklist options={optionsQuery.data?.sites ?? []} selected={siteIds} onChange={setSiteIds} empty="No sites are available yet." loading={optionsQuery.isLoading} error={optionsQuery.isError} onRetry={() => void optionsQuery.refetch()} /> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="automation-recipients">Which visitors?</FieldLabel>
                  <Select value={recipientScope} onValueChange={(value) => setRecipientScope(value as typeof recipientScope)}>
                    <SelectTrigger id="automation-recipients"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anyone">Anyone</SelectItem>
                      <SelectItem value="named">Named recipients only</SelectItem>
                      <SelectItem value="unnamed">Anonymous visitors only</SelectItem>
                      <SelectItem value="selected">Only selected recipients</SelectItem>
                    </SelectContent>
                  </Select>
                  {recipientScope === "selected" ? <AutomationOptionChecklist options={optionsQuery.data?.recipients ?? []} selected={recipientIds} onChange={setRecipientIds} empty="No recipients are available yet." loading={optionsQuery.isLoading} error={optionsQuery.isError} onRetry={() => void optionsQuery.refetch()} /> : null}
                </Field>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm"><span className="font-medium">Your rule:</span> {rule}</div>
              </FieldGroup>
            ) : null}

            {step === 3 ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="automation-name">Name</FieldLabel>
                  <Input id="automation-name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Visitor activity" />
                  <FieldDescription>Use a name your team will recognize.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="automation-url">Where should we send it?</FieldLabel>
                  <Input id="automation-url" type="url" spellCheck={false} autoCapitalize="none" value={endpointUrl} onChange={(event) => setEndpointUrl(event.target.value)} placeholder="https://hooks.example.com/handout" />
                  <FieldDescription>Paste the webhook URL from the app you want to connect. It must use HTTPS.</FieldDescription>
                </Field>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm"><span className="font-medium">What happens next:</span> We’ll save this paused. Send a test, then turn it on when your app confirms it arrived.</div>
              </FieldGroup>
            ) : null}

            <DialogFooter>
              {step > 1 ? <Button variant="outline" onClick={() => setStep((value) => value - 1)} disabled={mutation.isPending}><IconArrowLeft data-icon="inline-start" /> Back</Button> : null}
              <Button onClick={() => step < 3 ? setStep((value) => value + 1) : mutation.mutate()} disabled={!canContinue || mutation.isPending}>
                {step < 3 ? <>Continue <IconArrowRight data-icon="inline-end" /></> : mutation.isPending ? "Saving…" : <>Save paused <IconCheck data-icon="inline-end" /></>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><IconBolt /></div>
              <DialogTitle>Automation saved</DialogTitle>
              <DialogDescription>Keep this signing secret safe. It proves webhook requests came from Handout, and we only show it once.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-xs">
              <span className="min-w-0 flex-1 break-all">{created?.signingSecret}</span>
              <Button variant="outline" size="icon-sm" aria-label="Copy signing secret" onClick={() => { void navigator.clipboard.writeText(created?.signingSecret ?? ""); toast.success("Signing secret copied") }}><IconCopy /></Button>
            </div>
            <DialogFooter>
              <Button asChild><Link to="/automations/$automationId" params={{ automationId: created?.id ?? "" }}>Send a test <IconArrowRight data-icon="inline-end" /></Link></Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function buildRule(events: AutomationTriggerEventType[], siteScope: "all" | "selected", siteCount: number, recipientScope: string, recipientCount: number) {
  const action = events.length === 1 ? automationEventOptions.find((item) => item.value === events[0])?.label.toLowerCase() : `${events.length} selected actions happen`
  const site = siteScope === "all" ? "any site" : `${siteCount} selected ${siteCount === 1 ? "site" : "sites"}`
  const recipient = recipientScope === "anyone" ? "any visitor" : recipientScope === "named" ? "a named recipient" : recipientScope === "unnamed" ? "an anonymous visitor" : `${recipientCount} selected ${recipientCount === 1 ? "recipient" : "recipients"}`
  return `Send when ${recipient} ${action ?? "takes an action"} on ${site}.`
}
