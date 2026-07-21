import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"

const apiOrigin = import.meta.env.VITE_API_ORIGIN?.trim()

export const authClient = createAuthClient(
  {
    ...(apiOrigin ? { baseURL: apiOrigin } : {}),
    plugins: [emailOTPClient()],
  },
)
