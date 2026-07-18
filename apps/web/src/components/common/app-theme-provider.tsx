import {
  useState,
  type ReactNode,
} from "react"
import { ThemeProvider } from "next-themes"

import {
  AppThemeOverrideContext,
  type AppTheme,
} from "./app-theme-context"

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [forcedTheme, setForcedTheme] = useState<AppTheme | null>(null)

  return (
    <AppThemeOverrideContext.Provider value={setForcedTheme}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme={forcedTheme ?? undefined}
      >
        {children}
      </ThemeProvider>
    </AppThemeOverrideContext.Provider>
  )
}
