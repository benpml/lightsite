import { createContext, useContext, useEffect } from "react"

export type AppTheme = "dark" | "light"

export const AppThemeOverrideContext = createContext<(
  theme: AppTheme | null,
) => void>(() => undefined)

export function useAppThemeOverride(theme: AppTheme | null) {
  const setForcedTheme = useContext(AppThemeOverrideContext)

  useEffect(() => {
    setForcedTheme(theme)

    return () => setForcedTheme(null)
  }, [setForcedTheme, theme])
}
