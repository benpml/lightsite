import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { IconArrowRight, IconBuilding, IconRefresh, IconUserCircle } from "@tabler/icons-react"
import {
  LIGHTSITE_TEXT_LIMITS,
  normalizeWebsiteDomain,
  slugifyName,
  validateWorkspaceSlug,
} from "@lightsite/domain"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getAppBootstrap, completeAccountSetup } from "@/features/app-bootstrap/api"
import { getApiErrorMessage, getApiFieldError, isApiClientError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import {
  createWorkspace,
  getWorkspaceLogoPreview,
  getWorkspaceSlugAvailability,
} from "./api"
import {
  getDefaultAccountName,
  getDefaultWorkspaceName,
  resolveOnboardingStep,
} from "./onboarding-state"

export function OnboardingPage() {
  const navigate = useNavigate()
  const bootstrapQuery = useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => getAppBootstrap(signal),
  })
  const bootstrap = bootstrapQuery.data
  const step = bootstrap ? resolveOnboardingStep(bootstrap) : null

  useEffect(() => {
    if (step === "app") {
      void navigate({ to: "/sites" })
    }
  }, [navigate, step])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page-background px-4 py-8 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">Lightsite</p>
          <h1 className="font-heading text-2xl leading-8 font-semibold tracking-normal">
            Set up your workspace
          </h1>
        </div>

        {bootstrapQuery.isLoading ? <OnboardingLoadingCard /> : null}
        {bootstrapQuery.isError ? (
          <OnboardingErrorCard
            message={getApiErrorMessage(bootstrapQuery.error, "Onboarding could not be loaded.")}
            onRetry={() => void bootstrapQuery.refetch()}
            requiresAuth={isApiClientError(bootstrapQuery.error) && bootstrapQuery.error.status === 401}
          />
        ) : null}
        {bootstrap && step === "verify_email" ? (
          <VerifyEmailCard email={bootstrap.user.email} />
        ) : null}
        {bootstrap && step === "account" ? (
          <AccountSetupCard
            defaultName={getDefaultAccountName(bootstrap)}
            email={bootstrap.user.email}
          />
        ) : null}
        {bootstrap && step === "workspace" ? (
          <WorkspaceSetupCard
            defaultName={getDefaultWorkspaceName(bootstrap.user.email)}
          />
        ) : null}
        {bootstrap && step === "app" ? <OnboardingLoadingCard /> : null}
      </div>
    </main>
  )
}

function OnboardingLoadingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading</CardTitle>
        <CardDescription>Checking your account status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Preparing setup
        </div>
      </CardContent>
    </Card>
  )
}

function OnboardingErrorCard({
  message,
  onRetry,
  requiresAuth,
}: {
  message: string
  onRetry: () => void
  requiresAuth?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{requiresAuth ? "Sign in to continue" : "Setup could not be loaded"}</CardTitle>
        <CardDescription>
          {requiresAuth ? "Create an account or sign in before setting up your workspace." : message}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        {requiresAuth ? (
          <Button asChild>
            <a href="/auth?mode=sign-up">
              Continue
              <IconArrowRight data-icon="inline-end" />
            </a>
          </Button>
        ) : (
          <Button variant="outline" onClick={onRetry}>
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function VerifyEmailCard({ email }: { email: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTitle>Email verification required</AlertTitle>
          <AlertDescription>
            Open the verification link sent to your inbox, then refresh this page.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function AccountSetupCard({
  defaultName,
  email,
}: {
  defaultName: string
  email: string
}) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(defaultName)
  const accountMutation = useMutation({
    mutationFn: completeAccountSetup,
    onSuccess: async (bootstrap) => {
      queryClient.setQueryData(queryKeys.me(), bootstrap)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })
  const displayNameError = getApiFieldError(accountMutation.error, "displayName")
  const hasDisplayNameError = Boolean(displayNameError)
  const trimmedName = displayName.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmedName || accountMutation.isPending) {
            return
          }
          accountMutation.mutate({ displayName: trimmedName })
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field data-invalid={hasDisplayNameError || undefined}>
              <FieldLabel htmlFor="display-name">Name</FieldLabel>
              <Input
                id="display-name"
                maxLength={LIGHTSITE_TEXT_LIMITS.accountDisplayName}
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  if (accountMutation.isError) {
                    accountMutation.reset()
                  }
                }}
                aria-invalid={hasDisplayNameError || undefined}
                autoComplete="name"
                disabled={accountMutation.isPending}
                placeholder="Jane Doe"
              />
              {displayNameError ? <FieldError>{displayNameError}</FieldError> : null}
            </Field>
          </FieldGroup>
          {accountMutation.isError && !displayNameError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Account was not updated</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(accountMutation.error, "Try again in a moment.")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!trimmedName || accountMutation.isPending}>
            {accountMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconUserCircle data-icon="inline-start" />
            )}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function WorkspaceSetupCard({ defaultName }: { defaultName: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(defaultName)
  const [slug, setSlug] = useState(slugifyName(defaultName))
  const [slugTouched, setSlugTouched] = useState(false)
  const [website, setWebsite] = useState("")
  const slugValidation = useMemo(() => validateWorkspaceSlug(slug), [slug])
  const websiteValidation = useMemo(() => normalizeWebsiteDomain(website), [website])
  const slugAvailabilityQuery = useQuery({
    queryKey: queryKeys.workspaceSlugAvailability(slugValidation.ok ? slugValidation.slug : ""),
    queryFn: ({ signal }) => getWorkspaceSlugAvailability(slugValidation.ok ? slugValidation.slug : slug, signal),
    enabled: slugValidation.ok,
    staleTime: 10_000,
  })
  const logoPreviewQuery = useQuery({
    queryKey: queryKeys.workspaceLogoPreview(websiteValidation.ok ? websiteValidation.domain : ""),
    queryFn: ({ signal }) =>
      getWorkspaceLogoPreview({
        website: websiteValidation.ok ? websiteValidation.domain : website,
        size: 128,
        theme: "light",
      }, signal),
    enabled: websiteValidation.ok,
    staleTime: 60_000,
  })
  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await navigate({ to: "/sites" })
    },
  })
  const nameError = getApiFieldError(createWorkspaceMutation.error, "name")
  const slugError = getApiFieldError(createWorkspaceMutation.error, "slug")
  const websiteError = getApiFieldError(createWorkspaceMutation.error, "website")
  const hasSlugError = Boolean(slugError) || !slugValidation.ok || slugAvailabilityQuery.data?.available === false
  const hasWebsiteError = Boolean(websiteError) || (website.length > 0 && !websiteValidation.ok)
  const canSubmit =
    name.trim().length > 0 &&
    slugValidation.ok &&
    websiteValidation.ok &&
    slugAvailabilityQuery.data?.available === true &&
    !createWorkspaceMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Choose the company namespace for your team.</CardDescription>
      </CardHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit || !slugValidation.ok || !websiteValidation.ok) {
            return
          }
          createWorkspaceMutation.mutate({
            name: name.trim(),
            slug: slugValidation.slug,
            website: websiteValidation.domain,
          })
        }}
      >
        <CardContent className="flex flex-col gap-5">
          <WorkspaceLogoPreview
            imageUrl={logoPreviewQuery.data?.imageUrl ?? null}
            loading={logoPreviewQuery.isFetching}
            name={name}
          />
          <FieldGroup>
            <Field data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <Input
                id="workspace-name"
                maxLength={LIGHTSITE_TEXT_LIMITS.workspaceName}
                value={name}
                onChange={(event) => {
                  const nextName = event.target.value
                  setName(nextName)
                  if (!slugTouched) {
                    setSlug(slugifyName(nextName))
                  }
                  if (createWorkspaceMutation.isError) {
                    createWorkspaceMutation.reset()
                  }
                }}
                aria-invalid={Boolean(nameError) || undefined}
                autoComplete="organization"
                disabled={createWorkspaceMutation.isPending}
                placeholder="Acme"
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field data-invalid={hasSlugError || undefined}>
              <FieldLabel htmlFor="workspace-slug">Workspace slug</FieldLabel>
              <Input
                id="workspace-slug"
                maxLength={LIGHTSITE_TEXT_LIMITS.slug}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugifyName(event.target.value))
                  if (createWorkspaceMutation.isError) {
                    createWorkspaceMutation.reset()
                  }
                }}
                aria-invalid={hasSlugError || undefined}
                autoComplete="off"
                disabled={createWorkspaceMutation.isPending}
                placeholder="acme"
              />
              {slugError ? <FieldError>{slugError}</FieldError> : null}
              {!slugError && !slugValidation.ok ? <FieldError>{slugValidation.message}</FieldError> : null}
              {!slugError && slugValidation.ok && slugAvailabilityQuery.data?.available === false ? (
                <FieldError>This workspace slug is already in use.</FieldError>
              ) : null}
              {!hasSlugError && slugValidation.ok ? (
                <FieldDescription>
                  Public links will use /{slugValidation.slug}/site-slug.
                </FieldDescription>
              ) : null}
            </Field>
            <Field data-invalid={hasWebsiteError || undefined}>
              <FieldLabel htmlFor="workspace-website">Website</FieldLabel>
              <Input
                id="workspace-website"
                maxLength={LIGHTSITE_TEXT_LIMITS.url}
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value)
                  if (createWorkspaceMutation.isError) {
                    createWorkspaceMutation.reset()
                  }
                }}
                aria-invalid={hasWebsiteError || undefined}
                autoComplete="url"
                disabled={createWorkspaceMutation.isPending}
                inputMode="url"
                placeholder="acme.com"
              />
              {websiteError ? <FieldError>{websiteError}</FieldError> : null}
              {!websiteError && website.length > 0 && !websiteValidation.ok ? (
                <FieldError>{websiteValidation.message}</FieldError>
              ) : null}
              {websiteValidation.ok ? (
                <FieldDescription>{websiteValidation.domain}</FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>
          {createWorkspaceMutation.isError && !nameError && !slugError && !websiteError ? (
            <Alert variant="destructive">
              <AlertTitle>Workspace was not created</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(createWorkspaceMutation.error, "Try again in a moment.")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!canSubmit}>
            {createWorkspaceMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconArrowRight data-icon="inline-start" />
            )}
            Create workspace
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function WorkspaceLogoPreview({
  imageUrl,
  loading,
  name,
}: {
  imageUrl: string | null
  loading: boolean
  name: string
}) {
  const fallback = name.trim().slice(0, 1).toUpperCase() || "L"

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="size-8 object-contain"
            loading="lazy"
          />
        ) : loading ? (
          <Spinner />
        ) : (
          <IconBuilding aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name || "Workspace"}</p>
        <p className="truncate text-sm text-muted-foreground">
          {imageUrl ? "Logo preview found" : `Default avatar ${fallback}`}
        </p>
      </div>
    </div>
  )
}
