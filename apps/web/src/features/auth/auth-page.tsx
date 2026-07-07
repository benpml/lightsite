import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { IconArrowRight, IconLock, IconMail, IconUserPlus } from "@tabler/icons-react"
import { normalizeEmail, validateWorkEmail } from "@lightsite/domain"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { getAppBootstrap } from "@/features/app-bootstrap/api"
import { getApiErrorMessage, isApiClientError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import { authClient } from "./auth-client"

type AuthMode = "sign-in" | "sign-up"

export function AuthPage() {
  const initialMode = useMemo<AuthMode>(() => {
    const mode = new URLSearchParams(window.location.search).get("mode")
    return mode === "sign-up" ? "sign-up" : "sign-in"
  }, [])
  const [mode, setMode] = useState<AuthMode>(initialMode)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page-background px-4 py-8 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1">
          <img src="/lightsite-logo.svg" alt="Lightsite" className="mb-3 h-[17px] w-[83px]" />
          <p className="text-sm font-medium text-muted-foreground">Lightsite</p>
          <h1 className="font-heading text-2xl leading-8 font-semibold tracking-normal">
            {mode === "sign-up" ? "Create your account" : "Sign in to Lightsite"}
          </h1>
        </div>
        <AuthCard mode={mode} onModeChange={setMode} />
      </div>
    </main>
  )
}

function AuthCard({
  mode,
  onModeChange,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => getAppBootstrap(signal),
    retry: false,
  })

  const normalizedEmail = normalizeEmail(email)
  const emailValidation = validateWorkEmail(email)
  const passwordIsValid = password.length >= 8
  const canSubmit = emailValidation.ok && passwordIsValid && !isSubmitting

  if (bootstrapQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You are signed in</CardTitle>
          <CardDescription>
            Continue to your workspace setup or go back to your sites.
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button asChild>
            <Link to="/onboarding">
              Continue
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sites">Sites</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const bootstrapError =
    bootstrapQuery.error && !isApiClientError(bootstrapQuery.error)
      ? getApiErrorMessage(bootstrapQuery.error, "Session check failed.")
      : null

  const switchMode = (nextMode: AuthMode) => {
    onModeChange(nextMode)
    setSubmitError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              name: getInitialAccountName(normalizedEmail),
              email: normalizedEmail,
              password,
            })
          : await authClient.signIn.email({
              email: normalizedEmail,
              password,
            })

      if (result.error) {
        throw new Error(getBetterAuthErrorMessage(result.error, mode))
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      await navigate({ to: "/onboarding" })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Try again in a moment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "sign-up" ? "Start with your work email" : "Welcome back"}</CardTitle>
        <CardDescription>
          {mode === "sign-up"
            ? "Use a work email and a password with at least 8 characters."
            : "Use the work email and password for your Lightsite account."}
        </CardDescription>
      </CardHeader>
      <form className="contents" onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}>
              <FieldLabel htmlFor="auth-email">Work email</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <IconMail />
                </InputGroupAddon>
                <InputGroupInput
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setSubmitError(null)
                  }}
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}
                  disabled={isSubmitting}
                />
              </InputGroup>
              {!emailValidation.ok && email.length > 0 ? (
                <FieldError>{emailValidation.message}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={!passwordIsValid && password.length > 0 ? true : undefined}>
              <FieldLabel htmlFor="auth-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <IconLock />
                </InputGroupAddon>
                <InputGroupInput
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setSubmitError(null)
                  }}
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  placeholder="At least 8 characters"
                  aria-invalid={!passwordIsValid && password.length > 0 ? true : undefined}
                  disabled={isSubmitting}
                />
              </InputGroup>
              {!passwordIsValid && password.length > 0 ? (
                <FieldError>Use at least 8 characters.</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
          {submitError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>{mode === "sign-up" ? "Account was not created" : "Sign in failed"}</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          {bootstrapError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Session check failed</AlertTitle>
              <AlertDescription>{bootstrapError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={!canSubmit} className="sm:min-w-28">
            {isSubmitting ? (
              <Spinner data-icon="inline-start" />
            ) : mode === "sign-up" ? (
              <IconUserPlus data-icon="inline-start" />
            ) : null}
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")}
          >
            {mode === "sign-up" ? "I already have an account" : "Create an account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function getInitialAccountName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Lightsite user"
}

function getBetterAuthErrorMessage(
  error: { message?: string; code?: string; status?: number },
  mode: AuthMode,
) {
  if (error.code === "email.personal_domain_blocked") {
    return "Use your company email to sign up for Lightsite."
  }

  if (error.code === "email.plus_addressing_blocked") {
    return "Use your work email without a plus alias."
  }

  if (error.message) {
    return error.message
  }

  return mode === "sign-up" ? "Create account failed." : "Check your email and password."
}

