import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { AuthFlowShell } from "@/features/auth/components/auth-flow-shell"
import { getApiErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { redeemWorkspaceInviteCode } from "./api"

export function JoinWorkspacePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initialCode = useMemo(
    () => new URLSearchParams(window.location.search).get("code")?.trim() ?? "",
    [],
  )
  const [code, setCode] = useState(initialCode)
  const mutation = useMutation({
    mutationFn: redeemWorkspaceInviteCode,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await navigate({ to: "/onboarding" })
    },
  })

  return (
    <AuthFlowShell>
      <form
        className="flex w-full flex-col items-center gap-9 px-6 py-12 sm:px-12 sm:py-14"
        onSubmit={(event) => {
          event.preventDefault()
          if (!code.trim() || mutation.isPending) return
          mutation.mutate(code)
        }}
      >
        <div className="flex w-full flex-col items-center gap-1 text-center">
          <h1 className="text-2xl leading-8 font-medium">Join a workspace</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Enter the invite code shared with you.
          </p>
        </div>

        <FieldGroup className="gap-2.5">
          <Field data-invalid={mutation.isError || undefined}>
            <Input
              id="workspace-invite-code"
              size="lg"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                if (mutation.isError) mutation.reset()
              }}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Workspace invite code"
              aria-invalid={mutation.isError || undefined}
              placeholder="Paste your invite code"
              disabled={mutation.isPending}
              required
            />
            {mutation.isError ? (
              <FieldError>
                {getApiErrorMessage(mutation.error, "That invite code is invalid or expired.")}
              </FieldError>
            ) : null}
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={!code.trim() || mutation.isPending}>
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Join workspace
          </Button>
        </FieldGroup>

        {mutation.isError ? (
          <Alert variant="destructive" className="w-full">
            <AlertTitle>Could not join workspace</AlertTitle>
            <AlertDescription>
              Check the code or ask the workspace admin for a new invitation.
            </AlertDescription>
          </Alert>
        ) : null}

        <a href="/onboarding" className="text-sm leading-5 text-muted-foreground underline">
          Create a new workspace instead
        </a>
      </form>
    </AuthFlowShell>
  )
}
