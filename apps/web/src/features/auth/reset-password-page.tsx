import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

import { authClient } from "./auth-client"

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", [])
  const invalidToken = useMemo(
    () => new URLSearchParams(window.location.search).get("error") === "INVALID_TOKEN" || !token,
    [token],
  )
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirmation

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (invalidToken || !passwordValid || !passwordsMatch || pending) return
    setPending(true)
    setError("")
    try {
      const result = await authClient.resetPassword({ newPassword: password, token })
      if (result.error) throw new Error(result.error.message)
      await navigate({ to: "/auth" })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your password could not be reset.")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 text-foreground md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="flex items-center gap-2 self-center font-medium">
          <img src="/handout-logo.svg" alt="Handout" className="h-[17px] w-[85px]" />
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Choose a new password</CardTitle>
            <CardDescription>Use at least 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            {invalidToken ? (
              <FieldGroup>
                <Alert variant="destructive">
                  <AlertTitle>This reset link is invalid</AlertTitle>
                  <AlertDescription>It may have expired or already been used.</AlertDescription>
                </Alert>
                <Button asChild>
                  <a href="/auth?mode=forgot-password">Request a new link</a>
                </Button>
              </FieldGroup>
            ) : (
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field data-invalid={Boolean(error) || (!passwordValid && password.length > 0) || undefined}>
                    <FieldLabel htmlFor="new-password">New password</FieldLabel>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setError("")
                      }}
                      autoComplete="new-password"
                      disabled={pending}
                      aria-invalid={Boolean(error) || (!passwordValid && password.length > 0) || undefined}
                    />
                    {!passwordValid && password.length > 0 ? (
                      <FieldError>Use at least 8 characters.</FieldError>
                    ) : null}
                  </Field>
                  <Field data-invalid={!passwordsMatch && confirmation.length > 0 || undefined}>
                    <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmation}
                      onChange={(event) => {
                        setConfirmation(event.target.value)
                        setError("")
                      }}
                      autoComplete="new-password"
                      disabled={pending}
                      aria-invalid={!passwordsMatch && confirmation.length > 0 || undefined}
                    />
                    {!passwordsMatch && confirmation.length > 0 ? (
                      <FieldError>Passwords do not match.</FieldError>
                    ) : null}
                  </Field>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertTitle>Password was not reset</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <Button type="submit" disabled={!passwordValid || !passwordsMatch || pending}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    Reset password
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
