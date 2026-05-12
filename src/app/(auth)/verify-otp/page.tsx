import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = { title: "Verify code" };
export const dynamic = "force-dynamic";

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirect?: string }>;
}) {
  const sp = await searchParams;
  const email = sp.email;
  // If someone hits this URL without a pending email, send them back to /login
  // rather than rendering a broken form.
  if (!email) redirect("/login");

  return <OtpForm email={email} redirect={sp.redirect || "/dashboard"} />;
}
