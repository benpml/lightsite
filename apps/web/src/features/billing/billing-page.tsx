import { useState, type ComponentType, type ReactNode, type SVGProps } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  IconAlertCircle,
  IconCheck,
  IconCreditCard,
  IconExternalLink,
  IconInfinity,
  IconSparkles,
} from "@tabler/icons-react"
import type { BillingInterval, WorkspacePlan } from "@lightsite/contracts"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import {
  createBillingCheckout,
  createBillingPortal,
  getBillingSummary,
} from "./api"

const planLabels = {
  free: "Free",
  core: "Core",
  pro: "Pro",
} satisfies Record<WorkspacePlan, string>

const corePrices = {
  month: 49,
  year: 39,
} satisfies Record<BillingInterval, number>

export function BillingPage() {
  const activeWorkspace = useActiveWorkspace()
  const [interval, setInterval] = useState<BillingInterval>("month")
  const billingQuery = useQuery({
    queryKey: queryKeys.billing(activeWorkspace.id),
    queryFn: ({ signal }) => getBillingSummary(signal),
  })
  const checkoutMutation = useMutation({
    mutationFn: createBillingCheckout,
    onSuccess: (data) => {
      window.location.assign(data.url)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Checkout could not be started."))
    },
  })
  const portalMutation = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => {
      window.location.assign(data.url)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Billing portal could not be opened."))
    },
  })
  const summary = billingQuery.data
  const activePlan = summary?.plan ?? activeWorkspace.plan
  const currentSubscription = summary?.subscription
  const isLoadingAction = checkoutMutation.isPending || portalMutation.isPending

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pt-5 pb-6">
      <PageHeader
        title="Billing"
        description="Manage your workspace plan, publishing access, and Stripe billing portal."
        actions={
          summary?.hasStripeCustomer ? (
            <Button
              size="compact"
              variant="outline"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              {portalMutation.isPending ? <Spinner data-icon="inline-start" /> : <IconExternalLink data-icon="inline-start" />}
              Manage billing
            </Button>
          ) : null
        }
      />

      {billingQuery.isError ? (
        <Alert variant="destructive">
          <IconAlertCircle />
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(billingQuery.error, "Refresh and try again.")}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace plan</CardTitle>
            <CardDescription>{activeWorkspace.name}</CardDescription>
            <CardAction>
              <Badge variant={activePlan === "free" ? "secondary" : "default"}>
                {planLabels[activePlan]}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <PlanMetric label="Publishing" value={summary?.canPublish ? "Enabled" : "Upgrade required"} />
              <PlanMetric label="Seats" value={String(currentSubscription?.seatCount ?? 1)} />
              <PlanMetric
                label="Renews"
                value={currentSubscription?.currentPeriodEnd ? formatDate(currentSubscription.currentPeriodEnd) : "-"}
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <IconCheck />
                <span>Free workspaces can draft up to 10 sites.</span>
              </div>
              <div className="flex items-center gap-2">
                <IconInfinity />
                <span>Core includes unlimited published sites and recipients, subject to abuse guardrails.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing cadence</CardTitle>
            <CardDescription>Annual saves $10 per user each month.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              value={interval}
              onValueChange={(value) => {
                if (value === "month" || value === "year") {
                  setInterval(value)
                }
              }}
              className="grid w-full grid-cols-2"
              spacing={2}
            >
              <ToggleGroupItem value="month" variant="outline">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="year" variant="outline">
                Annual
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          badge={activePlan === "free" ? "Current" : undefined}
          description="Try Lightsite and build before you publish."
          features={[
            "Build up to 10 sites",
            "Private drafts",
            "Upgrade only when publishing",
          ]}
          icon={IconSparkles}
          price="$0"
          title="Free"
        />
        <PlanCard
          badge={activePlan === "core" ? "Current" : "Recommended"}
          cta={
            activePlan === "core" && summary?.hasStripeCustomer ? (
              <Button
                className="w-full"
                variant="outline"
                disabled={isLoadingAction}
                onClick={() => portalMutation.mutate()}
              >
                {portalMutation.isPending ? <Spinner data-icon="inline-start" /> : <IconCreditCard data-icon="inline-start" />}
                Manage Core
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={isLoadingAction || summary?.canManageBilling === false}
                onClick={() => checkoutMutation.mutate({ plan: "core", interval })}
              >
                {checkoutMutation.isPending ? <Spinner data-icon="inline-start" /> : <IconCreditCard data-icon="inline-start" />}
                {activePlan === "core" ? "Connect Core billing" : "Upgrade to Core"}
              </Button>
            )
          }
          description="Publish and share without workspace-level volume limits."
          features={[
            "Unlimited published sites",
            "Unlimited recipients",
            "Self-serve Stripe billing",
          ]}
          icon={IconCreditCard}
          price={`$${corePrices[interval]}`}
          priceDetail={`/user/mo${interval === "year" ? ", billed annually" : ""}`}
          title="Core"
        />
      </section>
    </div>
  )
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-16 flex-col justify-between rounded-lg border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  )
}

function PlanCard({
  badge,
  cta,
  description,
  disabled,
  features,
  icon: Icon,
  price,
  priceDetail = "",
  title,
}: {
  badge?: string
  cta?: ReactNode
  description: string
  disabled?: boolean
  features: string[]
  icon: ComponentType<SVGProps<SVGSVGElement>>
  price: string
  priceDetail?: string
  title: string
}) {
  return (
    <Card className={disabled ? "opacity-70" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon />
          <span>{title}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {badge ? (
          <CardAction>
            <Badge variant={badge === "Current" ? "default" : "secondary"}>{badge}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <span className="font-heading text-3xl font-semibold leading-none">{price}</span>
          {priceDetail ? <span className="text-sm text-muted-foreground"> {priceDetail}</span> : null}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <IconCheck />
              <span>{feature}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Unlimited usage is subject to abuse guardrails.
        </p>
        {cta ? <div className="mt-auto">{cta}</div> : null}
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}
