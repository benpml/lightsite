import { normalizeWebsiteUrl } from "@lightsite/domain"

export function normalizeButtonHref(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  const normalized = normalizeWebsiteUrl(trimmed)

  return normalized.ok ? normalized.url : null
}

export function getFormValue(
  form: HTMLFormElement | undefined,
  name: string,
  fallback: string
) {
  if (!form) {
    return fallback
  }

  const value = new FormData(form).get(name)

  return typeof value === "string" ? value : fallback
}
