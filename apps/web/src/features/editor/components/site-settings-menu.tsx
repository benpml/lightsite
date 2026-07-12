import { memo, useId, useMemo, useState } from "react"
import {
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconPalette,
  IconTrash,
} from "@tabler/icons-react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { DeleteSiteDialog } from "@/features/sites/components/delete-site-dialog"

import type { SiteThemeMode } from "../types"

type EditorSiteSettingsMenuProps = {
  isDeletingSite: boolean
  isDuplicatingSite: boolean
  isRenamingSite: boolean
  onDeleteSite: () => Promise<void>
  onDuplicateSite: () => Promise<void>
  onRenameSite: (name: string) => Promise<void>
  onSiteThemeModeChange: (mode: SiteThemeMode) => void
  siteName: string
  siteThemeMode: SiteThemeMode
}

const themeOptions: Array<{
  description: string
  label: string
  value: SiteThemeMode
}> = [
  {
    value: "dark",
    label: "Dark only",
    description: "Always publish and share this site in dark mode.",
  },
  {
    value: "light",
    label: "Light only",
    description: "Always publish and share this site in light mode.",
  },
  {
    value: "system",
    label: "System theme",
    description: "Match the visitor's device appearance setting.",
  },
]

export const EditorSiteSettingsMenu = memo(function EditorSiteSettingsMenu({
  isDeletingSite,
  isDuplicatingSite,
  isRenamingSite,
  onDeleteSite,
  onDuplicateSite,
  onRenameSite,
  onSiteThemeModeChange,
  siteName,
  siteThemeMode,
}: EditorSiteSettingsMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateError, setDuplicateError] = useState("")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({
            variant: "ghost",
            size: "icon-compact",
            className: "hover:text-accent-foreground",
          })}
          aria-label="Site settings"
          title="Site settings"
        >
          <IconDotsVertical />
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
              Page theme
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
        onSiteThemeModeChange={onSiteThemeModeChange}
        open={themeOpen}
        siteThemeMode={siteThemeMode}
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
})

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
                maxLength={LIGHTSITE_TEXT_LIMITS.siteName}
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
            <Button
              type="button"
              variant="outline"
              className="text-tertiary-foreground hover:text-tertiary-foreground focus-visible:text-tertiary-foreground"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
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
  onSiteThemeModeChange,
  open,
  siteThemeMode,
}: {
  onOpenChange: (open: boolean) => void
  onSiteThemeModeChange: (mode: SiteThemeMode) => void
  open: boolean
  siteThemeMode: SiteThemeMode
}) {
  const themeDescription = useMemo(
    () => themeOptions.find((option) => option.value === siteThemeMode)?.description ?? "",
    [siteThemeMode]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page theme</DialogTitle>
          <DialogDescription>
            Choose how the published page and recipient links should render this site.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <RadioGroup
            value={siteThemeMode}
            onValueChange={(value) => onSiteThemeModeChange(value as SiteThemeMode)}
            aria-label="Published page color theme"
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

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
