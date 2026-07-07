import { ApiClientError, createApiClientErrorFromResponse } from "./errors"
import { getDevAuthBypassHeaders } from "./dev-auth-bypass"

type ResponseSchema<T> = {
  parse(value: unknown): T
}

type ApiRequestOptions<TResponse> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  responseSchema?: ResponseSchema<TResponse>
  signal?: AbortSignal
}

export async function apiRequest<TResponse = void>(
  path: string,
  options: ApiRequestOptions<TResponse> = {},
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
    headers: buildRequestHeaders(options.body),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const requestId = response.headers.get("x-request-id")
  const body = await parseResponseBody(response)

  if (!response.ok) {
    throw createApiClientErrorFromResponse({
      status: response.status,
      body,
      requestId,
    })
  }

  if (!options.responseSchema) {
    return undefined as TResponse
  }

  try {
    return options.responseSchema.parse(body)
  } catch {
    throw new ApiClientError({
      code: "response.invalid",
      message: "The server returned an unexpected response.",
      status: response.status,
      requestId,
    })
  }
}

function buildApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const apiOrigin = import.meta.env.VITE_API_ORIGIN?.trim()

  if (!apiOrigin) {
    return path
  }

  return new URL(path, apiOrigin).toString()
}

function buildRequestHeaders(body: unknown) {
  return {
    ...getDevAuthBypassHeaders(),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
  }
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return null
  }

  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
