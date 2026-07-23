import { describe, expect, it } from "vitest"
import {
  decodeWorkspaceInviteCode,
  encodeWorkspaceInviteCode,
} from "./invite-code"

describe("workspace invite codes", () => {
  it("round-trips invitation UUIDs as compact URL-safe codes", () => {
    const invitationId = "00000000-0000-4000-8000-000000000301"
    const code = encodeWorkspaceInviteCode(invitationId)

    expect(code).toHaveLength(22)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeWorkspaceInviteCode(code)).toBe(invitationId)
  })

  it("rejects malformed codes", () => {
    expect(decodeWorkspaceInviteCode("not-an-invite-code")).toBeNull()
    expect(decodeWorkspaceInviteCode("")).toBeNull()
  })
})
