import { useEffect, useState } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { IconArrowLeft, IconCheck, IconCopy, IconPlayerPause, IconPlayerPlay, IconRefresh, IconRotate, IconSend, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { deleteAutomation, getAutomation, listAutomationActivity, listAutomations, retryAutomationDelivery, rotateAutomationSecret, setAutomationState, testAutomation } from "./api"
import { AutomationStatus } from "./automations-page"
import { EditAutomationDialog } from "./edit-automation-dialog"
import { AutomationDeliveryDataDialog } from "./automation-delivery-data-dialog"

export function AutomationDetailPage() {
  const { automationId = "" } = useParams({ strict: false })
  const workspace = useActiveWorkspace()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [awaitingDeliveryId, setAwaitingDeliveryId] = useState<string | null>(null)
  const detail = useQuery({ queryKey: queryKeys.automation(workspace.id, automationId), queryFn: ({ signal }) => getAutomation(workspace.id, automationId, signal), enabled: Boolean(automationId) })
  const entitlement = useQuery({ queryKey: queryKeys.automations(workspace.id), queryFn: ({ signal }) => listAutomations(workspace.id, signal) })
  const activity = useInfiniteQuery({
    queryKey: queryKeys.automationActivity(workspace.id, automationId),
    queryFn: ({ pageParam, signal }) => listAutomationActivity(workspace.id, automationId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(automationId),
    refetchInterval: (query) => {
      const awaited = query.state.data?.pages.flatMap((page) => page.deliveries).find((delivery) => delivery.id === awaitingDeliveryId)
      if (awaitingDeliveryId && (!awaited || awaited.status === "pending")) return 1_000
      return (query.state.data?.pages.length ?? 0) <= 1 ? 15_000 : false
    },
  })
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.automation(workspace.id, automationId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.automationActivity(workspace.id, automationId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.automations(workspace.id) }),
  ])
  const stateMutation = useMutation({
    mutationFn: (state: "enable" | "pause") => setAutomationState(workspace.id, automationId, state),
    onSuccess: async (_, state) => { await refresh(); toast.success(state === "enable" ? "Automation is on" : "Automation paused") },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const testMutation = useMutation({
    mutationFn: () => testAutomation(workspace.id, automationId),
    onSuccess: async ({ deliveryId }) => { setAwaitingDeliveryId(deliveryId); await queryClient.resetQueries({ queryKey: queryKeys.automationActivity(workspace.id, automationId), exact: true }); toast.message("Test is on its way…") },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => retryAutomationDelivery(workspace.id, automationId, deliveryId),
    onSuccess: async (_, deliveryId) => { await refresh(); setAwaitingDeliveryId(deliveryId); toast.message("Delivery queued again") },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const rotateMutation = useMutation({
    mutationFn: () => rotateAutomationSecret(workspace.id, automationId),
    onSuccess: async ({ signingSecret }) => { setNewSecret(signingSecret); await refresh(); toast.success("Signing secret rotated. Send a test before turning this back on.") },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteAutomation(workspace.id, automationId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.automations(workspace.id) }); await navigate({ to: "/automations" }); toast.success("Automation deleted") },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const deliveries = activity.data?.pages.flatMap((page) => page.deliveries) ?? []
  const awaitedDelivery = deliveries.find((delivery) => delivery.id === awaitingDeliveryId)
  const awaitedStatus = awaitedDelivery?.status
  const waitingForTest = Boolean(awaitingDeliveryId && (!awaitedStatus || awaitedStatus === "pending"))
  useEffect(() => {
    if (!awaitedStatus || awaitedStatus === "pending") return
    if (awaitedStatus === "succeeded") toast.success("Test received a successful response")
    else toast.error("The test did not succeed. Open Activity for the reason.")
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.automation(workspace.id, automationId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.automations(workspace.id) }),
    ])
  }, [automationId, awaitedStatus, queryClient, workspace.id])

  if (detail.isLoading) return <div className="space-y-5 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-72 w-full" /></div>
  if (detail.isError || !detail.data) return <div className="p-6"><Alert variant="destructive"><AlertTitle>Automation couldn’t load</AlertTitle><AlertDescription>{getApiErrorMessage(detail.error)}</AlertDescription></Alert></div>
  const automation = detail.data.automation
  const canManage = entitlement.data?.plan === "pro" && entitlement.data.role === "admin"
  const usageBlocked = Boolean(entitlement.data && entitlement.data.usage.attempts >= entitlement.data.usage.limit)
  const needsFreshTest = automation.stateReason === "plan_changed" || automation.stateReason === "delivery_failures" || automation.stateReason === "queue_limit"
  const hasSuccessfulTest = detail.data.hasSuccessfulTest || deliveries.some((delivery) =>
    delivery.revisionId === automation.currentRevisionId &&
    delivery.kind === "test" &&
    delivery.status === "succeeded" &&
    (!needsFreshTest || new Date(delivery.createdAt) > new Date(automation.updatedAt)),
  )

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pt-5 pb-6">
      <div><Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/automations"><IconArrowLeft data-icon="inline-start" />Automations</Link></Button></div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-medium">{automation.name}</h1><AutomationStatus state={automation.state} /></div><p className="text-sm text-muted-foreground">Sending to {automation.endpointHost}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testMutation.mutate()} disabled={!canManage || testMutation.isPending || waitingForTest}><IconSend data-icon="inline-start" />{waitingForTest ? "Waiting…" : "Send test"}</Button>
          {automation.state === "enabled" ? <Button onClick={() => stateMutation.mutate("pause")} disabled={!canManage || stateMutation.isPending}><IconPlayerPause data-icon="inline-start" />Pause</Button> : <Button onClick={() => stateMutation.mutate("enable")} disabled={!canManage || !hasSuccessfulTest || usageBlocked || stateMutation.isPending}><IconPlayerPlay data-icon="inline-start" />Turn on</Button>}
        </div>
      </div>

      {!hasSuccessfulTest && automation.state !== "enabled" ? <Alert><IconSend /><AlertTitle>Send a test before turning this on</AlertTitle><AlertDescription>Handout will send example visitor data. Once your app returns a successful response, the Turn on button becomes available.</AlertDescription></Alert> : null}
      {automation.state === "needs_attention" ? <Alert variant="destructive"><AlertTitle>This automation needs attention</AlertTitle><AlertDescription>{attentionMessage(automation.stateReason, entitlement.data?.usage.resetsAt)}</AlertDescription></Alert> : null}

      <Tabs defaultValue="setup">
        <TabsList variant="line"><TabsTrigger value="setup">Setup</TabsTrigger><TabsTrigger value="activity">Activity {deliveries.length ? <Badge variant="outline">{deliveries.length}{activity.hasNextPage ? "+" : ""}</Badge> : null}</TabsTrigger></TabsList>
        <TabsContent value="setup" className="pt-4">
          <div className="mb-3 flex max-w-3xl justify-end"><EditAutomationDialog automation={automation} workspaceId={workspace.id} disabled={!canManage} /></div>
          <div className="max-w-3xl overflow-hidden rounded-xl border">
            <SettingRow label="When" value={automation.trigger.eventTypes.map(eventLabel).join(", ")} />
            <Separator />
            <SettingRow label="Sites" value={automation.trigger.siteScope === "all" ? "All current and future sites" : `${automation.trigger.siteIds.length} selected`} />
            <Separator />
            <SettingRow label="Visitors" value={recipientLabel(automation.trigger.recipientScope, automation.trigger.recipientIds.length)} />
            <Separator />
            <SettingRow label="Destination" value={automation.endpointHost} />
          </div>

          <div className="mt-6 max-w-3xl rounded-xl border p-4">
            <h2 className="font-medium">Verify requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your app can verify the <code>webhook-signature</code> header with the signing secret shown when this automation was created.</p>
            {newSecret ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-xs"><span className="min-w-0 flex-1 break-all">{newSecret}</span><Button variant="outline" size="icon-sm" aria-label="Copy new signing secret" onClick={() => { void navigator.clipboard.writeText(newSecret); toast.success("Signing secret copied") }}><IconCopy /></Button></div> : null}
            <div className="mt-3"><Button variant="outline" size="sm" onClick={() => rotateMutation.mutate()} disabled={!canManage || rotateMutation.isPending}><IconRotate data-icon="inline-start" />Rotate signing secret</Button></div>
          </div>

          <div className="mt-6 max-w-3xl rounded-xl border border-destructive/30 p-4"><h2 className="font-medium">Delete automation</h2><p className="mt-1 text-sm text-muted-foreground">Stops future deliveries and permanently removes its setup and activity.</p><AlertDialog><AlertDialogTrigger asChild><Button className="mt-3" variant="destructive" size="sm" disabled={!canManage}><IconTrash data-icon="inline-start" />Delete</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {automation.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Pending deliveries will be cancelled.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep automation</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <div className="mb-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => activity.refetch()} disabled={activity.isFetching}><IconRefresh data-icon="inline-start" />Refresh</Button></div>
          <div className="grid gap-3 sm:hidden">
            {deliveries.length ? deliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-xl border p-4">
                <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="font-medium">{eventLabel(delivery.eventType)}</div><div className="truncate text-xs text-muted-foreground">{delivery.kind === "test" ? "Test" : delivery.eventId}</div></div><DeliveryStatus status={delivery.status} /></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><div className="text-muted-foreground">Attempts</div><div>{delivery.attemptCount}</div></div><div><div className="text-muted-foreground">Response</div><div>{delivery.responseStatus ?? friendlyError(delivery.errorCode)}</div></div></div>
                <div className="mt-3 flex flex-wrap gap-2"><AutomationDeliveryDataDialog workspaceId={workspace.id} automationId={automation.id} deliveryId={delivery.id} payloadRetained={delivery.payloadRetained} />{delivery.payloadRetained && delivery.status === "failed" && delivery.revisionId === automation.currentRevisionId && (delivery.kind === "test" || automation.state === "enabled") ? <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(delivery.id)} disabled={!canManage || retryMutation.isPending}><IconRefresh data-icon="inline-start" />Retry</Button> : null}</div>
              </div>
            )) : <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No deliveries yet. Send a test to check the connection.</div>}
          </div>
          <div className="hidden overflow-hidden rounded-xl border sm:block">
            <Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Response</TableHead><TableHead>Time</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                <TableBody>{deliveries.length ? deliveries.map((delivery) => <TableRow key={delivery.id}><TableCell><div className="font-medium">{eventLabel(delivery.eventType)}</div><div className="text-xs text-muted-foreground">{delivery.kind === "test" ? "Test" : delivery.eventId}</div></TableCell><TableCell><DeliveryStatus status={delivery.status} /></TableCell><TableCell>{delivery.attemptCount}</TableCell><TableCell>{delivery.responseStatus ?? friendlyError(delivery.errorCode)}</TableCell><TableCell className="text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(delivery.createdAt))}</TableCell><TableCell><div className="flex justify-end gap-1"><AutomationDeliveryDataDialog workspaceId={workspace.id} automationId={automation.id} deliveryId={delivery.id} payloadRetained={delivery.payloadRetained} />{delivery.payloadRetained && delivery.status === "failed" && delivery.revisionId === automation.currentRevisionId && (delivery.kind === "test" || automation.state === "enabled") ? <Button variant="ghost" size="sm" onClick={() => retryMutation.mutate(delivery.id)} disabled={!canManage || retryMutation.isPending}><IconRefresh data-icon="inline-start" />Retry</Button> : null}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No deliveries yet. Send a test to check the connection.</TableCell></TableRow>}</TableBody>
            </Table>
          </div>
          {activity.hasNextPage ? <div className="mt-3 flex justify-center"><Button variant="outline" size="sm" onClick={() => activity.fetchNextPage()} disabled={activity.isFetchingNextPage}>{activity.isFetchingNextPage ? "Loading…" : "Load older activity"}</Button></div> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 p-4 sm:grid-cols-[140px_1fr]"><div className="text-sm text-muted-foreground">{label}</div><div className="text-sm font-medium">{value}</div></div> }
function DeliveryStatus({ status }: { status: "pending" | "succeeded" | "failed" | "cancelled" }) { return <Badge variant={status === "succeeded" ? "default" : status === "failed" ? "destructive" : "outline"}>{status === "succeeded" ? <><IconCheck data-icon="inline-start" />Delivered</> : status === "pending" ? "Sending" : status === "cancelled" ? "Cancelled" : "Failed"}</Badge> }
function eventLabel(type: string) { return ({ site_visit: "Site visit", button_click: "Button click", link_click: "Link click", tab_switch: "Page change" } as Record<string, string>)[type] ?? type }
function recipientLabel(scope: string, count: number) { return scope === "anyone" ? "Anyone" : scope === "named" ? "Named recipients only" : scope === "unnamed" ? "Anonymous visitors only" : `${count} selected recipients` }
function attentionMessage(reason: string | null, resetsAt?: string) { return reason === "delivery_failures" ? "Too many deliveries failed, so Handout paused sending to protect your app. Send a successful test, then turn it on again." : reason === "usage_limit" ? `This workspace reached its monthly delivery limit. It resets ${resetsAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(resetsAt)) : "next month"}; then turn this automation on again.` : reason === "queue_limit" ? "The delivery queue filled up. Check the destination, send a successful test, then turn this back on." : reason === "plan_changed" ? "This workspace no longer has Pro. Upgrade, send a successful test, then turn this back on." : "Check the destination and send a test." }
function friendlyError(code: string | null) { return code === "network_error" ? "Couldn’t connect" : code === "configuration_error" ? "Couldn’t prepare request" : code === "destination_unsafe" ? "Destination blocked" : code?.startsWith("http_") ? code.replace("http_", "HTTP ") : "—" }
