export type EditableBlockType =
  | "title"
  | "heading"
  | "text"
  | "divider"
  | "bullet-list"
  | "number-list"
  | "icon-list"
  | "image"
  | "gif"
  | "image-card"
  | "icon-card"
  | "button"
  | "calendar"
  | "accordion"
  | "video"
  | "testimonial"
  | "logo-grid"

export type VariantRecord = {
  id: string
  name: string
  slug: string
  values?: Record<string, string>
}

export type EditorVariableType = "text" | "image" | "url"

export type EditorVariable = {
  id: string
  key: string
  label: string
  type: EditorVariableType
  defaultValue: string
}

export const recipientWebsiteVariableKey = "recipient_website"

export const initialEditorVariables: EditorVariable[] = [
  {
    id: recipientWebsiteVariableKey,
    key: recipientWebsiteVariableKey,
    label: "Recipient website",
    type: "url",
    defaultValue: "",
  },
  {
    id: "var-example-a",
    key: "example_a",
    label: "Example A",
    type: "text",
    defaultValue: "Acme",
  },
  {
    id: "var-example-b",
    key: "example_b",
    label: "Example B",
    type: "text",
    defaultValue: "implementation team",
  },
  {
    id: "var-company-logo",
    key: "company_logo",
    label: "Company logo",
    type: "image",
    defaultValue: "",
  },
  {
    id: "var-booking_url",
    key: "booking_url",
    label: "Booking URL",
    type: "url",
    defaultValue: "https://example.com/book",
  },
]

export const editorVariants: VariantRecord[] = [
  { id: "default", name: "Default Variant", slug: "default" },
  {
    id: "john-acme",
    name: "John Doe at Acme",
    slug: "abc123x",
    values: {
      [recipientWebsiteVariableKey]: "acme.com",
      "var-example-a": "Acme",
      "var-example-b": "John's implementation team",
    },
  },
  {
    id: "maya-northstar",
    name: "Maya at Northstar",
    slug: "northstar",
    values: {
      [recipientWebsiteVariableKey]: "northstar.com",
      "var-example-a": "Northstar",
      "var-example-b": "Maya's revenue team",
    },
  },
  { id: "sam-apex", name: "Sam at Apex", slug: "apex-q3" },
  { id: "rina-orbit", name: "Rina at Orbit", slug: "orbit" },
]

let localVariableSequence = 0
let localVariantSequence = 0

export function createEditorVariable({
  defaultValue = "",
  key,
  type,
}: {
  defaultValue?: string
  key: string
  type: EditorVariableType
}): EditorVariable {
  localVariableSequence += 1
  const normalizedKey = normalizeVariableKey(key)

  return {
    id: `var-local-${localVariableSequence.toString(36)}`,
    key: normalizedKey,
    label: variableLabelFromKey(normalizedKey),
    type,
    defaultValue,
  }
}

export function createEditorVariant({
  existingSlugs,
  name,
  slug,
  variables,
}: {
  existingSlugs: ReadonlySet<string>
  name: string
  slug: string
  variables: EditorVariable[]
}): VariantRecord {
  localVariantSequence += 1

  return {
    id: `variant-local-${localVariantSequence.toString(36)}`,
    name: name.trim() || "Untitled variant",
    slug: uniqueVariantSlug(slug || "variant", existingSlugs),
    values: Object.fromEntries(variables.map((variable) => [variable.id, ""])),
  }
}

export function duplicateEditorVariant({
  existingSlugs,
  variant,
}: {
  existingSlugs: ReadonlySet<string>
  variant: VariantRecord
}): VariantRecord {
  localVariantSequence += 1

  return {
    ...variant,
    id: `variant-local-${localVariantSequence.toString(36)}`,
    name: `Copy of ${variant.name}`,
    slug: uniqueVariantSlug(`${variant.slug}-copy`, existingSlugs),
    values: { ...variant.values },
  }
}

export function removeEditorVariant(
  variants: VariantRecord[],
  variantId: string
) {
  return variants.filter((variant) => variant.id === "default" || variant.id !== variantId)
}

export function coerceSelectedVariantId(
  variants: VariantRecord[],
  selectedVariantId: string
) {
  if (variants.some((variant) => variant.id === selectedVariantId)) {
    return selectedVariantId
  }

  return variants.find((variant) => variant.id === "default")?.id ?? variants[0]?.id ?? "default"
}

export function formatVariableToken(variable: Pick<EditorVariable, "key">) {
  return `{{${variable.key}}}`
}

export function normalizeVariableKey(value: string) {
  return value
    .trim()
    .replace(/^\{\{|\}\}$/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/[^\w]/g, "")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
}

function variableLabelFromKey(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function uniqueVariantSlug(slug: string, existingSlugs: ReadonlySet<string>) {
  const normalizedSlug = slug.trim() || "variant"

  if (!existingSlugs.has(normalizedSlug)) {
    return normalizedSlug
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${normalizedSlug}-${suffix}`

    if (!existingSlugs.has(candidate)) {
      return candidate
    }
  }

  return `${normalizedSlug}-${localVariantSequence.toString(36)}`
}
