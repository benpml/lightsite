import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { LIGHTSITE_TEXT_LIMITS, normalizeEmail, validateWorkEmail } from "@lightsite/domain"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/api/query-keys"
import {
  enableDevAuthBypass,
  isDevAuthBypassAvailable,
} from "@/lib/api/dev-auth-bypass"
import { cn } from "@/lib/utils"

import { authClient } from "./auth-client"

type AuthMode = "sign-in" | "sign-up"

export function AuthPage() {
  const returnTo = useMemo(() => getSafeExtensionReturnTo(), [])
  const initialMode = useMemo<AuthMode>(() => {
    const mode = new URLSearchParams(window.location.search).get("mode")
    return mode === "sign-up" ? "sign-up" : "sign-in"
  }, [])
  const [mode, setMode] = useState<AuthMode>(initialMode)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 text-foreground md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/auth" className="flex items-center gap-2 self-center font-medium">
          <img src="/lightsite-logo.svg" alt="Lightsite" className="h-[17px] w-[83px]" />
        </Link>
        <LoginForm mode={mode} onModeChange={setMode} returnTo={returnTo} />
      </div>
    </div>
  )
}

function LoginForm({
  className,
  mode,
  onModeChange,
  returnTo,
  ...props
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  returnTo: string | null
} & React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizedEmail = normalizeEmail(email)
  const emailValidation = validateWorkEmail(email)
  const passwordIsValid = password.length >= 8
  const canSubmit = emailValidation.ok && passwordIsValid && !isSubmitting

  const switchMode = (nextMode: AuthMode) => {
    onModeChange(nextMode)
    setSubmitError(null)
    const params = new URLSearchParams()
    if (nextMode === "sign-up") params.set("mode", "sign-up")
    if (returnTo) params.set("returnTo", returnTo)
    window.history.replaceState(null, "", `/auth${params.size ? `?${params}` : ""}`)
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
      if (returnTo) {
        window.location.replace(returnTo)
      } else {
        await navigate({ to: "/onboarding" })
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Try again in a moment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const continueLocally = async () => {
    enableDevAuthBypass()
    await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    if (returnTo) {
      window.location.replace(returnTo)
    } else {
      await navigate({ to: "/sites" })
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "sign-up" ? "Create your account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {mode === "sign-up"
              ? "Sign up with your Apple or Google account"
              : "Login with your Apple or Google account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button">
                  <svg data-icon="inline-start" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  {mode === "sign-up" ? "Sign up with Apple" : "Login with Apple"}
                </Button>
                <Button variant="outline" type="button">
                  <svg data-icon="inline-start" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {mode === "sign-up" ? "Sign up with Google" : "Login with Google"}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field data-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  maxLength={LIGHTSITE_TEXT_LIMITS.email}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setSubmitError(null)
                  }}
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  aria-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}
                  disabled={isSubmitting}
                />
                {!emailValidation.ok && email.length > 0 ? (
                  <FieldError>{emailValidation.message}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={!passwordIsValid && password.length > 0 ? true : undefined}>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                    onClick={(event) => event.preventDefault()}
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  maxLength={LIGHTSITE_TEXT_LIMITS.password}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setSubmitError(null)
                  }}
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  required
                  aria-invalid={!passwordIsValid && password.length > 0 ? true : undefined}
                  disabled={isSubmitting}
                />
                {!passwordIsValid && password.length > 0 ? (
                  <FieldError>Use at least 8 characters.</FieldError>
                ) : null}
              </Field>
              <AuthErrorAlert mode={mode} submitError={submitError} />
              {isDevAuthBypassAvailable() ? (
                <Field>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    Local development
                  </FieldSeparator>
                  <Button variant="secondary" type="button" onClick={() => void continueLocally()}>
                    Continue locally
                  </Button>
                </Field>
              ) : null}
              <Field data-disabled={!canSubmit ? true : undefined}>
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  {mode === "sign-up" ? "Create account" : "Login"}
                </Button>
                <FieldDescription className="text-center">
                  {mode === "sign-up" ? "Already have an account?" : "Don't have an account?"}{" "}
                  <a
                    href={buildAuthModeHref(mode === "sign-up" ? "sign-in" : "sign-up", returnTo)}
                    onClick={(event) => {
                      event.preventDefault()
                      switchMode(mode === "sign-up" ? "sign-in" : "sign-up")
                    }}
                  >
                    {mode === "sign-up" ? "Sign in" : "Sign up"}
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="#" onClick={(event) => event.preventDefault()}>
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" onClick={(event) => event.preventDefault()}>
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  )
}

function AuthErrorAlert({
  mode,
  submitError,
}: {
  mode: AuthMode
  submitError: string | null
}) {
  if (!submitError) {
    return null
  }

  return (
    <Field>
      <Alert variant="destructive">
        <AlertTitle>{mode === "sign-up" ? "Account was not created" : "Login failed"}</AlertTitle>
        <AlertDescription>{submitError}</AlertDescription>
      </Alert>
    </Field>
  )
}

function getInitialAccountName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Lightsite user"
}

function getSafeExtensionReturnTo() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo")
  if (!returnTo) return null
  try {
    const url = new URL(returnTo, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname !== "/extension-connect") {
      return null
    }
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function buildAuthModeHref(mode: AuthMode, returnTo: string | null) {
  const params = new URLSearchParams()
  if (mode === "sign-up") params.set("mode", "sign-up")
  if (returnTo) params.set("returnTo", returnTo)
  return `/auth${params.size ? `?${params}` : ""}`
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
