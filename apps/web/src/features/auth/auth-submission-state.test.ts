import { describe, expect, it } from "vitest"

import { getAuthSubmissionState } from "./auth-submission-state"

describe("getAuthSubmissionState", () => {
  it("only marks Google as loading during Google sign-in", () => {
    expect(getAuthSubmissionState("google")).toEqual({
      isSubmitting: true,
      isGoogleSubmitting: true,
      isEmailSubmitting: false,
      isOtpSubmitting: false,
    })
  })

  it("only marks email as loading while requesting an email code", () => {
    expect(getAuthSubmissionState("email")).toEqual({
      isSubmitting: true,
      isGoogleSubmitting: false,
      isEmailSubmitting: true,
      isOtpSubmitting: false,
    })
  })
})
