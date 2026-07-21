import {
  automationActionResponseSchema,
  automationActivityResponseSchema,
  automationDetailResponseSchema,
  automationDeliveryDataResponseSchema,
  automationListResponseSchema,
  automationOptionsResponseSchema,
  automationSecretResponseSchema,
  automationTestResponseSchema,
  createAutomationRequestSchema,
  updateAutomationRequestSchema,
  type CreateAutomationRequest,
  type UpdateAutomationRequest,
} from "@handout/contracts"
import { apiRequest } from "@/lib/api/client"

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/automations`

export function listAutomations(workspaceId: string, signal?: AbortSignal) {
  return apiRequest(base(workspaceId), { responseSchema: automationListResponseSchema, signal })
}
export function getAutomation(workspaceId: string, automationId: string, signal?: AbortSignal) {
  return apiRequest(`${base(workspaceId)}/${automationId}`, { responseSchema: automationDetailResponseSchema, signal })
}
export function getAutomationOptions(workspaceId: string, signal?: AbortSignal) {
  return apiRequest(`${base(workspaceId)}/options`, { responseSchema: automationOptionsResponseSchema, signal })
}
export function createAutomation(workspaceId: string, input: CreateAutomationRequest) {
  return apiRequest(base(workspaceId), { method: "POST", body: createAutomationRequestSchema.parse(input), responseSchema: automationDetailResponseSchema })
}
export function updateAutomation(workspaceId: string, automationId: string, input: UpdateAutomationRequest) {
  return apiRequest(`${base(workspaceId)}/${automationId}`, { method: "PATCH", body: updateAutomationRequestSchema.parse(input), responseSchema: automationActionResponseSchema })
}
export function setAutomationState(workspaceId: string, automationId: string, state: "enable" | "pause") {
  return apiRequest(`${base(workspaceId)}/${automationId}/${state}`, { method: "POST", responseSchema: automationActionResponseSchema })
}
export function testAutomation(workspaceId: string, automationId: string) {
  return apiRequest(`${base(workspaceId)}/${automationId}/test`, { method: "POST", responseSchema: automationTestResponseSchema })
}
export function listAutomationActivity(workspaceId: string, automationId: string, cursor?: string | null, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const query = params.size ? `?${params.toString()}` : ""
  return apiRequest(`${base(workspaceId)}/${automationId}/activity${query}`, { responseSchema: automationActivityResponseSchema, signal })
}
export function retryAutomationDelivery(workspaceId: string, automationId: string, deliveryId: string) {
  return apiRequest(`${base(workspaceId)}/${automationId}/deliveries/${deliveryId}/retry`, { method: "POST" })
}
export function getAutomationDeliveryData(workspaceId: string, automationId: string, deliveryId: string, signal?: AbortSignal) {
  return apiRequest(`${base(workspaceId)}/${automationId}/deliveries/${deliveryId}`, { responseSchema: automationDeliveryDataResponseSchema, signal })
}
export function rotateAutomationSecret(workspaceId: string, automationId: string) {
  return apiRequest(`${base(workspaceId)}/${automationId}/rotate-secret`, { method: "POST", responseSchema: automationSecretResponseSchema })
}
export function deleteAutomation(workspaceId: string, automationId: string) {
  return apiRequest(`${base(workspaceId)}/${automationId}`, { method: "DELETE" })
}
