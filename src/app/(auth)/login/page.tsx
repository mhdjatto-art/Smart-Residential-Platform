import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { BrandingProvider, getBrandingByHost } from "@/components/layout/branding-provider";

export const metadata: Metadata = { title: "Sign in" };

// Login form reads ?redirect=... via useSearchParams(). Forcing dynamic
// avoids the static prerender path entirely. The Suspense boundary is the
// belt-and-suspenders backup if Next.js ever tries to prerender anyway.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // When accessed via a tenant custom domain, the host resolves to that org
  // and we render its logo + brand colors on the login screen.
  const brand = await getBrandingByHost();

  return (
    <BrandingProvider orgId={brand?.orgId ?? null}>
      {brand?.branding?.logo_path && (
        <div className="flex justify-center pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.branding.logo_path} alt="Logo" className="h-10 max-w-[220px] object-contain" />
        </div>
      )}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </BrandingProvider>
  );
}
