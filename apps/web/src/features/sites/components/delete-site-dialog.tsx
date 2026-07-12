import { useId, useState } from "react"
import { IconX } from "@tabler/icons-react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type DeleteSiteDialogProps = {
  isDeleting: boolean
  onDeleteSite: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  siteName: string
}

const deleteConfirmationPhrase = "delete site"

export function DeleteSiteDialog({
  isDeleting,
  onDeleteSite,
  onOpenChange,
  open,
  siteName,
}: DeleteSiteDialogProps) {
  const inputId = useId()
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const canConfirm = confirmation.trim().toLowerCase() === deleteConfirmationPhrase

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogCancel
          aria-label="Close delete site modal"
          className="absolute top-2 right-2"
          disabled={isDeleting}
          size="icon-field"
          variant="ghost"
        >
          <IconX />
        </AlertDialogCancel>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete site?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {siteName} everywhere, including for all recipients. This
            cannot be reversed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor={inputId} className="block">
              Type <span className="text-destructive">{deleteConfirmationPhrase}</span> to confirm
            </FieldLabel>
            <Input
              id={inputId}
              maxLength={LIGHTSITE_TEXT_LIMITS.deleteConfirmation}
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
