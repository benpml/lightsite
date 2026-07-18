export const HANDOUT_TEXT_LIMITS = {
  accountDisplayName: 160,
  blockText: 20_000,
  changeSummary: 500,
  deleteConfirmation: 64,
  email: 320,
  embedCode: 10_000,
  embeddedImageDataUrl: 8_000_000,
  gifSearchQuery: 160,
  imageAlt: 300,
  password: 1_024,
  recipientCompany: 160,
  recipientName: 160,
  recipientVariableValue: 4_000,
  searchQuery: 160,
  sectionLabel: 80,
  sidebarLabel: 120,
  siteName: 160,
  slug: 128,
  url: 2_048,
  variableDefaultValue: 4_000,
  variableDescription: 1_000,
  variableName: 120,
  workspaceName: 160,
} as const;

export const HANDOUT_COLLECTION_LIMITS = {
  blocksPerTab: 500,
  links: 25,
  tabs: 25,
} as const;

export type HandoutTextLimitKey = keyof typeof HANDOUT_TEXT_LIMITS;

const embeddedImageDataUrlPattern = /^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i;

export function isEmbeddedImageDataUrl(value: string) {
  return embeddedImageDataUrlPattern.test(value);
}

export function getHandoutDocumentStringLimit(value: string) {
  return isEmbeddedImageDataUrl(value)
    ? HANDOUT_TEXT_LIMITS.embeddedImageDataUrl
    : HANDOUT_TEXT_LIMITS.blockText;
}

export type TextLimitValidationResult =
  | { ok: true; value: string }
  | {
      ok: false;
      code: "text.too_long";
      limit: number;
      message: string;
      value: string;
    };

export function clampTextToLimit(value: string, limitKey: HandoutTextLimitKey) {
  return value.slice(0, HANDOUT_TEXT_LIMITS[limitKey]);
}

export function validateTextLimit(
  value: string,
  limitKey: HandoutTextLimitKey,
  label = "Text",
): TextLimitValidationResult {
  const limit = HANDOUT_TEXT_LIMITS[limitKey];

  if (value.length <= limit) {
    return {
      ok: true,
      value,
    };
  }

  return {
    ok: false,
    code: "text.too_long",
    limit,
    message: `${label} must be ${limit.toLocaleString("en-US")} characters or fewer.`,
    value,
  };
}
