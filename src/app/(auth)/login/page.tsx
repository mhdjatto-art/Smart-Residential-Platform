import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { BrandingProvider, getBrandingByHost } from "@/components/layout/branding-provider";
import { getActiveLocale, getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

// Login form reads ?redirect=... via useSearchParams(). Forcing dynamic
// avoids the static prerender path entirely. The Suspense boundary is the
// belt-and-suspenders backup if Next.js ever tries to prerender anyway.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // When accessed via a tenant custom domain, the host resolves to that org
  // and we render its logo + brand colors + hero + welcome on the login
  // screen. On the SRP platform domain we render the default look.
  const brand  = await getBrandingByHost();
  const locale = await getActiveLocale();
  const { t }  = await getT();
  const b = brand?.branding ?? null;

  // Pre-translate labels on the server so the first paint never shows
  // untranslated i18n keys (no hydration flash).
  const labels = {
    sign_in_title:    t("auth.sign_in_title"),
    sign_in_subtitle: t("auth.sign_in_subtitle"),
    email:            t("auth.email"),
    password:         t("auth.password"),
    sign_in:          t("actions.sign_in"),
    invite_prompt:    t("auth.invite_prompt"),
    sign_up:          t("auth.sign_up"),
  };

  // Resolve per-locale welcome strings with fallbacks to English then to
  // null (handled by the JSX). Order: requested locale → en → null.
  const welcomeTitle =
    (b?.login_welcome_title?.[locale]) ??
    (b?.login_welcome_title?.en) ??
    null;
  const welcomeSubtitle =
    (b?.login_welcome_subtitle?.[locale]) ??
    (b?.login_welcome_subtitle?.en) ??
    null;

  return (
    <BrandingProvider orgId={brand?.orgId ?? null}>
      {/* Optional hero background — only renders when the tenant configured it. */}
      {b?.login_hero_path && (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%), url("${b.login_hero_path}")`,
          }}
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        {b?.logo_path && (
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logo_path} alt="Logo" className="h-12 max-w-[260px] object-contain" />
          </div>
        )}

        {(welcomeTitle || welcomeSubtitle) && (
          <div className={`mb-6 text-center ${b?.login_hero_path ? "text-white" : ""}`}>
            {welcomeTitle && (
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {welcomeTitle}
              </h1>
            )}
            {welcomeSubtitle && (
              <p className="mt-2 text-sm opacity-80 sm:text-base">
                {welcomeSubtitle}
              </p>
            )}
          </div>
        )}

        <div className="w-full">
          <Suspense fallback={null}>
            <LoginForm labels={labels} />
          </Suspense>
        </div>
      </div>
    </BrandingProvider>
  );
}
