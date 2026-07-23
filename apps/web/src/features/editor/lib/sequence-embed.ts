import type { SiteVariableDefinition } from "@handout/site-document"

export type OutreachPlatformId =
  | "apollo"
  | "instantly"
  | "outreach"
  | "lemlist"
  | "salesloft"
  | "other"

export type OutreachPlatform = {
  company: string
  domain: string
  firstName: string
  id: OutreachPlatformId
  label: string
}

export const OUTREACH_PLATFORMS: readonly OutreachPlatform[] = [
  {
    id: "apollo",
    label: "Apollo",
    firstName: "{{contact.first_name}}",
    company: "{{account.name}}",
    domain: "{{account.domain}}",
  },
  {
    id: "instantly",
    label: "Instantly",
    firstName: "{{firstName}}",
    company: "{{companyName}}",
    domain: "{{companyDomain}}",
  },
  {
    id: "outreach",
    label: "Outreach",
    firstName: "{{first_name}}",
    company: "{{account.name}}",
    domain: "{{account.domain}}",
  },
  {
    id: "lemlist",
    label: "Lemlist",
    firstName: "{{firstName}}",
    company: "{{companyName}}",
    domain: "{{companyDomain}}",
  },
  {
    id: "salesloft",
    label: "Salesloft",
    firstName: "{{first_name}}",
    company: "{{account_name_or_company}}",
    domain: "{{Account.domain}}",
  },
  {
    id: "other",
    label: "Other platform",
    firstName: "",
    company: "",
    domain: "",
  },
] as const

export type SequenceVariable = Pick<
  SiteVariableDefinition,
  "id" | "key" | "label"
>

export type SequenceVariableMappings = Record<string, string>

const systemVariableIds = {
  company: "recipient-company",
  domain: "recipient_website",
  firstName: "recipient-name",
} as const

const mergeVariablePattern = /\{\{[^{}]*\}\}/g

export function getOutreachPlatform(platformId: OutreachPlatformId) {
  return OUTREACH_PLATFORMS.find((platform) => platform.id === platformId) ?? OUTREACH_PLATFORMS[0]
}

export function createSequenceVariableMappings(
  platformId: OutreachPlatformId,
  variables: readonly SequenceVariable[],
): SequenceVariableMappings {
  const platform = getOutreachPlatform(platformId)

  return Object.fromEntries(variables.map((variable) => [
    variable.id,
    variable.id === systemVariableIds.firstName
      ? platform.firstName
      : variable.id === systemVariableIds.company
        ? platform.company
        : variable.id === systemVariableIds.domain
          ? platform.domain
          : "",
  ]))
}

export function getSequenceVariableLabel(variable: SequenceVariable) {
  return variable.id === systemVariableIds.domain ? "Website Domain" : variable.label
}

export function areSequenceVariableMappingsComplete(
  variables: readonly SequenceVariable[],
  mappings: SequenceVariableMappings,
) {
  return variables.every((variable) => Boolean(mappings[variable.id]?.trim()))
}

export function createSequenceEmbedHtml({
  mappings,
  publicId,
  publicOrigin = "https://handout.link",
  variables,
}: {
  mappings: SequenceVariableMappings
  publicId: string
  publicOrigin?: string
  variables: readonly SequenceVariable[]
}) {
  const normalizedPublicId = publicId.trim()
  if (!normalizedPublicId) {
    throw new Error("A site public id is required to create a sequence embed.")
  }

  if (!areSequenceVariableMappingsComplete(variables, mappings)) {
    throw new Error("Every Handout variable needs an outreach variable mapping.")
  }

  const variablesById = new Map(variables.map((variable) => [variable.id, variable]))
  const firstName = getRequiredMapping(systemVariableIds.firstName, variablesById, mappings)
  const company = getRequiredMapping(systemVariableIds.company, variablesById, mappings)
  const domain = getRequiredMapping(systemVariableIds.domain, variablesById, mappings)
  const origin = publicOrigin.replace(/\/+$/, "")
  const recipientPath = [normalizedPublicId, firstName, company, domain]
    .map(encodeTemplateComponent)
    .join("/")
  const query = variables
    .filter((variable) => !Object.values(systemVariableIds).includes(
      variable.id as (typeof systemVariableIds)[keyof typeof systemVariableIds]
    ))
    .map((variable) => (
      `${encodeURIComponent(variable.key)}=${encodeTemplateComponent(mappings[variable.id] ?? "")}`
    ))
    .join("&")
  const querySuffix = query ? `?${query}` : ""
  const recipientUrl = `${origin}/${recipientPath}${querySuffix}`
  const imageUrl = `${origin}/${recipientPath}/embed.jpg${querySuffix}`

  return [
    `<a href="${escapeHtmlAttribute(recipientUrl)}" rel="noopener noreferrer" target="_blank">`,
    "  <img",
    `    src="${escapeHtmlAttribute(imageUrl)}"`,
    '    alt="Your personalized Handout"',
    '    style="display:block;width:600px;max-width:100%;height:auto;border:0;border-radius:10px;"',
    "  />",
    "</a>",
  ].join("\n")
}

function getRequiredMapping(
  variableId: string,
  variablesById: ReadonlyMap<string, SequenceVariable>,
  mappings: SequenceVariableMappings,
) {
  if (!variablesById.has(variableId)) {
    throw new Error(`Required Handout variable ${variableId} is missing.`)
  }

  const value = mappings[variableId]?.trim()
  if (!value) {
    throw new Error(`Required Handout variable ${variableId} is not mapped.`)
  }

  return value
}

function encodeTemplateComponent(value: string) {
  let result = ""
  let cursor = 0

  for (const match of value.matchAll(mergeVariablePattern)) {
    const index = match.index
    result += encodeURIComponent(value.slice(cursor, index))
    result += match[0]
    cursor = index + match[0].length
  }

  return result + encodeURIComponent(value.slice(cursor))
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
