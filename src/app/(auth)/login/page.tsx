import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

// Login form reads ?redirect=... via useSearchParams(). Forcing dynamic
// avoids the static prerender path entirely. The Suspense boundary is the
// belt-and-suspenders backup if Next.js ever tries to prerender anyway.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
