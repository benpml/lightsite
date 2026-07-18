import { useEffect, useId, useMemo, useRef, useState } from "react"
import type React from "react"
import { createPortal } from "react-dom"
import { HANDOUT_TEXT_LIMITS } from "@handout/domain"
import {
  IconChevronLeft,
  IconCode,
  IconTrash,
  IconUserPlus,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react"
import type { TablerIcon } from "@tabler/icons-react"
import { toast } from "sonner"

import { RecipientAvatar as SharedRecipientAvatar } from "@/components/common/recipient-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { HandoutVariableOption } from "../tiptap/schema"
import {
  buildRecipientPublicUrl,
  buildRecipientScreenshotUrl,
  createRecipientEmailEmbedHtml,
  getRecipientLogoUrl,
  normalizeOptionalRecipientWebsite,
  type SiteRecipient,
} from "./recipient-model"

type RecipientShareDialogProps = {
  createRecipient: (input: {
    company: string
    name: string
    values: Record<string, string>
    website?: string
  }) => Promise<SiteRecipient>
  deleteRecipient: (recipientId: string) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  recipients: SiteRecipient[]
  siteUri: string
  siteVersion?: string | null
  updateRecipient: (
    recipientId: string,
    input: Partial<Pick<SiteRecipient, "company" | "name" | "values" | "website">>
  ) => Promise<SiteRecipient | null>
  variables: HandoutVariableOption[]
}

type ShareView = "new" | "past" | "detail"

type RecipientDraft = {
  company: string
  customValues: Record<string, string>
  name: string
  website: string
}

const builtInRecipientVariableIds = new Set([
  "recipient-name",
  "recipient-company",
  "var-company-logo",
])

export function RecipientShareDialog({
  createRecipient,
  deleteRecipient,
  onOpenChange,
  open,
  recipients,
  siteUri,
  siteVersion,
  updateRecipient,
  variables,
}: RecipientShareDialogProps) {
  const [view, setView] = useState<ShareView>("new")
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)
  const selectedRecipient =
    recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null
  const customVariables = useMemo(
    () => variables.filter((variable) => !builtInRecipientVariableIds.has(variable.id)),
    [variables]
  )
  const [draft, setDraft] = useState<RecipientDraft>(() =>
    createEmptyRecipientDraft(customVariables)
  )
  const [copiedState, setCopiedState] = useState<"embed" | "link" | null>(null)
  const titleId = useId()
  const wasOpenRef = useRef(false)
  const draftWebsiteValidation = useMemo(
    () => normalizeOptionalRecipientWebsite(draft.website),
    [draft.website]
  )
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    if (wasOpenRef.current) {
      return
    }

    wasOpenRef.current = true
    setView("new")
    setSelectedRecipientId(null)
    setDraft(createEmptyRecipientDraft(customVariables))
    setCopiedState(null)
  }, [customVariables, open, recipients.length])

  const createDisabled =
    !draft.name.trim() || !draft.company.trim() || !draftWebsiteValidation.ok
  const dialogIsDetail = view === "detail" && selectedRecipient

  const createNewRecipient = async () => {
    if (createDisabled) {
      return
    }

    try {
      const recipient = await createRecipient({
        company: draft.company,
        name: draft.name,
        values: createRecipientValues(draft, customVariables),
        website: draftWebsiteValidation.ok ? draftWebsiteValidation.website : draft.website,
      })

      setSelectedRecipientId(recipient.id)
      setView("detail")
      setDraft(createEmptyRecipientDraft(customVariables))
    } catch {
      toast.error("Recipient could not be created")
    }
  }

  const updateSelectedRecipient = (
    input: Partial<Pick<SiteRecipient, "company" | "name" | "values" | "website">>
  ) => {
    if (!selectedRecipient) {
      return
    }

    void updateRecipient(selectedRecipient.id, input).catch(() => {
      toast.error("Recipient could not be updated")
    })
  }

  const copyLink = async () => {
    if (!selectedRecipient) {
      return
    }

    await writeClipboardText(buildRecipientPublicUrl({ recipient: selectedRecipient, siteUri }))
    showCopiedState("link", setCopiedState)
  }

  const copyEmbed = async () => {
    if (!selectedRecipient) {
      return
    }

    const html = createRecipientEmailEmbedHtml({ recipient: selectedRecipient, siteUri, siteVersion })
    const text = buildRecipientPublicUrl({ recipient: selectedRecipient, siteUri })

    await writeClipboardHtml(html, text)
    showCopiedState("embed", setCopiedState)
  }

  const removeSelectedRecipient = async () => {
    if (!selectedRecipient) {
      return
    }

    try {
      await deleteRecipient(selectedRecipient.id)
      setSelectedRecipientId(null)
      setView("past")
    } catch {
      toast.error("Recipient could not be deleted")
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 supports-backdrop-filter:backdrop-blur-xs"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false)
        }
      }}
    >
      <ShareModalKeyboardBoundary onClose={() => onOpenChange(false)}>
        <div
          className={cn(
            "w-full overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10",
            "max-h-[min(560px,calc(100svh-2rem))]",
            dialogIsDetail ? "max-w-[635px]" : "max-w-[364px]"
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <h2 id={titleId} className="sr-only">
            Share site
          </h2>
        {dialogIsDetail ? (
          <RecipientDetail
            key={selectedRecipient.id}
            copiedState={copiedState}
            customVariables={customVariables}
            onBack={() => {
              setView("past")
              setCopiedState(null)
            }}
            onClose={() => onOpenChange(false)}
            onCopyEmbed={copyEmbed}
            onCopyLink={copyLink}
            onDelete={removeSelectedRecipient}
            onUpdate={updateSelectedRecipient}
            recipient={selectedRecipient}
            siteUri={siteUri}
            siteVersion={siteVersion}
          />
        ) : (
          <RecipientListPanel
            createDisabled={createDisabled}
            customVariables={customVariables}
            draft={draft}
            onClose={() => onOpenChange(false)}
            onCreate={createNewRecipient}
            onDraftChange={setDraft}
            onSelectRecipient={(recipient) => {
              setSelectedRecipientId(recipient.id)
              setView("detail")
              setCopiedState(null)
            }}
            onViewChange={setView}
            recipients={recipients}
            view={view}
            websiteValidation={draftWebsiteValidation}
          />
        )}
        </div>
      </ShareModalKeyboardBoundary>
    </div>,
    document.body
  )
}

function ShareModalKeyboardBoundary({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    panelRef.current?.focus({ preventScroll: true })

    return () => {
      previousFocusedElement?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div
      ref={panelRef}
      className="flex w-full justify-center outline-none"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
    >
      {children}
    </div>
  )
}

function RecipientListPanel({
  createDisabled,
  customVariables,
  draft,
  onClose,
  onCreate,
  onDraftChange,
  onSelectRecipient,
  onViewChange,
  recipients,
  view,
  websiteValidation,
}: {
  createDisabled: boolean
  customVariables: HandoutVariableOption[]
  draft: RecipientDraft
  onClose: () => void
  onCreate: () => void
  onDraftChange: React.Dispatch<React.SetStateAction<RecipientDraft>>
  onSelectRecipient: (recipient: SiteRecipient) => void
  onViewChange: (view: ShareView) => void
  recipients: SiteRecipient[]
  view: ShareView
  websiteValidation: ReturnType<typeof normalizeOptionalRecipientWebsite>
}) {
  return (
    <div className="flex max-h-[416px] flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground">
      <ModalTabsHeader
        activeView={view}
        onClose={onClose}
        onViewChange={onViewChange}
      />
      {view === "new" ? (
        <>
          <div className="min-h-0 overflow-y-auto px-4 py-4">
            <RecipientForm
              customVariables={customVariables}
              draft={draft}
              onDraftChange={onDraftChange}
              websiteValidation={websiteValidation}
            />
          </div>
          <div className="border-t border-border p-2.5">
            <Button className="w-full" disabled={createDisabled} onClick={onCreate}>
              Create link
            </Button>
          </div>
        </>
      ) : (
        <div className="min-h-[96px] overflow-y-auto p-3">
          {recipients.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {recipients.map((recipient) => (
                <RecipientListItem
                  key={recipient.id}
                  onSelect={() => onSelectRecipient(recipient)}
                  recipient={recipient}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-5 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-sm font-medium">No recipients yet</span>
                <span className="text-xs text-muted-foreground">
                  Create a recipient to generate a personalized link.
                </span>
              </div>
              <Button size="sm" onClick={() => onViewChange("new")}>
                New recipient
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModalTabsHeader({
  activeView,
  onClose,
  onViewChange,
}: {
  activeView: ShareView
  onClose: () => void
  onViewChange: (view: ShareView) => void
}) {
  return (
    <div className="flex h-[42px] flex-row items-center gap-2 border-b border-border py-0 pr-2.5 pl-4">
      <div className="flex h-full min-w-0 flex-1 items-center gap-2">
        <TabButton
          active={activeView === "new"}
          icon={IconUserPlus}
          label="New recipient"
          onClick={() => onViewChange("new")}
        />
        <TabButton
          active={activeView === "past"}
          icon={IconUsersGroup}
          label="Past recipients"
          onClick={() => onViewChange("past")}
        />
      </div>
      <Button
        aria-label="Close share modal"
        size="icon-field"
        type="button"
        variant="ghost"
        onClick={onClose}
      >
        <IconX />
      </Button>
    </div>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: TablerIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        "flex h-full items-center gap-1.5 border-b px-1 text-sm font-semibold transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
      type="button"
      onClick={onClick}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </button>
  )
}

function RecipientForm({
  customVariables,
  draft,
  onDraftChange,
  websiteValidation,
}: {
  customVariables: HandoutVariableOption[]
  draft: RecipientDraft
  onDraftChange: React.Dispatch<React.SetStateAction<RecipientDraft>>
  websiteValidation: ReturnType<typeof normalizeOptionalRecipientWebsite>
}) {
  const nameId = useId()
  const companyId = useId()
  const websiteId = useId()

  return (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={nameId} className="text-xs text-tertiary-foreground">
            Name
          </FieldLabel>
          <Input
            id={nameId}
            autoComplete="off"
            name="handout-recipient-name"
            placeholder="John"
            maxLength={HANDOUT_TEXT_LIMITS.recipientName}
            value={draft.name}
            onChange={(event) =>
              onDraftChange((currentDraft) => ({
                ...currentDraft,
                name: event.target.value,
              }))
            }
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={companyId} className="text-xs text-tertiary-foreground">
            Company
          </FieldLabel>
          <Input
            id={companyId}
            autoComplete="off"
            name="handout-recipient-company"
            placeholder="Acme"
            maxLength={HANDOUT_TEXT_LIMITS.recipientCompany}
            value={draft.company}
            onChange={(event) =>
              onDraftChange((currentDraft) => ({
                ...currentDraft,
                company: event.target.value,
              }))
            }
          />
        </Field>
      </div>
      <Field className="gap-1.5" data-invalid={!websiteValidation.ok ? true : undefined}>
        <FieldLabel htmlFor={websiteId} className="text-xs text-tertiary-foreground">
          Website
        </FieldLabel>
        <Input
          id={websiteId}
          aria-invalid={!websiteValidation.ok}
          autoComplete="off"
          inputMode="url"
          name="handout-recipient-website"
          placeholder="https://example.com"
          maxLength={HANDOUT_TEXT_LIMITS.url}
          value={draft.website}
          onChange={(event) =>
            onDraftChange((currentDraft) => ({
              ...currentDraft,
              website: event.target.value,
            }))
          }
        />
        {!websiteValidation.ok ? <FieldError>{websiteValidation.message}</FieldError> : null}
      </Field>
      {customVariables.map((variable) => (
        <Field key={variable.id} className="gap-1.5">
          <FieldLabel
            htmlFor={`${websiteId}-${variable.id}`}
            className="text-xs text-tertiary-foreground"
          >
            {variable.name}
          </FieldLabel>
          <Input
            id={`${websiteId}-${variable.id}`}
            autoComplete="off"
            placeholder={variable.defaultValue || "Enter value..."}
            maxLength={HANDOUT_TEXT_LIMITS.recipientVariableValue}
            value={draft.customValues[variable.id] ?? ""}
            onChange={(event) =>
              onDraftChange((currentDraft) => ({
                ...currentDraft,
                customValues: {
                  ...currentDraft.customValues,
                  [variable.id]: event.target.value,
                },
              }))
            }
          />
        </Field>
      ))}
    </FieldGroup>
  )
}

function RecipientListItem({
  onSelect,
  recipient,
}: {
  onSelect: () => void
  recipient: SiteRecipient
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      type="button"
      onClick={onSelect}
    >
      <RecipientAvatar recipient={recipient} />
      <RecipientName recipient={recipient} />
    </button>
  )
}

function RecipientDetail({
  copiedState,
  customVariables,
  onBack,
  onClose,
  onCopyEmbed,
  onCopyLink,
  onDelete,
  onUpdate,
  recipient,
  siteUri,
  siteVersion,
}: {
  copiedState: "embed" | "link" | null
  customVariables: HandoutVariableOption[]
  onBack: () => void
  onClose: () => void
  onCopyEmbed: () => void
  onCopyLink: () => void
  onDelete: () => void
  onUpdate: (
    input: Partial<Pick<SiteRecipient, "company" | "name" | "values" | "website">>
  ) => void
  recipient: SiteRecipient
  siteUri: string
  siteVersion?: string | null
}) {
  const nameId = useId()
  const companyId = useId()
  const websiteId = useId()
  const link = buildRecipientPublicUrl({ recipient, siteUri })
  const [identityDraft, setIdentityDraft] = useState(() => ({
    company: recipient.company,
    name: recipient.name,
  }))
  const [websiteDraft, setWebsiteDraft] = useState(recipient.website)
  const nameInvalid = identityDraft.name.trim().length === 0
  const companyInvalid = identityDraft.company.trim().length === 0
  const websiteValidation = useMemo(
    () => normalizeOptionalRecipientWebsite(websiteDraft),
    [websiteDraft]
  )

  const updateIdentityDraft = (field: "company" | "name", value: string) => {
    setIdentityDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const commitIdentityDraft = (field: "company" | "name") => {
    const value = identityDraft[field].trim().replace(/\s+/g, " ")

    if (!value) {
      setIdentityDraft((currentDraft) => ({
        ...currentDraft,
        [field]: recipient[field],
      }))
      return
    }

    if (value !== recipient[field]) {
      onUpdate({ [field]: value })
    }
  }

  const commitWebsiteDraft = () => {
    if (!websiteValidation.ok) {
      return
    }

    if (websiteValidation.website !== websiteDraft) {
      setWebsiteDraft(websiteValidation.website)
    }

    if (websiteValidation.website !== recipient.website) {
      onUpdate({ website: websiteValidation.website })
    }
  }

  return (
    <div className="flex max-h-[416px] flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground">
      <div className="flex h-10 items-center justify-between border-b border-border pl-1 pr-3">
        <Button
          className="justify-start text-muted-foreground"
          size="compact"
          type="button"
          variant="ghost"
          onClick={onBack}
        >
          <IconChevronLeft data-icon="inline-start" />
          Back
        </Button>
        <Button
          aria-label="Close share modal"
          size="icon-field"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <IconX />
        </Button>
      </div>
      <div className="grid min-h-0 grid-cols-[290px_minmax(0,1fr)] overflow-hidden">
        <div className="min-h-0 overflow-y-auto border-r border-border px-4 py-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <RecipientAvatar recipient={recipient} size="md" />
              <RecipientName recipient={recipient} />
            </div>
            <DeleteRecipientConfirmation onDelete={onDelete} recipient={recipient} />
          </div>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5" data-invalid={nameInvalid ? true : undefined}>
              <FieldLabel htmlFor={nameId} className="text-xs text-tertiary-foreground">
                Name
              </FieldLabel>
              <Input
                id={nameId}
                aria-invalid={nameInvalid}
                maxLength={HANDOUT_TEXT_LIMITS.recipientName}
                value={identityDraft.name}
                onBlur={() => commitIdentityDraft("name")}
                onChange={(event) => updateIdentityDraft("name", event.target.value)}
              />
              {nameInvalid ? <FieldError>Name is required.</FieldError> : null}
            </Field>
            <Field className="gap-1.5" data-invalid={companyInvalid ? true : undefined}>
              <FieldLabel htmlFor={companyId} className="text-xs text-tertiary-foreground">
                Company
              </FieldLabel>
              <Input
                id={companyId}
                aria-invalid={companyInvalid}
                maxLength={HANDOUT_TEXT_LIMITS.recipientCompany}
                value={identityDraft.company}
                onBlur={() => commitIdentityDraft("company")}
                onChange={(event) => updateIdentityDraft("company", event.target.value)}
              />
              {companyInvalid ? <FieldError>Company is required.</FieldError> : null}
            </Field>
            <Field className="gap-1.5" data-invalid={!websiteValidation.ok ? true : undefined}>
              <FieldLabel htmlFor={websiteId} className="text-xs text-tertiary-foreground">
                Website
              </FieldLabel>
              <Input
                id={websiteId}
                aria-invalid={!websiteValidation.ok}
                inputMode="url"
                placeholder="https://example.com"
                maxLength={HANDOUT_TEXT_LIMITS.url}
                value={websiteDraft}
                onBlur={commitWebsiteDraft}
                onChange={(event) => setWebsiteDraft(event.target.value)}
              />
              {!websiteValidation.ok ? <FieldError>{websiteValidation.message}</FieldError> : null}
            </Field>
            {customVariables.map((variable) => (
              <Field key={variable.id} className="gap-1.5">
                <FieldLabel
                  htmlFor={`${websiteId}-${variable.id}`}
                  className="text-xs text-tertiary-foreground"
                >
                  {variable.name}
                </FieldLabel>
                <Input
                  id={`${websiteId}-${variable.id}`}
                  placeholder={variable.defaultValue || "Enter value..."}
                  maxLength={HANDOUT_TEXT_LIMITS.recipientVariableValue}
                  value={recipient.values[variable.id] ?? ""}
                  onChange={(event) =>
                    onUpdate({
                      values: {
                        ...recipient.values,
                        [variable.id]: event.target.value,
                      },
                    })
                  }
                />
              </Field>
            ))}
          </FieldGroup>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-4">
          <div className="mb-4 text-sm font-medium">Share</div>
          <FieldGroup className="gap-4">
            <Field className="gap-1.5">
              <FieldLabel className="text-xs text-tertiary-foreground">Link</FieldLabel>
              <div className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-input bg-background py-1 pr-1 pl-3 shadow-xs">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {link.replace("https://", "")}
                </span>
                <Button size="sm" type="button" onClick={onCopyLink}>
                  {copiedState === "link" ? "Copied" : "Copy link"}
                </Button>
              </div>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel className="text-xs text-tertiary-foreground">
                Email embed
              </FieldLabel>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" onClick={onCopyEmbed}>
                  <IconCode data-icon="inline-start" />
                  {copiedState === "embed" ? "Copied embed" : "Copy embed"}
                </Button>
                <RecipientEmbedPreview
                  recipient={recipient}
                  siteUri={siteUri}
                  siteVersion={siteVersion}
                />
              </div>
            </Field>
          </FieldGroup>
        </div>
      </div>
    </div>
  )
}

function DeleteRecipientConfirmation({
  onDelete,
  recipient,
}: {
  onDelete: () => void
  recipient: SiteRecipient
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Delete recipient"
          size="icon-field"
          type="button"
          variant="ghost"
        >
          <IconTrash />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete recipient?</AlertDialogTitle>
          <AlertDialogDescription>
            The link for {recipient.name} @ {recipient.company} will stop working.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete recipient
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RecipientAvatar({
  recipient,
  size = "sm",
}: {
  recipient: SiteRecipient
  size?: "md" | "sm"
}) {
  return (
    <SharedRecipientAvatar
      recipient={recipient}
      size={size === "md" ? "md" : "xs"}
    />
  )
}

function RecipientName({ recipient }: { recipient: SiteRecipient }) {
  return (
    <span className="flex min-w-0 items-center gap-[3px] text-sm font-medium">
      <span className="truncate text-foreground">{recipient.name || "Recipient"}</span>
      <span className="text-muted-foreground">@</span>
      <span className="truncate text-foreground">{recipient.company || "Company"}</span>
    </span>
  )
}

function RecipientEmbedPreview({
  recipient,
  siteUri,
  siteVersion,
}: {
  recipient: SiteRecipient
  siteUri: string
  siteVersion?: string | null
}) {
  const screenshotUrl = buildRecipientScreenshotUrl({ recipient, siteUri, siteVersion })

  return (
    <div className="aspect-[1200/630] w-full overflow-hidden rounded-[10px] border border-border bg-background">
      <img
        alt={`Preview of the personalized site for ${recipient.name} at ${recipient.company}`}
        className="h-full w-full object-cover object-top"
        src={screenshotUrl}
      />
    </div>
  )
}

function createEmptyRecipientDraft(
  customVariables: HandoutVariableOption[]
): RecipientDraft {
  return {
    company: "",
    customValues: Object.fromEntries(
      customVariables.map((variable) => [variable.id, ""])
    ),
    name: "",
    website: "",
  }
}

function createRecipientValues(
  draft: RecipientDraft,
  customVariables: HandoutVariableOption[]
) {
  const values: Record<string, string> = {
    "recipient-company": draft.company,
    "recipient-name": draft.name,
  }
  const logoUrl = getRecipientLogoUrl(draft.website)

  if (logoUrl) {
    values["var-company-logo"] = logoUrl
  }

  for (const variable of customVariables) {
    values[variable.id] = draft.customValues[variable.id]?.trim() || variable.defaultValue || ""
  }

  return values
}

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  }
}

async function writeClipboardHtml(html: string, text: string) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ])
    return
  }

  await writeClipboardText(text)
}

function showCopiedState(
  state: "embed" | "link",
  setCopiedState: React.Dispatch<React.SetStateAction<"embed" | "link" | null>>
) {
  setCopiedState(state)
  window.setTimeout(() => setCopiedState(null), 1600)
}
