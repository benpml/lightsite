import type { Metadata } from "next"
import { HANDOUT_WEBSITE_THEME_CSS } from "@handout/design-tokens"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://www.handout.link"),
  title: "Handout — One pagers that close prospects",
  description:
    "Bundle your client-facing content in one sleek, trackable Handout site.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: HANDOUT_WEBSITE_THEME_CSS }} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <script
          id="unicorn-studio-sdk"
          src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.8/dist/unicornStudio.umd.js"
          defer
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
