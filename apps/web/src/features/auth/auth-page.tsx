import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { normalizeEmail, validateEmail } from "@handout/domain"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/api/query-keys"
import {
  enableDevAuthBypass,
  isDevAuthBypassAvailable,
} from "@/lib/api/dev-auth-bypass"

import { AuthFlowShell } from "./components/auth-flow-shell"
import { authClient } from "./auth-client"
import {
  getAuthSubmissionState,
  type AuthSubmission,
} from "./auth-submission-state"

type AuthMode = "sign-in" | "sign-up"
type AuthStep = "email" | "otp"

export function AuthPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const returnTo = useMemo(() => getSafeAuthReturnTo(), [])
  const initialMode = useMemo<AuthMode>(() => {
    return new URLSearchParams(window.location.search).get("mode") === "sign-up"
      ? "sign-up"
      : "sign-in"
  }, [])
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [step, setStep] = useState<AuthStep>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [activeSubmission, setActiveSubmission] = useState<AuthSubmission | null>(null)
  const [resent, setResent] = useState(false)

  const normalizedEmail = normalizeEmail(email)
  const emailValidation = validateEmail(email)
  const {
    isSubmitting,
    isGoogleSubmitting,
    isEmailSubmitting,
    isOtpSubmitting,
  } = getAuthSubmissionState(activeSubmission)

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStep("email")
    setOtp("")
    setSubmitError(null)
    setResent(false)

    const params = new URLSearchParams()
    if (nextMode === "sign-up") params.set("mode", nextMode)
    if (returnTo) params.set("returnTo", returnTo)
    window.history.replaceState(null, "", `/auth${params.size ? `?${params}` : ""}`)
  }

  const sendOtp = async (
    event?: React.FormEvent<HTMLFormElement>,
    submission: Extract<AuthSubmission, "email" | "resend"> = "email",
  ) => {
    event?.preventDefault()
    setSubmitError(null)
    setResent(false)

    if (!emailValidation.ok || isSubmitting) return false

    setActiveSubmission(submission)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      })
      if (result.error) throw new Error(result.error.message)
      setStep("otp")
      return true
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, "We could not send a verification code."))
      return false
    } finally {
      setActiveSubmission(null)
    }
  }

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    if (otp.length !== 6 || isSubmitting) return

    setActiveSubmission("otp")
    try {
      const result = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp,
        name: getInitialAccountName(normalizedEmail),
      })
      if (result.error) throw new Error(result.error.message)

      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      if (returnTo) {
        window.location.replace(returnTo)
      } else {
        await navigate({ to: "/onboarding" })
      }
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, "That code is invalid or expired."))
    } finally {
      setActiveSubmission(null)
    }
  }

  const signInWithGoogle = async () => {
    setSubmitError(null)
    if (isSubmitting) return

    setActiveSubmission("google")
    try {
      const callbackURL = returnTo ?? "/onboarding"
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: `/auth${mode === "sign-up" ? "?mode=sign-up" : ""}`,
      })
      if (result?.error) throw new Error(result.error.message)
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, "Google sign-in could not be started."))
      setActiveSubmission(null)
    }
  }

  const continueLocally = async () => {
    enableDevAuthBypass()
    await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    await navigate({ to: "/onboarding" })
  }

  return (
    <AuthFlowShell showLegalAgreement>
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 sm:px-12 sm:py-14">
        {step === "email" ? (
          <form className="flex w-full flex-col items-center gap-6" onSubmit={sendOtp}>
            <AuthHeading
              title={mode === "sign-up" ? "Create your account" : "Log in"}
              description={
                mode === "sign-up"
                  ? "Select an option below to get started."
                  : "Sign into your account below."
              }
            />

            <div className="flex w-full flex-col gap-5">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => void signInWithGoogle()}
              >
                {isGoogleSubmitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <img
                    src="/auth/google-logo.svg"
                    alt=""
                    data-icon="inline-start"
                    className="size-4"
                  />
                )}
                Sign in with Google
              </Button>

              <div className="flex w-full items-center">
                <Separator className="flex-1" />
                <span className="px-2 text-xs leading-4 text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

              <FieldGroup className="gap-2.5">
                <Field data-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}>
                  <Input
                    id="auth-email"
                    type="email"
                    size="lg"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setSubmitError(null)
                    }}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    aria-label="Email address"
                    aria-invalid={!emailValidation.ok && email.length > 0 ? true : undefined}
                    disabled={isSubmitting}
                    required
                  />
                  {!emailValidation.ok && email.length > 0 ? (
                    <FieldError>{emailValidation.message}</FieldError>
                  ) : null}
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={!emailValidation.ok || isSubmitting}>
                  {isEmailSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  Sign in with email
                </Button>
              </FieldGroup>
            </div>

            <AuthError message={submitError} />

            <p className="text-center text-sm leading-5 text-muted-foreground">
              {mode === "sign-up" ? "Already have an account? " : "Don’t have an account yet? "}
              <button
                type="button"
                className="underline"
                onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")}
              >
                {mode === "sign-up" ? "Log in" : "Sign up"}
              </button>
            </p>

            {isDevAuthBypassAvailable() ? (
              <Button type="button" variant="ghost" onClick={() => void continueLocally()}>
                Continue locally
              </Button>
            ) : null}
          </form>
        ) : (
          <form className="flex w-full flex-col items-center gap-9" onSubmit={verifyOtp}>
            <AuthHeading
              title="Enter verification code"
              description="We sent a 6-digit code to your email address"
            />

            <div className="flex w-full flex-col gap-6">
              <Field data-invalid={Boolean(submitError) || undefined}>
                <InputOTP
                  id="auth-verification-code"
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value)
                    setSubmitError(null)
                  }}
                  autoFocus
                  disabled={isSubmitting}
                  aria-invalid={Boolean(submitError) || undefined}
                  containerClassName="w-full"
                >
                  <InputOTPGroup className="w-full gap-2.5">
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="size-auto h-[52px] min-w-0 flex-1 rounded-lg border bg-background text-2xl shadow-xs first:rounded-lg first:border last:rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={otp.length !== 6 || isSubmitting}>
                {isOtpSubmitting ? <Spinner data-icon="inline-start" /> : null}
                Verify
              </Button>
            </div>

            <AuthError message={submitError} />

            <p className="text-center text-sm leading-5 text-muted-foreground">
              Didn’t receive the code?{" "}
              <button
                type="button"
                className="underline disabled:opacity-50"
                disabled={isSubmitting}
                onClick={() => {
                  void sendOtp(undefined, "resend").then((sent) => {
                    if (sent) setResent(true)
                  })
                }}
              >
                {resent ? "Sent" : "Resend"}
              </button>
            </p>

          </form>
        )}
      </div>
    </AuthFlowShell>
  )
}

function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-1 text-center">
      <h1 className="text-2xl leading-8 font-medium">{title}</h1>
      <p className="text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function AuthError({ message }: { message: string | null }) {
  return message ? (
    <Alert variant="destructive" className="w-full">
      <AlertTitle>Could not continue</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null
}

function getInitialAccountName(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Handout user"
}

function getSafeAuthReturnTo() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo")
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) return null
  return returnTo
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  if (/too many|rate limit/i.test(error.message)) {
    return "Too many attempts. Wait a minute, then request a new code."
  }
  return error.message || fallback
}
