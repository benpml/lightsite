export function normalizeButtonHref(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  if (/^(mailto:|tel:|https?:\/\/|\/|#)/i.test(trimmed)) {
    return isValidHref(trimmed) ? trimmed : null
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`
  }

  if (/^\+?[0-9().\-\s]{7,}$/.test(trimmed)) {
    return `tel:${trimmed.replace(/[^\d+]/g, "")}`
  }

  return isValidHref(`https://${trimmed}`) ? `https://${trimmed}` : null
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

function isValidHref(value: string) {
  if (value.startsWith("/") || value.startsWith("#")) {
    return !/\s/.test(value)
  }

  try {
    const url = new URL(value)

    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
  } catch {
    return false
  }
}
