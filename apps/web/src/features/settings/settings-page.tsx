import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconBuilding,
  IconCreditCard,
  IconLock,
  IconPhoto,
  IconRefresh,
  IconSettings,
  IconUser,
} from "@tabler/icons-react"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import type { SiteDefaults, SiteTrackingConsentPopup } from "@handout/site-document"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { LoadingState } from "@/components/common/loading-state"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { completeAccountSetup } from "@/features/app-bootstrap/api"
import { useActiveWorkspace, useAppBootstrap } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { authClient } from "@/features/auth/auth-client"
import { BillingSettingsTab } from "@/features/billing/billing-page"
import { ModePreview } from "@/features/site-settings/components/appearance-settings"
import { PrimaryColorPreview } from "@/features/site-settings/components/primary-color-preview"
import { getPrimaryColorPreviewStyles } from "@/features/site-settings/components/primary-color-preview-style"
import { PrimaryColorSelector } from "@/features/site-settings/components/primary-color-selector"
import {
  ConsentPopupPreview,
  ReplayAgreementDialog,
} from "@/features/site-settings/components/tracking-settings"
import { VariablesSettings } from "@/features/site-settings/components/variables-settings"
import { uploadWorkspaceLogo } from "@/features/workspaces/api"
import {
  createSiteVariableDefinition,
  modeOptions,
  trackingConsentOptions,
} from "@/features/site-settings/model"
import { getApiErrorMessage, getApiFieldError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"
import { readSquareImageAsBase64 } from "@/lib/image-upload"
import { cn } from "@/lib/utils"

import {
  checkEmailChange,
  getSiteDefaults,
  updateSiteDefaults,
  updateWorkspaceSettings,
  uploadProfileImage,
} from "./api"

const settingsTabs = ["workspace", "you", "site-defaults", "billing"] as const
type SettingsTab = (typeof settingsTabs)[number]

export function SettingsPage() {
  const initialTab = new URLSearchParams(window.location.search).get("tab")
  const [tab, setTab] = useState<SettingsTab>(
    settingsTabs.includes(initialTab as SettingsTab) ? initialTab as SettingsTab : "workspace",
  )

  useEffect(() => {
    const syncTab = () => {
      const next = new URLSearchParams(window.location.search).get("tab")
      setTab(settingsTabs.includes(next as SettingsTab) ? next as SettingsTab : "workspace")
    }
    window.addEventListener("popstate", syncTab)
    return () => window.removeEventListener("popstate", syncTab)
  }, [])

  const changeTab = (next: string) => {
    if (!settingsTabs.includes(next as SettingsTab)) return
    setTab(next as SettingsTab)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="min-h-full px-6 pt-5 pb-6">
      <div className="flex flex-col gap-1.5">
        <PageHeader title="Settings" />
        <Tabs value={tab} onValueChange={changeTab} className="min-w-0 gap-10">
          <TabsList
            variant="line"
            className="h-[42px]! w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-border-subtle p-0"
          >
            <SettingsTabTrigger value="workspace" icon={IconBuilding}>Workspace</SettingsTabTrigger>
            <SettingsTabTrigger value="you" icon={IconUser}>You</SettingsTabTrigger>
            <SettingsTabTrigger value="site-defaults" icon={IconSettings}>Site defaults</SettingsTabTrigger>
            <SettingsTabTrigger value="billing" icon={IconCreditCard}>Billing</SettingsTabTrigger>
          </TabsList>
          <TabsContent value="workspace" className="flex min-w-0 justify-center"><WorkspaceTab /></TabsContent>
          <TabsContent value="you" className="flex min-w-0 justify-center"><YouTab /></TabsContent>
          <TabsContent value="site-defaults" className="flex min-w-0 justify-center"><SiteDefaultsTab /></TabsContent>
          <TabsContent value="billing" className="flex min-w-0 justify-center"><BillingSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function SettingsTabTrigger({ children, icon: Icon, value }: { children: ReactNode; icon: typeof IconUser; value: SettingsTab }) {
  return (
    <TabsTrigger
      value={value}
      className="h-full flex-none gap-1.5 rounded-none px-1 py-1.5 after:bottom-[-1px]! after:h-px!"
    >
      <Icon data-icon="inline-start" />
      {children}
    </TabsTrigger>
  )
}

function WorkspaceTab() {
  const workspace = useActiveWorkspace()
  return <WorkspaceTabForm key={workspace.id} workspace={workspace} />
}

function WorkspaceTabForm({ workspace }: { workspace: ReturnType<typeof useActiveWorkspace> }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(workspace.name)
  const [website, setWebsite] = useState(workspace.websiteDomain)
  const isAdmin = workspace.role === "admin"

  const save = useMutation({
    mutationFn: (input: { name: string; website: string }) => updateWorkspaceSettings(workspace.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Workspace settings could not be saved.")),
  })
  const upload = useMutation({
    mutationFn: async (file: File) => uploadWorkspaceLogo(workspace.id, {
      contentType: file.type,
      dataBase64: await readSquareImageAsBase64(file),
      fileName: file.name,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      toast.success("Workspace logo updated.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Logo could not be uploaded.")),
  })

  const saveDetails = () => {
    const next = { name: name.trim(), website: website.trim() }
    if (!isAdmin || !next.name || !next.website || save.isPending) return
    if (next.name === workspace.name && next.website === workspace.websiteDomain) return
    save.mutate(next)
  }

  return (
    <SettingsSurface className="gap-7">
      <SettingsSectionHeader title="Workspace" description="Your workspace details">
        {!isAdmin ? (
          <Alert className="flex h-[30px] items-center gap-2 rounded-md border-0 bg-secondary px-3 py-0 text-tertiary-foreground shadow-none [&>svg]:translate-y-0!">
            <IconLock className="size-3.5 shrink-0" />
            <AlertDescription className="leading-5 text-tertiary-foreground">Only admin users can edit workspace</AlertDescription>
          </Alert>
        ) : null}
      </SettingsSectionHeader>

      <div
        className={cn("flex flex-col gap-7", !isAdmin && "pointer-events-none opacity-50")}
        aria-disabled={!isAdmin || undefined}
      >
        <FieldSet disabled={!isAdmin} className="gap-7">
          <Field className="gap-2">
            <FieldLabel htmlFor="workspace-name">Company name</FieldLabel>
            <Input
              id="workspace-name"
              maxLength={HANDOUT_TEXT_LIMITS.workspaceName}
              value={name}
              onBlur={saveDetails}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="workspace-website">Website</FieldLabel>
            <Input
              id="workspace-website"
              inputMode="url"
              maxLength={HANDOUT_TEXT_LIMITS.url}
              value={website}
              onBlur={saveDetails}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </Field>
        </FieldSet>

        <ImageUploadField
          alt={`${workspace.name} logo`}
          disabled={!isAdmin}
          imageUrl={workspace.logoUrl}
          label="Logo"
          pending={upload.isPending}
          onFile={(file) => upload.mutate(file)}
        >
          {isAdmin ? (
            <Alert className="flex h-[30px] items-center gap-2 rounded-md border-0 bg-secondary px-3 py-0 text-tertiary-foreground shadow-none [&>svg]:translate-y-0!">
              <IconAlertTriangle className="size-3.5 shrink-0" />
              <AlertDescription className="leading-5 text-tertiary-foreground">
                Changing this will change your logo on published sites.
              </AlertDescription>
            </Alert>
          ) : null}
        </ImageUploadField>
      </div>
    </SettingsSurface>
  )
}

function YouTab() {
  const bootstrap = useAppBootstrap()
  const queryClient = useQueryClient()
  const initial = useMemo(() => splitDisplayName(bootstrap.user.name ?? ""), [bootstrap.user.name])
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [emailOpen, setEmailOpen] = useState(false)
  const displayName = joinDisplayName(firstName, lastName)
  const mutation = useMutation({
    mutationFn: completeAccountSetup,
    onSuccess: async (next) => {
      queryClient.setQueryData(queryKeys.me(), next)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })
  const fieldError = getApiFieldError(mutation.error, "displayName")
  const profileImage = useMutation({
    mutationFn: async (file: File) => uploadProfileImage({
      contentType: file.type,
      dataBase64: await readSquareImageAsBase64(file),
      fileName: file.name,
    }),
    onSuccess: ({ imageUrl }) => {
      queryClient.setQueryData(queryKeys.me(), (current: typeof bootstrap | undefined) => current
        ? { ...current, user: { ...current.user, avatarUrl: imageUrl } }
        : current)
      toast.success("Profile image updated.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Profile image could not be uploaded.")),
  })
  const saveProfile = () => {
    if (!displayName || mutation.isPending || displayName === (bootstrap.user.name ?? "")) return
    mutation.mutate({ displayName })
  }

  return (
    <SettingsSurface className="gap-7">
      <SettingsSectionHeader title="You" description="Your profile and account" />
      <FieldSet>
        <FieldGroup className="gap-7">
          <div className="grid grid-cols-2 gap-3">
            <Field className="gap-2" data-invalid={Boolean(fieldError) || undefined}>
              <FieldLabel htmlFor="first-name">First name</FieldLabel>
              <Input id="first-name" autoComplete="given-name" value={firstName} onBlur={saveProfile} onChange={(event) => setFirstName(event.target.value)} />
              {fieldError ? <FieldError>{fieldError}</FieldError> : null}
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="last-name">Last name</FieldLabel>
              <Input id="last-name" autoComplete="family-name" value={lastName} onBlur={saveProfile} onChange={(event) => setLastName(event.target.value)} />
            </Field>
          </div>
          <ImageUploadField
            alt={`${displayName || "Your"} profile image`}
            imageUrl={bootstrap.user.avatarUrl}
            label="Profile image"
            pending={profileImage.isPending}
            onFile={(file) => profileImage.mutate(file)}
          />
          <Field className="gap-2">
            <FieldLabel htmlFor="account-email">Email address</FieldLabel>
            <div className="flex gap-2">
              <Input id="account-email" value={bootstrap.user.email} disabled />
              <Button variant="outline" onClick={() => setEmailOpen(true)}>Edit email</Button>
            </div>
            <FieldDescription>Your email is used to sign in and receive account messages.</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
      <EmailChangeDialog currentEmail={bootstrap.user.email} open={emailOpen} onOpenChange={setEmailOpen} />
    </SettingsSurface>
  )
}

function EmailChangeDialog({ currentEmail, open, onOpenChange }: { currentEmail: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const reset = () => { setStep("email"); setEmail(""); setCode(""); setError(""); setPending(false) }
  const requestCode = async () => {
    setPending(true); setError("")
    try {
      await checkEmailChange(email)
      const result = await authClient.emailOtp.requestEmailChange({ newEmail: email })
      if (result.error) throw new Error(result.error.message)
      setStep("code")
    } catch (caught) {
      setError(getApiErrorMessage(caught, caught instanceof Error ? caught.message : "Email could not be changed."))
    } finally {
      setPending(false)
    }
  }
  const confirm = async () => {
    setPending(true); setError("")
    const result = await authClient.emailOtp.changeEmail({ newEmail: email, otp: code })
    if (result.error) { setError(result.error.message ?? "That code is invalid or expired."); setPending(false); return }
    await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    toast.success("Email address changed.")
    onOpenChange(false); reset()
  }
  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "email" ? "Change email address" : "Confirm your new email"}</DialogTitle>
          <DialogDescription>
            {step === "email"
              ? `Your current email is ${currentEmail}.`
              : `Enter the 6-digit code sent to ${email}. Your email will not change until the code is confirmed.`}
          </DialogDescription>
        </DialogHeader>
        {step === "email" ? (
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="new-email">New email address</FieldLabel>
            <Input id="new-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError("") }} />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        ) : (
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel>Verification code</FieldLabel>
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
            </InputOTP>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={pending || (step === "email" ? !email || email.toLowerCase() === currentEmail.toLowerCase() : code.length !== 6)}
            onClick={step === "email" ? requestCode : confirm}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {step === "email" ? "Send code" : "Confirm email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SiteDefaultsTab() {
  const query = useQuery({
    queryKey: queryKeys.siteDefaults(),
    queryFn: ({ signal }) => getSiteDefaults(signal),
  })

  if (query.isLoading) return <SiteDefaultsLoadingState />
  if (query.isError || !query.data) {
    return (
      <SettingsSurface>
        <Alert variant="destructive">
          <AlertTitle>Site defaults could not be loaded</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(query.error, "Refresh and try again.")}
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="compact" onClick={() => void query.refetch()}>
              <IconRefresh data-icon="inline-start" />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </SettingsSurface>
    )
  }

  return <SiteDefaultsForm initialDefaults={query.data.defaults} />
}

function SiteDefaultsForm({ initialDefaults }: { initialDefaults: SiteDefaults }) {
  const workspace = useActiveWorkspace()
  const [replayAgreementOpen, setReplayAgreementOpen] = useState(false)
  const { draft, error: saveError, retry, status, update } = useSiteDefaultsAutosave(initialDefaults)
  const selectedConsent = trackingConsentOptions.find(
    (option) => option.value === draft.trackingConsentPopup,
  ) ?? trackingConsentOptions[0]

  return (
    <SettingsSurface className="gap-9">
      <SettingsSectionHeader
        title="Default site settings"
        description="Settings used for all new sites created (does not affect existing sites)."
        action={status === "saving" ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Spinner />
            Saving…
          </span>
        ) : null}
      />

      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>Changes were not saved</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(saveError, "Check your connection and try again.")}
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="compact" onClick={retry}>
              <IconRefresh data-icon="inline-start" />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <Field className="gap-3">
        <div>
          <FieldTitle>Mode</FieldTitle>
          <FieldDescription className="text-sm leading-5">The color mode your site uses for visitors</FieldDescription>
        </div>
        <ToggleGroup
          aria-label="Default site appearance mode"
          className="grid h-[280px] w-full grid-rows-3 gap-1.5"
          orientation="vertical"
          type="single"
          value={draft.themeMode}
          variant="outline"
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              update((current) => ({ ...current, themeMode: value }))
            }
          }}
        >
          {modeOptions.map((option) => (
            <ToggleGroupItem
              key={option.value}
              aria-label={`${option.label}: ${option.description}`}
              className="h-full w-full justify-start gap-4 overflow-hidden rounded-xl border-border bg-transparent py-1.5 pr-4 pl-1.5 text-left transition-opacity data-[state=off]:opacity-80 data-[state=off]:hover:opacity-100 data-[state=on]:border-purple-foreground data-[state=on]:bg-transparent hover:bg-transparent"
              value={option.value}
            >
              <ModePreview mode={option.value} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 font-medium text-foreground">{option.label}</span>
                <span className="block text-sm leading-5 font-normal text-muted-foreground">{option.description}</span>
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Separator className="bg-neutral-alpha-a400" />

      <Field className="gap-3">
        <div>
          <FieldTitle>Primary color</FieldTitle>
          <FieldDescription className="text-sm leading-5">The color used for primary buttons and other elements</FieldDescription>
        </div>
        <PrimaryColorSelector
          ariaLabel="Default primary color"
          customColor={draft.customPrimaryColor}
          primaryColor={draft.primaryColor}
          onCustomColorChange={(customPrimaryColor) => {
            update((current) => ({ ...current, customPrimaryColor }))
          }}
          onPresetColorChange={(primaryColor) => {
            update((current) => {
              const next = { ...current, primaryColor }
              delete next.customPrimaryColor
              return next
            })
          }}
        />
        <PrimaryColorPreview
          mode="split"
          styles={getPrimaryColorPreviewStyles(
            draft.primaryColor,
            draft.customPrimaryColor,
          )}
        />
      </Field>

      <Separator className="bg-neutral-alpha-a400" />

      <section className="flex flex-col gap-3">
        <SectionTitle title="Tracking" description="Track sessions and visitor actions" />
        <Card className="gap-0 overflow-hidden rounded-xl bg-card py-0 ring-1 ring-border-subtle">
          <SettingSwitch
            title="Activity tracking"
            description="Track visitor actions on the site"
            checked={draft.trackingEnabled}
            onCheckedChange={(trackingEnabled) => update((current) => ({
              ...current,
              trackingEnabled,
              ...(!trackingEnabled
                ? { recordingEnabled: false, recordingDisclosureAccepted: false }
                : {}),
            }))}
          />
          <SettingSwitch
            className="border-t border-border-subtle"
            title="Session replay"
            description="Watch how visitors use the site"
            badge={workspace.plan !== "pro" ? <Badge className="bg-blue-background text-blue-foreground" variant="secondary"><IconLock data-icon="inline-start" />Upgrade</Badge> : null}
            checked={draft.recordingEnabled}
            disabled={workspace.plan !== "pro" && !draft.recordingEnabled}
            onCheckedChange={(recordingEnabled) => {
              if (!recordingEnabled) {
                update((current) => ({
                  ...current,
                  recordingEnabled: false,
                  recordingDisclosureAccepted: false,
                }))
                return
              }
              setReplayAgreementOpen(true)
            }}
          />
        </Card>
      </section>

      <Separator className="bg-neutral-alpha-a400" />

      <Field className="gap-3">
        <div>
          <FieldTitle>Tracking consent popup</FieldTitle>
          <FieldDescription className="text-sm leading-5">Ask visitor tracking consent before they enter the site.</FieldDescription>
        </div>
        <Select
          value={draft.trackingConsentPopup}
          onValueChange={(value) => update((current) => ({
            ...current,
            trackingConsentPopup: value as SiteTrackingConsentPopup,
          }))}
        >
          <SelectTrigger aria-label="Tracking consent popup" className="h-[60px]! w-full rounded-[12px] px-3 py-0!">
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="text-sm leading-5 font-medium text-foreground">{selectedConsent.label}</span>
              <span className="line-clamp-2 text-xs leading-4 whitespace-normal text-muted-foreground">{selectedConsent.description}</span>
            </span>
          </SelectTrigger>
          <SelectContent align="end" className="w-[336px]" position="popper">
            <SelectGroup>
              {trackingConsentOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  className="py-2"
                  disabled={draft.recordingEnabled && option.value === "none"}
                  value={option.value}
                >
                  <span className="flex flex-col items-start">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {draft.trackingConsentPopup === "none" ? null : (
          <ConsentPopupPreview variant={draft.trackingConsentPopup} />
        )}
      </Field>

      <Separator className="bg-neutral-alpha-a400" />

      <VariablesSettings
        scope="site-defaults"
        variables={draft.variables}
        usageCounts={{}}
        onCreate={(input) => {
          update((current) => ({
            ...current,
            variables: [
              ...current.variables,
              createSiteVariableDefinition(input, current.variables),
            ],
          }))
        }}
        onEdit={(id, input) => update((current) => ({
          ...current,
          variables: current.variables.map((variable) =>
            variable.id === id ? { ...variable, ...input } : variable,
          ),
        }))}
        onDelete={(id) => update((current) => ({
          ...current,
          variables: current.variables.filter((variable) => variable.id !== id),
        }))}
      />

      <ReplayAgreementDialog
        open={replayAgreementOpen}
        onOpenChange={setReplayAgreementOpen}
        onAgree={() => {
          update((current) => ({
            ...current,
            recordingEnabled: true,
            recordingDisclosureAccepted: true,
            trackingConsentPopup:
              current.trackingConsentPopup === "none"
                ? "popup-a"
                : current.trackingConsentPopup,
            trackingEnabled: true,
          }))
          setReplayAgreementOpen(false)
        }}
      />
    </SettingsSurface>
  )
}

function SiteDefaultsLoadingState() {
  return (
    <SettingsSurface>
      <LoadingState placement="page" label="Loading site defaults" />
    </SettingsSurface>
  )
}

type SiteDefaultsSaveStatus = "idle" | "saving" | "saved" | "error"

function useSiteDefaultsAutosave(initialDefaults: SiteDefaults) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(initialDefaults)
  const [error, setError] = useState<unknown>(null)
  const [status, setStatus] = useState<SiteDefaultsSaveStatus>("idle")
  const desiredRef = useRef(initialDefaults)
  const confirmedRef = useRef(JSON.stringify(initialDefaults))
  const workerRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

  const runWorker = useCallback(async () => {
    while (JSON.stringify(desiredRef.current) !== confirmedRef.current) {
      const requested = desiredRef.current
      const requestedSerialized = JSON.stringify(requested)

      try {
        const response = await updateSiteDefaults(requested)
        const confirmedSerialized = JSON.stringify(response.defaults)
        confirmedRef.current = confirmedSerialized
        queryClient.setQueryData(queryKeys.siteDefaults(), response)

        if (
          JSON.stringify(desiredRef.current) === requestedSerialized &&
          confirmedSerialized !== requestedSerialized
        ) {
          desiredRef.current = response.defaults
          if (mountedRef.current) setDraft(response.defaults)
        }
      } catch (caught) {
        if (JSON.stringify(desiredRef.current) !== requestedSerialized) {
          continue
        }

        if (mountedRef.current) {
          setError(caught)
          setStatus("error")
        }
        return
      }
    }

    if (mountedRef.current) {
      setError(null)
      setStatus("saved")
    }
  }, [queryClient])

  const startWorker = useCallback(() => {
    if (workerRef.current) return
    const worker = runWorker()
    workerRef.current = worker
    void worker.finally(() => {
      workerRef.current = null
    })
  }, [runWorker])

  const update = useCallback((updater: (current: SiteDefaults) => SiteDefaults) => {
    const next = updater(desiredRef.current)
    desiredRef.current = next
    setDraft(next)
    setError(null)
    setStatus("saving")
    startWorker()
  }, [startWorker])

  const retry = useCallback(() => {
    setError(null)
    setStatus("saving")
    startWorker()
  }, [startWorker])

  return { draft, error, retry, status, update }
}

function ImageUploadField({
  alt,
  children,
  disabled = false,
  imageUrl,
  label,
  onFile,
  pending,
}: {
  alt: string
  children?: ReactNode
  disabled?: boolean
  imageUrl?: string | null
  label: string
  onFile: (file: File) => void
  pending: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <Field className="gap-2" data-disabled={disabled || undefined}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-3">
        <div className="flex h-[88px] items-center gap-4 rounded-[16px] border bg-popover py-3 pr-5 pl-3">
          <div
            className={cn(
              "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border bg-secondary text-muted-foreground",
              !imageUrl && "border-dashed",
            )}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={alt} className="size-full object-cover" />
            ) : (
              <IconPhoto className="size-5" />
            )}
          </div>
          <FieldDescription className="min-w-0 flex-1 text-tertiary-foreground">
            1:1 square aspect ratio. PNG, JPG or WEBP. 1MB maximum.
          </FieldDescription>
          <input
            ref={input}
            aria-label={`Choose ${label.toLowerCase()}`}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || pending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFile(file)
              event.target.value = ""
            }}
          />
          <Button
            variant="outline"
            size="compact"
            disabled={disabled || pending}
            onClick={() => input.current?.click()}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Upload
          </Button>
        </div>
        {children}
      </div>
    </Field>
  )
}

function SettingsSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] p-4", className)}>
      {children}
    </div>
  )
}

function SettingsSectionHeader({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode
  children?: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-6 font-medium text-foreground">{title}</h2>
          <p className="text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
      <Separator className="bg-neutral-alpha-a400" />
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-sm leading-5 font-medium">{title}</h2><p className="text-sm leading-5 text-muted-foreground">{description}</p></div>
}

function SettingSwitch({ badge, checked, className, description, disabled, onCheckedChange, title }: { badge?: ReactNode; checked: boolean; className?: string; description: string; disabled?: boolean; onCheckedChange: (checked: boolean) => void; title: string }) {
  return (
    <Field className={cn("h-16 items-center gap-2.5 px-4 py-3", className)} data-disabled={disabled || undefined} orientation="horizontal">
      <Switch aria-label={title} checked={checked} disabled={disabled} size="compact" onCheckedChange={onCheckedChange} />
      <FieldContent className={disabled ? "opacity-60" : undefined}>
        <div className="flex items-center gap-2"><FieldTitle>{title}</FieldTitle>{badge}</div>
        <FieldDescription className="text-sm leading-5">{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

function splitDisplayName(displayName: string) {
  const [firstName = "", ...rest] = displayName.trim().split(/\s+/).filter(Boolean)
  return { firstName, lastName: rest.join(" ") }
}

function joinDisplayName(firstName: string, lastName: string) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ")
}
