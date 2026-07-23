import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const authFlowShellSource = readFileSync(
  new URL("./components/auth-flow-shell.tsx", import.meta.url),
  "utf8",
)
const trackingSettingsSource = readFileSync(
  new URL("../site-settings/components/tracking-settings.tsx", import.meta.url),
  "utf8",
)

describe("legal acceptance surfaces", () => {
  it("presents the Terms and Privacy Policy beside account creation", () => {
    expect(authFlowShellSource).toContain(
      "By clicking continue, you agree to our",
    )
    expect(authFlowShellSource).toContain("HANDOUT_TERMS_OF_SERVICE_URL")
    expect(authFlowShellSource).toContain("HANDOUT_PRIVACY_POLICY_URL")
    expect(authFlowShellSource).toContain("Terms")
    expect(authFlowShellSource).toContain("Privacy Policy")
  })

  it("links replay acceptance to the versioned public addendum and Terms", () => {
    expect(trackingSettingsSource).toContain(
      'href={`${HANDOUT_TERMS_OF_SERVICE_URL}#tracking-replay`}',
    )
    expect(trackingSettingsSource).toContain("Session Replay Addendum")
    expect(trackingSettingsSource).toContain("Terms of Service")
  })
})
