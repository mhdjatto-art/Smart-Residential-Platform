import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/pwa/sw-register";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { siteConfig } from "@/config/site";
import { getActiveLocale } from "@/lib/i18n/server";
import { htmlDir } from "@/lib/i18n";
import { getMyPreferences } from "@/lib/api/user-preferences";
import { DEFAULT_PREFERENCES } from "@/lib/api/user-preferences-types";

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
    // Match the emerald primary so the Android status bar tints the same as the hero card
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)",  color: "#0B1F3A" },
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
  let locale: "en" | "ar" | "ku" = "en";
  let dir: "rtl" | "ltr" = "ltr";
  try {
    locale = await getActiveLocale();
    dir = htmlDir(locale);
  } catch {
    /* swallowed */
  }

  // Phase 18 — load user preferences (theme/accent). Falls back to defaults
  // when unauthenticated or the table doesn't exist yet.
  const prefs = await getMyPreferences().catch(() => DEFAULT_PREFERENCES);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider initial={prefs}>
          {children}
          <Toaster />
          <SwRegister />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
