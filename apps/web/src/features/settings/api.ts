import {
  checkEmailChangeResponseSchema,
  siteDefaultsResponseSchema,
  updateWorkspaceSettingsResponseSchema,
  uploadProfileImageResponseSchema,
  uploadWorkspaceLogoResponseSchema,
  type SiteDefaults,
} from "@handout/contracts"

import { apiRequest } from "@/lib/api/client"

export function getSiteDefaults(signal?: AbortSignal) {
  return apiRequest("/api/me/site-defaults", { responseSchema: siteDefaultsResponseSchema, signal })
}

export function updateSiteDefaults(defaults: SiteDefaults) {
  return apiRequest("/api/me/site-defaults", {
    method: "PUT",
    body: defaults,
    responseSchema: siteDefaultsResponseSchema,
  })
}

export function checkEmailChange(email: string) {
  return apiRequest("/api/me/email-change/check", {
    method: "POST",
    body: { email },
    responseSchema: checkEmailChangeResponseSchema,
  })
}

export function updateWorkspaceSettings(workspaceId: string, input: { name: string; website: string }) {
  return apiRequest(`/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: input,
    responseSchema: updateWorkspaceSettingsResponseSchema,
  })
}

export function uploadWorkspaceLogo(workspaceId: string, input: { contentType: string; dataBase64: string; fileName: string }) {
  return apiRequest(`/api/workspaces/${workspaceId}/logo`, {
    method: "PUT",
    body: input,
    responseSchema: uploadWorkspaceLogoResponseSchema,
  })
}

export function uploadProfileImage(input: { contentType: string; dataBase64: string; fileName: string }) {
  return apiRequest("/api/me/profile-image", {
    method: "PUT",
    body: input,
    responseSchema: uploadProfileImageResponseSchema,
  })
}
