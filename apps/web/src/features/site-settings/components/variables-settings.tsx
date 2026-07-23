import { useId, useMemo, useState } from "react"
import {
  IconBraces,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import type { SiteVariableDefinition } from "@handout/site-document"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Textarea } from "@/components/ui/textarea"

import {
  isDuplicateSiteVariableLabel,
  normalizeSiteVariableLabel,
  resolveSystemSiteVariableDescription,
  SYSTEM_SITE_VARIABLE_IDS,
  systemSiteVariables,
} from "../model"

type VariableInput = Pick<SiteVariableDefinition, "defaultValue" | "description" | "label">

type VariablesSettingsProps = {
  onCreate: (input: VariableInput) => void
  onDelete: (variableId: string) => void
  onEdit: (variableId: string, input: VariableInput) => void
  scope?: "site" | "site-defaults"
  usageCounts: Readonly<Record<string, number>>
  variables: SiteVariableDefinition[]
}

export function VariablesSettings({
  onCreate,
  onDelete,
  onEdit,
  scope = "site",
  usageCounts,
  variables,
}: VariablesSettingsProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingVariable, setEditingVariable] = useState<SiteVariableDefinition | null>(null)
  const [deletingVariable, setDeletingVariable] = useState<SiteVariableDefinition | null>(null)
  const customVariables = useMemo(
    () => variables.filter((variable) => !SYSTEM_SITE_VARIABLE_IDS.has(variable.id)),
    [variables],
  )
  const resolvedSystemVariables = useMemo(
    () => systemSiteVariables.map((systemVariable) => {
      const savedVariable = variables.find((variable) => variable.id === systemVariable.id)

      return savedVariable
        ? {
            ...systemVariable,
            defaultValue: savedVariable.defaultValue,
            description: resolveSystemSiteVariableDescription(
              systemVariable.id,
              savedVariable.description,
            ),
          }
        : systemVariable
    }),
    [variables],
  )

  const openCreator = () => {
    setEditingVariable(null)
    setEditorOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm leading-5 font-medium text-foreground">Variables</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          Variables to change site content per recipient.
        </p>
      </div>

      <ItemGroup className="gap-1.5">
        {resolvedSystemVariables.map((variable) => (
          <VariableRow
            key={variable.id}
            variable={variable}
            system
            onEdit={scope === "site" ? () => {
              setEditingVariable(variable)
              setEditorOpen(true)
            } : undefined}
          />
        ))}
        {customVariables.map((variable) => (
          <VariableRow
            key={variable.id}
            variable={variable}
            onDelete={() => setDeletingVariable(variable)}
            onEdit={() => {
              setEditingVariable(variable)
              setEditorOpen(true)
            }}
          />
        ))}
      </ItemGroup>

      <Button variant="outline" className="w-full" onClick={openCreator}>
        <IconPlus data-icon="inline-start" />
        Create variable
      </Button>

      <VariableEditorDialog
        key={editorOpen ? editingVariable?.id ?? "create-open" : "editor-closed"}
        open={editorOpen}
        scope={scope}
        variable={editingVariable}
        variables={customVariables}
        onOpenChange={setEditorOpen}
        onSubmit={(input) => {
          if (editingVariable) onEdit(editingVariable.id, input)
          else onCreate(input)
          setEditorOpen(false)
        }}
      />

      <VariableDeleteDialog
        open={Boolean(deletingVariable)}
        scope={scope}
        usageCount={deletingVariable ? usageCounts[deletingVariable.id] ?? 0 : 0}
        variable={deletingVariable}
        onOpenChange={(open) => {
          if (!open) setDeletingVariable(null)
        }}
        onDelete={() => {
          if (deletingVariable) onDelete(deletingVariable.id)
          setDeletingVariable(null)
        }}
      />
    </div>
  )
}

function VariableRow({
  onDelete,
  onEdit,
  system = false,
  variable,
}: {
  onDelete?: () => void
  onEdit?: () => void
  system?: boolean
  variable: SiteVariableDefinition
}) {
  return (
    <Item
      variant="outline"
      className="h-[60px] flex-nowrap gap-3 rounded-[12px] px-3 py-3"
    >
      <ItemMedia variant="icon" className="self-center! translate-y-0! text-variable-foreground [&_svg]:size-3.5!">
        <IconBraces />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="text-variable-foreground text-sm leading-5">{variable.label}</ItemTitle>
        <ItemDescription className="block! truncate text-xs leading-4">
          {variable.description?.trim() || "No description"}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="shrink-0 gap-1">
        {system ? (
          <>
            <Badge variant="secondary" className="text-tertiary-foreground">System</Badge>
            {onEdit ? (
              <Button variant="ghost" size="icon-field" aria-label={`Edit ${variable.label}`} onClick={onEdit}>
                <IconEdit />
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon-field" aria-label={`Edit ${variable.label}`} onClick={onEdit}>
              <IconEdit />
            </Button>
            <Button variant="ghost" size="icon-field" aria-label={`Delete ${variable.label}`} onClick={onDelete}>
              <IconTrash />
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  )
}

function VariableEditorDialog({
  onOpenChange,
  onSubmit,
  open,
  scope,
  variable,
  variables,
}: {
  onOpenChange: (open: boolean) => void
  onSubmit: (input: VariableInput) => void
  open: boolean
  scope: "site" | "site-defaults"
  variable: SiteVariableDefinition | null
  variables: SiteVariableDefinition[]
}) {
  const nameId = useId()
  const descriptionId = useId()
  const defaultId = useId()
  const [name, setName] = useState(variable?.label ?? "")
  const [description, setDescription] = useState(variable?.description ?? "")
  const [defaultValue, setDefaultValue] = useState(
    typeof variable?.defaultValue === "string" ? variable.defaultValue : "",
  )
  const nameLocked = Boolean(variable && SYSTEM_SITE_VARIABLE_IDS.has(variable.id))
  const normalizedName = normalizeSiteVariableLabel(name)
  const duplicateName = nameLocked
    ? false
    : isDuplicateSiteVariableLabel(normalizedName, variables, variable?.id)
  const nameError = duplicateName
    ? `A variable named ${normalizedName} already exists.`
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="gap-0.5">
          <DialogTitle>{variable ? "Edit variable" : "Create variable"}</DialogTitle>
          <DialogDescription>
            {scope === "site-defaults"
              ? variable
                ? "Update this variable for sites you create in the future."
                : "Create a variable for sites you create in the future."
              : variable
                ? "Update this variable everywhere it is used on the site."
                : "Create reusable recipient content for this site."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            if ((!nameLocked && !normalizedName) || duplicateName) return
            onSubmit({
              label: nameLocked ? variable?.label ?? normalizedName : normalizedName,
              description: description.trim() || undefined,
              defaultValue,
            })
          }}
        >
          <FieldGroup>
            <Field
              data-disabled={nameLocked || undefined}
              data-invalid={duplicateName || undefined}
            >
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                aria-invalid={duplicateName || undefined}
                autoFocus={!nameLocked}
                disabled={nameLocked}
                maxLength={120}
                placeholder="Enter a name for this variable"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={descriptionId}>Description</FieldLabel>
              <Textarea
                id={descriptionId}
                maxLength={1000}
                placeholder="Optional description for your team and AI agents."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={defaultId}>Default value</FieldLabel>
              <Textarea
                id={defaultId}
                className="min-h-8! py-1!"
                maxLength={4000}
                placeholder="Fallback if no value is provided"
                rows={1}
                value={defaultValue}
                onChange={(event) => setDefaultValue(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={(!nameLocked && !normalizedName) || duplicateName}>{variable ? "Save changes" : "Create variable"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VariableDeleteDialog({
  onDelete,
  onOpenChange,
  open,
  scope,
  usageCount,
  variable,
}: {
  onDelete: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: "site" | "site-defaults"
  usageCount: number
  variable: SiteVariableDefinition | null
}) {
  const places = usageCount === 1 ? "place" : "places"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {variable?.label ?? "variable"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {scope === "site-defaults"
              ? "This removes the variable from sites you create in the future. Existing sites are not affected."
              : usageCount > 0
              ? `This variable is used in ${usageCount} ${places} across the site. Those references will show as missing until they are replaced.`
              : "This variable is not currently used on the site."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>Delete variable</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
