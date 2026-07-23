export const SITE_DOCUMENT_SCHEMA_VERSION = 3 as const;

export const SITE_PRIMARY_COLOR_OPTIONS = [
  "neutral",
  "purple",
  "blue",
  "cyan",
  "teal",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
] as const;

export const SITE_PRIMARY_COLOR_PRESET_OPTIONS = SITE_PRIMARY_COLOR_OPTIONS.filter(
  (color) => color !== "teal",
);
