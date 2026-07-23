export type AuthSubmission = "google" | "email" | "otp" | "resend"

export function getAuthSubmissionState(activeSubmission: AuthSubmission | null) {
  return {
    isSubmitting: activeSubmission !== null,
    isGoogleSubmitting: activeSubmission === "google",
    isEmailSubmitting: activeSubmission === "email",
    isOtpSubmitting: activeSubmission === "otp",
  }
}
