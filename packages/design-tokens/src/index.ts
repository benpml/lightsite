export const SITE_MOBILE_BREAKPOINT_PX = 760 as const

export const handoutFoundationTokens = {
  "white-white": "#ffffff",
  "white-alpha-a800": "rgb(255 255 255 / 80%)",
  "white-alpha-a300": "rgb(255 255 255 / 30%)",
  "white-alpha-a200": "rgb(255 255 255 / 20%)",
  "neutral-950": "#0a0a0a",
  "neutral-900": "#191919",
  "neutral-800": "#252525",
  "neutral-700": "#333333",
  "neutral-600": "#525252",
  "neutral-500": "#737373",
  "neutral-450": "#8d8d8d",
  "neutral-400": "#999999",
  "neutral-300": "#c4c4c4",
  "neutral-200": "#e5e5e5",
  "neutral-100": "#f5f5f5",
  "neutral-50": "#fafafa",
  "neutral-alpha-a900": "rgb(128 128 128 / 40%)",
  "neutral-alpha-a800": "rgb(128 128 128 / 30%)",
  "neutral-alpha-a700": "rgb(128 128 128 / 24%)",
  "neutral-alpha-a600": "rgb(128 128 128 / 20%)",
  "neutral-alpha-a500": "rgb(128 128 128 / 16%)",
  "neutral-alpha-a400": "rgb(128 128 128 / 14%)",
  "neutral-alpha-a300": "rgb(128 128 128 / 12%)",
  "neutral-alpha-a200": "rgb(128 128 128 / 7%)",
  "neutral-alpha-a100": "rgb(128 128 128 / 5%)",
  "radius": "10px",
  "radius-none": "0",
  "radius-xs": "2px",
  "radius-sm": "6px",
  "radius-md": "8px",
  "radius-lg": "10px",
  "radius-xl": "14px",
  "radius-2xl": "18px",
  "radius-3xl": "22px",
  "radius-4xl": "26px",
  "radius-full": "9999px",
  "border-width": "1px",
} as const

export const handoutWebsiteTokens = {
  background: "var(--white-white)",
  foreground: "var(--neutral-900)",
  border: "var(--neutral-alpha-a400)",
  card: "var(--neutral-50)",
  "card-foreground": "var(--neutral-900)",
  primary: "var(--neutral-950)",
  "primary-foreground": "var(--white-white)",
  secondary: "var(--white-white)",
  "secondary-foreground": "var(--neutral-700)",
  tertiary: "var(--neutral-alpha-a200)",
  "tertiary-foreground": "var(--neutral-600)",
  muted: "var(--neutral-alpha-a300)",
  "muted-foreground": "var(--neutral-450)",
  "inverse-foreground": "var(--white-white)",
  "inverse-secondary-foreground": "var(--white-alpha-a800)",
  "inverse-border": "var(--white-alpha-a300)",
  input: "var(--neutral-alpha-a700)",
  ring: "var(--neutral-500)",
  popover: "var(--background)",
  "popover-foreground": "var(--foreground)",
} as const

export const handoutWebsiteComponentTokens = {
  "website-radius-sm": "8px",
  "website-radius-md": "10px",
  "website-radius-lg": "12px",
  "website-radius-2xl": "16px",
  "corner-border": "var(--neutral-alpha-a800)",
  "hero-benefits-backdrop": "#003683",
  "secondary-hover": "var(--neutral-50)",
  "control-shadow": "0 1px 0.5px rgb(0 0 0 / 6%)",
  "badge-inverse-shadow": "0 1px 1px rgb(0 0 0 / 6%)",
} as const

export const handoutLightTokens = {
  background: "#ffffff",
  foreground: "var(--neutral-950)",
  card: "var(--neutral-50)",
  "card-foreground": "var(--neutral-950)",
  popover: "#ffffff",
  "popover-foreground": "var(--neutral-950)",
  primary: "var(--neutral-950)",
  "primary-foreground": "var(--neutral-50)",
  secondary: "var(--neutral-100)",
  "secondary-foreground": "var(--neutral-800)",
  muted: "var(--neutral-100)",
  "muted-foreground": "var(--neutral-500)",
  "table-header-background": "rgb(0 0 0 / 5%)",
  accent: "var(--neutral-100)",
  "accent-foreground": "var(--neutral-950)",
  destructive: "#dc2626",
  warning: "#ffc182",
  success: "#adddc0",
  border: "var(--neutral-alpha-a600)",
  "border-strong": "var(--neutral-alpha-a700)",
  "border-subtle": "var(--neutral-alpha-a500)",
  input: "var(--neutral-alpha-a700)",
  ring: "var(--neutral-500)",
  "chart-1": "#8da4ef",
  "chart-2": "#3e63dd",
  "chart-3": "#3358d4",
  "chart-4": "#3a5bc7",
  "chart-5": "#1f2d5c",
  link: "#3e63dd",
  "page-background": "var(--background)",
  "tertiary-foreground": "var(--neutral-600)",
  "muted-faint": "var(--neutral-400)",
  "selection-background": "#f7f9ff",
  "selection-border": "#4f46e5",
  "selection-foreground": "var(--selection-border)",
  "editing-background": "var(--selection-background)",
  "editing-foreground": "var(--neutral-300)",
  "editing-foreground-hover": "var(--neutral-500)",
  "purple-background": "#755bde1f",
  "purple-background-subtle": "#755bde0f",
  "purple-foreground": "#725bcd",
  "purple-border": "#755bde14",
  "blue-background": "#0085ee1f",
  "blue-background-subtle": "#0085ee0f",
  "blue-foreground": "#218ce2",
  "blue-border": "#0085ee14",
  "cyan-background": "#0588f01f",
  "cyan-background-subtle": "#0588f00f",
  "cyan-foreground": "#0797b9",
  "cyan-border": "#0588f014",
  "teal-background": "#0d9b8a1f",
  "teal-background-subtle": "#0d9b8a0f",
  "teal-foreground": "#0d9b8a",
  "teal-border": "#0d9b8a14",
  "green-background": "#2b9a661f",
  "green-background-subtle": "#2b9a660f",
  "green-foreground": "#2b9a66",
  "green-border": "#2b9a6614",
  "yellow-background": "#ffba181f",
  "yellow-background-subtle": "#ffba180f",
  "yellow-foreground": "#ffba18",
  "yellow-border": "#ffba1814",
  "orange-background": "#ef5f001f",
  "orange-background-subtle": "#ef5f000f",
  "orange-foreground": "#ef5f00",
  "orange-border": "#ef5f0014",
  "red-background": "#dc3e421f",
  "red-background-subtle": "#dc3e420f",
  "red-foreground": "#dc3e42",
  "red-border": "#dc3e4214",
  "pink-background": "#cf38971f",
  "pink-background-subtle": "#cf38970f",
  "pink-foreground": "#cf3897",
  "pink-border": "#cf389714",
  "variable-background-secondary": "var(--cyan-background)",
  "variable-background": "var(--cyan-background)",
  "variable-background-hover": "var(--cyan-background)",
  "variable-foreground": "var(--cyan-foreground)",
  "variable-border": "var(--cyan-border)",
  sidebar: "var(--background)",
  "sidebar-foreground": "var(--foreground)",
  "sidebar-primary": "var(--primary)",
  "sidebar-primary-foreground": "var(--primary-foreground)",
  "sidebar-accent": "var(--accent)",
  "sidebar-accent-foreground": "var(--accent-foreground)",
  "sidebar-border": "var(--border)",
  "sidebar-ring": "var(--ring)",
} as const

export const handoutDarkTokens = {
  ...handoutLightTokens,
  background: "var(--neutral-900)",
  foreground: "var(--neutral-100)",
  card: "var(--neutral-800)",
  "card-foreground": "var(--neutral-100)",
  popover: "var(--neutral-800)",
  "popover-foreground": "var(--neutral-100)",
  primary: "var(--neutral-100)",
  "primary-foreground": "var(--neutral-900)",
  secondary: "var(--neutral-800)",
  "secondary-foreground": "var(--neutral-200)",
  muted: "var(--neutral-800)",
  "muted-foreground": "var(--neutral-400)",
  "table-header-background": "rgb(0 0 0 / 5%)",
  accent: "var(--neutral-700)",
  "accent-foreground": "var(--neutral-50)",
  destructive: "#fca5a5",
  border: "var(--neutral-alpha-a700)",
  "border-strong": "var(--neutral-alpha-a900)",
  "border-subtle": "var(--neutral-alpha-a300)",
  ring: "var(--neutral-400)",
  link: "#8da4ef",
  "tertiary-foreground": "var(--neutral-300)",
  "muted-faint": "var(--neutral-600)",
  "selection-background": "rgb(250 250 250 / 8%)",
  "selection-border": "#a5b4fc",
  "editing-foreground": "var(--neutral-700)",
  "purple-background": "#755bde4d",
  "purple-background-subtle": "#755bde1f",
  "purple-foreground": "#d4cafe",
  "purple-border": "#755bde29",
  "blue-background": "#0085ee4d",
  "blue-background-subtle": "#0085ee1f",
  "blue-foreground": "#97d1ff",
  "blue-border": "#0085ee29",
  "cyan-background": "#0588f04d",
  "cyan-background-subtle": "#0588f01f",
  "cyan-foreground": "#a4e9f4",
  "cyan-border": "#0588f029",
  "teal-background": "#0d9b8a4d",
  "teal-background-subtle": "#0d9b8a1f",
  "teal-foreground": "#99eada",
  "teal-border": "#0d9b8a29",
  "green-background": "#2b9a664d",
  "green-background-subtle": "#2b9a661f",
  "green-foreground": "#abeec6",
  "green-border": "#2b9a6629",
  "yellow-background": "#ffba184d",
  "yellow-background-subtle": "#ffba181f",
  "yellow-foreground": "#f7dd84",
  "yellow-border": "#ffba1829",
  "orange-background": "#ef5f004d",
  "orange-background-subtle": "#ef5f001f",
  "orange-foreground": "#ffc78d",
  "orange-border": "#ef5f0029",
  "red-background": "#dc3e4252",
  "red-background-subtle": "#dc3e421f",
  "red-foreground": "#fdbdbe",
  "red-border": "#dc3e4229",
  "pink-background": "#cf38974d",
  "pink-background-subtle": "#cf38971f",
  "pink-foreground": "#efbfdd",
  "pink-border": "#cf389729",
  "variable-background-secondary": "var(--cyan-background)",
  "variable-background": "var(--cyan-background)",
  "variable-background-hover": "var(--cyan-background)",
  "variable-foreground": "var(--cyan-foreground)",
  "variable-border": "var(--cyan-border)",
  "sidebar-accent": "var(--neutral-800)",
} as const

const legacyPaletteColorNames: Readonly<Record<string, string>> = {
  indigo: "purple",
  sky: "cyan",
  emerald: "green",
  amber: "yellow",
  rose: "red",
}

export function normalizeEditorTextColor(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const match = value.match(/^var\(--editor-color-([a-z]+)\)$/)
  if (!match) {
    return value
  }

  const legacyColorName = match[1]
  if (!legacyColorName) {
    return value
  }

  if (legacyColorName === "neutral") {
    return "var(--muted-foreground)"
  }

  const colorName = legacyPaletteColorNames[legacyColorName] ?? legacyColorName
  return `var(--${colorName}-foreground)`
}

export function normalizeEditorHighlightColor(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const match = value.match(
    /^(?:color-mix\(in oklab, )?var\(--editor-color-([a-z]+)\)(?: 30%, transparent\))?$/,
  )
  if (!match) {
    return value
  }

  const legacyColorName = match[1]
  if (!legacyColorName) {
    return value
  }

  if (legacyColorName === "neutral") {
    return "var(--muted)"
  }

  const colorName = legacyPaletteColorNames[legacyColorName] ?? legacyColorName
  return `var(--${colorName}-background)`
}

export const HANDOUT_THEME_CSS = [
  '@font-face{font-family:"Geist Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url("/fonts/geist-latin-wght-normal.woff2") format("woff2")}',
  cssRule(":root,.light", { ...handoutFoundationTokens, ...handoutLightTokens }, "light"),
  cssRule(".dark", handoutDarkTokens, "dark"),
  `@media(prefers-color-scheme:dark){${cssRule(".system", handoutDarkTokens, "dark")}}`,
].join("")

export const HANDOUT_WEBSITE_THEME_CSS = cssRule(
  ":root",
  {
    ...handoutFoundationTokens,
    ...handoutWebsiteTokens,
    ...handoutWebsiteComponentTokens,
  },
  "light",
)

function cssRule(
  selector: string,
  tokens: Readonly<Record<string, string>>,
  colorScheme: "dark" | "light",
) {
  const declarations = Object.entries(tokens)
    .map(([name, value]) => `--${name}:${value}`)
    .join(";")

  return `${selector}{color-scheme:${colorScheme};${declarations}}`
}
