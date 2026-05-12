import Link from "next/link";
import { Home } from "lucide-react";
import { siteConfig } from "@/config/site";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { getActiveLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let locale: "en" | "ar" | "ku" | "fr" | "es" = "en";
  try { locale = await getActiveLocale(); } catch { /* swallowed */ }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Home className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">{siteConfig.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {siteConfig.fullName}
              </span>
            </div>
          </Link>
          <LanguagePicker current={locale} />
        </div>

        <div className="mx-auto w-full max-w-sm">{children}</div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.fullName}. All rights reserved.
        </p>
      </div>

      <div className="hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div />
        <div className="space-y-6 text-primary-foreground">
          <h2 className="text-4xl font-bold leading-tight">{siteConfig.tagline}</h2>
          <p className="max-w-md text-sm text-primary-foreground/80">
            {siteConfig.description}
          </p>
        </div>
        <div className="text-xs text-primary-foreground/60">
          Multi-tenant. Secure by default. Built for scale.
        </div>
      </div>
    </div>
  );
}
