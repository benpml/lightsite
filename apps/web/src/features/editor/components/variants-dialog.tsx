import { useMemo, useState } from "react"
import {
  IconCards,
  IconChevronLeft,
  IconClipboard,
  IconCodePlus,
  IconCopy,
  IconDotsVertical,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { slugifyName, validateVariantSlug } from "@lightsite/domain"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import {
  createEditorVariant,
  duplicateEditorVariant,
  type EditorVariable,
  type VariantRecord,
} from "../editor-data"
import { VariableInputCard } from "./variable-input-card"

type VariantDraft = {
  id: string | null
  name: string
  slug: string
  slugEdited: boolean
  values: Record<string, string>
}

type VariantsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  variants: VariantRecord[]
  onCreateVariant: (variant: VariantRecord) => void
  onDeleteVariant: (variantId: string) => void
  onUpdateVariant: (variant: VariantRecord) => void
  siteSlug: string
  variables: EditorVariable[]
  workspaceSlug: string
}

export function VariantsDialog({
  open,
  onOpenChange,
  variants,
  onCreateVariant,
  onDeleteVariant,
  onUpdateVariant,
  siteSlug,
  variables,
  workspaceSlug,
}: VariantsDialogProps) {
  const [mode, setMode] = useState<"list" | "edit">("list")
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<VariantDraft>(() =>
    createDraftFromVariant(variants.find((variant) => !isDefaultVariant(variant)), variables)
  )
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const editableVariants = variants.filter((variant) => !isDefaultVariant(variant))
  const firstEditableVariant = editableVariants[0]
  const normalizedQuery = query.trim().toLowerCase()
  const filteredVariants = normalizedQuery
    ? editableVariants.filter((variant) =>
        `${variant.name} ${variant.slug}`.toLowerCase().includes(normalizedQuery)
      )
    : editableVariants
  const existingSlugs = useMemo(
    () => new Set(variants.filter((variant) => variant.id !== draft.id).map((variant) => variant.slug)),
    [draft.id, variants]
  )
  const savedDraftVariant = draft.id ? variants.find((variant) => variant.id === draft.id) : undefined
  const draftIsDirty = draft.id ? !variantMatchesDraft(savedDraftVariant, draft, variables) : true
  const slugValidation = validateVariantSlug(draft.slug)
  const normalizedDraftSlug = slugValidation.ok ? slugValidation.slug : slugifyName(draft.slug)
  const slugTaken = slugValidation.ok && existingSlugs.has(normalizedDraftSlug)
  const nameError = draft.name.trim() ? null : "Variant name is required."
  const slugError = slugValidation.ok
    ? slugTaken
      ? "Variant link is already in use."
      : null
    : slugValidation.message
  const canSaveDraft = !nameError && !slugError

  function showVariantList() {
    setDraft(createDraftFromVariant(firstEditableVariant, variables))
    setMode("list")
  }

  function openVariantEditor(variant: VariantRecord) {
    setDraft(createDraftFromVariant(variant, variables))
    setMode("edit")
  }

  function openNewVariantEditor() {
    const defaultSlug = uniqueDraftSlug("new-variant", new Set(variants.map((variant) => variant.slug)))

    setDraft({
      id: null,
      name: "New Variant",
      slug: defaultSlug,
      slugEdited: false,
      values: createEmptyValues(variables),
    })
    setMode("edit")
  }

  function handleDuplicateVariant(variant: VariantRecord) {
    const duplicatedVariant = duplicateEditorVariant({
      existingSlugs: new Set(variants.map((currentVariant) => currentVariant.slug)),
      variant,
    })

    onCreateVariant(duplicatedVariant)
    setDraft(createDraftFromVariant(duplicatedVariant, variables))
    setMode("edit")
    toast.success("Variant duplicated.")
  }

  function handleSaveVariant() {
    if (!canSaveDraft || !slugValidation.ok) {
      return
    }

    const values = normalizeVariantValues(draft.values, variables)

    if (draft.id) {
      const currentVariant = variants.find((variant) => variant.id === draft.id)

      if (!currentVariant) {
        return
      }

      const nextVariant = {
        ...currentVariant,
        name: draft.name.trim(),
        slug: slugValidation.slug,
        values,
      }

      onUpdateVariant(nextVariant)
      setDraft(createDraftFromVariant(nextVariant, variables))
      toast.success("Variant saved.")
      return
    }

    const nextVariant = {
      ...createEditorVariant({
        existingSlugs,
        name: draft.name,
        slug: slugValidation.slug,
        variables,
      }),
      values,
    }

    onCreateVariant(nextVariant)
    setDraft(createDraftFromVariant(nextVariant, variables))
    toast.success("Variant created.")
  }

  function handleDeleteTarget() {
    const deleteTarget = deleteTargetId

    if (!deleteTarget) {
      return
    }

    onDeleteVariant(deleteTarget)

    if (draft.id === deleteTarget) {
      showVariantList()
    }

    setDeleteTargetId(null)
    toast.success("Variant deleted.")
  }

  function handleCopyVariantLink(variant: VariantRecord | undefined = savedDraftVariant) {
    if (!variant || isDefaultVariant(variant)) {
      return
    }

    const path = `/${workspaceSlug}/${siteSlug}/${variant.slug}`
    const url = new URL(path, window.location.origin).toString()

    void navigator.clipboard.writeText(url).then(
      () => toast.success("Variant link copied."),
      () => toast.error("Could not copy variant link.")
    )
  }

  return (
    <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(nextOpen) => !nextOpen && setDeleteTargetId(null)}>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen)
          if (!nextOpen) {
            showVariantList()
            setQuery("")
          }
        }}
      >
        {mode === "list" ? (
          <DialogContent showCloseButton={false} className="h-[min(520px,calc(100dvh-2rem))] w-[min(640px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
            <DialogHeader className="gap-0 px-3.5 pt-1.5 pb-2">
              <div className="flex items-start gap-3">
                <div className="flex min-h-[57px] min-w-0 flex-1 flex-col justify-center">
                  <DialogTitle className="text-base leading-6 font-semibold">Site Variants</DialogTitle>
                  <DialogDescription className="mt-px text-sm leading-5">
                    Customize your site content and tracking link for each recipient.
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon-field" aria-label="Close variants">
                    <IconX />
                  </Button>
                </DialogClose>
              </div>
              <InputGroup className="mt-3">
                <InputGroupAddon>
                  <IconSearch />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                />
              </InputGroup>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto px-3.5 pt-1">
              {filteredVariants.length > 0 ? (
                filteredVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="group flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted focus-within:bg-muted"
                  >
                    <button
                      type="button"
                      className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => openVariantEditor(variant)}
                    >
                      <IconCards />
                      <span className="min-w-0 flex-1 truncate">{variant.name}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-field"
                        aria-label={`Copy ${variant.name} link`}
                        onClick={() => handleCopyVariantLink(variant)}
                      >
                        <IconClipboard />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-field"
                        aria-label={`Duplicate ${variant.name}`}
                        onClick={() => handleDuplicateVariant(variant)}
                      >
                        <IconCopy />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-field"
                        aria-label={`Delete ${variant.name}`}
                        onClick={() => setDeleteTargetId(variant.id)}
                      >
                        <IconTrash />
                      </Button>
                    </span>
                  </div>
                ))
              ) : (
                <Empty className="h-full border-0 p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconCards />
                    </EmptyMedia>
                    <EmptyTitle>{normalizedQuery ? "No matching variants" : "No variants yet"}</EmptyTitle>
                    <EmptyDescription>
                      {normalizedQuery
                        ? "Try a different name or link."
                        : "Create a recipient link when a one-pager needs personalized values."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
            <DialogFooter className="h-[42px] shrink-0 p-1.5">
              <Button size="compact" className="w-full" onClick={openNewVariantEditor}>
                <IconCodePlus data-icon="inline-start" />
                New Variant
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          <DialogContent showCloseButton={false} className="h-[min(680px,calc(100dvh-2rem))] w-[min(640px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
            <div className="flex h-[52px] items-center gap-2 px-3.5">
              <Button variant="ghost" size="icon-compact" aria-label="Back to variants" onClick={showVariantList}>
                <IconChevronLeft />
              </Button>
              <DialogTitle className="min-w-0 flex-1 text-base leading-6 font-semibold">
                {draft.id ? "Edit Variant" : "New Variant"}
              </DialogTitle>
              {draft.id ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-field" aria-label="Variant actions">
                      <IconDotsVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuGroup>
                      <DropdownMenuItem disabled={draftIsDirty} onClick={() => handleCopyVariantLink()}>
                        <IconClipboard />
                        Copy Variant Link
                      </DropdownMenuItem>
                      {savedDraftVariant && !isDefaultVariant(savedDraftVariant) ? (
                        <DropdownMenuItem onClick={() => handleDuplicateVariant(savedDraftVariant)}>
                          <IconCopy />
                          Duplicate Variant
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem variant="destructive" onClick={() => draft.id && setDeleteTargetId(draft.id)}>
                        <IconTrash />
                        Delete Variant
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <DialogClose asChild>
                <Button variant="ghost" size="icon-field" aria-label="Close variants">
                  <IconX />
                </Button>
              </DialogClose>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3.5 pb-4">
              <FieldSet>
                <FieldGroup className="gap-5">
                  <Field data-invalid={Boolean(nameError) || undefined}>
                    <FieldLabel>Name</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        value={draft.name}
                        aria-invalid={Boolean(nameError) || undefined}
                        onChange={(event) => {
                          const name = event.target.value
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            name,
                            slug: currentDraft.slugEdited
                              ? currentDraft.slug
                              : uniqueDraftSlug(slugifyName(name) || "variant", existingSlugs),
                          }))
                        }}
                      />
                    </InputGroup>
                    {nameError ? <FieldError>{nameError}</FieldError> : null}
                  </Field>
                  <Field data-invalid={Boolean(slugError) || undefined}>
                    <FieldLabel>Custom link</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <span>/{workspaceSlug}/{siteSlug}/</span>
                      </InputGroupAddon>
                      <InputGroupInput
                        value={draft.slug}
                        aria-invalid={Boolean(slugError) || undefined}
                        onChange={(event) =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            slug: slugifyName(event.target.value),
                            slugEdited: true,
                          }))
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label="Copy variant link"
                          disabled={!draft.id || draftIsDirty || Boolean(slugError)}
                          onClick={() => handleCopyVariantLink()}
                        >
                          <IconClipboard />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    {slugError ? <FieldError>{slugError}</FieldError> : null}
                  </Field>
                  <Field>
                    <FieldLabel>Variable values</FieldLabel>
                    {variables.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {variables.map((variable) => (
                          <VariableInputCard
                            key={variable.id}
                            variable={variable}
                            value={draft.values[variable.id] ?? ""}
                            onChange={(value) =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                values: {
                                  ...currentDraft.values,
                                  [variable.id]: value,
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty className="border bg-background p-4">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <IconCards />
                          </EmptyMedia>
                          <EmptyTitle>No variables yet</EmptyTitle>
                          <EmptyDescription>
                            Create variables in the editor to customize recipient links.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </Field>
                </FieldGroup>
              </FieldSet>
            </div>
            <Separator />
            <DialogFooter className="h-[42px] shrink-0 p-1.5">
              <Button size="compact" className="w-full" disabled={!canSaveDraft} onClick={handleSaveVariant}>
                Save Variant
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete variant?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the recipient link from this local draft. Published links should be deleted through the server once variant APIs are connected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDeleteTarget}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function createDraftFromVariant(variant: VariantRecord | undefined, variables: EditorVariable[]): VariantDraft {
  return {
    id: variant && !isDefaultVariant(variant) ? variant.id : null,
    name: variant && !isDefaultVariant(variant) ? variant.name : "New Variant",
    slug: variant && !isDefaultVariant(variant) ? variant.slug : "new-variant",
    slugEdited: Boolean(variant && !isDefaultVariant(variant)),
    values: {
      ...createEmptyValues(variables),
      ...(variant?.values ?? {}),
    },
  }
}

function createEmptyValues(variables: EditorVariable[]) {
  return Object.fromEntries(variables.map((variable) => [variable.id, ""]))
}

function isDefaultVariant(variant: VariantRecord | undefined) {
  return variant?.id === "default"
}

function variantMatchesDraft(
  variant: VariantRecord | undefined,
  draft: VariantDraft,
  variables: EditorVariable[],
) {
  if (!variant) {
    return false
  }

  if (variant.name !== draft.name.trim() || variant.slug !== draft.slug) {
    return false
  }

  return variables.every((variable) =>
    (variant.values?.[variable.id] ?? "") === (draft.values[variable.id] ?? "")
  )
}

function normalizeVariantValues(values: Record<string, string>, variables: EditorVariable[]) {
  return Object.fromEntries(variables.map((variable) => [variable.id, values[variable.id] ?? ""]))
}

function uniqueDraftSlug(slug: string, existingSlugs: ReadonlySet<string>) {
  const normalizedSlug = slugifyName(slug) || "variant"

  if (!existingSlugs.has(normalizedSlug)) {
    return normalizedSlug
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${normalizedSlug}-${suffix}`

    if (!existingSlugs.has(candidate)) {
      return candidate
    }
  }

  return normalizedSlug
}
