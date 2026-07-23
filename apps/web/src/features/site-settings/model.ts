import {
  RESERVED_SITE_VARIABLE_IDS,
  SITE_PRIMARY_COLOR_PRESET_OPTIONS,
  type SiteContent,
  type SitePrimaryColor,
  type SiteTrackingConsentPopup,
  type SiteVariableDefinition,
  type TiptapNode,
} from "@handout/site-document"

export const modeOptions = [
  { value: "light", label: "Light", description: "Always light mode" },
  { value: "dark", label: "Dark", description: "Always dark mode" },
  {
    value: "system",
    label: "Automatic",
    description: "Follow the users system theme",
  },
] as const

export const SYSTEM_SITE_VARIABLE_IDS = RESERVED_SITE_VARIABLE_IDS

export const systemSiteVariables: SiteVariableDefinition[] = [
  {
    id: "recipient-name",
    key: "name",
    label: "Name",
    type: "text",
    description: "Recipient first name",
    defaultValue: "you",
  },
  {
    id: "recipient-company",
    key: "company",
    label: "Company",
    type: "text",
    description: "Recipient company name",
    defaultValue: "your company",
  },
  {
    id: "recipient_website",
    key: "website",
    label: "Website",
    type: "url",
    description: "Recipient company website domain",
    defaultValue: "",
  },
]

const legacySystemVariableDescriptions: Readonly<Record<string, readonly string[]>> = {
  "recipient-name": [
    "Recipient’s first name",
    "The first name of the person receiving this page.",
  ],
  "recipient-company": [
    "Recipient’s company name",
    "The company receiving this page.",
  ],
  recipient_website: [
    "Recipient’s company website",
    "The recipient company's website.",
    "The recipient company's website, used to derive their logo when available.",
  ],
}

export function resolveSystemSiteVariableDescription(
  variableId: string,
  description?: string,
) {
  const systemVariable = systemSiteVariables.find((variable) => variable.id === variableId)
  const normalizedDescription = description?.trim()

  if (!systemVariable) return normalizedDescription
  if (
    !normalizedDescription ||
    legacySystemVariableDescriptions[variableId]?.includes(normalizedDescription)
  ) {
    return systemVariable.description
  }

  return normalizedDescription
}

export type SiteVariableInput = Pick<
  SiteVariableDefinition,
  "defaultValue" | "description" | "label"
>

export function createSiteVariableDefinition(
  input: SiteVariableInput,
  variables: SiteVariableDefinition[],
): SiteVariableDefinition {
  const label = normalizeSiteVariableLabel(input.label)
  const suffix = crypto.randomUUID().slice(0, 8)

  return {
    id: `var-${createSiteVariableKey(label) || "variable"}-${suffix}`,
    key: getUniqueSiteVariableKey(label, variables),
    label,
    type: "text",
    description: input.description?.trim() || undefined,
    defaultValue: typeof input.defaultValue === "string" ? input.defaultValue : "",
  }
}

export function isDuplicateSiteVariableLabel(
  label: string,
  variables: SiteVariableDefinition[],
  editingVariableId?: string,
) {
  const normalizedLabel = normalizeSiteVariableLabel(label).toLocaleLowerCase()
  if (!normalizedLabel) return false

  return [...systemSiteVariables, ...variables].some(
    (variable) =>
      variable.id !== editingVariableId &&
      normalizeSiteVariableLabel(variable.label).toLocaleLowerCase() === normalizedLabel,
  )
}

export function getUniqueSiteVariableKey(
  label: string,
  variables: SiteVariableDefinition[],
) {
  const baseKey = createSiteVariableKey(label) || "variable"
  const existingKeys = new Set(
    [...systemSiteVariables, ...variables].map((variable) => variable.key),
  )
  let key = baseKey
  let suffix = 2

  while (existingKeys.has(key)) {
    key = `${baseKey}-${suffix}`
    suffix += 1
  }

  return key
}

export function createSiteVariableKey(label: string) {
  return normalizeSiteVariableLabel(label)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeSiteVariableLabel(label: string) {
  return label.trim().replace(/\s+/g, " ")
}

const primaryColorMetadata: Record<
  SitePrimaryColor,
  { className: string; label: string }
> = {
  neutral: { label: "Neutral", className: "bg-foreground" },
  purple: { label: "Purple", className: "bg-purple-foreground" },
  blue: { label: "Blue", className: "bg-blue-foreground" },
  cyan: { label: "Cyan", className: "bg-cyan-foreground" },
  teal: { label: "Teal", className: "bg-teal-foreground" },
  green: { label: "Green", className: "bg-green-foreground" },
  yellow: { label: "Yellow", className: "bg-yellow-foreground" },
  orange: { label: "Orange", className: "bg-orange-foreground" },
  red: { label: "Red", className: "bg-red-foreground" },
  pink: { label: "Pink", className: "bg-pink-foreground" },
}

export const primaryColorOptions = SITE_PRIMARY_COLOR_PRESET_OPTIONS.map((value) => ({
  value,
  ...primaryColorMetadata[value],
}))

export const trackingConsentOptions: Array<{
  description: string
  label: string
  value: SiteTrackingConsentPopup
}> = [
  { value: "popup-a", label: "Popup A", description: "Highest allow rate." },
  { value: "popup-b", label: "Popup B", description: "Lower allow rate, more friendly." },
  {
    value: "none",
    label: "None",
    description: "I will obtain and record visitor consent myself beforehand.",
  },
]

export function getSiteVariableUsageCounts(content: SiteContent) {
  const counts: Record<string, number> = {}

  for (const page of content.pages) {
    visitNode(page.document, (node) => {
      if (node.type !== "variableToken") return
      const variableId = node.attrs?.variableId
      if (typeof variableId !== "string" || !variableId) return
      counts[variableId] = (counts[variableId] ?? 0) + 1
    })
  }

  return counts
}

function visitNode(node: TiptapNode, visitor: (node: TiptapNode) => void) {
  visitor(node)
  node.content?.forEach((child) => visitNode(child, visitor))
}
