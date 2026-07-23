import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  WorkspaceLogoPreviewQuery,
  WorkspaceLogoPreviewResponse,
  WorkspaceSlugAvailabilityResponse,
  WorkspaceSummary,
} from "@handout/contracts"
import { uploadProfileImageResponseSchema } from "@handout/contracts"

import { apiRequest } from "@/lib/api/client"

export function getWorkspaceSlugAvailability(slug: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ slug })

  return apiRequest(`/api/workspaces/slug-availability?${params.toString()}`, {
    responseSchema: workspaceSlugAvailabilityResponseSchema,
    signal,
  })
}

export function getWorkspaceLogoPreview(
  input: WorkspaceLogoPreviewQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    website: input.website,
    size: String(input.size ?? 128),
    theme: input.theme ?? "light",
  })

  return apiRequest(`/api/workspaces/logo-preview?${params.toString()}`, {
    responseSchema: workspaceLogoPreviewResponseSchema,
    signal,
  })
}

export function createWorkspace(input: CreateWorkspaceRequest) {
  return apiRequest("/api/workspaces", {
    method: "POST",
    body: normalizeCreateWorkspaceRequest(input),
    responseSchema: createWorkspaceResponseSchema,
  })
}

export function uploadOnboardingProfileImage(input: {
  contentType: string
  dataBase64: string
  fileName: string
}) {
  return apiRequest("/api/me/profile-image", {
    method: "PUT",
    body: input,
    responseSchema: uploadProfileImageResponseSchema,
  })
}

export function redeemWorkspaceInviteCode(code: string) {
  return apiRequest("/api/workspace-invitations/redeem", {
    method: "POST",
    body: { code: code.trim() },
    responseSchema: redeemWorkspaceInviteResponseSchema,
  })
}

const workspaceSlugAvailabilityResponseSchema = {
  parse(value: unknown): WorkspaceSlugAvailabilityResponse {
    const object = asRecord(value)

    if (
      typeof object.slug !== "string" ||
      typeof object.available !== "boolean" ||
      typeof object.requestId !== "string"
    ) {
      throw new Error("Invalid workspace slug availability response.")
    }

    return {
      slug: object.slug,
      available: object.available,
      requestId: object.requestId,
    }
  },
}

const workspaceLogoPreviewResponseSchema = {
  parse(value: unknown): WorkspaceLogoPreviewResponse {
    const object = asRecord(value)

    if (
      typeof object.enabled !== "boolean" ||
      typeof object.domain !== "string" ||
      typeof object.requestId !== "string" ||
      !(typeof object.imageUrl === "string" || object.imageUrl === null)
    ) {
      throw new Error("Invalid workspace logo preview response.")
    }

    return {
      enabled: object.enabled,
      domain: object.domain,
      imageUrl: object.imageUrl,
      requestId: object.requestId,
    }
  },
}

const createWorkspaceResponseSchema = {
  parse(value: unknown): CreateWorkspaceResponse {
    const object = asRecord(value)
    const workspace = parseWorkspaceSummary(object.workspace)
    const membership = asRecord(object.membership)

    if (
      typeof membership.id !== "string" ||
      typeof membership.workspaceId !== "string" ||
      typeof membership.userId !== "string" ||
      membership.role !== "admin" ||
      membership.status !== "active" ||
      typeof object.requestId !== "string"
    ) {
      throw new Error("Invalid create workspace response.")
    }

    return {
      workspace,
      membership: {
        id: membership.id,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: "admin",
        status: "active",
      },
      requestId: object.requestId,
    }
  },
}

const redeemWorkspaceInviteResponseSchema = {
  parse(value: unknown): { workspaceId: string; requestId: string } {
    const object = asRecord(value)
    if (typeof object.workspaceId !== "string" || typeof object.requestId !== "string") {
      throw new Error("Invalid workspace invitation response.")
    }
    return { workspaceId: object.workspaceId, requestId: object.requestId }
  },
}

function normalizeCreateWorkspaceRequest(input: CreateWorkspaceRequest): CreateWorkspaceRequest {
  return {
    name: input.name.trim(),
    website: input.website.trim(),
    ...(input.slug ? { slug: input.slug.trim() } : {}),
    ...(input.logoAssetId ? { logoAssetId: input.logoAssetId } : {}),
  }
}

function parseWorkspaceSummary(value: unknown): WorkspaceSummary {
  const object = asRecord(value)

  if (
    typeof object.id !== "string" ||
    typeof object.name !== "string" ||
    typeof object.slug !== "string" ||
    typeof object.websiteDomain !== "string" ||
    !(typeof object.logoAssetId === "string" || object.logoAssetId === null) ||
    (object.plan !== "free" && object.plan !== "core" && object.plan !== "pro") ||
    !workspaceStatuses.has(object.status as WorkspaceSummary["status"]) ||
    typeof object.createdAt !== "string" ||
    typeof object.updatedAt !== "string"
  ) {
    throw new Error("Invalid workspace.")
  }

  return {
    id: object.id,
    name: object.name,
    slug: object.slug,
    websiteDomain: object.websiteDomain,
    logoAssetId: object.logoAssetId,
    plan: object.plan,
    status: object.status as WorkspaceSummary["status"],
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
  }
}

const workspaceStatuses = new Set<WorkspaceSummary["status"]>([
  "active",
  "suspended",
  "scheduled_for_deletion",
  "deleted",
])

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object.")
  }

  return value as Record<string, unknown>
}
