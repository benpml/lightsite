import { useEffect, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconChevronsUp,
  IconCircleCheck,
  IconCreditCard,
  IconRefresh,
  IconUserPlus,
} from "@tabler/icons-react"
import type {
  BillingInterval,
  BillingSubscriptionStatus,
  BillingSummary,
  WorkspacePlan,
} from "@handout/contracts"
import { toast } from "sonner"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { LoadingState } from "@/components/common/loading-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { cn } from "@/lib/utils"

import {
  cancelBillingSubscription,
  createBillingCheckout,
  createBillingPortal,
  getBillingSummary,
  updateBillingSubscription,
} from "./api"
import {
  billingPlanLabels,
  billingPrices,
  getBillingCancellationState,
  getBillingPlanAction,
  getBillingSubscriptionNotice,
  managedSubscriptionStatuses,
  shouldShowUpgradePlan,
  type BillingPlanAction,
  type PaidPlan,
} from "./model"

export function BillingPage() {
  return <BillingSettingsTab />
}

export function BillingSettingsTab() {
  const workspace = useActiveWorkspace()
  return <BillingSettingsContent key={workspace.id} workspaceId={workspace.id} />
}

function BillingSettingsContent({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient()
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [pendingPlanAction, setPendingPlanAction] = useState<BillingPlanAction | null>(null)
  const billingQuery = useQuery({
    queryKey: queryKeys.billing(workspaceId),
    queryFn: ({ signal }) => getBillingSummary(signal),
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    const checkoutResult = url.searchParams.get("checkout")
    if (!checkoutResult) return

    if (checkoutResult === "success") {
      toast.success("Checkout completed. Your subscription is being activated.")
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    } else if (checkoutResult === "cancelled") {
      toast.message("Checkout was cancelled. No billing changes were made.")
    }

    url.searchParams.delete("checkout")
    window.history.replaceState(null, "", url)

    if (checkoutResult !== "success") return
    const refreshTimers = [1500, 5000].map((delay) => window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    }, delay))
    return () => refreshTimers.forEach((timer) => window.clearTimeout(timer))
  }, [queryClient, workspaceId])

  const refreshBilling = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.billing(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
    ])
  }

  const checkout = useMutation({
    mutationFn: createBillingCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(getApiErrorMessage(error, "Checkout could not be started.")),
  })
  const portal = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(getApiErrorMessage(error, "Billing could not be opened.")),
  })
  const update = useMutation({
    mutationFn: updateBillingSubscription,
    onSuccess: async (_, variables) => {
      setPendingPlanAction(null)
      await refreshBilling()
      toast.success(
        variables.plan === billingQuery.data?.plan &&
        variables.interval === billingQuery.data.subscription?.interval &&
        billingQuery.data.subscription.cancelAtPeriodEnd
          ? "Your subscription has been resumed."
          : "Subscription updated. Any prorations will appear on your next invoice.",
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Subscription could not be updated.")),
  })
  const cancel = useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: async () => {
      setCancelOpen(false)
      await refreshBilling()
      toast.success("Your subscription will end after the current billing period.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Subscription could not be cancelled.")),
  })

  if (billingQuery.isLoading) return <BillingLoadingState />

  if (billingQuery.isError || !billingQuery.data) {
    return (
      <Alert variant="destructive" className="w-full max-w-[560px]">
        <AlertTitle>Billing could not be loaded</AlertTitle>
        <AlertDescription>{getApiErrorMessage(billingQuery.error, "Refresh and try again.")}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="compact" onClick={() => void billingQuery.refetch()}>
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const summary = billingQuery.data
  const subscription = summary.subscription
  const interval = selectedInterval ?? subscription?.interval ?? "month"
  const annual = interval === "year"
  const seats = subscription?.seatCount ?? 1
  const isManaged = Boolean(
    subscription && managedSubscriptionStatuses.has(subscription.status),
  )
  const cancellationState = getBillingCancellationState(summary)
  const isBusy = checkout.isPending || portal.isPending || update.isPending || cancel.isPending
  const statusNotice = getBillingSubscriptionNotice(summary)

  const performAction = (action: BillingPlanAction) => {
    if (action.disabled || isBusy) return
    if (action.kind === "checkout") {
      checkout.mutate({ plan: action.plan, interval: action.interval })
    } else if (action.kind === "portal") {
      portal.mutate()
    } else if (action.kind === "update") {
      const isResume = summary.plan === action.plan &&
        subscription?.interval === action.interval &&
        subscription.cancelAtPeriodEnd
      if (isResume) update.mutate({ plan: action.plan, interval: action.interval })
      else setPendingPlanAction(action)
    }
  }

  const openPortal = () => {
    if (!summary.canManageBilling || portal.isPending) return
    portal.mutate()
  }

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-10">
      {!summary.canManageBilling ? (
        <Alert>
          <IconAlertTriangle />
          <AlertTitle>Billing is read-only</AlertTitle>
          <AlertDescription>Only workspace admins can change plans, seats, payment methods, or cancellation.</AlertDescription>
        </Alert>
      ) : null}

      {statusNotice ? (
        <Alert variant={statusNotice.destructive ? "destructive" : "default"}>
          <IconAlertTriangle />
          <AlertTitle>{statusNotice.title}</AlertTitle>
          <AlertDescription>{statusNotice.description}</AlertDescription>
          {statusNotice.showPortal && summary.canManageBilling ? (
            <AlertAction>
              <Button variant="outline" size="compact" disabled={portal.isPending} onClick={openPortal}>
                {portal.isPending ? <Spinner data-icon="inline-start" /> : null}
                Open billing
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      <BillingSection title="Quick actions">
        <div className="flex flex-wrap gap-1.5">
          {shouldShowUpgradePlan(summary.plan) ? (
            <Button
              variant="outline"
              size="compact"
              disabled={!summary.canManageBilling}
              onClick={() => document.getElementById("billing-plans")?.scrollIntoView({ behavior: "smooth" })}
            >
              <IconChevronsUp data-icon="inline-start" />
              Upgrade plan
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="compact"
            disabled={!summary.canManageBilling}
            onClick={() => window.location.assign("/team?invite=true")}
          >
            <IconUserPlus data-icon="inline-start" />
            Add seats
          </Button>
          <Button
            variant="outline"
            size="compact"
            disabled={!summary.canManageBilling || portal.isPending}
            onClick={openPortal}
          >
            {portal.isPending ? <Spinner data-icon="inline-start" /> : <IconCreditCard data-icon="inline-start" />}
            Update payment method
          </Button>
        </div>
      </BillingSection>

      <Separator className="bg-neutral-alpha-a400" />

      <BillingSection title="Subscription">
        <Card className="min-h-20 gap-0 rounded-[16px] border border-border bg-transparent py-0 ring-0">
          <CardContent className="flex min-h-20 items-center gap-3 p-5">
            <div className="min-w-0 flex-1">
              <div className="flex min-h-5 flex-wrap items-center gap-2 text-sm leading-5 font-medium text-tertiary-foreground">
                <span>{summary.plan === "free" ? "Free plan" : billingPlanLabels[summary.plan]}</span>
                <span className="size-[3px] rounded-full bg-tertiary-foreground" />
                <span>{seats} {seats === 1 ? "seat" : "seats"}</span>
                {subscription ? <SubscriptionBadge subscription={subscription} /> : null}
              </div>
              <p className="text-sm leading-5 text-muted-foreground">
                {getSubscriptionPriceLabel(summary, seats)}
              </p>
            </div>
            <Button
              variant="outline"
              size="compact"
              disabled={!summary.canManageBilling || portal.isPending}
              onClick={openPortal}
            >
              {portal.isPending ? <Spinner data-icon="inline-start" /> : null}
              Manage
            </Button>
          </CardContent>
        </Card>
      </BillingSection>

      <Separator className="bg-neutral-alpha-a400" />

      <section id="billing-plans" className="flex scroll-mt-6 flex-col gap-4">
        <div className="flex min-h-6 flex-wrap items-center gap-4">
          <h2 className="min-w-0 flex-1 text-base leading-6 font-medium text-foreground">Plans</h2>
          <label className="flex items-center gap-2 text-sm leading-5 text-muted-foreground">
            Annual pricing
            <Switch
              aria-label="Annual pricing"
              checked={annual}
              size="compact"
              onCheckedChange={(checked) => setSelectedInterval(checked ? "year" : "month")}
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {(["core", "pro"] as const).map((plan) => {
            const action = getBillingPlanAction(summary, plan, interval)
            return (
              <PlanCard
                key={plan}
                action={action}
                annual={annual}
                busy={isBusy}
                isDowngrade={summary.plan === "pro" && plan === "core"}
                plan={plan}
                onClick={() => performAction(action)}
              />
            )
          })}
        </div>
        {summary.plan === "free" ? (
          <Card className="flex min-h-[72px] flex-col items-start gap-3 rounded-[16px] border border-border bg-transparent px-5 py-4 ring-0 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-sm leading-5 font-medium text-tertiary-foreground">Free</p>
              <p className="text-sm leading-5 text-muted-foreground">Build up to 5 sites for free before publishing.</p>
            </div>
            <Button variant="secondary" size="compact" disabled>Current plan</Button>
          </Card>
        ) : null}
      </section>

      <Separator className="bg-neutral-alpha-a400" />

      <BillingSection title="Cancel" description="Cancel your subscription">
        {cancellationState === "available" ? (
          <>
            <Alert className="min-h-[30px] grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0 rounded-md border-0 bg-secondary px-3 py-0 text-tertiary-foreground shadow-none [&>svg]:row-span-1 [&>svg]:translate-y-0">
              <IconAlertTriangle className="size-3.5" />
              <AlertDescription className="leading-5 text-tertiary-foreground">
                Warning: This will un-publish all live sites, delete all tracking data, and may delete sites.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="compact"
              className="self-start text-red-foreground hover:text-red-foreground"
              disabled={!summary.canManageBilling}
              onClick={() => {
                if (isManaged) setCancelOpen(true)
                else openPortal()
              }}
            >
              Cancel
            </Button>
          </>
        ) : cancellationState === "scheduled" && subscription ? (
          <div className="flex flex-col items-start gap-3">
            <Alert>
              <IconAlertTriangle />
              <AlertTitle>Cancellation scheduled</AlertTitle>
              <AlertDescription>
                Access ends {formatBillingDate(subscription.currentPeriodEnd)} unless you resume the subscription.
              </AlertDescription>
            </Alert>
            {summary.plan === "core" || summary.plan === "pro" ? (
              <Button
                variant="outline"
                size="compact"
                disabled={!summary.canManageBilling || update.isPending || !subscription.interval}
                onClick={() => {
                  if (subscription.interval) {
                    update.mutate({ plan: summary.plan as PaidPlan, interval: subscription.interval })
                  }
                }}
              >
                {update.isPending ? <Spinner data-icon="inline-start" /> : null}
                Resume subscription
              </Button>
            ) : null}
          </div>
        ) : (
          <Button variant="secondary" size="compact" className="self-start" disabled>
            {summary.plan === "free" ? "You are already on the free plan" : "No active subscription to cancel"}
          </Button>
        )}
      </BillingSection>

      <PlanChangeDialog
        action={pendingPlanAction}
        currentPlan={summary.plan}
        pending={update.isPending}
        onOpenChange={(open) => { if (!open && !update.isPending) setPendingPlanAction(null) }}
        onConfirm={() => {
          if (pendingPlanAction) {
            update.mutate({ plan: pendingPlanAction.plan, interval: pendingPlanAction.interval })
          }
        }}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your plan remains active until {formatBillingDate(subscription?.currentPeriodEnd)}. After that, your workspace moves to the Free plan and its publishing, tracking, and site limits apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? <Spinner data-icon="inline-start" /> : null}
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BillingLoadingState() {
  return <LoadingState placement="page" label="Loading billing" />
}

function PlanChangeDialog({
  action,
  currentPlan,
  onConfirm,
  onOpenChange,
  pending,
}: {
  action: BillingPlanAction | null
  currentPlan: WorkspacePlan
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  pending: boolean
}) {
  if (!action) return null
  const planChanged = currentPlan !== action.plan

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action.label}?</DialogTitle>
          <DialogDescription>
            {planChanged
              ? `Your workspace will move to the ${billingPlanLabels[action.plan]} plan with ${action.interval === "year" ? "annual" : "monthly"} billing.`
              : `Your ${billingPlanLabels[action.plan]} plan will change to ${action.interval === "year" ? "annual" : "monthly"} billing.`}
            {" "}Stripe will prorate the change and include any adjustment on your next invoice.
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <IconArrowsExchange />
          <AlertDescription>This change takes effect immediately and applies to every paid seat.</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Keep current plan</Button>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Confirm change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SubscriptionBadge({ subscription }: { subscription: NonNullable<BillingSummary["subscription"]> }) {
  if (subscription.cancelAtPeriodEnd) return <Badge variant="secondary">Ends soon</Badge>
  const labels: Partial<Record<BillingSubscriptionStatus, string>> = {
    trialing: "Trial",
    past_due: "Payment due",
    unpaid: "Unpaid",
    paused: "Paused",
    incomplete: "Action required",
  }
  const label = labels[subscription.status]
  return label ? <Badge variant="secondary">{label}</Badge> : null
}

function getSubscriptionPriceLabel(summary: BillingSummary, seats: number) {
  if (summary.plan === "free") return "$0/month"
  const interval = summary.subscription?.interval ?? "month"
  const perSeat = billingPrices[summary.plan][interval]
  const suffix = interval === "year" ? "/month, billed annually" : "/month"
  return `$${perSeat * seats}${suffix} · $${perSeat} per seat`
}

function formatBillingDate(value: string | null | undefined) {
  if (!value) return "the end of the current billing period"
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function BillingSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <section className="flex flex-col gap-4 overflow-hidden">
      <div>
        <h2 className="text-base leading-6 font-medium text-foreground">{title}</h2>
        {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function PlanCard({
  action,
  annual,
  busy,
  isDowngrade,
  onClick,
  plan,
}: {
  action: BillingPlanAction
  annual: boolean
  busy: boolean
  isDowngrade: boolean
  onClick: () => void
  plan: PaidPlan
}) {
  const features = plan === "core"
    ? ["Unlimited published sites", "Unlimited recipients", "Activity tracking"]
    : ["Webhook automations", "Advanced tracking", "Watch session replays"]

  return (
    <Card className={cn(
      "min-w-0 flex-1 gap-6 rounded-[16px] border border-border p-5 ring-0",
      annual ? "min-h-[284px]" : "min-h-[282px]",
    )}>
      <div className="flex w-full flex-col gap-2">
        <div className="flex min-h-5 items-start">
          <p className="min-w-0 flex-1 text-sm leading-5 font-medium text-tertiary-foreground">{billingPlanLabels[plan]}</p>
          {annual ? <Badge variant="secondary" className="bg-green-background text-green-foreground">20% off</Badge> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-2xl leading-8 font-medium text-foreground">${billingPrices[plan][annual ? "year" : "month"]}</p>
          <p className="text-sm leading-5 text-muted-foreground">Per seat / month</p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {features.map((feature) => (
          <div key={feature} className="flex min-h-5 items-center gap-2 text-sm leading-5 text-secondary-foreground">
            <IconCircleCheck className="size-3.5 shrink-0 text-green-foreground" />
            <span>{feature}</span>
          </div>
        ))}
      </div>
      <Button
        variant={isDowngrade ? "outline" : "default"}
        className="mt-auto w-full"
        disabled={action.disabled || busy}
        onClick={onClick}
      >
        {busy && !action.disabled ? <Spinner data-icon="inline-start" /> : null}
        {action.label}
      </Button>
    </Card>
  )
}
