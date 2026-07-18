import type { SiteTheme, SiteThemeMode } from "./types"

export function getAppTheme(resolvedTheme: string | undefined): SiteTheme {
  return resolvedTheme === "dark" ? "dark" : "light"
}

export function resolveEditorSiteTheme(
  themeMode: SiteThemeMode,
  appTheme: SiteTheme,
): SiteTheme {
  return themeMode === "system" ? appTheme : themeMode
}
