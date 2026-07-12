export * from "./v2";

export const previewPlatforms = [
  "slack",
  "microsoft_teams",
  "linkedin",
  "x",
  "facebook",
  "discord",
  "search",
  "generic_bot",
  "unknown",
] as const;

export const previewResources = ["html", "og_image"] as const;

export type PreviewPlatform = (typeof previewPlatforms)[number];

export type PreviewResource = (typeof previewResources)[number];

export type PreviewClassification = {
  isPreviewBot: boolean;
  platform: PreviewPlatform;
  userAgentFamily: string;
  resource: PreviewResource;
};

const MAX_TRACKED_URL_LENGTH = 2_000;
const MAX_TRACKED_LABEL_LENGTH = 180;

export type PublicCacheKeyInput = {
  workspaceSlug: string;
  siteSlug: string;
  publishedVersionId: string;
  variantSlug?: string | null;
  variantRevision?: number | null;
};

const previewBotPatterns: Array<{
  platform: PreviewPlatform;
  family: string;
  pattern: RegExp;
}> = [
  { platform: "slack", family: "slackbot", pattern: /\bslackbot\b/i },
  { platform: "microsoft_teams", family: "microsoft-teams", pattern: /\b(microsoft teams|teamsbot|skypeuripreview)\b/i },
  { platform: "linkedin", family: "linkedinbot", pattern: /\blinkedinbot\b/i },
  { platform: "x", family: "twitterbot", pattern: /\btwitterbot\b/i },
  { platform: "facebook", family: "facebookexternalhit", pattern: /\bfacebookexternalhit\b/i },
  { platform: "discord", family: "discordbot", pattern: /\bdiscordbot\b/i },
  { platform: "search", family: "googlebot", pattern: /\bgooglebot\b/i },
  { platform: "search", family: "bingbot", pattern: /\bbingbot\b/i },
  { platform: "generic_bot", family: "generic-crawler", pattern: /\b(bot|crawler|spider|preview|unfurl)\b/i },
];

export function classifyPreviewRequest(input: {
  userAgent: string | null | undefined;
  resource: PreviewResource;
}): PreviewClassification {
  const userAgent = input.userAgent?.trim() ?? "";

  for (const candidate of previewBotPatterns) {
    if (candidate.pattern.test(userAgent)) {
      return {
        isPreviewBot: true,
        platform: candidate.platform,
        userAgentFamily: candidate.family,
        resource: input.resource,
      };
    }
  }

  return {
    isPreviewBot: false,
    platform: "unknown",
    userAgentFamily: "unknown",
    resource: input.resource,
  };
}

export function buildPublicCacheKey(input: PublicCacheKeyInput): string {
  const baseKey = [
    "public-site",
    normalizeSlugPart(input.workspaceSlug),
    normalizeSlugPart(input.siteSlug),
    input.publishedVersionId,
  ];

  if (input.variantSlug) {
    baseKey.push(normalizeSlugPart(input.variantSlug), String(input.variantRevision ?? 0));
  }

  return baseKey.join(":");
}

export function sanitizeTrackedUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";

    const sanitized = url.toString();
    return sanitized.length > MAX_TRACKED_URL_LENGTH ? null : sanitized;
  } catch {
    return null;
  }
}

export function extractReferrerHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function truncateTrackingLabel(value: string | null | undefined): string {
  const label = value?.trim() || "Clicked element";
  return label.length > MAX_TRACKED_LABEL_LENGTH ? label.slice(0, MAX_TRACKED_LABEL_LENGTH) : label;
}

function normalizeSlugPart(value: string): string {
  return value.trim().toLowerCase();
}
