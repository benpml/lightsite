import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { HANDOUT_TEXT_LIMITS, normalizeEmail, validateEmail } from "@handout/domain"

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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/api/query-keys"
import {
  enableDevAuthBypass,
  isDevAuthBypassAvailable,
} from "@/lib/api/dev-auth-bypass"
import { cn } from "@/lib/utils"

import { authClient } from "./auth-client"

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verify-email"

const pendingVerificationEmailKey = "handout:pending-verification-email"

export function AuthPage() {
  const returnTo = useMemo(() => getSafeAuthReturnTo(), [])
  const initialMode = useMemo<AuthMode>(() => {
    const mode = new URLSearchParams(window.location.search).get("mode")
    if (mode === "sign-up" || mode === "forgot-password" || mode === "verify-email") {
      return mode
    }
    return "sign-in"
  }, [])
  const [mode, setMode] = useState<AuthMode>(initialMode)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 text-foreground md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="flex items-center gap-2 self-center font-medium">
          <img src="/handout-logo.svg" alt="Handout" className="h-[17px] w-[85px]" />
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(
    () => window.sessionStorage.getItem(pendingVerificationEmailKey) ?? "",
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizedEmail = normalizeEmail(email)
  const emailValidation = validateEmail(email)
  const passwordIsValid = password.length >= 8
  const canSubmit = emailValidation.ok && passwordIsValid && !isSubmitting

  const switchMode = (nextMode: AuthMode) => {
    onModeChange(nextMode)
    setSubmitError(null)
    const params = new URLSearchParams()
    if (nextMode !== "sign-in") params.set("mode", nextMode)
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
        if (mode === "sign-in" && result.error.code === "EMAIL_NOT_VERIFIED") {
          window.sessionStorage.setItem(pendingVerificationEmailKey, normalizedEmail)
          setPendingVerificationEmail(normalizedEmail)
          switchMode("verify-email")
          return
        }
        throw new Error(getBetterAuthErrorMessage(result.error, mode))
      }

      if (mode === "sign-up") {
        window.sessionStorage.setItem(pendingVerificationEmailKey, normalizedEmail)
        setPendingVerificationEmail(normalizedEmail)
        switchMode("verify-email")
        return
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

  if (mode === "verify-email") {
    return (
      <VerifyEmailForm
        email={pendingVerificationEmail}
        onBack={() => switchMode("sign-in")}
        returnTo={returnTo}
      />
    )
  }

  if (mode === "forgot-password") {
    return (
      <ForgotPasswordForm
        initialEmail={email}
        onBack={() => switchMode("sign-in")}
      />
    )
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
              ? "Create your account with your email"
              : "Log in with your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  maxLength={HANDOUT_TEXT_LIMITS.email}
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
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  maxLength={HANDOUT_TEXT_LIMITS.password}
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
                {mode === "sign-in" ? (
                  <FieldDescription className="text-right">
                    <a
                      href="/auth?mode=forgot-password"
                      onClick={(event) => {
                        event.preventDefault()
                        switchMode("forgot-password")
                      }}
                    >
                      Forgot password?
                    </a>
                  </FieldDescription>
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
        Create and manage your Handout account.
      </FieldDescription>
    </div>
  )
}

function VerifyEmailForm({
  email,
  onBack,
  returnTo,
}: {
  email: string
  onBack: () => void
  returnTo: string | null
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [resent, setResent] = useState(false)

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email || code.length !== 6 || pending) return
    setPending(true)
    setError("")

    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code })
      if (result.error) {
        throw new Error(result.error.message ?? "That code is invalid or expired.")
      }
      window.sessionStorage.removeItem(pendingVerificationEmailKey)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      if (returnTo) {
        window.location.replace(returnTo)
      } else {
        await navigate({ to: "/onboarding" })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code is invalid or expired.")
    } finally {
      setPending(false)
    }
  }

  const resend = async () => {
    if (!email || pending) return
    setPending(true)
    setError("")
    setResent(false)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })
      if (result.error) throw new Error(result.error.message)
      setResent(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A new code could not be sent.")
    } finally {
      setPending(false)
    }
  }

  if (!email) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verify your email</CardTitle>
          <CardDescription>Return to sign in so we know where to send your code.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onBack}>Back to sign in</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Check your email</CardTitle>
        <CardDescription>Enter the 6-digit code sent to {email}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={verify}>
          <FieldGroup>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="verification-code">Verification code</FieldLabel>
              <InputOTP
                id="verification-code"
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value)
                  setError("")
                }}
                disabled={pending}
                aria-invalid={Boolean(error) || undefined}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error ? <FieldError>{error}</FieldError> : null}
              {resent ? <FieldDescription>A new code was sent.</FieldDescription> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending || code.length !== 6}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Verify email
              </Button>
              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                <button type="button" onClick={() => void resend()} disabled={pending}>
                  Resend code
                </button>
                {" · "}
                <button type="button" onClick={onBack}>Use another email</button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function ForgotPasswordForm({
  initialEmail,
  onBack,
}: {
  initialEmail: string
  onBack: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const validation = validateEmail(email)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validation.ok || pending) return
    setPending(true)
    setError("")
    try {
      const result = await authClient.requestPasswordReset({
        email: validation.email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (result.error) throw new Error(result.error.message)
      setSent(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset instructions could not be sent.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          {sent
            ? "If an account exists for that email, a reset link is on its way."
            : "Enter your email and we'll send you a secure reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <FieldGroup>
            <Alert>
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>The link expires in 60 minutes and can only be used once.</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={onBack}>Back to sign in</Button>
          </FieldGroup>
        ) : (
          <form onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={Boolean(error) || (!validation.ok && email.length > 0) || undefined}>
                <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError("")
                  }}
                  autoComplete="email"
                  disabled={pending}
                  aria-invalid={Boolean(error) || (!validation.ok && email.length > 0) || undefined}
                />
                {error ? <FieldError>{error}</FieldError> : null}
                {!error && !validation.ok && email.length > 0 ? (
                  <FieldError>{validation.message}</FieldError>
                ) : null}
              </Field>
              <Field>
                <Button type="submit" disabled={!validation.ok || pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Send reset link
                </Button>
                <Button type="button" variant="ghost" onClick={onBack}>Back to sign in</Button>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
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
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Handout user"
}

function getSafeAuthReturnTo() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo")
  if (!returnTo) return null
  try {
    const url = new URL(returnTo, window.location.origin)
    const allowedPath = url.pathname === "/extension-connect"
      || url.pathname === "/api/mcp/oauth/authorize"
    if (url.origin !== window.location.origin || !allowedPath) {
      return null
    }
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function buildAuthModeHref(mode: AuthMode, returnTo: string | null) {
  const params = new URLSearchParams()
  if (mode !== "sign-in") params.set("mode", mode)
  if (returnTo) params.set("returnTo", returnTo)
  return `/auth${params.size ? `?${params}` : ""}`
}

function getBetterAuthErrorMessage(
  error: { message?: string; code?: string; status?: number },
  mode: AuthMode,
) {
  if (error.message) {
    return error.message
  }

  return mode === "sign-up" ? "Create account failed." : "Check your email and password."
}
