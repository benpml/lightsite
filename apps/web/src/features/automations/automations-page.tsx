import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { IconArrowRight, IconBolt, IconRefresh } from "@tabler/icons-react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { listAutomations } from "./api"
import { CreateAutomationDialog } from "./create-automation-dialog"

export function AutomationsPage() {
  const workspace = useActiveWorkspace()
  const query = useQuery({ queryKey: queryKeys.automations(workspace.id), queryFn: ({ signal }) => listAutomations(workspace.id, signal) })

  if (query.isLoading) return <AutomationsLoading />
  if (query.isError) return <div className="p-6"><Alert variant="destructive"><AlertTitle>Automations couldn’t load</AlertTitle><AlertDescription>{getApiErrorMessage(query.error)}</AlertDescription><AlertAction><Button variant="outline" size="sm" onClick={() => query.refetch()}><IconRefresh data-icon="inline-start" />Retry</Button></AlertAction></Alert></div>

  const result = query.data
  if (!result) return null
  const canCreate = result.plan === "pro" && result.role === "admin"
  const percentage = Math.min(100, result.usage.attempts / result.usage.limit * 100)

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pt-5 pb-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="text-lg font-medium leading-7">Automations</h1><Badge variant="blue">Pro</Badge></div>
          <p className="text-sm leading-5 text-muted-foreground">Send visitor activity to the tools your team already uses.</p>
        </div>
        <CreateAutomationDialog workspaceId={workspace.id} disabled={!canCreate} />
      </div>

      {result.plan !== "pro" ? (
        <Alert>
          <IconBolt />
          <AlertTitle>Connect Handout to your workflow with Pro</AlertTitle>
          <AlertDescription>Send visits and clicks to your CRM, Slack workflow, or any app that gives you a webhook URL.</AlertDescription>
          <AlertAction><Button asChild size="sm"><Link to="/settings" search={{ tab: "billing" }}>View Pro</Link></Button></AlertAction>
        </Alert>
      ) : result.role !== "admin" ? (
        <Alert><AlertTitle>Admin access is required</AlertTitle><AlertDescription>You can see delivery activity, but only a workspace admin can create or change automations.</AlertDescription></Alert>
      ) : null}

      {result.plan === "pro" && percentage >= 80 ? <Alert variant={percentage >= 100 ? "destructive" : "default"}><AlertTitle>{percentage >= 100 ? "Monthly automation limit reached" : "Monthly automation usage is running low"}</AlertTitle><AlertDescription>{percentage >= 100 ? "No more webhook requests will be sent until the displayed reset time." : `${(result.usage.limit - result.usage.attempts).toLocaleString()} delivery attempts remain until the displayed reset time.`}</AlertDescription></Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm font-medium">Monthly delivery attempts</p><p className="text-xs text-muted-foreground">Tests and retries count. Resets {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.usage.resetsAt))}.</p></div><p className="text-sm tabular-nums">{result.usage.attempts.toLocaleString()} / {result.usage.limit.toLocaleString()}</p></div>
          <Progress value={percentage} aria-label={`${Math.round(percentage)} percent of monthly automation usage`} />
        </div>
        <div className="rounded-xl border p-4"><p className="text-sm font-medium">Queue</p><p className="mt-2 text-2xl font-medium tabular-nums">{(result.usage.pendingMessages + result.usage.pendingDeliveries).toLocaleString()}</p><p className="text-xs text-muted-foreground">waiting to be prepared or sent</p></div>
      </div>

      {result.automations.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader><EmptyMedia variant="icon"><IconBolt /></EmptyMedia><EmptyTitle>No automations yet</EmptyTitle><EmptyDescription>Choose an activity, paste a webhook URL, and send a test. Handout handles delivery and retries.</EmptyDescription></EmptyHeader>
          <EmptyContent>{canCreate ? <CreateAutomationDialog workspaceId={workspace.id} /> : null}</EmptyContent>
        </Empty>
      ) : (
        <>
        <div className="grid gap-3 sm:hidden">
          {result.automations.map((automation) => (
            <Link key={automation.id} to="/automations/$automationId" params={{ automationId: automation.id }} className="rounded-xl border p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="truncate font-medium">{automation.name}</div><div className="truncate text-xs text-muted-foreground">{automation.endpointHost}</div></div><AutomationStatus state={automation.state} /></div>
              <p className="mt-3 text-sm text-muted-foreground">{describeTrigger(automation.trigger)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{automation.lastDeliveryAt ? `Last delivered ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(automation.lastDeliveryAt))}` : "Not sent yet"}</p>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-xl border sm:block">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Rule</TableHead><TableHead>Status</TableHead><TableHead>Last delivery</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
            <TableBody>{result.automations.map((automation) => (
              <TableRow key={automation.id}>
                <TableCell><Link to="/automations/$automationId" params={{ automationId: automation.id }} className="font-medium hover:underline">{automation.name}</Link><div className="text-xs text-muted-foreground">{automation.endpointHost}</div></TableCell>
                <TableCell className="max-w-80 text-muted-foreground">{describeTrigger(automation.trigger)}</TableCell>
                <TableCell><AutomationStatus state={automation.state} /></TableCell>
                <TableCell className="text-muted-foreground">{automation.lastDeliveryAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(automation.lastDeliveryAt)) : "Not sent yet"}</TableCell>
                <TableCell><Button asChild variant="ghost" size="icon-sm"><Link to="/automations/$automationId" params={{ automationId: automation.id }} aria-label={`Open ${automation.name}`}><IconArrowRight /></Link></Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  )
}

export function AutomationStatus({ state }: { state: "draft" | "enabled" | "paused" | "needs_attention" }) {
  return <Badge variant={state === "enabled" ? "default" : state === "needs_attention" ? "destructive" : "outline"}>{state === "needs_attention" ? "Needs attention" : state === "enabled" ? "On" : state === "draft" ? "Not on yet" : "Paused"}</Badge>
}

function describeTrigger(trigger: { eventTypes: string[]; siteScope: string; recipientScope: string }) {
  const actions = trigger.eventTypes.map((type) => ({ site_visit: "visits", button_click: "button clicks", link_click: "link clicks", tab_switch: "page changes" })[type] ?? type).join(", ")
  return `${actions} · ${trigger.siteScope === "all" ? "all sites" : "selected sites"} · ${trigger.recipientScope === "anyone" ? "any visitor" : trigger.recipientScope}`
}

function AutomationsLoading() { return <div className="space-y-5 p-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div> }
