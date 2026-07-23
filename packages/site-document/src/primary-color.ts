import { deriveHandoutAdaptiveColorRoles } from "@handout/design-tokens/color-family";

import {
  siteCustomPrimaryColorSchema,
  type SiteContent,
  type SitePrimaryColor,
} from "./model";

export type SitePrimaryColorVariables = {
  "--handout-primary": string;
  "--handout-primary-foreground": string;
  "--handout-primary-soft": string;
  "--handout-sidebar-link-icon": string;
};

export function getSitePrimaryColorVariables(
  color: SitePrimaryColor,
  customColor?: SiteContent["settings"]["customPrimaryColor"],
): SitePrimaryColorVariables {
  const parsedCustomColor = siteCustomPrimaryColorSchema.safeParse(customColor);

  if (parsedCustomColor.success) {
    const roles = deriveHandoutAdaptiveColorRoles(parsedCustomColor.data);

    return {
      "--handout-primary": roles.foreground,
      "--handout-primary-foreground": roles.onForeground,
      "--handout-primary-soft": roles.backgroundSubtle,
      "--handout-sidebar-link-icon": roles.foreground,
    };
  }

  if (color === "neutral") {
    return {
      "--handout-primary": "var(--foreground,var(--primary))",
      "--handout-primary-foreground": "var(--background,var(--primary-foreground))",
      "--handout-primary-soft": "var(--accent,var(--muted))",
      "--handout-sidebar-link-icon": "var(--blue-foreground,var(--link))",
    };
  }

  return {
    "--handout-primary": `var(--${color}-foreground,var(--primary))`,
    "--handout-primary-foreground": "var(--background,var(--primary-foreground))",
    "--handout-primary-soft": `var(--${color}-background-subtle,var(--accent))`,
    "--handout-sidebar-link-icon": `var(--${color}-foreground,var(--link))`,
  };
}
