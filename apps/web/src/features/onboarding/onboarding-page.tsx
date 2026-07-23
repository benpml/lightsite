import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { IconPhoto } from "@tabler/icons-react"
import {
  HANDOUT_TEXT_LIMITS,
  normalizeWebsiteDomain,
} from "@handout/domain"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { completeAccountSetup, getAppBootstrap } from "@/features/app-bootstrap/api"
import { AuthArtwork } from "@/features/auth/components/auth-artwork"
import {
  AuthFlowShell,
  AuthFooterLinks,
} from "@/features/auth/components/auth-flow-shell"
import { uploadWorkspaceLogo } from "@/features/workspaces/api"
import { getApiErrorMessage, getApiFieldError, isApiClientError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import {
  readFileAsBase64,
  readSquareImageAsBase64,
  validateSquareImageFile,
} from "@/lib/image-upload"

import {
  createWorkspace,
  getWorkspaceLogoPreview,
  uploadOnboardingProfileImage,
} from "./api"
import {
  getDefaultAccountName,
  getDefaultWorkspaceWebsite,
  resolveOnboardingStep,
  splitAccountName,
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
    if (step === "app") void navigate({ to: "/sites" })
  }, [navigate, step])

  if (bootstrapQuery.isLoading || step === "app") {
    return <OnboardingStatus title="Preparing your account" description="This will only take a moment." />
  }

  if (bootstrapQuery.isError) {
    const requiresAuth = isApiClientError(bootstrapQuery.error) && bootstrapQuery.error.status === 401
    return (
      <OnboardingStatus
        title={requiresAuth ? "Sign in to continue" : "Setup could not be loaded"}
        description={
          requiresAuth
            ? "Create an account or log in before continuing."
            : getApiErrorMessage(bootstrapQuery.error, "Try again in a moment.")
        }
        action={
          requiresAuth ? (
            <Button asChild size="lg"><a href="/auth?mode=sign-up">Continue</a></Button>
          ) : (
            <Button variant="outline" size="lg" onClick={() => void bootstrapQuery.refetch()}>
              Try again
            </Button>
          )
        }
      />
    )
  }

  if (!bootstrap) return null

  if (step === "verify_email") {
    window.location.replace(`/auth?returnTo=${encodeURIComponent("/onboarding")}`)
    return null
  }

  if (step === "account") {
    return (
      <AccountSetup
        defaultName={getDefaultAccountName(bootstrap)}
        defaultImageUrl={bootstrap.user.avatarUrl ?? null}
      />
    )
  }

  return (
    <WorkspaceSetup
      defaultWebsite={getDefaultWorkspaceWebsite(bootstrap.user.email)}
    />
  )
}

function AccountSetup({
  defaultImageUrl,
  defaultName,
}: {
  defaultImageUrl: string | null
  defaultName: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initial = useMemo(() => splitAccountName(defaultName), [defaultName])
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [imageUrl, setImageUrl] = useState(defaultImageUrl)
  const [imageError, setImageError] = useState<string | null>(null)

  const profileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      return uploadOnboardingProfileImage({
        contentType: file.type,
        dataBase64: await readSquareImageAsBase64(file),
        fileName: file.name,
      })
    },
    onSuccess: ({ imageUrl: nextImageUrl }) => {
      setImageUrl(nextImageUrl)
      setImageError(null)
    },
    onError: (error) => {
      setImageError(getApiErrorMessage(error, "Profile image could not be uploaded."))
    },
  })

  const profileMutation = useMutation({
    mutationFn: completeAccountSetup,
    onSuccess: async (next) => {
      queryClient.setQueryData(queryKeys.me(), next)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })

  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")
  const displayNameError = getApiFieldError(profileMutation.error, "displayName")
  const pending = profileMutation.isPending || profileImageMutation.isPending

  return (
    <AuthFlowShell wide footer={<AuthFooterLinks showSignOut />}>
      <OnboardingSplitLayout>
        <form
          className="flex w-full min-w-0 flex-col items-center gap-6 bg-background px-6 pt-8 pb-10 sm:px-8"
          onSubmit={(event) => {
            event.preventDefault()
            if (!displayName || pending) return
            profileMutation.mutate({ displayName })
          }}
        >
          <h1 className="w-full text-center text-xl leading-7 font-medium">
            Let’s get your profile set up
          </h1>

          <FieldGroup className="gap-6">
            <Field className="gap-2" data-invalid={Boolean(displayNameError) || undefined}>
              <FieldLabel htmlFor="onboarding-first-name">First name</FieldLabel>
              <Input
                id="onboarding-first-name"
                maxLength={HANDOUT_TEXT_LIMITS.accountDisplayName}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                disabled={pending}
                aria-invalid={Boolean(displayNameError) || undefined}
                placeholder="John"
                required
              />
              {displayNameError ? <FieldError>{displayNameError}</FieldError> : null}
            </Field>

            <Field className="gap-2" data-invalid={Boolean(displayNameError) || undefined}>
              <FieldLabel htmlFor="onboarding-last-name">Last name</FieldLabel>
              <Input
                id="onboarding-last-name"
                maxLength={HANDOUT_TEXT_LIMITS.accountDisplayName}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                disabled={pending}
                aria-invalid={Boolean(displayNameError) || undefined}
                placeholder="Smith"
              />
            </Field>

            <Field className="gap-2.5" data-invalid={Boolean(imageError) || undefined}>
              <FieldLabel htmlFor="onboarding-profile-image">Profile image</FieldLabel>
              <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-popover py-2.5 pr-5 pl-2.5">
                <Avatar size="2xl" shape="square" className="border border-border bg-blue-background-subtle">
                  {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
                  <AvatarFallback className="bg-blue-background-subtle text-xl font-medium text-blue-foreground">
                    {firstName.trim().slice(0, 1).toUpperCase() || "A"}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 text-xs leading-4 text-muted-foreground">
                  1:1 square image, .png or .jpg<br />
                  512 x 512 recommended
                </p>
                <Input
                  ref={fileInputRef}
                  id="onboarding-profile-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) profileImageMutation.mutate(file)
                    event.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="compact"
                  disabled={pending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profileImageMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Upload
                </Button>
              </div>
              {imageError ? <FieldError>{imageError}</FieldError> : null}
            </Field>
          </FieldGroup>

          {profileMutation.isError && !displayNameError ? (
            <Alert variant="destructive">
              <AlertTitle>Profile was not saved</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(profileMutation.error, "Try again in a moment.")}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!displayName || pending}>
            {profileMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Continue
          </Button>
        </form>
      </OnboardingSplitLayout>
    </AuthFlowShell>
  )
}

function WorkspaceSetup({
  defaultWebsite,
}: {
  defaultWebsite: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [website, setWebsite] = useState(defaultWebsite)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const customLogoUrl = useMemo(
    () => logoFile ? URL.createObjectURL(logoFile) : null,
    [logoFile],
  )
  const websiteValidation = useMemo(() => normalizeWebsiteDomain(website), [website])

  useEffect(() => {
    return () => {
      if (customLogoUrl) URL.revokeObjectURL(customLogoUrl)
    }
  }, [customLogoUrl])

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
  const workspaceMutation = useMutation({
    mutationFn: async (input: { name: string; website: string }) => {
      const created = await createWorkspace(input)

      if (logoFile) {
        try {
          await uploadWorkspaceLogo(created.workspace.id, {
            contentType: logoFile.type,
            dataBase64: await readFileAsBase64(logoFile),
            fileName: logoFile.name,
          })
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Workspace created, but the logo could not be uploaded."))
        }
      }

      return created
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await navigate({ to: "/sites" })
    },
  })

  const nameError = getApiFieldError(workspaceMutation.error, "name")
  const websiteError = getApiFieldError(workspaceMutation.error, "website")
  const hasWebsiteError = Boolean(websiteError) || (website.length > 0 && !websiteValidation.ok)
  const canSubmit =
    name.trim().length > 0 &&
    websiteValidation.ok &&
    !workspaceMutation.isPending

  return (
    <AuthFlowShell wide footer={<AuthFooterLinks showSignOut />}>
      <OnboardingSplitLayout>
        <form
          className="flex w-full min-w-0 flex-col items-center gap-6 bg-background p-8"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSubmit || !websiteValidation.ok) return
            workspaceMutation.mutate({
              name: name.trim(),
              website: websiteValidation.domain,
            })
          }}
        >
          <h1 className="w-full text-center text-xl leading-7 font-medium">
            Now let’s set up your company
          </h1>

          <FieldGroup className="gap-6">
            <Field className="gap-2" data-invalid={hasWebsiteError || undefined}>
              <FieldLabel htmlFor="workspace-website">Website</FieldLabel>
              <Input
                id="workspace-website"
                maxLength={HANDOUT_TEXT_LIMITS.url}
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value)
                  if (workspaceMutation.isError) workspaceMutation.reset()
                }}
                autoComplete="url"
                inputMode="url"
                disabled={workspaceMutation.isPending}
                aria-invalid={hasWebsiteError || undefined}
                placeholder="acme.com"
                required
              />
              {websiteError ? <FieldError>{websiteError}</FieldError> : null}
              {!websiteError && website.length > 0 && !websiteValidation.ok ? (
                <FieldError>{websiteValidation.message}</FieldError>
              ) : null}
            </Field>

            <Field className="gap-2" data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="workspace-name">Company name</FieldLabel>
              <Input
                id="workspace-name"
                maxLength={HANDOUT_TEXT_LIMITS.workspaceName}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (workspaceMutation.isError) workspaceMutation.reset()
                }}
                autoComplete="organization"
                disabled={workspaceMutation.isPending}
                aria-invalid={Boolean(nameError) || undefined}
                placeholder="Acme"
                required
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>

            <Field className="gap-2.5">
              <FieldLabel htmlFor="workspace-logo">Profile logo</FieldLabel>
              <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-popover py-2.5 pr-5 pl-2.5">
                <Avatar
                  size="2xl"
                  shape="square"
                  className="border border-dashed border-border bg-secondary"
                >
                  {customLogoUrl || logoPreviewQuery.data?.imageUrl ? (
                    <AvatarImage
                      src={customLogoUrl ?? logoPreviewQuery.data?.imageUrl ?? undefined}
                      alt={`${name || "Company"} logo`}
                      className="object-contain"
                    />
                  ) : null}
                  <AvatarFallback className="bg-secondary text-muted-foreground">
                    {logoPreviewQuery.isFetching ? <Spinner /> : <IconPhoto aria-hidden="true" />}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 text-xs leading-4 text-muted-foreground">
                  1:1 square image, .png or .jpg<br />
                  512 x 512 recommended
                </p>
                <Input
                  ref={fileInputRef}
                  id="workspace-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={workspaceMutation.isPending}
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      try {
                        await validateSquareImageFile(file)
                        setLogoFile(file)
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Choose a PNG, JPG, or WebP image under 1 MB.",
                        )
                      }
                    }
                    event.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="compact"
                  disabled={workspaceMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload
                </Button>
              </div>
            </Field>
          </FieldGroup>

          {workspaceMutation.isError && !nameError && !websiteError ? (
            <Alert variant="destructive">
              <AlertTitle>Workspace was not created</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(workspaceMutation.error, "Try again in a moment.")}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            {workspaceMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Continue
          </Button>

          <p className="text-center text-sm leading-5 text-muted-foreground">
            Join an existing workspace{" "}
            <a href="/onboarding/join" className="underline">here</a>
          </p>
        </form>
      </OnboardingSplitLayout>
    </AuthFlowShell>
  )
}

function OnboardingSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 bg-card md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
      {children}
      <Separator orientation="vertical" className="hidden md:block" />
      <AuthArtwork />
    </div>
  )
}

function OnboardingStatus({
  action,
  description,
  title,
}: {
  action?: React.ReactNode
  description: string
  title: string
}) {
  return (
    <AuthFlowShell>
      <div className="flex w-full flex-col items-center gap-6 px-6 py-14 text-center sm:px-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-8 font-medium">{title}</h1>
          <p className="text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        {action ?? <Spinner />}
      </div>
    </AuthFlowShell>
  )
}
