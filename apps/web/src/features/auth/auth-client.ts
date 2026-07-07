import { createAuthClient } from "better-auth/react"

const apiOrigin = import.meta.env.VITE_API_ORIGIN?.trim()

export const authClient = createAuthClient(
  apiOrigin ? { baseURL: apiOrigin } : undefined,
)

