import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { IconCirclePlus } from "@tabler/icons-react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getApiErrorMessage, getApiFieldError, isApiClientError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { createSite } from "../api"

type CreateSiteDialogProps = {
  onOpenChange?: (open: boolean) => void
  open?: boolean
  trigger?: React.ReactNode
  workspaceId: string
  workspaceSlug: string
}

export function CreateSiteDialog({
  onOpenChange,
  open: controlledOpen,
  trigger,
  workspaceId,
  workspaceSlug,
}: CreateSiteDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [name, setName] = useState("")
  const slug = slugify(name) || "new-site"
  const createSiteMutation = useMutation({
    mutationFn: createSite,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sites(workspaceId) })
      setOpen(false)
      setName("")
      await navigate({
        to: "/edit/$siteId",
        params: { siteId: data.site.id },
      })
    },
  })
  const nameError = getApiFieldError(createSiteMutation.error, "name")
  const hasNameError = Boolean(nameError)
  const isPlanLimitError =
    isApiClientError(createSiteMutation.error) && createSiteMutation.error.code === "site.limit_reached"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="compact">
            <IconCirclePlus data-icon="inline-start" />
            Create a site
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create site</DialogTitle>
          <DialogDescription>
            Start with a private draft. Publishing creates the prospect-facing link.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            createSiteMutation.mutate({ name })
          }}
        >
          <FieldGroup>
            <Field data-invalid={hasNameError || undefined}>
              <FieldLabel htmlFor="site-name">Site name</FieldLabel>
              <Input
                id="site-name"
                maxLength={LIGHTSITE_TEXT_LIMITS.siteName}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (createSiteMutation.isError) {
                    createSiteMutation.reset()
                  }
                }}
                placeholder="Acme rollout brief"
                aria-invalid={hasNameError || undefined}
                disabled={createSiteMutation.isPending}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
              <FieldDescription>
                Draft URL preview: /{workspaceSlug}/{slug}
              </FieldDescription>
            </Field>
          </FieldGroup>
          {createSiteMutation.isError && !nameError ? (
            <Alert variant="destructive">
              <AlertTitle>Site was not created</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(createSiteMutation.error, "Try again in a moment.")}
              </AlertDescription>
              {isPlanLimitError ? (
                <AlertAction>
                  <Button
                    size="compact"
                    variant="outline"
                    type="button"
                    onClick={() => void navigate({ to: "/billing" })}
                  >
                    View plans
                  </Button>
                </AlertAction>
              ) : null}
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="text-tertiary-foreground hover:text-tertiary-foreground focus-visible:text-tertiary-foreground"
              disabled={createSiteMutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSiteMutation.isPending}>
              {createSiteMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create and open editor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
