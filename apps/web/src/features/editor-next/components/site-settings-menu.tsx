import { useId, useMemo, useState } from "react"
import {
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconPalette,
  IconTrash,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"

import type { EditorNextThemeMode } from "../types"

type EditorNextSiteSettingsMenuProps = {
  isDeletingSite: boolean
  isDuplicatingSite: boolean
  isRenamingSite: boolean
  onDeleteSite: () => Promise<void>
  onDuplicateSite: () => Promise<void>
  onRenameSite: (name: string) => Promise<void>
  onThemeModeChange: (mode: EditorNextThemeMode) => void
  siteName: string
  themeMode: EditorNextThemeMode
}

const deleteConfirmationPhrase = "delete site"

const themeOptions: Array<{
  description: string
  label: string
  value: EditorNextThemeMode
}> = [
  {
    value: "dark",
    label: "Dark only",
    description: "Always show this site editor in dark mode.",
  },
  {
    value: "light",
    label: "Light only",
    description: "Always show this site editor in light mode.",
  },
  {
    value: "system",
    label: "System theme",
    description: "Follow the appearance setting from this device.",
  },
]

export function EditorNextSiteSettingsMenu({
  isDeletingSite,
  isDuplicatingSite,
  isRenamingSite,
  onDeleteSite,
  onDuplicateSite,
  onRenameSite,
  onThemeModeChange,
  siteName,
  themeMode,
}: EditorNextSiteSettingsMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateError, setDuplicateError] = useState("")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-compact"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Site settings"
          >
            <IconDotsVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Site settings</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <IconEdit />
              Rename site
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isDuplicatingSite}
              onSelect={(event) => {
                event.preventDefault()
                setDuplicateError("")
                void onDuplicateSite().catch((error) => {
                  setDuplicateError(getActionErrorMessage(error, "Site could not be duplicated."))
                })
              }}
            >
              {isDuplicatingSite ? <Spinner /> : <IconCopy />}
              Duplicate site
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setThemeOpen(true)}>
              <IconPalette />
              Color themes
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <IconTrash />
              Delete site
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {duplicateError ? (
            <>
              <DropdownMenuSeparator />
              <div className="px-1.5 py-1 text-xs leading-4 text-destructive">
                {duplicateError}
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameSiteDialog
        key={renameOpen ? `rename-${siteName}` : "rename-closed"}
        isSaving={isRenamingSite}
        onOpenChange={setRenameOpen}
        onRenameSite={onRenameSite}
        open={renameOpen}
        siteName={siteName}
      />
      <ColorThemeDialog
        onOpenChange={setThemeOpen}
        onThemeModeChange={onThemeModeChange}
        open={themeOpen}
        themeMode={themeMode}
      />
      <DeleteSiteDialog
        key={deleteOpen ? "delete-open" : "delete-closed"}
        isDeleting={isDeletingSite}
        onDeleteSite={onDeleteSite}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        siteName={siteName}
      />
    </>
  )
}

function RenameSiteDialog({
  isSaving,
  onOpenChange,
  onRenameSite,
  open,
  siteName,
}: {
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onRenameSite: (name: string) => Promise<void>
  open: boolean
  siteName: string
}) {
  const inputId = useId()
  const [name, setName] = useState(siteName)
  const [error, setError] = useState("")
  const normalizedName = name.trim().replace(/\s+/g, " ")
  const nameIsEmpty = normalizedName.length === 0
  const nameIsUnchanged = normalizedName === siteName.trim().replace(/\s+/g, " ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename site</DialogTitle>
          <DialogDescription>
            Update the internal site name your team sees in Lightsite.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()

            if (nameIsEmpty || nameIsUnchanged) {
              return
            }

            setError("")
            void onRenameSite(normalizedName)
              .then(() => onOpenChange(false))
              .catch((renameError) => {
                setError(getActionErrorMessage(renameError, "Site could not be renamed."))
              })
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(error) || nameIsEmpty || undefined}>
              <FieldLabel htmlFor={inputId}>Site name</FieldLabel>
              <Input
                id={inputId}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError("")
                }}
                aria-invalid={Boolean(error) || nameIsEmpty || undefined}
                disabled={isSaving}
                autoComplete="off"
              />
              {nameIsEmpty ? (
                <FieldDescription className="text-destructive">
                  Enter a site name.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Rename failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || nameIsEmpty || nameIsUnchanged}>
              {isSaving ? <Spinner data-icon="inline-start" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ColorThemeDialog({
  onOpenChange,
  onThemeModeChange,
  open,
  themeMode,
}: {
  onOpenChange: (open: boolean) => void
  onThemeModeChange: (mode: EditorNextThemeMode) => void
  open: boolean
  themeMode: EditorNextThemeMode
}) {
  const themeDescription = useMemo(
    () => themeOptions.find((option) => option.value === themeMode)?.description ?? "",
    [themeMode]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Color themes</DialogTitle>
          <DialogDescription>
            Choose how the editor preview should render this site while you work.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <RadioGroup
            value={themeMode}
            onValueChange={(value) => onThemeModeChange(value as EditorNextThemeMode)}
            aria-label="Color theme"
            className="gap-2"
          >
            {themeOptions.map((option) => (
              <Field key={option.value} orientation="horizontal">
                <RadioGroupItem id={`site-theme-${option.value}`} value={option.value} />
                <FieldContent>
                  <FieldLabel htmlFor={`site-theme-${option.value}`}>{option.label}</FieldLabel>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <DialogFooter>
          <p className="mr-auto text-sm leading-5 text-muted-foreground">{themeDescription}</p>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSiteDialog({
  isDeleting,
  onDeleteSite,
  onOpenChange,
  open,
  siteName,
}: {
  isDeleting: boolean
  onDeleteSite: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  siteName: string
}) {
  const inputId = useId()
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const canConfirm = confirmation.trim().toLowerCase() === deleteConfirmationPhrase

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete site?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {siteName} from active sites and sends you back to the sites list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor={inputId}>Type delete site to confirm</FieldLabel>
            <Input
              id={inputId}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError("")
              }}
              aria-invalid={Boolean(error) || undefined}
              disabled={isDeleting}
              autoComplete="off"
            />
          </Field>
        </FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Delete failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!canConfirm || isDeleting}
            onClick={(event) => {
              event.preventDefault()
              setError("")
              void onDeleteSite()
                .then(() => onOpenChange(false))
                .catch((deleteError) => {
                  setError(getActionErrorMessage(deleteError, "Site could not be deleted."))
                })
            }}
          >
            {isDeleting ? <Spinner data-icon="inline-start" /> : null}
            Delete site
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
