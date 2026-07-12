import { useEffect, useId, useMemo, useRef, useState } from "react"
import type {
  AppBootstrapResponse,
  ListSiteVariantsResponse,
  ListSitesResponse,
  SiteContentResponse,
  SiteListItem,
  SiteVariableDefinition,
  SiteVariant,
} from "@lightsite/contracts"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconLink,
  IconLogout,
  IconMailFast,
  IconPhotoOff,
  IconRefresh,
  IconSearch,
  IconUserPlus,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  EXTENSION_PROTOCOL_VERSION,
  isGmailHostMessage,
  type BackgroundRequest,
  type BackgroundResponse,
  type ComposeContext,
  type ExtensionPanelMessage,
} from "./contracts"
import {
  buildRecipientPublicUrl,
  buildRecipientScreenshotUrl,
  cleanRecipientDisplayName,
  createEmailCard,
  createEmailLink,
  createRecipientVariant,
  filterRecipients,
  filterSites,
  getCustomVariables,
  getVariableDefaultValue,
  inferRecipientDraft,
  type RecipientDraft,
} from "./model"

const PUBLIC_ORIGIN = (import.meta.env.VITE_EXTENSION_PUBLIC_ORIGIN || "https://lightsite.io").replace(/\/$/, "")
const PREVIEW_ORIGIN = (import.meta.env.VITE_EXTENSION_PREVIEW_ORIGIN || PUBLIC_ORIGIN).replace(/\/$/, "")
type Step = "sites" | "recipient" | "share"
type AuthState = "checking" | "connected" | "disconnected"

export function GmailExtensionPanel() {
  const [context, setContext] = useState<ComposeContext | null>(null)
  const [authState, setAuthState] = useState<AuthState>("checking")
  const [bootstrap, setBootstrap] = useState<AppBootstrapResponse | null>(null)
  const [sites, setSites] = useState<SiteListItem[]>([])
  const [step, setStep] = useState<Step>("sites")
  const [selectedSite, setSelectedSite] = useState<SiteListItem | null>(null)
  const [variables, setVariables] = useState<SiteVariableDefinition[]>([])
  const [recipients, setRecipients] = useState<SiteVariant[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<SiteVariant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortVersion = useRef(0)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://mail.google.com" || !isGmailHostMessage(event.data)) return
      if (event.data.type === "compose-context") setContext(event.data.context)
    }
    window.addEventListener("message", onMessage)
    postToHost({
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
      source: "lightsite-extension-panel",
      type: "panel-ready",
    })
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    void initialize()
    async function initialize() {
      const session = await sendBackground<{ connected: boolean }>({ type: "session" })
      if (!session.ok || !session.data.connected) {
        setAuthState("disconnected")
        return
      }
      await loadWorkspace()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      if (step === "share") setStep("recipient")
      else if (step === "recipient") setStep("sites")
      else closePanel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [step])

  const loadWorkspace = async () => {
    setAuthState("checking")
    setError(null)
    const [bootstrapResponse, sitesResponse] = await Promise.all([
      api<AppBootstrapResponse>("/api/me"),
      api<ListSitesResponse>("/api/sites"),
    ])
    if (!bootstrapResponse.ok) {
      if (bootstrapResponse.error.status === 401) setAuthState("disconnected")
      else {
        setAuthState("connected")
        setError(bootstrapResponse.error.message)
      }
      return
    }
    if (!sitesResponse.ok) {
      if (sitesResponse.error.status === 401) setAuthState("disconnected")
      else {
        setAuthState("connected")
        setError(sitesResponse.error.message)
      }
      return
    }
    setBootstrap(bootstrapResponse.data)
    setSites(sitesResponse.data.sites)
    setAuthState("connected")
  }

  const selectSite = async (site: SiteListItem) => {
    if (site.status !== "published") return
    const version = ++abortVersion.current
    setSelectedSite(site)
    setSelectedRecipient(null)
    setLoading(true)
    setError(null)
    setStep("recipient")
    const [contentResponse, variantsResponse] = await Promise.all([
      api<SiteContentResponse>(`/api/sites/${encodeURIComponent(site.id)}/content`),
      api<ListSiteVariantsResponse>(`/api/sites/${encodeURIComponent(site.id)}/variants`),
    ])
    if (version !== abortVersion.current) return
    setLoading(false)
    if (!contentResponse.ok) {
      setError(contentResponse.error.message)
      return
    }
    if (!variantsResponse.ok) {
      setError(variantsResponse.error.message)
      return
    }
    setVariables(contentResponse.data.draftContent.variables)
    setRecipients(variantsResponse.data.variants)
  }

  const refreshRecipients = async (siteId: string) => {
    const response = await api<ListSiteVariantsResponse>(
      `/api/sites/${encodeURIComponent(siteId)}/variants`,
    )
    if (!response.ok) {
      setError(response.error.message)
      return
    }
    setRecipients(response.data.variants)
    setSites((currentSites) => currentSites.map((site) => (
      site.id === siteId
        ? { ...site, recipientCount: response.data.variants.length }
        : site
    )))
  }

  const signOut = async () => {
    await sendBackground({ type: "sign-out" })
    setBootstrap(null)
    setSites([])
    setAuthState("disconnected")
  }

  const workspace = bootstrap?.activeWorkspace ?? null

  return (
    <main className="flex h-svh min-h-0 flex-col overflow-hidden rounded-[inherit] bg-popover text-popover-foreground">
      <PanelHeader
        canGoBack={authState === "connected" && step !== "sites"}
        onBack={() => setStep(step === "share" ? "recipient" : "sites")}
        onClose={closePanel}
        onSignOut={authState === "connected" ? signOut : undefined}
      />
      {authState === "checking" ? <PanelLoading /> : null}
      {authState === "disconnected" ? <ConnectLightsite onConnected={() => void loadWorkspace()} /> : null}
      {authState === "connected" && error && step === "sites" ? (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Lightsite could not load</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => void loadWorkspace()}>Try again</Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {authState === "connected" && !error && step === "sites" ? (
        <SitePicker sites={sites} workspaceName={workspace?.name ?? "Lightsite"} onSelect={selectSite} />
      ) : null}
      {authState === "connected" && step === "recipient" && selectedSite ? (
        <RecipientPicker
          context={context}
          error={error}
          loading={loading}
          recipients={recipients}
          site={selectedSite}
          variables={variables}
          onRefreshRecipients={() => refreshRecipients(selectedSite.id)}
          onCreated={(recipient) => {
            setRecipients((current) => [recipient, ...current.filter((item) => item.id !== recipient.id)])
            setSites((currentSites) => currentSites.map((site) => (
              site.id === selectedSite.id
                ? { ...site, recipientCount: site.recipientCount + 1 }
                : site
            )))
            void refreshRecipients(selectedSite.id)
            setSelectedRecipient(recipient)
            setStep("share")
          }}
          onSelect={(recipient) => {
            setSelectedRecipient(recipient)
            setStep("share")
          }}
        />
      ) : null}
      {authState === "connected" && step === "share" && selectedSite && selectedRecipient && workspace ? (
        <ShareComplete
          composeId={context?.composeId ?? null}
          recipient={selectedRecipient}
          site={selectedSite}
          workspaceSlug={workspace.slug}
        />
      ) : null}
    </main>
  )
}

function PanelHeader({
  canGoBack,
  onBack,
  onClose,
  onSignOut,
}: {
  canGoBack: boolean
  onBack: () => void
  onClose: () => void
  onSignOut?: () => void
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      {canGoBack ? (
        <Button aria-label="Back" size="icon-field" variant="ghost" onClick={onBack}><IconArrowLeft /></Button>
      ) : (
        <img alt="Lightsite" className="h-[17px] w-[83px] dark:invert" src="/lightsite-logo.svg" />
      )}
      <div className="min-w-0 flex-1" />
      {onSignOut ? (
        <Button aria-label="Sign out" size="icon-field" variant="ghost" onClick={onSignOut}><IconLogout /></Button>
      ) : null}
      <Button aria-label="Close" size="icon-field" variant="ghost" onClick={onClose}><IconX /></Button>
    </header>
  )
}

function ConnectLightsite({ onConnected }: { onConnected: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const connect = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const response = await sendBackground({ type: "connect" })
    setSubmitting(false)
    if (!response.ok) setError(response.error.message)
    else onConnected()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center p-6">
      <div className="mb-6 flex flex-col gap-1 text-center">
        <h1 className="text-lg font-semibold">Connect Lightsite</h1>
        <p className="text-sm text-muted-foreground">
          Continue in Lightsite, then come straight back to this email.
        </p>
      </div>
      <FieldGroup>
        {error ? (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        ) : null}
        <Button disabled={submitting} type="button" onClick={() => void connect()}>
          {submitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <IconExternalLink data-icon="inline-start" />
          )}
          Continue with Lightsite
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Uses your existing Lightsite session. No password is shared with Gmail.
        </p>
      </FieldGroup>
    </div>
  )
}

function SitePicker({ sites, workspaceName, onSelect }: {
  sites: SiteListItem[]
  workspaceName: string
  onSelect: (site: SiteListItem) => void
}) {
  const [query, setQuery] = useState("")
  const results = useMemo(() => filterSites(sites, query), [query, sites])
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
        <h1 className="text-base font-semibold">Choose a site</h1>
        <p className="text-xs text-muted-foreground">{workspaceName}</p>
      </div>
      <SearchInput autoFocus placeholder="Search sites" query={query} onQueryChange={setQuery} />
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        {results.length ? (
          <div className="flex flex-col gap-1 px-1">
            {results.map((site) => (
              <button
                key={site.id}
                className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55"
                disabled={site.status !== "published"}
                type="button"
                onClick={() => onSelect(site)}
              >
                <Avatar shape="square" size="sm"><AvatarFallback>{site.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{site.name}</span>
                  <span className="block text-xs text-muted-foreground">{site.recipientCount} recipients</span>
                </span>
                <Badge variant={site.status === "published" ? "secondary" : "outline"}>{site.status}</Badge>
              </button>
            ))}
          </div>
        ) : (
          <Empty className="py-14"><EmptyHeader><EmptyTitle>No sites found</EmptyTitle><EmptyDescription>Try another search.</EmptyDescription></EmptyHeader></Empty>
        )}
      </ScrollArea>
    </section>
  )
}

function RecipientPicker({ context, error, loading, recipients, site, variables, onCreated, onRefreshRecipients, onSelect }: {
  context: ComposeContext | null
  error: string | null
  loading: boolean
  recipients: SiteVariant[]
  site: SiteListItem
  variables: SiteVariableDefinition[]
  onCreated: (recipient: SiteVariant) => void
  onRefreshRecipients: () => Promise<void>
  onSelect: (recipient: SiteVariant) => void
}) {
  const [activeTab, setActiveTab] = useState("new")

  if (loading) return <PanelLoading label="Loading recipients" />
  if (error) return <div className="p-4"><Alert variant="destructive"><AlertTitle>Site could not load</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-2"><h1 className="truncate text-base font-semibold">{site.name}</h1></div>
      <Tabs
        className="min-h-0 flex-1 gap-0"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value)
          if (value === "past") void onRefreshRecipients()
        }}
      >
        <TabsList className="mx-4 mb-3" variant="line">
          <TabsTrigger value="new"><IconUserPlus data-icon="inline-start" />New recipient</TabsTrigger>
          <TabsTrigger value="past"><IconUsersGroup data-icon="inline-start" />Past recipients</TabsTrigger>
        </TabsList>
        <TabsContent className="min-h-0" value="new">
          <NewRecipientForm context={context} recipients={recipients} site={site} variables={variables} onCreated={onCreated} />
        </TabsContent>
        <TabsContent className="min-h-0" value="past">
          <PastRecipients recipients={recipients} onSelect={onSelect} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function NewRecipientForm({ context, recipients, site, variables, onCreated }: {
  context: ComposeContext | null
  recipients: SiteVariant[]
  site: SiteListItem
  variables: SiteVariableDefinition[]
  onCreated: (recipient: SiteVariant) => void
}) {
  const initialDraft = useMemo(() => inferRecipientDraft(context?.recipient ?? null), [context?.recipient])
  const [draft, setDraft] = useState<RecipientDraft>(initialDraft)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const companyId = useId()
  const websiteId = useId()
  const customVariables = getCustomVariables(variables)
  const canCreate = Boolean(draft.name.trim() && draft.company.trim() && !submitting)

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canCreate) return
    setSubmitting(true)
    setError(null)
    const variant = createRecipientVariant({ draft, existingRecipients: recipients, variables })
    const response = await api<{ variants: SiteVariant[] }>(`/api/sites/${encodeURIComponent(site.id)}/variants/batch`, {
      method: "POST",
      body: { matchBy: "id", variants: [variant] },
    })
    setSubmitting(false)
    if (!response.ok) {
      setError(response.error.message)
      return
    }
    const created = response.data.variants[0]
    if (!created) {
      setError("Lightsite did not return the new recipient. Try again.")
      return
    }
    onCreated(created)
  }

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={create}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 pt-1">
          {context?.recipient ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <IconMailFast className="size-4 shrink-0" />
              <span className="truncate">From {context.recipient.email}</span>
            </div>
          ) : null}
          <FieldGroup className="gap-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Field><FieldLabel htmlFor={nameId}>Name</FieldLabel><Input autoFocus id={nameId} maxLength={LIGHTSITE_TEXT_LIMITS.recipientName} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
              <Field><FieldLabel htmlFor={companyId}>Company</FieldLabel><Input id={companyId} maxLength={LIGHTSITE_TEXT_LIMITS.recipientCompany} value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></Field>
            </div>
            <Field><FieldLabel htmlFor={websiteId}>Website</FieldLabel><Input id={websiteId} inputMode="url" placeholder="example.com" value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} /></Field>
            {customVariables.map((variable) => (
              <Field key={variable.id}>
                <FieldLabel htmlFor={`${websiteId}-${variable.id}`}>{variable.label}</FieldLabel>
                <Input id={`${websiteId}-${variable.id}`} placeholder={getVariableDefaultValue(variable) || "Enter value"} value={draft.values[variable.id] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, values: { ...current.values, [variable.id]: event.target.value } }))} />
              </Field>
            ))}
            {error ? <Field data-invalid><FieldError>{error}</FieldError></Field> : null}
          </FieldGroup>
        </div>
      </ScrollArea>
      <div className="border-t border-border p-3"><Button className="w-full" disabled={!canCreate} type="submit">{submitting ? <Spinner data-icon="inline-start" /> : null}Create link</Button></div>
    </form>
  )
}

function PastRecipients({ recipients, onSelect }: { recipients: SiteVariant[]; onSelect: (recipient: SiteVariant) => void }) {
  const [query, setQuery] = useState("")
  const results = useMemo(() => filterRecipients(recipients, query), [query, recipients])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SearchInput placeholder="Search recipients" query={query} onQueryChange={setQuery} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 pb-3">
          {results.length ? results.map((recipient) => (
            <button key={recipient.id} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" type="button" onClick={() => onSelect(recipient)}>
              <Avatar shape="square" size="xs"><AvatarFallback>{(recipient.recipientName || "R").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{recipient.recipientName || "Recipient"} <span className="text-muted-foreground">@</span> {recipient.recipientCompany || "Company"}</span>
            </button>
          )) : (
            <Empty className="py-12"><EmptyHeader><EmptyTitle>No recipients found</EmptyTitle><EmptyDescription>{recipients.length ? "Try another search." : "Create the first recipient for this site."}</EmptyDescription></EmptyHeader></Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ShareComplete({ composeId, recipient, site, workspaceSlug }: {
  composeId: string | null
  recipient: SiteVariant
  site: SiteListItem
  workspaceSlug: string
}) {
  const [inserting, setInserting] = useState<"card" | "link" | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recipientName = cleanRecipientDisplayName(recipient.recipientName || "") || "Recipient"
  const company = recipient.recipientCompany || "Company"
  const url = buildRecipientPublicUrl({ publicOrigin: PUBLIC_ORIGIN, recipient, siteSlug: site.slug, workspaceSlug })
  const screenshotUrl = buildRecipientScreenshotUrl({
    publicOrigin: PUBLIC_ORIGIN,
    recipient,
    siteSlug: site.slug,
    siteVersion: site.publishedAt,
    workspaceSlug,
  })
  const previewScreenshotUrl = buildRecipientScreenshotUrl({
    publicOrigin: PREVIEW_ORIGIN,
    recipient,
    siteSlug: site.slug,
    siteVersion: site.publishedAt,
    workspaceSlug,
  })

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://mail.google.com" || !isGmailHostMessage(event.data) || event.data.type !== "insert-result") return
      setInserting(null)
      if (!event.data.ok) setError(event.data.message || "Lightsite could not be inserted.")
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const insert = (format: "card" | "link") => {
    if (!composeId) {
      setError("This Gmail draft is no longer available.")
      return
    }
    setError(null)
    setInserting(format)
    const content = format === "card"
      ? createEmailCard({ company, recipientName, screenshotUrl, siteName: site.name, url })
      : createEmailLink({ recipientName, siteName: site.name, url })
    postToHost({
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
      source: "lightsite-extension-panel",
      type: "insert",
      composeId,
      format,
      ...content,
    })
  }

  return (
    <section className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden">
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="box-border w-full min-w-0 max-w-full px-4 py-4">
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <Avatar shape="square" size="md"><AvatarFallback>{recipientName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><h1 className="truncate text-base font-semibold">{recipientName} <span className="text-muted-foreground">@</span> {company}</h1><p className="truncate text-xs text-muted-foreground">{site.name}</p></div>
          </div>
          <EmailCardPreview
            company={company}
            recipientName={recipientName}
            screenshotUrl={previewScreenshotUrl}
          />
          <Separator className="my-4" />
          <div className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border bg-background p-2 pl-3">
            <IconLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
            <Button size="icon-xs" variant="ghost" aria-label="Copy link" onClick={() => void navigator.clipboard.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) })}>{copied ? <IconCheck /> : <IconCopy />}</Button>
          </div>
          {error ? <Alert className="mt-4" variant="destructive"><AlertTitle>Could not insert</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
      </div>
      <div className="box-border flex w-full min-w-0 flex-col gap-2 border-t border-border p-3">
        <Button disabled={Boolean(inserting)} onClick={() => insert("card")}>{inserting === "card" ? <Spinner data-icon="inline-start" /> : <IconMailFast data-icon="inline-start" />}Insert email card</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={Boolean(inserting)} variant="outline" onClick={() => insert("link")}>{inserting === "link" ? <Spinner data-icon="inline-start" /> : <IconLink data-icon="inline-start" />}Insert link</Button>
          <Button variant="outline" onClick={() => void sendBackground({ type: "open-tab", url })}><IconExternalLink data-icon="inline-start" />Preview</Button>
        </div>
      </div>
    </section>
  )
}

function EmailCardPreview({ company, recipientName, screenshotUrl }: {
  company: string
  recipientName: string
  screenshotUrl: string
}) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading")
  const previewUrl = attempt === 0
    ? screenshotUrl
    : `${screenshotUrl}${screenshotUrl.includes("?") ? "&" : "?"}retry=${attempt}`

  return (
    <div className="relative aspect-[1200/630] w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-xs">
      {status === "loading" ? <Skeleton className="absolute inset-0 size-full rounded-none" /> : null}
      {status === "error" ? (
        <Empty className="absolute inset-0 gap-2 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon"><IconPhotoOff /></EmptyMedia>
            <EmptyTitle className="text-sm">Preview unavailable</EmptyTitle>
            <EmptyDescription className="text-xs">The link still works. Retry the image before inserting it.</EmptyDescription>
          </EmptyHeader>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setStatus("loading")
              setAttempt((current) => current + 1)
            }}
          >
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        </Empty>
      ) : null}
      <img
        alt={`Preview of the personalized site for ${recipientName} at ${company}`}
        className={status === "ready" ? "h-full w-full object-cover object-top" : "invisible h-full w-full object-cover object-top"}
        src={previewUrl}
        onError={() => setStatus("error")}
        onLoad={() => setStatus("ready")}
      />
    </div>
  )
}

function SearchInput({ autoFocus, placeholder, query, onQueryChange }: { autoFocus?: boolean; placeholder: string; query: string; onQueryChange: (query: string) => void }) {
  return (
    <div className="relative mx-4 mb-3">
      <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input autoFocus={autoFocus} className="pl-8" placeholder={placeholder} value={query} onChange={(event) => onQueryChange(event.target.value)} />
    </div>
  )
}

function PanelLoading({ label = "Loading Lightsite" }: { label?: string }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" aria-label={label}><Skeleton className="h-8 w-2/3" /><Skeleton className="h-9 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
}

async function api<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}) {
  return sendBackground<T>({ type: "api-request", path, ...options })
}

async function sendBackground<T = unknown>(message: BackgroundRequest): Promise<BackgroundResponse<T>> {
  try {
    return await chrome.runtime.sendMessage(message) as BackgroundResponse<T>
  } catch {
    return { ok: false, error: { code: "extension.unavailable", message: "The Lightsite extension needs to be reloaded." } }
  }
}

function postToHost(message: ExtensionPanelMessage) {
  window.parent.postMessage(message, "https://mail.google.com")
}

function closePanel() {
  postToHost({ protocolVersion: EXTENSION_PROTOCOL_VERSION, source: "lightsite-extension-panel", type: "close-panel" })
}
