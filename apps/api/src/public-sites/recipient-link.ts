import { createHash } from "node:crypto";
import {
  HANDOUT_TEXT_LIMITS,
  normalizeWebsiteDomain,
  slugifyName,
  validateTextLimit,
} from "@handout/domain";
import type { SiteContent } from "@handout/site-document";
import { withRecipientLogo } from "../sites/recipient-values";

export const MAX_PUBLIC_RECIPIENT_QUERY_LENGTH = 8_192;

export type PublicRecipientLinkInput = {
  recipientName: string;
  recipientCompany: string;
  recipientWebsite: string;
  searchParams: URLSearchParams;
};

export type NormalizedPublicRecipientLink = {
  name: string;
  slugBase: string;
  recipientName: string;
  recipientCompany: string;
  publicLinkKey: string;
  variableValues: Record<string, unknown>;
};

export function normalizePublicRecipientLink(
  content: SiteContent,
  input: PublicRecipientLinkInput,
): NormalizedPublicRecipientLink | null {
  const recipientName = normalizeIdentity(input.recipientName, "recipientName");
  const recipientCompany = normalizeIdentity(input.recipientCompany, "recipientCompany");
  const website = normalizeWebsiteDomain(input.recipientWebsite);

  if (!recipientName || !recipientCompany || !website.ok) {
    return null;
  }

  const variableByQueryKey = new Map<string, SiteContent["variables"][number]>();
  for (const variable of content.variables) {
    if (variable.id === "recipient_website" || variable.key === "website") continue;
    variableByQueryKey.set(variable.id.toLocaleLowerCase(), variable);
    variableByQueryKey.set(variable.key.toLocaleLowerCase(), variable);
  }

  const seenVariableIds = new Set<string>();
  const customVariableValues: Record<string, string> = {};
  for (const [rawKey, rawValue] of input.searchParams) {
    const variable = variableByQueryKey.get(rawKey.trim().toLocaleLowerCase());
    if (!variable) continue;
    if (seenVariableIds.has(variable.id)) return null;

    const value = validateTextLimit(rawValue.trim(), "recipientVariableValue", variable.label);
    if (!value.ok) return null;
    seenVariableIds.add(variable.id);
    customVariableValues[variable.id] = value.value;
  }

  const variableValues = withRecipientLogo({
    ...customVariableValues,
    "recipient-company": recipientCompany,
    "recipient-name": recipientName,
    recipient_website: website.domain,
  });
  const fingerprintInput = {
    company: recipientCompany.toLocaleLowerCase(),
    name: recipientName.toLocaleLowerCase(),
    variables: Object.entries(customVariableValues).sort(([left], [right]) => left.localeCompare(right)),
    website: website.domain,
  };
  const publicLinkKey = createHash("sha256")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex");
  const slugBase = (slugifyName(`${recipientCompany}-${recipientName}`) || "recipient").slice(0, 80);

  return {
    name: `${recipientName} @ ${recipientCompany}`.slice(0, HANDOUT_TEXT_LIMITS.variableName),
    slugBase,
    recipientName,
    recipientCompany,
    publicLinkKey,
    variableValues,
  };
}

function normalizeIdentity(
  value: string,
  limitKey: "recipientName" | "recipientCompany",
) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const result = validateTextLimit(normalized, limitKey);
  return result.ok && result.value ? result.value : null;
}
