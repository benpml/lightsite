import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lightsite-one-pagers.b1n.chatgpt.site"),
  title: "Lightsite — Build one pagers that close prospects",
  description: "Bundle client-facing content into one sleek, trackable site.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    title: "Lightsite — Build one pagers that close prospects",
    description: "Bundle client-facing content into one sleek, trackable site.",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Lightsite — Build one pagers that close prospects." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightsite — Build one pagers that close prospects",
    description: "Bundle client-facing content into one sleek, trackable site.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
