import { uploadWorkspaceLogoResponseSchema } from "@handout/contracts"

import { apiRequest } from "@/lib/api/client"

export function uploadWorkspaceLogo(
  workspaceId: string,
  input: {
    contentType: string
    dataBase64: string
    fileName: string
  },
) {
  return apiRequest(`/api/workspaces/${workspaceId}/logo`, {
    method: "PUT",
    body: input,
    responseSchema: uploadWorkspaceLogoResponseSchema,
  })
}
