const UUID_BYTES = 16
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function encodeWorkspaceInviteCode(invitationId: string) {
  if (!UUID_PATTERN.test(invitationId)) {
    throw new Error("Workspace invitation ID must be a UUID.")
  }

  return Buffer.from(invitationId.replaceAll("-", ""), "hex").toString("base64url")
}

export function decodeWorkspaceInviteCode(code: string) {
  const normalized = code.trim()
  if (!/^[A-Za-z0-9_-]{22}$/.test(normalized)) return null

  const bytes = Buffer.from(normalized, "base64url")
  if (bytes.length !== UUID_BYTES) return null

  const hex = bytes.toString("hex")
  const invitationId = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")

  return UUID_PATTERN.test(invitationId) ? invitationId : null
}
