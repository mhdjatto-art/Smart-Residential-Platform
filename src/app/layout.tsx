import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/pwa/sw-register";
import { siteConfig } from "@/config/site";
import { getActiveLocale } from "@/lib/i18n/server";
import { htmlDir } from "@/lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: `${siteConfig.name} — ${siteConfig.fullName}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SRP",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1F3A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // i18n resolution is best-effort — never crash the root layout if cookies
  // or headers are unavailable (e.g. during static prerender). Default to
  // English LTR in that case.
  let locale: "en" | "ar" | "ku" | "fr" | "es" = "en";
  let dir: "rtl" | "ltr" = "ltr";
  try {
    locale = await getActiveLocale();
    dir = htmlDir(locale);
  } catch {
    /* swallowed */
  }
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
