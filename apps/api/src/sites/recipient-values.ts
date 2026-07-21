import { normalizeWebsiteDomain } from "@handout/domain";

export function withRecipientLogo(values: Record<string, unknown>) {
  const nextValues = { ...values };
  const website = firstNonEmptyString(
    nextValues.recipient_website,
    nextValues.website,
  );
  const normalized = typeof website === "string"
    ? normalizeWebsiteDomain(website)
    : null;

  if (!normalized?.ok) {
    delete nextValues["var-company-logo"];
    return nextValues;
  }

  nextValues.recipient_website = normalized.domain;
  nextValues.website = normalized.domain;

  const params = new URLSearchParams({
    domain: normalized.domain,
    theme: "light",
    size: "64",
  });
  nextValues["var-company-logo"] = `/api/workspaces/logo-preview/image?${params.toString()}`;

  return nextValues;
}

function firstNonEmptyString(...values: unknown[]) {
  return values.find((value): value is string => (
    typeof value === "string" && value.trim().length > 0
  ));
}
